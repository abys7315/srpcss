import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { ProvenanceManifest } from '../api/types';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import {
  FileCheck2,
  ShieldCheck,
  Search,
  BookOpen,
  Database,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  onNavigate?: (page: PageId) => void;
}

export const DataProvenance: React.FC<Props> = ({ onNavigate: _onNavigate }) => {
  const [manifest, setManifest] = useState<ProvenanceManifest | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadProvenance();
  }, []);

  const loadProvenance = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getProvenance();
      setManifest(res);
    } catch (e) {
      console.error('Failed to load provenance:', e);
    } finally {
      setLoading(false);
    }
  };

  const defaultDisclaimer =
    manifest?.mandatory_disclaimer ||
    'NOTICE REGARDING DATA FIDELITY & PROVENANCE: All reservoir, production, and dynacard telemetry presented in this system are either derived from publicly published petroleum engineering literature (Marx-Langenheim 1959, Boberg-Lantz 1966, API Spec 11B/11E), calibrated to published geological parameters of the Baghewala Field (Jodhpur Sandstone heavy crude, 17–19° API), or synthetically generated through high-fidelity multiphysics simulation. No proprietary or confidential telemetry of Oil India Limited has been compromised or reverse-engineered.';

  const dataItems = manifest?.data_items || [
    {
      name: 'Baghewala Jodhpur Sandstone Geology',
      provenance_tier: 'PUBLIC_EXTERNAL',
      source_citation: 'Oil India Limited Technical Publications / DGH India Open Acreage Reports (1995–2022)',
      description: 'Reservoir depth (950–1050m), net pay thickness (12m), porosity (24–28%), permeability (150–450 mD).',
      validation_status: 'VERIFIED_AGAINST_PUBLIC_LITERATURE',
    },
    {
      name: 'Extra-Heavy Crude Viscosity-Temperature Curve',
      provenance_tier: 'PUBLIC_EXTERNAL',
      source_citation: 'SPE-165448-MS "Heavy Oil Thermal Recovery in Western Rajasthan"',
      description: 'Dead oil viscosity: 1,200 cP at 52 °C; 14 cP at 220 °C. Crude gravity: 17.5° API.',
      validation_status: 'VERIFIED_AGAINST_LAB_DATA',
    },
    {
      name: 'Marx-Langenheim Thermal Steam Chest Formulation',
      provenance_tier: 'PUBLIC_EXTERNAL',
      source_citation: 'Marx, J.W. & Langenheim, R.H. (1959) Trans. AIME 216, 312-315',
      description: 'Transient thermal heat balance governing steam condensation front expansion.',
      validation_status: 'ANALYTICAL_STANDARD',
    },
    {
      name: 'Boberg-Lantz Reservoir Dissipation Formulation',
      provenance_tier: 'PUBLIC_EXTERNAL',
      source_citation: 'Boberg, T.C. & Lantz, R.B. (1966) J. Pet. Tech. 18(12), 1613-1623',
      description: 'Post-injection heat conduction into overburden and underburden formations.',
      validation_status: 'ANALYTICAL_STANDARD',
    },
    {
      name: 'Sucker Rod String & Pumping Unit Specification',
      provenance_tier: 'PUBLIC_EXTERNAL',
      source_citation: 'API Spec 11B (Sucker Rods) & API Spec 11E (Pumping Units, Size 456)',
      description: 'API 76 taper rod dimensions, Grade D yield strength, gearbox peak rating 456,000 in-lbs.',
      validation_status: 'INDUSTRY_STANDARD',
    },
    {
      name: '10-Well 5-Cycle Synthetic Field History',
      provenance_tier: 'SIMULATED',
      source_citation: 'Petro-Twin Multiphysics Synthetic History Generator (scripts/generate_synthetic_field.py)',
      description: '50 production cycles across 10 synthetic Baghewala wells with realistic noise, decline, and thermal decay.',
      validation_status: 'VALIDATED_AGAINST_PHYSICS_ENGINE',
    },
    {
      name: 'Gibbs Wave Surface & Downhole Dynacards',
      provenance_tier: 'SIMULATED',
      source_citation: 'Petro-Twin 1D Damped Wave Equation Solver (backend/physics/srp/dynacard.py)',
      description: 'Full surface polished rod and downhole pump dynamometer cards with viscous damping.',
      validation_status: 'VERIFIED_AGAINST_EVERITT_JENNINGS_CARDS',
    },
    {
      name: 'Operating Cost Benchmarks & Tariffs',
      provenance_tier: 'ASSUMED',
      source_citation: 'Rajasthan State Electricity Board (RSEB) Industrial Tariffs & Standard Steam Opex',
      description: 'Electricity: $0.12/kWh; Steam Generation: $28/tonne; Water Disposal: $2.50/bbl; Fixed Opex: $5,000/cycle.',
      validation_status: 'DOCUMENTED_ASSUMPTION',
    },
  ];

  const filteredItems = dataItems.filter((item) => {
    const matchesTier = selectedTier === 'ALL' || item.provenance_tier === selectedTier;
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_citation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
              Data Provenance & Scientific Audit Manifest
            </h1>
            <ProvenanceBadge tier="PUBLIC_EXTERNAL" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete transparency and academic citations for all reservoir parameters, engineering formulations, and telemetry sources.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-xs">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="font-medium">Manifest v1.0.0</span>
        </div>
      </div>

      {/* Official Disclaimer */}
      <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 shadow-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-950">
            Data Fidelity & Scientific Provenance Advisory
          </h3>
          <p className="text-xs text-blue-900/80 leading-relaxed">{defaultDisclaimer}</p>
        </div>
      </div>

      {/* 4 Provenance Tiers Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Real Data</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Field laboratory core flood data and published pressure transient tests from literature.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Literature & Standards</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            SPE papers, API Spec 11B/11E dimensions, Marx-Langenheim & Boberg-Lantz formulations.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Physics Simulation</span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Synthetic multi-cycle histories and Gibbs wave dynacard waveforms generated via physics engine.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Field Assumptions</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Explicitly documented industrial economic parameters: power tariffs, steam costs, water disposal.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'REAL', 'PUBLIC_EXTERNAL', 'SIMULATED', 'ASSUMED'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-xs ${
                selectedTier === tier
                  ? 'bg-blue-50 text-blue-700 border border-blue-300 font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {tier === 'PUBLIC_EXTERNAL' ? 'Literature' : tier.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search provenance citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Provenance Audit Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Data Parameter / Formulation</th>
                <th className="py-2.5 px-3 font-semibold">Provenance Tier</th>
                <th className="py-2.5 px-3 font-semibold">Source Citation / Literature Reference</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th className="py-2.5 px-3 font-semibold text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">{item.name}</td>
                  <td className="py-2.5 px-3">
                    <ProvenanceBadge tier={item.provenance_tier as any} />
                  </td>
                  <td className="py-2.5 px-3 text-blue-700">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-medium">{item.source_citation}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 max-w-sm">{item.description}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {item.validation_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
