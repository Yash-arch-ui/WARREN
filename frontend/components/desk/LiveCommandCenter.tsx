"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { IS_MOCK } from "@/lib/config";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController } from "@/lib/desk/controller";
import { useInvalidateOnEvents } from "@/lib/api/queries";
import { useHotkeys } from "@/lib/desk/useHotkeys";
import { useSoundCues } from "@/lib/desk/useSoundCues";
import DeskHeader from "@/components/desk/DeskHeader";
import ErrorBanner from "@/components/desk/ErrorBanner";
import StatsBar from "@/components/desk/StatsBar";
import ReplayTransport from "@/components/desk/transport/ReplayTransport";
import { TopologyGraph } from "@/components/desk/topology/TopologyGraph";
import Composer from "@/components/desk/Composer";
import EndpointCards from "@/components/desk/EndpointCards";
import WireTimeline from "@/components/desk/WireTimeline";
import PacketDrawer from "@/components/desk/PacketDrawer";
import RelayDirectoryPanel from "@/components/desk/RelayDirectoryPanel";
import HotkeyLegend from "@/components/desk/HotkeyLegend";

/**
 * LiveCommandCenter - the functional Command Center.
 *
 * Composition only. State flows: fixtures | SSE → useTraceStore → useDeskModel
 * → components. In mock mode the controller drives scripted playback, so we
 * auto-run the send trace once on mount for an out-of-box demo. DemoControls in
 * the header re-trigger send / receive / cover / reset.
 *
 * Embedded as the finale of the /desk showcase scroll-story; point it at a real
 * node with NEXT_PUBLIC_DATA_MODE=live (the contract.ts seam holds, zero
 * component changes).
 */
export function LiveCommandCenter() {
  const model = useDeskModel();
  const controller = useDeskController();
  const connect = useTraceStore((s) => s.connect);
  const connection = useTraceStore((s) => s.connection);
  const eventCount = useTraceStore((s) => s.events.length);
  const [pathOpen, setPathOpen] = useState(false);
  const booted = useRef(false);
  const reduce = useReducedMotion() ?? false;

  // LIVE mode boots into an idle, connected desk: nothing happens until you
  // send something. Hint the user, and dismiss the moment the first event lands
  // (eventCount > 0). Never shown in mock playback.
  const showLiveHint =
    !IS_MOCK && connection === "connected" && eventCount === 0;

  useInvalidateOnEvents();
  useHotkeys();
  useSoundCues();

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (IS_MOCK) {
      controller.runSend();
    } else {
      connect();
    }
    return () => controller.resetDesk();
    // run once on mount; store/controller actions are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="live-desk" className="flex min-h-screen flex-col bg-page text-ink">
      <DeskHeader onOpenAudit={() => setPathOpen(true)} />
      <ErrorBanner />
      <StatsBar />

      <div
        className="mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5"
        style={{ maxWidth: "1470px" }}
      >
        {/* Agents - horizontal band, 1470 x 350. */}
        <section
          aria-label="Mix path topology"
          className="relative h-[350px]"
        >
          <TopologyGraph />
          {showLiveHint ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-page) 55%, transparent)",
                transition: reduce ? undefined : "opacity 0.3s var(--ease-out)",
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  color: "var(--text-muted)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-chip)",
                  padding: "10px 16px",
                }}
              >
                Send a message to begin.
              </div>
            </div>
          ) : null}
        </section>

        {/* Playback transport - mock only, below the agents. */}
        {IS_MOCK ? <ReplayTransport /> : null}

        {/* Lower region: endpoints (left) · wire timeline + composer (right). */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="lg:flex-none">
            <EndpointCards />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <WireTimeline />
            <Composer />
            <RelayDirectoryPanel />
          </div>
        </div>
      </div>

      <HotkeyLegend />

      <PacketDrawer open={pathOpen} onClose={() => setPathOpen(false)} />
    </section>
  );
}
