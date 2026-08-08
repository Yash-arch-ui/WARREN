"use client";

/**
 * CommandCenterArt - the STATIC dark "Command Center" dashboard artwork shown
 * INSIDE the laptop screen during the hero scrollytelling (frames 2-3) and that
 * fills the viewport at frame 3.
 *
 * This is precise *presentation art* - there is no data fetching, no props, and
 * no relationship to the real live Command Center at /desk. Every value below is
 * a hand-set mock chosen to match the Warren design language. The component fills
 * its parent (`w-full h-full`) so the parent's scroll choreography can scale and
 * translate it freely.
 *
 * Design rules honoured here:
 *  - all DATA (roles, addresses, message ids, byte counts, timestamps) is mono
 *  - colour is semantic-only; tokens come from globals.css, never hardcoded hex
 *    (the only inline hex are the spec-mandated one-offs: the #cfe0ff investigator
 *    tint and the blue-tinted feed row)
 *  - the "entry relay" node is THE blue "in flight" node: --state-inflight
 *    border + the shared .anim-band-pulse glow (reduced-motion safe via globals)
 *  - LIGHT subtrees (stats strip + directory) carry data-section="light"
 *
 * Self-contained, prop-less, default export.
 */

/* ── tiny building blocks ────────────────────────────────────────────────── */

type NodeTone =
  | "default"
  | "band"
  | "flag"
  | "escalate"
  | "rnd";

const TONE_BORDER: Record<NodeTone, string> = {
  default: "var(--border-default)",
  band: "var(--band-blue)",
  flag: "var(--verdict-flag)",
  escalate: "var(--verdict-escalate)",
  rnd: "var(--desk-rnd)",
};

/** A small bordered topology node: bold role label + mono sublabel. */
function TopoNode({
  label,
  sub,
  tone = "default",
  pulse = false,
  className = "",
}: {
  label: string;
  sub: string;
  tone?: NodeTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-[var(--r-chip)] border bg-[var(--bg-card)] px-2.5 py-1.5 ${
        pulse ? "anim-band-pulse" : ""
      } ${className}`}
      style={{ borderColor: TONE_BORDER[tone] }}
    >
      <span className="truncate font-sans text-[11px] font-medium leading-tight text-[var(--text-primary)]">
        {label}
      </span>
      <span
        className="truncate font-mono text-[8.5px] leading-tight tracking-tight"
        style={{
          color:
            tone === "band"
              ? "var(--band-blue)"
              : tone === "flag"
                ? "var(--verdict-flag)"
                : tone === "escalate"
                  ? "var(--verdict-escalate)"
                  : "var(--text-faint)",
        }}
      >
        {sub}
      </span>
    </div>
  );
}

/** Inline directional connector glyph between nodes. */
function Edge({ glyph = "→" }: { glyph?: string }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 select-none px-1 font-mono text-[12px] text-[var(--text-faint)]"
    >
      {glyph}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

/** A coloured pill (model tier / status). */
function Pill({
  children,
  color,
  className = "",
}: {
  children: React.ReactNode;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--r-pill)] border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.1em] ${className}`}
      style={{ borderColor: `${color}55`, color, backgroundColor: `${color}14` }}
    >
      {children}
    </span>
  );
}

/* ── main artwork ────────────────────────────────────────────────────────── */

export default function CommandCenterArt() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* ── top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--bg-nav)] px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rotate-45 rounded-tl-[2px] border-[1.5px] border-current border-b-0 border-r-0 text-[var(--text-primary)]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-body)]">
            Warren · Live Desk
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* node: connected */}
          <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "var(--band-blue)",
                boxShadow: "0 0 6px var(--band-blue)",
              }}
            />
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--text-body)]">
              Node: connected
            </span>
          </span>
          {/* live */}
          <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <span aria-hidden="true">⟳</span> live
          </span>
        </div>
      </div>

      {/* ── light stats strip ────────────────────────────────────────────── */}
      <div
        data-section="light"
        className="grid grid-cols-5 gap-px border-b border-[var(--hairline)] bg-[var(--border-subtle)]"
      >
        {[
          { v: "46", k: "Tokens left", c: "var(--text-primary)" },
          { v: "3", k: "Relays", c: "var(--lane-network)" },
          { v: "1", k: "In flight", c: "var(--state-inflight)" },
          { v: "1024 B", k: "Packet size", c: "var(--text-primary)" },
          { v: "✓", k: "path verified", c: "var(--state-delivered)" },
        ].map((t) => (
          <div key={t.k} className="bg-[var(--bg-page)] px-3 py-1.5">
            <div
              className="font-mono text-[13px] font-medium leading-none"
              style={{ color: t.c }}
            >
              {t.v}
            </div>
            <div className="mt-0.5 font-sans text-[8.5px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {t.k}
            </div>
          </div>
        ))}
      </div>

      {/* ── main grid ────────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.25fr_1fr] gap-3 p-3">
        {/* ════ LEFT - runtime topology (the centerpiece) ════ */}
        <section className="flex min-w-0 flex-col rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Features - Runtime Topology</Eyebrow>
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              wb-8f2ad41c
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-between gap-2.5">
            {/* row 1: you → entry relay → middle relay */}
            <div className="flex items-center">
              <TopoNode label="you" sub="split · encrypt" className="flex-1" />
              <Edge />
              <TopoNode
                label="entry relay"
                sub="in flight ◖◗"
                tone="band"
                pulse
                className="flex-[1.2]"
              />
              <Edge glyph="⋯" />
              <TopoNode label="middle relay" sub="peel · delay" className="flex-1" />
            </div>

            {/* row 2: exit relay → recipient */}
            <div className="flex items-center">
              <TopoNode label="exit relay" sub="peel · deliver" className="flex-1" />
              <Edge glyph="⇄" />
              <TopoNode label="recipient" sub="path unknown" className="flex-1" />
              <Edge />
              <TopoNode label="ratchet" sub="decrypt · reassemble" className="flex-1" />
            </div>

            {/* row 3: directory → issuer → cover traffic */}
            <div className="flex items-center">
              <TopoNode
                label="DIRECTORY"
                sub="2-of-3 attested"
                tone="flag"
                className="flex-1"
              />
              <Edge />
              <TopoNode
                label="issuer"
                sub="blind · unlinkable"
                tone="escalate"
                className="flex-1"
              />
              <Edge />
              <TopoNode
                label="⧗ COVER"
                sub="constant rate"
                tone="escalate"
                className="flex-1"
              />
            </div>

            {/* ── trust boundary + local keys + wire spine ── */}
            <div className="mt-1 flex items-stretch gap-3">
              {/* dashed vertical wall */}
              <div
                aria-hidden="true"
                className="shrink-0 self-stretch border-l border-dashed"
                style={{ borderColor: "var(--border-strong)" }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    local · keys never leave
                  </span>
                  <TopoNode
                    label="wallet"
                    sub="46 tokens"
                    tone="rnd"
                    className="w-32 shrink-0"
                  />
                </div>
                {/* wire spine */}
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 font-mono text-[9px] text-[var(--band-blue)]">
                    ═ wire
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[8.5px] text-[var(--band-blue)]">
                    ═══ sphinx&#123;1024 B, token spent&#125; ═══▶
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ RIGHT - stacked: directory / what each hop knows / feed ════ */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          {/* - Relay directory (LIGHT mini-table) - */}
          <div
            data-section="light"
            className="rounded-[var(--r-card)] border border-[var(--border-default)] bg-[var(--bg-page)] p-2.5"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <Eyebrow>Relay Directory</Eyebrow>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                2 of 3
              </span>
            </div>
            <ul className="flex flex-col gap-px">
              {[
                { id: "7001", n: "entry · in path" },
                { id: "7002", n: "middle · in path" },
                { id: "7003", n: "exit · in path" },
                { id: "7004", n: "available" },
              ].map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] py-1 first:border-t-0"
                >
                  <span className="font-mono text-[9px] text-[var(--text-primary)]">
                    {r.id}
                  </span>
                  <span className="truncate font-sans text-[9px] text-[var(--text-muted)]">
                    {r.n}
                  </span>
                  <span className="shrink-0 font-mono text-[8px] text-[var(--verdict-complete)]">
                    active
                  </span>
                </li>
              ))}
              {/* the relay just added to the path - amber-flashed */}
              <li
                className="anim-codify mt-0.5 flex items-center justify-between gap-2 rounded-[var(--r-chip)] border px-1.5 py-1"
                style={{ borderColor: "var(--verdict-escalate)" }}
              >
                <span className="font-mono text-[9px] font-medium text-[var(--text-primary)]">
                  7004 ✦
                </span>
                <span className="truncate font-sans text-[9px] text-[var(--text-body)]">
                  new claim verified
                </span>
                <span className="shrink-0 font-mono text-[8px] text-[var(--state-token)]">
                  attested
                </span>
              </li>
            </ul>
          </div>

          {/* - What each hop knows (dark) - */}
          <div className="rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5">
            <Eyebrow>What Each Hop Knows</Eyebrow>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="flex items-start gap-1.5">
                <Pill color="var(--tier-frontier)" className="mt-px shrink-0">
                  entry
                </Pill>
                <p className="min-w-0 font-sans text-[9.5px] leading-snug text-[var(--text-body)]">
                  <span className="font-mono text-[var(--text-muted)]">sees:</span>{" "}
                  you, and the next relay. Not the recipient, not the content.
                </p>
              </div>
              <div className="flex items-start gap-1.5">
                <Pill color="var(--tier-open)" className="mt-px shrink-0">
                  exit
                </Pill>
                <p className="min-w-0 font-sans text-[9.5px] leading-snug text-[var(--text-body)]">
                  <span className="font-mono text-[var(--text-muted)]">sees:</span>{" "}
                  the recipient, and the previous relay. Never you.
                </p>
              </div>
            </div>
          </div>

          {/* - Live activity feed (dark) - */}
          <div className="flex min-h-0 flex-1 flex-col rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <Eyebrow>Live Activity</Eyebrow>
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                ⟳ streaming
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {/* entry-relay row - blue-tinted "in flight" */}
              <li
                className="flex items-center gap-2 rounded-[var(--r-chip)] px-1.5 py-1"
                style={{ backgroundColor: "#cfe0ff14" }}
              >
                <span className="w-20 shrink-0 truncate font-mono text-[9px]" style={{ color: "#cfe0ff" }}>
                  entry relay
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[8.5px]" style={{ color: "#cfe0ff" }}>
                  ▓ packets in flight ▓
                </span>
                <span className="shrink-0 font-mono text-[8px] text-[var(--text-faint)]">
                  09:41:22
                </span>
              </li>
              {/* wallet row */}
              <li className="flex items-center gap-2 px-1.5 py-0.5">
                <span
                  className="w-20 shrink-0 truncate font-mono text-[9px]"
                  style={{ color: "var(--lane-local)" }}
                >
                  issuer
                </span>
                <Pill color="var(--tier-open)" className="shrink-0">
                  token
                </Pill>
                <span className="min-w-0 flex-1 truncate font-sans text-[8.5px] text-[var(--text-muted)]">
                  spent 4c81f0a92b7e · epoch 20461
                </span>
                <span className="shrink-0 font-mono text-[8px] text-[var(--text-faint)]">
                  09:41:08
                </span>
              </li>
              {/* exit row */}
              <li className="flex items-center gap-2 px-1.5 py-0.5">
                <span
                  className="w-20 shrink-0 truncate font-mono text-[9px]"
                  style={{ color: "var(--lane-network)" }}
                >
                  exit relay
                </span>
                <Pill color="var(--tier-open)" className="shrink-0">
                  hop 3
                </Pill>
                <span className="min-w-0 flex-1 truncate font-sans text-[8.5px] text-[var(--text-muted)]">
                  handed off ▸{" "}
                  <span className="text-[var(--text-faint)]">no receipt</span>
                </span>
                <span className="shrink-0 font-mono text-[8px] text-[var(--text-faint)]">
                  09:40:55
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
