/**
 * The single seam between the desk data layer and every `/desk` component.
 *
 * Data flow:  fixtures | SSE → adapter → useTraceStore(events) → useDeskModel()
 *             folds raw events into the view-models below. Components read the
 *             view-models and call DeskController actions. Nothing touches raw
 *             WireEvents except useDeskModel itself.
 *
 * Swapping the data source (mock ↔ a live `warren serve`) changes only
 * model.ts / controller.ts — this contract and every component stay identical.
 */
import type {
  Hop,
  Lane,
  Message,
  MessageState,
  RelayEntry,
  Stats,
  EventKind,
} from "../types";

/** Canonical topology node ids, in path order. */
export type NodeId =
  | "directory" // the signed relay list, K-of-N attested
  | "issuer" // blind-signature admission tokens
  | "sender" // this node
  | "entry"
  | "middle"
  | "exit"
  | "recipient";

/** Per-node live status the TopologyGraph renders. */
export type NodeStatus = "idle" | "active" | "in_flight" | "done";

export interface NodeView {
  id: NodeId;
  label: string;
  lane: Lane;
  status: NodeStatus;
  /** latest human-readable line for this node, if any. */
  detail: string | null;
  /** what this node is trusted to learn — shown on the card. */
  knows: string;
}

/** A directed path edge between two nodes, lit when traffic flows. */
export interface EdgeView {
  from: NodeId;
  to: NodeId;
  /** what crosses it, or null for an internal step. */
  kind: EventKind | null;
  active: boolean;
}

/** The message currently on the desk (one-at-a-time model). */
export interface MessageView {
  id: string | null;
  state: MessageState | null;
  peer: string | null;
  room: string | null;
  direction: "sent" | "recv" | null;
  packets: number;
  tokensSpent: number;
}

/** The two ends of the conversation, for the identity panel. */
export interface EndpointsView {
  self: { handle: string; key: string; addr: string } | null;
  peer: { handle: string; key: string; addr: string } | null;
}

/** One trace-timeline dot. */
export interface TimelineDot {
  id: string;
  label: string;
  /** drives color: sent=blue token=amber hop=violet delivered=emerald error=red */
  tone: "sent" | "token" | "hop" | "delivered" | "cover" | "neutral" | "error";
  ts: string;
}

/** Everything a component needs, folded from the raw event stream. */
export interface DeskModel {
  message: MessageView;
  nodes: NodeView[];
  edges: EdgeView[];
  /** the signed relay directory, with this client's three hops marked. */
  relays: RelayEntry[];
  stats: Stats;
  endpoints: EndpointsView;
  timeline: TimelineDot[];
  /** recent traffic, newest first. */
  messages: Message[];
  /** node id currently lit, or null. */
  activeNode: NodeId | null;
  /** true while packets are on the mix path (drives the pulse). */
  inFlight: boolean;
  /** true once a message has fully reassembled on this node. */
  delivered: boolean;
}

/** Imperative desk actions. */
export interface DeskController {
  /** send a message to `peer` across the mix path. */
  send(peer: string, content: string): Promise<void>;
  /** replay the scripted outbound trace. */
  runSend(): void;
  /** replay the scripted inbound trace. */
  runReceive(): void;
  /** replay constant-rate cover traffic. */
  runCover(): void;
  /** mine a proof of work and mint a fresh token batch. */
  issueTokens(): Promise<void>;
  /** clear the stream and return to idle. */
  resetDesk(): void;
}

/**
 * Packet-detail drawer.
 *
 * `hops` is populated for messages this node sent and empty for ones it
 * received — a recipient genuinely cannot see the route, and the drawer says so
 * rather than leaving a blank panel.
 */
export interface TraceView {
  messageId: string | null;
  hops: Hop[];
  sha256: string | null;
  direction: "sent" | "recv" | null;
  /** true when the path is unknowable from this side, not merely unloaded. */
  pathHidden: boolean;
}
