/**
 * useDeskModel — folds the raw WireEvent stream (useTraceStore) into the
 * view-models in contract.ts: node status, message state, timeline, endpoints,
 * plus the relay directory and stats sourced from fixtures in mock mode and
 * from `warren serve` when live. Components must depend ONLY on the DeskModel
 * shape, never on these internals.
 */
"use client";

import { useMemo } from "react";
import { useTraceStore } from "../store/useTraceStore";
import { NODE_META, EDGES, nodeIdForSource } from "./nodes";
import { useStats, useRelays, useMessages, useIdentity, usePeers } from "../api/queries";
import { IS_MOCK } from "../config";
import { MOCK_DIRECTORY, MOCK_STATS } from "../fixtures/node";
import type {
  DeskModel,
  NodeView,
  NodeStatus,
  EdgeView,
  NodeId,
  TimelineDot,
  MessageView,
  EndpointsView,
} from "./contract";
import type { Message, RelayEntry, Stats, WireEvent } from "../types";

/**
 * DeskModel + live-health flags. contract.ts is the seam every component reads,
 * so the daemon-down affordance rides as an additive extension off
 * useDeskModel's return type. These are meaningful only in live mode; mock mode
 * reports them false.
 */
export interface DeskModelView extends DeskModel {
  /** GET /stats failed — tiles should show "—", not silent zeros. */
  statsError: boolean;
  /** GET /relays failed — the directory panel is unavailable. */
  relaysError: boolean;
}

const EMPTY_STATS: Stats = {
  total_messages: 0,
  by_state: {},
  sent: 0,
  received: 0,
  bytes: 0,
  tokens_spent: 0,
  tokens_remaining: 0,
  relays_in_path: 3,
  directory_entries: 0,
};

/** Latest event attributable to a topology node. */
function latestForNode(
  latestByNode: Record<string, WireEvent>,
  nodeId: NodeId,
): WireEvent | undefined {
  let best: WireEvent | undefined;
  for (const [name, ev] of Object.entries(latestByNode)) {
    if (nodeIdForSource(name) !== nodeId) continue;
    if (!best || ev.ts >= best.ts) best = ev;
  }
  return best;
}

function deriveMessage(events: WireEvent[]): MessageView {
  const view: MessageView = {
    id: null,
    state: null,
    peer: null,
    room: null,
    direction: null,
    packets: 0,
    tokensSpent: 0,
  };
  const packets = new Set<string>();
  for (const e of events) {
    if (e.msg_id) view.id = e.msg_id;
    if (e.peer) view.peer = e.peer;
    if (e.room) view.room = e.room;
    if (e.state) view.state = e.state;
    if (e.direction === "in") view.direction = "recv";
    else if (e.kind !== "directory") view.direction = "sent";
    if (e.kind === "token") view.tokensSpent += 1;
    // "packet 2/3 …" — count distinct packets seen for the current message.
    const m = /packet (\d+)\/(\d+)/.exec(e.detail);
    if (m) packets.add(`${e.msg_id}:${m[1]}`);
  }
  view.packets = packets.size;
  return view;
}

function deriveNodes(
  events: WireEvent[],
  latestByNode: Record<string, WireEvent>,
): { nodes: NodeView[]; activeNode: NodeId | null; inFlight: boolean } {
  const last = events[events.length - 1];
  const activeNode = last ? nodeIdForSource(last.node) : null;
  const seen = new Set(events.map((e) => nodeIdForSource(e.node)).filter(Boolean));
  // Packets are on the path from the first push into the entry relay until the
  // recipient reports a full reassembly — which, on the sending side, never
  // arrives. That asymmetry is the point, so the pulse simply stays on.
  const pushed = events.some((e) => e.kind === "sphinx");
  const settled = events.some((e) => e.kind === "reassemble" || e.kind === "error");
  const inFlight = pushed && !settled;

  const nodes: NodeView[] = NODE_META.map((meta) => {
    let status: NodeStatus = "idle";
    if (seen.has(meta.id)) status = "done";
    if (meta.id === activeNode) status = "active";
    if (inFlight && (meta.id === "entry" || meta.id === "middle" || meta.id === "exit")) {
      status = "in_flight";
    }
    const ev = latestForNode(latestByNode, meta.id);
    return {
      id: meta.id,
      label: meta.label,
      lane: meta.lane,
      status,
      detail: ev?.detail ?? null,
      knows: meta.knows,
    };
  });
  return { nodes, activeNode, inFlight };
}

function deriveEdges(events: WireEvent[]): EdgeView[] {
  const seen = new Set(events.map((e) => nodeIdForSource(e.node)).filter(Boolean));
  const lastId = events.length ? nodeIdForSource(events[events.length - 1].node) : null;
  return EDGES.map((edge) => ({
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    active: edge.to === lastId || (seen.has(edge.from) && seen.has(edge.to)),
  }));
}

function deriveTimeline(events: WireEvent[]): TimelineDot[] {
  const dots: TimelineDot[] = [];
  events.forEach((e, i) => {
    let tone: TimelineDot["tone"] | null = null;
    if (e.kind === "error") tone = "error";
    else if (e.room === "cover") tone = "cover";
    else if (e.kind === "token") tone = "token";
    else if (e.kind === "sphinx") tone = "hop";
    else if (e.kind === "reassemble") tone = "delivered";
    else if (e.kind === "encrypt") tone = "sent";
    if (tone) {
      dots.push({
        id: `${e.node}-${i}`,
        label: e.node,
        tone,
        ts: new Date(e.ts).toISOString(),
      });
    }
  });
  return dots;
}

function deriveEndpoints(
  identity: { identity: string; delivery_addr: string } | undefined,
  peers: { handle: string; id: string; addr: string }[] | undefined,
  peerLabel: string | null,
): EndpointsView {
  const peer = peers?.find((p) => p.handle === peerLabel) ?? peers?.[0] ?? null;
  return {
    self: identity
      ? { handle: "this node", key: identity.identity, addr: identity.delivery_addr }
      : null,
    peer: peer ? { handle: peer.handle, key: peer.id, addr: peer.addr } : null,
  };
}

export function useDeskModel(): DeskModelView {
  const events = useTraceStore((s) => s.events);
  const latestByNode = useTraceStore((s) => s.latestByNode);

  // Live sources — always called (Rules of Hooks), and harmless in mock mode
  // because the client returns bundled fixtures there.
  const relaysQ = useRelays();
  const statsQ = useStats();
  const messagesQ = useMessages();
  const identityQ = useIdentity();
  const peersQ = usePeers();

  const relays: RelayEntry[] = (IS_MOCK ? MOCK_DIRECTORY : relaysQ.data ?? MOCK_DIRECTORY).entries;
  const liveStats = statsQ.data;
  const messages: Message[] = messagesQ.data ?? [];

  const statsError = !IS_MOCK && statsQ.isError;
  const relaysError = !IS_MOCK && relaysQ.isError;

  return useMemo<DeskModelView>(() => {
    const messageView = deriveMessage(events);
    const { nodes, activeNode, inFlight } = deriveNodes(events, latestByNode);

    // stats: mock derives a single-message view from the fold; live uses
    // GET /stats verbatim.
    let stats: Stats;
    if (IS_MOCK || !liveStats) {
      const byState: Record<string, number> = {};
      if (messageView.state) byState[messageView.state] = 1;
      stats = {
        ...(IS_MOCK ? MOCK_STATS : EMPTY_STATS),
        total_messages: messageView.id ? 1 : 0,
        by_state: byState,
        tokens_spent: messageView.tokensSpent,
      };
    } else {
      stats = liveStats;
    }

    return {
      message: messageView,
      nodes,
      edges: deriveEdges(events),
      relays,
      stats,
      endpoints: deriveEndpoints(identityQ.data, peersQ.data, messageView.peer),
      timeline: deriveTimeline(events),
      messages,
      activeNode,
      inFlight,
      delivered: events.some((e) => e.kind === "reassemble"),
      statsError,
      relaysError,
    };
  }, [
    events,
    latestByNode,
    relays,
    liveStats,
    messages,
    identityQ.data,
    peersQ.data,
    statsError,
    relaysError,
  ]);
}
