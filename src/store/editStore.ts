/**
 * editStore — Virtual Surveyor parity (Phase 0)
 *
 * Holds the state that drives interactive survey editing (Phase 1+). Phase
 * 0 only ships the empty state shape and persistence so that downstream
 * phases can begin layering on top without further store churn.
 *
 * Why a separate store from viewerStore: the viewer has a Zustand store
 * already saturated with render layer state, tool modes, measurement
 * data, camera, and right-rail layout. Layering editing primitives onto
 * the same store risks selector recomputation cascades that already bite
 * the viewer at 10k+ entity loads. The editStore is read by tool-handler
 * hooks (Phase 1), the surfaces/modifiers panels (Phase 3-4), and the
 * design-feature panels (Phase 5) without forcing re-renders of layer
 * lifecycle effects.
 *
 * Persistence: drafts and snapping prefs persist to localStorage under
 * the key 'geoid.edit.v1'. Active drawing state is intentionally NOT
 * persisted so a refresh always lands the operator back in 'select'.
 */

import { create } from "zustand";
import type {
  SurveyPoint,
  Breakline,
  SurveySurface,
  TerrainModifier,
  DesignFeature,
} from "@/types/asset-svc";

export type DrawingKind =
  | "point"
  | "polyline"
  | "arc"
  | "breakline"
  | "boundary"
  | "rect"
  | "circle";

export interface DrawingVertex {
  longitude: number;
  latitude: number;
  height: number;
}

export interface SnappingState {
  enabled: boolean;
  /** Snap distance in metres along a drawn vector, or null = continuous. */
  intervalM: number | null;
  /** Snap angle in degrees from the last segment, or null = continuous. */
  angleDeg: number | null;
  /** Snap to existing vertex within this radius (metres). */
  vertexRadiusM: number;
}

export interface DrawingState {
  activeKind: DrawingKind | null;
  vertices: DrawingVertex[];
  /** Optional metadata the active tool wants to carry through commit. */
  meta?: Record<string, unknown>;
}

interface EditState {
  drawing: DrawingState;
  /** Local-first edit buffers; Phase 1 hooks write through to API. */
  draftPoints: Map<string, SurveyPoint>;
  draftBreaklines: Map<string, Breakline>;
  /** Live-fetched canonical lists; Phase 3+ populates from API. */
  surfaces: SurveySurface[];
  modifiers: TerrainModifier[];
  designFeatures: DesignFeature[];
  snapping: SnappingState;

  // ---- Actions ----
  startDrawing(kind: DrawingKind, meta?: Record<string, unknown>): void;
  appendVertex(v: DrawingVertex): void;
  popVertex(): void;
  clearDrawing(): void;
  setSnapping(patch: Partial<SnappingState>): void;
  setSurfaces(surfaces: SurveySurface[]): void;
  setModifiers(modifiers: TerrainModifier[]): void;
  setDesignFeatures(features: DesignFeature[]): void;
  upsertDraftPoint(p: SurveyPoint): void;
  removeDraftPoint(id: string): void;
  upsertDraftBreakline(b: Breakline): void;
  removeDraftBreakline(id: string): void;
  /** Reset everything back to the initial state. */
  reset(): void;
}

const STORAGE_KEY = "geoid.edit.v1";

const initialSnapping: SnappingState = {
  enabled: false,
  intervalM: null,
  angleDeg: null,
  vertexRadiusM: 0.5,
};

function loadPersisted(): Partial<EditState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { snapping?: SnappingState };
    return { snapping: parsed.snapping ?? initialSnapping };
  } catch {
    return {};
  }
}

function persist(state: EditState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ snapping: state.snapping }),
    );
  } catch {
    // Quota / storage disabled — silently skip; non-fatal.
  }
}

export const useEditStore = create<EditState>((set, get) => {
  const persisted = loadPersisted();
  return {
    drawing: { activeKind: null, vertices: [] },
    draftPoints: new Map(),
    draftBreaklines: new Map(),
    surfaces: [],
    modifiers: [],
    designFeatures: [],
    snapping: persisted.snapping ?? initialSnapping,

    startDrawing(kind, meta) {
      set({ drawing: { activeKind: kind, vertices: [], meta } });
    },
    appendVertex(v) {
      set((s) => ({ drawing: { ...s.drawing, vertices: [...s.drawing.vertices, v] } }));
    },
    popVertex() {
      set((s) => ({ drawing: { ...s.drawing, vertices: s.drawing.vertices.slice(0, -1) } }));
    },
    clearDrawing() {
      set({ drawing: { activeKind: null, vertices: [] } });
    },
    setSnapping(patch) {
      set((s) => {
        const next = { ...s.snapping, ...patch };
        const newState = { ...s, snapping: next };
        persist(newState);
        return { snapping: next };
      });
    },
    setSurfaces(surfaces) {
      set({ surfaces });
    },
    setModifiers(modifiers) {
      // Keep ordinal-sorted so consumers don't have to.
      set({ modifiers: [...modifiers].sort((a, b) => a.ordinal - b.ordinal) });
    },
    setDesignFeatures(designFeatures) {
      set({ designFeatures });
    },
    upsertDraftPoint(p) {
      const next = new Map(get().draftPoints);
      next.set(p.id, p);
      set({ draftPoints: next });
    },
    removeDraftPoint(id) {
      const next = new Map(get().draftPoints);
      next.delete(id);
      set({ draftPoints: next });
    },
    upsertDraftBreakline(b) {
      const next = new Map(get().draftBreaklines);
      next.set(b.id, b);
      set({ draftBreaklines: next });
    },
    removeDraftBreakline(id) {
      const next = new Map(get().draftBreaklines);
      next.delete(id);
      set({ draftBreaklines: next });
    },
    reset() {
      set({
        drawing: { activeKind: null, vertices: [] },
        draftPoints: new Map(),
        draftBreaklines: new Map(),
        surfaces: [],
        modifiers: [],
        designFeatures: [],
      });
    },
  };
});
