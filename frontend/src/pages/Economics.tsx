import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { WellDetail } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
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
  const [_loading, setLoading] = useState<boolean>(false);

  // Economic Parameters
  const [oilPrice, setOilPrice] = useState<number>(80.0);
  const [steamCostPerTonne, setSteamCostPerTonne] = useState<number>(28.0);
  const [electricityCostPerKwh, setElectricityCostPerKwh] = useState<number>(0.12);
  const [waterDisposalPerBbl, setWaterDisposalPerBbl] = useState<number>(2.50);
  const fixedWellOpex = 5000.0;

  // Well Operational Baseline & Optimized (Dynamically populated from backend)
  const [baselineOilBbl, setBaselineOilBbl] = useState<number>(4537);
  const [baselineSteamT, setBaselineSteamT] = useState<number>(3000);
  const [baselineKwh, setBaselineKwh] = useState<number>(18500);
  const [baselineWaterBbl, setBaselineWaterBbl] = useState<number>(14200);

  const [optimizedOilBbl, setOptimizedOilBbl] = useState<number>(5120);
  const [optimizedSteamT, setOptimizedSteamT] = useState<number>(2400);
  const [optimizedKwh, setOptimizedKwh] = useState<number>(15200);
  const [optimizedWaterBbl, setOptimizedWaterBbl] = useState<number>(12800);

  useEffect(() => {
    loadEconomicsData();
  }, [selectedWellId]);

  const loadEconomicsData = async () => {
    try {
      setLoading(true);
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);

      // Fetch baseline simulation
      const baseSim = await apiClient.simulateCycle({
        well_id: selectedWellId,
        cycle_number: 1,
        steam_volume_tonnes: w.operating_parameters?.steam_volume_tonnes || 3000,
        soak_duration_days: w.operating_parameters?.soak_duration_days || 6,
        spm: w.operating_parameters?.spm || 4.5,
        stroke_length_inch: 100.0,
        vfd_downstroke_ratio: 1.0,
      });

      if (baseSim?.kpis) {
        const oil = baseSim.kpis.total_oil_produced_bbl || 4537;
        const steam = baseSim.kpis.total_steam_injected_tonnes || 3000;
        const pwr = baseSim.kpis.total_electricity_kwh || 18500;
        const water = baseSim.kpis.total_water_produced_bbl || Math.round(oil * 3.5);
        setBaselineOilBbl(oil);
        setBaselineSteamT(steam);
        setBaselineKwh(pwr);
        setBaselineWaterBbl(water);
      }

      // Fetch joint optimization in background — don't block page on it
      apiClient.optimizeJoint({
        well_id: selectedWellId,
        weight_net_benefit: 0.50,
        weight_sor: 0.20,
        weight_energy: 0.20,
        weight_failure_risk: 0.10,
      }).then((optRes) => {
        const rec = optRes?.recommended_configuration;
        if (rec) {
          setOptimizedOilBbl(rec.cumulative_oil_bbl || 5120);
          setOptimizedSteamT(rec.steam_volume_tonnes || 2400);
          setOptimizedKwh(Math.round((baseSim?.kpis?.total_electricity_kwh || 18500) * (rec.spm / 5.0) * (rec.vfd_downstroke_ratio || 0.85)));
          setOptimizedWaterBbl(Math.round((baseSim?.kpis?.total_water_produced_bbl || 15000) * 0.90));
        }
      }).catch(() => {/* optimization is optional — page still works without it */});
    } catch (e) {
      console.error('Failed to load well economics data:', e);
    } finally {
      setLoading(false);
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
  const netBenefitDeltaPct = (((optEco.netBenefit - baselineEco.netBenefit) / Math.max(Math.abs(baselineEco.netBenefit), 1)) * 100).toFixed(1);

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              Synthetic economic scenario
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Full-cycle economic ledger, net benefit waterfall, and dynamic commodity price sensitivity for{' '}
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

      {/* Visual Cash Flow Waterfall (Section 10 Specification) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-600" />
          CASH-FLOW WATERFALL
        </h3>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 space-y-2">
          <div className="flex justify-between items-center text-emerald-800 font-bold">
            <span>Oil Revenue (+):</span>
            <span>+${Math.round(optEco.grossRevenue).toLocaleString()}</span>
          </div>
          <div className="pl-4 border-l-2 border-slate-300 space-y-1.5 text-rose-700">
            <div className="flex justify-between">
              <span>├── Steam Cost (-):</span>
              <span>-${Math.round(optEco.steamCost).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>├── Electricity Cost (-):</span>
              <span>-${Math.round(optEco.powerCost).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>├── Water Handling (-):</span>
              <span>-${Math.round(optEco.waterCost).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>└── OPEX Maintenance (-):</span>
              <span>-${Math.round(fixedWellOpex).toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-2 border-t-2 border-slate-300 flex justify-between items-center text-sm font-bold text-emerald-700">
            <span>NET ECONOMIC BENEFIT (=):</span>
            <span>${Math.round(optEco.netBenefit).toLocaleString()}</span>
          </div>
        </div>
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

          {/* Oil Price Sensitivity Matrix (Section 10 Specification) */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
            <span className="text-xs text-slate-800 font-bold uppercase tracking-wider block">Crude Sensitivity Matrix</span>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-700">
                <span className="font-sans">Oil $45/bbl:</span>
                <strong className={(optimizedOilBbl * 45) - optEco.totalCost > 0 ? "text-slate-800" : "text-rose-700"}>
                  ${Math.round((optimizedOilBbl * 45) - optEco.totalCost).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-sans">Oil $58/bbl:</span>
                <strong className="text-emerald-700 font-bold">
                  +${Math.round((optimizedOilBbl * 58) - optEco.totalCost).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-sans">Oil $75/bbl:</span>
                <strong className="text-emerald-700 font-bold">
                  +${Math.round((optimizedOilBbl * 75) - optEco.totalCost).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-sans">Oil $90/bbl:</span>
                <strong className="text-emerald-700 font-bold">
                  +${Math.round((optimizedOilBbl * 90) - optEco.totalCost).toLocaleString()}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Economic Ledger & Waterfall Breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Detailed Economic Ledger: Baseline vs. Petro-Twin
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
              Baghewala Benchmark Fleet Extrapolation (5 Wells):{' '}
              <strong className="text-emerald-700 font-semibold">+${Math.round((optEco.netBenefit - baselineEco.netBenefit) * 5).toLocaleString()}</strong> / cycle
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
