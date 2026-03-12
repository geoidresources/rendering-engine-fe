import React from 'react';
import { useViewerStore } from '../store/viewerStore';
import { Info, X } from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { selectedFeature, setSelectedFeature } = useViewerStore();

  if (!selectedFeature) return null;

  return (
    <div className="absolute top-4 right-4 w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex flex-col z-10 max-h-[calc(100vh-2rem)]">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h3 className="font-medium text-sm text-gray-800">Feature Details</h3>
        </div>
        <button 
          onClick={() => setSelectedFeature(null)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto">
        <div className="space-y-3">
          {Object.entries(selectedFeature.properties || {}).map(([key, value]) => (
            <div key={key} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{key}</div>
              <div className="text-sm text-gray-800 break-words">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </div>
            </div>
          ))}
          
          {(!selectedFeature.properties || Object.keys(selectedFeature.properties).length === 0) && (
            <div className="text-sm text-gray-500 italic text-center py-4">
              No properties available for this feature.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
