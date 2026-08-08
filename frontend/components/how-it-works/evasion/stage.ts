/**
 * stage.ts - geometry + helpers for the "The Evasion" pinned scroll-story stage.
 *
 * The stage is a single dark SVG canvas (viewBox 1000×560) showing a horizontal
 * order/time lane. The lane's x-axis is TIME in milliseconds (0 → ~600ms); order
 * events are dots along it; a ~400ms cancel cluster forms the layering evasion; a
 * rule-window bracket spans a candidate time width centered on the cluster; a
 * cancel_to_fill ratio needle sits to the right.
 *
 * Everything here is pure (no React) so EvasionStory can drive it from scroll.
 */

export const VIEW_W = 1000;
export const VIEW_H = 560;

/* ── the time lane ──────────────────────────────────────────────────────────
 * A horizontal axis mapping time (ms) → x (svg units). The lane occupies the
 * left ~62% of the canvas; the ratio gauge lives in the right column. */
export const LANE = {
  x0: 96, // x at t = 0ms
  x1: 660, // x at t = TIME_MAX
  y: 300, // baseline (the lane rail)
  timeMax: 600, // ms at x1
} as const;

/** Map a time in ms → svg x along the lane. */
export function tx(ms: number): number {
  const f = Math.max(0, Math.min(1, ms / LANE.timeMax));
  return LANE.x0 + (LANE.x1 - LANE.x0) * f;
}

/** Map a time WIDTH in ms → svg width along the lane. */
export function twidth(ms: number): number {
  return (Math.max(0, ms) / LANE.timeMax) * (LANE.x1 - LANE.x0);
}

/* Axis tick marks (ms) drawn under the rail. */
export const TICKS = [0, 100, 200, 300, 400, 500, 600] as const;

/* ── benign order flow (chapter 1) ──────────────────────────────────────────
 * Calm places/fills ticking along the lane. `lane` offsets a dot above/below the
 * rail so the flow reads as a book, not a single line. */
export type FlowDot = { ms: number; lane: -1 | 0 | 1; kind: "place" | "fill" };

export const BENIGN_FLOW: FlowDot[] = [
  { ms: 30, lane: 1, kind: "place" },
  { ms: 70, lane: -1, kind: "fill" },
  { ms: 120, lane: 0, kind: "place" },
  { ms: 165, lane: 1, kind: "fill" },
  { ms: 215, lane: -1, kind: "place" },
  { ms: 270, lane: 0, kind: "fill" },
  { ms: 330, lane: 1, kind: "place" },
  { ms: 385, lane: -1, kind: "fill" },
  { ms: 450, lane: 0, kind: "place" },
  { ms: 510, lane: 1, kind: "fill" },
  { ms: 560, lane: -1, kind: "fill" },
];

/** Vertical offset (svg units) for a lane index. */
export function laneY(lane: -1 | 0 | 1): number {
  return LANE.y + lane * 34;
}

/* ── the cancel cluster (chapters 2→) ───────────────────────────────────────
 * Eight CANCEL marks spanning ~400ms - the layering evasion. Centered on the
 * lane mid so the rule-window bracket can sit symmetrically around it. */
export const CLUSTER = {
  startMs: 110,
  endMs: 510, // span ≈ 400ms
  count: 8,
} as const;

export const CLUSTER_CENTER_MS = (CLUSTER.startMs + CLUSTER.endMs) / 2; // 310
export const CLUSTER_SPAN_MS = CLUSTER.endMs - CLUSTER.startMs; // 400

/** x positions of the 8 cancel marks, evenly spread across the cluster span. */
export const CANCEL_XS: number[] = Array.from({ length: CLUSTER.count }, (_, i) => {
  const ms = CLUSTER.startMs + (CLUSTER_SPAN_MS * i) / (CLUSTER.count - 1);
  return tx(ms);
});

/* ── rule-window bracket ─────────────────────────────────────────────────────
 * A bracket centered on the cluster center spanning a candidate window WIDTH.
 * Returns the left/right x for a given window width in ms. */
export function windowBracket(widthMs: number): { left: number; right: number; cx: number } {
  const cx = tx(CLUSTER_CENTER_MS);
  const half = twidth(widthMs) / 2;
  return { left: cx - half, right: cx + half, cx };
}

/* Candidate / final window widths used across the chapters. */
export const WINDOW = {
  seed: 100, // the deterministic seed rule (FINRA-5210-layering)
  prosecution: 420, // prosecution argues a wide window
  defense: 80, // defense argues a tight window
  codified: 450, // human-confirmed widened window (100 → 450)
} as const;

/* ── cancel_to_fill ratio gauge ─────────────────────────────────────────────
 * A vertical bar on the right column; the needle rises with the ratio. */
export const GAUGE = {
  x: 812,
  top: 132, // y at ratio 1.0
  bottom: 452, // y at ratio 0.0
  width: 56,
  threshold: 0.8, // FINRA-5210 spoofing seed rule: cancel ≥ 80% within the window
} as const;

/** Map a ratio (0..1) → needle y on the gauge. */
export function ratioY(ratio: number): number {
  const f = Math.max(0, Math.min(1, ratio));
  return GAUGE.bottom + (GAUGE.top - GAUGE.bottom) * f;
}

export const RATIO = {
  clean: 0.08,
  evasion: 0.94,
} as const;

/* The Chinese-wall divider sweeps across this x (chapter 3). */
export const WALL_X = 472;
