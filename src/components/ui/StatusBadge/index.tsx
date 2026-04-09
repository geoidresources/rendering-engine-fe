import React from "react";

interface StatusBadgeProps {
  variant: "active" | "offline" | "alert" | "standby" | "tag";
  children: React.ReactNode;
  className?: string;
}

const dotColors: Record<StatusBadgeProps["variant"], string> = {
  active: "bg-primary",
  offline: "bg-error",
  alert: "bg-accent",
  standby: "bg-text-muted",
  tag: "",
};

const badgeStyles: Record<StatusBadgeProps["variant"], string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  offline: "bg-error/10 text-error border-error/20",
  alert: "bg-accent/10 text-accent border-accent/20",
  standby: "bg-bg-elevated text-text-muted border-border-subtle",
  tag: "bg-transparent text-text-muted border-border-subtle",
};

export default function StatusBadge({ variant, children, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-sm border
        text-[10px] uppercase tracking-wider font-mono font-medium
        px-2 py-0.5
        ${badgeStyles[variant]}
        ${className}
      `}
    >
      {variant !== "tag" && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
