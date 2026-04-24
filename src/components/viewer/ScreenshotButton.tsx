/**
 * V-OUTPUT-01 — download the current viewer canvas as a PNG.
 *
 * Lives with the rest of the viewer chrome (CompassWidget / ZoomControls /
 * ScaleBar) rather than the ToolPalette so we don't pollute "tools" with
 * an action. Style mirrors ZoomControls for visual continuity.
 */
'use client';

import React, { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import type { Viewer as CesiumViewer } from 'cesium';
import { toast } from 'sonner';
import { useViewerStore } from '@/store/viewerStore';
import { useSiteStore } from '@/store/siteStore';
import { buildScreenshotFilename, exportViewerAsPng } from '@/lib/export/imageExport';

interface ScreenshotButtonProps {
  viewerRef: React.RefObject<CesiumViewer | null>;
}

export const ScreenshotButton: React.FC<ScreenshotButtonProps> = ({ viewerRef }) => {
  const [busy, setBusy] = useState(false);
  const activeProjectId = useSiteStore((s) => s.activeProjectId);
  const recentSites = useSiteStore((s) => s.recentSites);
  const manifest = useViewerStore((s) => s.manifest);
  const activeSurveyId = useViewerStore((s) => s.activeSurveyId);
  const availableSurveys = useViewerStore((s) => s.availableSurveys);

  const projectName = recentSites.find((s) => s.projectId === activeProjectId)?.name;
  const surveyDate = availableSurveys.find((s) => s.id === activeSurveyId)?.date;

  async function handleClick() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      toast.error('Viewer is not ready yet.');
      return;
    }
    setBusy(true);
    try {
      const slug = projectName ?? manifest?.siteId ?? 'geoid';
      const filename = buildScreenshotFilename(slug, surveyDate);
      const caption = [projectName, surveyDate].filter(Boolean).join(' · ');
      await exportViewerAsPng(viewer, filename, caption ? { caption } : {});
      toast.success('Screenshot saved');
    } catch (err) {
      console.error('Screenshot export failed', err);
      toast.error('Could not save screenshot — check the browser console.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Download PNG of current view"
      aria-label="Download screenshot"
      className="w-8 h-8 grid place-items-center rounded-sm border border-border-subtle bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/75 backdrop-blur-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shadow-2xl disabled:opacity-50 disabled:cursor-wait"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
    </button>
  );
};
