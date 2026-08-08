/**
 * Autopilot — a hands-free guided tour of the three scripted traces, for when
 * the desk is on a screen nobody is driving.
 *
 * It runs the same controller actions a person would click, and narrates each
 * beat in one line so the topology is never animating unexplained. Mock mode
 * only: there is nothing to script on a live wire.
 */
"use client";

import { create } from "zustand";
import { useClockStore } from "./clock";

interface DemoState {
  active: boolean;
  caption: string;
  set: (patch: Partial<DemoState>) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  active: false,
  caption: "",
  set: (patch) => set(patch),
}));

/** One beat: a caption, an optional action, and how long to hold it. */
type Beat = { at: number; caption: string; run?: () => void };

const BEATS: Beat[] = [
  {
    at: 0,
    caption: "Sending: the body is split into Sphinx-sized packets…",
    run: () => {
      useClockStore.getState().load("send");
      useClockStore.getState().play();
    },
  },
  {
    at: 4_000,
    caption: "…each packet spends one blind-signed admission token.",
  },
  {
    at: 9_000,
    caption:
      "Three hops. The entry relay knows the sender, the exit knows the recipient, neither knows both.",
  },
  {
    at: 14_000,
    caption:
      "No delivery receipt comes back — a receipt would be the correlation this is built to prevent.",
  },
  {
    at: 20_000,
    caption: "Receiving: packets arrive out of order, because mix delays are random.",
    run: () => {
      useClockStore.getState().load("receive");
      useClockStore.getState().play();
    },
  },
  {
    at: 27_000,
    caption: "Reassembled. Note the path panel is empty — the recipient cannot see the route.",
  },
  {
    at: 33_000,
    caption: "Cover traffic: constant-rate dummy packets, shaped exactly like real ones.",
    run: () => {
      useClockStore.getState().load("cover");
      useClockStore.getState().play();
    },
  },
  {
    at: 40_000,
    caption: "To an observer counting packets, a silent node and a busy node look identical.",
  },
  {
    at: 46_000,
    caption: "Tour complete.",
    run: () => stopDemo(),
  },
];

let timers: ReturnType<typeof setTimeout>[] = [];

export function startDemo() {
  stopDemo();
  useDemoStore.getState().set({ active: true, caption: BEATS[0].caption });
  for (const beat of BEATS) {
    timers.push(
      setTimeout(() => {
        useDemoStore.getState().set({ caption: beat.caption });
        beat.run?.();
      }, beat.at),
    );
  }
}

export function stopDemo() {
  timers.forEach(clearTimeout);
  timers = [];
  useDemoStore.getState().set({ active: false, caption: "" });
}
