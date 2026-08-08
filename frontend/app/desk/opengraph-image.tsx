import { ImageResponse } from "next/og";

// /desk Open Graph card - distinct title for the live command center.
// Self-contained: the Logomark SVG is inlined (no client-component import).
export const alt = "Alpha & Oversight - Live Command Center";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OBSIDIAN = "#020202";
const FROST = "#fefefe";
const FAINT = "#5a5d66";
const BAND = "#3b82f6";

function Mark({ size }: { size: number }) {
  return (
    <svg
      height={size}
      viewBox="6 3 90 94"
      fill="none"
      style={{ display: "block" }}
    >
      <path
        d="M9 6 H62 A5 5 0 0 1 67 11 V89 A5 5 0 0 1 62 94 H42 A5 5 0 0 1 37 89 V45 A5 5 0 0 0 32 40 H31 A22 22 0 0 1 9 18 Z"
        fill={FROST}
      />
      <rect x="79" y="6" width="14" height="88" rx="7" fill={FROST} />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OBSIDIAN,
          color: FROST,
          padding: "72px 88px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Mark size={48} />
            <span
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}
            >
              ALPHA &amp; OVERSIGHT
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 22,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: BAND,
              fontFamily: "monospace",
            }}
          >
            <span>●</span>
            Live
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
            }}
          >
            <span>Live Command</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
              color: FAINT,
            }}
          >
            Center
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 32,
              color: "#b8bcc4",
              lineHeight: 1.3,
              maxWidth: 900,
            }}
          >
            Watch the Band referee adversarial trades in real time.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid #1c1e24`,
            paddingTop: 22,
            fontSize: 20,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: FAINT,
            fontFamily: "monospace",
          }}
        >
          <span>SSE trace stream</span>
          <span style={{ color: BAND }}>/desk</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
