"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * StayAheadSection - the terminal sign-off CTA band ( "Stay Ahead in
 * Trading" clone, ). A LIGHT section (data-section="light" → white
 * bg, ink text) over a faint diagonal "market-tick" texture: a centered two-tone
 * two-line heading, a short blurb, and a black "Launch Desk" pill. Sits last so
 * the page closes light after the dark UnlockSection - a clean dark→light cut.
 *
 * Heading + blurb + pill rise in on scroll. Reduced-motion / SSR render the final
 * state immediately. Prop-less, self-contained, default export.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** Faint scattered diagonal tick marks - the "market noise" backdrop. A tiled
 *  SVG <pattern> of two short strokes per cell, low opacity, denser-feeling via
 *  a soft vertical fade. Monochrome (hairline gray), never an accent. */
function TickField() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="ao-ticks" width="54" height="54" patternUnits="userSpaceOnUse">
          <path
            d="M14 30 L24 18 M30 40 L40 28"
            style={{ stroke: "var(--hairline)" }}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </pattern>
        <linearGradient id="ao-ticks-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#ao-ticks)" />
      {/* fade the ticks out toward the centre so the headline stays clean */}
      <rect width="100%" height="100%" fill="url(#ao-ticks-fade)" />
    </svg>
  );
}

export default function StayAheadSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const start = reduce || inView;

  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    transition: { duration: 0.6, delay: 0.06 + i * 0.1, ease: EASE },
  });

  return (
    <section
      ref={ref}
      data-section="light"
      aria-labelledby="stay-ahead-title"
      className="relative overflow-hidden"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <TickField />

      <div
        className="relative z-10 mx-auto flex flex-col items-center px-6 py-28 text-center sm:py-36 lg:py-44"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        <motion.h2
          id="stay-ahead-title"
          {...rise(0)}
          className="font-sans"
          style={{
            fontSize: "clamp(32px, 4.8vw, 58px)",
            fontWeight: 420,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            maxWidth: 760,
          }}
        >
          Stop leaking the pattern
          <br />
          with{" "}
          <span style={{ color: "var(--text-faint)" }}>Warren</span>
        </motion.h2>

        <motion.p
          {...rise(1)}
          className="mt-6 font-sans"
          style={{ fontSize: 15, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: "44ch" }}
        >
          Run a node, point the desk at it, and watch a message cross the mixnet — three hops,
          one token per packet, no delivery receipt by design.
        </motion.p>

        <motion.div {...rise(2)} className="mt-9">
          <Link
            href="/desk"
            className="group inline-flex items-center gap-2 font-sans text-[14px] font-medium transition-transform hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--obsidian)",
              color: "var(--frost)",
              borderRadius: "var(--r-pill)",
              padding: "13px 26px",
            }}
          >
            Launch Desk
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
