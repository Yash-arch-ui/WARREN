/**
 * PipelineNode - one custom xyflow node = one actor on the mix path.
 *
 * Status visuals (NodeView.status):
 *   idle       → dim, muted border
 *   active     → lit frost ring + scale, amber accent
 *   done       → settled (lane-tone border, normal text)
 *   in_flight  → THE load-bearing visual: --state-inflight fill, breathing
 *                `.anim-band-pulse` halo, "▓ packets in flight ▓" label. It
 *                stays on for a send, because a sender never learns that a
 *                message landed — there is no acknowledgement to wait for.
 *
 * Failure-flip: when the message errored, recolor toward --state-failed.
 *
 * Reduced-motion: the parent passes `staticMode`; when true we render the final
 * resting state of every status with NO animation (no pulse, no scale).
 */
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { NodeId, NodeStatus } from "@/lib/desk/contract";
import type { Lane } from "@/lib/types";
import { NODE_W, NODE_H } from "./layout";

/** Which connection handles a node exposes (horizontal flow + the pros/def fan). */
export type NodeHandles = {
  tLeft: boolean; // target - incoming from the left (the path)
  tTop: boolean; // target - incoming from above (sender ← directory)
  tBottom: boolean; // target - incoming from below (sender ← token issuer)
  sRight: boolean; // source - outgoing to the right (the path)
  sBottom: boolean; // source - outgoing downward (directory → sender)
};

export type PipelineNodeData = {
  nodeId: NodeId;
  label: string;
  lane: Lane;
  status: NodeStatus;
  detail: string | null;
  /** what this node is trusted to learn - shown as the card tooltip. */
  knows: string;
  /** true when the message errored (drives the red flip). */
  failed: boolean;
  /** reduced-motion: render final state, no animation. */
  staticMode: boolean;
  /** true when this node is the active click-to-filter selection (neutral ring). */
  selected: boolean;
  /** which connection handles this node needs (derived from EDGES). */
  handles: NodeHandles;
};

export type PipelineFlowNode = Node<PipelineNodeData, "pipeline">;

/** Lane tone: what runs on this machine vs. what runs out on the network. */
const LANE_COLOR: Record<Lane, string> = {
  send: "var(--lane-local)",
  receive: "var(--lane-network)",
};

const LANE_LABEL: Record<Lane, string> = {
  send: "LOCAL",
  receive: "REMOTE",
};

const HANDLE_STYLE = {
  width: 6,
  height: 6,
  background: "var(--border-strong)",
  border: "none",
} as const;

function PipelineNodeImpl({ data }: NodeProps<PipelineFlowNode>) {
  const { status, failed, staticMode, handles, selected } = data;
  const waiting = status === "in_flight";

  // resolve the accent that drives border + ring + tone label.
  let accent = "var(--border-default)";
  let toneLabel: { text: string; color: string } | null = null;
  if (waiting) {
    accent = "var(--state-inflight)";
    toneLabel = { text: "▓ packets in flight ▓", color: "var(--state-inflight)" };
  } else if (failed) {
    accent = "var(--state-failed)";
    toneLabel = { text: "FAILED", color: "var(--state-failed)" };
  } else if (status === "active") {
    accent = "var(--state-token)";
  } else if (status === "done") {
    accent = LANE_COLOR[data.lane];
  }

  const dim = status === "idle";
  const lit = status === "active" && !staticMode;

  const baseRing = waiting
    ? undefined // pulse halo via className handles the glow
    : status === "active"
      ? `0 0 0 1px ${accent}, 0 0 20px var(--band-blue-glow)`.replace(
          "var(--band-blue-glow)",
          "rgba(245,158,11,0.28)",
        )
      : failed
        ? `0 0 0 1px ${accent}, 0 0 18px rgba(239,68,68,0.25)`
        : "none";

  // neutral selection ring (NOT --band-blue, which is SACRED). Layered OUTSIDE
  // any status ring so the click-to-filter selection reads on every state.
  const SELECT_RING = "0 0 0 2px var(--border-strong), 0 0 0 4px var(--bg-inset)";
  const ring = selected
    ? baseRing && baseRing !== "none"
      ? `${SELECT_RING}, ${baseRing}`
      : SELECT_RING
    : baseRing;

  return (
    <div
      className={waiting && !staticMode ? "anim-band-pulse" : undefined}
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: waiting ? "rgba(59,130,246,0.12)" : "var(--bg-card)",
        border: `1px solid ${accent}`,
        borderRadius: "var(--r-card)",
        padding: "9px 12px",
        opacity: dim ? 0.5 : 1,
        boxShadow: ring,
        cursor: "default",
        transform: lit ? "scale(1.04)" : "scale(1)",
        transition: staticMode
          ? "none"
          : "transform var(--dur-fast) var(--ease-spring), opacity var(--dur-fast) var(--ease-out), border-color 240ms var(--ease-out), box-shadow 240ms var(--ease-out), background 240ms var(--ease-out)",
        color: "var(--text-primary)",
      }}
    >
      {handles.tLeft && (
        <Handle id="t-left" type="target" position={Position.Left} style={HANDLE_STYLE} isConnectable={false} />
      )}
      {handles.tTop && (
        <Handle id="t-top" type="target" position={Position.Top} style={HANDLE_STYLE} isConnectable={false} />
      )}
      {handles.tBottom && (
        <Handle id="t-bottom" type="target" position={Position.Bottom} style={HANDLE_STYLE} isConnectable={false} />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: waiting ? "var(--state-inflight)" : "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.label}
        </span>
        {data.knows && (
          <span
            title={`Knows: ${data.knows}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: LANE_COLOR[data.lane],
              }}
            />
            {LANE_LABEL[data.lane]}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: LANE_COLOR[data.lane] }}>{LANE_LABEL[data.lane]}</span>
        {toneLabel ? (
          <span style={{ color: toneLabel.color, fontWeight: 600 }}>{toneLabel.text}</span>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>{status}</span>
        )}
      </div>

      {handles.sRight && (
        <Handle id="s-right" type="source" position={Position.Right} style={HANDLE_STYLE} isConnectable={false} />
      )}
      {handles.sBottom && (
        <Handle id="s-bottom" type="source" position={Position.Bottom} style={HANDLE_STYLE} isConnectable={false} />
      )}
    </div>
  );
}

export const PipelineNode = memo(PipelineNodeImpl);
