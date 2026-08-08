/**
 * BandEdge - one custom xyflow edge = one pipeline/Band hop.
 *
 * - Wire edges (data.kind != null) carry a small mono label naming what crosses.
 * - `active` lights the stroke (frost). Cross-Band active edges tint --band-blue.
 * - The investigator→specialist edge carries a TRAVELING blue pulse dot while
 *   `data.bandPulse` is true (model.bandWaiting) - the "blue is not a for-loop"
 *   signal that a real round-trip is in flight.
 * - Reduced-motion (`data.staticMode`): no traveling dot; the edge renders its
 *   final lit/dim stroke only.
 */
"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { EventKind } from "@/lib/types";

export type BandEdgeData = {
  kind: EventKind | null;
  active: boolean;
  /** traveling blue pulse (investigator→specialist while waiting on Band). */
  bandPulse: boolean;
  staticMode: boolean;
};

export type BandFlowEdge = Edge<BandEdgeData, "band">;

const KIND_LABEL: Record<EventKind, string> = {
  encrypt: "encrypt",
  token: "token",
  sphinx: "sphinx",
  deliver: "deliver",
  decrypt: "decrypt",
  reassemble: "reassemble",
  directory: "signed list",
  error: "error",
};

function BandEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<BandFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const active = data?.active ?? false;
  const isBand = (data?.kind ?? null) !== null;
  const bandPulse = data?.bandPulse ?? false;
  const staticMode = data?.staticMode ?? false;

  const stroke = bandPulse
    ? "var(--band-blue)"
    : active
      ? isBand
        ? "var(--band-blue)"
        : "var(--text-body)"
      : "var(--border-default)";

  const strokeWidth = active || bandPulse ? 1.8 : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth,
          opacity: active || bandPulse ? 1 : 0.55,
          transition: "stroke 240ms var(--ease-out), opacity 240ms var(--ease-out)",
        }}
      />

      {/* Traveling Band pulse - animated dot riding the path. */}
      {bandPulse && !staticMode && (
        <circle r={3.5} fill="var(--band-blue)">
          <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
        </circle>
      )}

      {isBand && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 8.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: active ? "var(--band-blue)" : "var(--text-faint)",
              background: "var(--bg-page)",
              border: `1px solid ${active ? "var(--band-blue)" : "var(--hairline)"}`,
              borderRadius: 4,
              padding: "1px 5px",
              transition: "color 240ms var(--ease-out), border-color 240ms var(--ease-out)",
            }}
          >
            {KIND_LABEL[data!.kind as EventKind]}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const BandEdge = memo(BandEdgeImpl);
