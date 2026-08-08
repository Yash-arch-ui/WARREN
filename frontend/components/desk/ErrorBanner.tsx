"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTraceStore } from "@/lib/store/useTraceStore";

/**
 * ErrorBanner - a thin desk-wide strip shown ONLY when the live stream is
 * conclusively down (connection === "error"; LiveSSEAdapter escalates here on a
 * CLOSED socket / persistent onerror / a dead-on-connect timeout). A transient
 * flap reads "reconnecting" and is NOT surfaced here - this is the node-down
 * affordance. Reads `connection` from the same store source as ConnectionStatus.
 *
 * Restraint: --verdict-flag red on the obsidian backbone, frost type. Never
 * the in-flight blue (reserved for packets on the wire). Slides in under reduced
 * motion the banner renders in its final state immediately (no transform/opacity
 * animation), per the design-system fallback rule.
 */
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function ErrorBanner() {
  const connection = useTraceStore((s) => s.connection);
  const reduce = useReducedMotion() ?? false;
  const down = connection === "error";

  return (
    <AnimatePresence initial={false}>
      {down ? (
        <motion.div
          key="node-down"
          role="status"
          aria-live="polite"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
          style={{ overflow: "hidden" }}
        >
          <div
            className="flex items-center gap-2.5 px-6 py-2 text-[12px]"
            style={{
              backgroundColor: "var(--bg-page)",
              borderBottom: "1px solid var(--state-failed)",
              boxShadow: "inset 3px 0 0 0 var(--state-failed)",
            }}
          >
            <span
              aria-hidden
              className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: "var(--state-failed)" }}
            />
            <span style={{ color: "var(--state-failed)", fontWeight: 600 }}>
              No node reachable
            </span>
            <span style={{ color: "var(--text-body)" }}>
              - is `warren serve` running? Showing last known state.
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
