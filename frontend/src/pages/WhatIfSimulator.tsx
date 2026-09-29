import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { WhatIfScenario } from '../api/types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  Sliders,
  Play,
  CheckCircle2,
  AlertOctagon,
  Star,
  FileSpreadsheet,
  Check,
  X,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ShieldAlert,
  Info
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const WhatIfSimulator: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [recommendedId, setRecommendedId] = useState<string>('RECOMMENDED');
  const [summaryInsight, setSummaryInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Governance Workflow States (Rule 12 & Rule 11)
  const [inspectedScenario, setInspectedScenario] = useState<WhatIfScenario | null>(null);
  const [approvedScenarioId, setApprovedScenarioId] = useState<string | null>(null);
  const [rejectedScenarioIds, setRejectedScenarioIds] = useState<string[]>([]);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  useEffect(() => {
    runSimulation();
  }, [selectedWellId]);

  const runSimulation = async () => {
    try {
      setLoading(true);
      setAppliedMsg(null);
      setErrorMessage(null);
      setApprovedScenarioId(null);
      setRejectedScenarioIds([]);
      setInspectedScenario(null);

      const res = await apiClient.runWhatIf({
        well_id: selectedWellId,
      });
      const scList = res.scenarios || [];
      setScenarios(scList);
      setRecommendedId(res.recommended_scenario_id || 'RECOMMENDED');
      setSummaryInsight(res.summary_insight || '');

      // Default inspected scenario to the recommended one if available
      const rec = scList.find(s => s.scenario_id === res.recommended_scenario_id || s.is_recommended);
      if (rec) {
        setInspectedScenario(rec);
      } else if (scList.length > 0) {
        setInspectedScenario(scList[0]);
      }
    } catch (e: any) {
      console.error('Failed to run What-If scenarios:', e);
      setErrorMessage(e?.response?.data?.detail || e?.response?.data?.message || e.message || 'What-If scenario simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sc: WhatIfScenario) => {
    if (sc.status === 'INFEASIBLE') {
      setErrorMessage(`Cannot approve scenario '${sc.label}' because it breaches hard safety constraints.`);
      return;
    }
    try {
      setActionInProgress(true);
      setErrorMessage(null);
      setAppliedMsg(null);

      await apiClient.approveRecommendation(sc.scenario_id, {
        well_id: selectedWellId,
        decision_reason: `Operator formal approval for scenario ${sc.label} (${sc.scenario_id})`,
        approved_by: "Chief Operations Engineer",
        approved_setpoint: {
          steam_volume_tonnes: sc.steam_volume_tonnes,
          soak_duration_days: sc.soak_days,
          spm: sc.spm,
          stroke_length_inch: sc.stroke_length_inch,
          vfd_downstroke_ratio: sc.vfd_downstroke_ratio
        }
      });

      setApprovedScenarioId(sc.scenario_id);
      setRejectedScenarioIds(prev => prev.filter(id => id !== sc.scenario_id));
      setAppliedMsg(`Scenario '${sc.label}' APPROVED by Chief Operations Engineer. Setpoint is now gated for execution.`);
    } catch (e: any) {
      console.error('Approval failed:', e);
      setErrorMessage(`Approval failed for '${sc.label}'. Reason: ${e?.response?.data?.detail || e?.response?.data?.message || e.message || 'API error'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async (sc: WhatIfScenario) => {
    try {
      setActionInProgress(true);
      setErrorMessage(null);
      setAppliedMsg(null);

      await apiClient.rejectRecommendation(sc.scenario_id, {
        well_id: selectedWellId,
        decision_reason: `Rejected by Operations Engineer: sub-optimal or unacceptable mechanical margin.`,
        approved_by: "Chief Operations Engineer"
      });

      setRejectedScenarioIds(prev => [...prev, sc.scenario_id]);
      if (approvedScenarioId === sc.scenario_id) {
        setApprovedScenarioId(null);
      }
      setAppliedMsg(`Scenario '${sc.label}' marked as REJECTED.`);
    } catch (e: any) {
      console.error('Rejection failed:', e);
      setErrorMessage(`Rejection failed for '${sc.label}'. Reason: ${e?.response?.data?.detail || e?.response?.data?.message || e.message || 'API error'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApplyApprovedSetpoint = async (sc: WhatIfScenario) => {
    if (approvedScenarioId !== sc.scenario_id) {
      setErrorMessage(`Governance Gate Error: Scenario '${sc.label}' must be formally approved before setpoint application.`);
      return;
    }
    try {
      setActionInProgress(true);
      setErrorMessage(null);

      await apiClient.updateSetpoint(selectedWellId, {
        spm: sc.spm,
        stroke_length_inch: sc.stroke_length_inch,
        vfd_downstroke_ratio: sc.vfd_downstroke_ratio,
        steam_volume_tonnes: sc.steam_volume_tonnes,
        soak_duration_days: sc.soak_days,
        applied_by: "Chief Operations Engineer"
      });

      setAppliedMsg(`Approved Setpoint for '${sc.label}' successfully applied to digital twin of ${selectedWellId}! Audit logged.`);
      setTimeout(() => {
        if (onNavigate) onNavigate('digital-twin');
      }, 1500);
    } catch (e: any) {
      console.error('Setpoint update failed:', e);
      // Strictly follow Rule 11: Never fake success!
      setErrorMessage(`Setpoint update failed. No operational state was changed. Reason: ${e?.response?.data?.detail || e?.response?.data?.message || e.message || 'API update failed'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              What-If Scenario Sandbox & Governance
            </h1>
            <ProvenanceBadge tier="SIMULATED" variant="bracket" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Engineering comparison sheet, physical constraint gating, and 2-person approval governance for well{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading || actionInProgress}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Evaluating scenarios...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Simulate Scenarios</span>
            </>
          )}
        </button>
      </div>

      {/* Success Banner */}
      {appliedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{appliedMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <DomainShiftWarning />

      {/* 1. ENGINEERING COMPARISON SHEET (Dynamic from Backend) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              ENGINEERING COMPARISON SHEET (5-SCENARIO MATRIX)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Strict physical constraint gating: thermal efficiency vs sucker rod kinematics directly computed by backend.
            </p>
          </div>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200 font-semibold">
            {scenarios.length} Scenarios Evaluated
          </span>
        </div>

        {/* Dynamic Multi-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {scenarios.map((sc) => {
            const isRec = sc.scenario_id === recommendedId || sc.is_recommended;
            const isInfeasible = sc.status === 'INFEASIBLE';
            const isApproved = approvedScenarioId === sc.scenario_id;
            const isRejected = rejectedScenarioIds.includes(sc.scenario_id);
            const isInspected = inspectedScenario?.scenario_id === sc.scenario_id;

            return (
              <div
                key={sc.scenario_id}
                onClick={() => setInspectedScenario(sc)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isInspected
                    ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20'
                    : isRec
                    ? 'bg-emerald-50/50 border-emerald-400'
                    : isInfeasible
                    ? 'bg-rose-50/30 border-rose-200'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      {sc.label}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        isRec
                          ? 'bg-emerald-100 text-emerald-800'
                          : isInfeasible
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {sc.scenario_id}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-slate-700 mt-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-500">Steam:</span>
                      <strong>{Math.round(sc.steam_volume_tonnes).toLocaleString()} t</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-500">SPM:</span>
                      <strong>{sc.spm.toFixed(1)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-500">VFD α:</span>
                      <strong className={sc.vfd_downstroke_ratio < 1.0 ? 'text-blue-700' : ''}>
                        {sc.vfd_downstroke_ratio.toFixed(2)}x
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-500">Soak:</span>
                      <strong>{sc.soak_days} d</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-500">Float Margin:</span>
                      <strong className={sc.min_float_margin_index < 1.0 ? 'text-rose-600' : 'text-emerald-700'}>
                        {sc.min_float_margin_index.toFixed(3)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-200/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 font-sans">
                    Feasibility Status
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold font-sans text-[11px]">
                    {isInfeasible ? (
                      <div className="flex items-center gap-1 text-rose-700">
                        <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">Infeasible ({sc.violations[0]?.substring(0, 18) || 'Float'}...)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Feasible</span>
                      </div>
                    )}
                  </div>

                  {isApproved && (
                    <div className="mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded text-center">
                      ✓ APPROVED FOR SETPOINT
                    </div>
                  )}
                  {isRejected && (
                    <div className="mt-1.5 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded text-center">
                      ✕ REJECTED BY OPERATOR
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. INSPECTION & GOVERNANCE ACTION BAR (Rule 12 Specification) */}
      {inspectedScenario && (
        <div className="bg-white border-2 border-blue-500/40 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Inspected Scenario: <span className="text-blue-700">{inspectedScenario.label} ({inspectedScenario.scenario_id})</span>
                </h3>
                <StatusBadge status={inspectedScenario.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">{inspectedScenario.description}</p>
            </div>

            {/* Governance Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReject(inspectedScenario)}
                disabled={actionInProgress || rejectedScenarioIds.includes(inspectedScenario.scenario_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Reject
              </button>

              <button
                onClick={() => handleApprove(inspectedScenario)}
                disabled={actionInProgress || inspectedScenario.status === 'INFEASIBLE' || approvedScenarioId === inspectedScenario.scenario_id}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {approvedScenarioId === inspectedScenario.scenario_id ? 'Approved ✓' : 'Approve Recommendation'}
              </button>

              <button
                onClick={() => handleApplyApprovedSetpoint(inspectedScenario)}
                disabled={actionInProgress || approvedScenarioId !== inspectedScenario.scenario_id}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title={approvedScenarioId !== inspectedScenario.scenario_id ? "Requires prior engineer approval" : "Apply approved setpoints to digital twin"}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Apply Approved Setpoint
              </button>
            </div>
          </div>

          {/* Inspected Scenario Physics and Economics Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Steam Volume</span>
              <p className="text-sm font-bold text-slate-900 mt-1 font-mono">
                {Math.round(inspectedScenario.steam_volume_tonnes).toLocaleString()} t
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Pumping Speed</span>
              <p className="text-sm font-bold text-slate-900 mt-1 font-mono">{inspectedScenario.spm.toFixed(1)} SPM</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">VFD Asymmetry</span>
              <p className="text-sm font-bold text-blue-700 mt-1 font-mono">{inspectedScenario.vfd_downstroke_ratio.toFixed(2)}x</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Modeled Oil</span>
              <p className="text-sm font-bold text-slate-900 mt-1 font-mono">
                {Math.round(inspectedScenario.cumulative_oil_bbl).toLocaleString()} bbl
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Steam-Oil Ratio</span>
              <p className="text-sm font-bold text-slate-900 mt-1 font-mono">{inspectedScenario.steam_oil_ratio.toFixed(2)} t/t</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Net Benefit</span>
              <p className="text-sm font-bold text-emerald-700 mt-1 font-mono">
                ${Math.round(inspectedScenario.net_benefit_usd).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-medium">Float Margin (≥1.0)</span>
              <p className={`text-sm font-bold mt-1 font-mono ${inspectedScenario.min_float_margin_index < 1.0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {inspectedScenario.min_float_margin_index.toFixed(3)}
              </p>
            </div>
          </div>

          {/* Violations or Warnings if any */}
          {inspectedScenario.violations && inspectedScenario.violations.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Hard Constraint Violations:</span>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  {inspectedScenario.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Insight Callout if provided */}
      {summaryInsight && (
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900 shadow-xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-blue-900 font-semibold">Model Assessment:</strong> {summaryInsight}
          </p>
        </div>
      )}

      {/* Detailed Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {scenarios.map((sc) => {
          const isRec = sc.scenario_id === recommendedId || sc.is_recommended;
          const isFloatViolator = sc.min_float_margin_index < 1.0;
          const isApproved = approvedScenarioId === sc.scenario_id;

          return (
            <div
              key={sc.scenario_id}
              className={`rounded-xl border transition-all flex flex-col justify-between ${
                isRec
                  ? 'bg-emerald-50/40 border-2 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                  : isFloatViolator
                  ? 'bg-rose-50/30 border border-rose-200 shadow-xs'
                  : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
              } p-4 space-y-4`}
            >
              {/* Header */}
              <div className="space-y-1.5 pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                    {sc.scenario_id.toUpperCase()}
                  </span>
                  {isRec && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-emerald-600" /> Optimal
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-slate-900 leading-snug">{sc.label}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed min-h-[2.5rem]">{sc.description}</p>
                <div className="pt-1">
                  <StatusBadge status={sc.status} />
                </div>
              </div>

              {/* Operating Parameters */}
              <div className="space-y-2 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Inputs</span>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Steam:</span>
                  <span className="font-semibold text-slate-900">{Math.round(sc.steam_volume_tonnes).toLocaleString()} t</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Soak Period:</span>
                  <span>{sc.soak_days} days</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Speed:</span>
                  <span className="font-semibold text-slate-900">{sc.spm.toFixed(1)} SPM</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Stroke Length:</span>
                  <span>{sc.stroke_length_inch}"</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">VFD α_down:</span>
                  <span className={sc.vfd_downstroke_ratio < 1.0 ? 'text-blue-700 font-semibold' : ''}>
                    {sc.vfd_downstroke_ratio.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Resulting Simulated KPIs */}
              <div className="space-y-2 text-xs pt-3 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Simulated KPIs</span>

                <div className="flex justify-between">
                  <span className="text-slate-500">Net Benefit:</span>
                  <span className={`font-semibold ${isRec ? 'text-emerald-700' : 'text-slate-900'}`}>
                    ${Math.round(sc.net_benefit_usd).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Cumulative Oil:</span>
                  <span>{Math.round(sc.cumulative_oil_bbl).toLocaleString()} bbl</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">SOR (Mass Basis):</span>
                  <span className={isRec ? 'text-emerald-700 font-bold' : ''}>{sc.steam_oil_ratio.toFixed(2)} t/t</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Float Margin:</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                      sc.min_float_margin_index < 1.0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {sc.min_float_margin_index.toFixed(3)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-1.5">
                <button
                  onClick={() => setInspectedScenario(sc)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Scenario</span>
                </button>
                {isApproved && (
                  <span className="text-[10px] font-bold text-center text-emerald-700 bg-emerald-50 py-1 rounded border border-emerald-200">
                    Approved · Ready to Apply
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
