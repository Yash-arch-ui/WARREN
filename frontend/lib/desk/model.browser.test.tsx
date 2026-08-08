import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Directory, Identity, Message, Peer, Stats, WireEvent } from "../types";

/**
 * useDeskModel folds the raw WireEvent stream (useTraceStore) + the REST
 * sources into the DeskModel view every component reads. These suites pin LIVE
 * mode (config mocked → IS_MOCK=false) so the query-driven branches — the
 * GET /stats counts and the statsError/relaysError health flags — are
 * exercised; the SSE fold (message/nodes/timeline) runs identically in both
 * modes.
 */

// LIVE mode: forces useDeskModel onto the query paths and makes
// statsError/relaysError (`!IS_MOCK && isError`) observable.
vi.mock("../config", () => ({
  DATA_MODE: "live",
  API_BASE: "http://127.0.0.1:8801",
  DEFAULT_PEER: "bob",
  IS_MOCK: false,
}));

// Drive the REST sources deterministically.
const useStatsMock = vi.fn();
const useRelaysMock = vi.fn();
const useMessagesMock = vi.fn();
const useIdentityMock = vi.fn();
const usePeersMock = vi.fn();
vi.mock("../api/queries", () => ({
  useStats: () => useStatsMock(),
  useRelays: () => useRelaysMock(),
  useMessages: () => useMessagesMock(),
  useIdentity: () => useIdentityMock(),
  usePeers: () => usePeersMock(),
}));

import { useDeskModel } from "./model";
import { useTraceStore } from "../store/useTraceStore";

/** Minimal UseQueryResult shim — only the fields useDeskModel reads. */
function q<T>(over: { data?: T; isError?: boolean } = {}): UseQueryResult<T> {
  return {
    data: over.data,
    isError: over.isError ?? false,
  } as UseQueryResult<T>;
}

/** A realistic wire frame; override per case. */
function ev(overrides: Partial<WireEvent> = {}): WireEvent {
  return {
    ts: 1_767_225_600_000,
    node: "sender",
    kind: "encrypt",
    direction: "out",
    msg_id: "wb-abc-1",
    peer: "bob",
    room: "direct",
    state: "QUEUED",
    detail: "1 482 B split into 3 packet(s) of at most 705 B",
    ...overrides,
  };
}

const STATS: Stats = {
  total_messages: 4,
  by_state: { IN_FLIGHT: 1, DELIVERED: 3 },
  sent: 2,
  received: 2,
  bytes: 5_312,
  tokens_spent: 14,
  tokens_remaining: 46,
  relays_in_path: 3,
  directory_entries: 3,
};

const DIRECTORY: Directory = {
  entries: [
    {
      address: "127.0.0.1:7001",
      identity_key: "aa".repeat(32),
      sphinx_key: "bb".repeat(32),
      role: "entry",
      status: "IN_PATH",
    },
  ],
  attestations: 2,
  threshold: 2,
  signers: 3,
  policy_enforced: true,
};

const IDENTITY: Identity = {
  identity: "cc".repeat(32),
  delivery_addr: "127.0.0.1:9001",
  tokens: 46,
};

const PEERS: Peer[] = [
  { handle: "bob", id: "dd".repeat(32), addr: "127.0.0.1:9002" },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function render() {
  return renderHook(() => useDeskModel(), { wrapper });
}

/** Push frames through the real store, as the adapter would. */
function feed(...frames: WireEvent[]) {
  const push = useTraceStore.getState().pushEvent;
  frames.forEach(push);
}

beforeEach(() => {
  cleanup();
  useTraceStore.getState().reset();
  useStatsMock.mockReturnValue(q<Stats>({ data: STATS }));
  useRelaysMock.mockReturnValue(q<Directory>({ data: DIRECTORY }));
  useMessagesMock.mockReturnValue(q<Message[]>({ data: [] }));
  useIdentityMock.mockReturnValue(q<Identity>({ data: IDENTITY }));
  usePeersMock.mockReturnValue(q<Peer[]>({ data: PEERS }));
});

describe("useDeskModel — the message fold", () => {
  it("is empty before any frame arrives", () => {
    const { result } = render();
    expect(result.current.message.id).toBeNull();
    expect(result.current.message.state).toBeNull();
    expect(result.current.activeNode).toBeNull();
    expect(result.current.inFlight).toBe(false);
  });

  it("tracks the message id, peer and state from the stream", () => {
    feed(ev(), ev({ node: "entry", kind: "sphinx", state: "IN_FLIGHT" }));
    const { result } = render();
    expect(result.current.message.id).toBe("wb-abc-1");
    expect(result.current.message.peer).toBe("bob");
    expect(result.current.message.state).toBe("IN_FLIGHT");
  });

  it("counts one token per packet", () => {
    feed(
      ev(),
      ev({ node: "issuer", kind: "token", detail: "packet 1/2: spent token" }),
      ev({ node: "issuer", kind: "token", detail: "packet 2/2: spent token" }),
    );
    const { result } = render();
    expect(result.current.message.tokensSpent).toBe(2);
    expect(result.current.message.packets).toBe(2);
  });
});

describe("useDeskModel — in-flight, the state a sender cannot leave", () => {
  it("goes in-flight once a packet is pushed into the entry relay", () => {
    feed(ev(), ev({ node: "entry", kind: "sphinx", state: "IN_FLIGHT" }));
    const { result } = render();
    expect(result.current.inFlight).toBe(true);
    expect(result.current.nodes.find((n) => n.id === "entry")?.status).toBe(
      "in_flight",
    );
  });

  it("STAYS in-flight after the exit hands off — there is no delivery receipt", () => {
    feed(
      ev(),
      ev({ node: "entry", kind: "sphinx", state: "IN_FLIGHT" }),
      ev({
        node: "exit",
        kind: "deliver",
        state: "IN_FLIGHT",
        detail: "handed to the mix path; delivery is unacknowledged by design",
      }),
    );
    const { result } = render();
    // A sender never learns the message landed. Anything else would be a lie.
    expect(result.current.inFlight).toBe(true);
    expect(result.current.delivered).toBe(false);
  });

  it("settles only on the receiving side, when packets reassemble", () => {
    feed(
      ev({ node: "recipient", kind: "decrypt", direction: "in", state: "IN_FLIGHT" }),
      ev({
        node: "recipient",
        kind: "reassemble",
        direction: "in",
        state: "DELIVERED",
        detail: "1 106 B reassembled from 3 packet(s); path unknown to the receiver",
      }),
    );
    const { result } = render();
    expect(result.current.delivered).toBe(true);
    expect(result.current.message.direction).toBe("recv");
  });
});

describe("useDeskModel — topology", () => {
  it("marks the newest frame's node active and seen nodes done", () => {
    feed(ev(), ev({ node: "entry", kind: "sphinx", state: "IN_FLIGHT" }));
    const { result } = render();
    expect(result.current.activeNode).toBe("entry");
    expect(result.current.nodes.find((n) => n.id === "sender")?.status).toBe("done");
  });

  it("carries what each node is trusted to know", () => {
    const { result } = render();
    const entry = result.current.nodes.find((n) => n.id === "entry");
    expect(entry?.knows).toContain("never the recipient");
  });

  it("lights an edge once both of its endpoints have been seen", () => {
    feed(ev(), ev({ node: "entry", kind: "sphinx" }));
    const { result } = render();
    const edge = result.current.edges.find(
      (e) => e.from === "sender" && e.to === "entry",
    );
    expect(edge?.active).toBe(true);
  });
});

describe("useDeskModel — timeline", () => {
  it("tones each frame by what it reports", () => {
    feed(
      ev(),
      ev({ node: "issuer", kind: "token" }),
      ev({ node: "entry", kind: "sphinx" }),
      ev({ node: "recipient", kind: "reassemble", direction: "in" }),
    );
    const { result } = render();
    expect(result.current.timeline.map((d) => d.tone)).toEqual([
      "sent",
      "token",
      "hop",
      "delivered",
    ]);
  });

  it("tones cover traffic apart from real sends", () => {
    feed(ev({ node: "entry", kind: "sphinx", room: "cover" }));
    const { result } = render();
    expect(result.current.timeline[0].tone).toBe("cover");
  });
});

describe("useDeskModel — REST sources and health", () => {
  it("uses the daemon's stats verbatim when live", () => {
    const { result } = render();
    expect(result.current.stats).toEqual(STATS);
    expect(result.current.statsError).toBe(false);
    expect(result.current.relaysError).toBe(false);
  });

  it("flags a failed stats query so tiles can show '—' instead of zeros", () => {
    useStatsMock.mockReturnValue(q<Stats>({ isError: true }));
    const { result } = render();
    expect(result.current.statsError).toBe(true);
  });

  it("flags a failed relays query independently", () => {
    useRelaysMock.mockReturnValue(q<Directory>({ isError: true }));
    const { result } = render();
    expect(result.current.relaysError).toBe(true);
  });

  it("resolves both endpoints from identity + peers", () => {
    feed(ev({ peer: "bob" }));
    const { result } = render();
    expect(result.current.endpoints.self?.key).toBe(IDENTITY.identity);
    expect(result.current.endpoints.peer?.handle).toBe("bob");
  });
});
