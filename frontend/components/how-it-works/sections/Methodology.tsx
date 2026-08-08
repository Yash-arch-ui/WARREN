"use client";

/**
 * §3.3 - Methodology: the five sub-flows that form the spine of /how-it-works.
 * A cinematic forensic-ops run (a)…(e), each a MethodBlock (mono eyebrow +
 * two-tone .font-display heading + lead-in + its visual). Sub-flow (d) renders
 * the integration-supplied `evasionSlot`. Token-only colours; dark stages are
 * tagged data-section="dark" so frost inks resolve. Reveals via Reveal/MaskLines
 * (reduced-motion safe by inheritance).
 */

import type { ReactNode } from "react";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import CaseRelayDiagram from "@/components/how-it-works/diagram/CaseRelayDiagram";
import OracleLoopDiagram from "@/components/how-it-works/diagram/OracleLoopDiagram";
import VerdictDiagram from "@/components/how-it-works/diagram/VerdictDiagram";
import TrustDiagram from "@/components/how-it-works/diagram/TrustDiagram";

/* ── a single sub-flow: eyebrow (a)…(e) · two-tone heading · lead-in · visual ── */
function MethodBlock({
  step,
  headPrimary,
  headFaint,
  lead,
  children,
  delay = 0,
  bare = false,
}: {
  step: string;
  headPrimary: string;
  headFaint: string;
  lead: ReactNode;
  children: ReactNode;
  delay?: number;
  /** When true, render `children` RAW - no <Reveal> wrapper. Required for a
   *  child that pins via position:sticky (e.g. EvasionStory): a motion transform
   *  ancestor establishes a containing block that breaks the sticky pin. */
  bare?: boolean;
}) {
  return (
    <article className="border-t border-[color:var(--border-subtle)] pt-12 first:border-t-0 first:pt-0 sm:pt-16">
      <Reveal delay={delay} className="mb-7">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
          {step}
        </p>
        <h3 className="sr-only">{`${headPrimary} ${headFaint}`}</h3>
        <MaskLines
          className="mt-3 font-display text-3xl leading-[1.06] sm:text-[2.6rem]"
          lines={[
            <span key="p" className="text-[color:var(--text-primary)]">
              {headPrimary}
            </span>,
            <span key="f" className="text-[color:var(--text-faint)]">
              {headFaint}
            </span>,
          ]}
        />
      </Reveal>
      <Reveal delay={delay + 0.05} className="mb-10 max-w-[60ch]">
        <p className="text-base leading-relaxed text-[color:var(--text-body)] sm:text-lg">
          {lead}
        </p>
      </Reveal>
      {bare ? children : <Reveal delay={delay + 0.08}>{children}</Reveal>}
    </article>
  );
}

/* ── a dark cinematic stage wrapping a kit diagram (token gotcha: data-section) ── */
function Stage({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure
      data-section="dark"
      className="ops-grain relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[var(--obsidian)] p-5 sm:p-8"
    >
      <div className="ops-grid ops-grid-fade pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-[1]">{children}</div>
      <figcaption className="relative z-[1] mt-5 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {label}
      </figcaption>
    </figure>
  );
}

/* ── (c) supporting strip: the four seed detectors, rebuilt (not the old comp) ── */
const SEED_RULES: {
  family: string;
  reg: string;
  metric: string;
  threshold: string;
}[] = [
  { family: "spoofing", reg: "FINRA 5210", metric: "cancel_ratio", threshold: "≥ 0.8" },
  { family: "layering", reg: "FINRA 5210", metric: "depth_levels", threshold: "≥ 3" },
  { family: "wash", reg: "SEC 10b-5", metric: "self_match_ratio", threshold: "> 0.5" },
  { family: "marking", reg: "SEC 10b-5", metric: "eod_print_move_bps", threshold: "≥ 100" },
];

function SeedDetectors() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SEED_RULES.map((r, i) => (
        <Reveal key={r.family} delay={i * 0.05}>
          <div className="flex items-baseline justify-between gap-4 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4">
            <div>
              <p className="font-mono text-sm font-semibold text-[color:var(--text-primary)]">
                {r.family}
              </p>
              <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                {r.reg}
              </p>
            </div>
            <p className="whitespace-nowrap font-mono text-[0.82rem] text-[color:var(--text-body)]">
              {r.metric} <span className="text-[color:var(--verdict-flag)]">{r.threshold}</span>
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function Methodology({ evasionSlot }: { evasionSlot?: ReactNode }) {
  return (
    <section
      id="methodology"
      data-hiw="methodology"
      data-section="light"
      className="py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[var(--maxw-content)] px-6">
        {/* section header */}
        <header className="mb-16 sm:mb-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            Methodology · five sub-flows
          </p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
            <span className="text-[color:var(--text-primary)]">How a case actually moves</span>{" "}
            <span className="text-[color:var(--text-faint)]">- invent, investigate, decide, learn.</span>
          </h2>
        </header>

        <div className="flex flex-col gap-16 sm:gap-24">
          {/* (a) following one case, end to end */}
          <MethodBlock
            step="(a) following one case, end to end"
            headPrimary="A line of agents,"
            headFaint="no one calling the next."
            lead={
              <>
                A case moves down a line of agents that never call each other directly - each
                drops its work on Band and the next picks it up. The Anomaly Detector computes
                hard features (cancel-to-fill, book depth, self-match) and decides if the flow
                looks suspicious. The Investigator recruits the right Specialist by those
                features, not by a guess. The Specialist proposes the contested inputs the engine
                can&apos;t derive - the time window, the bona-fide orders, the intent. Prosecution
                and Defense then argue the case locally, off Band, and the Adjudicator settles
                their numbers.
              </>
            }
          >
            <Stage label="Fig 2 - the case relay across Band">
              <CaseRelayDiagram />
            </Stage>
          </MethodBlock>

          {/* (b) inventing a new evasion */}
          <MethodBlock
            step="(b) inventing a new evasion"
            headPrimary="Two referees,"
            headFaint="before anything crosses."
            lead={
              <>
                A new tactic is never used until it proves itself twice. The Adversary proposes an
                order sequence, and two deterministic referees gate it: the real rule engine must
                miss it (it evades), and a backtest must show it makes money and moves the price
                (it&apos;s real). Only a sequence that evades <em>and</em> profits crosses the
                wall.
              </>
            }
          >
            <Stage label="Fig 3 - the R&D two-oracle gate">
              <OracleLoopDiagram />
            </Stage>
          </MethodBlock>

          {/* (c) who decides the verdict */}
          <MethodBlock
            step="(c) who decides the verdict"
            headPrimary="The verdict is never"
            headFaint="an opinion."
            lead={
              <>
                The verdict is never an opinion. The engine takes the order events, the inputs the
                debate resolved, and the active rules, then runs each rule&apos;s math. The first
                rule that trips returns a FLAG with the rule id and the exact metric that crossed
                the line; if none trip, the case passes. The agents only shape the contested
                inputs. The engine alone turns them into PASS or FLAG, the same way every time.
              </>
            }
          >
            <Stage label="Fig 4 - LLMs set inputs, code decides">
              <VerdictDiagram />
            </Stage>
            <SeedDetectors />
          </MethodBlock>

          {/* (d) closing the loop - integration mounts EvasionStory here */}
          <MethodBlock
            step="(d) closing the loop"
            headPrimary="From four rules"
            headFaint="to five, in one click."
            lead={
              <>
                Here is the part that makes it self-improving. When the Adversary&apos;s novel
                evasion reaches the engine, the seed rules miss it and the case passes - but
                because the flow still looked suspicious, it escalates to a human instead of
                closing. A compliance officer confirms it really is manipulation, and that one
                click does the rest: a new rule is derived from the case, replayed through a
                regression gate to prove it now flags, and codified. Active rules go from four to
                five, and the case flips from PASS to FLAGGED. The Adversary has to invent
                something new.
              </>
            }
            bare
          >
            {/* EvasionStory carries its OWN dark-glass stage (SplitFrame: bg-inset
                + hairline border + shadow), so the INNER story reads dark while the
                OUTER Methodology page stays light - which is what we want. No
                full-bleed black wrapper (that made the outer dark too), and no
                `overflow-hidden`/`transform` ancestor (either re-bases its
                position:sticky pin). Mounted raw via MethodBlock `bare`. */}
            {evasionSlot}
          </MethodBlock>

          {/* (e) why you can trust it */}
          <MethodBlock
            step="(e) why you can trust it"
            headPrimary="A wall you can’t coach,"
            headFaint="a ledger you can’t edit."
            lead={
              <>
                Two things carry the trust. The wall (the SanitizedBridge) strips the
                adversary&apos;s reasoning and model identity before any order crosses, so the
                blue team can&apos;t be coached. The ledger seals every Band message into a hash
                chain - each entry&apos;s hash is built from the previous hash plus the message
                body, and binds the real Band message id. Change one byte and the chain breaks, so{" "}
                <code className="font-mono text-[color:var(--text-primary)]">verify_chain()</code>{" "}
                returns false. The decision isn&apos;t just recorded; it&apos;s tamper-evident.
              </>
            }
          >
            <Stage label="Fig 6 - the wall and the hash chain">
              <TrustDiagram />
            </Stage>
          </MethodBlock>
        </div>
      </div>
    </section>
  );
}

export default Methodology;
