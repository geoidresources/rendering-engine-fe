"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Map as MapIcon,
  LayoutDashboard,
  BarChart3,
  Upload,
  FileBarChart,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  Search,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AUTH_TOKEN_KEY, AUTH_SESSION_KEY } from "@/lib/constants";

interface RailItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
  kbd?: string;
}

const PRIMARY_ITEMS: RailItem[] = [
  { id: "home", label: "Overview", href: "/home", icon: LayoutDashboard, kbd: "G H" },
  { id: "sites", label: "Sites & Viewer", href: "/project", icon: MapIcon, matchPrefix: "/project", kbd: "G V" },
  { id: "measurements", label: "Measurements", href: "/measurements", icon: BarChart3, kbd: "G M" },
  { id: "uploads", label: "Uploads", href: "/surveys/upload", icon: Upload, matchPrefix: "/surveys", kbd: "G U" },
  { id: "reports", label: "Reports", href: "/reports", icon: FileBarChart, kbd: "G R" },
  { id: "qa", label: "QA", href: "/qa", icon: CheckSquare, kbd: "G Q" },
];

const SECONDARY_ITEMS: RailItem[] = [
  { id: "access", label: "Team & access", href: "/client-portal", icon: Users, matchPrefix: "/client-portal" },
  { id: "admin", label: "Settings", href: "/admin", icon: Settings },
];

interface LeftRailProps {
  onCommand?: () => void;
}

/**
 * Global icon-only navigation rail (56px). Primary destinations at the
 * top, secondary (access / settings) at the bottom, with tooltips on
 * hover. Sits at the left edge of the (app) shell and is the single
 * source of truth for top-level route switching. Per-page sub-nav
 * belongs in the ContextBar, not here.
 */
export default function LeftRail({ onCommand }: LeftRailProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (item: RailItem) => {
    if (!item.href) return false;
    if (pathname === item.href) return true;
    const prefix = item.matchPrefix ?? item.href;
    return pathname.startsWith(prefix + "/");
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      /* storage disabled */
    }
    router.push("/login");
  };

  return (
    <TooltipProvider delay={120}>
      <aside
        aria-label="Primary"
        className="flex flex-col items-center h-screen w-14 shrink-0 bg-bg-surface border-r border-border-subtle py-3"
      >
        <Link
          href="/home"
          aria-label="GEOID home"
          className="mb-3 flex items-center justify-center w-9 h-9 rounded-sm bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
        >
          <Circle className="size-[18px]" strokeWidth={2.25} />
        </Link>

        {onCommand && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onCommand}
                  aria-label="Open command palette"
                  className="mb-3 text-text-muted hover:text-text-primary"
                >
                  <Search />
                </Button>
              }
            />
            <TooltipContent side="right">
              Search{" "}
              <kbd data-slot="kbd" className="ml-1 font-mono text-[10px] px-1 py-0.5 bg-background/20">
                ⌘K
              </kbd>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="w-6 border-t border-border-subtle mb-2" />

        <nav aria-label="Primary navigation" className="flex flex-col items-center gap-1 flex-1">
          {PRIMARY_ITEMS.map((item) => (
            <RailLink key={item.id} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="w-6 border-t border-border-subtle my-2" />

        <div className="flex flex-col items-center gap-1">
          {SECONDARY_ITEMS.map((item) => (
            <RailLink key={item.id} item={item} active={isActive(item)} />
          ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="text-text-muted hover:text-text-primary"
                >
                  <LogOut />
                </Button>
              }
            />
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function RailLink({ item, active }: { item: RailItem; active: boolean }) {
  const Icon = item.icon;
  const href = item.href ?? "#";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-sm transition-colors",
              active
                ? "text-accent bg-accent/10"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated",
            )}
          >
            {active && (
              <span className="absolute left-[-14px] top-1 bottom-1 w-0.5 bg-accent rounded-r-sm" />
            )}
            <Icon className="size-4" />
          </Link>
        }
      />
      <TooltipContent side="right">
        {item.label}
        {item.kbd && (
          <kbd data-slot="kbd" className="ml-1 font-mono text-[10px] px-1 py-0.5 bg-background/20">
            {item.kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
