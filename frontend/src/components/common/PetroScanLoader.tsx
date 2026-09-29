import React, { useState, useEffect } from 'react';
import { Sparkles, Globe, Cpu, Activity } from 'lucide-react';

interface PetroScanLoaderProps {
  wellId: string;
  provider?: string;
}

export const PetroScanLoader: React.FC<PetroScanLoaderProps> = ({
  wellId,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = [
    {
      title: `Accessing Digital Twin Telemetry (${wellId})`,
      detail: 'Extracting reservoir temperature (57.3°C), viscosity (2,396 cP), and Marx-Langenheim thermal radius...',
      icon: Activity,
      color: 'text-cyan-400',
    },
    {
      title: 'Querying Live Internet & SPE Technical Papers',
      detail: 'Grounding with Oil India Limited Baghewala heavy oil benchmarks, SPE 185340 & CSS cyclic steam records...',
      icon: Globe,
      color: 'text-emerald-400',
    },
    {
      title: 'Solving Multiphysics Rod Kinematics & Wave Dynamics',
      detail: 'Calculating API 11L Gibbs damped wave equations, downstroke annular drag & Goodman fatigue ratio...',
      icon: Cpu,
      color: 'text-blue-400',
    },
    {
      title: 'Synthesizing Visual Graphs, Pie Charts & Recommendations',
      detail: 'Rendering thermal decay curves, fluid cut donut charts, and optimal VFD downstroke setpoints...',
      icon: Sparkles,
      color: 'text-amber-400',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [steps.length]);

  const currentStep = steps[currentStepIndex];
  const IconComponent = currentStep.icon;

  return (
    <div className="py-7 px-4 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300">
      {/* HIGH-TECH PETROLEUM RADAR SCANNER ANIMATION */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Outermost pulsing seismic wave ring */}
        <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-40 duration-1000" />

        {/* Outer rotating HUD ring with dashed ticks */}
        <div className="absolute inset-1 rounded-full border border-dashed border-cyan-400/40 animate-[spin_8s_linear_infinite]" />

        {/* Counter-rotating sensor reticle */}
        <div className="absolute inset-3 rounded-full border border-cyan-500/30 border-t-cyan-400 border-b-blue-500 animate-[spin_4s_linear_infinite_reverse]" />

        {/* Radar beam sweep cone (CSS conic gradient rotation) */}
        <div className="absolute inset-4 rounded-full bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(6,182,212,0.35)_360deg)] animate-[spin_2.5s_linear_infinite]" />

        {/* Inner glow halo */}
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-amber-500/20 blur-sm animate-pulse" />

        {/* Core AI Intelligence Orb */}
        <div className="relative z-10 w-12 h-12 rounded-full bg-slate-950 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.6)]">
          <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
        </div>

        {/* Orbiting particle dots */}
        <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
        <div className="absolute inset-0 animate-[spin_4.5s_linear_infinite_reverse]">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,1)] absolute bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      </div>

      {/* DYNAMIC PROGRESS HEADLINE & DETAIL (NO MS / TIME DISPLAYED) */}
      <div className="space-y-1.5 max-w-md">
        <div className="font-bold text-slate-100 text-sm md:text-base flex items-center justify-center gap-2">
          <IconComponent className={`w-4 h-4 ${currentStep.color} animate-bounce`} />
          <span>{currentStep.title}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-sans min-h-[32px] transition-all duration-300">
          {currentStep.detail}
        </p>
      </div>

      {/* DUAL-PHASE CYBERNETIC PROGRESS BAR */}
      <div className="w-full max-w-xs space-y-1.5 pt-1">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60 relative">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 animate-[pulse_1.5s_ease-in-out_infinite] w-full" />
        </div>

        {/* Phase step indicator pills */}
        <div className="flex justify-between items-center px-1 text-[10px] text-slate-500">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1 transition-colors duration-300 ${
                idx === currentStepIndex
                  ? 'text-cyan-300 font-bold'
                  : idx < currentStepIndex
                  ? 'text-slate-400'
                  : 'text-slate-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  idx === currentStepIndex
                    ? 'bg-cyan-400 animate-ping'
                    : idx < currentStepIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-700'
                }`}
              />
              <span className="hidden sm:inline">P{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
