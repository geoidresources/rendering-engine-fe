"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  ArrowRightLeft, 
  LayoutDashboard, 
  Download, 
  ChevronRight, 
  AlertCircle, 
  ShieldCheck, 
  Activity,
  Map
} from "lucide-react";
import { ReconMetrics, ReconZone, MOCK_SURVEYS } from "./reconciliation-data";

/**
 * MetricCard: Top status cards for volumes and differences
 */
export const MetricCard = ({ 
  title, 
  value, 
  unit = "M³", 
  footer, 
  statusIcon, 
  color = "yellow" 
}: { 
  title: string; 
  value: string | number; 
  unit?: string; 
  footer: string; 
  statusIcon?: React.ReactNode;
  color?: "yellow" | "cyan" | "pink";
}) => {
  const colorMap = {
    yellow: "border-geoid-yellow/30 bg-geoid-yellow/5",
    cyan: "border-geoid-cyan/30 bg-geoid-cyan/5",
    pink: "border-pink-500/30 bg-pink-500/5",
  };

  const textColorMap = {
    yellow: "text-geoid-yellow",
    cyan: "text-geoid-cyan",
    pink: "text-pink-500",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col p-4 border rounded-sm ${colorMap[color]} relative overflow-hidden h-full min-h-[140px] shadow-lg`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${color === 'yellow' ? 'bg-geoid-yellow' : color === 'cyan' ? 'bg-geoid-cyan' : 'bg-pink-500'}`} />
      
      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
        {title}
      </span>
      
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </h2>
        <span className="text-xs font-bold text-zinc-500">{unit}</span>
      </div>

      <div className="mt-auto flex items-center gap-2">
        {statusIcon || <ShieldCheck size={12} className={textColorMap[color]} />}
        <span className={`text-[10px] font-bold tracking-widest ${textColorMap[color]} uppercase`}>
          {footer}
        </span>
      </div>
    </motion.div>
  );
};

/**
 * ReconciliationTable: Main data grid
 */
export const ReconciliationTable = ({ zones }: { zones: ReconZone[] }) => {
  return (
    <div className="w-full overflow-hidden border border-zinc-800 rounded-sm bg-zinc-900/40 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-geoid-yellow uppercase">
          Zone-By-Zone Reconciliation
        </h3>
        <button className="text-zinc-500 hover:text-white transition-colors">
          <Download size={14} />
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Zone ID</th>
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Sector Name</th>
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Benchmark</th>
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Current</th>
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Delta</th>
              <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase text-right">% Change</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone, idx) => (
              <motion.tr 
                key={zone.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group border-b border-zinc-800/30 hover:bg-white/5 transition-colors"
              >
                <td className="px-6 py-4 text-xs font-mono text-geoid-cyan">{zone.id}</td>
                <td className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wide group-hover:text-white transition-colors">
                  {zone.sectorName}
                </td>
                <td className="px-6 py-4 text-xs font-medium text-zinc-400">{zone.benchmark.toLocaleString()}</td>
                <td className="px-6 py-4 text-xs font-medium text-zinc-300">{zone.current.toLocaleString()}</td>
                <td className={`px-6 py-4 text-xs font-bold ${zone.delta < 0 ? 'text-pink-500' : 'text-emerald-500'}`}>
                  {zone.delta.toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-xs font-bold text-right ${zone.percentageChange < 0 ? 'text-geoid-yellow' : 'text-emerald-500'}`}>
                  {zone.percentageChange.toFixed(2)}%
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * DistributionBars: Progress indicators for volume comparison
 */
export const DistributionBars = () => {
  const layers = [
    { name: "Benchmark Layer", value: 100, color: "bg-indigo-400/50" },
    { name: "Current Layer", value: 89.93, color: "bg-geoid-cyan" },
    { name: "Predicted Yield", value: 92.40, color: "bg-geoid-yellow" },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
        Volume Dist. Comparison
      </h3>
      
      {layers.map((layer) => (
        <div key={layer.name} className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase">
            <span className="text-zinc-500">{layer.name}</span>
            <span className="text-white">{layer.value}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${layer.value}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full ${layer.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * SurveySelector: Top controls for survey selection
 */
export const SurveySelector = () => {
  return (
    <div className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800/80 p-2 pr-4 rounded-sm">
      <div className="flex flex-col px-4 text-left">
        <span className="text-[9px] font-black tracking-widest text-zinc-600 uppercase">Benchmark Survey</span>
        <span className="text-[11px] font-bold text-zinc-300 font-mono">{MOCK_SURVEYS[0].id}</span>
      </div>
      
      <div className="flex items-center justify-center p-2 text-geoid-yellow rounded-full border border-geoid-yellow/20 bg-geoid-yellow/5">
        <ArrowRightLeft size={16} />
      </div>

      <div className="flex flex-col px-4 text-left">
        <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">Current Survey</span>
        <span className="text-[11px] font-bold text-geoid-cyan font-mono">{MOCK_SURVEYS[1].id}</span>
      </div>

      <button className="ml-2 p-3 bg-geoid-yellow rounded-sm text-zinc-900 hover:bg-yellow-400 transition-colors shadow-[0_0_15px_rgba(244,180,0,0.2)]">
        <LayoutDashboard size={18} />
      </button>
    </div>
  );
};

/**
 * VarianceHeatMap: Placeholder for the 3D visual
 */
export const VarianceHeatMap = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
          Variance Heat Map
        </h3>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-geoid-cyan animate-pulse" />
          <span className="text-[9px] font-bold tracking-widest text-geoid-cyan uppercase">Live Scan</span>
        </div>
      </div>
      
      <div className="relative aspect-square w-full rounded-sm border border-zinc-800 bg-zinc-950 overflow-hidden group">
        {/* Placeholder gradient/image effect */}
        <div className="absolute inset-0 bg-neutral-900/50" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--geoid-yellow)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center mix-blend-overlay grayscale contrast-150" />
        
        {/* Mock UI elements on map */}
        <div className="absolute bottom-4 left-4 font-mono text-[8px] text-geoid-cyan tracking-widest uppercase">
          COORDS: 44.201 / -12.448 / Z: 1400
        </div>
        
        <div className="absolute top-4 right-4 flex flex-col gap-1">
          <div className="flex items-center justify-end gap-2 bg-black/40 backdrop-blur-md px-2 py-1 border border-white/5">
             <div className="w-2 h-2 bg-pink-500" />
             <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">High Delta</span>
          </div>
          <div className="flex items-center justify-end gap-2 bg-black/40 backdrop-blur-md px-2 py-1 border border-white/5">
             <div className="w-2 h-2 bg-geoid-cyan" />
             <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Stable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
