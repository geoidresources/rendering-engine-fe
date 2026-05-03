/**
 * Single source of truth for the five top-level tool-mode verbs
 * (Select / Measure / Draw / Compare / Annotate).
 *
 * Why a hook? Both `<ToolPalette/>` and `useViewerHotkeys()` need to
 * route a click *or* a keypress to the exact same store mutations.
 * Inlining the routing in two places drifted twice already during the
 * Polish Addendum (Compare auto-revealing the rail, Measure defaulting
 * to Distance) — extracting the routing means a future "Draw also
 * pans the camera to the selection" tweak lives in one file, not two.
 *
 * The hook reads/writes the store directly; it does not own any state
 * of its own. The returned object is stable across renders only on the
 * action references — `measureActive`/`drawActive`/`annotateActive` are
 * derived booleans recomputed from `activeTool` on every call, which is
 * the right behaviour because the keypress-time read inside
 * `useViewerHotkeys`'s `keydown` handler must see the latest tool.
 *
 * @see plans/quirky-munching-corbato.md — Polish Addendum, Phase 2.
 */

import { useViewerStore, type ToolMode } from '@/store/viewerStore';
import { useCompareStore } from '@/store/compareStore';

export type ModeId = 'select' | 'measure' | 'compare' | 'annotate';

export interface ToolModeActions {
  /** Run the click/keypress action for one of the five top-level modes. */
  activateMode: (id: ModeId) => void;
  /** Set a Measure submode (Distance / Area / Volume / Profile / Cross-section). */
  setMeasureSubmode: (id: ToolMode) => void;
  /** True when any measure tool — including profile/cross-section — is the active tool. */
  measureActive: boolean;
  /** True for the annotation-pin tool. */
  annotateActive: boolean;
  /** Mirrors `compareStore.enabled` so callers don't have to subscribe twice. */
  compareEnabled: boolean;
}

export function useToolModeActions(): ToolModeActions {
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const revealRailFor = useViewerStore((s) => s.revealRailFor);

  const compareEnabled = useCompareStore((s) => s.enabled);
  const toggleCompare = useCompareStore((s) => s.toggle);

  const measureActive =
    activeTool === 'distance' ||
    activeTool === 'area' ||
    activeTool === 'volume' ||
    activeTool === 'profile' ||
    activeTool === 'cross-section';
  const annotateActive = activeTool === 'annotate';

  const activateMode = (id: ModeId) => {
    if (id === 'select') {
      setActiveTool('select');
      return;
    }
    if (id === 'measure') {
      // Default to Area when nothing in the measure family is active,
      // matching the inspector's default data view ('area').
      if (!measureActive) {
        setActiveTool('area');
        // Also ensure the shape store defaults to polygon.
        useViewerStore.getState().setMeasureShape('polygon');
      }
      // Always reveal the rail to Inspector — that's where the live
      // readout lives. (`measurement-active` is a Phase-2 reason that
      // routes to 'inspector' in `viewerStore.revealRailFor`.)
      revealRailFor('measurement-active');
      return;
    }
    if (id === 'compare') {
      // Seed epochs if missing before toggling.
      const currentCmp = useCompareStore.getState();
      if (!currentCmp.epochA || !currentCmp.epochB) {
        const v = useViewerStore.getState();
        const activeSid = v.manifest?.surveyId;
        if (activeSid) {
          // Find the active survey in the project timeline and pick its predecessor.
          const idx = v.availableSurveys.findIndex((s) => s.id === activeSid);
          const baseline =
            idx > 0
              ? v.availableSurveys[idx - 1].id // Preceding survey
              : idx < v.availableSurveys.length - 1
                ? v.availableSurveys[idx + 1].id // Succeeding survey if first
                : activeSid; // Fallback to same survey
          const compare = activeSid;

          currentCmp.setEpochs(baseline, compare);
        }
      }
      toggleCompare();
      revealRailFor('compare-on');
      return;
    }
    if (id === 'annotate') {
      setActiveTool(annotateActive ? 'select' : 'annotate');
      return;
    }
  };

  const setMeasureSubmode = (id: ToolMode) => {
    setActiveTool(id);
    // Keep the rail anchored to Inspector when the user swaps submodes —
    // they may have collapsed it between Distance → Area, and the live
    // readout is the whole reason they're here.
    revealRailFor('measurement-active');
  };

  return {
    activateMode,
    setMeasureSubmode,
    measureActive,
    annotateActive,
    compareEnabled,
  };
}
