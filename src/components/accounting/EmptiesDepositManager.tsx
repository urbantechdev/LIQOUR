import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { EmptiesDepositRecord } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Send, 
  Plus, 
  Search, 
  X, 
  FileText, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const EmptiesDepositManager: React.FC = () => {
  const { 
    emptiesDeposits, 
    addEmptiesDeposit, 
    reconcileEmptiesDeposit,
    suppliers,
    distributors
  } = useErp();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RECONCILED'>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<'ALL' | 'BREWERY_SUPPLIER' | 'B2B_CUSTOMER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewDepositModalOpen, setIsNewDepositModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State
  const [partnerType, setPartnerType] = useState<'BREWERY_SUPPLIER' | 'B2B_CUSTOMER'>('BREWERY_SUPPLIER');
  const [partnerName, setPartnerName] = useState('East African Breweries Ltd (EABL / UDV)');
  const [crateType, setCrateType] = useState<'BEER_CRATE_25BTL' | 'SPIRITS_CASE_12BTL' | 'KEG_BARREL_50L'>('BEER_CRATE_25BTL');
  const [quantityCrates, setQuantityCrates] = useState<number>(100);
  const [unitDepositRateKes, setUnitDepositRateKes] = useState<number>(1200);
  const [movementType, setMovementType] = useState<'DEPOSIT_PAID_OUT' | 'DEPOSIT_COLLECTED_IN' | 'RETURNS_SETTLED'>('RETURNS_SETTLED');
  const [breakageCount, setBreakageCount] = useState<number>(0);
  const [movementNotes, setMovementNotes] = useState('');

  const totalDepositAmount = (quantityCrates || 0) * (unitDepositRateKes || 0);

  // Metrics
  const totalCratesTracked = emptiesDeposits.reduce((sum, d) => sum + d.quantityCrates, 0);
  const totalBreweryDepositsPaid = emptiesDeposits
    .filter(d => d.partnerType === 'BREWERY_SUPPLIER' && d.movementType === 'DEPOSIT_PAID_OUT')
    .reduce((sum, d) => sum + d.totalDepositKes, 0);
  const totalCustomerDepositsCollected = emptiesDeposits
    .filter(d => d.partnerType === 'B2B_CUSTOMER' && d.movementType === 'DEPOSIT_COLLECTED_IN')
    .reduce((sum, d) => sum + d.totalDepositKes, 0);
  const totalReturnsSettled = emptiesDeposits
    .filter(d => d.movementType === 'RETURNS_SETTLED')
    .reduce((sum, d) => sum + d.totalDepositKes, 0);

  const filteredDeposits = emptiesDeposits.filter(d => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (partnerFilter !== 'ALL' && d.partnerType !== partnerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!d.partnerName.toLowerCase().includes(q) && !(d.notes || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantityCrates <= 0 || unitDepositRateKes <= 0) return;

    await addEmptiesDeposit({
      date: new Date().toISOString().substring(0, 10),
      partnerType,
      partnerName,
      crateType,
      quantityCrates,
      unitDepositRateKes,
      totalDepositKes: totalDepositAmount,
      movementType,
      breakageCount,
      status: 'OPEN',
      notes: movementNotes
    });

    setFeedbackMsg(
      `Recorded empties deposit movement for ${quantityCrates} crate(s) with ${partnerName} (${formatKes(totalDepositAmount)}).`
    );
    setIsNewDepositModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleReconcile = async (item: EmptiesDepositRecord) => {
    const success = await reconcileEmptiesDeposit(
      item.id,
      'Settled against supplier/customer packaging account in General Ledger.'
    );
    if (success) {
      setFeedbackMsg(
        `Reconciled packaging deposit of ${formatKes(item.totalDepositKes)} for ${item.partnerName} into double-entry ledger.`
      );
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
            <Package className="w-5 h-5 text-[#0A006E]" />
            <h3 className="font-montserrat font-black text-lg text-slate-900">
              Returnable Glass &amp; Crate (Empties) Deposit Ledger
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Kenyan alcohol distributor packaging ledger. Manage returnable plastic beer crates (KES 1,200/crate), 50L Keg barrels (KES 6,000/keg), and spirit cases. Audit deposits paid out to EABL/KBL versus deposits held from bars &amp; lounges.
          </p>
        </div>

        <button
          onClick={() => setIsNewDepositModalOpen(true)}
          className="px-4 py-2.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFDE00]" />
          <span>Record Packaging Deposit</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Packaging Traced</span>
          <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
            {totalCratesTracked.toLocaleString()} Units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Crates, cases &amp; keg barrels</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Brewery Deposits Paid Out</span>
          <div className="font-montserrat font-black text-xl text-blue-900 mt-1">
            {formatKes(totalBreweryDepositsPaid)}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-0.5">Asset Acct 1070 (EABL/UDV)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Customer Deposits Held</span>
          <div className="font-montserrat font-black text-xl text-amber-900 mt-1">
            {formatKes(totalCustomerDepositsCollected)}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Liability Acct 2070 (B2B Bars)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs hover-card-lift">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Returns Settled &amp; Refunded</span>
          <div className="font-montserrat font-black text-xl text-emerald-900 mt-1">
            {formatKes(totalReturnsSettled)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Empties reconciled at depot</div>
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
            All Movements ({emptiesDeposits.length})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'OPEN' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Open Deposits ({emptiesDeposits.filter(d => d.status === 'OPEN').length})
          </button>
          <button
            onClick={() => setStatusFilter('RECONCILED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition shrink-0 cursor-pointer ${
              statusFilter === 'RECONCILED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Reconciled ({emptiesDeposits.filter(d => d.status === 'RECONCILED').length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
          >
            <option value="ALL">All Partners</option>
            <option value="BREWERY_SUPPLIER">Brewery Suppliers (EABL/UDV)</option>
            <option value="B2B_CUSTOMER">B2B Customers (Bars/Lounges)</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search partner, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Empties Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredDeposits.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No returnable packaging movements found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Partner Name &amp; Type</th>
                  <th className="py-3 px-3">Packaging Type</th>
                  <th className="py-3 px-3">Movement Direction</th>
                  <th className="py-3 px-3">Units &amp; Rate</th>
                  <th className="py-3 px-3">Total Deposit Float</th>
                  <th className="py-3 px-3">Notes &amp; Breakages</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeposits.map(item => {
                  const isBrewery = item.partnerType === 'BREWERY_SUPPLIER';
                  const isPaidOut = item.movementType === 'DEPOSIT_PAID_OUT';
                  const isCollected = item.movementType === 'DEPOSIT_COLLECTED_IN';
                  const isSettled = item.status === 'RECONCILED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-bold text-slate-900">{item.partnerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {isBrewery ? 'Brewery / Distiller' : 'B2B Bar / Merchant'} • {item.date}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">
                          {item.crateType === 'BEER_CRATE_25BTL'
                            ? 'Beer Crate (25 Btl Shell)'
                            : item.crateType === 'KEG_BARREL_50L'
                            ? 'Senator / Balozi Keg 50L Barrel'
                            : 'Spirits Case (12 Btl)'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isPaidOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                            <ArrowUpRight className="w-3 h-3 text-blue-700" />
                            <span>Paid Out to Brewery</span>
                          </span>
                        ) : isCollected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                            <ArrowDownRight className="w-3 h-3 text-amber-700" />
                            <span>Collected In from Bar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                            <RotateCcw className="w-3 h-3 text-emerald-700" />
                            <span>Returns Settled</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {item.quantityCrates} @ {formatKes(item.unitDepositRateKes)}
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm">
                        {formatKes(item.totalDepositKes)}
                      </td>

                      <td className="py-3 px-3 max-w-xs text-slate-600">
                        <div className="line-clamp-2">{item.notes || 'No notes recorded'}</div>
                        {item.breakageCount > 0 && (
                          <div className="text-[10px] font-mono text-rose-700 font-bold mt-0.5">
                            {item.breakageCount} broken bottle(s) flagged
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>RECONCILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>OPEN DEPOSIT</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isSettled ? (
                          <button
                            type="button"
                            onClick={() => handleReconcile(item)}
                            className="px-2.5 py-1.5 bg-[#0A006E] hover:bg-indigo-950 text-white rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer ml-auto"
                          >
                            <Send className="w-3 h-3 text-[#FFDE00]" />
                            <span>Reconcile Deposit</span>
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

      {/* MODAL: Record Packaging Deposit Movement */}
      {isNewDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm sm:text-base text-white">
                    Record Crate / Empties Deposit Movement
                  </h3>
                  <p className="text-[11px] text-[#FFDE00] font-semibold">
                    Returnable glass bottles, plastic crates &amp; kegs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewDepositModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeposit} className="p-5 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Partner Type</label>
                  <select
                    value={partnerType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setPartnerType(val);
                      if (val === 'BREWERY_SUPPLIER') {
                        setPartnerName('East African Breweries Ltd (EABL / UDV)');
                        setMovementType('DEPOSIT_PAID_OUT');
                      } else {
                        setPartnerName('The Alchemist Bar & Lounge');
                        setMovementType('DEPOSIT_COLLECTED_IN');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="BREWERY_SUPPLIER">Brewery Supplier (EABL / UDV)</option>
                    <option value="B2B_CUSTOMER">B2B Customer (Bar / Lounge / Retail)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Movement Direction</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="DEPOSIT_PAID_OUT">Deposit Paid Out (Asset Dr. 1070)</option>
                    <option value="DEPOSIT_COLLECTED_IN">Deposit Collected In (Liability Cr. 2070)</option>
                    <option value="RETURNS_SETTLED">Returns Settled / Refund Credited</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-montserrat font-bold text-slate-800">Partner Name</label>
                <input
                  type="text"
                  required
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Packaging Type</label>
                  <select
                    value={crateType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setCrateType(val);
                      if (val === 'BEER_CRATE_25BTL') setUnitDepositRateKes(1200);
                      else if (val === 'KEG_BARREL_50L') setUnitDepositRateKes(6000);
                      else setUnitDepositRateKes(600);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="BEER_CRATE_25BTL">Beer Crate (25 Btls)</option>
                    <option value="KEG_BARREL_50L">Keg Barrel (50L)</option>
                    <option value="SPIRITS_CASE_12BTL">Spirits Case (12 Btls)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Quantity (Units)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantityCrates}
                    onChange={(e) => setQuantityCrates(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-montserrat font-bold text-slate-800">Rate / Unit (KES)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={unitDepositRateKes}
                    onChange={(e) => setUnitDepositRateKes(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Calculation Banner */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between">
                <span className="font-montserrat font-bold text-emerald-950">Total Deposit Value:</span>
                <span className="font-mono font-black text-emerald-950 text-base">{formatKes(totalDepositAmount)}</span>
              </div>

              <div className="space-y-1">
                <label className="font-montserrat font-bold text-slate-800">Notes &amp; Delivery Reference</label>
                <textarea
                  rows={2}
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  placeholder="e.g. Returnable crates received from route driver; deposit refund deducted from B2B invoice..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewDepositModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] hover:bg-indigo-950 text-[#FFDE00] rounded-xl text-xs font-montserrat font-bold shadow-sm transition cursor-pointer"
                >
                  Save Packaging Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
