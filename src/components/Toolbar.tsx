import React from 'react';
import { MousePointer2, Ruler, Square, Hexagon, Home } from 'lucide-react';
import Link from 'next/link';
import { useViewerStore } from '../store/viewerStore';

export const Toolbar: React.FC = () => {
  const { terrainMode, setTerrainMode, activeTool, setActiveTool } = useViewerStore();

  const iconButtonBase =
    'h-9 w-9 grid place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950';
  const iconButtonIdle =
    'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60';
  const iconButtonActive = 'bg-blue-600/15 text-blue-600 dark:text-blue-400';

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30 p-1.5">
      <Link href="/home">
        <button
          className={`${iconButtonBase} ${iconButtonIdle}`}
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
          type="button"
        >
          <Home className="w-5 h-5" />
        </button>
      </Link>
      <div className="w-px h-6 bg-zinc-200/80 dark:bg-zinc-800/80 mx-1" />
      <button
        className={`${iconButtonBase} ${activeTool === 'select' ? iconButtonActive : iconButtonIdle}`}
        title="Select"
        aria-label="Select Tool"
        onClick={() => setActiveTool('select')}
        type="button"
      >
        <MousePointer2 className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-zinc-200/80 dark:bg-zinc-800/80 mx-1" />
      <button
        className={`${iconButtonBase} ${activeTool === 'distance' ? iconButtonActive : iconButtonIdle}`}
        title="Measure Distance"
        aria-label="Measure Distance Tool"
        onClick={() => setActiveTool('distance')}
        type="button"
      >
        <Ruler className="w-5 h-5" />
      </button>
      <button
        className={`${iconButtonBase} ${activeTool === 'area' ? iconButtonActive : iconButtonIdle}`}
        title="Measure Area"
        aria-label="Measure Area Tool"
        onClick={() => setActiveTool('area')}
        type="button"
      >
        <Square className="w-5 h-5" />
      </button>
      <button
        className={`${iconButtonBase} ${activeTool === 'volume' ? iconButtonActive : iconButtonIdle}`}
        title="Measure Volume"
        aria-label="Measure Volume Tool"
        onClick={() => setActiveTool('volume')}
        type="button"
      >
        <Hexagon className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-zinc-200/80 dark:bg-zinc-800/80 mx-1" />
      <div
        className="inline-flex items-center rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/40 p-0.5"
        role="group"
        aria-label="Terrain mode"
      >
        <button
          type="button"
          onClick={() => setTerrainMode('dtm')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            terrainMode === 'dtm'
              ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60'
          }`}
          title="Use bare-earth terrain"
        >
          DTM
        </button>
        <button
          type="button"
          onClick={() => setTerrainMode('dsm')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            terrainMode === 'dsm'
              ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60'
          }`}
          title="Use surface terrain (includes structures/vegetation)"
        >
          DSM
        </button>
      </div>
    </div>
  );
};
