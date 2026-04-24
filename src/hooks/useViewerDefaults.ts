/**
 * V-STATE-02 — persist per-user viewer defaults to localStorage so layer
 * visibility, terrain mode, tool choice, etc. survive page reloads.
 *
 * Storage key: `viewer:defaults:{userId}` — one slot per user so shared
 * machines don't bleed preferences between accounts.
 *
 * On mount: if no `?v=` URL param is present (which carries a full shared
 * state snapshot that must take precedence), seed the store from the stored
 * defaults. On every relevant store change: write the current values back.
 *
 * Scope: layers, terrainMode, blendPreset, activeTool,
 * terrainExaggeration, pointBudget. NOT camera (URL state owns that) and
 * NOT activeSurveyId / activePresetId (session-specific).
 */
'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useViewerStore } from '@/store/viewerStore';
import { getStoredUser } from '@/lib/auth';

interface ViewerDefaults {
  layers: ReturnType<typeof useViewerStore.getState>['layers'];
  terrainMode: ReturnType<typeof useViewerStore.getState>['terrainMode'];
  blendPreset: ReturnType<typeof useViewerStore.getState>['blendPreset'];
  activeTool: ReturnType<typeof useViewerStore.getState>['activeTool'];
  terrainExaggeration: number;
  pointBudget: number;
}

function storageKey(userId: string): string {
  return `viewer:defaults:${userId}`;
}

function readDefaults(userId: string): ViewerDefaults | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as ViewerDefaults;
  } catch {
    return null;
  }
}

function writeDefaults(userId: string, defaults: ViewerDefaults): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(defaults));
  } catch {
    // Storage quota exceeded or private-browsing restriction — silent no-op.
  }
}

export function useViewerDefaults(): void {
  const searchParams = useSearchParams();
  const hasUrlState = searchParams?.has('v') ?? false;
  const seededRef = useRef(false);

  // Mount: apply stored defaults when no shared-URL state is present.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (hasUrlState) return; // URL snapshot takes precedence

    const userId = getStoredUser()?.id;
    if (!userId) return;

    const defaults = readDefaults(userId);
    if (!defaults) return;

    useViewerStore.setState((s) => ({
      layers: { ...s.layers, ...defaults.layers },
      terrainMode: defaults.terrainMode ?? s.terrainMode,
      blendPreset: defaults.blendPreset ?? s.blendPreset,
      activeTool: defaults.activeTool ?? s.activeTool,
      terrainExaggeration: defaults.terrainExaggeration ?? s.terrainExaggeration,
      pointBudget: defaults.pointBudget ?? s.pointBudget,
    }));
  }, [hasUrlState]);

  // Subscribe: write defaults on every relevant change.
  useEffect(() => {
    const unsub = useViewerStore.subscribe((state) => {
      const userId = getStoredUser()?.id;
      if (!userId) return;
      writeDefaults(userId, {
        layers: state.layers,
        terrainMode: state.terrainMode,
        blendPreset: state.blendPreset,
        activeTool: state.activeTool,
        terrainExaggeration: state.terrainExaggeration,
        pointBudget: state.pointBudget,
      });
    });
    return unsub;
  }, []);
}
