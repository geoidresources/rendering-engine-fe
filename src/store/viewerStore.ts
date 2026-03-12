import { create } from 'zustand';

export type LayerId = 'ortho' | 'dsm' | 'laz' | 'polygons';

export interface LayerState {
  id: LayerId;
  name: string;
  visible: boolean;
  opacity: number;
  loading: boolean;
  error: string | null;
}

export interface ViewerState {
  // Layer Management
  layers: Record<LayerId, LayerState>;
  setLayerVisibility: (id: LayerId, visible: boolean) => void;
  setLayerOpacity: (id: LayerId, opacity: number) => void;
  setLayerLoading: (id: LayerId, loading: boolean) => void;
  setLayerError: (id: LayerId, error: string | null) => void;

  // Selection
  selectedFeature: Record<string, unknown> | null;
  setSelectedFeature: (feature: Record<string, unknown> | null) => void;

  // View State (camera)
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  setViewState: (viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  }) => void;
}

const initialLayers: Record<LayerId, LayerState> = {
  ortho: { id: 'ortho', name: 'Orthomosaic', visible: true, opacity: 1, loading: false, error: null },
  dsm: { id: 'dsm', name: 'DSM (Elevation)', visible: false, opacity: 0.8, loading: false, error: null },
  laz: { id: 'laz', name: 'Point Cloud', visible: true, opacity: 1, loading: false, error: null },
  polygons: { id: 'polygons', name: 'Regions of Interest', visible: true, opacity: 0.5, loading: false, error: null },
};

export const useViewerStore = create<ViewerState>((set) => ({
  layers: initialLayers,
  
  setLayerVisibility: (id, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], visible },
      },
    })),
    
  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], opacity },
      },
    })),
    
  setLayerLoading: (id, loading) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], loading },
      },
    })),
    
  setLayerError: (id, error) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], error },
      },
    })),

  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),

  viewState: {
    longitude: 0,
    latitude: 0,
    zoom: 16,
    pitch: 45,
    bearing: 0,
  },
  setViewState: (viewState) => set({ viewState }),
}));
