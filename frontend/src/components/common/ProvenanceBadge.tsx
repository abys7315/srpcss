import React from 'react';
import type { ProvenanceTier } from '../../api/types';

interface Props {
  tier?: ProvenanceTier | string;
  size?: 'sm' | 'md';
}

export const ProvenanceBadge: React.FC<Props> = ({ tier = 'SIMULATED', size = 'sm' }) => {
  const getBadgeStyle = () => {
    switch (tier) {
      case 'REAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PUBLIC_EXTERNAL':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SIMULATED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ASSUMED':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  const getLabel = () => {
    switch (tier) {
      case 'REAL':
        return 'Real Data';
      case 'PUBLIC_EXTERNAL':
        return 'Literature / SPE';
      case 'SIMULATED':
        return 'Physics Sim';
      case 'ASSUMED':
      default:
        return 'Field Assumption';
    }
  };

  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${pad} ${getBadgeStyle()}`}
      title={`Data Provenance: ${tier}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {getLabel()}
    </span>
  );
};
