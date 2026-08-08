"use client";

/**
 * TanStack Query layer over the REST client (lib/api/client).
 * The desk consumes these hooks; nothing else calls `api` directly.
 */
import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "./client";
import { useTraceStore } from "../store/useTraceStore";
import type { Directory, Identity, Message, NodeStatus, Peer, Stats } from "../types";

/** Query keys — single source of truth for invalidation. */
export const qk = {
  stats: ["stats"] as const,
  relays: ["relays"] as const,
  messages: ["messages"] as const,
  identity: ["identity"] as const,
  peers: ["peers"] as const,
  status: ["status"] as const,
};

export function useStats(): UseQueryResult<Stats> {
  return useQuery({
    queryKey: qk.stats,
    queryFn: () => api.stats(),
    refetchOnWindowFocus: false,
  });
}

export function useRelays(): UseQueryResult<Directory> {
  return useQuery({
    queryKey: qk.relays,
    queryFn: () => api.relays(),
    refetchOnWindowFocus: false,
  });
}

export function useMessages(): UseQueryResult<Message[]> {
  return useQuery({
    queryKey: qk.messages,
    queryFn: () => api.messages(),
    refetchOnWindowFocus: false,
  });
}

export function useIdentity(): UseQueryResult<Identity> {
  return useQuery({
    queryKey: qk.identity,
    queryFn: () => api.me(),
    refetchOnWindowFocus: false,
    // Identity and delivery address are fixed for the life of the daemon.
    staleTime: Infinity,
  });
}

export function usePeers(): UseQueryResult<Peer[]> {
  return useQuery({
    queryKey: qk.peers,
    queryFn: () => api.peers(),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

export function useNodeStatus(): UseQueryResult<NodeStatus> {
  return useQuery({
    queryKey: qk.status,
    queryFn: () => api.status(),
    refetchOnWindowFocus: false,
  });
}

/**
 * Mount once in /desk. Watches the trace store's latest event and, when it
 * signals a change the REST views would show, invalidates those caches so the
 * tiles and lists re-read the daemon's truth.
 *
 * The interesting frames are the ones that change durable state: a token spend
 * (the wallet shrank), a reassembly (a message landed), or an error.
 */
export function useInvalidateOnEvents(): void {
  const queryClient = useQueryClient();
  const latest = useTraceStore((s) => s.events[s.events.length - 1]);

  useEffect(() => {
    if (!latest) return;
    const changesState =
      latest.kind === "token" ||
      latest.kind === "reassemble" ||
      latest.kind === "error" ||
      latest.state === "IN_FLIGHT";
    if (!changesState) return;

    queryClient.invalidateQueries({ queryKey: qk.stats });
    queryClient.invalidateQueries({ queryKey: qk.messages });
    // A token spend changes the wallet balance reported by /agent/me.
    if (latest.kind === "token") {
      queryClient.invalidateQueries({ queryKey: qk.identity });
    }
  }, [latest, queryClient]);
}
