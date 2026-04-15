import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card
      className={cn(
        "bg-card border border-border-subtle rounded-sm gap-0 py-0 ring-0 overflow-hidden",
        className,
      )}
    >
      {title && (
        <CardHeader className="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
          <CardTitle className="text-text-secondary text-[10px] uppercase tracking-wider font-medium">
            {title}
          </CardTitle>
          {headerAction && (
            <CardAction className="row-start-auto col-start-auto self-auto justify-self-auto flex items-center">
              {headerAction}
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className={noPadding ? "p-0" : "p-6"}>{children}</CardContent>
    </Card>
  );
}
