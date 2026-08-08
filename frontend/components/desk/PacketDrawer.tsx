"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { TraceView } from "@/lib/desk/contract";
import type { Hop } from "@/lib/types";
import { useMessages } from "@/lib/api/queries";
import { getTraceView, currentMessageId } from "@/lib/desk/controller";
import { useTraceStore } from "@/lib/store/useTraceStore";

/**
 * PacketDrawer - where a message actually went. A right slide-over listing the
 * verified path hop by hop: each relay address, its role, and the identity and
 * sphinx keys the packet was built for. The header badge reports whether the
 * path was verified before any token was spent.
 *
 * The asymmetry is the whole point, and the drawer states it outright: a
 * message this node SENT has a full path, because this node chose it and
 * checked every relay's signed claim. A message it RECEIVED has none, because
 * the recipient cannot see where it came from. That empty state is the
 * anonymity guarantee, not missing data — so it gets an explanation, not a
 * spinner.
 *
 * Controlled: pass `{open, onClose}`.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const EMPTY_TRACE: TraceView = {
  messageId: null,
  hops: [],
  sha256: null,
  direction: null,
  pathHidden: false,
};

type PacketDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** optional override - the message whose path to show. */
  trace?: TraceView;
};

const short = (h: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "∅");

function HopRow({ hop, index }: { hop: Hop; index: number }) {
  return (
    <li className="border-b border-[var(--hairline)] last:border-0 py-3">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-[var(--text-primary)] truncate font-mono">
          {hop.addr}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)] rounded-[var(--r-chip)] border border-[var(--border-subtle)] px-1.5 py-0.5">
          {hop.role}
        </span>
        <span className="font-mono text-[9px] ml-auto shrink-0 text-[var(--text-faint)]">
          hop {hop.index + 1}
        </span>
      </div>
      <p className="font-mono text-[10px] text-[var(--text-body)] mt-1.5" title={hop.sphinx_key}>
        sphinx {short(hop.sphinx_key)}
      </p>
      <p className="font-mono text-[10px] mt-1 text-[var(--text-faint)]" title={hop.identity_key}>
        identity {short(hop.identity_key)}
      </p>
    </li>
  );
}

export default function PacketDrawer({ open, onClose, trace }: PacketDrawerProps) {
  const reduce = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLElement | null>(null);

  // Follow whichever message the stream is currently narrating.
  const events = useTraceStore((s) => s.events);
  const messagesQ = useMessages();
  const activeId = events.length ? currentMessageId() : null;
  const message = messagesQ.data?.find((m) => m.id === activeId) ?? messagesQ.data?.[0];

  const liveLoading = messagesQ.isLoading && !messagesQ.data;
  const view: TraceView = trace ?? (message ? getTraceView(message) : EMPTY_TRACE);
  // A path is verified whenever we have one: the hops were cross-checked
  // against the signed relay list and each relay's live claim before the packet
  // was built, and a mismatch refuses the send outright.
  const verified = view.hops.length > 0;

  // Modal a11y: focus trap + restore + ESCAPE-to-close, active only while open.
  useEffect(() => {
    if (!open) return;

    const saved = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    // Move focus into the panel on open (the close button if present, else the
    // panel itself via its tabIndex={-1}).
    const initial = focusables()[0] ?? panel;
    initial?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        // Nothing focusable but the panel - keep focus pinned inside it.
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !panel?.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !panel?.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever was focused before the drawer opened.
      saved?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="path-scrim"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55"
            aria-hidden
          />
          <motion.aside
            key="path-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Message path - verified hops"
            tabIndex={-1}
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: EASE }}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-[440px] border-l border-[var(--border-default)] bg-[var(--bg-card)] flex flex-col outline-none"
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Message path
                </p>
                <p className="font-mono text-[11px] text-[var(--text-faint)] mt-0.5 truncate">
                  {liveLoading
                    ? "loading…"
                    : `${view.messageId ?? "no message"} · ${view.hops.length} hop${view.hops.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {liveLoading ? (
                <span className="font-mono text-[11px] rounded-[var(--r-chip)] border border-[var(--border-subtle)] px-2 py-1 shrink-0 text-[var(--text-faint)]">
                  path …
                </span>
              ) : (
                <span
                  className="font-mono text-[11px] rounded-[var(--r-chip)] border px-2 py-1 shrink-0"
                  style={{
                    color: verified ? "var(--state-delivered)" : "var(--text-muted)",
                    borderColor: verified
                      ? "var(--state-delivered)"
                      : "var(--border-subtle)",
                  }}
                  title={
                    verified
                      ? "Every hop was checked against the signed relay list and its live claim before a token was spent."
                      : "No path to show from this side."
                  }
                >
                  path {verified ? "verified ✓" : "hidden"}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close path drawer"
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none px-1 transition-colors"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {liveLoading ? (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-12"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--text-muted)] animate-spin"
                  />
                  <p className="font-mono text-[11px] text-[var(--text-faint)] lowercase tracking-wider">
                    loading path…
                  </p>
                  <ul aria-hidden className="mt-2 w-full flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <li
                        key={i}
                        className="h-10 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--bg-card-2)] animate-pulse"
                      />
                    ))}
                  </ul>
                </div>
              ) : view.pathHidden ? (
                <div className="py-8 px-1">
                  <p className="text-[12px] text-[var(--text-body)] leading-relaxed">
                    This message was <strong>received</strong>, so there is no path
                    to show.
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mt-3">
                    A recipient decrypts packets that simply arrive. Nothing in
                    them records where they have been — each relay stripped its
                    own layer and knows only its immediate neighbours. The blank
                    panel is the guarantee working, not a loading failure.
                  </p>
                </div>
              ) : view.hops.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] py-8 text-center">
                  no message selected yet.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {view.hops.map((hop, i) => (
                    <HopRow key={`${hop.addr}-${i}`} hop={hop} index={i} />
                  ))}
                </ul>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-[var(--border-subtle)]">
              <p className="font-mono text-[10px] text-[var(--text-faint)]">
                {view.sha256
                  ? `sha256(ciphertext) ${short(view.sha256)}`
                  : "no relay on the path sees both ends"}
              </p>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
