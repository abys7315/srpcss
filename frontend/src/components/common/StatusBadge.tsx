import React from 'react';
import type { OperationalStatus } from '../../api/types';

interface Props {
  status: OperationalStatus | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-ok-t text-ok border-ok';
      case 'NEAR_LIMIT':
        return 'bg-warn-t text-warn border-warn';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-alarm-t text-alarm border-alarm';
      case 'NO_FEASIBLE_SOLUTION':
      case 'NO_IMPROVEMENT_FOUND':
        return 'bg-sunk text-muted border-rule';
      case 'LOW_CONFIDENCE':
      default:
        return 'bg-warn-t text-warn border-warn';
    }
  };

  const getDotStyle = () => {
    switch (status) {
      case 'FEASIBLE':
        return 'bg-ok';
      case 'NEAR_LIMIT':
        return 'bg-warn';
      case 'INFEASIBLE':
      case 'HIGH_RISK':
        return 'bg-alarm';
      default:
        return 'bg-muted';
    }
  };

  const formatStatus = (s: string) => {
    return s
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium border caps ${getStyle()}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getDotStyle()}`} />
      {formatStatus(status)}
    </span>
  );
};
