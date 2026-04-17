import { create } from 'zustand';
import { Manifest, Bounds } from '../types/manifest';
import { apiClient } from '../lib/http';
import type { Project } from '../types/api';

export type LayerId = 'ortho' | 'dsm' | 'laz' | 'polygons' | 'site_model' | 'heatmap' | 'contours';
export type TerrainMode = 'dtm' | 'dsm';
export type ToolMode = 'select' | 'distance' | 'area' | 'volume';
export type BlendPreset = 'stacked' | 'embedded';
export type RightRailTab = 'overview' | 'layers' | 'inspector' | 'measurements' | 'compare';
export type RailRevealReason = 'selection' | 'compare-on' | 'measurement-saved' | 'layer-toggled';

export interface MeasurementPoint {
  longitude: number;
  latitude: number;
  height: number;
}

export interface MeasurementState {
  tool: 'distance' | 'area' | 'volume' | null;
  status: 'idle' | 'drawing' | 'complete';
  points: MeasurementPoint[];
  distanceMeters?: number;
  areaSquareMeters?: number;
  volumeCubicMeters?: number;
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

  // Performance Controls
  pointBudget: number;
  setPointBudget: (budget: number) => void;
  terrainExaggeration: number;
  setTerrainExaggeration: (exaggeration: number) => void;
  blendPreset: BlendPreset;
  setBlendPreset: (preset: BlendPreset) => void;

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

export const useViewerStore = create<ViewerState>((set, get) => ({
  manifest: null,

  loadManifest: async (id: string) => {
    try {
      const surveyId = id.includes('?') ? id.split('?')[0] : id;
      let manifest: Manifest;

      // Try v1 dynamic manifest first (BuildManifest from DB).
      // Falls back to legacy static manifest endpoint for non-UUID IDs
      // (e.g. "rendering-assets-v2") or if the v1 endpoint returns 404.
      try {
        const resp = await apiClient.get<Manifest>(`/api/v1/surveys/${surveyId}/manifest`);
        manifest = resp.data;
        // If the DB-built manifest came back empty (survey exists in surveys
        // table but has no processed assets yet), fall through to the legacy
        // static manifest which may have hand-authored data.
        if (!manifest.assets || manifest.assets.length === 0) {
          throw new Error('v1 manifest has no assets — trying legacy fallback');
        }
      } catch {
        // Fallback: legacy static manifest (e.g. for dev/demo without DB).
        // Use apiClient (not bare fetch) so the auth token is included.
        const fallback = await apiClient.get<Manifest>(`/api/manifests/${surveyId}`);
        manifest = fallback.data;
      }

      const nextState: Partial<ViewerState> = { manifest };
      const cameraFromManifest = cameraFromBounds(manifest);
      if (cameraFromManifest) {
        nextState.cameraState = cameraFromManifest;
      }
      const defaultTerrainExaggeration = manifest.rendering?.terrainExaggeration;
      if (typeof defaultTerrainExaggeration === 'number' && Number.isFinite(defaultTerrainExaggeration)) {
        nextState.terrainExaggeration = defaultTerrainExaggeration;
      }
      set(nextState as Pick<ViewerState, 'manifest' | 'cameraState' | 'terrainExaggeration'>);
    } catch (error) {
      console.error('Error loading manifest:', error);
    }
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

  pointBudget: 5000000,
  setPointBudget: (budget) => set({ pointBudget: budget }),

  terrainExaggeration: 1,
  setTerrainExaggeration: (exaggeration) => set({ terrainExaggeration: exaggeration }),

  blendPreset: 'stacked',
  setBlendPreset: (blendPreset) => set({ blendPreset }),

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
    const tab: RightRailTab =
      reason === 'selection' ? 'inspector' :
      reason === 'compare-on' ? 'compare' :
      reason === 'measurement-saved' ? 'measurements' :
      'layers';
    set({ rightRailTab: tab, rightRailCollapsed: false });
  },
}));
