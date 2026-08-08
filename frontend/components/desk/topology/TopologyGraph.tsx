/**
 * TopologyGraph - the /desk CENTERPIECE.
 *
 * An @xyflow/react graph of the mix path, driven entirely by `useDeskModel()`
 * (NodeView[] / EdgeView[]). HORIZONTAL flow: this machine on the LEFT with the
 * directory and token issuer feeding it, a vertical divider, then the three
 * relay hops flowing left→right into the recipient.
 *
 * Load-bearing visual: the relay nodes turn --state-inflight with a breathing
 * halo + "▓ packets in flight ▓" while `model.inFlight`, and a pulse dot travels
 * the sender→entry edge. That state persists on a send rather than resolving,
 * because the sender receives no delivery acknowledgement — showing a tick
 * would be a lie the protocol cannot support.
 *
 * Reduced motion: a `useReducedMotion()` fallback renders the final/static node
 * and edge states with NO animation (passed down as `staticMode`).
 *
 * Takes NO props - it reads the model itself.
 */
"use client";

import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ViewportPortal,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import type { NodeId } from "@/lib/desk/contract";
import { NODE_POS, WALL, LANES } from "./layout";
import { PipelineNode, type PipelineFlowNode, type NodeHandles } from "./PipelineNode";
import { BandEdge, type BandFlowEdge } from "./BandEdge";

const nodeTypes: NodeTypes = { pipeline: PipelineNode };
const edgeTypes: EdgeTypes = { band: BandEdge };

/**
 * Which handles each node exposes for the HORIZONTAL flow. The path connects
 * right(source) → left(target); the two trust inputs (directory above, token
 * issuer below) feed the sender through the vertical handles.
 */
const NODE_HANDLES: Record<NodeId, NodeHandles> = {
  directory: { tLeft: false, tTop: false, tBottom: false, sRight: false, sBottom: true },
  issuer: { tLeft: false, tTop: true, tBottom: false, sRight: false, sBottom: false },
  sender: { tLeft: false, tTop: true, tBottom: true, sRight: true, sBottom: false },
  entry: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  middle: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  exit: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  recipient: { tLeft: true, tTop: false, tBottom: false, sRight: false, sBottom: false },
};

/** Per-edge source/target handle ids (keyed `${from}->${to}`). */
const EDGE_HANDLES: Record<string, { source: string; target: string }> = {
  "directory->sender": { source: "s-bottom", target: "t-top" },
  "issuer->sender": { source: "s-bottom", target: "t-bottom" },
  "sender->entry": { source: "s-right", target: "t-left" },
  "entry->middle": { source: "s-right", target: "t-left" },
  "middle->exit": { source: "s-right", target: "t-left" },
  "exit->recipient": { source: "s-right", target: "t-left" },
};

export function TopologyGraph() {
  const model = useDeskModel();
  const reduce = useReducedMotion();
  const staticMode = !!reduce;

  // failure-flip: a failed send is attributed to the node that refused it -
  // out of tokens or a refused path both stop at the sender.
  const failedNodeId: NodeId | null = useMemo(
    () => (model.message.state === "FAILED" ? "sender" : null),
    [model.message.state],
  );

  const nodes = useMemo<PipelineFlowNode[]>(() => {
    return model.nodes.map((n) => ({
      id: n.id,
      type: "pipeline" as const,
      position: NODE_POS[n.id],
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        nodeId: n.id,
        label: n.label,
        lane: n.lane,
        status: n.status,
        detail: n.detail,
        knows: n.knows,
        failed: n.id === failedNodeId,
        staticMode,
        selected: false,
        handles: NODE_HANDLES[n.id],
      },
    }));
  }, [model.nodes, failedNodeId, staticMode]);

  const edges = useMemo<BandFlowEdge[]>(() => {
    return model.edges.map((e) => {
      const key = `${e.from}->${e.to}`;
      const h = EDGE_HANDLES[key];
      const bandPulse = model.inFlight && e.from === "sender" && e.to === "entry";
      return {
        id: key,
        source: e.from,
        target: e.to,
        type: "band" as const,
        sourceHandle: h?.source ?? null,
        targetHandle: h?.target ?? null,
        data: {
          kind: e.kind,
          active: e.active,
          bandPulse,
          staticMode,
        },
      };
    });
  }, [model.edges, model.inFlight, staticMode]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 350,
        background: "var(--bg-inset)",
        borderRadius: "var(--r-card)",
        border: "1px solid var(--hairline)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.06, minZoom: 0.4, maxZoom: 1.2 }}
        minZoom={0.4}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        nodeOrigin={[0, 0]}
        defaultEdgeOptions={{ type: "band" }}
        style={{ background: "var(--bg-inset)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(20,22,28,0.06)"
        />

        {/* Swimlane panels behind the columns, then the trust divider. */}
        <Swimlanes />
        <TrustBoundary />
      </ReactFlow>
    </div>
  );
}

/**
 * Swimlane panels - a faint desk-toned frame + eyebrow label behind each column,
 * rendered in flow-space (ViewportPortal) so they pan/zoom with the graph. zIndex
 * -1 keeps them behind the nodes; pointer-events off. Desk tones stay tone-only.
 */
function Swimlanes() {
  return (
    <ViewportPortal>
      {LANES.map((lane) => (
        <div
          key={lane.key}
          style={{
            position: "absolute",
            left: lane.x,
            top: lane.y,
            width: lane.width,
            height: lane.height,
            zIndex: -1,
            pointerEvents: "none",
            borderRadius: 16,
            border: `1px solid color-mix(in srgb, ${lane.tone} 28%, transparent)`,
            background: `color-mix(in srgb, ${lane.tone} 6%, transparent)`,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: `color-mix(in srgb, ${lane.tone} 70%, var(--text-faint))`,
              whiteSpace: "nowrap",
            }}
          >
            {lane.label}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}

/**
 * The trust divider rendered in flow-space via a ViewportPortal so it
 * pans/zooms with the graph. It marks where this machine's knowledge stops:
 * everything to its right is handled by parties that must never learn both
 * ends of the conversation. Pure decoration - no handles, no pointer events.
 */
function TrustBoundary() {
  return (
    <ViewportPortal>
      <div
        style={{
          position: "absolute",
          left: WALL.x,
          top: WALL.yTop,
          width: WALL.width,
          height: WALL.height,
          pointerEvents: "none",
          borderLeft: "1px dashed var(--border-default)",
          transform: "translateX(-50%)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-90deg)",
            transformOrigin: "center",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            background: "var(--bg-inset)",
            padding: "2px 8px",
          }}
        >
          Trust Boundary
        </span>
      </div>
    </ViewportPortal>
  );
}
