import React from 'react';
import { useViewerStore, LayerId } from '../store/viewerStore';
import { Layers, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export const LayerPanel: React.FC = () => {
  const { layers, setLayerVisibility, setLayerOpacity } = useViewerStore();

  return (
    <div className="w-72 bg-white/95 backdrop-blur-sm border-r border-gray-200 h-full flex flex-col shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <Layers className="w-5 h-5 text-gray-600" />
        <h2 className="font-semibold text-gray-800">Workspace</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(Object.keys(layers) as LayerId[]).map((id) => {
          const layer = layers[id];
          return (
            <div key={id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-700">{layer.name}</span>
                  {layer.loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                  {layer.error && <span title={layer.error}><AlertCircle className="w-3 h-3 text-red-500" /></span>}
                </div>
                <button
                  onClick={() => setLayerVisibility(id, !layer.visible)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={layer.opacity}
                  onChange={(e) => setLayerOpacity(id, parseFloat(e.target.value))}
                  disabled={!layer.visible}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs text-gray-500 w-8 text-right">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
