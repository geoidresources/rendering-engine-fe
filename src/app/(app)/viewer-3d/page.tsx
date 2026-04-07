"use client";

import Viewer3DHeader from "@/components/viewer-3d/Viewer3DHeader";
import SystemStatusPanel from "@/components/viewer-3d/SystemStatusPanel";
import AnomalyAlertsPanel from "@/components/viewer-3d/AnomalyAlertsPanel";
import SiteDistributionPanel from "@/components/viewer-3d/SiteDistributionPanel";
import Viewer3DBottomBar from "@/components/viewer-3d/Viewer3DBottomBar";
import ControlToggles from "@/components/viewer-3d/ControlToggles";
import GlobePlaceholder from "@/components/viewer-3d/GlobePlaceholder";

export default function ViewerPage() {
  return (
    <main className="relative w-full h-screen bg-[#0A0D12] overflow-hidden">
      {/* 3D Rendering Context / Globe Placeholder */}
      <GlobePlaceholder />

      {/* Persistent UI Overlays */}
      <Viewer3DHeader />
      <ControlToggles />
      
      {/* Left Panels */}
      <SystemStatusPanel />
      
      {/* Right Panels */}
      <div className="flex flex-col gap-6">
        <AnomalyAlertsPanel />
        <SiteDistributionPanel />
      </div>

      {/* Navigation & Status Bottom Bar */}
      <Viewer3DBottomBar />

      {/* Vignette / Overlay effects to focus center */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.8)] z-10" />
    </main>
  );
}
