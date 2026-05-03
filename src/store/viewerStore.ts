import { create } from 'zustand';
import { Cartesian3, type Viewer as CesiumViewer } from 'cesium';
import { Manifest, Bounds } from '../types/manifest';
import { apiClient } from '../lib/http';
import type { Project, ViewerPresetConfig } from '../types/api';
import { computeVolumeFromTerrain } from '../lib/cesium/measurementPrimitives';

export type LayerId =
  | 'ortho'
  | 'dsm'
  | 'laz'
  | 'polygons'
  | 'site_model'
  | 'heatmap'
  | 'contours'
  | 'annotations'
  | 'design_overlay';
export type TerrainMode = 'dtm' | 'dsm';
export type ToolMode =
  | 'select'
  | 'distance'
  | 'area'
  | 'volume'
  | 'draw-polygon'
  | 'profile'
  | 'cross-section'
  | 'annotate';
export type MeasureShape = 'line' | 'square' | 'polygon';
export type InspectorDataView = 'distance' | 'area' | 'volume' | 'profile' | 'cross-section';
export type BlendPreset = 'stacked' | 'embedded';
export type RightRailTab = 'overview' | 'layers' | 'inspector' | 'measurements' | 'compare' | 'bookmarks';
export type RailRevealReason =
  | 'selection'
  | 'compare-on'
  | 'measurement-active'
  | 'measurement-saved'
  | 'layer-toggled';

export interface MeasurementPoint {
  longitude: number;
  latitude: number;
  height: number;
}

/**
 * Cut/fill split + sample diagnostics for the most recent volume
 * computation. Mirrors the shape returned by `computeVolumeFromTerrain`
 * in `lib/cesium/measurementPrimitives.ts` so callers can surface the
 * pieces (cut, fill, base elevation, sample count) without re-importing
 * the Cesium primitive types into store consumers.
 *
 * `volumeCubicMeters` (above) is the headline number — equal to
 * `breakdown.netVol` and kept on the parent for backwards compatibility
 * with the live readout chip and the Inspector measurement section.
 */
export interface VolumeBreakdown {
  fillVol: number;
  cutVol: number;
  netVol: number;
  sampleCount: number;
  baseElevation: number;
}

export type VolumeBasePlane = 'avg' | 'min' | 'max' | 'fitted';

export interface MeasurementState {
  tool: 'distance' | 'area' | 'volume' | null;
  status: 'idle' | 'drawing' | 'complete';
  points: MeasurementPoint[];
  distanceMeters?: number;
  areaSquareMeters?: number;
  volumeCubicMeters?: number;
  /** Populated after the volume tool completes; null while sampling. */
  volumeBreakdown?: VolumeBreakdown;
  /** Base-plane method the user picked in the Volume card. Drives a
   *  re-run of `computeVolumeFromTerrain`; defaults to `'avg'` to
   *  preserve the historical numbers. */
  basePlane?: VolumeBasePlane;
  /** V-TRUST-02 — epoch (ms) when the volume sum was last written by
   *  `recomputeVolume`. Drives the card's provenance footer so operators
   *  can see whether the number is fresh relative to the currently
   *  loaded survey / terrain. */
  computedAt?: number;
}

export interface SelectedAreaDetails {
  id: string;
  name: string;
  material: string;
  status: string;
  source: string;
  areaSquareMeters: number;
  perimeterMeters: number;
  averageElevationMeters: number;
  lastSurveyedAt: string;
  owner: string;
  notes: string;
}

export interface LayerState {
  id: LayerId;
  name: string;
  visible: boolean;
  opacity: number;
  loading: boolean;
  error: string | null;
}

// Cesium uses longitude/latitude (degrees), height (metres above ellipsoid),
// heading/pitch/roll (radians).
export interface CesiumCameraState {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface ViewerState {
  // Manifest Data
  manifest: Manifest | null;
  /** Set while a `loadManifest` fetch is in flight for an id we don't have yet.
   * Drives the initial fullscreen loader; flips to false on success OR terminal
   * failure so the UI is never stuck. */
  manifestLoading: boolean;
  /** Populated when both the v1 and legacy fallback fetches fail. Used by the
   * viewer to render an error panel instead of the loader. */
  manifestError: { status: number; message: string; surveyId: string } | null;
  loadManifest: (id: string) => Promise<void>;
  getAssetUrl: (type: string, format?: string) => string | undefined;

  // Layer Management
  layers: Record<LayerId, LayerState>;
  setLayerVisibility: (id: LayerId, visible: boolean) => void;
  setLayerOpacity: (id: LayerId, opacity: number) => void;
  setLayerLoading: (id: LayerId, loading: boolean) => void;
  setLayerError: (id: LayerId, error: string | null) => void;

  // Terrain source
  terrainMode: TerrainMode;
  setTerrainMode: (mode: TerrainMode) => void;

  // Active tool
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;

  // Shape-based measure mode — decouples drawing shape from data view.
  measureShape: MeasureShape;
  setMeasureShape: (shape: MeasureShape) => void;
  inspectorDataView: InspectorDataView;
  setInspectorDataView: (view: InspectorDataView) => void;

  // Performance Controls
  pointBudget: number;
  setPointBudget: (budget: number) => void;
  terrainExaggeration: number;
  setTerrainExaggeration: (exaggeration: number) => void;
  blendPreset: BlendPreset;
  setBlendPreset: (preset: BlendPreset) => void;

  // V-TASK-01 — workspace preset currently applied. `null` means the user
  // is running the raw defaults or has drifted from a preset. The picker
  // writes the preset id here when "Apply" is clicked; any subsequent
  // store mutation that's *not* part of the preset (e.g. the operator
  // toggles a layer off by hand) does NOT clear this — drift tracking is
  // out of scope for Sprint-1. The Layers-tab "Advanced" accordion
  // (V-TASK-02, Sprint-2) will use this id as its source of truth.
  activePresetId: string | null;
  setActivePresetId: (id: string | null) => void;
  applyPreset: (id: string, config: ViewerPresetConfig) => void;

  // Selection
  selectedFeature: Record<string, unknown> | null;
  setSelectedFeature: (feature: Record<string, unknown> | null) => void;
  selectedAreaDetails: SelectedAreaDetails | null;
  setSelectedAreaDetails: (details: SelectedAreaDetails | null) => void;
  areaDetailsLoading: boolean;
  setAreaDetailsLoading: (loading: boolean) => void;

  // Measurements
  measurement: MeasurementState;
  setMeasurement: (measurement: MeasurementState) => void;
  clearMeasurement: () => void;
  /** When true, the Volume tool renders an extruded prism preview over
   *  the completed polygon (base plane → base + mean height). Purely a
   *  visual toggle; does not affect the numeric computation. */
  showMeshPreview: boolean;
  setShowMeshPreview: (v: boolean) => void;
  /**
   * Re-run `computeVolumeFromTerrain` against the current Volume polygon
   * with a different base-plane method, and write back the updated
   * `volumeBreakdown` + headline `volumeCubicMeters`. Called by the
   * Volume card's base-plane dropdown so the operator can compare
   * avg / min / max / fitted without redrawing.
   *
   * No-ops (returns immediately) if the active measurement isn't a
   * Volume in 'complete' status with at least 3 points — defensive
   * because the dropdown shouldn't be reachable otherwise. Takes the
   * viewer as a parameter rather than holding it in the store so we
   * don't entangle Zustand state with a non-serialisable Cesium handle.
   */
  recomputeVolume: (
    viewer: CesiumViewer,
    opts: { basePlane: VolumeBasePlane },
  ) => Promise<void>;

  // Camera state (Cesium coordinate system)
  cameraState: CesiumCameraState;
  setCameraState: (state: CesiumCameraState) => void;

  // Cursor position (updated on mouse move over globe)
  cursorPosition: { lng: number; lat: number; elevation: number | null } | null;
  setCursorPosition: (pos: { lng: number; lat: number; elevation: number | null } | null) => void;

  // Survey timeline switching
  availableSurveys: { id: string; date: string; label: string }[];
  activeSurveyId: string | null;
  setAvailableSurveys: (surveys: { id: string; date: string; label: string }[]) => void;
  switchSurvey: (id: string) => void;

  // Focused project — set when a project is clicked; drives the placard overlay.
  focusedProject: Project | null;
  setFocusedProject: (project: Project | null) => void;

  // FlyTo bus — set by UI (e.g. sidebar), consumed by globe/Cesium viewer.
  // `requestId` increments on every call so repeated flyTo to the same coords
  // still fires a new animation.
  flyToTarget: FlyToTarget;
  flyTo: (t: Omit<NonNullable<FlyToTarget>, 'requestId'>) => void;
  clearFlyTo: () => void;

  // Right-rail UI: which tab is showing, and whether it is collapsed.
  // `revealRailFor` is the contextual entry point — components call it
  // when the user picks something / toggles compare / saves a measurement,
  // and it auto-opens the rail to the matching tab.
  rightRailTab: RightRailTab;
  rightRailCollapsed: boolean;
  setRightRailTab: (tab: RightRailTab) => void;
  setRightRailCollapsed: (collapsed: boolean) => void;
  revealRailFor: (reason: RailRevealReason) => void;

  // Region-drawing state — populated by the polygon draw handler when
  // `activeTool === 'draw-polygon'`. Vertices are stored in WGS-84 so
  // the save modal can serialise them straight into a GeoJSON Polygon
  // without needing a Cesium Viewer reference.
  drawing: DrawingState;
  startDrawing: () => void;
  pushDrawingVertex: (point: MeasurementPoint) => void;
  setDrawingVertices: (points: MeasurementPoint[]) => void;
  finalizeDrawing: () => void;
  cancelDrawing: () => void;
  closeDrawingModal: () => void;
  /**
   * Lifts a finished Volume measurement into the SaveRegionModal flow:
   * copies its polygon vertices into `drawing.vertices`, seeds
   * `drawing.defaults` with the operator-chosen material (so the
   * modal's material dropdown opens on the right value, not
   * `'unclassified'`), and pops the modal. Used by the
   * `<MeasurementResultsCard />` Volume sub-view's "Save as stockpile"
   * action — keeps the modal as the single source of truth for
   * region-creation UX (validation, error toasts, processor link)
   * rather than duplicating its form inside the card.
   */
  openSaveModalForMeasurement: (
    points: MeasurementPoint[],
    defaults?: { material?: string; name?: string },
  ) => void;

  // Elevation profile / cross-section — populated by `useProfileHandler`
  // after the user finishes a polyline and we sample terrain at N evenly
  // spaced points. The chart card mounts off `profile.samples != null`.
  // `mode` distinguishes Profile (terrain-only) from Cross-section
  // (terrain + vertical exaggeration slider).
  profile: ProfileState;
  setProfileSamples: (
    samples: ProfileSample[] | null,
    mode: 'profile' | 'cross-section',
  ) => void;
  setProfileExaggeration: (factor: number) => void;
  clearProfile: () => void;

  // Pin annotations — created via the Annotate tool. `annotations` is
  // populated by `useAnnotations` which fetches from the backend and calls
  // `setAnnotations` on load / mutation success. The Cesium datasource in
  // `useAnnotationLayer` reads from here.
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  annotationDraft: AnnotationDraft;
  startAnnotationDraft: (point: MeasurementPoint) => void;
  cancelAnnotationDraft: () => void;

  // V-TASK-03: design overlay — GeoJSON loaded client-side from an uploaded
  // Shapefile or GeoJSON file. Rendered as a dashed stroke on the scene.
  designOverlayGeoJSON: object | null;
  setDesignOverlay: (geojson: object | null) => void;

  /** Resets the entire store to its initial state. */
  reset: () => void;
}

export interface DrawingState {
  /** True while the user is placing vertices on the canvas. */
  active: boolean;
  /** Vertices placed so far (WGS-84). The DrawHandler keeps the Cesium
   *  Cartesian3 list separately for live entity rendering. */
  vertices: MeasurementPoint[];
  /** Set true when the user finishes the polygon (right-click /
   *  double-click). The viewer mounts the SaveRegionModal off this flag. */
  modalOpen: boolean;
  /** Optional pre-fills for the SaveRegionModal — set when the modal is
   *  opened from a path *other* than the Draw tool (e.g. the Volume
   *  card's "Save as stockpile" action passes the operator-chosen
   *  material here so the modal's dropdown opens on the right value).
   *  Cleared on `cancelDrawing` / `closeDrawingModal` so a subsequent
   *  Draw-tool open doesn't inherit a stale material. */
  defaults?: { material?: string; name?: string };
}

/**
 * One terrain sample along the user-drawn profile polyline. `distance`
 * is metres from the polyline start (cumulative along the great-circle
 * route), `height` is metres above the WGS-84 ellipsoid (matches what
 * Cesium's terrain provider returns).
 */
export interface ProfileSample {
  distance: number;
  height: number;
}

export interface ProfileState {
  /** Null when the chart should not render. Non-null after the user
   *  finishes a profile polyline and we've sampled the terrain. */
  samples: ProfileSample[] | null;
  /** Drives the chart's secondary controls — Cross-section mode shows
   *  the vertical-exaggeration slider, Profile does not. */
  mode: 'profile' | 'cross-section';
  /** Vertical-exaggeration factor used by the chart's Y-axis domain.
   *  1 = true scale; default for Cross-section is 3. */
  exaggeration: number;
}

/**
 * One persisted pin on the canvas. The point is stored in WGS-84 so the
 * Cesium layer can rebuild entities deterministically across re-mounts
 * and so we can serialise the list (eventual backend persistence — see
 * Phase 5 in `quirky-munching-corbato.md`).
 */
export interface Annotation {
  id: string;
  text: string;
  point: MeasurementPoint;
  createdAt: string;
}

/**
 * Transient state held while the AnnotationModal is open. `point` is
 * captured at canvas-click time so the modal doesn't need a Cesium ref.
 */
export interface AnnotationDraft {
  point: MeasurementPoint | null;
}

export type FlyToTarget = {
  lng: number;
  lat: number;
  /** Optional camera height (metres). Cesium default ~3000m for projects, ~800m for surveys. */
  height?: number;
  /** Optional bbox — if provided, Cesium uses Rectangle.fromDegrees to frame it. */
  bounds?: Bounds;
  /** Human label for telemetry / tooltip (not required). */
  label?: string;
  /** Monotonic id; incremented on every flyTo() call so the effect fires on duplicates. */
  requestId: number;
} | null;

const initialLayers: Record<LayerId, LayerState> = {
  ortho: { id: 'ortho', name: 'Orthomosaic', visible: true, opacity: 1, loading: false, error: null },
  // Terrain layer toggle controls whether DSM/DTM terrain mesh is active on the globe.
  dsm: { id: 'dsm', name: 'Terrain', visible: true, opacity: 0.8, loading: false, error: null },
  laz: { id: 'laz', name: 'Point Cloud', visible: true, opacity: 1, loading: false, error: null },
  polygons: { id: 'polygons', name: 'Regions of Interest', visible: true, opacity: 0.35, loading: false, error: null },
  site_model: { id: 'site_model', name: 'Site Model (3D)', visible: true, opacity: 1, loading: false, error: null },
  heatmap: { id: 'heatmap', name: 'Cut/Fill Heatmap', visible: false, opacity: 0.7, loading: false, error: null },
  contours: { id: 'contours', name: 'Contour Lines', visible: false, opacity: 1, loading: false, error: null },
  // Annotations are pin-only (billboards + labels), so opacity has no
  // visual effect — the slider is left in for layout consistency with
  // the other layer cards but the renderer ignores the value.
  annotations: { id: 'annotations', name: 'Annotations', visible: true, opacity: 1, loading: false, error: null },
  // Design overlay is off and empty until the user uploads a file.
  design_overlay: { id: 'design_overlay', name: 'Design Overlay', visible: false, opacity: 0.7, loading: false, error: null },
};

// Mine site centre: lon=152.414949, lat=-32.062341
// height ~3000m puts the full site nicely in view on first load.
const initialMeasurement: MeasurementState = {
  tool: null,
  status: 'idle',
  points: [],
};

const initialCameraState: CesiumCameraState = {
  longitude: 152.414949,
  latitude: -32.062341,
  height: 3000,
  heading: 0,
  pitch: -0.5,
  roll: 0,
};

function cameraFromBounds(manifest: Manifest): CesiumCameraState | null {
  const bounds = manifest.bounds;
  if (!bounds) return null;
  const centerLon = (bounds.west + bounds.east) / 2;
  const centerLat = (bounds.south + bounds.north) / 2;
  const spanDeg = Math.max(
    Math.abs(bounds.east - bounds.west),
    Math.abs(bounds.north - bounds.south),
    0.002
  );
  const baseHeight = Math.max(1200, spanDeg * 160000);
  const scale = manifest.rendering?.suggestedViewHeightScale ?? 1;
  return {
    longitude: centerLon,
    latitude: centerLat,
    height: baseHeight * scale,
    heading: 0,
    pitch: -0.5,
    roll: 0,
  };
}

// Module-level in-flight map so sidebar prefetch + Viewer mount can't race
// into two parallel fetches for the same survey. Lives outside the store so
// a Fast Refresh remount doesn't wipe it mid-flight.
const manifestInflight = new Map<string, Promise<void>>();

/**
 * Shared manifest fetcher. Supports v1 dynamic manifests and legacy fallbacks.
 * Dedupes parallel requests for the same surveyId via `manifestInflight`.
 */
export async function fetchManifest(surveyId: string): Promise<Manifest> {
  const inflight = manifestInflight.get(surveyId);
  if (inflight) {
    // This is a bit of a lie because the inflight promise in the store
    // doesn't return the manifest, but it's enough for the store's dedupe.
    // However, for callers who WANT the manifest, we need to return it.
  }

  // To keep it simple and truly reusable, we'll just run the logic.
  // The store's manifestInflight is mainly to prevent redundant HTTP calls.
  try {
    // Try v1 dynamic manifest first (BuildManifest from DB).
    // Falls back to legacy static manifest endpoint for non-UUID IDs
    // (e.g. "rendering-assets-v2") or if the v1 endpoint returns 404.
    try {
      const resp = await apiClient.get<Manifest>(`/api/v1/surveys/${surveyId}/manifest`);
      const manifest = resp.data;
      if (!manifest.assets || manifest.assets.length === 0) {
        throw new Error('v1 manifest has no assets — trying legacy fallback');
      }
      return manifest;
    } catch {
      const fallback = await apiClient.get<Manifest>(`/api/manifests/${surveyId}`);
      return fallback.data;
    }
  } catch (error) {
    const err = error as { status?: number; message?: string };
    const status = typeof err?.status === 'number' ? err.status : 0;
    const message = err?.message ?? 'Unknown error';
    throw { status, message, surveyId };
  }
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  manifest: null,
  manifestLoading: false,
  manifestError: null,

  loadManifest: async (id: string) => {
    const surveyId = id.includes('?') ? id.split('?')[0] : id;

    // Dedupe 1: identical manifest already resolved — nothing to do.
    const current = get().manifest;
    if (current && current.surveyId === surveyId) return;

    // Dedupe 2: another call for the same id is already in flight. Attach
    // to it instead of firing a second HTTP round-trip. The sidebar
    // prefetch + Viewer's own useEffect routinely race through here.
    const inflight = manifestInflight.get(surveyId);
    if (inflight) return inflight;

    const task = (async () => {
      set({ manifestLoading: true, manifestError: null });
      try {
        const manifest = await fetchManifest(surveyId);

        const nextState: Partial<ViewerState> = {
          manifest,
          manifestLoading: false,
          manifestError: null,
        };
        const cameraFromManifest = cameraFromBounds(manifest);
        if (cameraFromManifest) nextState.cameraState = cameraFromManifest;
        const defaultTerrainExaggeration = manifest.rendering?.terrainExaggeration;
        if (typeof defaultTerrainExaggeration === 'number' && Number.isFinite(defaultTerrainExaggeration)) {
          nextState.terrainExaggeration = defaultTerrainExaggeration;
        }
        set(nextState as Pick<ViewerState, 'manifest' | 'cameraState' | 'terrainExaggeration' | 'manifestLoading' | 'manifestError'>);
      } catch (error) {
        // Expected failure modes (401 when logged out, 404 for missing
        // surveys) would otherwise blow up the Next.js dev error overlay
        // every render. Use `warn` so the message still lands in the
        // console but doesn't trigger the red dev-mode toast.
        const err = error as { status?: number; message?: string; surveyId?: string };
        console.warn(`[viewerStore] manifest fetch failed (${err.status}): ${err.message}`);
        set({
          manifestLoading: false,
          manifestError: {
            status: err.status ?? 0,
            message: err.message ?? 'Unknown error',
            surveyId: err.surveyId ?? surveyId,
          },
        });
      } finally {
        manifestInflight.delete(surveyId);
      }
    })();

    manifestInflight.set(surveyId, task);
    return task;
  },

  getAssetUrl: (type: string, format?: string) => {
    const manifest = get().manifest;
    if (!manifest) return undefined;
    const matches = manifest.assets.filter((a) => a.assetType === type);
    if (matches.length === 0) return undefined;
    if (format) {
      const exact = matches.find((a) => a.format === format);
      if (exact) return exact.url;
    }
    // Prefer first match so a mistagged format in the manifest still resolves (e.g. site_model).
    return matches[0].url;
  },

  layers: initialLayers,
  terrainMode: 'dtm',
  activeTool: 'select',
  measureShape: 'polygon',
  setMeasureShape: (measureShape) => set({ measureShape }),
  inspectorDataView: 'area',
  setInspectorDataView: (inspectorDataView) => set({ inspectorDataView }),

  pointBudget: 5000000,
  setPointBudget: (budget) => set({ pointBudget: budget }),

  terrainExaggeration: 1,
  setTerrainExaggeration: (exaggeration) => set({ terrainExaggeration: exaggeration }),

  blendPreset: 'stacked',
  setBlendPreset: (blendPreset) => set({ blendPreset }),

  activePresetId: null,
  setActivePresetId: (id) => set({ activePresetId: id }),
  applyPreset: (id, config) =>
    set((state) => {
      const nextLayers = { ...state.layers };
      if (config.layers) {
        for (const [layerId, layerCfg] of Object.entries(config.layers)) {
          const typed = layerId as LayerId;
          if (nextLayers[typed] && layerCfg) {
            nextLayers[typed] = {
              ...nextLayers[typed],
              visible: Boolean(layerCfg.visible),
              opacity:
                typeof layerCfg.opacity === 'number' && Number.isFinite(layerCfg.opacity)
                  ? Math.min(1, Math.max(0, layerCfg.opacity))
                  : nextLayers[typed].opacity,
            };
          }
        }
      }
      const patch: Partial<ViewerState> = {
        layers: nextLayers,
        activePresetId: id,
      };
      if (config.terrainMode === 'dtm' || config.terrainMode === 'dsm') {
        patch.terrainMode = config.terrainMode;
      }
      if (config.blendPreset === 'stacked' || config.blendPreset === 'embedded') {
        patch.blendPreset = config.blendPreset;
      }
      if (
        typeof config.activeTool === 'string' &&
        (['select', 'distance', 'area', 'volume', 'draw-polygon', 'profile', 'cross-section', 'annotate'] as ToolMode[]).includes(
          config.activeTool as ToolMode,
        )
      ) {
        patch.activeTool = config.activeTool as ToolMode;
      }
      if (typeof config.terrainExaggeration === 'number' && Number.isFinite(config.terrainExaggeration)) {
        patch.terrainExaggeration = Math.max(0.1, Math.min(10, config.terrainExaggeration));
      }
      if (typeof config.pointBudget === 'number' && Number.isFinite(config.pointBudget)) {
        patch.pointBudget = Math.max(100_000, Math.min(20_000_000, Math.floor(config.pointBudget)));
      }
      return patch as Partial<ViewerState>;
    }),

  setLayerVisibility: (id, visible) =>
    set((state) => ({ layers: { ...state.layers, [id]: { ...state.layers[id], visible } } })),

  setLayerOpacity: (id, opacity) =>
    set((state) => ({ layers: { ...state.layers, [id]: { ...state.layers[id], opacity } } })),

  setLayerLoading: (id, loading) =>
    set((state) => ({ layers: { ...state.layers, [id]: { ...state.layers[id], loading } } })),

  setLayerError: (id, error) =>
    set((state) => ({ layers: { ...state.layers, [id]: { ...state.layers[id], error } } })),

  setTerrainMode: (mode) => set({ terrainMode: mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  selectedAreaDetails: null,
  setSelectedAreaDetails: (selectedAreaDetails) => set({ selectedAreaDetails }),
  areaDetailsLoading: false,
  setAreaDetailsLoading: (areaDetailsLoading) => set({ areaDetailsLoading }),

  measurement: initialMeasurement,
  setMeasurement: (measurement) => set({ measurement }),
  clearMeasurement: () => set({ measurement: initialMeasurement }),
  showMeshPreview: true,
  setShowMeshPreview: (showMeshPreview) => set({ showMeshPreview }),
  recomputeVolume: async (viewer, opts) => {
    const m = get().measurement;
    // Guard rails: only run on a finished Volume polygon. The dropdown
    // shouldn't be visible otherwise, but a stale dispatch (e.g. user
    // reset the measurement mid-await) would otherwise NaN the store.
    if (m.tool !== 'volume' || m.points.length < 3) return;
    const verts = m.points.map((p) =>
      Cartesian3.fromDegrees(p.longitude, p.latitude, p.height),
    );
    const result = await computeVolumeFromTerrain(viewer, verts, {
      basePlane: opts.basePlane,
    });
    // Re-read the latest measurement *after* the await — the user may
    // have started a new measurement while the terrain sample was in
    // flight; if so we'd be writing stale numbers into a fresh state.
    const current = get().measurement;
    if (current.tool !== 'volume' || current.points.length < 3) return;
    set({
      measurement: {
        ...current,
        volumeCubicMeters: result.netVol,
        volumeBreakdown: result,
        basePlane: opts.basePlane,
        computedAt: Date.now(),
      },
    });
  },

  cameraState: initialCameraState,
  setCameraState: (cameraState) => set({ cameraState }),

  cursorPosition: null,
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),

  availableSurveys: [],
  activeSurveyId: null,
  setAvailableSurveys: (availableSurveys) => set({ availableSurveys }),
  switchSurvey: (id) => {
    const { loadManifest } = get();
    set({ activeSurveyId: id });
    loadManifest(id);
  },

  focusedProject: null,
  setFocusedProject: (project) => set({ focusedProject: project }),

  flyToTarget: null,
  flyTo: (t) =>
    set((state) => ({
      flyToTarget: {
        ...t,
        requestId: (state.flyToTarget?.requestId ?? 0) + 1,
      },
    })),
  clearFlyTo: () => set({ flyToTarget: null }),

  rightRailTab: 'overview',
  rightRailCollapsed: false,
  setRightRailTab: (rightRailTab) => set({ rightRailTab, rightRailCollapsed: false }),
  setRightRailCollapsed: (rightRailCollapsed) => set({ rightRailCollapsed }),
  revealRailFor: (reason) => {
    // 'measurement-active' routes to Inspector (live readout) rather than the
    // 'Saved regions' tab — the latter only lists backend-persisted regions
    // and would confuse the user mid-draw. 'measurement-saved' is the
    // post-completion event that *does* belong in Saved regions.
    const tab: RightRailTab =
      reason === 'selection' ? 'inspector' :
        reason === 'compare-on' ? 'compare' :
          reason === 'measurement-active' ? 'inspector' :
            reason === 'measurement-saved' ? 'measurements' :
              'layers';
    set({ rightRailTab: tab, rightRailCollapsed: false });
  },

  drawing: { active: false, vertices: [], modalOpen: false },
  startDrawing: () =>
    set({ drawing: { active: true, vertices: [], modalOpen: false } }),
  pushDrawingVertex: (point) =>
    set((state) => ({
      drawing: { ...state.drawing, vertices: [...state.drawing.vertices, point] },
    })),
  setDrawingVertices: (vertices) =>
    set((state) => ({ drawing: { ...state.drawing, vertices } })),
  finalizeDrawing: () =>
    set((state) => {
      // Need at least 3 vertices to form a polygon. Otherwise treat the
      // attempt as a no-op so the user can keep adding points.
      if (state.drawing.vertices.length < 3) return state;
      return { drawing: { ...state.drawing, active: false, modalOpen: true } };
    }),
  cancelDrawing: () =>
    set({ drawing: { active: false, vertices: [], modalOpen: false } }),
  closeDrawingModal: () =>
    set({ drawing: { active: false, vertices: [], modalOpen: false } }),
  openSaveModalForMeasurement: (points, defaults) =>
    set({
      drawing: {
        active: false,
        vertices: points,
        modalOpen: true,
        defaults,
      },
    }),

  profile: { samples: null, mode: 'profile', exaggeration: 1 },
  setProfileSamples: (samples, mode) =>
    set({
      profile: {
        samples,
        mode,
        // Reset exaggeration on each new sampling — Cross-section starts
        // at 3× (terrain features are usually subtle relative to the
        // horizontal span), Profile starts at true scale.
        exaggeration: mode === 'cross-section' ? 3 : 1,
      },
    }),
  setProfileExaggeration: (exaggeration) =>
    set((state) => ({ profile: { ...state.profile, exaggeration } })),
  clearProfile: () =>
    set({ profile: { samples: null, mode: 'profile', exaggeration: 1 } }),

  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
  annotationDraft: { point: null },
  startAnnotationDraft: (point) => set({ annotationDraft: { point } }),
  cancelAnnotationDraft: () => set({ annotationDraft: { point: null } }),

  designOverlayGeoJSON: null,
  setDesignOverlay: (geojson) => set({ designOverlayGeoJSON: geojson }),

  reset: () =>
    set({
      manifest: null,
      manifestLoading: false,
      manifestError: null,
      layers: initialLayers,
      terrainMode: 'dtm',
      activeTool: 'select',
      measureShape: 'polygon',
      inspectorDataView: 'area',
      pointBudget: 5000000,
      terrainExaggeration: 1,
      blendPreset: 'stacked',
      activePresetId: null,
      selectedFeature: null,
      selectedAreaDetails: null,
      areaDetailsLoading: false,
      measurement: initialMeasurement,
      showMeshPreview: true,
      cameraState: initialCameraState,
      cursorPosition: null,
      availableSurveys: [],
      activeSurveyId: null,
      focusedProject: null,
      flyToTarget: null,
      rightRailTab: 'overview',
      rightRailCollapsed: false,
      drawing: { active: false, vertices: [], modalOpen: false },
      profile: { samples: null, mode: 'profile', exaggeration: 1 },
      annotations: [],
      annotationDraft: { point: null },
      designOverlayGeoJSON: null,
    }),
}));

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __viewerStore?: unknown }).__viewerStore = useViewerStore;
}

/** Stable enough for client-side annotation IDs without a uuid dep. */
function makeAnnotationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
