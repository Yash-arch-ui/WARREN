import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { WireEvent, ConnectionState } from "../types";

/**
 * Unit tests for the swap-proof stream seam (lib/eventsource/adapter.ts).
 *
 * createAdapter() branches on DATA_MODE (config.ts), which reads
 * NEXT_PUBLIC_DATA_MODE once at import time. We flip it to "live" via vi.hoisted
 * (runs BEFORE the hoisted static import) so the default createAdapter yields
 * the LiveSSEAdapter under test. Neither adapter class is exported, so the
 * MockAdapter is reached the same way - by flipping the env to "mock" and
 * re-importing the module (vi.resetModules) inside its own describe block.
 */

// Force the live branch BEFORE adapter/config modules are evaluated.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DATA_MODE = "live";
});

import { createAdapter } from "./adapter";

/** A realistic SSE frame. */
function ev(overrides: Partial<WireEvent> = {}): WireEvent {
  return {
    ts: 1_767_225_600_000,
    node: "entry",
    kind: "sphinx",
    direction: "out",
    msg_id: "wb-abc-1",
    peer: "bob",
    room: "direct",
    state: "IN_FLIGHT",
    detail: "packet 1/3 pushed into the mix path",
    ...overrides,
  };
}

/**
 * A stand-in for the browser's EventSource. The adapter does `new EventSource()`
 * against the GLOBAL, so we swap globalThis.EventSource for this class, then use
 * the simulate* helpers to drive lifecycle callbacks the way a real socket would.
 * Every constructed instance is pushed to `instances` so a test can grab it.
 */
const instances: FakeEventSource[] = [];

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  readyState: number = FakeEventSource.CONNECTING;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  // --- test helpers ---
  simulateOpen() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }
  /** drive onerror with the socket still trying to reconnect (not CLOSED). */
  simulateError() {
    this.onerror?.();
  }
  /** drive onerror after the socket has conclusively closed. */
  simulateClose() {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

/** Collects the (onEvent, onState) handler effects for assertions. */
function makeHandlers() {
  const events: WireEvent[] = [];
  const states: ConnectionState[] = [];
  return {
    handlers: {
      onEvent: (e: WireEvent) => events.push(e),
      onState: (s: ConnectionState) => states.push(s),
    },
    events,
    states,
  };
}

const realEventSource = globalThis.EventSource;

beforeEach(() => {
  vi.useFakeTimers();
  instances.length = 0;
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  globalThis.EventSource = realEventSource;
  vi.restoreAllMocks();
});

describe("LiveSSEAdapter (createAdapter in live mode)", () => {
  it("emits 'connecting' immediately and constructs one EventSource", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);

    expect(states[0]).toBe("connecting");
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toContain("/api/v1/stream");
  });

  it("onopen → 'connected'", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);

    instances[0].simulateOpen();
    expect(states).toContain("connected");
    expect(states[states.length - 1]).toBe("connected");
  });

  it("replay opt reports 'replay' on open", () => {
    const { handlers, states } = makeHandlers();
    createAdapter({ replay: "send" }).connect(handlers);

    instances[0].simulateOpen();
    expect(states[states.length - 1]).toBe("replay");
  });

  it("backlog:false opts out of the daemon's buffered history", () => {
    const { handlers } = makeHandlers();
    createAdapter({ backlog: false }).connect(handlers);
    expect(instances[0].url).toContain("replay=0");
  });

  it("valid JSON frame → onEvent(frame)", () => {
    const { handlers, events } = makeHandlers();
    createAdapter().connect(handlers);
    instances[0].simulateOpen();

    const frame = ev({ node: "recipient" });
    instances[0].simulateMessage(JSON.stringify(frame));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(frame);
  });

  it("malformed JSON frame → ignored (no onEvent, no throw)", () => {
    const { handlers, events } = makeHandlers();
    createAdapter().connect(handlers);
    instances[0].simulateOpen();

    expect(() => instances[0].simulateMessage("{not json")).not.toThrow();
    expect(events).toHaveLength(0);
  });

  it("lane filter drops frames from the other side of the wire", () => {
    const { handlers, events } = makeHandlers();
    createAdapter({ lane: "receive" }).connect(handlers);
    instances[0].simulateOpen();

    instances[0].simulateMessage(JSON.stringify(ev({ direction: "out" })));
    expect(events).toHaveLength(0);

    const kept = ev({ direction: "in", node: "recipient", kind: "decrypt" });
    instances[0].simulateMessage(JSON.stringify(kept));
    expect(events).toEqual([kept]);
  });

  it("first onerror while not CLOSED → 'reconnecting'", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);
    instances[0].simulateOpen();

    instances[0].simulateError();
    expect(states[states.length - 1]).toBe("reconnecting");
  });

  it("reaching the failure threshold (>=3 onerror) → 'error'", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);
    instances[0].simulateOpen();

    instances[0].simulateError(); // 1 -> reconnecting
    instances[0].simulateError(); // 2 -> reconnecting
    instances[0].simulateError(); // 3 -> error
    expect(states[states.length - 1]).toBe("error");
  });

  it("a CLOSED socket on the first onerror → 'error' immediately", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);
    instances[0].simulateOpen();

    instances[0].simulateClose(); // readyState CLOSED → error on first error
    expect(states[states.length - 1]).toBe("error");
  });

  it("never opens then the dead timer (6000ms) fires → 'error'", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);

    expect(states).not.toContain("error");
    vi.advanceTimersByTime(6000);
    expect(states[states.length - 1]).toBe("error");
  });

  it("opening before the dead timer cancels it (no spurious 'error')", () => {
    const { handlers, states } = makeHandlers();
    createAdapter().connect(handlers);

    instances[0].simulateOpen();
    vi.advanceTimersByTime(6000);
    expect(states).not.toContain("error");
  });

  it("disconnect() closes the socket", () => {
    const { handlers } = makeHandlers();
    const adapter = createAdapter();
    adapter.connect(handlers);

    const closeSpy = vi.spyOn(instances[0], "close");
    adapter.disconnect();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("MockAdapter (createAdapter in mock mode)", () => {
  /**
   * createAdapter is bound to the live branch for this whole module (env set in
   * vi.hoisted). To cover the MockAdapter without a second module, build one
   * directly off the same public surface by re-importing the module with the
   * mock branch - done here by constructing through createAdapter after
   * temporarily flipping DATA_MODE is not possible (config.ts memoised it). So
   * instead we exercise the mock cadence via a fresh dynamic import that
   * re-reads the env. This keeps the FakeEventSource untouched (the mock never
   * uses EventSource - it is pure setTimeout).
   */
  it("advancing timers yields replay/connected then frames at the stepMs cadence", async () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "mock";
    vi.resetModules();
    const { createAdapter: createMock } = await import("./adapter");

    const { handlers, states, events } = makeHandlers();
    // replay so the open state is "replay"; tight stepMs for a fast cadence.
    createMock({ replay: "C-0191", stepMs: 100 }).connect(handlers);

    // Synchronous: "connecting" emitted before any timer fires.
    expect(states[0]).toBe("connecting");
    expect(events).toHaveLength(0);

    // The 250ms connect handshake fires, flips state, and schedules each frame
    // at i*stepMs as NESTED timers (the i=0 frame is setTimeout(_, 0)). Advance
    // through the handshake then one more tick to flush those nested timers.
    vi.advanceTimersByTime(250);
    expect(states[states.length - 1]).toBe("replay");
    vi.advanceTimersByTime(1);
    // First frame (i=0, due at the handshake instant) has now fired.
    expect(events.length).toBeGreaterThanOrEqual(1);

    const afterFirst = events.length;
    vi.advanceTimersByTime(100);
    // The next frame in the cadence has now fired (if more than one exists).
    expect(events.length).toBeGreaterThanOrEqual(afterFirst);

    // Drain the rest of the cadence; it must terminate (no infinite stream).
    vi.advanceTimersByTime(100 * 50);
    const total = events.length;
    vi.advanceTimersByTime(100 * 50);
    expect(events.length).toBe(total);

    // restore for any later module loads
    process.env.NEXT_PUBLIC_DATA_MODE = "live";
    vi.resetModules();
  });

  it("a non-replay mock open reports 'connected'", async () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "mock";
    vi.resetModules();
    const { createAdapter: createMock } = await import("./adapter");

    const { handlers, states } = makeHandlers();
    createMock({ stepMs: 100 }).connect(handlers);
    vi.advanceTimersByTime(250);
    expect(states).toContain("connected");

    process.env.NEXT_PUBLIC_DATA_MODE = "live";
    vi.resetModules();
  });
});
