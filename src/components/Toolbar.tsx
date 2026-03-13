import React from 'react';
import { MousePointer2, Ruler, Square, Hexagon } from 'lucide-react';
import { useViewerStore } from '../store/viewerStore';

export const Toolbar: React.FC = () => {
  const { terrainMode, setTerrainMode } = useViewerStore();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1 z-10">
      <button className="p-2 rounded hover:bg-gray-100 text-blue-600 bg-blue-50 transition-colors" title="Select">
        <MousePointer2 className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors" title="Measure Distance">
        <Ruler className="w-5 h-5" />
      </button>
      <button className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors" title="Measure Area">
        <Square className="w-5 h-5" />
      </button>
      <button className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors" title="Measure Volume">
        <Hexagon className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        onClick={() => setTerrainMode('dtm')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          terrainMode === 'dtm' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="Use bare-earth terrain"
      >
        DTM
      </button>
      <button
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
