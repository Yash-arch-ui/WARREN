"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskUIStore } from "@/lib/desk/uiStore";
import { nodeIdForSource } from "@/lib/desk/nodes";
import type { TimelineDot } from "@/lib/desk/contract";

/**
 * WireTimeline - vertical dot timeline of a message's journey.
 *
 * Renders `model.timeline` (TimelineDot[]). Dot color maps from `tone`:
 *   sent → --state-inflight · token → --state-token · hop → --state-inflight
 *   delivered → --state-delivered · cover → --state-cover · error → --state-failed
 *
 * When a send is followed by a delivery, the segment connecting them re-shades
 * to the delivered tone. `font-mono` HH:MM:SS stamps sliced from the ISO `ts`.
 * Reduced-motion renders final colors immediately.
 */

const TONE_VAR: Record<TimelineDot["tone"], string> = {
  sent: "var(--state-inflight)",
  token: "var(--state-token)",
  hop: "var(--state-inflight)",
  delivered: "var(--state-delivered)",
  cover: "var(--state-cover)",
  error: "var(--state-failed)",
  neutral: "var(--text-faint)",
};

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function WireTimeline() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;
  const nodeFilter = useDeskUIStore((s) => s.nodeFilter);
  const query = useDeskUIStore((s) => s.query);

  // Apply the click-to-filter node selection + free-text search. A dot's `label`
  // is its topology node, so the node match folds through nodeIdForSource and
  // the text match runs over that same label.
  const dots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.timeline.filter((d) => {
      if (nodeFilter && nodeIdForSource(d.label) !== nodeFilter) return false;
      if (q && !d.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [model.timeline, nodeFilter, query]);

  // Track whether a delivery has landed after a send - drives the re-shade.
  const [flipped, setFlipped] = useState(false);
  const sawFlag = useRef(false);

  const hasPass = dots.some((d) => d.tone === "sent");
  const flagIndex = dots.findIndex((d) => d.tone === "delivered");
  const passToFlag = hasPass && flagIndex > 0;

  useEffect(() => {
    if (reduce) {
      setFlipped(passToFlag);
      return;
    }
    if (passToFlag && !sawFlag.current) {
      sawFlag.current = true;
      setFlipped(true);
    }
  }, [passToFlag, reduce]);

  if (dots.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-card)",
        }}
        className="px-5 py-5"
      >
        <Eyebrow />
        <p
          className="mt-4 font-sans"
          style={{ fontSize: 13, color: "var(--text-faint)" }}
        >
          Nothing on the wire yet…
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
      }}
      className="px-5 py-5"
    >
      <Eyebrow />
      <ol className="mt-5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {dots.map((dot, i) => {
          const isLast = i === dots.length - 1;
          // The connector below this dot. Re-shade the segment that leads INTO
          // the flag dot from amber (transition) to red on PASS→FLAG.
          const leadsToFlag = flagIndex > 0 && i === flagIndex - 1;
          const connectorColor =
            leadsToFlag && flipped
              ? "var(--verdict-flag)"
              : "var(--hairline)";

          return (
            <li
              key={dot.id}
              className="relative flex gap-4"
              style={{ paddingBottom: isLast ? 0 : 20 }}
            >
              {/* rail + dot */}
              <div
                className="relative flex flex-col items-center"
                style={{ width: 12 }}
              >
                <motion.span
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: TONE_VAR[dot.tone],
                    boxShadow:
                      dot.tone === "hop" || dot.tone === "sent"
                        ? "0 0 10px var(--band-blue-glow)"
                        : "none",
                    flex: "0 0 auto",
                    zIndex: 1,
                  }}
                />
                {!isLast && (
                  <motion.span
                    aria-hidden
                    style={{
                      width: 2,
                      flex: 1,
                      marginTop: 2,
                      backgroundColor: connectorColor,
                    }}
                    animate={{ backgroundColor: connectorColor }}
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }
                    }
                  />
                )}
              </div>

              {/* label + timestamp */}
              <div className="flex flex-col gap-0.5 pb-0">
                <span
                  className="font-sans"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-body)",
                    textTransform: "capitalize",
                  }}
                >
                  {dot.label}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: "var(--text-muted)",
                  }}
                >
                  {dot.ts.slice(11, 19)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Eyebrow() {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        color: "var(--text-muted)",
      }}
    >
      Wire Timeline
    </span>
  );
}
