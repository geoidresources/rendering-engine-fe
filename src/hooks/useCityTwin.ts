// React Query hooks for the city digital twin domain.
//
// Two hooks:
//   - useCityTwin(slug)            — twin metadata + active conversion URLs
//   - useConversionEvents(slug,id) — live progress events with incremental tail

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCityTwin,
  listConversionEvents,
} from "@/lib/api/cityTwinApi";
import type { CityTwin, ConversionEvent } from "@/types/city-twin";

const TWIN_STALE_MS = 30_000;
const EVENTS_POLL_MS = 1500; // 1.5 s gives near-real-time UX without hammering the server

/** Fetch a twin by slug. Re-fetched every 30 s while mounted. */
export function useCityTwin(slug: string | null | undefined) {
  return useQuery<CityTwin, Error>({
    queryKey: ["city-twin", slug],
    queryFn: () => {
      if (!slug) throw new Error("city twin slug is required");
      return getCityTwin(slug);
    },
    enabled: !!slug,
    staleTime: TWIN_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Polls the conversion events endpoint and accumulates new rows.
 *
 * Why polling over EventSource:
 *   1. EventSource cannot send Authorization headers — we'd have to add
 *      query-string auth on the SSE route. Polling reuses the existing
 *      bearer-token interceptor.
 *   2. React Query handles caching + invalidation + retry uniformly with
 *      the rest of the codebase.
 *   3. At 1.5 s cadence the UX is indistinguishable from push.
 *
 * The hook keeps the running list of events in component state so consecutive
 * polls *append* rather than replace — never lose intermediate events even
 * if the server returns a smaller window.
 *
 * Auto-stops once a terminal event ('completed' or 'failed') is seen.
 */
export function useConversionEvents(
  slug: string | null | undefined,
  conversionId: string | null | undefined,
) {
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const lastIdRef = useRef(0);

  // Reset accumulator when the (slug, conversionId) pair changes.
  useEffect(() => {
    setEvents([]);
    lastIdRef.current = 0;
  }, [slug, conversionId]);

  const isTerminal = useMemo(
    () =>
      events.some(
        (e) => e.stage === "completed" || e.stage === "failed",
      ),
    [events],
  );

  const query = useQuery<ConversionEvent[], Error>({
    queryKey: ["city-twin-events", slug, conversionId, "tail"],
    queryFn: async () => {
      if (!slug || !conversionId) return [];
      return listConversionEvents(slug, conversionId, lastIdRef.current, 500);
    },
    enabled: !!slug && !!conversionId && !isTerminal,
    refetchInterval: isTerminal ? false : EVENTS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  // Append new rows to the accumulator whenever a poll returns fresh data.
  useEffect(() => {
    if (!query.data || query.data.length === 0) return;
    setEvents((prev) => {
      const latest = query.data!;
      const maxId = latest.reduce((m, e) => (e.id > m ? e.id : m), lastIdRef.current);
      lastIdRef.current = maxId;
      return [...prev, ...latest];
    });
  }, [query.data]);

  // Per-kind summary the UI uses to render the progress chips.
  const byKind = useMemo(() => {
    const ks: Record<
      string,
      { kind: string; status: "pending" | "running" | "complete" | "failed"; lastMessage?: string; percentage?: number }
    > = {};
    for (const e of events) {
      const k = e.kind || "run";
      if (!ks[k]) ks[k] = { kind: k, status: "pending" };
      // Map workflow status → UI status. 'progress' keeps it 'running'.
      if (e.status === "started" || e.status === "progress") ks[k].status = "running";
      if (e.status === "complete") ks[k].status = "complete";
      if (e.status === "failed") ks[k].status = "failed";
      if (e.message) ks[k].lastMessage = e.message;
      if (e.percentage != null) ks[k].percentage = e.percentage;
    }
    return Object.values(ks);
  }, [events]);

  return {
    events,
    byKind,
    isTerminal,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
