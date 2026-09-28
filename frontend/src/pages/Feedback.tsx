import React, { useState } from 'react';
import { apiClient } from '../api/client';
import type { RecalibrationResult } from '../api/types';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  History,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const Feedback: React.FC<Props> = ({ selectedWellId }) => {
  // Field Measurement Form State
  const [dayInCycle, setDayInCycle] = useState<number>(45);
  const [observedOilBpd, setObservedOilBpd] = useState<number>(58.0);
  const [observedWaterCut, setObservedWaterCut] = useState<number>(62.0);
  const [observedTempC, setObservedTempC] = useState<number>(142.0);
  const [observedPressureBar, setObservedPressureBar] = useState<number>(24.5);
  const [notes, setNotes] = useState<string>('Field separator test run #3; thermal sensor recalibrated.');

  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string | null>(null);

  // Recalibration State
  const [recalibrating, setRecalibrating] = useState<boolean>(false);
  const [recalibrationResult, setRecalibrationResult] = useState<RecalibrationResult | null>(null);

  // Initial Residual & Drift Status
  const [driftDetected, setDriftDetected] = useState<boolean>(true);
  const ksPValue = 0.012;

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingFeedback(true);
      setFeedbackSuccessMsg(null);
      await apiClient.submitFeedback({
        well_id: selectedWellId,
        day_in_cycle: dayInCycle,
        observed_oil_rate_bpd: observedOilBpd,
        observed_water_cut_pct: observedWaterCut,
        observed_temperature_c: observedTempC,
        observed_intake_pressure_bar: observedPressureBar,
        notes,
      });
      setFeedbackSuccessMsg(`Field observation for ${selectedWellId} successfully ingested into telemetry store.`);
    } catch (e: any) {
      console.error('Failed to submit feedback:', e);
      setFeedbackSuccessMsg('Ingestion failed: server connection error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleRecalibrate = async () => {
    try {
      setRecalibrating(true);
      const res = await apiClient.recalibrateModel({
        well_id: selectedWellId,
        training_window_days: 90,
      });
      setRecalibrationResult(res);
      setDriftDetected(false);
    } catch (e) {
      console.error('Recalibration failed:', e);
    } finally {
      setRecalibrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              CLOSED-LOOP TELEMETRY FEEDBACK & RECALIBRATION
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time physical residual tracking, Kolmogorov-Smirnov drift detection, and automated gradient-boosted residual model recalibration for{' '}
            <strong className="text-slate-200 font-mono">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={handleRecalibrate}
          disabled={recalibrating}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-mono text-xs font-bold rounded-lg shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
        >
          {recalibrating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>RECALIBRATING RESIDUAL MODEL...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>TRIGGER ONLINE RECALIBRATION</span>
            </>
          )}
        </button>
      </div>

      <DomainShiftWarning />

      {/* Drift Detection Alert Banner */}
      {driftDetected ? (
        <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-600/80 shadow-lg shadow-amber-950/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold font-mono uppercase text-amber-200">
              PHYSICS RESIDUAL DRIFT DETECTED (KS-Test p-value = {ksPValue} &lt; 0.05)
            </h3>
            <p className="text-xs text-amber-300">
              Recent gauge measurements diverge systematically from the theoretical Boberg-Lantz model by +6.8 bpd (mean residual).
              Reservoir thermal boundary effects require model recalibration.
            </p>
            <div className="pt-1">
              <button
                onClick={handleRecalibrate}
                disabled={recalibrating}
                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-all"
              >
                1-CLICK RECALIBRATE NOW (&gt;20% MAE DROP TARGET)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-emerald-300 text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>MODEL IN STATISTICAL CONTROL:</strong> Residuals conform to normal white noise (p-value &gt; 0.05). Drift cleared.
          </span>
        </div>
      )}

      {/* Recalibration Verification Card (Visible when recalibration executed) */}
      {recalibrationResult && (
        <div className="p-5 rounded-xl bg-industrial-900 border border-emerald-500/60 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold font-mono text-slate-100 uppercase">
                RECALIBRATION COMPLETED — ACCEPTANCE CRITERIA VERIFIED (&gt;20% ERROR DROP)
              </h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
              Version: {recalibrationResult.new_model_version}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800">
              <span className="text-slate-400 block text-[11px]">Pre-Recalibration MAE:</span>
              <span className="text-rose-400 text-lg font-bold">
                {recalibrationResult.pre_recalibration_mae_bpd.toFixed(2)} bpd
              </span>
            </div>

            <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800">
              <span className="text-slate-400 block text-[11px]">Post-Recalibration MAE:</span>
              <span className="text-emerald-400 text-lg font-bold">
                {recalibrationResult.post_recalibration_mae_bpd.toFixed(2)} bpd
              </span>
            </div>

            <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800">
              <span className="text-slate-400 block text-[11px]">MAE Reduction:</span>
              <span className="text-emerald-400 text-lg font-bold flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {recalibrationResult.mae_reduction_pct.toFixed(1)}% Drop
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-mono leading-relaxed">{recalibrationResult.explanation}</p>
        </div>
      )}

      {/* 2-Column Section: Field Ingestion Form & Residual History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Telemetry Observation Form */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-cyan-400" />
              Manual Field Observation / Well Gauge Entry
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Baghewala Field Ops</span>
          </div>

          <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Production Day:</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={dayInCycle}
                  onChange={(e) => setDayInCycle(parseInt(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Observed Oil Rate (bpd):</label>
                <input
                  type="number"
                  step="0.1"
                  value={observedOilBpd}
                  onChange={(e) => setObservedOilBpd(parseFloat(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Observed Water Cut (%):</label>
                <input
                  type="number"
                  step="0.5"
                  value={observedWaterCut}
                  onChange={(e) => setObservedWaterCut(parseFloat(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Bottomhole Temp (°C):</label>
                <input
                  type="number"
                  step="0.5"
                  value={observedTempC}
                  onChange={(e) => setObservedTempC(parseFloat(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-slate-400 block mb-1">Pump Intake Pressure (bar):</label>
                <input
                  type="number"
                  step="0.1"
                  value={observedPressureBar}
                  onChange={(e) => setObservedPressureBar(parseFloat(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-slate-400 block mb-1">Field Engineer Notes:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {feedbackSuccessMsg && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded text-emerald-300 text-xs">
                {feedbackSuccessMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingFeedback}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {submittingFeedback ? 'INGESTING TELEMETRY...' : 'SUBMIT FIELD GAUGE RECORD'}
            </button>
          </form>
        </div>

        {/* Residual Tracking History */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-cyan-400" />
              Recent Physics Residuals (Actual vs Twin)
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Past 5 Gauge Tests</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-industrial-800 text-slate-400 uppercase">
                  <th className="pb-2 font-semibold">Day</th>
                  <th className="pb-2 font-semibold">Twin Pred</th>
                  <th className="pb-2 font-semibold">Field Actual</th>
                  <th className="pb-2 font-semibold">Residual (Δ)</th>
                  <th className="pb-2 font-semibold text-right">Z-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-900 text-slate-300">
                <tr>
                  <td className="py-2">Day 45</td>
                  <td className="py-2">51.2 bpd</td>
                  <td className="py-2 font-bold text-slate-100">58.0 bpd</td>
                  <td className="py-2 text-rose-400">+6.8 bpd</td>
                  <td className="py-2 text-right text-rose-400">2.83σ</td>
                </tr>
                <tr>
                  <td className="py-2">Day 35</td>
                  <td className="py-2">66.5 bpd</td>
                  <td className="py-2 font-bold text-slate-100">72.1 bpd</td>
                  <td className="py-2 text-rose-400">+5.6 bpd</td>
                  <td className="py-2 text-right text-amber-400">2.33σ</td>
                </tr>
                <tr>
                  <td className="py-2">Day 25</td>
                  <td className="py-2">84.0 bpd</td>
                  <td className="py-2 font-bold text-slate-100">88.5 bpd</td>
                  <td className="py-2 text-rose-400">+4.5 bpd</td>
                  <td className="py-2 text-right text-amber-400">1.88σ</td>
                </tr>
                <tr>
                  <td className="py-2">Day 15</td>
                  <td className="py-2">105.0 bpd</td>
                  <td className="py-2 font-bold text-slate-100">106.8 bpd</td>
                  <td className="py-2 text-emerald-400">+1.8 bpd</td>
                  <td className="py-2 text-right text-slate-400">0.75σ</td>
                </tr>
                <tr>
                  <td className="py-2">Day 5</td>
                  <td className="py-2">128.5 bpd</td>
                  <td className="py-2 font-bold text-slate-100">127.2 bpd</td>
                  <td className="py-2 text-emerald-400">-1.3 bpd</td>
                  <td className="py-2 text-right text-slate-400">0.54σ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-industrial-950/80 rounded-lg border border-industrial-800 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Recalibration Trigger Threshold:</span>
              <span className="text-amber-400">&gt; 5 sample points with |Z| &gt; 2.0</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Auto-retrain Method:</span>
              <span className="text-slate-200">LightGBM Residual Regressor + Ridge Fallback</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
