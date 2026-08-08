/**
 * Static layout source for the TopologyGraph. Positions are hand-tuned to render
 * the mix path as a HORIZONTAL flow, left → right: this node on the far left
 * with its two trust inputs (directory, token issuer) stacked beside it, a
 * vertical divider marking where knowledge of the sender stops, then the three
 * relay hops flowing rightward into the recipient.
 *
 * The divider is the point of the picture: everything right of it is handled by
 * parties that must never learn both ends of the conversation.
 *
 * Coordinates are in xyflow flow-space (px). Authored against a ~158px node.
 */
import type { NodeId } from "@/lib/desk/contract";

export const NODE_W = 158;
export const NODE_H = 70;

/** Horizontal rhythm: one column step along the path. */
const COL = 210;
/** Path vertical centre + the trust-input fan offset. */
const CY = 168;
const FAN = 96;

/** X anchors. The local node sits on the far left; the wall sits in the gutter. */
const X_LOCAL = 0;
const X_WALL = X_LOCAL + NODE_W + 38; // divider between this node and the network
const X0 = X_WALL + 42; // first relay column

/** Per-node absolute position (top-left), keyed by NodeId. Left → right flow. */
export const NODE_POS: Record<NodeId, { x: number; y: number }> = {
  // Trust inputs — stacked above and below this node, feeding into it.
  directory: { x: X_LOCAL, y: CY - FAN - NODE_H / 2 },
  issuer: { x: X_LOCAL, y: CY + FAN - NODE_H / 2 },
  sender: { x: X_LOCAL, y: CY - NODE_H / 2 },

  // The mix path — left → right, one column per hop.
  entry: { x: X0, y: CY - NODE_H / 2 },
  middle: { x: X0 + COL, y: CY - NODE_H / 2 },
  exit: { x: X0 + COL * 2, y: CY - NODE_H / 2 },
  recipient: { x: X0 + COL * 3, y: CY - NODE_H / 2 },
};

/** Right edge of the path (used to bound the lane). */
const X_END = X0 + COL * 3 + NODE_W;
const Y_TOP = NODE_POS.directory.y - 22;
const Y_BOT = NODE_POS.issuer.y + NODE_H + 22;

/**
 * Geometry for the divider (a full-height dashed vertical rail) marking the
 * boundary of what this node can vouch for.
 */
export const WALL = {
  x: X_WALL,
  yTop: Y_TOP,
  height: Y_BOT - Y_TOP,
  width: 2,
};

/**
 * Swimlane background panels (flow-space) — a faint tinted frame + eyebrow
 * label behind each side, so "this machine" and "the network" read as two
 * lanes either side of the divider. Tones are tone-only: a low-opacity border +
 * near-invisible fill, never a loud accent.
 */
export const LANES = [
  {
    key: "local" as const,
    label: "This machine · keys never leave",
    tone: "var(--lane-local)",
    x: X_LOCAL - 16,
    y: Y_TOP,
    width: NODE_W + 32,
    height: Y_BOT - Y_TOP,
  },
  {
    key: "network" as const,
    label: "The mix path · no single relay sees both ends",
    tone: "var(--lane-network)",
    x: X0 - 18,
    y: Y_TOP,
    width: X_END - (X0 - 18) + 16,
    height: Y_BOT - Y_TOP,
  },
];
