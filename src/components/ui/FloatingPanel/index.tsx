"use client";

import React from "react";
import { X, Minus, Maximize2 } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PanelAnchor =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "bottom";

interface FloatingPanelProps {
  title?: string;
  subtitle?: string;
  anchor?: PanelAnchor;
  width?: number | string;
  height?: number | string;
  collapsed?: boolean;
  onCollapse?: (next: boolean) => void;
  onClose?: () => void;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const anchorStyles: Record<PanelAnchor, string> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
  left: "top-4 bottom-4 left-4",
  right: "top-4 bottom-4 right-4",
  bottom: "left-4 right-4 bottom-4",
};

/**
 * Translucent canvas-overlay panel built on shadcn Card. Designed to
 * float above Cesium or a globe view without eating canvas space.
 * Use for layer toggles, measurement output, inspector detail,
 * timelines — anything that belongs *on* the view, not beside it.
 */
export default function FloatingPanel({
  title,
  subtitle,
  anchor = "top-right",
  width,
  height,
  collapsed = false,
  onCollapse,
  onClose,
  toolbar,
  footer,
  className,
  children,
}: FloatingPanelProps) {
  const style: React.CSSProperties = {};
  if (typeof width === "number") style.width = `${width}px`;
  else if (typeof width === "string") style.width = width;
  if (typeof height === "number") style.height = `${height}px`;
  else if (typeof height === "string") style.height = height;

  const showHeader = Boolean(title || toolbar || onCollapse || onClose);

  return (
    <Card
      size="sm"
      style={style}
      className={cn(
        "absolute z-20 rounded-sm gap-0 py-0 ring-0 border border-border-subtle",
        "bg-bg-surface/90 backdrop-blur-md shadow-2xl",
        "supports-[backdrop-filter]:bg-bg-surface/75",
        anchorStyles[anchor],
        className,
      )}
    >
      {showHeader && (
        <CardHeader className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle">
          <div className="flex-1 min-w-0">
            {title && (
              <CardTitle className="text-text-primary text-[11px] font-semibold uppercase tracking-wider truncate">
                {title}
              </CardTitle>
            )}
            {subtitle && (
              <CardDescription className="text-text-muted text-[10px] font-mono truncate">
                {subtitle}
              </CardDescription>
            )}
          </div>
          {(toolbar || onCollapse || onClose) && (
            <CardAction className="row-start-auto col-start-auto self-auto justify-self-auto flex items-center gap-0.5">
              {toolbar}
              {onCollapse && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={collapsed ? "Expand panel" : "Collapse panel"}
                  onClick={() => onCollapse(!collapsed)}
                  className="text-text-muted hover:text-text-primary"
                >
                  {collapsed ? <Maximize2 /> : <Minus />}
                </Button>
              )}
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Close panel"
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X />
                </Button>
              )}
            </CardAction>
          )}
        </CardHeader>
      )}

      {!collapsed && (
        <CardContent className="flex-1 min-h-0 overflow-auto p-0">
          {children}
        </CardContent>
      )}

      {!collapsed && footer && (
        <CardFooter className="px-3 py-2 border-t border-border-subtle bg-bg-base/50 rounded-none">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
