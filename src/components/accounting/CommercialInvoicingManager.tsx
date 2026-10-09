import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { CommercialInvoice, QuoteItem } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  CreditCard, 
  Plus, 
  Search, 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  X, 
  Printer, 
  Eye, 
  QrCode, 
  ArrowUpRight,
  FileCheck2,
  Calendar,
  Layers
} from 'lucide-react';

export const CommercialInvoicingManager: React.FC = () => {
  const { 
    commercialInvoices, 
    distributors, 
    branches, 
    products, 
    createCommercialInvoice, 
    recordCommercialInvoicePayment 
  } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<CommercialInvoice | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Payment Recording State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<CommercialInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'BANK_TRANSFER' | 'CASH'>('MPESA');

  // Form State
  const [distributorId, setDistributorId] = useState<string>(distributors[0]?.id || 'CUSTOM');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientKraPin, setClientKraPin] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().substring(0, 10);
  });
  const [notes, setNotes] = useState('');

  // Line Items
  const [lineItems, setLineItems] = useState<{
    productId: string;
    quantity: number;
    unitPriceKes: number;
  }[]>([
    {
      productId: products[0]?.id || '',
      quantity: 100,
      unitPriceKes: products[0]?.wholesalePriceKes || 3500
    }
  ]);

  const filteredInvoices = commercialInvoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (inv.clientKraPin && inv.clientKraPin.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPayment = paymentFilter === 'ALL' || inv.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  const totalInvoiced = commercialInvoices.reduce((sum, inv) => sum + inv.totalKes, 0);
  const totalPaid = commercialInvoices.reduce((sum, inv) => sum + inv.paidAmountKes, 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  // Compute Items
  const computedItems: QuoteItem[] = lineItems
    .map(item => {
      const prod = products.find(p => p.id === item.productId) || products[0];
      if (!prod) return null;
      const subtotal = item.quantity * item.unitPriceKes;
      const vat = subtotal * 0.16;
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unitPriceKes: item.unitPriceKes,
        vatAmountKes: vat,
        totalAmountKes: subtotal + vat
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
        quantity: 50,
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
        setClientName(dist.companyName);
        setClientPhone(dist.phone);
        setClientKraPin(dist.kraPin);
      }
    } else {
      setClientName('');
      setClientPhone('');
      setClientKraPin('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const branch = branches.find(b => b.id === branchId) || branches[0];
    const name = distributorId === 'CUSTOM' ? clientName : (distributors.find(d => d.id === distributorId)?.companyName || clientName);

    if (!name) return;

    createCommercialInvoice({
      distributorId: distributorId === 'CUSTOM' ? undefined : distributorId,
      clientName: name,
      clientPhone,
      clientKraPin,
      branchId: branch.id,
      branchName: branch.name,
      issueDate: new Date().toISOString().substring(0, 10),
      dueDate,
      paymentStatus: 'UNPAID',
      paidAmountKes: 0,
      subtotalKes,
      vatKes,
      totalKes,
      items: computedItems,
      notes
    });

    setIsAddModalOpen(false);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice || paymentAmount <= 0) return;
    recordCommercialInvoicePayment(targetInvoice.id, paymentAmount, paymentMethod);
    setIsPaymentModalOpen(false);
    setTargetInvoice(null);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total B2B Invoiced</div>
          <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
            {formatKes(totalInvoiced)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            16% Statutory VAT enforced on all B2B invoices
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Accounts Receivable (Due)</div>
          <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
            {formatKes(totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tracked in General Ledger Account 1100
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Settled Payments</div>
            <div className="font-montserrat font-black text-2xl text-emerald-800 mt-1">
              {formatKes(totalPaid)}
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
            <span>Create Commercial Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Fully Paid</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Invoice Number</th>
                <th className="py-3 px-3">Client / Merchant</th>
                <th className="py-3 px-3">Issue Date</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3">Taxable (Net)</th>
                <th className="py-3 px-3">16% VAT</th>
                <th className="py-3 px-3">Total (KES)</th>
                <th className="py-3 px-3">Payment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {inv.invoiceNumber}
                    </div>
                    {inv.etimsInvoiceNumber && (
                      <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>16% VAT Enforced</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-montserrat font-bold text-slate-800 text-xs">
                      {inv.clientName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      PIN: {inv.clientKraPin || 'NOT SPECIFIED'}
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                    {inv.issueDate}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                    {inv.dueDate}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-slate-700">
                    {formatKes(inv.subtotalKes)}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-emerald-800 font-bold">
                    {formatKes(inv.vatKes)}
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-[#0A006E]">
                    {formatKes(inv.totalKes)}
                  </td>

                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inv.paymentStatus === 'PARTIALLY_PAID'
                        ? 'bg-blue-100 text-[#0A006E]'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.paymentStatus.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>

                      {inv.paymentStatus !== 'PAID' && (
                        <button
                          onClick={() => {
                            setTargetInvoice(inv);
                            setPaymentAmount(inv.totalKes - inv.paidAmountKes);
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                        >
                          <DollarSign className="w-3 h-3 text-[#FFDE00]" />
                          <span>Record Pay</span>
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

      {/* MODAL: CREATE COMMERCIAL INVOICE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  New Commercial Sales Invoice (16% VAT Enforced)
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
                  <label className="block text-slate-700 font-bold mb-1">Fulfilling Branch</label>
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
                    placeholder="e.g. Kempinski Villa Rosa"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
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
                  <label className="block text-slate-700 font-bold mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
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
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-montserrat font-bold text-slate-800 text-xs">
                    Invoiced Alcohol Products
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
                        <th className="py-2.5 px-2">Qty (Bottles)</th>
                        <th className="py-2.5 px-2">Wholesale Rate</th>
                        <th className="py-2.5 px-2">16% VAT</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                        <th className="py-2.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((line, idx) => {
                        const prod = products.find(p => p.id === line.productId) || products[0];
                        const lineSubtotal = line.quantity * line.unitPriceKes;
                        const lineVat = lineSubtotal * 0.16;

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
                              {formatKes(lineSubtotal + lineVat)}
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

              {/* Totals */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <div className="text-slate-400">Total Invoice Amount (Gross)</div>
                  <div className="font-montserrat font-black text-xl text-[#0A006E]">
                    {formatKes(totalKes)}
                  </div>
                </div>
                <div className="text-right">
                  <div>Net Taxable: <strong className="font-mono text-slate-800">{formatKes(subtotalKes)}</strong></div>
                  <div>Output VAT 16%: <strong className="font-mono text-emerald-800">{formatKes(vatKes)}</strong></div>
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
                  Generate 16% VAT Commercial Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD INVOICE PAYMENT */}
      {isPaymentModalOpen && targetInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  Record Settlement Payment
                </h3>
                <div className="text-xs text-slate-500 font-mono">Invoice: {targetInvoice.invoiceNumber}</div>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Invoice:</span>
                  <strong className="font-mono">{formatKes(targetInvoice.totalKes)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <strong className="font-mono text-emerald-700">{formatKes(targetInvoice.paidAmountKes)}</strong>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                  <span>Balance Outstanding:</span>
                  <strong className="font-mono text-[#0A006E]">
                    {formatKes(targetInvoice.totalKes - targetInvoice.paidAmountKes)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Amount to Pay (KES) *</label>
                <input
                  type="number"
                  min={1}
                  max={targetInvoice.totalKes - targetInvoice.paidAmountKes}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold focus:ring-2 focus:ring-[#0A006E]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Settlement Channel *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="MPESA">Safaricom Daraja M-Pesa Paybill</option>
                  <option value="BANK_TRANSFER">Bank Wire / RTGS Settlement</option>
                  <option value="CASH">Physical Cash Deposit</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#34D186] text-white font-montserrat font-bold rounded-xl hover:bg-[#34D186]/90 transition shadow-sm"
                >
                  Confirm &amp; Reconcile Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW INVOICE */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs uppercase font-mono font-bold text-slate-400">Commercial Tax Invoice</span>
                <h3 className="font-montserrat font-black text-xl text-slate-900">
                  {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-400">Billed To:</div>
                <div className="font-montserrat font-bold text-slate-900 text-sm mt-0.5">{selectedInvoice.clientName}</div>
                <div className="font-mono text-slate-500 mt-0.5">{selectedInvoice.clientPhone}</div>
                <div className="font-mono text-slate-500">PIN: {selectedInvoice.clientKraPin || 'NOT SPECIFIED'}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400">Issuing Branch:</div>
                <div className="font-bold text-slate-800">{selectedInvoice.branchName}</div>
                <div className="text-slate-500 mt-1">Issue Date: {selectedInvoice.issueDate}</div>
                <div className="text-red-700 font-bold">Due Date: {selectedInvoice.dueDate}</div>
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
                    <th className="py-2 px-3 text-right">Total (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((item, idx) => (
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
              <div className="space-y-1">
                <div>Status: <strong className="font-bold text-slate-800">{selectedInvoice.paymentStatus}</strong></div>
                <div className="text-emerald-700 font-mono">VAT PIN: P051982736Z (16% Statutory VAT Enforced)</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-[10px]">Taxable: {formatKes(selectedInvoice.subtotalKes)} + VAT: {formatKes(selectedInvoice.vatKes)}</div>
                <div className="font-montserrat font-black text-lg text-[#0A006E]">
                  {formatKes(selectedInvoice.totalKes)}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-200 transition text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-[#0A006E] text-white font-bold rounded-xl hover:bg-[#0A006E]/90 transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
