/**
 * The wire contract with `warren serve`.
 *
 * Field names mirror the daemon's JSON verbatim (see `src/api.rs`) so there is
 * no translation layer to drift: what Rust serializes is what these types say.
 */

/** Which side of the wire a view is showing. */
export type Lane = "send" | "receive";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "replay"
  | "error";

/**
 * A message's progress. Note there is no `ACKNOWLEDGED`: a mixnet sender gets
 * no delivery receipt, because a receipt travelling back along the path would
 * be exactly the correlation the design exists to prevent. `IN_FLIGHT` is the
 * terminal state a sender can honestly observe.
 */
export type MessageState =
  | "QUEUED"
  | "ENCRYPTED"
  | "IN_FLIGHT"
  | "DELIVERED"
  | "FAILED";

/** What a stream frame is reporting. */
export type EventKind =
  | "encrypt"
  | "token"
  | "sphinx"
  | "deliver"
  | "decrypt"
  | "reassemble"
  | "directory"
  | "error";

/** One line of the live wire trace (SSE `GET /api/v1/stream`). */
export interface WireEvent {
  /** epoch milliseconds — the daemon carries no date formatting. */
  ts: number;
  node: string;
  kind: EventKind;
  direction: "in" | "out";
  msg_id: string;
  peer: string;
  room: string;
  state: MessageState;
  detail: string;
}

/**
 * One hop of a verified path.
 *
 * Present only on messages this client **sent**: the path was checked against
 * the signed relay list and each relay's live self-signed claim before the
 * packet was built. A received message carries none, and that emptiness is the
 * anonymity property, not missing data.
 */
export interface Hop {
  index: number;
  role: "entry" | "middle" | "exit";
  addr: string;
  identity_key: string;
  sphinx_key: string;
}

/** A message as the desk shows it (`GET /api/v1/messages`). */
export interface Message {
  id: string;
  peer: string;
  room: string;
  direction: "sent" | "recv";
  state: MessageState;
  bytes: number;
  /** Sphinx packets this message occupied. */
  chunks: number;
  /** One admission token per packet, so this equals `chunks` on a send. */
  tokens_spent: number;
  /** SHA-256 over the ciphertext actually put on the wire. Empty on receive. */
  sha256: string;
  hops: Hop[];
  preview: string;
  error: string | null;
  created_at: number;
  updated_at: number;
}

/** A relay in the signed directory (`GET /api/v1/relays`). */
export interface RelayEntry {
  address: string;
  identity_key: string;
  sphinx_key: string;
  /** Non-null when this client routes through it. */
  role: "entry" | "middle" | "exit" | null;
  status: "IN_PATH" | "AVAILABLE";
}

/**
 * The directory and its trust policy. `threshold` of `signers` keys must have
 * attested the list (K-of-N) before this client will route through it; with no
 * keys configured the list is trusted on relay self-signatures alone.
 */
export interface Directory {
  entries: RelayEntry[];
  attestations: number;
  threshold: number;
  signers: number;
  policy_enforced: boolean;
}

/** Header counters (`GET /api/v1/stats`). */
export interface Stats {
  total_messages: number;
  by_state: Record<string, number>;
  sent: number;
  received: number;
  bytes: number;
  tokens_spent: number;
  tokens_remaining: number;
  relays_in_path: number;
  directory_entries: number;
}

/** A configured peer (`GET /api/v1/agent/peers`). */
export interface Peer {
  handle: string;
  /** Their long-term ratchet identity key, hex. */
  id: string;
  /** Where the exit relay delivers to them. */
  addr: string;
}

/** This node's own identity (`GET /api/v1/agent/me`). */
export interface Identity {
  identity: string;
  delivery_addr: string;
  tokens: number;
}

/** Mixnet health (`GET /api/v1/status`). */
export interface NodeStatus {
  relays: string[];
  directory_entries: number;
  directory_attestations: number;
  directory_threshold: number;
  directory_keys: number;
  tokens: number;
  /** Plaintext budget inside one Sphinx payload, in bytes. */
  max_msg_len: number;
  /**
   * Body bytes that actually fit in one packet — roughly half `max_msg_len`,
   * because the body travels hex-encoded. This is the number to divide by when
   * predicting packet (and therefore token) cost; `max_msg_len` would
   * under-count.
   */
  packet_payload_bytes: number;
}

/** `POST /api/v1/messages` response. */
export interface SendResponse {
  id: string;
}
