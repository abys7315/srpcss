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
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const Predictions: React.FC<Props> = ({ selectedWellId }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPresetCard, setSelectedPresetCard] = useState<string>('ROD_FLOATING');

  // Forecast state
  const [forecastHorizon] = useState<number>(180);
  const [forecastData, setForecastData] = useState<{
    days: number[];
    p10: number[];
    p50: number[];
    p90: number[];
    cumulative_p50_bbl: number;
  }>({
    days: Array.from({ length: 18 }, (_, i) => (i + 1) * 10),
    p10: [85, 68, 54, 42, 33, 27, 22, 19, 16, 14, 12, 11, 10, 9, 8, 8, 7, 7],
    p50: [110, 90, 75, 62, 50, 41, 35, 30, 26, 23, 20, 18, 16, 15, 14, 13, 12, 11],
    p90: [135, 115, 98, 83, 70, 59, 50, 43, 38, 33, 29, 26, 24, 22, 20, 18, 17, 16],
    cumulative_p50_bbl: 1845,
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
        setForecastData({
          days: fRes.days || forecastData.days,
          p10: fRes.p10 || forecastData.p10,
          p50: fRes.p50 || forecastData.p50,
          p90: fRes.p90 || forecastData.p90,
          cumulative_p50_bbl: fRes.cumulative_p50_bbl || 1845,
        });
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
    peak_gearbox_torque_in_lbs: 285000,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              AI FORECASTS, DYNACARD DIAGNOSTICS & ANOMALY DETECTION
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Quantile production forecaster ($p_{10}/p_{50}/p_{90}$), Random Forest dynacard classifier, and thermal dissipation anomaly tracker for{' '}
            <strong className="text-slate-200 font-mono">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={loadForecastAndML}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-industrial-800 hover:bg-industrial-700 text-slate-200 font-mono text-xs rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH ML INFERENCE</span>
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
          unit="Z-score &gt; 2.0σ"
          delta={anomalies.length > 0 ? 'Residual Divergence Detected' : 'Nominal Thermal Profile'}
          warning={anomalies.length > 0}
          deltaPositive={anomalies.length === 0}
          provenance="SIMULATED"
        />

        <MetricCard
          title="ML Residual Corrector"
          value="Online (v1.0.1)"
          unit="MAE: 3.8 bpd (-28.4% error)"
          delta="Hybrid Physics-Informed"
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Section 1: Quantile Production Forecaster Chart (SVG) */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Quantile Production Decline Forecast (p10 / p50 / p90 Uncertainty Band)
            </h2>
            <p className="text-[11px] text-slate-400">
              Probabilistic hybrid physics + gradient boosted residual forecast accounting for reservoir heterogeneity and cooling.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-3 h-2 bg-indigo-500/30 inline-block border border-indigo-400" />
              p10–p90 Band
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              p50 Median
            </span>
          </div>
        </div>

        {/* SVG Forecast Graph */}
        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 650 250" className="w-full h-64 bg-industrial-950/60 rounded-lg border border-industrial-800">
            {/* Grid */}
            <line x1="50" y1="50" x2="620" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
            <line x1="50" y1="100" x2="620" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
            <line x1="50" y1="150" x2="620" y2="150" stroke="#1e293b" strokeDasharray="3 3" />
            <line x1="50" y1="200" x2="620" y2="200" stroke="#475569" strokeWidth="1.5" />
            <line x1="50" y1="20" x2="50" y2="200" stroke="#475569" strokeWidth="1.5" />

            {/* Axis Labels */}
            <text x="610" y="220" fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
              Cycle Production Day →
            </text>
            <text x="20" y="25" fill="#94a3b8" fontSize="10" transform="rotate(-90 20,25)" fontFamily="monospace">
              Oil Rate (bpd) →
            </text>

            {/* Y ticks */}
            <text x="42" y="55" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              120
            </text>
            <text x="42" y="105" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              80
            </text>
            <text x="42" y="155" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              40
            </text>
            <text x="42" y="200" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              0
            </text>

            {/* Shaded p10 - p90 area */}
            <path
              d="M 50 50 Q 150 70 250 110 T 450 160 T 610 180 L 610 190 Q 450 180 250 150 T 150 110 T 50 110 Z"
              fill="rgba(99, 102, 241, 0.15)"
              stroke="rgba(129, 140, 248, 0.5)"
              strokeWidth="1"
            />

            {/* Median p50 line */}
            <path
              d="M 50 80 Q 150 95 250 130 T 450 170 T 610 185"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />

            {/* Economic Cutoff line (15 bpd) */}
            <line x1="50" y1="181" x2="620" y2="181" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1.5" />
            <text x="610" y="177" fill="#f43f5e" fontSize="9" textAnchor="end" fontFamily="monospace">
              Economic Cutoff (15 bpd)
            </text>
          </svg>
        </div>
      </div>

      {/* Section 2: Dynacard Classifier & Anomaly Detector Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dynacard Classifier Panel */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Dynacard Pattern Classifier (Random Forest)
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Trained on 10,000+ Gibbs cards</span>
          </div>

          {/* Preset Card Archetype Selector */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {['NORMAL', 'ROD_FLOATING', 'FLUID_POUND', 'GAS_INTERFERENCE', 'TUBING_LEAK'].map((label) => (
              <button
                key={label}
                onClick={() => setSelectedPresetCard(label)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  selectedPresetCard === label
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-sm'
                    : 'bg-industrial-900 text-slate-400 hover:text-slate-200 border border-industrial-800'
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
          <div className="space-y-2 text-xs font-mono">
            <span className="text-[11px] text-slate-400 block font-semibold uppercase">Classification Probabilities:</span>
            {Object.entries(cardClassification.probabilities).map(([lbl, prob]) => (
              <div key={lbl} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">{lbl.replace(/_/g, ' ')}</span>
                  <span className="text-cyan-400 font-bold">{(prob * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-industrial-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      lbl === cardClassification.predicted_label ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                    style={{ width: `${prob * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Root cause and mitigation */}
          <div className="p-3 bg-industrial-950/80 rounded-lg border border-industrial-800 text-xs font-mono space-y-1.5">
            <div className="text-slate-300">
              <strong className="text-slate-400">Root Cause:</strong> {cardClassification.root_cause}
            </div>
            <div className="text-emerald-400">
              <strong className="text-slate-400">Mitigation:</strong> {cardClassification.recommended_mitigation}
            </div>
          </div>
        </div>

        {/* Operational Anomaly Detector Panel */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Thermal & Operational Anomaly Detector
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Boberg-Lantz vs Field Discrepancy</span>
          </div>

          <div className="space-y-3">
            {anomalies.map((anom, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-industrial-950/80 border border-industrial-800 space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${anom.severity === 'HIGH' ? 'text-rose-400' : 'text-amber-400'}`}
                    />
                    {anom.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      anom.severity === 'HIGH'
                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    Day {anom.day} • {anom.severity} (Z={anom.z_score.toFixed(2)})
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">{anom.description}</p>

                <div className="pt-1 flex items-center justify-between text-[11px] text-cyan-300">
                  <span>Action: {anom.action}</span>
                  <button
                    onClick={() => alert(`Executed anomaly containment routine for Day ${anom.day}!`)}
                    className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 rounded text-cyan-300 text-[10px] transition-all"
                  >
                    APPLY ACTION
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Statistical Monitoring Details */}
          <div className="p-3 bg-industrial-900 rounded-lg border border-industrial-800 text-xs font-mono space-y-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase block">Statistical Process Control</span>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Temperature Residual Mean (μ):</span>
                <span className="text-slate-200">+1.2 °C</span>
              </div>
              <div className="flex justify-between">
                <span>Residual Std Dev (σ):</span>
                <span className="text-slate-200">2.4 °C</span>
              </div>
              <div className="flex justify-between">
                <span>Alert Threshold:</span>
                <span className="text-amber-400">&gt; 3.00 σ (99.7% confidence)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
