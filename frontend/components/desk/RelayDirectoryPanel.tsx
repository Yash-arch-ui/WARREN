"use client";

import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskUIStore } from "@/lib/desk/uiStore";
import { relayMatchesQuery } from "@/lib/desk/filter";
import { useRelays } from "@/lib/api/queries";
import { IS_MOCK } from "@/lib/config";
import { MOCK_DIRECTORY } from "@/lib/fixtures/node";
import type { RelayEntry } from "@/lib/types";

/**
 * RelayDirectoryPanel - the signed relay list this client routes through.
 *
 * Lists `model.relays` as cards: mono address, role badge, identity + sphinx
 * keys, in-path status. The header shows the K-of-N directory policy, which is
 * the load-bearing fact: a relay list is only trusted when at least `threshold`
 * of `signers` independent directory keys have attested it. Without that,
 * whoever serves the list chooses your entire path.
 *
 * The three relays this client actually routes through are marked IN PATH and
 * rise above the rest.
 */

const ROLE_LABEL: Record<NonNullable<RelayEntry["role"]>, string> = {
  entry: "Entry",
  middle: "Middle",
  exit: "Exit",
};

const STATUS_COLOR: Record<RelayEntry["status"], string> = {
  IN_PATH: "var(--state-delivered)",
  AVAILABLE: "var(--text-muted)",
};

/** Shorten a 64-char hex key to something readable but still identifying. */
function shortKey(key: string): string {
  return key.length > 16 ? `${key.slice(0, 8)}…${key.slice(-6)}` : key;
}

function RelayCard({ relay, reduce }: { relay: RelayEntry; reduce: boolean }) {
  const inPath = relay.status === "IN_PATH";
  return (
    <li
      className={inPath && !reduce ? "anim-codify" : undefined}
      style={{
        backgroundColor: "var(--bg-inset)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-chip)",
        padding: "12px 14px",
        listStyle: "none",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono"
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          {relay.address}
        </span>
        <span
          className="font-sans"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: STATUS_COLOR[relay.status],
          }}
        >
          {relay.status === "IN_PATH" ? "in path" : "available"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {relay.role && (
          <span
            className="font-sans"
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--text-body)",
              backgroundColor: "var(--bg-card-2)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-chip)",
              padding: "2px 7px",
            }}
          >
            {ROLE_LABEL[relay.role]}
          </span>
        )}
        <span
          className="font-mono"
          style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 4px" }}
          title={`sphinx key ${relay.sphinx_key}`}
        >
          sphinx={shortKey(relay.sphinx_key)}
        </span>
      </div>

      <div
        className="mt-2 font-mono"
        style={{ fontSize: 10.5, color: "var(--text-faint)" }}
        title={relay.identity_key}
      >
        id {shortKey(relay.identity_key)}
      </div>

      {inPath && (
        <div
          className="mt-2 font-mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--state-delivered)",
            letterSpacing: "0.02em",
          }}
        >
          ✓ claim signature verified
        </div>
      )}
    </li>
  );
}

export default function RelayDirectoryPanel() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;
  const query = useDeskUIStore((s) => s.query);
  const relaysQ = useRelays();
  const directory = IS_MOCK ? MOCK_DIRECTORY : relaysQ.data ?? MOCK_DIRECTORY;
  const allRelays = model.relays;

  // Free-text search narrows the visible rows by address/role/key.
  const relays = query.trim()
    ? allRelays.filter((r) => relayMatchesQuery(r, query))
    : allRelays;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
      }}
      className="px-5 py-5"
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--text-muted)",
          }}
        >
          Relay Directory
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: directory.policy_enforced
              ? "var(--state-delivered)"
              : "var(--text-body)",
            transition: reduce ? undefined : "color 0.45s var(--ease-out)",
          }}
          title={
            directory.policy_enforced
              ? "The list is accepted only when at least K of N configured directory keys attest it."
              : "No directory keys configured — the list is trusted on relay self-signatures alone."
          }
        >
          {directory.attestations}/{directory.threshold} of {directory.signers}
        </span>
      </div>

      <div
        className="mt-1 font-sans"
        style={{ fontSize: 11, color: "var(--text-faint)" }}
      >
        {directory.policy_enforced
          ? `K-of-N attested — needs ${directory.threshold} independent signers`
          : "No K-of-N policy configured (self-signatures only)"}
      </div>

      <ul className="mt-4 flex flex-col gap-2.5" style={{ padding: 0, margin: 0 }}>
        {relays.length === 0 ? (
          <li
            className="font-sans"
            style={{ listStyle: "none", fontSize: 13, color: "var(--text-faint)" }}
          >
            No relays match “{query.trim()}”.
          </li>
        ) : (
          relays.map((relay) => (
            <RelayCard key={relay.address} relay={relay} reduce={reduce} />
          ))
        )}
      </ul>
    </div>
  );
}
