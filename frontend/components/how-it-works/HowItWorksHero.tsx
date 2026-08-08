"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * HowItWorksHero - full-height opening frame for /how-it-works.
 *
 * Editorial light backbone (sits inside the lead's data-section="light" wrap, so
 * tokens resolve to the white theme here - no explicit-hex requirement). Layout:
 *   eyebrow "HOW IT WORKS"  →  two-tone headline (ink line + muted line)  →
 *   serif/sans subhead  →  a small self-drawing SVG motif (an order-lane that
 *   runs into a rule-window bracket)  →  a "Scroll" cue (.anim-scroll-cue).
 *
 * The motif strokes draw themselves in via framer pathLength. Reduced-motion →
 * final state rendered immediately (paths fully drawn, no cue bounce).
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function HowItWorksHero() {
  const reduce = useReducedMotion() ?? false;

  // pathLength draw-in: animate 0→1 unless reduced-motion (then static at 1)
  const draw = (delay: number) =>
    reduce
      ? { initial: false as const, animate: undefined }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { duration: 1.4, ease: EASE, delay }, opacity: { duration: 0.2, delay } },
        };

  return (
    <section
      aria-labelledby="hiw-hero-title"
      className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* Eyebrow */}
        <motion.span
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="font-mono"
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--text-muted)",
          }}
        >
          How It Works
        </motion.span>

        {/* Two-tone headline */}
        <h1
          id="hiw-hero-title"
          className="mt-7 font-sans"
          style={{
            fontSize: "clamp(40px, 6.4vw, 78px)",
            fontWeight: 300,
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
          }}
        >
          <motion.span
            className="block"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            style={{ color: "var(--text-primary)" }}
          >
            The adversary invents.
          </motion.span>
          <motion.span
            className="block"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
            style={{ color: "var(--text-muted)" }}
          >
            The system learns.
          </motion.span>
        </h1>

        {/* Subhead */}
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="mt-8 max-w-xl font-sans"
          style={{
            fontSize: "clamp(15px, 1.5vw, 18px)",
            lineHeight: 1.6,
            color: "var(--text-body)",
          }}
        >
          Two desks across a Chinese wall, coordinating through Band. A red team
          engineers evasions; a blue team debates them down to a deterministic
          verdict - and when a novel tactic slips, the rule book rewrites itself.
        </motion.p>

        {/* Self-drawing motif: order-lane → rule-window bracket */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-14 w-full max-w-md"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 360 80"
            fill="none"
            className="w-full"
            style={{ display: "block", overflow: "visible" }}
          >
            {/* order lane - a baseline the orders ride along */}
            <motion.line
              x1="6"
              y1="52"
              x2="354"
              y2="52"
              stroke="var(--text-faint)"
              strokeWidth="1"
              strokeDasharray="2 5"
              {...draw(0.0)}
            />

            {/* order ticks (placements/cancels along the lane) */}
            {[34, 70, 106, 142, 178].map((x, i) => (
              <motion.line
                key={x}
                x1={x}
                y1="44"
                x2={x}
                y2="52"
                stroke="var(--desk-rnd)"
                strokeWidth="2"
                strokeLinecap="round"
                {...draw(0.15 + i * 0.06)}
              />
            ))}

            {/* the rule-window bracket clamping a slice of the lane */}
            <motion.path
              d="M232 26 H214 V72 H232"
              stroke="var(--desk-surv)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              {...draw(0.55)}
            />
            <motion.path
              d="M322 26 H340 V72 H322"
              stroke="var(--desk-surv)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              {...draw(0.65)}
            />

            {/* the flagged event inside the window */}
            <motion.line
              x1="277"
              y1="36"
              x2="277"
              y2="52"
              stroke="var(--verdict-flag)"
              strokeWidth="2.5"
              strokeLinecap="round"
              {...draw(0.8)}
            />

            {/* window label */}
            <motion.text
              x="277"
              y="20"
              textAnchor="middle"
              className="font-mono"
              fontSize="9"
              letterSpacing="0.12em"
              fill="var(--text-muted)"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.0 }}
            >
              window_ms
            </motion.text>
          </svg>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 flex flex-col items-center">
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "var(--text-faint)",
          }}
        >
          Scroll
        </span>
        <svg
          className="anim-scroll-cue mt-2"
          width="14"
          height="18"
          viewBox="0 0 14 18"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 1 V15 M2 10 L7 15 L12 10"
            stroke="var(--text-faint)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}
