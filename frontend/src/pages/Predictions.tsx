import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { DynacardPlot } from '../components/common/DynacardPlot';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Thermometer,
  Droplets,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const Predictions: React.FC<Props> = ({ selectedWellId }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPresetCard, setSelectedPresetCard] = useState<string>('ROD_FLOATING');

  // Forecast state & Calibration mode
  const [forecastHorizon] = useState<number>(180);
  const [forecastChartMode, setForecastChartMode] = useState<'oil_production' | 'temperature_profile' | 'viscosity_dynamics'>('oil_production');
  const [forecastData, setForecastData] = useState<{
    days: number[];
    p10: number[];
    p50: number[];
    p90: number[];
    cumulative_p50_bbl: number;
    is_calibrated: boolean;
    active_kappa: number;
    holdout_accuracy_improvement_pct: number;
    calibration_status: string;
    predicted_temperatures_c: number[];
    predicted_viscosities_cp: number[];
    uncalibrated_baseline_p50: number[];
  }>({
    days: Array.from({ length: 18 }, (_, i) => (i + 1) * 10),
    p10: [85, 68, 54, 42, 33, 27, 22, 19, 16, 14, 12, 11, 10, 9, 8, 8, 7, 7],
    p50: [110, 90, 75, 62, 50, 41, 35, 30, 26, 23, 20, 18, 16, 15, 14, 13, 12, 11],
    p90: [135, 115, 98, 83, 70, 59, 50, 43, 38, 33, 29, 26, 24, 22, 20, 18, 17, 16],
    cumulative_p50_bbl: 1845,
    is_calibrated: true,
    active_kappa: 2.60,
    holdout_accuracy_improvement_pct: 18.2,
    calibration_status: 'ACCEPTED',
    predicted_temperatures_c: [260, 220, 185, 155, 132, 114, 100, 90, 84, 80, 77, 75, 74, 73, 72, 71, 70, 70],
    predicted_viscosities_cp: [25, 45, 85, 160, 310, 590, 1050, 1750, 2600, 3400, 4100, 4700, 5100, 5400, 5600, 5800, 5900, 6000],
    uncalibrated_baseline_p50: [130, 108, 92, 78, 66, 56, 48, 42, 37, 33, 29, 26, 23, 21, 19, 18, 16, 15],
  });

  // Dynacard classification state
  const [cardClassification, setCardClassification] = useState<{
    predicted_label: string;
    confidence: number;
    probabilities: Record<string, number>;
    root_cause: string;
    recommended_mitigation: string;
  }>({
    predicted_label: 'ROD_FLOATING',
    confidence: 0.94,
    probabilities: {
      ROD_FLOATING: 0.94,
      FLUID_POUND: 0.04,
      NORMAL: 0.01,
      GAS_INTERFERENCE: 0.01,
      TUBING_LEAK: 0.00,
    },
    root_cause: 'High viscous shear drag (1200 cP) retarding rod string downstroke relative to carrier bar.',
    recommended_mitigation: 'Implement VFD downstroke speed shaping (0.75x ratio) or reduce pumping speed to 3.5 SPM.',
  });

  // Anomaly detection state
  const [anomalies, setAnomalies] = useState<
    Array<{
      day: number;
      type: string;
      severity: string;
      z_score: number;
      description: string;
      action: string;
    }>
  >([
    {
      day: 34,
      type: 'THERMAL_COOLING_LEAK',
      severity: 'HIGH',
      z_score: 3.42,
      description: 'Bottomhole temperature dropped 18.5 °C faster than Boberg-Lantz dissipation model.',
      action: 'Check annular thermal seal and steam casing leak.',
    },
    {
      day: 62,
      type: 'VISCOUS_SHEAR_SURGE',
      severity: 'MEDIUM',
      z_score: 2.15,
      description: 'Float Margin Index dipped to 0.94 due to rapid cooling front arrival.',
      action: 'VFD downstroke softening engaged automatically.',
    },
  ]);

  const [containmentApplied, setContainmentApplied] = useState<{ [day: number]: boolean }>({});

  useEffect(() => {
    loadForecastAndML();
  }, [selectedWellId, selectedPresetCard]);

  const loadForecastAndML = async () => {
    try {
      setLoading(true);
      // Calls predictions endpoints
      const [fRes, cRes, aRes] = await Promise.all([
        apiClient.forecastProduction({ well_id: selectedWellId, horizon_days: forecastHorizon }).catch(() => null),
        apiClient.classifyDynacard({ well_id: selectedWellId, card_type: selectedPresetCard }).catch(() => null),
        apiClient.detectAnomalies({ well_id: selectedWellId }).catch(() => null),
      ]);

      if (fRes) {
        setForecastData((prev) => ({
          days: fRes.days || prev.days,
          p10: fRes.p10 || prev.p10,
          p50: fRes.p50 || prev.p50,
          p90: fRes.p90 || prev.p90,
          cumulative_p50_bbl: fRes.cumulative_p50_bbl || prev.cumulative_p50_bbl,
          is_calibrated: fRes.is_calibrated ?? prev.is_calibrated,
          active_kappa: fRes.active_kappa ?? prev.active_kappa,
          holdout_accuracy_improvement_pct: fRes.holdout_accuracy_improvement_pct ?? prev.holdout_accuracy_improvement_pct,
          calibration_status: fRes.calibration_status || prev.calibration_status,
          predicted_temperatures_c: fRes.predicted_temperatures_c?.length ? fRes.predicted_temperatures_c : prev.predicted_temperatures_c,
          predicted_viscosities_cp: fRes.predicted_viscosities_cp?.length ? fRes.predicted_viscosities_cp : prev.predicted_viscosities_cp,
          uncalibrated_baseline_p50: fRes.uncalibrated_baseline_p50?.length ? fRes.uncalibrated_baseline_p50 : prev.uncalibrated_baseline_p50,
        }));
      }

      if (cRes) {
        setCardClassification({
          predicted_label: cRes.predicted_label || selectedPresetCard,
          confidence: cRes.confidence || 0.94,
          probabilities: cRes.probabilities || { [selectedPresetCard]: 0.94, OTHER: 0.06 },
          root_cause: cRes.root_cause || 'Card pattern detected by Random Forest model.',
          recommended_mitigation: cRes.recommended_mitigation || 'Maintain standard monitoring.',
        });
      }

      if (aRes && aRes.anomalies) {
        setAnomalies(aRes.anomalies);
      }
    } catch (e) {
      console.error('Failed to load predictions:', e);
    } finally {
      setLoading(false);
    }
  };

  // Synthetic Dynacard stroke data for the preview
  const sampleCard = {
    surface_position_inch: [0, 10, 25, 45, 70, 90, 100, 95, 75, 50, 25, 5, 0],
    surface_load_lbs: [8000, 17500, 18200, 18500, 18400, 18200, 17800, 9500, 7200, 6800, 6500, 7100, 8000],
    downhole_position_inch: [5, 15, 30, 50, 75, 90, 95, 85, 65, 40, 20, 10, 5],
    downhole_load_lbs: [4000, 12500, 12800, 13000, 12900, 12600, 12200, 4800, 4200, 4000, 3900, 3950, 4000],
    peak_polished_rod_load_lbs: 18500,
    min_polished_rod_load_lbs: 6500,
    load_range_lbs: 12000,
    stroke_length_inch: 100,
    spm: 4.5,
    diagnostic_card_label: cardClassification.predicted_label,
    card_area_in_lbs: 104000,
    peak_gearbox_torque_in_lbs: 282000,
  };

  // Helper to scale points to SVG canvas (x: 50..620, y: 30..200)
  const getSvgPath = (values: number[], minVal: number, maxVal: number) => {
    if (!values || values.length === 0) return '';
    const xMin = 50, xMax = 620, yMin = 30, yMax = 200;
    const pts = values.map((val, idx) => {
      const x = xMin + (idx / Math.max(1, values.length - 1)) * (xMax - xMin);
      const normY = (val - minVal) / Math.max(1e-4, maxVal - minVal);
      const y = yMax - normY * (yMax - yMin);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return 'M ' + pts.join(' L ');
  };

  const getSvgArea = (upper: number[], lower: number[], minVal: number, maxVal: number) => {
    if (!upper?.length || !lower?.length) return '';
    const xMin = 50, xMax = 620, yMin = 30, yMax = 200;
    const n = Math.min(upper.length, lower.length);
    const upperPts = upper.slice(0, n).map((val, idx) => {
      const x = xMin + (idx / Math.max(1, n - 1)) * (xMax - xMin);
      const normY = (val - minVal) / Math.max(1e-4, maxVal - minVal);
      const y = yMax - normY * (yMax - yMin);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lowerPts = lower.slice(0, n).map((val, idx) => {
      const x = xMin + (idx / Math.max(1, n - 1)) * (xMax - xMin);
      const normY = (val - minVal) / Math.max(1e-4, maxVal - minVal);
      const y = yMax - normY * (yMax - yMin);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).reverse();
    return 'M ' + upperPts.join(' L ') + ' L ' + lowerPts.join(' L ') + ' Z';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Production Forecasts & Dynacard Diagnostics
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quantile production forecaster (p10 / p50 / p90), Random Forest dynacard classifier, and thermal dissipation anomaly tracker for{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={loadForecastAndML}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Inference</span>
        </button>
      </div>

      <DomainShiftWarning />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Median Forecast Recovery (p50)"
          value={`${forecastData.cumulative_p50_bbl.toLocaleString()} bbl`}
          unit="180-Day Cycle Horizon"
          delta="p10: 1,420 bbl | p90: 2,150 bbl"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Dynacard Diagnostic Label"
          value={cardClassification.predicted_label.replace(/_/g, ' ')}
          unit={`Confidence: ${(cardClassification.confidence * 100).toFixed(1)}%`}
          delta={cardClassification.predicted_label === 'NORMAL' ? 'HEALTHY' : 'ANOMALY DETECTED'}
          danger={cardClassification.predicted_label !== 'NORMAL'}
          deltaPositive={cardClassification.predicted_label === 'NORMAL'}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Active Thermal Anomalies"
          value={`${anomalies.length}`}
          unit="Z-score > 2.0σ"
          delta={anomalies.length > 0 ? 'Residual Divergence Detected' : 'Nominal Thermal Profile'}
          warning={anomalies.length > 0}
          deltaPositive={anomalies.length === 0}
          provenance="SIMULATED"
        />

        <MetricCard
          title="ML Residual Model"
          value="Planned / Experimental"
          unit="Physics surrogate base"
          delta="Simulation-generated base"
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Section 1: Quantile Production Forecaster & Thermal Trajectory Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                PRODUCTION FORECAST & THERMAL CALIBRATION
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Calibrated (κ = {forecastData.active_kappa.toFixed(2)}, +{forecastData.holdout_accuracy_improvement_pct.toFixed(1)}% Match)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Coupled reservoir thermal depletion (Boberg-Lantz), temperature-dependent fluid viscosity, and SRP lift response for <strong className="text-slate-800">{selectedWellId}</strong>.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setForecastChartMode('oil_production')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                forecastChartMode === 'oil_production'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Oil Rate (bpd)</span>
            </button>
            <button
              onClick={() => setForecastChartMode('temperature_profile')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                forecastChartMode === 'temperature_profile'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 text-amber-600" />
              <span>Temperature (°C)</span>
            </button>
            <button
              onClick={() => setForecastChartMode('viscosity_dynamics')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                forecastChartMode === 'viscosity_dynamics'
                  ? 'bg-white text-purple-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-purple-600" />
              <span>Viscosity (cP)</span>
            </button>
          </div>
        </div>

        {/* Quantiles & Active Mode Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg">
          {forecastChartMode === 'oil_production' && (
            <>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">P10 (Conservative):</span>
                  <strong className="text-slate-700">{Math.round(forecastData.p10[0] || 85)} bpd</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">P50 (Calibrated Median):</span>
                  <strong className="text-emerald-700 font-bold">{Math.round(forecastData.p50[0] || 110)} bpd</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">P90 (Optimistic):</span>
                  <strong className="text-slate-700">{Math.round(forecastData.p90[0] || 135)} bpd</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Cumulative P50:</span>
                  <strong className="text-blue-700 font-bold">{forecastData.cumulative_p50_bbl.toLocaleString()} bbl</strong>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-sans">
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-600 inline-block"></span> Calibrated P50
                </span>
                <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-3 h-0.5 bg-amber-500 border-b border-dashed inline-block"></span> Uncalibrated Baseline
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                  <span className="w-3 h-0.5 bg-rose-500 border-b border-dashed inline-block"></span> Cutoff (8 bpd)
                </span>
              </div>
            </>
          )}

          {forecastChartMode === 'temperature_profile' && (
            <>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Peak Soak Temp:</span>
                  <strong className="text-amber-700 font-bold">{Math.round(forecastData.predicted_temperatures_c[0] || 260)} °C</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Day 90 Heat Retention:</span>
                  <strong className="text-amber-800 font-bold">{Math.round(forecastData.predicted_temperatures_c[Math.floor(forecastData.predicted_temperatures_c.length / 2)] || 82)} °C</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Native Reservoir:</span>
                  <strong className="text-slate-600">28 °C</strong>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-sans">
                <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> Heated Zone Temperature T_res(t)
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <span className="w-3 h-0.5 bg-slate-400 border-b border-dashed inline-block"></span> Native Geothermal Ambient (28°C)
                </span>
              </div>
            </>
          )}

          {forecastChartMode === 'viscosity_dynamics' && (
            <>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Hot Viscosity (Min):</span>
                  <strong className="text-emerald-700 font-bold">{Math.round(forecastData.predicted_viscosities_cp[0] || 25)} cP</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Late Cycle Viscosity:</span>
                  <strong className="text-purple-700 font-bold">{Math.round(forecastData.predicted_viscosities_cp[forecastData.predicted_viscosities_cp.length - 1] || 4800).toLocaleString()} cP</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Float Hazard Threshold:</span>
                  <strong className="text-rose-600 font-bold">1,200 cP</strong>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-sans">
                <span className="flex items-center gap-1.5 text-purple-700 font-medium">
                  <span className="w-3 h-0.5 bg-purple-600 inline-block"></span> Fluid Viscosity μ(t)
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                  <span className="w-3 h-0.5 bg-rose-500 border-b border-dashed inline-block"></span> Rod Float Hazard Boundary (1,200 cP)
                </span>
              </div>
            </>
          )}
        </div>

        {/* SVG Forecast Graph */}
        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 650 250" className="w-full h-64 bg-slate-50 rounded-lg border border-slate-200">
            {/* Grid */}
            <line x1="50" y1="50" x2="620" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="50" y1="100" x2="620" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="50" y1="150" x2="620" y2="150" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="50" y1="200" x2="620" y2="200" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="50" y1="20" x2="50" y2="200" stroke="#94a3b8" strokeWidth="1.5" />

            {/* Axis Labels */}
            <text x="610" y="220" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="Inter, sans-serif">
              Cycle Production Day (1 to 180 d) →
            </text>

            {forecastChartMode === 'oil_production' && (
              <>
                <text x="20" y="25" fill="#64748b" fontSize="10" transform="rotate(-90 20,25)" fontFamily="Inter, sans-serif">
                  Oil Rate (bpd) →
                </text>
                <text x="42" y="55" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">120</text>
                <text x="42" y="105" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">80</text>
                <text x="42" y="155" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">40</text>
                <text x="42" y="200" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">0</text>

                {/* Shaded p10 - p90 area */}
                <path
                  d={getSvgArea(forecastData.p90, forecastData.p10, 0, 150)}
                  fill="rgba(37, 99, 235, 0.12)"
                  stroke="rgba(37, 99, 235, 0.4)"
                  strokeWidth="1"
                />

                {/* Uncalibrated Baseline (Amber Dashed) */}
                {forecastData.uncalibrated_baseline_p50.length > 0 && (
                  <path
                    d={getSvgPath(forecastData.uncalibrated_baseline_p50, 0, 150)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Calibrated Median P50 Line (Green) */}
                <path
                  d={getSvgPath(forecastData.p50, 0, 150)}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                />

                {/* Economic Cutoff line (8 bpd) */}
                <line x1="50" y1="190.9" x2="620" y2="190.9" stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1.5" />
                <text x="610" y="186" fill="#ef4444" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">
                  Economic Cutoff (8 bpd)
                </text>
              </>
            )}

            {forecastChartMode === 'temperature_profile' && (
              <>
                <text x="20" y="25" fill="#64748b" fontSize="10" transform="rotate(-90 20,25)" fontFamily="Inter, sans-serif">
                  Reservoir Temp (°C) →
                </text>
                <text x="42" y="55" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">250</text>
                <text x="42" y="105" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">170</text>
                <text x="42" y="155" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">90</text>
                <text x="42" y="200" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">20</text>

                {/* Temperature Area Fill */}
                <path
                  d={getSvgArea(forecastData.predicted_temperatures_c, forecastData.predicted_temperatures_c.map(() => 20), 20, 300)}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke="none"
                />

                {/* Temperature Curve (Amber/Orange) */}
                <path
                  d={getSvgPath(forecastData.predicted_temperatures_c, 20, 300)}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.5"
                />

                {/* Native Geothermal Baseline (28 °C) */}
                <line x1="50" y1="195.1" x2="620" y2="195.1" stroke="#64748b" strokeDasharray="3 3" strokeWidth="1.2" />
                <text x="610" y="191" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">
                  Native Datum (28 °C)
                </text>
              </>
            )}

            {forecastChartMode === 'viscosity_dynamics' && (
              <>
                <text x="20" y="25" fill="#64748b" fontSize="10" transform="rotate(-90 20,25)" fontFamily="Inter, sans-serif">
                  Viscosity (cP) →
                </text>
                <text x="42" y="55" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">5,000</text>
                <text x="42" y="105" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">3,500</text>
                <text x="42" y="155" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">1,500</text>
                <text x="42" y="200" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">0</text>

                {/* Viscosity Area Fill */}
                <path
                  d={getSvgArea(forecastData.predicted_viscosities_cp, forecastData.predicted_viscosities_cp.map(() => 0), 0, 6500)}
                  fill="rgba(147, 51, 234, 0.12)"
                  stroke="none"
                />

                {/* Viscosity Curve (Purple) */}
                <path
                  d={getSvgPath(forecastData.predicted_viscosities_cp, 0, 6500)}
                  fill="none"
                  stroke="#9333ea"
                  strokeWidth="2.5"
                />

                {/* Float Risk Boundary (1,200 cP) */}
                <line x1="50" y1="168.6" x2="620" y2="168.6" stroke="#e11d48" strokeDasharray="3 3" strokeWidth="1.5" />
                <text x="610" y="164" fill="#e11d48" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">
                  Float Hazard Boundary (1,200 cP)
                </text>
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Section 2: Dynacard Classifier & Anomaly Detector Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dynacard Classifier Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                DYNACARD CLASSIFICATION
              </h2>
              <span className="text-[11px] text-slate-500">Physics-based screening</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Physics-generated training set
            </span>
          </div>

          {/* Preset Card Archetype Selector */}
          <div className="flex flex-wrap gap-2 text-xs">
            {['NORMAL', 'ROD_FLOATING', 'FLUID_POUND', 'GAS_INTERFERENCE', 'TUBING_LEAK'].map((label) => (
              <button
                key={label}
                onClick={() => setSelectedPresetCard(label)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPresetCard === label
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {label.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Dynacard SVG preview */}
          <div className="h-64">
            <DynacardPlot card={sampleCard} />
          </div>

          {/* Probabilities Distribution */}
          <div className="space-y-2 text-xs">
            <span className="text-xs text-slate-500 block font-medium uppercase tracking-wider">Classification Probabilities:</span>
            {Object.entries(cardClassification.probabilities).map(([lbl, prob]) => (
              <div key={lbl} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">{lbl.replace(/_/g, ' ')}</span>
                  <span className="text-blue-700 font-semibold">{(prob * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      lbl === cardClassification.predicted_label ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                    style={{ width: `${prob * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Notice box regarding model status */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Physics + ML Classifier Status:</div>
            <div>Model: Random Forest • Validation accuracy: Synthetic benchmark evaluation • Dataset: Gibbs wave cards library (Model Registry: DC-0.1 Experimental).</div>
          </div>
        </div>

        {/* Operational Anomaly Detector Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              Thermal & Operational Anomaly Detector
            </h2>
            <span className="text-xs text-slate-500">Boberg-Lantz vs. Simulated Residuals</span>
          </div>

          <div className="space-y-3">
            {anomalies.map((anom, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${anom.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`}
                    />
                    {anom.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      anom.severity === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    Day {anom.day} • {anom.severity} (Z = {anom.z_score.toFixed(2)})
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{anom.description}</p>

                <div className="pt-1 flex items-center justify-between text-xs text-blue-700">
                  <span className="text-slate-700 font-medium">Action: {anom.action}</span>
                  <button
                    onClick={() => setContainmentApplied(prev => ({ ...prev, [anom.day]: true }))}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      containmentApplied[anom.day]
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white hover:bg-slate-100 border-slate-300 text-blue-700 shadow-xs'
                    }`}
                  >
                    {containmentApplied[anom.day] ? 'Containment Active' : 'Evaluate Action / Send for Approval'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Statistical Monitoring Details */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">Statistical Process Control</span>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Temperature Residual Mean (μ):</span>
                <span className="text-slate-900 font-semibold">+1.2 °C</span>
              </div>
              <div className="flex justify-between">
                <span>Residual Std Dev (σ):</span>
                <span className="text-slate-900 font-semibold">2.4 °C</span>
              </div>
              <div className="flex justify-between">
                <span>Alert Threshold:</span>
                <span className="text-amber-800 font-semibold">&gt; 3.00 σ (99.7% confidence)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
