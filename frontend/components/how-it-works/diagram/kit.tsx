"use client";

/**
 * Diagram kit - the shared SVG primitives every /how-it-works diagram is built
 * from, so the four native schematics (architecture, oracle-loop, verdict, trust)
 * read as one family and match the site idiom (cf. landing OverviewSection's
 * self-drawing nonagon). Diagrams self-DRAW on scroll-into-view (not scrubbed);
 * `useReducedMotion` renders the final state instantly.
 *
 * Rules baked in:
 *  - band-blue is sacred: only `tone="band"` edges/pulses use it (= "on Band").
 *  - the rule engine is the authority: `EngineNode` is the only gold-ringed node.
 *  - verdict colours keep their meaning (pass=emerald, flag=red, escalate=amber).
 * All colour comes from tokens; nothing here hard-codes a hex.
 */

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export type Pt = { x: number; y: number };
export type Tone =
  | "band"
  | "rnd"
  | "surv"
  | "engine"
  | "flag"
  | "pass"
  | "escalate"
  | "human"
  | "neutral";

export const TONE: Record<Tone, string> = {
  band: "var(--band-blue)",
  rnd: "var(--desk-rnd)",
  surv: "var(--desk-surv)",
  engine: "var(--tier-frontier)",
  flag: "var(--verdict-flag)",
  pass: "var(--verdict-pass)",
  escalate: "var(--verdict-escalate)",
  human: "var(--verdict-escalate)",
  neutral: "var(--text-faint)",
};

/* ── frame: a ref'd <svg> that reveals its children when scrolled into view ──
   children is a render-prop receiving (show, reduce). */
export function DiagramFrame({
  viewBox,
  label,
  className = "",
  amount = 0.3,
  staticMode = false,
  children,
}: {
  viewBox: string;
  label: string;
  className?: string;
  amount?: number;
  /** Render the final (fully-drawn) state immediately, skipping the scroll-in
   *  self-draw. Used when the diagram lives inside a transformed/animated
   *  container (e.g. the hero laptop) where useInView can't fire reliably and a
   *  half-drawn diagram would read as blank. */
  staticMode?: boolean;
  children: (show: boolean, reduce: boolean) => ReactNode;
}) {
  const rm = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduce = staticMode || rm;
  const show = staticMode || reduce || inView;
  return (
    <div ref={ref} className={className}>
      <svg viewBox={viewBox} className="h-auto w-full" role="img" aria-label={label}>
        <DiagramDefs />
        {children(show, reduce)}
      </svg>
    </div>
  );
}

/* ── arrowhead markers, one per tone ──────────────────────────────────────── */
const MARKER_TONES: Tone[] = ["band", "neutral", "flag", "pass", "escalate", "rnd", "surv"];
export function DiagramDefs() {
  return (
    <defs>
      {MARKER_TONES.map((t) => (
        <marker
          key={t}
          id={`hk-arrow-${t}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={TONE[t]} />
        </marker>
      ))}
    </defs>
  );
}

/* ── self-drawing path (the OverviewSection pathLength idiom) ──────────────── */
export function TracePath({
  d,
  tone = "neutral",
  width = 1.5,
  dashed = false,
  opacity = 1,
  delay = 0,
  duration = 1.1,
  arrow = false,
  show,
  reduce,
}: {
  d: string;
  tone?: Tone;
  width?: number;
  dashed?: boolean;
  opacity?: number;
  delay?: number;
  duration?: number;
  arrow?: boolean;
  show: boolean;
  reduce: boolean;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={TONE[tone]}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={dashed ? "5 5" : undefined}
      opacity={opacity}
      markerEnd={arrow ? `url(#hk-arrow-${tone})` : undefined}
      initial={reduce ? false : { pathLength: 0 }}
      animate={show ? { pathLength: 1 } : undefined}
      transition={{ duration, delay, ease: EASE }}
    />
  );
}

/* ── orthogonal edge between two points ───────────────────────────────────── */
type EdgeMode = "straight" | "hv" | "vh" | "mid-h" | "mid-v";
export function edgePath(from: Pt, to: Pt, mode: EdgeMode = "mid-h"): string {
  const { x: x1, y: y1 } = from;
  const { x: x2, y: y2 } = to;
  switch (mode) {
    case "straight":
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    case "hv":
      return `M ${x1} ${y1} H ${x2} V ${y2}`;
    case "vh":
      return `M ${x1} ${y1} V ${y2} H ${x2}`;
    case "mid-v": {
      const my = (y1 + y2) / 2;
      return `M ${x1} ${y1} V ${my} H ${x2} V ${y2}`;
    }
    case "mid-h":
    default: {
      const mx = (x1 + x2) / 2;
      return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
    }
  }
}

export function Edge({
  from,
  to,
  mode = "mid-h",
  tone = "neutral",
  label,
  dashed = false,
  width = 1.5,
  delay = 0,
  pulse = false,
  show,
  reduce,
}: {
  from: Pt;
  to: Pt;
  mode?: EdgeMode;
  tone?: Tone;
  label?: string;
  dashed?: boolean;
  width?: number;
  delay?: number;
  pulse?: boolean;
  show: boolean;
  reduce: boolean;
}) {
  const d = edgePath(from, to, mode);
  const lx = (from.x + to.x) / 2;
  const ly = (from.y + to.y) / 2;
  return (
    <g>
      <TracePath d={d} tone={tone} width={width} dashed={dashed} arrow delay={delay} show={show} reduce={reduce} />
      {pulse && tone === "band" && <BandPulse path={d} show={show} reduce={reduce} delay={delay + 0.4} />}
      {label && (
        <motion.text
          x={lx}
          y={ly - 6}
          textAnchor="middle"
          className="font-mono"
          fontSize={11}
          letterSpacing="0.04em"
          fill={tone === "band" ? "var(--band-blue)" : "var(--text-muted)"}
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.4, delay: delay + 0.5 }}
        >
          {label}
        </motion.text>
      )}
    </g>
  );
}

/* ── a band-blue pulse dot riding a path (= live "on Band" cue) ───────────── */
export function BandPulse({
  path,
  show,
  reduce,
  dur = 1.6,
}: {
  path: string;
  show: boolean;
  reduce: boolean;
  dur?: number;
  delay?: number;
}) {
  if (reduce || !show) return null;
  return (
    <circle r={3.4} fill="var(--band-blue)">
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

/* ── a generic node card ──────────────────────────────────────────────────── */
export function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  tone = "surv",
  delay = 0,
  show,
  reduce,
  titleMono = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  tone?: Tone;
  delay?: number;
  show: boolean;
  reduce: boolean;
  titleMono?: boolean;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <rect x={x} y={y} width={w} height={h} rx={11} fill="var(--bg-card)" stroke={TONE[tone]} strokeWidth={1.2} />
      <rect x={x} y={y} width={3} height={h} rx={1.5} fill={TONE[tone]} opacity={0.9} />
      <text
        x={x + 16}
        y={sub ? y + h / 2 - 3 : y + h / 2 + 4}
        className={titleMono ? "font-mono" : "font-sans"}
        fontSize={titleMono ? 12.5 : 14}
        fontWeight={600}
        fill="var(--text-primary)"
      >
        {title}
      </text>
      {sub && (
        <text x={x + 16} y={y + h / 2 + 15} className="font-mono" fontSize={10.5} fill="var(--text-muted)">
          {sub}
        </text>
      )}
    </motion.g>
  );
}

/* ── the rule engine: the ONE gold-ringed authority node ──────────────────── */
export function EngineNode({
  x,
  y,
  w,
  h,
  title = "RULE ENGINE",
  sub = "sole PASS / FLAG authority · deterministic",
  delay = 0,
  show,
  reduce,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  sub?: string;
  delay?: number;
  show: boolean;
  reduce: boolean;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={show ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.55, delay, ease: EASE }}
      style={{ transformOrigin: `${x + w / 2}px ${y + h / 2}px` }}
    >
      {/* soft gold authority glow - a slightly larger rounded rect behind the card */}
      <rect
        x={x - 5}
        y={y - 5}
        width={w + 10}
        height={h + 10}
        rx={15}
        fill="none"
        stroke="var(--tier-frontier)"
        strokeWidth={6}
        opacity={0.16}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill="color-mix(in srgb, var(--tier-frontier) 12%, var(--obsidian))"
        stroke="var(--tier-frontier)"
        strokeWidth={3}
      />
      <text x={x + w / 2} y={y + h / 2 - 6} textAnchor="middle" className="font-mono" fontSize={14} fontWeight={700} letterSpacing="0.12em" fill="var(--frost)">
        {title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className="font-mono" fontSize={10.5} fill="var(--tier-frontier)">
        {sub}
      </text>
    </motion.g>
  );
}

/* ── a decision diamond (oracle / branch) ─────────────────────────────────── */
export function Diamond({
  cx,
  cy,
  rw,
  rh,
  title,
  sub,
  tone = "rnd",
  delay = 0,
  show,
  reduce,
}: {
  cx: number;
  cy: number;
  rw: number;
  rh: number;
  title: string;
  sub?: string;
  tone?: Tone;
  delay?: number;
  show: boolean;
  reduce: boolean;
}) {
  const pts = `${cx} ${cy - rh}, ${cx + rw} ${cy}, ${cx} ${cy + rh}, ${cx - rw} ${cy}`;
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={show ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <polygon points={pts} fill="var(--bg-card)" stroke={TONE[tone]} strokeWidth={1.2} />
      <text x={cx} y={sub ? cy - 2 : cy + 4} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} fill="var(--text-primary)">
        {title}
      </text>
      {sub && (
        <text x={cx} y={cy + 14} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--text-muted)">
          {sub}
        </text>
      )}
    </motion.g>
  );
}

/* ── a small verdict / status chip ────────────────────────────────────────── */
export function Chip({
  x,
  y,
  w,
  h = 26,
  label,
  tone = "neutral",
  delay = 0,
  show,
  reduce,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  tone?: Tone;
  delay?: number;
  show: boolean;
  reduce: boolean;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.4, delay, ease: EASE }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        fill={`color-mix(in srgb, ${TONE[tone]} 14%, var(--bg-card))`}
        stroke={TONE[tone]}
        strokeWidth={1}
      />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={TONE[tone]}>
        {label}
      </text>
    </motion.g>
  );
}

/* ── a free-floating SVG caption label ────────────────────────────────────── */
export function Tag({
  x,
  y,
  text,
  tone = "neutral",
  anchor = "start",
  delay = 0,
  show,
  reduce,
}: {
  x: number;
  y: number;
  text: string;
  tone?: Tone;
  anchor?: "start" | "middle" | "end";
  delay?: number;
  show: boolean;
  reduce: boolean;
}) {
  return (
    <motion.text
      x={x}
      y={y}
      textAnchor={anchor}
      className="font-mono"
      fontSize={11}
      letterSpacing="0.06em"
      fill={tone === "neutral" ? "var(--text-muted)" : TONE[tone]}
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.4, delay }}
    >
      {text}
    </motion.text>
  );
}
