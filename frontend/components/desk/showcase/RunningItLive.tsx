"use client";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * RunningItLive - report §14 / D13. The runtime layout (browser · Next.js :4100 ·
 * FastAPI :8000 · Band + model providers) and the exact commands to run it,
 * keyless or full-live. Reveal-on-scroll; terminal-styled command blocks.
 */

type Node = { title: string; sub: string; tone: string };
const RUNTIME: Node[] = [
  { title: "Browser", sub: "Command Center", tone: "var(--text-primary)" },
  { title: "Next.js", sub: ":4100", tone: "var(--desk-surv)" },
  { title: "FastAPI", sub: ":8000", tone: "var(--verdict-escalate)" },
];
const EXTERNAL: Node[] = [
  { title: "Band", sub: "mock or real", tone: "var(--band-blue)" },
  { title: "Model providers", sub: "AIML · Featherless", tone: "var(--desk-rnd)" },
];

function NodeBox({ n }: { n: Node }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border px-5 py-3.5 text-center" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
      <span className="font-sans text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</span>
      <span className="mt-0.5 font-mono text-[10px]" style={{ color: n.tone }}>{n.sub}</span>
    </div>
  );
}

function Term({ title, lines }: { title: string; lines: { c: string; comment?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--hairline)", backgroundColor: "rgba(10,11,13,0.7)" }}>
      <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--hairline)" }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--verdict-flag)", opacity: 0.6 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--verdict-escalate)", opacity: 0.6 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--verdict-pass)", opacity: 0.6 }} />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.comment ? "var(--text-faint)" : "var(--text-body)" }}>
            {!l.comment ? <span style={{ color: "var(--verdict-pass)" }}>$ </span> : null}
            {l.c}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function RunningItLive() {
  return (
    <section
      aria-labelledby="desk-run-title"
      className="relative mx-auto px-6 py-28"
      style={{ maxWidth: "var(--maxw-content)", color: "var(--text-primary)" }}
    >
      <Reveal>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          Running it live · §14 · D13
        </span>
      </Reveal>
      <MaskLines
        className="mt-5 font-sans"
        lineClassName="text-[clamp(28px,4vw,48px)] font-light tracking-[-0.02em] leading-[1.06]"
        lines={[
          <span key="l1" id="desk-run-title" style={{ color: "var(--text-primary)" }}>
            Three moving parts.
          </span>,
          <span key="l2" style={{ color: "var(--text-faint)" }}>
            Keyless in two commands.
          </span>,
        ]}
      />
      <Reveal delay={0.08}>
        <p className="mt-6 max-w-2xl font-sans" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
          The browser, the backend, and the outside services it calls. For a quick
          demo you can skip the outside services entirely - mock Band + recorded
          fixtures look identical to a live replay.
        </p>
      </Reveal>

      {/* runtime diagram */}
      <Reveal delay={0.06}>
        <div className="mt-12 rounded-[var(--r-card)] border p-6 sm:p-8" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card-2)" }}>
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-center">
            {RUNTIME.map((n, i) => (
              <div key={n.title} className="flex items-center justify-center gap-3">
                <NodeBox n={n} />
                {i < RUNTIME.length - 1 ? (
                  <span aria-hidden="true" className="font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {i === 0 ? "REST + SSE ›" : "›"}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {/* external services branch */}
          <div className="mt-5 flex flex-col items-center gap-3 md:flex-row md:justify-end md:gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
              FastAPI calls out ›
            </span>
            {EXTERNAL.map((n) => (
              <NodeBox key={n.title} n={n} />
            ))}
          </div>
        </div>
      </Reveal>

      {/* commands */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal delay={0.05}>
          <Term
            title="backend · serves :8000"
            lines={[
              { c: "# leave USE_REAL_BAND=false for the keyless demo", comment: true },
              { c: "cd alpha-oversight" },
              { c: "make run-backend" },
            ]}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <Term
            title="frontend · serves :4100"
            lines={[
              { c: "# .env.local: NEXT_PUBLIC_DATA_MODE=live  (or mock)", comment: true },
              { c: "#             NEXT_PUBLIC_API_BASE=http://localhost:8000", comment: true },
              { c: "npm install && npm run dev" },
            ]}
          />
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <div className="mt-6 flex flex-col gap-3 rounded-[var(--r-card)] border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
          <p className="font-sans text-[13.5px]" style={{ color: "var(--text-body)", lineHeight: 1.55 }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Mock mode needs nothing but the frontend</span> - it
            replays bundled fixtures and looks identical to a live replay. Full
            adversary runs additionally need the model-provider keys.
          </p>
          <a
            href="#live-desk"
            className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-pill)] px-5 py-2.5 font-sans text-[13px] font-medium transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: "var(--frost)", color: "var(--obsidian)" }}
          >
            Run the demo ↓
          </a>
        </div>
      </Reveal>
    </section>
  );
}
