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
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'PUBLIC_EXTERNAL':
        return 'bg-blue-950/80 text-blue-300 border-blue-500/40';
      case 'SIMULATED':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'ASSUMED':
      default:
        return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
    }
  };

  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border uppercase tracking-wider ${pad} ${getBadgeStyle()}`}
      title={`Data Provenance Tier: ${tier}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {tier}
    </span>
  );
};
