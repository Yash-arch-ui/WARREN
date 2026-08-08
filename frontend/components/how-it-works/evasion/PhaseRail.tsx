"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * PhaseRail - two coupled affordances:
 *  • PHASE INDICATOR (top-left): the six chapter labels stacked; the active one
 *    lifts to frost + a band-tone marker, the rest sit faint. Driven by `t`.
 *  • PROGRESS RAIL (right edge): a thin vertical track with a fill that grows
 *    with scroll progress and six chapter ticks.
 */

export const CHAPTERS = [
  "Clean flow",
  "The adversary's move",
  "Across the Band",
  "The debate",
  "The verdict",
  "Codify",
] as const;

/** Progress center for chapter i (0..5) on the 0..1 timeline. */
function chapterCenter(i: number): number {
  return (i + 0.5) / CHAPTERS.length;
}

export type PhaseRailProps = {
  t: MotionValue<number>;
  /** When set (reduced motion), render chapter `active` statically lit. */
  staticActive?: number;
};

function PhaseItem({
  t,
  i,
  label,
  staticActive,
}: {
  t: MotionValue<number>;
  i: number;
  label: string;
  staticActive?: number;
}) {
  const c = chapterCenter(i);
  const half = 0.5 / CHAPTERS.length;
  // Lit when t is within this chapter's band; faint otherwise.
  const lit = useTransform(t, [c - half, c, c + half], [0.32, 1, 0.32]);
  const dyn = staticActive == null;
  const isStatic = !dyn && staticActive === i;

  return (
    <div className="flex items-center gap-2.5">
      <motion.span
        className="inline-block h-[6px] w-[6px] shrink-0 rounded-[1px]"
        style={{
          backgroundColor: "var(--band-blue)",
          opacity: dyn ? lit : isStatic ? 1 : 0.32,
        }}
      />
      <motion.span
        className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
        style={{
          color: "var(--text-primary)",
          opacity: dyn ? lit : isStatic ? 1 : 0.32,
        }}
      >
        <span className="text-[var(--text-faint)]">{String(i + 1).padStart(2, "0")}</span>{" "}
        {label}
      </motion.span>
    </div>
  );
}

export function PhaseRail({ t, staticActive }: PhaseRailProps) {
  const fillScale = useTransform(t, (v) => Math.max(0, Math.min(1, v)));

  return (
    <>
      {/* Phase indicator - top-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-5 top-5 hidden flex-col gap-2 sm:left-7 sm:top-7 sm:flex"
      >
        <span className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.24em] text-[var(--desk-surv)]">
          The Evasion
        </span>
        {CHAPTERS.map((label, i) => (
          <PhaseItem key={label} t={t} i={i} label={label} staticActive={staticActive} />
        ))}
      </div>

      {/* Progress rail - right edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-7 right-2.5 top-7 hidden w-[2px] sm:block"
        style={{ backgroundColor: "var(--hairline)" }}
      >
        <motion.div
          className="absolute inset-x-0 top-0 origin-top"
          style={{
            height: "100%",
            backgroundColor: "var(--desk-surv)",
            scaleY: staticActive == null ? fillScale : 1,
          }}
        />
        {CHAPTERS.map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
            style={{
              top: `${chapterCenter(i) * 100}%`,
              backgroundColor: "var(--text-faint)",
            }}
          />
        ))}
      </div>
    </>
  );
}
