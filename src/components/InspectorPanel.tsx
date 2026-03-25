import React from 'react';
import { useViewerStore } from '../store/viewerStore';
import { Info } from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { selectedFeature, setSelectedFeature, activeTool } = useViewerStore();

  return (
    <div className="absolute top-0 right-0 w-80 max-h-[70vh] m-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-10 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">Inspector</h3>
        </div>
        {selectedFeature && (
          <button
            type="button"
            onClick={() => setSelectedFeature(null)}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            Clear
          </button>
        )}
      </div>
      <div className="p-3 overflow-y-auto text-xs font-mono text-gray-700 flex-1">
        {activeTool !== 'select' && (
          <p className="mb-3 text-amber-800 bg-amber-50 border border-amber-100 rounded p-2 text-[11px] leading-snug">
            Switch to <strong>Select</strong> in the toolbar to pick GeoJSON regions, 3D Tiles features, or the site GLB model.
          </p>
        )}
        {selectedFeature ? (
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(selectedFeature, null, 2)}</pre>
        ) : (
          <p className="text-gray-500">
            With <strong>Select</strong> active, click a region or feature on the map to inspect properties.
          </p>
        )}
      </div>
    </div>
  );
};
