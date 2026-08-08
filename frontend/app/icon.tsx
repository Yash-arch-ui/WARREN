import { ImageResponse } from "next/og";

// App icon - the AlphaLedger mark on obsidian, 32×32.
// Self-contained: the Logomark SVG is inlined (no client-component import).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020202",
          padding: 4,
        }}
      >
        <svg height={24} viewBox="6 3 90 94" fill="none">
          <path
            d="M9 6 H62 A5 5 0 0 1 67 11 V89 A5 5 0 0 1 62 94 H42 A5 5 0 0 1 37 89 V45 A5 5 0 0 0 32 40 H31 A22 22 0 0 1 9 18 Z"
            fill="#fefefe"
          />
          <rect x="79" y="6" width="14" height="88" rx="7" fill="#fefefe" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
