/**
 * V-OUTPUT-01 — Cesium viewer → PNG.
 *
 * Forces a synchronous scene render so the framebuffer contains the
 * current frame (Cesium's render loop may otherwise hand us a stale
 * buffer), pulls the canvas as a data URL, and triggers a Blob download.
 *
 * Requires `preserveDrawingBuffer: true` on viewer init — without it,
 * `toDataURL()` returns a transparent frame on most browsers.
 */
import type { Viewer as CesiumViewer } from 'cesium';
import { downloadBlob } from './csvExport';

export interface ScreenshotOverlay {
  /** Bottom-right label composited on the PNG, e.g. "Site Alpha · 2026-04-12". */
  caption?: string;
}

export async function exportViewerAsPng(
  viewer: CesiumViewer,
  filename: string,
  overlay: ScreenshotOverlay = {},
): Promise<void> {
  if (viewer.isDestroyed()) {
    throw new Error('Viewer is destroyed — cannot capture screenshot.');
  }

  // Force a render so the drawing buffer reflects the latest frame.
  viewer.scene.requestRender();
  viewer.scene.render();

  const sceneCanvas = viewer.scene.canvas;
  const { width, height } = sceneCanvas;
  if (width === 0 || height === 0) {
    throw new Error('Viewer canvas has zero size — is the Viewer mounted?');
  }

  // Composite caption onto a fresh canvas so we don't mutate the
  // Cesium canvas itself. Single draw operation for perf.
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D context for screenshot compositing.');

  ctx.drawImage(sceneCanvas, 0, 0);

  if (overlay.caption) {
    drawCaption(ctx, overlay.caption, width, height);
  }

  await new Promise<void>((resolve, reject) => {
    out.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob returned null — browser may not support PNG encoding.'));
        return;
      }
      downloadBlob(blob, filename);
      resolve();
    }, 'image/png');
  });
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, width: number, height: number): void {
  const padding = 12;
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = 28;
  const x = width - boxWidth - 16;
  const y = height - boxHeight - 16;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 15, 0.72)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padding, y + boxHeight / 2);
  ctx.restore();
}

/** Filename helper: `{slug}_{date}_view_{YYYY-MM-DD-HHmm}.png`. */
export function buildScreenshotFilename(projectSlug: string, surveyDate?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = slugify(projectSlug || 'geoid');
  const surveyPart = surveyDate ? `_${surveyDate}` : '';
  return `${slug}${surveyPart}_view_${stamp}.png`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'geoid';
}
