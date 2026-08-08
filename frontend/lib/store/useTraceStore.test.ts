import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WireEvent, ConnectionState } from "../types";

/**
 * Unit tests for the single live trace store (lib/store/useTraceStore.ts).
 *
 * The store owns a MODULE-SCOPED adapter handle (not in zustand state). We mock
 * the adapter factory so no real EventSource/timers are touched: createAdapter
 * returns a fake { connect, disconnect } whose handlers we can capture and
 * replay. The module-scoped `adapter` guard (`if (adapter) return`) is the
 * behaviour under test for connect() idempotency, so we drive it through the
 * public connect()/disconnect() surface rather than poking the closure.
 */

const fakeAdapter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("../eventsource/adapter", () => ({
  createAdapter: vi.fn(() => fakeAdapter),
}));

// Import AFTER the mock is registered (vi.mock is hoisted, so a static import is
// safe - the store sees the mocked factory).
import { createAdapter } from "../eventsource/adapter";
import { useTraceStore } from "./useTraceStore";

const createAdapterMock = vi.mocked(createAdapter);

/** A realistic SSE frame; override per case. */
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
    detail: "",
    ...overrides,
  };
}

describe("useTraceStore", () => {
  beforeEach(() => {
    // Reset the store back to a clean, disconnected baseline. disconnect()
    // nulls the module-scoped adapter so each test starts with a fresh guard.
    useTraceStore.getState().disconnect();
    useTraceStore.setState({
      events: [],
      latestByNode: {},
      connection: "idle",
    });
    fakeAdapter.connect.mockReset();
    fakeAdapter.disconnect.mockReset();
    createAdapterMock.mockClear();
    createAdapterMock.mockReturnValue(fakeAdapter);
  });

  it("pushEvent appends to events AND tracks latestByNode per agent", () => {
    const a1 = ev({ node: "entry", detail: "first" });
    const a2 = ev({ node: "middle", detail: "second" });
    const a3 = ev({ node: "entry", detail: "third" });

    const { pushEvent } = useTraceStore.getState();
    pushEvent(a1);
    pushEvent(a2);
    pushEvent(a3);

    const s = useTraceStore.getState();
    // Appended in order, nothing dropped.
    expect(s.events).toEqual([a1, a2, a3]);
    expect(s.events).toHaveLength(3);
    // latestByNode keyed by topology node, holding the MOST RECENT frame.
    expect(s.latestByNode.middle).toBe(a2);
    expect(s.latestByNode.entry).toBe(a3);
    expect(Object.keys(s.latestByNode).sort()).toEqual([
      "entry",
      "middle",
    ]);
  });

  it("connect() opens the adapter once; a second connect() is a no-op", () => {
    const { connect } = useTraceStore.getState();
    connect();
    connect();

    // The module-scoped `if (adapter) return` guard means exactly one adapter is
    // created and connected - one long-lived EventSource, not abort+reopen.
    expect(createAdapterMock).toHaveBeenCalledTimes(1);
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(1);
  });

  it("connect() wires handlers that drive pushEvent and connection state", () => {
    useTraceStore.getState().connect();

    const handlers = fakeAdapter.connect.mock.calls[0][0] as {
      onEvent: (e: WireEvent) => void;
      onState: (s: ConnectionState) => void;
    };

    const frame = ev({ node: "recipient", detail: "reassembled" });
    handlers.onEvent(frame);
    handlers.onState("connected");

    const s = useTraceStore.getState();
    expect(s.events).toEqual([frame]);
    expect(s.latestByNode.recipient).toBe(frame);
    expect(s.connection).toBe("connected");
  });

  it("disconnect() tears down the adapter, nulls it, and idles the connection", () => {
    const { connect } = useTraceStore.getState();
    connect();
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(1);

    useTraceStore.getState().setConnection("connected");
    useTraceStore.getState().disconnect();

    expect(fakeAdapter.disconnect).toHaveBeenCalledTimes(1);
    expect(useTraceStore.getState().connection).toBe("idle");

    // Because disconnect() nulled the module adapter, a later connect() opens a
    // FRESH adapter (proves the guard was cleared).
    useTraceStore.getState().connect();
    expect(createAdapterMock).toHaveBeenCalledTimes(2);
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(2);
  });

  it("reset() clears events and latestByNode (but not the adapter)", () => {
    const { pushEvent, reset } = useTraceStore.getState();
    pushEvent(ev({ node: "exit" }));
    pushEvent(ev({ node: "recipient" }));
    expect(useTraceStore.getState().events).toHaveLength(2);

    reset();

    const s = useTraceStore.getState();
    expect(s.events).toEqual([]);
    expect(s.latestByNode).toEqual({});
  });
});
