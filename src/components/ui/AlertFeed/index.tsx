import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import Panel from "@/components/ui/Panel";

interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: "warning" | "error" | "info" | "success";
  timestamp: string;
}

interface AlertFeedProps {
  alerts: Alert[];
  maxVisible?: number;
  className?: string;
}

const severityConfig = {
  warning: { icon: AlertTriangle, color: "text-warning", border: "border-l-warning" },
  error: { icon: AlertCircle, color: "text-error", border: "border-l-error" },
  info: { icon: Info, color: "text-primary", border: "border-l-primary" },
  success: { icon: CheckCircle, color: "text-success", border: "border-l-success" },
};

export default function AlertFeed({
  alerts,
  maxVisible,
  className = "",
}: AlertFeedProps) {
  const visible = maxVisible ? alerts.slice(0, maxVisible) : alerts;

  return (
    <Panel title="Active Alerts" className={className} noPadding>
      <div className="flex flex-col">
        {visible.length === 0 ? (
          <div className="px-6 py-8 text-center text-text-muted text-xs">
            No active alerts.
          </div>
        ) : (
          visible.map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-6 py-3 border-b border-border-subtle border-l-2 ${config.border} last:border-b-0`}
              >
                <Icon size={14} className={`shrink-0 mt-0.5 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs font-semibold uppercase tracking-wider">
                    {alert.title}
                  </p>
                  {alert.description && (
                    <p className="text-text-muted text-xs mt-0.5">{alert.description}</p>
                  )}
                </div>
                <span className="text-text-muted text-[10px] font-mono shrink-0">
                  {alert.timestamp}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
