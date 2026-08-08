"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/**
 * Preloader - full-screen black splash shown once on first site load.
 *
 * Sequence: animated "ALPHA & OVERSIGHT" wordmark with a drawn-in ◢ anchor,
 * two-clause stagger reveal, a thin scan-line underline sweep, and a
 * blue pulse dot hinting "connecting to a node". Holds ~2.6s, then
 * fades + slightly scales out and unmounts itself.
 *
 * Prop-less, self-contained. Respects prefers-reduced-motion (static
 * wordmark, shorter beat). A module-scoped guard plays the splash on every
 * full document load (first visit AND refresh - a hard load is a fresh JS
 * context, so the flag resets) while skipping replay on soft client-side
 * navigation back to "/" within the same session (module state survives
 * soft navs but not a reload).
 */

// Lives in the module's JS context: false on every fresh document load
// (initial visit or refresh), true after the splash has played once within
// this client session. Survives App-Router soft navigations; reset by reload.
let hasPlayedThisDocument = false;

// Two clauses: "ALPHA" / "& OVERSIGHT" - each splits into letters for stagger.
const CLAUSE_A = "ALPHA".split("");
const CLAUSE_B = "& OVERSIGHT".split("");

export default function Preloader() {
  const reduceMotion = useReducedMotion();

  // Decide visibility synchronously on mount (guarded for SSR).
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);

    if (hasPlayedThisDocument) {
      return; // already played in this session's JS context - skip on soft nav
    }

    // Claim the play immediately so a soft nav away mid-splash won't replay it.
    hasPlayedThisDocument = true;
    setShow(true);

    const hold = reduceMotion ? 1200 : 2600;
    timerRef.current = setTimeout(() => {
      setShow(false);
    }, hold);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reduceMotion]);

  // Nothing to render until the client decides - avoids SSR/CSR mismatch.
  if (!mounted) return null;

  // ---- Motion variants -----------------------------------------------------

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: 0.12,
        staggerChildren: 0.045,
      },
    },
  };

  const letter: Variants = {
    hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const exit = {
    opacity: 0,
    scale: 1.04,
    filter: "blur(2px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  };

  // ---- Render --------------------------------------------------------------

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="ao-preloader"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={exit}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "var(--obsidian)" }}
        >
          {/* faint center vignette for depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.025), transparent 70%)",
            }}
          />

          <div className="relative flex flex-col items-center gap-6 px-6">
            {/* Logomark ◢ + wordmark row */}
            <div className="flex items-center gap-4">
              {/* drawn-in right-angle anchor */}
              <motion.span
                initial={
                  reduceMotion
                    ? { opacity: 1, rotate: 45, scale: 1 }
                    : { opacity: 0, rotate: 12, scale: 0.4 }
                }
                animate={{ opacity: 1, rotate: 45, scale: 1 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.7, delay: 0.05, ease: [0.34, 1.56, 0.64, 1] }
                }
                className="inline-block"
                style={{
                  width: 16,
                  height: 16,
                  borderTop: "1.5px solid var(--frost)",
                  borderRight: "1.5px solid var(--frost)",
                  borderTopRightRadius: 3,
                }}
              />

              {/* Wordmark - two-clause letter stagger */}
              <motion.div
                variants={reduceMotion ? undefined : container}
                initial={reduceMotion ? false : "hidden"}
                animate={reduceMotion ? undefined : "visible"}
                className="flex select-none items-baseline gap-[0.4ch] font-sans"
                style={{
                  fontWeight: 300,
                  letterSpacing: "0.16em",
                  fontSize: "clamp(20px, 4.4vw, 34px)",
                  color: "var(--frost)",
                }}
              >
                <span className="flex">
                  {CLAUSE_A.map((ch, i) => (
                    <motion.span
                      key={`a-${i}`}
                      variants={reduceMotion ? undefined : letter}
                      className="inline-block"
                    >
                      {ch}
                    </motion.span>
                  ))}
                </span>
                <span
                  className="flex"
                  style={{ color: "var(--frost)" }}
                >
                  {CLAUSE_B.map((ch, i) => (
                    <motion.span
                      key={`b-${i}`}
                      variants={reduceMotion ? undefined : letter}
                      className="inline-block"
                      style={{ whiteSpace: "pre" }}
                    >
                      {ch}
                    </motion.span>
                  ))}
                </span>
              </motion.div>
            </div>

            {/* Scan-line underline sweep */}
            <div
              className="relative h-px w-[min(280px,72vw)] overflow-hidden"
              style={{ backgroundColor: "var(--hairline)" }}
            >
              {reduceMotion ? (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: "var(--border-default)" }}
                />
              ) : (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1.5,
                    delay: 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-y-0 left-0 w-1/2"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--frost), transparent)",
                  }}
                />
              )}
            </div>

            {/* "connecting to a node" hint */}
            <motion.div
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduceMotion ? { duration: 0 } : { delay: 0.9, duration: 0.6 }
              }
              className="flex items-center gap-2 font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <span
                className={reduceMotion ? "" : "anim-band-pulse"}
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "var(--band-blue)",
                  boxShadow: reduceMotion
                    ? "none"
                    : "0 0 10px var(--band-blue-glow)",
                }}
              />
              connecting to a node
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
