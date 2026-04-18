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
import type { ToolMode, RightRailTab } from '@/store/viewerStore';

const MODE_KEY_MAP: Record<string, 'select' | 'measure' | 'draw' | 'compare' | 'annotate'> = {
  KeyV: 'select',
  KeyM: 'measure',
  KeyD: 'draw',
  KeyC: 'compare',
  KeyA: 'annotate',
};

// Order mirrors `MEASURE_SUBMODES` in ToolPalette and `TABS` in
// RightRail. Keep the two arrays index-aligned with the toolbar UI —
// drift here will desync the keyboard hints from the click targets.
const MEASURE_SUBMODE_ORDER: ToolMode[] = [
  'distance',
  'area',
  'volume',
  'profile',
  'cross-section',
];
const TAB_ORDER: RightRailTab[] = [
  'overview',
  'layers',
  'inspector',
  'measurements',
  'compare',
];

const DIGIT_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
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
      // Bail on text input / contenteditable so we don't steal letters
      // from the SaveRegionModal name field, the AnnotationModal text
      // box, etc.
      if (isEditableTarget(e.target)) return;

      // Bail on modifier-bearing keystrokes — never shadow native
      // shortcuts like ⌘V / ⌃C / ⌥M. (Shift on its own is fine; the
      // letter codes below already match Shift+letter via `code`.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
        // Mid-drawing collision guard: the measurement handler rebinds
        // every time `activeTool` flips, and the new binding starts
        // with an empty `verticesRef`. Without this guard, the user
        // hits `2` mid-area-polygon, the polygon silently disappears,
        // and they conclude the tool is broken (again).
        const measurement = useViewerStore.getState().measurement;
        if (measurement.status === 'drawing' && measurement.points.length > 0) {
          e.preventDefault();
          toast.info(
            'Finish (right-click) or cancel (Esc) the current measurement first.',
          );
          return;
        }
        e.preventDefault();
        setMeasureSubmode(MEASURE_SUBMODE_ORDER[idx]);
        return;
      }

      e.preventDefault();
      setRightRailTab(TAB_ORDER[idx]);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activateMode, setMeasureSubmode, setRightRailTab, measureActive]);
}
