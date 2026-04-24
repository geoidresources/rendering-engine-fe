'use client';

/**
 * V-STATE-04 — Camera bookmarks panel in the viewer's right rail.
 * Lets users save named camera positions and fly back to them with one click.
 */
import React, { useState } from 'react';
import { Bookmark, BookmarkPlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useViewerBookmarks, useCreateBookmark, useDeleteBookmark } from '@/hooks/useViewerBookmarks';
import { useViewerStore } from '@/store/viewerStore';
import { cn } from '@/lib/utils';

interface BookmarksPanelProps {
  surveyId?: string;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ surveyId }) => {
  const { data: bookmarks = [], isLoading } = useViewerBookmarks(surveyId);
  const createMutation = useCreateBookmark(surveyId);
  const deleteMutation = useDeleteBookmark(surveyId);
  const flyTo = useViewerStore((s) => s.flyTo);
  const cameraState = useViewerStore((s) => s.cameraState);

  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) return;
    if (!cameraState) {
      toast.error('Pan the viewer first to capture a camera position.');
      return;
    }
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        name,
        camera_json: {
          lng: cameraState.longitude,
          lat: cameraState.latitude,
          height: cameraState.height,
          heading: cameraState.heading,
          pitch: cameraState.pitch,
        },
      });
      setNewName('');
      toast.success(`Bookmark "${name}" saved.`);
    } catch {
      toast.error('Failed to save bookmark.');
    } finally {
      setSaving(false);
    }
  };

  const handleFly = (bm: (typeof bookmarks)[number]) => {
    flyTo({
      lng: bm.camera_json.lng,
      lat: bm.camera_json.lat,
      height: bm.camera_json.height,
      label: bm.name,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`Bookmark "${name}" deleted.`);
    } catch {
      toast.error('Failed to delete bookmark.');
    }
  };

  return (
    <div className="px-2 py-2 space-y-2">
      {/* Save current camera */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Bookmark name…"
          aria-label="Bookmark name"
          className="flex-1 min-w-0 rounded-sm border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!newName.trim() || saving}
          title="Save current camera view"
          className="shrink-0 h-6 w-6 grid place-items-center rounded-sm border border-border-subtle text-text-muted hover:text-accent hover:border-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
        </button>
      </div>

      {/* Bookmark list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-text-muted" />
        </div>
      ) : bookmarks.length === 0 ? (
        <p className="text-[11px] text-text-muted text-center py-4">
          No bookmarks yet — navigate to a view and save it above.
        </p>
      ) : (
        <div className="space-y-1">
          {bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="group flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-elevated px-2 py-1.5 hover:border-accent/40 transition-colors"
            >
              <Bookmark className="size-3 text-text-muted shrink-0" />
              <button
                type="button"
                onClick={() => handleFly(bm)}
                className={cn(
                  'flex-1 min-w-0 text-left text-[11px] text-text-primary truncate',
                  'hover:text-accent transition-colors',
                )}
              >
                {bm.name}
              </button>
              <span className="text-[9px] text-text-muted shrink-0 tabular-nums">
                {bm.created_at.slice(0, 10)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(bm.id, bm.name)}
                disabled={deleteMutation.isPending}
                aria-label={`Delete bookmark ${bm.name}`}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity disabled:opacity-30"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
