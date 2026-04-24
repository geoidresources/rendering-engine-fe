'use client';

/**
 * V-STATE-04 — Saved camera bookmarks per user per survey.
 * CRUD against GET/POST/DELETE /user-svc/api/v1/users/me/viewer-bookmarks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userSvcClient } from '@/lib/http';

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
      const res = await userSvcClient.get<ViewerBookmark[]>(endpoint, {
        params: { survey_id: surveyId },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!surveyId,
  });
}

export function useCreateBookmark(surveyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<ViewerBookmark, Error, { name: string; camera_json: CameraJSON }>({
    mutationFn: async (body) => {
      const res = await userSvcClient.post<ViewerBookmark>(endpoint, {
        survey_id: surveyId,
        ...body,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['viewer-bookmarks', surveyId] }),
  });
}

export function useDeleteBookmark(surveyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await userSvcClient.delete(`${endpoint}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['viewer-bookmarks', surveyId] }),
  });
}
