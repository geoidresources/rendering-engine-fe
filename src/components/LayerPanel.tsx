import React from 'react';
import { AlertCircle, Eye, EyeOff, Layers, Loader2 } from 'lucide-react';

import { useViewerStore, LayerId } from '../store/viewerStore';
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

export const LayerPanel: React.FC = () => {
  const {
    layers,
    setLayerVisibility,
    setLayerOpacity,
    blendPreset,
    setBlendPreset,
  } = useViewerStore();

  return (
    <aside className="z-10 h-full w-80 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight text-foreground">Workspace</h2>
              <p className="text-xs text-muted-foreground">Layer visibility and scene blending</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            <Card size="sm" className="border shadow-none">
              <CardHeader className="gap-2">
                <CardTitle>Blend Preset</CardTitle>
                <CardDescription>
                  DTM/DSM in the top bar switches terrain. Use blend presets to match the scene
                  treatment without changing data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="inline-flex w-full rounded-xl border bg-muted/30 p-1"
                  role="tablist"
                  aria-label="Layer blend preset"
                >
                  {(['stacked', 'embedded'] as const).map((preset) => {
                    const active = blendPreset === preset;
                    return (
                      <Button
                        key={preset}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setBlendPreset(preset)}
                        variant={active ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1"
                      >
                        {preset === 'stacked' ? 'Stacked' : 'Embedded'}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {(Object.keys(layers) as LayerId[]).map((id) => {
              const layer = layers[id];
              const opacityLocked = !layer.visible;
              return (
                <Card key={id} size="sm" className="border shadow-none">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">{layer.name}</CardTitle>
                          {layer.loading && <Loader2 className="size-3 animate-spin text-primary" />}
                          {layer.error && (
                            <span title={layer.error}>
                              <AlertCircle className="size-3 text-destructive" />
                            </span>
                          )}
                        </div>
                        <Badge variant={layer.visible ? 'secondary' : 'outline'} className="capitalize">
                          {layer.visible ? 'Visible' : 'Hidden'}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => setLayerVisibility(id, !layer.visible)}
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        title={`Toggle visibility for ${layer.name}`}
                        aria-label={`Toggle visibility for ${layer.name}`}
                        type="button"
                      >
                        {layer.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                    </div>
                    {layer.error && (
                      <p className="text-xs leading-snug text-destructive" role="alert">
                        {layer.error}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent>
                    <div
                      className={opacityLocked ? 'pointer-events-none select-none opacity-55' : ''}
                      title={
                        opacityLocked
                          ? 'Turn this layer on to change opacity.'
                          : 'Drag to change layer opacity.'
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 text-xs text-muted-foreground">Opacity</span>
                        {opacityLocked ? (
                          <div className="flex h-7 flex-1 items-center text-xs text-muted-foreground" aria-hidden>
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
                            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                          />
                        )}
                        <span className="w-9 text-right text-xs text-muted-foreground">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
};
