/**
 * ReplayClock - the single mock playback engine for /desk.
 *
 * Replaces the controller's fire-and-forget `setTimeout` fan-out with a stateful,
 * scrubbable player: one recurring timer walks a loaded fixture into useTraceStore
 * frame-by-frame, and the transport (ReplayTransport) drives play/pause/seek/speed
 * off this store. It writes into useTraceStore exactly like the old `play()`, so
 * useDeskModel and every component are untouched (the swap-proof seam holds).
 *
 * MOCK ONLY. Live mode streams real frames over EventSource (store.connect +
 * LiveSSEAdapter) and never touches this clock - you can't scrub a live LLM run.
 *
 * Connection coupling: mock playback IS a recorded replay, so the clock sets the
 * trace store's connection to "replay" while loaded and "idle" once reset - this
 * is what finally drives the ConnectionStatus pill + ReplayBanner honestly,
 * instead of the page hard-setting "connected".
 */
"use client";

import { create } from "zustand";
import type { WireEvent } from "../types";
import { useTraceStore } from "../store/useTraceStore";
import { framesFor } from "../fixtures/registry";

export type ClockSpeed = 0.5 | 1 | 2 | 4;
export type ClockStatus = "idle" | "playing" | "paused" | "ended";

/** Base inter-frame cadence at 1×; divided by `speed`. */
const BASE_STEP_MS = 900;
/** Short handshake before the first frame so play() feels responsive. */
const HANDSHAKE_MS = 140;

/** Module-scoped timer (kept out of state so the store stays serializable). */
let ticker: ReturnType<typeof setTimeout> | null = null;
function clearTicker() {
  if (ticker) {
    clearTimeout(ticker);
    ticker = null;
  }
}

/** Mock playback is honestly a recorded replay - map status → connection pill. */
function syncConnection(status: ClockStatus) {
  useTraceStore.getState().setConnection(status === "idle" ? "idle" : "replay");
}

interface ClockState {
  /** the loaded fixture's trace id (null when idle). */
  traceId: string | null;
  /** the full loaded sequence. */
  frames: WireEvent[];
  /** playhead - count of frames already pushed (0..frames.length). */
  index: number;
  status: ClockStatus;
  speed: ClockSpeed;

  /** load a fixture by trace id; resets the trace, parks paused at frame 0. */
  load: (traceId: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** rebuild the trace to exactly `index` frames (scrubber drag). */
  seek: (index: number) => void;
  setSpeed: (s: ClockSpeed) => void;
  /** extend the sequence with post-playback frames (Confirm/Reject tails) and
   *  push them now, so a later seek can replay them too. */
  append: (frames: WireEvent[]) => void;
  reset: () => void;
}

export const useClockStore = create<ClockState>((set, get) => {
  /** Push the frame under the playhead, advance, and schedule the next tick. */
  function tick() {
    const { frames, index, status } = get();
    if (status !== "playing") return;
    if (index >= frames.length) {
      clearTicker();
      set({ status: "ended" });
      syncConnection("ended");
      return;
    }
    useTraceStore.getState().pushEvent(frames[index]);
    const next = index + 1;
    if (next >= frames.length) {
      clearTicker();
      set({ index: next, status: "ended" });
      syncConnection("ended");
    } else {
      set({ index: next });
      ticker = setTimeout(tick, BASE_STEP_MS / get().speed);
    }
  }

  return {
    traceId: null,
    frames: [],
    index: 0,
    status: "idle",
    speed: 1,

    load: (traceId) => {
      clearTicker();
      useTraceStore.getState().reset();
      set({ traceId, frames: framesFor(traceId), index: 0, status: "paused" });
      syncConnection("paused");
    },

    play: () => {
      const { frames, index, status } = get();
      if (!frames.length) return;
      clearTicker();
      // restart from the top if we'd run off the end.
      if (status === "ended" || index >= frames.length) {
        useTraceStore.getState().reset();
        set({ index: 0, status: "playing" });
      } else {
        set({ status: "playing" });
      }
      syncConnection("playing");
      ticker = setTimeout(tick, HANDSHAKE_MS);
    },

    pause: () => {
      clearTicker();
      if (get().status === "playing") {
        set({ status: "paused" });
        syncConnection("paused");
      }
    },

    toggle: () => {
      if (get().status === "playing") get().pause();
      else get().play();
    },

    seek: (target) => {
      const { frames } = get();
      clearTicker();
      const i = Math.max(0, Math.min(Math.round(target), frames.length));
      const trace = useTraceStore.getState();
      trace.reset();
      for (let k = 0; k < i; k++) trace.pushEvent(frames[k]);
      const ended = frames.length > 0 && i >= frames.length;
      set({ index: i, status: ended ? "ended" : "paused" });
      syncConnection(ended ? "ended" : "paused");
    },

    setSpeed: (speed) => {
      set({ speed });
      // re-arm so a mid-play speed change takes effect on the very next frame.
      if (get().status === "playing") {
        clearTicker();
        ticker = setTimeout(tick, BASE_STEP_MS / speed);
      }
    },

    append: (extra) => {
      if (!extra.length) return;
      const trace = useTraceStore.getState();
      extra.forEach((e) => trace.pushEvent(e));
      const merged = [...get().frames, ...extra];
      set({ frames: merged, index: merged.length, status: "ended" });
      syncConnection("ended");
    },

    reset: () => {
      clearTicker();
      useTraceStore.getState().reset();
      set({ traceId: null, frames: [], index: 0, status: "idle" });
      syncConnection("idle");
    },
  };
});
