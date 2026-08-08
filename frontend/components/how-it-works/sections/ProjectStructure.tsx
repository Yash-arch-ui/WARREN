"use client";

/**
 * §3.4 - "How the code is organized" (light, compact module map, no diagram).
 * The forensic register: a mono module map where the deterministic core sits
 * apart from the agents that feed it. Editorial heading idiom (mono eyebrow +
 * two-tone .font-display headline), Reveal-staggered rows. No diagram, no hex,
 * band-blue untouched (this section names no on-Band element).
 */

import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type ModuleRow = {
  /** the deterministic core is set apart from the agents that feed it */
  core?: boolean;
  name: string;
  desc: string;
};

const MODULES: ModuleRow[] = [
  { core: true, name: "rules/", desc: "the rule engine, the per-family math, and the rule registry." },
  { name: "agents/", desc: "the agents and their specialist registry." },
  { name: "band/", desc: "Band transport and the SanitizedBridge wall." },
  { core: true, name: "audit/", desc: "the hash-chained ledger." },
  { name: "state/", desc: "the case state machine." },
  { name: "server/", desc: "the FastAPI server (SSE stream, case endpoints, demo triggers)." },
];

function ModuleRowItem({ row, index }: { row: ModuleRow; index: number }) {
  const reduce = useReducedMotion() ?? false;
  const delay = index * 0.09;

  const inner = (
    <div className="group grid grid-cols-[10rem_1fr] items-baseline gap-x-6 gap-y-1 py-5 sm:grid-cols-[14rem_1fr]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={
            "h-1.5 w-1.5 rounded-full " +
            (row.core
              ? "bg-[color:var(--tier-frontier)] " +
                (reduce ? "" : "shadow-[0_0_0_3px_color-mix(in_srgb,var(--tier-frontier)_18%,transparent)]")
              : "bg-[color:var(--text-faint)]")
          }
        />
        <code
          className={
            "font-mono text-base font-semibold tracking-tight text-[color:var(--text-primary)]" +
            (row.core ? " " : "")
          }
        >
          {row.name}
        </code>
      </div>
      <p className="text-[15px] leading-relaxed text-[color:var(--text-body)]">
        {row.desc}
      </p>
    </div>
  );

  if (reduce) {
    return <div className="border-t border-[color:var(--border-subtle)]">{inner}</div>;
  }

  return (
    <motion.div
      className="relative border-t border-[color:var(--border-subtle)]"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      {/* hairline draw: a frontier/faint underline that wipes in left→right */}
      <motion.span
        aria-hidden
        className="absolute left-0 top-0 h-px origin-left"
        style={{
          width: "100%",
          background: row.core ? "var(--tier-frontier)" : "var(--text-faint)",
        }}
        variants={{
          hidden: { scaleX: 0, opacity: row.core ? 0.9 : 0.4 },
          show: {
            scaleX: 1,
            opacity: 0,
            transition: { duration: 0.9, delay, ease: EASE },
          },
        }}
      />
      <motion.div
        variants={{
          hidden: { opacity: 0, x: -28 },
          show: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.6, delay, ease: EASE },
          },
        }}
      >
        {inner}
      </motion.div>
    </motion.div>
  );
}

export function ProjectStructure() {
  return (
    <section
      data-hiw="structure"
      className="px-6 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[var(--maxw-content)]">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              §3.4 · Project structure
            </p>
          </Reveal>
          <h2 className="sr-only">How the code is organized</h2>
          <MaskLines
            className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl"
            lines={[
              <span key="l1" className="text-[color:var(--text-primary)]">
                How the code
              </span>,
              <span key="l2" className="text-[color:var(--text-faint)]">
                is organized.
              </span>,
            ]}
          />
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--text-body)]">
              The backend keeps the deterministic core apart from the agents that
              feed it.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-14 max-w-3xl">
          <Reveal>
            <div className="flex items-center justify-between border-b border-[color:var(--border-default)] pb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                module
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                responsibility
              </span>
            </div>
          </Reveal>

          {MODULES.map((row, i) => (
            <ModuleRowItem key={row.name} row={row} index={i} />
          ))}

          <div className="border-t border-[color:var(--border-subtle)]" />

          <Reveal delay={0.1}>
            <div className="mt-10 flex items-start gap-3">
              <span
                aria-hidden
                className="mt-2 h-px w-8 shrink-0 bg-[color:var(--tier-frontier)]"
              />
              <p className="font-mono text-sm leading-relaxed text-[color:var(--text-muted)]">
                Every flag can be traced from a Band message all the way to a
                cited rule.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default ProjectStructure;
