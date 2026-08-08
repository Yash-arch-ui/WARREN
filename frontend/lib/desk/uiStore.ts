/**
 * useDeskUIStore - desk-local UI state that is NOT part of the data fold
 * (useTraceStore/useDeskModel) seam: the click-to-filter node selection, the
 * free-text search query, and the sound-cue on/off toggle.
 *
 * Kept deliberately OUT of the DeskModel/DeskController contract - these are pure
 * presentation concerns the components own, so they never touch the swap-proof
 * data seam. Components subscribe with selectors.
 *
 * `soundOn` is persisted to localStorage (key `desk:soundOn`) and rehydrated
 * lazily on the client; it MUST default OFF (browser autoplay policy + good
 * manners - no audio until a user gesture flips it).
 */
"use client";

import { create } from "zustand";
import type { NodeId } from "./contract";

const SOUND_KEY = "desk:soundOn";

/** Read the persisted sound preference (client only; defaults OFF). */
function readSoundPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

interface DeskUIState {
  /** the topology node whose events the trace surfaces are filtered to, or null. */
  nodeFilter: NodeId | null;
  /** free-text search over rules + trace (agent_name / content / family). */
  query: string;
  /** subtle synthesized audio cues on FLAG/ESCALATE/codify/hotkey. Default OFF. */
  soundOn: boolean;

  /** set the active node filter (null clears it). */
  setNodeFilter: (id: NodeId | null) => void;
  /** click a node: toggles it off if it's already the active filter. */
  toggleNodeFilter: (id: NodeId) => void;
  clearNodeFilter: () => void;

  setQuery: (q: string) => void;

  setSoundOn: (on: boolean) => void;
  toggleSound: () => void;
}

export const useDeskUIStore = create<DeskUIState>((set, get) => ({
  // SSR-safe: start OFF on the server, rehydrate from localStorage on the client
  // (see rehydrateSound below, called once on mount from the DeskHeader toggle).
  nodeFilter: null,
  query: "",
  soundOn: false,

  setNodeFilter: (id) => set({ nodeFilter: id }),
  toggleNodeFilter: (id) =>
    set((s) => ({ nodeFilter: s.nodeFilter === id ? null : id })),
  clearNodeFilter: () => set({ nodeFilter: null }),

  setQuery: (q) => set({ query: q }),

  setSoundOn: (on) => {
    try {
      window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      // ignore quota / privacy-mode failures - in-memory state still flips.
    }
    set({ soundOn: on });
  },
  toggleSound: () => get().setSoundOn(!get().soundOn),
}));

/** Rehydrate the persisted sound pref on the client (call once, post-mount). */
export function rehydrateSoundPref() {
  const persisted = readSoundPref();
  if (persisted !== useDeskUIStore.getState().soundOn) {
    useDeskUIStore.setState({ soundOn: persisted });
  }
}
