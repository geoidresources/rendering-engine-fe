import { MAINTENANCE_ALLOWED_EMAIL, MAINTENANCE_MODE_ENABLED } from "./constants";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isMaintenanceModeEnabled(): boolean {
  return MAINTENANCE_MODE_ENABLED;
}

export function isMaintenanceBypassedEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === normalizeEmail(MAINTENANCE_ALLOWED_EMAIL);
}

export function shouldRedirectToMaintenance(email: string | null | undefined): boolean {
  return isMaintenanceModeEnabled() && !isMaintenanceBypassedEmail(email);
}
