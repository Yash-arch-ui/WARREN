"use client";

import { useDeskUIStore } from "@/lib/desk/uiStore";
import { useFilterActive } from "@/lib/desk/filter";
import { NODE_META } from "@/lib/desk/nodes";

/**
 * FilterChips - dismissible chips for the active node filter + search query.
 * Renders nothing when no filter is active. A neutral selection look (NOT
 * --band-blue, which is SACRED = waiting-on-Band); we use --text-primary /
 * --border-strong for the active node chip per the desk design rules.
 */

function labelForNode(id: string): string {
  return NODE_META.find((n) => n.id === id)?.label ?? id;
}

export default function FilterChips() {
  const { node, query, any } = useFilterActive();
  const clearNodeFilter = useDeskUIStore((s) => s.clearNodeFilter);
  const setQuery = useDeskUIStore((s) => s.setQuery);

  if (!any) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="font-mono text-[9px] uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        filter
      </span>

      {node ? (
        <button
          type="button"
          onClick={clearNodeFilter}
          title="Clear node filter"
          className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10px] transition-colors"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
            background: "var(--bg-inset)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>node:</span>
          {labelForNode(node)}
          <span aria-hidden style={{ color: "var(--text-muted)" }}>
            ✕
          </span>
        </button>
      ) : null}

      {query.trim() ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          title="Clear search"
          className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10px] transition-colors"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
            background: "var(--bg-inset)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>“</span>
          {query.trim()}
          <span style={{ color: "var(--text-muted)" }}>”</span>
          <span aria-hidden style={{ color: "var(--text-muted)" }}>
            ✕
          </span>
        </button>
      ) : null}
    </div>
  );
}
