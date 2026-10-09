import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { ETimsInvoice, MpesaTransaction, JournalEntry, ChartAccount } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Calculator, 
  ShieldCheck, 
  CheckCircle2, 
  Wifi, 
  Layers, 
  BookOpen, 
  TrendingUp, 
  PieChart, 
  RefreshCw, 
  QrCode, 
  Eye, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCheck,
  Send,
  Sparkles,
  DollarSign,
  Factory,
  Network,
  Truck,
  FileText,
  CreditCard,
  Plus,
  Building2,
  Menu,
  X
} from 'lucide-react';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import { SuppliersManager } from './SuppliersManager';
import { DistributorsManager } from './DistributorsManager';
import { SupplyInvoicesManager } from './SupplyInvoicesManager';
import { QuotesManager } from './QuotesManager';
import { CommercialInvoicingManager } from './CommercialInvoicingManager';

export type AccountingTab = 
  | 'OVERVIEW' 
  | 'SUPPLIERS' 
  | 'DISTRIBUTORS' 
  | 'SUPPLY_INVOICES' 
  | 'QUOTES' 
  | 'INVOICING' 
  | 'LEDGER' 
  | 'RECONCILIATION';

export const AccountingHub: React.FC = () => {
  const { 
    etimsInvoices, 
    orders, 
    mpesaTransactions, 
    runMpesaAutoReconciliation, 
    simulateDarajaIncomingPayment,
    chartOfAccounts, 
    journalEntries,
    postManualJournalEntry,
    activeBranch,
    suppliers,
    distributors,
    supplyInvoices,
    quotes,
    commercialInvoices
  } = useErp();

  const [activeTab, setActiveTab] = useState<AccountingTab>('OVERVIEW');
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ETimsInvoice | null>(null);
  const [reconcileResult, setReconcileResult] = useState<{ count: number; amount: number } | null>(null);

  // Manual Journal Entry Modal State
  const [isManualJeModalOpen, setIsManualJeModalOpen] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [drAccount, setDrAccount] = useState('1030');
  const [crAccount, setCrAccount] = useState('4010');
  const [manualAmount, setManualAmount] = useState<number>(50000);

  // Daraja Simulation State
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simAmount, setSimAmount] = useState<number>(4200);
  const [simPhone, setSimPhone] = useState<string>('254712345678');
  const [simBillRef, setSimBillRef] = useState<string>('');
  const [simType, setSimType] = useState<'Paybill' | 'Buy Goods Till'>('Buy Goods Till');

  // Calculate VAT totals
  const totalTaxable = etimsInvoices.reduce((acc, inv) => acc + inv.taxableAmount, 0);
  const totalVatCollected = etimsInvoices.reduce((acc, inv) => acc + inv.taxAmount, 0);
  const totalInvoiced = etimsInvoices.reduce((acc, inv) => acc + inv.totalInvoiceAmount, 0);

  // Financial Statements
  const totalRevenue = chartOfAccounts
    .filter(a => a.type === 'REVENUE')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const totalCogs = chartOfAccounts
    .filter(a => a.type === 'COGS')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const grossProfit = totalRevenue - totalCogs;

  const totalExpenses = chartOfAccounts
    .filter(a => a.type === 'EXPENSE')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const netProfit = grossProfit - totalExpenses;

  const totalAssets = chartOfAccounts
    .filter(a => a.type === 'ASSET')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const totalLiabilities = chartOfAccounts
    .filter(a => a.type === 'LIABILITY')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const totalEquity = chartOfAccounts
    .filter(a => a.type === 'EQUITY')
    .reduce((acc, a) => acc + a.balanceKes, 0);

  const handleRunReconciliation = () => {
    const res = runMpesaAutoReconciliation();
    setReconcileResult({ count: res.matchedCount, amount: res.matchedAmount });
    setTimeout(() => setReconcileResult(null), 5000);
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    simulateDarajaIncomingPayment(simAmount, simPhone, simBillRef || 'ORD-2026-1049', simType);
    setIsSimulateModalOpen(false);
  };

  const handlePostManualJe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescription || manualAmount <= 0) return;

    const drAccObj = chartOfAccounts.find(a => a.code === drAccount);
    const crAccObj = chartOfAccounts.find(a => a.code === crAccount);

    postManualJournalEntry({
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'MANUAL',
      referenceId: `MAN-${Date.now().toString().slice(-4)}`,
      description: manualDescription,
      lines: [
        { accountCode: drAccount, accountName: drAccObj?.name || 'Account', debitKes: manualAmount, creditKes: 0 },
        { accountCode: crAccount, accountName: crAccObj?.name || 'Account', debitKes: 0, creditKes: manualAmount }
      ],
      totalDebitKes: manualAmount,
      totalCreditKes: manualAmount,
      postedBy: 'CPA Accountant Manual Post',
      branchId: activeBranch.id
    });

    setIsManualJeModalOpen(false);
    setManualDescription('');
  };

  const selectedOrder = orders.find(o => o.etimsInvoiceNumber === selectedInvoice?.invoiceNumber);

  return (
    <div className="space-y-5">
      
      {/* Top Banner */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        {/* Text Above + Mobile Hamburger Trigger */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-md shrink-0">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                Kenyan Commercial Accounts &amp; Compliance Hub
              </h2>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 font-semibold mt-0.5 sm:mt-1">
                Integrated Suppliers, Merchants, Inbound Consignments, B2B Invoicing, Quotes &amp; General Ledger.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Accounts Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Menu Below: Collapsed Inside Hamburger on Mobile, Visible on Desktop */}
        <div
          className={`${
            isHeroMenuOpen ? 'block' : 'hidden sm:block'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 animate-in fade-in`}
        >
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 bg-white/95 p-2 rounded-2xl border border-[#0A006E]/15 shadow-2xs">
            <button
              onClick={() => {
                setActiveTab('OVERVIEW');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'OVERVIEW' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('SUPPLIERS');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'SUPPLIERS' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Factory className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Suppliers ({suppliers.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('DISTRIBUTORS');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'DISTRIBUTORS' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Merchants ({distributors.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('SUPPLY_INVOICES');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'SUPPLY_INVOICES' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Supply Invoices / Packing</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('QUOTES');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'QUOTES' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Quotes ({quotes.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('INVOICING');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'INVOICING' ? 'bg-[#0A006E] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>Invoicing &amp; 16% VAT</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('LEDGER');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'LEDGER' ? 'bg-slate-900 text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>General Ledger</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('RECONCILIATION');
                setIsHeroMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'RECONCILIATION' ? 'bg-[#34D186] text-white shadow-xs font-black' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>M-Pesa Match</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & FINANCIAL HEALTH */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#0A006E]" />
                </div>
              </div>
              <div>
                <div 
                  className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-slate-900 mt-1 tracking-tight truncate"
                  title={formatKes(totalRevenue)}
                >
                  {formatKes(totalRevenue)}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 mt-1 truncate">
                Wholesale ({formatKes(chartOfAccounts.find(a => a.code === '4010')?.balanceKes || 0)}) + Retail
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Net Operating Profit</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#1E9E60]" />
                </div>
              </div>
              <div>
                <div 
                  className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#1E9E60] mt-1 tracking-tight truncate"
                  title={formatKes(netProfit)}
                >
                  {formatKes(netProfit)}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-[#1E9E60] mt-1 font-medium truncate">
                Gross Profit: {formatKes(grossProfit)}
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">16% KRA Output VAT</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#1E9E60]" />
                </div>
              </div>
              <div>
                <div 
                  className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#1E9E60] mt-1 tracking-tight truncate"
                  title={formatKes(totalVatCollected)}
                >
                  {formatKes(totalVatCollected)}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-[#1E9E60] mt-1 flex items-center gap-1 font-medium truncate">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>16% Statutory VAT Enforced</span>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Accounts Balance</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-[#0A006E]" />
                </div>
              </div>
              <div>
                <div 
                  className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#0A006E] mt-1 tracking-tight truncate"
                  title={formatKes(totalAssets)}
                >
                  {formatKes(totalAssets)}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 mt-1 truncate">
                Assets = Liabilities ({formatKes(totalLiabilities)}) + Equity
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div 
              onClick={() => setActiveTab('SUPPLIERS')}
              className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm hover:border-[#0A006E] cursor-pointer transition group flex flex-col justify-between hover-card-lift"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A006E] flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Factory className="w-6 h-6" />
                </div>
                <h3 className="font-montserrat font-bold text-slate-900 text-base">Suppliers &amp; Distillers</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {suppliers.length} active suppliers with KRA PINs, credit terms, and accounts payable ledger.
                </p>
              </div>
              <div className="text-xs font-montserrat font-bold text-[#0A006E] flex items-center gap-1 mt-2">
                <span>View Directory &amp; Ledger</span>
                <span>→</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('DISTRIBUTORS')}
              className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm hover:border-[#0A006E] cursor-pointer transition group flex flex-col justify-between hover-card-lift"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1E9E60] flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Network className="w-6 h-6" />
                </div>
                <h3 className="font-montserrat font-bold text-slate-900 text-base">Commercial Merchants</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Manage wholesale merchants across Rift Valley, Coast, Central and Nairobi Metros.
                </p>
              </div>
              <div className="text-xs font-montserrat font-bold text-[#1E9E60] flex items-center gap-1 mt-2">
                <span>View Wholesale Network</span>
                <span>→</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('SUPPLY_INVOICES')}
              className="bg-white p-6 sm:p-7 min-h-[195px] sm:min-h-[225px] rounded-2xl border border-slate-200 shadow-sm hover:border-[#0A006E] cursor-pointer transition group flex flex-col justify-between hover-card-lift"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-900 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="font-montserrat font-bold text-slate-900 text-base">Supply Invoices &amp; Packing Lists</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Record inbound stock shipments with container, seal, driver, and auto-inventory intake.
                </p>
              </div>
              <div className="text-xs font-montserrat font-bold text-purple-900 flex items-center gap-1 mt-2">
                <span>Manage Inbound Cargo</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIERS */}
      {activeTab === 'SUPPLIERS' && <SuppliersManager />}

      {/* TAB 3: DISTRIBUTORS */}
      {activeTab === 'DISTRIBUTORS' && <DistributorsManager />}

      {/* TAB 4: SUPPLY INVOICES & PACKING LISTS */}
      {activeTab === 'SUPPLY_INVOICES' && <SupplyInvoicesManager />}

      {/* TAB 5: QUOTES / PROFORMA INVOICES */}
      {activeTab === 'QUOTES' && <QuotesManager />}

      {/* TAB 6: INVOICING & 16% VAT */}
      {activeTab === 'INVOICING' && <CommercialInvoicingManager />}

      {/* TAB 7: GENERAL LEDGER & DOUBLE ENTRY JOURNALS */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-montserrat font-black text-sm text-slate-900">
                Double-Entry General Ledger (Chart of Accounts &amp; Journals)
              </h3>
              <p className="text-xs text-slate-500">
                Strict balance verification: Debits always equal Credits.
              </p>
            </div>
            <button
              onClick={() => setIsManualJeModalOpen(true)}
              className="px-4 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold hover:bg-[#0A006E]/90 transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#FFDE00]" />
              <span>Post Manual Journal Entry</span>
            </button>
          </div>

          {/* Chart of Accounts Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="font-montserrat font-black text-xs text-slate-400 uppercase tracking-widest mb-3">
              Chart of Accounts (Kenyan Standard Ledger)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {chartOfAccounts.map(account => (
                <div key={account.code} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-[11px] text-[#0A006E] bg-blue-50 px-1 rounded">
                        {account.code}
                      </span>
                      <span className="font-bold text-slate-800 truncate max-w-[160px]">{account.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{account.type}</div>
                  </div>
                  <div className="font-montserrat font-black text-xs text-slate-900">
                    {formatKes(account.balanceKes)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double-Entry Journal Entries */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-montserrat font-black text-sm text-slate-900">
                Balanced Journal Entries Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Auto-posted by POS 16% VAT Invoices, Supply Invoices, B2B Billing, and Payroll sync
              </p>
            </div>

            <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
              {journalEntries.map(entry => (
                <div key={entry.id} className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-[#0A006E] bg-blue-50 px-2 py-0.5 rounded">
                        {entry.entryNumber}
                      </span>
                      <span className="font-semibold text-slate-800">{entry.description}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-500 font-mono text-[11px]">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <span className="text-slate-700 font-bold">{entry.postedBy}</span>
                    </div>
                  </div>

                  {/* Journal Lines Table */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[10px] font-bold border-b border-slate-200 pb-1">
                          <th className="text-left pb-1">Account</th>
                          <th className="text-right pb-1">Debit (KES)</th>
                          <th className="text-right pb-1">Credit (KES)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entry.lines.map((line, idx) => (
                          <tr key={idx} className="text-slate-700">
                            <td className="py-1">
                              <span className="font-mono text-slate-400 mr-2">[{line.accountCode}]</span>
                              <span className="font-medium">{line.accountName}</span>
                            </td>
                            <td className="py-1 text-right font-mono font-semibold text-slate-900">
                              {line.debitKes > 0 ? formatKes(line.debitKes) : '-'}
                            </td>
                            <td className="py-1 text-right font-mono font-semibold text-slate-900">
                              {line.creditKes > 0 ? formatKes(line.creditKes) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 8: M-PESA RECONCILIATION */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-4">
          
          {/* Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Wifi className="w-5 h-5 text-[#1E9E60]" />
              <div>
                <h3 className="font-montserrat font-black text-sm text-slate-900">
                  Safaricom Daraja C2B / Paybill Direct Ingestion
                </h3>
                <p className="text-xs text-slate-500">
                  Zero-touch reconciliation: Matches transaction receipt numbers to POS &amp; B2B invoices.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsSimulateModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0A006E]" />
                <span>Simulate STK / Webhook</span>
              </button>

              <button
                onClick={handleRunReconciliation}
                className="px-4 py-2 bg-[#34D186] text-white hover:bg-[#34D186]/90 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Run Auto-Reconciliation</span>
              </button>
            </div>
          </div>

          {reconcileResult && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Reconciliation complete:</strong> Matched {reconcileResult.count} transactions totaling <strong>{formatKes(reconcileResult.amount)}</strong>.
              </div>
            </div>
          )}

          {/* M-Pesa Feed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Receipt / Code</th>
                    <th className="py-3 px-3">Channel &amp; Shortcode</th>
                    <th className="py-3 px-3">Customer Phone / Name</th>
                    <th className="py-3 px-3">Bill Reference</th>
                    <th className="py-3 px-3">Amount (KES)</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Reconciliation Status</th>
                    <th className="py-3 px-4">Matched Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mpesaTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {tx.receiptNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{tx.transactionType}</span>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {tx.shortCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{tx.customerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{tx.phoneNumber}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#0A006E]">
                        {tx.billRefNumber || 'N/A'}
                      </td>
                      <td className="py-3 px-3 font-montserrat font-black text-slate-900 text-sm">
                        {formatKes(tx.amountKes)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {tx.timestamp}
                      </td>
                      <td className="py-3 px-3">
                        {tx.status === 'RECONCILED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-montserrat">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>AUTO-RECONCILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-montserrat">
                            <span>PENDING MATCH</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        {tx.matchedInvoiceId || 'Awaiting Match'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: POST MANUAL JOURNAL ENTRY */}
      {isManualJeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  Post Manual Balanced Journal Entry
                </h3>
              </div>
              <button 
                onClick={() => setIsManualJeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostManualJe} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Transaction Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank charge adjustment / Inter-depot transit cost"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Debit Account (Dr.) *</label>
                  <select
                    value={drAccount}
                    onChange={(e) => setDrAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    {chartOfAccounts.map(a => (
                      <option key={a.code} value={a.code}>
                        [{a.code}] {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Credit Account (Cr.) *</label>
                  <select
                    value={crAccount}
                    onChange={(e) => setCrAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    {chartOfAccounts.map(a => (
                      <option key={a.code} value={a.code}>
                        [{a.code}] {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Balanced: Debit {formatKes(manualAmount)} = Credit {formatKes(manualAmount)}.</span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualJeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] text-white font-montserrat font-bold rounded-xl hover:bg-[#0A006E]/90 transition shadow-sm"
                >
                  Post to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedInvoice && (
        <EtimsReceiptModal
          invoice={selectedInvoice}
          order={selectedOrder}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* Simulate Daraja Payment Modal */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="font-montserrat font-black text-lg text-slate-900 mb-1">
              Simulate Safaricom Daraja C2B Payment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Simulates webhook payload from Safaricom API to test automated invoice clearing.
            </p>

            <form onSubmit={handleSimulatePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Type</label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Buy Goods Till">Buy Goods Till (Till 829102)</option>
                  <option value="Paybill">Paybill (Shortcode 4082211)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (KES)</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Phone Number</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bill Reference / Order Number</label>
                <input
                  type="text"
                  value={simBillRef}
                  onChange={(e) => setSimBillRef(e.target.value)}
                  placeholder="e.g. ORD-2026-1049"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSimulateModalOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#34D186] text-white rounded-lg text-xs font-montserrat font-bold hover:bg-[#34D186]/90"
                >
                  Trigger Daraja Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
