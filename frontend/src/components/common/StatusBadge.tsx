import React from 'react';
import type { OperationalStatus } from '../../api/types';

interface Props {
  status: OperationalStatus | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-emerald-950/50';
      case 'NEAR_LIMIT':
        return 'bg-amber-950/80 text-amber-400 border-amber-500/50 shadow-amber-950/50';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-rose-950/80 text-rose-400 border-rose-500/50 shadow-rose-950/50 animate-pulse';
      case 'NO_FEASIBLE_SOLUTION':
      case 'NO_IMPROVEMENT_FOUND':
        return 'bg-slate-900 text-slate-300 border-slate-700';
      case 'LOW_CONFIDENCE':
      default:
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-600/40';
    }
  };

  const getDotStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-emerald-400';
      case 'NEAR_LIMIT':
        return 'bg-amber-400';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-rose-400';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border shadow-sm ${getStyle()}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getDotStyle()}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
