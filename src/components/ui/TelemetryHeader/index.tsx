"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Settings, UserCircle } from "lucide-react";

export default function TelemetryHeader() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <header className="h-16 shrink-0 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-text-muted">/</span>}
              <span
                className={`uppercase tracking-wider font-medium ${
                  isLast ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {segment}
              </span>
            </span>
          );
        })}
      </nav>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-bg-elevated border border-border-subtle rounded-sm pl-9 pr-4 py-1.5 text-[10px] uppercase tracking-wider font-mono text-text-primary placeholder:text-text-muted w-52 outline-none focus:border-border-active transition-colors"
          />
        </div>

        {/* Icons */}
        <button className="text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer relative">
          <Bell size={18} />
        </button>
        <button className="text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer">
          <Settings size={18} />
        </button>
        <button className="text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer">
          <UserCircle size={22} />
        </button>
      </div>
    </header>
  );
}
