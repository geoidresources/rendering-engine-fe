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
  Cartesian2,
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
  Matrix4,
  EllipsoidGeodesic,
  ColorMaterialProperty,
  TileAvailability,
  GeographicTilingScheme,
} from 'cesium';

// We do not import resium anymore
import { useViewerStore } from '../../store/viewerStore';
import { LayerPanel } from '../../components/LayerPanel';
import { Toolbar } from '../../components/Toolbar';
import { InspectorPanel } from '../../components/InspectorPanel';
import { fetchMockAreaDetails } from '../../lib/mockAreaDetails';
import { useMeasurementHandler } from '../../hooks/useMeasurementHandler';
import { CompassWidget } from '../../components/viewer/CompassWidget';
import { ZoomControls } from '../../components/viewer/ZoomControls';
import { CoordinatesBar } from '../../components/viewer/CoordinatesBar';
import { ScaleBar } from '../../components/viewer/ScaleBar';
import { HeatmapLegend } from '../../components/viewer/HeatmapLegend';
import { TimelineBar } from '../../components/viewer/TimelineBar';
import { AnomalyAlerts } from '../../components/viewer/AnomalyAlerts';
import { SiteDistribution } from '../../components/viewer/SiteDistribution';
import { ZoneAnalyticsPanel } from '../../components/viewer/ZoneAnalyticsPanel';
import type { AnomalyAlert } from '../../components/viewer/AnomalyAlerts';
import type { ZoneData } from '../../components/viewer/ZoneAnalyticsPanel';
import type { SiteDistributionItem } from '../../components/viewer/SiteDistribution';
import { apiClient, unwrapList } from '../../lib/http';
import type { ListEnvelope } from '@/types/api';

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

/** Smooth EDL parameter interpolation based on camera altitude (metres). */
function lerpEDL(camDist: number): { strength: number; radius: number } {
  if (camDist < 200) return { strength: 2.0, radius: 2.5 };
  if (camDist > 3000) return { strength: 0.3, radius: 0.8 };
  const t = (camDist - 200) / (3000 - 200);
  return {
    strength: 2.0 - t * 1.7,
    radius: 2.5 - t * 1.7,
  };
}

function buildPointCloudStyle(opacity: number): Cesium3DTileStyle {
  const a = Math.min(1, Math.max(0, opacity));
  return new Cesium3DTileStyle({
    pointSize: 3,
    color: `color() * vec4(1.0, 1.0, 1.0, ${a.toFixed(4)})`,
  });
}

function pickScenePosition(
  viewer: import('cesium').Viewer,
  windowPosition: Cartesian2
): Cartesian3 | null {
  const scene = viewer.scene;

  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }

  const ray = viewer.camera.getPickRay(windowPosition);
  if (!ray) return null;
  const globePick = scene.globe.pick(ray, scene);
  return defined(globePick) ? globePick : null;
}

function cartesianToMeasurementPoint(position: Cartesian3) {
  const cartographic = Cartographic.fromCartesian(position);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    height: cartographic.height,
  };
}

function computeDistanceMeters(points: Cartesian3[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const start = Cartographic.fromCartesian(points[i - 1]);
    const end = Cartographic.fromCartesian(points[i]);
    const geodesic = new EllipsoidGeodesic(start, end);
    const surfaceDistance = geodesic.surfaceDistance ?? 0;
    const verticalDelta = (end.height ?? 0) - (start.height ?? 0);
    total += Math.sqrt(surfaceDistance * surfaceDistance + verticalDelta * verticalDelta);
  }

  return total;
}

function computeAreaSquareMeters(points: Cartesian3[]): number {
  if (points.length < 3) return 0;

  const center = points.reduce(
    (acc, point) => Cartesian3.add(acc, point, acc),
    new Cartesian3(0, 0, 0)
  );
  const centroid = Cartesian3.multiplyByScalar(center, 1 / points.length, new Cartesian3());
  const inverseTransform = Matrix4.inverseTransformation(
    Transforms.eastNorthUpToFixedFrame(centroid),
    new Matrix4()
  );
  const projected = points.map((point) =>
    Matrix4.multiplyByPoint(inverseTransform, point, new Cartesian3())
  );

  let sum = 0;
  for (let i = 0; i < projected.length; i++) {
    const current = projected[i];
    const next = projected[(i + 1) % projected.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) * 0.5;
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(2)} km`
    : `${distanceMeters.toFixed(1)} m`;
}

function formatArea(areaSquareMeters: number): string {
  return areaSquareMeters >= 10000
    ? `${(areaSquareMeters / 10000).toFixed(2)} ha`
    : `${areaSquareMeters.toFixed(0)} m\u00B2`;
}

function normalizeSelectedFeature(
  props: Record<string, unknown>,
  defaults: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...defaults,
    ...props,
    id: props.id ?? defaults.id ?? defaults._entityId ?? 'unknown',
    name: props.name ?? defaults.name ?? 'Unnamed feature',
  };
}

/** Convert a GeoJSON selectedFeature (from the store) to ZoneData for the zone panel. */
function deriveZoneData(feature: Record<string, unknown> | null): ZoneData | null {
  if (!feature) return null;
  // Only show zone panel for geojson / polygon features with volume properties
  const src = feature._source as string | undefined;
  if (src !== 'geojson' && src !== '3dTiles') return null;

  const id = String(feature.id ?? feature.zone ?? feature._entityId ?? 'unknown');
  const name = String(feature.name ?? feature.zone ?? feature.label ?? id);
  const volumeM3 = Number(feature.volume_m3 ?? feature.total_volume_m3 ?? feature.volumeM3 ?? 0);
  const massT = Number(feature.tonnage ?? feature.total_tonnage ?? feature.massT ?? feature.mass_t ?? 0);
  const areaM2 = Number(feature.area_m2 ?? feature.total_area_m2 ?? feature.areaM2 ?? 0);
  const lastSurveyed = String(feature.survey_date ?? feature.lastSurveyed ?? feature.last_surveyed ?? '—');

  // Only show if at least volume or area is nonzero (real zone polygon, not a bare click)
  if (volumeM3 === 0 && areaM2 === 0) return null;

  return { id, name, volumeM3, massT, lastSurveyed, areaM2 };
}

/** Static anomaly alerts shown in the viewer sidebar when no live API data is available. */
const DEMO_ANOMALY_ALERTS: AnomalyAlert[] = [
  { id: 'a1', type: 'volume', severity: 'alert', message: 'Volume discrepancy detected — zone exceeds 5% variance from mass balance.', zone: 'Zone A' },
  { id: 'a2', type: 'terrain', severity: 'pending', message: 'Terrain model pending reprocessing after new GCP alignment.', zone: 'Zone C' },
  { id: 'a3', type: 'boundary', severity: 'warning', message: 'Stockpile boundary shifted > 2 m from previous survey.', zone: 'Zone B' },
];

/** Static site distribution data shown in the viewer sidebar. */
const DEMO_SITE_DISTRIBUTION: SiteDistributionItem[] = [
  { label: 'Coal', value: 42500, color: '#eab308' },
  { label: 'Overburden', value: 31200, color: '#3b82f6' },
  { label: 'Topsoil', value: 18700, color: '#22c55e' },
  { label: 'Waste Rock', value: 12400, color: '#ef4444' },
];

interface ViewerProps {
  surveyId?: string;
}

export default function Viewer({ surveyId: surveyIdProp }: ViewerProps) {
  const {
    layers,
    terrainMode,
    setCameraState,
    loadManifest,
    getAssetUrl,
    terrainExaggeration,
    manifest,
    activeTool,
    blendPreset,
    selectedFeature,
    setSelectedFeature,
    setSelectedAreaDetails,
    setAreaDetailsLoading,
    pointBudget,
    setLayerError,
    setLayerLoading,
    setMeasurement,
    clearMeasurement,
    setCursorPosition,
    setAvailableSurveys,
    activeSurveyId,
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
      blendPreset: s.blendPreset,
      selectedFeature: s.selectedFeature,
      setSelectedFeature: s.setSelectedFeature,
      setSelectedAreaDetails: s.setSelectedAreaDetails,
      setAreaDetailsLoading: s.setAreaDetailsLoading,
      pointBudget: s.pointBudget,
      setLayerError: s.setLayerError,
      setLayerLoading: s.setLayerLoading,
      setMeasurement: s.setMeasurement,
      clearMeasurement: s.clearMeasurement,
      setCursorPosition: s.setCursorPosition,
      setAvailableSurveys: s.setAvailableSurveys,
      activeSurveyId: s.activeSurveyId,
    }))
  );

  // Subscribe to the flyTo bus separately to avoid triggering the big destructure re-render.
  const flyToTarget = useViewerStore((s) => s.flyToTarget);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);

  // Wire measurement tools (distance, area, volume) to Cesium drawing handlers
  useMeasurementHandler(viewerRef);

  // Layer Refs to manage primitives iteratively
  const baseMapLayerRef = useRef<ImageryLayer | null>(null);
  const orthoLayerRef = useRef<ImageryLayer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const vectorDataSourceRef = useRef<GeoJsonDataSource | null>(null);
  const modelPrimitiveRef = useRef<CesiumModel | null>(null);
  const pickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const heatmapLayerRef = useRef<ImageryLayer | null>(null);
  const contourDataSourceRef = useRef<GeoJsonDataSource | null>(null);
  const prevContourOpacityRef = useRef<number>(-1);
  const siteModelHeightRef = useRef<number | null>(null);

  const siteModelAnchor = useMemo(() => manifest?.anchors?.find((a) => a.name === 'site_model'), [manifest]);
  const boundsCenterLng = manifest?.bounds ? (manifest.bounds.west + manifest.bounds.east) / 2 : undefined;
  const boundsCenterLat = manifest?.bounds ? (manifest.bounds.south + manifest.bounds.north) / 2 : undefined;
  const siteCenterLng = siteModelAnchor?.longitude ?? boundsCenterLng ?? DEFAULT_SITE_CENTER_LNG;
  const siteCenterLat = siteModelAnchor?.latitude ?? boundsCenterLat ?? DEFAULT_SITE_CENTER_LAT;
  const siteCenterHeight = siteModelAnchor?.height ?? 85;

  const pointCloudTilesetUrl = useMemo(() => {
    if (!manifest?.assets) return undefined;
    for (const a of manifest.assets) {
      if (a.assetType !== 'point_cloud') continue;
      // Accept traditional 3D Tiles (tileset.json) and COPC (.copc.laz).
      // Cesium 1.139 cannot load .copc.laz directly via Cesium3DTileset.fromUrl,
      // so the COPC case will surface a visible error to the user rather than
      // being silently dropped. Proper COPC rendering is a follow-up (either a
      // py3dtiles conversion step in the processor or a dedicated COPC loader).
      if (a.format === '3dtiles' || a.format === 'copc' || /tileset\.json/.test(a.url) || /\.copc\.laz$/i.test(a.url)) {
        return a.url;
      }
    }
    return undefined;
  }, [manifest]);
  const orthoUrl = getAssetUrl('ortho');
  const rawTerrainUrl = getAssetUrl(terrainMode === 'dtm' ? 'terrain_dtm' : 'terrain_dsm');
  // Route terrain tiles through backend proxy to fix Content-Encoding for gzip-compressed .terrain files
  const terrainUrl = rawTerrainUrl?.startsWith('https://storage.googleapis.com/')
    ? rawTerrainUrl.replace('https://storage.googleapis.com/', `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/terrain/proxy/`)
    : rawTerrainUrl;
  const vectorUrl = getAssetUrl('vector');
  const siteModelUrl = getAssetUrl('site_model', 'glb');
  const heatmapUrl = getAssetUrl('heatmap');
  const contourUrl = getAssetUrl('contours');
  const orthoAsset = useMemo(() => manifest?.assets?.find((a) => a.assetType === 'ortho'), [manifest]);
  const heatmapAsset = useMemo(() => manifest?.assets?.find((a) => a.assetType === 'heatmap'), [manifest]);

  // Load manifest on mount — use surveyId from URL if available, else fall back to env/static
  useEffect(() => {
    let cancelled = false;
    const manifestId = surveyIdProp || process.env.NEXT_PUBLIC_MANIFEST_ID || 'rendering-assets-v2';
    loadManifest(manifestId).then(() => {
      if (cancelled) {
        // A newer request superseded this one; the store already holds the newer manifest
        // so this is safe — just prevents stale side-effects in dependent effects.
      }
    });
    return () => { cancelled = true; };
  }, [loadManifest, surveyIdProp]);

  // Populate timeline bar with sibling surveys once manifest loads
  useEffect(() => {
    const sid = manifest?.surveyId || surveyIdProp;
    if (!sid) return;

    let cancelled = false;

    (async () => {
      try {
        // Get this survey's project_id, then fetch all sibling surveys
        const surveyResp = await apiClient.get<{ id: string; project_id: string; survey_date: string }>(`/api/v1/surveys/${sid}`);
        const projectId = surveyResp.data.project_id;
        if (!projectId || cancelled) return;

        // /surveys is a list endpoint — unwrap the {data, pagination} envelope
        // so the date-sort below operates on a plain array.
        type SurveyRow = { id: string; survey_date: string };
        const siblingsResp = await apiClient.get<ListEnvelope<SurveyRow>>(
          `/api/v1/surveys?project_id=${projectId}`,
        );
        if (cancelled) return;

        const surveys = unwrapList<SurveyRow>(siblingsResp.data)
          .filter((s) => s.survey_date)
          .sort((a, b) => a.survey_date.localeCompare(b.survey_date))
          .map((s) => ({
            id: s.id,
            date: s.survey_date,
            label: new Date(s.survey_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
          }));

        setAvailableSurveys(surveys);

        // Fetch temporal anomaly alerts for this project
        try {
          type TrendRow = { material: string; is_anomaly: boolean; anomaly_severity: string; anomaly_z_score: number };
          const trendsResp = await apiClient.get<ListEnvelope<TrendRow>>(
            `/api/v1/analytics/trends?project_id=${projectId}&material=`,
          );
          const trendRows = unwrapList<TrendRow>(trendsResp.data);
          if (!cancelled && trendRows.length) {
            const anomalies: AnomalyAlert[] = trendRows
              .filter((t) => t.is_anomaly)
              .slice(0, 3)
              .map((t, i) => ({
                id: `anomaly-${i}`,
                type: 'volume',
                severity: t.anomaly_severity ?? 'warning',
                message: `${t.material}: anomaly detected (z=${t.anomaly_z_score?.toFixed(2) ?? '—'})`,
                zone: t.material,
              }));
            if (anomalies.length > 0) setLiveAnomalies(anomalies);
          }
        } catch { /* non-critical */ }

        // Fetch stockpile totals for site distribution chart
        try {
          type StockpileRow = { material_type: string; volume_m3: number };
          const stockpilesResp = await apiClient.get<ListEnvelope<StockpileRow>>(
            `/api/v1/analytics/stockpiles?survey_id=${sid}`,
          );
          const stockpileRows = unwrapList<StockpileRow>(stockpilesResp.data);
          if (!cancelled && stockpileRows.length) {
            // Group by material and sum volume
            const grouped = stockpileRows.reduce<Record<string, number>>((acc, row) => {
              const key = row.material_type || 'Unknown';
              acc[key] = (acc[key] ?? 0) + (row.volume_m3 ?? 0);
              return acc;
            }, {});
            const COLORS = ['#eab308', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316'];
            const distrib: SiteDistributionItem[] = Object.entries(grouped)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([label, value], i) => ({ label, value: Math.round(value), color: COLORS[i % COLORS.length] }));
            if (distrib.length > 0) setLiveSiteDistrib(distrib);
          }
        } catch { /* non-critical */ }

      } catch {
        // Survey list is non-critical — silently ignore (timeline just stays hidden)
      }
    })();

    return () => { cancelled = true; };
  }, [manifest?.surveyId, surveyIdProp, setAvailableSurveys]);

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
      requestRenderMode: false,
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
    viewer.scene.globe.maximumScreenSpaceError = 0.75;
    viewer.scene.globe.tileCacheSize = 512;

    // Add base map (CartoDB light — no {r} retina suffix; that's a Leaflet-only template var)
    const provider = new UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      minimumLevel: 0,
      maximumLevel: 19,
      credit: 'CartoDB',
    });
    baseMapLayerRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);

    viewerRef.current = viewer;

    // Kick the render loop when the tab becomes visible again
    // (requestAnimationFrame is throttled while the page is hidden)
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
        viewer.resize();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // Track Context Loss
    const canvas = viewer.canvas;
    const ctxLossHandler = (e: Event) => {
      e.preventDefault();
      console.error(`${TAG} WebGL Context Lost! You may need to refresh or reduce point budget.`);
    };
    canvas.addEventListener('webglcontextlost', ctxLossHandler);

    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler);
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
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  }, [manifest, boundsCenterLng, boundsCenterLat]);

  // ---- FlyTo bus subscriber (triggered by sidebar project/survey clicks) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyToTarget) return;

    if (flyToTarget.bounds) {
      const { west, south, east, north } = flyToTarget.bounds;
      viewer.camera.flyTo({
        destination: Rectangle.fromDegrees(west, south, east, north),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
        duration: 2.0,
      });
    } else {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          flyToTarget.lng,
          flyToTarget.lat,
          flyToTarget.height ?? 3000,
        ),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 },
        duration: 2.0,
      });
    }
    // Only re-run when the requestId changes, not on every object-identity shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTarget?.requestId]);

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

  // ---- Cursor Position Tracking (for CoordinatesBar) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const cursorHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    cursorHandler.setInputAction((move: { endPosition: Cartesian2 }) => {
      const ray = viewer.camera.getPickRay(move.endPosition);
      if (!ray) { setCursorPosition(null); return; }
      const pos = viewer.scene.globe.pick(ray, viewer.scene);
      if (!pos || !defined(pos)) { setCursorPosition(null); return; }
      const carto = Cartographic.fromCartesian(pos);
      setCursorPosition({
        lng: CesiumMath.toDegrees(carto.longitude),
        lat: CesiumMath.toDegrees(carto.latitude),
        elevation: carto.height,
      });
    }, ScreenSpaceEventType.MOUSE_MOVE);
    return () => { cursorHandler.destroy(); };
  }, [setCursorPosition]);

  // ---- 3D/2D mode state ----
  const [is3D, setIs3D] = useState(true);
  const [liveAnomalies, setLiveAnomalies] = useState<AnomalyAlert[] | null>(null);
  const [liveSiteDistrib, setLiveSiteDistrib] = useState<SiteDistributionItem[] | null>(null);

  // ---- Global loading overlay ----
  const isManifestLoading = !manifest;
  const activeLoads = useMemo(() => {
    const loads: string[] = [];
    if (isManifestLoading) loads.push('Fetching survey manifest…');
    if (layers.dsm.loading) loads.push('Loading terrain data…');
    if (layers.ortho.loading) loads.push('Loading orthomosaic tiles…');
    if (layers.laz.loading) loads.push('Loading point cloud…');
    if (layers.polygons.loading) loads.push('Loading vector features…');
    if (layers.site_model.loading) loads.push('Loading site model…');
    if (layers.contours.loading) loads.push('Loading contour data…');
    return loads;
  }, [isManifestLoading, layers.dsm.loading, layers.ortho.loading, layers.laz.loading, layers.polygons.loading, layers.site_model.loading, layers.contours.loading]);
  const showLoader = activeLoads.length > 0;

  // ---- Right sidebar data derivation ----
  const zoneData = useMemo(() => deriveZoneData(selectedFeature), [selectedFeature]);

  // Invalidate cached site model height when terrain source changes
  useEffect(() => { siteModelHeightRef.current = null; }, [terrainUrl]);

  // ---- Terrain Provider ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!terrainUrl || !layers.dsm.visible) {
      // No terrain URL or terrain layer toggled off → flat globe
      viewer.terrainProvider = new EllipsoidTerrainProvider();
      viewer.scene.requestRender();
      setLayerLoading('dsm', false);
    } else {
      setLayerLoading('dsm', true);
      CesiumTerrainProvider.fromUrl(terrainUrl, { requestVertexNormals: true }).then((tp) => {
        // Workaround: Cesium's layer.json parser may not receive the "available"
        // field through the terrain proxy (internal Resource caching).  Without
        // _availability, createQuantizedMeshTerrainData crashes with:
        //   TypeError: Cannot read properties of undefined (reading 'computeChildMaskForTile')
        // Fix: synthesize full-coverage TileAvailability so Cesium can compute
        // child masks.  For tiles that don't actually exist, Cesium gracefully 404s.
        if (!tp.availability) {
          const tilingScheme = (tp as any)._tilingScheme ?? new GeographicTilingScheme();
          const maxLevel = 22;
          const avail = new TileAvailability(tilingScheme, maxLevel);
          for (let z = 0; z <= maxLevel; z++) {
            const nX = tilingScheme.getNumberOfXTilesAtLevel(z);
            const nY = tilingScheme.getNumberOfYTilesAtLevel(z);
            avail.addAvailableTileRange(z, 0, 0, nX - 1, nY - 1);
          }
          (tp as any)._availability = avail;
          console.warn(`${TAG} patched missing terrain availability (levels 0–${maxLevel})`);
        }
        if (!viewer.isDestroyed()) {
          viewer.terrainProvider = tp;
          viewer.scene.requestRender();
          setLayerError('dsm', null);
        }
        setLayerLoading('dsm', false);
      }).catch(e => {
        console.error(`${TAG} terrain fail`, e);
        if (!viewer.isDestroyed()) {
          viewer.terrainProvider = new EllipsoidTerrainProvider();
          viewer.scene.requestRender();
        }
        setLayerLoading('dsm', false);
        if (terrainMode === 'dsm') {
          setLayerError('dsm', 'DSM terrain data is not available. Falling back to flat terrain.');
        }
      });
    }
  }, [terrainUrl, terrainMode, layers.dsm.visible, setLayerError, setLayerLoading]);

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
        rectangle: orthoAsset?.bbox?.length === 4
          ? Rectangle.fromDegrees(orthoAsset.bbox[0], orthoAsset.bbox[1], orthoAsset.bbox[2], orthoAsset.bbox[3])
          : manifest?.bounds
            ? Rectangle.fromDegrees(manifest.bounds.west, manifest.bounds.south, manifest.bounds.east, manifest.bounds.north)
            : undefined,
        hasAlphaChannel: true,
      });
      const clayer = viewer.scene.imageryLayers.addImageryProvider(provider);
      orthoLayerRef.current = clayer;
    }

    orthoLayerRef.current.show = true;
    orthoLayerRef.current.alpha = layers.ortho.opacity;
    viewer.scene.requestRender();
  }, [orthoUrl, layers.ortho.visible, layers.ortho.opacity, orthoAsset, manifest]);

  // ---- Blend Preset (stacked vs embedded imagery compositing) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const base = baseMapLayerRef.current;
    if (!base) return;

    const ortho = orthoLayerRef.current;

    if (blendPreset === 'embedded' && ortho && ortho.show) {
      // Embedded: ortho underneath basemap; basemap becomes translucent
      const il = viewer.scene.imageryLayers;
      base.alpha = 0.3;
      if (il.indexOf(ortho) > il.indexOf(base)) il.lower(ortho);
    } else {
      // Stacked (default) OR no ortho available: basemap fully opaque
      base.alpha = 1.0;
      if (ortho) {
        const il = viewer.scene.imageryLayers;
        if (il.indexOf(ortho) < il.indexOf(base)) il.raise(ortho);
      }
    }
    viewer.scene.requestRender();
  }, [blendPreset, layers.ortho.visible, layers.ortho.opacity]);

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
    }

    // COPC (.copc.laz) is produced by the processor today but Cesium 1.139 has
    // no native loader. Surface a clear status message instead of letting
    // Cesium3DTileset.fromUrl throw an opaque stack trace. This is tracked as
    // a follow-up (convert COPC → 3D Tiles in workflow-geo-svc).
    if (/\.copc\.laz$/i.test(pointCloudTilesetUrl)) {
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
        viewer.scene.requestRender();
      }
      setLayerError(
        'laz',
        'Point cloud is COPC format — viewer needs a 3D Tiles conversion step. Tracked as Phase A-4 in the backlog.',
      );
      return;
    }

    setLayerError('laz', null);

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
          // Detect geographic coords in root transform (PDAL cesium writer outputs lat/lon/height instead of ECEF)
          const rootTransform = tileset.root.transform;
          const translation = Matrix4.getTranslation(rootTransform, new Cartesian3());
          const magnitude = Cartesian3.magnitude(translation);
          if (magnitude > 0 && magnitude < 100000) {
            const lat = translation.x;
            const lon = translation.y;
            const height = translation.z;
            const ecefCenter = Cartesian3.fromDegrees(lon, lat, height);
            const enuToEcef = Transforms.eastNorthUpToFixedFrame(ecefCenter);
            const mPerDegLat = 111132.0;
            const mPerDegLon = 111132.0 * Math.cos(CesiumMath.toRadians(lat));
            // local x (lat offset) → North, local y (lon offset) → East, local z → Up
            const localToEnu = new Matrix4(
              0, mPerDegLon, 0, 0,
              mPerDegLat, 0, 0, 0,
              0, 0, 1, 0,
              0, 0, 0, 1,
            );
            tileset.root.transform = Matrix4.IDENTITY;
            tileset.modelMatrix = Matrix4.multiply(enuToEcef, localToEnu, new Matrix4());
            console.info(`${TAG} Corrected geographic root transform → ECEF (lat=${lat.toFixed(4)}, lon=${lon.toFixed(4)})`);
          }
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
      if (ts.pointCloudShading) {
        const { strength, radius } = lerpEDL(camDist);
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
    const applyOpacity = (ds: GeoJsonDataSource) => {
      const alpha = layers.polygons.opacity;
      const fillColor = Color.fromCssColorString('#ef4444').withAlpha(alpha);
      const strokeColor = Color.fromCssColorString('#ef4444').withAlpha(Math.min(1, alpha + 0.3));
      for (const entity of ds.entities.values) {
        if (entity.polygon) {
          entity.polygon.material = new ColorMaterialProperty(fillColor);
        }
        if (entity.polyline) {
          entity.polyline.material = new ColorMaterialProperty(strokeColor);
        }
      }
    };

    if (!vectorDataSourceRef.current) {
      setLayerLoading('polygons', true);
      GeoJsonDataSource.load(vectorUrl, {
        stroke: Color.fromCssColorString('#ef4444'),
        fill: Color.fromCssColorString('#ef4444').withAlpha(layers.polygons.opacity),
        strokeWidth: 2,
        clampToGround: true,
      }).then(ds => {
        if (!viewer.isDestroyed() && isSubscribed) {
          viewer.dataSources.add(ds);
          vectorDataSourceRef.current = ds;
          ds.entities.values.forEach((entity) => {
            (entity as any)['_geoJsonProperties'] = entity.properties;
          });
          setLayerLoading('polygons', false);
          viewer.scene.requestRender();
        }
      }).catch(e => {
        console.error(`${TAG} Failed to load GeoJSON`, e);
        if (isSubscribed) {
          setLayerError('polygons', 'Failed to load vector data.');
          setLayerLoading('polygons', false);
        }
      });
    } else {
      vectorDataSourceRef.current.show = true;
      applyOpacity(vectorDataSourceRef.current);
      viewer.scene.requestRender();
    }

    return () => { isSubscribed = false; };
  }, [vectorUrl, layers.polygons.visible, layers.polygons.opacity, setLayerLoading, setLayerError]);

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
      try {
        // Use cached height if available (avoids re-sampling on every visibility/opacity toggle)
        let h = siteModelHeightRef.current;
        if (h === null) {
          // Start with anchor height from manifest (preferred), then fallback to hardcoded default
          h = siteCenterHeight;
          const tp = viewer.terrainProvider;
          if (tp && !(tp instanceof EllipsoidTerrainProvider)) {
            try {
              const updated = await sampleTerrainMostDetailed(tp, [Cartographic.fromDegrees(siteCenterLng, siteCenterLat)]);
              if (updated?.[0]?.height !== undefined) {
                h = updated[0].height;
              }
            } catch {
              // Fallback to anchor/default height
            }
          }
          siteModelHeightRef.current = h;
        }

        if (viewer.isDestroyed()) return;

        const modelMatrix = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(siteCenterLng, siteCenterLat, h));
        const color = Color.WHITE.withAlpha(Math.max(0, Math.min(1, layers.site_model.opacity)));

        if (!modelPrimitiveRef.current) {
          const model = await CesiumModel.fromGltfAsync({
            url: siteModelUrl,
            modelMatrix: modelMatrix,
            color: color,
            colorBlendMode: ColorBlendMode.MIX,
            colorBlendAmount: 1,
          });
          if (viewer.isDestroyed()) return;
          viewer.scene.primitives.add(model);
          modelPrimitiveRef.current = model;
          model.show = layers.site_model.visible;
          viewer.scene.requestRender();
        } else {
          modelPrimitiveRef.current.show = true;
          modelPrimitiveRef.current.modelMatrix = modelMatrix;
          modelPrimitiveRef.current.color = color;
          viewer.scene.requestRender();
        }
      } catch (e) {
        console.error("Failed to load model", e);
        if (!viewer.isDestroyed()) {
          setLayerError('site_model', 'Failed to load model');
        }
      } finally {
        if (!viewer.isDestroyed()) {
          setLayerLoading('site_model', false);
        }
      }
    };

    sampleAndPlace();
  }, [siteModelUrl, layers.site_model.visible, layers.site_model.opacity, terrainMode, terrainUrl, siteCenterLng, siteCenterLat, siteCenterHeight, setLayerLoading, setLayerError]);

  // ---- Heatmap (Cut/Fill) Imagery Layer ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!heatmapUrl || !layers.heatmap.visible) {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.show = false;
        viewer.scene.requestRender();
      }
      return;
    }

    if (!heatmapLayerRef.current) {
      const provider = new UrlTemplateImageryProvider({
        url: heatmapUrl,
        minimumLevel: heatmapAsset?.minZoom ?? 14,
        maximumLevel: heatmapAsset?.maxZoom ?? 22,
        rectangle: heatmapAsset?.bbox?.length === 4
          ? Rectangle.fromDegrees(heatmapAsset.bbox[0], heatmapAsset.bbox[1], heatmapAsset.bbox[2], heatmapAsset.bbox[3])
          : manifest?.bounds
            ? Rectangle.fromDegrees(manifest.bounds.west, manifest.bounds.south, manifest.bounds.east, manifest.bounds.north)
            : undefined,
        hasAlphaChannel: true,
      });
      heatmapLayerRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);
    }
    heatmapLayerRef.current.show = true;
    heatmapLayerRef.current.alpha = layers.heatmap.opacity;
    viewer.scene.requestRender();
  }, [heatmapUrl, layers.heatmap.visible, layers.heatmap.opacity, heatmapAsset, manifest]);

  // ---- Contour Lines (GeoJSON) Layer ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!contourUrl || !layers.contours.visible) {
      if (contourDataSourceRef.current) {
        contourDataSourceRef.current.show = false;
        viewer.scene.requestRender();
      }
      return;
    }

    let isSubscribed = true;
    if (!contourDataSourceRef.current) {
      setLayerLoading('contours', true);
      GeoJsonDataSource.load(contourUrl, {
        stroke: Color.fromCssColorString('#9ca3af'),
        fill: Color.TRANSPARENT,
        strokeWidth: 1,
        clampToGround: true,
      }).then(ds => {
        if (!viewer.isDestroyed() && isSubscribed) {
          viewer.dataSources.add(ds);
          contourDataSourceRef.current = ds;
          setLayerLoading('contours', false);
          viewer.scene.requestRender();
        }
      }).catch(e => {
        console.error(`${TAG} Failed to load contour GeoJSON`, e);
        if (isSubscribed) {
          setLayerError('contours', 'Failed to load contour data.');
          setLayerLoading('contours', false);
        }
      });
    } else {
      contourDataSourceRef.current.show = true;
    }

    // Apply opacity to all contour polyline entities (skip if unchanged)
    if (contourDataSourceRef.current && layers.contours.opacity !== prevContourOpacityRef.current) {
      prevContourOpacityRef.current = layers.contours.opacity;
      const entities = contourDataSourceRef.current.entities.values;
      const contourColor = Color.fromCssColorString('#9ca3af').withAlpha(layers.contours.opacity);
      const material = new ColorMaterialProperty(contourColor);
      for (const entity of entities) {
        if (entity.polyline) {
          entity.polyline.material = material as unknown as typeof entity.polyline.material;
        }
      }
    }

    viewer.scene.requestRender();
    return () => { isSubscribed = false; };
  }, [contourUrl, layers.contours.visible, layers.contours.opacity, setLayerLoading, setLayerError]);

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
        setSelectedFeature(normalizeSelectedFeature(props, { name: '3D Tiles feature' }));
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
          setSelectedFeature(
            normalizeSelectedFeature(custom as Record<string, unknown>, {
              _source: 'geojson',
              _entityId: entity.id,
              name: entity.name ?? 'Region of interest',
            })
          );
          return;
        }
        if (entity.properties) {
          setSelectedFeature(
            normalizeSelectedFeature(entity.properties.getValue(now) as Record<string, unknown>, {
              _source: 'geojson',
              _entityId: entity.id,
              name: entity.name ?? 'Region of interest',
            })
          );
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

  // ---- Navigation widget callbacks ----
  const handleResetNorth = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: viewer.camera.positionWC,
      orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 },
      duration: 0.5,
    });
  };

  const handleZoomIn = () => {
    const viewer = viewerRef.current;
    if (viewer) viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
  };

  const handleZoomOut = () => {
    const viewer = viewerRef.current;
    if (viewer) viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
  };

  const handleFitBounds = () => {
    const viewer = viewerRef.current;
    if (!viewer || !manifest?.bounds) return;
    const { west, south, east, north } = manifest.bounds;
    viewer.camera.flyTo({
      destination: Rectangle.fromDegrees(west, south, east, north),
      duration: 1,
    });
  };

  const handleToggle3D = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (is3D) {
      viewer.scene.morphTo2D(1);
      setIs3D(false);
    } else {
      viewer.scene.morphTo3D(1);
      setIs3D(true);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-muted/20 text-foreground">
      <LayerPanel />

      <div className="flex-1 relative h-full min-w-0">
        <Toolbar />
        <div ref={containerRef} className="absolute inset-0 w-full h-full outline-none" tabIndex={0} />
        <InspectorPanel />

        {/* Navigation controls — right side */}
        <div className="absolute bottom-16 right-4 z-10 flex flex-col items-center gap-2">
          <CompassWidget onResetNorth={handleResetNorth} />
          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitBounds={handleFitBounds}
            onToggle3D={handleToggle3D}
            is3D={is3D}
          />
          <ScaleBar />
        </div>

        {/* Right sidebar panels — anomaly alerts, zone analytics, site distribution */}
        <div className="absolute right-4 top-[340px] z-10 flex max-h-[calc(100dvh-400px)] flex-col gap-3 overflow-y-auto pr-1">
          <ZoneAnalyticsPanel zone={zoneData} />
          <AnomalyAlerts alerts={liveAnomalies ?? DEMO_ANOMALY_ALERTS} />
          <SiteDistribution data={liveSiteDistrib ?? DEMO_SITE_DISTRIBUTION} />
        </div>

        {/* Heatmap legend — bottom left */}
        <HeatmapLegend />

        {/* Timeline bar — bottom center */}
        <TimelineBar />

        {/* Coordinates bar — bottom */}
        <CoordinatesBar />

        {/* Global loading overlay */}
        {showLoader && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl border bg-background/95 p-6 shadow-2xl">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
              <div className="flex flex-col items-center gap-1.5">
                {activeLoads.map((msg) => (
                  <span key={msg} className="text-sm font-medium text-foreground">{msg}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
