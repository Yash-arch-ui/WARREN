"use client";

import { motion } from "framer-motion";

/**
 * AboutCardArt - the four bespoke monochrome visuals for <MoreAboutSection/>'s
 * bento cards. Each now carries a CONTINUOUS, subtle background animation (so the
 * cards feel alive like the  reference):
 *   RadarSearch  · 01 Adversarial R&D     - radar rings + a slowly SWEEPING wedge
 *   DetectRing   · 02 Surveillance Desk    - a segmented agent ring that ROTATES
 *   AuditShield  · 03 Tamper-evident Audit - a diagonal hatch field that DRIFTS
 *   BandScan     · 04 Cross-desk Band      - concentric arcs that PULSE outward
 *
 * Monochrome (white/gray); the only accent is --verdict-complete on the audit
 * chip. Deterministic (no Math.random) → SSR == client. `start` reveals on view;
 * `reduce` (prefers-reduced-motion) renders the final state with NO looping.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const MONO = "var(--font-mono)";
const LINEAR = "linear" as const;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function Svg({ vb, children, className }: { vb: string; children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox={vb} className={className ?? "h-full w-full"} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {children}
    </svg>
  );
}

/* ── 01 · radar rings + sweeping wedge ─────────────────────────────────────── */
export function RadarSearch({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 250;
  const cy = 150;
  const show = (d: number) => ({
    initial: reduce ? false : { opacity: 0, scale: 0.85 },
    animate: start ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 },
    transition: { duration: 0.7, delay: reduce ? 0 : d, ease: EASE },
  });
  const [sx0, sy0] = polar(cx, cy, 150, -34);
  const [sx1, sy1] = polar(cx, cy, 150, 6);
  return (
    <Svg vb="0 0 360 300">
      {[150, 108, 66].map((r, i) => (
        <motion.circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" style={{ transformBox: "fill-box", transformOrigin: "center" }} {...show(0.05 * i)} />
      ))}
      {/* continuously sweeping wedge */}
      <motion.g
        style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 7, repeat: Infinity, ease: LINEAR }}
      >
        <path d={`M${cx} ${cy} L${sx0.toFixed(1)} ${sy0.toFixed(1)} A150 150 0 0 1 ${sx1.toFixed(1)} ${sy1.toFixed(1)} Z`} fill="rgba(255,255,255,0.06)" />
        <line x1={cx} y1={cy} x2={sx1.toFixed(1)} y2={sy1.toFixed(1)} stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
      </motion.g>
      {/* floating glyph chips */}
      {[
        { x: 196, y: 70, g: "M-4 3 L-1 -1 L1 1 L4 -3" },
        { x: 320, y: 120, g: "M0 -4 A4 4 0 1 1 -0.1 -4 M0 0 L2 2" },
        { x: 168, y: 196, g: "M-4 3 L-2 0 L0 2 L3 -3" },
      ].map((c, i) => (
        <motion.g key={i} {...show(0.15 + i * 0.08)}>
          <circle cx={c.x} cy={c.y} r="15" fill="rgba(14,15,18,0.9)" stroke="rgba(255,255,255,0.12)" />
          <path d={c.g} transform={`translate(${c.x} ${c.y})`} fill="none" stroke="var(--frost)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        </motion.g>
      ))}
      {/* search lens */}
      <motion.g {...show(0.3)}>
        <circle cx={cx} cy={cy} r="32" fill="rgba(10,11,13,0.92)" stroke="var(--frost)" strokeWidth="1.6" />
        <circle cx={cx - 3} cy={cy - 3} r="11" fill="none" stroke="var(--frost)" strokeWidth="2" />
        <line x1={cx + 5} y1={cy + 5} x2={cx + 13} y2={cy + 13} stroke="var(--frost)" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
    </Svg>
  );
}

/* ── 02 · rotating segmented agent ring + center stat ──────────────────────── */
const NODES = [-90, -30, 30, 90, 150, 210];
export function DetectRing({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 130;
  const cy = 130;
  const R = 92;
  const gap = 13;
  return (
    <Svg vb="0 0 260 260">
      <circle cx={cx} cy={cy} r={R + 16} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      {/* the segments + nodes rotate slowly as one group */}
      <motion.g
        style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: LINEAR }}
      >
        {NODES.map((a, i) => {
          const next = NODES[(i + 1) % NODES.length] + (i === NODES.length - 1 ? 360 : 0);
          return (
            <motion.path
              key={i}
              d={arc(cx, cy, R, a + gap, next - gap)}
              fill="none"
              stroke="var(--frost)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ opacity: 0.5 }}
              initial={reduce ? false : { pathLength: 0 }}
              animate={start ? { pathLength: 1 } : { pathLength: reduce ? 1 : 0 }}
              transition={{ duration: 0.7, delay: reduce ? 0 : 0.1 + i * 0.07, ease: EASE }}
            />
          );
        })}
        {NODES.map((a, i) => {
          const [nx, ny] = polar(cx, cy, R, a);
          return (
            <motion.g
              key={`n${i}`}
              initial={reduce ? false : { opacity: 0, scale: 0.5 }}
              animate={start ? { opacity: 1, scale: 1 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.5 }}
              transition={{ duration: 0.4, delay: reduce ? 0 : 0.3 + i * 0.07, ease: EASE }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <circle cx={nx} cy={ny} r="13" fill="rgba(12,13,16,0.95)" stroke="rgba(255,255,255,0.18)" />
              <circle cx={nx} cy={ny} r="3" style={{ fill: "var(--text-muted)" }} />
            </motion.g>
          );
        })}
      </motion.g>
      {/* center stat - stays upright */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : { opacity: reduce ? 1 : 0 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.5, ease: EASE }}
      >
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="34" style={{ fill: "var(--frost)", fontFamily: MONO }} letterSpacing="-1">
          8
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9.5" letterSpacing="0.5" style={{ fill: "var(--text-muted)", fontFamily: MONO }}>
          agents · 2 tiers
        </text>
      </motion.g>
    </Svg>
  );
}

/* ── 03 · drifting diagonal hatch + hash-block chip ────────────────────────── */
export function AuditShield({ start, reduce }: { start: boolean; reduce: boolean }) {
  const hatch: { x: number; y: number }[] = [];
  for (let r = 0; r < 5; r++) for (let c = -1; c < 8; c++) hatch.push({ x: 40 + c * 46, y: 20 + r * 52 });
  return (
    <Svg vb="0 0 360 300">
      {/* the whole hatch field drifts right by one column-period, seamlessly */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : { opacity: reduce ? 1 : 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <motion.g animate={reduce ? undefined : { x: [0, 46] }} transition={{ duration: 5.5, repeat: Infinity, ease: LINEAR }}>
          {hatch.map((h, i) => (
            <line key={i} x1={h.x} y1={h.y} x2={h.x + 14} y2={h.y - 20} stroke="rgba(255,255,255,0.09)" strokeWidth="1.4" strokeLinecap="round" />
          ))}
        </motion.g>
      </motion.g>
      {/* hash-block credential chip */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={start ? { opacity: 1, y: 0 } : { opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.4, ease: EASE }}
      >
        <rect x="150" y="196" width="172" height="64" rx="12" fill="rgba(12,13,16,0.92)" stroke="rgba(255,255,255,0.14)" />
        <rect x="166" y="214" width="28" height="28" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" />
        <circle cx="180" cy="225" r="4.5" fill="none" stroke="var(--frost)" strokeWidth="1.4" />
        <path d="M172 237 a8 6 0 0 1 16 0" fill="none" stroke="var(--frost)" strokeWidth="1.4" />
        <rect x="206" y="218" width="92" height="5" rx="2.5" fill="rgba(255,255,255,0.22)" />
        <rect x="206" y="230" width="70" height="5" rx="2.5" fill="rgba(255,255,255,0.12)" />
        <g transform="translate(290 248)">
          <circle r="6" style={{ fill: "var(--verdict-complete)" }} opacity="0.18" />
          <circle r="2.4" style={{ fill: "var(--verdict-complete)" }} />
        </g>
      </motion.g>
    </Svg>
  );
}

/* ── 04 · concentric scan arcs + outward pulse ─────────────────────────────── */
export function BandScan({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 300;
  const cy = 300;
  return (
    <Svg vb="0 0 360 300">
      {[60, 110, 160, 210].map((r, i) => (
        <motion.path
          key={r}
          d={arc(cx, cy, r, 182, 268)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={i === 1 ? 2 : 1.3}
          strokeLinecap="round"
          style={{ opacity: 0.9 - i * 0.16 }}
          initial={reduce ? false : { pathLength: 0 }}
          animate={start ? { pathLength: 1 } : { pathLength: reduce ? 1 : 0 }}
          transition={{ duration: 0.9, delay: reduce ? 0 : 0.1 + i * 0.1, ease: EASE }}
        />
      ))}
      {/* outward pulse - an arc that expands + fades, forever */}
      {!reduce &&
        [0, 1].map((k) => (
          <motion.path
            key={`pulse${k}`}
            d={arc(cx, cy, 60, 182, 268)}
            fill="none"
            stroke="var(--frost)"
            strokeWidth="1.4"
            strokeLinecap="round"
            style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [0.9, 3.6], opacity: [0, 0.5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeOut", delay: k * 2 }}
          />
        ))}
      {[
        { r: 110, a: 200 },
        { r: 160, a: 230 },
        { r: 210, a: 255 },
      ].map((n, i) => {
        const [nx, ny] = polar(cx, cy, n.r, n.a);
        return (
          <motion.circle
            key={i}
            cx={nx}
            cy={ny}
            r="4.5"
            fill="var(--obsidian)"
            stroke="var(--frost)"
            strokeWidth="1.5"
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={start ? { opacity: 1, scale: 1 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.5 + i * 0.1, ease: EASE }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        );
      })}
      <motion.circle
        cx={cx}
        cy={cy}
        r="6"
        style={{ fill: "var(--frost)" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 0.9 } : { opacity: reduce ? 0.9 : 0 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.2, ease: EASE }}
      />
    </Svg>
  );
}
