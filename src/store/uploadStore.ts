import { create } from "zustand";
import type { FileUploadState } from "@/types/asset-svc";

interface UploadStore {
  uploads: FileUploadState[];
  surveyId: string | null;
  isIngesting: boolean;

  queueFiles: (files: File[]) => void;
  updateFile: (index: number, patch: Partial<FileUploadState>) => void;
  setSurveyId: (id: string) => void;
  setIsIngesting: (v: boolean) => void;
  clearCompleted: () => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  surveyId: null,
  isIngesting: false,

  queueFiles: (files) =>
    set((state) => ({
      uploads: [
        ...state.uploads,
        ...files.map((file) => ({
          file,
          status: "queued" as const,
          progress: 0,
          speed: 0,
          bytesUploaded: 0,
        })),
      ],
    })),

  updateFile: (index, patch) =>
    set((state) => ({
      uploads: state.uploads.map((u, i) => (i === index ? { ...u, ...patch } : u)),
    })),

  setSurveyId: (id) => set({ surveyId: id }),
  setIsIngesting: (v) => set({ isIngesting: v }),

  clearCompleted: () =>
    set((state) => ({
      uploads: state.uploads.filter((u) => u.status !== "complete"),
    })),

  reset: () => set({ uploads: [], surveyId: null, isIngesting: false }),
}));
