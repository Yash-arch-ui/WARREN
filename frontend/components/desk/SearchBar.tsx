"use client";

import { useDeskUIStore } from "@/lib/desk/uiStore";

/**
 * SearchBar - free-text filter over the visible rules + trace. The query lives in
 * useDeskUIStore; RelayDirectoryPanel, WireTimeline, EndpointCards and the
 * filtered NodeTrace log all read it via lib/desk/filter.ts.
 *
 * Pragmatic by design: the mock surfaces one live case at a time, so "search" =
 * narrow what's already on screen (rule rows by family/id, trace by
 * agent_name/content), not a backend query. Plain controls - no animation, so
 * reduced-motion needs no special path.
 */
export default function SearchBar() {
  const query = useDeskUIStore((s) => s.query);
  const setQuery = useDeskUIStore((s) => s.setQuery);

  return (
    <div
      className="flex items-center gap-2 rounded-[var(--r-chip)] border px-3 py-2"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-inset)",
      }}
    >
      <span
        aria-hidden
        className="font-mono text-[12px] leading-none"
        style={{ color: "var(--text-faint)" }}
      >
        ⌕
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search cases, families, agents…"
        aria-label="Search rules and trace"
        className="min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-[var(--text-faint)]"
        style={{ color: "var(--text-primary)" }}
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          title="Clear search"
          className="font-mono text-[11px] leading-none transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
