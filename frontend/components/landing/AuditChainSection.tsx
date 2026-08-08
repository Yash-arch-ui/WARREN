"use client";

/**
 * AuditChainSection - the `#audit` section: the tamper-evident ledger as a COMPLETE
 * 3×3 grid (nine blocks, tic-tac-toe layout) that fits in a single viewport.
 *   • nine steps (one per role in the Overview nonagon) fill a balanced 3×3 grid,
 *     chained in order by a fingerprint link that SNAKES through the cells
 *     (row 0 →, row 1 ←, row 2 →) so every hop lands on an adjacent block;
 *   • the demo control + the verify_chain result sit on ONE row at opposite ends,
 *     so clicking "simulate an edit" visibly flips verify_chain ✓ → ✗ and recolours
 *     every block downstream of the edit, all without scrolling;
 *   • no accidental hover-tamper - one clearly-labelled button drives the demo.
 *
 * Semantic colour only: --state-delivered ✓, --state-failed for the tamper,
 * --band-blue on Band-handoff steps. Reduced-motion renders the full grid.
 * id="audit".
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Block = { i: number; agent: string; title: string; band?: boolean; prev: string; hash: string };

/* nine steps - one per stage of a send, mirroring the Overview nonagon */
const BLOCKS: Block[] = [
  { i: 0, agent: "directory", title: "Relay list attested", band: true, prev: "- genesis", hash: "0x8b1e…a3f9" },
  { i: 1, agent: "client", title: "Path cross-checked", prev: "0x8b1e…a3f9", hash: "0x2c4a…11de" },
  { i: 2, agent: "ratchet", title: "Body encrypted", band: true, prev: "0x2c4a…11de", hash: "0x4d77…7c10" },
  { i: 3, agent: "client", title: "Padded to 1024 B", prev: "0x4d77…7c10", hash: "0x7a02…9b3c" },
  { i: 4, agent: "issuer", title: "Token spent", prev: "0x7a02…9b3c", hash: "0xb5e1…42aa" },
  { i: 5, agent: "entry relay", title: "Layer peeled", prev: "0xb5e1…42aa", hash: "0xc0aa…e904" },
  { i: 6, agent: "middle relay", title: "Layer peeled", band: true, prev: "0xc0aa…e904", hash: "0x9f31…b27d" },
  { i: 7, agent: "exit relay", title: "Delivered", prev: "0x9f31…b27d", hash: "0x3e88…1f60" },
  { i: 8, agent: "recipient", title: "Reassembled", prev: "0x3e88…1f60", hash: "0x1ed2…0f5c" },
];

const TAMPER_AT = 3;

/* ── 3×3 grid geometry (tic-tac-toe) - nine blocks snaked in chain order ─────── */
const W = 212;
const H = 50;
const COLS = 3;
const GAP_X = 54;
const GAP_Y = 60;
const COL = W + GAP_X; // horizontal stride = 266
const ROW = H + GAP_Y; // vertical stride   = 110
const PAD = 10;
const VB_W = PAD * 2 + (COLS - 1) * COL + W; // 764
const VB_H = PAD * 2 + 2 * ROW + H; //          290
/** chain index → grid cell, snaked (boustrophedon): row 0 →, row 1 ←, row 2 →,
 *  so each consecutive block is orthogonally adjacent to the previous one. */
const cell = (i: number) => {
  const row = Math.floor(i / COLS);
  const within = i % COLS;
  return { row, col: row % 2 === 0 ? within : COLS - 1 - within };
};
const gx = (col: number) => PAD + col * COL;
const gy = (row: number) => PAD + row * ROW;

function SvgBlock({ b, broken, edited, show, reduce }: { b: Block; broken: boolean; edited: boolean; show: boolean; reduce: boolean }) {
  const c = cell(b.i);
  const x = gx(c.col);
  const y = gy(c.row);
  const accent = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, delay: 0.1 + b.i * 0.08, ease: EASE }}
    >
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        rx={11}
        fill={broken ? "color-mix(in srgb, var(--verdict-flag) 9%, var(--bg-card))" : "var(--bg-card)"}
        stroke={broken ? "var(--verdict-flag)" : "var(--border-subtle)"}
        strokeWidth={1}
      />
      {/* line 1: index + agent (+ band dot) */}
      <text x={x + 14} y={y + 19} className="font-mono" fontSize={12} fill="var(--text-primary)">
        <tspan fill="var(--text-faint)">{String(b.i).padStart(2, "0")} </tspan>
        <tspan fill={edited ? "var(--verdict-flag)" : "var(--text-primary)"}>{edited ? "✏ " : ""}{b.agent}</tspan>
      </text>
      {b.band && <circle cx={x + W - 16} cy={y + 15} r={3} fill="var(--band-blue)" />}
      {/* line 2: title + fingerprint */}
      <text x={x + 14} y={y + 37} className="font-sans" fontSize={10} fill="var(--text-muted)">
        {b.title}
      </text>
      <text x={x + W - 14} y={y + 37} textAnchor="end" className="font-mono" fontSize={9.5} fontWeight={500} fill={accent}>
        {b.hash}
      </text>
    </motion.g>
  );
}

function SvgConnector({ i, broken, show, reduce }: { i: number; broken: boolean; show: boolean; reduce: boolean }) {
  const a = cell(i);
  const z = cell(i + 1);
  const ax = gx(a.col);
  const ay = gy(a.row);
  const zx = gx(z.col);
  const zy = gy(z.row);

  // Same row → horizontal hop (its direction follows the snake parity).
  // Different row → vertical drop to the cell directly below (same column).
  let d: string;
  let mx: number;
  let my: number;
  if (a.row === z.row) {
    const rightward = z.col > a.col;
    const sx = rightward ? ax + W : ax;
    const ex = rightward ? zx : zx + W;
    const yy = ay + H / 2;
    d = `M ${sx} ${yy} H ${ex}`;
    mx = (sx + ex) / 2;
    my = yy;
  } else {
    const sx = ax + W / 2;
    d = `M ${sx} ${ay + H} V ${zy}`;
    mx = sx;
    my = (ay + H + zy) / 2;
  }

  const c = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.4, delay: 0.16 + i * 0.08, ease: EASE }}
    >
      <path d={d} fill="none" stroke={c} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={broken ? "4 4" : undefined} opacity={0.85} />
      <circle cx={mx} cy={my} r={7} fill="var(--bg-page)" stroke={broken ? "var(--verdict-flag)" : "var(--border-subtle)"} strokeWidth={1} />
      <g stroke={c} strokeWidth={1.3} fill="none" strokeLinecap="round" transform={`translate(${mx - 4.5} ${my - 4.5}) scale(0.38)`}>
        <path d="M9 12h6" />
        <path d="M10 8.5h-1a3.5 3.5 0 0 0 0 7h1" />
        <path d="M14 8.5h1a3.5 3.5 0 0 1 0 7h-1" />
      </g>
    </motion.g>
  );
}

function MobileRow({ b, broken, edited }: { b: Block; broken: boolean; edited: boolean }) {
  const accent = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <div
      className="flex items-center justify-between rounded-[var(--r-card)] border px-3.5 py-2.5"
      style={{ backgroundColor: broken ? "color-mix(in srgb, var(--verdict-flag) 9%, var(--bg-card))" : "var(--bg-card)", borderColor: broken ? "var(--verdict-flag)" : "var(--border-subtle)" }}
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-[11.5px]" style={{ color: edited ? "var(--verdict-flag)" : "var(--text-primary)" }}>
          <span className="text-[var(--text-faint)]">{String(b.i).padStart(2, "0")} </span>
          {edited ? "✏ " : ""}{b.agent}
          {b.band && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: "var(--band-blue)" }} />}
        </p>
        <p className="truncate font-sans text-[10.5px] text-[var(--text-muted)]">{b.title}</p>
      </div>
      <span className="shrink-0 pl-2 font-mono text-[9.5px]" style={{ color: accent }}>{b.hash}</span>
    </div>
  );
}

export default function AuditChainSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const show = reduce || inView;
  const [edited, setEdited] = useState(false);
  const isBroken = (i: number) => edited && i >= TAMPER_AT;

  return (
    <section id="audit" data-section="dark" className="relative w-full overflow-hidden bg-[var(--bg-page)] px-6 py-12 text-[var(--text-primary)] sm:px-10 lg:py-14">
      <div ref={ref} className="mx-auto max-w-[var(--maxw-content)]">
        {/* eyebrow */}
        <Reveal className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Audit</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">tamper-evident · append-only</span>
        </Reveal>

        {/* heading */}
        <MaskLines
          className="text-3xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-4xl lg:text-4xl"
          lines={[
            <span key="l1" className="text-[var(--text-primary)]">Every step,</span>,
            <span key="l2" className="text-[var(--text-muted)]">hash-chained.</span>,
          ]}
        />

        {/* one-line how-it-works */}
        <Reveal delay={0.1}>
          <p className="mt-3 max-w-3xl font-sans text-[14px] leading-relaxed text-[var(--text-body)]">
            The same nine steps from the loop above, sealed into a logbook - each block stamped with a{" "}
            <span className="text-[var(--text-primary)]">fingerprint</span> of the one before it. Change any record and every
            fingerprint below it stops matching.
          </p>
        </Reveal>

        {/* control bar - simulate (left) ⟷ verify_chain (right), one row */}
        <Reveal delay={0.16}>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-card)] border px-4 py-3" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)" }}>
            <button
              type="button"
              onClick={() => setEdited((v) => !v)}
              className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border px-4 py-2 font-mono text-[12px] transition-colors"
              style={{
                borderColor: edited ? "var(--verdict-flag)" : "var(--border-default)",
                color: edited ? "var(--verdict-flag)" : "var(--text-primary)",
                backgroundColor: edited ? "color-mix(in srgb, var(--verdict-flag) 10%, transparent)" : "transparent",
              }}
            >
              {edited ? `↺  Reset the ledger` : `▶  Simulate editing block #${String(TAMPER_AT).padStart(2, "0")}`}
            </button>

            <div className="flex items-center gap-2">
              <motion.span
                key={edited ? "broken" : "ok"}
                initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: edited ? "var(--verdict-flag)" : "var(--verdict-complete)", boxShadow: `0 0 8px ${edited ? "var(--verdict-flag)" : "var(--verdict-complete)"}` }}
              />
              <span className="font-mono text-[13px]" style={{ color: edited ? "var(--verdict-flag)" : "var(--verdict-complete)" }}>
                {edited ? "verify_chain ✗  tampering caught" : "verify_chain ✓  intact"}
              </span>
            </div>
          </div>
        </Reveal>

        {/* result line */}
        <Reveal delay={0.2}>
          <p className="mt-3 font-sans text-[12.5px] text-[var(--text-muted)]">
            {edited
              ? `Block #${String(TAMPER_AT).padStart(2, "0")} changed - its fingerprint no longer matches, so every block below it (in red) fails the check.`
              : "All 9 blocks re-hashed end to end - nothing has been altered. Try the button to see a tamper get caught."}
          </p>
        </Reveal>

        {/* desktop staircase */}
        <div className="mt-5 hidden md:block">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mx-auto h-auto w-full" style={{ maxWidth: 820 }} role="img" aria-label="A 3x3 grid of nine ledger blocks, chained in order by a fingerprint link that snakes through the cells.">
            {BLOCKS.slice(0, -1).map((b) => (
              <SvgConnector key={`c-${b.i}`} i={b.i} broken={isBroken(b.i)} show={show} reduce={reduce} />
            ))}
            {BLOCKS.map((b) => (
              <SvgBlock key={b.i} b={b} broken={isBroken(b.i)} edited={edited && b.i === TAMPER_AT} show={show} reduce={reduce} />
            ))}
          </svg>
        </div>

        {/* mobile vertical stack */}
        <div className="mt-6 flex flex-col gap-1.5 md:hidden">
          {BLOCKS.map((b) => (
            <MobileRow key={b.i} b={b} broken={isBroken(b.i)} edited={edited && b.i === TAMPER_AT} />
          ))}
        </div>
      </div>
    </section>
  );
}
