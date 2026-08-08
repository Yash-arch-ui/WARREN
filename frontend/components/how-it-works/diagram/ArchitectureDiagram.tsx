"use client";

/**
 * D1 - the system architecture (Fig 1). Coordinates preserved from the
 * original report figure so the diagram keeps its drawn proportions, with the
 * dark-ops stage applied (tokens, not hex) and the scroll-into-view self-draw
 * layered on top. Sender-side local zone across a structural wall from the
 * relay path; the gold K-of-N directory holds sole authority on which relays
 * are real. Self-draws on scroll-into-view; band-blue marks only the wire
 * hops.
 *
 * Coordinate system: viewBox 0 0 1200 620 (1.94:1).
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
      label="Warren architecture: a sender-side local zone (client plus a proof-of-work gate and a blind-signature issuer) and a relay path (middle relay, exit relay, recipient, a local reorder-and-reassemble step, and the gold K-of-N directory) sit across a structural wall enforced by the entry relay. The K-of-N directory is the sole authority on which relays are real; independent directory signers attest the relay list; every message is chunked to fit the per-packet budget."
    >
      {(show, reduce) => (
        <>
          {/* ── THE WIRE spine ──────────────────────────────────────────── */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <rect x={352.5} y={13} width={540} height={44} rx={10} fill="var(--band-blue)" stroke="var(--band-blue)" />
            <rect x={352.5} y={13} width={540} height={44} rx={10} fill="none" stroke="var(--band-blue)" strokeWidth={6} opacity={0.18} />
            <text x={622.5} y={32} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={700} letterSpacing="0.12em" fill="var(--frost)">
              THE WIRE
            </text>
            <text x={622.5} y={48} textAnchor="middle" className="font-mono" fontSize={9} letterSpacing="0.05em" fill="var(--frost)" opacity={0.9}>
              [u32 LEN][u8 TYPE][BODY] · dressed as a TLS-1.2 record
            </text>
          </motion.g>

          {/* ── zone frames ─────────────────────────────────────────────── */}
          <DeskFrame x={40} y={104} w={288} h={404} label="SENDER SIDE · LOCAL" tone="var(--desk-rnd)" show={show} reduce={reduce} delay={0.1} />
          <DeskFrame x={490} y={99} w={730} h={404} label="RELAY PATH · MIX" tone="var(--desk-surv)" show={show} reduce={reduce} delay={0.1} />

          {/* ── structural wall ────────────────────────────────────────── */}
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
            ⟂ structural wall
          </motion.text>

          {/* ── sender-side stack ───────────────────────────────────────── */}
          <Node x={62} y={146} w={244} h={64} title="sender" sub="client · builds Sphinx packets" tone="rnd" titleMono delay={0.25} show={show} reduce={reduce} />
          <Node x={62} y={226} w={244} h={48} title="pow gate" sub="verify(challenge, counter)" tone="rnd" titleMono delay={0.32} show={show} reduce={reduce} />
          <Node x={62} y={286} w={244} h={48} title="issuer" sub="blind-signs the token batch" tone="rnd" titleMono delay={0.38} show={show} reduce={reduce} />
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.44, ease: EASE }}
          >
            <rect x={62} y={350} width={244} height={50} rx={10} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={184} y={372} textAnchor="middle" className="font-sans" fontSize={11} fontStyle="italic" fill="var(--text-muted)">
              work verified AND blind-signed
            </text>
            <text x={184} y={388} textAnchor="middle" className="font-sans" fontSize={11} fontStyle="italic" fill="var(--text-muted)">
              = one packet ready to send
            </text>
          </motion.g>

          {/* ── entry relay (straddles the wall) ─────────────────────────── */}
          <Node x={368} y={338} w={90} h={74} title="Entry" sub="relay · admits + peels one layer" tone="surv" titleMono delay={0.5} show={show} reduce={reduce} />

          {/* ── relay-path top row ───────────────────────────────────────── */}
          <Node x={512} y={145} w={138} h={50} title="Middle" sub="relay" tone="surv" titleMono delay={0.55} show={show} reduce={reduce} />
          <Node x={676} y={145} w={150} h={50} title="Exit relay" sub="peels the final layer" tone="surv" titleMono delay={0.6} show={show} reduce={reduce} />
          <Node x={852} y={145} w={162} h={50} title="Recipient" sub="ratchet decrypts" tone="surv" titleMono delay={0.65} show={show} reduce={reduce} />

          {/* ── local reorder + reassembly (recipient-side, not published) ── */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
          >
            <rect x={512} y={227} width={300} height={92} rx={10} fill="none" stroke="var(--desk-surv)" strokeWidth={1} strokeDasharray="5 4" opacity={0.8} />
            <text x={662} y={311} textAnchor="middle" className="font-mono" fontSize={9.5} fontStyle="italic" fill="var(--text-muted)">
              reorder + reassemble · local, off the wire
            </text>
          </motion.g>
          <Node x={526} y={245} w={126} h={42} title="chunk 1" tone="surv" titleMono delay={0.74} show={show} reduce={reduce} />
          <Node x={672} y={245} w={126} h={42} title="chunk 2" tone="surv" titleMono delay={0.78} show={show} reduce={reduce} />

          {/* ── delivered (right of reassembly) ──────────────────────────── */}
          <Node x={852} y={244} w={162} h={58} title="Delivered" sub="message reassembled" tone="surv" titleMono delay={0.82} show={show} reduce={reduce} />

          {/* ── K-of-N directory (sole authority) ────────────────────────── */}
          <EngineNode x={616} y={355} w={252} h={66} title="K-OF-N DIRECTORY" sub="sole authority on real relays · threshold attested" delay={0.9} show={show} reduce={reduce} />

          {/* ── attestation chips ─────────────────────────────────────────── */}
          <Chip x={556} y={447} w={156} h={30} label="BELOW THRESHOLD → REJECTED" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Chip x={746} y={447} w={220} h={30} label="≥ THRESHOLD → ATTESTED" tone="pass" delay={1.05} show={show} reduce={reduce} />

          {/* ── directory signer + attestation ───────────────────────────── */}
          <Node x={1044} y={239} w={154} h={58} title="Directory signer" sub="(independent operator)" tone="human" titleMono delay={0.95} show={show} reduce={reduce} />
          <Node x={1044} y={355} w={154} h={66} title="Attestation" sub="signs the entry set" tone="surv" titleMono delay={0.95} show={show} reduce={reduce} />

          {/* ── chunking budget footer ───────────────────────────────────── */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
          >
            <rect x={149} y={538} width={947} height={40} rx={8} fill="var(--bg-card)" stroke="var(--hairline)" strokeWidth={1} />
            <text x={165} y={563} className="font-mono" fontSize={11.5} fill="var(--text-muted)">
              Every message is chunked to fit the per-packet budget:
            </text>
            <text x={1080} y={563} textAnchor="end" className="font-mono" fontSize={11.5} fill="var(--band-blue)">
              MAX_MSG_LEN ≈ 705 B · packet_payload_bytes() = 305 B · one token spent per packet
            </text>
          </motion.g>

          {/* ════════════════════════════════════════════════════════════════
              EDGES
              ════════════════════════════════════════════════════════════════ */}

          <Edge from={{ x: 817, y: 57 }} to={{ x: 855, y: 99 }} mode="straight" tone="band" label="directory fetch" pulse delay={0.5} show={show} reduce={reduce} />

          <Edge from={{ x: 472, y: 57 }} to={{ x: 472, y: 538 }} mode="straight" tone="band" dashed width={1} delay={0.6} show={show} reduce={reduce} />

          {/* sender-side internal vertical chain: sender→pow gate→issuer→ready→entry */}
          <Edge from={{ x: 184, y: 210 }} to={{ x: 184, y: 226 }} mode="straight" delay={0.42} show={show} reduce={reduce} />
          <Edge from={{ x: 184, y: 274 }} to={{ x: 184, y: 286 }} mode="straight" delay={0.46} show={show} reduce={reduce} />
          <Edge from={{ x: 184, y: 334 }} to={{ x: 184, y: 350 }} mode="straight" delay={0.5} show={show} reduce={reduce} />
          <Edge from={{ x: 306, y: 375 }} to={{ x: 368, y: 375 }} mode="straight" delay={0.54} show={show} reduce={reduce} />

          <Edge
            from={{ x: 440, y: 338 }}
            to={{ x: 512, y: 170 }}
            mode="vh"
            tone="band"
            label="one Sphinx layer only"
            pulse
            width={1.8}
            delay={0.7}
            show={show}
            reduce={reduce}
          />

          {/* relay-path top row hops: middle→exit→recipient */}
          <Edge from={{ x: 650, y: 170 }} to={{ x: 676, y: 170 }} mode="straight" delay={0.78} show={show} reduce={reduce} />
          <Edge from={{ x: 826, y: 170 }} to={{ x: 852, y: 170 }} mode="straight" delay={0.82} show={show} reduce={reduce} />

          <Edge from={{ x: 901, y: 195 }} to={{ x: 812, y: 255 }} mode="vh" delay={0.86} show={show} reduce={reduce} />

          <Edge from={{ x: 812, y: 273 }} to={{ x: 852, y: 273 }} mode="straight" delay={0.9} show={show} reduce={reduce} />

          <Edge
            from={{ x: 933, y: 302 }}
            to={{ x: 742, y: 355 }}
            mode="mid-v"
            tone="neutral"
            delay={0.94}
            show={show}
            reduce={reduce}
          />
          <Tag x={837} y={332} text="reassembled message" tone="neutral" anchor="middle" delay={1.0} show={show} reduce={reduce} />

          <Edge from={{ x: 679, y: 421 }} to={{ x: 634, y: 447 }} mode="straight" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Edge from={{ x: 767, y: 421 }} to={{ x: 856, y: 447 }} mode="straight" tone="pass" delay={1.05} show={show} reduce={reduce} />

          <Edge from={{ x: 966, y: 462 }} to={{ x: 1044, y: 388 }} mode="mid-h" tone="pass" delay={1.1} show={show} reduce={reduce} />

          <Edge
            from={{ x: 1121, y: 355 }}
            to={{ x: 1121, y: 297 }}
            mode="straight"
            tone="pass"
            label="ATTESTATION"
            delay={1.15}
            show={show}
            reduce={reduce}
          />

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
          <Tag x={956} y={365} text="attest → trust" tone="neutral" anchor="middle" delay={1.25} show={show} reduce={reduce} />

          <TracePath
            d="M 616 388 H 532 V 444 H 184 V 400"
            tone="neutral"
            dashed
            arrow
            delay={1.3}
            show={show}
            reduce={reduce}
          />
          <Tag x={370} y={437} text="trusted relay list → sender (read-only)" tone="neutral" anchor="middle" delay={1.35} show={show} reduce={reduce} />
        </>
      )}
    </DiagramFrame>
  );
}

export default ArchitectureDiagram;
