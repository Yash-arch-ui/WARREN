"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * Caption - a single dark-glass caption card crossfaded into view across a
 * 4-point scroll window (in → hold → hold → out). One card per chapter; all
 * six are absolutely stacked in the same corner of the stage and only the
 * active one is opaque. Eyebrow is mono uppercase tracked + numbered "NN / 06".
 *
 * Driven by the shared spring `t` (0..1). `range` is the [enter, settled,
 * leaveStart, leaveEnd] progress window for this card.
 */

export type CaptionProps = {
  t: MotionValue<number>;
  /** [enter, settled, leaveStart, leaveEnd] - opacity ramps in then out. */
  range: [number, number, number, number];
  no: number; // 1..6
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  /** Optional event chip (e.g. "ADVERSARY · 400ms layering-evasion"). */
  chip?: { label: string; tone?: string };
};

export function Caption({ t, range, no, eyebrow, title, body, chip }: CaptionProps) {
  const [a, b, c, d] = range;
  const opacity = useTransform(t, [a, b, c, d], [0, 1, 1, 0]);
  // Rise on enter, lift on exit.
  const y = useTransform(t, [a, b, c, d], [22, 0, 0, -22]);

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7"
    >
      <div
        className="max-w-[460px] rounded-[var(--r-card)] border p-5 backdrop-blur-md sm:p-6"
        style={{
          backgroundColor: "rgba(15,16,17,0.92)",
          borderColor: "rgba(255,255,255,0.09)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--desk-surv)]">
            {eyebrow}
          </span>
          <span className="font-mono text-[10.5px] tracking-[0.18em] text-[var(--text-faint)]">
            {String(no).padStart(2, "0")} / 06
          </span>
        </div>

        {chip ? (
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.04em]"
              style={{
                color: chip.tone ?? "var(--text-body)",
                borderColor: chip.tone ? `${chip.tone}55` : "var(--border-default)",
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
            >
              {chip.label}
            </span>
          </div>
        ) : null}

        <h3
          className="mt-4 font-sans"
          style={{
            fontSize: "clamp(19px, 2.2vw, 26px)",
            fontWeight: 360,
            letterSpacing: "-0.012em",
            lineHeight: 1.18,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h3>
        <p
          className="mt-2.5 font-sans text-[13.5px] leading-relaxed"
          style={{ color: "var(--text-body)" }}
        >
          {body}
        </p>
      </div>
    </motion.div>
  );
}
