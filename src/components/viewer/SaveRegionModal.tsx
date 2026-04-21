'use client';

import React, { useMemo, useState } from 'react';
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
import { useMaterials, FALLBACK_MATERIALS } from '@/hooks/useMaterials';
import {
  useCreateMeasurement,
  type MeasurementFeatureType,
} from '@/hooks/useMeasurementsCrud';
import { cn } from '@/lib/utils';

interface SaveRegionModalProps {
  /** Project the polygon belongs to. Required to scope the POST. */
  projectId: string | null | undefined;
  /** Optional active survey id, attached as `properties.survey_id` so
   *  the workflow processor can pin the volume calculation to a single
   *  epoch instead of the project's latest. */
  surveyId?: string | null;
}

/**
 * Two-field modal that turns the polygon currently sitting in
 * `viewerStore.drawing.vertices` into a persisted measurement via
 * asset-svc. Auto-mounts when `drawing.modalOpen === true`; closes
 * itself (and clears drawing state) on save / cancel.
 *
 * Implemented as a thin wrapper around `SaveRegionForm` so the form's
 * `useState` initialisers can seed the default name + material lazily
 * — that avoids a `setState` inside `useEffect`, which the strict
 * Next-16 react-hooks rule flags. The form is unmounted while the
 * modal is closed, so each open starts with a fresh default name.
 */
export const SaveRegionModal: React.FC<SaveRegionModalProps> = ({
  projectId,
  surveyId,
}) => {
  const open = useViewerStore((s) => s.drawing.modalOpen);
  const closeModal = useViewerStore((s) => s.closeDrawingModal);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const create = useCreateMeasurement(projectId);

  const handleCancel = () => {
    if (create.isPending) return;
    closeModal();
    setActiveTool('select');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {open && (
          <SaveRegionForm
            projectId={projectId}
            surveyId={surveyId ?? null}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

interface SaveRegionFormProps {
  projectId: string | null | undefined;
  surveyId: string | null;
}

const SaveRegionForm: React.FC<SaveRegionFormProps> = ({
  projectId,
  surveyId,
}) => {
  const vertices = useViewerStore((s) => s.drawing.vertices);
  const defaults = useViewerStore((s) => s.drawing.defaults);
  const closeModal = useViewerStore((s) => s.closeDrawingModal);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const revealRailFor = useViewerStore((s) => s.revealRailFor);

  const { data: materialRows = [], isLoading: materialsLoading } =
    useMaterials(projectId);
  const create = useCreateMeasurement(projectId);

  // Material list — server values first (so most-recent appears at the
  // top), then any FALLBACK_MATERIALS we don't already have.
  const materials = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of materialRows) {
      if (!row.material) continue;
      if (seen.has(row.material)) continue;
      seen.add(row.material);
      out.push(row.material);
    }
    for (const m of FALLBACK_MATERIALS) {
      if (seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
    return out;
  }, [materialRows]);

  // Lazy initialisers — only run on first mount, which happens once
  // per modal open because the form is keyed off `open`. When the modal
  // is opened from a non-Draw entry point (e.g. the Volume card's
  // "Save as stockpile" button via `openSaveModalForMeasurement`), the
  // store's `drawing.defaults` carries the operator-chosen material and
  // a name suggestion — both flow into the initialisers here so the
  // form opens with the right pre-fills, not stale defaults.
  const [name, setName] = useState(
    () =>
      defaults?.name ??
      `Region ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`,
  );
  const [material, setMaterial] = useState<string>(
    () => defaults?.material ?? 'unclassified',
  );

  const handleCancel = () => {
    if (create.isPending) return;
    closeModal();
    setActiveTool('select');
  };

  const handleSave = () => {
    if (!projectId) {
      toast.error('Project context missing — cannot save region.');
      return;
    }
    if (vertices.length < 3) {
      toast.error('Polygon needs at least 3 vertices.');
      return;
    }
    // GeoJSON expects [lng, lat] pairs and a closed ring.
    const ring: [number, number][] = vertices.map((v) => [v.longitude, v.latitude]);
    ring.push(ring[0]);

    const featureType: MeasurementFeatureType = 'stockpile';

    create.mutate(
      {
        project_id: projectId,
        name: name.trim() || `Region ${Date.now()}`,
        feature_type: featureType,
        geojson: { type: 'Polygon', coordinates: [ring] },
        properties: {
          material,
          source: 'viewer-draw',
          ...(surveyId ? { survey_id: surveyId } : {}),
          drawn_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast.success('Region saved — volume computing in the background.', {
            description:
              'It will appear filled on the canvas once the processor finishes.',
            action: {
              label: 'Open processing',
              onClick: () => {
                window.open('/processing/active', '_blank');
              },
            },
          });
          closeModal();
          setActiveTool('select');
          revealRailFor('measurement-saved');
        },
        onError: (err) => {
          toast.error('Could not save region', {
            description: err.message,
          });
        },
      },
    );
  };

  // Submit on Cmd/Ctrl+Enter — keyboard-first design from the plan.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="size-4 text-accent" />
          Save drawn region
        </DialogTitle>
        <DialogDescription>
          Becomes a stockpile feature on this project. Volume + tonnage will
          be computed asynchronously by the workflow processor.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3" onKeyDown={onKeyDown}>
        <div className="space-y-1.5">
          <label
            htmlFor="region-name"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Name
          </label>
          <Input
            id="region-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. North coal pile"
            autoFocus
            disabled={create.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="region-material"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Material
          </label>
          <select
            id="region-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            disabled={create.isPending || materialsLoading}
            className={cn(
              'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              'disabled:opacity-50',
            )}
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {materialsLoading && (
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading materials…
            </p>
          )}
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <p>
            <strong className="text-foreground tabular-nums">
              {vertices.length}
            </strong>{' '}
            vertices captured
          </p>
          <p className="mt-0.5">
            ⌘↵ to save · Esc to cancel
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancel}
          disabled={create.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={create.isPending || !projectId || vertices.length < 3}
        >
          {create.isPending ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </>
          ) : (
            'Save region'
          )}
        </Button>
      </DialogFooter>
    </>
  );
};
