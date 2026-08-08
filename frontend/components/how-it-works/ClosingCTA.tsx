"use client";

import Link from "next/link";
import { Reveal } from "@/components/anim/Reveal";
import Logomark from "@/components/landing/Logomark";

/**
 * ClosingCTA - the closing call-to-action for /how-it-works.
 *
 * A centered card on the light backbone: shield/logomark emblem → two-tone
 * heading → "Watch it live" → /desk (next/link) + a "Replay ↑" scroll-to-top
 * button. Reveal carries the reduced-motion fallback; the scroll-to-top falls
 * back to a hard jump when the user prefers reduced motion (handled by the
 * browser via scroll-behavior, but we also pass a non-smooth path when matched).
 */

type ClosingCTAProps = {
  /** Override the "Watch it live" target. Default "/desk". */
  watchHref?: string;
};

export function ClosingCTA({ watchHref = "/desk" }: ClosingCTAProps) {
  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section
      aria-labelledby="hiw-cta-title"
      className="px-6 pb-32"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <Reveal>
        <div
          className="mx-auto flex max-w-3xl flex-col items-center p-12 text-center sm:p-16"
          style={{
            borderRadius: "var(--r-card)",
            border: "1px solid var(--hairline)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          {/* shield emblem - the angular mark inside a hairline ring */}
          <div
            aria-hidden="true"
            className="flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <Logomark size={26} />
          </div>

          <h2
            id="hiw-cta-title"
            className="mt-8 font-sans"
            style={{
              fontSize: "clamp(28px, 4.2vw, 46px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1.08,
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>Now watch it </span>
            <span style={{ color: "var(--text-muted)" }}>run live.</span>
          </h2>

          <p
            className="mt-5 max-w-md font-sans"
            style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}
          >
            The same loop, streaming in real time - evasions invented, debated,
            and codified on the live desk.
          </p>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href={watchHref}
              className="font-sans"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: "var(--r-pill)",
                backgroundColor: "var(--text-primary)",
                color: "var(--bg-page)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.01em",
                textDecoration: "none",
              }}
            >
              Watch it live →
            </Link>

            <button
              type="button"
              onClick={scrollToTop}
              className="font-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 20px",
                borderRadius: "var(--r-pill)",
                border: "1px solid var(--border-default)",
                backgroundColor: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
            >
              Replay ↑
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
