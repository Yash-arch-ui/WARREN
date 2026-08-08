"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useIsMobile } from "./useIsMobile";

/**
 * PoweredBySection - the "Powered by…" scroll-pinned reveal (
 * ). A tall runway + a CSS `position: sticky` stage drives a
 * scrubbed framer-motion timeline (the SAME robust pattern as EvasionStory):
 *
 *   start  - the headline sits DEAD-CENTER on obsidian; the board is offscreen-right.
 *   reveal - the headline translates to its LEFT rest position while the compute
 *            board slides in from the right (x 120% → 0, fades up).
 *   hold   - the composed state holds, then scrolls on to <FaqSection/>.
 *
 * WHY NOT GSAP PIN: the previous GSAP `ScrollTrigger` pin was built via an async
 * `import()`, so its start position was measured against a STALE document height
 * (before the earlier pinned sections inserted their pin-spacers). The pin fired
 * at the wrong scroll position and SNAPPED the section back - the headline
 * appeared to play twice (once scrolling past, once snapped-back with the board).
 * `position: sticky` has no pin-spacer and no measurement race, so the section
 * pins exactly where it should and the FAQ section never overlaps.
 *
 * Reduced-motion OR mobile (<768px): the sticky scrub is skipped entirely and a
 * static stacked layout (headline, then the panel) renders instead.
 */
export default function PoweredBySection() {
  const runwayRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [centerOffset, setCenterOffset] = useState(0);

  // Measure the px offset that visually centers the (left-column) headline over
  // the whole viewport, so it starts dead-center then settles left. Re-measured
  // on resize. No GSAP/ScrollTrigger involvement → no stale-height race.
  useLayoutEffect(() => {
    if (isMobile !== false) return;
    const measure = () => {
      const el = headRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // r.left already reflects the headline's rest (left) position because the
      // transform is 0 at the top of the runway (t=0 maps to centerOffset, but
      // we measure with the element un-transformed on the first layout pass).
      setCenterOffset(window.innerWidth / 2 - (r.left + r.width / 2));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile]);

  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ["start start", "end end"],
  });
  const t = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    restDelta: 0.0001,
  });

  // 0.00→0.50: headline slides from viewport-center to its left rest position;
  // the board slides in from the right and fades up. 0.50→1.00: holds.
  const headX = useTransform(t, [0, 0.5], [centerOffset, 0]);
  const boardX = useTransform(t, [0, 0.5], ["120%", "0%"]);
  const boardOpacity = useTransform(t, [0, 0.3, 0.5], [0, 0.35, 1]);

  // ── Static fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduce === true || isMobile === true) {
    return (
      <section className="relative w-full overflow-hidden bg-[var(--obsidian)] px-6 py-24">
        <div className="mx-auto flex max-w-[var(--maxw-content)] flex-col items-start gap-12">
          <Headline />
          <DifferencePanel />
        </div>
      </section>
    );
  }

  // ── Motion render: tall runway + sticky stage (framer scrub) ────────────
  return (
    <section ref={runwayRef} className="relative h-[200vh] bg-[var(--obsidian)]">
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden bg-[var(--obsidian)]">
        <div className="mx-auto grid w-full max-w-[var(--maxw-content)] grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
          {/* left - headline (starts viewport-centered via measured x offset) */}
          <motion.div ref={headRef} style={{ x: headX }}>
            <Headline />
          </motion.div>

          {/* right - the "why we're different" panel (slides in + fades up) */}
          <motion.div style={{ x: boardX, opacity: boardOpacity }}>
            <DifferencePanel />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const EYEBROW = "Infrastructure";

/** The two-tone "Powered by…" headline + sub (shared by both render paths). */
function Headline() {
  return (
    <div className="w-full max-w-xl lg:max-w-none lg:pr-8 xl:pr-12">
      <span className="mb-5 inline-block font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
        {EYEBROW}
      </span>
      <h2
        className="font-sans"
        style={{
          fontWeight: 420,
          letterSpacing: "-0.012em",
          lineHeight: 1.06,
          fontSize: "clamp(30px, 4.4vw, 60px)",
          color: "var(--text-primary)",
        }}
      >
        Built on published{" "}
        <span style={{ color: "#9a9a9a" }}>cryptographic primitives.</span>
      </h2>
      <p
        className="mt-6 font-sans"
        style={{ fontSize: "clamp(14px, 1.5vw, 17px)", lineHeight: 1.5, color: "var(--text-body)" }}
      >
        Sphinx packet format, Olm's Double Ratchet, RSA blind signatures and a
        K-of-N signed directory - assembled, not invented.
      </p>
    </div>
  );
}

type Diff = { t: string; lead: string; detail: string; tone: string };

/** the four differentiators - "X, not Y" framing answers "why us, not them". */
const DIFFS: Diff[] = [
  {
    t: "Metadata first",
    lead: "The pattern, not just the payload",
    detail: "Content encryption is table stakes. Warren targets who talks to whom, when, and how often - the part that usually leaks.",
    tone: "var(--tier-open)",
  },
  {
    t: "No trusted relay",
    lead: "Split knowledge, not a promise",
    detail: "Each relay peels exactly one layer. Correlating the ends requires colluding with every hop on the path.",
    tone: "var(--tier-frontier)",
  },
  {
    t: "Anonymous admission",
    lead: "Priced, not identified",
    detail: "Blind-signed tokens make flooding expensive without making senders identifiable - the issuer cannot link a token to who received it.",
    tone: "var(--state-delivered)",
  },
  {
    t: "Stated limits",
    lead: "A threat model, not a slogan",
    detail: "A global passive adversary watching every link still wins. That is written down, not hidden.",
    tone: "var(--lane-network)",
  },
];

/** The "why we're different" panel (replaces both render paths' right column). */
function DifferencePanel({
  boardClass,
  labelClass,
}: {
  boardClass?: string;
  labelClass?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[20px] border ${boardClass ?? ""}`}
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, #14161c 0%, #0a0b0d 100%)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* soft top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 75% at 82% 0%, rgba(255,255,255,0.055), transparent 60%)" }}
      />

      <div className="relative p-6 sm:p-8">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Why we&apos;re different
          </span>
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] text-[var(--text-muted)]"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            8 agents · 1 rule engine · 2 tiers
          </span>
        </div>

        <p
          className="mt-4 font-sans"
          style={{ fontSize: "clamp(19px, 2vw, 25px)", fontWeight: 420, lineHeight: 1.18, color: "var(--frost)" }}
        >
          Not another ML black box.
        </p>

        {/* differentiator rows */}
        <ul className="mt-5 flex flex-col">
          {DIFFS.map((d, i) => (
            <li
              key={d.t}
              className={`${labelClass ?? ""} flex gap-3 py-3.5`}
              style={{ borderTop: i ? "1px solid var(--hairline)" : "none" }}
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.tone, boxShadow: `0 0 8px ${d.tone}` }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sans text-[14px] font-medium text-[var(--frost)]">{d.t}</span>
                  <span className="font-mono text-[10.5px]" style={{ color: d.tone }}>
                    {d.lead}
                  </span>
                </div>
                <p className="mt-1 font-sans text-[12.5px] leading-snug text-[var(--text-muted)]">{d.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
