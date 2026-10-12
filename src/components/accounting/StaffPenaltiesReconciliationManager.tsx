import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { StaffDeductionItem, StaffDeductionType } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Scale, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  BookOpen, 
  Send, 
  Filter, 
  Search, 
  X, 
  DollarSign, 
  ArrowRight, 
  Check, 
  Ban, 
  FileText,
  Calendar,
  Building2,
  TrendingUp,
  FileCheck
} from 'lucide-react';

export const StaffPenaltiesReconciliationManager: React.FC = () => {
  const { 
    staffDeductions, 
    reconcileStaffDeduction, 
    waiveStaffDeduction,
    chartOfAccounts,
    currentUser,
    payrollRecords
  } = useErp();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPLIED' | 'RECONCILED' | 'WAIVED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeductionForRecon, setSelectedDeductionForRecon] = useState<StaffDeductionItem | null>(null);
  const [selectedDeductionForWaive, setSelectedDeductionForWaive] = useState<StaffDeductionItem | null>(null);

  // Reconciliation Modal Form State
  const [recoveryAccount, setRecoveryAccount] = useState<string>('4090');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [isSubmittingRecon, setIsSubmittingRecon] = useState(false);
  const [reconFeedback, setReconFeedback] = useState<string | null>(null);

  // Waive Modal Form State
  const [waiveReason, setWaiveReason] = useState('');

  // Metrics
  const totalDeductions = staffDeductions.reduce((sum, d) => sum + d.amountKes, 0);
  const totalPenalties = staffDeductions.filter(d => d.isPenalty).reduce((sum, d) => sum + d.amountKes, 0);
  const pendingDeductions = staffDeductions.filter(d => d.status === 'APPLIED');
  const pendingTotalKes = pendingDeductions.reduce((sum, d) => sum + d.amountKes, 0);
  const reconciledDeductions = staffDeductions.filter(d => d.status === 'RECONCILED');
  const reconciledTotalKes = reconciledDeductions.reduce((sum, d) => sum + d.amountKes, 0);

  // Filtered List
  const filteredDeductions = staffDeductions.filter(item => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = item.employeeName.toLowerCase().includes(q);
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesDoc = (item.referenceDocNumber || '').toLowerCase().includes(q);
      const matchesReason = item.reason.toLowerCase().includes(q);
      if (!matchesName && !matchesTitle && !matchesDoc && !matchesReason) return false;
    }
    return true;
  });

  const handleOpenReconcileModal = (item: StaffDeductionItem) => {
    setSelectedDeductionForRecon(item);
    // Suggest optimal recovery account based on deduction type
    if (item.type === 'STOCK_BREAKAGE') {
      setRecoveryAccount('5040'); // Stock Breakage, Transit Loss & Spoilage Offset
    } else if (item.type === 'CASH_SHORTAGE') {
      setRecoveryAccount('1060'); // Route Driver & Cashier Shortage Suspense
    } else if (item.type === 'SALARY_ADVANCE') {
      setRecoveryAccount('1050'); // Staff Salary Advances Receivable
    } else {
      setRecoveryAccount('4090'); // Staff Penalties & Disciplinary Recovery Income
    }
    setReconciliationNotes(
      `Reconciled against ${item.monthYear} payroll run. Offset against ${item.referenceDocNumber || 'incident record'}.`
    );
  };

  const handleConfirmReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeductionForRecon) return;

    setIsSubmittingRecon(true);
    try {
      const success = await reconcileStaffDeduction(
        selectedDeductionForRecon.id,
        reconciliationNotes.trim(),
        recoveryAccount
      );
      if (success) {
        setReconFeedback(
          `Successfully reconciled ${formatKes(selectedDeductionForRecon.amountKes)} for ${selectedDeductionForRecon.employeeName} into General Ledger Account ${recoveryAccount}. Balanced journal entry posted.`
        );
        setSelectedDeductionForRecon(null);
        setTimeout(() => setReconFeedback(null), 5000);
      }
    } finally {
      setIsSubmittingRecon(false);
    }
  };

  const handleConfirmWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeductionForWaive || !waiveReason.trim()) return;

    const success = await waiveStaffDeduction(selectedDeductionForWaive.id, waiveReason.trim());
    if (success) {
      setReconFeedback(
        `Disciplinary penalty of ${formatKes(selectedDeductionForWaive.amountKes)} for ${selectedDeductionForWaive.employeeName} waived by management. Payslip net amount adjusted.`
      );
      setSelectedDeductionForWaive(null);
      setWaiveReason('');
      setTimeout(() => setReconFeedback(null), 5000);
    }
  };

  const recoveryAccountOptions = [
    { code: '4090', name: '4090 • Staff Penalties & Disciplinary Recovery Income (Revenue)' },
    { code: '5040', name: '5040 • Stock Breakage, Transit Loss & Spoilage Offset (COGS Offset)' },
    { code: '1060', name: '1060 • Route Driver & Cashier Shortage Suspense Recovery (Asset Clearing)' },
    { code: '1050', name: '1050 • Staff Salary Advances Receivable Recovery (Asset Clearing)' },
    { code: '1010', name: '1010 • Cash on Hand - Retail Tills' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Feedback Banner */}
      {reconFeedback && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between text-xs font-semibold text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{reconFeedback}</span>
          </div>
          <button
            onClick={() => setReconFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Explanation */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#0A006E]">
            <Scale className="w-5 h-5 text-[#0A006E]" />
            <h3 className="font-montserrat font-black text-lg text-slate-900">
              Staff Penalties &amp; Monies Deducted Reconciliation
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Accountant audit &amp; reconciliation desk for staff deductions applied by HR (warehouse bottle breakages, van route cash shortages, tardiness fines, mid-month salary advances). Post balanced recovery journal entries directly into the General Ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
            {pendingDeductions.length} Pending Audit
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Deductions Applied</span>
          <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
            {formatKes(totalDeductions)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{staffDeductions.length} staff record(s)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Disciplinary Penalties Pool</span>
          <div className="font-montserrat font-black text-xl text-rose-700 mt-1">
            {formatKes(totalPenalties)}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">Breakages, shortages &amp; fines</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending Accountant Audit</span>
          <div className="font-montserrat font-black text-xl text-amber-900 mt-1">
            {formatKes(pendingTotalKes)}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{pendingDeductions.length} deduction(s) to settle</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Reconciled in General Ledger</span>
          <div className="font-montserrat font-black text-xl text-emerald-900 mt-1">
            {formatKes(reconciledTotalKes)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">{reconciledDeductions.length} settled to ledger</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-[#0A006E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Deductions ({staffDeductions.length})
          </button>
          <button
            onClick={() => setStatusFilter('APPLIED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'APPLIED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending Audit ({pendingDeductions.length})
          </button>
          <button
            onClick={() => setStatusFilter('RECONCILED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'RECONCILED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Reconciled ({reconciledDeductions.length})
          </button>
          <button
            onClick={() => setStatusFilter('WAIVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'WAIVED' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Waived ({staffDeductions.filter(d => d.status === 'WAIVED').length})
          </button>
        </div>

        {/* Search & Type Filter */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
          >
            <option value="ALL">All Deduction Types</option>
            <option value="STOCK_BREAKAGE">Stock Breakages</option>
            <option value="CASH_SHORTAGE">Cash &amp; Route Shortages</option>
            <option value="LATE_ABSENCE_PENALTY">Absence &amp; Tardiness Fines</option>
            <option value="SALARY_ADVANCE">Salary Advances</option>
            <option value="UNIFORM_EQUIPMENT">Uniform / Asset Damage</option>
            <option value="COMPLIANCE_FINE">Compliance Fines</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff, ref, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-48 sm:w-56"
            />
          </div>
        </div>

      </div>

      {/* Main Deductions & Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredDeductions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Scale className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No deductions match the selected filters.</p>
            <p className="text-[11px] text-slate-400">All staff penalties and deductions are either balanced or non-existent.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Classification &amp; Title</th>
                  <th className="py-3 px-3">Incident Ref / Date</th>
                  <th className="py-3 px-3">Amount Deducted</th>
                  <th className="py-3 px-3">Reason / Details</th>
                  <th className="py-3 px-3">Audit &amp; Ledger Status</th>
                  <th className="py-3 px-4 text-right">Accountant Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeductions.map(item => {
                  const isPending = item.status === 'APPLIED';
                  const isReconciled = item.status === 'RECONCILED';
                  const isWaived = item.status === 'WAIVED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-bold text-slate-900">{item.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Period: {item.monthYear}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 text-xs">{item.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.isPenalty ? (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-montserrat font-black text-[9px]">
                              DISCIPLINARY PENALTY
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-montserrat font-bold text-[9px]">
                              ADVANCE RECOVERY
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">{item.type}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-800 text-xs">{item.referenceDocNumber || 'N/A'}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{item.incidentDate}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-rose-700 text-sm">
                        -{formatKes(item.amountKes)}
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-slate-700 text-xs line-clamp-2" title={item.reason}>
                          {item.reason}
                        </div>
                        {item.reconciliationNotes && (
                          <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                            Audit note: {item.reconciliationNotes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {isReconciled ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>RECONCILED TO LEDGER</span>
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Acct {item.recoveryAccountCode} • {item.journalEntryId}
                            </div>
                          </div>
                        ) : isWaived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            <Ban className="w-3 h-3 text-slate-500" />
                            <span>WAIVED BY MGMT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>PENDING ACCOUNTANT RECONCILIATION</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReconcileModal(item)}
                              className="px-2.5 py-1.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <FileCheck className="w-3 h-3 text-[#FFDE00]" />
                              <span>Reconcile Monies</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDeductionForWaive(item)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="Waive penalty"
                            >
                              Waive
                            </button>
                          </div>
                        ) : isReconciled ? (
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">
                            Settled By {item.reconciledBy || 'Accountant'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Waived</span>
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

      {/* MODAL 1: Reconcile Monies Deducted into General Ledger */}
      {selectedDeductionForRecon && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm sm:text-base text-white">
                    Reconcile Deduction into General Ledger
                  </h3>
                  <p className="text-[11px] text-[#FFDE00] font-semibold">
                    Post double-entry recovery for {selectedDeductionForRecon.employeeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeductionForRecon(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReconciliation} className="p-5 space-y-4 text-xs">
              
              {/* Deduction Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Staff Member:</span>
                  <span className="font-montserrat font-bold text-slate-900">{selectedDeductionForRecon.employeeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Deduction Title:</span>
                  <span className="font-medium text-slate-800">{selectedDeductionForRecon.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Incident / Doc Ref:</span>
                  <span className="font-mono text-slate-800">{selectedDeductionForRecon.referenceDocNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Amount to Reconcile:</span>
                  <span className="font-mono font-black text-rose-700 text-sm">{formatKes(selectedDeductionForRecon.amountKes)}</span>
                </div>
              </div>

              {/* Recovery Account Selection */}
              <div className="space-y-1.5">
                <label className="font-montserrat font-bold text-slate-800">
                  Select Recovery / Offset Account (General Ledger) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={recoveryAccount}
                  onChange={(e) => setRecoveryAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                >
                  {recoveryAccountOptions.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Double-entry effect: <strong>Dr. 6010 Salaries Expense / Payroll Clearing</strong> (deducted from employee) and <strong>Cr. Account {recoveryAccount}</strong> (offsetting the loss or recognizing recovery revenue).
                </p>
              </div>

              {/* Accountant Audit Notes */}
              <div className="space-y-1.5">
                <label className="font-montserrat font-bold text-slate-800">
                  Accountant Reconciliation Notes &amp; Voucher Reference
                </label>
                <textarea
                  rows={3}
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  placeholder="Enter audit reconciliation notes, management reference, or breakage settlement voucher details..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedDeductionForRecon(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecon}
                  className="px-5 py-2 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#FFDE00]" />
                  <span>Confirm &amp; Post to Ledger</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Waive Disciplinary Penalty */}
      {selectedDeductionForWaive && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-amber-400" />
                <h3 className="font-montserrat font-black text-sm text-white">
                  Waive Disciplinary Penalty
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeductionForWaive(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmWaive} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Are you sure you want to waive the penalty of <strong>{formatKes(selectedDeductionForWaive.amountKes)}</strong> for <strong>{selectedDeductionForWaive.employeeName}</strong>? This will cancel the deduction from their payslip.
              </p>

              <div className="space-y-1.5">
                <label className="font-montserrat font-bold text-slate-800">
                  Management Waiver Justification <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="e.g. Approved by Director: Breakage occurred due to third-party courier collision insured under marine transit policy."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedDeductionForWaive(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-bold shadow-sm transition cursor-pointer"
                >
                  Confirm Waiver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
