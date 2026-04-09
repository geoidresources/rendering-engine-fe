import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { ChevronRight } from "lucide-react";

interface ProjectCardProps {
  name: string;
  sector: string;
  coordinates?: { lat: number; lng: number };
  thumbnailUrl?: string;
  tags?: string[];
  metrics?: { label: string; value: string }[];
  status?: "active" | "standby" | "offline" | "alert";
  href: string;
  className?: string;
}

export default function ProjectCard({
  name,
  sector,
  coordinates,
  thumbnailUrl,
  tags = [],
  metrics = [],
  status,
  href,
  className = "",
}: ProjectCardProps) {
  return (
    <Link
      href={href}
      className={`block bg-bg-surface border border-border-subtle rounded-sm overflow-hidden hover:border-text-muted transition-colors group ${className}`}
    >
      {/* Thumbnail */}
      <div className="relative h-44 bg-bg-elevated overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bg-elevated to-bg-base" />
        )}

        {/* Status badge */}
        {status && (
          <div className="absolute top-3 right-3">
            <StatusBadge variant={status}>
              {status}
            </StatusBadge>
          </div>
        )}

        {/* Coordinates overlay */}
        {coordinates && (
          <div className="absolute bottom-3 right-3 bg-bg-base/80 backdrop-blur-sm border border-border-subtle rounded-sm px-2 py-1">
            <span className="text-primary text-[10px] font-mono">
              COORD: {coordinates.lat.toFixed(2)} | {coordinates.lng.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Sector + Name */}
        <div>
          <p className="text-accent text-[10px] uppercase tracking-wider font-medium">
            {sector}
          </p>
          <h3 className="text-text-primary text-sm font-semibold uppercase tracking-wider mt-1">
            {name}
          </h3>
        </div>

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="flex gap-6">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="text-text-muted text-[10px] uppercase tracking-wider">{m.label}</p>
                <p className="text-text-secondary text-sm font-mono mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tags + Link */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1.5">
            {tags.map((tag) => (
              <StatusBadge key={tag} variant="tag">
                #{tag}
              </StatusBadge>
            ))}
          </div>
          <span className="text-primary text-[10px] uppercase tracking-wider font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            View Details <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
