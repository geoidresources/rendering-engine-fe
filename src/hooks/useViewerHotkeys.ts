/**
 * Global keyboard shortcuts for the viewer.
 *
 * Wires up the keyboard hints that the ToolPalette and RightRail
 * already advertise (`V/M/D/C/A` for modes, `1–5` for tabs or measure
 * submodes). Mounted exactly once at the top of `Viewer.tsx`; the
 * single global listener avoids the per-component handler sprawl that
 * caused double-fires during the first redesign.
 *
 * Routing rules:
 *
 *  - Letter keys → top-level tool modes (Select / Measure / Draw /
 *    Compare / Annotate). Identical to clicking the matching ToolPalette
 *    pill — both call into `useToolModeActions.activateMode()`.
 *
 *  - Number keys 1–5 are *context-sensitive*:
 *      • when a measure tool is active, they pick a Measure submode
 *        (Distance / Area / Volume / Profile / Cross-section);
 *      • otherwise they switch the right-rail tab.
 *    The user thinks of "M then 2 = Area" as a single gesture — keeping
 *    1–5 measure-aware lets that gesture work without a modifier.
 *
 *  - Esc is *not* handled here. ToolPalette already owns it (returns
 *    to Select); registering twice would set state twice per keypress.
 *
 * Bail conditions (the listener is `window`-scoped, so all input
 * elements would otherwise eat their own keystrokes):
 *
 *  - Inputs / textareas / contenteditable — anything where the user
 *    is typing. Includes role="textbox" for shadcn primitives.
 *  - Modifier-bearing keystrokes (⌘ ⌃ ⌥) — never shadow browser
 *    shortcuts like ⌘V (paste).
 *  - Mid-drawing measurement: digits cancel-by-side-effect since
 *    `useMeasurementHandler` rebinds on `activeTool` change and would
 *    silently wipe the in-progress vertices. We toast and no-op
 *    instead — explicit Esc / right-click is the only escape route.
 *
 * @see plans/quirky-munching-corbato.md — Polish Addendum, Phase 2.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';

import { useViewerStore } from '@/store/viewerStore';
import { useToolModeActions } from '@/hooks/useToolModeActions';
import type { ToolMode, RightRailTab, MeasureShape } from '@/store/viewerStore';

const MODE_KEY_MAP: Record<string, 'select' | 'measure' | 'compare' | 'annotate'> = {
  KeyV: 'select',
  KeyM: 'measure',
  KeyC: 'compare',
  KeyA: 'annotate',
};

// Shape-based submodes — matches the 3 shape buttons in ToolPalette.
// Each shape maps to a drawing ToolMode.
const MEASURE_SHAPE_ORDER: { shape: MeasureShape; toolMode: ToolMode }[] = [
  { shape: 'line', toolMode: 'distance' },
  { shape: 'square', toolMode: 'area' },
  { shape: 'polygon', toolMode: 'area' },
];
const TAB_ORDER: RightRailTab[] = [
  'overview',
  'layers',
  'inspector',
  'measurements',
  'compare',
  'bookmarks',
];

const DIGIT_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute('role') === 'textbox') return true;
  return false;
}

export function useViewerHotkeys(): void {
  const { activateMode, setMeasureSubmode, measureActive } = useToolModeActions();
  const setRightRailTab = useViewerStore((s) => s.setRightRailTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // V-COMPARE-03 — ← / → step through epochs on the timeline.
      // Read store state inline so the closure doesn't need to track
      // the full surveys array in its dep list (it would re-register
      // on every survey load which is noisy).
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const { availableSurveys, activeSurveyId, switchSurvey } =
          useViewerStore.getState();
        if (availableSurveys.length < 2) return;
        const ix = availableSurveys.findIndex((s) => s.id === activeSurveyId);
        const next =
          e.code === 'ArrowLeft'
            ? availableSurveys[ix - 1]
            : availableSurveys[ix + 1];
        if (!next) return;
        e.preventDefault();
        switchSurvey(next.id);
        return;
      }

      // Letter → top-level tool mode.
      const modeId = MODE_KEY_MAP[e.code];
      if (modeId) {
        e.preventDefault();
        activateMode(modeId);
        return;
      }

      // Digit → submode (when measuring) or right-rail tab.
      const idx = DIGIT_TO_INDEX[e.code];
      if (idx === undefined) return;

      if (measureActive) {
        const measurement = useViewerStore.getState().measurement;
        if (measurement.status === 'drawing' && measurement.points.length > 0) {
          e.preventDefault();
          toast.info(
            'Finish (right-click) or cancel (Esc) the current measurement first.',
          );
          return;
        }
        e.preventDefault();
        const entry = MEASURE_SHAPE_ORDER[idx];
        if (entry) {
          useViewerStore.getState().setMeasureShape(entry.shape);
          setMeasureSubmode(entry.toolMode);
        }
        return;
      }

      e.preventDefault();
      setRightRailTab(TAB_ORDER[idx]);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activateMode, setMeasureSubmode, setRightRailTab, measureActive]);
}
