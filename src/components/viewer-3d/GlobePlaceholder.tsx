"use client";

import { motion } from "framer-motion";

export default function GlobePlaceholder() {
  return (
    <div className="absolute inset-0 z-0 bg-[#0A0D12] overflow-hidden flex items-center justify-center">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a1f2e_0%,_#0A0D12_70%)] opacity-40" />

      {/* Main Globe Sphere */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="relative w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, #2a3447 0%, #161b26 40%, #0d1117 100%)",
          boxShadow: "0 0 120px rgba(0, 163, 255, 0.05), inset -20px -20px 80px rgba(0,0,0,0.8)"
        }}
      >
        {/* Glow effect */}
        <div className="absolute inset-x-0 inset-y-0 rounded-full border border-blue-500/10 blur-[2px]" />
        
        {/* Decorative Grid Lines (simulated) */}
        <div className="absolute inset-0 rounded-full opacity-10 overflow-hidden" 
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #00A3FF 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        {/* Markers */}
        <Marker x="30%" y="45%" label="WESTERN RIDGE" id="RW-XQ" active />
        <Marker x="70%" y="65%" label="PHOENIX NORTH" id="ID-72-ZL" />
        
        {/* Atmosphere ring */}
        <div className="absolute -inset-10 rounded-full border border-blue-400/5 blur-sm" />
      </motion.div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />
    </div>
  );
}

function Marker({ x, y, label, id, active = false }: { x: string, y: string, label: string, id: string, active?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1 }}
      className="absolute cursor-pointer group"
      style={{ left: x, top: y }}
    >
      <div className="relative flex items-center gap-4">
        <div className="flex flex-col items-end">
          <div className="px-3 py-1 bg-black/80 backdrop-blur-md border border-white/5 rounded-sm shadow-xl">
             <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black tracking-widest uppercase ${active ? 'text-[#F4B400]' : 'text-zinc-300'}`}>{label}</span>
                <span className="text-zinc-600 text-[8px] font-bold">ID: {id}</span>
             </div>
          </div>
        </div>
        <div className="relative">
           <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-[#F4B400]' : 'bg-zinc-500'} group-hover:scale-125 transition-transform`} />
           {active && <div className="absolute inset-0 rounded-full bg-[#F4B400] animate-ping opacity-40" />}
        </div>
      </div>
    </motion.div>
  );
}
