"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import Logomark from "@/components/landing/Logomark";

/**
 * ManifestoSection - the centered "statement" block that follows the
 * <KeyFigures/> stats band.
 *
 * A LIGHT section (data-section="light", white bg, hard cut from the band
 * above). A small muted brand <Logomark/> sits centered at the top; below it, one
 * large centered statement is revealed WORD-BY-WORD from light-gray
 * (--text-faint) to ink (--text-primary) as the section scrolls through the
 * viewport center.
 *
 * Motion: a single framer-motion `useScroll` tracks the section's progress
 * across the viewport ("start 0.9" → "end 0.25"); each word maps a narrow,
 * overlapping slice of that 0→1 progress to a color interpolation via
 * `useTransform`, so the fill sweeps left→right as you scroll.
 *
 * Reduced-motion: the full statement renders in ink immediately (no scroll
 * animation, no per-word MotionValues consumed for color).
 *
 * Prop-less, self-contained, default export.
 */

const STATEMENT =
  "Warren treats metadata as the thing worth protecting. Every message is padded to one size, routed through three relays that each know only their immediate neighbours, and delayed at random - so the shape of your traffic stops describing your life.";

const GRAY = "var(--text-faint)"; // #9a9a9a in the light theme
const INK = "var(--text-primary)"; // #14161c in the light theme

/** One word whose color fills gray→ink as the scroll progress passes its slice. */
function Word({
  word,
  index,
  total,
  progress,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Each word owns an overlapping slice of [0,1]; later words start later so the
  // fill reads as a left→right sweep. The slice is widened slightly so adjacent
  // words crossfade rather than snap.
  const start = index / total;
  const end = (index + 1.4) / total;
  const color = useTransform(progress, [start, end], [GRAY, INK]);

  return (
    <motion.span style={{ color }} className="transition-colors">
      {word}{" "}
    </motion.span>
  );
}

export default function ManifestoSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);

  // Drive the word fill off the section's travel through the viewport center.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.35"],
  });

  const words = STATEMENT.split(" ");

  return (
    <section
      data-section="light"
      aria-label="Manifesto"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div
        ref={ref}
        className="mx-auto flex flex-col items-center px-6 text-center"
        style={{
          maxWidth: 760,
          paddingTop: "clamp(36px, 6vh, 72px)",
          paddingBottom: "20vh",
        }}
      >
        {/* Brand logomark - small, muted, centered above the statement.
            Color is taken from --text-faint via currentColor. */}
        <span
          className="mb-8 inline-block"
          style={{ color: "var(--text-faint)" }}
        >
          <Logomark size={28} />
        </span>

        {/* The statement. */}
        <p
          className="font-sans"
          style={{
            fontSize: "clamp(26px, 3.4vw, 38px)",
            fontWeight: 400,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
          }}
        >
          {reduce
            ? // Reduced motion: full statement in ink, no scroll animation.
              STATEMENT
            : words.map((word, i) => (
                <Word
                  key={`${word}-${i}`}
                  word={word}
                  index={i}
                  total={words.length}
                  progress={scrollYProgress}
                />
              ))}
        </p>
      </div>
    </section>
  );
}
