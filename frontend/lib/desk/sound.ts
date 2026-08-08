/**
 * sound.ts - subtle SYNTHESIZED desk cues via the Web Audio API. No audio asset
 * files: every cue is an oscillator + gain envelope built on the fly.
 *
 * Gating (non-negotiable, browser autoplay policy):
 *   - The AudioContext is created LAZILY on the first user gesture (the sound
 *     toggle calls `primeAudio()`), never at import/mount.
 *   - Callers must check `useDeskUIStore.getState().soundOn` before triggering -
 *     this module just synthesizes; it does not read the toggle itself.
 *   - If the context is suspended (tab backgrounded / pre-gesture), cues no-op.
 *
 * Cue vocabulary (kept tasteful - short, low-velocity blips, never a jingle):
 *   flag      → a tense two-note minor drop (alert)
 *   escalate  → a rising two-note prompt (attention / hand-off to human)
 *   codify    → a soft resolved major third (success / rule written)
 *   tick      → a single faint blip (hotkey beat trigger)
 */
"use client";

type CueKind = "flag" | "escalate" | "codify" | "tick";

let ctx: AudioContext | null = null;

/** Lazily create / resume the AudioContext. MUST be called from a user gesture. */
export function primeAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** One enveloped sine blip. `delay` lets us sequence two-note cues. */
function blip(freq: number, when: number, dur: number, peak: number): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  // fast attack, exponential-ish decay - a soft pluck, not a beep.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * Play a cue. No-ops unless the context exists AND is running - so it stays
 * silent before the user has primed audio via the toggle (a gesture).
 */
export function playCue(kind: CueKind): void {
  if (!ctx || ctx.state !== "running") return;
  switch (kind) {
    case "flag":
      // tense minor drop: A5 → F5
      blip(880, 0, 0.18, 0.14);
      blip(698, 0.1, 0.22, 0.13);
      break;
    case "escalate":
      // rising prompt: E5 → B5
      blip(659, 0, 0.16, 0.12);
      blip(988, 0.12, 0.26, 0.13);
      break;
    case "codify":
      // resolved soft major third: C6 → E6, low velocity
      blip(1047, 0, 0.16, 0.1);
      blip(1319, 0.11, 0.3, 0.11);
      break;
    case "tick":
      // single faint blip for a hotkey beat trigger
      blip(740, 0, 0.07, 0.07);
      break;
  }
}
