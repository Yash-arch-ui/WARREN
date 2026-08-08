"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import PathNonagon from "./PathNonagon";

/**
 * OverviewSection - the "#overview" anchor: a NONAGON of every role on the two
 * roles, with the wire at the centre. Nine nodes sit on a 9-sided ring; the nine
 * sides are the nine stages of a send, each carrying a real artifact, forming one
 * closed loop. Replaces a linear box-row so a reviewer cannot read it
 * as "two parties pass a message" - the wire is the hub every role binds to.
 *
 * The desktop nonagon SVG lives in the shared `PathNonagon` component (also used
 * to fill the hero laptop screen via HeroSplitArt). DARK section. Below md a
 * stacked hop list takes over. Reduced-motion renders the final state.
 *
 * Prop-less, self-contained, default export. id="overview".
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* mobile list rows (full payloads) */
const HOPS = [
  { n: "01", from: "directory", to: "you", via: "signed relay list · K-of-N attested", kind: "wall" as const },
  { n: "02", from: "issuer", to: "you", via: "blind-signed tokens · unlinkable" },
  { n: "03", from: "you", to: "ratchet", via: "encrypt body · forward secrecy" },
  { n: "04", from: "you", to: "entry relay", via: "sphinx packet · 1024 B, token attached" },
  { n: "05", from: "entry relay", to: "middle relay", via: "one layer peeled · random delay" },
  { n: "06", from: "middle relay", to: "exit relay", via: "one layer peeled · random delay" },
  { n: "07", from: "exit relay", to: "recipient", via: "delivered · sender unknown here" },
  { n: "08", from: "recipient", to: "ratchet", via: "decrypt · reassemble" },
  { n: "09", from: "relays", to: "everyone", via: "cover traffic · silence looks like sending", kind: "feedback" as const },
];

const LEGEND: { label: string; tone: string }[] = [
  { label: "You · keys never leave", tone: "var(--lane-local)" },
  { label: "Relays · each sees one hop", tone: "var(--lane-network)" },
  { label: "In flight · padded + delayed", tone: "var(--state-inflight)" },
  { label: "Tokens · pay to send, not to be known", tone: "var(--state-token)" },
];

function HopList({ show, reduce }: { show: boolean; reduce: boolean }) {
  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ border: "1px solid var(--hairline)" }}>
      {HOPS.map((h, i) => (
        <motion.li
          key={h.n}
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={show ? { opacity: 1, x: 0 } : reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
          transition={{ duration: 0.4, delay: 0.05 + i * 0.05, ease: EASE }}
          className="flex flex-col gap-1 px-4 py-3.5"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 font-mono" style={{ fontSize: 12 }}>
            <span style={{ color: h.kind === "feedback" ? "var(--verdict-escalate)" : "var(--band-blue)" }}>{h.n}</span>
            <span style={{ color: "var(--text-primary)" }}>{h.from}</span>
            <span aria-hidden="true" style={{ color: "var(--text-faint)" }}>→</span>
            <span style={{ color: "var(--text-primary)" }}>{h.to}</span>
          </div>
          <div className="flex items-center gap-1.5 pl-6 font-mono" style={{ fontSize: 11, color: h.kind === "feedback" ? "var(--verdict-escalate)" : "var(--band-blue)" }}>
            <span style={{ color: "var(--text-muted)" }}>{h.kind === "wall" ? "cross-wall · via Band" : h.kind === "feedback" ? "co-evolution" : "via Band"}</span>
            <span aria-hidden="true" style={{ color: "var(--text-faint)" }}>·</span>
            <span>{h.via}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

export default function OverviewSection() {
  const reduce = useReducedMotion() ?? false;
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(diagramRef, { once: true, amount: 0.2 });
  const show = reduce || inView;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listInView = useInView(listRef, { once: true, amount: 0.15 });
  const showList = reduce || listInView;

  return (
    <section id="overview" className="relative z-50" aria-labelledby="overview-title" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div className="mx-auto px-6 pb-28 pt-24 sm:px-10 lg:pb-36 lg:pt-32" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* header */}
        <Reveal>
          <span className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--band-blue)" }}>
            Overview
          </span>
        </Reveal>

        <MaskLines
          className="mt-5 font-sans"
          lineClassName=""
          lines={[
            <span key="l1" id="overview-title" style={{ color: "var(--text-primary)" }}>
              Nine stages, one message.
            </span>,
            <span key="l2" style={{ color: "var(--text-faint)" }}>
              No stage sees more than its neighbours.
            </span>,
          ]}
        />

        <Reveal delay={0.1}>
          <p className="mt-7 font-sans" style={{ fontSize: "clamp(14px, 1.4vw, 16px)", lineHeight: 1.65, color: "var(--text-body)", maxWidth: 700 }}>
            No participant sees the whole picture. A signed directory fixes the path, a blind issuer prices admission without learning
            who paid, the ratchet encrypts the body, and three relays each peel exactly one layer before forwarding after a random delay.
            What crosses between them is always the same thing: a{" "}
            <span style={{ color: "var(--band-blue)" }}>1024-byte packet</span> that looks like every other packet on the wire.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2 font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.tone }} />
                {l.label}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ── desktop nonagon (md+) ───────────────────────────────────────── */}
        <div ref={diagramRef} className="mt-8 hidden md:block">
          <PathNonagon show={show} reduce={reduce} />

          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 text-center font-mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}>
              3 hops · 1 token per packet · fixed size
            </p>
            <p className="mx-auto mt-2 text-center font-mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
              9 stages = directory, issuer, ratchet, you, three relays, recipient, and the cover traffic underneath.
            </p>
            <p className="mx-auto mt-3 text-center font-mono" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-faint)", maxWidth: 760 }}>
              Every side is a real step in the send path (POST /api/v1/messages → Sphinx packet → entry relay). The path is verified
              against the signed relay list before a single token is spent, and a mismatch refuses the send rather than leaking it.
            </p>
          </Reveal>
        </div>

        {/* ── mobile list (below md) ──────────────────────────────────────── */}
        <div ref={listRef} className="mt-10 md:hidden">
          <HopList show={showList} reduce={reduce} />
          <p className="mt-6 font-mono" style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-faint)" }}>
            Every hop is a real step in the send path, verified against the signed relay list before a token is spent.
          </p>
        </div>
      </div>
    </section>
  );
}
