"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Map as MapIcon,
  BarChart3,
  Upload,
  FileBarChart,
  CheckSquare,
  Users,
  Settings,
  Ruler,
  GitCompare,
  Columns2,
  Layers3,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useProjects } from "@/hooks/useProjects";
import { useSiteStore } from "@/store/siteStore";
import { useCompareStore } from "@/store/compareStore";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global command palette. Cross-entity search across routes, sites,
 * and actions — the single-surface substitute for "how do I get to X?"
 * that Spatial Studio relies on instead of deeply nested menus. Bound
 * to ⌘K at the shell level.
 */
export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const { data: projects = [] } = useProjects();
  const setActiveProject = useSiteStore((s) => s.setActiveProject);
  const setViewMode = useSiteStore((s) => s.setViewMode);
  const toggleCompare = useCompareStore((s) => s.toggle);
  const [page, setPage] = useState<"root" | "site">("root");

  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) setPage("root");
    onOpenChange(next);
  };

  const go = (href: string) => {
    router.push(href);
    handleOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} showCloseButton={false}>
      <Command>
        <CommandInput placeholder="Search sites, actions, and pages..." autoFocus />
        <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {page === "root" && (
          <>
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/home")}>
                <LayoutDashboard />
                Overview
                <CommandShortcut>G H</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/project")}>
                <MapIcon />
                Sites & viewer
                <CommandShortcut>G V</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/measurements")}>
                <Ruler />
                Measurements
                <CommandShortcut>G M</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/surveys/upload")}>
                <Upload />
                New upload
                <CommandShortcut>G U</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/reports")}>
                <FileBarChart />
                Reports
                <CommandShortcut>G R</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/qa")}>
                <CheckSquare />
                QA queue
                <CommandShortcut>G Q</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/reconciliation")}>
                <GitCompare />
                Reconciliation
              </CommandItem>
              <CommandItem onSelect={() => go("/client-portal")}>
                <Users />
                Team & access
              </CommandItem>
              <CommandItem onSelect={() => go("/admin")}>
                <Settings />
                Settings
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Switch site">
              {orderedProjects.length === 0 && (
                <CommandItem disabled>No sites</CommandItem>
              )}
              {orderedProjects.slice(0, 6).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`site ${p.name}`}
                  onSelect={() => {
                    setActiveProject(p.id, p.name);
                    router.push("/project");
                    handleOpenChange(false);
                  }}
                >
                  <MapIcon />
                  {p.name}
                </CommandItem>
              ))}
              {orderedProjects.length > 6 && (
                <CommandItem onSelect={() => setPage("site")}>
                  <MapIcon />
                  Show all sites…
                </CommandItem>
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  toggleCompare();
                  onOpenChange(false);
                }}
              >
                <Columns2 />
                Toggle compare mode
                <CommandShortcut>C</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setViewMode("3d");
                  onOpenChange(false);
                }}
              >
                <Layers3 />
                Switch to 3D view
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setViewMode("map");
                  onOpenChange(false);
                }}
              >
                <MapIcon />
                Switch to map view
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setViewMode("split");
                  onOpenChange(false);
                }}
              >
                <Columns2 />
                Switch to split view
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  router.push("/measurements");
                  onOpenChange(false);
                }}
              >
                <BarChart3 />
                New measurement…
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {page === "site" && (
          <CommandGroup heading="All sites">
            {orderedProjects.map((p) => (
              <CommandItem
                key={p.id}
                value={`site ${p.name}`}
                onSelect={() => {
                  setActiveProject(p.id, p.name);
                  router.push("/project");
                  onOpenChange(false);
                }}
              >
                <MapIcon />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
