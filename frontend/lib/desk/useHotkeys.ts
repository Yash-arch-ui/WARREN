/**
 * useHotkeys - keyboard shortcuts for the desk operator. Mounted once in
 * app/desk/page.tsx.
 *
 *   A      → run Beat A          (mock only)
 *   B      → run Beat B          (mock only)
 *   C      → run R&D loop        (mock only)
 *   Space  → toggle the ReplayClock (play / pause)   (mock only)
 *   R      → reset the desk
 *
 * Ignored when focus is in an input / textarea / contenteditable / select, and
 * when a modifier (⌘/Ctrl/Alt) is held - so it never steals browser shortcuts or
 * the SearchBar's typing. Clock/beat keys are gated behind IS_MOCK (you can't
 * scrub or re-fire a live LLM run); R always works.
 *
 * When sound is on, a beat hotkey plays a soft "tick" (the AudioContext is
 * already primed by the time the user has toggled sound - both are gestures).
 */
"use client";

import { useEffect } from "react";
import { useClockStore } from "./clock";
import { useDeskController } from "./controller";
import { useDeskUIStore } from "./uiStore";
import { playCue, primeAudio } from "./sound";
import { IS_MOCK } from "../config";

/** True when the event target is a text-entry surface we must not hijack. */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable === true;
}

export function useHotkeys() {
  const controller = useDeskController();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      const tick = () => {
        if (useDeskUIStore.getState().soundOn) {
          // a keypress is a user gesture - safe to lazily prime the context so a
          // rehydrated "on" preference can sound without first clicking the toggle.
          primeAudio();
          playCue("tick");
        }
      };

      // Space is keyed by code (it has no printable key char worth matching).
      if (e.code === "Space") {
        if (!IS_MOCK) return;
        e.preventDefault();
        useClockStore.getState().toggle();
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          if (!IS_MOCK) return;
          e.preventDefault();
          controller.runSend();
          tick();
          break;
        case "b":
          if (!IS_MOCK) return;
          e.preventDefault();
          controller.runReceive();
          tick();
          break;
        case "c":
          if (!IS_MOCK) return;
          e.preventDefault();
          controller.runCover();
          tick();
          break;
        case "r":
          e.preventDefault();
          controller.resetDesk();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // controller is a stable ref (mock/live singleton); IS_MOCK is constant.
  }, [controller]);
}
