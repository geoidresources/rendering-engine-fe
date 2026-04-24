/**
 * V-STATE-03 — Fetch and mutate survey annotations from the asset-svc backend.
 *
 * On load: fetches all annotations for the current survey and syncs them into
 * viewerStore so `useAnnotationLayer` can render them as Cesium pins without
 * being aware of React Query.
 *
 * Exposed: `createAnnotation(text)` and `deleteAnnotation(id)` — callers
 * get back a mutation promise they can await (useful for AnnotationModal's
 * saving spinner).
 */
'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetSvcClient } from '@/lib/http';
import { useViewerStore } from '@/store/viewerStore';
import type { Annotation } from '@/store/viewerStore';

interface BackendAnnotation {
  id: string;
  project_id: string;
  survey_id: string;
  user_id: string;
  text: string;
  point: { longitude: number; latitude: number; height: number };
  created_at: string;
  updated_at: string;
}

function toStoreAnnotation(a: BackendAnnotation): Annotation {
  return {
    id: a.id,
    text: a.text,
    point: a.point,
    createdAt: a.created_at,
  };
}

function annotationsKey(surveyId: string) {
  return ['annotations', surveyId];
}

export function useAnnotations(projectId: string | undefined, surveyId: string | undefined) {
  const qc = useQueryClient();
  const setAnnotations = useViewerStore((s) => s.setAnnotations);
  const cancelAnnotationDraft = useViewerStore((s) => s.cancelAnnotationDraft);
  const annotationDraft = useViewerStore((s) => s.annotationDraft);

  const { data } = useQuery<BackendAnnotation[]>({
    queryKey: annotationsKey(surveyId ?? ''),
    queryFn: async () => {
      const res = await assetSvcClient.get<BackendAnnotation[]>(
        `/asset-svc/api/v1/annotations/?survey_id=${encodeURIComponent(surveyId!)}`,
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(surveyId),
    staleTime: 30_000,
  });

  // Sync backend data → Cesium datasource via the store.
  useEffect(() => {
    if (!data) return;
    setAnnotations(data.map(toStoreAnnotation));
  }, [data, setAnnotations]);

  const createAnnotation = useMutation<BackendAnnotation, Error, { text: string }>({
    mutationFn: async ({ text }) => {
      const draftPoint = annotationDraft.point;
      if (!draftPoint) throw new Error('No draft point');
      const res = await assetSvcClient.post<BackendAnnotation>('/asset-svc/api/v1/annotations/', {
        project_id: projectId,
        survey_id: surveyId,
        text,
        point: draftPoint,
      });
      return res.data;
    },
    onSuccess: (created) => {
      qc.setQueryData<BackendAnnotation[]>(annotationsKey(surveyId ?? ''), (prev = []) => [
        ...prev,
        created,
      ]);
      cancelAnnotationDraft();
    },
  });

  const deleteAnnotation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await assetSvcClient.delete(`/asset-svc/api/v1/annotations/${encodeURIComponent(id)}`);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<BackendAnnotation[]>(annotationsKey(surveyId ?? ''), (prev = []) =>
        prev.filter((a) => a.id !== id),
      );
    },
  });

  const handleCreate = async (text: string) => {
    await createAnnotation.mutateAsync({ text });
  };

  const handleDelete = async (id: string) => {
    await deleteAnnotation.mutateAsync(id);
  };

  return { createAnnotation: handleCreate, deleteAnnotation: handleDelete };
}
