"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  ChevronRight, 
  Activity, 
  Database, 
  Cloud, 
  Wifi, 
  Thermometer, 
  Layers
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { 
  MetricCard, 
  ReconciliationTable, 
  DistributionBars, 
  SurveySelector, 
  VarianceHeatMap 
} from "./ReconciliationComponents";
import { MOCK_RECON_DATA } from "./reconciliation-data";

export default function ReconciliationPage() {
  const { metrics, zones } = MOCK_RECON_DATA;

  return (
    <PageShell
      title="Reconciliation Analytics"
      description="Subterranean intel comparison engine for benchmark vs current surveys."
    >
      <div className="flex flex-col gap-8 pb-12">
        {/* Navigation Breadcrumbs & Dynamic Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] text-zinc-600 uppercase">
              <span>Breadcrumbs</span>
              <ChevronRight size={10} />
              <span>Survey_A1</span>
              <ChevronRight size={10} />
              <span className="text-geoid-yellow">Level_04</span>
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Comparison Engine</span>
               <h1 className="text-4xl font-black tracking-tighter text-white uppercase flex items-center gap-1">
                 <span className="bg-geoid-yellow text-zinc-950 px-2 mr-1">Recon</span>
                 <span>ciliation Analytics</span>
               </h1>
            </div>
          </div>

          <SurveySelector />
        </div>

        {/* Global Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Survey A Volume" 
            value={metrics.surveyAVolume} 
            footer={`Confidence: ${metrics.surveyAConfidence}%`}
            color="yellow"
            statusIcon={<Thermometer size={12} className="text-geoid-yellow" />}
          />
          <MetricCard 
            title="Survey B Volume" 
            value={metrics.surveyBVolume} 
            footer={metrics.surveyBStatus}
            color="cyan"
            statusIcon={<Wifi size={12} className="text-geoid-cyan" />}
          />
          <MetricCard 
            title="Net Difference" 
            value={metrics.netDifference} 
            footer="Extraction Delta"
            color="pink"
            statusIcon={<Activity size={12} className="text-pink-500" />}
          />
          <MetricCard 
            title="Variance %" 
            value={`${metrics.variancePercentage}%`} 
            unit=""
            footer={metrics.withinTolerance ? "Within Tolerance" : "Out of Tolerance"}
            color="yellow"
            statusIcon={<Layers size={12} className="text-geoid-yellow" />}
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Detailed Analytics Table */}
          <div className="lg:col-span-8 space-y-6">
            <ReconciliationTable zones={zones} />
            
            {/* Additional details or commentary can go here */}
            <div className="p-4 border border-zinc-800/50 bg-zinc-900/20 rounded-sm">
               <div className="flex gap-4 items-start">
                 <Database size={16} className="text-zinc-600 mt-1" />
                 <div>
                   <h4 className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">Analyst Metadata</h4>
                   <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                     Automatic reconciliation engine active. Volume calculations derived from voxel-based subtraction of point cloud datasets. 
                     Variance threshold set to ±15%. Delta values indicate deviation from baseline structural models.
                   </p>
                 </div>
               </div>
            </div>
          </div>

          {/* Right: Visualization Sidebar */}
          <div className="lg:col-span-4 space-y-8 p-6 border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm rounded-sm">
            <VarianceHeatMap />
            
            <hr className="border-zinc-800/50" />
            
            <DistributionBars />
            
            <hr className="border-zinc-800/50" />
            
            {/* System Monitor Status */}
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-[10px] font-bold tracking-widest uppercase">
                 <div className="flex items-center gap-3 bg-zinc-950/50 px-3 py-2 border border-zinc-800 rounded-sm">
                    <span className="text-zinc-500">Platform Latency</span>
                    <span className="text-geoid-cyan">14ms</span>
                 </div>
                 <div className="flex items-center gap-3 bg-zinc-950/50 px-3 py-2 border border-zinc-800 rounded-sm">
                    <span className="text-zinc-500">Server Region</span>
                    <span className="text-zinc-300">US-CENTRAL-A</span>
                 </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                 <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">System Status</span>
                 <span className="text-[10px] font-bold tracking-widest text-geoid-cyan uppercase flex items-center gap-2">
                   All Nodes Nominal
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
