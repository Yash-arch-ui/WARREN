import { create } from "zustand";
import type { WireEvent, ConnectionState } from "../types";
import {
  createAdapter,
  type EventSourceAdapter,
  type AdapterOpts,
} from "../eventsource/adapter";

/**
 * The single live store. One adapter writes here; every component subscribes
 * via selectors. The adapter instance is module-scoped (not in state) to keep
 * state serializable.
 */
let adapter: EventSourceAdapter | null = null;

interface TraceState {
  events: WireEvent[];
  connection: ConnectionState;
  /** topology node -> latest event, for quick status lookup. */
  latestByNode: Record<string, WireEvent>;

  connect: (opts?: AdapterOpts) => void;
  disconnect: () => void;
  pushEvent: (e: WireEvent) => void;
  setConnection: (s: ConnectionState) => void;
  reset: () => void;
}

export const useTraceStore = create<TraceState>((set, get) => ({
  events: [],
  connection: "idle",
  latestByNode: {},

  pushEvent: (e) =>
    set((s) => ({
      events: [...s.events, e],
      latestByNode: { ...s.latestByNode, [e.node]: e },
    })),

  setConnection: (connection) => set({ connection }),

  connect: (opts) => {
    // Reuse the single long-lived adapter: once a live `/stream` is open, a
    // later connect() is a no-op, so we keep ONE EventSource instead of
    // reopening. A genuine teardown nulls `adapter` via disconnect(), after
    // which a later connect() opens fresh.
    if (adapter) return;
    adapter = createAdapter(opts);
    adapter.connect({
      onEvent: (e) => get().pushEvent(e),
      onState: (connection) => set({ connection }),
    });
  },

  disconnect: () => {
    adapter?.disconnect();
    adapter = null;
    set({ connection: "idle" });
  },

  reset: () => set({ events: [], latestByNode: {} }),
}));
