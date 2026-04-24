/**
 * V-TASK-01 — modal for saving the current viewer state as a named
 * workspace preset. Opens from the Workspace dropdown's "Save current
 * as preset…" item; on submit it calls `useCreateViewerPreset` with a
 * snapshot of `viewerStore` pared down to the fields a preset carries
 * (layers, terrain mode, tool, etc.) and sets `activePresetId` to the
 * freshly-created row so the picker's label updates instantly.
 */
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateViewerPreset } from '@/hooks/useViewerPresets';
import { useViewerStore } from '@/store/viewerStore';
import type { ViewerPresetConfig } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildSnapshot(state: ReturnType<typeof useViewerStore.getState>): ViewerPresetConfig {
  const snapshotLayer = (id: 'ortho' | 'dsm' | 'laz' | 'contours' | 'heatmap') => ({
    visible: state.layers[id].visible,
    opacity: state.layers[id].opacity,
  });
  return {
    ver: 1,
    layers: {
      ortho: snapshotLayer('ortho'),
      dsm: snapshotLayer('dsm'),
      laz: snapshotLayer('laz'),
      contours: snapshotLayer('contours'),
      heatmap: snapshotLayer('heatmap'),
    },
    terrainMode: state.terrainMode,
    blendPreset: state.blendPreset,
    activeTool: state.activeTool,
    terrainExaggeration: state.terrainExaggeration,
    pointBudget: state.pointBudget,
  };
}

export function SavePresetModal({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const createPreset = useCreateViewerPreset();
  const setActivePresetId = useViewerStore((s) => s.setActivePresetId);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErr('Name is required');
      return;
    }
    setErr(null);
    const snapshot = buildSnapshot(useViewerStore.getState());
    try {
      const created = await createPreset.mutateAsync({ name: trimmed, config: snapshot });
      setActivePresetId(created.id);
      setName('');
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save preset');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setErr(null);
          setName('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Save workspace preset</DialogTitle>
          <DialogDescription>
            Captures the current layers, terrain mode, and active tool so you can
            return to this view with one click.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-1">
          <label htmlFor="preset-name" className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
            Preset name
          </label>
          <Input
            id="preset-name"
            autoFocus
            value={name}
            maxLength={120}
            placeholder="e.g. North pit weekly"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !createPreset.isPending) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {err && <span className="text-[11px] text-destructive">{err}</span>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={createPreset.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createPreset.isPending || name.trim().length === 0}>
            {createPreset.isPending ? 'Saving…' : 'Save preset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
