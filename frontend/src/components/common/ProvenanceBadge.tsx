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

  const textColor =
    tier === 'REAL' || tier === 'FIELD_OBSERVATION'
      ? 'text-ok'
      : tier === 'PUBLIC_EXTERNAL' || tier === 'LITERATURE'
      ? 'text-steam'
      : tier === 'SIMULATED' || tier === 'PHYSICS_SIM'
      ? 'text-muted'
      : tier === 'SETPOINT'
      ? 'text-accent'
      : 'text-warn';

  if (variant === 'bracket') {
    return (
      <span
        className={`font-mono text-[9px] font-medium caps px-1 rounded-sm bg-sunk border border-rule ${textColor}`}
        title={`Data provenance: ${tier}`}
      >
        [{getLabel()}]
      </span>
    );
  }

  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-sm border border-rule bg-sunk caps ${pad} ${textColor}`}
      title={`Data provenance: ${tier}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {getLabel()}
    </span>
  );
};
