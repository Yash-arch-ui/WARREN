import { API_BASE, IS_MOCK } from "../config";
import type {
  Directory,
  Identity,
  Message,
  NodeStatus,
  Peer,
  SendResponse,
  Stats,
  WireEvent,
} from "../types";
import { MOCK_DIRECTORY, MOCK_IDENTITY, MOCK_PEERS, MOCK_STATS, MOCK_STATUS } from "../fixtures/node";

/**
 * REST client for `warren serve`.
 *
 * In mock mode it returns bundled fixtures so the UI renders with no daemon.
 * Set NEXT_PUBLIC_DATA_MODE=live to drive a real node.
 */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  const body = await res.json();
  // The daemon wraps every payload in `{ "data": ... }`.
  return (body?.data ?? body) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  const parsed = await res.json();
  return (parsed?.data ?? parsed) as T;
}

export const api = {
  me: () => (IS_MOCK ? Promise.resolve(MOCK_IDENTITY) : get<Identity>("/api/v1/agent/me")),
  peers: () => (IS_MOCK ? Promise.resolve(MOCK_PEERS) : get<Peer[]>("/api/v1/agent/peers")),
  status: () => (IS_MOCK ? Promise.resolve(MOCK_STATUS) : get<NodeStatus>("/api/v1/status")),
  stats: () => (IS_MOCK ? Promise.resolve(MOCK_STATS) : get<Stats>("/api/v1/stats")),
  relays: () => (IS_MOCK ? Promise.resolve(MOCK_DIRECTORY) : get<Directory>("/api/v1/relays")),
  messages: () => (IS_MOCK ? Promise.resolve<Message[]>([]) : get<Message[]>("/api/v1/messages")),
  message: (id: string) => get<Message>(`/api/v1/messages/${id}`),
  /** Backlog of the live trace, for a page load that arrives mid-session. */
  events: () => (IS_MOCK ? Promise.resolve<WireEvent[]>([]) : get<WireEvent[]>("/api/v1/events")),

  /** Encrypt, spend one token per packet, and push into the entry relay. */
  send: (peer: string, content: string, room = "direct") =>
    post<SendResponse>("/api/v1/messages", { peer, content, room }),

  /** Mine a proof of work and mint a batch of blind-signed admission tokens. */
  issueTokens: (count = 10) => post<{ detail: string }>("/api/v1/tokens/issue", { count }),
};
