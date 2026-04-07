"use client";

import { ChevronDown, RefreshCw, Layers } from "lucide-react";

export default function ControlToggles() {
  const buttons = [
    { label: "SELECT PROJECT", icon: <ChevronDown size={14} className="ml-2" /> },
    { label: "RESET VIEW", icon: <RefreshCw size={14} className="ml-2" /> },
    { label: "LAYERS", icon: <Layers size={14} className="ml-2 text-[#F4B400]" /> },
  ];

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-sm border border-zinc-800/10 rounded-sm">
      {buttons.map((btn, idx) => (
        <button 
          key={btn.label}
          className={`
            px-5 py-2.5 flex items-center text-[9px] font-black tracking-[0.2em] uppercase rounded-sm border transition-all duration-200
            ${idx === 0 
              ? "bg-[#0A0D12] border-zinc-800/40 text-blue-400 hover:border-blue-400/50" 
              : "bg-[#0A0D12] border-zinc-800/20 text-zinc-400 hover:bg-[#11161d] hover:text-white"
            }
          `}
        >
          {btn.label}
           {btn.icon}
        </button>
      ))}
    </div>
  );
}
