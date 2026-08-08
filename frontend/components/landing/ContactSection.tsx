"use client";

import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * ContactSection - the "Contact Warren" block (contact
 * clone, ). LIGHT section (data-section="light"). A shield-shaped
 * badge card (rounded top, pointed bottom - the Warren emblem motif) holds a heading,
 * two lines of copy, and a Name / Phone / Email / Message form with a black
 * full-width Submit pill. Submissions POST to NEXT_PUBLIC_CONTACT_ENDPOINT when
 * set (e.g. a Formspree/Getform URL); without it the form is demo-only (nothing
 * sent). Scroll-reveal + reduced-motion safe. Default export.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** The shield/badge frame: rounded top corners, a shallow centre point at the
 *  bottom. Drawn as a stretched SVG path with a non-scaling 1px stroke so it can
 *  size to whatever the form needs without distorting the hairline. */
function ShieldFrame() {
  // viewBox is near-square (the card's natural ratio) so the rounded top corners
  // barely distort under preserveAspectRatio="none".
  const PATH =
    "M30 1 L610 1 Q640 1 640 30 L640 596 L320 638 L0 596 L0 30 Q0 1 30 1 Z";
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 640 640"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ao-contact-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcfcfc" />
          <stop offset="1" stopColor="#f3f3f3" />
        </linearGradient>
      </defs>
      <path d={PATH} fill="url(#ao-contact-face)" />
      <path
        d={PATH}
        fill="none"
        style={{ stroke: "var(--border-default)" }}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const FIELD =
  "w-full rounded-[var(--r-pill)] px-5 font-sans text-[14px] outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--text-primary)]";

export default function ContactSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const start = reduce || inView;
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where submissions go: set NEXT_PUBLIC_CONTACT_ENDPOINT to a form endpoint
  // (e.g. a free Formspree/Getform/webhook URL) and the form POSTs there so you
  // actually receive messages. Without it the form is demo-only (nothing sent).
  const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!ENDPOINT) {
      setSent(true); // demo mode - no backend configured
      return;
    }
    try {
      setSending(true);
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSent(true);
    } catch {
      setError("Couldn't send right now - please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      ref={ref}
      id="contact"
      data-section="light"
      aria-labelledby="contact-title"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto px-6 py-20 sm:py-24" style={{ maxWidth: "var(--maxw-content)" }}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 26 }}
          animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative mx-auto"
          style={{ maxWidth: 620 }}
        >
          <ShieldFrame />

          <div className="relative z-10 px-7 pb-12 pt-11 sm:px-14 sm:pb-14 sm:pt-12">
            <h2
              id="contact-title"
              className="text-center font-sans"
              style={{
                fontSize: "clamp(30px, 4vw, 50px)",
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Contact Warren
            </h2>
            <p className="mx-auto mt-4 max-w-[42ch] text-center font-sans" style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text-muted)" }}>
              Questions about the threat model, running a relay, or the protocol?
            </p>
            <p className="mx-auto mt-2.5 max-w-[34ch] text-center font-sans" style={{ fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, color: "var(--text-body)" }}>
              Leave your details and our team will get back to you shortly.
            </p>

            {sent ? (
              <div
                className="mt-10 flex flex-col items-center rounded-[18px] px-6 py-10 text-center"
                style={{ backgroundColor: "var(--bg-card-2)", border: "1px solid var(--border-subtle)" }}
              >
                <span className="font-sans" style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
                  Thanks - we&apos;ll be in touch.
                </span>
                <span className="mt-2 font-sans" style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                  Your message is queued. The desk will reach out shortly.
                </span>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-5 font-sans text-[13px] underline-offset-4 hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form className="mt-7 flex flex-col gap-2.5" onSubmit={handleSubmit}>
                <input
                  required
                  name="name"
                  placeholder="Your Name"
                  className={FIELD}
                  style={{ height: 46, backgroundColor: "var(--bg-card-2)", color: "var(--text-primary)" }}
                />
                <input
                  name="phone"
                  placeholder="Phone"
                  inputMode="tel"
                  className={FIELD}
                  style={{ height: 46, backgroundColor: "var(--bg-card-2)", color: "var(--text-primary)" }}
                />
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="Email"
                  className={FIELD}
                  style={{ height: 46, backgroundColor: "var(--bg-card-2)", color: "var(--text-primary)" }}
                />
                <textarea
                  name="message"
                  placeholder="Message"
                  rows={3}
                  className="w-full resize-y rounded-[20px] px-5 py-3.5 font-sans text-[14px] outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--text-primary)]"
                  style={{ backgroundColor: "var(--bg-card-2)", color: "var(--text-primary)" }}
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-1 w-full font-sans text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{
                    height: 50,
                    backgroundColor: "var(--obsidian)",
                    color: "var(--frost)",
                    borderRadius: "var(--r-pill)",
                  }}
                >
                  {sending ? "Sending…" : "Submit"}
                </button>
                {error && (
                  <p className="mt-1 text-center font-sans text-[12.5px]" style={{ color: "var(--verdict-flag)" }}>
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
