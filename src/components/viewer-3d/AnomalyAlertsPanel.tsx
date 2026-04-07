"use client";

import { AlertTriangle, Activity, Thermometer } from "lucide-react";

export default function AnomalyAlertsPanel() {
  const alerts = [
    {
      id: 1,
      type: "SEISMIC SHIFT: ZONE D",
      description: "Recorded 0.23m deviation at 14:00 UTC",
      icon: <Activity size={14} className="text-[#F4B400]" />,
      status: "CRITICAL"
    },
    {
      id: 2,
      type: "TEMP THRESHOLD",
      description: "Stable since previous update",
      icon: <Thermometer size={14} className="text-zinc-500" />,
      status: "NORMAL"
    }
  ];

  return (
    <div className="absolute top-24 right-6 z-40 w-80 bg-[#0A0D12]/60 backdrop-blur-md border border-white/5 rounded-sm p-5 shadow-2xl">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle size={14} className="text-[#F4B400] animate-pulse" />
        <h2 className="text-white text-[10px] font-black tracking-[0.2em] uppercase">
          ANOMALY ALERTS
        </h2>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="relative group cursor-pointer">
            {/* Status indicator bar */}
            <div className={`absolute -left-5 top-0 bottom-0 w-1 ${alert.status === 'CRITICAL' ? 'bg-[#F4B400]' : 'bg-zinc-800'}`} />
            
            <div className="flex gap-4">
              <div className="mt-1 shrink-0 group-hover:scale-110 transition-transform">
                {alert.icon}
              </div>
              <div className="flex flex-col gap-1">
                <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${alert.status === 'CRITICAL' ? 'text-zinc-200 group-hover:text-[#F4B400]' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                  {alert.type}
                </span>
                <p className="text-[9px] font-bold text-zinc-500 tracking-wide uppercase leading-relaxed">
                  {alert.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
