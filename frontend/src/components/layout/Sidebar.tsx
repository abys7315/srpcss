import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Flame,
  ArrowUpDown,
  Compass,
  Sliders,
  Activity,
  DollarSign,
  ShieldAlert,
  Layers,
  BarChart3,
  Database,
  MapPin,
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
  | 'risk'
  | 'model-registry'
  | 'benchmarks'
  | 'provenance';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const operationsNav = [
    { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
    { id: 'digital-twin', label: 'Digital Twin', icon: Cpu },
    { id: 'css-optimizer', label: 'CSS Thermal Model', icon: Flame },
    { id: 'srp-optimizer', label: 'SRP Dynamics', icon: ArrowUpDown },
    { id: 'joint-optimizer', label: 'Joint Optimizer', icon: Compass },
    { id: 'what-if', label: 'What-If Simulator', icon: Sliders },
  ];

  const analyticsNav = [
    { id: 'predictions', label: 'Production & Diagnostics', icon: Activity },
    { id: 'economics', label: 'Economics & Sensitivity', icon: DollarSign },
    { id: 'risk', label: 'Risk & Integrity', icon: ShieldAlert },
  ];

  const validationNav = [
    { id: 'model-registry', label: 'Model Registry', icon: Layers },
    { id: 'benchmarks', label: 'Benchmark & Ablation', icon: BarChart3 },
    { id: 'provenance', label: 'Data Provenance', icon: Database },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-900 text-slate-300 p-3 flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none overflow-y-auto">
      <div className="space-y-4">
        {/* Brand Subtitle in Sidebar */}
        <div className="px-3 pt-1 pb-2 border-b border-slate-800">
          <div className="text-[11px] font-bold text-white tracking-wider uppercase">
            PETRO-TWIN
          </div>
          <div className="text-[10px] text-blue-400 font-medium">
            CSS + SRP Digital Twin
          </div>
          <div className="text-[10px] text-slate-400">
            Baghewala Heavy-Oil Field
          </div>
        </div>

        {/* Section 1: OPERATIONS */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            OPERATIONS
          </div>
          <div className="space-y-0.5">
            {operationsNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as PageId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: ANALYTICS */}
        <div className="pt-2 border-t border-slate-800 space-y-1">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            ANALYTICS
          </div>
          <div className="space-y-0.5">
            {analyticsNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as PageId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: VALIDATION */}
        <div className="pt-2 border-t border-slate-800 space-y-1">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            VALIDATION
          </div>
          <div className="space-y-0.5">
            {validationNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as PageId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Field Overview Widget */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Baghewala Field</span>
          </div>
          <div className="text-[10px] text-slate-400 pl-5 leading-tight">
            Barmer Basin, Rajasthan, India
          </div>

          <div className="pt-1.5 space-y-1 text-[11px] border-t border-slate-800/80">
            <div className="flex justify-between text-slate-400">
              <span>Benchmark Wells</span>
              <strong className="text-slate-200">5</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Active Wells</span>
              <strong className="text-emerald-400">5</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Avg. Oil Rate</span>
              <strong className="text-slate-200">42.8 m³/day</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Model State</span>
              <strong className="text-emerald-400">CALIBRATED</strong>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

