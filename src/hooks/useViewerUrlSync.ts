'use client';

/**
 * V-STATE-01 — URL ↔ viewer-state sync.
 *
 * Mount once from the Viewer. Two-way binding with these rules:
 *  - On mount, decode `?v=` once and apply it to the stores. Subsequent
 *    URL changes are ignored to avoid fly-to thrash while the user is
 *    navigating.
 *  - On every subsequent store change (debounced 500 ms), re-encode and
 *    push the new token back into the URL via `router.replace()` so the
 *    back button isn't spammed with history entries.
 *  - The `?surveyId=` param is preserved untouched.
 */
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useViewerStore, type LayerId } from '@/store/viewerStore';
import { useCompareStore } from '@/store/compareStore';
import {
  VIEWER_URL_PARAM,
  captureFromStore,
  decode,
  encode,
} from '@/lib/viewer/urlState';

const DEBOUNCE_MS = 500;

export function useViewerUrlSync(): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedInitialRef = useRef(false);

  // ── One-shot: decode ?v= and apply to stores ──────────────────────
  useEffect(() => {
    if (appliedInitialRef.current) return;
    appliedInitialRef.current = true;

    const token = searchParams?.get(VIEWER_URL_PARAM);
    const decoded = decode(token);
    if (!decoded) return;

    const v = useViewerStore.getState();
    if (decoded.cam) v.setCameraState(decoded.cam);
    if (decoded.tm) v.setTerrainMode(decoded.tm);
    if (decoded.tool) v.setActiveTool(decoded.tool);
    if (decoded.layers) {
      for (const [id, tuple] of Object.entries(decoded.layers) as [LayerId, [boolean, number]][]) {
        if (tuple) {
          v.setLayerVisibility(id, tuple[0]);
          v.setLayerOpacity(id, tuple[1]);
        }
      }
    }
    if (decoded.cmp) {
      const cmp = useCompareStore.getState();
      cmp.setEpochs(decoded.cmp.a, decoded.cmp.b);
      cmp.setMode(decoded.cmp.m);
      cmp.setSplitPosition(decoded.cmp.sp);
      if (decoded.cmp.en !== cmp.enabled) cmp.toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced encode on store change ──────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const writeToUrl = () => {
      if (!appliedInitialRef.current) return;
      const v = useViewerStore.getState();
      const c = useCompareStore.getState();
      const token = encode(
        captureFromStore({
          camera: v.cameraState,
          terrainMode: v.terrainMode,
          layers: v.layers,
          activeTool: v.activeTool,
          selectedFeatureId: typeof v.selectedFeature?.id === 'string' ? v.selectedFeature.id : null,
          compare: {
            enabled: c.enabled,
            epochA: c.epochA,
            epochB: c.epochB,
            mode: c.mode,
            splitPosition: c.splitPosition,
          },
        }),
      );

      const params = new URLSearchParams(window.location.search);
      if (token) params.set(VIEWER_URL_PARAM, token);
      else params.delete(VIEWER_URL_PARAM);

      const nextQuery = params.toString();
      const currentQuery = window.location.search.replace(/^\?/, '');
      if (nextQuery === currentQuery) return;

      router.replace(
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
        { scroll: false },
      );
    };

    const schedule = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(writeToUrl, DEBOUNCE_MS);
    };

    const unsubViewer = useViewerStore.subscribe(schedule);
    const unsubCompare = useCompareStore.subscribe(schedule);

    return () => {
      if (timeout) clearTimeout(timeout);
      unsubViewer();
      unsubCompare();
    };
  }, [router]);
}
