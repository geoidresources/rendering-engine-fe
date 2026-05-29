/**
 * cityTwinViewerStore — render-layer state for /live-city/[cityId].
 *
 * Modelled on the mining `viewerStore.layers` shape but trimmed to the five
 * layers the digital twin pipeline produces: mesh, terrain, ortho, points,
 * vector. Kept in its own store so the city-twin route does not drag in the
 * full mining viewer state graph (measurement / drawing / right-rail tabs
 * etc. — none of which apply yet).
 *
 * Each layer carries a visible flag, an opacity 0..1, and a status that the
 * layer hooks update as Cesium fetches go through their lifecycle:
 *
 *   idle    → no work in flight, layer not yet attempted
 *   loading → Cesium fetch in flight
 *   ready   → primitive / data source is live in the scene
 *   error   → fetch failed; `error` carries the human-readable reason
 *
 * The `<CityTwinLayersPanel />` reads visible + opacity + status to render
 * the row UI, while the four `useCityTwin*Layer` hooks own the status
 * transitions and the Cesium lifecycle for their respective layer.
 */

import { create } from "zustand";

export type CityTwinLayerId = "mesh" | "terrain" | "ortho" | "points" | "vector";

export type CityTwinLayerStatus = "idle" | "loading" | "ready" | "error";

export interface CityTwinLayerSlot {
  visible: boolean;
  opacity: number;
  status: CityTwinLayerStatus;
  error?: string;
}

export interface CityTwinViewerState {
  layers: Record<CityTwinLayerId, CityTwinLayerSlot>;
  setVisible: (id: CityTwinLayerId, visible: boolean) => void;
  setOpacity: (id: CityTwinLayerId, opacity: number) => void;
  setStatus: (id: CityTwinLayerId, status: CityTwinLayerStatus, error?: string) => void;
  /** Resets all five layers back to the on-mount defaults. Useful when the
   *  active conversion changes — we don't want a stale "error" pill from
   *  the previous conversion lingering. */
  reset: () => void;
}

const defaultSlot = (): CityTwinLayerSlot => ({
  visible: true,
  opacity: 1,
  status: "idle",
});

const initialLayers: Record<CityTwinLayerId, CityTwinLayerSlot> = {
  mesh: defaultSlot(),
  terrain: defaultSlot(),
  ortho: defaultSlot(),
  points: defaultSlot(),
  vector: defaultSlot(),
};

export const useCityTwinViewerStore = create<CityTwinViewerState>((set) => ({
  layers: initialLayers,

  setVisible: (id, visible) =>
    set((state) => ({
      layers: { ...state.layers, [id]: { ...state.layers[id], visible } },
    })),

  setOpacity: (id, opacity) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          opacity: Math.min(1, Math.max(0, opacity)),
        },
      },
    })),

  setStatus: (id, status, error) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          status,
          // Clear stale error text on any non-error transition so the
          // tooltip doesn't lie after the operator hits "retry".
          error: status === "error" ? error : undefined,
        },
      },
    })),

  reset: () =>
    set({
      layers: {
        mesh: defaultSlot(),
        terrain: defaultSlot(),
        ortho: defaultSlot(),
        points: defaultSlot(),
        vector: defaultSlot(),
      },
    }),
}));
