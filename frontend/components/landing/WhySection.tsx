"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Logomark from "./Logomark";
import { BarSignal, AreaRamp, AreaProof } from "./art/StatCharts";

/**
 * WhySection - the "Why metadata matters" proof band ("Why …"
 * clone, themed for adversarial trade-surveillance).
 *
 * DARK section (obsidian, root tokens). Left: eyebrow + angular mark, a two-tone
 * heading, and a white "Launch Desk" pill. Right: three hairline-separated
 * columns - each a label, a MONO count-up stat, and a bespoke monochrome
 * mini-chart (detection bars · rulebook ramp · audit-proof). Everything reveals
 * on scroll-in; counts animate from 0 and charts draw in. prefers-reduced-motion
 * / SSR renders the final composed state immediately.
 *
 * Prop-less, self-contained, default export.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const COUNT_MS = 1300;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Stat = {
  label: string;
  to: number;
  prefix?: string;
  suffix?: string;
  Chart: (p: { start: boolean; reduce: boolean; active: boolean }) => React.ReactElement;
};

const STATS: Stat[] = [
  { label: "Relays that see both ends", to: 0, suffix: "", Chart: BarSignal },
  { label: "Independent directory signers", to: 3, prefix: "", Chart: AreaRamp },
  { label: "Packets padded to one size", to: 100, suffix: "%", Chart: AreaProof },
];

/** RAF count-up to `to` once `start` flips true (final value if reduced). */
function useCountUp(to: number, start: boolean, reduce: boolean) {
  const [v, setV] = useState(reduce ? to : 0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) {
      setV(to);
      return;
    }
    if (!start) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setV(to * easeOutCubic(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setV(to);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [to, start, reduce]);
  return v;
}

function StatColumn({
  stat,
  index,
  start,
  reduce,
  active,
  grow,
  onEnter,
  onLeave,
}: {
  stat: Stat;
  index: number;
  start: boolean;
  reduce: boolean;
  active: boolean;
  grow: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const v = useCountUp(stat.to, start, reduce);
  const { Chart } = stat;
  return (
    <motion.div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: 0.6, delay: 0.1 + index * 0.12, ease: EASE }}
      className="flex min-w-0 flex-col px-0 sm:px-6 sm:[&:not(:first-child)]:border-l"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        // hover redistributes the row to 50:25:25 (grow 2 vs 1).
        flexGrow: grow,
        flexBasis: 0,
        transition: "flex-grow 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <span
        className="font-sans transition-opacity duration-300"
        style={{ fontSize: 14, lineHeight: 1.3, color: "var(--text-primary)", opacity: active ? 1 : 0.82 }}
      >
        {stat.label}
      </span>
      <span
        className="mt-4 font-mono tabular-nums transition-colors duration-300"
        style={{
          fontSize: "clamp(26px, 3vw, 40px)",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: active ? "var(--frost)" : "var(--text-faint)",
        }}
      >
        {stat.prefix ?? ""}
        {Math.round(v)}
        {stat.suffix ?? ""}
      </span>
      <div className="mt-7">
        <Chart start={start} reduce={reduce} active={active} />
      </div>
    </motion.div>
  );
}

export default function WhySection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const start = reduce || inView;
  // hovered column expands to 50% (the other two share 25% each).
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section
      ref={ref}
      aria-labelledby="why-title"
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: "var(--obsidian)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto px-6 py-24 sm:py-28" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* eyebrow row */}
        <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--text-faint)" }}>
            Why metadata matters
          </span>
          <Logomark size={18} />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] lg:gap-16">
          {/* left - heading + CTA */}
          <div className="flex flex-col">
            <motion.h2
              id="why-title"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="font-sans"
              style={{
                fontWeight: 380,
                letterSpacing: "-0.014em",
                lineHeight: 1.08,
                fontSize: "clamp(30px, 4vw, 52px)",
                color: "var(--text-primary)",
              }}
            >
              Why metadata is the{" "}
              <span style={{ color: "var(--text-faint)" }}>part worth hiding</span>
            </motion.h2>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="mt-9"
            >
              <Link
                href="/desk"
                className="inline-flex items-center gap-2 font-sans text-[14px] font-medium transition-transform hover:-translate-y-0.5"
                style={{
                  backgroundColor: "var(--frost)",
                  color: "var(--obsidian)",
                  borderRadius: "var(--r-pill)",
                  padding: "11px 22px",
                }}
              >
                Launch Desk
                <span aria-hidden="true">→</span>
              </Link>
            </motion.div>
          </div>

          {/* right - three stat columns; hover one → 50:25:25 */}
          <div className="flex flex-col gap-12 sm:flex-row sm:gap-0">
            {STATS.map((s, i) => (
              <StatColumn
                key={s.label}
                stat={s}
                index={i}
                start={start}
                reduce={reduce}
                active={hovered === i}
                grow={hovered === null ? 1 : hovered === i ? 2 : 1}
                onEnter={() => setHovered(i)}
                onLeave={() => setHovered(null)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
