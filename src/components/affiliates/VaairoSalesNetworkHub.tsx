import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import {
  Affiliate,
  Product,
  SalesNetworkCustomer,
  SalesNetworkCustomerSegment
} from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import {
  Network,
  UserPlus,
  ShoppingBag,
  TrendingUp,
  FileCheck2,
  ShieldCheck,
  ArrowRightLeft,
  Copy,
  Check,
  Plus,
  Trash2,
  Tag,
  Smartphone,
  Building2,
  Mail,
  MapPin,
  Search,
  CheckCircle2,
  Sparkles,
  Receipt
} from 'lucide-react';

interface VaairoSalesNetworkHubProps {
  onOpenPreferredPriceBook: (affiliateId: string) => void;
  onDisbursePayout: (affiliate: Affiliate) => void;
}

const SEGMENT_LABELS: Record<SalesNetworkCustomerSegment, string> = {
  BAR_LOUNGE: 'Bar / Lounge / Club',
  EVENT_PLANNER: 'Event & Wedding Planner',
  CORPORATE_B2B: 'Corporate / Hospitality B2B',
  VIP_PRIVATE_CLIENT: 'VIP Private Cellar Client',
  RETAIL_CONSUMER: 'Direct Retail Consumer'
};

export const VaairoSalesNetworkHub: React.FC<VaairoSalesNetworkHubProps> = ({
  onOpenPreferredPriceBook,
  onDisbursePayout
}) => {
  const {
    affiliates,
    commissions,
    products,
    websiteDeliveryOrders,
    salesNetworkCustomers,
    onboardSalesNetworkCustomer,
    createSalesNetworkRemoteOrder
  } = useErp();

  const [activeSubTab, setActiveSubTab] = useState<
    'REMOTE_SELLING' | 'CUSTOMERS' | 'PERFORMANCE' | 'RECONCILIATION'
  >('REMOTE_SELLING');

  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    () => affiliates[0]?.id || ''
  );
  const [copiedRefSlug, setCopiedRefSlug] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. CUSTOMER ONBOARDING STATE
  // ---------------------------------------------------------------------------
  const [isOnboardFormOpen, setIsOnboardFormOpen] = useState(false);
  const [customerFilterAgentId, setCustomerFilterAgentId] = useState<string>('ALL');
  const [newCustName, setNewCustName] = useState('');
  const [newCustVenue, setNewCustVenue] = useState('');
  const [newCustSegment, setNewCustSegment] =
    useState<SalesNetworkCustomerSegment>('BAR_LOUNGE');
  const [newCustPhone, setNewCustPhone] = useState('2547');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustKraPin, setNewCustKraPin] = useState('');
  const [newCustLocation, setNewCustLocation] = useState(
    'Westlands — Woodvale Grove, Nairobi'
  );
  const [newCustNotes, setNewCustNotes] = useState('');

  // ---------------------------------------------------------------------------
  // 2. REMOTE ORDER GENERATOR STATE
  // ---------------------------------------------------------------------------
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [remoteCustomerName, setRemoteCustomerName] = useState<string>('');
  const [remoteCustomerPhone, setRemoteCustomerPhone] = useState<string>('2547');
  const [remoteCustomerEmail, setRemoteCustomerEmail] = useState<string>('');
  const [remoteDeliveryLocation, setRemoteDeliveryLocation] = useState<string>(
    'Westlands — Electric Avenue, Nairobi'
  );
  const [remoteDeliveryNotes, setRemoteDeliveryNotes] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [remoteCart, setRemoteCart] = useState<
    {
      product: Product;
      quantity: number;
      preferredSellingUnitPrice: number;
    }[]
  >(() => {
    const initialProds = products.slice(0, 2);
    const firstAff = affiliates[0];
    return initialProds.map(p => {
      const bookPrice = firstAff?.preferredPrices?.[p.id];
      const defaultPreferred =
        bookPrice && bookPrice > p.retailPriceKes
          ? bookPrice
          : Math.round(p.retailPriceKes * 1.08);
      return {
        product: p,
        quantity: 2,
        preferredSellingUnitPrice: defaultPreferred
      };
    });
  });

  // ---------------------------------------------------------------------------
  // 3. RECONCILIATION FILTER STATE
  // ---------------------------------------------------------------------------
  const [reconciliationAgentId, setReconciliationAgentId] = useState<string>(
    () => affiliates[0]?.id || 'ALL'
  );

  const selectedAgent = useMemo(
    () => affiliates.find(a => a.id === selectedAgentId) || affiliates[0] || null,
    [affiliates, selectedAgentId]
  );

  const handleCopyAgentStorefrontLink = (slug: string) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://liqour.urbantechdev.com';
    const url = `${origin}/?ref=${encodeURIComponent(slug)}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedRefSlug(slug);
    setTimeout(() => setCopiedRefSlug(null), 2500);
  };

  const handleSelectOnboardedCustomerForOrder = (cust: SalesNetworkCustomer) => {
    setSelectedAgentId(cust.affiliateId);
    setSelectedCustomerId(cust.id);
    setRemoteCustomerName(
      cust.businessOrVenueName
        ? `${cust.customerName} (${cust.businessOrVenueName})`
        : cust.customerName
    );
    setRemoteCustomerPhone(cust.phone);
    setRemoteCustomerEmail(cust.email || '');
    setRemoteDeliveryLocation(cust.defaultDeliveryLocation);
    setRemoteDeliveryNotes(cust.defaultDeliveryNotes || '');
    setActiveSubTab('REMOTE_SELLING');
  };

  const handleAddProductToRemoteCart = (product: Product) => {
    const bookPrice = selectedAgent?.preferredPrices?.[product.id];
    const allowPref = selectedAgent ? selectedAgent.allowPreferredPrice !== false : true;
    const resolvedPreferred = allowPref
      ? bookPrice && bookPrice > product.retailPriceKes
        ? bookPrice
        : Math.round(product.retailPriceKes * 1.08)
      : product.retailPriceKes;

    setRemoteCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          preferredSellingUnitPrice: resolvedPreferred
        }
      ];
    });
  };

  const filteredCatalogProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [products, productSearch]);

  // Live Accounting Separation Preview for Remote Order Builder
  const remoteOrderPreview = useMemo(() => {
    const allowPref = selectedAgent ? selectedAgent.allowPreferredPrice !== false : true;
    const commMode = selectedAgent?.commissionMode || 'COMMISSION_AND_PROFIT';
    const commRate = selectedAgent?.commissionRatePercent ?? 5;

    let companySalesKes = 0;
    let grossCustomerTotalKes = 0;

    remoteCart.forEach(item => {
      const baseUnit = item.product.retailPriceKes;
      const soldUnit = allowPref
        ? Math.max(baseUnit, Math.round(item.preferredSellingUnitPrice || baseUnit))
        : baseUnit;
      companySalesKes += baseUnit * item.quantity;
      grossCustomerTotalKes += soldUnit * item.quantity;
    });

    const rawMarkup = Math.max(0, grossCustomerTotalKes - companySalesKes);
    const separatedMarkupProfitKes = commMode === 'BASE_COMMISSION_ONLY' ? 0 : rawMarkup;
    const baseCommissionKes =
      commMode === 'PREFERRED_PRICE_PROFIT_ONLY'
        ? 0
        : Math.round((companySalesKes * commRate) / 100);
    const totalCommissionPayableKes = separatedMarkupProfitKes + baseCommissionKes;
    const netCompanyRetainedKes = Math.max(0, companySalesKes - baseCommissionKes);

    return {
      companySalesKes,
      grossCustomerTotalKes,
      separatedMarkupProfitKes,
      baseCommissionKes,
      totalCommissionPayableKes,
      netCompanyRetainedKes,
      commRate,
      commMode,
      allowPref
    };
  }, [remoteCart, selectedAgent]);

  const handleCreateOnboardedCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    const created = onboardSalesNetworkCustomer({
      affiliateId: selectedAgent?.id || affiliates[0]?.id || 'aff-1',
      customerName: newCustName,
      businessOrVenueName: newCustVenue,
      segment: newCustSegment,
      phone: newCustPhone,
      email: newCustEmail,
      kraPin: newCustKraPin,
      defaultDeliveryLocation: newCustLocation,
      defaultDeliveryNotes: newCustNotes
    });

    setBannerMessage(
      `Onboarded "${created.customerName}" (${created.customerCode}) under Sales Agent ${created.affiliateName}. Ready for remote ordering!`
    );
    setTimeout(() => setBannerMessage(null), 5000);
    setNewCustName('');
    setNewCustVenue('');
    setNewCustEmail('');
    setNewCustKraPin('');
    setIsOnboardFormOpen(false);
  };

  const handleSubmitRemoteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || remoteCart.length === 0) return;
    const finalName = remoteCustomerName.trim() || 'Remote Beverage Client';
    const finalPhone = remoteCustomerPhone.trim() || '254722000000';
    const finalLocation =
      remoteDeliveryLocation.trim() || 'Westlands — Nairobi';

    const result = createSalesNetworkRemoteOrder({
      affiliateId: selectedAgent.id,
      salesNetworkCustomerId: selectedCustomerId || undefined,
      customerName: finalName,
      customerPhone: finalPhone,
      customerEmail: remoteCustomerEmail.trim() || undefined,
      deliveryLocation: finalLocation,
      deliveryNotes: remoteDeliveryNotes.trim() || undefined,
      items: remoteCart
    });

    setBannerMessage(
      `Remote Order ${result.order.orderNumber} generated by ${selectedAgent.name}! Separated Accounting → Company Sales: ${formatKes(
        result.companySalesKes
      )} | Affiliate Markup Profit: +${formatKes(
        result.affiliateMarkupProfitKes
      )} | Base Commission: +${formatKes(
        result.affiliateBaseCommissionKes
      )} | Total Commission Payable (Acct 2045): ${formatKes(
        result.totalAffiliatePayableKes
      )}.`
    );
    setTimeout(() => setBannerMessage(null), 7000);
  };

  const filteredCustomers = useMemo(() => {
    if (customerFilterAgentId === 'ALL') return salesNetworkCustomers;
    return salesNetworkCustomers.filter(c => c.affiliateId === customerFilterAgentId);
  }, [salesNetworkCustomers, customerFilterAgentId]);

  const reconciliationAgent = useMemo(
    () =>
      reconciliationAgentId === 'ALL'
        ? null
        : affiliates.find(a => a.id === reconciliationAgentId) || null,
    [affiliates, reconciliationAgentId]
  );

  const reconciliationRecords = useMemo(() => {
    const affiliateOnly = commissions.filter(c => c.recipientRole !== 'POS_CASHIER');
    if (reconciliationAgentId === 'ALL') return affiliateOnly;
    return affiliateOnly.filter(c => c.affiliateId === reconciliationAgentId);
  }, [commissions, reconciliationAgentId]);

  const reconciliationSummary = useMemo(() => {
    let grossCollectedKes = 0;
    let companyBaseSalesKes = 0;
    let markupProfitKes = 0;
    let baseCommissionKes = 0;
    let totalEarnedKes = 0;
    let paidOutKes = 0;
    let pendingPayableKes = 0;

    reconciliationRecords.forEach(r => {
      const mProfit =
        r.preferredPriceProfitKes !== undefined
          ? r.preferredPriceProfitKes
          : Math.max(0, r.soldPriceKes - r.baselinePriceKes);
      const bComm =
        r.baseCommissionKes !== undefined
          ? r.baseCommissionKes
          : Math.max(0, r.markupEarnedKes - mProfit);

      grossCollectedKes += r.soldPriceKes;
      companyBaseSalesKes += r.baselinePriceKes;
      markupProfitKes += mProfit;
      baseCommissionKes += bComm;
      totalEarnedKes += r.markupEarnedKes;
      if (r.status === 'PAID') {
        paidOutKes += r.markupEarnedKes;
      } else {
        pendingPayableKes += r.markupEarnedKes;
      }
    });

    return {
      grossCollectedKes,
      companyBaseSalesKes,
      markupProfitKes,
      baseCommissionKes,
      totalEarnedKes,
      paidOutKes,
      pendingPayableKes
    };
  }, [reconciliationRecords]);

  return (
    <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-md overflow-hidden">
      {/* =====================================================================
          HEADER: VAAIRO SALES NETWORK ARCHITECTURE & 3-WAY ACCOUNTING SEPARATION
          ===================================================================== */}
      <div className="bg-linear-to-r from-[#0A006E] via-[#090258] to-[#1E9E60] text-white p-5 sm:p-6 border-b-2 border-[#FFDE00] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5" />
                <span>VAAIRO Sales Network • Commercial Distribution Engine</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-mono text-[10px] font-bold">
                {affiliates.length} Active Sales Agents • {salesNetworkCustomers.length} Onboarded Accounts
              </span>
            </div>
            <h3 className="font-montserrat font-black italic text-xl sm:text-2xl text-white tracking-tight">
              VAAIRO Sales Network — Remote Ordering, Customer Onboarding &amp; Profit Separation
            </h3>
            <p className="text-xs text-slate-200 max-w-3xl">
              Empowers field sales agents and beverage affiliates to onboard customers, manage SKU-level Preferred Pricing, generate remote delivery orders, and reconcile separated <strong className="text-[#FFDE00]">Company Sales</strong>, <strong className="text-emerald-300">Affiliate Markup Profit</strong>, and <strong className="text-[#FFDE00]">Commission Payable (Acct 2045)</strong>.
            </p>
          </div>

          {/* Commercial Chain Diagram Pill */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-3.5 text-[11px] font-mono space-y-1.5 shrink-0">
            <div className="text-[10px] font-montserrat font-black uppercase text-[#FFDE00] tracking-wider">
              Commercial Revenue Waterfall
            </div>
            <div className="flex items-center gap-1.5 text-white font-bold flex-wrap">
              <span className="px-2 py-0.5 rounded bg-white/15">Merchant</span>
              <span className="text-[#FFDE00]">→</span>
              <span className="px-2 py-0.5 rounded bg-white/15">Sales Agent</span>
              <span className="text-[#FFDE00]">→</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">Preferred Price</span>
              <span className="text-[#FFDE00]">→</span>
              <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-black">Markup + Comm</span>
            </div>
            <div className="text-[10px] text-slate-300 flex items-center gap-3 pt-0.5">
              <span>• Acct 4010: Company Sales</span>
              <span>• Acct 2045: Commission Payable</span>
            </div>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/15">
          <button
            type="button"
            onClick={() => setActiveSubTab('REMOTE_SELLING')}
            className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'REMOTE_SELLING'
                ? 'bg-[#FFDE00] text-[#0A006E] shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>1. Remote Order &amp; Preferred Pricing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('CUSTOMERS')}
            className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'CUSTOMERS'
                ? 'bg-[#FFDE00] text-[#0A006E] shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>2. Onboard Customers ({salesNetworkCustomers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('PERFORMANCE')}
            className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'PERFORMANCE'
                ? 'bg-[#FFDE00] text-[#0A006E] shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>3. Agent Performance &amp; Price Books</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('RECONCILIATION')}
            className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'RECONCILIATION'
                ? 'bg-[#FFDE00] text-[#0A006E] shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>4. Payment &amp; Reconciliation Statement</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div className="m-5 mb-0 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#1E9E60] shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: GENERATE ORDERS & SELL REMOTELY WITH PREFERRED PRICING
          ===================================================================== */}
      {activeSubTab === 'REMOTE_SELLING' && (
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Agent Selection, Customer Pick & Product Catalogue */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-montserrat font-black uppercase text-[#0A006E] tracking-wider">
                    Step 1 • Active Sales Network Agent
                  </span>
                  <h4 className="font-montserrat font-black text-sm text-slate-900">
                    Select Sales Agent &amp; Shareable Remote Storefront Link
                  </h4>
                </div>
                {selectedAgent && (
                  <button
                    type="button"
                    onClick={() => onOpenPreferredPriceBook(selectedAgent.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1.5 cursor-pointer self-start"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      Manage {selectedAgent.name.split(' ')[0]}&apos;s Preferred Price Book (
                      {Object.keys(selectedAgent.preferredPrices || {}).length} SKUs)
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Selling Agent / Affiliate
                  </label>
                  <select
                    value={selectedAgent?.id || ''}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#0A006E]/30 font-montserrat font-bold text-xs text-slate-900 focus:outline-none focus:border-[#0A006E]"
                  >
                    {affiliates.map(aff => (
                      <option key={aff.id} value={aff.id}>
                        {aff.name} ({aff.code}) • {aff.commissionRatePercent ?? 5}% Base + Markup
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAgent && (
                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                      Remote Storefront Referral Link
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={`${
                          typeof window !== 'undefined'
                            ? window.location.origin
                            : 'https://liqour.urbantechdev.com'
                        }/?ref=${selectedAgent.customSlug}`}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-[11px] text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyAgentStorefrontLink(selectedAgent.customSlug)}
                        className="px-3 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedRefSlug === selectedAgent.customSlug ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product Picker with Company Price vs Agent Preferred Price */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60] tracking-wider">
                    Step 2 • Add Products with Protected Company Floor Price
                  </span>
                  <h4 className="font-montserrat font-black text-sm text-slate-900">
                    Select Beverages for Remote Customer Order
                  </h4>
                </div>
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search 657 drinks by name or SKU..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredCatalogProducts.map(prod => {
                  const agentPrefPrice = selectedAgent?.preferredPrices?.[prod.id];
                  const effectivePref =
                    agentPrefPrice && agentPrefPrice > prod.retailPriceKes
                      ? agentPrefPrice
                      : Math.round(prod.retailPriceKes * 1.08);
                  const perBottleMarkup = Math.max(0, effectivePref - prod.retailPriceKes);

                  return (
                    <div
                      key={prod.id}
                      className="p-3 rounded-xl border border-slate-200 hover:border-[#0A006E] bg-slate-50/60 flex items-center justify-between gap-2 transition"
                    >
                      <div className="min-w-0">
                        <div className="font-montserrat font-bold text-xs text-slate-900 truncate">
                          {prod.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Company Price:{' '}
                          <strong className="text-[#0A006E]">
                            {formatKes(prod.retailPriceKes)}
                          </strong>{' '}
                          • Pref:{' '}
                          <strong className="text-[#1E9E60]">
                            {formatKes(effectivePref)}
                          </strong>{' '}
                          (+{formatKes(perBottleMarkup)})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddProductToRemoteCart(prod)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Remote Order Customer Details, Preferred Price Line Editor & Accounting Separation */}
          <form
            onSubmit={handleSubmitRemoteOrder}
            className="lg:col-span-5 bg-slate-50 rounded-2xl border-2 border-[#0A006E]/20 p-4 sm:p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                    Step 3 • Remote Order &amp; Profit Split
                  </span>
                  <h4 className="font-montserrat font-black text-base text-slate-900">
                    Remote Order Sheet ({remoteCart.reduce((s, i) => s + i.quantity, 0)} Bottles)
                  </h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#1E9E60] font-mono font-black text-[10px]">
                  Floor Protected
                </span>
              </div>

              {/* Customer Selector (From Onboarded Book or Direct Entry) */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] font-montserrat font-black uppercase text-slate-600 mb-1">
                    Load Onboarded Customer Account (Optional)
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={e => {
                      const cid = e.target.value;
                      setSelectedCustomerId(cid);
                      const found = salesNetworkCustomers.find(c => c.id === cid);
                      if (found) {
                        setRemoteCustomerName(
                          found.businessOrVenueName
                            ? `${found.customerName} (${found.businessOrVenueName})`
                            : found.customerName
                        );
                        setRemoteCustomerPhone(found.phone);
                        setRemoteCustomerEmail(found.email || '');
                        setRemoteDeliveryLocation(found.defaultDeliveryLocation);
                        setRemoteDeliveryNotes(found.defaultDeliveryNotes || '');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Enter New Remote Customer or Select Account --</option>
                    {salesNetworkCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customerCode}: {c.customerName}
                        {c.businessOrVenueName ? ` (${c.businessOrVenueName})` : ''} — Agent:{' '}
                        {c.affiliateName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-montserrat font-bold text-slate-700 mb-0.5">
                      Customer / Venue Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={remoteCustomerName}
                      onChange={e => setRemoteCustomerName(e.target.value)}
                      placeholder="e.g. Havana Lounge Westlands"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-montserrat font-bold text-slate-700 mb-0.5">
                      M-Pesa Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={remoteCustomerPhone}
                      onChange={e => setRemoteCustomerPhone(e.target.value)}
                      placeholder="2547XX XXX XXX"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-[#0A006E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-montserrat font-bold text-slate-700 mb-0.5">
                      Customer Email (Order &amp; Receipt)
                    </label>
                    <input
                      type="email"
                      value={remoteCustomerEmail}
                      onChange={e => setRemoteCustomerEmail(e.target.value)}
                      placeholder="client@venue.co.ke"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-montserrat font-bold text-slate-700 mb-0.5">
                      Delivery Address / Zone *
                    </label>
                    <input
                      type="text"
                      required
                      value={remoteDeliveryLocation}
                      onChange={e => setRemoteDeliveryLocation(e.target.value)}
                      placeholder="Westlands, Kilimani, Karen..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items with Preferred Selling Price & Markup Editor */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {remoteCart.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-400">
                    Click &ldquo;Add&rdquo; on any beverage on the left to build a remote order.
                  </div>
                ) : (
                  remoteCart.map(item => {
                    const companyFloor = item.product.retailPriceKes;
                    const soldUnit = remoteOrderPreview.allowPref
                      ? Math.max(companyFloor, item.preferredSellingUnitPrice)
                      : companyFloor;
                    const lineMarkup = Math.max(0, (soldUnit - companyFloor) * item.quantity);

                    return (
                      <div
                        key={item.product.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-montserrat font-bold text-slate-900 truncate">
                            {item.product.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRemoteCart(prev =>
                                prev.filter(i => i.product.id !== item.product.id)
                              )
                            }
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-center">
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-slate-400">
                              Qty (Bottles)
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                                setRemoteCart(prev =>
                                  prev.map(i =>
                                    i.product.id === item.product.id ? { ...i, quantity: q } : i
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                            />
                          </div>

                          <div>
                            <span className="block text-[9px] font-bold uppercase text-slate-400">
                              Company Floor
                            </span>
                            <div className="font-mono font-bold text-[#0A006E] py-1">
                              {formatKes(companyFloor)}
                            </div>
                          </div>

                          <div>
                            <span className="block text-[9px] font-bold uppercase text-[#1E9E60]">
                              Preferred Price
                            </span>
                            <input
                              type="number"
                              min={companyFloor}
                              step={50}
                              disabled={!remoteOrderPreview.allowPref}
                              value={soldUnit}
                              onChange={e => {
                                const nextVal = Math.max(
                                  companyFloor,
                                  parseInt(e.target.value, 10) || companyFloor
                                );
                                setRemoteCart(prev =>
                                  prev.map(i =>
                                    i.product.id === item.product.id
                                      ? { ...i, preferredSellingUnitPrice: nextVal }
                                      : i
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 rounded-lg border-2 border-emerald-500/40 font-mono font-black text-xs text-[#1E9E60]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                          <span className="text-slate-500">
                            Line Total: <strong className="font-mono text-slate-800">{formatKes(soldUnit * item.quantity)}</strong>
                          </span>
                          <span className="font-mono font-bold text-[#1E9E60]">
                            Agent Markup: +{formatKes(lineMarkup)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 3-Way Accounting Separation Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-950 text-white space-y-2 text-xs border border-[#FFDE00]/40">
                <div className="flex items-center justify-between text-[10px] font-montserrat font-black uppercase text-[#FFDE00]">
                  <span>Automated Accounting Separation</span>
                  <span>Acct 4010 vs. Acct 2045</span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-200">
                  <span>Gross Customer Payable (Preferred Price):</span>
                  <span className="font-mono font-black text-white">
                    {formatKes(remoteOrderPreview.grossCustomerTotalKes)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-200">
                  <span>1. Protected Company Sales (Base Price):</span>
                  <span className="font-mono font-bold text-[#FFDE00]">
                    {formatKes(remoteOrderPreview.companySalesKes)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-emerald-300">
                  <span>2. Separated Affiliate Markup Profit:</span>
                  <span className="font-mono font-black">
                    +{formatKes(remoteOrderPreview.separatedMarkupProfitKes)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-emerald-300">
                  <span>
                    3. Base Volume Commission ({remoteOrderPreview.commRate}% of Company Sales):
                  </span>
                  <span className="font-mono font-black">
                    +{formatKes(remoteOrderPreview.baseCommissionKes)}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/15 flex items-center justify-between">
                  <span className="font-montserrat font-black text-xs text-[#FFDE00]">
                    Commission Payable to {selectedAgent?.name.split(' ')[0] || 'Agent'} (Acct 2045):
                  </span>
                  <span className="font-mono font-black text-sm text-[#FFDE00]">
                    {formatKes(remoteOrderPreview.totalCommissionPayableKes)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={remoteCart.length === 0 || !remoteCustomerName.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                Generate Remote Order &amp; Post Commission ({formatKes(remoteOrderPreview.grossCustomerTotalKes)})
              </span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 2: ONBOARD CUSTOMERS & AGENT CLIENT BOOK
          ===================================================================== */}
      {activeSubTab === 'CUSTOMERS' && (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h4 className="font-montserrat font-black text-base text-slate-900">
                Onboarded Sales Network Customer Portfolio ({filteredCustomers.length})
              </h4>
              <p className="text-xs text-slate-500">
                Sales agents onboard bars, event planners, corporate accounts, and VIP private buyers to track repeat orders and separated commissions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={customerFilterAgentId}
                onChange={e => setCustomerFilterAgentId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 font-montserrat font-bold text-xs text-[#0A006E]"
              >
                <option value="ALL">All Sales Agents ({salesNetworkCustomers.length})</option>
                {affiliates.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsOnboardFormOpen(prev => !prev)}
                className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isOnboardFormOpen ? 'Close Onboarding Form' : '+ Onboard New Customer'}</span>
              </button>
            </div>
          </div>

          {isOnboardFormOpen && (
            <form
              onSubmit={handleCreateOnboardedCustomer}
              className="p-5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h5 className="font-montserrat font-black text-sm text-[#0A006E]">
                  Onboard New Customer into VAAIRO Sales Network
                </h5>
                <span className="text-[11px] font-semibold text-slate-500">
                  Automatically links repeat orders &amp; preferred pricing to the assigned agent
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Assigned Sales Agent *
                  </label>
                  <select
                    value={selectedAgent?.id || ''}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                  >
                    {affiliates.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Contact Person Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="e.g. Kelvin Mutua"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Business / Lounge / Venue Name
                  </label>
                  <input
                    type="text"
                    value={newCustVenue}
                    onChange={e => setNewCustVenue(e.target.value)}
                    placeholder="e.g. Mercury Lounge ABC Place"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Customer Segment *
                  </label>
                  <select
                    value={newCustSegment}
                    onChange={e =>
                      setNewCustSegment(e.target.value as SalesNetworkCustomerSegment)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800"
                  >
                    {Object.entries(SEGMENT_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    M-Pesa Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="2547XX XXX XXX"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Customer Email (For Order &amp; 16% VAT Receipts)
                  </label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={e => setNewCustEmail(e.target.value)}
                    placeholder="orders@venue.co.ke"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Buyer KRA PIN (Optional for B2B 16% VAT Invoice)
                  </label>
                  <input
                    type="text"
                    value={newCustKraPin}
                    onChange={e => setNewCustKraPin(e.target.value.toUpperCase())}
                    placeholder="P051XXXXXXX"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono uppercase text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                    Default Delivery Location / Landmark *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustLocation}
                    onChange={e => setNewCustLocation(e.target.value)}
                    placeholder="Westlands — Woodvale Grove, Nairobi"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer"
                >
                  Save &amp; Onboard Customer
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCustomers.map(cust => (
              <div
                key={cust.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-[#0A006E] bg-white shadow-2xs flex flex-col justify-between gap-3 transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0A006E] font-mono font-bold text-[10px]">
                          {cust.customerCode}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#1E9E60] font-montserrat font-bold text-[10px]">
                          {SEGMENT_LABELS[cust.segment]}
                        </span>
                      </div>
                      <h5 className="font-montserrat font-black text-sm text-slate-900 mt-1">
                        {cust.customerName}
                      </h5>
                      {cust.businessOrVenueName && (
                        <div className="text-xs font-bold text-[#0A006E] flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{cust.businessOrVenueName}</span>
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-slate-100 font-mono font-bold text-[10px] text-slate-700">
                      {cust.totalOrdersCount} Orders
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono font-semibold">{cust.phone}</span>
                      {cust.kraPin && (
                        <span className="ml-auto font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                          PIN: {cust.kraPin}
                        </span>
                      )}
                    </div>
                    {cust.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono truncate">{cust.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.defaultDeliveryLocation}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-500">
                      <span>Assigned Sales Agent:</span>
                      <strong className="text-[#0A006E]">
                        {cust.affiliateName} ({cust.affiliateCode})
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Gross Customer Spend:</span>
                      <strong className="font-mono text-slate-900">
                        {formatKes(cust.grossSpendKes)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Company Base Sales:</span>
                      <strong className="font-mono text-[#0A006E]">
                        {formatKes(cust.companySalesKes)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[#1E9E60] font-bold">
                      <span>Agent Markup + Commission:</span>
                      <span className="font-mono">
                        +{formatKes(cust.affiliateMarkupProfitKes + cust.affiliateBaseCommissionKes)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectOnboardedCustomerForOrder(cust)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Generate Remote Order for {cust.customerName.split(' ')[0]}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AGENT PERFORMANCE MONITOR & PREFERRED PRICING
          ===================================================================== */}
      {activeSubTab === 'PERFORMANCE' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-montserrat font-black text-base text-slate-900">
                VAAIRO Sales Network — Agent Performance &amp; Margin Scorecard
              </h4>
              <p className="text-xs text-slate-500">
                Real-time visibility into each agent&apos;s onboarded accounts, remote orders, separated Company Sales, Preferred Price Markup, and Commission Payable.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Sales Agent</th>
                  <th className="py-3 px-3 text-center">Onboarded Clients</th>
                  <th className="py-3 px-3 text-center">Preferred SKUs</th>
                  <th className="py-3 px-3 text-right">Gross Sold (Preferred)</th>
                  <th className="py-3 px-3 text-right">Company Sales (Protected)</th>
                  <th className="py-3 px-3 text-right">Separated Markup Profit</th>
                  <th className="py-3 px-3 text-right">Base % Comm</th>
                  <th className="py-3 px-3 text-right">Pending Payable</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {affiliates.map(aff => {
                  const agentClients = salesNetworkCustomers.filter(
                    c => c.affiliateId === aff.id
                  ).length;
                  const prefSkuCount = Object.keys(aff.preferredPrices || {}).length;
                  const agentComms = commissions.filter(
                    c => c.affiliateId === aff.id && c.recipientRole !== 'POS_CASHIER'
                  );
                  const sepProfit =
                    aff.preferredPriceProfitTotalKes !== undefined
                      ? aff.preferredPriceProfitTotalKes
                      : agentComms.reduce(
                          (s, c) =>
                            s +
                            (c.preferredPriceProfitKes ??
                              Math.max(0, c.soldPriceKes - c.baselinePriceKes)),
                          0
                        );
                  const compSales =
                    aff.companySalesTotalKes !== undefined
                      ? aff.companySalesTotalKes
                      : Math.max(0, (aff.totalSalesKes || 0) - sepProfit);
                  const baseComm =
                    aff.baseCommissionTotalKes !== undefined
                      ? aff.baseCommissionTotalKes
                      : agentComms.reduce((s, c) => s + (c.baseCommissionKes || 0), 0);

                  return (
                    <tr key={aff.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-black text-slate-900">{aff.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {aff.code} • {aff.mpesaNumber}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-[#0A006E]">
                        {agentClients}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenPreferredPriceBook(aff.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0A006E] font-montserrat font-bold text-[10px] cursor-pointer"
                        >
                          {prefSkuCount} SKUs • Edit
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatKes(aff.totalSalesKes)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0A006E]">
                        {formatKes(compSales)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-[#1E9E60]">
                        +{formatKes(sepProfit)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        +{formatKes(baseComm)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-700">
                        {formatKes(aff.pendingCommissionKes)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReconciliationAgentId(aff.id);
                              setActiveSubTab('RECONCILIATION');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-montserrat font-bold text-[10px] cursor-pointer"
                          >
                            Statement
                          </button>
                          <button
                            type="button"
                            disabled={aff.pendingCommissionKes <= 0}
                            onClick={() => onDisbursePayout(aff)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[10px] disabled:opacity-40 cursor-pointer"
                          >
                            Pay B2C
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PAYMENT & RECONCILIATION STATEMENT
          ===================================================================== */}
      {activeSubTab === 'RECONCILIATION' && (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h4 className="font-montserrat font-black text-base text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#0A006E]" />
                <span>
                  Agent Payment &amp; Commission Reconciliation Statement
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                Auditable separation of Company Sales (Acct 4010), Affiliate Preferred Price Markup, Base Commission, and M-Pesa B2C Settlement (Acct 2045).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reconciliationAgentId}
                onChange={e => setReconciliationAgentId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-300 font-montserrat font-bold text-xs text-[#0A006E]"
              >
                <option value="ALL">All Sales Network Agents (Consolidated)</option>
                {affiliates.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code}) — Pending: {formatKes(a.pendingCommissionKes)}
                  </option>
                ))}
              </select>

              {reconciliationAgent && reconciliationAgent.pendingCommissionKes > 0 && (
                <button
                  type="button"
                  onClick={() => onDisbursePayout(reconciliationAgent)}
                  className="px-4 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    Disburse {formatKes(reconciliationAgent.pendingCommissionKes)} via M-Pesa B2C
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* 5-Column Reconciliation Equation Waterfall */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500 block">
                1. Gross Sold (Preferred)
              </span>
              <div className="font-mono font-black text-base text-slate-900 mt-1">
                {formatKes(reconciliationSummary.grossCollectedKes)}
              </div>
              <span className="text-[10px] text-slate-500">Total customer collections</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200">
              <span className="text-[10px] font-montserrat font-bold uppercase text-[#0A006E] block">
                2. Company Sales (Acct 4010)
              </span>
              <div className="font-mono font-black text-base text-[#0A006E] mt-1">
                {formatKes(reconciliationSummary.companyBaseSalesKes)}
              </div>
              <span className="text-[10px] text-slate-600">Protected merchant base</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-montserrat font-bold uppercase text-[#1E9E60] block">
                3. Affiliate Markup Profit
              </span>
              <div className="font-mono font-black text-base text-[#1E9E60] mt-1">
                +{formatKes(reconciliationSummary.markupProfitKes)}
              </div>
              <span className="text-[10px] text-emerald-800">Sold minus Company Price</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
              <span className="text-[10px] font-montserrat font-bold uppercase text-emerald-900 block">
                4. Base Commission Earned
              </span>
              <div className="font-mono font-black text-base text-emerald-800 mt-1">
                +{formatKes(reconciliationSummary.baseCommissionKes)}
              </div>
              <span className="text-[10px] text-slate-600">
                Disbursed: {formatKes(reconciliationSummary.paidOutKes)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300">
              <span className="text-[10px] font-montserrat font-black uppercase text-amber-900 block">
                5. Net Commission Payable
              </span>
              <div className="font-mono font-black text-base text-amber-800 mt-1">
                {formatKes(reconciliationSummary.pendingPayableKes)}
              </div>
              <span className="text-[10px] text-amber-900 font-semibold">
                Liability Account 2045
              </span>
            </div>
          </div>

          {/* Detailed Reconciliation Ledger */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Order # &amp; Date</th>
                  <th className="py-3 px-3">Sales Agent</th>
                  <th className="py-3 px-3 text-right">Company Sales</th>
                  <th className="py-3 px-3 text-right">Preferred Sold Price</th>
                  <th className="py-3 px-3 text-right">Markup Profit</th>
                  <th className="py-3 px-3 text-right">Base Commission</th>
                  <th className="py-3 px-3 text-right">Total Payable</th>
                  <th className="py-3 px-4">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationRecords.map(rec => {
                  const markup =
                    rec.preferredPriceProfitKes !== undefined
                      ? rec.preferredPriceProfitKes
                      : Math.max(0, rec.soldPriceKes - rec.baselinePriceKes);
                  const baseComm =
                    rec.baseCommissionKes !== undefined
                      ? rec.baseCommissionKes
                      : Math.max(0, rec.markupEarnedKes - markup);
                  const remoteOrd = websiteDeliveryOrders.find(
                    o => o.orderNumber === rec.orderNumber || o.id === rec.orderId
                  );

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#0A006E]">
                          {rec.orderNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {remoteOrd ? `Remote: ${remoteOrd.customerName}` : new Date(rec.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {rec.affiliateName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#0A006E] font-bold">
                        {formatKes(rec.baselinePriceKes)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900 font-bold">
                        {formatKes(rec.soldPriceKes)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#1E9E60] font-black">
                        +{formatKes(markup)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                        +{formatKes(baseComm)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900 font-black">
                        {formatKes(rec.markupEarnedKes)}
                      </td>
                      <td className="py-3 px-4">
                        {rec.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-mono font-bold text-[10px]">
                            ✓ PAID ({rec.payoutMpesaRef || 'B2C'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                            PENDING (Acct 2045)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
