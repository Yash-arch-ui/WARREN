/**
 * One flag selects the data source. Components never know which adapter is live.
 *   NEXT_PUBLIC_DATA_MODE = mock | live      (default: mock)
 *   NEXT_PUBLIC_API_BASE  = http://127.0.0.1:8801   (this node's `warren serve`)
 *   NEXT_PUBLIC_DEFAULT_PEER = handle from the daemon's [peers] config
 *
 * `warren serve` binds loopback only, so the live mode is a local-first UI: the
 * browser talks to a daemon on this machine that holds the wallet and ratchet.
 * There is no hosted API to point at, by design.
 */
export const DATA_MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";

export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8801";

/** Pre-filled recipient in the composer. */
export const DEFAULT_PEER: string =
  process.env.NEXT_PUBLIC_DEFAULT_PEER ?? "bob";

export const IS_MOCK = DATA_MODE === "mock";
