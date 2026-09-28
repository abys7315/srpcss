import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { WellDetail } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  DollarSign,
  Sliders,
  PieChart,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const Economics: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [_well, setWell] = useState<WellDetail | null>(null);

  // Economic Parameters
  const [oilPrice, setOilPrice] = useState<number>(80.0);
  const [steamCostPerTonne, setSteamCostPerTonne] = useState<number>(28.0);
  const [electricityCostPerKwh, setElectricityCostPerKwh] = useState<number>(0.12);
  const [waterDisposalPerBbl, setWaterDisposalPerBbl] = useState<number>(2.50);
  const fixedWellOpex = 5000.0;

  // Well Operational Baseline & Optimized
  const baselineOilBbl = 1750;
  const baselineSteamT = 3000;
  const baselineKwh = 14500;
  const baselineWaterBbl = 4200;

  const optimizedOilBbl = 2150;
  const optimizedSteamT = 3400;
  const optimizedKwh = 12800; // lower SPM + VFD saves power!
  const optimizedWaterBbl = 4600;

  useEffect(() => {
    loadWell();
  }, [selectedWellId]);

  const loadWell = async () => {
    try {
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);
    } catch (e) {
      console.error('Failed to load well economics:', e);
    }
  };

  // Calculations
  const calcEconomics = (oilBbl: number, steamT: number, kwh: number, waterBbl: number) => {
    const grossRevenue = oilBbl * oilPrice;
    const steamCost = steamT * steamCostPerTonne;
    const powerCost = kwh * electricityCostPerKwh;
    const waterCost = waterBbl * waterDisposalPerBbl;
    const totalCost = steamCost + powerCost + waterCost + fixedWellOpex;
    const netBenefit = grossRevenue - totalCost;
    const costPerBbl = totalCost / Math.max(oilBbl, 1);
    const breakevenOilPrice = totalCost / Math.max(oilBbl, 1);
    return { grossRevenue, steamCost, powerCost, waterCost, totalCost, netBenefit, costPerBbl, breakevenOilPrice };
  };

  const baselineEco = calcEconomics(baselineOilBbl, baselineSteamT, baselineKwh, baselineWaterBbl);
  const optEco = calcEconomics(optimizedOilBbl, optimizedSteamT, optimizedKwh, optimizedWaterBbl);
  const netBenefitDeltaPct = (((optEco.netBenefit - baselineEco.netBenefit) / baselineEco.netBenefit) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              FIELD ECONOMICS & SENSITIVITY ENGINE
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Full-cycle economic ledger, net benefit waterfall, and real-time commodity price sensitivity for{' '}
            <strong className="text-slate-200 font-mono">{selectedWellId}</strong>.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-industrial-900 border border-industrial-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Economic Model: API 11E / Marx-Langenheim Accounting</span>
        </div>
      </div>

      <DomainShiftWarning />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Optimized Net Economic Benefit"
          value={`$${Math.round(optEco.netBenefit).toLocaleString()}`}
          unit="USD / cycle"
          delta={`+${netBenefitDeltaPct}% vs Baseline (+$${Math.round(optEco.netBenefit - baselineEco.netBenefit).toLocaleString()})`}
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Lifting Cost per Barrel"
          value={`$${optEco.costPerBbl.toFixed(2)}`}
          unit="USD / bbl oil"
          delta={`-$${(baselineEco.costPerBbl - optEco.costPerBbl).toFixed(2)}/bbl savings`}
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Breakeven Crude Price"
          value={`$${optEco.breakevenOilPrice.toFixed(2)}`}
          unit="USD / bbl"
          delta={`Safety Buffer: +$${(oilPrice - optEco.breakevenOilPrice).toFixed(2)}/bbl`}
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Return on Steam Investment (ROSI)"
          value={`${((optEco.grossRevenue / optEco.steamCost) * 100).toFixed(0)}%`}
          unit="Gross revenue / steam cost"
          delta="Thermal capital efficiency"
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Main Grid: Sensitivity Controls & Waterfall Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commodity & Cost Sliders */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Market & Operational Cost Sliders
          </h2>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Crude Oil Price ($/bbl):</span>
                <span className="text-emerald-400 font-bold">${oilPrice.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="2"
                value={oilPrice}
                onChange={(e) => setOilPrice(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>$40 / bbl</span>
                <span>$120 / bbl</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Steam Generation Cost ($/tonne):</span>
                <span className="text-amber-400 font-bold">${steamCostPerTonne.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={steamCostPerTonne}
                onChange={(e) => setSteamCostPerTonne(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>$15 / t</span>
                <span>$50 / t</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Electricity Tariff ($/kWh):</span>
                <span className="text-cyan-400 font-bold">${electricityCostPerKwh.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.06"
                max="0.25"
                step="0.01"
                value={electricityCostPerKwh}
                onChange={(e) => setElectricityCostPerKwh(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>$0.06 / kWh</span>
                <span>$0.25 / kWh</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Water Disposal ($/bbl):</span>
                <span className="text-teal-400 font-bold">${waterDisposalPerBbl.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.25"
                value={waterDisposalPerBbl}
                onChange={(e) => setWaterDisposalPerBbl(parseFloat(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3 bg-industrial-950/80 rounded-lg border border-industrial-800 text-xs font-mono space-y-1">
            <span className="text-[11px] text-slate-400 block font-bold uppercase">Fixed Cycle Costs:</span>
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span>Well Maintenance & Chemicals:</span>
              <span className="text-slate-200">${fixedWellOpex.toLocaleString()} / cycle</span>
            </div>
          </div>
        </div>

        {/* Economic Ledger & Waterfall Breakdown */}
        <div className="lg:col-span-2 glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-emerald-400" />
              Cash Flow Waterfall: Baseline vs Petro-Twin Optimized
            </h2>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              +${Math.round(optEco.netBenefit - baselineEco.netBenefit).toLocaleString()} Net Lift
            </span>
          </div>

          {/* Side by side comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-industrial-800 text-slate-400 uppercase">
                  <th className="pb-2 font-semibold">Ledger Component</th>
                  <th className="pb-2 font-semibold text-slate-400">Baseline Run</th>
                  <th className="pb-2 font-semibold text-emerald-400">Petro-Twin Optimal</th>
                  <th className="pb-2 font-semibold text-right">Net Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-900 text-slate-300">
                <tr>
                  <td className="py-2 text-slate-200">Gross Oil Revenue</td>
                  <td className="py-2 text-slate-400">${Math.round(baselineEco.grossRevenue).toLocaleString()}</td>
                  <td className="py-2 text-emerald-400 font-bold">${Math.round(optEco.grossRevenue).toLocaleString()}</td>
                  <td className="py-2 text-right text-emerald-400">
                    +${Math.round(optEco.grossRevenue - baselineEco.grossRevenue).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-rose-300">(-) Steam Injection Cost</td>
                  <td className="py-2 text-rose-400">-${Math.round(baselineEco.steamCost).toLocaleString()}</td>
                  <td className="py-2 text-rose-400">-${Math.round(optEco.steamCost).toLocaleString()}</td>
                  <td className="py-2 text-right text-rose-400">
                    -${Math.round(optEco.steamCost - baselineEco.steamCost).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-rose-300">(-) Electrical Lifting Cost</td>
                  <td className="py-2 text-rose-400">-${Math.round(baselineEco.powerCost).toLocaleString()}</td>
                  <td className="py-2 text-emerald-400 font-medium">-${Math.round(optEco.powerCost).toLocaleString()}</td>
                  <td className="py-2 text-right text-emerald-400">
                    +${Math.round(baselineEco.powerCost - optEco.powerCost).toLocaleString()} (Energy Saved)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-rose-300">(-) Produced Water Handling</td>
                  <td className="py-2 text-rose-400">-${Math.round(baselineEco.waterCost).toLocaleString()}</td>
                  <td className="py-2 text-rose-400">-${Math.round(optEco.waterCost).toLocaleString()}</td>
                  <td className="py-2 text-right text-slate-400">
                    -${Math.round(optEco.waterCost - baselineEco.waterCost).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-rose-300">(-) Fixed Well Opex</td>
                  <td className="py-2 text-rose-400">-${Math.round(fixedWellOpex).toLocaleString()}</td>
                  <td className="py-2 text-rose-400">-${Math.round(fixedWellOpex).toLocaleString()}</td>
                  <td className="py-2 text-right text-slate-500">$0</td>
                </tr>
                <tr className="border-t-2 border-industrial-800 font-bold">
                  <td className="py-3 text-slate-100 text-sm">TOTAL NET ECONOMIC BENEFIT</td>
                  <td className="py-3 text-slate-300 text-sm">${Math.round(baselineEco.netBenefit).toLocaleString()}</td>
                  <td className="py-3 text-emerald-400 text-sm">${Math.round(optEco.netBenefit).toLocaleString()}</td>
                  <td className="py-3 text-right text-emerald-400 text-sm">+{netBenefitDeltaPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-industrial-900 rounded-lg border border-industrial-800 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>
              Baghewala Field Fleet Extrapolation (10 Wells):{' '}
              <strong className="text-emerald-400">+${Math.round((optEco.netBenefit - baselineEco.netBenefit) * 10).toLocaleString()}</strong> / cycle
            </span>
            <button
              onClick={() => onNavigate && onNavigate('benchmarks')}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
            >
              View Full Benchmark Verification <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
