import React from 'react';
import { useViewerStore } from '../store/viewerStore';
import { 
  Info, 
  Loader2, 
  Ruler, 
  Square, 
  MapPinned, 
  ChevronRight, 
  Download, 
  FileText,
  Activity,
  Maximize2
} from 'lucide-react';

function formatDistance(distanceMeters?: number): string {
  if (!distanceMeters || distanceMeters <= 0) return '0.0 M';
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(2)} KM`
    : `${distanceMeters.toFixed(1)} M`;
}

function formatArea(areaSquareMeters?: number): string {
  if (!areaSquareMeters || areaSquareMeters <= 0) return '0.0 M²';
  return areaSquareMeters >= 10000
    ? `${(areaSquareMeters / 10000).toFixed(2)} HA`
    : `${areaSquareMeters.toFixed(1)} M²`;
}

export const InspectorPanel: React.FC = () => {
  const {
    selectedFeature,
    setSelectedFeature,
    selectedAreaDetails,
    setSelectedAreaDetails,
    areaDetailsLoading,
    activeTool,
    measurement,
  } = useViewerStore();

  const clearSelection = () => {
    setSelectedFeature(null);
    setSelectedAreaDetails(null);
  };

  return (
    <div className="absolute top-[80px] right-6 w-80 max-h-[calc(100vh-120px)] bg-[#0A0D12]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col z-40 animate-in slide-in-from-right-4 duration-500">
      
      {/* Header */}
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex flex-col gap-1">
           <h3 className="text-[11px] font-black text-[#F4B400] tracking-[0.25em] uppercase">ZONE ANALYTICS</h3>
           <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-500 tracking-widest uppercase">
              <span>PROJECT: ZULU-CORE-04</span>
           </div>
        </div>
        <Maximize2 size={14} className="text-zinc-500 hover:text-white cursor-pointer transition-colors" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
           <StatBox 
            label="ESTIMATED AREA" 
            value={selectedAreaDetails ? formatArea(selectedAreaDetails.areaSquareMeters) : formatArea(measurement.areaSquareMeters)} 
            icon={<Square size={12} />} 
           />
           <StatBox 
            label="ACCUMULATED VOLUME" 
            value="14,204.5 M³" 
            icon={<Activity size={12} />} 
            color="text-cyan-400"
           />
           <StatBox 
            label="SURFACE VARIANCE" 
            value="0.024%" 
            icon={<Activity size={12} />} 
           />
           <StatBox 
            label="LAST SURVEYED" 
            value={selectedAreaDetails?.lastSurveyedAt || "24 SEP 2023"} 
            icon={<FileText size={12} />} 
           />
        </div>

        {/* Secondary Details */}
        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
           <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase text-left">TELEMETRY OVERRIDE</span>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">ENABLED</span>
           </div>
           <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase text-left">COORD_PRECISION</span>
              <span className="text-[9px] font-black text-white uppercase tracking-widest">+ / - 0.002M</span>
           </div>
        </div>

        {/* Dynamic Measurement Content */}
        {(activeTool === 'distance' || activeTool === 'area') && (
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-[#F4B400]">
                 {activeTool === 'distance' ? <Ruler size={14} /> : <Square size={14} />}
                 <span className="text-[9px] font-black tracking-widest uppercase">{activeTool.toUpperCase()} TOOL ACTIVE</span>
              </div>
              <p className="text-[9px] text-zinc-500 font-bold leading-relaxed uppercase">
                 {activeTool === 'distance' 
                  ? "CLICK START AND END POINTS TO CALCULATE 3D LINEAR DISTANCE." 
                  : "PLOT POLYGON VERTICES. RIGHT CLICK OR DOUBLE CLICK TO CLOSE PATH."}
              </p>
           </div>
        )}

        {/* Feature Inspection */}
        {selectedFeature && (
           <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg space-y-4">
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                    <span className="text-[8px] font-black text-[#F4B400] uppercase tracking-widest">SELECTED ENTITY</span>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                       {String(selectedFeature.name || selectedFeature.id || 'N/A')}
                    </h4>
                 </div>
                 <button onClick={clearSelection}><X_Icon /></button>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto custom-scrollbar pr-2 font-mono text-[9px] text-zinc-400">
                 {Object.entries(selectedFeature).map(([k, v]) => (
                    !k.startsWith('_') && (
                      <div key={k} className="flex justify-between border-b border-zinc-800/30 pb-1">
                        <span className="uppercase text-zinc-600">{k}</span>
                        <span className="text-white text-right">{String(v)}</span>
                      </div>
                    )
                 ))}
              </div>
           </div>
        )}

        {/* Global CTAs */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/50">
           <button className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#F4B400] rounded-lg text-[10px] font-black text-black tracking-[0.15em] uppercase hover:bg-[#FFC107] transition-all active:scale-[0.98]">
              <Download size={14} /> EXPORT POINT CLOUD (.LAS)
           </button>
           <button className="w-full flex items-center justify-center gap-3 py-3.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black text-zinc-400 tracking-[0.15em] uppercase hover:text-white hover:border-zinc-700 transition-all">
              <FileText size={14} /> INITIALIZE FULL REPORT
           </button>
        </div>

      </div>

      {/* Footer System Status */}
      <div className="p-4 bg-zinc-900/20 border-t border-zinc-800 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <Loader2 size={12} className="text-[#F4B400] animate-spin" />
            <span className="text-[8px] font-bold text-zinc-500 tracking-widest uppercase">KERNEL SYNCED</span>
         </div>
         <span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase tabular-nums">LATENCY: 14MS</span>
      </div>
    </div>
  );
};

function StatBox({ label, value, icon, color = "text-white" }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3 space-y-2 hover:border-zinc-700 transition-colors">
       <div className="flex items-center gap-2 text-zinc-500">
          {icon}
          <span className="text-[8px] font-bold tracking-widest uppercase">{label}</span>
       </div>
       <div className={`text-[11px] font-black tracking-wider uppercase ${color}`}>{value}</div>
    </div>
  );
}

function X_Icon() {
  return (
    <div className="p-1 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer text-zinc-500 hover:text-white">
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
       </svg>
    </div>
  );
}
