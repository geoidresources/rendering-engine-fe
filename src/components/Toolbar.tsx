import React from 'react';
import { MousePointer2, Ruler, Square, Hexagon, Home } from 'lucide-react';
import Link from 'next/link';
import { useViewerStore } from '../store/viewerStore';

export const Toolbar: React.FC = () => {
  const { terrainMode, setTerrainMode, activeTool, setActiveTool } = useViewerStore();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1 z-10">
      <Link href="/home">
        <button
          className="p-2 rounded transition-colors hover:bg-gray-100 text-gray-600 focus:outline-none"
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
          type="button"
        >
          <Home className="w-5 h-5" />
        </button>
      </Link>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        className={`p-2 rounded transition-colors ${
          activeTool === 'select' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Select"
        aria-label="Select Tool"
        onClick={() => setActiveTool('select')}
        type="button"
      >
        <MousePointer2 className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        className={`p-2 rounded transition-colors ${
          activeTool === 'distance' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Measure Distance"
        aria-label="Measure Distance Tool"
        onClick={() => setActiveTool('distance')}
        type="button"
      >
        <Ruler className="w-5 h-5" />
      </button>
      <button
        className={`p-2 rounded transition-colors ${
          activeTool === 'area' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Measure Area"
        aria-label="Measure Area Tool"
        onClick={() => setActiveTool('area')}
        type="button"
      >
        <Square className="w-5 h-5" />
      </button>
      <button
        className={`p-2 rounded transition-colors ${
          activeTool === 'volume' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Measure Volume"
        aria-label="Measure Volume Tool"
        onClick={() => setActiveTool('volume')}
        type="button"
      >
        <Hexagon className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        type="button"
        onClick={() => setTerrainMode('dtm')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          terrainMode === 'dtm' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="Use bare-earth terrain"
      >
        DTM
      </button>
      <button
        type="button"
        onClick={() => setTerrainMode('dsm')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          terrainMode === 'dsm' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="Use surface terrain (includes structures/vegetation)"
      >
        DSM
      </button>
    </div>
  );
};
