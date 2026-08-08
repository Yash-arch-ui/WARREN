"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * DeskBackdrop - the landing-style ambient backdrop for the /desk showcase: a
 * faint drifting grid + two slow monochrome glows. Decorative only and strictly
 * MONOCHROME - the sacred `--band-blue` is never used for decoration. Absolute,
 * pointer-events-none; drop it as the first child of a `relative` section.
 * Reduced motion → the glows hold still.
 */
export function DeskBackdrop({ glow = true }: { glow?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* drifting grid, faded toward the edges */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          opacity: 0.5,
          WebkitMaskImage: "radial-gradient(130% 90% at 50% 10%, black, transparent 78%)",
          maskImage: "radial-gradient(130% 90% at 50% 10%, black, transparent 78%)",
        }}
      />
      {glow ? (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 560,
              height: 560,
              left: "6%",
              top: "4%",
              background: "radial-gradient(circle, var(--ambient-glow), transparent 64%)",
              filter: "blur(46px)",
            }}
            animate={reduce ? undefined : { x: [0, 44, 0], y: [0, 30, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 440,
              height: 440,
              right: "5%",
              top: "34%",
              background: "radial-gradient(circle, var(--ambient-glow-2), transparent 66%)",
              filter: "blur(54px)",
            }}
            animate={reduce ? undefined : { x: [0, -32, 0], y: [0, 38, 0] }}
            transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}
    </div>
  );
}
