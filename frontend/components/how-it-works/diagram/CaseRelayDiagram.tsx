"use client";

/**
 * D2 - one packet's hop-by-hop relay (Fig 2). A left→right relay across three
 * numbered phases: Entry → Middle (delay, off the wire) → Exit. No relay ever
 * calls the next one directly - each only forwards to the address its one
 * peeled Sphinx layer reveals. Only the real wire events (token, sphinx,
 * deliver) ride band-blue; the per-hop delay and cover traffic are LOCAL, off
 * the wire (neutral edges). The gold node is the final, deterministic unwrap.
 * Self-draws on scroll-into-view.
 */

import { motion } from "framer-motion";
import {
  DiagramFrame,
  Node,
  EngineNode,
  Edge,
  Chip,
  Tag,
  EASE,
  type Pt,
} from "./kit";

/* ── layout constants (single source of geometry) ────────────────────────── */
const ROW = 150; // primary relay row (centre-y of the entry / exit cards)
const NODE_H = 52;

// Phase 1 · Entry
const SRC = { x: 36, y: 124, w: 150, h: NODE_H }; // packet in, token attached
const ANOM = { x: 226, y: 124, w: 156, h: NODE_H }; // admission gate
const INV = { x: 226, y: 230, w: 156, h: 58 }; // Sphinx unwrap
const SPEC = { x: 226, y: 330, w: 156, h: 58 }; // next-hop address

// Phase 2 · Middle (bordered box, off the wire)
const DEBATE = { x: 452, y: 196, w: 296, h: 198 };
const PROS = { x: 472, y: 244, w: 122, h: 46 };
const DEF = { x: 606, y: 244, w: 122, h: 46 };
const ADJ = { x: 472, y: 320, w: 256, h: 56 }; // forward: peel layer 2

// Phase 3 · Exit
const ENGINE = { x: 806, y: 124, w: 240, h: 66 }; // EngineNode
const ESC = { x: 806, y: 330, w: 240, h: 58 }; // recipient inbox
const FLAG = { x: 814, y: 232, w: 224, h: 30 }; // deliver chip (centred under exit)
const BAND_OUT = { x: 1066, y: 345, w: 96, h: 28 }; // deliver lands back on the wire

/* phase band positions */
const PHASES: { x: number; n: string; label: string }[] = [
  { x: 36, n: "1", label: "ENTRY" },
  { x: 452, n: "2", label: "MIDDLE · delay off the wire" },
  { x: 822, n: "3", label: "EXIT · DELIVER" },
];

/* ── local helper: a phase eyebrow (number + tracked mono label) ──────────── */
function PhaseHead({
  x,
  n,
  label,
  show,
  reduce,
  delay,
}: {
  x: number;
  n: string;
  label: string;
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <rect x={x} y={62} width={26} height={26} rx={6} fill="var(--bg-inset)" stroke="var(--border-default)" strokeWidth={1} />
      <text x={x + 13} y={80} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={700} fill="var(--text-primary)">
        {n}
      </text>
      <text x={x + 38} y={80} className="font-mono" fontSize={11} fontWeight={600} letterSpacing="0.16em" fill="var(--text-muted)">
        {label}
      </text>
    </motion.g>
  );
}

/* edge anchor helpers (so geometry reads from the layout constants) */
const rightMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w, y: r.y + r.h / 2 });
const leftMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x, y: r.y + r.h / 2 });
const topMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y });
const bottomMid = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h });

export function CaseRelayDiagram({
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
      viewBox="0 0 1200 520"
      amount={0.25}
      label="One packet's hop-by-hop relay across three phases. Phase 1 Entry: the packet arrives with its admission token; the entry relay checks the token, peels its one Sphinx layer, and reads the next-hop address - nothing else. Phase 2 Middle runs locally off the wire: the relay sleeps for a delay it did not choose and mixes in cover traffic, then peels its own layer and forwards. Phase 3 Exit: the final Sphinx layer is peeled, the packet delivers to the recipient's inbox, and a deliver event lands back on the wire. No relay ever calls the next one directly - each only forwards to the address its one peeled layer reveals."
    >
      {(show, reduce) => (
        <>
          {/* phase eyebrows */}
          {PHASES.map((p, i) => (
            <PhaseHead key={p.n} x={p.x} n={p.n} label={p.label} show={show} reduce={reduce} delay={0.05 + i * 0.06} />
          ))}

          {/* faint phase separators */}
          <motion.line
            x1={416}
            y1={56}
            x2={416}
            y2={464}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 7"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.7 } : undefined}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          />
          <motion.line
            x1={788}
            y1={56}
            x2={788}
            y2={464}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 7"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.7 } : undefined}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          />

          {/* ── Phase 1 · Entry nodes ────────────────────────────────── */}
          <Node x={SRC.x} y={SRC.y} w={SRC.w} h={SRC.h} title="Packet in" sub="token attached" tone="neutral" titleMono delay={0.3} show={show} reduce={reduce} />
          <Node x={ANOM.x} y={ANOM.y} w={ANOM.w} h={ANOM.h} title="Admission gate" sub="token spent, valid?" tone="surv" titleMono delay={0.4} show={show} reduce={reduce} />
          <Node x={INV.x} y={INV.y} w={INV.w} h={INV.h} title="Sphinx unwrap" sub="peel layer 1" tone="surv" titleMono delay={0.48} show={show} reduce={reduce} />
          <Node x={SPEC.x} y={SPEC.y} w={SPEC.w} h={SPEC.h} title="Next-hop addr" sub="only the next hop, nothing else" tone="surv" titleMono delay={0.56} show={show} reduce={reduce} />

          {/* ── Phase 2 · Middle box (local, off the wire) ───────────── */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.55, delay: 0.62, ease: EASE }}
          >
            <rect x={DEBATE.x} y={DEBATE.y} width={DEBATE.w} height={DEBATE.h} rx={14} fill="color-mix(in srgb, var(--text-faint) 4%, transparent)" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="5 5" opacity={0.85} />
            <text x={DEBATE.x + DEBATE.w / 2} y={DEBATE.y + 24} textAnchor="middle" className="font-mono" fontSize={10.5} fontStyle="italic" letterSpacing="0.04em" fill="var(--text-muted)">
              delay + cover · local, off the wire
            </text>
          </motion.g>
          <Node x={PROS.x} y={PROS.y} w={PROS.w} h={PROS.h} title="sleep(delay_ms)" tone="surv" titleMono delay={0.68} show={show} reduce={reduce} />
          <Node x={DEF.x} y={DEF.y} w={DEF.w} h={DEF.h} title="cover chaff" tone="surv" titleMono delay={0.72} show={show} reduce={reduce} />
          <Node x={ADJ.x} y={ADJ.y} w={ADJ.w} h={ADJ.h} title="Forward" sub="peel layer 2 → next hop" tone="surv" titleMono delay={0.78} show={show} reduce={reduce} />

          {/* ── Phase 3 · Exit ────────────────────────────────────────── */}
          <EngineNode x={ENGINE.x} y={ENGINE.y} w={ENGINE.w} h={ENGINE.h} title="EXIT UNWRAP" sub="final layer peeled · deterministic" delay={0.9} show={show} reduce={reduce} />
          <Chip x={FLAG.x} y={FLAG.y} w={FLAG.w} h={FLAG.h} label="reorder window releases → DELIVERED" tone="pass" delay={1.02} show={show} reduce={reduce} />
          <Node x={ESC.x} y={ESC.y} w={ESC.w} h={ESC.h} title="Recipient inbox" sub="decrypt + reassemble" tone="surv" titleMono delay={0.98} show={show} reduce={reduce} />
          <Chip x={BAND_OUT.x} y={BAND_OUT.y} w={BAND_OUT.w} h={BAND_OUT.h} label="deliver" tone="band" delay={1.14} show={show} reduce={reduce} />

          {/* ── edges (drawn after nodes, in reading order) ──────────── */}
          {/* token check on arrival (the one real inbound wire event) */}
          <Edge from={rightMid(SRC)} to={leftMid(ANOM)} mode="straight" tone="band" label="token" pulse width={1.8} delay={0.62} show={show} reduce={reduce} />

          {/* entry-phase relay (local, one step at a time) */}
          <Edge from={bottomMid(ANOM)} to={topMid(INV)} mode="straight" tone="neutral" delay={0.7} show={show} reduce={reduce} />
          <Edge from={bottomMid(INV)} to={topMid(SPEC)} mode="straight" tone="neutral" label="peel layer 1" delay={0.76} show={show} reduce={reduce} />

          {/* next-hop address → middle: the sphinx wire event */}
          <Edge from={rightMid(SPEC)} to={leftMid(ADJ)} mode="mid-h" tone="band" label="sphinx" pulse width={1.8} delay={0.82} show={show} reduce={reduce} />

          {/* middle-phase internals (local, neutral) */}
          <Edge from={bottomMid(PROS)} to={{ x: ADJ.x + 70, y: ADJ.y }} mode="mid-v" tone="neutral" delay={0.86} show={show} reduce={reduce} />
          <Edge from={bottomMid(DEF)} to={{ x: ADJ.x + ADJ.w - 70, y: ADJ.y }} mode="mid-v" tone="neutral" delay={0.9} show={show} reduce={reduce} />

          {/* Forward → exit unwrap: peeled layer 2 (local handoff, neutral) */}
          <Edge from={rightMid(ADJ)} to={{ x: ENGINE.x, y: ENGINE.y + ENGINE.h - 14 }} mode="mid-h" tone="neutral" label="peeled layer 2" delay={0.96} show={show} reduce={reduce} />

          {/* exit unwrap → delivered (internal) */}
          <Edge from={bottomMid(ENGINE)} to={{ x: FLAG.x + FLAG.w / 2, y: FLAG.y }} mode="straight" tone="pass" delay={1.04} show={show} reduce={reduce} />

          {/* delivered → recipient inbox */}
          <Edge from={{ x: FLAG.x + FLAG.w / 2, y: FLAG.y + FLAG.h }} to={topMid(ESC)} mode="straight" tone="pass" delay={1.1} show={show} reduce={reduce} />

          {/* recipient inbox → out on the wire: the deliver event */}
          <Edge from={rightMid(ESC)} to={leftMid(BAND_OUT)} mode="straight" tone="band" label="deliver" pulse width={1.8} delay={1.16} show={show} reduce={reduce} />

          {/* footer caption: the law of this figure */}
          <Tag x={600} y={494} text="no relay calls the next one directly - each only knows the next hop's address · crypto decides, not policy" tone="neutral" anchor="middle" delay={1.24} show={show} reduce={reduce} />
        </>
      )}
    </DiagramFrame>
  );
}

export default CaseRelayDiagram;
