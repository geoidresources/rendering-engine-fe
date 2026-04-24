'use client';

import React, { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { useViewerStore } from '@/store/viewerStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Single-field modal that turns the click captured in
 * `viewerStore.annotationDraft.point` into a persisted backend annotation.
 * `onSave` is provided by the parent (Viewer.tsx) which owns the
 * `useAnnotations` hook — this keeps the modal unaware of the mutation
 * implementation and lets Viewer handle loading/error state at the right level.
 *
 * Auto-mounts whenever a draft is open; closing without saving cancels the
 * draft and stays in Annotate mode so the user can try again.
 */
interface AnnotationModalProps {
  onSave: (text: string) => Promise<void>;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({ onSave }) => {
  const draftPoint = useViewerStore((s) => s.annotationDraft.point);
  const cancelDraft = useViewerStore((s) => s.cancelAnnotationDraft);
  const open = draftPoint != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancelDraft();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {open && <AnnotationForm onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
};

const AnnotationForm: React.FC<{ onSave: (text: string) => Promise<void> }> = ({ onSave }) => {
  const draftPoint = useViewerStore((s) => s.annotationDraft.point);
  const cancelDraft = useViewerStore((s) => s.cancelAnnotationDraft);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCancel = () => {
    cancelDraft();
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('Annotation needs a label.');
      return;
    }
    if (!draftPoint) {
      toast.error('Lost the click position — try clicking again.');
      cancelDraft();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      toast.success('Pin dropped.');
      setActiveTool('select');
    } catch {
      toast.error('Failed to save annotation — check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="size-4 text-accent" />
          New annotation
        </DialogTitle>
        <DialogDescription>
          Add a short label for this point. Pins persist across sessions and
          are shared with all users of this survey.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3" onKeyDown={onKeyDown}>
        <div className="space-y-1.5">
          <label
            htmlFor="annotation-text"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Label
          </label>
          <Input
            id="annotation-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Equipment park"
            autoFocus
            maxLength={80}
            disabled={saving}
          />
        </div>

        {draftPoint && (
          <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground">
            <p>
              <span className="text-foreground tabular-nums">
                {draftPoint.longitude.toFixed(5)}
              </span>
              ,{' '}
              <span className="text-foreground tabular-nums">
                {draftPoint.latitude.toFixed(5)}
              </span>
            </p>
            <p className="mt-0.5">
              ↵ to save · Esc to cancel
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!text.trim() || saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
          Save pin
        </Button>
      </DialogFooter>
    </>
  );
};
