// unwrapList collapses a rendering-engine-be list response into a plain
// `T[]` that consumers can `.map`/`.filter` without shape-guessing.
//
// The backend contract (ADR: "list endpoints return `{data, pagination}`")
// is enforced in `rendering-engine-be/internal/handlers/handlers.go` via the
// `listEnvelope` helper — every list route wraps its rows in
// `{data: [...], pagination: {limit, offset, total}}`. Non-list (object)
// endpoints return raw. However, we tolerate three inputs because:
//
//   1. `ListEnvelope<T>` — the current, canonical shape. `.data` is always
//      defined server-side, but the optional-coalesce below guards against
//      transient proxy rewrites that could strip the array.
//   2. `T[]` — the legacy shape that some hooks still assume. This branch
//      also covers the ad-hoc mapview callers that pre-date the envelope
//      ADR; they can adopt the helper without waiting for their endpoint
//      to be audited.
//   3. `undefined` — the pre-fetch state of a TanStack Query result. Makes
//      the call site safe to use in render without an extra guard.
//
// Returning an empty array on any of {undefined, missing `.data`} is a
// deliberate choice over throwing: the list hooks are read-only and a
// blank grid is a strictly better UX than a render-time TypeError that
// blanks the whole page.

import type { ListEnvelope } from "@/types/api";

export function unwrapList<T>(
  payload: ListEnvelope<T> | T[] | undefined | null,
): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.data ?? [];
}
