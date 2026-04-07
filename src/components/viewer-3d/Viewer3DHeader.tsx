"use client";

import { Search, Bell, Wifi, User } from "lucide-react";

export default function Viewer3DHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
      <div className="flex items-center gap-8 pointer-events-auto">
        <div className="flex flex-col">
          <h1 className="text-white text-lg font-black tracking-widest uppercase">
            GEOID MINE SURVEY
          </h1>
          <nav className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">BREADCRUMBS</span>
            <span className="text-[10px] text-zinc-700">/</span>
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase hover:text-[#F4B400] cursor-pointer transition-colors">SURVEY_A1</span>
            <span className="text-[10px] text-zinc-700">/</span>
            <span className="text-[10px] font-bold text-[#F4B400] tracking-wider uppercase">LEVEL_04</span>
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-6 pointer-events-auto">
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#F4B400] transition-colors" size={14} />
          <input 
            type="text" 
            placeholder="SEARCH TELEMETRY..."
            className="bg-black/40 border border-zinc-800/50 rounded-sm pl-10 pr-4 py-2 text-[10px] font-bold tracking-widest text-zinc-300 w-64 focus:outline-none focus:border-[#F4B400]/50 focus:bg-black/60 transition-all placeholder:text-zinc-600 uppercase"
          />
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-4 text-zinc-400">
          <button className="hover:text-white transition-colors relative">
            <Bell size={18} />
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#F4B400] rounded-full border border-black" />
          </button>
          <button className="hover:text-[#F4B400] transition-colors">
            <Wifi size={18} />
          </button>
          <button className="w-8 h-8 rounded bg-zinc-800/50 border border-zinc-700 flex items-center justify-center hover:border-zinc-500 transition-colors">
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
