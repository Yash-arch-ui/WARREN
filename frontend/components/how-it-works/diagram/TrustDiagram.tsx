"use client";

/**
 * D6 - why you can trust it (report Fig 6). Two trust mechanisms read side by
 * side: the Chinese wall on the left (the SanitizedBridge strips reasoning +
 * model identity so only bare orders cross R&D→Surveillance, with the rulebook
 * flowing back read-only), and the hash-chained audit ledger on the right (three
 * Band leaves, each hash built from the previous hash plus the canonical body;
 * tamper one byte → verify_chain() = False). Self-draws on scroll-into-view;
 * band-blue marks only the one real Band crossing. Dark "ops" stage.
 */

import { motion } from "framer-motion";
import { DiagramFrame, Node, Edge, Tag, EASE } from "./kit";

/* ── layout constants ─────────────────────────────────────────────────────── */
const VB = "0 0 1200 600";

/* left - Chinese wall · SanitizedBridge */
const WALL_X = 552; // the dividing wall x
const RND_X = 64;
const RND_Y = 150;
const NODE_W = 240;
const BRIDGE_X = 432;
const BRIDGE_Y = 188;
const BRIDGE_W = 116;
const SURV_X = 64;
const SURV_Y = 326;

/* right - hash-chained ledger stack */
const LEAF_X = 720;
const LEAF_W = 412;
const LEAF_H = 90;
const LEAF_Y0 = 168;
const LEAF_GAP = 132;

/* a single ledger leaf: a mono record card (kind · sha/id · prev/hash) ─────── */
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
        {`leaf ${i + 1} · ${kind}`}
      </text>
      <text x={LEAF_X + 18} y={y + 47} className="font-mono" fontSize={10.5} fill="var(--text-muted)">
        content_sha256 · band_message_id
      </text>
      <text x={LEAF_X + 18} y={y + 67} className="font-mono" fontSize={10.5} fill="var(--text-muted)">
        {`prev_hash = ${prev}`}
      </text>
      <text x={LEAF_X + LEAF_W - 18} y={y + 67} textAnchor="end" className="font-mono" fontSize={11} fontWeight={600} fill="var(--band-blue)">
        {`hash = ${hash}`}
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
      label="Two trust mechanisms shown side by side. On the left, the Chinese wall: an R&D order carrying symbol, side, qty, limit_price, timestamps plus the adversary's reasoning and model_key passes through the SanitizedBridge, which strips reasoning and model_key so Surveillance receives only the bare order; the active rulebook flows back to R&D read-only. On the right, the hash-chained audit ledger: three Band leaves (HANDOFF, EVIDENCE, VERDICT) where each leaf's hash is sha256 of the previous hash plus the canonical body and binds the real band_message_id; tamper any byte and the recomputed hash no longer matches the stored hash, so verify_chain() returns False."
    >
      {(show, reduce) => (
        <>
          {/* ── panel eyebrows ─────────────────────────────────────────── */}
          <Tag x={64} y={64} text="◆ THE WALL · SanitizedBridge" tone="neutral" delay={0.1} show={show} reduce={reduce} />
          <Tag x={720} y={64} text="◆ HASH-CHAINED AUDIT LEDGER" tone="neutral" delay={0.1} show={show} reduce={reduce} />

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

          {/* ── LEFT: the Chinese wall ─────────────────────────────────── */}
          {/* the wall line itself */}
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
          <Tag x={WALL_X} y={90} text="⟂ one-way Chinese wall" tone="neutral" anchor="middle" delay={0.95} show={show} reduce={reduce} />

          {/* R&D order (left of wall) - title at top, field list stacked below */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          >
            <rect x={RND_X} y={RND_Y} width={NODE_W} height={96} rx={11} fill="var(--bg-card)" stroke="var(--desk-rnd)" strokeWidth={1.2} />
            <rect x={RND_X} y={RND_Y} width={3} height={96} rx={1.5} fill="var(--desk-rnd)" opacity={0.9} />
            <text x={RND_X + 16} y={RND_Y + 26} className="font-mono" fontSize={12.5} fontWeight={600} fill="var(--text-primary)">
              R&amp;D order
            </text>
            <text x={RND_X + 16} y={RND_Y + 50} className="font-mono" fontSize={10} fill="var(--text-muted)">
              symbol · side · qty · limit_price
            </text>
            <text x={RND_X + 16} y={RND_Y + 66} className="font-mono" fontSize={10} fill="var(--text-muted)">
              timestamps
            </text>
            <text x={RND_X + 16} y={RND_Y + 84} className="font-mono" fontSize={10} fill="var(--desk-rnd)">
              + reasoning   + model_key
            </text>
          </motion.g>

          {/* SanitizedBridge straddling the wall */}
          <Node
            x={BRIDGE_X}
            y={BRIDGE_Y}
            w={BRIDGE_W}
            h={64}
            title="Sanitized"
            sub="Bridge · strips reasoning + model_key"
            tone="neutral"
            titleMono
            delay={0.46}
            show={show}
            reduce={reduce}
          />

          {/* Surveillance receives (left, below) - title at top, fields below */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.54, ease: EASE }}
          >
            <rect x={SURV_X} y={SURV_Y} width={NODE_W} height={96} rx={11} fill="var(--bg-card)" stroke="var(--desk-surv)" strokeWidth={1.2} />
            <rect x={SURV_X} y={SURV_Y} width={3} height={96} rx={1.5} fill="var(--desk-surv)" opacity={0.9} />
            <text x={SURV_X + 16} y={SURV_Y + 26} className="font-mono" fontSize={12.5} fontWeight={600} fill="var(--text-primary)">
              Surveillance receives
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 50} className="font-mono" fontSize={10} fill="var(--text-muted)">
              symbol · side · qty · limit_price
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 66} className="font-mono" fontSize={10} fill="var(--text-muted)">
              timestamps
            </text>
            <text x={SURV_X + 16} y={SURV_Y + 84} className="font-mono" fontSize={10} fill="var(--text-muted)">
              (only the bare order)
            </text>
          </motion.g>

          {/* edges: R&D → bridge → Surveillance (the band crossing) */}
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
            label="events only"
            pulse
            width={1.8}
            delay={0.6}
            show={show}
            reduce={reduce}
          />

          {/* back-edge: active rulebook (read-only) flowing back to R&D */}
          <Edge
            from={{ x: SURV_X + NODE_W, y: SURV_Y + 60 }}
            to={{ x: RND_X + NODE_W - 30, y: RND_Y + 88 }}
            mode="mid-h"
            tone="neutral"
            dashed
            label="active rulebook (read-only)"
            delay={0.7}
            show={show}
            reduce={reduce}
          />

          {/* ── RIGHT: the hash chain ──────────────────────────────────── */}
          {/* caption: the hash formula */}
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
            hash = sha256(prev_hash + canonical body)
          </motion.text>

          <Leaf i={0} kind="HANDOFF" prev="none" hash="h1" show={show} reduce={reduce} delay={0.5} />
          <Leaf i={1} kind="EVIDENCE" prev="h1" hash="h2" show={show} reduce={reduce} delay={0.62} />
          <Leaf i={2} kind="VERDICT" prev="h2" hash="h3" show={show} reduce={reduce} delay={0.74} />

          {/* leaf → leaf chain links (neutral, each prev_hash feeds the next) */}
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

          {/* footer tag: tamper-evidence */}
          <Tag
            x={720}
            y={LEAF_Y0 + 2 * LEAF_GAP + LEAF_H + 40}
            text="tamper any byte → recomputed hash ≠ stored hash → verify_chain() = False"
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
