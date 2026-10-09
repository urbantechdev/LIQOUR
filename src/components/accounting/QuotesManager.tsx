import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { CommercialQuote, QuoteItem } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  Printer, 
  Eye, 
  Clock, 
  Calendar,
  Send,
  Building2,
  Sparkles
} from 'lucide-react';

export const QuotesManager: React.FC = () => {
  const { 
    quotes, 
    distributors, 
    branches, 
    products, 
    createQuote, 
    convertQuoteToInvoice 
  } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedQuote, setSelectedQuote] = useState<CommercialQuote | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [conversionSuccessMsg, setConversionSuccessMsg] = useState<string | null>(null);

  // Form State
  const [distributorId, setDistributorId] = useState<string>(distributors[0]?.id || 'CUSTOM');
  const [customClientName, setCustomClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientKraPin, setClientKraPin] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().substring(0, 10);
  });
  const [paymentTerms, setPaymentTerms] = useState('50% Advance via M-Pesa/Bank, 50% on Delivery');
  const [notes, setNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<{
    productId: string;
    quantity: number;
    unitPriceKes: number;
  }[]>([
    {
      productId: products[0]?.id || '',
      quantity: 60,
      unitPriceKes: products[0]?.wholesalePriceKes || 3000
    }
  ]);

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.distributorOrClientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (q.clientKraPin && q.clientKraPin.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalQuotesValue = quotes.reduce((sum, q) => sum + q.totalKes, 0);
  const convertedCount = quotes.filter(q => q.status === 'CONVERTED_TO_INVOICE').length;

  // Compute Line Items
  const computedItems: QuoteItem[] = lineItems
    .map(item => {
      const prod = products.find(p => p.id === item.productId) || products[0];
      if (!prod) return null;
      const totalWithoutVat = item.quantity * item.unitPriceKes;
      const vatAmountKes = totalWithoutVat * 0.16;
      const totalAmountKes = totalWithoutVat + vatAmountKes;

      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unitPriceKes: item.unitPriceKes,
        vatAmountKes,
        totalAmountKes
      };
    })
    .filter(Boolean) as QuoteItem[];

  const subtotalKes = computedItems.reduce((sum, i) => sum + (i.quantity * i.unitPriceKes), 0);
  const vatKes = computedItems.reduce((sum, i) => sum + i.vatAmountKes, 0);
  const totalKes = subtotalKes + vatKes;

  const handleAddLine = () => {
    const prod = products[0];
    setLineItems([
      ...lineItems,
      {
        productId: prod?.id || '',
        quantity: 24,
        unitPriceKes: prod?.wholesalePriceKes || 2500
      }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleProductSelect = (idx: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    const updated = [...lineItems];
    updated[idx].productId = prodId;
    if (prod) {
      updated[idx].unitPriceKes = prod.wholesalePriceKes;
    }
    setLineItems(updated);
  };

  const handleDistributorChange = (distId: string) => {
    setDistributorId(distId);
    if (distId !== 'CUSTOM') {
      const dist = distributors.find(d => d.id === distId);
      if (dist) {
        setCustomClientName(dist.companyName);
        setClientPhone(dist.phone);
        setClientEmail(dist.email);
        setClientKraPin(dist.kraPin);
      }
    } else {
      setCustomClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientKraPin('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const branch = branches.find(b => b.id === branchId) || branches[0];
    const clientName = distributorId === 'CUSTOM' ? customClientName : (distributors.find(d => d.id === distributorId)?.companyName || customClientName);

    if (!clientName) return;

    createQuote({
      distributorOrClientName: clientName,
      clientPhone,
      clientEmail,
      clientKraPin,
      distributorId: distributorId === 'CUSTOM' ? undefined : distributorId,
      branchId: branch.id,
      branchName: branch.name,
      issueDate: new Date().toISOString().substring(0, 10),
      validUntil,
      paymentTerms,
      status: 'SENT',
      subtotalKes,
      vatKes,
      totalKes,
      items: computedItems,
      notes
    });

    setIsAddModalOpen(false);
  };

  const handleConvert = (quoteId: string) => {
    const inv = convertQuoteToInvoice(quoteId);
    if (inv) {
      setConversionSuccessMsg(`Quote successfully converted to Commercial Invoice ${inv.invoiceNumber} and posted to General Ledger!`);
      setSelectedQuote(null);
      setTimeout(() => setConversionSuccessMsg(null), 6000);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Success Notification */}
      {conversionSuccessMsg && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{conversionSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setConversionSuccessMsg(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Quotes Issued</div>
          <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
            {quotes.length} Quotations
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Proforma invoices for Wholesale &amp; Hospitality
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Quotation Value</div>
          <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
            {formatKes(totalQuotesValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Calculated at Tier 1 &amp; Tier 2 wholesale rates
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Conversion Ratio</div>
            <div className="font-montserrat font-black text-2xl text-emerald-800 mt-1">
              {quotes.length > 0 ? ((convertedCount / quotes.length) * 100).toFixed(0) : 0}% ({convertedCount} Invoiced)
            </div>
          </div>
          <button
            onClick={() => {
              if (distributors.length > 0) handleDistributorChange(distributors[0].id);
              setIsAddModalOpen(true);
            }}
            className="mt-2 flex items-center justify-center space-x-2 px-3.5 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold hover:bg-[#0A006E]/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#FFDE00]" />
            <span>Create Proforma Quote</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">Sent to Client</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CONVERTED_TO_INVOICE">Converted to Invoice</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Quote Number</th>
                <th className="py-3 px-3">Client / Merchant</th>
                <th className="py-3 px-3">Issue Date</th>
                <th className="py-3 px-3">Valid Until</th>
                <th className="py-3 px-3">Subtotal</th>
                <th className="py-3 px-3">16% VAT</th>
                <th className="py-3 px-3">Total (KES)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                    {quote.quoteNumber}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-montserrat font-bold text-slate-800 text-xs">
                      {quote.distributorOrClientName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {quote.clientPhone} • PIN: {quote.clientKraPin || 'NOT SPECIFIED'}
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                    {quote.issueDate}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                    {quote.validUntil}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-slate-700">
                    {formatKes(quote.subtotalKes)}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-emerald-800 font-bold">
                    {formatKes(quote.vatKes)}
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-[#0A006E]">
                    {formatKes(quote.totalKes)}
                  </td>

                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      quote.status === 'CONVERTED_TO_INVOICE'
                        ? 'bg-purple-100 text-purple-900'
                        : quote.status === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-50 text-[#0A006E]'
                    }`}>
                      {quote.status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setSelectedQuote(quote)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>

                      {quote.status !== 'CONVERTED_TO_INVOICE' && (
                        <button
                          onClick={() => handleConvert(quote.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#34D186] hover:bg-[#34D186]/90 text-white font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                        >
                          <ArrowRight className="w-3 h-3 text-[#FFDE00]" />
                          <span>Convert to Invoice</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE PROFORMA QUOTE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  Generate Commercial Quotation / Proforma Invoice
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Client / Merchant *</label>
                  <select
                    value={distributorId}
                    onChange={(e) => handleDistributorChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {distributors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.companyName} ({d.tier.replace(/_/g, ' ')})
                      </option>
                    ))}
                    <option value="CUSTOM">+ New Custom Client / Hotel / Bar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Issuing Main Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Client Name / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kempinski Villa Rosa & Lounge"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Client KRA PIN</label>
                  <input
                    type="text"
                    placeholder="P051909090K"
                    value={clientKraPin}
                    onChange={(e) => setClientKraPin(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+254 700 000 000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Valid Until Date</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-montserrat font-bold text-slate-800 text-xs">
                    Quoted Products &amp; Wholesale Rates
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-2">Quantity (Bottles)</th>
                        <th className="py-2.5 px-2">Unit Price (KES)</th>
                        <th className="py-2.5 px-2">16% VAT</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((line, idx) => {
                        const prod = products.find(p => p.id === line.productId) || products[0];
                        const lineSubtotal = line.quantity * line.unitPriceKes;
                        const lineVat = lineSubtotal * 0.16;
                        const lineTotal = lineSubtotal + lineVat;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <select
                                value={line.productId}
                                onChange={(e) => handleProductSelect(idx, e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                              >
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) => {
                                  const updated = [...lineItems];
                                  updated[idx].quantity = Math.max(1, Number(e.target.value));
                                  setLineItems(updated);
                                }}
                                className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={10}
                                value={line.unitPriceKes}
                                onChange={(e) => {
                                  const updated = [...lineItems];
                                  updated[idx].unitPriceKes = Number(e.target.value);
                                  setLineItems(updated);
                                }}
                                className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                              />
                            </td>

                            <td className="py-2 px-2 font-mono text-emerald-800">
                              {formatKes(lineVat)}
                            </td>

                            <td className="py-2 px-3 font-montserrat font-bold text-slate-900">
                              {formatKes(lineTotal)}
                            </td>

                            <td className="py-2 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Commercial Terms / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Pricing valid for 14 days. Minimum order quantity 5 cases."
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Totals Banner */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <div className="text-slate-400">Total Proforma Quote Amount</div>
                  <div className="font-montserrat font-black text-xl text-[#0A006E]">
                    {formatKes(totalKes)}
                  </div>
                </div>
                <div className="text-right">
                  <div>Net Subtotal: <strong className="font-mono text-slate-800">{formatKes(subtotalKes)}</strong></div>
                  <div>16% VAT: <strong className="font-mono text-emerald-800">{formatKes(vatKes)}</strong></div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] text-white font-montserrat font-bold rounded-xl hover:bg-[#0A006E]/90 transition shadow-sm"
                >
                  Issue Proforma Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW QUOTE */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs uppercase font-mono font-bold text-slate-400">Commercial Quotation</span>
                <h3 className="font-montserrat font-black text-xl text-slate-900">
                  {selectedQuote.quoteNumber}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedQuote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-400">Prepared For:</div>
                <div className="font-montserrat font-bold text-slate-900 text-sm mt-0.5">{selectedQuote.distributorOrClientName}</div>
                <div className="font-mono text-slate-500 mt-0.5">{selectedQuote.clientPhone}</div>
                <div className="font-mono text-slate-500">PIN: {selectedQuote.clientKraPin || 'NOT SPECIFIED'}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400">Issuing Branch:</div>
                <div className="font-bold text-slate-800">{selectedQuote.branchName}</div>
                <div className="text-slate-500 mt-1">Issue Date: {selectedQuote.issueDate}</div>
                <div className="text-red-700 font-bold">Valid Until: {selectedQuote.validUntil}</div>
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedQuote.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatKes(item.unitPriceKes)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {formatKes(item.quantity * item.unitPriceKes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div className="text-slate-500">
                Payment Terms: <strong className="text-slate-800">{selectedQuote.paymentTerms}</strong>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-[10px]">Net: {formatKes(selectedQuote.subtotalKes)} + 16% VAT: {formatKes(selectedQuote.vatKes)}</div>
                <div className="font-montserrat font-black text-lg text-[#0A006E]">
                  {formatKes(selectedQuote.totalKes)}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-200 transition text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Quotation</span>
              </button>

              <div className="flex items-center space-x-2">
                {selectedQuote.status !== 'CONVERTED_TO_INVOICE' && (
                  <button
                    onClick={() => handleConvert(selectedQuote.id)}
                    className="px-4 py-2 bg-[#34D186] text-white font-montserrat font-bold rounded-xl hover:bg-[#34D186]/90 transition text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4 text-[#FFDE00]" />
                    <span>Convert to Commercial Invoice</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
