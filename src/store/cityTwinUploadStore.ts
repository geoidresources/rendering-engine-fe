/**
 * cityTwinUploadStore — per-kind upload state for the city-twin upload page.
 *
 * The /live-city/[cityId]/upload page renders one card per asset kind
 * (mesh, dsm, orthophoto, point_cloud, vector). Each card stages files
 * locally, then drives a three-step ladder (init → PUT to GCS → finalize)
 * via `useCityTwinUpload`. This store owns the lifecycle of every slot.
 *
 * One slot per kind — uploading two kinds in parallel is supported (they
 * write to separate slots). Re-uploading the same kind clears the prior
 * slot first; the BE archives the previous asset row.
 */
import { create } from "zustand";
import type { CityTwinAssetKind } from "@/types/city-twin";

export type UploadFileProgress = {
  /** Path used as the manifest key — webkitRelativePath when present, else File.name. */
  name: string;
  bytes: number;
  totalBytes: number;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
};

export type UploadKindStatus =
  | "idle"
  | "initializing"
  | "uploading"
  | "finalizing"
  | "complete"
  | "failed";

export interface UploadKindSlot {
  /** Files the operator selected but hasn't sent yet. Cleared on `clearKind` /
   *  on a successful finalize. */
  files: File[];
  /** Returned by /assets/init; required by the finalize PATCH and the
   *  "Remove" archive flow. */
  uploadingAssetId: string | null;
  /** Mirror of files[] with byte-level progress for the UI. Reset on
   *  every new init. */
  perFile: UploadFileProgress[];
  status: UploadKindStatus;
  error?: string;
  /** ISO timestamp set on successful finalize so the panel can show
   *  "uploaded 2 min ago". */
  uploadedAt: string | null;
  /** Echo of the detected root_file / source_format the BE was given. Useful
   *  for the "uploaded" view without re-fetching the asset row. */
  rootFile: string | null;
  sourceFormat: string | null;
}

const KINDS: CityTwinAssetKind[] = ["mesh", "dsm", "orthophoto", "point_cloud", "vector"];

const defaultSlot = (): UploadKindSlot => ({
  files: [],
  uploadingAssetId: null,
  perFile: [],
  status: "idle",
  error: undefined,
  uploadedAt: null,
  rootFile: null,
  sourceFormat: null,
});

const initialKinds = (): Record<CityTwinAssetKind, UploadKindSlot> =>
  KINDS.reduce(
    (acc, k) => {
      acc[k] = defaultSlot();
      return acc;
    },
    {} as Record<CityTwinAssetKind, UploadKindSlot>,
  );

interface CityTwinUploadState {
  kinds: Record<CityTwinAssetKind, UploadKindSlot>;
  stageFiles: (kind: CityTwinAssetKind, files: File[]) => void;
  clearKind: (kind: CityTwinAssetKind) => void;
  setStatus: (kind: CityTwinAssetKind, status: UploadKindStatus, error?: string) => void;
  setUploadingAssetId: (kind: CityTwinAssetKind, id: string | null) => void;
  initFileProgress: (kind: CityTwinAssetKind, items: UploadFileProgress[]) => void;
  setFileProgress: (
    kind: CityTwinAssetKind,
    index: number,
    bytes: number,
    status?: UploadFileProgress["status"],
    error?: string,
  ) => void;
  setUploaded: (kind: CityTwinAssetKind, rootFile: string, sourceFormat: string) => void;
  reset: () => void;
}

export const useCityTwinUploadStore = create<CityTwinUploadState>((set) => ({
  kinds: initialKinds(),

  stageFiles: (kind, files) =>
    set((state) => ({
      kinds: {
        ...state.kinds,
        [kind]: {
          ...state.kinds[kind],
          // Append to whatever is already staged so multi-drop works.
          files: [...state.kinds[kind].files, ...files],
          status: "idle",
          error: undefined,
        },
      },
    })),

  clearKind: (kind) =>
    set((state) => ({
      kinds: { ...state.kinds, [kind]: defaultSlot() },
    })),

  setStatus: (kind, status, error) =>
    set((state) => ({
      kinds: {
        ...state.kinds,
        [kind]: {
          ...state.kinds[kind],
          status,
          // Clear stale error text on any non-failed transition so retries
          // don't leave a red banner showing.
          error: status === "failed" ? error : undefined,
        },
      },
    })),

  setUploadingAssetId: (kind, id) =>
    set((state) => ({
      kinds: { ...state.kinds, [kind]: { ...state.kinds[kind], uploadingAssetId: id } },
    })),

  initFileProgress: (kind, items) =>
    set((state) => ({
      kinds: { ...state.kinds, [kind]: { ...state.kinds[kind], perFile: items } },
    })),

  setFileProgress: (kind, index, bytes, status, error) =>
    set((state) => {
      const slot = state.kinds[kind];
      const next = slot.perFile.map((row, i) =>
        i === index
          ? { ...row, bytes, status: status ?? row.status, error: error ?? row.error }
          : row,
      );
      return { kinds: { ...state.kinds, [kind]: { ...slot, perFile: next } } };
    }),

  setUploaded: (kind, rootFile, sourceFormat) =>
    set((state) => ({
      kinds: {
        ...state.kinds,
        [kind]: {
          ...state.kinds[kind],
          status: "complete",
          uploadedAt: new Date().toISOString(),
          rootFile,
          sourceFormat,
          // Drop staged files — the asset row is the new source of truth.
          files: [],
        },
      },
    })),

  reset: () => set({ kinds: initialKinds() }),
}));
