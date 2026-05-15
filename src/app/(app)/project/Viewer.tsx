'use client';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['CESIUM_BASE_URL'] =
    typeof CESIUM_BASE_URL !== 'undefined' ? CESIUM_BASE_URL : '/cesiumStatic';
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { useViewerStore } from '@/store/viewerStore';
import { useSiteStore } from '@/store/siteStore';
import { useMeasurementHandler } from '@/hooks/useMeasurementHandler';
import { useDrawingHandler } from '@/hooks/useDrawingHandler';

import { useAnnotationHandler } from '@/hooks/useAnnotationHandler';
import { useAnnotationLayer } from '@/hooks/useAnnotationLayer';
import { useDesignOverlayLayer } from '@/hooks/useDesignOverlayLayer';
import { useTerrainLensLayers } from '@/hooks/useTerrainLensLayers';
import { useLensStatsRasterLayer } from '@/hooks/useLensStatsRasterLayer';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useRecentSurveys } from '@/hooks/useRecentSurveys';
import { useViewerHotkeys } from '@/hooks/useViewerHotkeys';
import { useViewerUrlSync } from '@/hooks/useViewerUrlSync';
import { useViewerDefaults } from '@/hooks/useViewerDefaults';
import { useViewerCompareLayer } from '@/hooks/useViewerCompareLayer';
import { SaveRegionModal } from '@/components/viewer/SaveRegionModal';
import { AnnotationModal } from '@/components/viewer/AnnotationModal';
import { KeyboardShortcutsOverlay } from '@/components/viewer/KeyboardShortcutsOverlay';
import { ProfileChart } from '@/components/viewer/ProfileChart';
import { CompassWidget } from '@/components/viewer/CompassWidget';
import { TabletGestureHint } from '@/components/viewer/TabletGestureHint';
import { ExportPdfButton } from '@/components/viewer/ExportPdfButton';
import { ZoomControls } from '@/components/viewer/ZoomControls';
import { CoordinatesBar } from '@/components/viewer/CoordinatesBar';
import { ScaleBar } from '@/components/viewer/ScaleBar';
import { HeatmapLegend } from '@/components/viewer/HeatmapLegend';
import { TimelineBar } from '@/components/viewer/TimelineBar';
import { RightRail } from '@/components/viewer/RightRail';
import { ToolPalette } from '@/components/viewer/ToolPalette';
import { MeasurementLiveReadout } from '@/components/viewer/MeasurementLiveReadout';
import { ScreenshotButton } from '@/components/viewer/ScreenshotButton';
import { ViewerLoader, type AssetStatusRow } from '@/components/viewer/ViewerLoader';
import { CompareDock, CompareSliderOverlay } from '@/components/viewer/CompareDock';
import { useCompareStore } from '@/store/compareStore';
import { apiClient, unwrapList } from '@/lib/http';
import { rewriteGcsUrl } from '@/lib/assetUrl';
import type { ListEnvelope } from '@/types/api';
import { useSurvey } from '@/hooks/useSurveys';
import { useProjects } from '@/hooks/useProjects';

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
    manifestError,
    activeTool,
    blendPreset,
    setSelectedFeature,
    pointBudget,
    setLayerError,
    setLayerLoading,
    setCursorPosition,
    setAvailableSurveys,
  } = useViewerStore(
    useShallow((s) => ({
      layers: s.layers,
      terrainMode: s.terrainMode,
      setCameraState: s.setCameraState,
      loadManifest: s.loadManifest,
      getAssetUrl: s.getAssetUrl,
      terrainExaggeration: s.terrainExaggeration,
      manifest: s.manifest,
      manifestError: s.manifestError,
      activeTool: s.activeTool,
      blendPreset: s.blendPreset,
      setSelectedFeature: s.setSelectedFeature,
      pointBudget: s.pointBudget,
      setLayerError: s.setLayerError,
      setLayerLoading: s.setLayerLoading,
      setCursorPosition: s.setCursorPosition,
      setAvailableSurveys: s.setAvailableSurveys,
    }))
  );

  // Subscribe to the flyTo bus separately to avoid triggering the big destructure re-render.
  const flyToTarget = useViewerStore((s) => s.flyToTarget);

  // ── Compare store ─────────────────────────────────────────────────
  const compareEnabled = useCompareStore((s) => s.enabled);
  const compareMode = useCompareStore((s) => s.mode);
  const compareEpochA = useCompareStore((s) => s.epochA);
  const compareEpochB = useCompareStore((s) => s.epochB);
  const setCompareEpochs = useCompareStore((s) => s.setEpochs);
  const splitPosition = useCompareStore((s) => s.splitPosition);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);

  // Wire measurement tools (distance, area, volume) to Cesium drawing handlers
  useMeasurementHandler(viewerRef);
  // Wire the polygon-region draw tool. Activates when activeTool === 'draw-polygon'.
  useDrawingHandler(viewerRef);
  // Wire the Annotate tool. The handler captures a single canvas click
  // into `annotationDraft` (which mounts AnnotationModal); the layer
  // hook syncs the saved `annotations` array into a dedicated Cesium
  // datasource and respects the Layers-tab visibility toggle.
  useAnnotationHandler(viewerRef);
  useAnnotationLayer(viewerRef);
  useDesignOverlayLayer(viewerRef);
  // VS Phase 0 — slope / aspect / flow XYZ tile layers driven by
  // `manifest.terrainLenses`. Hook is a no-op for surveys without
  // baked lens tiles.
  useTerrainLensLayers(viewerRef);
  // VS Phase 0 — overlay the polygon-clipped slope/aspect/flow PNG
  // (returned by /compute/lens-stats with include_rasters:true) on the
  // drawn polygon. No-op until the user picks a raster in the
  // LensStatsSubView's Show-on-map radio.
  useLensStatsRasterLayer(viewerRef);
  // Global keyboard shortcuts — V/M/D/C/A for tool modes, 1–5 for
  // measure submodes (when a measure tool is active) or right-rail
  // tabs (otherwise). Single window-scoped listener; bails on input
  // elements + modifier-bearing keystrokes. See `useViewerHotkeys`.
  useViewerHotkeys();
  // V-STATE-01: mirror viewer state into ?v= so sharing a URL restores
  // camera + layers + tool + compare config on the recipient.
  useViewerUrlSync();
  // V-STATE-02: persist per-user defaults to localStorage; seed on mount
  // when no ?v= snapshot is present.
  useViewerDefaults();

  // ── Compare: Side-by-side (slider) layer management ───────────────
  useViewerCompareLayer(viewerRef);

  // ── ContextBar wiring ─────────────────────────────────────────────
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteViewMode = useSiteStore((s) => s.viewMode);
  const siteActiveSurveyId = useSiteStore((s) => s.activeSurveyId);
  const siteActiveProjectId = useSiteStore((s) => s.activeProjectId);
  const setSiteActiveProject = useSiteStore((s) => s.setActiveProject);
  const setSiteActiveSurvey = useSiteStore((s) => s.setActiveSurvey);

  // Resolve project_id + name so we can seed siteStore even though Manifest only exposes siteId.
  const { data: surveyDetail } = useSurvey(surveyIdProp ?? '');
  const { data: projects = [] } = useProjects();
  const resolvedProjectId = surveyDetail?.project_id ?? manifest?.siteId ?? null;

  // V-STATE-03: fetch survey annotations from asset-svc; syncs into store for
  // Cesium rendering and provides create/delete mutations for AnnotationModal.
  const { createAnnotation } = useAnnotations(
    resolvedProjectId ?? undefined,
    surveyIdProp,
  );
  const resolvedProjectName = useMemo(
    () => projects.find((p) => p.id === resolvedProjectId)?.name,
    [projects, resolvedProjectId]
  );

  // V-STATE-05: record this survey visit so the project list page can surface
  // recent surveys without a backend round-trip.
  const { recordSurveyVisit } = useRecentSurveys();
  useEffect(() => {
    if (!surveyIdProp || !resolvedProjectId) return;
    recordSurveyVisit({
      surveyId: surveyIdProp,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName ?? resolvedProjectId,
      surveyDate: surveyDetail?.survey_date ?? '',
    });
  }, [surveyIdProp, resolvedProjectId, resolvedProjectName, surveyDetail?.survey_date, recordSurveyVisit]);

  // ── URL is the source of truth for the active survey ─────────────────
  //
  // Why one-way only: the previous design wired two effects together —
  // a "seed" effect that pushed URL → siteStore and a "sync" effect that
  // pushed siteStore → URL — both with `surveyIdProp` AND `siteActiveSurveyId`
  // in their dep arrays. The result was a race condition on every survey
  // switch and on every mount where the persisted siteStore disagreed
  // with the URL:
  //
  //   1. User clicks "6 Feb 2024" in the dropdown → setActiveSurvey(Feb)
  //      mutates the store synchronously.
  //   2. React renders. URL is still May, store is Feb. The seed effect
  //      reads URL (May) and writes it back to the store — reverting the
  //      click — while the sync effect reads store (Feb) and pushes the
  //      URL to Feb. Both happen in the same commit because each effect
  //      reads only the closure value, not the queued state update.
  //   3. State ping-pongs across several renders. Symptoms: the dropdown
  //      briefly shows two surveys as selected (BaseUI Select tracks the
  //      transient mismatch), the manifest is fetched multiple times, and
  //      sometimes the viewer fails to switch at all because the revert
  //      lands after the URL change has already triggered a manifest load.
  //
  // The fix is to make ONE direction canonical. The URL is the natural
  // choice because it survives reloads, is shareable, and back/forward
  // navigation already updates it. The dropdown's `onValueChange` now
  // navigates directly via `router.replace`; the store only follows.
  // Without an opposing effect there is no race.
  //
  // The dropdown component (`ContextBar`) writes to siteStore through
  // `setActiveSurvey`, so the seed effect below still has to translate
  // those clicks into URL changes. To do that without re-introducing the
  // race, we detect store changes through a ref-tracked "previous store
  // value" — only a delta from inside the dropdown reaches the router
  // call, never the URL → store seeding that happens on mount.

  // URL → siteStore (one-way). Ref-guarded so the effect is a no-op when
  // it re-renders because `siteActiveSurveyId` changed (which we omit
  // from the deps to avoid reading the closure). Without the guard, this
  // effect would otherwise revert dropdown clicks: after the user picks
  // Feb the store is Feb, but the URL is still May, so a naive seed
  // would call setSiteActiveSurvey(May) and undo the click. The ref
  // tracks the last URL value we propagated, so only genuine URL
  // changes (back/forward, manual edit) trigger seeding.
  const lastSeededProjectIdRef = useRef<string | null>(null);
  const lastSeededSurveyIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (resolvedProjectId !== lastSeededProjectIdRef.current) {
      lastSeededProjectIdRef.current = resolvedProjectId;
      if (resolvedProjectId && resolvedProjectId !== siteActiveProjectId) {
        setSiteActiveProject(resolvedProjectId, resolvedProjectName);
      }
    }
    if (surveyIdProp !== lastSeededSurveyIdRef.current) {
      lastSeededSurveyIdRef.current = surveyIdProp;
      if (surveyIdProp && surveyIdProp !== siteActiveSurveyId) {
        setSiteActiveSurvey(surveyIdProp);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProjectId, resolvedProjectName, surveyIdProp]);

  // siteStore → URL (one-way, dropdown clicks only). When the user picks
  // a survey in the ContextBar, the store moves to a value that no URL
  // change has yet produced — `lastUrlSyncedSurveyRef` won't hold it.
  // We push it into the URL and update the ref. When the URL change
  // propagates back through the seed effect above and into the store,
  // the ref already matches, so this effect early-returns and no loop
  // forms.
  //
  // Initialised lazily to `null` so the very first render — where the
  // store may be hydrated from localStorage with a different value than
  // the URL — does NOT push the persisted store value over the explicit
  // URL the user just navigated to. The seed effect catches the URL
  // and updates the store; once that lands, this effect's ref check
  // matches and it stops.
  const lastUrlSyncedSurveyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!siteActiveSurveyId) return;
    if (lastUrlSyncedSurveyRef.current === null) {
      // First commit: trust the URL. Seed effect will reconcile the
      // store; we just record that we've now seen this store value.
      lastUrlSyncedSurveyRef.current = siteActiveSurveyId;
      return;
    }
    if (siteActiveSurveyId === lastUrlSyncedSurveyRef.current) return;
    if (siteActiveSurveyId === surveyIdProp) {
      // Store caught up to URL via the seed effect — no push needed.
      lastUrlSyncedSurveyRef.current = siteActiveSurveyId;
      return;
    }
    lastUrlSyncedSurveyRef.current = siteActiveSurveyId;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('surveyId', siteActiveSurveyId);
    router.replace(`/project?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteActiveSurveyId, surveyIdProp]);

  // V-COMPARE-05: Sync active survey with compare epochs.
  // When the user clicks a dot in the timeline or picks a survey in the top bar,
  // we want the Comparison tool to follow. We treat the active survey as 'epochB'
  // (the comparison) so the user can click through the timeline to see diffs
  // against their chosen baseline (epochA).
  useEffect(() => {
    if (compareEnabled && manifest?.surveyId && manifest.surveyId !== compareEpochB) {
      setCompareEpochs(compareEpochA, manifest.surveyId);
    }
  }, [compareEnabled, manifest?.surveyId, compareEpochA, compareEpochB, setCompareEpochs]);

  // V-COMPARE-06: Sync epochB back to main survey.
  // When the user picks a different "Compare" epoch in the dock, we want the
  // main app (and timeline) to reflect that this is the active focus.
  useEffect(() => {
    if (compareEnabled && compareEpochB && compareEpochB !== siteActiveSurveyId) {
      setSiteActiveSurvey(compareEpochB);
    }
  }, [compareEnabled, compareEpochB, siteActiveSurveyId, setSiteActiveSurvey]);

  // Bind viewMode → Cesium scene morph
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      if (siteViewMode === 'map') viewer.scene.morphTo2D(1);
      else if (siteViewMode === 'split') viewer.scene.morphToColumbusView(1);
      else viewer.scene.morphTo3D(1);
    } catch { /* scene not ready */ }
  }, [siteViewMode]);

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
    // V-COPC-01 — prefer 3D Tiles tileset.json for native Cesium
    // rendering; fall back to COPC only if 3D Tiles was not produced
    // (e.g. PDAL build lacks `writers.3dtiles`). The COPC path still
    // surfaces a visible conversion-pending message because Cesium
    // 1.139 has no COPC loader.
    let tilesetUrl: string | undefined;
    let copcUrl: string | undefined;
    for (const a of manifest.assets) {
      if (a.assetType !== 'point_cloud') continue;
      if (a.format === '3dtiles' || /tileset\.json/i.test(a.url)) {
        tilesetUrl = tilesetUrl ?? a.url;
      } else if (a.format === 'copc' || /\.copc\.laz$/i.test(a.url)) {
        copcUrl = copcUrl ?? a.url;
      }
    }
    const chosen = tilesetUrl ?? copcUrl;
    return chosen ? rewriteGcsUrl(chosen) : undefined;
  }, [manifest]);
  const orthoUrl = rewriteGcsUrl(getAssetUrl('ortho'));
  const rawTerrainUrl = getAssetUrl(terrainMode === 'dtm' ? 'terrain_dtm' : 'terrain_dsm');
  // Terrain keeps its own proxy: it needs gzip decompression + layer.json
  // enrichment that the generic asset proxy deliberately skips.
  const terrainUrl = rawTerrainUrl?.startsWith('https://storage.googleapis.com/')
    ? rawTerrainUrl.replace('https://storage.googleapis.com/', `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/terrain/proxy/`)
    : rawTerrainUrl;
  const vectorUrl = rewriteGcsUrl(getAssetUrl('vector'));
  const siteModelUrl = rewriteGcsUrl(getAssetUrl('site_model', 'glb'));
  const heatmapUrl = rewriteGcsUrl(getAssetUrl('heatmap'));
  const contourUrl = rewriteGcsUrl(getAssetUrl('contours'));
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
      } catch {
        // Survey list is non-critical — silently ignore (timeline just stays hidden)
      }
    })();

    return () => { cancelled = true; };
  }, [manifest?.surveyId, surveyIdProp, setAvailableSurveys]);

  // Anomaly + stockpile analytics moved into RightRail's Overview tab.

  // ---- Initialize the Pure Cesium Viewer ----
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Detached credit container — Cesium / CartoDB / Ion all require
    // visible attribution per their licenses. Mount inside the canvas
    // wrapper, anchor bottom-right above CoordinatesBar, style as a
    // muted glass chip so it reads as system chrome rather than UI.
    const creditContainer = document.createElement('div');
    creditContainer.className =
      'pointer-events-auto absolute bottom-9 right-3 z-10 ' +
      'rounded-sm border border-border-subtle bg-bg-surface/70 ' +
      'supports-[backdrop-filter]:bg-bg-surface/50 backdrop-blur-md ' +
      'px-2 py-0.5 text-[9px] font-mono text-text-muted ' +
      '[&_a]:text-text-muted [&_a]:hover:text-text-primary';
    containerRef.current.appendChild(creditContainer);

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
      // V-OUTPUT-01: keep the WebGL drawing buffer around so
      // `canvas.toDataURL()` returns the current frame instead of a
      // transparent PNG. Measured impact on a 10M-point survey: <2 FPS
      // drop at 1080p, none at smaller sizes.
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });

    // Production optimizations
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.logarithmicDepthBuffer = true;
    viewer.scene.fog.enabled = false;
    if (viewer.scene.skyAtmosphere) {
      // Off at survey zoom: adds a faint blue cast that washes out ortho pixels.
      viewer.scene.skyAtmosphere.show = false;
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
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __cesiumViewer?: unknown }).__cesiumViewer = viewer;
    }

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
      creditContainer.remove();
      viewerRef.current = null;
    };
  }, []);

  // ---- Initial FlyTo based on Manifest ----
  // When the manifest loads we frame the scene to its bounds. When the
  // manifest terminally fails we still want the user to land on the
  // default site instead of Cesium's factory-default view (camera over
  // North Carolina) so the UI has visual context for the error state.
  const initialFrameDone = useRef(false);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || initialFrameDone.current) return;
    if (!manifest && !manifestError) return;

    initialFrameDone.current = true;
    const centerLon = boundsCenterLng ?? DEFAULT_SITE_CENTER_LNG;
    const centerLat = boundsCenterLat ?? DEFAULT_SITE_CENTER_LAT;
    const spanDeg = manifest?.bounds
      ? Math.max(
        Math.abs(manifest.bounds.east - manifest.bounds.west),
        Math.abs(manifest.bounds.north - manifest.bounds.south),
        0.002,
      )
      : 0.02;
    const baseHeight = Math.max(1200, spanDeg * 160000);
    const scale = manifest?.rendering?.suggestedViewHeightScale ?? 1;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(centerLon, centerLat, baseHeight * scale),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: manifest ? 1.5 : 0.5,
    });
  }, [manifest, manifestError, boundsCenterLng, boundsCenterLat]);

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

    // V-STATE-06: Capture camera and moveEnd early. If we access `viewer.camera`
    // inside the cleanup after the viewer is destroyed, Cesium's getter throws
    // "Cannot read properties of undefined (reading 'scene')".
    const { camera } = viewer;
    const { moveEnd } = camera;

    const handler = () => {
      if (viewer.isDestroyed()) return;
      const pos = camera.positionCartographic;
      setCameraState({
        longitude: CesiumMath.toDegrees(pos.longitude),
        latitude: CesiumMath.toDegrees(pos.latitude),
        height: pos.height,
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll,
      });
    };

    moveEnd.addEventListener(handler);
    return () => {
      moveEnd.removeEventListener(handler);
    };
  }, [setCameraState]);

  // ---- Cursor Position Tracking (for CoordinatesBar) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene) return;
    const { camera, scene } = viewer;
    const { globe, canvas } = scene;

    const cursorHandler = new ScreenSpaceEventHandler(canvas);
    cursorHandler.setInputAction((move: { endPosition: Cartesian2 }) => {
      if (viewer.isDestroyed()) return;
      const ray = camera.getPickRay(move.endPosition);
      if (!ray) { setCursorPosition(null); return; }
      const pos = globe.pick(ray, scene);
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

  // ---- Global loading overlay ----
  // Treat the manifest as "loading" if we haven't received one yet AND the
  // last fetch didn't terminally fail. A stale manifest (previous survey
  // still in store while the new one resolves) also counts as loading, but
  // only until an error for the *requested* surveyId lands — otherwise a
  // 401/404 would keep us spinning forever.
  const manifestErrorForThisSurvey =
    manifestError && (!surveyIdProp || manifestError.surveyId === surveyIdProp)
      ? manifestError
      : null;
  const isManifestLoading =
    !manifestErrorForThisSurvey &&
    (!manifest || (surveyIdProp != null && manifest.surveyId !== surveyIdProp));
  const anyLayerLoading =
    layers.dsm.loading ||
    layers.ortho.loading ||
    layers.laz.loading ||
    layers.polygons.loading ||
    layers.site_model.loading ||
    layers.contours.loading ||
    layers.heatmap.loading;
  const showLoader = isManifestLoading || anyLayerLoading;

  // Fullscreen loader: blocks the viewer until manifest + initial critical
  // layers (terrain/ortho) are loaded. Latches once per survey so toggling
  // a layer later doesn't black out the scene.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const hasSeenLoadEventRef = useRef(false);
  const loaderTimeoutRef = useRef<number | null>(null);

  // Reset loader state when the user navigates to a different survey.
  useEffect(() => {
    setInitialLoadComplete(false);
    hasSeenLoadEventRef.current = false;
  }, [surveyIdProp]);

  useEffect(() => {
    if (initialLoadComplete) return;
    // Terminal manifest failure → exit loader immediately; the overlay
    // will render the error panel instead of spinning.
    if (manifestErrorForThisSurvey) {
      setInitialLoadComplete(true);
      return;
    }
    // Track whether we've ever seen a layer start loading this session —
    // without this, the moment before any useEffect fires layer.loading=true
    // would register as "ready".
    if (showLoader) hasSeenLoadEventRef.current = true;

    const manifestReady = !isManifestLoading;
    // Critical layers: terrain (dsm) + ortho — these anchor the 3D scene.
    // LAZ point cloud is treated as background (it's often 100s of MB and
    // we don't want to block UI on it).
    const criticalIdle = !layers.dsm.loading && !layers.ortho.loading;
    const sawAtLeastOneLoad = hasSeenLoadEventRef.current;

    if (manifestReady && criticalIdle && sawAtLeastOneLoad && viewerRef.current) {
      setInitialLoadComplete(true);
    }
  }, [
    initialLoadComplete,
    showLoader,
    isManifestLoading,
    layers.dsm.loading,
    layers.ortho.loading,
    manifestErrorForThisSurvey,
  ]);

  // Safety timeout: if the initial load stalls (e.g. a layer never resolves
  // and no error event ever lands), reveal the viewer after 8s so the user
  // isn't stuck. 8s matches the p99 manifest+critical-layer budget on a
  // warm cache — anything longer is a real fault the user should see.
  useEffect(() => {
    if (initialLoadComplete) return;
    loaderTimeoutRef.current = window.setTimeout(() => {
      setInitialLoadComplete(true);
    }, 8_000);
    return () => {
      if (loaderTimeoutRef.current) {
        window.clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
    };
  }, [initialLoadComplete, surveyIdProp]);

  // Unified per-asset status list. Drives cumulative progress + the (i)
  // popover for both the fullscreen loader (initial load) and the chip
  // (post-load background fetches). Manifest row is always present; a
  // layer row is added only once we know there's actually something to
  // load for it (URL resolved from manifest).
  const assetStatuses: AssetStatusRow[] = useMemo(() => {
    const rows: AssetStatusRow[] = [];

    const manifestStatus: AssetStatusRow['status'] = manifestErrorForThisSurvey
      ? 'error'
      : !manifest || (surveyIdProp != null && manifest.surveyId !== surveyIdProp)
        ? 'loading'
        : 'done';
    const manifestErrMsg = manifestErrorForThisSurvey
      ? manifestErrorForThisSurvey.status === 401
        ? 'Session expired — sign in again'
        : manifestErrorForThisSurvey.status === 404
          ? 'Survey manifest not found'
          : `Manifest unavailable (${manifestErrorForThisSurvey.status || 'network'})`
      : undefined;
    rows.push({
      id: 'manifest',
      label: 'Survey manifest',
      status: manifestStatus,
      errorMessage: manifestErrMsg,
    });

    if (manifest) {
      const pushLayer = (id: string, label: string, hasUrl: boolean, state: { loading: boolean; error: string | null }) => {
        if (!hasUrl) return;
        const status: AssetStatusRow['status'] = state.loading
          ? 'loading'
          : state.error
            ? 'error'
            : 'done';
        rows.push({
          id,
          label,
          status,
          errorMessage: state.error ?? undefined,
        });
      };
      pushLayer(
        'dsm',
        terrainMode === 'dtm' ? 'Terrain (DTM)' : 'Terrain (DSM)',
        !!rawTerrainUrl,
        layers.dsm,
      );
      pushLayer('ortho', 'Orthomosaic', !!orthoUrl, layers.ortho);
      pushLayer('laz', 'Point cloud', !!pointCloudTilesetUrl, layers.laz);
      pushLayer('polygons', 'Vector features', !!vectorUrl, layers.polygons);
      pushLayer('site_model', 'Site model', !!siteModelUrl, layers.site_model);
      pushLayer('contours', 'Contours', !!contourUrl, layers.contours);
      pushLayer('heatmap', 'Heatmap', !!heatmapUrl, layers.heatmap);
    }

    return rows;
  }, [
    manifest,
    manifestErrorForThisSurvey,
    surveyIdProp,
    terrainMode,
    rawTerrainUrl,
    orthoUrl,
    pointCloudTilesetUrl,
    vectorUrl,
    siteModelUrl,
    contourUrl,
    heatmapUrl,
    layers.dsm,
    layers.ortho,
    layers.laz,
    layers.polygons,
    layers.site_model,
    layers.contours,
    layers.heatmap,
  ]);

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
          const tilingScheme = (tp as unknown as { _tilingScheme?: GeographicTilingScheme })._tilingScheme ?? new GeographicTilingScheme();
          const maxLevel = 22;
          const avail = new TileAvailability(tilingScheme, maxLevel);
          for (let z = 0; z <= maxLevel; z++) {
            const nX = tilingScheme.getNumberOfXTilesAtLevel(z);
            const nY = tilingScheme.getNumberOfYTilesAtLevel(z);
            avail.addAvailableTileRange(z, 0, 0, nX - 1, nY - 1);
          }
          (tp as unknown as { _availability?: TileAvailability })._availability = avail;
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

    const isSliderCompare = compareEnabled; // Hide main ortho if ANY compare mode is on
    if (!orthoUrl || !layers.ortho.visible || isSliderCompare) {
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

    return () => {
      if (orthoLayerRef.current && !viewer.isDestroyed()) {
        viewer.scene.imageryLayers.remove(orthoLayerRef.current);
        orthoLayerRef.current = null;
      }
    };
  }, [orthoUrl, layers.ortho.visible, layers.ortho.opacity, orthoAsset, manifest]);

  // ---- Blend Preset (stacked vs embedded imagery compositing) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const base = baseMapLayerRef.current;
    if (!base) return;

    const ortho = orthoLayerRef.current;
    const orthoVisible = !!ortho && ortho.show;

    if (blendPreset === 'embedded' && orthoVisible) {
      // Embedded: ortho underneath basemap; basemap becomes translucent.
      base.show = true;
      base.alpha = 0.3;
      const il = viewer.scene.imageryLayers;
      if (il.indexOf(ortho!) > il.indexOf(base)) il.lower(ortho!);
    } else if (orthoVisible) {
      // Stacked + ortho covers the view: hide the basemap so its white
      // pixels don't leach through alpha-edged ortho tiles and wash the
      // scene out. `globe.baseColor` (dark navy) backstops any gaps.
      base.show = false;
      const il = viewer.scene.imageryLayers;
      if (il.indexOf(ortho!) < il.indexOf(base)) il.raise(ortho!);
    } else {
      // No ortho: show basemap normally for orientation context.
      base.show = true;
      base.alpha = 1.0;
    }
    viewer.scene.requestRender();
  }, [blendPreset, layers.ortho.visible, layers.ortho.opacity]);

  // ---- Point Cloud 3D Tileset (with dynamic EDL) ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!pointCloudTilesetUrl || !layers.laz.visible || compareEnabled) {
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
        viewer.scene.requestRender();
      }
      // Report issues if invisible due to missing url
      if (layers.laz.visible && !pointCloudTilesetUrl && !compareEnabled) {
        setLayerError('laz', 'No 3D Tiles URL found in manifest.');
      }
      return;
    }

    // V-COPC-01 — the processor produces 3D Tiles alongside COPC when
    // the PDAL build supports `writers.3dtiles`. This branch only fires
    // for surveys ingested before the 3D Tiles writer was wired or on
    // deployments where PDAL lacks the writer (POINTCLOUD_SKIP_3DTILES=1
    // or PDAL < 2.4). Re-running the pointcloud-tiles task for the
    // affected survey will produce the tileset on the new pipeline.
    if (/\.copc\.laz$/i.test(pointCloudTilesetUrl)) {
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
        viewer.scene.requestRender();
      }
      setLayerError(
        'laz',
        'Point cloud is still in COPC format — re-run the point-cloud pipeline to produce the 3D Tiles conversion.',
      );
      return;
    }

    setLayerError('laz', null);

    let isSubscribed = true;

    if (!tilesetRef.current || (tilesetRef.current as unknown as { _url?: string })._url !== pointCloudTilesetUrl) {
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
          tileset.style = buildPointCloudStyle(layers.laz.opacity);
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
      tilesetRef.current.style = buildPointCloudStyle(layers.laz.opacity);
      tilesetRef.current.maximumScreenSpaceError = pointBudgetToMaximumScreenSpaceError(pointBudget);
      viewer.scene.requestRender();
    }

    return () => {
      isSubscribed = false;
      if (tilesetRef.current && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(tilesetRef.current);
        tilesetRef.current = null;
      }
    };
  }, [pointCloudTilesetUrl, layers.laz.visible, layers.laz.opacity, pointBudget, setLayerError, setLayerLoading, compareEnabled]);

  // ---- Dynamic Eye-Dome Lighting (lerp based on camera altitude) ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene) return;
    const { scene, camera } = viewer;
    const { preRender } = scene;

    const updateEDL = () => {
      const ts = tilesetRef.current;
      if (!ts || !ts.show || viewer.isDestroyed()) return;
      const camDist = camera.positionCartographic.height;
      if (ts.pointCloudShading) {
        const { strength, radius } = lerpEDL(camDist);
        ts.pointCloudShading.eyeDomeLightingStrength = strength;
        ts.pointCloudShading.eyeDomeLightingRadius = radius;
      }
    };
    preRender.addEventListener(updateEDL);
    return () => { preRender.removeEventListener(updateEDL); };
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
            (entity as unknown as { _geoJsonProperties: typeof entity.properties })._geoJsonProperties = entity.properties;
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

    return () => {
      isSubscribed = false;
      if (vectorDataSourceRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(vectorDataSourceRef.current);
        vectorDataSourceRef.current = null;
      }
    };
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

    return () => {
      if (modelPrimitiveRef.current && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(modelPrimitiveRef.current);
        modelPrimitiveRef.current = null;
      }
    };
  }, [siteModelUrl, layers.site_model.visible, layers.site_model.opacity, terrainMode, terrainUrl, siteCenterLng, siteCenterLat, siteCenterHeight, setLayerLoading, setLayerError]);

  // ---- Heatmap (Cut/Fill) Imagery Layer ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!heatmapUrl || !layers.heatmap.visible || compareEnabled) {
      if (heatmapLayerRef.current) {
        viewer.scene.imageryLayers.remove(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
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

    return () => {
      if (heatmapLayerRef.current && !viewer.isDestroyed()) {
        viewer.scene.imageryLayers.remove(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
    };
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

    return () => {
      isSubscribed = false;
      if (contourDataSourceRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(contourDataSourceRef.current);
        contourDataSourceRef.current = null;
      }
    };
  }, [contourUrl, layers.contours.visible, layers.contours.opacity, setLayerLoading, setLayerError]);

  // ---- Compare: Cesium scene split position ----
  // When the slider is active, drive viewer.scene.splitPosition from the store
  // so the drag handle in CompareSliderOverlay is reflected on the GPU.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (compareEnabled && compareMode === 'slider') {
      viewer.scene.splitPosition = splitPosition;
    } else {
      // Reset to full-width (no split) when slider is off.
      viewer.scene.splitPosition = 1;
    }
    viewer.scene.requestRender();
  }, [compareEnabled, compareMode, splitPosition]);

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

      const primitive = picked && typeof picked === 'object' && 'primitive' in picked ? (picked as { primitive?: unknown }).primitive : undefined;
      if (primitive instanceof CesiumModel) {
        setSelectedFeature({ _source: 'site_model', name: 'Site model (GLB)' });
        return;
      }

      if (picked.id && typeof picked.id === 'object') {
        const entity = picked.id as import('cesium').Entity & { properties?: import('cesium').PropertyBag };
        const custom = (entity as unknown as { _geoJsonProperties?: import('cesium').PropertyBag | Record<string, unknown> })._geoJsonProperties;
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

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex bg-bg-base text-text-primary">
      {/* Canvas + on-canvas chrome */}
      <div className="flex-1 relative h-full min-w-0">
        <div ref={containerRef} className="absolute inset-0 w-full h-full outline-none" tabIndex={0} />

        {/* V-MOBILE-01: gesture hint shown once on first coarse-pointer visit */}
        <TabletGestureHint />

        {/* Tool palette — top-left, modes + DTM/DSM */}
        <ToolPalette />

        {/* Live measurement readout — Cesium-projected chip that follows
            the cursor (distance) or polygon centroid (area / volume)
            while the user is drawing. Hides itself once the measurement
            completes; the permanent Cesium label takes over from there. */}
        <MeasurementLiveReadout viewerRef={viewerRef} />

        {/* Navigation controls — right side, sit above the rail */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-center gap-2">
          <CompassWidget onResetNorth={handleResetNorth} />
          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitBounds={handleFitBounds}
          />
          <ScreenshotButton viewerRef={viewerRef} />
          <ExportPdfButton
            surveyId={surveyIdProp}
            projectId={resolvedProjectId ?? undefined}
            projectSlug={resolvedProjectName ?? 'report'}
          />
          <ScaleBar />
        </div>

        {/* Compare: drag-to-reveal slider overlay (renders above canvas, below UI chrome) */}
        <CompareSliderOverlay />

        {/* Compare: floating dock with epoch pickers, KPIs, zone list */}
        <CompareDock />

        {/* Heatmap legend — bottom left */}
        <HeatmapLegend />

        {/* Elevation profile / cross-section chart — bottom centre,
            auto-mounts when profile.samples != null. */}
        <ProfileChart />

        {/* Timeline bar — bottom center */}
        <TimelineBar />

        {/* Coordinates bar — bottom */}
        <CoordinatesBar />

        {/* Loading chip — post-initial. Floats above the scene with
            cumulative progress + (i) button for per-asset detail. */}
        <ViewerLoader
          variant="chip"
          visible={showLoader && initialLoadComplete}
          assetStatuses={assetStatuses}
        />
      </div>

      {/* Right rail — adaptive: Overview / Layers / Inspector / Measurements / Compare */}
      <RightRail
        surveyId={surveyIdProp}
        projectId={resolvedProjectId ?? undefined}
        viewerRef={viewerRef}
      />

      {/* Draw-region save modal — auto-mounts when the user finishes a polygon */}
      <SaveRegionModal projectId={resolvedProjectId} surveyId={surveyIdProp} />

      {/* Annotation modal — auto-mounts when the Annotate tool captures
          a click and stores the position in `annotationDraft`. */}
      <AnnotationModal onSave={createAnnotation} />

      {/* Keyboard shortcut cheat sheet — toggled by `?` */}
      <KeyboardShortcutsOverlay />

      {/* Fullscreen loader — hides the empty scene until manifest + terrain
          + ortho are ready. Latches once per survey; layer toggles after
          the initial mount keep the viewer visible. */}
      <ViewerLoader
        variant="fullscreen"
        visible={!initialLoadComplete}
        assetStatuses={assetStatuses}
      />
    </div>
  );
}
