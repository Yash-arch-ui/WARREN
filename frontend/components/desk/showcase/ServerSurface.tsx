"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * ServerSurface - report §10. The backend is a small FastAPI service the UI
 * talks to over a handful of REST endpoints + one live SSE stream. Left: the
 * endpoint table. Right: a live ActivityEvent ticker (the exact frame shape the
 * stream emits), frames appearing one at a time to sell "live". Reduced motion →
 * all frames shown static.
 */

type Endpoint = { method: string; path: string; what: string; mono?: boolean };
const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/stream", what: "Live trace of every agent action, desk-tagged · ?desk= · ?replay=<case>", mono: true },
  { method: "GET", path: "/cases · /cases/{id}", what: "List cases / one case in full (state, verdict, features, events)" },
  { method: "GET", path: "/cases/{id}/audit", what: "Hash-chain ledger rows + a freshly recomputed verified flag" },
  { method: "GET", path: "/rules · /stats", what: "Current rulebook / headline counts (flagged, escalated, active rules)" },
  { method: "POST", path: "/cases/{id}/confirm", what: "Human confirms escalation → derive + prove + codify a rule → FLAGGED" },
  { method: "POST", path: "/cases/{id}/reject", what: "Human dismisses escalation → case CLOSED, no rule written" },
  { method: "POST", path: "/demo/beat-a · /beat-b · /rnd", what: "One-click triggers for the two beats and a live adversary run" },
];

type Frame = { agent: string; model: string; desk: "surveillance" | "rnd"; content: string; t: string };
const FRAMES: Frame[] = [
  { agent: "Adversary", model: "Qwen3-Next-80B", desk: "rnd", content: "emitted layering scenario · Market #0", t: "09:41:00" },
  { agent: "AnomalyDetector", model: "deterministic", desk: "surveillance", content: "features · cancel_to_fill=0.94 depth=5", t: "09:41:02" },
  { agent: "Investigator", model: "Qwen3-Next-80B", desk: "surveillance", content: "▓ waiting on Band ▓ recruit @layer-spec", t: "09:41:04" },
  { agent: "Prosecution", model: "claude-sonnet-4-6", desk: "surveillance", content: "layered bids withdrawn pre-fill - intent to deceive", t: "09:41:07" },
  { agent: "RuleEngine", model: "deterministic", desk: "surveillance", content: "VERDICT PASS - 400ms slips the 100ms window", t: "09:41:09" },
  { agent: "EscalationManager", model: "gpt-5-mini", desk: "surveillance", content: "ESCALATION → human · recommend confirm", t: "09:41:10" },
];

function deskTone(desk: string) {
  return desk === "rnd" ? "var(--desk-rnd)" : "var(--desk-surv)";
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
          GET /stream · text/event-stream
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
              key={`${f.agent}-${f.t}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[8px] border px-3 py-2 font-mono text-[11px]"
              style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: deskTone(f.desk) }}>{f.agent}</span>
                <span style={{ color: "var(--text-faint)" }}>{f.t}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="shrink-0 text-[9.5px]" style={{ color: f.model === "deterministic" ? "var(--verdict-escalate)" : "var(--text-muted)" }}>
                  {f.model}
                </span>
                <span style={{ color: "var(--text-body)" }}>{f.content}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="border-t px-4 py-2 font-mono text-[9.5px]" style={{ borderColor: "var(--hairline)", color: "var(--text-faint)" }}>
        { "{ agent_name · model_id · desk · content · reasoning=null · tool_calls · created_at }" }
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
          The server surface · §10
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,48px)] font-light tracking-[-0.02em] leading-[1.06]"
        lines={[
          <span key="l1" id="desk-server-title" style={{ color: "var(--text-primary)" }}>
            A small FastAPI service.
          </span>,
          <span key="l2" style={{ color: "var(--text-faint)" }}>
            One live stream.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          The frontend talks to the backend through a handful of REST endpoints
          plus one live event stream - and that stream is the spine of the
          dashboard. One small JSON frame per agent action is all the UI needs to
          draw the whole trace.
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
