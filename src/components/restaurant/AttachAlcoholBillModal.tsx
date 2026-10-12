import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import { AttachedAlcoholBill, Product, SaleItem } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import {
  Wine,
  Search,
  Plus,
  CheckCircle2,
  Receipt,
  Beer,
  Check,
  X,
  FileText,
  AlertCircle,
  Building2,
  Clock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAttachBill: (bill: AttachedAlcoholBill) => void;
  currentAttachedBill?: AttachedAlcoholBill | null;
  onRemoveAttachedBill?: () => void;
}

export const AttachAlcoholBillModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAttachBill,
  currentAttachedBill,
  onRemoveAttachedBill
}) => {
  const { orders, products, activeBranch } = useErp();

  const [activeTab, setActiveTab] = useState<'EXISTING_ORDERS' | 'QUICK_DRINKS' | 'MANUAL_SLIP'>('EXISTING_ORDERS');
  const [searchOrderQuery, setSearchOrderQuery] = useState('');
  const [searchDrinkQuery, setSearchDrinkQuery] = useState('');

  // Selected quick drinks
  const [selectedDrinks, setSelectedDrinks] = useState<{ product: Product; quantity: number }[]>([]);

  // Manual slip entry
  const [manualBillNumber, setManualBillNumber] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualAmountKes, setManualAmountKes] = useState<number>(0);
  const [manualNotes, setManualNotes] = useState('');

  // Filter recent alcohol orders
  const recentAlcoholOrders = useMemo(() => {
    return orders
      .filter(o => {
        // Must contain at least one alcohol item
        const hasAlcohol = o.items.some(i => i.itemType !== 'FOOD');
        if (!hasAlcohol) return false;
        if (searchOrderQuery.trim()) {
          const q = searchOrderQuery.toLowerCase();
          return (
            o.orderNumber.toLowerCase().includes(q) ||
            (o.customerName && o.customerName.toLowerCase().includes(q)) ||
            (o.etimsInvoiceNumber && o.etimsInvoiceNumber.toLowerCase().includes(q)) ||
            o.items.some(i => i.productName.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .slice(0, 20);
  }, [orders, searchOrderQuery]);

  // Filter drinks for quick picker
  const filteredDrinks = useMemo(() => {
    return products
      .filter(p => {
        if (!searchDrinkQuery.trim()) return true;
        const q = searchDrinkQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
        );
      })
      .slice(0, 25);
  }, [products, searchDrinkQuery]);

  if (!isOpen) return null;

  const handleSelectExistingOrder = (order: typeof orders[0]) => {
    const alcoholItems: SaleItem[] = order.items.filter(i => i.itemType !== 'FOOD');
    const totalAlcoholKes = alcoholItems.reduce((sum, i) => sum + i.totalAmount, 0) || order.totalKes;

    const attached: AttachedAlcoholBill = {
      billNumber: order.orderNumber || order.etimsInvoiceNumber || `ALC-${Date.now().toString().slice(-4)}`,
      branchName: order.branchName || activeBranch.name,
      cashierName: order.cashierName,
      customerName: order.customerName,
      items: alcoholItems,
      totalKes: totalAlcoholKes,
      linkedOrderId: order.id,
      notes: `Consolidated from ${order.branchName || 'Bar'} Order #${order.orderNumber}`
    };

    onAttachBill(attached);
    onClose();
  };

  const handleAddQuickDrink = (product: Product) => {
    setSelectedDrinks(prev => {
      const existing = prev.find(d => d.product.id === product.id);
      if (existing) {
        return prev.map(d =>
          d.product.id === product.id ? { ...d, quantity: d.quantity + 1 } : d
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveQuickDrink = (productId: string) => {
    setSelectedDrinks(prev => prev.filter(d => d.product.id !== productId));
  };

  const handleConfirmQuickDrinks = () => {
    if (selectedDrinks.length === 0) return;

    const saleItems: SaleItem[] = selectedDrinks.map(d => ({
      productId: d.product.id,
      productName: d.product.name,
      sku: d.product.sku,
      barcode: d.product.barcode,
      quantity: d.quantity,
      unitPrice: d.product.retailPriceKes,
      costPrice: d.product.warehouseCostKes,
      vatAmount: Math.round(d.product.retailPriceKes * d.quantity * (16 / 116)),
      totalAmount: d.product.retailPriceKes * d.quantity,
      itemType: 'ALCOHOL'
    }));

    const totalAlcoholKes = saleItems.reduce((sum, i) => sum + i.totalAmount, 0);

    const attached: AttachedAlcoholBill = {
      billNumber: `ALC-TAB-${Date.now().toString().slice(-5)}`,
      branchName: activeBranch.name,
      items: saleItems,
      totalKes: totalAlcoholKes,
      notes: 'Itemized alcohol drinks added to restaurant meal receipt'
    };

    onAttachBill(attached);
    onClose();
  };

  const handleConfirmManualSlip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBillNumber.trim() || manualAmountKes <= 0) return;

    const fakeItem: SaleItem = {
      productId: `alc-slip-${Date.now()}`,
      productName: `Client Alcohol Bill (${manualBillNumber.trim()})`,
      sku: 'ALC-BAR-SLIP',
      barcode: '0000000000000',
      quantity: 1,
      unitPrice: manualAmountKes,
      costPrice: Math.round(manualAmountKes * 0.7),
      vatAmount: Math.round(manualAmountKes * (16 / 116)),
      totalAmount: manualAmountKes,
      itemType: 'ALCOHOL',
      notes: manualNotes.trim()
    };

    const attached: AttachedAlcoholBill = {
      billNumber: manualBillNumber.trim(),
      customerName: manualCustomerName.trim() || undefined,
      items: [fakeItem],
      totalKes: manualAmountKes,
      notes: manualNotes.trim() || 'Attached client bar bill slip'
    };

    onAttachBill(attached);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border-2 border-[#0A006E] animate-in zoom-in-95 duration-150 space-y-0">
        {/* Header */}
        <div className="bg-[#0A006E] text-white p-5 border-b-4 border-[#FFDE00] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md shrink-0">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-base tracking-wide flex items-center gap-2">
                <span>Attach Client Alcohol Bill</span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Consolidate a client&apos;s alcohol bar bill onto their food thermal receipt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Attached Bill Banner (if any) */}
        {currentAttachedBill && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="font-montserrat font-bold text-amber-900">
                  Currently Attached: Bill #{currentAttachedBill.billNumber}
                </span>{' '}
                <span className="font-mono font-black text-[#0A006E]">
                  ({formatKes(currentAttachedBill.totalKes)})
                </span>
              </div>
            </div>
            {onRemoveAttachedBill && (
              <button
                type="button"
                onClick={() => {
                  onRemoveAttachedBill();
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] shrink-0 transition"
              >
                Detach Bill
              </button>
            )}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-montserrat font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('EXISTING_ORDERS')}
            className={`flex-1 py-3 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'EXISTING_ORDERS'
                ? 'border-[#0A006E] text-[#0A006E] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Select Existing Bar Order</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('QUICK_DRINKS')}
            className={`flex-1 py-3 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'QUICK_DRINKS'
                ? 'border-[#0A006E] text-[#0A006E] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Beer className="w-3.5 h-3.5" />
            <span>Itemized Drinks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MANUAL_SLIP')}
            className={`flex-1 py-3 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'MANUAL_SLIP'
                ? 'border-[#0A006E] text-[#0A006E] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Manual Bar Slip</span>
          </button>
        </div>

        {/* Tab 1: Select from Existing Orders */}
        {activeTab === 'EXISTING_ORDERS' && (
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchOrderQuery}
                onChange={e => setSearchOrderQuery(e.target.value)}
                placeholder="Search bar order #, customer name, drink..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {recentAlcoholOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No past bar orders found. You can also use &ldquo;Itemized Drinks&rdquo; or &ldquo;Manual Bar Slip&rdquo; to add the client&apos;s drinks bill.
                </div>
              ) : (
                recentAlcoholOrders.map(ord => (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectExistingOrder(ord)}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#0A006E] hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-montserrat font-black text-xs text-slate-900 group-hover:text-[#0A006E]">
                          Order #{ord.orderNumber}
                        </span>
                        {ord.customerName && (
                          <span className="px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 text-[10px] truncate max-w-[120px]">
                            {ord.customerName}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ord.createdAt?.slice(11, 16) || ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {ord.items.map(i => `${i.quantity}× ${i.productName}`).join(', ')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Cashier: {ord.cashierName || 'Bar'} • {ord.paymentMethod}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-montserrat font-black text-[#0A006E]">
                        {formatKes(ord.totalKes)}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 group-hover:underline">
                        <span>Attach</span>
                        <Check className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Itemized Quick Drinks Selection */}
        {activeTab === 'QUICK_DRINKS' && (
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchDrinkQuery}
                onChange={e => setSearchDrinkQuery(e.target.value)}
                placeholder="Search whisky, vodka, gin, beer, wine..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
              />
            </div>

            {/* Selected Drinks Pill Carousel */}
            {selectedDrinks.length > 0 && (
              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-montserrat font-bold text-amber-900">
                  <span>Selected Alcohol Drinks ({selectedDrinks.reduce((s, d) => s + d.quantity, 0)})</span>
                  <span className="text-sm font-black text-[#0A006E]">
                    {formatKes(selectedDrinks.reduce((s, d) => s + d.product.retailPriceKes * d.quantity, 0))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedDrinks.map(d => (
                    <span
                      key={d.product.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 shadow-2xs"
                    >
                      <span className="font-bold">{d.quantity}×</span>
                      <span className="truncate max-w-[130px]">{d.product.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickDrink(d.product.id)}
                        className="text-red-500 hover:text-red-700 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Drink items list */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredDrinks.map(p => {
                const isSelected = selectedDrinks.find(d => d.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddQuickDrink(p)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-[#0A006E] hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-montserrat font-bold text-slate-900 truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {p.brand} • {p.volumeMl}ml
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-montserrat font-black text-[#0A006E]">
                        {formatKes(p.retailPriceKes)}
                      </span>
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-[#0A006E] text-[#FFDE00]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                disabled={selectedDrinks.length === 0}
                onClick={handleConfirmQuickDrinks}
                className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] disabled:opacity-50 text-white font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                <span>Attach {selectedDrinks.length} Drink(s) to Bill</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Manual Bar Slip Entry */}
        {activeTab === 'MANUAL_SLIP' && (
          <form onSubmit={handleConfirmManualSlip} className="p-4 sm:p-5 space-y-3.5 text-xs">
            <div>
              <label className="block font-montserrat font-bold text-slate-700 mb-1">
                Bar Bill Reference / Slip Number *
              </label>
              <input
                type="text"
                required
                value={manualBillNumber}
                onChange={e => setManualBillNumber(e.target.value)}
                placeholder="e.g. BAR-SLIP-049, TAB-102, COUNTER-RECEIPT-88"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Alcohol Total Amount (KES) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={manualAmountKes || ''}
                  onChange={e => setManualAmountKes(Number(e.target.value))}
                  placeholder="e.g. 4500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-montserrat font-black text-sm text-[#0A006E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Client / Table Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualCustomerName}
                  onChange={e => setManualCustomerName(e.target.value)}
                  placeholder="e.g. Table 4 / John M."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-montserrat font-bold text-slate-700 mb-1">
                Drinks Description / Itemization
              </label>
              <textarea
                rows={2}
                value={manualNotes}
                onChange={e => setManualNotes(e.target.value)}
                placeholder="e.g. 2x Johnnie Walker Black Tot, 3x Tusker Malt, 1x Water"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!manualBillNumber || manualAmountKes <= 0}
                className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] disabled:opacity-50 text-white font-montserrat font-black shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                <span>Attach to Meal Receipt</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
