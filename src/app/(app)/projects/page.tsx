"use client";

import PageShell from "@/components/ui/PageShell";
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Plus, 
  ChevronRight, 
  Navigation,
  Globe,
  Wifi,
  Radio
} from "lucide-react";
import { 
  Button, 
  Input, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem 
} from "@heroui/react";

const PROJECTS = [
  {
    id: "01-A",
    name: "NORTHERN RIM EXCAVATION",
    status: "ACTIVE",
    statusColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    image: "https://images.unsplash.com/photo-1541888941259-79d745bc47eb?q=80&w=400",
    area: "12.2",
    depth: "1,402",
    coords: "45.32 | -122.67",
    tags: ["#MAGMA", "#THERMAL"]
  },
  {
    id: "04-F",
    name: "SUB-BASALT TUNNELING",
    status: "STANDBY",
    statusColor: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=400",
    area: "4.8",
    depth: "850",
    coords: "32.11 | -106.54",
    tags: ["#BASALT", "#STRUCTURAL"]
  },
  {
    id: "09-X",
    name: "VOID-MAPPING OPERATION",
    status: "ACTIVE",
    statusColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    image: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=400",
    area: "31.5",
    depth: "2,200",
    coords: "-23.44 | 121.23",
    tags: ["#VOID", "#DEEP-SURVEY"]
  },
  {
    id: "12-B",
    name: "COASTAL SHELF AUDIT",
    status: "ALERT",
    statusColor: "text-red-400 bg-red-400/10 border-red-400/20",
    image: "https://images.unsplash.com/photo-1502481851512-e9e2529bbbf9?q=80&w=400",
    area: "54.0",
    depth: "110",
    coords: "12.01 | -118.52",
    tags: ["#SHELF", "#STABILITY"]
  },
  {
    id: "02-C",
    name: "CARBON CAPTURE CLUSTER",
    status: "ACTIVE",
    statusColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    image: "https://images.unsplash.com/photo-1550684847-75bdda21cc95?q=80&w=400",
    area: "18.9",
    depth: "3,400",
    coords: "64.13 | -21.94",
    tags: ["#ICELAND", "#CARBON"]
  },
  {
    id: "15-Z",
    name: "DEEP-MANTLE CORE CORE",
    status: "ARCHIVED",
    statusColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    image: "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=400",
    area: "112.0",
    depth: "12,262",
    coords: "-77.04 | 166.66",
    tags: ["#KOLA", "#EXTREME"]
  }
];

export default function ProjectsPage() {
  return (
    <PageShell hideDefaultHeader>
      <div className="flex flex-col gap-8 animate-in fade-in duration-700 pb-12">
        
        {/* Project Hub Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-zinc-800 pb-8">
           <div className="flex items-center gap-6">
              <h1 className="text-2xl font-black text-white tracking-[0.2em] uppercase">PROJECT HUB</h1>
              <div className="hidden lg:flex items-center gap-4 py-1.5 px-4 bg-zinc-900/50 border border-zinc-800 rounded-full">
                 <Navigation size={12} className="text-[#F4B400]" />
                 <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">LAT: 34.0522° N | LON: 118.2437° W</span>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#F4B400] transition-colors" />
                <input 
                  type="text" 
                  placeholder="SEARCH ENTITIES..." 
                  className="bg-zinc-900/80 border border-zinc-800 rounded-md py-2.5 pl-10 pr-4 text-[10px] font-bold tracking-widest text-white focus:outline-none focus:border-[#F4B400]/50 w-64 uppercase transition-all"
                />
              </div>
              <div className="flex items-center gap-4 text-zinc-500">
                <Wifi size={18} className="cursor-pointer hover:text-white" />
                <Radio size={18} className="cursor-pointer hover:text-white" />
              </div>
           </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-zinc-800">
              <button className="p-2 bg-zinc-800 text-[#F4B400] rounded-md shadow-sm"><Grid size={18} /></button>
              <button className="p-2 text-zinc-500 hover:text-white"><List size={18} /></button>
              <div className="w-px h-4 bg-zinc-800 mx-2" />
              <button className="flex items-center gap-2 px-4 text-[10px] font-black text-zinc-400 tracking-widest uppercase hover:text-white">
                FILTER: <span className="text-white">ALL SECTORS</span> <Plus size={12} className="rotate-45" />
              </button>
           </div>

           <div className="flex items-center gap-6">
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">TOTAL ENTITIES: 124</span>
              <button className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black tracking-widest px-6 py-2.5 rounded uppercase transition-all active:scale-[0.98]">
                INITIALIZE NEW SITE
              </button>
           </div>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {PROJECTS.map((project) => (
             <div key={project.id} className="bg-[#0E1218] border border-zinc-800 rounded-xl overflow-hidden group hover:border-[#F4B400]/30 transition-all cursor-pointer">
                <div className="p-5 border-b border-zinc-800/50 flex justify-between items-start">
                   <div className="space-y-1">
                      <span className="text-[9px] font-bold text-[#F4B400]/80 tracking-[0.2em] uppercase">SECTOR {project.id}</span>
                      <h3 className="text-sm font-black text-white tracking-widest leading-tight group-hover:text-[#F4B400] transition-colors">{project.name}</h3>
                   </div>
                   <span className={`text-[8px] font-black px-2 py-0.5 rounded border tracking-tighter uppercase ${project.statusColor}`}>
                      {project.status}
                   </span>
                </div>

                <div className="relative aspect-video overflow-hidden">
                   <img 
                    src={project.image} 
                    className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105" 
                    alt={project.name} 
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D12] to-transparent opacity-40" />
                   <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded border border-zinc-800">
                      <span className="text-[8px] font-black text-blue-400 tracking-widest">COORD: {project.coords}</span>
                   </div>
                </div>

                <div className="p-5 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <span className="text-[8px] font-bold text-zinc-500 tracking-widest uppercase block">TOTAL AREA</span>
                         <p className="text-lg font-black text-white tracking-tight">{project.area} <span className="text-[10px] text-zinc-500 ml-0.5">KM²</span></p>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[8px] font-bold text-zinc-500 tracking-widest uppercase block">DEPTH LEVEL</span>
                         <p className="text-lg font-black text-white tracking-tight">{project.depth} <span className="text-[10px] text-zinc-500 ml-0.5">M</span></p>
                      </div>
                   </div>

                   <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                         {project.tags.map(tag => (
                           <span key={tag} className="text-[8px] font-bold text-zinc-600 hover:text-[#F4B400] transition-colors cursor-pointer">{tag}</span>
                         ))}
                      </div>
                      <button className="text-[10px] font-black text-[#F4B400] hover:text-white transition-colors flex items-center gap-1 group/btn">
                        VIEW DETAILS <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>

        {/* Footer Telemetry */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-8 pt-8 border-t border-zinc-800">
           <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                 <Globe size={14} className="text-blue-500" />
                 <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase">SATELLITE UPLINK</span>
                    <span className="text-[10px] font-black text-white tracking-widest uppercase">GEO-STATIONARY: ACTIVE [99.8%]</span>
                 </div>
              </div>
              <div className="flex items-center gap-3 border-l border-zinc-800 pl-8">
                 <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase">PROCESSING LOAD</span>
                    <div className="flex items-center gap-3">
                       <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="w-[64%] h-full bg-[#F4B400]" />
                       </div>
                       <span className="text-[10px] font-black text-white tracking-widest uppercase">64.2 TFLOPS</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="flex flex-col items-end">
              <span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase">SYSTEM TIME</span>
              <span className="text-[10px] font-black text-white tracking-widest uppercase">2024.05.23 | 14:32:09 UTC</span>
           </div>
        </div>

      </div>
    </PageShell>
  );
}
