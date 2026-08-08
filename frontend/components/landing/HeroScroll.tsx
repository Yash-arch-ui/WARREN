"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import LandingNav from "./LandingNav";
import HeroSplitArt from "./HeroSplitArt";
import Logomark from "@/components/landing/Logomark";
import { useIsMobile } from "./useIsMobile";

/**
 * HeroScroll - the pinned "device-zoom" scrollytelling hero (
 * ). A single PINNED sticky stage drives a scrubbed GSAP timeline
 * across four reference frames:
 *
 *   FRAME 1 (light): hero headline + a laptop peeking from the bottom edge, a
 *     "We use cookies" consent card overlaid low, a bouncing down-arrow cue.
 *   FRAME 1→2: cookie card dismisses, hero text fades up & out, device rises.
 *   FRAME 2 (light→dark): device scales toward filling the viewport, bg crossfades
 *     white→obsidian, a circular ▶ play button fades in/out at center.
 *   FRAME 3 (dark): the bezel fades to 0, CommandCenterArt fills the viewport.
 *   FRAME 4 (dark→light): the dashboard scales ~1.05, translates up + fades out,
 *     handing off to <KeyFigures/> below.
 *
 * Reduced-motion: the pin/scrub is skipped entirely; a simple stacked static
 * layout (hero, then a framed CommandCenterArt) is rendered instead.
 *
 * Prop-less, self-contained, default export. Renders <LandingNav/> fixed over
 * everything (z above frames, below the Preloader at z-[100]).
 */
export default function HeroScroll() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // null = undecided (SSR/first paint), true/false once measured on the client
  const [reduced, setReduced] = useState<boolean | null>(null);
  // Below the md breakpoint the pin + 3D device-zoom scroll-jack and overflow,
  // so we take the same static path as reduced-motion.
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion OR a small viewport: do not build the pinned timeline at
    // all (the static stacked hero renders instead).
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
      const stage = q(".hero-stage")[0] as HTMLElement;
      const device = q(".hero-device")[0] as HTMLElement;
      const bezel = q(".hero-bezel");
      const keys = q(".hero-keys");
      const heroText = q(".hero-text");
      const cookie = q(".hero-cookie");
      const arrow = q(".hero-arrow");
      const play = q(".hero-play");

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: stage,
          pinSpacing: false,
          anticipatePin: 1,
        },
      });

      // ── initial states (FRAME 1) ──
      // The device is tilted back in 3D (rotateX) so screen + bezel both read as
      // a real laptop lid. rotateX animates → 0 (upright) as the scroll zooms in.
      gsap.set(stage, { backgroundColor: "#ffffff" });
      gsap.set(device, {
        yPercent: 46,
        scale: 0.8,
        rotateX: 18,
        transformOrigin: "50% 82%",
        transformPerspective: 1600,
      });
      gsap.set(bezel, { opacity: 1, scale: 1 });
      gsap.set(keys, { opacity: 1, yPercent: 0 });
      gsap.set(heroText, { opacity: 1, y: 0 });
      gsap.set(cookie, { opacity: 1, y: 0 });
      gsap.set(play, { opacity: 0, scale: 0.7 });

      // Reference choreography = an Apple-style "dive INTO the screen": the app
      // flattens to head-on EARLY and grows OUT of the laptop to full-bleed while
      // the device frame (keyboard, bezel) sweeps / expands away - NOT a uniform
      // scale-up with a late bezel fade.

      // FRAME 1 hold: 0.00-0.14 - tilted laptop peeking, headline + cookie.
      tl.to({}, { duration: 0.14 });

      // 0.14-0.30 - RISE + FLATTEN: headline + cookie clear; the laptop rises to
      // centre and UN-TILTS fully head-on (rotateX → 0) by 0.30, the app filling
      // the bezel. (Reference: the UI is flat & head-on by ~30%.)
      tl.to(cookie, { opacity: 0, y: 24, duration: 0.1 }, 0.14);
      tl.to(heroText, { opacity: 0, y: -44, duration: 0.12 }, 0.14);
      tl.to(arrow, { opacity: 0, duration: 0.08 }, 0.14);
      tl.to(
        device,
        { yPercent: 0, scale: 1.0, rotateX: 0, duration: 0.16, ease: "power2.out" },
        0.14,
      );

      // 0.30-0.40 - bg crossfades white → obsidian; the play button blinks.
      tl.to(stage, { backgroundColor: "#020202", duration: 0.18 }, 0.3);
      tl.to(play, { opacity: 1, scale: 1, duration: 0.08 }, 0.31);
      tl.to(play, { opacity: 0, scale: 1.3, duration: 0.1 }, 0.42);

      // 0.30-0.56 - THE BURST: the app grows out of the device to full-bleed. The
      // keyboard slides down & out; the bezel rim EXPANDS outward past the
      // viewport edges (scale > 1) as it fades - so the app reads as coming OUT of
      // the laptop, not the laptop scaling uniformly. scale 1.0 → 1.3 makes the
      // 78vh screen fill the full viewport height head-on.
      tl.to(keys, { yPercent: 130, opacity: 0, duration: 0.12, ease: "power1.in" }, 0.3);
      tl.to(device, { scale: 1.3, duration: 0.26, ease: "power1.inOut" }, 0.3);
      tl.to(bezel, { scale: 1.14, opacity: 0, duration: 0.16, ease: "power1.in" }, 0.4);

      // 0.56-1.00 - END STATE: The app continues to scale aggressively (diving past
      // the camera) and fades into the obsidian background before the Overview section appears.
      tl.to(device, { scale: 2.2, duration: 0.44, ease: "power2.in" }, 0.56);
      tl.to(device, { opacity: 0, duration: 0.20, ease: "power1.inOut" }, 0.80);

      ScrollTrigger.refresh();
      }, rootRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // Re-run when the mobile boundary is crossed so the pin builds/tears down
    // to match the active render path.
  }, [isMobile]);

  // ── Static fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduced === true || isMobile === true) {
    return (
      <>
        <LandingNav />
        <section
          data-section="light"
          className="relative flex flex-col items-center px-6 pb-16 pt-32"
          style={{ backgroundColor: "var(--bg-page)" }}
        >
          <HeroCopy />
          <div className="mt-14 w-full max-w-[var(--maxw-content)]">
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-[var(--obsidian)] shadow-2xl">
              <div className="aspect-[16/10] w-full">
                <HeroSplitArt />
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── Motion (and pre-measure) render ─────────────────────────────────────
  return (
    <>
      <LandingNav />
      {/* Outer runway - its height creates the scroll distance for the pin. */}
      <div ref={rootRef} className="relative h-[330vh]">
        {/* Sticky stage - pinned for the duration of the scroll. */}
        <div
          className="hero-stage sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* Hero text (FRAME 1) - light, centered, sits above the device. */}
          <div
            data-section="light"
            className="hero-text pointer-events-none absolute inset-x-0 top-[18%] z-20 flex justify-center px-6"
          >
            <HeroCopy />
          </div>

          {/* The device (laptop). A perspective WRAPPER holds the 3D-tilted
              .hero-device: a thin-bezel aluminium lid wrapping the dark inset
              SCREEN (CommandCenterArt), plus a keyboard BASE/hinge hinted at the
              bottom. rotateX tilts the lid back in 3D; it animates → upright and
              scales to full-bleed across frames 2→3. */}
          <div
            className="relative z-10 h-[78vh] w-[min(1180px,92vw)]"
            style={{ perspective: "1600px", perspectiveOrigin: "50% 55%" }}
          >
            <div
              className="hero-device relative h-full w-full"
              style={{ transformStyle: "preserve-3d", willChange: "transform" }}
            >
            {/* keyboard base / hinge - a silver aluminium slab hinted just below
                the lid, giving the tilted laptop a 3D footprint. Fades out as the
                lid rises upright into full-bleed (frame 2). */}
            <div
              className="hero-keys absolute inset-x-[-3%] bottom-[-7.2%] z-0 h-[8.4%] rounded-b-[14px] rounded-t-[4px]"
              style={{
                background:
                  "linear-gradient(180deg, #d4d7dc 0%, #a8acb4 40%, #75797f 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.6) inset, 0 30px 70px rgba(0,0,0,0.4)",
              }}
            >
              {/* hinge notch (lid-open recess) at top-center of the base */}
              <div
                className="hero-base absolute left-1/2 top-0 h-[34%] w-[18%] -translate-x-1/2 rounded-b-[7px]"
                style={{ backgroundColor: "rgba(0,0,0,0.34)" }}
              />
              {/* trackpad cutout hint */}
              <div
                className="absolute left-1/2 bottom-[12%] h-[26%] w-[26%] -translate-x-1/2 rounded-[4px]"
                style={{
                  backgroundColor: "rgba(0,0,0,0.10)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset",
                }}
              />
            </div>

            {/* bezel - the laptop lid: thin aluminium rim around a dark screen.
                Fades to 0 in frame 3 so the dashboard reads full-bleed. */}
            <div
              className="hero-bezel absolute inset-0 z-10 rounded-[18px] border bg-[var(--obsidian)]"
              style={{
                borderColor: "rgba(255,255,255,0.18)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.12) inset, 0 0 0 1px rgba(0,0,0,0.6), 0 50px 130px rgba(0,0,0,0.5)",
              }}
            >
              {/* webcam dot, centered on the top bezel */}
              <div
                className="absolute left-1/2 top-[7px] h-[3px] w-[3px] -translate-x-1/2 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.24)" }}
              />
            </div>

            {/* screen - the actual dashboard art, inset inside the bezel */}
            <div className="absolute inset-[11px] z-20 overflow-hidden rounded-[10px] bg-[var(--obsidian)]">
              <HeroSplitArt />
            </div>

            {/* cookie consent card (FRAME 1) - dark, overlaid low-left on the
                screen. Dismisses on the
                0.16-0.30 beat. `inert` keeps this decorative/satirical card (its
                "Accept all" / "Reject all" buttons are non-functional parody)
                out of the focus order and a11y tree without touching the scroll
                animation, layout, or copy. */}
            <div inert className="hero-cookie absolute bottom-[8%] left-[5%] z-30 w-[min(460px,64%)]">
              <div
                className="rounded-[16px] border p-5 shadow-2xl backdrop-blur"
                style={{
                  backgroundColor: "rgba(8,8,9,0.92)",
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Logomark size={16} className="text-[var(--frost)]" />
                  <span
                    className="font-sans text-[15px]"
                    style={{ fontWeight: 300, color: "var(--frost)" }}
                  >
                    We Use Cookies
                  </span>
                </div>
                <p
                  className="font-sans text-[11.5px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  This site sets no tracking cookies and runs no analytics —
                  it would be a strange thing to do here. By continuing you agree
                  to our use of cookies. Check our Cookie Policy for details.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-[var(--r-pill)] px-5 py-2 font-sans text-[12px] font-medium"
                    style={{
                      backgroundColor: "var(--frost)",
                      color: "var(--obsidian)",
                    }}
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--r-pill)] border px-5 py-2 font-sans text-[12px]"
                    style={{
                      borderColor: "rgba(255,255,255,0.22)",
                      color: "var(--frost)",
                    }}
                  >
                    Reject all
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* circular play button (FRAME 2) - center */}
          <div className="hero-play pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full border text-white"
              style={{
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(2px)",
              }}
            >
              <span className="ml-1 text-[20px] leading-none">▶</span>
            </span>
          </div>

          {/* scroll cue (FRAME 1) - bottom-right bouncing arrow */}
          <div
            data-section="light"
            className="hero-arrow anim-scroll-cue pointer-events-none absolute bottom-6 right-6 z-30 flex flex-col items-center gap-1"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              scroll
            </span>
            <span className="text-[18px] leading-none text-[var(--text-primary)]">
              ↓
            </span>
          </div>
        </div>
      </div>
      {/* Pull the next section up to cover the empty 100vh stage when it unpins, eliminating the black void. */}
      <div className="hidden md:block -mt-[100vh]" />
    </>
  );
}

/** The centered two-tone hero headline + sub (shared by both render paths). */
function HeroCopy() {
  return (
    <div className="text-center">
      <h1
        className="font-sans"
        style={{
          fontWeight: 420,
          letterSpacing: "-0.012em",
          lineHeight: 1.06,
          // STORY variant: "They already know" sits on its own line and the
          // rotating CLAUSE drops to a second line below it - the phrases are
          // long, so a single nowrap line would blow past the viewport.
          // Font-size eased down so the longest clause stays clean and centered
          // at desktop widths; shrinks on narrow viewports.
          fontSize: "clamp(26px, 4.6vw, 60px)",
          color: "var(--text-primary)",
        }}
      >
        They already know
        <br />
        <RotatingWord />
      </h1>
      <p
        className="mx-auto mt-6 max-w-xl font-sans"
        style={{
          fontSize: "clamp(14px, 1.6vw, 18px)",
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        Warren routes every message through three relays that each know only
        their neighbours, pads it to a fixed size, and delays it at random. The
        content was already private. This hides the pattern.
      </p>
    </div>
  );
}

/**
 * RotatingWord - the headline's trailing CLAUSE, cycling on a ~2s timer through
 * the three things traffic analysis reveals even when the content is encrypted.
 * Rendered in the muted two-tone gray on its own centered line under "They
 * already know". Under prefers-reduced-motion the clause stays fixed on the
 * first phrase with no animation. AnimatePresence cross-fades each swap.
 */
const ROTATING_WORDS = [
  "who you talked to.",
  "when you talked.",
  "how often you talk.",
] as const;

function RotatingWord() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  // Reserve horizontal space (from the LONGEST phrase, not a single word) so the
  // line doesn't reflow on swap; centered on its own line under the headline.
  const ch = Math.max(...ROTATING_WORDS.map((w) => w.length));

  if (reduceMotion) {
    return <span style={{ color: "#9a9a9a" }}>{ROTATING_WORDS[0]}</span>;
  }

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        minWidth: `${ch}ch`,
        textAlign: "center",
        verticalAlign: "bottom",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: "0.18em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "-0.18em" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "inline-block",
            color: "#9a9a9a",
            whiteSpace: "nowrap",
          }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
