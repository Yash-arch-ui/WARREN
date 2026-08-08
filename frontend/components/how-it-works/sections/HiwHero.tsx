"use client";

/**
 * HiwHero - the opener for /how-it-works.
 * A dark cinematic stage (data-section="dark" + ops grain/grid) carrying the
 * signature two-tone Fraunces headline, a mono eyebrow, a tight sub-line, two
 * CTAs, a self-drawing wire-lane motif (SEND/COVER ticks that draw in),
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
  "3 hops, no full path",
  "K-of-N attested directory",
  "blind-signature tokens",
  "305 body bytes / packet",
];

/* ── packet-lane motif ─────────────────────────────────────────────────────
   A thin wire lane: a baseline that draws across, jittered SEND/COVER ticks
   (real traffic mixed with chaff - the point is an observer can't tell them
   apart). One SEND is the hop-crossing cue (band-blue + pulse, the moment a
   packet leaves visibility into the mix); the rest stay neutral/verdict-toned.
   Self-draws on scroll-into-view; reduced-motion renders the final frame
   instantly. */
type Tick = {
  x: number;
  /** rung height as a fraction of the lane (0..1, top = bigger book depth) */
  depth: number;
  kind: "SEND" | "COVER";
  /** hop = the one tick crossing into the mix (sacred blue + pulse) */
  hop?: boolean;
};

const LANE_W = 920;
const LANE_H = 132;
const BASE_Y = 104; // baseline within the 0..LANE_H box
const TICKS: Tick[] = [
  { x: 70, depth: 0.42, kind: "COVER" },
  { x: 168, depth: 0.66, kind: "SEND" },
  { x: 266, depth: 0.55, kind: "COVER" },
  { x: 364, depth: 0.78, kind: "SEND" },
  { x: 462, depth: 0.7, kind: "SEND", hop: true },
  { x: 560, depth: 0.5, kind: "COVER" },
  { x: 658, depth: 0.62, kind: "SEND" },
  { x: 756, depth: 0.84, kind: "COVER" },
  { x: 854, depth: 0.48, kind: "SEND" },
];

function tickColor(t: Tick): string {
  if (t.hop) return "var(--band-blue)";
  return t.kind === "COVER" ? "var(--verdict-flag)" : "var(--verdict-pass)";
}

function PacketLane() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const show = reduce || inView;
  const hopTick = TICKS.find((t) => t.hop)!;
  const hopPath = `M ${hopTick.x} ${BASE_Y} L ${hopTick.x} ${
    BASE_Y - hopTick.depth * (LANE_H - 40)
  }`;

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox={`0 0 ${LANE_W} ${LANE_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="A wire lane: real messages and cover traffic tick along a timeline, indistinguishable from outside; one send crosses into the mix (highlighted)."
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
                strokeWidth={t.hop ? 2.4 : 1.6}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={show ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.55, delay, ease: EASE }}
              />
              <circle cx={t.x} cy={top} r={t.hop ? 4 : 3} fill={color} />
              <text
                x={t.x}
                y={BASE_Y + 18}
                textAnchor="middle"
                className="font-mono"
                fontSize={9}
                letterSpacing="0.08em"
                fill={t.hop ? "var(--band-blue)" : "var(--text-muted)"}
              >
                {t.kind}
              </text>
            </motion.g>
          );
        })}

        {/* the hop cue: a band-blue pulse riding the tick that crosses into the mix */}
        {!reduce && show && (
          <circle r={3.4} fill="var(--band-blue)">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={hopPath} />
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
            WARREN · HOW IT WORKS
          </p>
        </Reveal>

        {/* two-tone display headline (line-rise) */}
        <h1 className="sr-only">Every hop learns one thing. No hop learns the rest.</h1>
        <MaskLines
          className="mt-6 font-display text-5xl leading-[1.02] sm:text-7xl"
          delay={0.05}
          lines={[
            <span key="l1" className="text-[color:var(--text-primary)]">
              Every hop learns one thing.
            </span>,
            <span key="l2" className="text-[color:var(--text-faint)]">
              No hop learns the rest.
            </span>,
          ]}
        />

        {/* sub-line */}
        <Reveal delay={0.15} className="mt-7 max-w-[60ch]">
          <p className="text-lg leading-relaxed text-[color:var(--text-body)] sm:text-xl">
            A mixnet messenger where anonymity is structural, not promised -
            Sphinx-layered packets, blind-signature tokens, and a K-of-N
            relay directory, with no single component able to see sender,
            recipient, and content at once.
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
            <a
              href="https://github.com/Yash-arch-ui/WARREN"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] px-7 py-3 font-mono text-sm font-semibold tracking-[0.04em] text-[color:var(--text-body)] transition-colors hover:border-[var(--text-muted)] hover:text-[color:var(--text-primary)]"
            >
              View source
            </a>
          </div>
        </Reveal>

        {/* self-drawing packet-lane motif */}
        <Reveal delay={0.3} className="mt-16">
          <PacketLane />
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
