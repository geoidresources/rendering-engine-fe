'use client';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['CESIUM_BASE_URL'] =
    typeof CESIUM_BASE_URL !== 'undefined' ? CESIUM_BASE_URL : '/cesiumStatic';
}

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  Ion,
  UrlTemplateImageryProvider,
  CesiumTerrainProvider,
  Cartesian3,
  Math as CesiumMath,
  Color,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cesium3DTileStyle,
  defined,
  Cesium3DTileFeature,
  JulianDate,
  Cartographic,
  sampleTerrainMostDetailed,
  EllipsoidTerrainProvider,
  ColorBlendMode,
  Transforms,
  Model as CesiumModel,
  Viewer as CesiumViewer,
  ImageryLayer,
  Cesium3DTileset,
  GeoJsonDataSource,
} from 'cesium';

// We do not import resium anymore
import { useViewerStore } from '../store/viewerStore';
import { LayerPanel } from './LayerPanel';
import { Toolbar } from './Toolbar';
import { InspectorPanel } from './InspectorPanel';

Ion.defaultAccessToken = '';

const TAG = '[Viewer]';
const DEFAULT_SITE_CENTER_LNG = 152.414949;
const DEFAULT_SITE_CENTER_LAT = -32.062341;

function pointBudgetToMaximumScreenSpaceError(budget: number): number {
  const POINT_BUDGET_MIN = 100_000;
  const POINT_BUDGET_MAX = 10_000_000;
  const t = Math.min(1, Math.max(0, (budget - POINT_BUDGET_MIN) / (POINT_BUDGET_MAX - POINT_BUDGET_MIN)));
  return 32 - t * (32 - 2);
}

function pointBudgetToCacheBytes(budget: number): number {
  const POINT_BUDGET_MIN = 100_000;
  const POINT_BUDGET_MAX = 10_000_000;
  const t = Math.min(1, Math.max(0, (budget - POINT_BUDGET_MIN) / (POINT_BUDGET_MAX - POINT_BUDGET_MIN)));
  const minBytes = 128 * 1024 * 1024;
  const maxBytes = 512 * 1024 * 1024;
  return Math.round(minBytes + t * (maxBytes - minBytes));
}

function buildPointCloudStyle(opacity: number): Cesium3DTileStyle | undefined {
  const a = Math.min(1, Math.max(0, opacity));
  if (a >= 0.99) return undefined;
  return new Cesium3DTileStyle({
    pointSize: 3,
    color: `rgba(255, 255, 255, ${a})`,
  });
}

export default function Viewer() {
  const {
    layers,
    terrainMode,
    setCameraState,
    loadManifest,
    getAssetUrl,
    terrainExaggeration,
    manifest,
    activeTool,
    setSelectedFeature,
    pointBudget,
    setLayerError,
    setLayerLoading,
  } = useViewerStore(
    useShallow((s) => ({
      layers: s.layers,
      terrainMode: s.terrainMode,
      setCameraState: s.setCameraState,
      loadManifest: s.loadManifest,
      getAssetUrl: s.getAssetUrl,
      terrainExaggeration: s.terrainExaggeration,
      manifest: s.manifest,
      activeTool: s.activeTool,
      setSelectedFeature: s.setSelectedFeature,
      pointBudget: s.pointBudget,
      setLayerError: s.setLayerError,
      setLayerLoading: s.setLayerLoading,
    }))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  
  // Layer Refs to manage primitives iteratively
  const baseMapLayerRef = useRef<ImageryLayer | null>(null);
  const orthoLayerRef = useRef<ImageryLayer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const vectorDataSourceRef = useRef<GeoJsonDataSource | null>(null);
  const modelPrimitiveRef = useRef<CesiumModel | null>(null);
  const pickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  
  const siteModelAnchor = useMemo(() => manifest?.anchors?.find((a) => a.name === 'site_model'), [manifest]);
  const boundsCenterLng = manifest?.bounds ? (manifest.bounds.west + manifest.bounds.east) / 2 : undefined;
  const boundsCenterLat = manifest?.bounds ? (manifest.bounds.south + manifest.bounds.north) / 2 : undefined;
  const siteCenterLng = siteModelAnchor?.longitude ?? boundsCenterLng ?? DEFAULT_SITE_CENTER_LNG;
  const siteCenterLat = siteModelAnchor?.latitude ?? boundsCenterLat ?? DEFAULT_SITE_CENTER_LAT;
  const siteCenterHeight = siteModelAnchor?.height ?? 85;

  const pointCloudTilesetUrl = useMemo(() => {
    if (!manifest?.assets) return undefined;
    for (const a of manifest.assets) {
      if (a.assetType === 'point_cloud' && (a.format === '3dtiles' || /tileset\.json/.test(a.url))) return a.url;
    }
    return undefined;
  }, [manifest]);
  const orthoUrl = getAssetUrl('ortho');
  const terrainUrl = getAssetUrl(terrainMode === 'dtm' ? 'terrain_dtm' : 'terrain_dsm');
  const vectorUrl = getAssetUrl('vector');
  const siteModelUrl = getAssetUrl('site_model', 'glb');
  const orthoAsset = useMemo(() => manifest?.assets?.find((a) => a.assetType === 'ortho'), [manifest]);

  // Load manifest on mount
  useEffect(() => {
    const manifestId = process.env.NEXT_PUBLIC_MANIFEST_ID || 'rendering-assets-v2';
    loadManifest(`${manifestId}?t=${Date.now()}`);
  }, [loadManifest]);

  // ---- Initialize the Pure Cesium Viewer ----
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    
    // Hide standard credit display elements to clean up DOM 
    const creditContainer = document.createElement('div');
    creditContainer.style.display = 'none';

    const viewer = new CesiumViewer(containerRef.current, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false as unknown as ImageryLayer,
      requestRenderMode: true,
      maximumRenderTimeChange: 0.0,
      creditContainer,
    });

    // Production optimizations
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.logarithmicDepthBuffer = true;
    viewer.scene.fog.enabled = false;
    if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.brightnessShift = -0.1;
    }
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.baseColor = Color.fromCssColorString('#1a1a2e');

    // Add base map
    const provider = new UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      minimumLevel: 0,
      maximumLevel: 19,
    });
    baseMapLayerRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);

    viewerRef.current = viewer;

    // Track Context Loss
    const canvas = viewer.canvas;
    const ctxLossHandler = (e: Event) => {
        e.preventDefault();
        console.error(`${TAG} WebGL Context Lost! You may need to refresh or reduce point budget.`);
    };
    canvas.addEventListener('webglcontextlost', ctxLossHandler);

    return () => {
      canvas.removeEventListener('webglcontextlost', ctxLossHandler);
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // ---- Initial FlyTo based on Manifest ----
  const initialFrameDone = useRef(false);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !manifest || initialFrameDone.current) return;
    
    initialFrameDone.current = true;
    const centerLon = boundsCenterLng ?? DEFAULT_SITE_CENTER_LNG;
    const centerLat = boundsCenterLat ?? DEFAULT_SITE_CENTER_LAT;
    const spanDeg = manifest.bounds ? Math.max(Math.abs(manifest.bounds.east - manifest.bounds.west), Math.abs(manifest.bounds.north - manifest.bounds.south), 0.002) : 0.02;
    const baseHeight = Math.max(1200, spanDeg * 160000);
    const scale = manifest.rendering?.suggestedViewHeightScale ?? 1;
    
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(centerLon, centerLat, baseHeight * scale),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-30), roll: 0 },
      duration: 1.5,
    });
  }, [manifest, boundsCenterLng, boundsCenterLat]);

  // ---- Camera Tracking ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handler = () => {
      const pos = viewer.camera.positionCartographic;
      setCameraState({
        longitude: CesiumMath.toDegrees(pos.longitude),
        latitude: CesiumMath.toDegrees(pos.latitude),
        height: pos.height,
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      });
    };
    viewer.camera.moveEnd.addEventListener(handler);
    return () => { viewer.camera.moveEnd.removeEventListener(handler); };
  }, [setCameraState]);

  // ---- Terrain Provider ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    
    if (!terrainUrl) {
      viewer.terrainProvider = new EllipsoidTerrainProvider();
    } else {
      CesiumTerrainProvider.fromUrl(terrainUrl, { requestVertexNormals: true }).then((tp) => {
        if (!viewer.isDestroyed()) {
          viewer.terrainProvider = tp;
          viewer.scene.requestRender();
        }
      }).catch(e => console.error(`${TAG} terrain fail`, e));
    }
  }, [terrainUrl]);

  // ---- Terrain Exaggeration ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.verticalExaggeration = terrainExaggeration;
    viewer.scene.verticalExaggerationRelativeHeight = 0;
    viewer.scene.requestRender();
  }, [terrainExaggeration]);

  // ---- Orthomosaic Layer ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    
    if (!orthoUrl || !layers.ortho.visible) {
      if (orthoLayerRef.current) {
        orthoLayerRef.current.show = false;
        viewer.scene.requestRender();
      }
      return;
    }

    if (!orthoLayerRef.current) {
        const provider = new UrlTemplateImageryProvider({
          url: orthoUrl,
          minimumLevel: orthoAsset?.minZoom ?? 14,
          maximumLevel: orthoAsset?.maxZoom ?? 22,
          rectangle: manifest?.bounds
            ? Rectangle.fromDegrees(manifest.bounds.west, manifest.bounds.south, manifest.bounds.east, manifest.bounds.north)
            : Rectangle.fromDegrees(152.4, -32.08, 152.43, -32.04),
        });
        const clayer = viewer.scene.imageryLayers.addImageryProvider(provider);
        orthoLayerRef.current = clayer;
    }
    
    orthoLayerRef.current.show = true;
    orthoLayerRef.current.alpha = layers.ortho.opacity;
    viewer.scene.requestRender();
  }, [orthoUrl, layers.ortho.visible, layers.ortho.opacity, orthoAsset, manifest]);

  // ---- Point Cloud 3D Tileset (with dynamic EDL) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!pointCloudTilesetUrl || !layers.laz.visible) {
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
        viewer.scene.requestRender();
      }
      // Report issues if invisible due to missing url
      if (layers.laz.visible && !pointCloudTilesetUrl) {
          setLayerError('laz', 'No 3D Tiles URL found in manifest.');
      }
      return;
    } else {
        setLayerError('laz', null);
    }

    let isSubscribed = true;

    if (!tilesetRef.current || (tilesetRef.current as any)._url !== pointCloudTilesetUrl) {
        if (tilesetRef.current) {
           viewer.scene.primitives.remove(tilesetRef.current);
           tilesetRef.current = null;
        }
        setLayerLoading('laz', true);

        Cesium3DTileset.fromUrl(pointCloudTilesetUrl, {
            maximumScreenSpaceError: pointBudgetToMaximumScreenSpaceError(pointBudget),
            cacheBytes: pointBudgetToCacheBytes(pointBudget),
            pointCloudShading: {
                attenuation: true,
                eyeDomeLighting: true,
                eyeDomeLightingStrength: 1.0,
                maximumAttenuation: 4,
                geometricErrorScale: 1.0,
            }
        }).then(tileset => {
            if (!viewer.isDestroyed() && isSubscribed) {
                viewer.scene.primitives.add(tileset);
                tilesetRef.current = tileset;
                tileset.show = layers.laz.visible;
                tileset.style = buildPointCloudStyle(layers.laz.opacity) as any;
                setLayerLoading('laz', false);
                viewer.scene.requestRender();
            }
        }).catch(e => {
            console.error(`${TAG} Failed to load point cloud`, e);
            if (isSubscribed) {
                setLayerError('laz', 'Failed to load point cloud. Check network tab.');
                setLayerLoading('laz', false);
            }
        });
    } else {
        tilesetRef.current.show = true;
        tilesetRef.current.style = buildPointCloudStyle(layers.laz.opacity) as any;
        tilesetRef.current.maximumScreenSpaceError = pointBudgetToMaximumScreenSpaceError(pointBudget);
        viewer.scene.requestRender();
    }

    return () => { isSubscribed = false; };
  }, [pointCloudTilesetUrl, layers.laz.visible, layers.laz.opacity, pointBudget, setLayerError, setLayerLoading]);

  // Add Dynamic EDL updates based on camera
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const updateEDL = () => {
        const ts = tilesetRef.current;
        if (!ts || !ts.show) return;
        const camDist = viewer.camera.positionCartographic.height;
        // As you get closer, strengthen the EDL outlines
        if (ts.pointCloudShading) {
            let strength = 0.5;
            let radius = 1.0;
            if (camDist < 500) { strength = 1.5; radius = 2.0; } 
            else if (camDist < 2000) { strength = 1.0; radius = 1.5; }
            ts.pointCloudShading.eyeDomeLightingStrength = strength;
            ts.pointCloudShading.eyeDomeLightingRadius = radius;
        }
    };
    viewer.scene.preRender.addEventListener(updateEDL);
    return () => { viewer.scene.preRender.removeEventListener(updateEDL); };
  }, []);

  // ---- Vector (GeoJSON) Layer ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!vectorUrl || !layers.polygons.visible) {
      if (vectorDataSourceRef.current) {
        vectorDataSourceRef.current.show = false;
        viewer.scene.requestRender();
      }
      return;
    }

    let isSubscribed = true;
    if (!vectorDataSourceRef.current) {
        GeoJsonDataSource.load(vectorUrl, {
            stroke: Color.fromCssColorString('#ef4444'),
            fill: Color.fromCssColorString('#ef4444').withAlpha(layers.polygons.opacity * 0.35),
            strokeWidth: 2,
            clampToGround: true, // Ground/Classification Primitives mapping handled internally by Cesium since 1.62
        }).then(ds => {
            if (!viewer.isDestroyed() && isSubscribed) {
                viewer.dataSources.add(ds);
                vectorDataSourceRef.current = ds;
                
                // Polyfill properties for pick event
                ds.entities.values.forEach((entity) => {
                  (entity as any)['_geoJsonProperties'] = entity.properties;
                });
                viewer.scene.requestRender();
            }
        });
    } else {
        vectorDataSourceRef.current.show = true;
        // Updating fill color of entities dynamically is slightly heavier over collections in vanilla Cesium, 
        // so we re-load if necessary, or just rely on CSS injection (but for now simple .show=true covers visibility bounds).
        viewer.scene.requestRender();
    }

    return () => { isSubscribed = false; };
  }, [vectorUrl, layers.polygons.visible, layers.polygons.opacity]);

  // ---- GLB Site Model ---
  useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const visible = !!siteModelUrl && layers.site_model.visible && layers.site_model.opacity > 0.02;
      
      if (!visible || !siteModelUrl) {
          if (modelPrimitiveRef.current) {
              modelPrimitiveRef.current.show = false;
              viewer.scene.requestRender();
          }
          return;
      }

      setLayerLoading('site_model', true);

      const sampleAndPlace = async () => {
          let h = siteCenterHeight;
          const tp = viewer.terrainProvider;
          if (tp && !(tp instanceof EllipsoidTerrainProvider)) {
              try {
                  const updated = await sampleTerrainMostDetailed(tp, [Cartographic.fromDegrees(siteCenterLng, siteCenterLat)]);
                  if (updated?.[0]?.height !== undefined) {
                      h = updated[0].height + 12; // slight offset
                  }
              } catch (e) {
                  // Fallback to default
              }
          }
          
          if (viewer.isDestroyed()) return;

          const modelMatrix = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(siteCenterLng, siteCenterLat, h));
          const color = Color.WHITE.withAlpha(Math.max(0, Math.min(1, layers.site_model.opacity)));

          if (!modelPrimitiveRef.current) {
               CesiumModel.fromGltfAsync({
                   url: siteModelUrl,
                   modelMatrix: modelMatrix,
                   color: color,
                   colorBlendMode: ColorBlendMode.MIX,
                   colorBlendAmount: 1,
               }).then(model => {
                   if (viewer.isDestroyed()) return;
                   viewer.scene.primitives.add(model);
                   modelPrimitiveRef.current = model;
                   model.show = layers.site_model.visible;
                   setLayerLoading('site_model', false);
                   viewer.scene.requestRender();
               }).catch(e => {
                   console.error("Failed to load model", e);
                   setLayerError('site_model', 'Failed to load model');
                   setLayerLoading('site_model', false);
               });
          } else {
               modelPrimitiveRef.current.show = true;
               modelPrimitiveRef.current.modelMatrix = modelMatrix;
               modelPrimitiveRef.current.color = color;
               setLayerLoading('site_model', false);
               viewer.scene.requestRender();
          }
      };

      sampleAndPlace();
  }, [siteModelUrl, layers.site_model.visible, layers.site_model.opacity, terrainMode, terrainUrl, siteCenterLng, siteCenterLat, siteCenterHeight, setLayerLoading, setLayerError]);

  // ---- Interaction Picker ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || activeTool !== 'select') return;

    if (pickHandlerRef.current) {
        pickHandlerRef.current.destroy();
    }
    
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    pickHandlerRef.current = handler;

    handler.setInputAction((click: { position: import('cesium').Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const now = JulianDate.now();

      if (!defined(picked)) {
        setSelectedFeature(null);
        return;
      }

      if (picked instanceof Cesium3DTileFeature) {
        const names = picked.getPropertyIds();
        const props: Record<string, unknown> = { _source: '3dTiles' };
        for (let i = 0; i < names.length; i++) {
          props[names[i]] = picked.getProperty(names[i]);
        }
        setSelectedFeature(props);
        return;
      }

      const primitive = picked && typeof picked === 'object' && 'primitive' in picked ? (picked as any).primitive : undefined;
      if (primitive instanceof CesiumModel) {
        setSelectedFeature({ _source: 'site_model', name: 'Site model (GLB)' });
        return;
      }

      if (picked.id && typeof picked.id === 'object') {
        const entity = picked.id as import('cesium').Entity & { properties?: import('cesium').PropertyBag };
        const custom = (entity as any)._geoJsonProperties;
        if (custom && typeof custom.getValue === 'function') {
          setSelectedFeature(custom.getValue(now) as Record<string, unknown>);
          return;
        }
        if (custom && typeof custom === 'object') {
          setSelectedFeature(custom as Record<string, unknown>);
          return;
        }
        if (entity.properties) {
          setSelectedFeature(entity.properties.getValue(now) as Record<string, unknown>);
          return;
        }
        setSelectedFeature({ _source: 'entity', id: entity.id, name: entity.name });
        return;
      }

      setSelectedFeature(null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
       if (pickHandlerRef.current) {
           pickHandlerRef.current.destroy();
           pickHandlerRef.current = null;
       }
    };
  }, [activeTool, setSelectedFeature]);

  return (
    <div className="relative w-full h-screen overflow-hidden flex bg-gray-900">
      <LayerPanel />

      <div className="flex-1 relative h-full">
        <Toolbar />
        <div ref={containerRef} className="absolute inset-0 w-full h-full outline-none" tabIndex={0} />
        <InspectorPanel />
      </div>
    </div>
  );
}
