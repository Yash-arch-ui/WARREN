"use client";

/**
 * AuditChainArt - the STATIC dark "Audit Lineage" artwork shown INSIDE a feature
 * card on the landing page. It is the A&O analog of 's "Verified &
 * Audited Leaderboard" screenshot: a compact, hash-chained audit ledger.
 *
 * This is pure presentation art - no data, no props, no fetching. Every value is
 * a hand-set mock chosen to read well when the card is scaled inside the
 * horizontal feature carousel. The component fills its parent (`w-full h-full`).
 *
 * Design rules honoured:
 *  - ALL data (agent ids, hashes, Band message ids, case rows) is mono
 *  - colour is semantic-only via globals.css tokens (no one-off hex needed here)
 *  - desk cells are tinted --desk-surv; the chain tip carries a --verdict-complete ✓
 *  - the "verify_chain ✓" pill uses --verdict-complete over a dark-green wash
 *
 * Self-contained, prop-less, default export.
 */

/* ── ledger rows ─────────────────────────────────────────────────────────── */

type Row = {
  i: string;
  agent: string;
  desk: string | null;
  role: string;
  band: string | null;
  prev: string;
  hash: string;
  tip?: boolean;
};

const ROWS: Row[] = [
  { i: "00", agent: "anomaly_det", desk: "surv", role: "detect", band: null, prev: "0000", hash: "8b1e" },
  { i: "01", agent: "investigator", desk: "surv", role: "recruit", band: "bm_4471", prev: "8b1e", hash: "4d77" },
  { i: "02", agent: "specialist", desk: "surv", role: "propose", band: "bm_4472", prev: "4d77", hash: "c0aa" },
  { i: "03", agent: "rule_engine", desk: null, role: "verdict", band: null, prev: "c0aa", hash: "9f31" },
  { i: "04", agent: "escalation", desk: "surv", role: "escalate", band: "bm_4480", prev: "9f31", hash: "1ed2", tip: true },
];

/* ── tiny building blocks ────────────────────────────────────────────────── */

function FingerprintIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M12 3.5a8.5 8.5 0 0 0-7 3.3" opacity="0.5" />
      <path d="M5.2 17.4A8.5 8.5 0 0 1 6 7" />
      <path d="M12 7a5 5 0 0 0-5 5c0 1.6.3 3.1.9 4.4" />
      <path d="M12 7a5 5 0 0 1 5 5c0 2.6-.5 4.4-1.4 6" opacity="0.7" />
      <path d="M12 11v1.5c0 2.8.6 5 1.7 7" />
      <path d="M9.4 19.7A11 11 0 0 1 8.6 15c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4" opacity="0.7" />
    </svg>
  );
}

function HashGlyph({ value, tip = false }: { value: string; tip?: boolean }) {
  return (
    <span
      className="font-mono text-[9px] tracking-tight"
      style={{ color: tip ? "var(--verdict-complete)" : "var(--text-body)" }}
    >
      {value}…{tip ? " ✓" : ""}
    </span>
  );
}

/* ── main artwork ────────────────────────────────────────────────────────── */

export default function AuditChainArt() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-page)] p-4 text-[var(--text-primary)] sm:p-5">
      {/* ── header: fingerprint + eyebrow, verify pill ─────────────────────── */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <FingerprintIcon />
          <p className="font-sans text-[9px] font-medium uppercase leading-tight tracking-[0.18em] text-[var(--text-muted)] sm:text-[10px]">
            Audit Lineage -<br className="sm:hidden" /> Hash-Chained Ledger
          </p>
        </div>

        {/* verify_chain ✓ pill */}
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] border px-2.5 py-1"
          style={{
            backgroundColor: "color-mix(in srgb, var(--verdict-complete) 12%, transparent)",
            borderColor: "color-mix(in srgb, var(--verdict-complete) 40%, transparent)",
          }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: "var(--verdict-complete)",
              boxShadow: "0 0 6px var(--verdict-complete)",
            }}
          />
          <span
            className="font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: "var(--verdict-complete)" }}
          >
            verify_chain ✓
          </span>
        </span>
      </div>

      {/* ── the ledger table ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-inset)]">
        {/* column header */}
        <div className="grid grid-cols-[1.6rem_5.5rem_2.6rem_4rem_1fr_auto] items-center gap-2 border-b border-[var(--hairline)] bg-[var(--bg-card)] px-3 py-2">
          {["#", "AGENT", "DESK", "ROLE", "BAND_MSG", "PREV → HASH"].map((c) => (
            <span
              key={c}
              className="truncate font-mono text-[7.5px] uppercase tracking-[0.12em] text-[var(--text-faint)] last:text-right"
            >
              {c}
            </span>
          ))}
        </div>

        {/* rows */}
        <ul className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--hairline)]">
          {ROWS.map((r) => (
            <li
              key={r.i}
              className="grid grid-cols-[1.6rem_5.5rem_2.6rem_4rem_1fr_auto] items-center gap-2 px-3 py-2"
              style={
                r.tip
                  ? { backgroundColor: "color-mix(in srgb, var(--verdict-complete) 6%, transparent)" }
                  : undefined
              }
            >
              {/* index */}
              <span className="font-mono text-[9px] text-[var(--text-faint)]">{r.i}</span>

              {/* agent */}
              <span className="truncate font-mono text-[9.5px] text-[var(--text-primary)]">
                {r.agent}
              </span>

              {/* desk - tinted surv */}
              <span
                className="font-mono text-[9px]"
                style={{ color: r.desk ? "var(--desk-surv)" : "var(--text-faint)" }}
              >
                {r.desk ?? "-"}
              </span>

              {/* role */}
              <span className="truncate font-mono text-[9px] text-[var(--text-body)]">
                {r.role}
              </span>

              {/* band message id */}
              <span
                className="truncate font-mono text-[9px]"
                style={{ color: r.band ? "var(--band-blue)" : "var(--text-faint)" }}
              >
                {r.band ?? "-"}
              </span>

              {/* prev → hash */}
              <span className="flex items-center justify-end gap-1 whitespace-nowrap text-right">
                <span className="font-mono text-[9px] text-[var(--text-faint)]">{r.prev}</span>
                <span aria-hidden="true" className="font-mono text-[9px] text-[var(--text-faint)]">
                  →
                </span>
                <HashGlyph value={r.hash} tip={r.tip} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── caption ────────────────────────────────────────────────────────── */}
      <p className="mt-3 font-sans text-[9px] leading-snug text-[var(--text-faint)] sm:text-[10px]">
        every ledger leaf carries a Band message id - the audit trail{" "}
        <span className="italic">is</span> the Band message log.
      </p>
    </div>
  );
}
