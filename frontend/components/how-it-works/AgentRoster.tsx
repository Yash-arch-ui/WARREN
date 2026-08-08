"use client";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * AgentRoster - "The cast". The red-team adversary + the seven-agent
 * Surveillance pipeline + the deterministic rule engine, sourced verbatim from
 * the project report (§02 roster). Each card shows the role, its model tier
 * (frontier = gold, open = graphite - tone-only, never decorative), and what it
 * sends/receives over Band. Light backbone (inherits the page's data-section).
 *
 * Scroll motion via the shared Reveal/MaskLines primitives (reduced-motion safe).
 */

type Tier = "frontier" | "open" | "deterministic";
type Agent = {
  name: string;
  tier: Tier;
  model: string;
  role: string;
  io: string; // what it puts on / takes off Band
};

const ADVERSARY: Agent = {
  name: "Adversary",
  tier: "open",
  model: "Qwen3-Next-80B",
  role: "Invents fresh manipulation tactics engineered to slip every active rule while still making money. Only confirmed evasions cross the wall.",
  io: "sends HANDOFF across the wall",
};

const SURVEILLANCE: Agent[] = [
  {
    name: "Anomaly Detector",
    tier: "open",
    model: "Qwen3-Next-80B",
    role: "First glance at a window of orders - computes the hard features (cancel-to-fill, depth, self-match) and decides what smells off.",
    io: "receives HANDOFF · opens the case",
  },
  {
    name: "Investigator",
    tier: "open",
    model: "Qwen3-Next-80B",
    role: "Opens the case and recruits the right specialist by looking up who is available on Band. The only tool-using agent.",
    io: "sends HANDOFF (recruit)",
  },
  {
    name: "Specialist",
    tier: "open",
    model: "Qwen3-Next-80B",
    role: "Domain expert for one manipulation family; proposes the contested inputs the engine cannot derive on its own.",
    io: "sends EVIDENCE",
  },
  {
    name: "Prosecution",
    tier: "frontier",
    model: "claude-sonnet-4-6",
    role: "Argues the reading that makes the order flow look most like manipulation.",
    io: "debates locally - off Band",
  },
  {
    name: "Defense",
    tier: "open",
    model: "Qwen3.6-35B-A3B",
    role: "Argues the innocent reading - legitimate, bona-fide trading.",
    io: "debates locally - off Band",
  },
  {
    name: "Adjudicator",
    tier: "open",
    model: "Qwen3-Next-80B",
    role: "Reads both arguments and resolves them into one conservative set of engine-ready inputs.",
    io: "hands resolved inputs to the engine",
  },
  {
    name: "Escalation Manager",
    tier: "frontier",
    model: "gpt-5-mini",
    role: "When the rulebook misses, packages a clear brief for the human and recommends an action.",
    io: "sends ESCALATION",
  },
];

const TIER_META: Record<Tier, { label: string; tone: string }> = {
  frontier: { label: "frontier", tone: "var(--tier-frontier)" },
  open: { label: "open", tone: "var(--tier-open)" },
  deterministic: { label: "deterministic", tone: "var(--verdict-escalate)" },
};

function TierBadge({ tier }: { tier: Tier }) {
  const m = TIER_META[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2 py-[3px] font-mono text-[10px]"
      style={{ color: m.tone, borderColor: `${m.tone}55` }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: m.tone }}
      />
      {m.label}
    </span>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <article
      className="flex h-full flex-col p-5"
      style={{
        borderRadius: "var(--r-card)",
        border: "1px solid var(--hairline)",
        backgroundColor: "var(--bg-card)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="font-sans"
          style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text-primary)" }}
        >
          {agent.name}
        </h3>
        <TierBadge tier={agent.tier} />
      </div>
      <code className="mt-1 font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
        {agent.model}
      </code>
      <p className="mt-3 font-sans" style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }}>
        {agent.role}
      </p>
      <div
        className="mt-4 flex items-center gap-2 border-t pt-3 font-mono text-[10.5px]"
        style={{ borderColor: "var(--hairline)", color: "var(--band-blue)" }}
      >
        <span aria-hidden="true">▸</span>
        {agent.io}
      </div>
    </article>
  );
}

export function AgentRoster() {
  return (
    <section
      aria-labelledby="hiw-cast-title"
      className="mx-auto px-6 pt-28 pb-20 sm:pt-32"
      style={{ maxWidth: "var(--maxw-content)", backgroundColor: "var(--bg-page)" }}
    >
      <Reveal>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          Meet the agents
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,44px)] font-light tracking-[-0.02em] leading-[1.08]"
        lines={[
          <span key="l1" id="hiw-cast-title" style={{ color: "var(--text-primary)" }}>
            Eight agents.
          </span>,
          <span key="l2" style={{ color: "var(--text-muted)" }}>
            One rule engine.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          You just watched them hand a case down the line. Here is who they are.
          Two roles - Prosecution and the human-facing Escalation Manager - run a
          frontier model; the workhorses run a strong, cheaper open model. The
          rule engine isn’t an agent at all.
        </p>
      </Reveal>

      {/* Red team */}
      <Reveal delay={0.05}>
        <div className="mt-14 flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--desk-rnd)" }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            Red team · R&amp;D desk
          </span>
        </div>
      </Reveal>
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Reveal delay={0.05} className="md:col-span-1">
          <AgentCard agent={ADVERSARY} />
        </Reveal>
        <Reveal delay={0.1} className="md:col-span-2">
          <div
            className="flex h-full flex-col justify-center p-6"
            style={{ borderRadius: "var(--r-card)", border: "1px dashed var(--border-default)", backgroundColor: "transparent" }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--desk-rnd)" }}>
              Two deterministic referees
            </span>
            <p className="mt-3 font-sans" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>
              Before any evasion may cross the wall, code - not a model - checks it
              twice: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>did it evade?</strong> (the
              real engine returns PASS) and <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>was it real?</strong> (it
              must profit and move price). Only a sequence that does both is a
              confirmed novel evasion.
            </p>
          </div>
        </Reveal>
      </div>

      {/* Blue team */}
      <Reveal delay={0.05}>
        <div className="mt-14 flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--desk-surv)" }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            Blue team · Surveillance desk
          </span>
        </div>
      </Reveal>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SURVEILLANCE.map((a, i) => (
          <Reveal key={a.name} delay={0.04 * i}>
            <AgentCard agent={a} />
          </Reveal>
        ))}
        {/* Rule engine - distinct, not an agent */}
        <Reveal delay={0.04 * SURVEILLANCE.length}>
          <article
            className="flex h-full flex-col p-5"
            style={{
              borderRadius: "var(--r-card)",
              border: "1px solid var(--verdict-escalate)",
              backgroundColor: "var(--bg-card-2)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-sans" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                Rule Engine
              </h3>
              <TierBadge tier="deterministic" />
            </div>
            <code className="mt-1 font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
              plain code - not an LLM
            </code>
            <p className="mt-3 font-sans" style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }}>
              Walks the active rules over the agreed numbers and returns PASS or
              FLAG - same inputs, same answer, every time. The single authority
              that decides. No agent can overrule it.
            </p>
            <div
              className="mt-4 flex items-center gap-2 border-t pt-3 font-mono text-[10.5px]"
              style={{ borderColor: "var(--hairline)", color: "var(--band-blue)" }}
            >
              <span aria-hidden="true">▸</span>
              broadcasts VERDICT
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
