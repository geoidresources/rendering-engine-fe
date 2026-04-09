import { TrendingUp, TrendingDown } from "lucide-react";
import Panel from "@/components/ui/Panel";

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
    <Panel className={className}>
      <div className="flex flex-col gap-2">
        <span className="text-text-secondary text-[10px] uppercase tracking-wider font-medium">
          {title}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-text-primary text-4xl font-mono font-bold leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-text-muted text-base font-mono">{unit}</span>
          )}
          {delta && (
            <span
              className={`flex items-center gap-1 text-xs font-mono ${
                delta.positive ? "text-success" : "text-error"
              }`}
            >
              {delta.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta.value}
            </span>
          )}
        </div>
        {subtitle && (
          <span className="text-text-muted text-[10px] uppercase tracking-wider font-mono">
            {subtitle}
          </span>
        )}
      </div>
    </Panel>
  );
}
