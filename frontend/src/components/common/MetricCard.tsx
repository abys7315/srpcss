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
    <div className={`glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between relative overflow-hidden ${
      danger ? 'border-rose-500/50 bg-rose-950/20' : warning ? 'border-amber-500/50 bg-amber-950/20' : ''
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {icon && <span className="text-cyan-400">{icon}</span>}
          {title}
        </span>
        <ProvenanceBadge tier={provenance} size="sm" />
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-2 my-1">
        <span className={`text-2xl font-bold font-mono tracking-tight ${
          danger ? 'text-rose-400' : warning ? 'text-amber-400' : 'text-slate-100'
        }`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-400 font-mono font-medium">{unit}</span>}
      </div>

      {/* Footer / Delta */}
      <div className="flex items-center justify-between text-xs mt-1">
        {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        {delta && (
          <span className={`font-mono font-medium ml-auto ${
            deltaPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};
