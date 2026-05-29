// City-twin tile fetch helpers.
//
// Every byte of tile / vector / mesh content for a city twin flows through
// rendering-engine-be at paths like:
//
//   /api/v1/city-twins/:slug/mesh/tileset.json
//   /api/v1/city-twins/:slug/terrain/layer.json
//   /api/v1/city-twins/:slug/ortho/{z}/{x}/{y}.png
//   /api/v1/city-twins/:slug/points/tileset.json
//   /api/v1/city-twins/:slug/vector
//
// The backend enforces JWT + class=1 + tenant gating on EVERY request — so
// every Cesium HTTP call must:
//   1. Resolve the relative path against NEXT_PUBLIC_API_BASE_URL.
//   2. Attach `Authorization: Bearer <jwt>` from localStorage.
//
// Skipping either of these → 401 → silently dead layer.
//
// These helpers were originally inlined in LiveCityViewer.tsx; lifted to a
// shared module so the per-kind layer hooks (terrain / ortho / points /
// vector) can reuse them without duplicating the JWT-read logic.

import { AUTH_TOKEN_KEY } from "@/lib/constants";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

/**
 * Prepend the rendering-engine-be origin to a proxied path. Returns the URL
 * unchanged if it is already absolute (e.g. in a dev setup where the BE
 * already returns full URLs), or `null` if the input was nullish.
 */
export function absolutizeProxiedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return apiBase + url;
  return url; // already absolute (e.g. dev with explicit host)
}

/**
 * Return the bearer-token header pair for the current user, or an empty
 * object during SSR / when no token is stored. Safe to spread into a
 * Cesium `Resource({ headers })` constructor.
 */
export function bearerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
