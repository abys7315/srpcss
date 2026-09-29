import React from 'react';
import type { ProvenanceTier } from '../../api/types';

interface Props {
  tier?: ProvenanceTier | string;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'bracket';
}

export const ProvenanceBadge: React.FC<Props> = ({ tier = 'SIMULATED', size = 'sm', variant = 'pill' }) => {
  const getLabel = () => {
    switch (tier) {
      case 'REAL':
      case 'FIELD_OBSERVATION':
        return 'FIELD OBSERVATION';
      case 'PUBLIC_EXTERNAL':
      case 'LITERATURE':
        return 'PUBLIC / SPE';
      case 'SIMULATED':
      case 'PHYSICS_SIM':
        return 'PHYSICS SIM';
      case 'SETPOINT':
        return 'SETPOINT';
      case 'ASSUMED':
      default:
        return 'ASSUMED';
    }
  };

  if (variant === 'bracket') {
    const textColor =
      tier === 'REAL' || tier === 'FIELD_OBSERVATION'
        ? 'text-emerald-700'
        : tier === 'PUBLIC_EXTERNAL'
        ? 'text-blue-700'
        : tier === 'SIMULATED' || tier === 'PHYSICS_SIM'
        ? 'text-slate-600'
        : tier === 'SETPOINT'
        ? 'text-indigo-600'
        : 'text-amber-800';

    return (
      <span
        className={`font-mono text-[9px] font-bold tracking-tight uppercase px-1 py-0.2 rounded bg-slate-100/80 border border-slate-200/80 ${textColor}`}
        title={`Data Provenance: ${tier}`}
      >
        [{getLabel()}]
      </span>
    );
  }

  const getBadgeStyle = () => {
    switch (tier) {
      case 'REAL':
      case 'FIELD_OBSERVATION':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PUBLIC_EXTERNAL':
      case 'LITERATURE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SIMULATED':
      case 'PHYSICS_SIM':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SETPOINT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ASSUMED':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
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

