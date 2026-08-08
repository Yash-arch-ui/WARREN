"use client";

import { motion } from "framer-motion";

/**
 * PathNonagon - the presentational SVG of the "wire at the centre" nonagon: nine
 * roles on a 9-sided ring, every side one hop a message takes, with cover
 * traffic closing the loop so that sending and silence look alike. Extracted
 * from OverviewSection so the exact same diagram (the landing "#overview" art)
 * can also fill the hero laptop screen (HeroSplitArt) without diverging.
 *
 * Pure presentation: no hooks of its own - the caller supplies `show` (start the
 * self-draw) and `reduce` (render the final state immediately, reduced-motion).
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Tone = "rnd" | "surv" | "codify" | "human";
type Role = {
  id: string;
  name: string;
  role: string;
  hopN: string;
  hop: string;
  tone: Tone;
  tier: string;
  feedback?: boolean;
  wall?: boolean;
};

/* the nine roles in path order (one per nonagon vertex); `hop` = what this
   node HANDS to the next one. */
const ROLES: Role[] = [
  { id: "directory", name: "directory", role: "K-of-N signed relay list", hopN: "01", hop: "verified path", tone: "rnd", tier: "attested", wall: true },
  { id: "issuer", name: "issuer", role: "blind-signs tokens", hopN: "02", hop: "unlinkable token", tone: "codify", tier: "proof of work" },
  { id: "ratchet", name: "ratchet", role: "encrypts the body", hopN: "03", hop: "ciphertext", tone: "rnd", tier: "double ratchet" },
  { id: "sender", name: "you", role: "pads · splits · spends", hopN: "04", hop: "sphinx packet", tone: "rnd", tier: "1024 B" },
  { id: "entry", name: "entry relay", role: "knows you, not them", hopN: "05", hop: "one layer peeled", tone: "surv", tier: "random delay" },
  { id: "middle", name: "middle relay", role: "knows neither end", hopN: "06", hop: "one layer peeled", tone: "surv", tier: "random delay" },
  { id: "exit", name: "exit relay", role: "knows them, not you", hopN: "07", hop: "delivery", tone: "surv", tier: "random delay" },
  { id: "recipient", name: "recipient", role: "decrypts · reassembles", hopN: "08", hop: "plaintext", tone: "human", tier: "path unknown" },
  { id: "cover", name: "cover traffic", role: "hides the silence", hopN: "09", hop: "indistinguishable", tone: "codify", tier: "constant rate", feedback: true },
];

const toneColor: Record<Tone, string> = {
  rnd: "var(--desk-rnd)",
  surv: "var(--desk-surv)",
  codify: "var(--verdict-escalate)",
  human: "var(--text-faint)",
};

/* ── nonagon geometry (viewBox 0 0 1120 900) - a wide ellipse-laid 9-gon ───── */
const CX = 560;
const CY = 460;
const RX = 372;
const RY = 300;
const CARD_W = 172;
const CARD_H = 66;
const rad = (d: number) => (d * Math.PI) / 180;
const PTS = ROLES.map((r, i) => {
  const a = -90 + i * 40; // 360/9 = 40°, clockwise from top
  return { ...r, i, a, x: CX + RX * Math.cos(rad(a)), y: CY + RY * Math.sin(rad(a)) };
});
const BAND_D = "M " + PTS.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
const CLOSE_D = `M ${PTS[8].x.toFixed(1)} ${PTS[8].y.toFixed(1)} L ${PTS[0].x.toFixed(1)} ${PTS[0].y.toFixed(1)}`;
const ARROWS = PTS.map((p, i) => {
  const q = PTS[(i + 1) % 9];
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  return { mx, my, ang, feedback: i === 8 };
});

function AgentCard({ node, show, reduce }: { node: (typeof PTS)[number]; show: boolean; reduce: boolean }) {
  const tone = toneColor[node.tone];
  const x = node.x - CARD_W / 2;
  const y = node.y - CARD_H / 2;
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, delay: 0.5 + node.i * 0.09, ease: EASE }}
    >
      <rect x={x} y={y} width={CARD_W} height={CARD_H} rx={13} fill="var(--bg-card)" stroke={tone} strokeWidth={1} />
      <circle cx={x + CARD_W - 15} cy={y + 15} r={3} fill={tone} />
      <text x={x + 14} y={y + 24} className="font-mono" fontSize={12.5} fill="var(--text-primary)">
        {node.name}
      </text>
      <text x={x + 14} y={y + 41} className="font-sans" fontSize={10.5} fill="var(--text-muted)">
        {node.role}
      </text>
      <text x={x + 14} y={y + 58} className="font-mono" fontSize={9.5} fill={node.feedback ? "var(--verdict-escalate)" : "var(--band-blue)"}>
        {node.hopN} → {node.hop}
      </text>
    </motion.g>
  );
}

export function PathNonagon({
  show,
  reduce,
  className = "h-auto w-full",
}: {
  show: boolean;
  reduce: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 112 1120 680"
      className={className}
      role="img"
      aria-label="A nonagon of nine roles around the wire at the centre: a signed directory fixes the path, a blind issuer mints admission tokens, the ratchet encrypts the body, you pad and split it into Sphinx packets, then an entry relay that knows you but not the recipient, a middle relay that knows neither end, and an exit relay that knows the recipient but not you, deliver to a recipient who cannot see the path. Constant-rate cover traffic loops back so silence and sending look alike."
    >
      <defs>
        <marker id="non-arrow-band" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--band-blue)" />
        </marker>
      </defs>

      {/* faint spokes - every role binds to the wire at the hub */}
      {PTS.map((p) => (
        <motion.line
          key={`spoke-${p.id}`}
          x1={CX}
          y1={CY}
          x2={p.x}
          y2={p.y}
          stroke="var(--band-blue)"
          strokeWidth={1}
          strokeDasharray="2 7"
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 0.12 } : undefined}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
      ))}

      {/* nonagon sides (the eight forward hops) - self-draw */}
      <motion.path
        d={BAND_D}
        fill="none"
        stroke="var(--band-blue)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.85}
        initial={reduce ? false : { pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.5, delay: 0.4, ease: EASE }}
      />
      {/* closing side - the codify feedback (amber, dashed) */}
      <motion.path
        d={CLOSE_D}
        fill="none"
        stroke="var(--verdict-escalate)"
        strokeWidth={1.5}
        strokeDasharray="5 6"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 1, delay: 1.5, ease: EASE }}
      />
      {/* directional arrowheads at each side midpoint */}
      {ARROWS.map((a, i) => (
        <motion.path
          key={`arr-${i}`}
          d="M -5 -4 L 5 0 L -5 4 Z"
          transform={`translate(${a.mx.toFixed(1)} ${a.my.toFixed(1)}) rotate(${a.ang.toFixed(1)})`}
          fill={a.feedback ? "var(--verdict-escalate)" : "var(--band-blue)"}
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.4, delay: 0.7 + i * 0.12, ease: EASE }}
        />
      ))}

      {/* trust marker on side 01 (directory → issuer) */}
      <motion.text
        x={(PTS[0].x + PTS[1].x) / 2 + 6}
        y={(PTS[0].y + PTS[1].y) / 2 - 14}
        textAnchor="middle"
        className="font-mono"
        fontSize={9.5}
        letterSpacing="0.12em"
        fill="var(--text-faint)"
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: 0.85 } : undefined}
        transition={{ duration: 0.5, delay: 1.4 }}
      >
        ⟂ trust boundary
      </motion.text>

      {/* centre - the wire */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: 0.9, ease: EASE }}
      >
        <circle cx={CX} cy={CY} r={104} fill="none" stroke="var(--band-blue)" strokeWidth={1} opacity={0.3} />
        <circle cx={CX} cy={CY - 36} r={4} fill="var(--band-blue)" />
        <text aria-hidden="true" x={CX} y={CY + 18} textAnchor="middle" className="font-mono" fontSize={34} letterSpacing="0.16em" fill="var(--band-blue)">
          WIRE
        </text>
      </motion.g>

      {/* role cards on the vertices */}
      {PTS.map((p) => (
        <AgentCard key={p.id} node={p} show={show} reduce={reduce} />
      ))}
    </svg>
  );
}

export default PathNonagon;
