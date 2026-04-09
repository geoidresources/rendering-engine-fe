import React from "react";

interface PanelProps {
  title?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Panel({
  title,
  headerAction,
  children,
  className = "",
  noPadding = false,
}: PanelProps) {
  return (
    <div className={`bg-bg-surface border border-border-subtle rounded-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
          <h3 className="text-text-secondary text-[10px] uppercase tracking-wider font-medium">
            {title}
          </h3>
          {headerAction && <div className="flex items-center">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
