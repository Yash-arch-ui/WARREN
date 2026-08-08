"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Reveal - reveal-on-scroll wrapper (fade + rise, fires once on enter).
 * Shared anim primitive (lead-frozen): how-it-works + landing sections import it.
 * Reduced-motion → renders the final state immediately, no transform.
 */
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.7, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
