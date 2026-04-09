export default function StatusBar() {
  return (
    <footer className="h-8 shrink-0 bg-bg-surface border-t border-border-subtle flex items-center justify-between px-6 text-[10px] font-mono uppercase tracking-wider">
      {/* Coordinates */}
      <div className="flex items-center gap-6">
        <span>
          <span className="text-text-muted">LAT: </span>
          <span className="text-text-secondary">-29.4022°</span>
        </span>
        <span>
          <span className="text-text-muted">LNG: </span>
          <span className="text-text-secondary">116.8451°</span>
        </span>
        <span>
          <span className="text-text-muted">ALT: </span>
          <span className="text-text-secondary">2,400m</span>
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-text-muted">Active Sites: 12</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-success">System Stable</span>
        </span>
      </div>
    </footer>
  );
}
