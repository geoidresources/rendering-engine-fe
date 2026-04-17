'use client';

import React, { useEffect } from 'react';
import {
  Columns2,
  Hexagon,
  MousePointer2,
  Pencil,
  PenTool,
  Ruler,
  Square,
} from 'lucide-react';
import { useViewerStore, type ToolMode } from '@/store/viewerStore';
import { useCompareStore } from '@/store/compareStore';
import { cn } from '@/lib/utils';

type ModeId = 'select' | 'measure' | 'draw' | 'compare' | 'annotate';

interface ModeDef {
  id: ModeId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  enabled: boolean;
  hint?: string;
}

interface MeasureSubmode {
  id: ToolMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}

const MODES: ModeDef[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V', enabled: true },
  { id: 'measure', label: 'Measure', icon: Ruler, shortcut: 'M', enabled: true },
  { id: 'draw', label: 'Draw', icon: PenTool, shortcut: 'D', enabled: false, hint: 'Region drawing — coming in Phase 3' },
  { id: 'compare', label: 'Compare', icon: Columns2, shortcut: 'C', enabled: true },
  { id: 'annotate', label: 'Annotate', icon: Pencil, shortcut: 'A', enabled: false, hint: 'Annotations — coming in Phase 5' },
];

const MEASURE_SUBMODES: MeasureSubmode[] = [
  { id: 'distance', label: 'Distance', icon: Ruler, shortcut: '1' },
  { id: 'area', label: 'Area', icon: Square, shortcut: '2' },
  { id: 'volume', label: 'Volume', icon: Hexagon, shortcut: '3' },
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
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const terrainMode = useViewerStore((s) => s.terrainMode);
  const setTerrainMode = useViewerStore((s) => s.setTerrainMode);
  const revealRailFor = useViewerStore((s) => s.revealRailFor);

  const compareEnabled = useCompareStore((s) => s.enabled);
  const toggleCompare = useCompareStore((s) => s.toggle);

  const measureActive = activeTool === 'distance' || activeTool === 'area' || activeTool === 'volume';

  // Esc returns to Select. (Event listener — not setState in effect.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setActiveTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveTool]);

  const handleModeClick = (id: ModeId) => {
    if (id === 'select') {
      setActiveTool('select');
      return;
    }
    if (id === 'measure') {
      // Default to distance if no measure tool is active yet.
      if (!measureActive) setActiveTool('distance');
      return;
    }
    if (id === 'compare') {
      toggleCompare();
      revealRailFor('compare-on');
    }
    // Draw / Annotate are disabled in Phase 1; click is a no-op.
  };

  return (
    <div className="absolute top-4 left-4 z-20 flex items-start gap-2">
      {/* Mode pills */}
      <div
        role="toolbar"
        aria-label="Viewer tools"
        className="inline-flex items-center gap-0.5 rounded-sm border border-border-subtle bg-bg-surface/85 backdrop-blur-md p-1 shadow-2xl supports-[backdrop-filter]:bg-bg-surface/65"
      >
        {MODES.map(({ id, label, icon: Icon, shortcut, enabled, hint }) => {
          const isActive =
            (id === 'select' && activeTool === 'select' && !compareEnabled) ||
            (id === 'measure' && measureActive) ||
            (id === 'compare' && compareEnabled);
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
                'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-sm text-[10px] uppercase tracking-wider font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : enabled
                    ? 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                    : 'text-text-muted/40 cursor-not-allowed',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Measure submodes — only when Measure is active */}
      {measureActive && (
        <div
          role="toolbar"
          aria-label="Measure submodes"
          className="inline-flex items-center gap-0.5 rounded-sm border border-border-subtle bg-bg-surface/85 backdrop-blur-md p-1 shadow-2xl supports-[backdrop-filter]:bg-bg-surface/65"
        >
          {MEASURE_SUBMODES.map(({ id, label, icon: Icon, shortcut }) => {
            const active = activeTool === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTool(id)}
                title={`${label} · ${shortcut}`}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-sm text-[10px] uppercase tracking-wider font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                  active
                    ? 'bg-accent text-[#111]'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Terrain mode (DTM/DSM) — always inline */}
      <div
        role="group"
        aria-label="Terrain mode"
        className="inline-flex items-center rounded-sm border border-border-subtle bg-bg-surface/85 backdrop-blur-md p-0.5 shadow-2xl supports-[backdrop-filter]:bg-bg-surface/65"
      >
        {(['dtm', 'dsm'] as const).map((m) => {
          const active = terrainMode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setTerrainMode(m)}
              title={m === 'dtm' ? 'Bare-earth terrain' : 'Surface terrain (incl. structures/vegetation)'}
              className={cn(
                'h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                active
                  ? 'bg-accent text-[#111]'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              {m.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
