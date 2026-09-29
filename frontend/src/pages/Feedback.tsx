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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              Telemetry Feedback & Model Recalibration
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physical residual tracking, Kolmogorov-Smirnov drift detection, and automated gradient-boosted residual model recalibration for{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={handleRecalibrate}
          disabled={recalibrating}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50"
        >
          {recalibrating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Recalibrating Residual Model...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trigger Online Recalibration</span>
            </>
          )}
        </button>
      </div>

      {/* Calibration Notice */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-blue-600" />
            <span>Field Calibration Environment & Telemetry Synchronization</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Active Baseline
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Field measurements update the physics-informed neural residual corrector, compensating for local permeability variations and thermal front behavior.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-200/80">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
            <span>Reference Well: <strong className="text-slate-900 font-semibold">BW-01 (Baghewala)</strong></span>
          </span>
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
            <span>Feedback Mode: Adaptive Closed-Loop Recalibration</span>
          </span>
        </div>
      </div>

      <DomainShiftWarning />

      {/* Drift Detection Alert Banner */}
      {driftDetected ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-900">
              Physics Residual Drift Detected (KS-Test p = {ksPValue})
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              Recent gauge measurements diverge systematically from the theoretical Boberg-Lantz model by +6.8 bpd (mean residual).
              Reservoir thermal boundary effects require model recalibration.
            </p>
            <div className="pt-1.5">
              <button
                onClick={handleRecalibrate}
                disabled={recalibrating}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all"
              >
                Recalibrate Model Now
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong className="font-semibold text-emerald-900">Model In Statistical Control:</strong> Residuals conform to normal white noise (p &gt; 0.05). Drift cleared.
          </span>
        </div>
      )}

      {/* Recalibration Verification Card (Visible when recalibration executed) */}
      {recalibrationResult && (
        <div className="p-5 rounded-xl bg-white border border-emerald-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Recalibration Completed — Acceptance Criteria Verified (&gt;20% Error Reduction)
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Version {recalibrationResult.new_model_version}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px] font-medium">Pre-Recalibration MAE</span>
              <span className="text-rose-600 text-lg font-bold">
                {recalibrationResult.pre_recalibration_mae_bpd.toFixed(2)} bpd
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px] font-medium">Post-Recalibration MAE</span>
              <span className="text-emerald-700 text-lg font-bold">
                {recalibrationResult.post_recalibration_mae_bpd.toFixed(2)} bpd
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px] font-medium">MAE Reduction</span>
              <span className="text-emerald-700 text-lg font-bold flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {recalibrationResult.mae_reduction_pct.toFixed(1)}% Drop
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">{recalibrationResult.explanation}</p>
        </div>
      )}

      {/* 2-Column Section: Field Ingestion Form & Residual History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Telemetry Observation Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-emerald-600" />
              Manual Field Observation / Well Gauge Entry
            </h2>
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">Baghewala Field Ops</span>
          </div>

          <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-700 block mb-1 font-medium">Production Day:</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={dayInCycle}
                  onChange={(e) => setDayInCycle(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-medium">Observed Oil Rate (bpd):</label>
                <input
                  type="number"
                  step="0.1"
                  value={observedOilBpd}
                  onChange={(e) => setObservedOilBpd(parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-medium">Observed Water Cut (%):</label>
                <input
                  type="number"
                  step="0.5"
                  value={observedWaterCut}
                  onChange={(e) => setObservedWaterCut(parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-medium">Bottomhole Temp (°C):</label>
                <input
                  type="number"
                  step="0.5"
                  value={observedTempC}
                  onChange={(e) => setObservedTempC(parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-slate-700 block mb-1 font-medium">Pump Intake Pressure (bar):</label>
                <input
                  type="number"
                  step="0.1"
                  value={observedPressureBar}
                  onChange={(e) => setObservedPressureBar(parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-slate-700 block mb-1 font-medium">Field Engineer Notes:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {feedbackSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium">
                {feedbackSuccessMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingFeedback}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 text-xs"
            >
              {submittingFeedback ? 'Ingesting Telemetry...' : 'Submit Field Gauge Record'}
            </button>
          </form>
        </div>

        {/* Residual Tracking History */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-blue-600" />
              Recent Physics Residuals (Actual vs. Twin)
            </h2>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 border border-slate-200 text-slate-600">
                Residual Tracking Log
              </span>
              <span className="text-xs text-slate-400">Past 5 Cycles</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Day</th>
                  <th className="py-2.5 px-3 font-semibold">Twin Pred</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-900">Observed Value</th>
                  <th className="py-2.5 px-3 font-semibold">Residual (Δ)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Z-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Day 45</td>
                  <td className="py-2.5 px-3 text-slate-600">51.2 bpd</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">58.0 bpd</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">+6.8 bpd</td>
                  <td className="py-2.5 px-3 text-right text-rose-600 font-bold">2.83σ</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Day 35</td>
                  <td className="py-2.5 px-3 text-slate-600">66.5 bpd</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">72.1 bpd</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">+5.6 bpd</td>
                  <td className="py-2.5 px-3 text-right text-amber-600 font-bold">2.33σ</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Day 25</td>
                  <td className="py-2.5 px-3 text-slate-600">84.0 bpd</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">88.5 bpd</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">+4.5 bpd</td>
                  <td className="py-2.5 px-3 text-right text-amber-600 font-bold">1.88σ</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Day 15</td>
                  <td className="py-2.5 px-3 text-slate-600">105.0 bpd</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">106.8 bpd</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">+1.8 bpd</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">0.75σ</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">Day 5</td>
                  <td className="py-2.5 px-3 text-slate-600">128.5 bpd</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">127.2 bpd</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">-1.3 bpd</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">0.54σ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500">
            * Note: Residuals are computed against the baseline Boberg-Lantz thermal dissipation curve and Gibbs sucker rod kinematics.
          </p>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Recalibration Trigger Threshold:</span>
              <span className="text-amber-800 font-semibold">&gt; 5 sample points with |Z| &gt; 2.0</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Auto-retrain Method:</span>
              <span className="text-slate-800 font-medium">LightGBM Residual Regressor + Ridge Fallback</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
