'use client';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['CESIUM_BASE_URL'] =
    typeof CESIUM_BASE_URL !== 'undefined' ? CESIUM_BASE_URL : '/cesiumStatic';
}

import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  Viewer as ResiumViewer,
  ImageryLayer,
  Cesium3DTileset,
  GeoJsonDataSource,
  Model,
  CameraFlyTo,
} from 'resium';
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
  HeadingPitchRange,
  ColorBlendMode,
  Transforms,
  Matrix4,
  BoundingSphere,
  Model as CesiumModel,
} from 'cesium';

import { useViewerStore } from '../store/viewerStore';
import { LayerPanel } from './LayerPanel';
import { Toolbar } from './Toolbar';
import { InspectorPanel } from './InspectorPanel';

Ion.defaultAccessToken = '';

const TAG = '[CesiumViewer]';
const SITE_CENTER_LNG = 152.414949;
const SITE_CENTER_LAT = -32.062341;
const POINT_BUDGET_MIN = 100_000;
const POINT_BUDGET_MAX = 10_000_000;

/** Higher point budget → lower SSE (more detail on screen). */
function pointBudgetToMaximumScreenSpaceError(budget: number): number {
  const t = Math.min(
    1,
    Math.max(0, (budget - POINT_BUDGET_MIN) / (POINT_BUDGET_MAX - POINT_BUDGET_MIN))
  );
  return 40 - t * (40 - 2);
}

/** Higher point budget → larger GPU tile cache (bytes). */
function pointBudgetToCacheBytes(budget: number): number {
  const t = Math.min(
    1,
    Math.max(0, (budget - POINT_BUDGET_MIN) / (POINT_BUDGET_MAX - POINT_BUDGET_MIN))
  );
  const minBytes = 64 * 1024 * 1024;
  const maxBytes = 512 * 1024 * 1024;
  return Math.round(minBytes + t * (maxBytes - minBytes));
}

function buildPointCloudStyle(opacity: number): Cesium3DTileStyle {
  const a = Math.min(1, Math.max(0, opacity));
  return new Cesium3DTileStyle({
    pointSize: 6,
    color: `color("white", ${a})`,
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

  const cesiumRef = useRef<import('cesium').Viewer | null>(null);
  const [viewerMounted, setViewerMounted] = useState(false);
  const pointCloudZoomedRef = useRef<string | null>(null);
  const siteModelFramedKeyRef = useRef<string | null>(null);
  /** Ellipsoid height (m) at site centre — updated from terrain sampling */
  const [siteModelPosition, setSiteModelPosition] = useState(() =>
    Cartesian3.fromDegrees(SITE_CENTER_LNG, SITE_CENTER_LAT, 85)
  );

  const handleViewerRef = useCallback(
    (r: { cesiumElement: import('cesium').Viewer } | null) => {
      const v = r?.cesiumElement ?? null;
      cesiumRef.current = v;
      setViewerMounted(!!v);
      if (v) {
        const { width, height } = v.canvas;
        console.log(`${TAG} ResiumViewer mounted — canvas: ${width}×${height}`);
      }
    },
    []
  );

  useEffect(() => {
    const id = `rendering-assets-v2?t=${Date.now()}`;
    console.log(`${TAG} loadManifest →`, id);
    loadManifest(id).then(() => {
      const m = useViewerStore.getState().manifest;
      if (m) {
        console.log(
          `${TAG} manifest loaded — id: ${m.id}, assets:`,
          m.assets.map((a) => `${a.id}(${a.assetType}/${a.format})`).join(', ')
        );
      } else {
        console.warn(`${TAG} manifest returned but is still null`);
      }
    });
  }, [loadManifest]);

  useEffect(() => {
    const viewer = cesiumRef.current;
    if (!viewer) return;
    console.log(`${TAG} attaching camera moveEnd listener`);
    const handler = () => {
      const cam = viewer.camera;
      const pos = cam.positionCartographic;
      const next = {
        longitude: CesiumMath.toDegrees(pos.longitude),
        latitude: CesiumMath.toDegrees(pos.latitude),
        height: pos.height,
        heading: cam.heading,
        pitch: cam.pitch,
        roll: cam.roll,
      };
      console.log(
        `${TAG} camera moveEnd — lng=${next.longitude.toFixed(5)}`,
        `lat=${next.latitude.toFixed(5)}`,
        `h=${Math.round(next.height)}m`,
        `hdg=${(next.heading * 180 / Math.PI).toFixed(1)}°`,
        `pitch=${(next.pitch * 180 / Math.PI).toFixed(1)}°`
      );
      setCameraState(next);
    };
    viewer.camera.moveEnd.addEventListener(handler);
    return () => {
      viewer.camera.moveEnd.removeEventListener(handler);
    };
  }, [setCameraState, viewerMounted]);

  useEffect(() => {
    const viewer = cesiumRef.current;
    if (!viewer) return;
    console.log(`${TAG} apply verticalExaggeration →`, terrainExaggeration);
    viewer.scene.verticalExaggeration = terrainExaggeration;
    viewer.scene.verticalExaggerationRelativeHeight = 0;
    viewer.scene.requestRender?.();
  }, [terrainExaggeration, viewerMounted]);

  // Inspector: pick GeoJSON entities, 3D Tiles features, or generic entities
  useEffect(() => {
    const viewer = cesiumRef.current;
    if (!viewer || activeTool !== 'select') return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
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
          const n = names[i];
          props[n] = picked.getProperty(n);
        }
        setSelectedFeature(props);
        return;
      }

      const primitive =
        picked && typeof picked === 'object' && 'primitive' in picked
          ? (picked as { primitive: unknown }).primitive
          : undefined;
      if (primitive instanceof CesiumModel) {
        setSelectedFeature({
          _source: 'site_model',
          name: 'Site model (GLB)',
        });
        return;
      }

      if (picked.id && typeof picked.id === 'object') {
        const entity = picked.id as import('cesium').Entity & {
          properties?: import('cesium').PropertyBag;
        };
        const custom = (entity as unknown as Record<string, unknown>)._geoJsonProperties as
          | import('cesium').PropertyBag
          | Record<string, unknown>
          | undefined;

        if (custom && typeof (custom as import('cesium').PropertyBag).getValue === 'function') {
          setSelectedFeature(
            (custom as import('cesium').PropertyBag).getValue(now) as Record<string, unknown>
          );
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
        setSelectedFeature({
          _source: 'entity',
          id: entity.id,
          name: entity.name,
        });
        return;
      }

      setSelectedFeature(null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [activeTool, viewerMounted, setSelectedFeature]);

  const orthoUrl = getAssetUrl('ortho');
  const terrainUrl = getAssetUrl(terrainMode === 'dtm' ? 'terrain_dtm' : 'terrain_dsm');
  /** Cesium only streams 3D Tiles in-browser; LAZ in the manifest must be converted to tileset.json. */
  const pointCloudTilesetUrl = useMemo(() => {
    if (!manifest?.assets) return undefined;
    for (const a of manifest.assets) {
      if (a.assetType !== 'point_cloud') continue;
      if (a.format === '3dtiles') return a.url;
      if (/tileset\.json(\?|#|$)/i.test(a.url)) return a.url;
    }
    return undefined;
  }, [manifest]);

  const vectorUrl = getAssetUrl('vector');
  const siteModelUrl = getAssetUrl('site_model', 'glb');

  const siteModelVisible =
    !!siteModelUrl &&
    layers.site_model.visible &&
    layers.site_model.opacity > 0.02;

  const siteModelColor = useMemo(
    () => Color.WHITE.withAlpha(Math.min(1, Math.max(0, layers.site_model.opacity))),
    [layers.site_model.opacity]
  );

  const siteModelMatrix = useMemo(
    () => Transforms.eastNorthUpToFixedFrame(siteModelPosition),
    [siteModelPosition]
  );

  // Explain why Point Cloud layer cannot render when manifest only has LAZ
  useEffect(() => {
    if (!layers.laz.visible) {
      setLayerError('laz', null);
      return;
    }
    if (!manifest?.assets) return;

    const pc = manifest.assets.filter((a) => a.assetType === 'point_cloud');
    if (pc.length === 0) {
      setLayerError('laz', null);
      return;
    }
    if (!pointCloudTilesetUrl) {
      const formats = [...new Set(pc.map((a) => a.format))].join(', ');
      setLayerError(
        'laz',
        `No 3D Tiles URL (found format: ${formats}). LAZ cannot be streamed in Cesium — add a tileset.json asset or convert the point cloud to 3D Tiles.`
      );
    } else {
      setLayerError('laz', null);
    }
  }, [layers.laz.visible, manifest, pointCloudTilesetUrl, setLayerError]);

  useEffect(() => {
    if (!layers.site_model.visible) siteModelFramedKeyRef.current = null;
  }, [layers.site_model.visible]);

  // Mark loading when the layer should show a model; cleared in Model onReady / onError
  useEffect(() => {
    if (!siteModelVisible || !siteModelUrl) {
      setLayerLoading('site_model', false);
      return;
    }
    setLayerLoading('site_model', true);
    setLayerError('site_model', null);
  }, [siteModelVisible, siteModelUrl, setLayerLoading, setLayerError]);

  const handleSiteModelReady = useCallback(
    (model: CesiumModel) => {
      setLayerLoading('site_model', false);
      setLayerError('site_model', null);

      const frameKey = siteModelUrl ?? '';
      if (siteModelFramedKeyRef.current === frameKey) return;

      const viewer = cesiumRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      let sphere = model.boundingSphere;
      if (!defined(sphere)) {
        const c = Matrix4.getTranslation(model.modelMatrix, new Cartesian3());
        sphere = new BoundingSphere(c, 80);
      }
      const range = Math.max(sphere.radius * 2.8, 120);
      const done = () => {
        siteModelFramedKeyRef.current = frameKey;
        console.log(`${TAG} camera framed site model (bounding sphere)`);
      };
      void Promise.resolve(
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: 1.35,
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(-38), range),
        }) as Promise<void> | void
      )
        .then(() => {
          done();
        })
        .catch((err: unknown) => {
          console.error(`${TAG} flyToBoundingSphere site model`, err);
          setLayerError(
            'site_model',
            'Could not frame model — try zooming manually; check console for errors'
          );
        });
    },
    [siteModelUrl, setLayerError, setLayerLoading]
  );

  const handleSiteModelError = useCallback(
    (err: unknown) => {
      console.error(`${TAG} site model GLB load failed`, err);
      setLayerLoading('site_model', false);
      const msg = err instanceof Error ? err.message : String(err);
      setLayerError(
        'site_model',
        `GLB failed to load: ${msg}. Check Network (404/CORS) and that CESIUM_BASE_URL includes Workers (Draco).`
      );
    },
    [setLayerError, setLayerLoading]
  );

  // Place GLB on sampled terrain height; re-sample when terrain provider becomes available
  useEffect(() => {
    if (!siteModelVisible || !siteModelUrl) return;
    const viewer = cesiumRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    const fallback = () => {
      setSiteModelPosition(Cartesian3.fromDegrees(SITE_CENTER_LNG, SITE_CENTER_LAT, 85));
    };

    const sample = () => {
      const tp = viewer.terrainProvider;
      if (!tp || tp instanceof EllipsoidTerrainProvider) {
        fallback();
        return;
      }
      const cartos = [Cartographic.fromDegrees(SITE_CENTER_LNG, SITE_CENTER_LAT)];
      sampleTerrainMostDetailed(tp, cartos)
        .then((updated) => {
          if (!viewer.isDestroyed?.() && updated?.[0]) {
            const c = updated[0];
            const h = c.height ?? 0;
            setSiteModelPosition(Cartesian3.fromRadians(c.longitude, c.latitude, h + 12));
          } else {
            fallback();
          }
        })
        .catch((err) => {
          console.warn(`${TAG} sampleTerrain for site model`, err);
          fallback();
        });
    };

    sample();
    const globe = viewer.scene?.globe;
    if (!globe?.terrainProviderChanged) return;
    const removeListener = globe.terrainProviderChanged.addEventListener(sample);
    return () => {
      removeListener();
    };
  }, [siteModelVisible, siteModelUrl, viewerMounted, terrainUrl, terrainMode]);

  const tilesetSse = useMemo(
    () => pointBudgetToMaximumScreenSpaceError(pointBudget),
    [pointBudget]
  );
  const tilesetCacheBytes = useMemo(
    () => pointBudgetToCacheBytes(pointBudget),
    [pointBudget]
  );
  const pointCloudStyle = useMemo(
    () => buildPointCloudStyle(layers.laz.opacity),
    [layers.laz.opacity]
  );

  useEffect(() => {
    if (!manifest) return;
    console.group(`${TAG} asset URLs (terrainMode=${terrainMode})`);
    console.log('ortho      :', orthoUrl ?? '— not found');
    console.log('terrain    :', terrainUrl ?? '— not found');
    console.log('point cloud (3D Tiles):', pointCloudTilesetUrl ?? '— not found');
    console.log('vector     :', vectorUrl ?? '— not found');
    console.log('site model :', siteModelUrl ?? '— not found');
    console.groupEnd();
  }, [manifest, terrainMode, orthoUrl, terrainUrl, pointCloudTilesetUrl, vectorUrl, siteModelUrl]);

  useEffect(() => {
    console.group(`${TAG} layer render state`);
    console.log(
      'ortho     visible=%s url=%s → render=%s',
      layers.ortho.visible,
      orthoUrl ?? '—',
      layers.ortho.visible && !!orthoUrl
    );
    console.log(
      'laz       visible=%s url=%s → render=%s',
      layers.laz.visible,
      pointCloudTilesetUrl ?? '—',
      layers.laz.visible && !!pointCloudTilesetUrl
    );
    console.log(
      'polygons  visible=%s url=%s → render=%s',
      layers.polygons.visible,
      vectorUrl ?? '—',
      layers.polygons.visible && !!vectorUrl
    );
    console.log(
      'siteModel visible=%s url=%s → render=%s',
      layers.site_model.visible,
      siteModelUrl ?? '—',
      layers.site_model.visible && !!siteModelUrl
    );
    console.log('terrain   mode=%s  url=%s → render=%s', terrainMode, terrainUrl ?? '—', !!terrainUrl);
    console.log(`${TAG} point cloud SSE=${tilesetSse.toFixed(1)} cacheMB=${(tilesetCacheBytes / 1024 / 1024).toFixed(0)}`);
    console.groupEnd();
  }, [
    layers,
    terrainMode,
    orthoUrl,
    pointCloudTilesetUrl,
    vectorUrl,
    siteModelUrl,
    terrainUrl,
    tilesetSse,
    tilesetCacheBytes,
  ]);

  const basemapProvider = useMemo(() => {
    console.log(`${TAG} creating basemap provider (Carto Light)`);
    return new UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      minimumLevel: 0,
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors © CARTO',
    });
  }, []);

  const orthoProvider = useMemo(() => {
    if (!orthoUrl) {
      console.log(`${TAG} orthoProvider — skipped (no URL)`);
      return null;
    }
    console.log(`${TAG} creating ortho provider →`, orthoUrl);
    return new UrlTemplateImageryProvider({
      url: orthoUrl,
      minimumLevel: 14,
      maximumLevel: 22,
      rectangle: Rectangle.fromDegrees(152.40, -32.08, 152.43, -32.04),
    });
  }, [orthoUrl]);

  const terrainProviderPromise = useMemo(() => {
    if (!terrainUrl) {
      console.log(`${TAG} terrainProvider — skipped (no URL)`);
      return undefined;
    }
    console.log(`${TAG} creating terrain provider →`, terrainUrl);
    const p = CesiumTerrainProvider.fromUrl(terrainUrl);
    p.then(
      (tp) =>
        console.log(
          `${TAG} terrain provider ready — scheme:`,
          (tp as unknown as Record<string, unknown>).tilingScheme?.constructor?.name ?? 'unknown'
        ),
      (err) => console.error(`${TAG} terrain provider FAILED`, err)
    );
    return p;
  }, [terrainUrl]);

  const initialDestination = useMemo(
    () => Cartesian3.fromDegrees(SITE_CENTER_LNG, SITE_CENTER_LAT, 3000),
    []
  );
  const initialOrientation = useMemo(
    () => ({ heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-30), roll: 0 }),
    []
  );

  const hiddenCreditContainer = useMemo(() => {
    if (typeof document === 'undefined') return undefined;
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    return el;
  }, []);

  const handlePointCloudReady = useCallback(
    (tileset: import('cesium').Cesium3DTileset) => {
      console.log(
        `${TAG} Cesium3DTileset ready — root geometric error:`,
        tileset.root?.geometricError
      );
      try {
        tileset.pointCloudShading.attenuation = true;
        tileset.pointCloudShading.eyeDomeLighting = true;
        tileset.pointCloudShading.eyeDomeLightingStrength = 0.6;
      } catch (e) {
        console.warn(`${TAG} pointCloudShading tweak skipped`, e);
      }

      const viewer = cesiumRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      const key = pointCloudTilesetUrl ?? '';
      if (pointCloudZoomedRef.current === key) return;
      // Avoid fighting the site-model camera when both layers are on
      const siteOn =
        !!siteModelUrl && layers.site_model.visible && layers.site_model.opacity > 0.02;
      if (siteOn) {
        console.log(`${TAG} skipping point-cloud auto-zoom (site model visible)`);
        return;
      }
      pointCloudZoomedRef.current = key;

      try {
        const sphere = tileset.boundingSphere;
        if (defined(sphere)) {
          viewer.camera.flyToBoundingSphere(sphere, { duration: 1.5 });
        } else {
          void viewer.zoomTo(tileset);
        }
      } catch (e) {
        console.warn(`${TAG} zoomTo tileset failed`, e);
      }
    },
    [pointCloudTilesetUrl, siteModelUrl, layers.site_model.visible, layers.site_model.opacity]
  );

  return (
    <div className="relative w-full h-screen overflow-hidden flex bg-gray-900">
      <LayerPanel />

      <div className="flex-1 relative h-full">
        <Toolbar />

        <ResiumViewer
          ref={handleViewerRef}
          full
          {...(hiddenCreditContainer ? { creditContainer: hiddenCreditContainer } : {})}
          geocoder={false}
          homeButton={false}
          sceneModePicker={false}
          baseLayerPicker={false}
          navigationHelpButton={false}
          animation={false}
          timeline={false}
          selectionIndicator={false}
          infoBox={false}
          baseLayer={false as unknown as import('cesium').ImageryLayer}
          terrainProvider={terrainProviderPromise as Promise<import('cesium').TerrainProvider> | undefined}
        >
          <CameraFlyTo
            destination={initialDestination}
            orientation={initialOrientation}
            duration={0}
          />

          <ImageryLayer imageryProvider={basemapProvider} />

          {layers.ortho.visible && orthoProvider && (
            <ImageryLayer imageryProvider={orthoProvider} alpha={layers.ortho.opacity} />
          )}

          {layers.laz.visible && pointCloudTilesetUrl && (
            <Cesium3DTileset
              key={`pc-${pointCloudTilesetUrl}`}
              url={pointCloudTilesetUrl}
              show={layers.laz.visible}
              maximumScreenSpaceError={tilesetSse}
              cacheBytes={tilesetCacheBytes}
              style={pointCloudStyle}
              onReady={handlePointCloudReady}
              onTileFailed={(e) => console.error(`${TAG} Cesium3DTileset tile failed`, e)}
            />
          )}

          {layers.polygons.visible && vectorUrl && (
            <GeoJsonDataSource
              data={vectorUrl}
              stroke={Color.fromCssColorString('#ef4444')}
              fill={Color.fromCssColorString('#ef4444').withAlpha(layers.polygons.opacity * 0.35)}
              strokeWidth={2}
              clampToGround
              onLoad={(ds) => {
                console.log(`${TAG} GeoJsonDataSource loaded — entities:`, ds.entities.values.length);
                ds.entities.values.forEach((entity) => {
                  (entity as unknown as Record<string, unknown>)['_geoJsonProperties'] =
                    entity.properties;
                });
              }}
              onError={(e) => console.error(`${TAG} GeoJsonDataSource error`, e)}
            />
          )}

          {siteModelVisible && siteModelUrl && (
            <Model
              key={`sm-${siteModelUrl}`}
              url={siteModelUrl}
              modelMatrix={siteModelMatrix}
              scale={1}
              minimumPixelSize={128}
              maximumScale={50000}
              color={siteModelColor}
              colorBlendMode={ColorBlendMode.MIX}
              colorBlendAmount={1}
              incrementallyLoadTextures
              show
              onReady={handleSiteModelReady}
              onError={handleSiteModelError}
            />
          )}
        </ResiumViewer>

        <InspectorPanel />
      </div>
    </div>
  );
}
