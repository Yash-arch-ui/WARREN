"use client";

/**
 * §2 "The whole picture" - the centerpiece overview. Mono eyebrow + two-tone
 * .font-display headline, the paste-ready body, a full-width dark stage embedding
 * the native ArchitectureDiagram (D1), then a sender/mix/recipient split
 * (editorial cards, not a second diagram) with the structural-wall note
 * between them. Sender side mints tokens (tone rnd); recipient side lists the
 * relay hops (tone surv); the K-of-N directory is the sole authority on which
 * relays are real. band-blue stays sacred (only the hop-crossing note carries it).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import ArchitectureDiagram from "@/components/how-it-works/diagram/ArchitectureDiagram";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const HOPS = ["entry", "middle", "exit"] as const;

const COUNT_MS = 1400;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Small RAF count-up for a desk badge (KeyFigures idiom). Reduced-motion or
 * out-of-view → renders the final integer immediately. */
function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(reduce ? to : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || !inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setValue(Math.round(to * EASE_OUT(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(to);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, reduce, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}

/** A run of plain words that fill gray→ink staggered as they enter view
 * (a discrete, dependency-free echo of ManifestoSection's scroll fill - used
 * here so it composes with the inline <strong/> emphasis). Reduced-motion →
 * body color immediately. */
function FillRun({ text, baseDelay }: { text: string; baseDelay: number }) {
  const reduce = useReducedMotion() ?? false;
  const words = text.split(" ");
  if (reduce) return <>{text}</>;
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ color: "var(--text-faint)" }}
          whileInView={{ color: "var(--text-body)" }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ delay: baseDelay + i * 0.012, duration: 0.4, ease: EASE }}
        >
          {w}{" "}
        </motion.span>
      ))}
    </>
  );
}

/** Card-sized entrance (larger offset than the shared Reveal) with an optional
 * hover lift. Reduced-motion → final state, no transform, no hover. */
function LiftCard({
  children,
  delay,
  hover = true,
}: {
  children: ReactNode;
  delay: number;
  hover?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  if (reduce) return <div className="h-full">{children}</div>;
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 48, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={hover ? { y: -6 } : undefined}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.7, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** One staggered relay-hop row. Reduced-motion → static row. */
function HopRow({ name, index }: { name: string; index: number }) {
  const reduce = useReducedMotion() ?? false;
  const inner = (
    <>
      <span
        className="h-4 w-[3px] shrink-0 rounded-full"
        style={{ background: "var(--desk-surv)" }}
        aria-hidden
      />
      <span className="font-mono text-[12px] text-[color:var(--text-primary)]">
        {name}
      </span>
    </>
  );
  const cls =
    "flex items-center gap-2.5 rounded-lg border border-[color:var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5";
  if (reduce) return <li className={cls}>{inner}</li>;
  return (
    <motion.li
      className={cls}
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: 0.3 + index * 0.07, duration: 0.5, ease: EASE }}
    >
      {inner}
    </motion.li>
  );
}

export function HiwOverview() {
  return (
    <section
      id="overview"
      data-hiw="overview"
      className="relative px-6 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[var(--maxw-content)]">
        {/* heading idiom - mono eyebrow + two-tone display headline */}
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            Overview
          </p>
        </Reveal>
        <h2 className="sr-only">The whole picture</h2>
        <MaskLines
          className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl"
          lineClassName=""
          delay={0.05}
          lines={[
            <span key="a" className="text-[color:var(--text-primary)]">
              The whole picture
            </span>,
            <span key="b" className="text-[color:var(--text-faint)]">
              - a sender, a mix, a recipient.
            </span>,
          ]}
        />

        {/* paste-ready body */}
        <Reveal delay={0.1} className="mt-8 max-w-2xl space-y-5 text-[15px] leading-relaxed text-[color:var(--text-body)]">
          <p>
            <FillRun
              baseDelay={0}
              text="The system is built from three trust zones that never share a full view. The"
            />
            <strong className="font-semibold text-[color:var(--text-primary)]">sender</strong>{" "}
            <FillRun baseDelay={0.3} text="chunks the message into Sphinx packets and mints one admission token per packet. The" />
            <strong className="font-semibold text-[color:var(--text-primary)]">mix</strong>{" "}
            <FillRun
              baseDelay={0.55}
              text="is three independent relays - entry, middle, exit - each peeling one Sphinx layer and forwarding blind. The relay list itself is only trusted once a K-of-N directory quorum has attested it."
            />
          </p>
          <p>
            <FillRun
              baseDelay={0}
              text="A packet crosses a structural wall at every hop: each relay learns only the next address, never the full path. The recipient's ratchet decrypts and reassembles the chunks, and the sender never learns whether delivery succeeded - a receipt traveling back would be exactly the correlation the design exists to prevent."
            />
          </p>
        </Reveal>
      </div>

      {/* full-width dark stage - the native architecture diagram (D1) */}
      <div className="mt-14 sm:mt-20">
        <Reveal>
          <div
            data-section="dark"
            className="ops-grain relative overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--obsidian)] px-4 py-8 sm:px-10 sm:py-12"
          >
            <div className="ops-grid ops-grid-fade absolute inset-0" aria-hidden />
            <div className="relative mx-auto max-w-[1200px]">
              <ArchitectureDiagram />
            </div>
          </div>
        </Reveal>
      </div>

      {/* rebuilt two-desks split (editorial cards) */}
      <div className="mx-auto mt-14 max-w-[var(--maxw-content)] sm:mt-20">
        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* sender side - compose & mint */}
          <LiftCard delay={0}>
            <article className="h-full rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] p-7">
              <header className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--desk-rnd)]">
                    Sender side · local
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-[color:var(--text-primary)]">
                    Compose &amp; mint
                  </h3>
                </div>
                <span className="shrink-0 rounded-full border border-[color:var(--desk-rnd)] px-3 py-1 font-mono text-[11px] text-[color:var(--desk-rnd)]">
                  <CountUp to={1} suffix=" token / packet" />
                </span>
              </header>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-body)]">
                The sender chunks the message into Sphinx packets and mints one
                admission token per packet from a PoW-gated blind-signature
                batch - the token proves nothing about who requested it.
              </p>
              <ul className="mt-5 space-y-2">
                <li className="flex items-center gap-3 rounded-lg border border-[color:var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3">
                  <span
                    className="h-6 w-[3px] shrink-0 rounded-full"
                    style={{ background: "var(--desk-rnd)" }}
                    aria-hidden
                  />
                  <span className="font-mono text-[13px] text-[color:var(--text-primary)]">
                    Issuer
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-[color:var(--text-muted)]">
                    blind-signs the token batch
                  </span>
                </li>
              </ul>
            </article>
          </LiftCard>

          {/* the wall - Sphinx layering across each hop */}
          <LiftCard delay={0.1} hover={false}>
            <div className="flex h-full min-w-[180px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[color:var(--border-default)] bg-[var(--bg-inset)] px-6 py-7 text-center lg:max-w-[220px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                ⟂ structural wall
              </p>
              <div className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)]">
                Sphinx layering
              </div>
              <p className="text-xs leading-relaxed text-[color:var(--text-body)]">
                Only the next hop&apos;s address crosses each boundary - no
                relay ever learns the full path. Mix delay and cover traffic
                scramble timing and volume before an observer can correlate
                anything.
              </p>
              <p className="font-mono text-[11px] text-[color:var(--band-blue)]">
                one hop only · Sphinx-wrapped
              </p>
            </div>
          </LiftCard>

          {/* recipient side - the relay path */}
          <LiftCard delay={0.18}>
            <article className="h-full rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-card)] p-7">
              <header className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--desk-surv)]">
                    Recipient side · attested
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-[color:var(--text-primary)]">
                    The relay path
                  </h3>
                </div>
                <span className="shrink-0 rounded-full border border-[color:var(--desk-surv)] px-3 py-1 font-mono text-[11px] text-[color:var(--desk-surv)]">
                  <CountUp to={3} suffix=" hops" />
                </span>
              </header>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-body)]">
                Three relays carry the packet to delivery - plus a K-of-N
                directory that is not a relay at all, the sole authority on
                which relays are real.
              </p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {HOPS.map((name, i) => (
                  <HopRow key={name} name={name} index={i} />
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-[color:var(--tier-frontier)] bg-[var(--bg-inset)] px-4 py-3">
                <span
                  className="h-6 w-[3px] shrink-0 rounded-full"
                  style={{ background: "var(--tier-frontier)" }}
                  aria-hidden
                />
                <span className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)]">
                  Directory
                </span>
                <span className="ml-auto font-mono text-[11px] text-[color:var(--tier-frontier)]">
                  K-of-N attested · no single key
                </span>
              </div>
            </article>
          </LiftCard>
        </div>
      </div>
    </section>
  );
}

export default HiwOverview;
