/**
 * useSoundCues - watches the trace stream for newly-arrived terminal/verdict
 * markers and fires a synthesized cue (lib/desk/sound.ts) when sound is ON.
 *
 * Gating: cues only fire when `useDeskUIStore.soundOn` is true AND the audio
 * context has been primed by a prior user gesture (playCue no-ops otherwise).
 * We track the last-seen event count so a cue fires once per NEW frame, never on
 * re-render or backward scrub (seek rebuilds the trace → count drops, no cue).
 *
 * Event → cue:  error → "flag" · token spend → "escalate" · delivered → "codify".
 * A soft "tick" on hotkey beats is fired directly from useHotkeys, not here.
 */
"use client";

import { useEffect, useRef } from "react";
import { useTraceStore } from "../store/useTraceStore";
import { useDeskUIStore } from "./uiStore";
import { playCue } from "./sound";
import type { WireEvent } from "../types";

/** The cue (if any) a single frame should trigger. */
function cueForEvent(e: WireEvent): "flag" | "escalate" | "codify" | null {
  // Reuses the existing three cue samples: a delivery is the resolving tone,
  // a token spend the mid tone, an error the alert.
  if (e.kind === "reassemble") return "codify";
  if (e.kind === "token") return "escalate";
  if (e.kind === "error") return "flag";
  return null;
}

export function useSoundCues() {
  const events = useTraceStore((s) => s.events);
  // how many events we've already evaluated - only the tail is "new".
  const seen = useRef(0);

  useEffect(() => {
    const len = events.length;
    // backward jump (seek/reset) - re-baseline silently, no cue replay.
    if (len < seen.current) {
      seen.current = len;
      return;
    }
    if (len === seen.current) return;

    const soundOn = useDeskUIStore.getState().soundOn;
    if (soundOn) {
      // fire a cue for the most relevant new frame (the newest wins if several
      // arrive in one batch - mock pushes one at a time, so this is usually one).
      for (let i = len - 1; i >= seen.current; i--) {
        const cue = cueForEvent(events[i]);
        if (cue) {
          playCue(cue);
          break;
        }
      }
    }
    seen.current = len;
  }, [events]);
}
