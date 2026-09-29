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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Field Economics & Sensitivity Engine
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Full-cycle economic ledger, net benefit waterfall, and real-time commodity price sensitivity for{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">API 11E / Marx-Langenheim Accounting</span>
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-500" />
            Market & Operational Cost Sliders
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-700 mb-1 font-medium">
                <span>Crude Oil Price ($/bbl):</span>
                <span className="text-emerald-700 font-semibold">${oilPrice.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="2"
                value={oilPrice}
                onChange={(e) => setOilPrice(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                <span>$40 / bbl</span>
                <span>$120 / bbl</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1 font-medium">
                <span>Steam Generation Cost ($/tonne):</span>
                <span className="text-amber-700 font-semibold">${steamCostPerTonne.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={steamCostPerTonne}
                onChange={(e) => setSteamCostPerTonne(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                <span>$15 / t</span>
                <span>$50 / t</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1 font-medium">
                <span>Electricity Tariff ($/kWh):</span>
                <span className="text-amber-700 font-semibold">${electricityCostPerKwh.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.06"
                max="0.25"
                step="0.01"
                value={electricityCostPerKwh}
                onChange={(e) => setElectricityCostPerKwh(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                <span>$0.06 / kWh</span>
                <span>$0.25 / kWh</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1 font-medium">
                <span>Water Disposal ($/bbl):</span>
                <span className="text-blue-700 font-semibold">${waterDisposalPerBbl.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.25"
                value={waterDisposalPerBbl}
                onChange={(e) => setWaterDisposalPerBbl(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Fixed Cycle Costs</span>
            <div className="flex justify-between text-slate-700 text-xs">
              <span>Well Maintenance & Chemicals:</span>
              <span className="text-slate-900 font-semibold">${fixedWellOpex.toLocaleString()} / cycle</span>
            </div>
          </div>
        </div>

        {/* Economic Ledger & Waterfall Breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Cash Flow Waterfall: Baseline vs. Petro-Twin Optimized
            </h2>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              +${Math.round(optEco.netBenefit - baselineEco.netBenefit).toLocaleString()} Net Lift
            </span>
          </div>

          {/* Side by side comparison table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Ledger Component</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-500">Baseline Run</th>
                  <th className="py-2.5 px-3 font-semibold text-emerald-700">Petro-Twin Optimal</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Gross Oil Revenue</td>
                  <td className="py-2.5 px-3 text-slate-600">${Math.round(baselineEco.grossRevenue).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">${Math.round(optEco.grossRevenue).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                    +${Math.round(optEco.grossRevenue - baselineEco.grossRevenue).toLocaleString()}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-rose-700">(-) Steam Injection Cost</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(baselineEco.steamCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(optEco.steamCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-rose-600">
                    -${Math.round(optEco.steamCost - baselineEco.steamCost).toLocaleString()}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-rose-700">(-) Electrical Lifting Cost</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(baselineEco.powerCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">-${Math.round(optEco.powerCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                    +${Math.round(baselineEco.powerCost - optEco.powerCost).toLocaleString()} (Saved)
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-rose-700">(-) Produced Water Handling</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(baselineEco.waterCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(optEco.waterCost).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    -${Math.round(optEco.waterCost - baselineEco.waterCost).toLocaleString()}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-rose-700">(-) Fixed Well Opex</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(fixedWellOpex).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-rose-600">-${Math.round(fixedWellOpex).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">$0</td>
                </tr>
                <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                  <td className="py-3 px-3 text-slate-900 text-sm">Total Net Economic Benefit</td>
                  <td className="py-3 px-3 text-slate-700 text-sm">${Math.round(baselineEco.netBenefit).toLocaleString()}</td>
                  <td className="py-3 px-3 text-emerald-700 text-sm font-bold">${Math.round(optEco.netBenefit).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-emerald-700 text-sm font-bold">+{netBenefitDeltaPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>
              Baghewala Field Fleet Extrapolation (10 Wells):{' '}
              <strong className="text-emerald-700 font-semibold">+${Math.round((optEco.netBenefit - baselineEco.netBenefit) * 10).toLocaleString()}</strong> / cycle
            </span>
            <button
              onClick={() => onNavigate && onNavigate('benchmarks')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
            >
              View Full Benchmark Verification <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
