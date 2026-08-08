"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Logomark from "./Logomark";
import { RadarSearch, DetectRing, AuditShield, BandScan } from "./art/AboutCardArt";

/**
 * MoreAboutSection - the closing "MORE ABOUT US" bento grid (
 * "Features" grid clone, ). A 2×2 grid of numbered cards, each a
 * two-tone heading + copy + a bespoke monochrome visual that draws in. The whole
 * grid staggers in on scroll; cards lift on hover. prefers-reduced-motion / SSR
 * render the final state immediately. Prop-less, self-contained, default export.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Card = {
  no: string;
  title: [string, string]; // [ink line, faint line]
  body?: string;
  steps?: string[];
  /** "tall" cards (01,02) carry more content; visual placement differs. */
  Art: (p: { start: boolean; reduce: boolean }) => React.ReactElement;
  artClass: string; // positioning of the visual layer within the card
};

const CARDS: Card[] = [
  {
    no: "01",
    title: ["Three hops,", "no full view"],
    body: "Each relay peels exactly one layer of encryption. The entry sees you and the next hop. The exit sees the recipient and the previous hop. Neither can name the other end.",
    Art: RadarSearch,
    artClass: "inset-0",
  },
  {
    no: "02",
    title: ["A messenger that", "hides the pattern"],
    steps: ["Ratchet-encrypt the body", "Pad to a fixed 1024 B", "Spend an admission token", "Three hops, random delays"],
    Art: DetectRing,
    artClass: "right-[-28px] top-1/2 h-[260px] w-[260px] -translate-y-1/2",
  },
  {
    no: "03",
    title: ["Signed", "relay directory"],
    body: "A relay list is only trusted when K of N independent signers have attested it. Otherwise whoever hands you the list chooses your entire path.",
    Art: AuditShield,
    artClass: "inset-0",
  },
  {
    no: "04",
    title: ["Constant-rate", "cover traffic"],
    body: "Relays emit dummy packets shaped exactly like real ones. To anyone counting, a silent node and a busy node look the same.",
    Art: BandScan,
    artClass: "inset-0",
  },
];

function BentoCard({ card, index, start, reduce }: { card: Card; index: number; start: boolean; reduce: boolean }) {
  const { Art } = card;
  const isWide = card.no === "02";
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
      transition={{ duration: 0.6, delay: 0.08 + index * 0.1, ease: EASE }}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[20px] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-shadow duration-300 hover:shadow-[0_26px_70px_-12px_rgba(0,0,0,0.6)] sm:min-h-[330px] sm:p-9"
      style={{ backgroundColor: "var(--bg-inset)" }}
    >
      {/* border ring - brightens on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-[20px] border border-[#1c1d1f] transition-colors duration-300 group-hover:border-white/20" />
      {/* radial glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.08), transparent 62%)" }}
      />
      {/* top accent line on hover */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
      />
      {/* animated visual layer (full-bleed background; brightens + scales on hover) */}
      <div className={`pointer-events-none absolute ${card.artClass} opacity-80 transition-[transform,opacity] duration-500 group-hover:scale-[1.05] group-hover:opacity-100`}>
        <Art start={start} reduce={reduce} />
      </div>

      {/* number */}
      <span className="absolute right-7 top-7 font-mono text-[12px] tracking-widest sm:right-9 sm:top-9" style={{ color: "var(--text-faint)" }}>
        {card.no}
      </span>

      {/* content (top-stacked; visuals own the lower / corner space) */}
      <div className="relative z-10 flex h-full flex-col">
        <h3
          className="font-sans"
          style={{
            fontSize: "clamp(22px, 2.2vw, 30px)",
            fontWeight: 380,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            maxWidth: isWide ? "60%" : "85%",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>{card.title[0]}</span>{" "}
          <span style={{ color: "var(--text-faint)" }}>{card.title[1]}</span>
        </h3>

        {card.body && (
          <p
            className="mt-5 max-w-[44ch] font-sans"
            style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)" }}
          >
            {card.body}
          </p>
        )}

        {card.steps && (
          <ul className="mt-7 flex max-w-[56%] flex-col gap-3">
            {card.steps.map((s, i) => (
              <motion.li
                key={s}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={start ? { opacity: 1, x: 0 } : reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: 0.45, delay: reduce ? 0 : 0.4 + i * 0.09, ease: EASE }}
                className="flex items-center gap-2.5 font-sans"
                style={{ fontSize: 13.5, color: "var(--text-muted)" }}
              >
                <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ backgroundColor: "var(--text-faint)" }} />
                {s}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

export default function MoreAboutSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const start = reduce || inView;

  return (
    <section
      ref={ref}
      aria-labelledby="more-about-title"
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: "var(--obsidian)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto px-6 py-24 sm:py-28" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* header row */}
        <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <span id="more-about-title" className="font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--text-faint)" }}>
            More about us
          </span>
          <Logomark size={18} />
        </div>

        {/* bento grid */}
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 sm:mt-14">
          {CARDS.map((c, i) => (
            <BentoCard key={c.no} card={c} index={i} start={start} reduce={reduce} />
          ))}
        </div>
      </div>
    </section>
  );
}
