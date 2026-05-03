"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Ruler,
  GitCompare,
  Globe,
  FileBarChart,
  CheckSquare,
  Shield,
  HeartPulse,
  HelpCircle,
  LogOut,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { AUTH_TOKEN_KEY } from "@/lib/constants";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", href: "/home", icon: LayoutDashboard },
  { id: "upload", label: "Upload", href: "/surveys/upload", icon: Upload },
  { id: "measurements", label: "Measurements", href: "/measurements", icon: Ruler },
  { id: "reconciliation", label: "Reconciliation", href: "/reconciliation", icon: GitCompare },
  { id: "project", label: "Project", href: "/project", icon: Globe, external: true },
  // { id: "reporting", label: "Reporting", href: "/reports", icon: FileBarChart },
  // { id: "qa", label: "QA", href: "/qa", icon: CheckSquare },
  { id: "access", label: "Access", href: "/client-portal", icon: Shield },
];

const FOOTER_LINKS = [
  { id: "health", label: "System Health", icon: HeartPulse },
  { id: "support", label: "Support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    router.push("/login");
  };

  return (
    <aside className="flex flex-col h-screen w-[240px] shrink-0 bg-bg-surface border-r border-border-subtle">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle">
        <h1 className="text-text-primary text-sm font-bold tracking-widest uppercase">
          GEOID
        </h1>
        <p className="text-text-muted text-[10px] uppercase tracking-wider mt-0.5">
          Subterranean Intel
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.external
            ? false
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors
                ${isActive
                  ? "border-l-2 border-text-primary text-text-primary bg-bg-elevated"
                  : "border-l-2 border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }
              `}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border-subtle flex flex-col gap-3">
        <div className="px-3">
          <AppButton variant="primary" size="sm" fullWidth onPress={() => router.push("/surveys/upload")}>
            New Survey
          </AppButton>
        </div>

        <div className="flex flex-col gap-0.5">
          {FOOTER_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer w-full text-left"
              >
                <Icon size={14} className="shrink-0" />
                <span>{link.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer w-full text-left"
          >
            <LogOut size={14} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
