"use client";

import Link from "next/link";
import Logomark from "@/components/landing/Logomark";

/**
 * HowItWorksHeader - sticky top bar for the /how-it-works editorial route.
 *
 * Light bar (h-14, top-0, z-50). Because a sticky element can sit OUTSIDE the
 * nearest data-section="light" frame during scroll, tokens would resolve to the
 * ROOT (dark) theme and the bar would vanish (the documented "invisible navbar"
 * gotcha). So every color here is an EXPLICIT hex, not a token:
 *   ink #14161c · faint #9a9a9a · hairline #e7e7e7 · bg #ffffff.
 *
 * Left: Logomark + "ALPHA & OVERSIGHT" wordmark (inherits currentColor = ink).
 * Right: "← Back" → "/" and "Live Desk →" → "/desk".
 */

const INK = "#14161c";
const FAINT = "#646464";
const HAIRLINE = "#e7e7e7";

type HowItWorksHeaderProps = {
  /** Optional override for the back-link target. Default "/". */
  backHref?: string;
};

export function HowItWorksHeader({ backHref = "/" }: HowItWorksHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 h-14 w-full"
      style={{
        backgroundColor: "#ffffff",
        borderBottom: `1px solid ${HAIRLINE}`,
        color: INK,
      }}
    >
      <div
        className="mx-auto flex h-full items-center justify-between px-6"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        {/* Brand cluster - currentColor (= ink) flows into the mark + wordmark */}
        <Link
          href={backHref}
          aria-label="Alpha & Oversight - back to home"
          className="flex items-center"
          style={{ color: INK, textDecoration: "none" }}
        >
          <Logomark size={20} withWordmark />
        </Link>

        {/* Right nav links */}
        <nav className="flex items-center gap-6 font-mono">
          <Link
            href={backHref}
            className="transition-colors"
            style={{
              color: FAINT,
              fontSize: 12,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>
          <Link
            href="/desk"
            className="transition-colors"
            style={{
              color: INK,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            Live Desk →
          </Link>
        </nav>
      </div>
    </header>
  );
}
