/**
 * A scripted receive. Note what is missing: no entry/middle/exit frames, and
 * no sender address — a recipient decrypts packets that simply arrive, and
 * learns nothing about the path they took. The packets also land out of order,
 * which is the Poisson mix delay doing its job.
 */
import type { WireEvent } from "../types";

const MSG = "wb-0e2ce946-18c2f9e6b41-1";
const PEER = "0e2ce946cd82";
const ROOM = "direct";
const T0 = 1_767_225_607_000;

export const RECEIVE_FRAMES: WireEvent[] = [
  {
    ts: T0,
    node: "recipient",
    kind: "decrypt",
    direction: "in",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: `packet 2/3 decrypted from ${PEER}`,
  },
  {
    ts: T0 + 420,
    node: "recipient",
    kind: "decrypt",
    direction: "in",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: `packet 1/3 decrypted from ${PEER}`,
  },
  {
    ts: T0 + 1_130,
    node: "recipient",
    kind: "decrypt",
    direction: "in",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: `packet 3/3 decrypted from ${PEER}`,
  },
  {
    ts: T0 + 2_640,
    node: "recipient",
    kind: "reassemble",
    direction: "in",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "DELIVERED",
    detail: "1 106 B reassembled from 3 packet(s); path unknown to the receiver",
  },
];
