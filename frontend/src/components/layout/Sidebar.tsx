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
    { id: 'digital-twin', label: 'Digital Twin Model', icon: Cpu },
    { id: 'joint-optimizer', label: 'Joint CSS + SRP Optimizer', icon: Compass, highlight: true },
    { id: 'css-optimizer', label: 'CSS Thermal Loop', icon: Flame },
    { id: 'srp-optimizer', label: 'SRP Lift Loop', icon: ArrowUpDown },
    { id: 'what-if', label: 'What-If Sandbox', icon: Sliders },
    { id: 'predictions', label: 'Forecasts & Dynacards', icon: TrendingUp },
    { id: 'economics', label: 'Field Economics', icon: DollarSign },
    { id: 'feedback', label: 'Closed-Loop Calibration', icon: RefreshCw },
    { id: 'benchmarks', label: 'Benchmarks & Ablation', icon: BarChart3 },
    { id: 'provenance', label: 'Data Provenance & Audit', icon: FileCheck2 },
  ];

  return (
    <aside className="w-60 border-r border-slate-200 bg-white p-3 flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none">
      <div className="space-y-1">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
          Navigation
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
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* System Status info box */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">API Gateway:</span>
          <span className="text-emerald-700 font-semibold">Active</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Safety Margin:</span>
          <span className="text-slate-800 font-semibold">M_float ≥ 1.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Asset / Basin:</span>
          <span className="text-slate-800 font-semibold">Baghewala Field</span>
        </div>
      </div>
    </aside>
  );
};
