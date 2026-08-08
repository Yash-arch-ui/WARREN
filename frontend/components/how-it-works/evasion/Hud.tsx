"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * Hud - the live metrics read-out pinned top-right of the stage. All values are
 * mono (Geist Mono) and animate continuously off the shared spring `t`, so the
 * numbers tick as the burst forms, the confidence spikes, and the guessed
 * window widens - a running telemetry strip rather than per-chapter swaps.
 *
 * Rows: confidence ratio · packets · window_ms (narrow→wide guess) ·
 * match · hops peeled (2/3 ▸ 3/3). Each row formats a derived MotionValue.
 */

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  /** Static or animated color for the value. */
  tone?: string | MotionValue<string>;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
        {label}
      </span>
      <motion.span
        className="font-mono text-[12.5px] tabular-nums"
        style={{ color: tone ?? "var(--text-primary)" }}
      >
        {value}
      </motion.span>
    </div>
  );
}

export type HudProps = {
  /** Pre-derived numeric / string MotionValues from CorrelationStory. */
  ratio: MotionValue<number>;
  depth: MotionValue<number>;
  windowMs: MotionValue<number>;
  /** Tone of the confidence value: gray→amber as it spikes. */
  ratioTone: MotionValue<string>;
  /** Match text + its tone, swapped by chapter window. */
  verdict: MotionValue<string>;
  verdictTone: MotionValue<string>;
  /** Hops-peeled count, rolls 2/3 → 3/3 in the final chapter. */
  rules: MotionValue<number>;
};

export function Hud({
  ratio,
  depth,
  windowMs,
  ratioTone,
  verdict,
  verdictTone,
  rules,
}: HudProps) {
  const ratioText = useTransform(ratio, (v) => v.toFixed(2));
  const depthText = useTransform(depth, (v) => String(Math.round(v)));
  const windowText = useTransform(windowMs, (v) => `${Math.round(v)}ms`);
  const rulesText = useTransform(rules, (v): string => (v < 4.5 ? "2/3" : "3/3"));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-5 top-5 w-[214px] rounded-[12px] border p-4 backdrop-blur-md sm:right-7 sm:top-7"
      style={{
        backgroundColor: "rgba(10,11,13,0.86)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="mb-3 flex items-center justify-between border-b pb-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--desk-surv)]">
          live · flow #0
        </span>
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--verdict-pass)" }}
        />
      </div>
      <div className="space-y-2.5">
        <Row label="confidence" value={<motion.span>{ratioText}</motion.span>} tone={ratioTone} />
        <Row label="packets" value={<motion.span>{depthText}</motion.span>} />
        <Row label="window_ms" value={<motion.span>{windowText}</motion.span>} />
        <Row label="match" value={<motion.span>{verdict}</motion.span>} tone={verdictTone} />
        <Row label="hops_peeled" value={<motion.span>{rulesText}</motion.span>} />
      </div>
    </div>
  );
}

/**
 * HudStatic - the reduced-motion final-state read-out (widest guessed window
 * 450ms, 0.94 confidence, unconfirmed). No MotionValues.
 */
export function HudStatic() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-5 top-5 w-[214px] rounded-[12px] border p-4 sm:right-7 sm:top-7"
      style={{
        backgroundColor: "rgba(10,11,13,0.86)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="mb-3 flex items-center justify-between border-b pb-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--desk-surv)]">
          live · flow #0
        </span>
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--verdict-pass)" }}
        />
      </div>
      <div className="space-y-2.5">
        <Row label="confidence" value="0.94" tone="var(--verdict-flag)" />
        <Row label="packets" value="5" />
        <Row label="window_ms" value="450ms" />
        <Row label="match" value="unconfirmed" tone="var(--verdict-flag)" />
        <Row label="hops_peeled" value="3/3" />
      </div>
    </div>
  );
}
