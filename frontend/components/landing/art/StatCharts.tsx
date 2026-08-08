"use client";

import { motion } from "framer-motion";

/**
 * StatCharts - the three monochrome proof-charts under each <WhySection/> stat,
 * rebuilt reference: white-capped gradient bars, a
 * filled trend with a dashed comparison line, and an axis chart with floating
 * readout tooltips. Pure white/gray on obsidian (no colour accents).
 *
 *  - deterministic geometry (no Math.random) → SSR == client.
 *  - props: `start` (reveal), `reduce` (prefers-reduced-motion → final state),
 *    `active` (the column is hovered/expanded → reveal the extra readouts).
 *
 * Shared viewBox 260×150.
 */

const VW = 260;
const VH = 150;
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type P = { start: boolean; reduce: boolean; active: boolean };

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {children}
    </svg>
  );
}

/* smooth (quadratic-midpoint) path through [x,y] points */
function smooth(pts: ReadonlyArray<readonly [number, number]>): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/* ── 1 · detection bars - white-capped, gradient body ──────────────────────── */
const BARS = [0.46, 0.66, 0.4, 0.74, 0.56, 0.88, 0.5, 0.64, 0.8, 0.54, 0.92, 0.7, 0.84];

export function BarSignal({ start, reduce }: P) {
  const padX = 6;
  const baseY = VH - 14;
  const topY = 16;
  const plotW = VW - padX * 2;
  const plotH = baseY - topY;
  const slot = plotW / BARS.length;
  const bw = slot * 0.62;
  return (
    <Svg>
      <defs>
        <linearGradient id="sc-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.015)" />
        </linearGradient>
      </defs>
      <line x1={padX} y1={baseY} x2={VW - padX} y2={baseY} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      {BARS.map((v, i) => {
        const bx = padX + i * slot + (slot - bw) / 2;
        const bh = v * plotH;
        const by = baseY - bh;
        return (
          <motion.g
            key={i}
            initial={reduce ? false : { scaleY: 0 }}
            animate={start ? { scaleY: 1 } : reduce ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.03, ease: EASE }}
            style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
          >
            <rect x={bx} y={by} width={bw} height={bh} fill="url(#sc-bar)" />
            <line x1={bx} y1={by} x2={bx + bw} y2={by} stroke="var(--frost)" strokeWidth="1.6" />
          </motion.g>
        );
      })}
    </Svg>
  );
}

/* ── 2 · defense trend - filled area, white line, dashed comparison ────────── */
const MAIN = [0.34, 0.5, 0.42, 0.46, 0.7, 0.58, 0.64, 0.56, 0.72, 0.62, 0.8, 0.74, 0.96];
const COMP = [0.3, 0.4, 0.5, 0.44, 0.58, 0.66, 0.54, 0.62, 0.6, 0.7, 0.68, 0.82, 0.86];

export function AreaRamp({ start, reduce, active }: P) {
  const padX = 6;
  const baseY = VH - 14;
  const topY = 20;
  const plotW = VW - padX * 2;
  const plotH = baseY - topY;
  const X = (i: number) => padX + (i * plotW) / (MAIN.length - 1);
  const Y = (v: number) => baseY - v * plotH;
  const mainPts = MAIN.map((v, i) => [X(i), Y(v)] as const);
  const compPts = COMP.map((v, i) => [X(i), Y(v)] as const);
  const line = smooth(mainPts);
  const area = `${line} L${X(MAIN.length - 1).toFixed(1)} ${baseY} L${padX} ${baseY} Z`;
  const mk = 4; // marker index
  return (
    <Svg>
      <defs>
        <linearGradient id="sc-ramp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <line x1={padX} y1={baseY} x2={VW - padX} y2={baseY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <motion.path
        d={area}
        fill="url(#sc-ramp)"
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      />
      {/* dashed comparison series */}
      <motion.path
        d={smooth(compPts)}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.3"
        strokeDasharray="4 4"
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.1, delay: 0.1, ease: EASE }}
      />
      {/* main white line */}
      <motion.path
        d={line}
        fill="none"
        stroke="var(--frost)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      {/* readout marker - fades up when the column is active/expanded */}
      <motion.g initial={false} animate={{ opacity: active ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
        <line x1={X(mk)} y1={Y(MAIN[mk])} x2={X(mk)} y2={baseY} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <circle cx={X(mk)} cy={Y(MAIN[mk])} r="3.4" fill="var(--obsidian)" stroke="var(--frost)" strokeWidth="1.6" />
      </motion.g>
    </Svg>
  );
}

/* ── 3 · verdict proof - axis grid, line, floating readout tooltips ────────── */
const PROOF = [0.18, 0.3, 0.4, 0.36, 0.3, 0.34, 0.46, 0.5, 0.6, 0.56, 0.7, 0.82, 0.94];

export function AreaProof({ start, reduce, active }: P) {
  const padL = 22;
  const padR = 6;
  const baseY = VH - 14;
  const topY = 18;
  const plotW = VW - padL - padR;
  const plotH = baseY - topY;
  const X = (i: number) => padL + (i * plotW) / (PROOF.length - 1);
  const Y = (v: number) => baseY - v * plotH;
  const pts = PROOF.map((v, i) => [X(i), Y(v)] as const);
  const line = smooth(pts);
  const area = `${line} L${X(PROOF.length - 1).toFixed(1)} ${baseY} L${padL} ${baseY} Z`;
  const ticks = [0, 25, 50, 75, 100];
  const splitIdx = 5; // dashed before, solid after
  const a = 4; // earlier readout index (active only)
  const b = PROOF.length - 1; // latest readout

  function Tip({ i, label, x, y, dx }: { i: number; label: string; x: number; y: number; dx: number }) {
    return (
      <g transform={`translate(${x + dx} ${y - 26})`}>
        <rect width="62" height="22" rx="4" fill="rgba(10,11,13,0.94)" stroke="rgba(255,255,255,0.16)" />
        <text x="7" y="9" style={{ fill: "var(--text-faint)", fontFamily: "var(--font-mono)" }} fontSize="6">BLOCK #{1180 + i * 9}</text>
        <text x="7" y="17.5" style={{ fill: "var(--frost)", fontFamily: "var(--font-mono)" }} fontSize="8">{label}</text>
      </g>
    );
  }

  return (
    <Svg>
      <defs>
        <linearGradient id="sc-proof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* axis grid */}
      {ticks.map((t) => {
        const gy = baseY - (t / 100) * plotH;
        return (
          <g key={t}>
            <line x1={padL} y1={gy} x2={VW - padR} y2={gy} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" style={{ fill: "var(--text-faint)", fontFamily: "var(--font-mono)" }} fontSize="7">{t}</text>
          </g>
        );
      })}
      <motion.path
        d={area}
        fill="url(#sc-proof)"
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      />
      {/* dashed early segment + solid later segment */}
      <motion.path
        d={smooth(pts.slice(0, splitIdx + 1))}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <motion.path
        d={smooth(pts.slice(splitIdx))}
        fill="none"
        stroke="var(--frost)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
      />
      {/* latest readout - always shown */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 1.1, ease: EASE }}
      >
        <line x1={X(b)} y1={Y(PROOF[b])} x2={X(b)} y2={baseY} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <circle cx={X(b)} cy={Y(PROOF[b])} r="3.4" fill="var(--obsidian)" stroke="var(--frost)" strokeWidth="1.6" />
        <Tip i={b} label="verified ✓" x={X(b)} y={Y(PROOF[b])} dx={-64} />
      </motion.g>
      {/* earlier readout - only when active/expanded */}
      <motion.g initial={false} animate={{ opacity: active ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
        <line x1={X(a)} y1={Y(PROOF[a])} x2={X(a)} y2={baseY} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <circle cx={X(a)} cy={Y(PROOF[a])} r="3" fill="var(--obsidian)" stroke="var(--frost)" strokeWidth="1.4" />
        <Tip i={a} label="verified ✓" x={X(a)} y={Y(PROOF[a])} dx={6} />
      </motion.g>
    </Svg>
  );
}
