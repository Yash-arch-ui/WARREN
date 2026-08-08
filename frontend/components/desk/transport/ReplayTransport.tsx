"use client";

import { useMemo } from "react";
import { useClockStore, type ClockSpeed } from "@/lib/desk/clock";
import { TRACES } from "@/lib/fixtures/registry";
import type { WireEvent } from "@/lib/types";

/**
 * ReplayTransport - the mock-only playback transport strip under the StatsBar.
 *
 * A real scrubber over the loaded fixture: play/pause, reset, 0.5×-4× speed, a
 * draggable seek rail (with token/hop/delivery tick marks), a live playhead +
 * current-frame readout, and the trace picker (send / receive / cover traffic).
 * Everything drives the ReplayClock (lib/desk/clock.ts); the rest of the desk
 * just reacts to useTraceStore as usual.
 *
 * Reduced-motion safe: it's plain controls + a native range input - no animation.
 * Live mode never renders this (you can't scrub a live wire); the page
 * gates it behind IS_MOCK.
 */

const SPEEDS: ClockSpeed[] = [0.5, 1, 2, 4];

const TONE_VAR: Record<string, string> = {
  sent: "var(--state-inflight)",
  token: "var(--state-token)",
  hop: "var(--state-inflight)",
  delivered: "var(--state-delivered)",
  cover: "var(--state-cover)",
  error: "var(--state-failed)",
};

/** A short tone for a frame (rail ticks + readout dot). */
function frameTone(e: WireEvent): keyof typeof TONE_VAR | null {
  if (e.kind === "error") return "error";
  if (e.room === "cover") return "cover";
  if (e.kind === "token") return "token";
  if (e.kind === "sphinx") return "hop";
  if (e.kind === "reassemble") return "delivered";
  if (e.kind === "encrypt") return "sent";
  return null;
}

/** A compact label for the frame currently under the playhead. */
function frameLabel(e: WireEvent | undefined): string {
  if (!e) return "ready";
  const packet = /packet (\d+\/\d+)/.exec(e.detail);
  if (packet) return `packet ${packet[1]}`;
  if (e.kind === "reassemble") return "reassembled";
  if (e.kind === "encrypt") return "split + encrypt";
  if (e.kind === "deliver") return "handed to path";
  if (e.kind === "error") return "failed";
  return e.node;
}

function IconBtn({
  label,
  glyph,
  onClick,
  disabled,
  emphasis,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-chip)] border text-[12px] transition-colors disabled:opacity-40"
      style={{
        borderColor: emphasis ? "var(--border-strong)" : "var(--border-default)",
        color: emphasis ? "var(--text-primary)" : "var(--text-body)",
        background: "var(--bg-inset)",
      }}
    >
      {glyph}
    </button>
  );
}

export default function ReplayTransport() {
  const { traceId, frames, index, status, speed } = useClockStore();
  const load = useClockStore((s) => s.load);
  const play = useClockStore((s) => s.play);
  const pause = useClockStore((s) => s.pause);
  const seek = useClockStore((s) => s.seek);
  const reset = useClockStore((s) => s.reset);
  const setSpeed = useClockStore((s) => s.setSpeed);

  const total = frames.length;
  const playing = status === "playing";
  const current = index > 0 ? frames[index - 1] : undefined;

  // tick marks: positions of verdict / escalate / codify / band frames on the rail.
  const ticks = useMemo(() => {
    if (!total) return [];
    return frames
      .map((e, i) => ({ i, tone: frameTone(e) }))
      .filter((t) => t.tone)
      .map((t) => ({ pct: (t.i + 1) / total, color: TONE_VAR[t.tone as string] }));
  }, [frames, total]);

  const tone = current ? frameTone(current) : null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--hairline)] bg-[var(--bg-nav)] px-6 py-2.5"
      aria-label="Replay transport"
    >
      {/* transport buttons */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 hidden font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)] md:inline">
          replay
        </span>
        <IconBtn
          label={playing ? "Pause" : "Play"}
          glyph={playing ? "❚❚" : "▶"}
          emphasis
          onClick={() => (playing ? pause() : play())}
        />
        <IconBtn label="Reset" glyph="↺" onClick={reset} disabled={!traceId} />
      </div>

      {/* scrubber */}
      <div className="flex min-w-[200px] flex-1 items-center gap-3">
        <div className="relative flex-1">
          {/* tick marks behind the rail */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2">
            {ticks.map((t, k) => (
              <span
                key={k}
                className="absolute top-0 h-3 w-[2px] -translate-x-1/2 rounded-full opacity-80"
                style={{ left: `${t.pct * 100}%`, background: t.color }}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={index}
            disabled={!total}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="relative w-full cursor-pointer disabled:cursor-default"
            style={{ accentColor: "var(--text-muted)" }}
          />
        </div>
        <div className="flex min-w-[150px] items-center gap-2 font-mono text-[10px] text-[var(--text-muted)]">
          <span className="tabular-nums text-[var(--text-faint)]">
            {index}/{total || 0}
          </span>
          {tone ? (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ background: TONE_VAR[tone] }}
            />
          ) : null}
          <span className="truncate text-[var(--text-body)]">{frameLabel(current)}</span>
        </div>
      </div>

      {/* speed */}
      <div className="flex items-center gap-1">
        <span className="mr-1 hidden font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)] sm:inline">
          speed
        </span>
        {SPEEDS.map((s) => {
          const on = speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className="rounded-[var(--r-chip)] border px-1.5 py-1 font-mono text-[10px] tabular-nums transition-colors"
              style={{
                borderColor: on ? "var(--border-strong)" : "var(--border-subtle)",
                color: on ? "var(--text-primary)" : "var(--text-faint)",
                background: on ? "var(--bg-inset)" : "transparent",
              }}
            >
              {s}×
            </button>
          );
        })}
      </div>

      {/* trace picker */}
      <div className="flex items-center gap-1">
        <span className="mr-1 hidden font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)] sm:inline">
          trace
        </span>
        {TRACES.map((c) => {
          const on = traceId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => load(c.id)}
              title={`${c.id} - ${c.blurb}`}
              className="rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors"
              style={{
                borderColor: on ? "var(--border-strong)" : "var(--border-subtle)",
                color: on ? "var(--text-primary)" : "var(--text-muted)",
                background: on ? "var(--bg-inset)" : "transparent",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
