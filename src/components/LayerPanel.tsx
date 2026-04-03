import React from 'react';
import { useViewerStore, LayerId } from '../store/viewerStore';
import { Layers, Eye, EyeOff, AlertCircle, Loader2, Settings2 } from 'lucide-react';

export const LayerPanel: React.FC = () => {
  const {
    layers,
    setLayerVisibility,
    setLayerOpacity,
  } = useViewerStore();

  return (
    <div className="w-72 h-full flex flex-col z-10 border-r border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/75 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30">
      <div className="p-4 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center gap-2">
        <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        <h2 className="font-semibold text-zinc-900 dark:text-white tracking-tight">Workspace</h2>
      </div>

      <p className="px-4 pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
        DTM/DSM in the top bar switch quantized-mesh terrain. Layer toggles add ortho, points, vectors, and models.
      </p>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl p-3 border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/80 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Blend</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                Switch between the original stack and a more integrated scene look.
              </p>
            </div>
            <div
              className="inline-flex rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/60 p-0.5"
              role="tablist"
              aria-label="Layer blend preset"
            >
              {(['stacked', 'embedded'] as const).map((preset) => {
                const active = blendPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBlendPreset(preset)}
                    className={
                      active
                        ? 'rounded-lg px-2.5 py-1 text-xs font-semibold bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                        : 'rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60'
                    }
                  >
                    {preset === 'stacked' ? 'Stacked' : 'Embedded'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(Object.keys(layers) as LayerId[]).map((id) => {
          const layer = layers[id];
          const opacityLocked = !layer.visible;
          return (
            <div
              key={id}
              className="rounded-xl p-3 border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/80 dark:bg-zinc-900/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-zinc-800 dark:text-zinc-100">
                    {layer.name}
                  </span>
                  {layer.loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                  {layer.error && (
                    <span title={layer.error}>
                      <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400" />
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setLayerVisibility(id, !layer.visible)}
                  className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  title={`Toggle visibility for ${layer.name}`}
                  aria-label={`Toggle visibility for ${layer.name}`}
                  type="button"
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {layer.error && (
                <p
                  className="text-[11px] text-red-600 dark:text-red-400 mb-2 leading-snug"
                  role="alert"
                >
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
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 w-12">Opacity</span>
                  {opacityLocked ? (
                    <div
                      className="flex-1 flex items-center h-6 text-xs text-zinc-500 dark:text-zinc-400"
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
                      className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
                    />
                  )}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
};
