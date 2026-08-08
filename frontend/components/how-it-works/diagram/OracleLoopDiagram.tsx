"use client";

/**
 * D3 - the R&D two-oracle gate (report Fig 3). The Adversary invents an
 * order-event sequence engineered to beat the live rulebook; a candidate is
 * never used until it clears BOTH deterministic referees. Oracle 1 (the real
 * rule engine) must MISS it (it evades); Oracle 2 (a backtest) must show profit
 * AND price impact (it's real). Only a sequence that evades AND profits crosses
 * the SanitizedBridge to the Surveillance desk - that crossing is the one true
 * Band hop here (HANDOFF, events only). A fail on either oracle bounces back to
 * the Adversary for another bounded round. Self-draws on scroll-into-view;
 * band-blue marks only the Band hop. Dark "ops" stage.
 */

import { DiagramFrame, Node, Diamond, Edge, Tag, TracePath } from "./kit";

/* ── layout constants ─────────────────────────────────────────────────────── */
// spine flows left → right along this baseline; nodes hang centered on it.
const SPINE_Y = 230;

// Adversary (R&D source)
const ADV = { x: 40, y: 196, w: 270, h: 72 };
// candidate hand-off point
const CAND_X = 296;

// Oracle 1 - rule engine (did it EVADE?)
const O1 = { cx: 446, cy: SPINE_Y, rw: 96, rh: 66 };
// Oracle 2 - backtest (profit AND impact?)
const O2 = { cx: 684, cy: SPINE_Y, rw: 96, rh: 66 };

// Confirmed novel evasion (strong pass card)
const CONF = { x: 806, y: 192, w: 300, h: 76 };
// crossing → SanitizedBridge → Surveillance
const SURV = { x: 806, y: 372, w: 300, h: 62 };

// retry-loop baselines (above = oracle-1 fail, below would crowd the surv card,
// so both retries route up and over the spine back to the Adversary).
const RETRY1_Y = 96; // oracle-1 fail (rule fired)
const RETRY2_Y = 56; // oracle-2 fail (no profit)

export function OracleLoopDiagram({ className = "" }: { className?: string }) {
  return (
    <DiagramFrame
      className={className}
      viewBox="0 0 1140 560"
      amount={0.25}
      label="The R&D two-oracle gate: the Adversary proposes an order-event sequence engineered to beat the live rulebook, emitting a candidate. Oracle 1 is the real rule engine - it must MISS the candidate (the registry returns PASS) for it to count as an evasion. Oracle 2 is a backtest - the candidate must show profit AND price impact to be real. A sequence that evades AND profits is a confirmed novel evasion that crosses the SanitizedBridge to the Surveillance desk as a Band HANDOFF carrying order events only. A failure on either oracle retries back to the Adversary for another bounded round; at most K rounds, and a round with no evade-and-profit sequence stops the loop with no confirmed evasion."
    >
      {(show, reduce) => (
        <>
          {/* ── header eyebrow ─────────────────────────────────────────── */}
          <text
            x={40}
            y={36}
            className="font-mono"
            fontSize={12}
            fontWeight={600}
            letterSpacing="0.16em"
            fill="var(--desk-rnd)"
          >
            R&amp;D DESK · INVENTING A NEW EVASION
          </text>
          <text
            x={40}
            y={54}
            className="font-mono"
            fontSize={10.5}
            letterSpacing="0.04em"
            fill="var(--text-muted)"
          >
            a tactic is never used until it proves itself twice
          </text>

          {/* ── nodes ──────────────────────────────────────────────────── */}
          {/* Adversary - the R&D source */}
          <Node
            x={ADV.x}
            y={ADV.y}
            w={ADV.w}
            h={ADV.h}
            title="Adversary"
            sub="engineers a new evasion sequence"
            tone="rnd"
            titleMono
            delay={0.18}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 1 - rule engine */}
          <Diamond
            cx={O1.cx}
            cy={O1.cy}
            rw={O1.rw}
            rh={O1.rh}
            title="Oracle 1 · rule engine"
            sub="did it EVADE? (PASS)"
            tone="rnd"
            delay={0.34}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 2 - backtest */}
          <Diamond
            cx={O2.cx}
            cy={O2.cy}
            rw={O2.rw}
            rh={O2.rh}
            title="Oracle 2 · backtest"
            sub="profit AND price impact?"
            tone="rnd"
            delay={0.42}
            show={show}
            reduce={reduce}
          />

          {/* Confirmed novel evasion - the one strong pass card */}
          <Node
            x={CONF.x}
            y={CONF.y}
            w={CONF.w}
            h={CONF.h}
            title="Confirmed novel evasion"
            sub="evades AND profits"
            tone="pass"
            titleMono
            delay={0.5}
            show={show}
            reduce={reduce}
          />

          {/* crossing → SanitizedBridge → Surveillance desk */}
          <Node
            x={SURV.x}
            y={SURV.y}
            w={SURV.w}
            h={SURV.h}
            title="SanitizedBridge"
            sub="→ Surveillance · reasoning + id stripped"
            tone="surv"
            titleMono
            delay={0.58}
            show={show}
            reduce={reduce}
          />

          {/* ── edges ──────────────────────────────────────────────────── */}
          {/* Adversary → candidate → Oracle 1 */}
          <Edge
            from={{ x: ADV.x + ADV.w, y: SPINE_Y }}
            to={{ x: O1.cx - O1.rw, y: SPINE_Y }}
            mode="straight"
            tone="rnd"
            delay={0.62}
            show={show}
            reduce={reduce}
          />
          <Tag x={330} y={214} text="candidate" tone="rnd" anchor="middle" delay={0.68} show={show} reduce={reduce} />

          {/* Oracle 1 → Oracle 2 (evades ✓) */}
          <Edge
            from={{ x: O1.cx + O1.rw, y: SPINE_Y }}
            to={{ x: O2.cx - O2.rw, y: SPINE_Y }}
            mode="straight"
            tone="pass"
            label="evades ✓"
            delay={0.72}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 2 → confirmed (real ✓) */}
          <Edge
            from={{ x: O2.cx + O2.rw, y: SPINE_Y }}
            to={{ x: CONF.x, y: CONF.y + CONF.h / 2 }}
            mode="mid-h"
            tone="pass"
            label="real ✓"
            delay={0.82}
            show={show}
            reduce={reduce}
          />

          {/* confirmed → SanitizedBridge → Surveillance (the one Band hop) */}
          <Edge
            from={{ x: CONF.x + CONF.w / 2, y: CONF.y + CONF.h }}
            to={{ x: SURV.x + SURV.w / 2, y: SURV.y }}
            mode="straight"
            tone="band"
            label="HANDOFF · events only"
            pulse
            width={1.8}
            delay={0.92}
            show={show}
            reduce={reduce}
          />

          {/* ── retry loops back to the Adversary (two distinct overhead lanes
                 so the labels and return runs never collide) ─────────────── */}
          {/* Oracle 1 fail - rule fired -> retry (lower lane, y=RETRY1_Y) */}
          <TracePath
            d={`M ${O1.cx} ${O1.cy - O1.rh} V ${RETRY1_Y} H ${ADV.x + ADV.w / 2 - 30} V ${ADV.y}`}
            tone="flag"
            dashed
            arrow
            delay={1.02}
            show={show}
            reduce={reduce}
          />
          <Tag x={O1.cx} y={RETRY1_Y - 8} text="rule fired → retry (round++)" tone="flag" anchor="middle" delay={1.08} show={show} reduce={reduce} />

          {/* Oracle 2 fail - no profit -> retry (upper lane, y=RETRY2_Y) */}
          <TracePath
            d={`M ${O2.cx} ${O2.cy - O2.rh} V ${RETRY2_Y} H ${ADV.x + ADV.w / 2 + 30} V ${ADV.y}`}
            tone="escalate"
            dashed
            arrow
            delay={1.12}
            show={show}
            reduce={reduce}
          />
          <Tag x={O2.cx} y={RETRY2_Y - 8} text="no profit → retry" tone="escalate" anchor="middle" delay={1.18} show={show} reduce={reduce} />

          {/* ── footer: bounded-loop guarantee (split across two lines so
                 it stays legible without overflowing a single Tag) ──────── */}
          <Tag
            x={40}
            y={508}
            text="Bounded: at most K rounds. A round with no evade-and-profit sequence"
            tone="neutral"
            delay={1.22}
            show={show}
            reduce={reduce}
          />
          <Tag
            x={40}
            y={526}
            text="stops the loop with no confirmed evasion."
            tone="neutral"
            delay={1.28}
            show={show}
            reduce={reduce}
          />
        </>
      )}
    </DiagramFrame>
  );
}

export default OracleLoopDiagram;
