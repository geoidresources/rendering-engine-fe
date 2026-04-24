'use client';

import React, { useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetSvcClient } from '@/lib/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * V-OUTPUT-04 — Threaded comment panel for a single annotation.
 *
 * Comments are fetched from `/asset-svc/api/v1/annotations/:id/comments`.
 * The backend schema (annotation_comments table) is wired up in
 * migration 020_annotation_comments.sql which is run separately.
 *
 * The panel is intentionally simple: flat list of comments + a reply box.
 * No edit / delete of comments in v1 — the sign-off workflow tracks
 * who approved via an `approved_at` timestamp on the annotation itself
 * (future V-OUTPUT-04b).
 */

interface AnnotationComment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

function commentsKey(annotationId: string) {
  return ['annotations', annotationId, 'comments'];
}

interface AnnotationThreadProps {
  annotationId: string;
  annotationText: string;
}

export function AnnotationThread({ annotationId, annotationText }: AnnotationThreadProps) {
  const qc = useQueryClient();
  const [reply, setReply] = useState('');

  const { data: comments = [], isLoading } = useQuery<AnnotationComment[]>({
    queryKey: commentsKey(annotationId),
    queryFn: async () => {
      const res = await assetSvcClient.get<AnnotationComment[]>(
        `/asset-svc/api/v1/annotations/${encodeURIComponent(annotationId)}/comments`,
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30_000,
  });

  const addComment = useMutation<AnnotationComment, Error, string>({
    mutationFn: async (text) => {
      const res = await assetSvcClient.post<AnnotationComment>(
        `/asset-svc/api/v1/annotations/${encodeURIComponent(annotationId)}/comments`,
        { text },
      );
      return res.data;
    },
    onSuccess: (comment) => {
      qc.setQueryData<AnnotationComment[]>(commentsKey(annotationId), (prev = []) => [
        ...prev,
        comment,
      ]);
      setReply('');
    },
    onError: () => toast.error('Failed to post comment.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    addComment.mutate(text);
  };

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-text-muted">
        <MessageCircle className="size-3" />
        <span>Thread — {annotationText}</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-1 text-text-muted text-[11px]">
          <Loader2 className="size-3 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && comments.length === 0 && (
        <p className="text-[11px] text-text-muted">No comments yet. Be the first.</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="rounded-sm border border-border-subtle bg-bg-elevated px-2.5 py-1.5">
          <p className="text-[11px] text-text-primary">{c.text}</p>
          <p className="text-[9px] text-text-muted mt-0.5 font-mono">
            {c.created_at.slice(0, 10)}
          </p>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 mt-1">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          disabled={addComment.isPending}
          className="flex-1 text-[11px] h-7"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!reply.trim() || addComment.isPending}
          className="h-7 px-2"
        >
          {addComment.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
        </Button>
      </form>
    </div>
  );
}
