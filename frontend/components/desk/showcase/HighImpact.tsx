"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * HighImpact - three interactive "wow" demos, playable right on the page: a
 * tamper-test on a packet's trace (verified ✓→✗), wire-envelope tooltips per
 * hop, and an attestation ladder climbing toward K-of-N threshold. These
 * mirror the real desk affordances so the demo reads even before the live desk.
 */

/* ── tiny deterministic display hash (illustrative, not crypto) ──────────── */
function h(s: string): string {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  let y = (x ^ 0x9e3779b9) >>> 0;
  y = Math.imul(y, 2654435761) >>> 0;
  return (x.toString(16).padStart(8, "0") + y.toString(16).padStart(8, "0")).slice(0, 12);
}

/* ════════════════════════ 1 · TAMPER TEST ════════════════════════ */
type Leaf = { kind: string; content: string };
const BASE_LEAVES: Leaf[] = [
  { kind: "encrypt", content: "ratchet seals body · 305 B" },
  { kind: "token", content: "admission token spent · 1/packet" },
  { kind: "sphinx", content: "3 layers wrapped · entry/middle/exit" },
  { kind: "deliver", content: "reorder window · DELIVERED" },
];

function chainHashes(leaves: Leaf[]): string[] {
  const out: string[] = [];
  let prev = "genesis";
  for (const l of leaves) {
    const hash = h(prev + l.kind + l.content);
    out.push(hash);
    prev = hash;
  }
  return out;
}

function TamperTest() {
  const stored = useMemo(() => chainHashes(BASE_LEAVES), []);
  const [tampered, setTampered] = useState(false);
  const leaves = tampered
    ? BASE_LEAVES.map((l, i) => (i === 2 ? { ...l, content: "2 layers wrapped · exit skipped" } : l))
    : BASE_LEAVES;
  const live = chainHashes(leaves);
  const firstBreak = live.findIndex((hsh, i) => hsh !== stored[i]);
  const intact = firstBreak === -1;

  return (
    <div className="flex h-full flex-col rounded-[var(--r-card)] border p-5" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Tamper test</span>
        <span
          className="flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10.5px]"
          style={{
            color: intact ? "var(--verdict-complete)" : "var(--verdict-flag)",
            borderColor: (intact ? "var(--verdict-complete)" : "var(--verdict-flag)") + "55",
          }}
        >
          verify_path {intact ? "✓ verified" : "✗ broken"}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5">
        {leaves.map((l, i) => {
          const broken = !intact && firstBreak >= 0 && i >= firstBreak;
          const tone = broken ? "var(--verdict-flag)" : "var(--text-faint)";
          return (
            <div key={l.kind} className="flex items-center gap-2 rounded-[8px] border px-3 py-2" style={{ borderColor: broken ? "var(--verdict-flag)44" : "var(--hairline)", backgroundColor: "var(--bg-card-2)" }}>
              <span className="w-24 shrink-0 font-mono text-[10px]" style={{ color: i === 2 && tampered ? "var(--verdict-flag)" : "var(--desk-surv)" }}>{l.kind}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{l.content}</span>
              <span className="font-mono text-[10px]" style={{ color: tone }}>{live[i].slice(0, 8)}…</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setTampered((v) => !v)}
        className="mt-4 w-full rounded-[var(--r-pill)] py-2.5 font-sans text-[13px] font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: tampered ? "var(--bg-card-2)" : "var(--verdict-flag)", color: tampered ? "var(--text-primary)" : "#fff", border: tampered ? "1px solid var(--border-default)" : "none" }}
      >
        {tampered ? "↺ Restore the trace" : "Flip a byte in sphinx"}
      </button>
      <p className="mt-3 font-sans text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        Each leaf folds in the hash before it. Edit one byte and every link after
        it disagrees with the stored trace - the verified badge flips on the spot.
      </p>
    </div>
  );
}

/* ════════════════════════ 2 · WIRE ENVELOPE ════════════════════════ */
type Env = { kind: string; from: string; to: string };
const ENVELOPES: Env[] = [
  { kind: "token", from: "Sender", to: "Entry relay" },
  { kind: "sphinx", from: "Entry relay", to: "Middle relay" },
  { kind: "sphinx", from: "Middle relay", to: "Exit relay" },
  { kind: "deliver", from: "Exit relay", to: "Recipient" },
];

function BandEnvelope() {
  const [active, setActive] = useState(0);
  const e = ENVELOPES[active];
  const bmid = useMemo(() => h(e.kind + e.from + e.to), [e]);
  const sha = useMemo(() => h(e.kind + e.from + e.to + "content") + h(e.to + e.from), [e]);

  return (
    <div className="flex h-full flex-col rounded-[var(--r-card)] border p-5" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Wire envelope · hover a hop</span>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {ENVELOPES.map((env, i) => (
          <button
            key={env.kind}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="rounded-[var(--r-chip)] border px-2.5 py-1 font-mono text-[10px] transition-colors"
            style={{
              color: i === active ? "var(--band-blue)" : "var(--text-muted)",
              borderColor: i === active ? "var(--band-blue-dim)" : "var(--hairline)",
              backgroundColor: i === active ? "rgba(59,130,246,0.08)" : "transparent",
            }}
          >
            {env.kind}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 rounded-[10px] border p-4 font-mono text-[11px]" style={{ borderColor: "var(--band-blue-dim)", backgroundColor: "rgba(10,11,13,0.6)" }}>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--band-blue)" }}>Wire · {e.kind}</span>
          <span style={{ color: "var(--verdict-pass)" }}>● sealed</span>
        </div>
        <Row k="from → to" v={`${e.from} → ${e.to}`} />
        <Row k="event_id" v={bmid} />
        <Row k="sha256(content)" v={sha} />
        <Row k="direction" v="cross-hop · wire event" />
      </div>
      <p className="mt-3 font-sans text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        Every edge in the topology is a real wire event. Hovering it surfaces
        the exact envelope - what actually crossed between hops, node-tagged,
        nothing more.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3">
      <span style={{ color: "var(--text-faint)" }}>{k}</span>
      <span className="truncate" style={{ color: "var(--text-body)" }}>{v}</span>
    </div>
  );
}

/* ════════════════════════ 3 · ATTESTATION LADDER ════════════════════════ */
const TOTAL_SIGNERS = 5;
const THRESHOLD = 3;

function CoEvolutionLadder() {
  const reduce = useReducedMotion() ?? false;
  const [round, setRound] = useState(1); // each round adds a signer
  const rungs = Array.from({ length: round }, (_, i) => i); // 0..round-1
  const met = round >= THRESHOLD;

  return (
    <div className="flex h-full flex-col rounded-[var(--r-card)] border p-5" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Attestation ladder</span>
        <span className="rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10.5px]" style={{ color: met ? "var(--verdict-complete)" : "var(--verdict-escalate)", borderColor: (met ? "var(--verdict-complete)" : "var(--verdict-escalate)") + "55" }}>
          attestations · {round}/{TOTAL_SIGNERS}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col-reverse gap-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {rungs.map((r) => (
            <motion.div
              key={r}
              initial={reduce ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={reduce ? { duration: 0 } : { duration: 0.4 }}
              className="flex items-center gap-2.5"
              style={{ paddingLeft: `${r * 16}px` }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px]" style={{ border: "1.5px solid var(--desk-rnd)", color: "var(--desk-rnd)" }}>
                {r + 1}
              </span>
              <span className="rounded-[8px] border px-3 py-1.5 font-mono text-[10.5px]" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card-2)", color: "var(--text-body)" }}>
                <span style={{ color: "var(--desk-rnd)" }}>Signer {r + 1} attests</span>
                <span style={{ color: "var(--text-faint)" }}> → entry_set_hash matches → </span>
                <span style={{ color: "var(--verdict-complete)" }}>{r + 1}/{TOTAL_SIGNERS}{r + 1 >= THRESHOLD ? " · THRESHOLD" : ""}</span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => setRound((r) => Math.min(TOTAL_SIGNERS, r + 1))}
        disabled={round >= TOTAL_SIGNERS}
        className="mt-4 w-full rounded-[var(--r-pill)] py-2.5 font-sans text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--frost)", color: "var(--obsidian)" }}
      >
        {round >= TOTAL_SIGNERS ? "All signers attested" : "Collect next attestation ↑"}
      </button>
      <p className="mt-3 font-sans text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        Each independent signer adds one attestation. Once at least the
        threshold have signed, the directory is trusted - no single key,
        however many rounds, can substitute for it.
      </p>
    </div>
  );
}

export function HighImpact() {
  return (
    <section
      aria-labelledby="desk-highimpact-title"
      className="relative mx-auto px-6 py-28"
      style={{ maxWidth: "var(--maxw-content)", color: "var(--text-primary)" }}
    >
      <Reveal>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          High-impact features · interactive
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,48px)] font-light tracking-[-0.02em] leading-[1.06]"
        lines={[
          <span key="l1" id="desk-highimpact-title" style={{ color: "var(--text-primary)" }}>
            The moments that
          </span>,
          <span key="l2" style={{ color: "var(--text-faint)" }}>
            make it land.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          A few specific touches make the desk feel alive and unlike a generic
          dashboard. Try them right here - they behave exactly as they do on the
          live desk below.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Reveal delay={0.04}><div className="h-full"><TamperTest /></div></Reveal>
        <Reveal delay={0.08}><div className="h-full"><BandEnvelope /></div></Reveal>
        <Reveal delay={0.12}><div className="h-full"><CoEvolutionLadder /></div></Reveal>
      </div>
    </section>
  );
}
