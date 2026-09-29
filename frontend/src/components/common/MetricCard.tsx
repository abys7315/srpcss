import React from 'react';
import { ProvenanceBadge } from './ProvenanceBadge';
import type { ProvenanceTier } from '../../api/types';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  provenance?: ProvenanceTier;
  warning?: boolean;
  danger?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  delta,
  deltaPositive,
  icon,
  provenance = 'SIMULATED',
  warning,
  danger
}) => {
  return (
    <div className={`bg-white dark:bg-[#0c1322] border rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs transition-all hover:shadow-md hover:border-cyan-500/40 min-w-0 ${
      danger
        ? 'border-rose-200 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/20'
        : warning
        ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/20'
        : 'border-slate-200 dark:border-slate-800/80'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
          {icon && <span className={`shrink-0 ${danger ? 'text-rose-500' : warning ? 'text-amber-500' : 'text-cyan-500 dark:text-cyan-400'}`}>{icon}</span>}
          <span className="truncate">{title}</span>
        </span>
        <div className="shrink-0 scale-90 origin-right">
          <ProvenanceBadge tier={provenance} size="sm" variant="bracket" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-1.5 my-1 min-w-0 overflow-hidden">
        <span className={`text-2xl font-bold tracking-tight font-mono truncate ${
          danger
            ? 'text-rose-600 dark:text-rose-400'
            : warning
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-900 dark:text-white'
        }`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500 dark:text-slate-400 font-normal shrink-0">{unit}</span>}
      </div>

      {/* Footer / Delta */}
      <div className="flex items-center justify-between gap-1.5 text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 min-w-0">
        {subtitle && (
          <span className="text-slate-500 dark:text-slate-400 truncate text-[11px] max-w-[55%]" title={subtitle}>
            {subtitle}
          </span>
        )}
        {delta && (
          <span className={`text-[10px] font-semibold ml-auto shrink-0 px-1.5 py-0.5 rounded border ${
            deltaPositive
              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
              : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50'
          }`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};
