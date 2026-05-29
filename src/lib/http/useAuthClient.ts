"use client";

import { useRouter } from "next/navigation";
import { clearStoredSession, getStoredToken } from "@/lib/auth";

/**
 * Component-level hook for reading auth state and triggering a logout.
 * Logout clears localStorage, resets all stores, and redirects to /login.
 */
export function useAuthClient() {
  const router = useRouter();
  const token = getStoredToken();
  const isAuthenticated = !!token;

  const logout = async () => {
    clearStoredSession();

    try {
      const [
        { useSiteStore },
        { useUploadStore },
        { useCompareStore },
        { useViewerStore },
        { useEditStore },
        { usePermissionStore },
        { useProjectStore },
      ] = await Promise.all([
        import("@/store/siteStore"),
        import("@/store/uploadStore"),
        import("@/store/compareStore"),
        import("@/store/viewerStore"),
        import("@/store/editStore"),
        import("@/store/permissionStore"),
        import("@/store/projectStore"),
      ]);

      useSiteStore.getState().reset();
      useUploadStore.getState().reset();
      useCompareStore.getState().reset();
      useViewerStore.getState().reset();
      useEditStore.getState().reset();
      usePermissionStore.getState().reset();
      useProjectStore.getState().reset();
    } catch (e) {
      console.error("[useAuthClient] Store reset failed:", e);
    }

    router.push("/login");
  };

  return { token, isAuthenticated, logout };
}
