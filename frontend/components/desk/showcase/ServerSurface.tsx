"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * ServerSurface - the backend is a small Rust daemon (`warren serve`) the UI
 * talks to over a handful of REST endpoints + one live SSE stream. Left: the
 * endpoint table. Right: a live event ticker (the exact frame shape the
 * stream emits), frames appearing one at a time to sell "live". Reduced motion →
 * all frames shown static.
 */

type Endpoint = { method: string; path: string; what: string; mono?: boolean };
const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/v1/stream", what: "Live event feed, node-tagged · encrypt/token/sphinx/deliver/decrypt/reassemble/directory/error", mono: true },
  { method: "GET", path: "/api/v1/agent/me · /peers", what: "This node's identity / known peers and their ratchet keys" },
  { method: "GET", path: "/api/v1/status · /relays", what: "Node status (packet_payload_bytes, max_msg_len) / the K-of-N attested relay directory" },
  { method: "GET", path: "/api/v1/messages · /messages/{id}", what: "List messages / one message in full (state, hops, chunks)" },
  { method: "GET", path: "/api/v1/stats", what: "Headline counts (sent, delivered, tokens spent, relays known)" },
  { method: "POST", path: "/api/v1/messages", what: "Send: chunks into Sphinx packets, spends one token per packet" },
  { method: "POST", path: "/api/v1/ratchet/init · /tokens/issue", what: "Init a ratchet session with a peer / mine PoW and issue a token batch" },
];

type Frame = { kind: string; hop: string; side: "local" | "wire"; content: string; t: string };
const FRAMES: Frame[] = [
  { kind: "token", hop: "sender", side: "local", content: "admission token spent · 1/packet", t: "09:41:00" },
  { kind: "encrypt", hop: "sender", side: "local", content: "ratchet seals body · 305 B", t: "09:41:01" },
  { kind: "sphinx", hop: "entry", side: "wire", content: "layer peeled · forward → middle", t: "09:41:02" },
  { kind: "sphinx", hop: "middle", side: "wire", content: "layer peeled · forward → exit", t: "09:41:04" },
  { kind: "sphinx", hop: "exit", side: "wire", content: "final layer peeled · forward → recipient", t: "09:41:06" },
  { kind: "deliver", hop: "recipient", side: "wire", content: "reorder window closed · DELIVERED", t: "09:41:08" },
];

function sideTone(side: string) {
  return side === "local" ? "var(--desk-rnd)" : "var(--desk-surv)";
}

function StreamPanel({ reduce }: { reduce: boolean }) {
  const [n, setN] = useState(reduce ? FRAMES.length : 1);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setN((v) => (v >= FRAMES.length ? 1 : v + 1)), 1500);
    return () => clearInterval(id);
  }, [reduce]);
  const shown = FRAMES.slice(0, n).slice(-5);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[var(--r-card)] border"
      style={{ borderColor: "var(--hairline)", backgroundColor: "rgba(10,11,13,0.7)", backdropFilter: "blur(6px)" }}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--hairline)" }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--desk-surv)" }}>
          GET /api/v1/stream · text/event-stream
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--verdict-pass)" }} />
          streaming
        </span>
      </div>
      <div className="flex-1 space-y-2 p-4">
        <AnimatePresence initial={false}>
          {shown.map((f) => (
            <motion.div
              key={`${f.kind}-${f.t}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[8px] border px-3 py-2 font-mono text-[11px]"
              style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: sideTone(f.side) }}>{f.kind}</span>
                <span style={{ color: "var(--text-faint)" }}>{f.t}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="shrink-0 text-[9.5px]" style={{ color: "var(--verdict-escalate)" }}>
                  {f.hop}
                </span>
                <span style={{ color: "var(--text-body)" }}>{f.content}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="border-t px-4 py-2 font-mono text-[9.5px]" style={{ borderColor: "var(--hairline)", color: "var(--text-faint)" }}>
        { "{ kind · node · hop · content · created_at }" }
      </div>
    </div>
  );
}

export function ServerSurface() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section
      aria-labelledby="desk-server-title"
      className="relative mx-auto px-6 py-28"
      style={{ maxWidth: "var(--maxw-content)", color: "var(--text-primary)" }}
    >
      <Reveal>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          The server surface
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,48px)] font-light tracking-[-0.02em] leading-[1.06]"
        lines={[
          <span key="l1" id="desk-server-title" style={{ color: "var(--text-primary)" }}>
            A small Rust daemon.
          </span>,
          <span key="l2" style={{ color: "var(--text-faint)" }}>
            One live stream.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          The frontend talks to warren serve through a handful of REST
          endpoints plus one live event stream - and that stream is the spine
          of the desk. One small JSON frame per protocol event is all the UI
          needs to draw the whole trace.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* endpoints */}
        <div className="flex flex-col overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
          {ENDPOINTS.map((e, i) => (
            <Reveal key={e.path} delay={0.03 * i}>
              <div
                className="flex flex-col gap-1 px-5 py-3.5"
                style={{ borderTop: i ? "1px solid var(--hairline)" : "none" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="rounded-[4px] px-1.5 py-[2px] font-mono text-[9.5px] font-medium"
                    style={{
                      color: e.method === "POST" ? "var(--verdict-escalate)" : "var(--verdict-pass)",
                      border: `1px solid ${e.method === "POST" ? "var(--verdict-escalate)" : "var(--verdict-pass)"}44`,
                    }}
                  >
                    {e.method}
                  </span>
                  <code className="font-mono text-[12.5px]" style={{ color: "var(--text-primary)" }}>{e.path}</code>
                </div>
                <span className="font-sans text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {e.what}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* live stream */}
        <Reveal delay={0.06}>
          <div className="h-full min-h-[360px]">
            <StreamPanel reduce={reduce} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
