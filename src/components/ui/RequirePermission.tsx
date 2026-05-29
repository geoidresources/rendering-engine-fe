"use client";

import React from "react";
import { type Permission, usePermission } from "@/store/permissionStore";
import { useActiveProject } from "@/store/projectStore";
import { PermissionDeniedPage } from "@/components/ui/PermissionDeniedPage";

interface RequirePermissionProps {
  permission: Permission;
  /** Custom fallback UI. Defaults to a full-page denied message. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children when the active project grants `permission`.
 * While the project is loading or no project is selected, any item that
 * requires a permission is withheld (deny-by-default).
 * Renders `fallback` (or <PermissionDeniedPage />) when access is denied.
 */
export function RequirePermission({ permission, fallback, children }: RequirePermissionProps) {
  const { project } = useActiveProject();
  const projectId = project?.id ?? null;
  const allowed = usePermission(projectId, permission);

  if (!allowed) {
    return <>{fallback ?? <PermissionDeniedPage />}</>;
  }

  return <>{children}</>;
}
