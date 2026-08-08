"use client";

/**
 * §3.1 - "Why this exists". Light editorial section, no diagram. The forensic
 * register: a mono eyebrow over a two-tone Fraunces headline, two paragraphs of
 * paste-ready report copy, and the four manipulation tactics surfaced as small
 * mono inline chips.
 *
 * Motion (bolder than the prior subtle fades): the two body paragraphs now
 * "write themselves in" word-by-word, sweeping gray→ink as the section travels
 * the viewport center (the ManifestoSection idiom). The tactic chips
 * stagger-pop with a hover lift. Reduced-motion → final ink state instantly,
 * no scroll-driven color, no entrance transforms (inherited from the shared
 * anim primitives and the per-word reduce branch).
 */

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const GRAY = "var(--text-faint)";
const INK = "var(--text-body)";

const TACTICS = ["spoofing", "layering", "wash trading", "marking the close"] as const;

/** One word whose color fills gray→ink as the scroll progress passes its slice. */
function FillWord({
  children,
  index,
  total,
  progress,
}: {
  children: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const start = index / total;
  const end = (index + 1.4) / total;
  const color = useTransform(progress, [start, end], [GRAY, INK]);
  return (
    <motion.span style={{ color }} className="transition-colors">
      {children}{" "}
    </motion.span>
  );
}

/**
 * A paragraph whose plain-text segments fill in word-by-word on scroll while
 * embedded rich nodes (e.g. <strong/>) render verbatim. Segments are supplied
 * as an ordered list of strings (filled) and ReactNodes (verbatim).
 */
function FillParagraph({
  text,
  progress,
  reduce,
}: {
  text: string;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  if (reduce) {
    return <p style={{ color: INK }}>{text}</p>;
  }
  const words = text.split(" ");
  return (
    <p>
      {words.map((w, i) => (
        <FillWord key={`${w}-${i}`} index={i} total={words.length} progress={progress}>
          {w}
        </FillWord>
      ))}
    </p>
  );
}

function TacticChip({ label, index }: { label: string; index: number }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <span className="inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[var(--bg-inset)] px-3 py-1 font-mono text-xs tracking-[0.08em] text-[color:var(--text-body)]">
        {label}
      </span>
    );
  }
  return (
    <motion.span
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, scale: 1.04 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: 0.06 * index, duration: 0.5, ease: EASE }}
      className="inline-flex cursor-default items-center rounded-full border border-[color:var(--border-default)] bg-[var(--bg-inset)] px-3 py-1 font-mono text-xs tracking-[0.08em] text-[color:var(--text-body)] transition-colors hover:border-[color:var(--text-faint)]"
    >
      {label}
    </motion.span>
  );
}

export function MotivationSection() {
  const reduce = useReducedMotion() ?? false;
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Drive the word-fill off the body block's travel through the viewport.
  const { scrollYProgress } = useScroll({
    target: bodyRef,
    offset: ["start 0.85", "end 0.45"],
  });

  // Split the [0,1] fill across the two paragraphs so the second begins as the
  // first finishes (a continuous top-to-bottom sweep).
  const p1 = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const p2 = useTransform(scrollYProgress, [0.4, 1], [0, 1]);

  const PARA_1 =
    "Markets can be rigged. A trader can post orders they never plan to fill to fake demand (spoofing), stack fake depth across price levels (layering), trade with themselves to invent volume (wash trading), or push the closing price to mark their own book. Regulators write rules against each of these, but the rules are fixed while the tactics keep moving - a small change to a known trick can slip a rule written for last year's version of it.";
  const PARA_2 =
    "Two obvious fixes both fall short. Writing new rules by hand is slow and always a step behind. Letting an AI model decide the verdict is worse: the decision becomes a black box a regulator can't audit and an opponent can try to talk its way past. Alpha & Oversight keeps the verdict deterministic and auditable, and lets the system write its own new rules the moment an old one is beaten.";

  return (
    <section data-hiw="motivation" className="relative px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[var(--maxw-content)]">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            §3.1 · The problem
          </p>
        </Reveal>

        <h2 className="sr-only">Why this exists</h2>
        <MaskLines
          className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl"
          lines={[
            <span key="0" className="text-[color:var(--text-primary)]">
              Why this exists
            </span>,
            <span key="1" className="text-[color:var(--text-faint)]">
              - the rules stand still, the tactics move.
            </span>,
          ]}
        />

        <div
          ref={bodyRef}
          className="mt-9 max-w-[64ch] space-y-6 text-lg leading-relaxed"
        >
          <FillParagraph text={PARA_1} progress={p1} reduce={reduce} />
          <FillParagraph text={PARA_2} progress={p2} reduce={reduce} />
        </div>

        <Reveal delay={0.16} className="mt-10">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            The four tactics it watches
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {TACTICS.map((t, i) => (
              <TacticChip key={t} label={t} index={i} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default MotivationSection;
