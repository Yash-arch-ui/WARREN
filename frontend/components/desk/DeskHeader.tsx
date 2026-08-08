"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Logomark from "@/components/landing/Logomark";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskController } from "@/lib/desk/controller";
import { useDemoStore, startDemo, stopDemo } from "@/lib/desk/autopilot";
import { useDeskUIStore, rehydrateSoundPref } from "@/lib/desk/uiStore";
import { primeAudio } from "@/lib/desk/sound";
import { IS_MOCK } from "@/lib/config";
import ConnectionStatus from "./ConnectionStatus";

/**
 * DeskHeader - the live-desk top bar. Angular logomark + wordmark, the
 * ConnectionStatus pill, a ReplayBanner chip (shown only while the stream is
 * replaying a recorded trace), and DemoControls: the scripted traces + reset
 * that drive the DeskController. The header is the operator's cockpit chrome.
 *
 * Optional `onOpenAudit` surfaces the packet-path drawer toggle from here so the whole
 * desk has a single chrome bar.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type DeskHeaderProps = {
  onOpenAudit?: () => void;
};

function ReplayBanner() {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] rounded-[var(--r-chip)] border px-2 py-1"
      style={{
        color: "var(--verdict-escalate)",
        borderColor: "var(--verdict-escalate)",
        background: "#fbf0dd",
      }}
    >
      <span aria-hidden>⟲</span> REPLAY
    </motion.span>
  );
}

function DemoButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "ghost";
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.15, ease: EASE }}
      className="font-mono text-[10px] uppercase tracking-wider rounded-[var(--r-chip)] border px-2.5 py-1.5 transition-colors"
      style={
        variant === "ghost"
          ? {
              borderColor: "var(--border-subtle)",
              color: "var(--text-muted)",
              background: "transparent",
            }
          : {
              borderColor: "var(--border-default)",
              color: "var(--text-body)",
              background: "var(--bg-inset)",
            }
      }
    >
      {label}
    </motion.button>
  );
}

/** AUTO-PILOT chip + live narration line, shown only while the tour runs. */
function AutoPilotStrip() {
  const caption = useDemoStore((s) => s.caption);
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex w-full items-center gap-2.5 border-t border-[var(--hairline)] pt-2.5"
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--band-blue)", borderColor: "var(--band-blue-dim)", background: "#e8f1ff" }}
      >
        <span className="h-[6px] w-[6px] rounded-full anim-band-pulse" style={{ background: "var(--band-blue)" }} />
        Auto-pilot
      </span>
      <span className="truncate font-mono text-[11px] text-[var(--text-body)]">{caption}</span>
    </motion.div>
  );
}

/**
 * SoundToggle - speaker/mute for the synthesized desk cues (lib/desk/sound.ts).
 * Default OFF; persisted in useDeskUIStore + localStorage. The click is the user
 * gesture that lazily primes the AudioContext (browser autoplay policy), so cues
 * only ever fire after this has been turned on.
 */
function SoundToggle() {
  const reduce = useReducedMotion() ?? false;
  const soundOn = useDeskUIStore((s) => s.soundOn);
  const toggleSound = useDeskUIStore((s) => s.toggleSound);

  return (
    <motion.button
      type="button"
      onClick={() => {
        // prime audio on the gesture, THEN flip - so turning it on can sound.
        primeAudio();
        toggleSound();
      }}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.15, ease: EASE }}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Mute desk cues" : "Enable desk cues"}
      title={soundOn ? "Sound cues: on" : "Sound cues: off"}
      className="font-mono text-[10px] uppercase tracking-wider rounded-[var(--r-chip)] border px-2.5 py-1.5 transition-colors"
      style={{
        borderColor: soundOn ? "var(--border-strong)" : "var(--border-subtle)",
        color: soundOn ? "var(--text-primary)" : "var(--text-muted)",
        background: soundOn ? "var(--bg-inset)" : "transparent",
      }}
    >
      {soundOn ? "♪ On" : "♪ Off"}
    </motion.button>
  );
}

function DemoControls() {
  const controller = useDeskController();
  const demoActive = useDemoStore((s) => s.active);
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)] mr-1 hidden md:inline">
        demo
      </span>
      <DemoButton label="Send" onClick={controller.runSend} />
      <DemoButton label="Receive" onClick={controller.runReceive} />
      <DemoButton label="Cover" onClick={controller.runCover} />
      {IS_MOCK ? (
        <DemoButton
          label={demoActive ? "■ Stop" : "▶ 90s Demo"}
          onClick={demoActive ? stopDemo : startDemo}
        />
      ) : null}
      <DemoButton
        label="Reset"
        onClick={() => {
          stopDemo();
          controller.resetDesk();
        }}
        variant="ghost"
      />
    </div>
  );
}

export default function DeskHeader({ onOpenAudit }: DeskHeaderProps) {
  const connection = useTraceStore((s) => s.connection);
  const demoActive = useDemoStore((s) => s.active);

  // rehydrate the persisted sound pref once on the client (SSR-safe default OFF).
  useEffect(() => {
    rehydrateSoundPref();
  }, []);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3.5 border-b border-[var(--hairline)] bg-[var(--bg-nav)]">
      <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
        <Logomark size={18} />
        <span className="font-semibold tracking-wide text-[13px]">
          WARREN
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          · LIVE DESK
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {connection === "replay" ? <ReplayBanner /> : null}
        <ConnectionStatus state={connection} />
        <SoundToggle />
        {onOpenAudit ? (
          <DemoButton label="Path ▦" onClick={onOpenAudit} variant="ghost" />
        ) : null}
      </div>

      <div className="w-full flex md:w-auto md:ml-2">
        <DemoControls />
      </div>

      {demoActive ? <AutoPilotStrip /> : null}
    </header>
  );
}
