import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Flame,
  ArrowUpDown,
  Compass,
  Sliders,
  TrendingUp,
  DollarSign,
  RefreshCw,
  BarChart3,
  FileCheck2,
} from 'lucide-react';

export type PageId =
  | 'command-center'
  | 'digital-twin'
  | 'css-optimizer'
  | 'srp-optimizer'
  | 'joint-optimizer'
  | 'what-if'
  | 'predictions'
  | 'economics'
  | 'feedback'
  | 'benchmarks'
  | 'provenance';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
    { id: 'digital-twin', label: 'Digital Twin', icon: Cpu },
    { id: 'joint-optimizer', label: 'Joint Pareto Optimizer', icon: Compass, highlight: true },
    { id: 'css-optimizer', label: 'CSS Thermal Loop', icon: Flame },
    { id: 'srp-optimizer', label: 'SRP Lift Loop', icon: ArrowUpDown },
    { id: 'what-if', label: 'What-If Sandbox', icon: Sliders },
    { id: 'predictions', label: 'AI Forecasts & Dynacards', icon: TrendingUp },
    { id: 'economics', label: 'Field Economics', icon: DollarSign },
    { id: 'feedback', label: 'Closed-Loop Feedback', icon: RefreshCw },
    { id: 'benchmarks', label: 'Benchmarks & Ablation', icon: BarChart3 },
    { id: 'provenance', label: 'Data Provenance', icon: FileCheck2 },
  ];

  return (
    <aside className="w-60 border-r border-industrial-800 bg-industrial-950/80 p-3 flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none">
      <div className="space-y-1">
        <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
          Operations & Digital Twin
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as PageId)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              } ${item.highlight && !isActive ? 'text-cyan-400/90' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* System Status info box */}
      <div className="rounded-lg bg-industrial-900 border border-industrial-800 p-2.5 text-[11px] font-mono text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">API Gateway:</span>
          <span className="text-emerald-400 font-medium">Active (v1)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Constraint Gate:</span>
          <span className="text-cyan-400 font-medium">Strict (M_float ≥ 1.0)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Field:</span>
          <span className="text-slate-300 font-medium">Baghewala OIL</span>
        </div>
      </div>
    </aside>
  );
};
