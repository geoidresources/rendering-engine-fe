/**
 * V-TASK-01 — "Workspace: <preset> ▼" dropdown mounted in the ContextBar
 * when the user is on a viewer route. Lists the 3 system presets plus
 * the caller's own presets, applies the chosen config to `viewerStore`,
 * and surfaces the Save / Delete actions against the user's rows.
 *
 * System presets (Stockpile Analysis, Cut-Fill, Ortho Review) are read
 * from the user-svc response with `is_system: true`; the menu hides
 * edit/delete controls for them and the backend additionally rejects
 * `PUT`/`DELETE` against their fixed UUIDs with a 403.
 */
'use client';

import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useViewerPresets, useDeleteViewerPreset } from '@/hooks/useViewerPresets';
import { useViewerStore } from '@/store/viewerStore';
import { SavePresetModal } from './SavePresetModal';
import { cn } from '@/lib/utils';

export function WorkspacePresetPicker() {
  const { data: presets = [], isLoading } = useViewerPresets();
  const deletePreset = useDeleteViewerPreset();
  const activePresetId = useViewerStore((s) => s.activePresetId);
  const applyPreset = useViewerStore((s) => s.applyPreset);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const active = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? null,
    [presets, activePresetId],
  );
  const systemPresets = useMemo(() => presets.filter((p) => p.is_system), [presets]);
  const userPresets = useMemo(() => presets.filter((p) => !p.is_system), [presets]);

  const handleApply = (id: string) => {
    const hit = presets.find((p) => p.id === id);
    if (!hit) return;
    applyPreset(id, hit.config);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this workspace preset?')) return;
    deletePreset.mutate(id, {
      onSuccess: () => {
        if (activePresetId === id) useViewerStore.getState().setActivePresetId(null);
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="border-transparent bg-transparent hover:bg-bg-elevated gap-1.5 min-w-[180px] justify-start"
            >
              <Layers className="size-3.5 text-text-muted" />
              <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Workspace
              </span>
              <span className={cn('truncate text-xs', active ? 'text-text-primary' : 'text-text-muted')}>
                {isLoading ? 'Loading…' : (active?.name ?? 'Default')}
              </span>
              <ChevronDown className="ml-auto size-3 text-text-muted" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="bg-card border-border-subtle min-w-[240px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
            System presets
          </DropdownMenuLabel>
          {systemPresets.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-text-muted">
              No system presets available
            </DropdownMenuItem>
          )}
          {systemPresets.map((p) => (
            <DropdownMenuItem
              key={p.id}
              className="text-xs"
              onClick={() => handleApply(p.id)}
            >
              <span className="truncate">{p.name}</span>
              {activePresetId === p.id && (
                <span className="ml-auto text-[9px] uppercase tracking-wider text-text-muted">
                  active
                </span>
              )}
            </DropdownMenuItem>
          ))}

          {userPresets.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-border-subtle" />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
                My presets
              </DropdownMenuLabel>
              {userPresets.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <DropdownMenuItem
                    className="text-xs flex-1"
                    onClick={() => handleApply(p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                    {activePresetId === p.id && (
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-text-muted">
                        active
                      </span>
                    )}
                  </DropdownMenuItem>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    className="mr-1 p-1 rounded-sm text-text-muted hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </>
          )}

          <DropdownMenuSeparator className="bg-border-subtle" />
          <DropdownMenuItem
            className="text-xs"
            onClick={() => setSaveModalOpen(true)}
          >
            <Plus className="size-3" />
            <span>Save current as preset…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SavePresetModal open={saveModalOpen} onOpenChange={setSaveModalOpen} />
    </>
  );
}
