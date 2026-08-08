"use client";

/**
 * Logomark - the angular Warren mark.
 *
 * The mark is two side-by-side angular elements sharing a baseline, rendered in
 * solid currentColor so it inherits text color (works on light + dark sections):
 *   (1) LEFT  - a stylized "ㄱ"/"7"/katana glyph: a heavy horizontal top bar that
 *               turns downward into a stem and curves to a rounded foot lower-left.
 *   (2) RIGHT - a solid filled vertical rounded bar (a bold "l"/"I"), same height.
 *
 * Drawn on a 100×100 viewBox; the SVG width tracks the glyph cluster aspect (~1:1).
 */

type LogomarkProps = {
  /** px height of the mark (width scales). Default 22 (nav). */
  size?: number;
  className?: string;
  /** When true, render the wordmark "ALPHA & OVERSIGHT" after the mark. */
  withWordmark?: boolean;
};

function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      height={size}
      viewBox="6 3 90 94"
      fill="none"
      role="img"
      aria-label="Warren"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/*
        LEFT glyph - the "ㄱ" / katana.
        Top bar runs across the top; the right edge drops down as the stem; the
        stem's lower-left is cut by a generous inner radius so the foot reads as
        a rounded hook. Bar thickness ~24 units, stem width ~22 units.
      */}
      <path
        d="
          M9 6
          H62
          A5 5 0 0 1 67 11
          V89
          A5 5 0 0 1 62 94
          H42
          A5 5 0 0 1 37 89
          V45
          A5 5 0 0 0 32 40
          H31
          A22 22 0 0 1 9 18
          Z
        "
        fill="currentColor"
      />
      {/* RIGHT glyph - solid rounded vertical bar. */}
      <rect x="79" y="6" width="14" height="88" rx="7" fill="currentColor" />
    </svg>
  );
}

export default function Logomark({
  size = 22,
  className,
  withWordmark = false,
}: LogomarkProps) {
  if (!withWordmark) {
    return <Mark size={size} className={className} />;
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${Math.round(size * 0.45)}px`,
        lineHeight: 1,
      }}
    >
      <Mark size={size} />
      <span
        className="font-sans"
        style={{
          fontWeight: 600,
          fontSize: `${Math.round(size * 0.82)}px`,
          letterSpacing: "0.01em",
          color: "currentColor",
          whiteSpace: "nowrap",
        }}
      >
        ALPHA &amp; OVERSIGHT
      </span>
    </span>
  );
}
