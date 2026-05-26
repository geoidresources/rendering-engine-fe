"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LeftRail from "@/components/ui/LeftRail";
import ContextBar from "@/components/ui/ContextBar";
import CommandMenu from "@/components/ui/CommandMenu";
import { clearStoredSession, getStoredSession } from "@/lib/auth";
import { shouldRedirectToMaintenance } from "@/lib/maintenance";

/**
 * Client wrapper for the (app) route group. Owns:
 *   · ⌘K palette state + the global key binding
 *   · the LeftRail ↔ ContextBar ↔ route flex layout
 *
 * Keeping this in a single client component means the outer layout can
 * remain an RSC while still shipping the full Spatial Studio shell
 * (nav + context bar + palette) on every (app) route.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const session = getStoredSession();
    const sessionEmail = session?.user?.email ?? session?.email;

    if (shouldRedirectToMaintenance(sessionEmail)) {
      clearStoredSession();
      router.replace("/maintenance");
    }
  }, [router]);

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <LeftRail onCommand={() => setPaletteOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <ContextBar onCommand={() => setPaletteOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandMenu open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
