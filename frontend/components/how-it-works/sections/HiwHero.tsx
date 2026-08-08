"use client";

/**
 * HiwHero - the opener for /how-it-works (spec §5, bolder forensic-ops register).
 * A dark cinematic stage (data-section="dark" + ops grain/grid) carrying the
 * signature two-tone Fraunces headline, a mono eyebrow, a tight sub-line, two
 * CTAs, a self-drawing order-book lane motif (PLACE/CANCEL ticks that draw in),
 * and a system-true mono fact-strip. Reduced-motion → everything final, no draw.
 *
 * Rules honored: band-blue stays sacred (only the on-Band tick + glow CTA use
 * it); no hard-coded hex (tokens only); EASE 4-tuple for every framer ease; the
 * dark stage is tagged data-section="dark" so frost inks resolve. Marker:
 * data-hiw="hero".
 */

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ── system-true fact-strip (never embellish - see spec §5) ───────────────── */
const FACTS = [
  "8 agents + 1 rule engine",
  "2 desks · 1 wall",
  "4 → 5 rules",
  "100% deterministic verdicts",
];

/* ── order-lane motif ──────────────────────────────────────────────────────
   A thin order-book lane: a baseline that draws across, resting-order rungs
   that rise, and a few PLACE / CANCEL ticks. One CANCEL is the on-Band cue
   (band-blue + pulse); the rest stay neutral/verdict-toned. Self-draws on
   scroll-into-view; reduced-motion renders the final frame instantly. */
type Tick = {
  x: number;
  /** rung height as a fraction of the lane (0..1, top = bigger book depth) */
  depth: number;
  kind: "PLACE" | "CANCEL";
  /** band = the one on-Band cancel (sacred blue + pulse) */
  band?: boolean;
};

const LANE_W = 920;
const LANE_H = 132;
const BASE_Y = 104; // baseline within the 0..LANE_H box
const TICKS: Tick[] = [
  { x: 70, depth: 0.42, kind: "PLACE" },
  { x: 168, depth: 0.66, kind: "PLACE" },
  { x: 266, depth: 0.55, kind: "CANCEL" },
  { x: 364, depth: 0.78, kind: "PLACE" },
  { x: 462, depth: 0.7, kind: "CANCEL", band: true },
  { x: 560, depth: 0.5, kind: "PLACE" },
  { x: 658, depth: 0.62, kind: "CANCEL" },
  { x: 756, depth: 0.84, kind: "PLACE" },
  { x: 854, depth: 0.48, kind: "CANCEL" },
];

function tickColor(t: Tick): string {
  if (t.band) return "var(--band-blue)";
  return t.kind === "CANCEL" ? "var(--verdict-flag)" : "var(--verdict-pass)";
}

function OrderLane() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const show = reduce || inView;
  const bandTick = TICKS.find((t) => t.band)!;
  const bandPath = `M ${bandTick.x} ${BASE_Y} L ${bandTick.x} ${
    BASE_Y - bandTick.depth * (LANE_H - 40)
  }`;

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox={`0 0 ${LANE_W} ${LANE_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="An order-book lane: resting orders are placed and cancelled along a timeline; one cancellation rides the Band coordination spine (highlighted)."
      >
        {/* baseline - the order-book time axis */}
        <motion.line
          x1={24}
          y1={BASE_Y}
          x2={LANE_W - 24}
          y2={BASE_Y}
          stroke="var(--border-default)"
          strokeWidth={1.4}
          initial={reduce ? false : { pathLength: 0 }}
          animate={show ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.1, ease: EASE }}
        />

        {/* ticks - PLACE/CANCEL rungs rising off the baseline */}
        {TICKS.map((t, i) => {
          const top = BASE_Y - t.depth * (LANE_H - 40);
          const color = tickColor(t);
          const delay = 0.3 + i * 0.08;
          return (
            <motion.g
              key={i}
              initial={reduce ? false : { opacity: 0 }}
              animate={show ? { opacity: 1 } : undefined}
              transition={{ duration: 0.4, delay, ease: EASE }}
            >
              <motion.line
                x1={t.x}
                y1={BASE_Y}
                x2={t.x}
                y2={top}
                stroke={color}
                strokeWidth={t.band ? 2.4 : 1.6}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={show ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.55, delay, ease: EASE }}
              />
              <circle cx={t.x} cy={top} r={t.band ? 4 : 3} fill={color} />
              <text
                x={t.x}
                y={BASE_Y + 18}
                textAnchor="middle"
                className="font-mono"
                fontSize={9}
                letterSpacing="0.08em"
                fill={t.band ? "var(--band-blue)" : "var(--text-muted)"}
              >
                {t.kind}
              </text>
            </motion.g>
          );
        })}

        {/* the on-Band cue: a band-blue pulse riding the sacred cancel rung */}
        {!reduce && show && (
          <circle r={3.4} fill="var(--band-blue)">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={bandPath} />
          </circle>
        )}
      </svg>
    </div>
  );
}

export function HiwHero() {
  return (
    <section
      data-hiw="hero"
      data-section="light"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div className="relative z-[1] mx-auto w-full max-w-[var(--maxw-content)] px-6">
        {/* eyebrow */}
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[color:var(--text-muted)]">
            ALPHA &amp; OVERSIGHT · HOW IT WORKS
          </p>
        </Reveal>

        {/* two-tone display headline (line-rise) */}
        <h1 className="sr-only">The adversary invents. The system learns.</h1>
        <MaskLines
          className="mt-6 font-display text-5xl leading-[1.02] sm:text-7xl"
          delay={0.05}
          lines={[
            <span key="l1" className="text-[color:var(--text-primary)]">
              The adversary invents.
            </span>,
            <span key="l2" className="text-[color:var(--text-faint)]">
              The system learns.
            </span>,
          ]}
        />

        {/* sub-line */}
        <Reveal delay={0.15} className="mt-7 max-w-[60ch]">
          <p className="text-lg leading-relaxed text-[color:var(--text-body)] sm:text-xl">
            Adversarial trade-surveillance, refereed by a Band of agents - where a
            model invents new market manipulation and deterministic code, not an
            LLM, renders every verdict.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.25}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/desk"
              className="ops-glow-band inline-flex items-center rounded-full bg-[var(--band-blue)] px-7 py-3 font-mono text-sm font-semibold tracking-[0.04em] text-[color:var(--frost)] transition-transform hover:-translate-y-0.5"
            >
              Watch it run live →
            </Link>
            <Link
              href="/alpha-oversight-report.pdf"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-7 py-3 font-mono text-sm font-semibold tracking-[0.04em] text-[color:var(--text-body)] transition-colors hover:border-[var(--text-muted)] hover:text-[color:var(--text-primary)]"
            >
              Read the report
            </Link>
          </div>
        </Reveal>

        {/* self-drawing order-lane motif */}
        <Reveal delay={0.3} className="mt-16">
          <OrderLane />
        </Reveal>

        {/* mono fact-strip - system-true only */}
        <Reveal delay={0.4}>
          <ul className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-6 font-mono text-xs tracking-[0.06em] text-[color:var(--text-muted)]">
            {FACTS.map((f, i) => (
              <li key={f} className="flex items-center gap-x-3">
                {i > 0 && (
                  <span aria-hidden className="text-[color:var(--text-faint)]">
                    ·
                  </span>
                )}
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export default HiwHero;
