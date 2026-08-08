/**
 * Desk controller. Implements the DeskController contract for both data modes:
 * in mock mode the scripted traces drive the scrubbable ReplayClock; in live
 * mode the same actions POST to `warren serve` and let the real SSE stream
 * drive the fold. The surface is identical across modes, so components never
 * branch on it.
 */
"use client";

import { useTraceStore } from "../store/useTraceStore";
import { useClockStore } from "./clock";
import { api } from "../api/client";
import { IS_MOCK } from "../config";
import type { DeskController, TraceView } from "./contract";
import type { Message, WireEvent } from "../types";

/**
 * Typed error for a failed action. The api client throws a plain Error whose
 * message embeds the HTTP status (`POST <path> -> <status>`); we re-throw as
 * this so callers can map `.status` to an inline reason without re-parsing
 * strings. `.status` is null when no code is present.
 */
export class DeskActionError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message: string) {
    super(message);
    this.name = "DeskActionError";
    this.status = status;
  }
}

/** Pull the trailing HTTP status off the api client's `... -> <status>` message. */
function toDeskActionError(err: unknown): DeskActionError {
  if (err instanceof DeskActionError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/->\s*(\d{3})\b/);
  const status = match ? Number(match[1]) : null;
  return new DeskActionError(status, message);
}

/** A scheduled fixture player (mock cadence). */
let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
function play(events: WireEvent[], stepMs = 700, startDelay = 0) {
  const push = useTraceStore.getState().pushEvent;
  events.forEach((e, i) => {
    timers.push(setTimeout(() => push(e), startDelay + i * stepMs));
  });
}

/**
 * Packet-detail view for the drawer.
 *
 * A message this node **sent** carries its verified path. A message it
 * **received** carries none — not because the UI failed to load it, but
 * because a recipient cannot learn the route. `pathHidden` lets the drawer say
 * which of the two it is looking at.
 */
export function getTraceView(message: Message | null | undefined): TraceView {
  if (!message) {
    return { messageId: null, hops: [], sha256: null, direction: null, pathHidden: false };
  }
  return {
    messageId: message.id,
    hops: message.hops,
    sha256: message.sha256 || null,
    direction: message.direction,
    pathHidden: message.direction === "recv",
  };
}

const liveController: DeskController = {
  send: async (peer, content) => {
    // Open the stream first so the opening frames the POST kicks off are not
    // missed.
    useTraceStore.getState().connect();
    try {
      await api.send(peer, content);
    } catch (err) {
      console.error("[desk] send failed:", err);
      throw toDeskActionError(err);
    }
  },
  issueTokens: async () => {
    try {
      await api.issueTokens(10);
    } catch (err) {
      console.error("[desk] token issuance failed:", err);
      throw toDeskActionError(err);
    }
  },
  runSend: () => {
    useTraceStore.getState().connect();
  },
  runReceive: () => {
    useTraceStore.getState().connect();
  },
  runCover: () => {
    useTraceStore.getState().connect();
  },
  resetDesk: () => {
    clearTimers();
    useTraceStore.getState().disconnect();
    useTraceStore.getState().reset();
  },
};

/**
 * Mock paths drive the ReplayClock (lib/desk/clock.ts) — the single scrubbable
 * player — so each scripted trace is a load+play. The clock owns the trace
 * reset and connection state.
 */
const mockController: DeskController = {
  send: async (peer, content) => {
    // No daemon in mock mode: narrate a plausible send so the composer still
    // demonstrates the sequence rather than silently doing nothing.
    const now = Date.now();
    const id = `wb-mock-${now.toString(16)}`;
    const packets = Math.max(1, Math.ceil(content.length / 705));
    const frames: WireEvent[] = [
      {
        ts: now,
        node: "sender",
        kind: "encrypt",
        direction: "out",
        msg_id: id,
        peer,
        room: "direct",
        state: "QUEUED",
        detail: `${content.length} B split into ${packets} packet(s) of at most 705 B`,
      },
    ];
    for (let i = 0; i < packets; i += 1) {
      frames.push({
        ts: now + i,
        node: "issuer",
        kind: "token",
        direction: "out",
        msg_id: id,
        peer,
        room: "direct",
        state: "ENCRYPTED",
        detail: `packet ${i + 1}/${packets}: spent admission token (mock)`,
      });
      frames.push({
        ts: now + i,
        node: "entry",
        kind: "sphinx",
        direction: "out",
        msg_id: id,
        peer,
        room: "direct",
        state: "IN_FLIGHT",
        detail: `packet ${i + 1}/${packets} pushed into the mix path`,
      });
    }
    frames.push({
      ts: now,
      node: "exit",
      kind: "deliver",
      direction: "out",
      msg_id: id,
      peer,
      room: "direct",
      state: "IN_FLIGHT",
      detail: "handed to the mix path; delivery is unacknowledged by design",
    });
    useClockStore.getState().append(frames);
    play(frames, 450);
  },
  issueTokens: async () => {
    play(
      [
        {
          ts: Date.now(),
          node: "issuer",
          kind: "token",
          direction: "out",
          msg_id: "",
          peer: "—",
          room: "direct",
          state: "QUEUED",
          detail: "mined proof of work; 10 blind-signed tokens minted (mock)",
        },
      ],
      400,
    );
  },
  runSend: () => {
    useClockStore.getState().load("send");
    useClockStore.getState().play();
  },
  runReceive: () => {
    useClockStore.getState().load("receive");
    useClockStore.getState().play();
  },
  runCover: () => {
    useClockStore.getState().load("cover");
    useClockStore.getState().play();
  },
  resetDesk: () => {
    clearTimers();
    useClockStore.getState().reset();
  },
};

export function useDeskController(): DeskController {
  return IS_MOCK ? mockController : liveController;
}

/**
 * Non-hook read of the current message id from the event stream (NOT a React
 * hook, despite being called from controller actions — reads the store
 * imperatively).
 */
export function currentMessageId(): string | null {
  const events = useTraceStore.getState().events;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].msg_id) return events[i].msg_id;
  }
  return null;
}
