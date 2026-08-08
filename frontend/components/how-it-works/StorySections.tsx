"use client";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * StorySections - the reveal-on-scroll editorial blocks that sit BELOW the
 * pinned scroll-story (owned by teammate "Evasion"). Light backbone; tokens
 * resolve to the white theme inside the lead's data-section="light" wrap.
 *
 * Three blocks:
 *   (a) "Two desks"     - R&D (red team, --desk-rnd) ⚔ Surveillance (blue team,
 *                         --desk-surv) as two cards explaining the Chinese-wall
 *                         co-evolution.
 *   (b) "Four detectors"- spoofing / layering / wash_trade / marking, each with
 *                         its cited-metric keys + seed threshold in mono (exact
 *                         from CONTEXT.md §2).
 *   (c) "Deterministic by design" - LLMs debate, the rule engine decides; no
 *                         LLM overrules.
 *
 * Shared primitives Reveal + MaskLines carry the reduced-motion fallbacks.
 */

// ---- block (a): the two desks --------------------------------------------
type Desk = {
  team: string;
  name: string;
  role: string;
  body: string;
  tone: string; // CSS var for the desk accent (tone-only, per D3)
};

const DESKS: Desk[] = [
  {
    team: "Red team",
    name: "R&D Desk",
    role: "The adversary",
    body: "Invents market-manipulation tactics engineered to evade the current rule book. Two deterministic oracles judge each candidate: it must both evade the engine and move price at a profit before it counts as a confirmed novel evasion.",
    tone: "--desk-rnd",
  },
  {
    team: "Blue team",
    name: "Surveillance Desk",
    role: "The auditor",
    body: "Receives only sanitized order flow across the Chinese wall - events, never the adversary's reasoning. An LLM-agent debate proposes contested inputs; the deterministic rule engine renders the authoritative verdict.",
    tone: "--desk-surv",
  },
];

// ---- block (b): the four detectors ---------------------------------------
type Detector = {
  family: string; // lowercase RuleFamily key (exact)
  title: string;
  source: string; // regulation the seed rule derives from
  catches: string; // plain-English: what manipulation this is
  seed: string; // seed rule id
  metric: string; // the headline cited-metric key
  threshold: string;
  citedKeys: string; // full cited-metric key list (mono)
};

const DETECTORS: Detector[] = [
  {
    family: "spoofing",
    title: "Spoofing",
    source: "FINRA 5210",
    catches:
      "Posting orders you never intend to fill to fake demand, then pulling them - cancel ≥ 80% of posted orders inside the window.",
    seed: "FINRA-5210-spoofing",
    metric: "cancel_ratio",
    threshold: "≥ 0.8",
    citedKeys:
      "cancel_ratio · near_fill_cancel_ratio · spoof_side · window_ms · threshold",
  },
  {
    family: "layering",
    title: "Layering",
    source: "FINRA 5210",
    catches:
      "Stacking orders across three or more price levels to fake book depth, then cancelling once the market moves your way.",
    seed: "FINRA-5210-layering",
    metric: "depth_levels",
    threshold: "≥ 3",
    citedKeys:
      "depth_levels · cancel_span_ms · layer_side · window_ms · threshold",
  },
  {
    family: "wash_trade",
    title: "Wash trade",
    source: "SEC 10b-5",
    catches:
      "Trading with yourself to manufacture fake volume - more than half of the filled quantity self-matched.",
    seed: "SEC-10b-5-wash",
    metric: "self_match_ratio",
    threshold: "> 0.5",
    citedKeys:
      "self_match_ratio · self_matched_qty · total_filled_qty · threshold",
  },
  {
    family: "marking",
    title: "Marking the close",
    source: "SEC 10b-5",
    catches:
      "Pushing the closing print to mark your own book - moving the end-of-day price by 100 bps or more.",
    seed: "SEC-10b-5-marking",
    metric: "eod_print_move_bps",
    threshold: "≥ 100.0",
    citedKeys: "eod_print_move_bps · ref_price · close_price · threshold",
  },
];

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "var(--text-muted)",
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono" style={EYEBROW}>
      {children}
    </span>
  );
}

export function TwoDesks() {
  return (
    <div
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      {/* ---- Two desks · one wall --------------------------------------- */}
      <section
        aria-label="Two desks, one wall"
        className="mx-auto px-6 pt-28 pb-20 sm:pt-36"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        <Reveal>
          <SectionEyebrow>Two desks · one wall</SectionEyebrow>
        </Reveal>
        <MaskLines
          className="mt-5 font-sans"
          lineClassName="text-[clamp(28px,4vw,44px)] font-light tracking-[-0.02em] leading-[1.08]"
          lines={[
            <span key="l1" style={{ color: "var(--text-primary)" }}>
              Co-evolution, by
            </span>,
            <span key="l2" style={{ color: "var(--text-muted)" }}>
              construction.
            </span>,
          ]}
        />

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {DESKS.map((desk, i) => (
            <Reveal key={desk.name} delay={i * 0.08}>
              <article
                className="flex h-full flex-col p-7"
                style={{
                  borderRadius: "var(--r-card)",
                  border: "1px solid var(--hairline)",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      backgroundColor: `var(${desk.tone})`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      color: "var(--text-muted)",
                    }}
                  >
                    {desk.team}
                  </span>
                </div>
                <h3
                  className="mt-4 font-sans"
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    color: "var(--text-primary)",
                  }}
                >
                  {desk.name}
                </h3>
                <span
                  className="mt-1 font-mono"
                  style={{ fontSize: 12, color: `var(${desk.tone})` }}
                >
                  {desk.role}
                </span>
                <p
                  className="mt-5 font-sans"
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--text-body)",
                  }}
                >
                  {desk.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* the wall caption */}
        <Reveal delay={0.1}>
          <p
            className="mx-auto mt-10 max-w-2xl text-center font-sans"
            style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}
          >
            The desks never share a model or a memory. They coordinate only
            through Band - and only the surveillance side ever sees the order
            flow. The wall is what makes the contest honest.
          </p>
        </Reveal>
      </section>
    </div>
  );
}

/**
 * FourDetectors - the rulebook's four seed families (report §06): spoofing &
 * layering (FINRA 5210), wash trade & marking-the-close (SEC 10b-5), each with
 * its plain-English description + cited-metric threshold.
 */
export function FourDetectors() {
  return (
    <div
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      {/* ---- Four detectors --------------------------------------------- */}
      <section
        aria-labelledby="hiw-detectors-title"
        className="mx-auto px-6 pt-8 pb-20"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        <Reveal>
          <SectionEyebrow>Four detectors</SectionEyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            id="hiw-detectors-title"
            className="mt-5 font-sans"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1.08,
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>Every flag is a </span>
            <span style={{ color: "var(--text-muted)" }}>cited metric.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {DETECTORS.map((d, i) => (
            <Reveal key={d.family} delay={i * 0.06}>
              <article
                className="flex h-full flex-col p-6"
                style={{
                  borderRadius: "var(--r-card)",
                  border: "1px solid var(--hairline)",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className="font-sans"
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {d.title}
                  </h3>
                  <code
                    className="font-mono"
                    style={{ fontSize: 11, color: "var(--text-faint)" }}
                  >
                    {d.source}
                  </code>
                </div>

                {/* plain-English: what this manipulation is */}
                <p
                  className="mt-3 font-sans"
                  style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }}
                >
                  {d.catches}
                </p>

                {/* headline rule: metric ≥ threshold */}
                <div
                  className="mt-5 flex items-center gap-2 font-mono"
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: "var(--r-chip)",
                    backgroundColor: "var(--bg-card-2)",
                    color: "var(--text-body)",
                  }}
                >
                  <span style={{ color: "var(--text-primary)" }}>{d.metric}</span>
                  <span style={{ color: "var(--text-muted)" }}>{d.threshold}</span>
                  <span
                    className="ml-auto"
                    style={{ color: "var(--text-faint)", fontSize: 11 }}
                  >
                    → FLAG
                  </span>
                </div>

                {/* seed rule provenance */}
                <span
                  className="mt-3 font-mono"
                  style={{ fontSize: 11, color: "var(--text-muted)" }}
                >
                  seed · {d.seed}
                </span>

                {/* full cited-metric key list */}
                <span
                  className="mt-4 font-mono"
                  style={{
                    fontSize: 11,
                    lineHeight: 1.7,
                    color: "var(--text-faint)",
                    wordBreak: "break-word",
                  }}
                >
                  {d.citedKeys}
                </span>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

    </div>
  );
}

/**
 * DeterministicClose - "The models debate; the rule engine decides." Pulled out
 * of StorySections so it can sit AFTER the EvasionStory as the page's closing
 * thesis (the report's §06 boundary: LLMs argue, code decides).
 */
export function DeterministicClose() {
  return (
    <section
      aria-labelledby="hiw-determinism-title"
      className="mx-auto px-6 pt-8 pb-32"
      style={{ maxWidth: "var(--maxw-content)", backgroundColor: "var(--bg-page)" }}
    >
      <Reveal>
        <div
          className="mx-auto flex max-w-3xl flex-col items-center p-10 text-center sm:p-14"
          style={{
            borderRadius: "var(--r-card)",
            border: "1px solid var(--hairline)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          <SectionEyebrow>Deterministic by design</SectionEyebrow>
          <h2
            id="hiw-determinism-title"
            className="mt-5 font-sans"
            style={{
              fontSize: "clamp(24px, 3.4vw, 36px)",
              fontWeight: 300,
              letterSpacing: "-0.015em",
              lineHeight: 1.12,
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>
              The models debate.{" "}
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              The rule engine decides.
            </span>
          </h2>
          <p
            className="mt-6 max-w-xl font-sans"
            style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-body)" }}
          >
            Prosecution and Defense argue the case, but their argument is
            load-bearing only through the contested inputs they resolve. The
            verdict itself is rendered by a deterministic rule engine that flags
            on the first active rule that trips.
            <span style={{ color: "var(--text-primary)" }}>
              {" "}No LLM ever overrules it.
            </span>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
