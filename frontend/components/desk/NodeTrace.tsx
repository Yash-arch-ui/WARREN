"use client";

import { useFilteredEvents, useFilterActive } from "@/lib/desk/filter";

/**
 * NodeTrace - the filtered detail log. Renders ONLY while a node filter or search
 * query is active (lib/desk/filter.ts), listing the raw events that match so the
 * operator sees exactly what the topology click / search narrowed to. Plain list,
 * no animation - reduced-motion safe by construction.
 */
export default function NodeTrace() {
  const { any } = useFilterActive();
  const events = useFilteredEvents();

  if (!any) return null;

  return (
    <div
      className="px-5 py-5"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--text-muted)",
          }}
        >
          Filtered trace
        </span>
        <span
          className="font-mono tabular-nums"
          style={{ fontSize: 11, color: "var(--text-faint)" }}
        >
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <p
          className="mt-4 font-sans"
          style={{ fontSize: 13, color: "var(--text-faint)" }}
        >
          No matching events.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5" style={{ padding: 0, margin: 0 }}>
          {events.map((e, i) => (
            <li
              key={`${e.node}-${e.ts}-${i}`}
              style={{ listStyle: "none" }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-primary)",
                    textTransform: "capitalize",
                  }}
                >
                  {e.node}
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ fontSize: 10.5, color: "var(--text-muted)" }}
                >
                  {new Date(e.ts).toISOString().slice(11, 19)}
                </span>
              </div>
              {e.detail ? (
                <p
                  className="mt-1 font-sans leading-snug"
                  style={{ fontSize: 12, color: "var(--text-body)" }}
                >
                  {e.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
