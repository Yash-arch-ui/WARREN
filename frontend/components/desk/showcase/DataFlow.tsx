"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { useIsMobile } from "@/components/landing/useIsMobile";
import { DeskBackdrop } from "./DeskBackdrop";

/**
 * DataFlow - report §12 / D12. How live data reaches the screen, as a PINNED
 * scroll-scrub: the section holds while a token walks the pipeline stage by
 * stage (Event bus → /stream → traceStore → useDeskModel → Panels), each
 * lighting up with its caption as you scroll. Reduced motion / mobile fall back
 * to a static stacked diagram.
 */

type Stage = { key: string; title: string; sub: string; body: string; tone: string };
const STAGES: Stage[] = [
  { key: "bus", title: "Backend · :8000", sub: "event bus", body: "Every agent action and REST mutation originates here. One case runs at a time.", tone: "var(--desk-rnd)" },
  { key: "sse", title: "/stream", sub: "SSE", body: "A single JSON ActivityEvent frame per action - desk-tagged, reasoning stripped - streamed to the browser.", tone: "var(--desk-surv)" },
  { key: "store", title: "traceStore", sub: "events", body: "An append-only zustand log of raw events. The honest record of exactly what crossed the wire.", tone: "var(--desk-surv)" },
  { key: "model", title: "useDeskModel", sub: "fold", body: "One step folds the raw events into a single tidy DeskModel every panel reads from - and emits markers (verdict · escalate · codify).", tone: "var(--verdict-escalate)" },
  { key: "panels", title: "Panels", sub: "topology · timeline · dossiers · rules · audit", body: "Each panel renders from the model. A marker also triggers a TanStack Query refetch of /stats · /rules · /audit.", tone: "var(--band-blue)" },
];

const N = STAGES.length;

function StageNode({ t, i, stage }: { t: MotionValue<number>; i: number; stage: Stage }) {
  const active = useTransform(t, (v) => {
    const d = Math.abs(v * (N - 1) - i);
    return d <= 0.5 ? 1 : Math.max(0, 1 - (d - 0.5) * 1.4);
  });
  const borderColor = useTransform(active, (a) => (a > 0.4 ? stage.tone : "var(--border-default)"));
  const scale = useTransform(active, [0, 1], [0.96, 1.04]);
  const glow = useTransform(active, (a) => `0 0 ${a * 26}px ${a > 0.4 ? stage.tone + "55" : "transparent"}`);
  return (
    <motion.div
      className="relative flex flex-1 flex-col items-center rounded-[12px] border px-3 py-4 text-center"
      style={{ borderColor, scale, boxShadow: glow, backgroundColor: "var(--bg-card)" }}
    >
      <motion.span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: stage.tone, opacity: active }}>
        0{i + 1}
      </motion.span>
      <span className="mt-1 font-sans text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{stage.title}</span>
      <span className="mt-0.5 font-mono text-[9.5px]" style={{ color: "var(--text-faint)" }}>{stage.sub}</span>
    </motion.div>
  );
}

function PinnedDataFlow() {
  const runwayRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: runwayRef, offset: ["start start", "end end"] });
  const t = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.0001 });

  // active caption index → crossfade the body text
  const fillScaleX = useTransform(t, [0, 1], [0, 1]);

  return (
    <div ref={runwayRef} className="relative" style={{ height: `${N * 34 + 40}vh` }}>
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] items-center overflow-hidden">
        <DeskBackdrop glow={false} />
        <div className="relative mx-auto w-full px-6" style={{ maxWidth: "var(--maxw-content)" }}>
          <Reveal>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Data flow · §12 · D12
            </span>
          </Reveal>
          <h2 className="mt-4 font-sans" style={{ fontSize: "clamp(26px,3.6vw,42px)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.08, color: "var(--text-primary)" }}>
            How live data reaches the screen.
          </h2>

          {/* the horizontal flow */}
          <div className="relative mt-16">
            {/* progress rail behind the nodes */}
            <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 md:block" style={{ backgroundColor: "var(--hairline)" }}>
              <motion.div className="h-full origin-left" style={{ scaleX: fillScaleX, backgroundColor: "var(--desk-surv)", opacity: 0.6 }} />
            </div>
            <div className="relative flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-2">
              {STAGES.map((s, i) => (
                <div key={s.key} className="flex items-center md:flex-1">
                  <StageNode t={t} i={i} stage={s} />
                  {i < N - 1 ? (
                    <span aria-hidden="true" className="mx-1 hidden font-mono text-[14px] md:inline" style={{ color: "var(--text-faint)" }}>›</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* active-stage captions, crossfaded */}
          <div className="relative mx-auto mt-12 h-24 max-w-2xl text-center">
            {STAGES.map((s, i) => {
              const center = i / (N - 1);
              const half = 0.5 / (N - 1);
              return (
                <DataCaption key={s.key} t={t} center={center} half={half} body={s.body} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataCaption({ t, center, half, body }: { t: MotionValue<number>; center: number; half: number; body: string }) {
  const opacity = useTransform(t, [center - half, center - half * 0.4, center + half * 0.4, center + half], [0, 1, 1, 0]);
  return (
    <motion.p className="absolute inset-x-0 top-0 mx-auto font-sans" style={{ opacity, fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>
      {body}
    </motion.p>
  );
}

function StaticDataFlow() {
  return (
    <div className="mx-auto px-6 py-24" style={{ maxWidth: "var(--maxw-content)" }}>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        Data flow · §12 · D12
      </span>
      <h2 className="mt-4 font-sans" style={{ fontSize: "clamp(26px,3.6vw,42px)", fontWeight: 300, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
        How live data reaches the screen.
      </h2>
      <ol className="mt-10 flex flex-col gap-3">
        {STAGES.map((s, i) => (
          <li key={s.key} className="rounded-[12px] border p-4" style={{ borderColor: "var(--hairline)", backgroundColor: "var(--bg-card)" }}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px]" style={{ color: s.tone }}>0{i + 1}</span>
              <span className="font-sans text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{s.title}</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--text-faint)" }}>{s.sub}</span>
            </div>
            <p className="mt-2 font-sans text-[13px]" style={{ color: "var(--text-body)", lineHeight: 1.55 }}>{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DataFlow() {
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  return (
    <section aria-label="How live data reaches the screen" className="relative" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      {reduce || isMobile === true ? <StaticDataFlow /> : <PinnedDataFlow />}
    </section>
  );
}
