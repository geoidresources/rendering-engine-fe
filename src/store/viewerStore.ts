import { create } from 'zustand';
import { Manifest } from '../types/manifest';

export type LayerId = 'ortho' | 'dsm' | 'laz' | 'polygons' | 'site_model';
export type TerrainMode = 'dtm' | 'dsm';
export type ToolMode = 'select' | 'distance' | 'area' | 'volume';

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

  // Selection
  selectedFeature: Record<string, unknown> | null;
  setSelectedFeature: (feature: Record<string, unknown> | null) => void;

  // Camera state (Cesium coordinate system)
  cameraState: CesiumCameraState;
  setCameraState: (state: CesiumCameraState) => void;
}

const initialLayers: Record<LayerId, LayerState> = {
  ortho: { id: 'ortho', name: 'Orthomosaic', visible: true, opacity: 1, loading: false, error: null },
  // "Terrain" toggles a future draped terrain overlay in the UI; globe terrain comes from DTM/DSM toolbar.
  dsm: { id: 'dsm', name: 'Terrain', visible: false, opacity: 0.8, loading: false, error: null },
  laz: { id: 'laz', name: 'Point Cloud', visible: true, opacity: 1, loading: false, error: null },
  polygons: { id: 'polygons', name: 'Regions of Interest', visible: true, opacity: 0.5, loading: false, error: null },
  site_model: { id: 'site_model', name: 'Site Model (3D)', visible: true, opacity: 1, loading: false, error: null },
};

// Mine site centre: lon=152.414949, lat=-32.062341
// height ~3000m puts the full site nicely in view on first load.
const initialCameraState: CesiumCameraState = {
  longitude: 152.414949,
  latitude: -32.062341,
  height: 3000,
  heading: 0,
  pitch: -0.5,
  roll: 0,
};

export const useViewerStore = create<ViewerState>((set, get) => ({
  manifest: null,

  loadManifest: async (id: string) => {
    try {
      const baseUrl = id.includes('?') ? id.split('?')[0] : id;
      const query = id.includes('?') ? '?' + id.split('?')[1] : '';
      const response = await fetch(`http://localhost:8080/api/manifests/${baseUrl}${query}`);
      if (!response.ok) throw new Error('Failed to load manifest');
      const manifest = await response.json();
      set({ manifest });
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

  pointBudget: 2000000,
  setPointBudget: (budget) => set({ pointBudget: budget }),

  terrainExaggeration: 1,
  setTerrainExaggeration: (exaggeration) => set({ terrainExaggeration: exaggeration }),

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

  cameraState: initialCameraState,
  setCameraState: (cameraState) => set({ cameraState }),
}));
