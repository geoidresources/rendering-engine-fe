'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ImageryLayer,
  UrlTemplateImageryProvider,
  Cesium3DTileset,
  SplitDirection,
  Rectangle,
  Matrix4,
  Cartesian3,
  Transforms,
  Math as CesiumMath,
} from 'cesium';
import type { Viewer as CesiumViewer } from 'cesium';
import { useCompareStore } from '@/store/compareStore';
import { useViewerStore } from '@/store/viewerStore';
import { fetchManifest } from '@/store/viewerStore';
import { rewriteGcsUrl } from '@/lib/assetUrl';
import { Manifest } from '@/types/manifest';

const TAG = '[useViewerCompareLayer]';

/**
 * Manages comparison layers (Ortho, LAZ, Heatmap) in Cesium.
 * In slider mode: injects A (LEFT) and B (RIGHT) layers.
 * In diff mode: injects B's Heatmap and B's Ortho (full screen).
 */
export function useViewerCompareLayer(viewerRef: React.RefObject<CesiumViewer | null>) {
  const enabled = useCompareStore((s) => s.enabled);
  const epochA = useCompareStore((s) => s.epochA);
  const epochB = useCompareStore((s) => s.epochB);
  const mode = useCompareStore((s) => s.mode);
  const setEpochs = useCompareStore((s) => s.setEpochs);
  const manifestA = useCompareStore((s) => s.manifestA);
  const manifestB = useCompareStore((s) => s.manifestB);
  const setManifests = useCompareStore((s) => s.setManifests);
  const setIsLoading = useCompareStore((s) => s.setIsLoading);

  const layers = useViewerStore((s) => s.layers);

  const pointBudget = useViewerStore((s) => s.pointBudget);

  // Layer refs
  const orthoARef = useRef<ImageryLayer | null>(null);
  const orthoBRef = useRef<ImageryLayer | null>(null);
  const lazARef = useRef<Cesium3DTileset | null>(null);
  const lazBRef = useRef<Cesium3DTileset | null>(null);
  const heatmapRef = useRef<ImageryLayer | null>(null);

  // Tracking URLs to avoid redundant tileset reloads
  const lastUrlARef = useRef<string | null>(null);
  const lastUrlBRef = useRef<string | null>(null);

  // 1. Fetch manifests when epochs change
  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const [mA, mB] = await Promise.all([
          epochA ? fetchManifest(epochA).catch(e => { console.error(TAG, 'Fetch A failed', e); return null; }) : null,
          epochB ? fetchManifest(epochB).catch(e => { console.error(TAG, 'Fetch B failed', e); return null; }) : null,
        ]);
        setManifests(mA, mB);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [enabled, epochA, epochB, setManifests]);

  // 2. Helper to resolve asset URLs
  const getAssetUrl = (m: Manifest | null, type: string) => {
    if (!m) return undefined;
    const a = m.assets.find(asset => asset.assetType === type);
    return a ? rewriteGcsUrl(a.url) : undefined;
  };

  // 3. Effect to manage Ortho layers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !enabled) {
      // Cleanup
      if (orthoARef.current) { viewer?.scene.imageryLayers.remove(orthoARef.current); orthoARef.current = null; }
      if (orthoBRef.current) { viewer?.scene.imageryLayers.remove(orthoBRef.current); orthoBRef.current = null; }
      return;
    }

    const orthoVisible = layers.ortho.visible;
    const orthoOpacity = layers.ortho.opacity;

    // Epoch A (Baseline) -> LEFT (Slider only)
    const urlA = getAssetUrl(manifestA, 'ortho');
    const orthoAssetA = manifestA?.assets?.find(a => a.assetType === 'ortho');
    if (urlA && orthoVisible && mode === 'slider') {
      if (!orthoARef.current || (orthoARef.current.imageryProvider as any).url !== urlA) {
        if (orthoARef.current) viewer.scene.imageryLayers.remove(orthoARef.current);
        const provider = new UrlTemplateImageryProvider({
          url: urlA,
          hasAlphaChannel: true,
          minimumLevel: orthoAssetA?.minZoom ?? 14,
          maximumLevel: orthoAssetA?.maxZoom ?? 22,
          rectangle: orthoAssetA?.bbox?.length === 4
            ? Rectangle.fromDegrees(orthoAssetA.bbox[0], orthoAssetA.bbox[1], orthoAssetA.bbox[2], orthoAssetA.bbox[3])
            : manifestA?.bounds
              ? Rectangle.fromDegrees(manifestA.bounds.west, manifestA.bounds.south, manifestA.bounds.east, manifestA.bounds.north)
              : undefined,
        });
        orthoARef.current = viewer.scene.imageryLayers.addImageryProvider(provider);
        orthoARef.current.splitDirection = SplitDirection.LEFT;
      }
      orthoARef.current.show = true;
      orthoARef.current.alpha = orthoOpacity;
    } else if (orthoARef.current) {
      orthoARef.current.show = false;
    }

    // Epoch B (Compare) -> RIGHT (Slider) or FULL (Diff)
    const urlB = getAssetUrl(manifestB, 'ortho');
    const orthoAssetB = manifestB?.assets?.find(a => a.assetType === 'ortho');
    if (urlB && orthoVisible) {
      if (!orthoBRef.current || (orthoBRef.current.imageryProvider as any).url !== urlB) {
        if (orthoBRef.current) viewer.scene.imageryLayers.remove(orthoBRef.current);
        const provider = new UrlTemplateImageryProvider({
          url: urlB,
          hasAlphaChannel: true,
          minimumLevel: orthoAssetB?.minZoom ?? 14,
          maximumLevel: orthoAssetB?.maxZoom ?? 22,
          rectangle: orthoAssetB?.bbox?.length === 4
            ? Rectangle.fromDegrees(orthoAssetB.bbox[0], orthoAssetB.bbox[1], orthoAssetB.bbox[2], orthoAssetB.bbox[3])
            : manifestB?.bounds
              ? Rectangle.fromDegrees(manifestB.bounds.west, manifestB.bounds.south, manifestB.bounds.east, manifestB.bounds.north)
              : undefined,
        });
        orthoBRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);
      }
      orthoBRef.current.show = true;
      orthoBRef.current.alpha = orthoOpacity;
      orthoBRef.current.splitDirection = mode === 'slider' ? SplitDirection.RIGHT : SplitDirection.NONE;
    } else if (orthoBRef.current) {
      orthoBRef.current.show = false;
    }

    viewer.scene.requestRender();
  }, [viewerRef, enabled, mode, manifestA, manifestB, layers.ortho.visible, layers.ortho.opacity]);

  // 4. Effect to manage Heatmap layer (Diff mode only)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !enabled || mode !== 'diff') {
      if (heatmapRef.current) { viewer?.scene.imageryLayers.remove(heatmapRef.current); heatmapRef.current = null; }
      return;
    }

    const heatmapUrl = getAssetUrl(manifestB, 'heatmap');
    const heatmapAsset = manifestB?.assets?.find(a => a.assetType === 'heatmap');
    const heatmapVisible = layers.heatmap.visible;
    const heatmapOpacity = layers.heatmap.opacity;

    if (heatmapUrl && heatmapVisible) {
      if (!heatmapRef.current || (heatmapRef.current.imageryProvider as any).url !== heatmapUrl) {
        if (heatmapRef.current) viewer.scene.imageryLayers.remove(heatmapRef.current);
        const provider = new UrlTemplateImageryProvider({
          url: heatmapUrl,
          hasAlphaChannel: true,
          minimumLevel: heatmapAsset?.minZoom ?? 14,
          maximumLevel: heatmapAsset?.maxZoom ?? 22,
          rectangle: heatmapAsset?.bbox?.length === 4
            ? Rectangle.fromDegrees(heatmapAsset.bbox[0], heatmapAsset.bbox[1], heatmapAsset.bbox[2], heatmapAsset.bbox[3])
            : manifestB?.bounds
              ? Rectangle.fromDegrees(manifestB.bounds.west, manifestB.bounds.south, manifestB.bounds.east, manifestB.bounds.north)
              : undefined,
        });
        heatmapRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);
      }
      heatmapRef.current.show = true;
      heatmapRef.current.alpha = heatmapOpacity;
    } else if (heatmapRef.current) {
      heatmapRef.current.show = false;
    }

    viewer.scene.requestRender();
  }, [viewerRef, enabled, mode, manifestB, layers.heatmap.visible, layers.heatmap.opacity]);

  // 5. Effect to manage LAZ layers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !enabled) {
      if (lazARef.current) { viewer?.scene.primitives.remove(lazARef.current); lazARef.current = null; }
      if (lazBRef.current) { viewer?.scene.primitives.remove(lazBRef.current); lazBRef.current = null; }
      return;
    }

    const lazVisible = layers.laz.visible;
    const lazOpacity = layers.laz.opacity;

    const setupTileset = async (url: string, split: SplitDirection) => {
      try {
        const ts = await Cesium3DTileset.fromUrl(url, {
          maximumScreenSpaceError: 16,
          pointCloudShading: { eyeDomeLighting: true },
        });

        if (!viewer || viewer.isDestroyed()) {
          ts.destroy();
          return null;
        }

        // PDAL Geographic Fix
        const rootTransform = ts.root.transform;
        const translation = Matrix4.getTranslation(rootTransform, new Cartesian3());
        const magnitude = Cartesian3.magnitude(translation);
        if (magnitude > 0 && magnitude < 100000) {
          const lat = translation.x; const lon = translation.y; const height = translation.z;
          const ecefCenter = Cartesian3.fromDegrees(lon, lat, height);
          const enuToEcef = Transforms.eastNorthUpToFixedFrame(ecefCenter);
          const localToEnu = new Matrix4(0, 111132.0 * Math.cos(CesiumMath.toRadians(lat)), 0, 0, 111132.0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
          ts.root.transform = Matrix4.IDENTITY;
          ts.modelMatrix = Matrix4.multiply(enuToEcef, localToEnu, new Matrix4());
        }

        ts.splitDirection = split;
        viewer.scene.primitives.add(ts);
        return ts;
      } catch (e) {
        console.error(TAG, 'Tileset load failed', url, e);
        return null;
      }
    };

    const urlA = getAssetUrl(manifestA, 'point_cloud');
    if (urlA && lazVisible && mode === 'slider') {
      if (lastUrlARef.current !== urlA) {
        if (lazARef.current) viewer.scene.primitives.remove(lazARef.current);
        lastUrlARef.current = urlA;
        setupTileset(urlA, SplitDirection.LEFT).then(ts => {
          if (ts) lazARef.current = ts;
        });
      } else if (lazARef.current) {
        lazARef.current.show = true;
      }
    } else {
      if (lazARef.current) {
        viewer.scene.primitives.remove(lazARef.current);
        lazARef.current = null;
      }
      lastUrlARef.current = null;
    }

    const urlB = getAssetUrl(manifestB, 'point_cloud');
    if (urlB && lazVisible) {
      if (lastUrlBRef.current !== urlB) {
        if (lazBRef.current) viewer.scene.primitives.remove(lazBRef.current);
        lastUrlBRef.current = urlB;
        setupTileset(urlB, mode === 'slider' ? SplitDirection.RIGHT : SplitDirection.NONE).then(ts => {
          if (ts) lazBRef.current = ts;
        });
      } else if (lazBRef.current) {
        lazBRef.current.show = true;
        lazBRef.current.splitDirection = mode === 'slider' ? SplitDirection.RIGHT : SplitDirection.NONE;
      }
    } else {
      if (lazBRef.current) {
        viewer.scene.primitives.remove(lazBRef.current);
        lazBRef.current = null;
      }
      lastUrlBRef.current = null;
    }

    viewer.scene.requestRender();
  }, [viewerRef, enabled, mode, manifestA, manifestB, layers.laz.visible]);

  return null;
}
