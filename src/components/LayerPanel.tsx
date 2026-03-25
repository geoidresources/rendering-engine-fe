import React from 'react';
import { useViewerStore, LayerId } from '../store/viewerStore';
import { Layers, Eye, EyeOff, AlertCircle, Loader2, Settings2 } from 'lucide-react';

export const LayerPanel: React.FC = () => {
  const {
    layers,
    setLayerVisibility,
    setLayerOpacity,
    pointBudget,
    setPointBudget,
    terrainExaggeration,
    setTerrainExaggeration,
  } = useViewerStore();

  return (
    <div className="w-72 bg-white/95 backdrop-blur-sm border-r border-gray-200 h-full flex flex-col shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <Layers className="w-5 h-5 text-gray-600" />
        <h2 className="font-semibold text-gray-800">Workspace</h2>
      </div>

      <p className="px-4 pt-2 text-[11px] text-gray-500 leading-snug">
        DTM/DSM in the top bar switch quantized-mesh terrain. Layer toggles add ortho, points, vectors, and models.
      </p>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(Object.keys(layers) as LayerId[]).map((id) => {
          const layer = layers[id];
          const opacityLocked = !layer.visible;
          return (
            <div key={id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-700">{layer.name}</span>
                  {layer.loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                  {layer.error && (
                    <span title={layer.error}>
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setLayerVisibility(id, !layer.visible)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  title={`Toggle visibility for ${layer.name}`}
                  aria-label={`Toggle visibility for ${layer.name}`}
                  type="button"
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {layer.error && (
                <p className="text-[11px] text-red-600 mb-2 leading-snug" role="alert">
                  {layer.error}
                </p>
              )}

              <div
                className={
                  opacityLocked
                    ? 'pointer-events-none select-none opacity-55 rounded-md'
                    : ''
                }
                title={
                  opacityLocked
                    ? 'Turn this layer on to change opacity.'
                    : 'Drag to change layer opacity.'
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-12">Opacity</span>
                  {opacityLocked ? (
                    <div
                      className="flex-1 flex items-center h-6 text-xs text-gray-500"
                      aria-hidden
                    >
                      {Math.round(layer.opacity * 100)}% (locked)
                    </div>
                  ) : (
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={layer.opacity}
                      onChange={(e) => setLayerOpacity(id, parseFloat(e.target.value))}
                      title="Adjust opacity"
                      aria-label={`Opacity for ${layer.name}`}
                      aria-valuenow={layer.opacity}
                      aria-valuemin={0}
                      aria-valuemax={1}
                      className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  )}
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-800">Performance & Display</h3>
          </div>

          <div className="space-y-4">
            <div
              className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              title="Higher budget uses lower screen-space error and a larger tile cache so more point tiles stay loaded (uses more GPU memory)."
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Point budget</span>
                <span className="text-xs text-gray-500">{(pointBudget / 1_000_000).toFixed(1)}M</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round((Math.log10(pointBudget / 100_000) / Math.log10(100)) * 100)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const newBudget = Math.round(100_000 * Math.pow(100, val / 100));
                  setPointBudget(newBudget);
                }}
                aria-label="Point cloud quality budget"
                aria-valuenow={pointBudget}
                aria-valuemin={100_000}
                aria-valuemax={10_000_000}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div
              className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              title="Scales terrain height relative to the ellipsoid. Values above 1× make relief easier to see on flat sites."
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Terrain exaggeration</span>
                <span className="text-xs text-gray-500">{terrainExaggeration}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={terrainExaggeration}
                onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
                aria-label="Terrain vertical exaggeration"
                aria-valuenow={terrainExaggeration}
                aria-valuemin={1}
                aria-valuemax={5}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
