import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { BreweryRebateClaimRecord } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Award, 
  CheckCircle2, 
  Clock, 
  Send, 
  Plus, 
  Search, 
  X, 
  FileText, 
  Building2, 
  TrendingUp, 
  ArrowRight,
  Layers,
  Sparkles
} from 'lucide-react';

export const BreweryRebatesManager: React.FC = () => {
  const { 
    breweryRebates, 
    addBreweryRebate, 
    reconcileBreweryRebateToLedger,
    suppliers
  } = useErp();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewRebateModalOpen, setIsNewRebateModalOpen] = useState(false);
  const [selectedForReconcile, setSelectedForReconcile] = useState<BreweryRebateClaimRecord | null>(null);
  const [creditNoteInput, setCreditNoteInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State for new rebate claim
  const [supplierName, setSupplierName] = useState('East African Breweries Ltd (EABL)');
  const [claimMonth, setClaimMonth] = useState('October 2026');
  const [targetTurnoverKes, setTargetTurnoverKes] = useState<number>(10000000);
  const [actualAchievedVolumeKes, setActualAchievedVolumeKes] = useState<number>(11500000);
  const [rebateRatePercent, setRebateRatePercent] = useState<number>(2.5);

  const calculatedRebateAmount = Math.round((actualAchievedVolumeKes || 0) * ((rebateRatePercent || 0) / 100));

  // Metrics
  const totalRebatesClaimed = breweryRebates.reduce((sum, r) => sum + r.rebateAmountKes, 0);
  const totalReconciled = breweryRebates
    .filter(r => r.claimStatus === 'RECONCILED_IN_LEDGER')
    .reduce((sum, r) => sum + r.rebateAmountKes, 0);
  const pendingCreditNotes = breweryRebates.filter(r => r.claimStatus !== 'RECONCILED_IN_LEDGER');
  const pendingCreditNotesKes = pendingCreditNotes.reduce((sum, r) => sum + r.rebateAmountKes, 0);

  const filteredRebates = breweryRebates.filter(r => {
    if (statusFilter !== 'ALL' && r.claimStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.supplierName.toLowerCase().includes(q) && !r.month.toLowerCase().includes(q) && !(r.creditNoteNumber || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleCreateRebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualAchievedVolumeKes <= 0 || rebateRatePercent <= 0) return;

    await addBreweryRebate({
      month: claimMonth,
      supplierName,
      targetTurnoverKes,
      actualAchievedVolumeKes,
      rebateRatePercent,
      rebateAmountKes: calculatedRebateAmount,
      claimStatus: 'SUBMITTED'
    });

    setFeedbackMsg(
      `Submitted brewery rebate claim of ${formatKes(calculatedRebateAmount)} for ${supplierName} (${claimMonth}).`
    );
    setIsNewRebateModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleConfirmReconcileCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForReconcile) return;

    const cn = creditNoteInput.trim() || `EABL-CN-${Date.now().toString().slice(-5)}`;
    const success = await reconcileBreweryRebateToLedger(selectedForReconcile.id, cn);
    if (success) {
      setFeedbackMsg(
        `Applied brewery credit note ${cn} (${formatKes(selectedForReconcile.rebateAmountKes)}) to Accounts Payable. COGS volume discount credited in General Ledger.`
      );
      setSelectedForReconcile(null);
      setCreditNoteInput('');
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between text-xs font-semibold text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Action */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#0A006E]">
            <Award className="w-5 h-5 text-[#0A006E]" />
            <h3 className="font-montserrat font-black text-lg text-slate-900">
              Brewery Volume Rebates &amp; Supplier Claims
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Liquor distribution volume incentive and margin rebate manager. Track monthly turnover targets achieved with EABL, UDV, Keroche, and Diageo. Offset brewery credit notes directly against trade payable liabilities in the General Ledger.
          </p>
        </div>

        <button
          onClick={() => setIsNewRebateModalOpen(true)}
          className="px-4 py-2.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFDE00]" />
          <span>File Monthly Rebate Claim</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rebates Claimed</span>
          <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
            {formatKes(totalRebatesClaimed)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{breweryRebates.length} monthly claims</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending Credit Notes</span>
          <div className="font-montserrat font-black text-xl text-amber-900 mt-1">
            {formatKes(pendingCreditNotesKes)}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{pendingCreditNotes.length} awaiting settlement</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Reconciled to Ledger</span>
          <div className="font-montserrat font-black text-xl text-emerald-900 mt-1">
            {formatKes(totalReconciled)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Trade payables offset applied</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Target Achievement Rate</span>
          <div className="font-montserrat font-black text-xl text-blue-900 mt-1">
            112.4%
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-0.5">Tier 1 super-distributor quota</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-[#0A006E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Claims ({breweryRebates.length})
          </button>
          <button
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'SUBMITTED' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Submitted ({breweryRebates.filter(r => r.claimStatus === 'SUBMITTED').length})
          </button>
          <button
            onClick={() => setStatusFilter('CREDIT_NOTE_RECEIVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'CREDIT_NOTE_RECEIVED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Credit Notes In Hand ({breweryRebates.filter(r => r.claimStatus === 'CREDIT_NOTE_RECEIVED').length})
          </button>
          <button
            onClick={() => setStatusFilter('RECONCILED_IN_LEDGER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'RECONCILED_IN_LEDGER' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Reconciled to Ledger ({breweryRebates.filter(r => r.claimStatus === 'RECONCILED_IN_LEDGER').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search supplier, month, credit note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-56 sm:w-64"
          />
        </div>
      </div>

      {/* Rebates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredRebates.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Award className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No brewery rebate claims found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Supplier &amp; Period</th>
                  <th className="py-3 px-3">Target vs Volume Achieved</th>
                  <th className="py-3 px-3">Quota Completion</th>
                  <th className="py-3 px-3">Rebate Margin</th>
                  <th className="py-3 px-3">Claim Amount (KES)</th>
                  <th className="py-3 px-3">Credit Note #</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRebates.map(item => {
                  const pct = Math.round((item.actualAchievedVolumeKes / (item.targetTurnoverKes || 1)) * 100);
                  const isSettled = item.claimStatus === 'RECONCILED_IN_LEDGER';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-bold text-slate-900">{item.supplierName}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Month: {item.month}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-emerald-800">
                          {formatKes(item.actualAchievedVolumeKes)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Target: {formatKes(item.targetTurnoverKes)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`font-mono font-bold text-xs ${pct >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {item.rebateRatePercent}%
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm">
                        {formatKes(item.rebateAmountKes)}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-800 font-bold">
                        {item.creditNoteNumber || 'Pending CN'}
                      </td>

                      <td className="py-3 px-3">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>RECONCILED TO LEDGER</span>
                          </span>
                        ) : item.claimStatus === 'CREDIT_NOTE_RECEIVED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>CN IN HAND • READY TO APPLY</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>SUBMITTED TO BREWERY</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isSettled ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedForReconcile(item);
                              setCreditNoteInput(item.creditNoteNumber || '');
                            }}
                            className="px-2.5 py-1.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer ml-auto"
                          >
                            <Send className="w-3 h-3 text-[#FFDE00]" />
                            <span>Reconcile CN</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">
                            Settled By {item.reconciledBy || 'Accountant'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: File Monthly Rebate Claim */}
      {isNewRebateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm sm:text-base text-white">
                    File Monthly Volume Rebate Claim
                  </h3>
                  <p className="text-[11px] text-[#FFDE00] font-semibold">
                    Brewery volume achievement &amp; margin recovery
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewRebateModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRebate} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="font-montserrat font-bold text-slate-800">Brewery / Supplier</label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="East African Breweries Ltd (EABL)">East African Breweries Ltd (EABL)</option>
                  <option value="United Distillers & Vintners (UDV Kenya)">United Distillers &amp; Vintners (UDV Kenya)</option>
                  <option value="Kenya Breweries Ltd (KBL)">Kenya Breweries Ltd (KBL)</option>
                  <option value="Keroche Breweries Ltd">Keroche Breweries Ltd</option>
                  <option value="Kenya Wine Agencies Ltd (KWAL)">Kenya Wine Agencies Ltd (KWAL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Claim Period Month</label>
                  <input
                    type="text"
                    required
                    value={claimMonth}
                    onChange={(e) => setClaimMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Rebate Margin (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={25}
                    required
                    value={rebateRatePercent}
                    onChange={(e) => setRebateRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Target Turnover (KES)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetTurnoverKes}
                    onChange={(e) => setTargetTurnoverKes(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Actual Achieved Volume (KES)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={actualAchievedVolumeKes}
                    onChange={(e) => setActualAchievedVolumeKes(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculated Rebate Amount Banner */}
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Accrued Volume Rebate:</span>
                  <div className="font-mono font-black text-emerald-950 text-base">{formatKes(calculatedRebateAmount)}</div>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-200 text-emerald-950 font-mono font-bold text-xs">
                  {rebateRatePercent}% on {formatKes(actualAchievedVolumeKes)}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewRebateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] hover:bg-indigo-950 text-[#FFDE00] rounded-xl text-xs font-montserrat font-bold shadow-sm transition cursor-pointer"
                >
                  Submit Rebate Claim
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reconcile Credit Note into Accounts Payable */}
      {selectedForReconcile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#FFDE00]" />
                <h3 className="font-montserrat font-black text-sm text-white">
                  Reconcile Brewery Credit Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForReconcile(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReconcileCreditNote} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Apply credit note for <strong>{selectedForReconcile.supplierName}</strong> ({selectedForReconcile.month}) valued at <strong>{formatKes(selectedForReconcile.rebateAmountKes)}</strong>.
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-800">
                  <span>Dr. 2010 Accounts Payable (Distilleries):</span>
                  <span className="font-bold">{formatKes(selectedForReconcile.rebateAmountKes)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Cr. 5010 COGS Supplier Rebate Recovery:</span>
                  <span className="font-bold">{formatKes(selectedForReconcile.rebateAmountKes)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-montserrat font-bold text-slate-800">
                  Supplier Credit Note Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EABL-CN-2026-90412"
                  value={creditNoteInput}
                  onChange={(e) => setCreditNoteInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedForReconcile(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                  <span>Post CN to General Ledger</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
