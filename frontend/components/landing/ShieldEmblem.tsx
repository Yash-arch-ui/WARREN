"use client";

import { useId } from "react";
import Logomark from "@/components/landing/Logomark";

/**
 * ShieldEmblem - the shared A&O frosted shield badge. A SYMMETRIC shield:
 * rounded top corners, vertical sides, then a chamfer to a flat bottom point; a
 * frosted silver gradient face with a field of diagonal tick marks; a light top
 * rim + a soft white halo lift it off the obsidian. The brand name sits top-left
 * and the shared <Logomark/> bottom-right.
 *
 * This is the centred centrepiece in BOTH <UnlockSection/> ("Unlock the full
 * power") and <ThreatLeaderboardArt/> (the Codify-engine metrics panel), so the
 * same icon aligns on the page's central axis as you scroll between them. IDs are
 * namespaced with useId() so multiple instances on one page don't collide.
 *
 * Size it from the parent via `className` (e.g. an explicit height + the shield's
 * 280:385 aspect); the SVG fills it (`h-full w-full`, preserveAspectRatio meet).
 */
export default function ShieldEmblem({
  className = "",
  logoSize = 42,
  showLabel = true,
}: {
  className?: string;
  logoSize?: number;
  showLabel?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const hatch = `emb-hatch-${uid}`;
  const face = `emb-face-${uid}`;
  const rim = `emb-rim-${uid}`;

  // rounded top corners, vertical sides, then a chamfer to a flat bottom point.
  const SHIELD =
    "M28 3 H252 A25 25 0 0 1 277 28 V322 L196 382 H84 L3 322 V28 A25 25 0 0 1 28 3 Z";

  return (
    <div className={`relative ${className}`}>
      {/* soft white halo behind the badge - separates it from the obsidian */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 52% at 50% 40%, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 46%, transparent 72%)",
          filter: "blur(6px)",
        }}
      />
      <svg
        viewBox="0 0 280 385"
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: "drop-shadow(0 18px 44px rgba(0,0,0,0.55))" }}
      >
        <defs>
          <pattern id={hatch} width="30" height="28" patternUnits="userSpaceOnUse">
            <path
              d="M8 6 L20 20"
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </pattern>
          <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34373d" />
            <stop offset="0.5" stopColor="#222429" />
            <stop offset="1" stopColor="#141519" />
          </linearGradient>
          <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.10)" />
          </linearGradient>
        </defs>
        <path d={SHIELD} fill={`url(#${face})`} />
        <path d={SHIELD} fill={`url(#${hatch})`} />
        <path d={SHIELD} fill="none" stroke={`url(#${rim})`} strokeWidth="1.5" />
      </svg>

      {/* brand name - top-left */}
      {showLabel ? (
        <span className="absolute left-[10%] top-[8%] font-sans text-[clamp(9px,0.95vw,15px)] font-medium tracking-[-0.01em] text-[var(--frost)]">
          Warren
        </span>
      ) : null}

      {/* logomark - bottom-right, above the flat point */}
      <span className="absolute bottom-[15%] right-[13%] text-[var(--frost)]">
        <Logomark size={logoSize} />
      </span>
    </div>
  );
}
