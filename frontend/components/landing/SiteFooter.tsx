"use client";

import Link from "next/link";
import Logomark from "./Logomark";

/**
 * SiteFooter - the closing footer (footer).
 * LIGHT section. Three columns: a nav-link list, a centred logomark + tagline +
 * social circles, and a "Launch Desk" pill beside a back-to-top button. Below a
 * hairline: copyright / contact email / legal links. Then a giant full-width
 * "Warren" wordmark, clipped at the bottom edge. Default export.
 */

const NAV: { label: string; href: string; ext?: boolean }[] = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Live Desk", href: "/desk" },
  { label: "FAQ", href: "#faq-title", ext: true },
  { label: "Contact", href: "#contact", ext: true },
];

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SocialCircle({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
      style={{ border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
    >
      {children}
    </a>
  );
}

export default function SiteFooter() {
  const scrollTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer
      data-section="light"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)", overflow: "hidden" }}
    >
      <div className="mx-auto px-6 pt-20" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* top row */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:items-start">
          {/* nav links */}
          <nav className="flex flex-col gap-3.5">
            {NAV.map((n) =>
              n.ext ? (
                <a
                  key={n.label}
                  href={n.href}
                  className="font-sans text-[14px] transition-colors hover:opacity-70"
                  style={{ color: "var(--text-body)" }}
                >
                  {n.label}
                </a>
              ) : (
                <Link
                  key={n.label}
                  href={n.href}
                  className="font-sans text-[14px] transition-colors hover:opacity-70"
                  style={{ color: "var(--text-body)" }}
                >
                  {n.label}
                </Link>
              ),
            )}
          </nav>

          {/* centre - mark + tagline + socials */}
          <div className="flex flex-col items-center text-center">
            <Logomark size={26} withWordmark />
            <p className="mt-4 max-w-[34ch] font-sans" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)" }}>
              Adversarial trade-surveillance, contested in the open - every verdict sealed to a
              tamper-evident ledger.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <SocialCircle label="GitHub" href="https://github.com/PrathamSingla15/alpha-oversight">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.22-3.37-1.22-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
                </svg>
              </SocialCircle>
              <SocialCircle label="X" href="https://x.com/Chainer_Rio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.9 2H22l-7.3 8.34L23 22h-6.56l-5.14-6.72L5.4 22H2.3l7.8-8.92L1.6 2h6.72l4.65 6.15L18.9 2Zm-1.15 18h1.7L7.3 3.9H5.5L17.75 20Z" />
                </svg>
              </SocialCircle>
            </div>
          </div>

          {/* right - CTA + back to top */}
          <div className="flex items-center justify-start gap-3 md:justify-end">
            <Link
              href="/desk"
              className="inline-flex items-center gap-2 font-sans text-[13px] font-medium transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--obsidian)",
                color: "var(--frost)",
                borderRadius: "var(--r-pill)",
                padding: "11px 22px",
              }}
            >
              Launch Desk
              <span aria-hidden="true">→</span>
            </Link>
            <button
              type="button"
              onClick={scrollTop}
              aria-label="Back to top"
              className="flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: "var(--obsidian)", color: "var(--frost)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" {...ICON}>
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* meta row */}
        <div
          className="mt-16 flex flex-col gap-4 pt-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <span className="font-sans text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            © All rights reserved. 2026 Warren
          </span>
          <div className="flex items-center gap-5 font-sans text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            <Link href="/terms" className="transition-colors hover:opacity-70">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:opacity-70">Privacy Policy</Link>
          </div>
        </div>
      </div>

      {/* giant wordmark - full bleed, clipped at the bottom */}
      <div aria-hidden="true" className="mt-12 w-full" style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1200 172" preserveAspectRatio="xMidYMax meet" className="block w-full">
          <text
            x="600"
            y="172"
            textAnchor="middle"
            textLength="1184"
            lengthAdjust="spacingAndGlyphs"
            className="font-sans"
            style={{ fontWeight: 600, fontSize: 210, letterSpacing: "-0.02em", fill: "var(--text-primary)" }}
          >
            Warren
          </text>
        </svg>
      </div>
    </footer>
  );
}
