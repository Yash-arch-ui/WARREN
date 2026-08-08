"use client";

/**
 * §3 - Methodology: the five sub-flows that form the spine of /how-it-works.
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
   *  child that pins via position:sticky (e.g. CorrelationStory): a motion transform
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

/* ── generic fact strip: reused for (b) chunk math and (c) directory fields ── */
type FactRow = { label: string; sub: string; value: string };

function FactStrip({ rows }: { rows: FactRow[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <Reveal key={r.label} delay={i * 0.05}>
          <div className="flex items-baseline justify-between gap-4 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4">
            <div>
              <p className="font-mono text-sm font-semibold text-[color:var(--text-primary)]">
                {r.label}
              </p>
              <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                {r.sub}
              </p>
            </div>
            <p className="whitespace-nowrap font-mono text-[0.82rem] text-[color:var(--text-body)]">
              {r.value}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

const CHUNK_FACTS: FactRow[] = [
  { label: "packet payload", sub: "sphinx-packet crate", value: "1024 B total" },
  { label: "ratchet + envelope overhead", sub: "Olm wire + JSON worst case", value: "~319 B" },
  { label: "max message / packet", sub: "MAX_MSG_LEN", value: "~705 B raw" },
  { label: "body bytes / packet", sub: "packet_payload_bytes() · hex-halved", value: "305 B" },
];

const DIRECTORY_FIELDS: FactRow[] = [
  { label: "entries", sub: "Directory", value: "the relay list under attestation" },
  { label: "attestations", sub: "Directory", value: "signatures collected this epoch" },
  { label: "threshold", sub: "Directory", value: "min. valid signatures required" },
  { label: "signers", sub: "Directory", value: "the K configured directory keys" },
  { label: "policy_enforced", sub: "Directory", value: "unattested entries rejected outright" },
];

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
            <span className="text-[color:var(--text-primary)]">How a message actually moves</span>{" "}
            <span className="text-[color:var(--text-faint)]">- mint, wrap, relay, hide, arrive.</span>
          </h2>
        </header>

        <div className="flex flex-col gap-16 sm:gap-24">
          {/* (a) minting the right to send */}
          <MethodBlock
            step="(a) minting the right to send"
            headPrimary="One proof of work,"
            headFaint="before one packet moves."
            lead={
              <>
                Before any packet can enter the mix, the sender proves work:{" "}
                <code className="font-mono text-[color:var(--text-primary)]">token-issue</code>{" "}
                mines a challenge bound to (issuer nonce, client_id, epoch) - 26 leading zero bits
                by default, about 67 million SHA-256 evaluations - and hands the solved challenge to
                the issuer. The issuer verifies the work, then blind-signs a batch of admission
                tokens without ever seeing which token maps to which packet. Blind signatures
                (RFC 9474) make the token provably valid and provably unlinkable to the request
                that minted it.
              </>
            }
          >
            <Stage label="Fig 2 - proof of work verified, then blind-signed">
              <OracleLoopDiagram />
            </Stage>
          </MethodBlock>

          {/* (b) cutting the message to fit */}
          <MethodBlock
            step="(b) cutting the message to fit"
            headPrimary="One packet holds"
            headFaint="705 bytes, hex and all."
            lead={
              <>
                A Sphinx packet payload is 1024 bytes; strip the onion-layer overhead and the
                ratchet&apos;s own wire overhead and what&apos;s left for a message is{" "}
                <code className="font-mono text-[color:var(--text-primary)]">MAX_MSG_LEN</code> -
                about 705 bytes. Anything longer is split across several packets, and because the
                body travels hex-encoded inside the client-server envelope, the real per-packet
                budget the sender plans against is half that again: 305 body bytes. Every packet,
                whole or partial, spends exactly one admission token.
              </>
            }
          >
            <FactStrip rows={CHUNK_FACTS} />
          </MethodBlock>

          {/* (c) trusting a relay before spending a token */}
          <MethodBlock
            step="(c) trusting a relay before spending a token"
            headPrimary="Every hop is checked"
            headFaint="against a signed list."
            lead={
              <>
                The client only trusts a relay&apos;s address and keys once the signed relay list
                carries valid attestations from at least the configured threshold of directory
                keys - an attestation from a key that isn&apos;t one of the N is rejected outright,
                not just ignored. Once trusted, each hop does one thing: peel its Sphinx layer,
                read the next address, forward blind. No relay - not even the exit - ever sees the
                full path.
              </>
            }
          >
            <Stage label="Fig 3 - one Sphinx layer peeled per hop">
              <CaseRelayDiagram />
            </Stage>
            <FactStrip rows={DIRECTORY_FIELDS} />
            <div className="mt-6">
              <Stage label="Fig 4 - K-of-N directory attestation">
                <TrustDiagram />
              </Stage>
            </div>
          </MethodBlock>

          {/* (d) hiding timing and volume - integration mounts CorrelationStory here */}
          <MethodBlock
            step="(d) hiding timing and volume"
            headPrimary="Delay is drawn,"
            headFaint="not fixed - and chaff fills the gaps."
            lead={
              <>
                Here is the part built to defeat a wire observer directly. The sender samples each
                hop&apos;s delay from an exponential distribution and carries it inside that
                hop&apos;s Sphinx header; the relay enforces it by sleeping, so packets leave out
                of order by design. Cover traffic runs on the same rhythm as real packets, so
                nothing about arrival timing tells an observer which is which. On the receiving
                side, a short reorder window restores order when it can, and releases anyway when
                it can&apos;t wait any longer.
              </>
            }
            bare
          >
            {/* CorrelationStory carries its OWN dark-glass stage (SplitFrame: bg-inset
                + hairline border + shadow), so the INNER story reads dark while the
                OUTER Methodology page stays light - which is what we want. No
                full-bleed black wrapper (that made the outer dark too), and no
                `overflow-hidden`/`transform` ancestor (either re-bases its
                position:sticky pin). Mounted raw via MethodBlock `bare`. */}
            {evasionSlot}
          </MethodBlock>

          {/* (e) arriving without a receipt */}
          <MethodBlock
            step="(e) arriving without a receipt"
            headPrimary="Delivered, maybe -"
            headFaint="the sender never finds out for sure."
            lead={
              <>
                The recipient&apos;s Double Ratchet decrypts each packet&apos;s body and the
                reorder buffer reassembles the chunks back into one message. A message&apos;s state
                moves QUEUED → ENCRYPTED → IN_FLIGHT → DELIVERED (or FAILED) - and stops there.
                There&apos;s no ACKNOWLEDGED state, on purpose: a receipt traveling back along the
                path would be exactly the correlation the design exists to prevent. The path
                stays hidden even after delivery - unknowable from the recipient&apos;s side from
                the start.
              </>
            }
          >
            <Stage label="Fig 5 - delivery state machine, no receipt">
              <VerdictDiagram />
            </Stage>
          </MethodBlock>
        </div>
      </div>
    </section>
  );
}

export default Methodology;
