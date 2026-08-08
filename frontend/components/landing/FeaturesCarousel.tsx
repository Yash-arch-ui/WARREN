"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import CaseRelayDiagram from "@/components/how-it-works/diagram/CaseRelayDiagram";
import Image from "next/image";
import ThreatLeaderboardArt from "./art/ThreatLeaderboardArt";
import Logomark from "@/components/landing/Logomark";
import { useIsMobile } from "./useIsMobile";

/**
 * FeaturesCarousel - the pinned "Our Features" horizontal-scroll carousel
 * A DARK section with a hard cut from the
 * light <ManifestoSection/> above it.
 *
 * Layout: an outer runway whose height equals the horizontal track's scroll
 * distance, so 1px of vertical scroll maps to ~1px of horizontal travel. A
 * sticky stage is PINNED for the duration; inside it a fixed section-anchor
 * header (hairline divider, "FEATURES" eyebrow + faint ◢ logomark, "Our
 * Features" heading, "← SCROLL" cue) sits over a horizontal TRACK of four large
 * dark cards. As the user scrolls down, a scrubbed GSAP timeline translates the
 * track on x from 0 → -(trackScrollWidth - viewportWidth), so cards march
 * right→left.
 *
 * The GSAP setup MATCHES <HeroScroll/>: gsap.registerPlugin(ScrollTrigger);
 * useLayoutEffect + gsap.context scoped to the root ref; a
 * window.matchMedia('(prefers-reduced-motion: reduce)') branch that skips the
 * pin; return ctx.revert() cleanup.
 *
 * Reduced-motion / no-pin fallback: the track renders as a NATIVE
 * overflow-x-auto scroller (no pinning) with the same cards - still usable.
 *
 * Prop-less, self-contained, default export.
 */

type Card = {
  no: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  art: React.ReactNode;
  cta?: { label: string; href: string };
  /** When true the art fills the whole card (self-contained panel, e.g. the
   *  centred-badge leaderboard) instead of the text-left / laptop-right layout. */
  full?: boolean;
};

/* ── bare line icons (no bordered box) - match the 9-correct top-left mark ── */
const il = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function TraceIc() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...il}>
      <path d="M3 13h3l2.5-7 4 14 2.5-7H21" />
    </svg>
  );
}
function AuditIc() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...il}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </svg>
  );
}
function ContestIc() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...il}>
      <path d="M14.5 4h5v5M19.5 4 12 11.5M9.5 20h-5v-5M4.5 20 12 12.5" />
    </svg>
  );
}
function CodifyIc() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...il}>
      <path d="M12 2l8.5 5v10L12 22 3.5 17V7z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * LaptopFrame - a reusable angled MacBook-style device frame (bezel + base)
 * wrapping a card's art region. The screen is tilted slightly to read as a real
 * device rising into the card. The art is a
 * real, fully-drawn product schematic (no video / play affordance - these are
 * static screens, not clips).
 */
function LaptopFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative"
        style={{
          width: "112%",
          maxWidth: 760,
          transform: "perspective(1600px) rotateY(-12deg) rotateX(3deg)",
          transformOrigin: "left center",
        }}
      >
        {/* Lid - bezel + screen */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 14,
            padding: 10,
            backgroundColor: "#0b0b0c",
            border: "1px solid var(--border-default)",
            boxShadow:
              "0 40px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Camera notch */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[5px] z-10 inline-block rounded-full"
            style={{
              width: 5,
              height: 5,
              transform: "translateX(-50%)",
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          />
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 7,
              backgroundColor: "var(--obsidian)",
              border: "1px solid var(--hairline)",
              aspectRatio: "16 / 10.2",
            }}
          >
            <div className="absolute inset-0">{children}</div>
          </div>
        </div>
        {/* Base / hinge - a thin slab beneath the lid */}
        <div
          aria-hidden="true"
          className="relative mx-auto"
          style={{
            width: "104%",
            left: "-2%",
            height: 12,
            marginTop: 3,
            borderRadius: "0 0 10px 10px",
            background:
              "linear-gradient(180deg, #141416 0%, #0a0a0b 60%, #050505 100%)",
            border: "1px solid var(--border-subtle)",
            borderTop: "none",
            boxShadow: "0 18px 30px rgba(0,0,0,0.5)",
          }}
        >
          {/* hinge indent */}
          <span
            className="absolute left-1/2 top-0 inline-block rounded-b"
            style={{
              width: "16%",
              height: 4,
              transform: "translateX(-50%)",
              backgroundColor: "#000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Inline art for card 3 - two dossier mini-cards across the two model tiers. */
function CrossModelArt() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-4 p-6 sm:gap-6 sm:p-10">
      {/* Prosecution - frontier (gold) */}
      <DossierCard
        badge="▸ frontier"
        badgeColor="var(--tier-frontier)"
        role="Prosecution"
        deskColor="var(--desk-rnd)"
        quote="Layered orders at 09:31:04 seeded a phantom book; the cancel-burst at 09:31:06 confirms intent to mislead."
      />
      {/* swords */}
      <span
        aria-hidden="true"
        className="shrink-0 font-sans text-[20px] leading-none text-[var(--text-faint)] sm:text-[26px]"
      >
        ⚔
      </span>
      {/* Defense - open (gray) */}
      <DossierCard
        badge="▸ open"
        badgeColor="var(--tier-open)"
        role="Defense"
        deskColor="var(--desk-surv)"
        quote="Cancels are within venue latency norms; absent a fill-rate anomaly the pattern is consistent with routine quoting."
      />
    </div>
  );
}

function DossierCard({
  badge,
  badgeColor,
  role,
  deskColor,
  quote,
}: {
  badge: string;
  badgeColor: string;
  role: string;
  deskColor: string;
  quote: string;
}) {
  return (
    <div
      className="flex h-full max-w-[320px] flex-1 flex-col rounded-[var(--r-card)] border p-5 sm:p-6"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[11px] font-medium"
          style={{ color: badgeColor }}
        >
          {badge}
        </span>
        <span
          aria-hidden="true"
          className="inline-block"
          style={{
            width: 10,
            height: 10,
            backgroundColor: deskColor,
            borderRadius: 2,
            opacity: 0.85,
          }}
        />
      </div>
      <span
        className="mt-4 font-sans text-[12px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
      >
        {role}
      </span>
      <p
        className="mt-3 font-mono text-[13px] leading-relaxed text-[var(--text-body)]"
        style={{ flex: 1 }}
      >
        “{quote}”
      </p>
    </div>
  );
}

/** Card 01 art - the real CaseRelay schematic (the native Fig-2 case relay we
 *  ship on /how-it-works), rendered fully-drawn as a static "screen". */
function RelayArt() {
  return (
    <div
      data-section="dark"
      className="flex h-full w-full items-center justify-center bg-[var(--obsidian)] px-5 py-4 sm:px-7"
    >
      <CaseRelayDiagram staticMode className="w-full" />
    </div>
  );
}

/** Card 02 art - a screenshot of the real #audit hash-chain section (stair.png),
 *  shown as the card's device "screen". */
function StairArt() {
  return (
    <div className="relative h-full w-full bg-[var(--obsidian)]">
      <Image
        src="/stair.png"
        alt="Hash-chained audit ledger - nine blocks, each sealed with a fingerprint of the one before"
        fill
        sizes="(max-width: 768px) 86vw, 40vw"
        className="object-cover object-left-top"
      />
    </div>
  );
}

const CARDS: Card[] = [
  {
    no: "01",
    icon: <TraceIc />,
    title: "Live Trace Analytics",
    body: "Every stage streams in real time - the topology, the token spends, the packets going out, the blue in-flight relays.",
    art: <RelayArt />,
    cta: { label: "Open the Live Desk", href: "/desk" },
  },
  {
    no: "02",
    icon: <AuditIc />,
    title: "Verified & Audited Lineage",
    body: "Every decision sealed in a hash-chained ledger. verify_chain ✓ - tamper-evident, audit-ready.",
    art: <StairArt />,
    cta: { label: "See the audit ledger", href: "/#audit" },
  },
  {
    no: "03",
    icon: <ContestIc />,
    title: "Cross-Model Contest",
    body: "Prosecution (frontier) ⚔ Defense (open) argue the same evidence across two model tiers.",
    art: <CrossModelArt />,
    cta: { label: "See the model lineup", href: "/how-it-works#different" },
  },
];

/**
 * A single wide, landscape feature card - matches the
 * layout: a deep-black gradient panel; a BARE line icon top-left; the title,
 * body and a frosted translucent CTA pill anchored to the LOWER-left; and an
 * angled <LaptopFrame/> on the right that BLEEDS off the card's right edge (the
 * card clips it with overflow-hidden), showing a real, fully-drawn schematic.
 *
 * Below md the card stacks: text block, then the laptop beneath it.
 */
function FeatureCard({ card }: { card: Card }) {
  // Full-bleed variant (the centred-badge leaderboard): the self-contained art
  // panel IS the card, so its ShieldEmblem sits dead-centre (10-correct).
  if (card.full) {
    return (
      <div className="feat-card relative w-[86vw] md:w-[min(60vw,707px)] shrink-0 overflow-hidden rounded-[var(--r-card)] md:h-[clamp(360px,54vh,540px)]">
        {card.art}
      </div>
    );
  }

  return (
    <article
      className="feat-card relative flex w-[86vw] md:w-[min(60vw,707px)] shrink-0 flex-col overflow-hidden rounded-[var(--r-card)] border md:grid md:h-[clamp(360px,54vh,540px)] md:[grid-template-columns:42%_58%]"
      style={{
        background:
          "linear-gradient(100deg, #060708 0%, #0a0b0e 46%, #0f1218 100%)",
        borderColor: "var(--border-subtle)",
        boxShadow: "0 40px 110px rgba(0,0,0,0.55)",
      }}
    >
      {/* cool screen-glow bleeding from the laptop on the right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 80% at 80% 50%, rgba(120,140,180,0.12), transparent 68%)",
        }}
      />

      {/* LEFT - text column. Bare icon top-left; title + body + frosted pill
          anchored to the lower-left. */}
      <div className="relative z-10 flex flex-col p-8 sm:p-10 md:h-full">
        <span aria-hidden="true" className="text-[var(--text-primary)]">
          {card.icon}
        </span>

        <div className="mt-auto pt-10">
          <h3
            className="font-sans"
            style={{
              fontSize: "clamp(26px, 2.8vw, 38px)",
              fontWeight: 300,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
              color: "var(--text-primary)",
            }}
          >
            {card.title}
          </h3>
          <p
            className="mt-3.5 max-w-[34ch] font-sans"
            style={{
              fontSize: "clamp(13px, 1.4vw, 15px)",
              lineHeight: 1.55,
              color: "var(--text-muted)",
            }}
          >
            {card.body}
          </p>

          {card.cta ? (
            <Link
              href={card.cta.href}
              className="mt-7 inline-flex items-center gap-2 self-start rounded-[var(--r-pill)] px-5 py-2.5 font-sans text-[13px] font-medium transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.24)",
                color: "var(--frost)",
                backdropFilter: "blur(4px)",
              }}
            >
              {card.cta.label}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>

      {/* RIGHT (md+) - laptop bleeding off the right edge, clipped by the card. */}
      <div className="relative hidden md:block">
        <div
          className="absolute top-1/2 left-[7%] w-[132%] -translate-y-1/2"
        >
          <LaptopFrame>{card.art}</LaptopFrame>
        </div>
      </div>

      {/* Laptop (mobile stacked) - normal sizing beneath the text. */}
      <div className="relative z-10 px-8 pb-9 md:hidden">
        <LaptopFrame>{card.art}</LaptopFrame>
      </div>
    </article>
  );
}

function FeaturesHeader() {
  // data-section="light" remaps the monochrome tokens to their light-theme
  // values, so the eyebrow / heading / hairline / logomark read DARK on the
  // white section (the cards below stay dark - they sit outside this wrapper).
  return (
    <div data-section="light" className="px-6 pt-16 sm:px-10 pb-8">
      <div
        className="flex items-center justify-between pt-4"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Features
        </span>
        <span aria-hidden="true" style={{ opacity: 0.55 }}>
          <Logomark size={16} className="text-[var(--text-faint)]" />
        </span>
      </div>
      <div className="mt-14 flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-16">
        <h2
          className="font-sans shrink-0"
          style={{
            fontSize: "clamp(34px, 5vw, 56px)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Our Features
        </h2>
        <div className="flex flex-col items-start text-left">
          <p
            className="font-sans max-w-[42ch]"
            style={{
              fontSize: "clamp(15px, 1.6vw, 18px)",
              fontWeight: 400,
              lineHeight: 1.45,
              color: "var(--text-muted)",
            }}
          >
            Warren treats metadata as the thing worth protecting. Every message is padded to one size, routed through three relays that each know only their immediate neighbours, and delayed at random - so the shape of your traffic stops describing your life.
          </p>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)] sm:inline mt-6">
            ← Scroll
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesCarousel() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // null = undecided (SSR/first paint), true/false once measured on the client
  const [reduced, setReduced] = useState<boolean | null>(null);
  // Below md the pinned horizontal scroll becomes a native swipe stack.
  const isMobile = useIsMobile();
  // Runway height needed so vertical scroll ≈ horizontal track travel.
  const [runway, setRunway] = useState<number | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion OR a small viewport: do not build the pinned timeline at
    // all (the native horizontal scroller renders instead).
    if (mq.matches || window.matchMedia("(max-width: 767px)").matches) return;

    // Lazy-load gsap off the landing critical path: dynamically import it (+the
    // ScrollTrigger plugin) inside the effect, then build the SAME pinned
    // context a tick later - fine for a scroll-triggered animation.
    let cancelled = false;
    let ctx: gsap.Context | undefined;

    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (cancelled) return;

      ctx = gsap.context((self) => {
        const q = self.selector!;
        const stage = q(".feat-stage")[0] as HTMLElement;
        const track = trackRef.current;
        if (!stage || !track) return;

        // The distance the track must travel = its overflow beyond the viewport.
        const distance = () =>
          Math.max(0, track.scrollWidth - window.innerWidth);

        // Size the runway so 1px vertical ≈ 1px horizontal travel (+1 viewport so
        // the last card holds on-screen before the pin releases).
        const setRunwayHeight = () =>
          setRunway(distance() + window.innerHeight);
        setRunwayHeight();

        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: true,
            pin: stage,
            pinSpacing: false,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        const onResize = () => setRunwayHeight();
        window.addEventListener("resize", onResize);
        ScrollTrigger.refresh();

        // Clean up the resize listener alongside ctx.revert().
        self.add(() => window.removeEventListener("resize", onResize));
      }, rootRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // Re-run when the mobile boundary is crossed so the pin builds/tears down.
  }, [isMobile]);

  // ── No-pin fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduced === true || isMobile === true) {
    return (
      <section
        aria-label="Our Features"
        style={{
          backgroundColor: "#ffffff",
          color: "#14161c",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>
        {/* Native horizontal scroller - same cards, no pinning. Cards auto-size
            their height on mobile (stacked content) and take the cinematic tall
            frame from sm+ (side-by-side grid). */}
        <div
          className="flex gap-6 overflow-x-auto px-6 pb-16 pt-12 sm:px-10"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {CARDS.map((card) => (
            <div key={card.no} style={{ scrollSnapAlign: "start" }}>
              <FeatureCard card={card} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── Motion (and pre-measure) render ─────────────────────────────────────
  return (
    <div
      ref={rootRef}
      className="relative"
      style={{
        height: runway != null ? `${runway}px` : "300vh",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Sticky stage - pinned for the duration of the horizontal scroll. */}
      <div
        className="feat-stage sticky top-0 flex h-screen w-full flex-col overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          color: "#14161c",
        }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>

        {/* Horizontal track - translated on x by the scrubbed timeline. */}
        <div className="relative flex-1">
          <div
            ref={trackRef}
            className="absolute left-0 top-0 flex h-full items-center gap-6 pr-[8vw] will-change-transform sm:gap-8"
            style={{
              // Inset the first card so it aligns with the "Our Features"
              // heading (the centered max-width container), not the viewport edge.
              paddingLeft:
                "max(calc((100vw - var(--maxw-content)) / 2 + 2.5rem), 2.5rem)",
            }}
          >
            {CARDS.map((card) => (
              <div key={card.no}>
                <FeatureCard card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
