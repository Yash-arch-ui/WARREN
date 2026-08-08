"use client";

/**
 * D2 - following one case, end to end (report Fig 2). A left→right relay across
 * three numbered phases: Triage → local Debate & resolve → Verdict. Agents never
 * call each other - each drops its work on Band and the next picks it up. Only
 * the three real Band messages (HANDOFF in, EVIDENCE, VERDICT) ride band-blue;
 * the Prosecution⚔Defense debate is LOCAL, off Band (neutral edges). The gold
 * rule engine is the sole PASS/FLAG authority. Self-draws on scroll-into-view.
 */

import { motion } from "framer-motion";
import {
  DiagramFrame,
  Node,
  EngineNode,
  Edge,
  Chip,
  Tag,
  EASE,
  type Pt,
} from "./kit";

/* ── layout constants (single source of geometry) ────────────────────────── */
const ROW = 150; // primary relay row (centre-y of the triage / engine cards)
const NODE_H = 52;

// Phase 1 · Triage
const SRC = { x: 36, y: 124, w: 150, h: NODE_H }; // sanitized order events
const ANOM = { x: 226, y: 124, w: 156, h: NODE_H }; // Anomaly Detector
const INV = { x: 226, y: 230, w: 156, h: 58 }; // Investigator
const SPEC = { x: 226, y: 330, w: 156, h: 58 }; // Specialist

// Phase 2 · Debate & resolve (bordered box, off Band)
const DEBATE = { x: 452, y: 196, w: 296, h: 198 };
const PROS = { x: 472, y: 244, w: 122, h: 46 };
const DEF = { x: 606, y: 244, w: 122, h: 46 };
const ADJ = { x: 472, y: 320, w: 256, h: 56 }; // Adjudicator

// Phase 3 · Verdict
const ENGINE = { x: 806, y: 124, w: 240, h: 66 }; // EngineNode
const ESC = { x: 806, y: 330, w: 240, h: 58 }; // Escalation Manager
const FLAG = { x: 814, y: 232, w: 224, h: 30 }; // FLAG chip (centred under the engine)
const BAND_OUT = { x: 1066, y: 345, w: 96, h: 28 }; // VERDICT lands back on Band

/* phase band positions */
const PHASES: { x: number; n: string; label: string }[] = [
  { x: 36, n: "1", label: "TRIAGE" },
  { x: 452, n: "2", label: "DEBATE & RESOLVE · off Band" },
  { x: 822, n: "3", label: "VERDICT" },
];

/* ── local helper: a phase eyebrow (number + tracked mono label) ──────────── */
function PhaseHead({
  x,
  n,
  label,
  show,
  reduce,
  delay,
}: {
  x: number;
  n: string;
  label: string;
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <rect x={x} y={62} width={26} height={26} rx={6} fill="var(--bg-inset)" stroke="var(--border-default)" strokeWidth={1} />
      <text x={x + 13} y={80} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={700} fill="var(--text-primary)">
        {n}
      </text>
      <text x={x + 38} y={80} className="font-mono" fontSize={11} fontWeight={600} letterSpacing="0.16em" fill="var(--text-muted)">
        {label}
      </text>
    </motion.g>
  );
}

/* edge anchor helpers (so geometry reads from the layout constants) */
const rightMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w, y: r.y + r.h / 2 });
const leftMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x, y: r.y + r.h / 2 });
const topMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y });
const bottomMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h });

export function CaseRelayDiagram({
  className = "",
  staticMode = false,
}: {
  className?: string;
  staticMode?: boolean;
}) {
  return (
    <DiagramFrame
      className={className}
      staticMode={staticMode}
      viewBox="0 0 1200 520"
      amount={0.25}
      label="Following one surveillance case end to end across three phases. Phase 1 Triage: sanitized order events arrive on Band as a HANDOFF; the Anomaly Detector computes features and flags suspicious flow; the Investigator @mention-recruits the right Specialist, who proposes the contested inputs the engine cannot derive - time window, bona-fide orders, intent. Phase 2 Debate and resolve runs locally off Band: Prosecution and Defense argue, and the Adjudicator resolves one conservative set of engine inputs; the Specialist's contribution reaches the debate as a Band EVIDENCE message. Phase 3 Verdict: the deterministic rule engine runs the active rules on the resolved inputs and renders FLAG with the rule id and cited metric, flagging the case; the Escalation Manager packages the brief and recommends an action, emitted on Band as a VERDICT. Agents never call each other - each drops its work on Band and the next picks it up; the rule engine is the sole PASS/FLAG authority."
    >
      {(show, reduce) => (
        <>
          {/* phase eyebrows */}
          {PHASES.map((p, i) => (
            <PhaseHead key={p.n} x={p.x} n={p.n} label={p.label} show={show} reduce={reduce} delay={0.05 + i * 0.06} />
          ))}

          {/* faint phase separators */}
          <motion.line
            x1={416}
            y1={56}
            x2={416}
            y2={464}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 7"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.7 } : undefined}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          />
          <motion.line
            x1={788}
            y1={56}
            x2={788}
            y2={464}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 7"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.7 } : undefined}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          />

          {/* ── Phase 1 · Triage nodes ───────────────────────────────── */}
          <Node x={SRC.x} y={SRC.y} w={SRC.w} h={SRC.h} title="Sanitized" sub="order events" tone="neutral" titleMono delay={0.3} show={show} reduce={reduce} />
          <Node x={ANOM.x} y={ANOM.y} w={ANOM.w} h={ANOM.h} title="Anomaly Detector" sub="features → suspicious?" tone="surv" titleMono delay={0.4} show={show} reduce={reduce} />
          <Node x={INV.x} y={INV.y} w={INV.w} h={INV.h} title="Investigator" sub="recruits a specialist" tone="surv" titleMono delay={0.48} show={show} reduce={reduce} />
          <Node x={SPEC.x} y={SPEC.y} w={SPEC.w} h={SPEC.h} title="Specialist" sub="window · bona-fide · intent" tone="surv" titleMono delay={0.56} show={show} reduce={reduce} />

          {/* ── Phase 2 · Debate box (local, off Band) ───────────────── */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.55, delay: 0.62, ease: EASE }}
          >
            <rect x={DEBATE.x} y={DEBATE.y} width={DEBATE.w} height={DEBATE.h} rx={14} fill="color-mix(in srgb, var(--text-faint) 4%, transparent)" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="5 5" opacity={0.85} />
            <text x={DEBATE.x + DEBATE.w / 2} y={DEBATE.y + 24} textAnchor="middle" className="font-mono" fontSize={10.5} fontStyle="italic" letterSpacing="0.04em" fill="var(--text-muted)">
              local debate · off Band
            </text>
          </motion.g>
          <Node x={PROS.x} y={PROS.y} w={PROS.w} h={PROS.h} title="Prosecution" tone="surv" titleMono delay={0.68} show={show} reduce={reduce} />
          <Node x={DEF.x} y={DEF.y} w={DEF.w} h={DEF.h} title="Defense" tone="surv" titleMono delay={0.72} show={show} reduce={reduce} />
          <Node x={ADJ.x} y={ADJ.y} w={ADJ.w} h={ADJ.h} title="Adjudicator" sub="resolves one conservative input set" tone="surv" titleMono delay={0.78} show={show} reduce={reduce} />

          {/* ── Phase 3 · Verdict ────────────────────────────────────── */}
          <EngineNode x={ENGINE.x} y={ENGINE.y} w={ENGINE.w} h={ENGINE.h} sub="runs the active rules · deterministic" delay={0.9} show={show} reduce={reduce} />
          <Chip x={FLAG.x} y={FLAG.y} w={FLAG.w} h={FLAG.h} label="FLAG · rule_id + metric → FLAGGED" tone="flag" delay={1.02} show={show} reduce={reduce} />
          <Node x={ESC.x} y={ESC.y} w={ESC.w} h={ESC.h} title="Escalation Manager" sub="packages brief · recommends action" tone="surv" titleMono delay={0.98} show={show} reduce={reduce} />
          <Chip x={BAND_OUT.x} y={BAND_OUT.y} w={BAND_OUT.w} h={BAND_OUT.h} label="→ Band" tone="band" delay={1.14} show={show} reduce={reduce} />

          {/* ── edges (drawn after nodes, in reading order) ──────────── */}
          {/* Band HANDOFF into the desk (the one real inbound Band message) */}
          <Edge from={rightMid(SRC)} to={leftMid(ANOM)} mode="straight" tone="band" label="HANDOFF" pulse width={1.8} delay={0.62} show={show} reduce={reduce} />

          {/* triage relay (local @mention handoffs down the line) */}
          <Edge from={bottomMid(ANOM)} to={topMid(INV)} mode="straight" tone="neutral" delay={0.7} show={show} reduce={reduce} />
          <Edge from={bottomMid(INV)} to={topMid(SPEC)} mode="straight" tone="neutral" label="@mention recruit" delay={0.76} show={show} reduce={reduce} />

          {/* Specialist → debate: the EVIDENCE Band message */}
          <Edge from={rightMid(SPEC)} to={leftMid(ADJ)} mode="mid-h" tone="band" label="EVIDENCE" pulse width={1.8} delay={0.82} show={show} reduce={reduce} />

          {/* debate internals (local, neutral) */}
          <Edge from={bottomMid(PROS)} to={{ x: ADJ.x + 70, y: ADJ.y }} mode="mid-v" tone="neutral" delay={0.86} show={show} reduce={reduce} />
          <Edge from={bottomMid(DEF)} to={{ x: ADJ.x + ADJ.w - 70, y: ADJ.y }} mode="mid-v" tone="neutral" delay={0.9} show={show} reduce={reduce} />

          {/* Adjudicator → Engine: resolved inputs (local handoff, neutral) */}
          <Edge from={rightMid(ADJ)} to={{ x: ENGINE.x, y: ENGINE.y + ENGINE.h - 14 }} mode="mid-h" tone="neutral" label="resolved inputs" delay={0.96} show={show} reduce={reduce} />

          {/* Engine → FLAG verdict (internal) */}
          <Edge from={bottomMid(ENGINE)} to={{ x: FLAG.x + FLAG.w / 2, y: FLAG.y }} mode="straight" tone="flag" delay={1.04} show={show} reduce={reduce} />

          {/* FLAG → Escalation Manager */}
          <Edge from={{ x: FLAG.x + FLAG.w / 2, y: FLAG.y + FLAG.h }} to={topMid(ESC)} mode="straight" tone="flag" delay={1.1} show={show} reduce={reduce} />

          {/* Escalation Manager → out on Band: the VERDICT message */}
          <Edge from={rightMid(ESC)} to={leftMid(BAND_OUT)} mode="straight" tone="band" label="VERDICT" pulse width={1.8} delay={1.16} show={show} reduce={reduce} />

          {/* footer caption: the law of this figure */}
          <Tag x={600} y={494} text="agents never call each other - each drops work on Band, the next picks it up · LLMs argue, code decides" tone="neutral" anchor="middle" delay={1.24} show={show} reduce={reduce} />
        </>
      )}
    </DiagramFrame>
  );
}

export default CaseRelayDiagram;
