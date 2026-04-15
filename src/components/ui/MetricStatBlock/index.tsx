import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricStatBlockProps {
  title: string;
  value: string | number;
  unit?: string;
  delta?: { value: string; positive?: boolean };
  subtitle?: string;
  className?: string;
}

export default function MetricStatBlock({
  title,
  value,
  unit,
  delta,
  subtitle,
  className = "",
}: MetricStatBlockProps) {
  return (
    <Card
      className={cn(
        "bg-card border border-border-subtle rounded-sm gap-0 py-0 ring-0 overflow-hidden",
        "hover:border-foreground/20 transition-colors",
        className,
      )}
    >
      <CardContent className="p-6">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-4xl font-mono font-bold leading-none">
              {value}
            </span>
            {unit && (
              <span className="text-muted-foreground/70 text-base font-mono">{unit}</span>
            )}
            {delta && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-mono",
                  delta.positive ? "text-[var(--color-success)]" : "text-destructive",
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
