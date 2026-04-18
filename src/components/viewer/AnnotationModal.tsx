'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
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
 * `viewerStore.annotationDraft.point` into a persisted pin via
 * `addAnnotation`. Auto-mounts whenever a draft is open; closing without
 * saving cancels the draft and stays in Annotate mode so the user can
 * try again.
 *
 * Like SaveRegionModal we wrap the form in a thin shell so the inner
 * `useState` initialiser fires once per open — no stale value carrying
 * over between pins, no setState-in-effect.
 */
export const AnnotationModal: React.FC = () => {
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
        {open && <AnnotationForm />}
      </DialogContent>
    </Dialog>
  );
};

const AnnotationForm: React.FC = () => {
  const draftPoint = useViewerStore((s) => s.annotationDraft.point);
  const cancelDraft = useViewerStore((s) => s.cancelAnnotationDraft);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);

  const [text, setText] = useState('');

  const handleCancel = () => {
    cancelDraft();
    // Stay in annotate mode — the user opened the modal by entering it,
    // so leaving them in 'select' would feel like a tool lockout.
  };

  const handleSave = () => {
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
    addAnnotation(trimmed);
    toast.success('Pin dropped.');
    // After saving, drop back into Select so the canvas is interactive
    // (pan/zoom) again. Power users who want to drop several pins in a
    // row can press A then click again.
    setActiveTool('select');
  };

  // Cmd/Ctrl+Enter saves; Esc handled by the Dialog's onOpenChange.
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
          Add a short label for this point. Pins persist for the session
          and can be hidden from the Layers tab.
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
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!text.trim()}>
          Save pin
        </Button>
      </DialogFooter>
    </>
  );
};
