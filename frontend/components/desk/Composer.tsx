"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController, DeskActionError } from "@/lib/desk/controller";
import { usePeers, useNodeStatus } from "@/lib/api/queries";
import { DEFAULT_PEER } from "@/lib/config";

/**
 * Composer - the only control that puts real traffic on the wire.
 *
 * Sending is not free and not instant: the body is split into Sphinx-sized
 * packets, each packet spends one blind-signed admission token, and each is
 * pushed into the entry relay separately. The panel says so before you click,
 * and the token balance visibly falls after.
 *
 * There is deliberately no delivery confirmation. The protocol gives the sender
 * no receipt — a receipt travelling back would be exactly the correlation the
 * mixnet exists to prevent — so the success state says "handed to the mix path"
 * and nothing stronger.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/**
 * Fallback body-bytes-per-packet, used only until the daemon answers.
 *
 * This is NOT the Sphinx payload size: the body is hex-encoded on the wire, so
 * a packet carries about half of it. Dividing by the raw payload size would
 * under-count packets and quote a cheaper price than the send actually costs.
 */
const FALLBACK_PACKET_BYTES = 315;

type Phase = "idle" | "sending" | "sent" | "issuing" | "error";

/** Map a failed POST to an inline reason. */
function reasonForStatus(status: number | null): string {
  switch (status) {
    case 409:
      return "out of tokens, unknown peer, or the path was refused";
    case 400:
      return "the daemon rejected the request body";
    case 404:
      return "endpoint not found — is this a current `warren serve`?";
    default:
      return "send failed — is `warren serve` running?";
  }
}

export default function Composer() {
  const reduce = useReducedMotion() ?? false;
  const model = useDeskModel();
  const controller = useDeskController();
  const peersQ = usePeers();
  const statusQ = useNodeStatus();
  const [peer, setPeer] = useState(DEFAULT_PEER);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "sending" || phase === "issuing";
  const bytes = new TextEncoder().encode(body).length;
  const perPacket = statusQ.data?.packet_payload_bytes || FALLBACK_PACKET_BYTES;
  const packets = Math.max(1, Math.ceil(bytes / perPacket));
  const tokens = model.stats.tokens_remaining;
  const shortOnTokens = tokens < packets;

  const onError = (err: unknown) => {
    const status = err instanceof DeskActionError ? err.status : null;
    setError(reasonForStatus(status));
    setPhase("error");
  };

  const onSend = async () => {
    if (busy || !body.trim()) return;
    setError(null);
    setPhase("sending");
    try {
      await controller.send(peer, body);
      setPhase("sent");
      setBody("");
    } catch (err) {
      onError(err);
    }
  };

  const onIssue = async () => {
    if (busy) return;
    setError(null);
    setPhase("issuing");
    try {
      await controller.issueTokens();
      setPhase("idle");
    } catch (err) {
      onError(err);
    }
  };

  const peers = peersQ.data ?? [];

  return (
    <section
      aria-label="Compose a message"
      className="rounded-[var(--r-card)] border p-4"
      style={{
        borderColor: shortOnTokens ? "var(--state-token)" : "var(--border-subtle)",
        background: "var(--bg-card)",
        boxShadow: reduce || !shortOnTokens ? undefined : "0 0 18px #f59e0b22",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--text-muted)" }}
        >
          Compose
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          {tokens} token{tokens === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="flex gap-2 mb-2">
        {peers.length > 0 ? (
          <select
            aria-label="Recipient"
            value={peer}
            onChange={(e) => setPeer(e.target.value)}
            className="font-mono text-[12px] rounded-[var(--r-chip)] px-2 py-1.5"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {peers.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.handle}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Recipient"
            value={peer}
            onChange={(e) => setPeer(e.target.value)}
            placeholder="peer handle"
            className="font-mono text-[12px] rounded-[var(--r-chip)] px-2 py-1.5 w-32"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        )}
      </div>

      <textarea
        aria-label="Message body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="message body…"
        className="w-full font-sans text-[13px] rounded-[var(--r-chip)] px-3 py-2 resize-y"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      />

      <p className="text-[11px] text-[var(--text-faint)] mt-2 mb-3 leading-relaxed font-mono">
        {bytes} B → {packets} packet{packets === 1 ? "" : "s"} → {packets} token
        {packets === 1 ? "" : "s"}
        {shortOnTokens ? " · not enough tokens" : ""}
      </p>

      <div className="flex gap-3">
        <motion.button
          type="button"
          onClick={onSend}
          disabled={busy || !body.trim() || shortOnTokens}
          aria-busy={phase === "sending"}
          whileTap={reduce ? undefined : { scale: 0.95 }}
          animate={phase === "sent" && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          // A multi-keyframe pop cannot use a spring — Motion only supports two
          // keyframes there — so the success beat is an eased tween.
          transition={
            phase === "sent"
              ? { duration: 0.36, ease: EASE, times: [0, 0.5, 1] }
              : { duration: 0.18, ease: EASE }
          }
          className="flex-1 rounded-[var(--r-chip)] px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-40"
          style={
            phase === "sent"
              ? { background: "var(--state-delivered)", color: "#04150d" }
              : { background: "var(--state-inflight)", color: "#04101f" }
          }
        >
          {phase === "sending"
            ? "encrypting…"
            : phase === "sent"
              ? "✓ handed to the mix path"
              : "Send"}
        </motion.button>

        <motion.button
          type="button"
          onClick={onIssue}
          disabled={busy}
          aria-busy={phase === "issuing"}
          whileTap={reduce ? undefined : { scale: 0.95 }}
          className="rounded-[var(--r-chip)] px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-40"
          style={{
            background: "transparent",
            border: "1px solid var(--state-token)",
            color: "var(--state-token)",
          }}
          title="Mine a proof of work and mint a fresh batch of blind-signed tokens"
        >
          {phase === "issuing" ? "mining…" : "Mint tokens"}
        </motion.button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-[12px] mt-3 leading-relaxed"
          style={{ color: "var(--state-failed)" }}
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
