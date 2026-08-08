/**
 * Cover traffic: relays emit constant-rate Poisson dummy packets that are
 * shaped exactly like real ones and dropped at the exit. To an observer
 * counting packets, a silent node and a busy node look the same — which is why
 * these frames deliberately read almost identically to a real send.
 */
import type { WireEvent } from "../types";

const ROOM = "cover";
const T0 = 1_767_225_620_000;

const beat = (offset: number, n: number): WireEvent => ({
  ts: T0 + offset,
  node: "entry",
  kind: "sphinx",
  direction: "out",
  msg_id: `cover-${n}`,
  peer: "—",
  room: ROOM,
  state: "IN_FLIGHT",
  detail: `cover packet ${n} pushed into 127.0.0.1:7001 → 127.0.0.1:7002 → 127.0.0.1:7003`,
});

export const COVER_FRAMES: WireEvent[] = [
  {
    ts: T0,
    node: "sender",
    kind: "directory",
    direction: "out",
    msg_id: "cover-0",
    peer: "—",
    room: ROOM,
    state: "QUEUED",
    detail: "constant-rate cover traffic active (Poisson, bypasses the admission gate)",
  },
  // Exponentially-spaced, because a fixed interval would itself be a signature.
  beat(430, 1),
  beat(1_180, 2),
  beat(1_390, 3),
  beat(2_650, 4),
  {
    ts: T0 + 2_900,
    node: "exit",
    kind: "deliver",
    direction: "out",
    msg_id: "cover-4",
    peer: "—",
    room: ROOM,
    state: "DELIVERED",
    detail: "cover packets dropped at the exit relay; no recipient, no delivery",
  },
];
