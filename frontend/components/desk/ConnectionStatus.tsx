"use client";

import type { ConnectionState } from "@/lib/types";

/**
 * ConnectionStatus - the Band connection pill with a status dot. Standalone,
 * cleaned-up replacement for the inline version in the old /desk foundation proof.
 * `replay` reads amber here; the ReplayBanner chip (DeskHeader) carries the
 * dedicated replay affordance. Static - the dot pulses only when connecting/
 * reconnecting and reduced-motion is off (handled via the globals kill-switch).
 */
type ConnectionStatusProps = {
  state: ConnectionState;
  className?: string;
};

const MAP: Record<ConnectionState, { c: string; label: string; live: boolean }> = {
  idle: { c: "var(--status-idle)", label: "idle", live: false },
  connecting: { c: "var(--state-token)", label: "connecting", live: true },
  connected: { c: "var(--state-delivered)", label: "node: connected", live: false },
  reconnecting: { c: "var(--state-token)", label: "reconnecting", live: true },
  replay: { c: "var(--state-token)", label: "replay", live: false },
  error: { c: "var(--state-failed)", label: "no node", live: false },
};

export default function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  const s = MAP[state];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[var(--r-pill)] border border-[var(--border-default)] px-3 py-1 text-[11px] text-[var(--text-body)] ${className ?? ""}`}
    >
      <span
        className={`w-[7px] h-[7px] rounded-full ${s.live ? "anim-band-pulse" : ""}`}
        style={{ background: s.c }}
      />
      {s.label}
    </span>
  );
}
