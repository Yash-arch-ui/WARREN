"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * MaskLines - editorial line-mask reveal: each line rises out of an
 * overflow-hidden clip, staggered, so type appears UNMASKED rather than faded.
 * Shared anim primitive (lead-frozen). The in-view trigger lives on the
 * (unclipped) container - observing the clipped lines directly would never fire.
 * Reduced-motion → static lines, no clip animation.
 */
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const lineVariant = {
  hidden: { y: "112%" },
  show: { y: "0%", transition: { duration: 0.85, ease: EASE } },
};

export function MaskLines({
  lines,
  className = "",
  lineClassName = "",
  delay = 0,
}: {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className}>
        {lines.map((l, i) => (
          <span key={i} className={`block ${lineClassName}`}>
            {l}
          </span>
        ))}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      custom={delay}
      variants={{
        hidden: {},
        show: (d: number) => ({ transition: { staggerChildren: 0.09, delayChildren: d } }),
      }}
    >
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span variants={lineVariant} className={`block ${lineClassName}`}>
            {l}
          </motion.span>
        </span>
      ))}
    </motion.div>
  );
}
