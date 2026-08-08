"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * KeyFigures - the closing "Key Figures" stats band (frame-4 reveal).
 *
 * LIGHT section (data-section="light", white bg, ink text)
 * with a hard cut from the dark Command Center dashboard above it. A centered
 * light-weight title sits over a row of big MONO count-up figures, each with an
 * uppercase tracked label. A thin hairline-topped eyebrow strip closes it out.
 *
 * Three primary figures, evenly spaced
 * (12k+ / 1.8k+ / 990M+). Prop-less, self-contained. Numbers count up from 0
 * when scrolled into view. Respects prefers-reduced-motion by rendering final
 * values immediately.
 */

type Figure = {
  /** numeric target to count toward, or null for a static stylized value */
  to: number | null;
  /** value shown verbatim when `to` is null */
  staticValue?: string;
  prefix?: string;
  suffix?: string;
  /** decimal places to render while counting */
  decimals?: number;
  label: string;
};

const FIGURES: Figure[] = [
  { to: 3, suffix: "", decimals: 0, label: "Relays per message · none sees both ends" },
  {
    to: null,
    staticValue: "1024 B",
    label: "Every packet, identical size",
  },
  {
    to: 1,
    suffix: "",
    decimals: 0,
    label: "Admission token spent per packet",
  },
];

const COUNT_MS = 1400;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Single count-up (or static) figure cell. */
function FigureCell({
  figure,
  start,
  reduce,
}: {
  figure: Figure;
  start: boolean;
  reduce: boolean;
}) {
  const isStatic = figure.to === null;
  const [value, setValue] = useState(
    isStatic || reduce ? (figure.to ?? 0) : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStatic || reduce) {
      if (figure.to !== null) setValue(figure.to);
      return;
    }
    if (!start) return;

    const target = figure.to as number;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setValue(target * EASE_OUT(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [start, isStatic, reduce, figure.to]);

  const display = isStatic
    ? figure.staticValue
    : `${figure.prefix ?? ""}${value.toFixed(figure.decimals ?? 0)}${
        figure.suffix ?? ""
      }`;

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="font-mono tabular-nums"
        style={{
          fontSize: "clamp(30px, 3.6vw, 46px)",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          // reserve digits so settling values don't shift layout
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </span>
      <span
        className="mt-3 font-sans"
        style={{
          fontSize: "clamp(12px, 1vw, 14px)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
        }}
      >
        {figure.label}
      </span>
    </div>
  );
}

export default function KeyFigures() {
  const reduce = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.4 });
  const start = reduce || inView;

  return (
    <section
      ref={sectionRef}
      data-section="light"
      aria-labelledby="key-figures-title"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="mx-auto px-6 pt-24 pb-10 sm:pt-32 sm:pb-12"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        {/* Title */}
        <motion.h2
          id="key-figures-title"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={start ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center font-sans"
          style={{
            fontSize: "clamp(34px, 5vw, 52px)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Key Figures
        </motion.h2>

        {/* Figures row */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={start ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 grid grid-cols-1 gap-y-12 sm:grid-cols-3 sm:gap-x-12 lg:mt-14 lg:gap-x-20"
        >
          {FIGURES.map((figure) => (
            <FigureCell
              key={figure.label}
              figure={figure}
              start={start}
              reduce={reduce}
            />
          ))}
        </motion.div>

        {/* Eyebrow strip with hairline top border - left-aligned, tight under
            the line (matches 11.png "VERIFY YOUR TRACK RECORD. ATTRACT CAPITAL."). */}
        <div
          className="mt-12 pt-1.5 text-left lg:mt-14"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              lineHeight: 1,
              display: "inline-block",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--text-muted)",
            }}
          >
            Hide the pattern · State the limits
          </span>
        </div>
      </div>
    </section>
  );
}
