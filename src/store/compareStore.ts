import { create } from "zustand";

export type CompareMode = "slider" | "side-by-side" | "diff";

interface CompareState {
  enabled: boolean;
  epochA: string | null;
  epochB: string | null;
  mode: CompareMode;
  /** Fraction (0–1) of canvas width where the slider divider sits. 0.5 = centred. */
  splitPosition: number;

  toggle: () => void;
  setEpochs: (a: string | null, b: string | null) => void;
  setMode: (mode: CompareMode) => void;
  setSplitPosition: (pos: number) => void;
  reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  enabled: false,
  epochA: null,
  epochB: null,
  mode: "slider",
  splitPosition: 0.5,

  toggle: () => set((state) => ({ enabled: !state.enabled })),

  setEpochs: (epochA, epochB) => set({ epochA, epochB }),

  setMode: (mode) => set({ mode }),

  setSplitPosition: (splitPosition) =>
    set({ splitPosition: Math.min(1, Math.max(0, splitPosition)) }),

  reset: () =>
    set({
      enabled: false,
      epochA: null,
      epochB: null,
      mode: "slider",
      splitPosition: 0.5,
    }),
}));
