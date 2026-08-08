"use client";

/**
 * §3.2 "The whole picture" - the centerpiece overview. Mono eyebrow + two-tone
 * .font-display headline, the paste-ready body, a full-width dark stage embedding
 * the native ArchitectureDiagram (D1), then a rebuilt two-desks split (editorial
 * cards, not a second diagram) with the Chinese-wall / SanitizedBridge note
 * between them. R&D = red team (1 agent, tone rnd); Surveillance = blue team
 * (7 agents, tone surv); the rule engine is plain code and the sole authority.
 * band-blue stays sacred (only the Band note carries it as the transport-of-record).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import ArchitectureDiagram from "@/components/how-it-works/diagram/ArchitectureDiagram";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const SURV_AGENTS = [
  "Anomaly Detector",
  "Investigator",
  "Specialist",
  "Prosecution",
  "Defense",
  "Adjudicator",
  "Escalation Manager",
] as const;

const COUNT_MS = 1400;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Small RAF count-up for a desk badge (KeyFigures idiom). Reduced-motion or
 * out-of-view → renders the final integer immediately. */
function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(reduce ? to : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || !inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setValue(Math.round(to * EASE_OUT(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(to);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, reduce, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}

/** A run of plain words that fill gray→ink staggered as they enter view
 * (a discrete, dependency-free echo of ManifestoSection's scroll fill - used
 * here so it composes with the inline <strong/> emphasis). Reduced-motion →
 * body color immediately. */
function FillRun({ text, baseDelay }: { text: string; baseDelay: number }) {
  const reduce = useReducedMotion() ?? false;
  const words = text.split(" ");
  if (reduce) return <>{text}</>;
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ color: "var(--text-faint)" }}
          whileInView={{ color: "var(--text-body)" }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ delay: baseDelay + i * 0.012, duration: 0.4, ease: EASE }}
        >
          {w}{" "}
        </motion.span>
      ))}
    </>
  );
}

/** Card-sized entrance (larger offset than the shared Reveal) with an optional
 * hover lift. Reduced-motion → final state, no transform, no hover. */
function LiftCard({
  children,
  delay,
  hover = true,
}: {
  children: ReactNode;
  delay: number;
  hover?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  if (reduce) return <div className="h-full">{children}</div>;
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 48, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={hover ? { y: -6 } : undefined}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.7, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** One staggered surveillance-agent row. Reduced-motion → static row. */
function AgentRow({ name, index }: { name: string; index: number }) {
  const reduce = useReducedMotion() ?? false;
  const inner = (
    <>
      <span
        className="h-4 w-[3px] shrink-0 rounded-full"
        style={{ background: "var(--desk-surv)" }}
        aria-hidden
      />
      <span className="font-mono text-[12px] text-[color:var(--text-primary)]">
        {name}
      </span>
    </>
  );
  const cls =
    "flex items-center gap-2.5 rounded-lg border border-[color:var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5";
  if (reduce) return <li className={cls}>{inner}</li>;
  return (
    <motion.li
      className={cls}
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: 0.3 + index * 0.07, duration: 0.5, ease: EASE }}
    >
      {inner}
    </motion.li>
  );
}

export function HiwOverview() {
  return (
    <section
      id="overview"
      data-hiw="overview"
      className="relative px-6 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[var(--maxw-content)]">
        {/* heading idiom - mono eyebrow + two-tone display headline */}
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            Overview
          </p>
        </Reveal>
        <h2 className="sr-only">The whole picture</h2>
        <MaskLines
          className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl"
          lineClassName=""
          delay={0.05}
          lines={[
            <span key="a" className="text-[color:var(--text-primary)]">
              The whole picture
            </span>,
            <span key="b" className="text-[color:var(--text-faint)]">
              - two desks, one wall.
            </span>,
          ]}
        />

        {/* paste-ready body */}
        <Reveal delay={0.1} className="mt-8 max-w-2xl space-y-5 text-[15px] leading-relaxed text-[color:var(--text-body)]">
          <p>
            <FillRun
              baseDelay={0}
              text="The system is built from two desks that never share a model or a memory. They talk only through Band, a message bus that carries every handoff. The"
            />
            <strong className="font-semibold text-[color:var(--text-primary)]">R&amp;D desk</strong>{" "}
            <FillRun baseDelay={0.3} text="is the red team: one Adversary that invents new evasions. The" />
            <strong className="font-semibold text-[color:var(--text-primary)]">Surveillance desk</strong>{" "}
            <FillRun
              baseDelay={0.55}
              text="is the blue team: seven agents that investigate a case, plus one rule engine that is not an agent at all. The rule engine is plain code, and it is the only thing that decides PASS or FLAG."
            />
          </p>
          <p>
            <FillRun
              baseDelay={0}
              text="Order flow crosses a one-way wall: only the bare orders move from R&D to Surveillance, with the adversary's reasoning and model identity stripped off first. Every message is sealed into a hash-chained ledger, so the whole decision can be replayed and checked."
            />
          </p>
        </Reveal>
      </div>

      {/* full-width dark stage - the native architecture diagram (D1) */}
      <div className="mt-14 sm:mt-20">
        <Reveal>
          <div
            data-section="dark"
            className="ops-grain relative overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--obsidian)] px-4 py-8 sm:px-10 sm:py-12"
          >
            <div className="ops-grid ops-grid-fade absolute inset-0" aria-hidden />
            <div className="relative mx-auto max-w-[1200px]">
              <ArchitectureDiagram />
            </div>
          </div>
        </Reveal>
      </div>

      {/* rebuilt two-desks split (editorial cards) */}
      <div className="mx-auto mt-14 max-w-[var(--maxw-content)] sm:mt-20">
        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* R&D - red team */}
          <LiftCard delay={0}>
            <article className="h-full rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] p-7">
              <header className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--desk-rnd)]">
                    R&amp;D desk · red team
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-[color:var(--text-primary)]">
                    The adversary
                  </h3>
                </div>
                <span className="shrink-0 rounded-full border border-[color:var(--desk-rnd)] px-3 py-1 font-mono text-[11px] text-[color:var(--desk-rnd)]">
                  <CountUp to={1} suffix=" agent" />
                </span>
              </header>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-body)]">
                One Adversary invents new evasions, gated by two deterministic
                oracles before any tactic is trusted.
              </p>
              <ul className="mt-5 space-y-2">
                <li className="flex items-center gap-3 rounded-lg border border-[color:var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3">
                  <span
                    className="h-6 w-[3px] shrink-0 rounded-full"
                    style={{ background: "var(--desk-rnd)" }}
                    aria-hidden
                  />
                  <span className="font-mono text-[13px] text-[color:var(--text-primary)]">
                    Adversary
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-[color:var(--text-muted)]">
                    invents evasions
                  </span>
                </li>
              </ul>
            </article>
          </LiftCard>

          {/* the wall - Chinese wall / SanitizedBridge */}
          <LiftCard delay={0.1} hover={false}>
            <div className="flex h-full min-w-[180px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[color:var(--border-default)] bg-[var(--bg-inset)] px-6 py-7 text-center lg:max-w-[220px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                ⟂ Chinese wall
              </p>
              <div className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)]">
                SanitizedBridge
              </div>
              <p className="text-xs leading-relaxed text-[color:var(--text-body)]">
                Only the bare order events cross R&amp;D → Surveillance. The
                adversary&apos;s reasoning and model identity are stripped off first;
                the rulebook flows back read-only.
              </p>
              <p className="font-mono text-[11px] text-[color:var(--band-blue)]">
                events only · on Band
              </p>
            </div>
          </LiftCard>

          {/* Surveillance - blue team */}
          <LiftCard delay={0.18}>
            <article className="h-full rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] p-7">
              <header className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--desk-surv)]">
                    Surveillance desk · blue team
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-[color:var(--text-primary)]">
                    The investigators
                  </h3>
                </div>
                <span className="shrink-0 rounded-full border border-[color:var(--desk-surv)] px-3 py-1 font-mono text-[11px] text-[color:var(--desk-surv)]">
                  <CountUp to={7} suffix=" agents" />
                </span>
              </header>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-body)]">
                Seven agents investigate a case and shape the contested inputs -
                plus one rule engine that is not an agent, the sole PASS / FLAG
                authority.
              </p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {SURV_AGENTS.map((name, i) => (
                  <AgentRow key={name} name={name} index={i} />
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-[color:var(--tier-frontier)] bg-[var(--bg-inset)] px-4 py-3">
                <span
                  className="h-6 w-[3px] shrink-0 rounded-full"
                  style={{ background: "var(--tier-frontier)" }}
                  aria-hidden
                />
                <span className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)]">
                  Rule engine
                </span>
                <span className="ml-auto font-mono text-[11px] text-[color:var(--tier-frontier)]">
                  not an agent · code decides
                </span>
              </div>
            </article>
          </LiftCard>
        </div>
      </div>
    </section>
  );
}

export default HiwOverview;
