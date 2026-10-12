import React, { useState } from 'react';
import { Product, HeldCart, StockCategory } from '../../types';
import { CartItem, useErp } from '../../context/ErpContext';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from '../common/ProductImage';
import { AttachAlcoholBillModal } from '../restaurant/AttachAlcoholBillModal';
import { 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Smartphone, 
  Banknote, 
  CreditCard, 
  Split, 
  Camera, 
  Printer, 
  Clock, 
  KeyRound, 
  PauseCircle, 
  PlayCircle, 
  CheckCircle2, 
  Search, 
  X, 
  Sparkles, 
  Layers, 
  AlertTriangle,
  UserCheck,
  Send,
  Lock,
  ArrowRight,
  Utensils,
  Wine,
  ChefHat,
  Store
} from 'lucide-react';
import { detectKenyanMobileCarrier, sanitizeAndControlKenyanMobileInput } from '../../utils/kenyanMobileCarrier';

export interface CashierRegisterViewProps {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, markup?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  barcodeInput: string;
  setBarcodeInput: (val: string) => void;
  handleBarcodeSubmit: (e: React.FormEvent) => void;
  posBarcodeInputRef: React.RefObject<HTMLInputElement | null>;
  processScannedBarcode: (barcode: string) => void;
  lastPinnedPosScan: {
    product: Product;
    scannedCode: string;
    isCaseScan: boolean;
    qtyAdded: number;
    stockOnHand: number;
    remainingAfterCart: number;
  } | null;
  setLastPinnedPosScan: (val: any) => void;
  justScannedProductId: string | null;
  setIsCameraModalOpen: (val: boolean) => void;
  
  // Checkout & Customer
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerEmail: string;
  setCustomerEmail: (val: string) => void;
  customerKraPin: string;
  setCustomerKraPin: (val: string) => void;
  
  // Settlement Tender
  paymentMethod: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'SPLIT';
  setPaymentMethod: (val: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'SPLIT') => void;
  cashTendered: string;
  setCashTendered: (val: string) => void;
  cashChange: number;
  parsedCashTendered: number;
  splitCashAmount: string;
  setSplitCashAmount: (val: string) => void;
  splitMpesaAmount: string;
  setSplitMpesaAmount: (val: string) => void;
  splitRemaining: number;
  cardAuthCode: string;
  setCardAuthCode: (val: string) => void;
  posMpesaReceiptInput: string;
  setPosMpesaReceiptInput: (val: string) => void;
  
  // Financial totals
  subtotal: number;
  totalCartUnits: number;
  vatAmount: number;
  companyBaselineSubtotal: number;
  
  // Actions
  handleCheckout: () => void;
  handlePutCartOnHold: () => void;
  handleOpenPosPrompt: () => void;
  handleSalesLadySubmitToQueue: (mode: 'PRINT_RECEIPT_AND_HOLD' | 'PAY_ON_COLLECTION') => void;
  checkoutError: string | null;
  isProcessingStk: boolean;
  stkStatusMessage: string;
  
  // Station & Queue
  branchHeldCarts: HeldCart[];
  allBranchSalesRepHeldCarts: HeldCart[];
  isHeldCartsOpen: boolean;
  setIsHeldCartsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleRecallCart: (holdId: string) => void;
  updateHeldCartQueueStatus: (holdId: string, updates: Partial<HeldCart>) => void;
  removeHeldCart: (holdId: string) => void;
  setPrintingQueueTicket: (val: HeldCart | null) => void;
  handleKickDrawer: () => void;
  openStaffPinPrompt: () => void;
  
  // Info & Context
  currentUser: { name: string; id: string; role?: string };
  activeBranch: { name: string; code: string; id: string };
  activeCounterCashierName: string;
  isWarehouse: boolean;
  isWholesaleStore: boolean;
  minThreshold: number;
  
  // Catalog Lookup / Drawer
  products: Product[];
  inventoryItems: any[];
  onOpenCatalogLookup: () => void;
  onSwitchToCatalogView?: () => void;
}

export const CashierRegisterView: React.FC<CashierRegisterViewProps> = ({
  cart,
  addToCart,
  removeFromCart,
  updateCartItemQty,
  clearCart,
  barcodeInput,
  setBarcodeInput,
  handleBarcodeSubmit,
  posBarcodeInputRef,
  processScannedBarcode,
  lastPinnedPosScan,
  setLastPinnedPosScan,
  justScannedProductId,
  setIsCameraModalOpen,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  customerKraPin,
  setCustomerKraPin,
  paymentMethod,
  setPaymentMethod,
  cashTendered,
  setCashTendered,
  cashChange,
  parsedCashTendered,
  splitCashAmount,
  setSplitCashAmount,
  splitMpesaAmount,
  setSplitMpesaAmount,
  splitRemaining,
  cardAuthCode,
  setCardAuthCode,
  posMpesaReceiptInput,
  setPosMpesaReceiptInput,
  subtotal,
  totalCartUnits,
  vatAmount,
  handleCheckout,
  handlePutCartOnHold,
  handleOpenPosPrompt,
  handleSalesLadySubmitToQueue,
  checkoutError,
  isProcessingStk,
  stkStatusMessage,
  branchHeldCarts,
  allBranchSalesRepHeldCarts,
  isHeldCartsOpen,
  setIsHeldCartsOpen,
  handleRecallCart,
  updateHeldCartQueueStatus,
  removeHeldCart,
  setPrintingQueueTicket,
  handleKickDrawer,
  openStaffPinPrompt,
  currentUser,
  activeBranch,
  activeCounterCashierName,
  isWarehouse,
  isWholesaleStore,
  minThreshold,
  inventoryItems,
  onOpenCatalogLookup,
  onSwitchToCatalogView
}) => {
  const {
    attachedAlcoholBill,
    setAttachedAlcoholBill,
    restaurantTableNumber,
    setRestaurantTableNumber,
    restaurantFoodCategories,
    restaurantFoodItems,
    addFoodToCart
  } = useErp();

  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [isAttachAlcoholModalOpen, setIsAttachAlcoholModalOpen] = useState(false);
  const [isFoodMenuModalOpen, setIsFoodMenuModalOpen] = useState(false);
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<string>('ALL');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const posCarrier = detectKenyanMobileCarrier(customerPhone);

  const attachedAlcoholTotal = attachedAlcoholBill ? attachedAlcoholBill.totalKes : 0;
  const effectiveGrandTotal = subtotal + attachedAlcoholTotal;

  return (
    <div className="space-y-4">
      {/* 1. TOP CASHIER REGISTER STATUS & UTILITY COMMAND BAR (Matches Branch Manager Hero Card Style) */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-7 shadow-md flex flex-col justify-between gap-4 hover-card-lift">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-md shrink-0">
              <Store className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                  Branch Retail POS Terminal • Cashier Station
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/15 text-[#0A006E] border border-[#0A006E]/20 font-montserrat font-black text-[10px] uppercase">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-700"></span>
                  </span>
                  <span>Ready to Scan</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 mt-0.5 sm:mt-1 max-w-2xl font-semibold">
                <strong>Retail Checkout Terminal:</strong> Served by <strong className="text-[#0A006E]">{activeCounterCashierName || currentUser.name}</strong> at <strong className="text-[#0A006E]">{activeBranch.name}</strong>. Waiting for scanned items or incoming Sales Representative queue orders.
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar Below — Matches Branch Manager Card toolbar */}
        <div className="pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-in fade-in">
          <div className="bg-white/90 p-2 rounded-2xl border border-[#0A006E]/15 shadow-2xs flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs text-[#0A006E] font-montserrat font-black uppercase tracking-wider px-1">
              Terminal Actions:
            </span>
            {/* Restaurant Food Menu Button */}
            <button
              type="button"
              onClick={() => setIsFoodMenuModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-orange-950 border border-orange-300 text-xs font-montserrat font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Browse and add restaurant kitchen dishes & food items"
            >
              <Utensils className="w-3.5 h-3.5 text-orange-600" />
              <span>Food Menu</span>
            </button>

            {/* Attach Client Alcohol Bill Button */}
            <button
              type="button"
              onClick={() => setIsAttachAlcoholModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                attachedAlcoholBill
                  ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 ring-2 ring-amber-300/40'
                  : 'bg-white hover:bg-amber-50 text-slate-800 border border-slate-300'
              }`}
              title="Attach client alcohol bill to this restaurant ticket"
            >
              <Wine className="w-3.5 h-3.5 text-amber-700" />
              <span>{attachedAlcoholBill ? `Alcohol Bill (#${attachedAlcoholBill.billNumber})` : 'Attach Alcohol Bill'}</span>
            </button>

            {/* Dine-In Table Number Input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-xs" title="Restaurant dine-in table number printed on receipt">
              <span className="font-montserrat font-bold text-slate-500 uppercase text-[10px]">Table:</span>
              <input
                type="text"
                value={restaurantTableNumber}
                onChange={(e) => setRestaurantTableNumber(e.target.value)}
                placeholder="e.g. T-04"
                className="w-16 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0A006E]"
              />
            </div>

            {/* Quick Item Lookup / Browse Drawer Button */}
            <button
              type="button"
              onClick={onOpenCatalogLookup}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-montserrat font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Open Product Catalog Lookup to search and add drinks manually"
            >
              <Search className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>Item Lookup</span>
            </button>

            {/* Rep Orders Queue Button */}
            {allBranchSalesRepHeldCarts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsHeldCartsOpen(prev => !prev)}
                className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border border-[#0A006E] text-xs font-montserrat font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs animate-pulse"
                title="Incoming orders submitted by Sales Representatives"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{allBranchSalesRepHeldCarts.length} Rep Order{allBranchSalesRepHeldCarts.length > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Held Carts Button */}
            <button
              type="button"
              onClick={() => setIsHeldCartsOpen(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-2xs ${
                branchHeldCarts.length > 0
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="View Held Orders & Collection Queue"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Held ({branchHeldCarts.length})</span>
            </button>

            {/* Kick Cash Drawer Button */}
            <button
              type="button"
              onClick={handleKickDrawer}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FFDE00] text-[#0A006E] border border-amber-300 text-xs font-montserrat font-black flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="Send RJ11 Drawer Kick Pulse via ESC/POS"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Drawer</span>
            </button>

            {/* Clear / Void Cart Button */}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-montserrat font-bold flex items-center gap-1 transition cursor-pointer"
                title="Clear active register cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            {/* Switch Staff PIN */}
            <button
              type="button"
              onClick={openStaffPinPrompt}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-montserrat font-bold flex items-center gap-1 transition cursor-pointer"
              title="Switch cashier login PIN"
            >
              <Lock className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Switch PIN</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Counter Order Queue & Held Carts Panel */}
      {isHeldCartsOpen && (
        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-[#0A006E] space-y-3 animate-in fade-in shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Counter Orders &amp; Held Carts Queue ({branchHeldCarts.length})
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsHeldCartsOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 rounded-lg bg-white border border-slate-200"
            >
              ✕ Close Queue
            </button>
          </div>

          {branchHeldCarts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center bg-white rounded-xl border border-slate-200">
              No orders currently in the counter queue or on hold.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {branchHeldCarts.map((held) => {
                const status = held.queueStatus || 'QUEUED_AT_COUNTER';
                const isReady = status === 'READY_FOR_COLLECTION';
                return (
                  <div
                    key={held.id}
                    className={`p-3 rounded-xl bg-white border shadow-2xs space-y-2 flex flex-col justify-between ${
                      isReady ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-black text-xs text-[#0A006E]">
                          {held.holdNumber}
                        </span>
                        <span className="text-[10px] font-bold text-[#1E9E60] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {formatKes(held.totalKes)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-800 font-bold line-clamp-1 mt-1">
                        {held.items.map(i => `${i.quantity}× ${i.product.name}`).join(', ')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        Source: {held.affiliateName || held.heldByName || 'Walk-in'} • {held.createdAt}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPrintingQueueTicket(held)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-montserrat font-bold flex items-center gap-1 transition"
                        title="Print 80mm Thermal Receipt"
                      >
                        <Printer className="w-3 h-3 text-[#0A006E]" />
                        <span>Print</span>
                      </button>

                      {!isReady && (
                        <button
                          type="button"
                          onClick={() => {
                            updateHeldCartQueueStatus(held.id, {
                              queueStatus: 'READY_FOR_COLLECTION',
                              preparedByCashierName: currentUser.name,
                              readyAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            });
                          }}
                          className="px-2 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] text-[10px] font-montserrat font-bold transition"
                        >
                          Ready
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRecallCart(held.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-[10px] font-montserrat font-black flex items-center gap-1 transition"
                      >
                        <PlayCircle className="w-3 h-3" />
                        <span>Load to Register</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeHeldCart(held.id)}
                        className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                        title="Discard order"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. MAIN REGISTER WORKSPACE: 2-COLUMN SPLIT (MIDDLE REGISTER LIST + RIGHT SETTLEMENT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* CENTER / MIDDLE WORKSTATION: BARCODE SCANNER + SCANNED ITEMS LIST (7 or 8 COLS) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3.5">
          
          {/* Prominent Barcode Scanning Command Ribbon */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-[#0A006E]/15 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wide">
                  Barcode Scanner Active
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  • USB / Bluetooth / Keypad Input
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                Auto-Add on Scan
              </span>
            </div>

            {/* Fast Scanner Input Bar */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 text-[#0A006E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={posBarcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan bottle barcode (EAN-13 / UPC / Case) or enter SKU & press Enter..."
                  autoFocus
                  className="w-full pl-11 pr-8 py-3 bg-slate-50 border-2 border-slate-300 focus:border-[#0A006E] focus:bg-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A006E]/20 text-slate-900 placeholder:text-slate-400 transition"
                />
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('');
                      posBarcodeInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs"
                    title="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Camera Scanner Trigger */}
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold text-xs border border-slate-200 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Open Camera Barcode Scanner"
              >
                <Camera className="w-4 h-4 text-[#0A006E]" />
                <span className="hidden sm:inline">Camera</span>
              </button>

              <button
                type="submit"
                className="px-5 py-3 bg-[#0A006E] hover:bg-[#060046] active:scale-95 text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
              >
                <Barcode className="w-4 h-4" />
                <span>Scan / Add</span>
              </button>
            </form>

            {/* Pinned Verification Card for the Last Scanned Item */}
            {lastPinnedPosScan && (
              <div className="p-3.5 rounded-xl bg-[#0A006E] text-white border-2 border-[#FFDE00] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-inner">
                    <ProductImage product={lastPinnedPosScan.product} size="xs" />
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase shrink-0 text-center shadow-xs">
                    <div>IDENTIFIED</div>
                    <div className="font-mono text-[9px]">{lastPinnedPosScan.isCaseScan ? 'CASE CODE' : 'BOTTLE'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-montserrat font-black text-[#FFDE00] truncate">
                      {lastPinnedPosScan.product.name} ({lastPinnedPosScan.product.volumeMl} mL)
                    </div>
                    <div className="text-[10px] font-mono text-slate-200 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Barcode: <strong>{lastPinnedPosScan.scannedCode}</strong></span>
                      <span>•</span>
                      <span>SKU: <strong>{lastPinnedPosScan.product.sku}</strong></span>
                      <span>•</span>
                      <span>Price: <strong className="text-emerald-300">{formatKes(lastPinnedPosScan.product.retailPriceKes)}</strong></span>
                      <span>•</span>
                      <span>Added: <strong className="text-[#FFDE00]">+{lastPinnedPosScan.qtyAdded}</strong></span>
                      <span>•</span>
                      <span>Stock Left: <strong className="text-white">{lastPinnedPosScan.remainingAfterCart} btl</strong></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-right font-mono text-xs">
                    <div className="text-[9px] text-[#FFDE00] uppercase font-bold">Line Total</div>
                    <div className="font-black text-white">
                      {formatKes(lastPinnedPosScan.product.retailPriceKes * lastPinnedPosScan.qtyAdded)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastPinnedPosScan(null)}
                    className="text-white/60 hover:text-white p-1 text-xs font-bold transition"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Attached Client Alcohol Bill Banner */}
          {attachedAlcoholBill && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                  🍷
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-montserrat font-black text-xs sm:text-sm text-slate-900">
                      Attached Client Alcohol Bill: #{attachedAlcoholBill.billNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono font-bold text-[10px]">
                      +{formatKes(attachedAlcoholBill.totalKes)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                    {attachedAlcoholBill.items.length} drink item(s) • Source: {attachedAlcoholBill.branchName || 'Bar Counter'}
                    {restaurantTableNumber ? ` • Table: ${restaurantTableNumber}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsAttachAlcoholModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-[#0A006E] border border-amber-300 text-xs font-montserrat font-bold transition cursor-pointer"
                >
                  View Drinks
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedAlcoholBill(null)}
                  className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-montserrat font-bold transition cursor-pointer"
                  title="Detach this alcohol bill from the order"
                >
                  Detach
                </button>
              </div>
            </div>
          )}

          {/* THE MIDDLE WORKSTATION: SCANNED ITEMS LIST / REGISTER TAPE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[440px]">
            {/* Header Ribbon of the middle table */}
            <div className="bg-slate-50/80 p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-2xs">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm text-slate-900 uppercase tracking-tight">
                    Scanned Items Checkout List
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {cart.length === 0
                      ? 'Waiting for items to be scanned...'
                      : `${cart.length} line items • ${totalCartUnits} total units in register`}
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-[#0A006E] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Subtotal: {formatKes(subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              )}
            </div>

            {/* TABLE CONTENT: WAITING STATE VS ITEM ROWS */}
            {cart.length === 0 ? (
              /* CLEAN WAITING STATE: Retail POS waiting for items to be scanned */
              <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center bg-slate-50/40">
                {/* Animated scan indicator */}
                <div className="relative mb-5">
                  <div className="w-24 h-24 rounded-3xl bg-white shadow-md border-2 border-slate-200 flex items-center justify-center text-[#0A006E]">
                    <Barcode className="w-12 h-12" />
                  </div>
                  {/* Glowing Laser Scan Beam Animation */}
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse" />
                </div>

                <h4 className="font-montserrat font-black text-lg sm:text-xl text-slate-800 tracking-tight mb-2">
                  Waiting for items to be scanned...
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  Point your physical USB/Bluetooth barcode scanner at bottle, enter SKU/barcode above, or recall orders submitted by Sales Representatives.
                </p>

                {/* Helpful POS Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-montserrat font-bold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Laser Scanner Ready
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0A006E] border border-blue-200 text-xs font-montserrat font-bold shadow-2xs">
                    EAN-13 / UPC Single Bottles
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-montserrat font-bold shadow-2xs">
                    GTIN-14 Master Cases
                  </span>
                  <button
                    type="button"
                    onClick={onOpenCatalogLookup}
                    className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border border-[#0A006E] text-xs font-montserrat font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Lookup from Catalog</span>
                  </button>
                </div>
              </div>
            ) : (
              /* CLEAN RETAIL POS SCANNED ITEMS TABLE */
              <div className="flex-1 flex flex-col justify-between overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-montserrat font-black text-slate-700 uppercase tracking-wider">
                      <th className="py-3 px-3 w-12 text-center">#</th>
                      <th className="py-3 px-3">Item Description</th>
                      <th className="py-3 px-3 text-center">Barcode / SKU</th>
                      <th className="py-3 px-3 text-right">Price</th>
                      <th className="py-3 px-3 text-center w-36">Quantity</th>
                      <th className="py-3 px-3 text-right">Line Total</th>
                      <th className="py-3 px-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {cart.map((item, idx) => {
                      const isJustScanned = item.product.id === justScannedProductId;
                      const baseProdId = item.product.id.includes('-vol-')
                        ? item.product.id.split('-vol-')[0]
                        : item.product.id;
                      const branchInv = inventoryItems.find(
                        i => i.productId === baseProdId && i.branchId === activeBranch.id
                      );
                      const fallbackInv = inventoryItems.find(
                        i => i.productId === baseProdId && i.bottlesOnHand > 0
                      );
                      const inv = branchInv && branchInv.bottlesOnHand > 0 ? branchInv : fallbackInv || branchInv;
                      const stockBefore = inv ? inv.bottlesOnHand : 0;
                      const lineTotal = item.unitPrice * item.quantity;

                      return (
                        <tr
                          key={item.product.id}
                          className={`transition-colors ${
                            isJustScanned
                              ? 'bg-emerald-50/80 ring-2 ring-emerald-400/50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Row Index */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                            {String(idx + 1).padStart(2, '0')}
                          </td>

                          {/* Product Image & Details */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                                <ProductImage product={item.product} size="xs" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-montserrat font-bold text-slate-900 text-xs sm:text-sm">
                                    {item.product.name}
                                  </span>
                                  {isJustScanned && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-montserrat font-black text-[9px] uppercase animate-pulse">
                                      ★ Just Scanned
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                  <span>{item.product.volumeMl} mL</span>
                                  <span>•</span>
                                  <span className="text-slate-600">Stock: {stockBefore} btl</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Barcode & SKU */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {item.product.barcode || 'NO-BARCODE'}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                                SKU: {item.product.sku}
                              </span>
                            </div>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                            {formatKes(item.unitPrice)}
                          </td>

                          {/* Quantity Stepper */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                                title="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-3 py-1 font-mono font-black text-xs text-slate-900 min-w-8 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                                title="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-montserrat font-black text-sm text-[#0A006E] tabular-nums">
                              {formatKes(lineTotal)}
                            </span>
                          </td>

                          {/* Remove Action */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Bottom Register Footer Bar */}
                <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-montserrat font-bold text-slate-700">
                  <div className="flex items-center gap-3">
                    <span>{cart.length} line item(s)</span>
                    <span>•</span>
                    <span className="text-[#0A006E] font-black">{totalCartUnits} total bottle(s)</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Ready for next barcode scan</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RETAIL SETTLEMENT & TENDER PANEL (4 or 5 COLS) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3.5 sticky top-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4">
            
            {/* Grand Digital LED Total Display */}
            <div className="p-4 rounded-2xl bg-slate-950 border-2 border-[#0A006E] text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-montserrat font-black uppercase tracking-wider">
                <span>Total Amount Due</span>
                <span className="text-emerald-400">VAT 16% Included</span>
              </div>
              <div className="font-montserrat font-black text-3xl sm:text-4xl text-[#FFDE00] tracking-tight tabular-nums leading-none drop-shadow-xs">
                {formatKes(effectiveGrandTotal)}
              </div>
              {attachedAlcoholTotal > 0 ? (
                <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800 text-slate-300">
                  <div className="flex justify-between">
                    <span>Food Items Subtotal:</span>
                    <span className="font-mono">{formatKes(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#FFDE00] font-bold">
                    <span>+ Attached Alcohol Bill (#{attachedAlcoholBill?.billNumber}):</span>
                    <span className="font-mono">+{formatKes(attachedAlcoholTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                  <span>Subtotal: {formatKes(subtotal - vatAmount)}</span>
                  <span>16% VAT: {formatKes(vatAmount)}</span>
                </div>
              )}
              {restaurantTableNumber && (
                <div className="pt-1.5 border-t border-slate-800 text-[10px] font-mono text-orange-300 flex justify-between">
                  <span>Dine-In Table:</span>
                  <span className="font-bold">{restaurantTableNumber}</span>
                </div>
              )}
            </div>

            {/* Receipt Attribution Bar */}
            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span className="truncate text-slate-600 font-medium">
                  Served by: <strong className="text-[#0A006E] font-bold">{currentUser.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={openStaffPinPrompt}
                className="text-[10px] font-montserrat font-black text-[#0A006E] bg-[#FFDE00] px-2 py-1 rounded-lg border border-[#0A006E]/30 shrink-0"
              >
                Switch
              </button>
            </div>

            {/* Customer Details Toggle / Inputs (Optional) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCustomerDetails(prev => !prev)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-montserrat font-bold text-slate-700 transition"
              >
                <span>Customer &amp; Tax Info {customerName || customerPhone ? `(${customerName || customerPhone})` : '(Optional)'}</span>
                <span className="text-slate-400">{showCustomerDetails ? '▲' : '▼'}</span>
              </button>
              
              {showCustomerDetails && (
                <div className="p-3 space-y-2.5 bg-white border-t border-slate-200 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Walk-in Customer / John Doe"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-slate-600">
                        Phone (for M-Pesa / Receipt)
                      </label>
                      {posCarrier.isValid && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {posCarrier.carrier}
                        </span>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={sanitizeAndControlKenyanMobileInput(customerPhone)}
                      onChange={(e) => setCustomerPhone(sanitizeAndControlKenyanMobileInput(e.target.value))}
                      placeholder="0712345678"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Email</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="client@mail.com"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">KRA PIN</label>
                      <input
                        type="text"
                        value={customerKraPin}
                        onChange={(e) => setCustomerKraPin(e.target.value.toUpperCase())}
                        placeholder="P05XXXXXX"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Multi-Tender Payment Selector */}
            <div className="space-y-2">
              <label className="block text-[10px] font-montserrat font-black text-slate-700 uppercase tracking-wider">
                Payment Tender
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-1 rounded-xl text-xs font-montserrat font-bold flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-[#34D186] text-[#FFDE00] border-[#34D186] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('MPESA')}
                  className={`py-2 px-1 rounded-xl text-xs font-montserrat font-bold flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    paymentMethod === 'MPESA'
                      ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>M-Pesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-2 px-1 rounded-xl text-xs font-montserrat font-bold flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPLIT')}
                  className={`py-2 px-1 rounded-xl text-xs font-montserrat font-bold flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    paymentMethod === 'SPLIT'
                      ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Split className="w-4 h-4" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* Cash Tender Details & Fast Cash Notes */}
            {paymentMethod === 'CASH' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Cash Received:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCashTendered(subtotal.toString())}
                      className="px-2 py-0.5 rounded bg-slate-200 hover:bg-[#FFDE00] text-slate-800 text-[10px] font-bold"
                    >
                      Exact
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashTendered((Math.ceil(subtotal / 1000) * 1000).toString())}
                      className="px-2 py-0.5 rounded bg-slate-200 hover:bg-[#FFDE00] text-slate-800 text-[10px] font-bold"
                    >
                      Round 1k
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={`KES ${subtotal}`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0A006E]"
                />

                {/* Quick note addition chips */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {[500, 1000, 2000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(cashTendered) || 0;
                        setCashTendered((current + amt).toString());
                      }}
                      className="px-2 py-1 rounded bg-white hover:bg-emerald-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                {parsedCashTendered > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-300">
                    <span className="font-bold text-emerald-800">Change Due:</span>
                    <span className="font-montserrat font-black text-base text-emerald-700">
                      {formatKes(cashChange)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* M-Pesa / STK Express Options */}
            {paymentMethod === 'MPESA' && (
              <div className="p-3 rounded-xl bg-emerald-50/80 border-2 border-[#34D186] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-montserrat font-black text-[11px] text-[#1E9E60] uppercase flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Safaricom M-Pesa Express</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#0A006E]">
                    {posCarrier.isValid ? posCarrier.formattedDisplay : 'Enter phone above'}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    Or Enter M-Pesa Receipt Code (If paid directly):
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={posMpesaReceiptInput}
                    onChange={e =>
                      setPosMpesaReceiptInput(
                        e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                      )
                    }
                    placeholder="e.g. QKA84X92LM"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs uppercase text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Card / Bank Transfer */}
            {paymentMethod === 'BANK_TRANSFER' && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1.5 text-xs">
                <label className="font-bold text-purple-950 block">PDQ Card Ref / Bank Code:</label>
                <input
                  type="text"
                  value={cardAuthCode}
                  onChange={(e) => setCardAuthCode(e.target.value)}
                  placeholder="e.g. AUTH-KCB-99420"
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg font-mono text-xs"
                />
              </div>
            )}

            {/* Split Tender */}
            {paymentMethod === 'SPLIT' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2 text-xs">
                <div className="font-bold text-amber-950">Split Tender:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Cash (KES)</label>
                    <input
                      type="number"
                      value={splitCashAmount}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">M-Pesa (KES)</label>
                    <input
                      type="number"
                      value={splitMpesaAmount}
                      onChange={(e) => setSplitMpesaAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-amber-200 text-[11px]">
                  <span>Unpaid Balance:</span>
                  <span className={`font-bold ${splitRemaining === 0 ? 'text-[#1E9E60]' : 'text-red-700'}`}>
                    {formatKes(splitRemaining)}
                  </span>
                </div>
              </div>
            )}

            {/* Feedback / Error banner */}
            {checkoutError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            {isProcessingStk && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#1E9E60] flex items-center space-x-2 animate-pulse">
                <div className="w-4 h-4 rounded-full border-2 border-[#34D186] border-t-transparent animate-spin" />
                <span>{stkStatusMessage}</span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                className="w-full py-3.5 px-4 bg-[#FFDE00] hover:bg-yellow-400 active:scale-95 text-[#0A006E] border-2 border-[#0A006E]/30 rounded-xl font-montserrat font-black text-sm sm:text-base shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>COLLECT PAYMENT &amp; PRINT ({formatKes(effectiveGrandTotal)})</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePutCartOnHold}
                  disabled={cart.length === 0}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold text-xs border border-slate-200 transition flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Hold Order</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSalesLadySubmitToQueue('PRINT_RECEIPT_AND_HOLD')}
                  disabled={cart.length === 0}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold text-xs border border-slate-200 transition flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0A006E]" />
                  <span>Quote Receipt</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Attach Alcohol Bill Modal */}
      <AttachAlcoholBillModal
        isOpen={isAttachAlcoholModalOpen}
        onClose={() => setIsAttachAlcoholModalOpen(false)}
        onAttachBill={(bill) => {
          setAttachedAlcoholBill(bill);
          setIsAttachAlcoholModalOpen(false);
        }}
        currentAttachedBill={attachedAlcoholBill}
        onRemoveAttachedBill={() => setAttachedAlcoholBill(null)}
      />

      {/* Fast Restaurant Food Menu Drawer / Modal */}
      {isFoodMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#0A006E]/20 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-base sm:text-lg text-white">
                    Restaurant Kitchen &amp; Food Menu
                  </h3>
                  <p className="text-xs text-slate-200">
                    Select dishes to add directly into current register order ({restaurantFoodItems.length} available items)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFoodMenuModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categories & Search */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onChange={(e) => setFoodSearchQuery(e.target.value)}
                    placeholder="Search dishes (e.g. Nyama Choma, Fries, Chicken, Ugali, Fish)..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
                  />
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedFoodCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedFoodCategory === 'ALL'
                      ? 'bg-[#0A006E] text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All Categories ({restaurantFoodItems.length})
                </button>
                {restaurantFoodCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedFoodCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedFoodCategory === cat.id
                        ? 'bg-[#0A006E] text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dishes Grid */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {restaurantFoodItems
                .filter(item => {
                  if (selectedFoodCategory !== 'ALL' && item.categoryId !== selectedFoodCategory) return false;
                  if (foodSearchQuery.trim()) {
                    const q = foodSearchQuery.toLowerCase();
                    return item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q));
                  }
                  return true;
                })
                .map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-[#0A006E]/40 hover:shadow-sm transition flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-montserrat font-black text-xs sm:text-sm text-slate-900 leading-snug">
                          {item.name}
                        </h4>
                        <span className="font-mono font-black text-xs text-[#0A006E] shrink-0 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          {formatKes(item.priceKes)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Portion: {item.servingPortion || 'Standard'}</span>
                        {item.preparationTimeMinutes && <span>• {item.preparationTimeMinutes} mins</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addFoodToCart(item, 1);
                      }}
                      className="w-full py-1.5 rounded-xl bg-orange-50 hover:bg-orange-600 text-orange-950 hover:text-white border border-orange-300 hover:border-orange-600 font-montserrat font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Order</span>
                    </button>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="text-slate-600">
                Cart items in register: <strong className="text-[#0A006E]">{cart.length}</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsFoodMenuModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-bold cursor-pointer transition shadow-2xs"
              >
                Done Adding Dishes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
