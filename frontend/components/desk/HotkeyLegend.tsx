"use client";

import { IS_MOCK } from "@/lib/config";

/**
 * HotkeyLegend - a faint, unobtrusive footer strip documenting the desk
 * shortcuts (lib/desk/useHotkeys.ts). Beat/clock keys show only in mock mode
 * (they're gated there); R always works. Plain text - reduced-motion safe.
 */

const MOCK_KEYS: { key: string; label: string }[] = [
  { key: "A", label: "Beat A" },
  { key: "B", label: "Beat B" },
  { key: "C", label: "R&D" },
  { key: "Space", label: "play / pause" },
];

const ALWAYS_KEYS: { key: string; label: string }[] = [
  { key: "R", label: "reset" },
];

function Key({ k }: { k: string }) {
  return (
    <kbd
      className="font-mono"
      style={{
        fontSize: 9.5,
        lineHeight: 1,
        padding: "2px 5px",
        borderRadius: 4,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-inset)",
        color: "var(--text-muted)",
      }}
    >
      {k}
    </kbd>
  );
}

export default function HotkeyLegend() {
  const keys = [...(IS_MOCK ? MOCK_KEYS : []), ...ALWAYS_KEYS];
  return (
    <footer
      className="hidden flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-6 py-2 md:flex"
      style={{ borderColor: "var(--hairline)", background: "var(--bg-nav)" }}
      aria-label="Keyboard shortcuts"
    >
      <span
        className="font-mono font-semibold uppercase tracking-wider"
        style={{ fontSize: 9, color: "var(--text-muted)" }}
      >
        keys
      </span>
      {keys.map((k) => (
        <span key={k.key} className="inline-flex items-center gap-1.5">
          <Key k={k.key} />
          <span
            className="font-mono font-semibold"
            style={{ fontSize: 10, color: "var(--text-muted)" }}
          >
            {k.label}
          </span>
        </span>
      ))}
    </footer>
  );
}
