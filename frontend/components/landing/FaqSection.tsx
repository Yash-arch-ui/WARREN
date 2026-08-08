"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Logomark from "./Logomark";

/**
 * FaqSection - the closing "Frequently Asked Questions" accordion (
 * FAQ clone, ). LIGHT section (data-section="light" → white bg,
 * ink text). Left: eyebrow + mark, a light-weight heading, a short blurb, and a
 * black "Launch Desk" pill. Right: a single-open accordion - clicking a question
 * rotates its +→- and slides a 1-2 line answer open. Scroll-reveal + reduced-
 * motion safe. Prop-less, self-contained, default export.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does Warren work?",
    a: "Your message is encrypted with a Double Ratchet, padded into fixed-size Sphinx packets, and routed through three relays. Each relay peels one encryption layer, waits a random moment, and forwards. The entry relay knows you but not who you are writing to; the exit knows the recipient but not you.",
  },
  {
    q: "Doesn't encryption already solve this?",
    a: "Encryption hides what you said. It does not hide that you said it, to whom, or how often - and that pattern is frequently enough on its own. Warren targets the pattern.",
  },
  {
    q: "Who is it for?",
    a: "People for whom the fact of a conversation is itself sensitive: sources talking to journalists, people organising under surveillance, anyone whose contact graph would put them at risk.",
  },
  {
    q: "What stops the network being flooded?",
    a: "Every packet carries a blind-signed admission token, minted in batches behind a proof of work. A relay verifies the signature and rejects a replayed token, but the blind signature means the issuer cannot link a token back to who was given it - so spam has a cost without identity having one.",
  },
  {
    q: "Can I run it against my own node?",
    a: "Yes - the desk talks to a local `warren serve` daemon over loopback; bundled fixtures stand in until you point it at one.",
  },
  {
    q: "What does it deliberately not do?",
    a: "It does not defeat a global adversary who can watch every link at once, and it does not claim to. It does not confirm delivery to the sender, because a receipt travelling back would recreate the link it removed. The threat model is written down rather than implied.",
  },
];

function PlusMinus({ open, reduce }: { open: boolean; reduce: boolean }) {
  return (
    <span className="relative ml-6 block h-4 w-4 shrink-0" aria-hidden="true">
      <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2" style={{ backgroundColor: "var(--text-primary)" }} />
      <motion.span
        className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2"
        style={{ backgroundColor: "var(--text-primary)", transformOrigin: "center" }}
        initial={false}
        animate={{ scaleY: open ? 0 : 1 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
      />
    </span>
  );
}

function FaqRow({
  item,
  index,
  open,
  onToggle,
  start,
  reduce,
}: {
  item: { q: string; a: string };
  index: number;
  open: boolean;
  onToggle: () => void;
  start: boolean;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.5, delay: 0.08 + index * 0.07, ease: EASE }}
      style={{ borderBottom: "1px solid var(--hairline)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span
          className="font-sans transition-opacity"
          style={{ fontSize: "clamp(15px, 1.5vw, 17px)", color: "var(--text-primary)", opacity: open ? 1 : 0.78 }}
        >
          {item.q}
        </span>
        <PlusMinus open={open} reduce={reduce} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.34, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <p
              className="max-w-[52ch] pb-6 pr-8 font-sans"
              style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)" }}
            >
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FaqSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const start = reduce || inView;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      ref={ref}
      data-section="light"
      aria-labelledby="faq-title"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto px-6 py-24 sm:py-28" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* eyebrow row */}
        <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
            FAQ
          </span>
          <Logomark size={18} />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-20">
          {/* left - heading + blurb + CTA */}
          <div>
            <motion.h2
              id="faq-title"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="font-sans"
              style={{
                fontSize: "clamp(32px, 4.2vw, 54px)",
                fontWeight: 350,
                lineHeight: 1.05,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
              }}
            >
              Frequently Asked Questions
            </motion.h2>
            <p className="mt-6 max-w-[34ch] font-sans" style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text-muted)" }}>
              What Warren hides, what it does not, and how a message actually moves.
            </p>
            <Link
              href="/how-it-works"
              className="mt-8 inline-flex items-center gap-2 font-sans text-[14px] font-medium transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: "var(--obsidian)", color: "var(--frost)", borderRadius: "var(--r-pill)", padding: "11px 22px" }}
            >
              See how it works
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* right - accordion */}
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {FAQS.map((item, i) => (
              <FaqRow
                key={item.q}
                item={item}
                index={i}
                open={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
                start={start}
                reduce={reduce}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
