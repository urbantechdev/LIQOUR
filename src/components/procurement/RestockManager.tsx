import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from '../common/ProductImage';
import {
  Truck,
  Warehouse,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Boxes,
  Store,
  Bell,
  Zap,
  AlertTriangle,
  XCircle,
  Send,
  ShieldCheck,
  Trash2,
  Minus,
  Menu,
  X
} from 'lucide-react';

export const RestockManager: React.FC = () => {
  const {
    restockRequests,
    autoDisburseEnabled,
    setAutoDisburseEnabled,
    createRestockRequest,
    warehouseDisburseStock,
    triggerWarehouseAutoDisburseForAllLowStockShops,
    updateRestockRequestItemQty,
    removeUnavailableItemFromRestockRequest,
    removeAllUnavailableItemsFromRequest,
    acceptAndFulfillRestockRequest,
    rejectRestockRequest,
    approveRestockRequest,
    dispatchRestockRequest,
    receiveRestockRequest,
    branches,
    activeBranch,
    currentRole,
    products,
    inventoryItems,
    orders
  } = useErp();

  // Modal Mode: 'SHOP_REQUEST' (Shop requests stock refill) | 'WAREHOUSE_DISBURSE' (Warehouse controller disburses without waiting for shop request)
  const [modalMode, setModalMode] = useState<'SHOP_REQUEST' | 'WAREHOUSE_DISBURSE' | null>(null);
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);

  const warehousesAndDistributors = branches.filter(
    b => b.tier === 'WAREHOUSE' || b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE'
  );
  const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
  const shopBranches = branches.filter(b => b.tier !== 'WAREHOUSE');

  const [sourceSupplyBranchId, setSourceSupplyBranchId] = useState<string>(mainWarehouse?.id || branches[0]?.id || '');
  const [targetShopBranchId, setTargetShopBranchId] = useState<string>(
    activeBranch.tier !== 'WAREHOUSE' ? activeBranch.id : shopBranches[0]?.id || branches[0]?.id || ''
  );
  const [selectedLines, setSelectedLines] = useState<Array<{ productId: string; casesRequested: number }>>([
    { productId: products[0]?.id || '', casesRequested: 5 }
  ]);
  const [requestNotes, setRequestNotes] = useState('');
  const [autoAcceptImmediately, setAutoAcceptImmediately] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  const handleAddLine = () => {
    const nextProd = products.length > 0 ? products[selectedLines.length % products.length] : undefined;
    setSelectedLines(prev => [...prev, { productId: nextProd?.id || '', casesRequested: 3 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (selectedLines.length <= 1) return;
    setSelectedLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = selectedLines.filter(l => l.productId && l.casesRequested > 0);
    if (validLines.length === 0) return;

    if (modalMode === 'SHOP_REQUEST') {
      const created = createRestockRequest(sourceSupplyBranchId, validLines, {
        fromBranchId: targetShopBranchId,
        initiationType: 'SHOP_REFILL_REQUEST',
        urgency: 'OUT_OF_STOCK',
        notes:
          requestNotes.trim() ||
          `Shop stock refill request sent to Warehouse (Main Store) / Merchant — pending acceptance.`
      });
      showToast(
        `Stock Refill Request ${created.requestNumber} sent from ${created.fromBranchName} to ${created.toBranchName}! Pending acceptance in Notifications.`
      );
    } else if (modalMode === 'WAREHOUSE_DISBURSE') {
      const created = warehouseDisburseStock(targetShopBranchId, validLines, {
        sourceWarehouseId: sourceSupplyBranchId,
        initiationType: 'WAREHOUSE_CONTROLLER_PUSH',
        urgency: 'OUT_OF_STOCK',
        notes:
          requestNotes.trim() ||
          `Warehouse Controller disbursed stock without waiting for shop request — ${
            autoAcceptImmediately ? 'immediately stocked' : 'pending acceptance notification'
          }.`,
        autoAcceptImmediately
      });
      showToast(
        autoAcceptImmediately
          ? `Disbursed & stocked ${created.requestNumber} directly from ${created.toBranchName} into ${created.fromBranchName}!`
          : `Warehouse Disbursement ${created.requestNumber} sent to ${created.fromBranchName} as a notification pending acceptance!`
      );
    }

    setModalMode(null);
    setRequestNotes('');
    setSelectedLines([{ productId: products[0]?.id || '', casesRequested: 5 }]);
  };

  const isScopedShopStaff =
    currentRole === 'STAFF' &&
    activeBranch.tier !== 'WAREHOUSE' &&
    activeBranch.tier !== 'MAIN_STORE';

  const scopedRestockRequests = isScopedShopStaff
    ? restockRequests.filter(
        r => r.fromBranchId === activeBranch.id || r.toBranchId === activeBranch.id
      )
    : restockRequests;

  const pendingNotifications = scopedRestockRequests.filter(
    r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISPATCHED'
  );
  const completedAcquisitions = scopedRestockRequests.filter(
    r => r.status === 'RECEIVED' || r.status === 'REJECTED'
  );

  // Main Warehouse (Main Store) stock total
  const warehouseBottlesTotal = inventoryItems
    .filter(i => i.branchId === mainWarehouse?.id)
    .reduce((sum, i) => sum + i.bottlesOnHand, 0);

  return (
    <div className="space-y-5">
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-montserrat font-bold flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="text-emerald-800 hover:text-emerald-950 font-black">
            ✕
          </button>
        </div>
      )}

      {/* Top Banner: Warehouse (Main Store) & Independent Shop Stock Refill Engine */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-md shrink-0">
              <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                  Warehouse (Main Store) &amp; Shop Stock Refill Hub
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] text-[10px] font-montserrat font-black uppercase">
                  Warehouse = Main Store ({warehouseBottlesTotal.toLocaleString()} btls)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#0A006E]/85 mt-0.5 sm:mt-1 font-semibold">
                Every shop sale &amp; product acquisition from the Warehouse (Main Store) is independent. Shops can request stock refills when running low, or the Warehouse Controller can auto-disburse stock without waiting for a shop request.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Restock Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Menu Action Buttons Bar — Collapsed Inside Hamburger on Mobile */}
        <div
          className={`${
            isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex-col gap-3 animate-in fade-in`}
        >
          {/* Auto-Disburse Toggle Pill */}
          <div className="bg-white/95 border-2 border-[#0A006E] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <div className="text-xs font-montserrat font-black text-[#0A006E] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">Warehouse Auto-Disburse</span>
              </div>
              <div className="text-[10px] text-slate-600 font-medium truncate">
                Auto-pushes stock alert when shop runs low
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !autoDisburseEnabled;
                setAutoDisburseEnabled(next);
                showToast(
                  next
                    ? 'Warehouse Controller Auto-Disburse ENABLED — out-of-stock shops will automatically receive disbursement notifications.'
                    : 'Warehouse Controller Auto-Disburse paused.'
                );
              }}
              className={`px-3 py-1.5 rounded-xl font-montserrat font-black text-xs transition shrink-0 cursor-pointer ${
                autoDisburseEnabled
                  ? 'bg-[#34D186] text-[#FFDE00]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {autoDisburseEnabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              {/* Button 1: Shop Requests Stock Refill */}
              <button
                type="button"
                onClick={() => {
                  setTargetShopBranchId(activeBranch.tier !== 'WAREHOUSE' ? activeBranch.id : shopBranches[0]?.id || branches[0].id);
                  setSourceSupplyBranchId(mainWarehouse?.id || branches[0].id);
                  setModalMode('SHOP_REQUEST');
                  setIsHeroMenuOpen(false);
                }}
                className="px-3.5 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span>Shop: Request Stock Refill</span>
              </button>

              {/* Button 2: Warehouse Controller Disburses Stock Without Waiting for Shop Request */}
              <button
                type="button"
                onClick={() => {
                  setSourceSupplyBranchId(mainWarehouse?.id || branches[0].id);
                  setTargetShopBranchId(activeBranch.tier !== 'WAREHOUSE' ? activeBranch.id : shopBranches[0]?.id || branches[0].id);
                  setModalMode('WAREHOUSE_DISBURSE');
                  setIsHeroMenuOpen(false);
                }}
                className="px-3.5 py-2.5 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-black transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Truck className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span>Warehouse: Disburse Stock</span>
              </button>

              {/* Button 3: One-Click Auto-Disburse to All Out-of-Stock / Low-Stock Shops */}
              <button
                type="button"
                onClick={() => {
                  const res = triggerWarehouseAutoDisburseForAllLowStockShops();
                  showToast(
                    res.count > 0
                      ? `Warehouse Controller auto-disbursed stock to ${res.count} shop(s) with low/out-of-stock items! Notifications pending acceptance below.`
                      : 'All shops currently have healthy stock or already have a pending refill notification.'
                  );
                  setIsHeroMenuOpen(false);
                }}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black transition flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span>Auto-Disburse Low-Stock Shops</span>
              </button>
            </div>

          <div className="flex items-center gap-2 text-xs font-montserrat font-black text-[#0A006E]">
            <Bell className="w-4 h-4" />
            <span>{pendingNotifications.length} Pending Acceptance Notification(s)</span>
          </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: LIVE NOTIFICATIONS PENDING ACCEPTANCE (FROM DISTRIBUTOR OR WAREHOUSE) */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E] shadow-md overflow-hidden">
        <div className="bg-[#0A006E] px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#FFDE00] animate-bounce" />
            <div>
              <h3 className="font-montserrat font-black italic text-sm sm:text-base text-white">
                Pending Stock Refill &amp; Warehouse Disbursement Notifications ({pendingNotifications.length})
              </h3>
              <p className="text-[11px] text-slate-300">
                Incoming Shop Refill Requests &amp; Warehouse Controller Auto-Disbursements awaiting acceptance
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-xs">
            {pendingNotifications.length} Pending Action
          </span>
        </div>

        {pendingNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
            <p className="text-xs font-montserrat font-bold text-slate-800">
              All Stock Refill Requests &amp; Warehouse Disbursements Have Been Accepted!
            </p>
            <p className="text-[11px] text-slate-500">
              Use the buttons above to request a shop refill or trigger a proactive Warehouse Controller disbursement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {pendingNotifications.map(req => {
              const isWarehousePush =
                req.initiationType === 'WAREHOUSE_AUTO_DISBURSE' ||
                req.initiationType === 'WAREHOUSE_CONTROLLER_PUSH';

              return (
                <div
                  key={req.id}
                  className="p-5 hover:bg-slate-50/90 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs text-[#0A006E] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                        {req.requestNumber}
                      </span>

                      <span
                        className={`text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full ${
                          isWarehousePush
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {isWarehousePush
                          ? 'WAREHOUSE CONTROLLER AUTO-DISBURSE (NO SHOP REQUEST)'
                          : 'SHOP OUT-OF-STOCK REFILL REQUEST'}
                      </span>

                      <span className="text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
                        NOTIFICATION PENDING ACCEPTANCE
                      </span>

                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-montserrat font-black text-slate-900">
                      <span className="text-[#1E9E60] flex items-center gap-1">
                        <Warehouse className="w-4 h-4" />
                        <span>From Supplying Store: {req.toBranchName}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span className="text-[#0A006E] flex items-center gap-1">
                        <Store className="w-4 h-4" />
                        <span>To Receiving Shop: {req.fromBranchName}</span>
                      </span>
                    </div>

                    {/* Editable Stock List — Inventory Controller can edit quantities or remove unavailable products */}
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-montserrat font-black uppercase text-slate-500">
                        <span>Requested Stock List (Inventory Controller Editable)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const res = removeAllUnavailableItemsFromRequest(req.id);
                            showToast(
                              `Removed ${res.removedCount} unavailable product(s) from ${req.requestNumber}. ${res.remainingCount} available item(s) ready for acceptance.`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-montserrat font-black text-[10px] flex items-center gap-1 transition"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Auto-Remove Unavailable Stock</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {req.items.map((item) => {
                          const whInv = inventoryItems.find(
                            inv => inv.branchId === req.toBranchId && inv.productId === item.productId
                          );
                          const prod = products.find(p => p.id === item.productId);
                          const packSize = prod?.packSize || 12;
                          const availBottles = whInv?.bottlesOnHand ?? 0;
                          const availCases = Math.floor(availBottles / packSize);
                          const isUnavailable = availBottles < item.bottlesTotal || availBottles <= 0;

                          return (
                            <div
                              key={item.productId}
                              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                                isUnavailable
                                  ? 'bg-red-50/70 border-red-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <ProductImage
                                    product={prod || { name: item.productName }}
                                    size="xs"
                                  />
                                  <div className="min-w-0">
                                    <strong className="text-[#0A006E] text-xs font-montserrat font-black block truncate">
                                      {item.productName}
                                    </strong>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      SKU: {item.sku} ({packSize} btls/cs)
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-black shrink-0 ${
                                    availBottles <= 0
                                      ? 'bg-red-600 text-white'
                                      : isUnavailable
                                      ? 'bg-amber-200 text-amber-950'
                                      : 'bg-emerald-100 text-[#1E9E60]'
                                  }`}
                                >
                                  {availBottles <= 0
                                    ? 'UNAVAILABLE (0 IN STOCK)'
                                    : `WH Stock: ${availCases} cs (${availBottles} btls)`}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRestockRequestItemQty(
                                        req.id,
                                        item.productId,
                                        Math.max(1, item.casesRequested - 1)
                                      )
                                    }
                                    className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-800"
                                    title="Decrease cases"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.casesRequested}
                                    onChange={(e) =>
                                      updateRestockRequestItemQty(
                                        req.id,
                                        item.productId,
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                    className="w-14 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-black text-xs text-center text-[#0A006E]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRestockRequestItemQty(req.id, item.productId, item.casesRequested + 1)
                                    }
                                    className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-800"
                                    title="Increase cases"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    cs ({item.bottlesTotal} btls)
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    removeUnavailableItemFromRestockRequest(
                                      req.id,
                                      item.productId,
                                      'Removed by Inventory Controller — product unavailable in stock list'
                                    );
                                    showToast(
                                      `Removed unavailable product "${item.productName}" from ${req.requestNumber} stock list.`
                                    );
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-montserrat font-black text-[10px] flex items-center gap-1 transition"
                                  title="Remove unavailable product from the order request stock list"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove Product</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {req.removedItems && req.removedItems.length > 0 && (
                        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800">
                          <strong>Removed Unavailable Products from Stock List:</strong>{' '}
                          {req.removedItems.map(r => `${r.productName} (${r.casesRequested} cs)`).join(', ')}
                        </div>
                      )}
                    </div>

                    {req.notes && (
                      <div className="text-xs text-slate-600 italic">
                        “{req.notes}” — <span className="font-semibold not-italic text-slate-700">{req.requestedBy}</span>
                      </div>
                    )}
                  </div>

                  {/* Notification Acceptance Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        rejectRestockRequest(req.id, 'Rejected by controller');
                        showToast(`Notification ${req.requestNumber} rejected.`);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-montserrat font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        acceptAndFulfillRestockRequest(req.id);
                        showToast(
                          `Accepted ${req.requestNumber}! Stock deducted from ${req.toBranchName} and credited to ${req.fromBranchName}'s independent inventory.`
                        );
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                      <span>Accept &amp; Disburse Stock to {req.fromBranchName.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: INDEPENDENT SHOP SALES & WAREHOUSE ACQUISITION MATRIX */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-montserrat font-black italic text-base text-slate-900">
              Independent Shop Sales &amp; Product Acquisition Status (Per Branch)
            </h3>
            <p className="text-xs text-slate-500">
              Every shop operates independent sales and acquires its own stock from {mainWarehouse?.name || 'Warehouse (Main Store)'}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shopBranches.map(shop => {
            const shopInv = inventoryItems.filter(i => i.branchId === shop.id);
            const totalBottles = shopInv.reduce((s, i) => s + i.bottlesOnHand, 0);
            const outOfStockCount = products.filter(p => {
              const row = shopInv.find(i => i.productId === p.id);
              return !row || row.bottlesOnHand === 0;
            }).length;
            const lowStockCount = products.filter(p => {
              const row = shopInv.find(i => i.productId === p.id);
              return row && row.bottlesOnHand > 0 && row.bottlesOnHand <= (row.reorderLevel || 12);
            }).length;

            // Independent Sales for this specific shop ONLY
            const shopOrders = orders.filter(o => o.branchId === shop.id);
            const shopRevenue = shopOrders.reduce((s, o) => s + o.totalKes, 0);

            // Independent Stock Acquisitions for this specific shop ONLY
            const shopAcquisitions = restockRequests.filter(
              r => r.fromBranchId === shop.id && r.status === 'RECEIVED'
            );

            return (
              <div
                key={shop.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#0A006E]/10 text-[#0A006E]">
                        {shop.code} • {shop.tier === 'DISTRIBUTOR' ? 'MERCHANT' : shop.tier.replace('_', ' ')}
                      </span>
                      <h4 className="font-montserrat font-black text-sm text-slate-900 mt-1">
                        {shop.name}
                      </h4>
                    </div>
                    {outOfStockCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-800 text-[10px] font-montserrat font-black flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{outOfStockCount} Out of Stock</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-montserrat font-black">
                        Stock Healthy
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Independent Sales</span>
                      <strong className="font-montserrat font-black text-[#0A006E] text-xs">
                        {formatKes(shopRevenue)}
                      </strong>
                      <span className="text-[9px] text-slate-400 block">{shopOrders.length} orders</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Shop Stock</span>
                      <strong className="font-mono font-black text-slate-900 text-xs">
                        {totalBottles} btls
                      </strong>
                      <span className="text-[9px] text-amber-700 block">{lowStockCount} low SKU(s)</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">WH Refills</span>
                      <strong className="font-mono font-black text-emerald-800 text-xs">
                        {shopAcquisitions.length} received
                      </strong>
                      <span className="text-[9px] text-slate-400 block">From Main Store</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetShopBranchId(shop.id);
                      setSourceSupplyBranchId(mainWarehouse?.id || branches[0].id);
                      setModalMode('SHOP_REQUEST');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#0A006E] border border-[#0A006E]/30 font-montserrat font-bold text-[11px] flex items-center justify-center gap-1 transition"
                  >
                    <Send className="w-3 h-3" />
                    <span>Shop Request Refill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetShopBranchId(shop.id);
                      setSourceSupplyBranchId(mainWarehouse?.id || branches[0].id);
                      setModalMode('WAREHOUSE_DISBURSE');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center justify-center gap-1 transition"
                  >
                    <Truck className="w-3 h-3" />
                    <span>WH Auto-Disburse</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: COMPLETED & ARCHIVED STOCK ACQUISITION LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-montserrat font-black text-sm text-slate-900">
            Completed Independent Shop Stock Acquisitions &amp; History ({completedAcquisitions.length})
          </h3>
        </div>

        {completedAcquisitions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Accept any pending notification above to record completed stock transfers from Warehouse (Main Store) to Shops.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {completedAcquisitions.map(req => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0A006E]">{req.requestNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-montserrat font-black ${
                        req.status === 'RECEIVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status === 'RECEIVED' ? 'ACCEPTED & STOCKED IN SHOP' : 'REJECTED'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {req.initiationType === 'WAREHOUSE_AUTO_DISBURSE' || req.initiationType === 'WAREHOUSE_CONTROLLER_PUSH'
                        ? 'Warehouse Auto-Disbursement'
                        : 'Shop Refill Request'}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800">
                    {req.toBranchName} → {req.fromBranchName}
                  </div>
                  <div className="text-slate-500">
                    {req.items.map(i => `${i.productName} (${i.casesRequested} cs / ${i.bottlesTotal} btls)`).join(', ')}
                  </div>
                </div>
                {req.acceptedBy && (
                  <div className="text-[11px] text-emerald-700 font-semibold shrink-0">
                    Accepted by {req.acceptedBy}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: SHOP REQUEST STOCK REFILL OR WAREHOUSE CONTROLLER AUTO-DISBURSE */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#1E9E60]">
                  {modalMode === 'SHOP_REQUEST'
                    ? 'Independent Shop Stock Acquisition'
                    : 'Warehouse Controller Direct Stock Disbursement'}
                </span>
                <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900">
                  {modalMode === 'SHOP_REQUEST'
                    ? 'Request Stock Refill from Warehouse (Main Store)'
                    : 'Disburse Stock Without Waiting for Shop Request'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Supplying Warehouse (Main Store) / Merchant *
                  </label>
                  <select
                    value={sourceSupplyBranchId}
                    onChange={(e) => setSourceSupplyBranchId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {warehousesAndDistributors.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.tier === 'WAREHOUSE' ? 'Warehouse / Main Store' : w.tier === 'DISTRIBUTOR' ? 'Merchant' : w.tier})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Receiving Independent Shop / Branch *
                  </label>
                  <select
                    value={targetShopBranchId}
                    onChange={(e) => setTargetShopBranchId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {shopBranches.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-montserrat font-black uppercase text-[11px] text-slate-700">
                    Products &amp; Cases to {modalMode === 'SHOP_REQUEST' ? 'Request' : 'Disburse'}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-montserrat font-bold text-[#0A006E] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Product</span>
                  </button>
                </div>

                {selectedLines.map((line, idx) => {
                  const shopStock =
                    inventoryItems.find(i => i.branchId === targetShopBranchId && i.productId === line.productId)
                      ?.bottlesOnHand ?? 0;
                  const whStock =
                    inventoryItems.find(i => i.branchId === sourceSupplyBranchId && i.productId === line.productId)
                      ?.bottlesOnHand ?? 0;

                  return (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                        <div className="sm:col-span-3">
                          <select
                            value={line.productId}
                            onChange={(e) => {
                              const updated = [...selectedLines];
                              updated[idx].productId = e.target.value;
                              setSelectedLines(updated);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                          >
                            {products.length === 0 && (
                              <option value="">-- Create SKU in Inventory first --</option>
                            )}
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                [{p.category}] {p.name} ({p.packSize} btls/case)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={line.casesRequested}
                            onChange={(e) => {
                              const updated = [...selectedLines];
                              updated[idx].casesRequested = Math.max(1, parseInt(e.target.value) || 1);
                              setSelectedLines(updated);
                            }}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center"
                            title="Cases"
                          />
                          <span className="text-[11px] font-bold text-slate-500">cs</span>
                          {selectedLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-red-500 hover:text-red-700 font-bold px-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>
                          Shop Current Stock: <strong className={shopStock === 0 ? 'text-red-600' : 'text-slate-800'}>{shopStock} btls</strong>
                        </span>
                        <span>
                          Warehouse (Main Store) Available: <strong className="text-emerald-800">{whStock} btls</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notification / Dispatch Notes
                </label>
                <input
                  type="text"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder={
                    modalMode === 'SHOP_REQUEST'
                      ? 'e.g. Out of stock at shop counter — urgent refill needed from Warehouse'
                      : 'e.g. Proactive Warehouse Controller stock replenishment'
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {modalMode === 'WAREHOUSE_DISBURSE' && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAcceptImmediately}
                    onChange={(e) => setAutoAcceptImmediately(e.target.checked)}
                    className="rounded text-[#1E9E60]"
                  />
                  <span className="text-xs font-bold text-emerald-950">
                    Also auto-accept immediately (leave unchecked to send as a Notification Pending Acceptance)
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black flex items-center gap-2 shadow-md"
                >
                  <Bell className="w-4 h-4" />
                  <span>
                    {modalMode === 'SHOP_REQUEST'
                      ? 'Send Stock Refill Request Notification'
                      : 'Send Warehouse Disbursement Notification'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
