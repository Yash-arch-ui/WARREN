"use client";

/**
 * D4 - the delivery state machine (Fig 5). The state machine only ever moves
 * forward. Three inputs feed it - the encrypted packet, its chunk position in
 * the reorder window, and the ratchet session - and the gold EngineNode is the
 * sole authority: it advances QUEUED → ENCRYPTED → IN_FLIGHT → DELIVERED (or
 * FAILED), and stops there. Self-draws on scroll-into-view; no band-blue here
 * (nothing here re-crosses the wire - this is local recipient-side state).
 * Dark "ops" stage.
 */

import { motion } from "framer-motion";
import {
  DiagramFrame,
  Node,
  EngineNode,
  Diamond,
  Chip,
  Edge,
  Tag,
  EASE,
} from "./kit";

/* ── layout constants (viewBox 0 0 1100 560) ─────────────────────────────── */
const VB = "0 0 1100 560";

// left input column
const IN_X = 40;
const IN_W = 268;
const IN_H = 56;
const IN_GAP = 22;
const IN1_Y = 96; //  encrypted packet   (neutral)
const IN2_Y = IN1_Y + IN_H + IN_GAP; // chunk position (surv)
const IN3_Y = IN2_Y + IN_H + IN_GAP; // ratchet session (neutral)

// process block (the deterministic for-each)
const PROC_X = 380;
const PROC_Y = 120;
const PROC_W = 360;
const PROC_H = 232;

// engine authority anchor (the thing actually deciding)
const ENG_X = 426;
const ENG_Y = 392;
const ENG_W = 268;
const ENG_H = 70;

// branch diamond
const DEC_CX = 850;
const DEC_CY = 236;
const DEC_RW = 96;
const DEC_RH = 70;

// verdict outputs (right column)
const OUT_X = 940;
const OUT_W = 132;
const OUT_H = 50;
const FLAG_Y = 120; // FAILED
const PASS_Y = 352; // DELIVERED

/* ── a labelled process block: a neutral rect + stacked mono step lines ───── */
function ProcessBlock({
  show,
  reduce,
  delay,
}: {
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  const lines = [
    "state machine, in order:",
    "  QUEUED → ENCRYPTED",
    "  ENCRYPTED → IN_FLIGHT",
    "  IN_FLIGHT → DELIVERED or FAILED",
    "no ACKNOWLEDGED state - ever",
  ];
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      <rect
        x={PROC_X}
        y={PROC_Y}
        width={PROC_W}
        height={PROC_H}
        rx={12}
        fill="var(--bg-inset)"
        stroke="var(--border-default)"
        strokeWidth={1.2}
      />
      <text
        x={PROC_X + 20}
        y={PROC_Y + 28}
        className="font-mono"
        fontSize={11}
        fontWeight={700}
        letterSpacing="0.14em"
        fill="var(--text-muted)"
      >
        DELIVERY STATE MACHINE
      </text>
      <line
        x1={PROC_X + 20}
        y1={PROC_Y + 40}
        x2={PROC_X + PROC_W - 20}
        y2={PROC_Y + 40}
        stroke="var(--border-subtle)"
        strokeWidth={1}
      />
      {lines.map((ln, i) => (
        <text
          key={i}
          x={PROC_X + 20}
          y={PROC_Y + 70 + i * 30}
          className="font-mono"
          fontSize={12.5}
          fill={
            i === lines.length - 1
              ? "var(--text-primary)"
              : "var(--text-body)"
          }
          fontWeight={i === lines.length - 1 ? 600 : 400}
        >
          {ln}
        </text>
      ))}
    </motion.g>
  );
}

export function VerdictDiagram({ className = "" }: { className?: string }) {
  // anchors
  const in1R = { x: IN_X + IN_W, y: IN1_Y + IN_H / 2 };
  const in2R = { x: IN_X + IN_W, y: IN2_Y + IN_H / 2 };
  const in3R = { x: IN_X + IN_W, y: IN3_Y + IN_H / 2 };
  const procL = { x: PROC_X, y: PROC_Y + PROC_H / 2 };
  const procR = { x: PROC_X + PROC_W, y: DEC_CY };
  const procBottom = { x: PROC_X + PROC_W / 2, y: PROC_Y + PROC_H };
  const engTop = { x: ENG_X + ENG_W / 2, y: ENG_Y };

  return (
    <DiagramFrame
      className={className}
      viewBox={VB}
      amount={0.3}
      label="Warren delivery state machine: three inputs - the encrypted packet, its chunk position in the reorder window, and the ratchet session - feed a deterministic state machine. The gold state machine is the sole authority: it advances QUEUED to ENCRYPTED to IN_FLIGHT to DELIVERED or FAILED, one direction only, and there is no ACKNOWLEDGED state. If the final chunk is received within the reorder window the message is DELIVERED; otherwise it FAILED. No receipt ever travels back to the sender - that silence is the design, not a gap in it."
    >
      {(show, reduce) => (
        <>
          {/* ── eyebrow ─────────────────────────────────────────────── */}
          <motion.text
            x={40}
            y={48}
            className="font-mono"
            fontSize={12}
            letterSpacing="0.2em"
            fill="var(--text-muted)"
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.4, ease: EASE }}
          >
            ONE-WAY · NO ACKNOWLEDGED STATE
          </motion.text>

          {/* ── inputs (left column) ────────────────────────────────── */}
          <Node
            x={IN_X}
            y={IN1_Y}
            w={IN_W}
            h={IN_H}
            title="Encrypted packet"
            sub="Sphinx-unwrapped, still ratchet-sealed"
            tone="neutral"
            titleMono
            delay={0.1}
            show={show}
            reduce={reduce}
          />
          <Node
            x={IN_X}
            y={IN2_Y}
            w={IN_W}
            h={IN_H}
            title="Chunk position"
            sub="seq · reorder window slot"
            tone="surv"
            titleMono
            delay={0.18}
            show={show}
            reduce={reduce}
          />
          <Node
            x={IN_X}
            y={IN3_Y}
            w={IN_W}
            h={IN_H}
            title="Ratchet session"
            sub="Olm Double Ratchet keys"
            tone="neutral"
            titleMono
            delay={0.26}
            show={show}
            reduce={reduce}
          />

          {/* annotate that ONLY the chunk position depends on arrival order */}
          <Tag
            x={IN_X}
            y={IN3_Y + IN_H + 30}
            text="↑ only the chunk position depends on arrival order"
            tone="surv"
            anchor="start"
            delay={0.42}
            show={show}
            reduce={reduce}
          />

          {/* ── process block ───────────────────────────────────────── */}
          <ProcessBlock show={show} reduce={reduce} delay={0.34} />

          {/* ── engine authority anchor ─────────────────────────────── */}
          <EngineNode
            x={ENG_X}
            y={ENG_Y}
            w={ENG_W}
            h={ENG_H}
            title="STATE MACHINE"
            sub="sole delivery authority · deterministic"
            delay={0.5}
            show={show}
            reduce={reduce}
          />

          {/* ── branch ──────────────────────────────────────────────── */}
          <Diamond
            cx={DEC_CX}
            cy={DEC_CY}
            rw={DEC_RW}
            rh={DEC_RH}
            title="final chunk"
            sub="received?"
            tone="neutral"
            delay={0.58}
            show={show}
            reduce={reduce}
          />

          {/* ── verdict outputs ─────────────────────────────────────── */}
          <Chip
            x={OUT_X}
            y={FLAG_Y}
            w={OUT_W}
            h={OUT_H}
            label="FAILED"
            tone="flag"
            delay={0.74}
            show={show}
            reduce={reduce}
          />
          <Tag
            x={OUT_X + OUT_W / 2}
            y={FLAG_Y + OUT_H + 20}
            text="reorder window expired"
            tone="flag"
            anchor="middle"
            delay={0.82}
            show={show}
            reduce={reduce}
          />
          <Chip
            x={OUT_X}
            y={PASS_Y}
            w={OUT_W}
            h={OUT_H}
            label="DELIVERED"
            tone="pass"
            delay={0.74}
            show={show}
            reduce={reduce}
          />
          <Tag
            x={OUT_X + OUT_W / 2}
            y={PASS_Y + OUT_H + 20}
            text="no receipt sent back"
            tone="pass"
            anchor="middle"
            delay={0.82}
            show={show}
            reduce={reduce}
          />

          {/* ── edges (inputs → process) ────────────────────────────── */}
          <Edge
            from={in1R}
            to={{ x: PROC_X, y: procL.y - 36 }}
            mode="mid-h"
            tone="neutral"
            delay={0.34}
            show={show}
            reduce={reduce}
          />
          <Edge
            from={in2R}
            to={{ x: PROC_X, y: procL.y }}
            mode="mid-h"
            tone="surv"
            delay={0.4}
            show={show}
            reduce={reduce}
          />
          <Edge
            from={in3R}
            to={{ x: PROC_X, y: procL.y + 36 }}
            mode="mid-h"
            tone="neutral"
            delay={0.46}
            show={show}
            reduce={reduce}
          />

          {/* process → engine (the state machine advances) */}
          <Edge
            from={procBottom}
            to={engTop}
            mode="straight"
            tone="neutral"
            label="advances"
            width={1.8}
            delay={0.54}
            show={show}
            reduce={reduce}
          />

          {/* engine → branch (the state machine's resolution) */}
          <Edge
            from={{ x: ENG_X + ENG_W, y: ENG_Y + ENG_H / 2 }}
            to={{ x: DEC_CX, y: DEC_CY + DEC_RH }}
            mode="mid-v"
            tone="neutral"
            label="resolves state"
            width={1.8}
            delay={0.62}
            show={show}
            reduce={reduce}
          />

          {/* branch → FAILED (no) */}
          <Edge
            from={{ x: DEC_CX, y: DEC_CY - DEC_RH }}
            to={{ x: OUT_X, y: FLAG_Y + OUT_H / 2 }}
            mode="vh"
            tone="flag"
            label="no"
            delay={0.7}
            show={show}
            reduce={reduce}
          />
          {/* branch → DELIVERED (yes) */}
          <Edge
            from={{ x: DEC_CX + DEC_RW, y: DEC_CY }}
            to={{ x: OUT_X, y: PASS_Y + OUT_H / 2 }}
            mode="vh"
            tone="pass"
            label="yes"
            delay={0.7}
            show={show}
            reduce={reduce}
          />

          {/* ── footer thesis ───────────────────────────────────────── */}
          <Tag
            x={40}
            y={518}
            text="The state machine only ever moves forward. It renders DELIVERED / FAILED deterministically -"
            tone="neutral"
            anchor="start"
            delay={0.9}
            show={show}
            reduce={reduce}
          />
          <Tag
            x={40}
            y={538}
            text="and stops there. No receipt ever travels back to the sender."
            tone="neutral"
            anchor="start"
            delay={0.96}
            show={show}
            reduce={reduce}
          />
        </>
      )}
    </DiagramFrame>
  );
}

export default VerdictDiagram;
