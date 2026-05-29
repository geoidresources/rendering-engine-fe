"use client";

import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-page fallback shown when a user navigates to a route they lack
 * permission for. Centered layout, minimal chrome, Back button.
 */
export function PermissionDeniedPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-6">
      <ShieldOff className="size-10 text-text-muted/50" strokeWidth={1.5} />
      <div>
        <h2 className="text-text-primary text-base font-semibold mb-1">Access restricted</h2>
        <p className="text-text-muted text-sm">
          You don&apos;t have permission to view this page.
          <br />
          Contact your administrator if you believe this is an error.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => router.back()}>
        Go back
      </Button>
    </div>
  );
}
