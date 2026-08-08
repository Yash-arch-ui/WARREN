"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Logomark from "@/components/landing/Logomark";

/**
 * LandingNav - floating top navigation for the Warren landing page.
 *
 * Sits fixed at the top, full width, over a transparent background so it floats
 * across the alternating light/dark scrollytelling frames of the page.
 *
 * LEGIBILITY - deterministic scroll-spy (NOT mix-blend-mode).
 * ----------------------------------------------------------
 * The prior implementation relied on `mix-blend-mode: difference`. That is only
 * correct when the blended ink is PURE #fff with no isolating/opaque ancestor;
 * here the brand+links sit inside positioned/opacity-bearing flex layers, so the
 * blend silently produced invisible output over the white hero (see es.png).
 *
 * Instead we read the GROUND TRUTH: each frame we sample the actually-rendered
 * pixel behind the nav's centre with `document.elementsFromPoint`, walk up to the
 * first element with a non-transparent background, and compute its perceptual
 * luminance. Luminance < 0.5 ⇒ dark frame ⇒ paint the brand/links WHITE; else
 * paint them INK (var(--text-primary)). This is robust because:
 *   • It works even while GSAP tweens the hero stage colour white→obsidian
 *     mid-scroll (no scroll delta), because we also poll on rAF, not just scroll.
 *   • It needs no agreement from sibling sections about their theme attrs.
 *   • Default state is INK (the page opens white at the top), so the brand is
 *     visible on first paint before any listener fires - no flash of invisible text.
 *
 * The "Node: connected" pill and the solid dark CTA already carry their own
 * self-contained contrast and are left untouched by the theme flip.
 *
 * Self-contained, prop-less, default export.
 */

const LINKS: ReadonlyArray<{ label: string; href: string; isRoute?: boolean }> = [
  { label: "Overview", href: "#overview" },
  { label: "How it works", href: "/how-it-works", isRoute: true },
  { label: "Live Desk", href: "/desk", isRoute: true },
  { label: "Threat model", href: "#threat-model" },
];

/** Parse an rgb()/rgba() computed-style string → perceptual luminance, or null if transparent. */
function luminanceOf(color: string): number | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  const [r, g, b] = parts;
  const a = parts.length >= 4 ? parts[3] : 1;
  if (!a) return null; // fully transparent → not the painted background
  // Relative luminance (sRGB-weighted), good enough for a light/dark decision.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export default function LandingNav() {
  // true ⇒ frame behind the nav is dark ⇒ paint brand/links white.
  const [onDark, setOnDark] = useState(false);
  // mobile slide-down menu (md and below - the centered link row is hidden there)
  const [menuOpen, setMenuOpen] = useState(false);
  // On sub-routes (e.g. /terms), in-page hash links must point back to the home
  // page; on "/" they stay bare so the browser scrolls without a reload.
  const pathname = usePathname();
  const resolveHash = (href: string) =>
    href.startsWith("#") && pathname !== "/" ? `/${href}` : href;

  useEffect(() => {
    let raf = 0;
    let last = -1; // -1 unknown, 0 light, 1 dark - avoids redundant setState churn.

    const sample = () => {
      raf = 0;
      // Sample at the nav's vertical mid-line, slightly inset from the left edge
      // where the brand actually sits.
      const y = 32;
      const x = Math.min(80, window.innerWidth / 2);
      const stack = document.elementsFromPoint(x, y);

      let lum: number | null = null;
      for (const el of stack) {
        if (el instanceof HTMLElement && el.closest("header[data-landing-nav]")) {
          continue; // skip the nav itself
        }
        const bg = getComputedStyle(el).backgroundColor;
        const l = luminanceOf(bg);
        if (l !== null) {
          lum = l;
          break; // first opaque background wins (it's what the eye sees)
        }
      }

      // If nothing opaque was found (e.g. between sections), assume light page bg.
      const dark = lum !== null && lum < 0.5;
      const next = dark ? 1 : 0;
      if (next !== last) {
        last = next;
        setOnDark(dark);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sample);
    };

    // rAF poll loop: catches GSAP background tweens that don't emit scroll events.
    let pollRaf = 0;
    const poll = () => {
      schedule();
      pollRaf = requestAnimationFrame(poll);
    };

    sample();
    pollRaf = requestAnimationFrame(poll);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (pollRaf) cancelAnimationFrame(pollRaf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // Close the mobile menu when the viewport grows past md (the desktop link row
  // takes over) and lock body scroll while the sheet is open.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Ink on light frames (default), white on dark frames.
  // NOTE: this fixed header is NOT inside a [data-section="light"] wrapper, so
  // var(--text-primary)/--text-body resolve to the ROOT (dark-theme) values -
  // i.e. near-white - which made the brand invisible + links faint over the
  // white hero. Use EXPLICIT dark hex on light frames instead.
  const inkColor = onDark ? "#ffffff" : "#14161c";
  const linkColor = onDark ? "rgba(255,255,255,0.82)" : "#52525b";
  const linkHover = onDark ? "#ffffff" : "#14161c";

  return (
    <header data-landing-nav className="fixed inset-x-0 top-0 z-50 w-full">
      <nav className="relative flex h-[72px] w-full items-center justify-between px-6 sm:px-10 lg:px-16">
        {/* brand: shared Logomark + editorial uppercase wordmark */}
        <Link
          href="/"
          aria-label="Warren - home"
          className="group inline-flex items-center gap-2.5"
          style={{ color: inkColor, transition: "color 200ms ease" }}
        >
          <Logomark size={22} className="transition-opacity duration-300 group-hover:opacity-80" />
          <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.16em]">
            Warren
          </span>
        </Link>

        {/* centered nav links, absolutely centered in the bar */}
        <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
          <ul className="pointer-events-auto flex items-center gap-8">
            {LINKS.map((link) => {
              const inner = (
                <span
                  className="font-sans text-[12.5px] tracking-wide"
                  style={{ color: linkColor, transition: "color 200ms ease" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = linkHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = linkColor;
                  }}
                >
                  {link.label}
                </span>
              );
              return (
                <li key={link.href}>
                  {link.isRoute ? (
                    <Link href={link.href}>{inner}</Link>
                  ) : (
                    <a href={resolveHash(link.href)}>{inner}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* fixed-contrast status pill + CTA (own self-contained contrast) */}
        <div className="flex items-center gap-3">
          {/* node: connected status pill */}
          <span className="hidden items-center gap-1.5 rounded-[var(--r-pill)] border border-white/15 bg-black/25 px-3 py-1.5 backdrop-blur-sm sm:inline-flex">
            <span
              aria-hidden="true"
              className="relative inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "var(--verdict-complete)",
                boxShadow: "0 0 6px var(--verdict-complete)",
              }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
              Node: connected
            </span>
          </span>

          {/* Launch Desk CTA - dark pill, fixed contrast */}
          <Link
            href="/desk"
            className="group inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-white/12 bg-[var(--obsidian)] px-4 py-2 font-sans text-[12px] font-medium tracking-wide text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_2px_10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-white/20 hover:bg-[#0c0c0c]"
          >
            Launch Desk
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>

          {/* Hamburger - only below md, where the centered link row is hidden. */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border md:hidden"
            style={{
              borderColor: onDark ? "rgba(255,255,255,0.18)" : "#e2e2e6",
              color: inkColor,
              transition: "color 200ms ease, border-color 200ms ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M4 4 L14 14 M14 4 L4 14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 5 H15 M3 9 H15 M3 13 H15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu sheet - full-width dark panel under the bar (md and below).
          Self-contained dark contrast so it reads over any frame; not nested in
          a [data-section="light"] wrap, so explicit colors are used. */}
      {menuOpen && (
        <div
          className="absolute inset-x-0 top-[72px] border-t md:hidden"
          style={{
            backgroundColor: "rgba(2,2,2,0.97)",
            borderColor: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(8px)",
          }}
        >
          <ul className="flex flex-col px-6 py-3">
            {LINKS.map((link) => {
              const inner = (
                <span className="block py-3 font-sans text-[15px] tracking-wide text-white/85">
                  {link.label}
                </span>
              );
              return (
                <li
                  key={link.href}
                  className="border-b border-white/8 last:border-b-0"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.isRoute ? (
                    <Link href={link.href}>{inner}</Link>
                  ) : (
                    <a href={resolveHash(link.href)}>{inner}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
