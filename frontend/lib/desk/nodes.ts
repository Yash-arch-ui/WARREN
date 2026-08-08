/**
 * Static topology metadata — the canonical node set + ordered path edges.
 * Shared by useDeskModel (status folding) and TopologyGraph (layout).
 */
import type { NodeId } from "./contract";
import type { Lane, EventKind } from "../types";

export interface NodeMeta {
  id: NodeId;
  label: string;
  lane: Lane;
  /** which `node` values in the stream map onto this topology node. */
  sources: string[];
  /** What this node is trusted to know — the heart of the design. */
  knows: string;
}

export const NODE_META: NodeMeta[] = [
  {
    id: "sender",
    label: "This node",
    lane: "send",
    sources: ["sender"],
    knows: "the plaintext, the recipient, and the whole path",
  },
  {
    id: "issuer",
    label: "Token issuer",
    lane: "send",
    sources: ["issuer"],
    knows: "that a batch was minted — never which message spends which token",
  },
  {
    id: "entry",
    label: "Entry relay",
    lane: "send",
    sources: ["entry"],
    knows: "who sent it and the next hop — never the recipient or the content",
  },
  {
    id: "middle",
    label: "Middle relay",
    lane: "send",
    sources: ["middle"],
    knows: "two neighbouring relays — neither end of the conversation",
  },
  {
    id: "exit",
    label: "Exit relay",
    lane: "send",
    sources: ["exit"],
    knows: "the recipient and the previous hop — never the sender or the content",
  },
  {
    id: "recipient",
    label: "Recipient",
    lane: "receive",
    sources: ["recipient"],
    knows: "the plaintext and the sender's key — never the path it travelled",
  },
  {
    id: "directory",
    label: "Directory",
    lane: "send",
    sources: ["directory"],
    knows: "the signed relay list, attested by K of N independent signers",
  },
];

/**
 * The ordered path. `kind` marks what crosses each edge; `null` is an internal
 * step rather than a packet on the wire.
 */
export const EDGES: { from: NodeId; to: NodeId; kind: EventKind | null }[] = [
  { from: "directory", to: "sender", kind: "directory" },
  { from: "issuer", to: "sender", kind: "token" },
  { from: "sender", to: "entry", kind: "sphinx" },
  { from: "entry", to: "middle", kind: "sphinx" },
  { from: "middle", to: "exit", kind: "sphinx" },
  { from: "exit", to: "recipient", kind: "deliver" },
];

/** Map a raw stream `node` value to its NodeId (or null if unrecognized). */
export function nodeIdForSource(node: string): NodeId | null {
  const n = node.toLowerCase();
  const meta = NODE_META.find((m) => m.sources.includes(n));
  return meta?.id ?? null;
}
