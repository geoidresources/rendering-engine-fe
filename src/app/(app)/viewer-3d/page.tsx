"use client";

import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";

export default function Viewer3DPage() {
  return (
    <div className="relative h-full bg-bg-base">
      {/* 3D Viewer placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated to-bg-base flex items-center justify-center">
        <span className="text-text-muted text-sm font-mono uppercase tracking-wider">
          3D Cesium Viewer — Connect to render
        </span>
      </div>

      {/* Coordinate Info Panel — Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <Panel className="w-64">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-[10px] uppercase tracking-wider">Coordinate System</span>
              <span className="text-primary text-[10px] font-mono font-semibold">WGS 84 / UTM 50S</span>
            </div>
            <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Latitude</span>
                <span className="text-text-primary text-xs font-mono font-bold">-29.4022°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Longitude</span>
                <span className="text-text-primary text-xs font-mono font-bold">116.8451°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Altitude</span>
                <span className="text-primary text-xs font-mono font-bold">2,400.00m</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
              <div className="bg-bg-elevated rounded-sm p-2 text-center">
                <p className="text-text-muted text-[10px] uppercase tracking-wider">Satellites</p>
                <p className="text-text-primary text-sm font-mono font-bold">12 Locked</p>
              </div>
              <div className="bg-bg-elevated rounded-sm p-2 text-center">
                <p className="text-text-muted text-[10px] uppercase tracking-wider">HDOP</p>
                <p className="text-success text-sm font-mono font-bold">0.8 (Fine)</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Zoom controls — Bottom Left */}
      <div className="absolute bottom-16 left-4 z-10 flex flex-col gap-1">
        <button className="w-8 h-8 bg-bg-surface border border-border-subtle rounded-sm flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer">+</button>
        <button className="w-8 h-8 bg-bg-surface border border-border-subtle rounded-sm flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer">−</button>
      </div>
    </div>
  );
}
