"use client";

/**
 * §3.5 - "What's actually new". A thesis line, a 2×3 forensic feature grid
 * (six cards · mono title + one-line body), then the model-family-diversity
 * panel (§6 matrix) on a dark stage. The four adversarial-boundary seats run
 * four different families - that is the differentiator, so the family column is
 * highlighted. Token-only colours; band-blue stays sacred (never used here).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const COUNT_MS = 900;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Zero-padded count-up for a feature index ("01".."06"). Reduced-motion or
 * out-of-view → final value immediately. */
function IndexCount({ id }: { id: string }) {
  const reduce = useReducedMotion() ?? false;
  const target = parseInt(id, 10);
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(reduce ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || !inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setValue(Math.round(target * EASE_OUT(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, reduce, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {String(value).padStart(2, "0")}
    </span>
  );
}

/* ── feature-grid copy (paste-ready, authoritative) ───────────────────────── */
type Feature = { id: string; title: string; body: string };
const FEATURES: Feature[] = [
  {
    id: "01",
    title: "The code decides, not a model.",
    body: "The rule engine is the only authority for PASS or FLAG.",
  },
  {
    id: "02",
    title: "The rulebook co-evolves.",
    body: "A confirmed miss becomes a regression-tested rule in one step.",
  },
  {
    id: "03",
    title: "The wall is structural.",
    body:
      "Two separate Band identities; the crossing strips reasoning and model identity. Isolation by construction, not policy.",
  },
  {
    id: "04",
    title: "The audit binds real messages.",
    body: "The hash chain ties each step to a real Band message id.",
  },
  {
    id: "05",
    title: "Different model families guard each other.",
    body:
      "The four seats on an adversarial boundary run four different model families, so a blind spot in one can't quietly pass to the next.",
  },
  {
    id: "06",
    title: "Both gates are deterministic.",
    body:
      "A new evasion must beat the real engine and profit in a backtest. Neither test is an LLM.",
  },
];

/* ── §6 model-family matrix (current backend, 2026-06-17) ─────────────────── */
type Seat = { seat: string; model: string; family: string; boundary: boolean; frontier?: boolean };
const SEATS: Seat[] = [
  { seat: "Adversary (R&D)", model: "claude-opus-4-8", family: "Anthropic", boundary: true, frontier: true },
  { seat: "Prosecution", model: "Kimi-K2.7", family: "Moonshot", boundary: true },
  { seat: "Defense", model: "DeepSeek-V4-Pro", family: "DeepSeek", boundary: true },
  { seat: "Adjudicator", model: "GLM-5.2", family: "Zhipu", boundary: true },
  { seat: "Escalation Manager", model: "Qwen3.5-397B", family: "Qwen", boundary: false },
  { seat: "Anomaly · Investigator · Specialist", model: "Qwen3-Next-80B", family: "Qwen", boundary: false },
  { seat: "Rule engine", model: "- deterministic", family: "-", boundary: false },
];

/* ── a single forensic feature card (staggered entrance + hover lift) ──────── */
function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const reduce = useReducedMotion() ?? false;

  const inner = (
    <>
      <span className="absolute left-0 top-6 h-7 w-[3px] rounded-full bg-[var(--text-faint)] opacity-60" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-faint)]">
        <IndexCount id={feature.id} />
      </span>
      <h3 className="font-mono text-[15px] font-semibold leading-snug text-[color:var(--text-primary)]">
        {feature.title}
      </h3>
      <p className="text-[14px] leading-relaxed text-[color:var(--text-body)]">{feature.body}</p>
    </>
  );

  const cls =
    "group relative flex h-full flex-col gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[color:var(--border-default)]";

  if (reduce) return <div className={cls}>{inner}</div>;

  return (
    <motion.div
      className={cls}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: 0.07 * index, duration: 0.6, ease: EASE }}
    >
      {inner}
    </motion.div>
  );
}

/** A matrix row that fades+rises in sequence as the table enters view.
 * Reduced-motion → static row. Content is passed verbatim as children. */
function MatrixRow({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  const cls = "border-b border-[color:var(--border-subtle)] last:border-b-0";
  if (reduce) return <tr className={cls}>{children}</tr>;
  return (
    <motion.tr
      className={cls}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: 0.08 * index, duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.tr>
  );
}

export function WhatsDifferent() {
  const heading: ReactNode[] = [
    <span key="a" className="text-[color:var(--text-primary)]">
      What&apos;s
    </span>,
    <span key="b" className="text-[color:var(--text-faint)]">
      actually new.
    </span>,
  ];

  return (
    <section
      id="different"
      data-hiw="different"
      className="relative w-full py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[var(--maxw-content)] px-6">
        {/* ── heading ─────────────────────────────────────────────────── */}
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            The differentiator
          </p>
        </Reveal>
        <h2 className="sr-only">What&apos;s actually new</h2>
        <MaskLines
          lines={heading}
          delay={0.05}
          className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl"
          lineClassName="pr-1"
        />
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--text-body)]">
            Plenty of systems put a model in the loop. The point here is the
            opposite: every load-bearing decision is structural or deterministic,
            and the models only ever shape contested inputs.
          </p>
        </Reveal>

        {/* ── 2×3 feature grid ────────────────────────────────────────── */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.id} feature={f} index={i} />
          ))}
        </div>

        {/* ── model-family-diversity panel (dark stage) ───────────────── */}
        <div className="mt-20">
          <Reveal>
            <div
              data-section="dark"
              className="ops-grain relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[var(--obsidian)] p-7 sm:p-10"
            >
              <div className="ops-grid ops-grid-fade pointer-events-none absolute inset-0" aria-hidden />

              <div className="relative">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                  Model-family diversity
                </p>
                <h3 className="mt-3 font-display text-2xl leading-tight text-[color:var(--text-primary)] sm:text-3xl">
                  Four seats, four families, one adversarial boundary.
                </h3>
                <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[color:var(--text-body)]">
                  The four seats that sit on an adversarial boundary - adversary,
                  prosecution, defense, adjudicator - run four different model
                  families. A manipulation the Anthropic adversary hides should be
                  caught by a Moonshot prosecutor, weighed against a DeepSeek
                  defender, and adjudicated by a Zhipu model - none of which share
                  the adversary&apos;s blind spots.
                </p>

                {/* matrix */}
                <div className="mt-8 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[color:var(--border-default)]">
                        <th className="py-3 pr-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                          Seat
                        </th>
                        <th className="py-3 pr-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                          Model
                        </th>
                        <th className="py-3 pr-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-primary)]">
                          Family
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SEATS.map((s, i) => (
                        <MatrixRow key={s.seat} index={i}>
                          <td className="py-3 pr-4 align-top">
                            <span className="flex items-center gap-2">
                              {s.boundary && (
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--desk-surv)]"
                                  aria-hidden
                                />
                              )}
                              <span className="text-[13.5px] text-[color:var(--text-body)]">
                                {s.seat}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span className="font-mono text-[12.5px] text-[color:var(--text-muted)]">
                              {s.model}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span
                              className={
                                s.family === "-"
                                  ? "font-mono text-[12.5px] text-[color:var(--text-faint)]"
                                  : "font-mono text-[12.5px] font-semibold text-[color:var(--text-primary)]"
                              }
                            >
                              {s.family}
                              {s.frontier && (
                                <span className="ml-2 rounded border border-[color:var(--tier-frontier)] px-1.5 py-px text-[10px] uppercase tracking-[0.14em] text-[color:var(--tier-frontier)]">
                                  frontier
                                </span>
                              )}
                            </span>
                          </td>
                        </MatrixRow>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-faint)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--desk-surv)]" aria-hidden />
                  adversarial-boundary seat
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default WhatsDifferent;
