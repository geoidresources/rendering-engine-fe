/**
 * Viewer URL-state codec — V-STATE-01.
 *
 * Serialises the subset of viewer state that matters for sharing a link
 * (camera, layer visibility+opacity, terrain mode, active tool, selected
 * feature id, compare config) into a single `?v=<base64url(json)>` URL
 * parameter, alongside the existing `?surveyId=` param.
 *
 * Design notes:
 *  - Versioned payload (`ver: 1`). Future renames should bump `ver` and
 *    branch on decode so we can keep old links working.
 *  - `decode()` is lenient — malformed / future-version payloads return
 *    null; the caller falls back to store defaults. Never throws.
 *  - Encoded size stays well under the 2000-char URL budget for typical
 *    scenes (6 layers × ~20 chars + camera numbers = ~400 bytes pre-b64).
 */
import type { CesiumCameraState, LayerId, LayerState, TerrainMode, ToolMode } from '@/store/viewerStore';
import type { CompareMode } from '@/store/compareStore';

export const VIEWER_URL_PARAM = 'v';
const CODEC_VERSION = 1;

export interface ViewerUrlState {
  cam?: CesiumCameraState;
  tm?: TerrainMode;
  /** Per-layer `[visible, opacity]` tuples keyed by LayerId. Tuples keep
   *  the payload smaller than `{visible,opacity}` objects. */
  layers?: Partial<Record<LayerId, [boolean, number]>>;
  tool?: ToolMode;
  /** Selected feature id (opaque string — could be a measurement id, a
   *  GeoJSON entity id, etc.). Viewer re-selects by matching on id. */
  sel?: string;
  /** Compare config: enabled, epochA, epochB, mode, splitPosition. */
  cmp?: { en: boolean; a: string | null; b: string | null; m: CompareMode; sp: number };
}

interface EncodedPayload extends ViewerUrlState {
  ver: number;
}

/** Encode a state subset into a URL-safe base64 token. Returns null when
 *  the input is effectively empty (no camera / layers / etc.) so callers
 *  can strip the param entirely rather than store `?v=e30`. */
export function encode(state: ViewerUrlState): string | null {
  const hasContent =
    state.cam != null ||
    state.tm != null ||
    state.tool != null ||
    state.sel != null ||
    state.cmp != null ||
    (state.layers && Object.keys(state.layers).length > 0);
  if (!hasContent) return null;

  const payload: EncodedPayload = { ver: CODEC_VERSION, ...state };
  const json = JSON.stringify(payload);
  return toBase64Url(json);
}

/** Decode a base64 token back into a state subset. Returns null on any
 *  error — malformed JSON, wrong version, missing fields. Callers must
 *  treat `null` as "use store defaults". */
export function decode(token: string | null | undefined): ViewerUrlState | null {
  if (!token) return null;
  try {
    const json = fromBase64Url(token);
    const parsed = JSON.parse(json) as Partial<EncodedPayload>;
    if (parsed.ver !== CODEC_VERSION) {
      console.warn(`[viewer-url] dropping payload with ver=${parsed.ver} (expected ${CODEC_VERSION})`);
      return null;
    }
    // Narrow out the `ver` field so callers only see user-facing state.
    const rest = { ...parsed };
    delete rest.ver;
    return rest;
  } catch (err) {
    console.warn('[viewer-url] decode failed — falling back to store defaults', err);
    return null;
  }
}

/** Build an encoded snapshot from live store slices. */
export function captureFromStore(input: {
  camera: CesiumCameraState;
  terrainMode: TerrainMode;
  layers: Record<LayerId, LayerState>;
  activeTool: ToolMode;
  selectedFeatureId?: string | null;
  compare: { enabled: boolean; epochA: string | null; epochB: string | null; mode: CompareMode; splitPosition: number };
}): ViewerUrlState {
  const layers: Partial<Record<LayerId, [boolean, number]>> = {};
  for (const [id, layer] of Object.entries(input.layers) as [LayerId, LayerState][]) {
    // Round opacity to 2 decimals — the slider step is 0.01 and the
    // extra precision just bloats the payload.
    layers[id] = [layer.visible, Math.round(layer.opacity * 100) / 100];
  }
  const state: ViewerUrlState = {
    cam: roundCamera(input.camera),
    tm: input.terrainMode,
    layers,
    tool: input.activeTool,
  };
  if (input.selectedFeatureId) state.sel = input.selectedFeatureId;
  if (input.compare.enabled || input.compare.epochA || input.compare.epochB) {
    state.cmp = {
      en: input.compare.enabled,
      a: input.compare.epochA,
      b: input.compare.epochB,
      m: input.compare.mode,
      sp: Math.round(input.compare.splitPosition * 1000) / 1000,
    };
  }
  return state;
}

// ── base64url helpers ──────────────────────────────────────────────────
// btoa / atob don't handle the `-` / `_` alphabet by default. We only
// call these in the browser (the URL-sync hook is client-only), so
// `btoa` is always defined.

function toBase64Url(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function roundCamera(c: CesiumCameraState): CesiumCameraState {
  // Degrees to 6dp (~0.1 m), height to 1dp, angles to 4dp (~radians).
  const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    longitude: r(c.longitude, 6),
    latitude: r(c.latitude, 6),
    height: r(c.height, 1),
    heading: r(c.heading, 4),
    pitch: r(c.pitch, 4),
    roll: r(c.roll, 4),
  };
}
