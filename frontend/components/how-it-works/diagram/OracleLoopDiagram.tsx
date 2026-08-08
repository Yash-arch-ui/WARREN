"use client";

/**
 * D3 - the token issuance loop (Fig 3). The sender mines a proof-of-work
 * challenge bound to the issuer's nonce; a solved challenge is never spendable
 * until it clears BOTH checks. Oracle 1 (PoW verify) must confirm the work
 * meets the target; Oracle 2 (blind sign) must confirm the issuer signed the
 * batch without ever seeing which token maps to which packet. Only a verified,
 * signed batch crosses to the entry relay - that crossing is the one true wire
 * hop here (token, spent per packet). A fail on either check bounces back to
 * the sender for another mining round. Self-draws on scroll-into-view;
 * band-blue marks only the wire hop. Dark "ops" stage.
 */

import { DiagramFrame, Node, Diamond, Edge, Tag, TracePath } from "./kit";

/* ── layout constants ─────────────────────────────────────────────────────── */
// spine flows left → right along this baseline; nodes hang centered on it.
const SPINE_Y = 230;

// Sender (local source)
const ADV = { x: 40, y: 196, w: 270, h: 72 };
// candidate hand-off point
const CAND_X = 296;

// Oracle 1 - PoW verify (did the work clear the target?)
const O1 = { cx: 446, cy: SPINE_Y, rw: 96, rh: 66 };
// Oracle 2 - blind sign (does the issuer sign it?)
const O2 = { cx: 684, cy: SPINE_Y, rw: 96, rh: 66 };

// Confirmed token batch (strong pass card)
const CONF = { x: 806, y: 192, w: 300, h: 76 };
// crossing → entry relay → mix
const SURV = { x: 806, y: 372, w: 300, h: 62 };

// retry-loop baselines (above = oracle-1 fail, below would crowd the surv card,
// so both retries route up and over the spine back to the sender).
const RETRY1_Y = 96; // oracle-1 fail (work insufficient)
const RETRY2_Y = 56; // oracle-2 fail (batch full)

export function OracleLoopDiagram({ className = "" }: { className?: string }) {
  return (
    <DiagramFrame
      className={className}
      viewBox="0 0 1140 560"
      amount={0.25}
      label="The token issuance loop: the sender mines a proof-of-work challenge bound to the issuer's nonce, client id, and epoch, emitting a solved candidate. Oracle 1 is the PoW check - it must confirm the work meets the target leading-zero-bit difficulty. Oracle 2 is the blind-signature check - the issuer must sign the batch without ever seeing which token maps to which packet. A challenge that clears both is a confirmed token batch that crosses to the entry relay as a wire token event, spent one per packet. A failure on either check retries back to the sender for another mining round; mining continues until the target is met, and a batch that fails signing is never spendable."
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
            SENDER SIDE · MINTING A TOKEN BATCH
          </text>
          <text
            x={40}
            y={54}
            className="font-mono"
            fontSize={10.5}
            letterSpacing="0.04em"
            fill="var(--text-muted)"
          >
            a token is never issued until the work and the signature both check out
          </text>

          {/* ── nodes ──────────────────────────────────────────────────── */}
          {/* Sender - the local source */}
          <Node
            x={ADV.x}
            y={ADV.y}
            w={ADV.w}
            h={ADV.h}
            title="Sender"
            sub="mines a proof-of-work challenge"
            tone="rnd"
            titleMono
            delay={0.18}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 1 - PoW verify */}
          <Diamond
            cx={O1.cx}
            cy={O1.cy}
            rw={O1.rw}
            rh={O1.rh}
            title="PoW verify"
            sub="≥ 26 leading zero bits?"
            tone="rnd"
            delay={0.34}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 2 - blind sign */}
          <Diamond
            cx={O2.cx}
            cy={O2.cy}
            rw={O2.rw}
            rh={O2.rh}
            title="Blind sign"
            sub="issuer signs, never sees which token"
            tone="rnd"
            delay={0.42}
            show={show}
            reduce={reduce}
          />

          {/* Confirmed token batch - the one strong pass card */}
          <Node
            x={CONF.x}
            y={CONF.y}
            w={CONF.w}
            h={CONF.h}
            title="Token batch minted"
            sub="work verified AND blind-signed"
            tone="pass"
            titleMono
            delay={0.5}
            show={show}
            reduce={reduce}
          />

          {/* crossing → entry relay → mix */}
          <Node
            x={SURV.x}
            y={SURV.y}
            w={SURV.w}
            h={SURV.h}
            title="Entry relay"
            sub="→ mix · one token spent per packet"
            tone="surv"
            titleMono
            delay={0.58}
            show={show}
            reduce={reduce}
          />

          {/* ── edges ──────────────────────────────────────────────────── */}
          {/* Sender → candidate → Oracle 1 */}
          <Edge
            from={{ x: ADV.x + ADV.w, y: SPINE_Y }}
            to={{ x: O1.cx - O1.rw, y: SPINE_Y }}
            mode="straight"
            tone="rnd"
            delay={0.62}
            show={show}
            reduce={reduce}
          />
          <Tag x={330} y={214} text="solved challenge" tone="rnd" anchor="middle" delay={0.68} show={show} reduce={reduce} />

          {/* Oracle 1 → Oracle 2 (valid ✓) */}
          <Edge
            from={{ x: O1.cx + O1.rw, y: SPINE_Y }}
            to={{ x: O2.cx - O2.rw, y: SPINE_Y }}
            mode="straight"
            tone="pass"
            label="valid ✓"
            delay={0.72}
            show={show}
            reduce={reduce}
          />

          {/* Oracle 2 → confirmed (signed ✓) */}
          <Edge
            from={{ x: O2.cx + O2.rw, y: SPINE_Y }}
            to={{ x: CONF.x, y: CONF.y + CONF.h / 2 }}
            mode="mid-h"
            tone="pass"
            label="signed ✓"
            delay={0.82}
            show={show}
            reduce={reduce}
          />

          {/* confirmed → entry relay → mix (the one wire hop) */}
          <Edge
            from={{ x: CONF.x + CONF.w / 2, y: CONF.y + CONF.h }}
            to={{ x: SURV.x + SURV.w / 2, y: SURV.y }}
            mode="straight"
            tone="band"
            label="token"
            pulse
            width={1.8}
            delay={0.92}
            show={show}
            reduce={reduce}
          />

          {/* ── retry loops back to the sender (two distinct overhead lanes
                 so the labels and return runs never collide) ─────────────── */}
          {/* Oracle 1 fail - work insufficient -> retry (lower lane, y=RETRY1_Y) */}
          <TracePath
            d={`M ${O1.cx} ${O1.cy - O1.rh} V ${RETRY1_Y} H ${ADV.x + ADV.w / 2 - 30} V ${ADV.y}`}
            tone="flag"
            dashed
            arrow
            delay={1.02}
            show={show}
            reduce={reduce}
          />
          <Tag x={O1.cx} y={RETRY1_Y - 8} text="insufficient work → retry (mine again)" tone="flag" anchor="middle" delay={1.08} show={show} reduce={reduce} />

          {/* Oracle 2 fail - batch full -> retry (upper lane, y=RETRY2_Y) */}
          <TracePath
            d={`M ${O2.cx} ${O2.cy - O2.rh} V ${RETRY2_Y} H ${ADV.x + ADV.w / 2 + 30} V ${ADV.y}`}
            tone="escalate"
            dashed
            arrow
            delay={1.12}
            show={show}
            reduce={reduce}
          />
          <Tag x={O2.cx} y={RETRY2_Y - 8} text="batch full → retry next epoch" tone="escalate" anchor="middle" delay={1.18} show={show} reduce={reduce} />

          {/* ── footer: bounded-loop guarantee (split across two lines so
                 it stays legible without overflowing a single Tag) ──────── */}
          <Tag
            x={40}
            y={508}
            text="Mining retries until the target is met. A batch that fails signing"
            tone="neutral"
            delay={1.22}
            show={show}
            reduce={reduce}
          />
          <Tag
            x={40}
            y={526}
            text="is never spendable - the client just mines again."
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
