"use client";

export default function SiteDistributionPanel() {
  const data = [
    { label: "ALPHA", value: 45, color: "bg-zinc-800" },
    { label: "BRAVO", value: 85, color: "bg-[#F4B400]", active: true },
    { label: "CHARLIE", value: 30, color: "bg-zinc-800" },
  ];

  const total = 42; // Example from design

  return (
    <div className="absolute top-[380px] right-6 z-40 w-80 bg-[#0A0D12]/60 backdrop-blur-md border border-white/5 rounded-sm p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-[10px] font-black tracking-[0.2em] uppercase">
          SITE DISTRIBUTION
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-600 text-[8px] font-bold uppercase tracking-widest">TOTAL:</span>
          <span className="text-[#F4B400] text-[10px] font-black tracking-widest">{total}</span>
        </div>
      </div>

      <div className="flex items-end justify-between h-24 gap-4 px-2">
        {data.map((item) => (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-3 group cursor-pointer">
            {/* Bar */}
            <div className="w-full relative px-2">
              <div 
                className={`w-full rounded-sm transition-all duration-500 group-hover:brightness-125 ${item.color} shadow-lg`}
                style={{ height: `${item.value}%` }}
              >
                {item.active && (
                   <div className="absolute -top-1 left-0 right-0 h-0.5 bg-[#F4B400] blur-[1px] animate-pulse" />
                )}
              </div>
            </div>
            {/* Label */}
            <span className={`text-[9px] font-bold tracking-widest transition-colors ${item.active ? 'text-[#F4B400]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Decorative background grid */}
      <div className="absolute inset-x-5 top-14 bottom-12 border-y border-zinc-800/20 -z-10 pointer-events-none">
        <div className="h-1/2 border-b border-zinc-800/10" />
      </div>
    </div>
  );
}
