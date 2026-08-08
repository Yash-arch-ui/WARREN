/**
 * A scripted send, exactly as `warren serve` narrates one: split, then per
 * packet a token spend and a push into the entry relay, then the honest
 * admission that delivery is unobservable from here.
 */
import type { WireEvent } from "../types";

const MSG = "wb-f776150a-18c2f9e41d0-3";
const PEER = "bob";
const ROOM = "direct";
const T0 = 1_767_225_600_000;

export const SEND_FRAMES: WireEvent[] = [
  {
    ts: T0,
    node: "sender",
    kind: "encrypt",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "QUEUED",
    detail: "1 482 B split into 3 packet(s) of at most 705 B",
  },
  {
    ts: T0 + 40,
    node: "issuer",
    kind: "token",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "ENCRYPTED",
    detail: "packet 1/3: spent admission token 4c81f0a92b7e (epoch 20461)",
  },
  {
    ts: T0 + 95,
    node: "entry",
    kind: "sphinx",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: "packet 1/3 pushed into 127.0.0.1:7001 → 127.0.0.1:7002 → 127.0.0.1:7003",
  },
  {
    ts: T0 + 150,
    node: "issuer",
    kind: "token",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "ENCRYPTED",
    detail: "packet 2/3: spent admission token 91de7b3c05af (epoch 20461)",
  },
  {
    ts: T0 + 205,
    node: "entry",
    kind: "sphinx",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: "packet 2/3 pushed into 127.0.0.1:7001 → 127.0.0.1:7002 → 127.0.0.1:7003",
  },
  {
    ts: T0 + 260,
    node: "issuer",
    kind: "token",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "ENCRYPTED",
    detail: "packet 3/3: spent admission token 2f60ba845c17 (epoch 20461)",
  },
  {
    ts: T0 + 315,
    node: "entry",
    kind: "sphinx",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: "packet 3/3 pushed into 127.0.0.1:7001 → 127.0.0.1:7002 → 127.0.0.1:7003",
  },
  {
    ts: T0 + 340,
    node: "exit",
    kind: "deliver",
    direction: "out",
    msg_id: MSG,
    peer: PEER,
    room: ROOM,
    state: "IN_FLIGHT",
    detail: "handed to the mix path; delivery is unacknowledged by design",
  },
];
