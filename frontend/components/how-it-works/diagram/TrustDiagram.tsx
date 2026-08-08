"use client";

/**
 * D6 - why you can trust the relay list (Fig 6). Two trust mechanisms read
 * side by side: canonicalization on the left (a relay's self-signed claim
 * drops its own signature bytes before hashing, so what gets attested is the
 * canonical entry: address, identity_key, sphinx_key, role, status), and K-of-N
 * attestation on the right (three independent signers each attest the same
 * canonical entry-set hash; the directory is trusted only once at least
 * `threshold` of the configured `keys` have a valid signature on file - an
 * attestation from a key that isn't one of the N is rejected outright, not
 * merely ignored). Self-draws on scroll-into-view; band-blue marks only the
 * one real wire crossing. Dark "ops" stage.
 */

import { motion } from "framer-motion";
import { DiagramFrame, Node, Edge, Tag, EASE } from "./kit";

/* ── layout constants ─────────────────────────────────────────────────────── */
const VB = "0 0 1200 600";

/* left - canonicalization boundary */
const WALL_X = 552; // the dividing wall x
const RND_X = 64;
const RND_Y = 150;
const NODE_W = 240;
const BRIDGE_X = 432;
const BRIDGE_Y = 188;
const BRIDGE_W = 116;
const SURV_X = 64;
const SURV_Y = 326;

/* right - K-of-N attestation stack */
const LEAF_X = 720;
const LEAF_W = 412;
const LEAF_H = 90;
const LEAF_Y0 = 168;
const LEAF_GAP = 132;

/* a single attestation leaf: a mono record card (signer · entry hash · sig) ── */
function Leaf({
  i,
  kind,
  prev,
  hash,
  show,
  reduce,
  delay,
}: {
  i: number;
  kind: string;
  prev: string;
  hash: string;
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  const y = LEAF_Y0 + i * LEAF_GAP;
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <rect x={LEAF_X} y={y} width={LEAF_W} height={LEAF_H} rx={11} fill="var(--bg-card)" stroke="var(--border-default)" strokeWidth={1.2} />
      <rect x={LEAF_X} y={y} width={3} height={LEAF_H} rx={1.5} fill="var(--text-faint)" opacity={0.9} />
      <text x={LEAF_X + 18} y={y + 26} className="font-mono" fontSize={12.5} fontWeight={700} letterSpacing="0.08em" fill="var(--text-primary)">
        {`attestation ${i + 1} · ${kind}`}
      </text>
      <text x={LEAF_X + 18} y={y + 47} className="font-mono" fontSize={10.5} fill="var(--text-muted)">
        entry_set_hash · signer_pubkey
      </text>
      <text x={LEAF_X + 18} y={y + 67} className="font-mono" fontSize={10.5} fill="var(--text-muted)">
        {`entry_set_hash = ${prev}`}
      </text>
      <text x={LEAF_X + LEAF_W - 18} y={y + 67} textAnchor="end" className="font-mono" fontSize={11} fontWeight={600} fill="var(--band-blue)">
        {`sig = ${hash}`}
      </text>
    </motion.g>
  );
}

export function TrustDiagram({
  className = "",
  staticMode = false,
}: {
  className?: string;
  staticMode?: boolean;
}) {
  return (
    <DiagramFrame
      className={className}
      staticMode={staticMode}
      viewBox={VB}
      amount={0.25}
      label="Two trust mechanisms shown side by side. On the left, canonicalization: a relay's self-signed claim carrying address, identity_key, sphinx_key, role, status, plus its own raw signature bytes passes through a canonicalization step that drops the signature before hashing, so the directory receives only the canonical entry; the attested directory flows back to clients read-only. On the right, K-of-N attestation: three independent signers each attest the identical entry_set_hash with their own signature - the directory is trusted only once at least the configured threshold of the N configured keys have a valid signature on file; an attestation from a key that isn't one of the N is rejected outright, not merely ignored."
    >
      {(show, reduce) => (
        <>
          {/* ── panel eyebrows ─────────────────────────────────────────── */}
          <Tag x={64} y={64} text="◆ THE RELAY CLAIM" tone="neutral" delay={0.1} show={show} reduce={reduce} />
          <Tag x={720} y={64} text="◆ K-OF-N ATTESTATION" tone="neutral" delay={0.1} show={show} reduce={reduce} />

          {/* divider between the two panels */}
          <motion.line
            x1={664}
            y1={48}
            x2={664}
            y2={560}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 8"
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 0.7 } : undefined}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          />

          {/* ── LEFT: canonicalization ─────────────────────────────────── */}
          {/* the boundary line itself */}
          <motion.line
            x1={WALL_X}
            y1={96}
            x2={WALL_X}
            y2={480}
            stroke="var(--text-faint)"
            strokeWidth={1.4}
            strokeDasharray="5 6"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.8 } : undefined}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          />
          <Tag x={WALL_X} y={90} text="⟂ canonicalization boundary" tone="neutral" anchor="middle" delay={0.95} show={show} reduce={reduce} />

          {/* relay claim (left of boundary) - title at top, field list stacked below */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          >
            <rect x={RND_X} y={RND_Y} width={NODE_W} height={96} rx={11} fill="var(--bg-card)" stroke="var(--desk-rnd)" strokeWidth={1.2} />
            <rect x={RND_X} y={RND_Y} width={3} height={96} rx={1.5} fill="var(--desk-rnd)" opacity={0.9} />
            <text x={RND_X + 16} y={RND_Y + 26} className="font-mono" fontSize={12.5} fontWeight={600} fill="var(--text-primary)">
              Relay claim
            </text>
            <text x={RND_X + 16} y={RND_Y + 50} className="font-mono" fontSize={10} fill="var(--text-muted)">
              address · identity_key · sphinx_key
            </text>
            <text x={RND_X + 16} y={RND_Y + 66} className="font-mono" fontSize={10} fill="var(--text-muted)">
              role · status
            </text>
            <text x={RND_X + 16} y={RND_Y + 84} className="font-mono" fontSize={10} fill="var(--desk-rnd)">
              + raw signature bytes
            </text>
          </motion.g>

          {/* canonicalize step straddling the boundary */}
          <Node
            x={BRIDGE_X}
            y={BRIDGE_Y}
            w={BRIDGE_W}
            h={64}
            title="Canonicalize"
            sub="drops the signature before hashing"
            tone="neutral"
            titleMono
            delay={0.46}
            show={show}
            reduce={reduce}
          />

          {/* directory entry (left, below) - title at top, fields below */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.54, ease: EASE }}
          >
            <rect x={SURV_X} y={SURV_Y} width={NODE_W} height={96} rx={11} fill="var(--bg-card)" stroke="var(--desk-surv)" strokeWidth={1.2} />
            <rect x={SURV_X} y={SURV_Y} width={3} height={96} rx={1.5} fill="var(--desk-surv)" opacity={0.9} />
            <text x={SURV_X + 16} y={SURV_Y + 26} className="font-mono" fontSize={12.5} fontWeight={600} fill="var(--text-primary)">
              Directory entry
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 50} className="font-mono" fontSize={10} fill="var(--text-muted)">
              address · identity_key · sphinx_key
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 66} className="font-mono" fontSize={10} fill="var(--text-muted)">
              role · status
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 84} className="font-mono" fontSize={10} fill="var(--text-muted)">
              (canonical entry, unsigned)
            </text>
          </motion.g>

          {/* edges: claim → canonicalize → directory entry (the one wire crossing) */}
          <Edge
            from={{ x: RND_X + NODE_W, y: RND_Y + 44 }}
            to={{ x: BRIDGE_X, y: BRIDGE_Y + 24 }}
            mode="mid-h"
            delay={0.5}
            show={show}
            reduce={reduce}
          />
          <Edge
            from={{ x: BRIDGE_X + BRIDGE_W / 2, y: BRIDGE_Y + 64 }}
            to={{ x: SURV_X + NODE_W / 2, y: SURV_Y }}
            mode="mid-v"
            tone="band"
            label="canonical entry"
            pulse
            width={1.8}
            delay={0.6}
            show={show}
            reduce={reduce}
          />

          {/* back-edge: attested directory (read-only) flowing back to clients */}
          <Edge
            from={{ x: SURV_X + NODE_W, y: SURV_Y + 60 }}
            to={{ x: RND_X + NODE_W - 30, y: RND_Y + 88 }}
            mode="mid-h"
            tone="neutral"
            dashed
            label="attested directory (read-only)"
            delay={0.7}
            show={show}
            reduce={reduce}
          />

          {/* ── RIGHT: K-of-N attestation ──────────────────────────────── */}
          {/* caption: the attestation formula */}
          <motion.text
            x={720}
            y={140}
            className="font-mono"
            fontSize={11.5}
            letterSpacing="0.04em"
            fill="var(--band-blue)"
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            each signer attests: entry_set_hash = sha256(canonical_entries)
          </motion.text>

          <Leaf i={0} kind="signer A" prev="e7a1…" hash="9f2c…" show={show} reduce={reduce} delay={0.5} />
          <Leaf i={1} kind="signer B" prev="e7a1…" hash="4b08…" show={show} reduce={reduce} delay={0.62} />
          <Leaf i={2} kind="signer C" prev="e7a1…" hash="c31d…" show={show} reduce={reduce} delay={0.74} />

          {/* leaf → leaf: each independently counts toward the threshold */}
          <Edge
            from={{ x: LEAF_X + LEAF_W / 2, y: LEAF_Y0 + LEAF_H }}
            to={{ x: LEAF_X + LEAF_W / 2, y: LEAF_Y0 + LEAF_GAP }}
            mode="straight"
            tone="neutral"
            delay={0.82}
            show={show}
            reduce={reduce}
          />
          <Edge
            from={{ x: LEAF_X + LEAF_W / 2, y: LEAF_Y0 + LEAF_GAP + LEAF_H }}
            to={{ x: LEAF_X + LEAF_W / 2, y: LEAF_Y0 + 2 * LEAF_GAP }}
            mode="straight"
            tone="neutral"
            delay={0.9}
            show={show}
            reduce={reduce}
          />

          {/* footer tag: an unlisted key is rejected outright */}
          <Tag
            x={720}
            y={LEAF_Y0 + 2 * LEAF_GAP + LEAF_H + 40}
            text="an attestation from a key that isn't one of the N is rejected outright, not merely ignored"
            tone="flag"
            delay={1.0}
            show={show}
            reduce={reduce}
          />
        </>
      )}
    </DiagramFrame>
  );
}

export default TrustDiagram;
