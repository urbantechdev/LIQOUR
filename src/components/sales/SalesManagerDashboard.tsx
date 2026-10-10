import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import { Affiliate, SaleOrder } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import {
  TrendingUp,
  BadgePercent,
  Users,
  Calendar,
  Store,
  Plus,
  Search,
  CheckCircle2,
  Smartphone,
  FileText,
  KeyRound,
  Filter,
  X,
  Award,
  DollarSign,
  ShoppingBag,
  History,
  Receipt,
  Clock,
  XCircle,
  Menu
} from 'lucide-react';

export type PerformancePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type HistoryPeriodFilter = 'ALL' | PerformancePeriod;

interface PeriodStats {
  ordersCount: number;
  bottlesSold: number;
  companySalesKes: number;
  grossSalesKes: number;
  markupProfitKes: number;
  baseCommissionKes: number;
  totalEarnedKes: number;
}

export const SalesManagerDashboard: React.FC = () => {
  const {
    currentUser,
    currentRole,
    currentDepartment,
    activeBranch,
    branches,
    affiliates,
    registerAffiliate,
    updateAffiliatePin,
    updateAffiliateCommissionSettings,
    payoutAffiliateCommission,
    orders,
    etimsInvoices,
    lastCompletedInvoice,
    setLastCompletedInvoice,
    salesRepOffDutyRequests,
    reviewSalesRepOffDutyRequest
  } = useErp();

  // Scope to the Sales Manager's branch by default; Super Admin/Accountant can switch branches
  const defaultBranchId =
    currentRole === 'STAFF' && currentDepartment === 'SALES_MANAGER'
      ? currentUser.branchId || activeBranch.id
      : branches.find(b => b.tier === 'LIQUOR_STORE')?.id || branches[0]?.id || activeBranch.id;

  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0] || activeBranch;

  // Keep selectedBranchId synced when first branch is created
  React.useEffect(() => {
    if (branches.length > 0 && (!selectedBranchId || selectedBranchId === 'unconfigured-branch' || !branches.some(b => b.id === selectedBranchId))) {
      const target = branches.find(b => b.tier === 'LIQUOR_STORE')?.id || branches[0].id;
      setSelectedBranchId(target);
    }
  }, [branches, selectedBranchId]);

  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('DAY');
  const [selectedAffiliateFilter, setSelectedAffiliateFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // New Affiliate Modal State (Sales Manager creates Sales Representatives and issues their 6-digit Login PIN)
  const [isAddAffiliateOpen, setIsAddAffiliateOpen] = useState(false);
  const [newAffName, setNewAffName] = useState('');
  const [newAffPhone, setNewAffPhone] = useState('2547');
  const [newAffPin, setNewAffPin] = useState('');
  const [newAffRate, setNewAffRate] = useState<number>(5);
  const [newAffBranchId, setNewAffBranchId] = useState<string>('');

  // Issue / Reset 6-Digit Login PIN state for existing Sales Representatives
  const [editingPinRepId, setEditingPinRepId] = useState<string | null>(null);
  const [editingPinInput, setEditingPinInput] = useState<string>('');

  // Edit Commission Rate Modal State
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [editRateInput, setEditRateInput] = useState<string>('5');
  const [editAllowPrefPrice, setEditAllowPrefPrice] = useState<boolean>(true);

  // Previous Sales Records Modal State for a specific Sales Representative
  const [viewingRepHistory, setViewingRepHistory] = useState<Affiliate | null>(null);
  const [repHistoryPeriod, setRepHistoryPeriod] = useState<HistoryPeriodFilter>('ALL');
  const [repHistorySearch, setRepHistorySearch] = useState<string>('');
  const [ordersTablePeriod, setOrdersTablePeriod] = useState<HistoryPeriodFilter>('ALL');
  const [offDutyStatusFilter, setOffDutyStatusFilter] = useState<'ALL' | 'PENDING_SALES_MANAGER' | 'APPROVED' | 'REJECTED'>('ALL');
  const [offDutyNotesMap, setOffDutyNotesMap] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Helper to check if an order date falls within DAY, WEEK, MONTH, or YEAR
  const isOrderWithinPeriod = (isoDate: string | undefined, period: PerformancePeriod): boolean => {
    if (!isoDate) return true;
    const orderTime = new Date(isoDate).getTime();
    if (Number.isNaN(orderTime)) return true;

    const now = new Date();
    const nowMs = now.getTime();

    if (period === 'DAY') {
      // Same calendar day or within last 24 hours
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return orderTime >= startOfToday || nowMs - orderTime <= 24 * 60 * 60 * 1000;
    }
    if (period === 'WEEK') {
      return nowMs - orderTime <= 7 * 24 * 60 * 60 * 1000;
    }
    if (period === 'MONTH') {
      return nowMs - orderTime <= 30 * 24 * 60 * 60 * 1000;
    }
    // YEAR
    return nowMs - orderTime <= 365 * 24 * 60 * 60 * 1000;
  };

  // Compute stats for a given list of orders
  const computeStatsFromOrders = (orderList: SaleOrder[]): PeriodStats => {
    let ordersCount = 0;
    let bottlesSold = 0;
    let companySalesKes = 0;
    let grossSalesKes = 0;
    let markupProfitKes = 0;
    let baseCommissionKes = 0;
    let totalEarnedKes = 0;

    orderList.forEach(o => {
      ordersCount += 1;
      const qty = o.items.reduce((s, i) => s + i.quantity, 0);
      bottlesSold += qty;
      const comp = o.companySalesKes ?? o.totalKes - (o.affiliateMarkupTotalKes || 0);
      const markup = o.affiliateMarkupTotalKes || 0;
      const baseComm = o.affiliateBaseCommissionKes || 0;
      const earned = o.affiliateTotalEarnedKes ?? markup + baseComm;

      companySalesKes += comp;
      grossSalesKes += o.totalKes;
      markupProfitKes += markup;
      baseCommissionKes += baseComm;
      totalEarnedKes += earned;
    });

    return {
      ordersCount,
      bottlesSold,
      companySalesKes,
      grossSalesKes,
      markupProfitKes,
      baseCommissionKes,
      totalEarnedKes
    };
  };

  // All orders made from this branch
  const allBranchOrders = useMemo(() => {
    return orders.filter(o => o.branchId === selectedBranchId);
  }, [orders, selectedBranchId]);

  // Branch orders per period (DAY, WEEK, MONTH, YEAR)
  const branchStatsByPeriod = useMemo(() => {
    return {
      DAY: computeStatsFromOrders(allBranchOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'DAY'))),
      WEEK: computeStatsFromOrders(allBranchOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'WEEK'))),
      MONTH: computeStatsFromOrders(allBranchOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'MONTH'))),
      YEAR: computeStatsFromOrders(allBranchOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'YEAR')))
    };
  }, [allBranchOrders]);

  // Affiliated persons belonging to this branch (or all affiliates if no branches created yet / matching branch)
  const branchAffiliates = useMemo(() => {
    if (branches.length === 0 || !selectedBranchId || selectedBranchId === 'unconfigured-branch') {
      return affiliates;
    }
    return affiliates.filter(
      a =>
        !a.branchId ||
        a.branchId === 'unconfigured-branch' ||
        a.branchId === selectedBranchId ||
        !branches.some(b => b.id === a.branchId)
    );
  }, [affiliates, branches, selectedBranchId]);

  // Performance of each Sales Representative per DAY, WEEK, MONTH, YEAR, and ALL TIME
  const affiliatePerformanceList = useMemo(() => {
    return branchAffiliates.map(aff => {
      const affOrders = allBranchOrders
        .filter(
          o =>
            o.affiliateId === aff.id ||
            (o.affiliateName && o.affiliateName.toLowerCase() === aff.name.toLowerCase()) ||
            (o.cashierName && o.cashierName.toLowerCase() === aff.name.toLowerCase())
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const dayStats = computeStatsFromOrders(
        affOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'DAY'))
      );
      const weekStats = computeStatsFromOrders(
        affOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'WEEK'))
      );
      const monthStats = computeStatsFromOrders(
        affOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'MONTH'))
      );
      const yearStats = computeStatsFromOrders(
        affOrders.filter(o => isOrderWithinPeriod(o.createdAt, 'YEAR'))
      );
      const allTimeStats = computeStatsFromOrders(affOrders);

      return {
        affiliate: aff,
        allOrders: affOrders,
        allTimeStats,
        periods: {
          DAY: dayStats,
          WEEK: weekStats,
          MONTH: monthStats,
          YEAR: yearStats
        }
      };
    });
  }, [branchAffiliates, allBranchOrders]);

  // Filtered Branch Orders for the selected period & selected Sales Representative filter
  const filteredBranchOrders = useMemo(() => {
    return allBranchOrders.filter(o => {
      if (ordersTablePeriod !== 'ALL' && !isOrderWithinPeriod(o.createdAt, ordersTablePeriod)) {
        return false;
      }
      if (selectedAffiliateFilter !== 'ALL') {
        const targetAff = branchAffiliates.find(a => a.id === selectedAffiliateFilter);
        const matchesAff =
          o.affiliateId === selectedAffiliateFilter ||
          (targetAff &&
            ((o.affiliateName && o.affiliateName.toLowerCase() === targetAff.name.toLowerCase()) ||
              (o.cashierName && o.cashierName.toLowerCase() === targetAff.name.toLowerCase())));
        if (!matchesAff) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.affiliateName || '').toLowerCase().includes(q) ||
        (o.cashierName || '').toLowerCase().includes(q) ||
        o.items.some(i => i.productName.toLowerCase().includes(q))
      );
    });
  }, [allBranchOrders, ordersTablePeriod, selectedAffiliateFilter, branchAffiliates, searchQuery]);

  const handleOnboardAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newAffPin.replace(/\D/g, '');
    if (!newAffName.trim() || cleanPin.length !== 6) return;

    const targetBranchId = newAffBranchId || selectedBranchId || branches[0]?.id || '';
    const targetBranchObj = branches.find(b => b.id === targetBranchId) || currentBranch;

    const slug = newAffName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const created = await registerAffiliate({
        name: newAffName.trim(),
        code: `SR-${newAffName.trim().split(' ')[0].toUpperCase()}-${String(affiliates.length + 1).padStart(2, '0')}`,
        phone: newAffPhone.trim() || '254722000000',
        branchId: targetBranchId,
        employmentType: 'CASUAL',
        compensationModel: 'COMMISSION_ONLY',
        commissionRatePercent: newAffRate,
        commissionMode: 'COMMISSION_AND_PROFIT',
        allowPreferredPrice: true,
        preferredPrices: {},
        customSlug: slug || `rep-${affiliates.length + 1}`,
        loginPin: cleanPin,
        mpesaNumber: newAffPhone.trim() || '254722000000',
        active: true
      });

      showToast(
        `Sales Manager created Sales Representative "${created.name}" (${created.code}) under ${targetBranchObj.name} and issued 6-Digit Login PIN: ${cleanPin}`
      );
      setNewAffName('');
      setNewAffPin('');
      setIsAddAffiliateOpen(false);
    } catch {
      // Global persistence error banner is automatically shown by ErpContext
    }
  };

  const handleSaveAffiliateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAffiliate) return;
    const parsedRate = Math.max(0, Math.min(100, parseFloat(editRateInput) || 0));
    updateAffiliateCommissionSettings(editingAffiliate.id, {
      commissionRatePercent: parsedRate,
      commissionMode: parsedRate > 0 ? 'COMMISSION_AND_PROFIT' : 'PREFERRED_PRICE_PROFIT_ONLY',
      allowPreferredPrice: editAllowPrefPrice
    });
    showToast(
      `Updated ${editingAffiliate.name}: ${parsedRate}% Base Commission • Preferred Price ${
        editAllowPrefPrice ? 'Enabled' : 'Disabled'
      }.`
    );
    setEditingAffiliate(null);
  };

  const periodLabels: Record<PerformancePeriod, { title: string; subtitle: string }> = {
    DAY: { title: 'Daily (Today)', subtitle: 'Last 24 Hours / Today' },
    WEEK: { title: 'Weekly (7 Days)', subtitle: 'Last 7 Days Performance' },
    MONTH: { title: 'Monthly (30 Days)', subtitle: 'Last 30 Days Performance' },
    YEAR: { title: 'Yearly (365 Days)', subtitle: 'Annual Cumulative Performance' }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-[#FFDE00] text-[#0A006E] rounded-3xl border-2 border-[#0A006E]/20 p-4 sm:p-6 lg:p-8 shadow-xl flex flex-col justify-between gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-lg shrink-0">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase tracking-wider">
                    Branch Sales &amp; Representatives Manager
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/90 text-[#0A006E] border border-[#0A006E]/20 font-mono text-[11px] font-bold">
                    Manager: {currentUser.name}
                  </span>
                </div>
                <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight mt-1 leading-tight">
                  {currentBranch.name} — Sales &amp; Representatives Dashboard
                </h2>
                <p className="text-xs sm:text-sm text-[#0A006E]/80 font-semibold mt-1">
                  Monitor all orders made from your branch, manage Sales Representatives, inspect their previous sales records, and track performance per Day, Week, Month, and Year.
                </p>
              </div>
            </div>

            {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
            <button
              type="button"
              onClick={() => setIsHeroMenuOpen(prev => !prev)}
              aria-label="Toggle Sales Manager Hero Menu"
              className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
            >
              {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Branch Selector + Onboard New Affiliate Button — Collapsed Inside Hamburger on Mobile */}
          <div
            className={`${
              isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
            } flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#0A006E]/15 animate-in fade-in`}
          >
            <div className="flex items-center gap-2 bg-white/90 border border-[#0A006E]/20 rounded-2xl px-3.5 py-2 shadow-2xs">
              <Store className="w-4 h-4 text-[#0A006E] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-montserrat font-bold uppercase tracking-wider text-[#0A006E]/70">
                  Assigned Branch
                </div>
                <select
                  value={selectedBranchId}
                  onChange={e => {
                    setSelectedBranchId(e.target.value);
                    setSelectedAffiliateFilter('ALL');
                    setIsHeroMenuOpen(false);
                  }}
                  disabled={currentRole === 'STAFF' && currentDepartment === 'SALES_MANAGER'}
                  className="bg-transparent text-xs font-montserrat font-black text-[#0A006E] focus:outline-none cursor-pointer disabled:cursor-default w-full"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id} className="text-slate-900 font-bold">
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewAffBranchId(selectedBranchId || branches[0]?.id || '');
                setIsAddAffiliateOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-4 py-3 rounded-2xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FFDE00] stroke-[2.5]" />
              <span>+ Create Sales Representative &amp; Issue PIN</span>
            </button>
          </div>
        </div>

        {/* 4-Period Interactive Selector Cards (Day / Week / Month / Year) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-[#0A006E]/15">
          {(['DAY', 'WEEK', 'MONTH', 'YEAR'] as PerformancePeriod[]).map(period => {
            const st = branchStatsByPeriod[period];
            const isSelected = selectedPeriod === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-lg ring-2 ring-[#0A006E]/30'
                    : 'bg-white/90 hover:bg-white text-[#0A006E] border-[#0A006E]/20 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-montserrat font-black uppercase">
                  <span>{periodLabels[period].title}</span>
                  <Calendar className={`w-4 h-4 ${isSelected ? 'text-[#FFDE00]' : 'text-[#0A006E]'}`} />
                </div>
                <div className="font-montserrat font-black text-xl sm:text-2xl mt-1">
                  {formatKes(st.grossSalesKes)}
                </div>
                <div
                  className={`text-[11px] font-mono font-bold mt-1 flex items-center justify-between ${
                    isSelected ? 'text-[#FFDE00]' : 'text-slate-600'
                  }`}
                >
                  <span>{st.ordersCount} Orders ({st.bottlesSold} Btls)</span>
                  <span>Comm: {formatKes(st.totalEarnedKes)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-[#1E9E60] text-xs font-montserrat font-bold flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          SALES REPRESENTATIVE OFF-DUTY REQUESTS — SALES MANAGER APPROVAL QUEUE
          ===================================================================== */}
      <div className="bg-white rounded-3xl border-2 border-[#0A006E]/20 shadow-sm overflow-hidden">
        <div className="bg-[#0A006E] text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-4 border-[#FFDE00]">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0 shadow-md">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-white">
                  Sales Representative Off-Duty Requests — Sales Manager Approval Queue
                </h3>
                {salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER' && (!r.branchId || r.branchId === selectedBranchId)).length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFDE00] text-[#0A006E] font-mono font-black text-xs">
                    {salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER' && (!r.branchId || r.branchId === selectedBranchId)).length} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Sales Representatives submit Off-Duty requests directly from their Staff POS terminal for Sales Manager approval.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'PENDING_SALES_MANAGER', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setOffDutyStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-montserrat font-black text-[11px] transition cursor-pointer ${
                  offDutyStatusFilter === st
                    ? 'bg-[#FFDE00] text-[#0A006E]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {st === 'PENDING_SALES_MANAGER' ? 'PENDING' : st} (
                {st === 'ALL'
                  ? salesRepOffDutyRequests.filter(r => !r.branchId || r.branchId === selectedBranchId).length
                  : salesRepOffDutyRequests.filter(r => r.status === st && (!r.branchId || r.branchId === selectedBranchId)).length}
                )
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {salesRepOffDutyRequests
            .filter(r => (!r.branchId || r.branchId === selectedBranchId) && (offDutyStatusFilter === 'ALL' ? true : r.status === offDutyStatusFilter))
            .length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-medium">
              No Sales Representative off-duty requests matching <span className="font-bold">{offDutyStatusFilter === 'PENDING_SALES_MANAGER' ? 'PENDING' : offDutyStatusFilter}</span> for {currentBranch.name}.
            </div>
          ) : (
            salesRepOffDutyRequests
              .filter(r => (!r.branchId || r.branchId === selectedBranchId) && (offDutyStatusFilter === 'ALL' ? true : r.status === offDutyStatusFilter))
              .map(req => {
                const typeLabel =
                  req.offDutyType === 'REST_DAY'
                    ? 'Scheduled Rest Day Off'
                    : req.offDutyType === 'SHIFT_OFF_DUTY'
                    ? 'Shift Off-Duty'
                    : req.offDutyType === 'MEDICAL_OFF_DUTY'
                    ? 'Medical Off-Duty'
                    : 'Personal Off-Duty';

                return (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-[#0A006E] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                          {req.requestNumber}
                        </span>
                        <span className="font-montserrat font-black text-sm text-slate-900">
                          {req.affiliateName}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {req.affiliateCode} • {req.branchName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0A006E]/10 text-[#0A006E] font-montserrat font-black text-[11px]">
                          {typeLabel}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-montserrat font-black text-[10px] uppercase inline-flex items-center gap-1 ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-[#1E9E60]'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                          {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          {req.status === 'PENDING_SALES_MANAGER' && <Clock className="w-3 h-3" />}
                          <span>{req.status === 'PENDING_SALES_MANAGER' ? 'PENDING SALES MANAGER' : req.status}</span>
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 font-medium">
                        <strong className="text-slate-900">Period:</strong> {req.startDate} &rarr; {req.endDate} ({req.daysOrShiftsCount}{' '}
                        {req.daysOrShiftsCount === 1 ? 'day/shift' : 'days/shifts'}) •{' '}
                        <strong className="text-slate-900">Reason:</strong> {req.reason}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                        {req.coveringRepName && (
                          <span>
                            Stand-in Sales Rep: <strong className="text-slate-800">{req.coveringRepName}</strong>
                          </span>
                        )}
                        <span>Requested: {new Date(req.requestedAt).toLocaleString()}</span>
                        {req.reviewedBy && (
                          <span className="text-[#0A006E] font-semibold">
                            Reviewed by {req.reviewedBy}: {req.managerReviewNotes || 'No note'}
                          </span>
                        )}
                      </div>
                    </div>

                    {req.status === 'PENDING_SALES_MANAGER' && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <input
                          type="text"
                          value={offDutyNotesMap[req.id] || ''}
                          onChange={e =>
                            setOffDutyNotesMap(prev => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Sales Manager approval/rejection note..."
                          className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#0A006E] min-w-[220px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            reviewSalesRepOffDutyRequest(
                              req.id,
                              'APPROVED',
                              offDutyNotesMap[req.id] || 'Approved by Sales Manager — Route coverage confirmed.'
                            );
                            showToast(`Approved off-duty request ${req.requestNumber} for ${req.affiliateName}.`);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-white font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#FFDE00]" />
                          <span>Approve Off-Duty</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            reviewSalesRepOffDutyRequest(
                              req.id,
                              'REJECTED',
                              offDutyNotesMap[req.id] || 'Declined by Sales Manager due to peak shift coverage.'
                            );
                            showToast(`Declined off-duty request ${req.requestNumber} for ${req.affiliateName}.`);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: LIST OF AFFILIATED PERSONS & PERFORMANCE PER DAY / WEEK / MONTH / YEAR
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0A006E]" />
              <span>
                Branch Sales Representatives ({branchAffiliates.length}) — Performance &amp; Previous Sales Records
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active timeframe highlighted: <strong className="text-[#0A006E]">{periodLabels[selectedPeriod].title}</strong>. Click <strong>Previous Sales Records</strong> on any Sales Representative to inspect their complete sales history and receipts.
            </p>
          </div>

          {/* Timeframe Switcher Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            {(['DAY', 'WEEK', 'MONTH', 'YEAR'] as PerformancePeriod[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-black transition cursor-pointer ${
                  selectedPeriod === p
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'DAY' ? 'Day' : p === 'WEEK' ? 'Week' : p === 'MONTH' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {affiliatePerformanceList.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <BadgePercent className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-montserrat font-bold text-sm text-slate-800">
                No Sales Representatives assigned to {currentBranch.name} yet
              </div>
              <p className="text-xs text-slate-500">
                Click &ldquo;+ Add Branch Sales Representative&rdquo; above to onboard a Sales Representative for this branch.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {affiliatePerformanceList.map(({ affiliate, allTimeStats, periods }) => {
                const activeStats = periods[selectedPeriod];
                const isFilteredToThisAffiliate = selectedAffiliateFilter === affiliate.id;

                return (
                  <div
                    key={affiliate.id}
                    className={`rounded-2xl border-2 p-5 transition space-y-4 ${
                      isFilteredToThisAffiliate
                        ? 'bg-[#0A006E]/5 border-[#0A006E]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Sales Representative Profile, PIN, Commission Config & Quick Actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-base shadow-sm shrink-0">
                          {affiliate.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-montserrat font-black text-base text-slate-900">
                              {affiliate.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[11px]">
                              {affiliate.code}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0A006E] font-montserrat font-bold text-[10px]">
                              Sales Representative
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[10px] uppercase">
                              {affiliate.commissionRatePercent || 0}% Base Comm + 100% Markup
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#FFDE00]/30 text-[#0A006E] font-mono font-black text-[11px] flex items-center gap-1">
                              <KeyRound className="w-3 h-3" />
                              <span>Issued Login PIN: {affiliate.loginPin}</span>
                            </span>
                            {editingPinRepId === affiliate.id ? (
                              <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-[#0A006E]/30">
                                <input
                                  type="text"
                                  maxLength={6}
                                  value={editingPinInput}
                                  onChange={e => setEditingPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  placeholder="6-digit PIN"
                                  className="w-20 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-black text-[11px] text-[#0A006E]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingPinInput.length === 6) {
                                      updateAffiliatePin(affiliate.id, editingPinInput);
                                      showToast(`Issued new 6-Digit Login PIN (${editingPinInput}) to Sales Representative ${affiliate.name}.`);
                                      setEditingPinRepId(null);
                                      setEditingPinInput('');
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[10px]"
                                >
                                  Save PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPinRepId(null);
                                    setEditingPinInput('');
                                  }}
                                  className="text-[10px] text-slate-500 px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPinRepId(affiliate.id);
                                  setEditingPinInput(affiliate.loginPin || '');
                                }}
                                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] font-montserrat font-bold text-[10px] transition cursor-pointer"
                              >
                                Re-Issue / Change PIN
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                            <span>M-Pesa: <strong className="font-mono text-slate-700">{affiliate.mpesaNumber}</strong></span>
                            <span>•</span>
                            <span>
                              All-Time Previous Sales:{' '}
                              <strong className="text-[#1E9E60]">
                                {allTimeStats.ordersCount} Orders ({allTimeStats.bottlesSold} Bottles • {formatKes(allTimeStats.grossSalesKes)})
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Selected Period ({periodLabels[selectedPeriod].title}):{' '}
                              <strong className="text-[#0A006E]">
                                {activeStats.ordersCount} Orders ({activeStats.bottlesSold} Bottles)
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons for Sales Manager */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingRepHistory(affiliate);
                            setRepHistoryPeriod('ALL');
                            setRepHistorySearch('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Previous Sales Records ({allTimeStats.ordersCount})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAffiliateFilter(prev =>
                              prev === affiliate.id ? 'ALL' : affiliate.id
                            )
                          }
                          className={`px-3.5 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                            isFilteredToThisAffiliate
                              ? 'bg-[#0A006E] text-[#FFDE00]'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          <span>
                            {isFilteredToThisAffiliate ? 'Showing Orders Below' : 'Filter Branch Orders'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingAffiliate(affiliate);
                            setEditRateInput(String(affiliate.commissionRatePercent ?? 5));
                            setEditAllowPrefPrice(affiliate.allowPreferredPrice !== false);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A006E] border border-[#0A006E]/30 font-montserrat font-bold text-xs cursor-pointer"
                        >
                          Commission Settings
                        </button>

                        {affiliate.pendingCommissionKes > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const ok = payoutAffiliateCommission(affiliate.id);
                              if (ok) {
                                showToast(
                                  `Disbursed ${formatKes(affiliate.pendingCommissionKes)} M-Pesa B2C payout to ${affiliate.name} (${affiliate.mpesaNumber}).`
                                );
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay Due ({formatKes(affiliate.pendingCommissionKes)})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4-Period Performance Matrix for this Affiliated Person: DAY | WEEK | MONTH | YEAR */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                      {(['DAY', 'WEEK', 'MONTH', 'YEAR'] as PerformancePeriod[]).map(periodKey => {
                        const pStat = periods[periodKey];
                        const isActivePeriod = selectedPeriod === periodKey;
                        return (
                          <div
                            key={periodKey}
                            onClick={() => setSelectedPeriod(periodKey)}
                            className={`p-3.5 rounded-xl border transition cursor-pointer ${
                              isActivePeriod
                                ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-montserrat font-black uppercase tracking-wider">
                              <span className={isActivePeriod ? 'text-[#FFDE00]' : 'text-slate-500'}>
                                {periodKey === 'DAY'
                                  ? 'Day (Today)'
                                  : periodKey === 'WEEK'
                                  ? 'Week (7 Days)'
                                  : periodKey === 'MONTH'
                                  ? 'Month (30 Days)'
                                  : 'Year (365 Days)'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                                  isActivePeriod
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white text-slate-700 border border-slate-200'
                                }`}
                              >
                                {pStat.ordersCount} Orders • {pStat.bottlesSold} Btls
                              </span>
                            </div>

                            <div className="mt-2 flex items-baseline justify-between gap-2">
                              <div>
                                <div
                                  className={`text-[10px] ${
                                    isActivePeriod ? 'text-slate-300' : 'text-slate-500'
                                  }`}
                                >
                                  Gross Sales
                                </div>
                                <div className="font-montserrat font-black text-base">
                                  {formatKes(pStat.grossSalesKes)}
                                </div>
                              </div>

                              <div className="text-right">
                                <div
                                  className={`text-[10px] ${
                                    isActivePeriod ? 'text-[#FFDE00]' : 'text-[#1E9E60]'
                                  }`}
                                >
                                  Affiliate Earned
                                </div>
                                <div
                                  className={`font-mono font-black text-sm ${
                                    isActivePeriod ? 'text-[#FFDE00]' : 'text-[#1E9E60]'
                                  }`}
                                >
                                  {formatKes(pStat.totalEarnedKes)}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`mt-1.5 pt-1.5 border-t text-[10px] font-mono flex items-center justify-between ${
                                isActivePeriod
                                  ? 'border-white/15 text-slate-300'
                                  : 'border-slate-200 text-slate-500'
                              }`}
                            >
                              <span>Company Net: {formatKes(pStat.companySalesKes)}</span>
                              <span>Markup: {formatKes(pStat.markupProfitKes)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          SECTION 2: ORDERS & PREVIOUS SALES RECORDS MADE FROM THIS BRANCH
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0A006E]" />
              <span>
                Branch Previous Sales Records — {currentBranch.name} ({filteredBranchOrders.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete historical sales register with separated Company Baseline Price vs. Sales Representative Markup &amp; Commission.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Filter for Orders Table */}
            <select
              value={ordersTablePeriod}
              onChange={e => setOrdersTablePeriod(e.target.value as HistoryPeriodFilter)}
              className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-[#0A006E]"
            >
              <option value="ALL">All Previous Sales (All Time)</option>
              <option value="DAY">Daily (Today)</option>
              <option value="WEEK">Weekly (Last 7 Days)</option>
              <option value="MONTH">Monthly (Last 30 Days)</option>
              <option value="YEAR">Yearly (Last 365 Days)</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[210px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search order #, rep, product..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
              />
            </div>

            {/* Filter by Sales Representative */}
            <select
              value={selectedAffiliateFilter}
              onChange={e => setSelectedAffiliateFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-slate-800"
            >
              <option value="ALL">All Branch Sales Representatives &amp; Channels</option>
              {branchAffiliates.map(a => (
                <option key={a.id} value={a.id}>
                  Sales Rep: {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-montserrat font-black uppercase text-slate-500">
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4">Sales Representative / Channel</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items Sold</th>
                <th className="py-3.5 px-4 text-right">Company Price</th>
                <th className="py-3.5 px-4 text-right">Rep Earned</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4 text-center">16% VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredBranchOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No previous sales records found for {currentBranch.name} matching your filter.
                  </td>
                </tr>
              ) : (
                filteredBranchOrders.map(order => {
                  const companyPortion =
                    order.companySalesKes ?? order.totalKes - (order.affiliateMarkupTotalKes || 0);
                  const affiliateEarned =
                    order.affiliateTotalEarnedKes ??
                    (order.affiliateMarkupTotalKes || 0) + (order.affiliateBaseCommissionKes || 0);
                  const matchedInv = etimsInvoices.find(
                    inv => inv.orderId === order.id || inv.invoiceNumber === order.etimsInvoiceNumber
                  );

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-black text-[#0A006E]">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {order.salesPersonName || order.affiliateName ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 font-montserrat font-bold text-[#0A006E]">
                                <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{order.salesPersonName || order.affiliateName}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {order.checkoutRole === 'SALES_REP_SELF_CHECKOUT' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                    Direct Self-Cashout
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Cashier: <strong className="text-slate-700">{order.cashierName}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-800 font-medium text-xs">
                                {order.cashierName}
                              </span>
                              <div className="text-[9px] text-slate-400 font-mono">
                                Counter Direct Sale
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {order.customerName || 'Walk-in Customer'}
                        </div>
                        {order.customerPhone && (
                          <div className="font-mono text-[10px] text-slate-500">
                            {order.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                        {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {formatKes(companyPortion)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-amber-700">
                        {affiliateEarned > 0 ? `+${formatKes(affiliateEarned)}` : formatKes(0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-[#1E9E60]">
                        {formatKes(order.totalKes)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {matchedInv ? (
                          <button
                            type="button"
                            onClick={() => setLastCompletedInvoice(matchedInv)}
                            className="px-2.5 py-1 rounded-lg bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] font-montserrat font-bold text-[11px] transition cursor-pointer"
                          >
                            Receipt
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: ONBOARD NEW BRANCH SALES REPRESENTATIVE
          ===================================================================== */}
      {isAddAffiliateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-md w-full h-dvh sm:h-auto overflow-y-auto shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col justify-between">
            <div className="bg-[#0A006E] text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div>
                <h4 className="font-montserrat font-black text-base">
                  Onboard Sales Representative — {currentBranch.name}
                </h4>
                <p className="text-xs text-slate-300">
                  Assign a new commission-based Sales Representative to your branch
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAffiliateOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOnboardAffiliate} className="p-6 space-y-4">
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Branch *
                  </label>
                  <select
                    value={newAffBranchId || selectedBranchId}
                    onChange={e => setNewAffBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sales Representative Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAffName}
                  onChange={e => setNewAffName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Safaricom M-Pesa Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={newAffPhone}
                  onChange={e => setNewAffPhone(e.target.value)}
                  placeholder="254722000000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Base Commission (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={newAffRate}
                    onChange={e => setNewAffRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-black"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-montserrat font-black text-[#0A006E]">
                      6-Digit PIN *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setNewAffPin(Math.floor(100000 + Math.random() * 900000).toString())
                      }
                      className="text-[10px] font-montserrat font-black text-[#1E9E60] hover:underline"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newAffPin}
                    onChange={e => setNewAffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="482910"
                    className="w-full px-3.5 py-2.5 bg-[#FFDE00]/20 border-2 border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddAffiliateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-montserrat font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs shadow-md cursor-pointer"
                >
                  Onboard Sales Representative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1B: SALES REPRESENTATIVE PREVIOUS SALES RECORDS MODAL
          ===================================================================== */}
      {viewingRepHistory && (() => {
        const repOrdersAll = orders
          .filter(
            o =>
              o.affiliateId === viewingRepHistory.id ||
              (o.affiliateName &&
                o.affiliateName.toLowerCase() === viewingRepHistory.name.toLowerCase()) ||
              (o.cashierName &&
                o.cashierName.toLowerCase() === viewingRepHistory.name.toLowerCase())
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const repOrdersFiltered = repOrdersAll.filter(o => {
          if (repHistoryPeriod !== 'ALL' && !isOrderWithinPeriod(o.createdAt, repHistoryPeriod)) {
            return false;
          }
          if (!repHistorySearch.trim()) return true;
          const q = repHistorySearch.toLowerCase();
          return (
            o.orderNumber.toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').toLowerCase().includes(q) ||
            (o.mpesaReceiptNumber || '').toLowerCase().includes(q) ||
            o.items.some(i => i.productName.toLowerCase().includes(q))
          );
        });

        const filteredStats = computeStatsFromOrders(repOrdersFiltered);

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-none sm:rounded-3xl max-w-5xl w-full h-dvh sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col">
              {/* Header */}
              <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b-4 border-[#FFDE00] shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-montserrat font-black text-base shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-montserrat font-black italic text-base sm:text-lg text-white">
                        Previous Sales Records — {viewingRepHistory.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-mono font-black text-[11px]">
                        {viewingRepHistory.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/15 text-white font-montserrat font-bold text-[10px]">
                        Sales Representative
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Complete order history, itemized products sold, separated preferred price profit, and 16% VAT receipts.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRepHistory(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* 4 Summary KPI Cards for Selected History Filter */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-montserrat font-black uppercase text-slate-500">
                      Previous Sales Count
                    </div>
                    <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
                      {filteredStats.ordersCount} Orders
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {filteredStats.bottlesSold} Total Bottles Sold
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-[#0A006E]/20">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                      Company Sales (Protected)
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#0A006E] mt-1">
                      {formatKes(filteredStats.companySalesKes)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      Gross Paid: {formatKes(filteredStats.grossSalesKes)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60]">
                      Separated Price Profit
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#1E9E60] mt-1">
                      +{formatKes(filteredStats.markupProfitKes)}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-800 mt-0.5">
                      Base Comm: +{formatKes(filteredStats.baseCommissionKes)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FFDE00]/30 border border-[#0A006E]/25">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                      Total Rep Earned
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#1E9E60] mt-1">
                      {formatKes(filteredStats.totalEarnedKes)}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-amber-800 mt-0.5">
                      Pending Payout: {formatKes(viewingRepHistory.pendingCommissionKes || 0)}
                    </div>
                  </div>
                </div>

                {/* Filter Bar: Timeframe Tabs + Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                    {(
                      [
                        { id: 'ALL', label: `All Previous (${repOrdersAll.length})` },
                        { id: 'DAY', label: 'Today' },
                        { id: 'WEEK', label: 'Last 7 Days' },
                        { id: 'MONTH', label: 'Last 30 Days' },
                        { id: 'YEAR', label: 'Last 365 Days' }
                      ] as { id: HistoryPeriodFilter; label: string }[]
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRepHistoryPeriod(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-black transition cursor-pointer ${
                          repHistoryPeriod === tab.id
                            ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={repHistorySearch}
                      onChange={e => setRepHistorySearch(e.target.value)}
                      placeholder="Search order #, customer, drink..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
                    />
                  </div>
                </div>

                {/* Itemized Previous Sales Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-montserrat font-black uppercase text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-4">Order # &amp; Date</th>
                          <th className="py-3 px-3">Customer</th>
                          <th className="py-3 px-3">Drinks Sold &amp; Unit Pricing</th>
                          <th className="py-3 px-3 text-right">Company Price</th>
                          <th className="py-3 px-3 text-right">Price Profit</th>
                          <th className="py-3 px-3 text-right">Base Comm</th>
                          <th className="py-3 px-3 text-right">Rep Earned</th>
                          <th className="py-3 px-3 text-right">Customer Paid</th>
                          <th className="py-3 px-4 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {repOrdersFiltered.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-10 text-center text-slate-500">
                              No previous sales records found for <strong>{viewingRepHistory.name}</strong> in this filter.
                            </td>
                          </tr>
                        ) : (
                          repOrdersFiltered.map(order => {
                            const companyPortion =
                              order.companySalesKes ?? order.totalKes - (order.affiliateMarkupTotalKes || 0);
                            const markupProfit = order.affiliateMarkupTotalKes || 0;
                            const baseComm = order.affiliateBaseCommissionKes || 0;
                            const totalEarned = order.affiliateTotalEarnedKes ?? markupProfit + baseComm;
                            const matchedInv = etimsInvoices.find(
                              inv => inv.orderId === order.id || inv.invoiceNumber === order.etimsInvoiceNumber
                            );

                            return (
                              <tr key={order.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4">
                                  <div className="font-mono font-black text-[#0A006E]">
                                    {order.orderNumber}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-500">
                                    {new Date(order.createdAt).toLocaleString()}
                                  </div>
                                  {order.mpesaReceiptNumber && (
                                    <div className="font-mono text-[10px] text-emerald-700 font-bold">
                                      M-Pesa: {order.mpesaReceiptNumber}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900">
                                    {order.customerName || 'Walk-in Customer'}
                                  </div>
                                  {order.customerPhone && (
                                    <div className="font-mono text-[10px] text-slate-500">
                                      {order.customerPhone}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="space-y-1">
                                    {order.items.map((item, idx) => {
                                      const compUnit = item.companyUnitPrice ?? item.unitPrice;
                                      const markupUnit = item.affiliateMarkupPerUnit ?? Math.max(0, item.unitPrice - compUnit);
                                      return (
                                        <div key={idx} className="text-[11px] text-slate-800">
                                          <span className="font-bold">{item.quantity}× {item.productName}</span>
                                          <span className="text-[10px] font-mono text-slate-500 ml-1.5">
                                            (Sold @ {formatKes(item.unitPrice)} • Co: {formatKes(compUnit)}
                                            {markupUnit > 0 ? ` • +${formatKes(markupUnit)}/btl` : ''})
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-[#0A006E] tabular-nums">
                                  {formatKes(companyPortion)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-[#1E9E60] tabular-nums">
                                  {markupProfit > 0 ? `+${formatKes(markupProfit)}` : formatKes(0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                                  {baseComm > 0 ? `+${formatKes(baseComm)}` : formatKes(0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 tabular-nums">
                                  +{formatKes(totalEarned)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                                  {formatKes(order.totalKes)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {matchedInv ? (
                                    <button
                                      type="button"
                                      onClick={() => setLastCompletedInvoice(matchedInv)}
                                      className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[10px] inline-flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <Receipt className="w-3 h-3" />
                                      <span>Receipt</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-400">Verified</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-600">
                  Showing <strong>{repOrdersFiltered.length}</strong> of <strong>{repOrdersAll.length}</strong> total previous sales records for <strong>{viewingRepHistory.name}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRepHistory(null)}
                  className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer"
                >
                  Close Sales History
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          MODAL 2: EDIT AFFILIATE COMMISSION SETTINGS
          ===================================================================== */}
      {editingAffiliate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-md w-full h-dvh sm:h-auto overflow-y-auto shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col justify-between">
            <div className="bg-[#0A006E] text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div>
                <h4 className="font-montserrat font-black text-base">
                  Commission Settings — {editingAffiliate.name}
                </h4>
                <p className="text-xs text-slate-300">{editingAffiliate.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAffiliate(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAffiliateSettings} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Base Commission Percentage (%) on Company Price
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={editRateInput}
                  onChange={e => setEditRateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-black"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={editAllowPrefPrice}
                  onChange={e => setEditAllowPrefPrice(e.target.checked)}
                  className="w-4 h-4 accent-[#0A006E]"
                />
                <span>Allow selling at Preferred Selling Price (100% markup to affiliate)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAffiliate(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-montserrat font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs shadow-md cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KRA eTIMS Receipt Modal */}
      {lastCompletedInvoice && (
        <EtimsReceiptModal
          invoice={lastCompletedInvoice}
          onClose={() => setLastCompletedInvoice(null)}
        />
      )}
    </div>
  );
};
