"use client";

import { Plus, Minus, Maximize, Search } from "lucide-react";

export default function Viewer3DBottomBar() {
  const coordinates = [
    { label: "LAT", value: "34.0522° N" },
    { label: "LNG", value: "118.2437° W" },
    { label: "ALT", value: "-1,422.00M" },
  ];

  return (
    <footer className="absolute bottom-0 left-0 right-0 z-50 h-10 flex items-center justify-between px-6 bg-black/60 backdrop-blur-md border-t border-white/5 pointer-events-auto">
      {/* Coordinates */}
      <div className="flex items-center gap-8">
        {coordinates.map((coord) => (
          <div key={coord.label} className="flex items-center gap-2">
            <span className="text-zinc-600 text-[8px] font-black tracking-widest">{coord.label}:</span>
            <span className="text-zinc-300 text-[10px] font-black tracking-widest tabular-nums">{coord.value}</span>
          </div>
        ))}
      </div>

      {/* Global Status & Tools */}
      <div className="flex items-center gap-8 h-full">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F4B400] shadow-[0_0_8px_rgba(244,180,0,0.4)]" />
            <span className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase group-hover:text-zinc-300 transition-colors">ACTIVE SITES: 12</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase group-hover:text-zinc-300 transition-colors">OFFLINE: 04</span>
          </div>
        </div>

        <div className="h-full w-[1px] bg-zinc-800/50" />

        <div className="flex items-center gap-4 text-zinc-500">
          <button className="hover:text-[#F4B400] transition-colors"><Search size={14} /></button>
          <button className="hover:text-[#F4B400] transition-colors"><Plus size={14} /></button>
          <button className="hover:text-[#F4B400] transition-colors"><Minus size={14} /></button>
          <button className="hover:text-[#F4B400] transition-colors ml-2"><Maximize size={14} /></button>
        </div>
      </div>
    </footer>
  );
}
