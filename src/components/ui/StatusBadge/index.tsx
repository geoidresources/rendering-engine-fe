import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  variant: "active" | "offline" | "alert" | "standby" | "tag";
  children: React.ReactNode;
  className?: string;
}

const dotColors: Record<StatusBadgeProps["variant"], string> = {
  active: "bg-primary",
  offline: "bg-destructive",
  alert: "bg-accent",
  standby: "bg-muted-foreground",
  tag: "",
};

const variantClass: Record<StatusBadgeProps["variant"], string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  offline: "bg-destructive/10 text-destructive border-destructive/20",
  alert: "bg-accent/10 text-accent border-accent/20",
  standby: "bg-secondary text-muted-foreground border-border",
  tag: "bg-transparent text-muted-foreground border-border",
};

/**
 * HUD status pill. Wraps shadcn Badge with our 5 fixed status types,
 * preserving the leading colored dot for non-tag variants.
 */
export default function StatusBadge({ variant, children, className = "" }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "inline-flex h-auto items-center gap-1.5 rounded-sm border",
        "text-[10px] uppercase tracking-wider font-mono font-medium",
        "px-2 py-0.5",
        variantClass[variant],
        className,
      )}
    >
      {variant !== "tag" && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])} />
      )}
      {children}
    </Badge>
  );
}
