import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { Affiliate, AffiliateCommissionMode } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import { LeaveAndOffDutyModal } from '../common/LeaveAndOffDutyModal';
import { VaairoSalesNetworkHub } from './VaairoSalesNetworkHub';
import { StaffActionButtons, StaffStatusBadge } from '../common/StaffLifecycleActionsModal';
import {
  BadgePercent,
  Copy,
  Check,
  Store,
  Plus,
  Smartphone,
  CheckCircle2,
  Users,
  KeyRound,
  Settings2,
  Sliders,
  Tag,
  ShieldCheck,
  TrendingUp,
  Search,
  X,
  RotateCcw,
  ArrowRightLeft,
  History,
  Receipt,
  Calendar,
  Clock,
  XCircle,
  Menu
} from 'lucide-react';

export const AffiliateManager: React.FC = () => {
  const {
    affiliates,
    commissions,
    orders,
    products,
    etimsInvoices,
    lastCompletedInvoice,
    setLastCompletedInvoice,
    defaultAffiliateCommissionRate,
    defaultAffiliateCommissionMode,
    defaultAllowPreferredPrice,
    updateGlobalAffiliateSettings,
    registerAffiliate,
    updateAffiliatePin,
    updateAffiliateCommissionSettings,
    setAffiliateProductPreferredPrice,
    updateAffiliateAssignedCashier,
    payoutAffiliateCommission,
    branches,
    employees,
    salesRepOffDutyRequests,
    reviewSalesRepOffDutyRequest
  } = useErp();

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [payoutFeedback, setPayoutFeedback] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOffDutyModalOpen, setIsOffDutyModalOpen] = useState(false);
  const [offDutyStatusFilter, setOffDutyStatusFilter] = useState<'ALL' | 'PENDING_SALES_MANAGER' | 'APPROVED' | 'REJECTED'>('ALL');
  const [salesManagerNotesMap, setSalesManagerNotesMap] = useState<Record<string, string>>({});

  // Preferred Price Book Modal state for a specific Affiliate
  const [priceBookAffiliateId, setPriceBookAffiliateId] = useState<string | null>(null);
  const [priceBookSearch, setPriceBookSearch] = useState('');
  const [draftPreferredPrices, setDraftPreferredPrices] = useState<Record<string, string>>({});

  // Global Commission Setting local inputs
  const [globalRateInput, setGlobalRateInput] = useState<string>(String(defaultAffiliateCommissionRate));
  const [globalModeInput, setGlobalModeInput] = useState<AffiliateCommissionMode>(defaultAffiliateCommissionMode);
  const [globalAllowPrefInput, setGlobalAllowPrefInput] = useState<boolean>(defaultAllowPreferredPrice);

  // Inline PIN editing state for existing Sales Representatives
  const [editingPinAffId, setEditingPinAffId] = useState<string | null>(null);
  const [editingPinValue, setEditingPinValue] = useState<string>('');

  // Inline Commission Rate editing state per affiliate
  const [editingCommAffId, setEditingCommAffId] = useState<string | null>(null);
  const [editingCommRateValue, setEditingCommRateValue] = useState<string>('');

  // Previous Sales Records Modal & Ledger Filter State
  const [viewingRepSalesHistory, setViewingRepSalesHistory] = useState<Affiliate | null>(null);
  const [repHistoryPeriod, setRepHistoryPeriod] = useState<'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [repHistorySearch, setRepHistorySearch] = useState<string>('');
  const [ledgerRepFilter, setLedgerRepFilter] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // New affiliate form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('2547');
  const [branchId, setBranchId] = useState(
    branches.find(b => b.tier === 'LIQUOR_STORE')?.id || branches[0]?.id || ''
  );
  const [assignedCashierId, setAssignedCashierId] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('2547');
  const [loginPin, setLoginPin] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState<number>(defaultAffiliateCommissionRate);
  const [newCommissionMode, setNewCommissionMode] = useState<AffiliateCommissionMode>(defaultAffiliateCommissionMode);
  const [newAllowPreferredPrice, setNewAllowPreferredPrice] = useState<boolean>(defaultAllowPreferredPrice);
  const [pinError, setPinError] = useState<string | null>(null);

  const liquorStores = branches.filter(b => b.tier === 'LIQUOR_STORE');
  const posCashiers = employees.filter(e => e.department === 'POS' && e.active);

  // Calculate separated Company Sales vs. Affiliate Profit & Commissions
  const affiliateCommissionsOnly = commissions.filter(
    c => c.recipientRole !== 'POS_CASHIER'
  );

  const totalGrossAffiliateSales = affiliates.reduce((acc, a) => acc + (a.totalSalesKes || 0), 0);
  const totalSeparatedPreferredPriceProfit =
    affiliates.reduce(
      (acc, a) =>
        acc +
        (a.preferredPriceProfitTotalKes !== undefined
          ? a.preferredPriceProfitTotalKes
          : affiliateCommissionsOnly
              .filter(c => c.affiliateId === a.id)
              .reduce(
                (s, c) =>
                  s +
                  (c.preferredPriceProfitKes !== undefined
                    ? c.preferredPriceProfitKes
                    : Math.max(0, c.soldPriceKes - c.baselinePriceKes)),
                0
              )),
      0
    );

  const totalCompanyBaselineSalesFromAffiliates =
    affiliates.reduce(
      (acc, a) =>
        acc +
        (a.companySalesTotalKes !== undefined
          ? a.companySalesTotalKes
          : Math.max(0, (a.totalSalesKes || 0) - (a.preferredPriceProfitTotalKes || 0))),
      0
    );

  const totalBaseCommissionEarnedByAffiliates =
    affiliates.reduce(
      (acc, a) =>
        acc +
        (a.baseCommissionTotalKes !== undefined
          ? a.baseCommissionTotalKes
          : affiliateCommissionsOnly
              .filter(c => c.affiliateId === a.id)
              .reduce((s, c) => s + (c.baseCommissionKes || 0), 0)),
      0
    );

  const totalAffiliateProfitEarned = affiliates.reduce(
    (acc, a) => acc + a.totalCommissionEarnedKes,
    0
  );
  const totalCommissionPending =
    affiliates.reduce((acc, a) => acc + a.pendingCommissionKes, 0) +
    posCashiers.reduce((acc, c) => acc + (c.pendingCommissionKes || 0), 0);
  const totalCommissionPaid =
    affiliates.reduce((acc, a) => acc + a.paidCommissionKes, 0) +
    posCashiers.reduce((acc, c) => acc + (c.paidCommissionKes || 0), 0);

  const activePriceBookAffiliate = affiliates.find(a => a.id === priceBookAffiliateId) || null;

  const handleCopyLink = (slug: string) => {
    const url = `https://vaairo.co.ke/ref/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handlePayout = (aff: Affiliate) => {
    if (aff.pendingCommissionKes <= 0) return;
    const ok = payoutAffiliateCommission(aff.id);
    if (ok) {
      setPayoutFeedback(
        `Disbursed ${formatKes(aff.pendingCommissionKes)} separated Affiliate Profit & Commission via Safaricom B2C API to ${aff.name} (${aff.mpesaNumber}). Company Sales remained untouched.`
      );
      setTimeout(() => setPayoutFeedback(null), 5000);
    }
  };

  const handleApplyGlobalSettings = (applyToAll: boolean) => {
    const parsedRate = Math.max(0, Math.min(100, parseFloat(globalRateInput) || 0));
    setGlobalRateInput(String(parsedRate));
    updateGlobalAffiliateSettings({
      commissionRatePercent: parsedRate,
      commissionMode: globalModeInput,
      allowPreferredPrice: globalAllowPrefInput,
      applyToExistingAffiliates: applyToAll
    });
    setPayoutFeedback(
      applyToAll
        ? `Updated Commission Setting (${parsedRate}% • ${
            globalModeInput === 'PREFERRED_PRICE_PROFIT_ONLY'
              ? 'Preferred Price Profit Only'
              : globalModeInput === 'COMMISSION_AND_PROFIT'
              ? 'Preferred Price Profit + Base Commission %'
              : 'Base Commission % Only'
          }) and Preferred Price Option (${globalAllowPrefInput ? 'Allowed' : 'Disabled'}) for ALL ${affiliates.length} Sales Affiliates.`
        : `Saved default Commission Setting (${parsedRate}%) and Preferred Selling Price rule for newly onboarded Sales Affiliates.`
    );
    setTimeout(() => setPayoutFeedback(null), 4500);
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!name.trim()) return;

    const cleanPin = loginPin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setPinError('Each Sales Representative must be assigned a 6-digit numeric Login PIN (e.g. 583920) to sign in.');
      return;
    }

    const matchedCashier =
      posCashiers.find(c => c.id === assignedCashierId) ||
      posCashiers.find(c => c.branchId === branchId) ||
      posCashiers[0];

    const resolvedSlug =
      customSlug.trim().toLowerCase().replace(/\s+/g, '-') ||
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      `rep-${affiliates.length + 1}`;

    try {
      const created = await registerAffiliate({
        name: name.trim(),
        code: `SR-${name.trim().split(' ')[0].toUpperCase()}-${(affiliates.length + 1).toString().padStart(2, '0')}`,
        phone,
        branchId,
        assignedCashierId: matchedCashier?.id,
        assignedCashierName: matchedCashier?.name,
        commissionRatePercent: newCommissionRate,
        commissionMode: newCommissionMode,
        allowPreferredPrice: newAllowPreferredPrice,
        preferredPrices: {},
        customSlug: resolvedSlug,
        loginPin: cleanPin,
        mpesaNumber: mpesaNumber || phone,
        active: true
      });

      setPayoutFeedback(
        `Onboarded Sales Representative "${created.name}" (${created.code}) with Commission Setting: ${
          created.commissionMode === 'PREFERRED_PRICE_PROFIT_ONLY'
            ? '100% Preferred Price Profit'
            : `${created.commissionRatePercent}% Base Commission + 100% Preferred Price Profit`
        } • Preferred Selling Price: ${created.allowPreferredPrice ? 'ENABLED (Company Price Protected)' : 'Disabled'}.`
      );
      setTimeout(() => setPayoutFeedback(null), 5000);

      setIsAddModalOpen(false);
      setName('');
      setCustomSlug('');
      setLoginPin('');
      setPinError(null);
    } catch (err) {
      setPinError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const formatCommissionModeLabel = (mode?: AffiliateCommissionMode, rate?: number) => {
    const r = rate ?? 0;
    if (mode === 'PREFERRED_PRICE_PROFIT_ONLY') {
      return '100% Preferred Price Profit Only';
    }
    if (mode === 'BASE_COMMISSION_ONLY') {
      return `${r}% Base Commission Only`;
    }
    return `100% Preferred Price Profit + ${r}% Base Comm`;
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-md shrink-0">
              <BadgePercent className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                Sales Representatives Commission, Preferred Price &amp; Sales History Portal
              </h2>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 mt-0.5 sm:mt-1 max-w-3xl font-semibold">
                Configure commission settings for Sales Representatives, allow them to sell at their preferred price without affecting the Company Price, and inspect all previous sales records.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Sales Rep Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div
          className={`${
            isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex-col lg:flex-row lg:items-center justify-between gap-3 animate-in fade-in`}
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#0A006E] font-bold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-[#0A006E]/20">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E9E60] shrink-0" />
              <span>Company Price 100% Protected</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-[#0A006E]/20">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
              <span>Markup Separated from Company Sales</span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOffDutyModalOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black transition flex items-center justify-between sm:justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span>Sales Rep Off-Duty Requests</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-mono text-[10px] font-black shrink-0">
                {salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER').length}
              </span>
            </button>
            <button
              onClick={() => {
                setIsAddModalOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-white rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span>Onboard Sales Representative</span>
            </button>
          </div>
        </div>
      </div>

      {payoutFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{payoutFeedback}</span>
        </div>
      )}

      {/* VAAIRO SALES NETWORK — REMOTE DISTRIBUTION, CUSTOMER ONBOARDING & RECONCILIATION HUB */}
      <VaairoSalesNetworkHub
        onOpenPreferredPriceBook={(affId) => setPriceBookAffiliateId(affId)}
        onDisbursePayout={handlePayout}
      />

      {/* SALES REPRESENTATIVE OFF-DUTY REQUESTS — SALES MANAGER APPROVAL QUEUE */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/15 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-montserrat font-black text-sm sm:text-base text-[#0A006E] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A006E]" />
                <span>Sales Representative Off-Duty Requests — Sales Manager Queue ({salesRepOffDutyRequests.length})</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-montserrat font-black text-[10px]">
                {salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER').length} Awaiting Sales Manager
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[10px]">
                {salesRepOffDutyRequests.filter(r => r.status === 'APPROVED').length} Approved Off-Duty
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sales Representatives request off-duty shifts and rest days from the Sales Manager. Approve or decline requests below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'PENDING_SALES_MANAGER', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setOffDutyStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-montserrat font-black text-[11px] border transition cursor-pointer ${
                  offDutyStatusFilter === st
                    ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL'
                  ? `All (${salesRepOffDutyRequests.length})`
                  : st === 'PENDING_SALES_MANAGER'
                  ? `Pending (${salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER').length})`
                  : st === 'APPROVED'
                  ? `Approved (${salesRepOffDutyRequests.filter(r => r.status === 'APPROVED').length})`
                  : `Rejected (${salesRepOffDutyRequests.filter(r => r.status === 'REJECTED').length})`}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsOffDutyModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Request / Manage Off-Duty</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {salesRepOffDutyRequests.filter(r =>
            offDutyStatusFilter === 'ALL' ? true : r.status === offDutyStatusFilter
          ).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No Sales Representative off-duty requests recorded yet.
            </div>
          ) : (
            salesRepOffDutyRequests
              .filter(r => (offDutyStatusFilter === 'ALL' ? true : r.status === offDutyStatusFilter))
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
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-[#0A006E] bg-[#0A006E]/10 px-2 py-0.5 rounded">
                          {req.requestNumber}
                        </span>
                        <span className="font-montserrat font-black text-sm text-slate-900">
                          {req.affiliateName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          ({req.affiliateCode} • {req.branchName})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#0A006E] border border-indigo-200 font-montserrat font-bold text-[10px]">
                          {typeLabel}
                        </span>
                        {req.status === 'PENDING_SALES_MANAGER' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-montserrat font-black text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>PENDING SALES MANAGER</span>
                          </span>
                        )}
                        {req.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>APPROVED BY SALES MANAGER</span>
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-montserrat font-black text-[10px]">
                            <XCircle className="w-3 h-3" />
                            <span>DECLINED BY SALES MANAGER</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">Reason:</span> {req.reason}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                        <span>
                          Off-Duty Dates: <strong className="font-mono text-slate-800">{req.startDate}</strong> to{' '}
                          <strong className="font-mono text-slate-800">{req.endDate}</strong> (
                          <strong className="text-[#0A006E]">
                            {req.daysOrShiftsCount} day/shift{req.daysOrShiftsCount === 1 ? '' : 's'}
                          </strong>
                          )
                        </span>
                        {req.coveringRepName && (
                          <span>
                            Covering Sales Rep: <strong className="text-slate-800">{req.coveringRepName}</strong>
                          </span>
                        )}
                        <span>
                          Requested: <strong className="font-mono">{new Date(req.requestedAt).toLocaleString()}</strong>
                        </span>
                      </div>

                      {req.managerReviewNotes && (
                        <div className="text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                          <strong className="text-slate-800">
                            Sales Manager Note ({req.reviewedBy || 'Sales Manager'}):
                          </strong>{' '}
                          {req.managerReviewNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={salesManagerNotesMap[req.id] || ''}
                        onChange={(e) =>
                          setSalesManagerNotesMap(prev => ({
                            ...prev,
                            [req.id]: e.target.value
                          }))
                        }
                        placeholder="Sales Manager note..."
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A006E] w-full sm:w-48"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          reviewSalesRepOffDutyRequest(
                            req.id,
                            'APPROVED',
                            salesManagerNotesMap[req.id] || 'Approved by Sales Manager'
                          );
                          setPayoutFeedback(
                            `Sales Manager approved Off-Duty Request ${req.requestNumber} for Sales Representative ${req.affiliateName} (${req.startDate} to ${req.endDate}).`
                          );
                        }}
                        disabled={req.status === 'APPROVED'}
                        className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700 opacity-60 cursor-not-allowed'
                            : 'bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] shadow-2xs'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Off-Duty</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          reviewSalesRepOffDutyRequest(
                            req.id,
                            'REJECTED',
                            salesManagerNotesMap[req.id] || 'Declined by Sales Manager'
                          );
                          setPayoutFeedback(
                            `Sales Manager declined Off-Duty Request ${req.requestNumber} for Sales Representative ${req.affiliateName}.`
                          );
                        }}
                        disabled={req.status === 'REJECTED'}
                        className={`px-3 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center justify-center gap-1 border transition cursor-pointer ${
                          req.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700 border-red-200 opacity-60 cursor-not-allowed'
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* COMMISSION SETTING & PREFERRED SELLING PRICE POLICY CONTROL PANEL */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/15 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm sm:text-base text-slate-900">
                Sales Affiliate Commission Settings &amp; Preferred Price Rule
              </h3>
              <p className="text-xs text-slate-500">
                Set how Sales Affiliates earn commissions and enable/disable selling with their preferred price without changing Company Prices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyGlobalSettings(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-montserrat font-bold text-xs transition whitespace-nowrap"
            >
              Save Default Rule
            </button>
            <button
              type="button"
              onClick={() => handleApplyGlobalSettings(true)}
              className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs transition shadow-xs whitespace-nowrap"
            >
              Apply to All Affiliates ({affiliates.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Setting 1: Option to Allow Affiliates to Sell with Their Preferred Price */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                  1. Preferred Selling Price Option
                </span>
                <span
                  className={`text-[10px] font-montserrat font-black px-2 py-0.5 rounded ${
                    globalAllowPrefInput
                      ? 'bg-emerald-100 text-[#1E9E60]'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {globalAllowPrefInput ? 'ALLOWED' : 'LOCKED TO COMPANY PRICE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Allow Sales Affiliates to sell products at their preferred price in POS or via custom price book without affecting the official Company Price.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGlobalAllowPrefInput(prev => !prev)}
              className={`w-full py-2.5 px-3 rounded-xl font-montserrat font-black text-xs flex items-center justify-between border-2 transition ${
                globalAllowPrefInput
                  ? 'bg-[#34D186] text-[#FFDE00] border-[#34D186]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              }`}
            >
              <span>
                {globalAllowPrefInput
                  ? '✓ Sell with Preferred Price (Company Price Protected)'
                  : 'Fixed Company Price Only (No Custom Price)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  globalAllowPrefInput ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {globalAllowPrefInput ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Setting 2: Commission Earning Mode & Profit Separation Rule */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase block mb-1">
                2. Affiliate Profit &amp; Commission Structure
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Choose whether Sales Affiliates earn strictly their separated Preferred Price Profit (<code className="font-mono text-[#1E9E60]">Sold Price - Company Price</code>) or also a Base % Commission.
              </p>
            </div>

            <select
              value={globalModeInput}
              onChange={(e) => {
                const nextMode = e.target.value as AffiliateCommissionMode;
                setGlobalModeInput(nextMode);
                if (nextMode === 'PREFERRED_PRICE_PROFIT_ONLY') {
                  setGlobalRateInput('0');
                } else if (parseFloat(globalRateInput) === 0) {
                  setGlobalRateInput('5');
                }
              }}
              className="w-full px-3 py-2.5 bg-white border-2 border-[#0A006E]/30 rounded-xl text-xs font-montserrat font-bold text-slate-900 focus:outline-none focus:border-[#0A006E]"
            >
              <option value="COMMISSION_AND_PROFIT">
                Separated Preferred Price Profit + Base Commission %
              </option>
              <option value="PREFERRED_PRICE_PROFIT_ONLY">
                Separated Preferred Price Profit Only (100% of Extra Price)
              </option>
              <option value="BASE_COMMISSION_ONLY">
                Base Commission % on Company Price Only
              </option>
            </select>
          </div>

          {/* Setting 3: Base Commission Rate (%) Setting */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                  3. Base Commission Rate (%)
                </span>
                <span className="font-mono font-black text-xs text-[#1E9E60] bg-emerald-100 px-2 py-0.5 rounded">
                  {globalModeInput === 'PREFERRED_PRICE_PROFIT_ONLY' ? '0% (Profit Only)' : `${globalRateInput || 0}% Base`}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Base percentage commission on Company Price in addition to 100% of the Affiliate&apos;s separated Preferred Price Profit.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  disabled={globalModeInput === 'PREFERRED_PRICE_PROFIT_ONLY'}
                  value={globalModeInput === 'PREFERRED_PRICE_PROFIT_ONLY' ? 0 : globalRateInput}
                  onChange={(e) => setGlobalRateInput(e.target.value)}
                  className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-black text-xs text-slate-900 disabled:opacity-50"
                />
                <span className="text-xs font-bold text-slate-600">% of Company Sales</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 2, 3, 5, 8, 10].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setGlobalRateInput(String(preset));
                      if (preset === 0) {
                        setGlobalModeInput('PREFERRED_PRICE_PROFIT_ONLY');
                      } else if (globalModeInput === 'PREFERRED_PRICE_PROFIT_ONLY') {
                        setGlobalModeInput('COMMISSION_AND_PROFIT');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition border ${
                      Number(globalRateInput) === preset
                        ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset === 0 ? '0% (Profit Only)' : `${preset}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AFTER-SALES SEPARATION KPI CARDS (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Company Sales (At Company Price) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
              Company Sales (At Company Price)
            </span>
            <div
              className="font-montserrat font-black text-xl sm:text-2xl text-[#0A006E] mt-2 tracking-tight tabular-nums truncate"
              title={formatKes(totalCompanyBaselineSalesFromAffiliates)}
            >
              {formatKes(totalCompanyBaselineSalesFromAffiliates)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-3">
            Retained by Company • Gross Customer Paid: <strong className="text-slate-800">{formatKes(totalGrossAffiliateSales)}</strong>
          </div>
        </div>

        {/* Card 2: Separated Affiliate Preferred Price Profit */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/30 shadow-sm flex flex-col justify-between hover-card-lift">
          <div>
            <span className="text-[11px] text-[#1E9E60] font-bold uppercase tracking-wider block">
              Separated Affiliate Price Profit
            </span>
            <div
              className="font-montserrat font-black text-xl sm:text-2xl text-[#1E9E60] mt-2 tracking-tight tabular-nums truncate"
              title={formatKes(totalSeparatedPreferredPriceProfit)}
            >
              +{formatKes(totalSeparatedPreferredPriceProfit)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-emerald-800 font-medium mt-3">
            Preferred Price minus Company Price (Separated after sales)
          </div>
        </div>

        {/* Card 3: Total Affiliate Profit & Commission Earned (What They Earn) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
          <div>
            <span className="text-[11px] text-slate-700 font-bold uppercase tracking-wider block">
              Total Affiliate Earnings (What They Earn)
            </span>
            <div
              className="font-montserrat font-black text-xl sm:text-2xl text-slate-900 mt-2 tracking-tight tabular-nums truncate"
              title={formatKes(totalAffiliateProfitEarned)}
            >
              {formatKes(totalAffiliateProfitEarned)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-3">
            Price Profit ({formatKes(totalSeparatedPreferredPriceProfit)}) + Base Comm ({formatKes(totalBaseCommissionEarnedByAffiliates)})
          </div>
        </div>

        {/* Card 4: Pending vs Disbursed M-Pesa Payout */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
          <div>
            <span className="text-[11px] text-amber-700 font-bold uppercase tracking-wider block">
              Pending Affiliate Payout (Acct 2045)
            </span>
            <div
              className="font-montserrat font-black text-xl sm:text-2xl text-amber-700 mt-2 tracking-tight tabular-nums truncate"
              title={formatKes(totalCommissionPending)}
            >
              {formatKes(totalCommissionPending)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-3">
            Disbursed to Date: <strong className="text-[#1E9E60]">{formatKes(totalCommissionPaid)}</strong>
          </div>
        </div>
      </div>

      {/* Affiliates Cards Grid */}
      {affiliates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#0A006E]/10 text-[#0A006E] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-montserrat font-black text-sm text-slate-900">
              No Sales Representatives Onboarded Yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Onboard Sales Representatives with custom Commission Settings and Preferred Selling Price permissions so they can sell at their preferred price and earn separated profits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black inline-flex items-center gap-1.5 shadow-xs hover:bg-[#060046]"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Sales Representative</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {affiliates.map((aff) => {
            const store = branches.find(b => b.id === aff.branchId);
            const isCopied = copiedSlug === aff.customSlug;
            const allowPref = aff.allowPreferredPrice !== false;
            const commMode = aff.commissionMode || 'COMMISSION_AND_PROFIT';
            const commRate = aff.commissionRatePercent ?? 5;
            const customPriceCount = Object.keys(aff.preferredPrices || {}).length;

            // Compute this Sales Representative's separated sales & profit figures + previous orders
            const affOrders = orders.filter(
              o =>
                o.affiliateId === aff.id ||
                (o.affiliateName && o.affiliateName.toLowerCase() === aff.name.toLowerCase()) ||
                (o.cashierName && o.cashierName.toLowerCase() === aff.name.toLowerCase())
            );
            const affCommRecords = affiliateCommissionsOnly.filter(c => c.affiliateId === aff.id);
            const affSeparatedProfit =
              aff.preferredPriceProfitTotalKes !== undefined
                ? aff.preferredPriceProfitTotalKes
                : affCommRecords.reduce(
                    (s, c) =>
                      s +
                      (c.preferredPriceProfitKes !== undefined
                        ? c.preferredPriceProfitKes
                        : Math.max(0, c.soldPriceKes - c.baselinePriceKes)),
                    0
                  );
            const affCompanySales =
              aff.companySalesTotalKes !== undefined
                ? aff.companySalesTotalKes
                : Math.max(0, (aff.totalSalesKes || 0) - affSeparatedProfit);
            const affBaseComm =
              aff.baseCommissionTotalKes !== undefined
                ? aff.baseCommissionTotalKes
                : affCommRecords.reduce((s, c) => s + (c.baseCommissionKes || 0), 0);

            return (
              <div
                key={aff.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between hover:border-[#0A006E] transition space-y-3"
              >
                <div className="space-y-3">
                  {/* Top Identity Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0A006E]">
                          {aff.code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Sales Representative
                        </span>
                        <StaffStatusBadge
                          status={aff.employmentStatus}
                          active={aff.active}
                          reason={aff.suspensionReason || aff.terminationReason}
                          compact
                        />
                      </div>
                      <h3 className="font-montserrat font-black text-base text-slate-900">
                        {aff.name}
                      </h3>
                      <div className="flex items-center space-x-1 text-xs text-slate-500 mt-0.5">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{store?.name || 'Liquor Store'}</span>
                      </div>
                    </div>

                    {/* Preferred Price Permission Badge */}
                    <button
                      type="button"
                      onClick={() => {
                        updateAffiliateCommissionSettings(aff.id, {
                          allowPreferredPrice: !allowPref
                        });
                        setPayoutFeedback(
                          `${!allowPref ? 'Enabled' : 'Disabled'} Preferred Selling Price option for ${aff.name}. Company prices remain unaffected.`
                        );
                        setTimeout(() => setPayoutFeedback(null), 4000);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-montserrat font-black uppercase transition border ${
                        allowPref
                          ? 'bg-emerald-50 text-[#1E9E60] border-emerald-300 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                      title="Toggle whether this affiliate can sell with their preferred price without affecting company price"
                    >
                      {allowPref ? '✓ Preferred Price: ON' : 'Preferred Price: OFF'}
                    </button>
                  </div>

                  {/* Per-Affiliate Commission Setting & Preferred Price Controls */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-montserrat font-black uppercase text-[#0A006E] flex items-center gap-1">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Commission &amp; Pricing Setting</span>
                      </span>

                      {editingCommAffId === aff.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={editingCommRateValue}
                            onChange={(e) => setEditingCommRateValue(e.target.value)}
                            className="w-16 px-2 py-0.5 bg-white border border-[#0A006E] rounded font-mono font-bold text-xs text-right"
                          />
                          <span className="text-[10px] font-bold">%</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextRate = Math.max(0, Math.min(100, parseFloat(editingCommRateValue) || 0));
                              updateAffiliateCommissionSettings(aff.id, {
                                commissionRatePercent: nextRate,
                                commissionMode:
                                  nextRate === 0 && commMode === 'BASE_COMMISSION_ONLY'
                                    ? 'PREFERRED_PRICE_PROFIT_ONLY'
                                    : commMode
                              });
                              setEditingCommAffId(null);
                              setPayoutFeedback(
                                `Updated base commission rate for ${aff.name} to ${nextRate}%.`
                              );
                              setTimeout(() => setPayoutFeedback(null), 4000);
                            }}
                            className="px-2 py-0.5 rounded bg-[#34D186] text-white font-bold text-[10px]"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommAffId(aff.id);
                            setEditingCommRateValue(String(commRate));
                          }}
                          className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                        >
                          Edit Base % ({commRate}%)
                        </button>
                      )}
                    </div>

                    {/* Commission Mode Selector */}
                    <select
                      value={commMode}
                      onChange={(e) => {
                        const mode = e.target.value as AffiliateCommissionMode;
                        updateAffiliateCommissionSettings(aff.id, {
                          commissionMode: mode,
                          commissionRatePercent: mode === 'PREFERRED_PRICE_PROFIT_ONLY' ? 0 : commRate || 5
                        });
                        setPayoutFeedback(
                          `Updated ${aff.name}'s earning structure to: ${formatCommissionModeLabel(mode, mode === 'PREFERRED_PRICE_PROFIT_ONLY' ? 0 : commRate || 5)}`
                        );
                        setTimeout(() => setPayoutFeedback(null), 4000);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-800"
                    >
                      <option value="COMMISSION_AND_PROFIT">
                        Preferred Price Profit + {commRate}% Base Comm
                      </option>
                      <option value="PREFERRED_PRICE_PROFIT_ONLY">
                        100% Preferred Price Profit Only (Sold - Company Price)
                      </option>
                      <option value="BASE_COMMISSION_ONLY">
                        {commRate}% Base Commission Only (On Company Price)
                      </option>
                    </select>

                    {/* Preferred Selling Price Toggle + Open Preferred Price Book Button */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowPref}
                          onChange={(e) => {
                            updateAffiliateCommissionSettings(aff.id, {
                              allowPreferredPrice: e.target.checked
                            });
                          }}
                          className="rounded border-slate-300 text-[#0A006E] focus:ring-[#0A006E]"
                        />
                        <span>Sell with Preferred Price</span>
                      </label>

                      {allowPref && (
                        <button
                          type="button"
                          onClick={() => {
                            setPriceBookAffiliateId(aff.id);
                            setPriceBookSearch('');
                            const initialDrafts: Record<string, string> = {};
                            Object.entries(aff.preferredPrices || {}).forEach(([pid, val]) => {
                              initialDrafts[pid] = String(val);
                            });
                            setDraftPreferredPrices(initialDrafts);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-[10px] font-montserrat font-black flex items-center gap-1 transition shrink-0"
                        >
                          <Tag className="w-3 h-3" />
                          <span>Preferred Prices ({customPriceCount})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assigned POS Cashier (Working Under) */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <label className="block text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                      Working Under POS Cashier:
                    </label>
                    <select
                      value={aff.assignedCashierId || ''}
                      onChange={(e) => {
                        const targetCashier = posCashiers.find(c => c.id === e.target.value);
                        if (targetCashier) {
                          updateAffiliateAssignedCashier(aff.id, targetCashier.id, targetCashier.name);
                          setPayoutFeedback(
                            `Assigned Sales Representative ${aff.name} to work under POS Cashier ${targetCashier.name}.`
                          );
                          setTimeout(() => setPayoutFeedback(null), 4500);
                        } else {
                          updateAffiliateAssignedCashier(aff.id, '', '');
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="">
                        {aff.assignedCashierName
                          ? `${aff.assignedCashierName} (Assigned Cashier)`
                          : 'Select POS Cashier...'}
                      </option>
                      {posCashiers.map(cashier => (
                        <option key={cashier.id} value={cashier.id}>
                          {cashier.name} ({cashier.employeeNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 6-Digit Login Security PIN Box */}
                  <div className="p-2.5 rounded-xl bg-[#FFDE00]/20 border border-[#0A006E]/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#0A006E]" />
                      <span className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                        Login PIN:
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[11px] tracking-widest">
                        {aff.loginPin || '------'}
                      </span>
                    </div>

                    {editingPinAffId === aff.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={editingPinValue}
                          onChange={(e) => setEditingPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6 digits"
                          className="w-20 px-2 py-1 bg-white border border-[#0A006E] rounded-lg font-mono font-bold text-[11px] text-center"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingPinValue.length === 6) {
                              updateAffiliatePin(aff.id, editingPinValue);
                              setEditingPinAffId(null);
                              setPayoutFeedback(`Updated 6-Digit Login PIN for Sales Representative ${aff.name} to ${editingPinValue}.`);
                              setTimeout(() => setPayoutFeedback(null), 4000);
                            }
                          }}
                          disabled={editingPinValue.length !== 6}
                          className="px-2 py-1 rounded-lg bg-[#34D186] text-white font-bold text-[10px] disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPinAffId(null)}
                          className="px-1 text-slate-400 hover:text-slate-700 font-bold text-[10px]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPinAffId(aff.id);
                          setEditingPinValue(aff.loginPin || '');
                        }}
                        className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                      >
                        Edit PIN
                      </button>
                    )}
                  </div>

                  {/* Custom Markup Link Box */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
                      <span>Affiliate Referral Link</span>
                      <span className="text-[#1E9E60]">Company Price Protected</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] text-slate-700 truncate">
                        .../ref/{aff.customSlug}
                      </span>
                      <button
                        onClick={() => handleCopyLink(aff.customSlug)}
                        className="p-1 text-slate-500 hover:text-[#0A006E] rounded"
                        title="Copy referral link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* AFTER-SALES PROFIT SEPARATION BREAKDOWN */}
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5 text-xs">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60] flex items-center justify-between">
                      <span>After-Sales Profit Separation</span>
                      <span>What {aff.name.split(' ')[0]} Earns</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Gross Sold (Preferred Price):</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{formatKes(aff.totalSalesKes)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Company Sales (Company Price):</span>
                      <span className="font-mono font-bold text-[#0A006E] tabular-nums">{formatKes(affCompanySales)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#1E9E60] font-semibold">
                      <span>Separated Preferred Price Profit:</span>
                      <span className="font-mono font-black tabular-nums">+{formatKes(affSeparatedProfit)}</span>
                    </div>
                    {affBaseComm > 0 && (
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Base Commission ({commRate}%):</span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">+{formatKes(affBaseComm)}</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-emerald-200 flex items-center justify-between">
                      <span className="font-montserrat font-black text-[11px] text-slate-900">
                        Total Earned by Affiliate:
                      </span>
                      <span className="font-montserrat font-black text-sm text-[#1E9E60] tabular-nums">
                        {formatKes(aff.totalCommissionEarnedKes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-amber-800 font-bold">Pending Payout:</span>
                      <span className="font-mono font-black text-amber-700 tabular-nums">
                        {formatKes(aff.pendingCommissionKes)}
                      </span>
                    </div>
                  </div>

                  {/* Staff Lifecycle Actions: Edit, Suspend, Terminate, Instant Delete */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <StaffActionButtons
                      staff={aff}
                      compact
                      onActionComplete={msg => {
                        setPayoutFeedback(msg);
                        setTimeout(() => setPayoutFeedback(null), 4500);
                      }}
                    />
                  </div>
                </div>

                {/* Previous Sales Records & Payout Actions */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingRepSalesHistory(aff);
                      setRepHistoryPeriod('ALL');
                      setRepHistorySearch('');
                    }}
                    className="w-full py-2.5 px-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Previous Sales Records ({affOrders.length} Sales)</span>
                  </button>

                  <button
                    onClick={() => handlePayout(aff)}
                    disabled={aff.pendingCommissionKes <= 0}
                    className="w-full py-2.5 px-3 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-[#FFDE00]" />
                    <span>Disburse Earned Profit ({formatKes(aff.pendingCommissionKes)})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Previous Sales Records & After-Sales Profit Separation Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-montserrat font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#0A006E]" />
              <span>
                Previous Sales Records &amp; After-Sales Separation Ledger: Company Sales vs. Sales Representative Profit
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Filter by Sales Representative or search historical orders to inspect separated Company Price vs. Representative Preferred Price Profit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search order # or rep..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <select
              value={ledgerRepFilter}
              onChange={(e) => setLedgerRepFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-[#0A006E]"
            >
              <option value="ALL">All Sales Representatives &amp; Staff ({commissions.length})</option>
              {affiliates.map(a => (
                <option key={a.id} value={a.id}>
                  Sales Rep: {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {commissions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No sales records logged yet. Ring up a sale in the POS Terminal with a Sales Representative&apos;s Preferred Price to see automatic after-sales separation between Company Sales and Representative Profit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Sales Representative / Staff</th>
                  <th className="py-3 px-3">Order Number &amp; Date</th>
                  <th className="py-3 px-3">Customer &amp; Items Sold</th>
                  <th className="py-3 px-3 text-right">Company Sales (Company Price)</th>
                  <th className="py-3 px-3 text-right">Sold Price (Preferred Price)</th>
                  <th className="py-3 px-3 text-right">Separated Price Profit</th>
                  <th className="py-3 px-3 text-right">Base % Comm</th>
                  <th className="py-3 px-3 text-right">Total Rep Earned</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions
                  .filter(c => {
                    if (ledgerRepFilter !== 'ALL' && c.affiliateId !== ledgerRepFilter) {
                      return false;
                    }
                    if (!ledgerSearch.trim()) return true;
                    const q = ledgerSearch.toLowerCase();
                    return (
                      c.orderNumber.toLowerCase().includes(q) ||
                      c.affiliateName.toLowerCase().includes(q) ||
                      (c.payoutMpesaRef || '').toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                  const separatedProfit =
                    c.preferredPriceProfitKes !== undefined
                      ? c.preferredPriceProfitKes
                      : c.recipientRole === 'POS_CASHIER'
                      ? 0
                      : Math.max(0, c.soldPriceKes - c.baselinePriceKes);
                  const baseComm =
                    c.baseCommissionKes !== undefined
                      ? c.baseCommissionKes
                      : Math.max(0, c.markupEarnedKes - separatedProfit);
                  const matchedOrder = orders.find(o => o.id === c.orderId || o.orderNumber === c.orderNumber);
                  const matchedInv = etimsInvoices.find(
                    inv => inv.orderId === c.orderId || (matchedOrder && inv.invoiceNumber === matchedOrder.etimsInvoiceNumber)
                  );

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{c.affiliateName}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {c.recipientRole === 'POS_CASHIER'
                            ? `Casual POS Cashier (${c.commissionRatePercent ?? 3}% Commission)`
                            : formatCommissionModeLabel(c.commissionMode, c.commissionRatePercent)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-[#0A006E]">{c.orderNumber}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {new Date(c.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {matchedOrder ? (
                          <div>
                            <div className="font-bold text-slate-800 text-[11px]">
                              {matchedOrder.customerName || 'Walk-in Customer'}
                            </div>
                            <div className="text-[10px] text-slate-500 max-w-[220px] truncate">
                              {matchedOrder.items.map(i => `${i.quantity}× ${i.productName}`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">POS Retail Order</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0A006E] tabular-nums">
                        {formatKes(c.baselinePriceKes)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatKes(c.soldPriceKes)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-[#1E9E60] tabular-nums">
                        {separatedProfit > 0 ? `+${formatKes(separatedProfit)}` : formatKes(0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {baseComm > 0 ? `+${formatKes(baseComm)}` : formatKes(0)}
                      </td>
                      <td className="py-3 px-3 text-right font-montserrat font-black text-emerald-700 tabular-nums">
                        +{formatKes(c.markupEarnedKes)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-montserrat ${
                            c.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                          {c.payoutMpesaRef || 'Acct 2045'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {matchedInv ? (
                          <button
                            type="button"
                            onClick={() => setLastCompletedInvoice(matchedInv)}
                            className="px-2.5 py-1 rounded-lg bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] font-montserrat font-bold text-[10px] inline-flex items-center gap-1 transition cursor-pointer"
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PREFERRED PRODUCT SELLING PRICE BOOK MODAL (DOES NOT AFFECT COMPANY PRICE) */}
      {activePriceBookAffiliate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border-2 border-[#0A006E] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b-4 border-[#FFDE00]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-base sm:text-lg text-white">
                    Preferred Selling Price Book — {activePriceBookAffiliate.name} ({activePriceBookAffiliate.code})
                  </h3>
                  <p className="text-xs text-slate-300">
                    Set {activePriceBookAffiliate.name}&apos;s preferred selling prices. Official Company Prices remain 100% unchanged; any amount above Company Price is separated as {activePriceBookAffiliate.name}&apos;s profit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPriceBookAffiliateId(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Search & Quick Bulk Markup Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={priceBookSearch}
                    onChange={(e) => setPriceBookSearch(e.target.value)}
                    placeholder="Search drink by name, brand, or SKU to set preferred selling price..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-bold text-[11px]">Tap to Increase Preferred Price:</span>
                  {[100, 250, 500].map(addKes => (
                    <button
                      key={addKes}
                      type="button"
                      onClick={() => {
                        products.slice(0, 20).forEach(prod => {
                          const currentSaved = activePriceBookAffiliate.preferredPrices?.[prod.id];
                          const currentDraft = draftPreferredPrices[prod.id] !== undefined
                            ? parseFloat(draftPreferredPrices[prod.id])
                            : undefined;
                          const baseCurrent =
                            currentDraft !== undefined && !isNaN(currentDraft)
                              ? Math.max(prod.retailPriceKes, currentDraft)
                              : currentSaved !== undefined && currentSaved >= prod.retailPriceKes
                              ? currentSaved
                              : prod.retailPriceKes;
                          const nextPref = baseCurrent + addKes;
                          setAffiliateProductPreferredPrice(activePriceBookAffiliate.id, prod.id, nextPref);
                          setDraftPreferredPrices(prev => ({
                            ...prev,
                            [prod.id]: String(nextPref)
                          }));
                        });
                        setPayoutFeedback(
                          `Increased preferred selling prices by +${formatKes(addKes)}/btl for ${activePriceBookAffiliate.name} (Company Price unchanged).`
                        );
                        setTimeout(() => setPayoutFeedback(null), 4000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-[#34D186] hover:text-[#FFDE00] active:scale-95 text-[#1E9E60] border border-emerald-300 font-mono font-bold text-[11px] transition cursor-pointer select-none"
                    >
                      +{addKes}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Table */}
              <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Product / Drink</th>
                      <th className="py-3 px-3 text-right">Company Price (Protected)</th>
                      <th className="py-3 px-3 text-right">Affiliate Preferred Price (KES)</th>
                      <th className="py-3 px-3 text-right">Separated Affiliate Profit / Unit</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products
                      .filter(
                        p =>
                          p.name.toLowerCase().includes(priceBookSearch.toLowerCase()) ||
                          p.brand.toLowerCase().includes(priceBookSearch.toLowerCase()) ||
                          p.sku.toLowerCase().includes(priceBookSearch.toLowerCase())
                      )
                      .slice(0, 40)
                      .map(prod => {
                        const savedPref = activePriceBookAffiliate.preferredPrices?.[prod.id];
                        const draftVal =
                          draftPreferredPrices[prod.id] !== undefined
                            ? draftPreferredPrices[prod.id]
                            : savedPref !== undefined
                            ? String(savedPref)
                            : String(prod.retailPriceKes);
                        const numericPref = Math.max(
                          prod.retailPriceKes,
                          parseFloat(draftVal) || prod.retailPriceKes
                        );
                        const profitPerUnit = Math.max(0, numericPref - prod.retailPriceKes);

                        return (
                          <tr key={prod.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-900">{prod.name}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {prod.sku} • {prod.volumeMl}mL
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-[#0A006E] bg-blue-50 px-2 py-0.5 rounded tabular-nums">
                                {formatKes(prod.retailPriceKes)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min={prod.retailPriceKes}
                                step={50}
                                value={draftVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftPreferredPrices(prev => ({ ...prev, [prod.id]: val }));
                                  const num = parseFloat(val);
                                  if (!isNaN(num) && num >= prod.retailPriceKes) {
                                    setAffiliateProductPreferredPrice(
                                      activePriceBookAffiliate.id,
                                      prod.id,
                                      num
                                    );
                                  }
                                }}
                                className="w-28 px-2.5 py-1 bg-amber-50/70 border border-amber-300 rounded-lg text-right font-mono font-black text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`font-mono font-black text-xs tabular-nums ${
                                  profitPerUnit > 0 ? 'text-[#1E9E60]' : 'text-slate-400'
                                }`}
                              >
                                {profitPerUnit > 0 ? `+${formatKes(profitPerUnit)}` : 'KES 0'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {[100, 250, 500].map(inc => (
                                  <button
                                    key={inc}
                                    type="button"
                                    onClick={() => {
                                      const nextVal = numericPref + inc;
                                      setAffiliateProductPreferredPrice(
                                        activePriceBookAffiliate.id,
                                        prod.id,
                                        nextVal
                                      );
                                      setDraftPreferredPrices(prev => ({
                                        ...prev,
                                        [prod.id]: String(nextVal)
                                      }));
                                    }}
                                    className="px-2 py-1 rounded bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] active:scale-95 text-[10px] font-mono font-bold transition cursor-pointer select-none"
                                    title={`Tap to add +KES ${inc} (tap multiple times to keep increasing)`}
                                  >
                                    +{inc}
                                  </button>
                                ))}
                                {profitPerUnit > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAffiliateProductPreferredPrice(
                                        activePriceBookAffiliate.id,
                                        prod.id,
                                        null
                                      );
                                      setDraftPreferredPrices(prev => ({
                                        ...prev,
                                        [prod.id]: String(prod.retailPriceKes)
                                      }));
                                    }}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    title="Reset to Company Price"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500">
                  When <strong>{activePriceBookAffiliate.name}</strong> selects any product in POS, their preferred price is applied automatically while the Company Price stays fixed.
                </p>
                <button
                  type="button"
                  onClick={() => setPriceBookAffiliateId(null)}
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs transition"
                >
                  Done &amp; Save Preferred Prices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Sales Representative Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 my-auto animate-in fade-in">
            <h3 className="font-montserrat font-black text-lg text-slate-900 mb-1">
              Onboard Sales Representative
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure commission settings, preferred selling price permission, M-Pesa payout number &amp; 6-digit Login PIN.
            </p>

            {pinError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {pinError}
              </div>
            )}

            <form onSubmit={handleCreateAffiliate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!customSlug) {
                      setCustomSlug(
                        e.target.value
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')
                      );
                    }
                  }}
                  placeholder="e.g. Cynthia Mwangi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              {/* Commission Setting & Preferred Price Option */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="text-xs font-montserrat font-black text-[#1E9E60] uppercase">
                  Commission Setting &amp; Preferred Selling Price Option
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Commission Earning Mode
                    </label>
                    <select
                      value={newCommissionMode}
                      onChange={(e) => {
                        const mode = e.target.value as AffiliateCommissionMode;
                        setNewCommissionMode(mode);
                        if (mode === 'PREFERRED_PRICE_PROFIT_ONLY') {
                          setNewCommissionRate(0);
                        } else if (newCommissionRate === 0) {
                          setNewCommissionRate(5);
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="COMMISSION_AND_PROFIT">
                        Preferred Price Profit + Base %
                      </option>
                      <option value="PREFERRED_PRICE_PROFIT_ONLY">
                        Preferred Price Profit Only (100%)
                      </option>
                      <option value="BASE_COMMISSION_ONLY">
                        Base Commission % Only
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Base Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={newCommissionMode === 'PREFERRED_PRICE_PROFIT_ONLY'}
                      value={newCommissionMode === 'PREFERRED_PRICE_PROFIT_ONLY' ? 0 : newCommissionRate}
                      onChange={(e) => setNewCommissionRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 disabled:opacity-50"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAllowPreferredPrice}
                    onChange={(e) => setNewAllowPreferredPrice(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#1E9E60] focus:ring-[#34D186]"
                  />
                  <span className="text-[11px] text-slate-700 font-semibold leading-snug">
                    <strong>Allow Selling with Preferred Price (Without Affecting Company Price):</strong> Any profit above the Company Price is separated from Company Sales after checkout as what this affiliate earns.
                  </span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-montserrat font-black text-[#0A006E]">
                    6-Digit Login Security PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                      setLoginPin(randomPin);
                      setPinError(null);
                    }}
                    className="text-[10px] font-montserrat font-black text-[#1E9E60] hover:underline"
                  >
                    Generate 6-Digit PIN
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={loginPin}
                  onChange={(e) => {
                    setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setPinError(null);
                  }}
                  placeholder="6 digits (e.g. 582910)"
                  className="w-full px-3 py-2 bg-[#FFDE00]/20 border-2 border-[#0A006E] rounded-lg text-xs font-mono font-black text-[#0A006E] tracking-widest"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Liquor Store</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    {liquorStores.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.county})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Working Under POS Cashier
                  </label>
                  <select
                    value={assignedCashierId}
                    onChange={(e) => setAssignedCashierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">Auto-Assign Store POS Cashier</option>
                    {posCashiers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Personal Custom Slug / URL Key</label>
                <div className="flex items-center">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-2 border border-r-0 border-slate-300 rounded-l-lg font-mono">
                    /ref/
                  </span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="cynthia-spirits"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-r-lg text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">M-Pesa Payout Number</label>
                  <input
                    type="text"
                    value={mpesaNumber}
                    onChange={(e) => setMpesaNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setPinError(null);
                  }}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0A006E] text-[#FFDE00] rounded-lg text-xs font-montserrat font-black hover:bg-[#060046]"
                >
                  Activate Sales Representative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALES REPRESENTATIVE PREVIOUS SALES RECORDS MODAL */}
      {viewingRepSalesHistory && (() => {
        const isWithinTimeframe = (isoDate: string | undefined, tf: 'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
          if (tf === 'ALL' || !isoDate) return true;
          const ts = new Date(isoDate).getTime();
          if (Number.isNaN(ts)) return true;
          const nowMs = Date.now();
          if (tf === 'DAY') return nowMs - ts <= 24 * 60 * 60 * 1000;
          if (tf === 'WEEK') return nowMs - ts <= 7 * 24 * 60 * 60 * 1000;
          if (tf === 'MONTH') return nowMs - ts <= 30 * 24 * 60 * 60 * 1000;
          return nowMs - ts <= 365 * 24 * 60 * 60 * 1000;
        };

        const repOrdersAll = orders
          .filter(
            o =>
              o.affiliateId === viewingRepSalesHistory.id ||
              (o.affiliateName &&
                o.affiliateName.toLowerCase() === viewingRepSalesHistory.name.toLowerCase()) ||
              (o.cashierName &&
                o.cashierName.toLowerCase() === viewingRepSalesHistory.name.toLowerCase())
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const repOrdersFiltered = repOrdersAll.filter(o => {
          if (!isWithinTimeframe(o.createdAt, repHistoryPeriod)) return false;
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

        const totalBottles = repOrdersFiltered.reduce(
          (s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0),
          0
        );
        const totalGross = repOrdersFiltered.reduce((s, o) => s + o.totalKes, 0);
        const totalCompany = repOrdersFiltered.reduce(
          (s, o) => s + (o.companySalesKes ?? o.totalKes - (o.affiliateMarkupTotalKes || 0)),
          0
        );
        const totalMarkupProfit = repOrdersFiltered.reduce(
          (s, o) => s + (o.affiliateMarkupTotalKes || 0),
          0
        );
        const totalBaseComm = repOrdersFiltered.reduce(
          (s, o) => s + (o.affiliateBaseCommissionKes || 0),
          0
        );
        const totalEarned = repOrdersFiltered.reduce(
          (s, o) => s + (o.affiliateTotalEarnedKes ?? (o.affiliateMarkupTotalKes || 0) + (o.affiliateBaseCommissionKes || 0)),
          0
        );

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
                        Previous Sales Records — {viewingRepSalesHistory.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-mono font-black text-[11px]">
                        {viewingRepSalesHistory.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/15 text-white font-montserrat font-bold text-[10px]">
                        Sales Representative
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Historical sales register, itemized products sold, separated preferred price profit, and 16% VAT receipts.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRepSalesHistory(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-montserrat font-black uppercase text-slate-500">
                      Previous Sales Count
                    </div>
                    <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
                      {repOrdersFiltered.length} Orders
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {totalBottles} Total Bottles Sold
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-[#0A006E]/20">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                      Company Sales (Protected)
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#0A006E] mt-1">
                      {formatKes(totalCompany)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      Gross Paid: {formatKes(totalGross)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60]">
                      Separated Price Profit
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#1E9E60] mt-1">
                      +{formatKes(totalMarkupProfit)}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-800 mt-0.5">
                      Base Comm: +{formatKes(totalBaseComm)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FFDE00]/30 border border-[#0A006E]/25">
                    <div className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                      Total Rep Earned
                    </div>
                    <div className="font-montserrat font-black text-xl text-[#1E9E60] mt-1">
                      {formatKes(totalEarned)}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-amber-800 mt-0.5">
                      Pending Payout: {formatKes(viewingRepSalesHistory.pendingCommissionKes || 0)}
                    </div>
                  </div>
                </div>

                {/* Timeframe Filter + Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                    {(
                      [
                        { id: 'ALL', label: `All Previous (${repOrdersAll.length})` },
                        { id: 'DAY', label: 'Today' },
                        { id: 'WEEK', label: 'Last 7 Days' },
                        { id: 'MONTH', label: 'Last 30 Days' },
                        { id: 'YEAR', label: 'Last 365 Days' }
                      ] as const
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
                              No previous sales records found for <strong>{viewingRepSalesHistory.name}</strong> in this filter.
                            </td>
                          </tr>
                        ) : (
                          repOrdersFiltered.map(order => {
                            const companyPortion =
                              order.companySalesKes ?? order.totalKes - (order.affiliateMarkupTotalKes || 0);
                            const markupProfit = order.affiliateMarkupTotalKes || 0;
                            const baseComm = order.affiliateBaseCommissionKes || 0;
                            const totalEarnedOrder = order.affiliateTotalEarnedKes ?? markupProfit + baseComm;
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
                                  +{formatKes(totalEarnedOrder)}
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
                  Showing <strong>{repOrdersFiltered.length}</strong> of <strong>{repOrdersAll.length}</strong> total previous sales records for <strong>{viewingRepSalesHistory.name}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRepSalesHistory(null)}
                  className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer"
                >
                  Close Sales History
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 16% VAT Receipt Modal */}
      {lastCompletedInvoice && (
        <EtimsReceiptModal
          invoice={lastCompletedInvoice}
          onClose={() => setLastCompletedInvoice(null)}
        />
      )}

      {/* Sales Representative Off-Duty Request & Sales Manager Approval Modal */}
      {isOffDutyModalOpen && (
        <LeaveAndOffDutyModal
          mode="SALES_REP_OFF_DUTY"
          onClose={() => setIsOffDutyModalOpen(false)}
        />
      )}
    </div>
  );
};
