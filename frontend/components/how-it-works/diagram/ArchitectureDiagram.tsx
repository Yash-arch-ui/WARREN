"use client";

/**
 * D1 - the system architecture (report Fig 1). Faithfully recreated from the
 * source-of-truth drawio file at /home/ayush_s/projects/pratham/fig1_architecture.drawio
 * — every coordinate matches the drawio cell geometry to the pixel so the
 * diagram reads the same as the report figure, with the dark-ops stage
 * applied (tokens, not hex) and the scroll-into-view self-draw layered on
 * top. Two desks across the Chinese wall on the Band spine; the gold rule
 * engine holds sole verdict authority; the hash-chained ledger seals every
 * message. Self-draws on scroll-into-view; band-blue marks only the Band hops.
 *
 * Coordinate system: viewBox 0 0 1200 620 (1.94:1), matches the drawio page.
 * All positions below are copied directly from the drawio file's mxGeometry
 * values (see the file header for the line-by-line mapping).
 */

import { motion } from "framer-motion";
import { DiagramFrame, Node, EngineNode, Edge, Chip, Tag, TracePath, EASE } from "./kit";

function DeskFrame({
  x,
  y,
  w,
  h,
  label,
  tone,
  show,
  reduce,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone: string;
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <rect x={x} y={y} width={w} height={h} rx={16} fill="color-mix(in srgb, var(--band-blue) 2%, transparent)" stroke={tone} strokeWidth={1} strokeDasharray="2 6" opacity={0.7} />
      <text x={x + 16} y={y + 24} className="font-mono" fontSize={12} fontWeight={600} letterSpacing="0.1em" fill={tone}>
        {label}
      </text>
    </motion.g>
  );
}

export function ArchitectureDiagram({
  className = "",
  staticMode = false,
}: {
  className?: string;
  staticMode?: boolean;
}) {
  return (
    <DiagramFrame
      className={className}
      viewBox="0 0 1200 620"
      amount={0.25}
      staticMode={staticMode}
      label="Alpha & Oversight architecture: an R&D desk (adversary plus two deterministic oracles) and a Surveillance desk (anomaly detector, investigator, specialist, a local prosecution-versus-defense debate, adjudicator, the gold rule engine, and escalation manager) sit on the Band coordination spine across a one-way Chinese wall enforced by the SanitizedBridge. The deterministic rule engine is the sole PASS/FLAG authority; a human peer confirms escalations; a hash-chained ledger seals every Band message."
    >
      {(show, reduce) => (
        <>
          {/* ── BAND spine ──────────────────────────────────────────────── */}
          {/* drawio: (352.5, 13, 540, 44) */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <rect x={352.5} y={13} width={540} height={44} rx={10} fill="var(--band-blue)" stroke="var(--band-blue)" />
            <rect x={352.5} y={13} width={540} height={44} rx={10} fill="none" stroke="var(--band-blue)" strokeWidth={6} opacity={0.18} />
            <text x={622.5} y={32} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={700} letterSpacing="0.12em" fill="var(--frost)">
              BAND
            </text>
            <text x={622.5} y={48} textAnchor="middle" className="font-mono" fontSize={9} letterSpacing="0.05em" fill="var(--frost)" opacity={0.9}>
              HANDOFF · EVIDENCE · VERDICT · ESCALATION · RULE_CODIFIED
            </text>
          </motion.g>

          {/* ── desk frames ─────────────────────────────────────────────── */}
          {/* drawio: rnd (40, 104, 288, 404); surv (490, 99, 730, 404) */}
          <DeskFrame x={40} y={104} w={288} h={404} label="R&D DESK · RED TEAM" tone="var(--desk-rnd)" show={show} reduce={reduce} delay={0.1} />
          <DeskFrame x={490} y={99} w={730} h={404} label="SURVEILLANCE DESK · BLUE TEAM" tone="var(--desk-surv)" show={show} reduce={reduce} delay={0.1} />

          {/* ── Chinese wall ───────────────────────────────────────────── */}
          {/* drawio: vertical line (348, 97) → (348, 515) */}
          <motion.line
            x1={348}
            y1={97}
            x2={348}
            y2={515}
            stroke="var(--text-faint)"
            strokeWidth={1.4}
            strokeDasharray="5 6"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.8 } : undefined}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          />
          {/* drawio: walllbl (346, 99, 52, 30) - "Chinese wall" */}
          <motion.text
            x={372}
            y={111}
            textAnchor="middle"
            className="font-mono"
            fontSize={10}
            fontWeight={600}
            fill="var(--text-muted)"
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.9, ease: EASE }}
          >
            ⟂ Chinese wall
          </motion.text>

          {/* ── R&D stack (drawio: left column inside R&D desk) ────────── */}
          {/* adv (62, 146, 244, 64); or1 (62, 226, 244, 48); or2 (62, 286, 244, 48); conf (62, 350, 244, 50) */}
          <Node x={62} y={146} w={244} h={64} title="adversary" sub="frontier LLM · invents evasions" tone="rnd" titleMono delay={0.25} show={show} reduce={reduce} />
          <Node x={62} y={226} w={244} h={48} title="oracle 1 · rule engine" sub="does the rulebook MISS it?" tone="rnd" titleMono delay={0.32} show={show} reduce={reduce} />
          <Node x={62} y={286} w={244} h={48} title="oracle 2 · backtest" sub="profit AND price impact?" tone="rnd" titleMono delay={0.38} show={show} reduce={reduce} />
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.44, ease: EASE }}
          >
            <rect x={62} y={350} width={244} height={50} rx={10} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={184} y={372} textAnchor="middle" className="font-sans" fontSize={11} fontStyle="italic" fill="var(--text-muted)">
              evades AND profits
            </text>
            <text x={184} y={388} textAnchor="middle" className="font-sans" fontSize={11} fontStyle="italic" fill="var(--text-muted)">
              = confirmed novel evasion
            </text>
          </motion.g>

          {/* ── SanitizedBridge ─────────────────────────────────────────── */}
          {/* drawio: bridge (368, 338, 90, 74) - straddles the wall at x=348 */}
          <Node x={368} y={338} w={90} h={74} title="Sanitized" sub="Bridge · strips reasoning + model_key" tone="surv" titleMono delay={0.5} show={show} reduce={reduce} />

          {/* ── surveillance top row ───────────────────────────────────── */}
          {/* drawio: anom (512, 145, 138, 50); inv (676, 145, 150, 50); spec (852, 145, 162, 50) */}
          <Node x={512} y={145} w={138} h={50} title="Anomaly" sub="Detector" tone="surv" titleMono delay={0.55} show={show} reduce={reduce} />
          <Node x={676} y={145} w={150} h={50} title="Investigator" sub="recruits a specialist" tone="surv" titleMono delay={0.6} show={show} reduce={reduce} />
          <Node x={852} y={145} w={162} h={50} title="Specialist" sub="proposes contested inputs" tone="surv" titleMono delay={0.65} show={show} reduce={reduce} />

          {/* ── local debate (Prosecution + Defense, off-Band) ─────────── */}
          {/* drawio: debate (512, 227, 300, 92); pros (526, 245, 126, 42); def (672, 245, 126, 42) */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
          >
            <rect x={512} y={227} width={300} height={92} rx={10} fill="none" stroke="var(--desk-surv)" strokeWidth={1} strokeDasharray="5 4" opacity={0.8} />
            <text x={662} y={311} textAnchor="middle" className="font-mono" fontSize={9.5} fontStyle="italic" fill="var(--text-muted)">
              local debate · off Band
            </text>
          </motion.g>
          <Node x={526} y={245} w={126} h={42} title="Prosecution" tone="surv" titleMono delay={0.74} show={show} reduce={reduce} />
          <Node x={672} y={245} w={126} h={42} title="Defense" tone="surv" titleMono delay={0.78} show={show} reduce={reduce} />

          {/* ── Adjudicator (right of debate) ──────────────────────────── */}
          {/* drawio: adj (852, 244, 162, 58) */}
          <Node x={852} y={244} w={162} h={58} title="Adjudicator" sub="resolves the inputs" tone="surv" titleMono delay={0.82} show={show} reduce={reduce} />

          {/* ── rule engine (sole authority) ───────────────────────────── */}
          {/* drawio: engine (616, 355, 252, 66) */}
          <EngineNode x={616} y={355} w={252} h={66} delay={0.9} show={show} reduce={reduce} />

          {/* ── verdict chips ──────────────────────────────────────────── */}
          {/* drawio: flag (556, 447, 156, 30); esc (746, 447, 220, 30) */}
          <Chip x={556} y={447} w={156} h={30} label="FLAG → FLAGGED" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Chip x={746} y={447} w={220} h={30} label="PASS on suspicious flow → ESCALATED" tone="escalate" delay={1.05} show={show} reduce={reduce} />

          {/* ── Compliance (human) + Escalation Manager ─────────────────── */}
          {/* drawio: human (1044, 239, 154, 58); escmgr (1044, 355, 154, 66) */}
          <Node x={1044} y={239} w={154} h={58} title="Compliance officer" sub="(human peer)" tone="human" titleMono delay={0.95} show={show} reduce={reduce} />
          <Node x={1044} y={355} w={154} h={66} title="Escalation" sub="Manager" tone="surv" titleMono delay={0.95} show={show} reduce={reduce} />

          {/* ── hash-chained ledger ────────────────────────────────────── */}
          {/* drawio: ledger (149, 538, 947, 40) */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
          >
            <rect x={149} y={538} width={947} height={40} rx={8} fill="var(--bg-card)" stroke="var(--hairline)" strokeWidth={1} />
            <text x={165} y={563} className="font-mono" fontSize={11.5} fill="var(--text-muted)">
              Hash-chained audit ledger — every Band message sealed:
            </text>
            <text x={1080} y={563} textAnchor="end" className="font-mono" fontSize={11.5} fill="var(--band-blue)">
              hash = sha256(prev_hash + canonical_json) · binds band_message_id · verify_chain()
            </text>
          </motion.g>

          {/* ════════════════════════════════════════════════════════════════
              EDGES — every one of these is a 1:1 port of the drawio edge.
              ════════════════════════════════════════════════════════════════ */}

          {/* e_band_surv: BAND bottom (0.86*540+352.5, 57) ≈ (817, 57) →
              surv top centre (855, 99). Label "@mention handoffs". */}
          <Edge from={{ x: 817, y: 57 }} to={{ x: 855, y: 99 }} mode="straight" tone="band" label="@mention handoffs" pulse delay={0.5} show={show} reduce={reduce} />

          {/* e_band_ledger: source (472, 57) → target ledger top (left mid).
              Routed straight down to ledger top via waypoint (472, 538).
              In drawio it's an endArrow (no arrow) per file - but it's the
              ledger binding, so a dashed line is right. */}
          <Edge from={{ x: 472, y: 57 }} to={{ x: 472, y: 538 }} mode="straight" tone="band" dashed width={1} delay={0.6} show={show} reduce={reduce} />

          {/* R&D internal vertical chain - drawio: adv→or1→or2→conf→bridge */}
          <Edge from={{ x: 184, y: 210 }} to={{ x: 184, y: 226 }} mode="straight" delay={0.42} show={show} reduce={reduce} />
          <Edge from={{ x: 184, y: 274 }} to={{ x: 184, y: 286 }} mode="straight" delay={0.46} show={show} reduce={reduce} />
          <Edge from={{ x: 184, y: 334 }} to={{ x: 184, y: 350 }} mode="straight" delay={0.5} show={show} reduce={reduce} />
          {/* e_conf_bridge: conf right edge → bridge left edge.
              conf right (306, 375), bridge left (368, 375). Straight. */}
          <Edge from={{ x: 306, y: 375 }} to={{ x: 368, y: 375 }} mode="straight" delay={0.54} show={show} reduce={reduce} />

          {/* e_bridge_anom: bridge (exit 0.8, 0 → 368+72, 338) = (440, 338)
              → anom (entry 0, 0.5 → 512, 170). drawio waypoints define the
              routing: from (440, 338) straight UP to (440, 170) then RIGHT
              to (512, 170). The label "HANDOFF events only" sits on the
              segment. */}
          <Edge
            from={{ x: 440, y: 338 }}
            to={{ x: 512, y: 170 }}
            mode="vh"
            tone="band"
            label="HANDOFF · events only"
            pulse
            width={1.8}
            delay={0.7}
            show={show}
            reduce={reduce}
          />

          {/* Top-row relay: anom→inv→spec, straight horizontal hops */}
          <Edge from={{ x: 650, y: 170 }} to={{ x: 676, y: 170 }} mode="straight" delay={0.78} show={show} reduce={reduce} />
          <Edge from={{ x: 826, y: 170 }} to={{ x: 852, y: 170 }} mode="straight" delay={0.82} show={show} reduce={reduce} />

          {/* e_spec_deb: specialist → debate. drawio waypoints (in group):
              (411, 117), (348, 117), (348, 156) → global: (901, 216), (838,
              216), (838, 255). Specialist bottom-left (exit 0.3, 1) =
              (852+48.6, 195) = (901, 195). Debate top-right (entry 1, 0.3)
              = (812, 255). Path: M 901 195 V 216 H 838 V 255. */}
          <Edge from={{ x: 901, y: 195 }} to={{ x: 812, y: 255 }} mode="vh" delay={0.86} show={show} reduce={reduce} />

          {/* e_deb_adj: debate → adj. Debate right (812, 273) → adj left
              (852, 273). Straight horizontal hop. */}
          <Edge from={{ x: 812, y: 273 }} to={{ x: 852, y: 273 }} mode="straight" delay={0.9} show={show} reduce={reduce} />

          {/* e_adj_eng: adjudicator → engine. Label "resolved inputs".
              Adj bottom (933, 302) → engine top centre (742, 355). Mid-v
              path: M 933 302 V 339 H 742 V 355. Tag sits at y=329 to
              label the arrow. */}
          <Edge
            from={{ x: 933, y: 302 }}
            to={{ x: 742, y: 355 }}
            mode="mid-v"
            tone="neutral"
            delay={0.94}
            show={show}
            reduce={reduce}
          />
          <Tag x={837} y={332} text="resolved inputs" tone="neutral" anchor="middle" delay={1.0} show={show} reduce={reduce} />

          {/* Engine outputs. e_eng_flag exit (0.25, 1) → (616+63, 421) =
              (679, 421). Flag chip top (0.5, 0) = (634, 447). Straight.
              e_eng_esc exit (0.6, 1) → (616+151.2, 421) = (767, 421). Esc
              chip top centre (856, 447). Straight. */}
          <Edge from={{ x: 679, y: 421 }} to={{ x: 634, y: 447 }} mode="straight" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Edge from={{ x: 767, y: 421 }} to={{ x: 856, y: 447 }} mode="straight" tone="escalate" delay={1.05} show={show} reduce={reduce} />

          {/* e_esc_mgr: esc chip right (966, 462) → escmgr left mid (1044,
              388). Straight. */}
          <Edge from={{ x: 966, y: 462 }} to={{ x: 1044, y: 388 }} mode="mid-h" tone="escalate" delay={1.1} show={show} reduce={reduce} />

          {/* e_mgr_human: escmgr → human. escmgr top centre (1121, 355)
              → human bottom centre (1121, 297). Straight vertical. Label
              "ESCALATION" sits on the segment. */}
          <Edge
            from={{ x: 1121, y: 355 }}
            to={{ x: 1121, y: 297 }}
            mode="straight"
            tone="escalate"
            label="ESCALATION"
            delay={1.15}
            show={show}
            reduce={reduce}
          />

          {/* e_human_eng: human → engine. Source: human's left mid
              (1044, 268). Engine entry: (1, 0.25) = (868, 371.5).
              drawio waypoints (group): (533, 169), (533, 273) → global
              (1023, 268), (1023, 372). Path: M 1044 268 V 372 H 868 V 372.
              Label "confirm → codify" sits at midpoint. */}
          <Edge
            from={{ x: 1044, y: 268 }}
            to={{ x: 868, y: 371 }}
            mode="vh"
            tone="neutral"
            dashed
            delay={1.2}
            show={show}
            reduce={reduce}
          />
          <Tag x={956} y={365} text="confirm → codify" tone="neutral" anchor="middle" delay={1.25} show={show} reduce={reduce} />

          {/* e_rulebook: source engine (616, 388) → target conf bottom
              (184, 400). drawio waypoints (global): (532, 388), (532, 444),
              (184, 444). Path: M 616 388 H 532 V 444 H 184 V 400 - this
              routes LEFT from the engine's left edge, DOWN past the chips
              to y=444, then LEFT all the way to R&D at x=184, then UP into
              the bottom of the "confirmed evasion" box. */}
          <TracePath
            d="M 616 388 H 532 V 444 H 184 V 400"
            tone="neutral"
            dashed
            arrow
            delay={1.3}
            show={show}
            reduce={reduce}
          />
          <Tag x={370} y={437} text="active rulebook → R&D (read-only)" tone="neutral" anchor="middle" delay={1.35} show={show} reduce={reduce} />
        </>
      )}
    </DiagramFrame>
  );
}

export default ArchitectureDiagram;