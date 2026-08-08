"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskUIStore } from "@/lib/desk/uiStore";
import type { EndpointsView } from "@/lib/desk/contract";

/**
 * EndpointCards - the two ends of the conversation, side by side.
 *
 * The contrast is the point: the LOCAL card shows key material that never
 * leaves this machine, the PEER card shows only what was exchanged out of band
 * to open a session. Nothing in the middle of the network sees either card's
 * contents, which is why the relays get their own panel and these two do not
 * mention them.
 *
 * Reads `model.endpoints`; shows an empty state until the daemon answers.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Side = "sender" | "recipient";

const SIDE_META: Record<
  Side,
  { title: string; icon: string; accent: string; accentDim: string; xFrom: number }
> = {
  sender: {
    title: "This node",
    icon: "◆",
    accent: "var(--lane-local)",
    accentDim: "var(--border-default)",
    xFrom: -16,
  },
  recipient: {
    title: "Peer",
    icon: "◇",
    accent: "var(--lane-network)",
    accentDim: "var(--border-default)",
    xFrom: 16,
  },
};

type Endpoint = { handle: string; key: string; addr: string } | null;

/** Shorten a 64-char hex key to something readable but still identifying. */
function shortKey(key: string): string {
  return key.length > 20 ? `${key.slice(0, 10)}…${key.slice(-8)}` : key;
}

function EndpointCard({
  side,
  endpoint,
  reduce,
}: {
  side: Side;
  endpoint: Endpoint;
  reduce: boolean;
}) {
  const meta = SIDE_META[side];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: meta.xFrom }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="w-full min-w-0 rounded-[var(--r-card)] border bg-[var(--bg-card)] p-4 sm:w-[400px] sm:min-h-[350px]"
      style={{ borderColor: meta.accentDim }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: meta.accent }}
        >
          <span aria-hidden className="text-[13px] leading-none">
            {meta.icon}
          </span>
          {meta.title}
        </span>
        {endpoint ? (
          <span className="font-mono text-[10px] text-[var(--text-faint)]">
            {endpoint.handle}
          </span>
        ) : null}
      </div>

      {endpoint ? (
        <>
          <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text-faint)" }}>
            identity key
          </p>
          <p
            className="font-mono text-sm font-medium text-[var(--text-primary)] leading-snug break-all"
            title={endpoint.key}
          >
            {shortKey(endpoint.key)}
          </p>
          <p className="font-mono text-[10px] mt-3 mb-1" style={{ color: "var(--text-faint)" }}>
            delivery address
          </p>
          <p className="font-mono text-[12px] text-[var(--text-body)] leading-relaxed">
            {endpoint.addr}
          </p>
          <p className="text-[12px] text-[var(--text-body)] mt-4 leading-relaxed">
            {side === "sender"
              ? "The long-term ratchet key and wallet live on this machine only. The daemon that holds them binds to loopback."
              : "Exchanged out of band to open the Double Ratchet session. No relay on the path ever learns it."}
          </p>
        </>
      ) : (
        <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">
          awaiting {meta.title.toLowerCase()} identity…
        </p>
      )}
    </motion.div>
  );
}

/** Free-text test over an endpoint's surfaced fields (null-safe). */
function endpointMatchesQuery(e: Endpoint, q: string): boolean {
  if (!q) return true;
  if (!e) return false;
  return [e.handle, e.key, e.addr].some((f) => (f ?? "").toLowerCase().includes(q));
}

export default function EndpointCards() {
  const reduce = useReducedMotion() ?? false;
  const endpoints: EndpointsView = useDeskModel().endpoints;
  const nodeFilter = useDeskUIStore((s) => s.nodeFilter);
  const query = useDeskUIStore((s) => s.query);

  // Node filter: each side is its own NodeId, so show only the selected side
  // when the filter targets one of them, and hide the panel when it targets a
  // relay. Query: keep only sides whose identity matches.
  const q = query.trim().toLowerCase();
  const nodeAllows = (side: Side) => !nodeFilter || nodeFilter === side;
  const showSender =
    nodeAllows("sender") && endpointMatchesQuery(endpoints.self, q);
  const showRecipient =
    nodeAllows("recipient") && endpointMatchesQuery(endpoints.peer, q);

  // The filter narrowed the desk to a relay (or text with no endpoint hit) —
  // drop the whole panel rather than render two empty placeholders.
  if (!showSender && !showRecipient) return null;

  return (
    <section aria-label="Conversation endpoints">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Endpoints
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          local ◆ peer
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        {showSender ? (
          <EndpointCard side="sender" endpoint={endpoints.self} reduce={reduce} />
        ) : null}
        {showRecipient ? (
          <EndpointCard side="recipient" endpoint={endpoints.peer} reduce={reduce} />
        ) : null}
      </div>
    </section>
  );
}
