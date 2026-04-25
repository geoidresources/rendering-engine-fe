'use client';

import React, { useEffect } from 'react';
import {
  Columns2,
  Hexagon,
  MousePointer2,
  Pencil,
  PenTool,
  Ruler,
  Slash,
  Square,
} from 'lucide-react';
import { useViewerStore, type MeasureShape } from '@/store/viewerStore';
import { useToolModeActions, type ModeId } from '@/hooks/useToolModeActions';
import { cn } from '@/lib/utils';

interface ModeDef {
  id: ModeId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  enabled: boolean;
  hint?: string;
}

interface MeasureSubmode {
  id: MeasureShape;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}

const MODES: ModeDef[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V', enabled: true },
  { id: 'measure', label: 'Measure', icon: Ruler, shortcut: 'M', enabled: true },
  { id: 'draw', label: 'Draw', icon: PenTool, shortcut: 'D', enabled: true, hint: 'Draw a polygon region — saves as a stockpile' },
  { id: 'compare', label: 'Compare', icon: Columns2, shortcut: 'C', enabled: true },
  { id: 'annotate', label: 'Annotate', icon: Pencil, shortcut: 'A', enabled: true, hint: 'Drop a labeled pin on the canvas' },
];

/** Drawing-shape submodes — replace the old 5 measurement-type buttons.
 *  The data view (distance / area / volume / profile / section) is now
 *  selected via a dropdown in the inspector card. */
const MEASURE_SUBMODES: MeasureSubmode[] = [
  { id: 'line', label: 'Line', icon: Slash, shortcut: '1' },
  { id: 'square', label: 'Square', icon: Square, shortcut: '2' },
  { id: 'polygon', label: 'Polygon', icon: Hexagon, shortcut: '3' },
];

/**
 * Five-mode tool palette — replaces the old 7-button Toolbar.
 *
 * Behaviour:
 *  - Select / Measure / Compare are wired today; Draw / Annotate are
 *    intentionally disabled (Phase 3 / Phase 5).
 *  - The Measure pill expands into Distance / Area / Volume submodes
 *    just to the right of the active pill — no second toolbar row.
 *  - Esc returns to Select. Compare mirrors the ContextBar Compare
 *    button so users can also reach it from the canvas, and it auto-
 *    opens the Compare tab in the right rail.
 *  - DTM / DSM is a separate inline pair for terrain mode switching.
 *
 * Active-mode highlight is derived from `activeTool` + `compareEnabled`
 * — there is no local "active mode" state, so external mutations
 * (Inspector clearing the measurement, ContextBar toggling Compare)
 * stay in sync without an effect.
 */
export const ToolPalette: React.FC = () => {
  // Mode routing lives in `useToolModeActions` so the keyboard hotkey
  // hook (`useViewerHotkeys`) can reuse the exact same wiring without
  // duplicating the if-ladder. ToolPalette is now a thin renderer over
  // that hook — see plans/quirky-munching-corbato.md, Polish Addendum
  // Phase 2 for the rationale.
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  // Right inset has to track the rail width (360 px expanded, 36 px
  // collapsed) so the toolbar doesn't waste space — without this the
  // pill stays pinned ~340 px shy of the canvas edge even after the
  // user collapses the rail.
  const railCollapsed = useViewerStore((s) => s.rightRailCollapsed);
  // Quick terrain-mode chip lives next to the verb toolbar so the
  // operator can flip DTM ↔ DSM without opening the Layers rail. The
  // canonical control still lives in LayersTab; this is a shortcut
  // mirror, not a separate source of truth.
  const terrainMode = useViewerStore((s) => s.terrainMode);
  const setTerrainMode = useViewerStore((s) => s.setTerrainMode);
  const terrainVisible = useViewerStore((s) => s.layers.dsm.visible);

  const {
    activateMode,
    setMeasureSubmode,
    measureActive,
    drawActive,
    annotateActive,
    compareEnabled,
  } = useToolModeActions();

  const profileActive = activeTool === 'profile' || activeTool === 'cross-section';
  const measureShape = useViewerStore((s) => s.measureShape);
  const setMeasureShapeStore = useViewerStore((s) => s.setMeasureShape);

  // Esc returns to Select. (Event listener — not setState in effect.)
  // Kept here (not in `useViewerHotkeys`) on purpose: ToolPalette already
  // owns "what does Esc do for tools" and registering this in two places
  // would double-fire `setActiveTool('select')` per keypress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setActiveTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveTool]);

  // Local thin wrapper kept for type-narrowed prop passing into the
  // button below. All routing lives in `activateMode`.
  const handleModeClick = (id: ModeId) => activateMode(id);

  // Find the active hint (only one mode shows a hint at a time, by
  // construction — Draw / Profile / Annotate are mutually exclusive
  // since they all map to a single `activeTool`).
  const activeHint = drawActive
    ? { Icon: PenTool, text: 'Click vertices · double-click to finish · Esc to cancel' }
    : profileActive
      ? { Icon: Ruler, text: 'Click ≥2 points · double-click to sample · Esc to cancel' }
      : annotateActive
        ? { Icon: Pencil, text: 'Click to drop a pin · Esc to cancel' }
        : null;

  return (
    // Single anchored container. `left-3 / top-3` hugs the corner more
    // tightly than the old `left-4 / top-4` since the pill is now slim
    // enough that the extra inset read as wasted space. Right-bound
    // keeps it from sliding under the 360-px rail; the pill is now
    // narrow enough that wrapping shouldn't trigger on any sane width.
    <div
      className={cn(
        'absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5',
        railCollapsed ? 'right-14' : 'right-[376px]',
      )}
    >
      {/* One unified pill: modes → optional submodes → terrain segment.
          Glassy, fully rounded, hairline borders, soft tonal selection
          — no accent fill on the top-level modes (it's noisy), no
          shadow-2xl drop. */}
      <div
        role="toolbar"
        aria-label="Viewer tools"
        className="inline-flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-bg-surface/55 px-1 py-1 shadow-lg shadow-black/20 backdrop-blur-2xl supports-[backdrop-filter]:bg-bg-surface/40"
      >
        {MODES.map(({ id, label, icon: Icon, shortcut, enabled, hint }) => {
          const isActive =
            (id === 'select' && activeTool === 'select' && !compareEnabled) ||
            (id === 'measure' && measureActive) ||
            (id === 'draw' && drawActive) ||
            (id === 'compare' && compareEnabled) ||
            (id === 'annotate' && annotateActive);
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              onClick={() => handleModeClick(id)}
              title={enabled ? `${label} · ${shortcut}` : (hint ?? label)}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                // Apple Control-Center pattern: tinted-accent background with
                // accent-coloured icon. ~5–7:1 contrast for the icon, but the
                // pill itself stays calm — no full amber slab on top-level
                // verbs. (Submodes below use the loud fill on purpose.)
                'inline-flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : enabled
                    ? 'text-text-muted/80 hover:bg-text-primary/[0.06] hover:text-text-primary'
                    : 'cursor-not-allowed text-text-muted/30',
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}

        {/* Measure submodes slide in inline behind a hairline divider —
            same surface, just a quiet step-down in importance. The
            selected submode wears a slightly stronger fill so the user
            can read the active sub-tool without scanning the chip below. */}
        {measureActive && (
          <>
            <div className="mx-1 h-5 w-px bg-white/10" aria-hidden />
            {MEASURE_SUBMODES.map(({ id, label, icon: Icon, shortcut }) => {
              const active = measureShape === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMeasureShapeStore(id);
                    // Map shape to the drawing activeTool
                    const toolMode = id === 'line' ? 'distance' : 'area';
                    setMeasureSubmode(toolMode);
                  }}
                  title={`${label} · ${shortcut}`}
                  aria-label={label}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                    active
                      ? 'bg-accent text-bg-base'
                      : 'text-text-muted/70 hover:bg-text-primary/[0.06] hover:text-text-primary',
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </>
        )}

        {/* Terrain mode (DTM ↔ DSM) — quick chrome mirror of the
            LayersTab control. Sits behind a divider so the verb
            toolbar's identity stays clear, but it's one click closer
            so operators can flip surface ↔ bare-earth without leaving
            the canvas. Disabled when terrain itself is hidden. */}
        <div className="mx-1 h-5 w-px bg-white/10" aria-hidden />
        <div
          role="group"
          aria-label="Terrain mode"
          title={
            terrainVisible
              ? 'Switch terrain surface'
              : 'Turn the Terrain layer on to switch surface'
          }
          className={cn(
            'inline-flex items-center rounded-full bg-bg-base/40 p-0.5',
            !terrainVisible && 'opacity-40 pointer-events-none',
          )}
        >
          {(['dtm', 'dsm'] as const).map((m) => {
            const active = terrainMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setTerrainMode(m)}
                aria-pressed={active}
                className={cn(
                  'h-7 min-w-[2.25rem] px-2 rounded-full text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                  active
                    ? 'bg-accent text-bg-base'
                    : 'text-text-muted/80 hover:text-text-primary',
                )}
              >
                {m === 'dtm' ? 'DTM' : 'DSM'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hint chip — only renders when a mode that needs guidance is
          active. Sits below the pill in a quieter glass, sentence case,
          no border, just enough contrast to read against the canvas. */}
      {activeHint && (
        <div
          role="status"
          aria-live="polite"
          className="ml-1 inline-flex items-center gap-2 rounded-full bg-bg-surface/45 px-3 py-1 text-[11px] font-normal text-text-muted shadow-sm shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-surface/30"
        >
          <activeHint.Icon className="size-3 text-text-muted/80" />
          {activeHint.text}
        </div>
      )}
    </div>
  );
};
