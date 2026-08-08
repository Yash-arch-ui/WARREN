"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import { useIsMobile } from "@/components/landing/useIsMobile";

/**
 * PipelineFlow - "The flow". The opener: one case's journey through the eight
 * agents + rule engine, end to end (report §05, D5/D6). Every handoff that
 * crosses Band is drawn in the sacred blue with its message kind (HANDOFF ·
 * EVIDENCE · VERDICT · ESCALATION · RULE_CODIFIED); the Prosecution⚔Defense
 * debate is marked "off Band" - it runs locally.
 *
 * Desktop: a PINNED stage - the section holds in place while a tall runway gives
 * scroll distance, so as you scroll the steps build up one at a time (the column
 * advances, the active beat sits centred and bright, the rest dim). Reduced
 * motion / mobile: a plain stacked list, no pin.
 */

type Step = {
  node: string;
  accent: string;
  tier?: string;
  desc: string;
  state?: string;
  local?: boolean;
  emit?: string; // Band message kind on the connector BELOW this step
  emitNote?: string;
};

const STEPS: Step[] = [
  {
    node: "Order flow in",
    accent: "var(--desk-rnd)",
    desc: "Sanitized order events cross the Chinese wall - no reasoning, no model. The case opens.",
    state: "OPEN",
    emit: "HANDOFF",
    emitNote: "order events",
  },
  {
    node: "Anomaly Detector",
    accent: "var(--desk-surv)",
    tier: "open",
    desc: "Computes cancel-to-fill, book depth and self-match. Clean flow closes; suspicious flow moves on.",
    state: "UNDER_REVIEW",
  },
  {
    node: "Investigator",
    accent: "var(--desk-surv)",
    tier: "open",
    desc: "Opens the inquiry and recruits the right domain specialist over Band.",
    emit: "HANDOFF",
    emitNote: "recruit a specialist",
  },
  {
    node: "Specialist",
    accent: "var(--desk-surv)",
    tier: "open",
    desc: "Proposes the contested inputs the engine can't derive - the window, the bona-fide orders, the intent.",
    emit: "EVIDENCE",
    emitNote: "contested inputs",
  },
  {
    node: "Prosecution ⚔ Defense",
    accent: "var(--desk-surv)",
    local: true,
    desc: "Two agents argue manipulation vs. legitimate trading. This debate runs locally - it never touches Band.",
  },
  {
    node: "Adjudicator",
    accent: "var(--desk-surv)",
    tier: "open",
    desc: "Resolves the dispute into one conservative set of engine-ready numbers.",
  },
  {
    node: "Rule Engine",
    accent: "var(--verdict-escalate)",
    tier: "deterministic",
    desc: "Runs the active rules - same inputs, same answer. A FLAG ends the case; a PASS on suspicious flow escalates.",
    emit: "VERDICT",
    emitNote: "PASS or FLAG",
  },
  {
    node: "Escalation Manager",
    accent: "var(--verdict-escalate)",
    tier: "frontier",
    desc: "When the rulebook misses, packages a clear brief for the human and recommends an action.",
    state: "ESCALATED",
    emit: "ESCALATION",
    emitNote: "human briefing",
  },
  {
    node: "Human confirms → codify",
    accent: "var(--band-blue)",
    desc: "On confirm, a new rule is derived, regression-proven and codified. The rulebook grows 4 ▸ 5.",
    state: "FLAGGED",
    emit: "RULE_CODIFIED",
    emitNote: "new rule + proof",
  },
];

const TOTAL = STEPS.length;
const STEP_H = 184; // fixed block height (card + connector) for the pinned build
const CARD_H = 124;

function MiniTier({ tier }: { tier: string }) {
  const tone =
    tier === "frontier"
      ? "var(--tier-frontier)"
      : tier === "deterministic"
        ? "var(--verdict-escalate)"
        : "var(--tier-open)";
  return (
    <span className="font-mono text-[10px]" style={{ color: tone }}>
      ▸ {tier}
    </span>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div
      className="w-full rounded-[var(--r-card)] border p-5"
      style={{ minHeight: CARD_H, borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px]"
            style={{ border: `1.5px solid ${step.accent}`, color: step.accent }}
          >
            {index + 1}
          </span>
          <h3 className="font-sans" style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            {step.node}
          </h3>
        </div>
        <div className="flex items-center gap-2.5">
          {step.tier ? <MiniTier tier={step.tier} /> : null}
          {step.local ? (
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              local · off Band
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 font-sans" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-body)" }}>
        {step.desc}
      </p>
      {step.state ? (
        <span
          className="mt-3 inline-block rounded-[var(--r-chip)] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ backgroundColor: "var(--bg-card-2)", color: "var(--text-muted)" }}
        >
          state · {step.state}
        </span>
      ) : null}
    </div>
  );
}

function Connector({ emit, note, reduce }: { emit?: string; note?: string; reduce: boolean }) {
  const isBand = Boolean(emit);
  return (
    <div className="relative mx-auto flex h-14 w-full items-center justify-center">
      <span
        className="absolute top-0 h-full w-px"
        style={{
          left: "calc(50% - 0.5px)",
          backgroundColor: isBand ? "var(--band-blue)" : "var(--border-default)",
          opacity: isBand ? 0.45 : 0.6,
        }}
      />
      {isBand && !reduce ? (
        <motion.span
          className="absolute top-0 h-2 w-2 rounded-full"
          style={{ left: "calc(50% - 4px)", backgroundColor: "var(--band-blue)", boxShadow: "0 0 8px var(--band-blue)" }}
          animate={{ y: [0, 48], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      ) : null}
      {isBand ? (
        <span
          className="relative z-10 inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2.5 py-1 font-mono text-[10px]"
          style={{ backgroundColor: "var(--bg-page)", color: "var(--band-blue)", borderColor: "var(--band-blue-dim)" }}
        >
          <span aria-hidden="true">Band</span>
          <span style={{ color: "var(--text-primary)" }}>{emit}</span>
          {note ? <span style={{ color: "var(--text-muted)" }}>· {note}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

/* ── intro heading, shared by both paths ─────────────────────────────────── */
function Heading() {
  return (
    <>
      <Reveal>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          The flow · how it works
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,44px)] font-light tracking-[-0.02em] leading-[1.08]"
        lines={[
          <span key="l1" id="hiw-pipeline-title" style={{ color: "var(--text-primary)" }}>
            Follow one case,
          </span>,
          <span key="l2" style={{ color: "var(--text-muted)" }}>
            end to end.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          Eight agents and one rule engine move a case from raw orders to a
          sealed verdict - and they never call each other directly. Each drops
          its work onto Band; the next picks it up. Scroll to watch the handoffs,
          one by one. (We’ll meet the two desks and every agent just below.)
        </p>
      </Reveal>
    </>
  );
}

/* ── one block in the pinned build - opacity/scale track the active beat ─── */
function StepBlock({ t, index, step, reduce }: { t: MotionValue<number>; index: number; step: Step; reduce: boolean }) {
  const opacity = useTransform(t, (v) => {
    const d = Math.abs(v * (TOTAL - 1) - index);
    if (d <= 0.5) return 1;
    return Math.max(0.12, 1 - (d - 0.5) * 0.72);
  });
  const scale = useTransform(t, (v) => {
    const d = Math.abs(v * (TOTAL - 1) - index);
    return Math.max(0.95, 1 - d * 0.035);
  });
  return (
    <motion.div style={{ height: STEP_H, opacity, scale }} className="origin-center">
      <StepCard step={step} index={index} />
      {index < TOTAL - 1 ? <Connector emit={step.emit} note={step.emitNote} reduce={reduce} /> : null}
    </motion.div>
  );
}

/* ── desktop: pinned build-up ────────────────────────────────────────────── */
function PinnedPipeline({ reduce }: { reduce: boolean }) {
  const runwayRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(0);

  const { scrollYProgress } = useScroll({ target: runwayRef, offset: ["start start", "end end"] });
  const t = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.0001 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // translate the column so the active beat (t·(TOTAL-1)) sits ~44% down.
  const olY = useTransform(t, (v) => {
    if (!viewportH) return 0;
    const active = v * (TOTAL - 1);
    return viewportH * 0.44 - STEP_H / 2 - active * STEP_H;
  });
  const stepLabel = useTransform(t, (v) => {
    const i = Math.min(TOTAL, Math.max(1, Math.round(v * (TOTAL - 1)) + 1));
    return `${i} / ${TOTAL}`;
  });

  return (
    <div ref={runwayRef} className="relative" style={{ height: `${TOTAL * 32 + 40}vh` }}>
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <div className="mx-auto w-full px-6" style={{ maxWidth: "var(--maxw-content)" }}>
          <div className="pt-12">
            <Heading />
          </div>
        </div>

        {/* the building flow */}
        <div ref={viewportRef} className="relative mt-6 w-full flex-1 overflow-hidden">
          {/* progress counter */}
          <div className="pointer-events-none absolute right-6 top-3 z-10 font-mono text-[10px] tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            <span style={{ color: "var(--desk-surv)" }}>STEP </span>
            <motion.span>{stepLabel}</motion.span>
          </div>
          <motion.ol className="absolute inset-x-0 top-0 mx-auto w-full max-w-xl px-6" style={{ y: olY }}>
            {STEPS.map((step, i) => (
              <li key={step.node}>
                <StepBlock t={t} index={i} step={step} reduce={reduce} />
              </li>
            ))}
          </motion.ol>
        </div>
      </div>
    </div>
  );
}

/* ── reduced-motion / mobile: plain stacked list ─────────────────────────── */
function StaticPipeline({ reduce }: { reduce: boolean }) {
  return (
    <div className="mx-auto px-6" style={{ maxWidth: "var(--maxw-content)" }}>
      <Heading />
      <ol className="mx-auto mt-12 w-full max-w-xl">
        {STEPS.map((step, i) => (
          <li key={step.node}>
            <Reveal delay={Math.min(0.03 * i, 0.18)}>
              <StepCard step={step} index={i} />
            </Reveal>
            {i < STEPS.length - 1 ? <Connector emit={step.emit} note={step.emitNote} reduce={reduce} /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PipelineFlow() {
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  return (
    <section
      aria-labelledby="hiw-pipeline-title"
      className="pb-24"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      {reduce || isMobile === true ? <StaticPipeline reduce={reduce} /> : <PinnedPipeline reduce={reduce} />}
      <Reveal delay={0.05}>
        <p className="mx-auto mt-12 max-w-xl px-6 text-center font-sans" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
          Only the blue links travel over Band; the Prosecution⚔Defense debate
          runs locally. Every Band message is also sealed into the hash-chained
          audit ledger the instant it is sent.
        </p>
      </Reveal>
    </section>
  );
}
