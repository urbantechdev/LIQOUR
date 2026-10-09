import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { LiveLoggedInCustomer } from '../../types';
import { formatKes, formatNumber } from '../../utils/kenyaTax';
import {
  detectKenyanMobileCarrier,
  formatKenyanMobileDisplay
} from '../../utils/kenyanMobileCarrier';
import { GeneralBusinessAnalytics } from './GeneralBusinessAnalytics';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Building2, 
  Boxes, 
  ShieldCheck, 
  Wifi, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  CreditCard, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  BarChart3,
  Percent,
  Warehouse,
  Store,
  Calendar,
  FileText,
  Truck,
  Globe,
  MapPin,
  Smartphone,
  Clock,
  Menu,
  X,
  Users,
  Mail,
  Phone
} from 'lucide-react';

export const ExecutiveDashboard: React.FC = () => {
  const { 
    chartOfAccounts, 
    inventoryItems, 
    products, 
    branches, 
    orders, 
    etimsInvoices, 
    mpesaTransactions,
    affiliates,
    websiteDeliveryOrders,
    updateWebsiteDeliveryOrderStatus,
    liveLoggedInCustomers,
    consumers
  } = useErp();

  const [customerSearch, setCustomerSearch] = useState('');

  // Merge live logged-in customer sessions with active website order customers & registered online consumers
  const unifiedLiveCustomers: LiveLoggedInCustomer[] = React.useMemo(() => {
    const byKey = new Map<string, LiveLoggedInCustomer>();

    // 1. Live active sessions from storefront heartbeats & storage
    liveLoggedInCustomers.forEach(c => {
      const key = (c.email || c.uid || c.phone).toLowerCase();
      if (!key) return;
      const carrierInfo = detectKenyanMobileCarrier(c.phone || '');
      byKey.set(key, {
        ...c,
        phone: carrierInfo.cleanDigits || c.phone || '',
        carrier: carrierInfo.carrier !== 'UNKNOWN' ? carrierInfo.carrier : c.carrier || 'UNKNOWN'
      });
    });

    // 2. Active website delivery orders (customers who logged in & placed orders)
    websiteDeliveryOrders.forEach(ord => {
      const email = (ord.customerEmail || '').trim().toLowerCase();
      const key = email || ord.customerPhone || ord.id;
      const existing = byKey.get(key);
      const carrierInfo = detectKenyanMobileCarrier(ord.customerPhone || '');
      const isHold = ord.deliveryStatus !== 'COMPLETED_AND_PAID';
      if (!existing) {
        byKey.set(key, {
          uid: `web-cust-${ord.id}`,
          name: ord.customerName || 'Online Customer',
          email: ord.customerEmail || `${ord.customerName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
          phone: carrierInfo.cleanDigits || ord.customerPhone || '',
          carrier: carrierInfo.carrier,
          deliveryZone: ord.deliveryLocation,
          branchId: ord.branchId,
          branchName: ord.branchName,
          cartItemsCount: ord.items.reduce((s, i) => s + i.quantity, 0),
          cartTotalKes: ord.totalCompanyPriceKes,
          activeOrdersCount: isHold ? 1 : 0,
          status: isHold ? 'ORDER_PLACED' : 'ONLINE',
          loginAt: ord.createdAt,
          lastActiveAt: ord.deliveredAt || ord.createdAt
        });
      } else if (isHold) {
        byKey.set(key, {
          ...existing,
          phone: existing.phone || carrierInfo.cleanDigits || ord.customerPhone,
          carrier: existing.carrier !== 'UNKNOWN' ? existing.carrier : carrierInfo.carrier,
          activeOrdersCount: Math.max(existing.activeOrdersCount, 1),
          status: existing.status === 'IN_CHECKOUT' ? 'IN_CHECKOUT' : 'ORDER_PLACED'
        });
      }
    });

    // 3. Registered consumers with email & phone
    consumers.forEach(con => {
      const email = (con.email || '').trim().toLowerCase();
      const key = email || con.phone || con.id;
      if (!byKey.has(key) && (email || con.phone)) {
        const carrierInfo = detectKenyanMobileCarrier(con.phone || '');
        byKey.set(key, {
          uid: con.id,
          name: con.fullName,
          email: con.email || `${con.fullName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
          phone: carrierInfo.cleanDigits || con.phone,
          carrier: carrierInfo.carrier,
          deliveryZone: con.defaultDeliveryLocation,
          branchId: con.preferredBranchId,
          cartItemsCount: 0,
          cartTotalKes: con.lifetimeSpendKes || 0,
          activeOrdersCount: con.totalOrdersCount || 0,
          status: 'ONLINE',
          loginAt: con.lastOrderAt || new Date().toISOString(),
          lastActiveAt: con.lastOrderAt || new Date().toISOString()
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) =>
      String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || ''))
    );
  }, [liveLoggedInCustomers, websiteDeliveryOrders, consumers]);

  const filteredLiveCustomers = React.useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return unifiedLiveCustomers;
    return unifiedLiveCustomers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.deliveryZone || '').toLowerCase().includes(q) ||
        (c.carrier || '').toLowerCase().includes(q)
    );
  }, [unifiedLiveCustomers, customerSearch]);

  const [period, setPeriod] = useState<'TODAY' | 'THIS_MONTH' | 'YEAR_TO_DATE'>('THIS_MONTH');
  const [dashboardMode, setDashboardMode] = useState<'FINANCIAL_ASSETS' | 'GENERAL_ANALYTICS'>('FINANCIAL_ASSETS');
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);

  // Asset Ledger breakdown
  const cashOnHand = chartOfAccounts.find(a => a.code === '1010')?.balanceKes || 0;
  const mpesaClearing = chartOfAccounts.find(a => a.code === '1020')?.balanceKes || 0;
  const bankOperating = chartOfAccounts.find(a => a.code === '1030')?.balanceKes || 0;
  const accountsReceivable = chartOfAccounts.find(a => a.code === '1100')?.balanceKes || 0;
  const ipsInventoryVal = chartOfAccounts.find(a => a.code === '1200')?.balanceKes || 0;
  const lpsInventoryVal = chartOfAccounts.find(a => a.code === '1210')?.balanceKes || 0;

  const totalLiquidAssets = cashOnHand + mpesaClearing + bankOperating;
  const totalInventoryAssetVal = ipsInventoryVal + lpsInventoryVal;
  const totalAssets = chartOfAccounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balanceKes, 0);

  // Liabilities & Working Capital
  const totalLiabilities = chartOfAccounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balanceKes, 0);
  const totalEquity = chartOfAccounts.filter(a => a.type === 'EQUITY').reduce((sum, a) => sum + a.balanceKes, 0);
  const netWorkingCapital = totalLiquidAssets + accountsReceivable + totalInventoryAssetVal - totalLiabilities;
  const currentRatio = totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : 'N/A';

  // Financial P&L Statistics
  const wholesaleRevenue = chartOfAccounts.find(a => a.code === '4010')?.balanceKes || 0;
  const retailRevenue = chartOfAccounts.find(a => a.code === '4020')?.balanceKes || 0;
  const totalGrossRevenue = wholesaleRevenue + retailRevenue;

  const cogsIps = chartOfAccounts.find(a => a.code === '5010')?.balanceKes || 0;
  const cogsLps = chartOfAccounts.find(a => a.code === '5020')?.balanceKes || 0;
  const totalCogs = cogsIps + cogsLps;

  const grossProfit = totalGrossRevenue - totalCogs;
  const grossMarginPct = totalGrossRevenue > 0 ? ((grossProfit / totalGrossRevenue) * 100).toFixed(1) : '0.0';

  const totalExpenses = chartOfAccounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.balanceKes, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = totalGrossRevenue > 0 ? ((netProfit / totalGrossRevenue) * 100).toFixed(1) : '0.0';

  // KRA eTIMS & Tax Stats
  const totalVatTransmitted = etimsInvoices.reduce((sum, i) => sum + i.taxAmount, 0);
  const etimsVerifiedCount = etimsInvoices.filter(i => i.transmissionStatus === 'VERIFIED').length;

  // After-Sales Separation Metrics (Company Sales vs. Separated Affiliate Profit)
  const totalGrossCustomerCollections = orders.reduce(
    (sum, o) => sum + (o.totalKes ?? o.totalAmount ?? 0),
    0
  );
  const totalSeparatedAffiliateProfit = orders.reduce(
    (sum, o) =>
      sum +
      (o.affiliateMarkupTotalKes ?? o.affiliateProfitAmount ?? o.affiliateMarkupTotal ?? 0),
    0
  );
  const totalCompanySalesOnly = orders.reduce(
    (sum, o) =>
      sum +
      (o.companySalesKes ??
        o.companySalesTotal ??
        (o.totalKes ?? o.totalAmount ?? 0) -
          (o.affiliateMarkupTotalKes ?? o.affiliateMarkupTotal ?? 0)),
    0
  );
  const totalAffiliateEarnedAll = orders.reduce(
    (sum, o) => sum + (o.affiliateTotalEarnedKes ?? o.affiliateCommissionAmount ?? 0),
    0
  );
  const affiliatePayableAccount =
    chartOfAccounts.find(a => a.code === '2045' || a.code === '2450')?.balanceKes || 0;

  // User-Facing Website Sales Stream Metrics
  const websitePaidOrders = orders.filter(
    o => o.orderSource === 'WEBSITE' || o.orderNumber.startsWith('WEB-')
  );
  const totalWebsiteSalesRevenueKes = websitePaidOrders.reduce(
    (sum, o) => sum + (o.companySalesKes ?? o.totalKes ?? 0),
    0
  );
  const websiteOnHoldOrders = websiteDeliveryOrders.filter(
    o => o.deliveryStatus !== 'COMPLETED_AND_PAID'
  );
  const totalWebsiteOnHoldValueKes = websiteOnHoldOrders.reduce(
    (sum, o) => sum + o.totalCompanyPriceKes,
    0
  );

  // Branch Asset Valuation Breakdown
  const branchAssetStats = branches.map(branch => {
    const items = inventoryItems.filter(i => i.branchId === branch.id);
    let val = 0;
    let totalBottles = 0;
    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        val += item.bottlesOnHand * prod.warehouseCostKes;
        totalBottles += item.bottlesOnHand;
      }
    }
    return {
      branch,
      val,
      totalBottles,
      pctOfTotal: totalInventoryAssetVal > 0 ? ((val / totalInventoryAssetVal) * 100).toFixed(1) : '0'
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Executive Welcome & Period Filter Header (Dashboard Hero) */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        {/* Top Row: Hero Title & Mobile Hamburger Toggle */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-md shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                Financial &amp; Assets Executive Dashboard
              </h2>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 font-semibold mt-0.5 sm:mt-1">
                Consolidated balance sheet assets, double-entry revenue streams, and KRA compliance metrics.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop 16% VAT Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-800 border border-emerald-200 text-xs font-bold font-montserrat shadow-2xs shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>16% Statutory VAT Enforced</span>
          </div>
        </div>

        {/* Hero Menu Below — Collapsed Inside Hamburger on Mobile, Always Visible on Desktop */}
        <div
          className={`${
            isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in`}
        >
          {/* Primary Dashboard Mode Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white/95 p-1.5 rounded-xl border border-[#0A006E]/20 text-xs font-montserrat font-bold shadow-2xs gap-1">
            <button
              type="button"
              onClick={() => {
                setDashboardMode('FINANCIAL_ASSETS');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-lg transition cursor-pointer text-left sm:text-center ${
                dashboardMode === 'FINANCIAL_ASSETS'
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs font-black'
                  : 'text-slate-700 hover:text-[#0A006E] hover:bg-slate-100'
              }`}
            >
              Financial &amp; Assets
            </button>
            <button
              type="button"
              onClick={() => {
                setDashboardMode('GENERAL_ANALYTICS');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-lg transition cursor-pointer text-left sm:text-center ${
                dashboardMode === 'GENERAL_ANALYTICS'
                  ? 'bg-[#34D186] text-[#FFDE00] shadow-xs font-black'
                  : 'text-slate-700 hover:text-[#1E9E60] hover:bg-slate-100'
              }`}
            >
              General Business Analytics
            </button>
          </div>

          {/* Period Filter Menu */}
          {dashboardMode === 'FINANCIAL_ASSETS' && (
            <div className="grid grid-cols-3 sm:flex items-center bg-white/90 p-1.5 rounded-xl border border-[#0A006E]/15 text-xs font-montserrat font-bold shadow-2xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setPeriod('TODAY');
                  setIsHeroMenuOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition text-center cursor-pointer ${
                  period === 'TODAY' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:text-[#0A006E]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod('THIS_MONTH');
                  setIsHeroMenuOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition text-center cursor-pointer ${
                  period === 'THIS_MONTH' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:text-[#0A006E]'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod('YEAR_TO_DATE');
                  setIsHeroMenuOpen(false);
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition text-center cursor-pointer ${
                  period === 'YEAR_TO_DATE' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:text-[#0A006E]'
                }`}
              >
                YTD 2026
              </button>
            </div>
          )}

          {/* Mobile 16% VAT Badge Inside Collapsed Hamburger */}
          <div className="sm:hidden flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-emerald-800 border border-emerald-200 text-xs font-bold font-montserrat shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>16% Statutory VAT Enforced</span>
          </div>
        </div>
      </div>

      {dashboardMode === 'GENERAL_ANALYTICS' ? (
        <GeneralBusinessAnalytics />
      ) : (
        <>
      {/* TOP STATS: FINANCIAL KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Assets Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] shadow-sm relative overflow-hidden flex flex-col justify-between hover-card-lift">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-xs">Total Enterprise Assets</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[#0A006E]" />
              </div>
            </div>
            <div 
              className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#0A006E] tracking-tight truncate" 
              title={formatKes(totalAssets)}
            >
              {formatKes(totalAssets)}
            </div>
          </div>
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Liquid + Inventory + Receivables</span>
            <span className="font-bold text-[#1E9E60]">100% Balanced</span>
          </div>
        </div>

        {/* Gross Operating Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] shadow-sm relative overflow-hidden flex flex-col justify-between hover-card-lift">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-50 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span className="font-bold uppercase tracking-wider text-[#1E9E60] text-xs">Gross Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#1E9E60]" />
              </div>
            </div>
            <div 
              className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-slate-900 tracking-tight truncate"
              title={formatKes(totalGrossRevenue)}
            >
              {formatKes(totalGrossRevenue)}
            </div>
          </div>
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Gross Margin:</span>
            <span className="font-montserrat font-bold text-[#1E9E60]">{grossMarginPct}%</span>
          </div>
        </div>

        {/* Net Profit (EBIT) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] shadow-sm relative overflow-hidden flex flex-col justify-between hover-card-lift">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-50 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span className="font-bold uppercase tracking-wider text-purple-900 text-xs">Net Operating Profit</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-800" />
              </div>
            </div>
            <div 
              className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-purple-950 tracking-tight truncate"
              title={formatKes(netProfit)}
            >
              {formatKes(netProfit)}
            </div>
          </div>
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Net Profit Margin:</span>
            <span className="font-montserrat font-bold text-purple-900">{netMarginPct}%</span>
          </div>
        </div>

        {/* KRA 16% VAT Collected */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] shadow-sm relative overflow-hidden flex flex-col justify-between hover-card-lift">
          <div className="absolute top-0 right-0 w-28 h-28 bg-yellow-50 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span className="font-bold uppercase tracking-wider text-slate-600 text-xs">KRA Output VAT 16%</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-[#1E9E60]" />
              </div>
            </div>
            <div 
              className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#1E9E60] tracking-tight truncate"
              title={formatKes(totalVatTransmitted)}
            >
              {formatKes(totalVatTransmitted)}
            </div>
          </div>
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>16% VAT Invoices:</span>
            <span className="font-bold text-slate-800">{etimsVerifiedCount} Recorded</span>
          </div>
        </div>

      </div>

      {/* AFTER-SALES PROFIT SEPARATION: COMPANY SALES vs. AFFILIATE PREFERRED PRICE PROFIT */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/15 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-montserrat font-black text-base text-[#0A006E] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#1E9E60]" />
              <span>After-Sales Separation: Company Sales vs. Sales Affiliate Profit</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sales affiliates can sell at their preferred price without affecting Company Price. After each sale, affiliate price profit is automatically separated from Company Sales.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[#1E9E60] font-montserrat font-bold text-xs shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#1E9E60]" />
            <span>Company Price Immutable</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              1. Gross Customer Collections
            </div>
            <div className="font-montserrat font-black text-lg text-slate-900 mt-1">
              {formatKes(totalGrossCustomerCollections)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total paid by customers at POS ({orders.length} orders)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A006E]">
              2. Separated Company Sales
            </div>
            <div className="font-montserrat font-black text-lg text-[#0A006E] mt-1">
              {formatKes(totalCompanySalesOnly)}
            </div>
            <div className="text-[11px] text-blue-900/75 mt-1">
              Retained by company strictly at Company Price
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E9E60]">
              3. Separated Affiliate Price Profit
            </div>
            <div className="font-montserrat font-black text-lg text-[#1E9E60] mt-1">
              +{formatKes(totalSeparatedAffiliateProfit)}
            </div>
            <div className="text-[11px] text-emerald-900/80 mt-1">
              Preferred Price − Company Price (Excluded from Co. Revenue)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#34D186] text-white border border-[#34D186]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#FFDE00]">
              4. Total Affiliate Earnings
            </div>
            <div className="font-montserrat font-black text-lg text-[#FFDE00] mt-1">
              {formatKes(totalAffiliateEarnedAll)}
            </div>
            <div className="text-[11px] text-emerald-100 mt-1">
              What Affiliates Earn • Unpaid Liability: {formatKes(affiliatePayableAccount)}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE LOGGED-IN CUSTOMERS DIRECTORY (ADMIN REAL-TIME VIEW: NAME, EMAIL & CONTACT) */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/20 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#34D186] text-white flex items-center justify-center font-black shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-[#0A006E]">
                  Live Logged-In Storefront Customers
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[10px] uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#34D186] animate-pulse" />
                  <span>{unifiedLiveCustomers.length} Live Customer(s)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time admin visibility of logged-in customers on the storefront, including their verified full name, email address, and mobile contact (Safaricom / Airtel).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Search name, email, or phone..."
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E] w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Contact / Mobile Number</th>
                <th className="py-2.5 px-3">Network</th>
                <th className="py-2.5 px-3">Delivery Zone &amp; Branch</th>
                <th className="py-2.5 px-3">Cart / Orders</th>
                <th className="py-2.5 px-3">Live Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLiveCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 font-medium">
                    No matching logged-in customers found.
                  </td>
                </tr>
              ) : (
                filteredLiveCustomers.map(cust => {
                  const carrierInfo = detectKenyanMobileCarrier(cust.phone || '');
                  const isAirtel = carrierInfo.carrier === 'AIRTEL' || cust.carrier === 'AIRTEL';
                  const isSafaricom =
                    carrierInfo.carrier === 'SAFARICOM' || cust.carrier === 'SAFARICOM';
                  return (
                    <tr key={cust.uid + cust.email} className="hover:bg-slate-50/90 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#34D186] animate-pulse shrink-0" />
                          <div>
                            <div className="font-montserrat font-black text-slate-900">
                              {cust.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Active:{' '}
                              {cust.lastActiveAt
                                ? new Date(cust.lastActiveAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Just now'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <a
                          href={`mailto:${cust.email}`}
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-[#0A006E] hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cust.email}</span>
                        </a>
                      </td>
                      <td className="py-3 px-3">
                        {cust.phone ? (
                          <a
                            href={`tel:${cust.phone}`}
                            className="inline-flex items-center gap-1.5 font-mono font-black text-slate-900 hover:text-[#0A006E]"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#1E9E60] shrink-0" />
                            <span>{formatKenyanMobileDisplay(cust.phone)}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Pending phone entry</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isAirtel ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-montserrat font-black text-[9px] uppercase">
                            Airtel Kenya
                          </span>
                        ) : isSafaricom ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#34D186] text-white font-montserrat font-black text-[9px] uppercase">
                            Safaricom
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-montserrat font-bold text-[9px] uppercase">
                            Mobile Line
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-semibold truncate max-w-[180px]">
                          {cust.deliveryZone || 'Nairobi Metro'}
                        </div>
                        {cust.branchName && (
                          <div className="text-[10px] text-slate-500 truncate">
                            Outlet: {cust.branchName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="font-black text-[#0A006E]">
                          {formatKes(cust.cartTotalKes || 0)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {cust.cartItemsCount || 0} item(s) • {cust.activeOrdersCount || 0} order(s)
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-montserrat font-black text-[10px] uppercase ${
                            cust.status === 'IN_CHECKOUT'
                              ? 'bg-amber-100 text-amber-900'
                              : cust.status === 'ORDER_PLACED'
                              ? 'bg-blue-100 text-[#0A006E]'
                              : 'bg-emerald-100 text-[#1E9E60]'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{cust.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LIVE WEBSITE SALES STREAM (DIRECT CUSTOMER PORTAL — COMPANY PRICE) */}
      <div className="bg-white rounded-2xl border-2 border-[#34D186]/20 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shrink-0 shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-[#0A006E]">
                  Live Website Sales Stream (User-Facing Online Portal)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[10px] uppercase">
                  100% Company Price • 0% Affiliate Markup
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders placed on the independent user-facing website stay on hold until delivered, then stream here as Website Sales when the customer prompts M-Pesa payment.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('vaairo:open-storefront'))}
            aria-label="Open Customer Website"
            title="Open Customer Website"
            className="w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer shrink-0 self-end sm:self-auto"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Open Customer Website</span>
          </button>
        </div>

        {/* Website Stream KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E9E60]">
              Website Sales Revenue (Paid)
            </div>
            <div className="font-montserrat font-black text-xl text-[#1E9E60] mt-1">
              {formatKes(totalWebsiteSalesRevenueKes)}
            </div>
            <div className="text-[11px] text-emerald-800 mt-1">
              {websitePaidOrders.length} completed website order(s) at Company Price
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
              Website Orders On Hold (In Delivery)
            </div>
            <div className="font-montserrat font-black text-xl text-amber-950 mt-1">
              {formatKes(totalWebsiteOnHoldValueKes)}
            </div>
            <div className="text-[11px] text-amber-800 mt-1">
              {websiteOnHoldOrders.length} order(s) awaiting delivery &amp; customer M-Pesa self-prompt
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A006E]">
              Affiliate Commission on Website Sales
            </div>
            <div className="font-montserrat font-black text-xl text-[#0A006E] mt-1">
              KES 0.00
            </div>
            <div className="text-[11px] text-blue-900/80 mt-1">
              Direct portal orders bypass sales affiliates (100% Company Sales)
            </div>
          </div>
        </div>

        {/* Website Orders Stream Table (Both On-Hold Deliveries & Completed Website Sales) */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Web Order #</th>
                <th className="py-2.5 px-3">Customer &amp; Phone</th>
                <th className="py-2.5 px-3">Delivery Location</th>
                <th className="py-2.5 px-3">Drinks Ordered</th>
                <th className="py-2.5 px-3">Company Price Total</th>
                <th className="py-2.5 px-3">Delivery &amp; Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {websiteOnHoldOrders.map(holdOrd => (
                <tr key={holdOrd.id} className="bg-amber-50/40 hover:bg-amber-50/70 transition">
                  <td className="py-3 px-3 font-mono font-black text-[#0A006E]">
                    <div>{holdOrd.orderNumber}</div>
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[9px] font-sans font-bold">
                      ON HOLD (DELIVERY)
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{holdOrd.customerName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{holdOrd.customerPhone}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                      <span>{holdOrd.deliveryLocation}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {holdOrd.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-[#0A006E]">
                    {formatKes(holdOrd.totalCompanyPriceKes)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>
                          {holdOrd.deliveryStatus === 'DELIVERED_AWAITING_PAYMENT'
                            ? 'Delivered • Awaiting Customer Self-Prompt'
                            : 'On Hold • Out for Delivery'}
                        </span>
                      </span>
                      {holdOrd.deliveryStatus !== 'DELIVERED_AWAITING_PAYMENT' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateWebsiteDeliveryOrderStatus(
                              holdOrd.id,
                              'DELIVERED_AWAITING_PAYMENT'
                            )
                          }
                          className="px-2 py-1 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-bold text-[10px] hover:bg-[#060046] cursor-pointer"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {websitePaidOrders.map(webSale => (
                <tr key={webSale.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-black text-[#1E9E60]">
                    <div>{webSale.orderNumber}</div>
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-[#1E9E60] text-[9px] font-sans font-bold">
                      WEBSITE SALE
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{webSale.customerName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{webSale.customerPhone}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    <div className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#1E9E60] shrink-0" />
                      <span>{webSale.deliveryAddress || 'Doorstep Delivery'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {webSale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-[#1E9E60]">
                    {formatKes(webSale.companySalesKes ?? webSale.totalKes)}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-bold text-[10px]">
                      <Smartphone className="w-3 h-3" />
                      <span>PAID ON DELIVERY • {webSale.mpesaReceiptNumber || 'MPESA'}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED SECTION 1: ASSETS PORTFOLIO ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Asset Class Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 min-h-[490px] shadow-sm space-y-6 flex flex-col justify-between hover-card-lift">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-[#0A006E]" />
                  <span>Enterprise Asset Structure</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Categorized by Liquidity, Working Inventory, and Accounts Receivable</p>
              </div>
              <span className="font-montserrat font-black text-base text-[#0A006E]">
                {formatKes(totalAssets)}
              </span>
            </div>

            <div className="space-y-4">
              
              {/* Liquid Cash & Banks */}
              <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34D186]" />
                    <span className="font-bold text-slate-800 text-sm">Liquid Treasury &amp; M-Pesa Settlement</span>
                  </div>
                  <span className="font-montserrat font-black text-slate-900 text-sm">{formatKes(totalLiquidAssets)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#34D186] h-full rounded-full transition-all"
                    style={{ width: `${((totalLiquidAssets / totalAssets) * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 pt-1">
                  <div className="truncate">Till Cash: <strong className="text-slate-800">{formatKes(cashOnHand)}</strong></div>
                  <div className="truncate">Daraja M-Pesa: <strong className="text-slate-800">{formatKes(mpesaClearing)}</strong></div>
                  <div className="truncate">Bank Operating: <strong className="text-slate-800">{formatKes(bankOperating)}</strong></div>
                </div>
              </div>

              {/* Inventory Valuation: IPS vs LPS */}
              <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0A006E]" />
                    <span className="font-bold text-slate-800 text-sm">Alcohol Inventory Stock Asset (IPS &amp; LPS)</span>
                  </div>
                  <span className="font-montserrat font-black text-[#0A006E] text-sm">{formatKes(totalInventoryAssetVal)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-[#34D186] h-full transition-all"
                    style={{ width: `${((ipsInventoryVal / totalInventoryAssetVal) * 100).toFixed(1)}%` }}
                    title="IPS (Imported Stock)"
                  />
                  <div 
                    className="bg-[#FFDE00] h-full transition-all"
                    style={{ width: `${((lpsInventoryVal / totalInventoryAssetVal) * 100).toFixed(1)}%` }}
                    title="LPS (Local Stock)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#34D186] shrink-0" />
                    <span className="truncate">IPS (Imported Bonded): <strong className="text-slate-900">{formatKes(ipsInventoryVal)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#FFDE00] shrink-0" />
                    <span className="truncate">LPS (Local Excise Paid): <strong className="text-slate-900">{formatKes(lpsInventoryVal)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Accounts Receivable */}
              <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="font-bold text-slate-800 text-sm">Accounts Receivable (Brokers &amp; Distributors)</span>
                  </div>
                  <span className="font-montserrat font-black text-slate-900 text-sm">{formatKes(accountsReceivable)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${((accountsReceivable / totalAssets) * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 pt-0.5">
                  Cleared automatically upon Safaricom Daraja STK Push / Paybill settlement.
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Liquidity Ratios & Working Capital (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 min-h-[490px] shadow-sm flex flex-col justify-between space-y-5 hover-card-lift">
          <div>
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2.5">
                <Percent className="w-5 h-5 text-[#1E9E60]" />
                <span>Financial Ratios &amp; Solvency</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time statutory accounting health</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Current Liquidity Ratio</div>
                  <div className="text-[11px] text-slate-400">Total Assets / Total Liabilities</div>
                </div>
                <div className="font-montserrat font-black text-xl text-[#1E9E60]">
                  {currentRatio}x
                </div>
              </div>

              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Net Working Capital</div>
                  <div className="text-[11px] text-slate-400">Operating Capital Reserve</div>
                </div>
                <div className="font-montserrat font-black text-base sm:text-lg text-[#0A006E] truncate shrink-0 ml-2" title={formatKes(netWorkingCapital)}>
                  {formatKes(netWorkingCapital)}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Owner's Shareholder Equity</div>
                  <div className="text-[11px] text-slate-400">Capital + Retained Earnings</div>
                </div>
                <div className="font-montserrat font-black text-base sm:text-lg text-slate-900 truncate shrink-0 ml-2" title={formatKes(totalEquity)}>
                  {formatKes(totalEquity)}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Total Trade Payables</div>
                  <div className="text-[11px] text-slate-400">Due to Distillers (EABL, KDL)</div>
                </div>
                <div className="font-montserrat font-black text-base sm:text-lg text-red-700 truncate shrink-0 ml-2" title={formatKes(totalLiabilities)}>
                  {formatKes(totalLiabilities)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-[#1E9E60] flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#1E9E60] shrink-0" />
            <span className="font-medium">
              Solvency Verified: Assets exceed liabilities by <strong>{formatKes(totalAssets - totalLiabilities)}</strong>.
            </span>
          </div>
        </div>

      </div>

      {/* DETAILED SECTION 2: BRANCH ASSETS & STOCK VALUATION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-black text-base text-slate-900 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-[#0A006E]" />
              <span>Branch-by-Branch Inventory Asset Distribution</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live inventory valuation across Central Bonded Warehouse, Main Stores, and Liquor Outlets.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            Total Branches: {branches.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Branch Facility</th>
                <th className="py-3 px-3">Distribution Tier</th>
                <th className="py-3 px-3">County Location</th>
                <th className="py-3 px-3">Stock Units</th>
                <th className="py-3 px-3">Asset Value (Cost)</th>
                <th className="py-3 px-3">% of Inventory Asset</th>
                <th className="py-3 px-4">Direct Sales Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchAssetStats.map(({ branch, val, totalBottles, pctOfTotal }) => (
                <tr key={branch.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-montserrat font-bold text-slate-900 text-sm">
                      {branch.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Code: {branch.code} • PIN: {branch.kraPin}
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0A006E]">
                      {branch.tier.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700 font-medium">
                    {branch.location} ({branch.county})
                  </td>

                  <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                    {totalBottles.toLocaleString()} btls
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-[#0A006E]">
                    {formatKes(val)}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#0A006E] h-full rounded-full"
                          style={{ width: `${pctOfTotal}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 text-xs">{pctOfTotal}%</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {branch.allowDirectSales ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Retail/Wholesale Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
                        Storage Only (No Sales)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

    </div>
  );
};
