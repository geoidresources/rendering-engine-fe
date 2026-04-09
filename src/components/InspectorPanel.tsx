import React from 'react';
import { useViewerStore } from '../store/viewerStore';
import { Info, Loader2, Ruler, Square, MapPinned, Trash2 } from 'lucide-react';

function formatDistance(distanceMeters?: number): string {
  if (!distanceMeters || distanceMeters <= 0) return '0 m';
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(2)} km`
    : `${distanceMeters.toFixed(1)} m`;
}

function formatArea(areaSquareMeters?: number): string {
  if (!areaSquareMeters || areaSquareMeters <= 0) return '0 m\u00B2';
  return areaSquareMeters >= 10000
    ? `${(areaSquareMeters / 10000).toFixed(2)} ha`
    : `${areaSquareMeters.toFixed(0)} m\u00B2`;
}

function formatVolume(volumeCubicMeters?: number): string {
  if (!volumeCubicMeters || volumeCubicMeters <= 0) return '0 m\u00B3';
  return `${volumeCubicMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00B3`;
}

export const InspectorPanel: React.FC = () => {
  const {
    selectedFeature,
    setSelectedFeature,
    selectedAreaDetails,
    setSelectedAreaDetails,
    areaDetailsLoading,
    activeTool,
    measurement,
    clearMeasurement,
    setActiveTool,
  } = useViewerStore();

  const clearSelection = () => {
    setSelectedFeature(null);
    setSelectedAreaDetails(null);
  };

  const handleClearMeasurement = () => {
    clearMeasurement();
    setActiveTool('select');
  };

  return (
    <div className="absolute top-0 right-0 w-80 max-h-[70vh] m-4 bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-zinc-200/70 dark:border-zinc-800/70 z-10 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
            Inspector
          </h3>
        </div>
        {selectedFeature && (
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="p-3 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-200 flex-1 space-y-3">
        {(activeTool === 'distance' || activeTool === 'area' || activeTool === 'volume') && (
          <div className="rounded-xl border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-500/10 p-3 text-[11px] leading-snug">
            <div className="mb-2 flex items-center gap-2 text-blue-950 dark:text-blue-100">
              {activeTool === 'distance' ? (
                <Ruler className="h-4 w-4" />
              ) : activeTool === 'area' ? (
                <Square className="h-4 w-4" />
              ) : (
                <MapPinned className="h-4 w-4" />
              )}
              <span className="font-semibold">
                {activeTool === 'distance'
                  ? 'Distance tool'
                  : activeTool === 'area'
                    ? 'Area tool'
                    : 'Volume tool'}
              </span>
            </div>

            {activeTool === 'distance' && (
              <>
                <p>Click to place points. Double-click or right-click to finish.</p>
                <p className="mt-2 text-blue-950 dark:text-blue-100">
                  Distance: <strong>{formatDistance(measurement.distanceMeters)}</strong>
                </p>
                {measurement.points.length > 0 && (
                  <p className="mt-1 text-blue-950 dark:text-blue-100">
                    Points: <strong>{measurement.points.length}</strong>
                  </p>
                )}
              </>
            )}

            {activeTool === 'area' && (
              <>
                <p>Click to add polygon vertices. Right-click to close and measure.</p>
                <p className="mt-2 text-blue-950 dark:text-blue-100">
                  Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
                </p>
                <p className="mt-1 text-blue-950 dark:text-blue-100">
                  Vertices: <strong>{measurement.points.length}</strong>
                </p>
              </>
            )}

            {activeTool === 'volume' && (
              <>
                <p>Draw a polygon around a stockpile. Right-click to close and compute volume.</p>
                <p className="mt-2 text-blue-950 dark:text-blue-100">
                  Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
                </p>
                {measurement.volumeCubicMeters !== undefined && (
                  <p className="mt-1 text-blue-950 dark:text-blue-100">
                    Volume: <strong>{formatVolume(measurement.volumeCubicMeters)}</strong>
                  </p>
                )}
                {measurement.status === 'drawing' && measurement.points.length >= 3 && measurement.volumeCubicMeters === undefined && (
                  <p className="mt-1 text-blue-700 dark:text-blue-300 italic">Computing volume...</p>
                )}
                <p className="mt-1 text-blue-950 dark:text-blue-100">
                  Vertices: <strong>{measurement.points.length}</strong>
                </p>
              </>
            )}

            {measurement.status !== 'idle' && (
              <button
                type="button"
                onClick={handleClearMeasurement}
                className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear measurement
              </button>
            )}
          </div>
        )}

        {activeTool !== 'select' && (
          <p className="text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl p-2 text-[11px] leading-snug">
            Switch to <strong>Select</strong> in the toolbar to inspect GeoJSON regions, 3D Tiles features, or the site GLB model.
          </p>
        )}

        {selectedFeature && (
          <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Selected feature</p>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {String(selectedFeature.name ?? selectedFeature.id ?? 'Unnamed feature')}
                </h4>
              </div>
              <span className="rounded-full bg-zinc-100/80 dark:bg-zinc-800/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                {String(selectedFeature._source ?? 'feature')}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Feature ID: {String(selectedFeature.id ?? selectedFeature._entityId ?? 'n/a')}
            </p>
          </div>
        )}

        {(areaDetailsLoading || selectedAreaDetails) && (
          <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">Area details</p>
                <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                  {selectedAreaDetails?.name ?? 'Loading area details'}
                </h4>
              </div>
              {areaDetailsLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700 dark:text-emerald-300" />
              )}
            </div>

            {selectedAreaDetails && (
              <div className="space-y-2 text-[11px] text-emerald-950 dark:text-emerald-50">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Material</p>
                    <p className="font-semibold">{selectedAreaDetails.material}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Status</p>
                    <p className="font-semibold">{selectedAreaDetails.status}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Measured area</p>
                    <p className="font-semibold">{formatArea(selectedAreaDetails.areaSquareMeters)}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Perimeter</p>
                    <p className="font-semibold">{formatDistance(selectedAreaDetails.perimeterMeters)}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Avg elevation</p>
                    <p className="font-semibold">{selectedAreaDetails.averageElevationMeters.toFixed(1)} m</p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Last surveyed</p>
                    <p className="font-semibold">{selectedAreaDetails.lastSurveyedAt}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                  <p className="text-emerald-800/70 dark:text-emerald-200/70">Source</p>
                  <p className="font-semibold">{selectedAreaDetails.source}</p>
                </div>

                <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                  <p className="text-emerald-800/70 dark:text-emerald-200/70">Owner</p>
                  <p className="font-semibold">{selectedAreaDetails.owner}</p>
                </div>

                <div className="rounded-lg bg-white/80 dark:bg-zinc-950/30 p-2 border border-emerald-200/50 dark:border-emerald-500/20">
                  <p className="text-emerald-800/70 dark:text-emerald-200/70">Notes</p>
                  <p>{selectedAreaDetails.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedFeature ? (
          <pre className="whitespace-pre-wrap break-all rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100">
            {JSON.stringify(selectedFeature, null, 2)}
          </pre>
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400">
            With <strong>Select</strong> active, click a region or feature on the map to inspect properties.
          </p>
        )}
      </div>
    </div>
  );
};
