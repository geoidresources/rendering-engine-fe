"use client";

import PageShell from "@/components/ui/PageShell";
import { 
  ArrowUpRight, 
  Map as MapIcon, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Battery,
  Zap,
  Maximize2
} from "lucide-react";
import { motion } from "framer-motion";

const TOP_STATS = [
  { label: "ACTIVE PROJECTS", value: "14", change: "+2", color: "text-[#F4B400]" },
  { label: "SURVEYS PENDING", value: "08", change: null, color: "text-white" },
  { label: "UPTIME RATE", value: "99.8", suffix: "%", color: "text-emerald-400" },
];

const RECENT_PROJECTS = [
  { name: "ZULU_CORE_04", date: "24 SEP 2023", size: "842.1 MB", status: "SYNCED", statusColor: "text-emerald-500" },
  { name: "TANGO_ALPHA", date: "22 SEP 2023", size: "1.2 GB", status: "WAITING", statusColor: "text-amber-500" },
  { name: "PROJECT_NEON", date: "21 SEP 2023", size: "240.5 MB", status: "SYNCED", statusColor: "text-emerald-500" },
];

const ALERTS = [
  { title: "PENDING QA", site: "Site_A1_North_Drift", description: "Surface mismatch detected in segment 04. Survey validation required.", type: "warning" },
  { title: "READY TO APPROVE", site: "Pit_Beta_Volume_Calcs", description: "Drones completed sweep. Comparison to baseline: 0.02% variance.", type: "success" },
];

export default function HomePage() {
  return (
    <PageShell hideDefaultHeader>
      <div className="flex flex-col gap-6 animate-in fade-in duration-700">
        
        {/* Welcome Header & Top Stats */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
              WELCOME, PETER
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 uppercase flex items-center gap-2">
              OPERATIONAL OVERVIEW <span className="text-zinc-700">|</span> <span className="text-[#F4B400]/80">SECTOR 7G ANALYSIS</span>
            </p>
          </div>

          <div className="flex gap-4">
            {TOP_STATS.map((stat) => (
              <div key={stat.label} className="bg-[#111827]/50 border border-zinc-800/50 p-4 min-w-[160px] rounded-lg group hover:border-[#F4B400]/30 transition-all">
                <span className="text-[8px] font-bold tracking-[0.2em] text-zinc-500 block mb-2">{stat.label}</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black tracking-tight ${stat.color}`}>
                    {stat.value}
                    {stat.suffix && <span className="text-sm ml-0.5">{stat.suffix}</span>}
                  </span>
                  {stat.change && (
                    <span className="text-[10px] font-bold text-blue-400">{stat.change}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Section: Telemetry & Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Telemetry Box */}
          <div className="lg:col-span-2 bg-[#0E1218] border border-zinc-800 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 flex gap-2">
               <div className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[8px] font-bold text-zinc-500 tracking-widest uppercase">LIVE FEED</div>
               <div className="px-2 py-1 bg-[#1E3A8A]/30 border border-blue-500/30 rounded text-[8px] font-bold text-blue-400 tracking-widest uppercase">PROCESSED DATA</div>
            </div>
            
            <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#F4B400] uppercase mb-12">VOLUME EXTRACTION TELEMETRY</h3>
            
            {/* Custom SVG Chart Placeholder */}
            <div className="relative h-[240px] w-full mt-auto">
               <svg viewBox="0 0 800 240" className="w-full h-full">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="0" y1="200" x2="800" y2="200" stroke="#1F2937" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="400" y1="0" x2="400" y2="240" stroke="#1F2937" strokeWidth="1" strokeDasharray="4 4" />
                  
                  {/* Wave Area */}
                  <path 
                    d="M 0 180 Q 200 120 400 160 T 800 180 V 240 H 0 Z" 
                    fill="url(#chartGradient)" 
                  />
                  
                  {/* Navigation Line */}
                  <path 
                    d="M 0 180 Q 200 120 400 160 T 800 180" 
                    fill="none" 
                    stroke="#3B82F6" 
                    strokeWidth="3" 
                  />
                  
                  {/* Data Point */}
                  <circle cx="400" cy="160" r="4" fill="#00B5D8" className="animate-pulse shadow-[0_0_10px_#00B5D8]" />
               </svg>
            </div>
          </div>

          {/* Right Stack: Previews */}
          <div className="flex flex-col gap-6">
            <PreviewCard 
              title="2D MAP PREVIEW" 
              image="https://images.unsplash.com/photo-1541888941259-79d745bc47eb?q=80&w=400"
              icon={<MapIcon size={14} />}
            />
            <PreviewCard 
              title="3D TERRAIN MESH" 
              image="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=400"
              icon={<Zap size={14} />}
              status="RENDERING MESH..."
            />
          </div>
        </div>

        {/* Bottom Section: Sites & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
           
           {/* Sites Under Review */}
           <div className="bg-[#0E1218] border border-zinc-800 rounded-xl p-6 relative group overflow-hidden">
             <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#F4B400] uppercase mb-6">SITES UNDER REVIEW</h3>
             <div className="relative aspect-square max-h-[400px] mx-auto rounded-lg overflow-hidden border border-zinc-800">
                <img 
                  src="https://images.unsplash.com/photo-1557683311-eac922347aa1?q=80&w=600" 
                  className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700 hover:scale-105" 
                  alt="Site Map"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D12] to-transparent opacity-40" />
                
                {/* Hotspots */}
                <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-[#F4B400] rounded-full animate-ping" />
                <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-[#F4B400] rounded-full" />
                
                <div className="absolute bottom-1/4 right-1/3 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-red-500 rounded-full" />

                <div className="absolute top-1/2 right-4 translate-y-[-50%] p-4 bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-lg max-w-[180px]">
                   <span className="text-[8px] font-bold tracking-widest text-[#F4B400]/70 uppercase block mb-1">ACTIVE SCAN</span>
                   <p className="text-[10px] font-black text-white tracking-widest">24.512° S, 117.844° E</p>
                </div>
             </div>
           </div>

           {/* Alerts & Projects Stack */}
           <div className="flex flex-col gap-6">
              
              <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#F4B400] uppercase">ACTIVE ALERTS</h3>
                </div>

                <div className="space-y-4">
                  {ALERTS.map((alert) => (
                    <div key={alert.site} className="bg-[#111827] border-l-4 border-l-[#F4B400] border border-zinc-800 p-5 rounded-r-lg group hover:bg-[#161b22] transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[9px] font-black text-blue-400 tracking-widest uppercase block mb-1">{alert.title}</span>
                          <h4 className="text-sm font-black text-white tracking-widest">{alert.site}</h4>
                        </div>
                        <AlertTriangle className="text-[#F4B400]" size={16} />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold leading-relaxed mb-4">{alert.description}</p>
                      <div className="flex justify-end">
                        <button className="text-[9px] font-black text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group/btn">
                          REVIEW LOGS <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Projects & Fleet Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-[#0E1218] border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[9px] font-bold text-zinc-500 tracking-[0.2em] uppercase">RECENT PROJECTS</h3>
                      <button className="text-[8px] font-black text-blue-400 hover:underline uppercase">VIEW ALL</button>
                    </div>
                    <div className="space-y-4">
                      {RECENT_PROJECTS.map((proj) => (
                        <div key={proj.name} className="flex justify-between items-center group">
                          <div>
                             <h4 className="text-[10px] font-black text-white tracking-widest group-hover:text-[#F4B400] transition-colors">{proj.name}</h4>
                             <span className="text-[8px] font-bold text-zinc-500 uppercase">{proj.date}</span>
                          </div>
                          <div className="text-right">
                             <div className={`text-[8px] font-black ${proj.statusColor} tracking-widest`}>{proj.status}</div>
                             <span className="text-[8px] font-bold text-zinc-600 uppercase">{proj.size}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>

                 <div className="bg-[#0E1218] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between overflow-hidden relative">
                    <div className="relative z-10">
                      <h3 className="text-[9px] font-bold text-blue-400 tracking-[0.2em] uppercase flex items-center gap-2 mb-6">
                        <Zap size={14} /> DRONE FLEET STATUS
                      </h3>
                      <div className="space-y-5">
                        <DroneStat label="UNIT D-01 [ACTIVE]" value={92} color="bg-blue-500" />
                        <DroneStat label="UNIT D-02 [CHARGING]" value={14} color="bg-[#F4B400]" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 right-0 opacity-10 translate-x-1/4 translate-y-1/4">
                       <Zap size={120} className="text-blue-500" />
                    </div>
                 </div>
              </div>

           </div>
        </div>

      </div>
    </PageShell>
  );
}

function PreviewCard({ title, image, icon, status }: { title: string; image: string; icon: React.ReactNode, status?: string }) {
  return (
    <div className="bg-[#0E1218] border border-zinc-800 rounded-xl p-5 group cursor-pointer relative overflow-hidden flex-1">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-200 uppercase">{title}</h3>
        <span className="text-zinc-500 group-hover:text-[#F4B400] transition-colors">
          <Maximize2 size={14} />
        </span>
      </div>
      <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800">
        <img 
          src={image} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0 opacity-50 group-hover:opacity-100" 
          alt={title} 
        />
        {status && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
             <span className="text-[9px] font-black text-[#F4B400] tracking-[0.3em] uppercase animate-pulse">{status}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
        {icon}
        <span className="text-[8px] font-black tracking-widest uppercase">NODE ID: 8892-X</span>
      </div>
    </div>
  );
}

function DroneStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[8px] font-black tracking-[0.1em] text-zinc-200">
        <span className="uppercase">{label}</span>
        <span>{value}% BATT</span>
      </div>
      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]`} 
        />
      </div>
    </div>
  );
}
