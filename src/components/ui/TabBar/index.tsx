"use client";

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
}

export default function TabBar({ tabs, activeIndex, onChange, className = "" }: TabBarProps) {
  return (
    <div className={`flex border-b border-border-subtle ${className}`}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          className={`
            px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors
            bg-transparent border-none cursor-pointer
            ${i === activeIndex
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-text-muted hover:text-text-secondary"
            }
          `}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
