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
    <div className={`bg-white border rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all hover:shadow-sm ${
      danger ? 'border-rose-200 bg-rose-50/30' : warning ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
          {icon && <span className={danger ? 'text-rose-600' : warning ? 'text-amber-600' : 'text-blue-600'}>{icon}</span>}
          {title}
        </span>
        <ProvenanceBadge tier={provenance} size="sm" />
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-2 my-1">
        <span className={`text-2xl font-semibold tracking-tight ${
          danger ? 'text-rose-600' : warning ? 'text-amber-700' : 'text-slate-900'
        }`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500 font-normal">{unit}</span>}
      </div>

      {/* Footer / Delta */}
      <div className="flex items-center justify-between text-xs mt-1.5 pt-1.5 border-t border-slate-100">
        {subtitle && <span className="text-slate-500 truncate text-[11px]">{subtitle}</span>}
        {delta && (
          <span className={`text-xs font-medium ml-auto ${
            deltaPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};
