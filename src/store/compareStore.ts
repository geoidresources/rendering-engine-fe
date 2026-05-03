import { create } from "zustand";
import { Manifest } from "@/types/manifest";

export type CompareMode = "slider" | "diff";

interface CompareState {
  enabled: boolean;
  epochA: string | null;
  epochB: string | null;
  mode: CompareMode;
  /** Fraction (0–1) of canvas width where the slider divider sits. 0.5 = centred. */
  splitPosition: number;
  manifestA: Manifest | null;
  manifestB: Manifest | null;
  isLoading: boolean;

  toggle: () => void;
  setEpochs: (a: string | null, b: string | null) => void;
  setMode: (mode: CompareMode) => void;
  setSplitPosition: (pos: number) => void;
  setManifests: (a: Manifest | null, b: Manifest | null) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  enabled: false,
  epochA: null,
  epochB: null,
  mode: "slider",
  splitPosition: 0.5,
  manifestA: null,
  manifestB: null,
  isLoading: false,

  toggle: () => set((state) => ({ enabled: !state.enabled })),

  setEpochs: (epochA, epochB) => set({ epochA, epochB }),

  setMode: (mode) => set({ mode }),

  setSplitPosition: (splitPosition) =>
    set({ splitPosition: Math.min(1, Math.max(0, splitPosition)) }),

  setManifests: (manifestA, manifestB) => set({ manifestA, manifestB }),

  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      enabled: false,
      epochA: null,
      epochB: null,
      mode: "slider",
      splitPosition: 0.5,
      manifestA: null,
      manifestB: null,
      isLoading: false,
    }),
}));
