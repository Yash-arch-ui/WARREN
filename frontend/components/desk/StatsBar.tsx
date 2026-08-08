"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";

/**
 * StatsBar - the horizontal tile row at the head of the /desk Command Center.
 *
 * Stays DARK to match the command-center backbone (no data-section="light"
 * wrapper). Every tile is folded from real `model.stats` (GET /api/v1/stats);
 * nothing is scripted.
 *
 * Numbers are font-mono; uppercase tracked eyebrow labels in `--text-muted`.
 * The token tile rolls when the balance changes - a send spends one token per
 * packet, so the number visibly falls as traffic goes out. Respects
 * prefers-reduced-motion (final values, no roll).
 */

/** A number tile that rolls when the value changes. */
function RollingNumber({
  count,
  highlight,
  reduce,
}: {
  count: number;
  highlight: boolean;
  reduce: boolean;
}) {
  const [rolling, setRolling] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (reduce) {
      prev.current = count;
      return;
    }
    if (count !== prev.current) {
      setRolling(true);
      const id = window.setTimeout(() => setRolling(false), 600);
      prev.current = count;
      return () => window.clearTimeout(id);
    }
    prev.current = count;
  }, [count, reduce]);

  return (
    <span
      style={{
        display: "inline-block",
        transition: reduce ? undefined : "transform 0.45s var(--ease-spring)",
        transform: rolling ? "translateY(-2px)" : "translateY(0)",
        color: highlight ? "var(--state-token)" : "var(--text-primary)",
      }}
    >
      {count}
    </span>
  );
}

type Tile = {
  label: string;
  /** when true, this tile is sourced from a failed query - show "-". */
  errored: boolean;
  render: (reduce: boolean) => React.ReactNode;
};

/** A dimmed em-dash placeholder for a tile whose REST source is unavailable. */
function Unavailable() {
  return (
    <span style={{ color: "var(--state-failed)" }} title="Unavailable - is `warren serve` running?">
      -
    </span>
  );
}

export default function StatsBar() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;

  // Relays come from GET /api/v1/relays; every other tile from GET /stats.
  // Surface each query's failure on its own tiles so a stopped daemon reads as
  // "-"/unavailable instead of silent zeros.
  const { statsError, relaysError } = model;

  const tiles: Tile[] = [
    {
      label: "Tokens left",
      errored: statsError,
      render: (r) => (
        <RollingNumber
          count={model.stats.tokens_remaining}
          highlight={model.stats.tokens_remaining < 10}
          reduce={r}
        />
      ),
    },
    {
      label: "Sent",
      errored: statsError,
      render: () => <span>{model.stats.sent}</span>,
    },
    {
      label: "Received",
      errored: statsError,
      render: () => <span>{model.stats.received}</span>,
    },
    {
      label: "In flight",
      errored: statsError,
      render: () => <span>{model.stats.by_state["IN_FLIGHT"] ?? 0}</span>,
    },
    {
      label: "Tokens spent",
      errored: statsError,
      render: () => <span>{model.stats.tokens_spent}</span>,
    },
    {
      label: "Relays",
      errored: relaysError,
      render: () => <span>{model.stats.directory_entries}</span>,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Surveillance desk statistics"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
        overflow: "hidden",
      }}
    >
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className="flex flex-col gap-2 px-5 py-5"
          style={{
            borderLeft:
              i % 6 === 0 ? "none" : "1px solid var(--hairline)",
            borderTop: "none",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: "clamp(24px, 2.4vw, 34px)",
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--text-primary)",
            }}
          >
            {tile.errored ? <Unavailable /> : tile.render(reduce)}
          </span>
          <span
            className="font-sans"
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: tile.errored ? "var(--verdict-flag)" : "var(--text-muted)",
            }}
          >
            {tile.errored ? "unavailable" : tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}
