import { create } from "zustand";
import { userSvcClient } from "@/lib/http";

export type Permission =
  | "can_upload"
  | "can_approve"
  | "can_create_measurement"
  | "can_run_analysis"
  | "can_export"
  | "can_view_draft"
  | "can_view_published"
  | "can_manage_users"
  | "can_call_api";

interface PermissionsEntry {
  permissions: Record<Permission, boolean>;
  fetchedAt: number;
}

interface PermissionsByProject {
  [projectId: string]: PermissionsEntry;
}

interface PermissionsApiResponse {
  project_id: string;
  permissions: Record<Permission, boolean>;
}

const CACHE_TTL_MS = 60_000;

interface PermissionStore {
  byProject: PermissionsByProject;
  /** Project IDs currently being fetched — prevents duplicate in-flight requests. */
  loading: Set<string>;

  fetchPermissions(projectId: string, force?: boolean): Promise<void>;
  can(projectId: string, perm: Permission): boolean;
  reset(): void;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  byProject: {},
  loading: new Set(),

  async fetchPermissions(projectId, force = false) {
    const state = get();

    // Skip if a fetch is already in flight for this project.
    if (state.loading.has(projectId)) return;

    // Skip if cache is fresh and not forced.
    const cached = state.byProject[projectId];
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;

    // Mark as loading.
    set((s) => {
      const next = new Set(s.loading);
      next.add(projectId);
      return { loading: next };
    });

    try {
      const res = await userSvcClient.get<PermissionsApiResponse>(
        "/user-svc/api/v1/auth/permissions",
        { params: { project_id: projectId } }
      );

      set((s) => ({
        byProject: {
          ...s.byProject,
          [projectId]: {
            permissions: res.data.permissions,
            fetchedAt: Date.now(),
          },
        },
      }));
    } catch (e) {
      console.error("[PermissionStore] Failed to fetch permissions:", e);
    } finally {
      set((s) => {
        const next = new Set(s.loading);
        next.delete(projectId);
        return { loading: next };
      });
    }
  },

  can(projectId, perm) {
    const entry = get().byProject[projectId];
    if (!entry) return false;
    // Deny-by-default if cache is stale — components should call fetchPermissions on mount.
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return false;
    return entry.permissions[perm] ?? false;
  },

  reset() {
    set({ byProject: {}, loading: new Set() });
  },
}));

/**
 * Ergonomic hook for a single permission check.
 * Components call this on mount; `fetchPermissions` is non-blocking so
 * the initial render returns `false` (deny-by-default) until the response lands.
 */
export function usePermission(projectId: string | null, perm: Permission): boolean {
  // Trigger fetch on component mount when projectId is available.
  // We do this synchronously inside the hook so any component that calls
  // usePermission automatically primes the cache.
  if (projectId && typeof window !== "undefined") {
    // Fire-and-forget — non-blocking, deduplicated by the loading set.
    usePermissionStore.getState().fetchPermissions(projectId);
  }
  return usePermissionStore((s) =>
    projectId ? s.can(projectId, perm) : false
  );
}
