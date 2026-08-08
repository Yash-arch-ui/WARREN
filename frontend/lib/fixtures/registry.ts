import type { WireEvent } from "../types";
import { SEND_FRAMES } from "./send";
import { RECEIVE_FRAMES } from "./receive";
import { COVER_FRAMES } from "./cover";

/**
 * The single fixture registry — one source of truth shared by the replay clock
 * (mock player), the live adapter's `?replay=` parity, and the transport
 * picker. Keyed by trace id.
 */
export interface TraceMeta {
  id: string;
  /** short transport-picker label. */
  label: string;
  /** one-line outcome blurb. */
  blurb: string;
}

/** Picker order: the outbound story → the inbound story → the cover story. */
export const TRACES: TraceMeta[] = [
  { id: "send", label: "Send", blurb: "3 packets, 3 tokens → IN_FLIGHT" },
  { id: "receive", label: "Receive", blurb: "arrives out of order → DELIVERED" },
  { id: "cover", label: "Cover traffic", blurb: "indistinguishable from real sends" },
];

export const FIXTURES: Record<string, WireEvent[]> = {
  send: SEND_FRAMES,
  receive: RECEIVE_FRAMES,
  cover: COVER_FRAMES,
};

export const DEFAULT_TRACE = "send";

/** Resolve a trace id to its frame sequence, falling back to the default. */
export function framesFor(traceId?: string | null): WireEvent[] {
  return (traceId && FIXTURES[traceId]) || FIXTURES[DEFAULT_TRACE];
}
