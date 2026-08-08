"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import Logomark from "@/components/landing/Logomark";

/**
 * DeskShowcaseHeader - sticky brand bar for the /desk showcase. Matches the
 * LANDING nav exactly: 72px tall, the shared Logomark + uppercase wordmark, and
 * font-sans links. The pinned `top-[72px]` stages tuck below it.
 *
 * TOKEN GOTCHA (the invisible-navbar bug): this bar is `sticky` and is NOT
 * nested in a `[data-section]` scope, so `var(--text-*)` would resolve to the
 * ROOT palette unpredictably. So it uses EXPLICIT HEX. The /desk hero is now
 * DARK, so the bar is obsidian with frost text + a light CTA pill to match.
 *
 * Auto-hides once the live Command Center (#live-desk) scrolls into the top of
 * the viewport, so the dashboard gets the full screen height. Slides back in on
 * scroll-up. Reduced-motion toggles instantly (no slide).
 */
const INK = "#fefefe";
const MUTED = "#9a9a9a";
const BORDER = "#1c1d1f";
const BG = "#020202";

export function DeskShowcaseHeader() {
  const reduce = useReducedMotion() ?? false;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const desk = document.getElementById("live-desk");
    if (!desk) return;
    // Fire when the live desk crosses into the top sliver of the viewport - i.e.
    // the operator has reached the dashboard. rootMargin shrinks the root to the
    // top ~12%, so the bar only hides once the desk owns the top of the screen.
    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { rootMargin: "0px 0px -88% 0px", threshold: 0 },
    );
    io.observe(desk);
    return () => io.disconnect();
  }, []);

  return (
    <header
      className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b px-6 sm:px-10"
      style={{
        borderColor: BORDER,
        backgroundColor: `${BG}f2`,
        backdropFilter: "blur(10px)",
        color: INK,
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: reduce
          ? "none"
          : "transform 0.35s var(--ease-out), opacity 0.35s var(--ease-out)",
      }}
    >
      {/* brand: identical to the landing nav (logomark + uppercase wordmark), home */}
      <Link
        href="/"
        aria-label="Alpha & Oversight - home"
        className="group inline-flex items-center gap-2.5"
        style={{ color: INK }}
      >
        <Logomark size={22} className="transition-opacity duration-300 group-hover:opacity-80" />
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.16em]">Alpha &amp; Oversight</span>
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/how-it-works"
          className="font-sans text-[12.5px] font-semibold tracking-wide transition-colors"
          style={{ color: MUTED }}
          onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
          onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
        >
          How it works
        </Link>
        <a
          href="#live-desk"
          className="rounded-[var(--r-pill)] px-4 py-2 font-sans text-[12px] font-bold tracking-wide"
          style={{ backgroundColor: "#fefefe", color: "#020202" }}
        >
          Live demo
        </a>
      </nav>
    </header>
  );
}
