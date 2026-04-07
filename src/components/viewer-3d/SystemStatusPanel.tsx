"use client";

export default function SystemStatusPanel() {
  const stats = [
    { label: "CORE LOAD", value: "22.4%", color: "text-zinc-400" },
    { label: "SAT UPLINK", value: "Active", color: "text-emerald-500" },
    { label: "DATA STREAM", value: "9.2 Gbps", color: "text-cyan-400" },
  ];

  return (
    <div className="absolute top-24 left-6 z-40 w-64 bg-[#0A0D12]/60 backdrop-blur-md border border-white/5 rounded-sm p-5 shadow-2xl">
      <h2 className="text-[#F4B400] text-[10px] font-black tracking-[0.2em] uppercase mb-4 opacity-80">
        SYSTEM STATUS
      </h2>
      
      <div className="space-y-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1.5 group cursor-default">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase group-hover:text-zinc-400 transition-colors">
                {stat.label}
              </span>
              <span className={`text-[10px] font-black tracking-widest ${stat.color} transition-all`}>
                {stat.value}
              </span>
            </div>
            {/* Progress bar or visual indicator */}
            <div className="h-[2px] w-full bg-zinc-800/50 rounded-full overflow-hidden">
               <div 
                 className={`h-full bg-current ${stat.color} opacity-30 group-hover:opacity-60 transition-opacity`} 
                 style={{ width: stat.label === 'CORE LOAD' ? '22.4%' : '100%' }}
               />
            </div>
          </div>
        ))}
      </div>

      {/* Decorative pulse */}
      <div className="mt-6 pt-4 border-t border-zinc-800/30 flex items-center gap-3">
        <div className="relative">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute opacity-40" />
          <div className="w-2 h-2 bg-emerald-500 rounded-full relative" />
        </div>
        <span className="text-[8px] font-bold text-zinc-500 tracking-widest uppercase">STABLE_GRID_04</span>
      </div>
    </div>
  );
}
