"use client";

/**
 * §3.6 - "See it live" closing CTA. A dark, cinematic ops stage (obsidian +
 * blueprint grid + grain) with an `.ops-seam` band-blue top hairline. Two
 * actions: primary "Watch it run live" → /desk (the genuine "go to the live
 * Band" action, so it carries the sacred band-blue glow), and secondary "Read
 * the full report (PDF)" → /alpha-oversight-report.pdf.
 *
 * band-blue is reserved for the one CTA that actually walks you onto the live
 * Band; nothing else here is decorative blue. No hard-coded hex - tokens only.
 */

import Link from "next/link";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const FACTS = [
  "8 agents + 1 rule engine",
  "2 desks · 1 wall",
  "4 → 5 rules",
  "100% deterministic verdicts",
];

export function SeeItLive() {
  return (
    <section
      id="see-it-live"
      data-hiw="see-it-live"
      data-section="light"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div className="relative z-10 mx-auto max-w-[var(--maxw-content)] px-6 text-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            Alpha &amp; Oversight · The live desk
          </p>
        </Reveal>

        <h2 className="sr-only">See it live</h2>
        <MaskLines
          delay={0.05}
          className="mt-5 font-display text-5xl leading-[1.04] sm:text-6xl"
          lines={[
            <span key="a" className="text-[color:var(--text-primary)]">
              See it live.
            </span>,
            <span key="b" className="text-[color:var(--text-faint)]">
              Watch the adversary lose.
            </span>,
          ]}
        />

        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[color:var(--text-body)] sm:text-lg">
            Open the desk to watch a case move across Band in real time - the
            handoff, the local debate, and the deterministic verdict - or read
            the full report for the architecture end to end.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {/* primary - the genuine "step onto the live Band" action (sacred blue) */}
            <Link
              href="/desk"
              className="ops-glow-band group inline-flex items-center gap-3 rounded-full bg-[var(--band-blue)] px-7 py-3.5 font-mono text-sm font-semibold tracking-[0.02em] text-[color:var(--frost)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span
                className="h-2 w-2 rounded-full bg-[var(--frost)] opacity-90"
                aria-hidden
              />
              Watch it run live
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>

            {/* secondary - read the report. Plain <a> (NOT next/link): the PDF is
                a static /public asset, not an app route, so the App Router router
                can't navigate to it - a Link silently does nothing. Open in a new
                tab. */}
            <a
              href="/alpha-oversight-report.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] px-7 py-3.5 font-mono text-sm font-semibold tracking-[0.02em] text-[color:var(--text-primary)] transition-colors duration-200 hover:border-[color:var(--text-muted)]"
            >
              Read the full report (PDF)
            </a>
          </div>
        </Reveal>

        {/* mono fact-strip - system-true, no embellishment */}
        <Reveal delay={0.24}>
          <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-xs text-[color:var(--text-muted)]">
            {FACTS.map((fact, i) => (
              <li key={fact} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="text-[color:var(--text-faint)]" aria-hidden>
                    ·
                  </span>
                )}
                <span className="tracking-[0.04em]">{fact}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export default SeeItLive;
