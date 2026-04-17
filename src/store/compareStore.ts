import { create } from "zustand";

export type CompareMode = "slider" | "side-by-side" | "diff";

interface CompareState {
  enabled: boolean;
  epochA: string | null;
  epochB: string | null;
  mode: CompareMode;

  toggle: () => void;
  setEpochs: (a: string | null, b: string | null) => void;
  setMode: (mode: CompareMode) => void;
  reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  enabled: false,
  epochA: null,
  epochB: null,
  mode: "slider",

  toggle: () => set((state) => ({ enabled: !state.enabled })),

  setEpochs: (epochA, epochB) => set({ epochA, epochB }),

  setMode: (mode) => set({ mode }),

  reset: () =>
    set({ enabled: false, epochA: null, epochB: null, mode: "slider" }),
}));
