import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { DailyRouteCashUpRecord } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Plus, 
  Search, 
  X, 
  FileText, 
  User, 
  DollarSign, 
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Package
} from 'lucide-react';

export const DailyRouteCashUpManager: React.FC = () => {
  const { 
    dailyRouteCashUps, 
    addDailyRouteCashUp, 
    reconcileRouteCashUpToLedger,
    employees
  } = useErp();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewCashUpModalOpen, setIsNewCashUpModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State for New Van Route Cash-Up Record
  const [routeCode, setRouteCode] = useState('ROUTE-WESTLANDS-02');
  const [routeName, setRouteName] = useState('Westlands & Parklands Lounges & Bars');
  const [vehicleReg, setVehicleReg] = useState('KDM 284P (Isuzu 4-Ton Canter)');
  const [driverName, setDriverName] = useState(employees[0]?.name || 'Peter Kamau');
  const [salesRepName, setSalesRepName] = useState('Moses Muya');
  const [invoicedValueKes, setInvoicedValueKes] = useState<number>(450000);
  const [cashCollectedKes, setCashCollectedKes] = useState<number>(180000);
  const [mpesaCollectedKes, setMpesaCollectedKes] = useState<number>(200000);
  const [chequesCollectedKes, setChequesCollectedKes] = useState<number>(45000);
  const [b2bCreditInvoicedKes, setB2bCreditInvoicedKes] = useState<number>(20000);
  const [breakagesValueKes, setBreakagesValueKes] = useState<number>(3000);
  const [emptiesReturnedCrates, setEmptiesReturnedCrates] = useState<number>(75);
  const [emptiesReturnedBottles, setEmptiesReturnedBottles] = useState<number>(1875);
  const [routeNotes, setRouteNotes] = useState('');

  // Reconcile Modal confirmation state
  const [reconcilingRecord, setReconcilingRecord] = useState<DailyRouteCashUpRecord | null>(null);
  const [transferShortageToPenalty, setTransferShortageToPenalty] = useState(true);

  // Computed Live Variance for Form
  const totalAccountedFor = 
    (cashCollectedKes || 0) + 
    (mpesaCollectedKes || 0) + 
    (chequesCollectedKes || 0) + 
    (b2bCreditInvoicedKes || 0) + 
    (breakagesValueKes || 0);
  const liveVariance = totalAccountedFor - (invoicedValueKes || 0);

  // Metrics
  const totalInvoiced = dailyRouteCashUps.reduce((sum, r) => sum + r.invoicedValueKes, 0);
  const totalCashCollected = dailyRouteCashUps.reduce((sum, r) => sum + r.cashCollectedKes, 0);
  const totalMpesaCollected = dailyRouteCashUps.reduce((sum, r) => sum + r.mpesaCollectedKes, 0);
  const totalBreakages = dailyRouteCashUps.reduce((sum, r) => sum + r.breakagesValueKes, 0);
  const totalShortages = dailyRouteCashUps
    .filter(r => r.varianceKes < 0)
    .reduce((sum, r) => sum + Math.abs(r.varianceKes), 0);

  const filteredRoutes = dailyRouteCashUps.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRoute = r.routeCode.toLowerCase().includes(q) || r.routeName.toLowerCase().includes(q);
      const matchVehicle = r.vehicleReg.toLowerCase().includes(q);
      const matchPerson = r.driverName.toLowerCase().includes(q) || r.salesRepName.toLowerCase().includes(q);
      if (!matchRoute && !matchVehicle && !matchPerson) return false;
    }
    return true;
  });

  const handleCreateCashUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invoicedValueKes <= 0) return;

    const newRec = await addDailyRouteCashUp({
      date: new Date().toISOString().substring(0, 10),
      routeCode,
      routeName,
      vehicleReg,
      driverName,
      salesRepName,
      invoicedValueKes,
      cashCollectedKes,
      mpesaCollectedKes,
      chequesCollectedKes,
      b2bCreditInvoicedKes,
      breakagesValueKes,
      varianceKes: liveVariance,
      status: liveVariance < 0 ? 'SHORTAGE_FLAGGED' : liveVariance === 0 ? 'BALANCED' : 'BALANCED',
      emptiesReturnedCrates,
      emptiesReturnedBottles,
      notes: routeNotes
    });

    setFeedbackMsg(
      `Created route cash-up record for ${routeCode} (${vehicleReg}). Variance: ${liveVariance === 0 ? 'Balanced' : formatKes(liveVariance)}.`
    );
    setIsNewCashUpModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleConfirmReconcileToLedger = async () => {
    if (!reconcilingRecord) return;
    const success = await reconcileRouteCashUpToLedger(
      reconcilingRecord.id,
      transferShortageToPenalty
    );
    if (success) {
      setFeedbackMsg(
        `Route ${reconcilingRecord.routeCode} settled and balanced into General Ledger. ${
          reconcilingRecord.varianceKes < 0 && transferShortageToPenalty
            ? `Shortage of ${formatKes(Math.abs(reconcilingRecord.varianceKes))} transferred directly to ${reconcilingRecord.driverName}'s staff payroll deduction.`
            : ''
        }`
      );
      setReconcilingRecord(null);
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
            <Truck className="w-5 h-5 text-[#0A006E]" />
            <h3 className="font-montserrat font-black text-lg text-slate-900">
              Daily Route &amp; Van Cash-Up Sales Reconciliation
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Liquor delivery truck evening cashiering desk. Match dispatched goods (cases/cartons) against Cash collections, M-Pesa B2B Paybill, Post-Dated Cheques, approved Credit lines, and in-transit breakages. Automatically flag route cash shortages against driver floats.
          </p>
        </div>

        <button
          onClick={() => setIsNewCashUpModalOpen(true)}
          className="px-4 py-2.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFDE00]" />
          <span>Log Evening Van Cash-Up</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Route Invoiced</span>
          <div className="font-montserrat font-black text-lg sm:text-xl text-slate-900 mt-1">
            {formatKes(totalInvoiced)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{dailyRouteCashUps.length} truck route(s)</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Cash Collected (Banked)</span>
          <div className="font-montserrat font-black text-lg sm:text-xl text-emerald-900 mt-1">
            {formatKes(totalCashCollected)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Physical cash counted</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">M-Pesa B2B / Till</span>
          <div className="font-montserrat font-black text-lg sm:text-xl text-blue-900 mt-1">
            {formatKes(totalMpesaCollected)}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-0.5">Daraja verified remittances</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-200 bg-purple-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">In-Transit Breakages</span>
          <div className="font-montserrat font-black text-lg sm:text-xl text-purple-900 mt-1">
            {formatKes(totalBreakages)}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-0.5">Damaged bottles &amp; cartons</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Total Route Shortages</span>
          <div className="font-montserrat font-black text-lg sm:text-xl text-rose-700 mt-1">
            {formatKes(totalShortages)}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Driver &amp; Rep float variances</div>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-[#0A006E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Routes ({dailyRouteCashUps.length})
          </button>
          <button
            onClick={() => setStatusFilter('SHORTAGE_FLAGGED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'SHORTAGE_FLAGGED' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Shortages Flagged ({dailyRouteCashUps.filter(r => r.status === 'SHORTAGE_FLAGGED').length})
          </button>
          <button
            onClick={() => setStatusFilter('BALANCED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'BALANCED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Balanced ({dailyRouteCashUps.filter(r => r.status === 'BALANCED').length})
          </button>
          <button
            onClick={() => setStatusFilter('RECONCILED_TO_LEDGER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'RECONCILED_TO_LEDGER' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Reconciled to Ledger ({dailyRouteCashUps.filter(r => r.status === 'RECONCILED_TO_LEDGER').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search route, truck reg, driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-56 sm:w-64"
          />
        </div>
      </div>

      {/* Route Cash-Up Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredRoutes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Truck className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No route cash-up records found.</p>
            <p className="text-[11px] text-slate-400">Click &quot;Log Evening Van Cash-Up&quot; to balance delivery lorry returns.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Route &amp; Vehicle</th>
                  <th className="py-3 px-3">Crew (Driver &amp; Rep)</th>
                  <th className="py-3 px-3">Dispatched Value</th>
                  <th className="py-3 px-3">Remittances (Cash • M-Pesa • PDC)</th>
                  <th className="py-3 px-3">Breakages</th>
                  <th className="py-3 px-3">Variance (Shortage)</th>
                  <th className="py-3 px-3">Empties Returned</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoutes.map(item => {
                  const isShortage = item.varianceKes < 0;
                  const isReconciled = item.status === 'RECONCILED_TO_LEDGER';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-bold text-slate-900">{item.routeCode}</div>
                        <div className="text-[11px] text-slate-600 font-medium">{item.routeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vehicleReg} • {item.date}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          <strong>Driver:</strong> {item.driverName}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          <strong>Rep:</strong> {item.salesRepName}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-sm">
                        {formatKes(item.invoicedValueKes)}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-emerald-800 font-bold">
                          Cash: {formatKes(item.cashCollectedKes)}
                        </div>
                        <div className="font-mono text-blue-800 text-[11px]">
                          M-Pesa: {formatKes(item.mpesaCollectedKes)}
                        </div>
                        <div className="font-mono text-slate-500 text-[10px]">
                          Cheques/Credit: {formatKes((item.chequesCollectedKes || 0) + (item.b2bCreditInvoicedKes || 0))}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-purple-900 font-bold">
                        {item.breakagesValueKes > 0 ? formatKes(item.breakagesValueKes) : 'KES 0'}
                      </td>

                      <td className="py-3 px-3">
                        {isShortage ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-black text-xs">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>{formatKes(item.varianceKes)} Shortage</span>
                          </div>
                        ) : item.varianceKes > 0 ? (
                          <span className="font-mono font-bold text-emerald-700">
                            +{formatKes(item.varianceKes)} Surplus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>BALANCED (0.00)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-800">
                          {item.emptiesReturnedCrates} Crates
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.emptiesReturnedBottles} Bottles
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {isReconciled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>RECONCILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>OPEN CASH-UP</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isReconciled ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReconcilingRecord(item);
                              setTransferShortageToPenalty(item.varianceKes < 0);
                            }}
                            className="px-2.5 py-1.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer ml-auto"
                          >
                            <Send className="w-3 h-3 text-[#FFDE00]" />
                            <span>Settle to Ledger</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">
                            {item.journalEntryId || 'Settled'}
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

      {/* MODAL 1: Log New Van Route Cash-Up */}
      {isNewCashUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm sm:text-base text-white">
                    Evening Delivery Van Sales &amp; Cash-Up Entry
                  </h3>
                  <p className="text-[11px] text-[#FFDE00] font-semibold">
                    Reconcile lorry deliveries, remittances, empties &amp; in-transit breakages
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCashUpModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCashUp} className="p-5 overflow-y-auto space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Route Code</label>
                  <input
                    type="text"
                    required
                    value={routeCode}
                    onChange={(e) => setRouteCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Route Area Description</label>
                  <input
                    type="text"
                    required
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Vehicle Registration</label>
                  <input
                    type="text"
                    required
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Lorry Driver Name</label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Van Sales Representative</label>
                  <input
                    type="text"
                    required
                    value={salesRepName}
                    onChange={(e) => setSalesRepName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <label className="font-montserrat font-black text-slate-900 text-xs">
                  Total Dispatched / Invoiced Value (KES) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={invoicedValueKes}
                  onChange={(e) => setInvoicedValueKes(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-[#0A006E] focus:outline-none"
                />
              </div>

              {/* Remittance Breakdown */}
              <div className="space-y-2">
                <span className="font-montserrat font-black text-slate-800 uppercase text-[11px] tracking-wider">
                  Remittances &amp; Settlement Realized
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-emerald-800 text-[11px]">Physical Cash (KES)</label>
                    <input
                      type="number"
                      min={0}
                      value={cashCollectedKes}
                      onChange={(e) => setCashCollectedKes(parseFloat(e.target.value) || 0)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-emerald-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-blue-800 text-[11px]">M-Pesa B2B / Till (KES)</label>
                    <input
                      type="number"
                      min={0}
                      value={mpesaCollectedKes}
                      onChange={(e) => setMpesaCollectedKes(parseFloat(e.target.value) || 0)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-blue-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 text-[11px]">Post-Dated Cheques (KES)</label>
                    <input
                      type="number"
                      min={0}
                      value={chequesCollectedKes}
                      onChange={(e) => setChequesCollectedKes(parseFloat(e.target.value) || 0)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 text-[11px]">Authorized B2B Credit (KES)</label>
                    <input
                      type="number"
                      min={0}
                      value={b2bCreditInvoicedKes}
                      onChange={(e) => setB2bCreditInvoicedKes(parseFloat(e.target.value) || 0)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-purple-800 text-[11px]">Transit Breakages (KES)</label>
                    <input
                      type="number"
                      min={0}
                      value={breakagesValueKes}
                      onChange={(e) => setBreakagesValueKes(parseFloat(e.target.value) || 0)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-purple-900 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Empties Returned */}
              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="font-semibold text-amber-950 text-[11px]">Empties Returned (Crates)</label>
                  <input
                    type="number"
                    min={0}
                    value={emptiesReturnedCrates}
                    onChange={(e) => setEmptiesReturnedCrates(parseInt(e.target.value) || 0)}
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-amber-950 text-[11px]">Returnable Glass Bottles</label>
                  <input
                    type="number"
                    min={0}
                    value={emptiesReturnedBottles}
                    onChange={(e) => setEmptiesReturnedBottles(parseInt(e.target.value) || 0)}
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Variance Calculation Banner */}
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                liveVariance < 0 
                  ? 'bg-rose-50 border-rose-400 text-rose-900' 
                  : liveVariance > 0 
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-emerald-50 border-emerald-500 text-emerald-900'
              }`}>
                <div>
                  <div className="font-montserrat font-black text-xs uppercase">
                    {liveVariance < 0 ? 'Route Cash Shortage Detected' : liveVariance > 0 ? 'Route Surplus Detected' : 'Route Perfectly Balanced'}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    Accounted: {formatKes(totalAccountedFor)} vs Invoiced: {formatKes(invoicedValueKes)}
                  </div>
                </div>
                <div className="font-montserrat font-black text-lg">
                  {formatKes(liveVariance)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-montserrat font-bold text-slate-800">Route Accountant Notes</label>
                <textarea
                  rows={2}
                  value={routeNotes}
                  onChange={(e) => setRouteNotes(e.target.value)}
                  placeholder="Notes on client variances, route stops, police checks or broken crates..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewCashUpModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] hover:bg-indigo-950 text-[#FFDE00] rounded-xl text-xs font-montserrat font-bold shadow-sm transition cursor-pointer"
                >
                  Save Van Cash-Up Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Ledger Settlement and Shortage Transfer */}
      {reconcilingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#FFDE00]" />
                <h3 className="font-montserrat font-black text-sm text-white">
                  Settle Route to Double-Entry Ledger
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReconcilingRecord(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                You are reconciling route <strong>{reconcilingRecord.routeCode}</strong> ({reconcilingRecord.vehicleReg}) with invoiced value of <strong>{formatKes(reconcilingRecord.invoicedValueKes)}</strong>.
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Dr. 1010 Cash on Hand:</span>
                  <span className="font-bold">{formatKes(reconcilingRecord.cashCollectedKes)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dr. 1020 M-Pesa Clearing:</span>
                  <span className="font-bold">{formatKes(reconcilingRecord.mpesaCollectedKes)}</span>
                </div>
                {reconcilingRecord.breakagesValueKes > 0 && (
                  <div className="flex justify-between text-purple-700">
                    <span>Dr. 5040 Transit Breakage Loss:</span>
                    <span className="font-bold">{formatKes(reconcilingRecord.breakagesValueKes)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-800">
                  <span>Cr. 4010 Wholesale Beverage Sales:</span>
                  <span className="font-bold">{formatKes(reconcilingRecord.invoicedValueKes)}</span>
                </div>
              </div>

              {reconcilingRecord.varianceKes < 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Route Shortage: {formatKes(Math.abs(reconcilingRecord.varianceKes))}</span>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={transferShortageToPenalty}
                      onChange={(e) => setTransferShortageToPenalty(e.target.checked)}
                      className="mt-0.5 rounded text-[#0A006E] focus:ring-[#0A006E]"
                    />
                    <span className="text-[11px] leading-tight">
                      <strong>Transfer Shortage to Staff Penalty:</strong> Automatically apply a deduction to driver <strong>{reconcilingRecord.driverName}</strong>&apos;s payslip under Cash Shortages for HR recovery.
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReconcilingRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReconcileToLedger}
                  className="px-5 py-2 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                  <span>Confirm Settlement</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
