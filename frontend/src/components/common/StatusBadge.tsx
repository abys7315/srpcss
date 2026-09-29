import React from 'react';
import type { OperationalStatus } from '../../api/types';

interface Props {
  status: OperationalStatus | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'NEAR_LIMIT':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'NO_FEASIBLE_SOLUTION':
      case 'NO_IMPROVEMENT_FOUND':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'LOW_CONFIDENCE':
      default:
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    }
  };

  const getDotStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-emerald-500';
      case 'NEAR_LIMIT':
        return 'bg-amber-500';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  const formatStatus = (s: string) => {
    return s
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs ${getStyle()}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getDotStyle()}`} />
      {formatStatus(status)}
    </span>
  );
};
