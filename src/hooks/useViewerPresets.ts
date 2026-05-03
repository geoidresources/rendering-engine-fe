/**
 * V-TASK-01 — React Query bindings for the viewer workspace presets in
 * user-svc. Three system presets (Stockpile Analysis, Cut-Fill, Ortho
 * Review) are returned first, followed by the caller's own rows sorted
 * newest-first. System rows have `is_system: true` and return 403 on
 * `PUT`/`DELETE` — the UI hides those actions by reading the flag.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSvcClient } from '@/lib/http';
import type { ViewerPreset, ViewerPresetConfig } from '@/types/api';
import { toast } from 'sonner';

const LIST_KEY = ['viewer-presets', 'list'] as const;
const ENDPOINT = '/user-svc/api/v1/users/me/viewer-presets';

export function useViewerPresets() {
  return useQuery<ViewerPreset[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      try {
        const res = await userSvcClient.get<ViewerPreset[]>(ENDPOINT);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        throw e;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export interface CreateViewerPresetBody {
  name: string;
  config: ViewerPresetConfig;
}

export function useCreateViewerPreset() {
  const qc = useQueryClient();
  return useMutation<ViewerPreset, Error, CreateViewerPresetBody>({
    mutationFn: async (body) => {
      try {
        const res = await userSvcClient.post<ViewerPreset>(ENDPOINT, body);
        toast.success('Preset created');
        return res.data;
      } catch (e) {
        toast.error('Failed to create preset');
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export interface UpdateViewerPresetArgs {
  id: string;
  name?: string;
  config?: ViewerPresetConfig;
}

export function useUpdateViewerPreset() {
  const qc = useQueryClient();
  return useMutation<ViewerPreset, Error, UpdateViewerPresetArgs>({
    mutationFn: async ({ id, ...body }) => {
      try {
        const res = await userSvcClient.put<ViewerPreset>(`${ENDPOINT}/${id}`, body);
        toast.success('Preset updated');
        return res.data;
      } catch (e) {
        toast.error('Failed to update preset');
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteViewerPreset() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      try {
        await userSvcClient.delete(`${ENDPOINT}/${id}`);
        toast.success('Preset deleted');
      } catch (e) {
        toast.error('Failed to delete preset');
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
