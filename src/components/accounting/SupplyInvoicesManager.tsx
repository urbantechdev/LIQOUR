import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { SupplyInvoice, SupplyInvoiceItem } from '../../types';
import { formatKes, formatNumber } from '../../utils/kenyaTax';
import { 
  FileText, 
  Plus, 
  Search, 
  Truck, 
  Boxes, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  Printer, 
  Eye, 
  Calendar,
  Warehouse,
  Hash,
  BadgeAlert
} from 'lucide-react';

export const SupplyInvoicesManager: React.FC = () => {
  const { 
    supplyInvoices, 
    suppliers, 
    branches, 
    products, 
    createSupplyInvoice 
  } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<SupplyInvoice | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
  const [packingListNumber, setPackingListNumber] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [truckRegistration, setTruckRegistration] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverNationalId, setDriverNationalId] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'RTGS' | 'CHEQUE' | 'MPESA'>('RTGS');
  const [notes, setNotes] = useState('');

  // Line Items
  const [items, setItems] = useState<{
    productId: string;
    casesSupplied: number;
    unitCostKes: number;
    batchNumber: string;
    expiryDate: string;
  }[]>([
    {
      productId: products[0]?.id || '',
      casesSupplied: 20,
      unitCostKes: products[0]?.warehouseCostKes || 2500,
      batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
      expiryDate: '2029-12-31'
    }
  ]);

  const availableYears = Array.from(
    new Set([
      ...supplyInvoices.map(inv => (inv.deliveryDate || inv.createdAt || '2026').substring(0, 4)),
      '2026',
      '2025',
      '2024'
    ])
  ).sort((a, b) => b.localeCompare(a));

  const filteredInvoices = supplyInvoices.filter(inv => {
    const invYear = (inv.deliveryDate || inv.createdAt || '').substring(0, 4);
    const matchesYear = yearFilter === 'ALL' || invYear === yearFilter;
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.packingListNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.containerNumber && inv.containerNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesYear && matchesSearch;
  });

  const totalSupplyValue = supplyInvoices.reduce((sum, inv) => sum + inv.totalAmountKes, 0);
  const totalVatInput = supplyInvoices.reduce((sum, inv) => sum + inv.vatKes, 0);

  // Compute form totals
  const computedItems: SupplyInvoiceItem[] = items
    .map(line => {
      const prod = products.find(p => p.id === line.productId) || products[0];
      if (!prod) return null;
      const totalBottles = line.casesSupplied * (prod.packSize || 12);
      const totalCostKes = totalBottles * line.unitCostKes;
      const vatAmountKes = totalCostKes * 0.16;

      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        category: prod.category,
        casesSupplied: line.casesSupplied,
        bottlesPerCase: prod.packSize || 12,
        totalBottles,
        unitCostKes: line.unitCostKes,
        totalCostKes,
        vatAmountKes,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate
      };
    })
    .filter(Boolean) as SupplyInvoiceItem[];

  const subtotalKes = computedItems.reduce((sum, i) => sum + i.totalCostKes, 0);
  const vatKes = computedItems.reduce((sum, i) => sum + i.vatAmountKes, 0);
  const totalAmountKes = subtotalKes + vatKes;

  const handleAddItem = () => {
    const prod = products[0];
    setItems([
      ...items,
      {
        productId: prod?.id || '',
        casesSupplied: 10,
        unitCostKes: prod?.warehouseCostKes || 2500,
        batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
        expiryDate: '2029-12-31'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleLineProductChange = (index: number, newProdId: string) => {
    const prod = products.find(p => p.id === newProdId);
    const updated = [...items];
    updated[index].productId = newProdId;
    if (prod) {
      updated[index].unitCostKes = prod.warehouseCostKes;
    }
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === supplierId) || suppliers[0] || {
      id: 'sup-direct',
      name: 'Direct Beverage Supplier',
      kraPin: 'P051000000A'
    };
    const branch = branches.find(b => b.id === branchId) || branches[0];

    createSupplyInvoice({
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierPin: supplier.kraPin,
      branchId: branch.id,
      branchName: branch.name,
      deliveryDate,
      subtotalKes,
      vatKes,
      exciseDutyKes: 0,
      totalAmountKes,
      paymentStatus: 'PENDING',
      paymentMethod,
      packingListNumber: packingListNumber || `PKL-${branch.code.substring(0, 3)}-${Date.now().toString().slice(-4)}`,
      containerNumber,
      truckRegistration,
      driverName,
      driverNationalId,
      sealNumber,
      inspectorName,
      items: computedItems,
      notes
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inbound Consignments</div>
          <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
            {supplyInvoices.length} Shipments Processed
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Automated stock intake &amp; Ledger sync
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Supply Invoiced</div>
          <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
            {formatKes(totalSupplyValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Debits Inventory Account (1200 / 1210)
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">KRA 16% Input VAT Credit</div>
            <div className="font-montserrat font-black text-2xl text-emerald-800 mt-1">
              {formatKes(totalVatInput)}
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-2 flex items-center justify-center space-x-2 px-3.5 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold hover:bg-[#0A006E]/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#FFDE00]" />
            <span>New Supply Invoice / Packing List</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar (Multi-Year Archival Retrieval) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setYearFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition ${
              yearFilter === 'ALL'
                ? 'bg-[#0A006E] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Years ({supplyInvoices.length})
          </button>
          {availableYears.map(yr => (
            <button
              key={yr}
              type="button"
              onClick={() => setYearFilter(yr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                yearFilter === yr
                  ? 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              FY {yr}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Retrieve invoice by #, year, packing list, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono shrink-0">
            {filteredInvoices.length} record(s)
          </span>
        </div>
      </div>

      {/* Supply Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Invoice &amp; Packing List</th>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Receiving Branch</th>
                <th className="py-3 px-3">Consignment Transit</th>
                <th className="py-3 px-3">Delivery Date</th>
                <th className="py-3 px-3">Subtotal (Net)</th>
                <th className="py-3 px-3">16% VAT</th>
                <th className="py-3 px-3">Total Cost (KES)</th>
                <th className="py-3 px-3">Payment</th>
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
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <span>PKL: {inv.packingListNumber}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-montserrat font-bold text-slate-800 text-xs">{inv.supplierName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">PIN: {inv.supplierPin}</div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700 font-medium">
                    {inv.branchName}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-mono text-[11px] text-slate-800 font-bold">
                      {inv.truckRegistration || inv.containerNumber || 'Direct Depot Delivery'}
                    </div>
                    {inv.sealNumber && (
                      <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Seal: {inv.sealNumber}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px]">
                    {inv.deliveryDate}
                  </td>

                  <td className="py-3.5 px-3 text-slate-700 font-mono">
                    {formatKes(inv.subtotalKes)}
                  </td>

                  <td className="py-3.5 px-3 text-emerald-800 font-mono font-bold">
                    {formatKes(inv.vatKes)}
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-[#0A006E]">
                    {formatKes(inv.totalAmountKes)}
                  </td>

                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.paymentStatus}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-[#0A006E]" />
                      <span>View Packing List</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE SUPPLY INVOICE & PACKING LIST */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  New Inbound Supply Invoice &amp; Packing List
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
              
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Receiving Facility *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.tier})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Transit & Customs Inspection Details */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <div className="font-montserrat font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0A006E]" />
                  <span>Packing List Transit, Seal &amp; Customs Gate Information</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Packing List No.</label>
                    <input
                      type="text"
                      placeholder="PKL-2026-9901"
                      value={packingListNumber}
                      onChange={(e) => setPackingListNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Truck Registration</label>
                    <input
                      type="text"
                      placeholder="KBZ 489X / ZD 1092"
                      value={truckRegistration}
                      onChange={(e) => setTruckRegistration(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Container Number (IPS)</label>
                    <input
                      type="text"
                      placeholder="MSKU-892104-9"
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Customs Seal No.</label>
                    <input
                      type="text"
                      placeholder="KRA-SEAL-8910"
                      value={sealNumber}
                      onChange={(e) => setSealNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Driver Full Name</label>
                    <input
                      type="text"
                      placeholder="Erick Mwangi"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Driver National ID</label>
                    <input
                      type="text"
                      placeholder="24981023"
                      value={driverNationalId}
                      onChange={(e) => setDriverNationalId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Inspector / Officer Name</label>
                    <input
                      type="text"
                      placeholder="Officer J. Rotich"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Settlement Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="RTGS">RTGS Bank Wire</option>
                      <option value="BANK_TRANSFER">EFT Bank Transfer</option>
                      <option value="CHEQUE">Corporate Cheque</option>
                      <option value="MPESA">M-Pesa Business Paybill</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-montserrat font-bold text-slate-800 text-xs">
                    Consignment Manifest Items (Bottles &amp; Cases)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product Line</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-2">Cases</th>
                        <th className="py-2.5 px-2">Unit Cost (KES)</th>
                        <th className="py-2.5 px-2">Batch No.</th>
                        <th className="py-2.5 px-2">Expiry Date</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                        <th className="py-2.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((line, idx) => {
                        const prod = products.find(p => p.id === line.productId) || products[0];
                        const totalBottles = line.casesSupplied * (prod?.packSize || 12);
                        const lineSubtotal = totalBottles * line.unitCostKes;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <select
                                value={line.productId}
                                onChange={(e) => handleLineProductChange(idx, e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                              >
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    [{p.category}] {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={1}
                                value={line.casesSupplied}
                                onChange={(e) => {
                                  const updated = [...items];
                                  updated[idx].casesSupplied = Math.max(1, Number(e.target.value));
                                  setItems(updated);
                                }}
                                className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={10}
                                value={line.unitCostKes}
                                onChange={(e) => {
                                  const updated = [...items];
                                  updated[idx].unitCostKes = Number(e.target.value);
                                  setItems(updated);
                                }}
                                className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={line.batchNumber}
                                onChange={(e) => {
                                  const updated = [...items];
                                  updated[idx].batchNumber = e.target.value;
                                  setItems(updated);
                                }}
                                className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="date"
                                value={line.expiryDate}
                                onChange={(e) => {
                                  const updated = [...items];
                                  updated[idx].expiryDate = e.target.value;
                                  setItems(updated);
                                }}
                                className="w-32 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                              />
                            </td>

                            <td className="py-2 px-3 font-montserrat font-bold text-slate-900">
                              {formatKes(lineSubtotal)}
                            </td>

                            <td className="py-2 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
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

              {/* Summary Totals */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-slate-500">
                  Double-entry posting: Debits Inventory (1200/1210) &amp; Credits Accounts Payable (2010).
                </div>
                <div className="flex items-center space-x-6 text-xs">
                  <div>
                    <span className="text-slate-500 mr-2">Net Subtotal:</span>
                    <strong className="font-mono text-slate-800">{formatKes(subtotalKes)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-2">16% VAT Credit:</span>
                    <strong className="font-mono text-emerald-800">{formatKes(vatKes)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-2">Grand Total:</span>
                    <strong className="font-montserrat font-black text-lg text-[#0A006E]">{formatKes(totalAmountKes)}</strong>
                  </div>
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
                  Post Supply Invoice &amp; Intake Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FULL PACKING LIST & INVOICE DETAILS */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-[#0A006E]" />
                  <h3 className="font-montserrat font-black text-lg text-slate-900">
                    Official Inbound Packing List &amp; Supply Ingestion
                  </h3>
                </div>
                <div className="font-mono text-xs text-slate-500 mt-0.5">
                  Invoice: {selectedInvoice.invoiceNumber} • Packing List: {selectedInvoice.packingListNumber}
                </div>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-xs border border-slate-200">
              <div>
                <span className="text-slate-400 block">Supplier</span>
                <strong className="text-slate-900">{selectedInvoice.supplierName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Supplier PIN</span>
                <strong className="font-mono">{selectedInvoice.supplierPin}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Receiving Facility</span>
                <strong className="text-slate-900">{selectedInvoice.branchName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Delivery Date</span>
                <strong className="font-mono">{selectedInvoice.deliveryDate}</strong>
              </div>

              <div>
                <span className="text-slate-400 block">Truck Registration</span>
                <strong className="font-mono">{selectedInvoice.truckRegistration || 'Depot Transfer'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Container No.</span>
                <strong className="font-mono">{selectedInvoice.containerNumber || 'N/A (Local Supply)'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Customs Seal No.</span>
                <strong className="font-mono text-emerald-700">{selectedInvoice.sealNumber || 'Verified Untampered'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Inspector Name</span>
                <strong>{selectedInvoice.inspectorName || 'Lead Verifier Kamau'}</strong>
              </div>
            </div>

            {/* Line items in packing list */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-2">Cases</th>
                    <th className="py-2.5 px-2">Total Bottles</th>
                    <th className="py-2.5 px-2">Unit Cost</th>
                    <th className="py-2.5 px-2">Batch / Expiry</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {item.productName}
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px] font-bold text-[#0A006E]">
                        {item.category}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold">
                        {item.casesSupplied} cs
                      </td>
                      <td className="py-2.5 px-2 font-mono">
                        {item.totalBottles} btls
                      </td>
                      <td className="py-2.5 px-2 font-mono">
                        {formatKes(item.unitCostKes)}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-slate-500">
                        {item.batchNumber} (Exp: {item.expiryDate})
                      </td>
                      <td className="py-2.5 px-3 text-right font-montserrat font-bold text-slate-900">
                        {formatKes(item.totalCostKes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="text-emerald-800 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Posted to Double-Entry General Ledger Account 2010 (Accounts Payable)</span>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-[10px]">Total Consignment Invoiced</div>
                <div className="font-montserrat font-black text-base text-[#0A006E]">
                  {formatKes(selectedInvoice.totalAmountKes)}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-200 transition text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Packing Slip</span>
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
