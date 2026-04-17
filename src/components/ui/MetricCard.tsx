import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  delta?: { value: string; positive?: boolean };
  subtitle?: string;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  unit,
  delta,
  subtitle,
  className = "",
}: MetricCardProps) {
  return (
    <Card className={cn("rounded-sm gap-0 py-0 ring-0 border overflow-hidden hover:border-foreground/20 transition-colors", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
            {title}
          </span>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-foreground text-2xl font-mono font-bold leading-none truncate">
              {value}
            </span>
            {unit && (
              <span className="text-muted-foreground/70 text-base font-mono">
                {unit}
              </span>
            )}
            {delta && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-mono",
                  delta.positive ? "text-success" : "text-destructive",
                )}
              >
                {delta.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta.value}
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wider font-mono">
              {subtitle}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
