import React from 'react';
import { useViewerStore } from '../store/viewerStore';
import { Info, Loader2, Ruler, Square, MapPinned, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { ScrollArea } from './ui/scroll-area';

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
    <Card className="absolute right-4 top-4 z-10 flex max-h-[70vh] w-80 overflow-hidden border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Info className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm">Inspector</CardTitle>
              <CardDescription>Selection, measurements, and metadata</CardDescription>
            </div>
          </div>
          {selectedFeature && (
            <Button type="button" onClick={clearSelection} variant="ghost" size="sm">
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-3 py-3 text-xs text-foreground">
        {(activeTool === 'distance' || activeTool === 'area' || activeTool === 'volume') && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-snug">
            <div className="mb-2 flex items-center gap-2 text-foreground">
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
                <p className="mt-2 text-foreground">
                  Distance: <strong>{formatDistance(measurement.distanceMeters)}</strong>
                </p>
                {measurement.points.length > 0 && (
                  <p className="mt-1 text-foreground">
                    Points: <strong>{measurement.points.length}</strong>
                  </p>
                )}
              </>
            )}

            {activeTool === 'area' && (
              <>
                <p>Click to add polygon vertices. Right-click to close and measure.</p>
                <p className="mt-2 text-foreground">
                  Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
                </p>
                <p className="mt-1 text-foreground">
                  Vertices: <strong>{measurement.points.length}</strong>
                </p>
              </>
            )}

            {activeTool === 'volume' && (
              <>
                <p>Draw a polygon around a stockpile. Right-click to close and compute volume.</p>
                <p className="mt-2 text-foreground">
                  Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
                </p>
                {measurement.volumeCubicMeters !== undefined && (
                  <p className="mt-1 text-foreground">
                    Volume: <strong>{formatVolume(measurement.volumeCubicMeters)}</strong>
                  </p>
                )}
                {measurement.status === 'drawing' && measurement.points.length >= 3 && measurement.volumeCubicMeters === undefined && (
                  <p className="mt-1 italic text-primary">Computing volume...</p>
                )}
                <p className="mt-1 text-foreground">
                  Vertices: <strong>{measurement.points.length}</strong>
                </p>
              </>
            )}

            {measurement.status !== 'idle' && (
              <Button
                type="button"
                onClick={handleClearMeasurement}
                variant="ghost"
                size="sm"
                className="mt-2 h-auto px-0 text-[11px] text-primary hover:text-primary"
              >
                <Trash2 className="h-3 w-3" />
                Clear measurement
              </Button>
            )}
          </div>
        )}

        {activeTool !== 'select' && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100">
            Switch to <strong>Select</strong> in the toolbar to inspect GeoJSON regions, 3D Tiles features, or the site GLB model.
          </p>
        )}

        {selectedFeature && (
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected feature</p>
                <h4 className="text-sm font-semibold text-foreground">
                  {String(selectedFeature.name ?? selectedFeature.id ?? 'Unnamed feature')}
                </h4>
              </div>
              <Badge variant="outline" className="uppercase">
                {String(selectedFeature._source ?? 'feature')}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
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
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Material</p>
                    <p className="font-semibold">{selectedAreaDetails.material}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Status</p>
                    <p className="font-semibold">{selectedAreaDetails.status}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Measured area</p>
                    <p className="font-semibold">{formatArea(selectedAreaDetails.areaSquareMeters)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Perimeter</p>
                    <p className="font-semibold">{formatDistance(selectedAreaDetails.perimeterMeters)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Avg elevation</p>
                    <p className="font-semibold">{selectedAreaDetails.averageElevationMeters.toFixed(1)} m</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                    <p className="text-emerald-800/70 dark:text-emerald-200/70">Last surveyed</p>
                    <p className="font-semibold">{selectedAreaDetails.lastSurveyedAt}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                  <p className="text-emerald-800/70 dark:text-emerald-200/70">Source</p>
                  <p className="font-semibold">{selectedAreaDetails.source}</p>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
                  <p className="text-emerald-800/70 dark:text-emerald-200/70">Owner</p>
                  <p className="font-semibold">{selectedAreaDetails.owner}</p>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-background/80 p-2 dark:bg-zinc-950/30">
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
          <p className="text-muted-foreground">
            With <strong>Select</strong> active, click a region or feature on the map to inspect properties.
          </p>
        )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
