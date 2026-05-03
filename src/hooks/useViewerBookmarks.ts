'use client';

/**
 * V-STATE-04 — Saved camera bookmarks per user per survey.
 * CRUD against GET/POST/DELETE /user-svc/api/v1/users/me/viewer-bookmarks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userSvcClient } from '@/lib/http';
import { toast } from 'sonner';

export interface CameraJSON {
  lng: number;
  lat: number;
  height: number;
  heading?: number;
  pitch?: number;
}

export interface ViewerBookmark {
  id: string;
  client_id: string;
  user_id: string;
  survey_id: string;
  name: string;
  camera_json: CameraJSON;
  created_at: string;
  updated_at: string;
}

const endpoint = '/user-svc/api/v1/users/me/viewer-bookmarks';

export function useViewerBookmarks(surveyId: string | undefined) {
  return useQuery<ViewerBookmark[]>({
    queryKey: ['viewer-bookmarks', surveyId],
    queryFn: async () => {
      if (!surveyId) return [];
      try {
        const res = await userSvcClient.get<ViewerBookmark[]>(endpoint, {
          params: { survey_id: surveyId },
        });
        const data = res.data;
        if (!Array.isArray(data)) {
          console.error('[useViewerBookmarks] Expected array, got:', data);
          return [];
        }
        return data;
      } catch (e) {
        console.error('[useViewerBookmarks] Fetch failed:', e);
        toast.error('Failed to load bookmarks');
        throw e;
      }
    },
    enabled: !!surveyId,
    retry: 1,
  });
}

export function useCreateBookmark(surveyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<ViewerBookmark, Error, { name: string; camera_json: CameraJSON }>({
    mutationFn: async (body) => {
      try {
        const res = await userSvcClient.post<ViewerBookmark>(endpoint, {
          survey_id: surveyId,
          ...body,
        });
        toast.success('Bookmark saved');
        return res.data;
      } catch (e) {
        toast.error('Failed to save bookmark');
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['viewer-bookmarks', surveyId] }),
  });
}

export function useDeleteBookmark(surveyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      try {
        await userSvcClient.delete(`${endpoint}/${id}`);
        toast.success('Bookmark deleted');
      } catch (e) {
        toast.error('Failed to delete bookmark');
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['viewer-bookmarks', surveyId] }),
  });
}
