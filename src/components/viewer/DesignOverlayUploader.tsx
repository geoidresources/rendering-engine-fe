'use client';

import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useViewerStore } from '@/store/viewerStore';
import { parseDesignFile } from '@/lib/viewer/designOverlay';

/**
 * V-TASK-03 — Drop zone / file picker for design overlay.
 *
 * Accepts GeoJSON or Shapefile (.zip) and stores the resulting
 * FeatureCollection in viewerStore. The Cesium rendering is handled
 * by useDesignOverlayLayer in Viewer.tsx (reads from the store).
 *
 * Placed in the Layers tab beneath the standard layer list; hidden
 * until the user expands "Design overlay" or navigates to this control.
 */
export const DesignOverlayUploader: React.FC = () => {
  const designOverlayGeoJSON = useViewerStore((s) => s.designOverlayGeoJSON);
  const setDesignOverlay = useViewerStore((s) => s.setDesignOverlay);
  const setLayerVisibility = useViewerStore((s) => s.setLayerVisibility);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const geojson = await parseDesignFile(file);
      setDesignOverlay(geojson);
      setLayerVisibility('design_overlay', true);
      toast.success(`Design overlay loaded: ${file.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clearOverlay = () => {
    setDesignOverlay(null);
    setLayerVisibility('design_overlay', false);
  };

  if (designOverlayGeoJSON) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-accent/30 bg-accent/5 px-3 py-1.5">
        <span className="text-[10px] text-accent uppercase tracking-[0.12em]">Design overlay loaded</span>
        <button
          type="button"
          onClick={clearOverlay}
          title="Remove design overlay"
          className="text-text-muted hover:text-red-400 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-border-subtle bg-bg-elevated/40 px-3 py-3 text-center hover:border-accent/40 transition-colors cursor-pointer"
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <Upload className="size-4 text-text-muted" />
      <p className="text-[10px] text-text-muted leading-snug">
        Drop a <span className="font-medium text-text-primary">.geojson</span> or{' '}
        <span className="font-medium text-text-primary">.zip</span> Shapefile to overlay a design surface
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,.zip,.shp"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
};
