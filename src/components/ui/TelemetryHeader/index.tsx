"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Settings } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TelemetryHeader() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <header className="h-16 shrink-0 bg-card border-b border-border-subtle flex items-center justify-between px-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          {segments.map((segment, i) => {
            const isLast = i === segments.length - 1;
            return (
              <BreadcrumbItem key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                {isLast ? (
                  <BreadcrumbPage className="text-foreground uppercase tracking-wider font-medium">
                    {segment}
                  </BreadcrumbPage>
                ) : (
                  <span className="uppercase tracking-wider font-medium text-muted-foreground">
                    {segment}
                  </span>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search..."
            className="bg-secondary border-border-subtle rounded-sm pl-9 pr-4 h-8 text-[10px] uppercase tracking-wider font-mono text-foreground placeholder:text-muted-foreground w-52 focus-visible:border-foreground focus-visible:ring-0"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
          <Bell size={16} />
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
          <Settings size={16} />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Avatar className="size-7 border border-border-subtle">
                <AvatarFallback className="bg-secondary text-foreground text-[10px] font-mono uppercase">
                  GE
                </AvatarFallback>
              </Avatar>
            </button>
          } />
          <DropdownMenuContent align="end" className="bg-card border-border-subtle w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Account
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border-subtle" />
            <DropdownMenuItem className="text-xs uppercase tracking-wider">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs uppercase tracking-wider">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border-subtle" />
            <DropdownMenuItem className="text-xs uppercase tracking-wider text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
