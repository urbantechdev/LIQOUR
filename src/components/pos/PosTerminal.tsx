import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useErp } from '../../context/ErpContext';
import { getAuthHeaders } from '../../utils/apiAuth';
import { Product, StockCategory, HeldCart } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Search, 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Smartphone, 
  Banknote, 
  CreditCard, 
  Split, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  Camera, 
  Wifi, 
  Printer, 
  CircleDollarSign, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Send, 
  Calculator, 
  History, 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  Layers,
  ArrowRight,
  HelpCircle,
  PauseCircle,
  PlayCircle,
  Clock,
  UserCheck,
  Delete,
  X,
  Download
} from 'lucide-react';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import { OrderItemsDocumentModal } from '../common/OrderItemsDocumentModal';
import {
  OrderItemsDocumentPayload,
  isMultiItemOrder,
  buildOrderDocumentFromCart,
  buildOrderDocumentFromSaleOrder,
  downloadOrderItemsHtmlDocument
} from '../../utils/orderItemsDocumentGenerator';
import { ProductImage } from '../common/ProductImage';
import {
  getProductImageUrl,
  generateStudioBottleSvgDataUri,
  extractGoogleDriveFileId
} from '../../utils/productImages';
import { CenterScreenFeedback, CenterScreenFeedbackData } from '../common/CenterScreenFeedback';
import { BarcodeScannerModal } from '../inventory/BarcodeScannerModal';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../../data/nairobiDrinksCatalog';
import { scatterAndReshuffleProducts, useAutoReshuffleTimer } from '../../utils/productScattering';
import {
  detectKenyanMobileCarrier,
  sanitizeAndControlKenyanMobileInput
} from '../../utils/kenyanMobileCarrier';

interface ShiftDrawerState {
  isOpen: boolean;
  stationId: string;
  cashierName: string;
  openedAt: string;
  openingFloatKes: number;
  cashSalesKes: number;
  expectedCashKes: number;
}

export const PosTerminal: React.FC = () => {
  const { 
    products, 
    inventoryItems, 
    activeBranch, 
    cart, 
    selectedAffiliate,
    setSelectedAffiliate,
    recalledSalesPerson,
    setRecalledSalesPerson,
    addToCart, 
    removeFromCart, 
    updateCartItemQty, 
    updateCartItemMarkup,
    updateCartItemPreferredPrice,
    clearCart,
    heldCarts,
    holdCurrentCart,
    updateHeldCartQueueStatus,
    recallHeldCart,
    removeHeldCart,
    completeSale,
    affiliates,
    defaultAffiliateCommissionRate,
    defaultAffiliateCommissionMode,
    defaultAllowPreferredPrice,
    updateAffiliateCommissionSettings,
    lastCompletedInvoice,
    setLastCompletedInvoice,
    orders,
    employees,
    currentUser,
    currentRole,
    currentDepartment,
    posStationMode,
    setPosStationMode,
    isPosCashier,
    instantLoginWithStaffPin,
    updateCurrentStaffName,
    updateAffiliateAssignedCashier,
    branches,
    getBranchProductPrice,
    setBranchProductPreferredPrice,
    restockRequests,
    createRestockRequest,
    acceptAndFulfillRestockRequest,
    etimsInvoices,
    scanHistory
  } = useErp();

  // Two POS Sales Roles:
  // 1. 'COUNTER_CASHIER' — Sits inside counter, receives order queue, prepares drinks ready for collection & processes payment
  // 2. 'SALES_LADY' — Sales Affiliate Lady who picks order from customer & submits to Cashier Queue (Pay on Collection OR Print Thermal Receipt & Hold Pending Payment)
  const [printingQueueTicket, setPrintingQueueTicket] = useState<HeldCart | null>(null);
  const [selectedWorkingCashierId, setSelectedWorkingCashierId] = useState<string>('');
  const [counterCashierSaleMode, setCounterCashierSaleMode] = useState<'DIRECT_SALE' | 'RECEIVE_REP_ORDERS'>('DIRECT_SALE');
  const [showAllBranchRepOrders, setShowAllBranchRepOrders] = useState<boolean>(true);
  const [filterRepIdForOrders, setFilterRepIdForOrders] = useState<string>('ALL');
  const [isRepHistoryModalOpen, setIsRepHistoryModalOpen] = useState(false);
  const [activeOrderItemsDocument, setActiveOrderItemsDocument] = useState<OrderItemsDocumentPayload | null>(null);
  const [repHistoryPeriod, setRepHistoryPeriod] = useState<'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [repHistorySearch, setRepHistorySearch] = useState('');

  // Mobile POS App Navigation Tab ('CATALOG' | 'QUEUE' | 'CHECKOUT')
  const [mobilePosTab, setMobilePosTab] = useState<'CATALOG' | 'QUEUE' | 'CHECKOUT'>('CATALOG');

  // Search & Catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StockCategory | 'ALL'>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);
  const [awaitingNextPosScan, setAwaitingNextPosScan] = useState(false);
  const posBarcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [centerFeedback, setCenterFeedback] = useState<CenterScreenFeedbackData | null>(null);

  const showSuccessFeedback = useCallback((title: string, message?: string, subtext?: string) => {
    setCenterFeedback({
      type: 'SUCCESS',
      title,
      message,
      subtext,
      durationMs: 540
    });
  }, []);

  const showErrorFeedback = useCallback((title: string, message?: string, subtext?: string) => {
    setCenterFeedback({
      type: 'ERROR',
      title,
      message,
      subtext,
      durationMs: 600
    });
  }, []);

  const [posMpesaReceiptInput, setPosMpesaReceiptInput] = useState('');
  const [posCheckoutRequestId, setPosCheckoutRequestId] = useState<string | null>(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptModalError, setPromptModalError] = useState<string | null>(null);
  const [promptModalSuccess, setPromptModalSuccess] = useState<string | null>(null);
  const [lastPinnedPosScan, setLastPinnedPosScan] = useState<{
    product: Product;
    scannedCode: string;
    isCaseScan: boolean;
    qtyAdded: number;
    stockOnHand: number;
    remainingAfterCart: number;
  } | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Product Box Tap-to-Preview & Volume (Liters / mL) Selection Modal State
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [selectedVolumeMl, setSelectedVolumeMl] = useState<number>(750);
  const [volumeUnitMode, setVolumeUnitMode] = useState<'ML' | 'L'>('ML');
  const [customVolumeInput, setCustomVolumeInput] = useState<string>('750');
  const [previewQty, setPreviewQty] = useState<number>(1);
  const [previewMarkup, setPreviewMarkup] = useState<number>(0);

  const ML_VOLUME_PRESETS = [
    { ml: 200, label: '200 mL', sub: '0.20 L • Nip / Quarter' },
    { ml: 250, label: '250 mL', sub: '0.25 L • Can / Stubby' },
    { ml: 330, label: '330 mL', sub: '0.33 L • Std Bottle/Can' },
    { ml: 350, label: '350 mL', sub: '0.35 L • Half Bottle' },
    { ml: 375, label: '375 mL', sub: '0.375 L • Pint' },
    { ml: 500, label: '500 mL', sub: '0.50 L • Half Litre' },
    { ml: 700, label: '700 mL', sub: '0.70 L • Euro Bottle' },
    { ml: 750, label: '750 mL', sub: '0.75 L • Standard Bottle' }
  ];

  const LITER_VOLUME_PRESETS = [
    { ml: 1000, label: '1.0 Liter', sub: '1,000 mL • Full Litre' },
    { ml: 1500, label: '1.5 Liters', sub: '1,500 mL • Magnum' },
    { ml: 1750, label: '1.75 Liters', sub: '1,750 mL • Handle' },
    { ml: 2000, label: '2.0 Liters', sub: '2,000 mL • Double Litre' },
    { ml: 3000, label: '3.0 Liters', sub: '3,000 mL • Double Magnum' },
    { ml: 5000, label: '5.0 Liters', sub: '5,000 mL • Party Cask / Keg' }
  ];

  const formatVolumeBadgeText = (volMl: number) => {
    const liters = +(volMl / 1000).toFixed(3);
    if (volMl >= 1000) {
      return `${liters} L (${volMl.toLocaleString()} mL)`;
    }
    return `${volMl} mL (${liters} L)`;
  };

  const openProductPreviewModal = (product: Product) => {
    const baseVol = product.volumeMl || 750;
    setPreviewProduct(product);
    setSelectedVolumeMl(baseVol);
    const defaultMode = baseVol >= 1000 ? 'L' : 'ML';
    setVolumeUnitMode(defaultMode);
    setCustomVolumeInput(defaultMode === 'L' ? String(+(baseVol / 1000).toFixed(3)) : String(baseVol));
    setPreviewQty(1);

    const companyBasePrice = getBranchProductPrice(product, activeBranch).effectiveUnitPriceKes;
    const activeAff =
      selectedAffiliate ||
      affiliates.find(
        a =>
          a.id === currentUser.id ||
          a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      ) ||
      null;
    const allowPref = activeAff ? activeAff.allowPreferredPrice !== false : defaultAllowPreferredPrice;
    const savedPref = allowPref && activeAff?.preferredPrices ? activeAff.preferredPrices[product.id] : undefined;
    setPreviewMarkup(savedPref && savedPref > companyBasePrice ? savedPref - companyBasePrice : 0);
  };

  const handleSelectVolumePreset = (volMl: number, mode?: 'ML' | 'L') => {
    const targetMode = mode || (volMl >= 1000 ? 'L' : 'ML');
    setSelectedVolumeMl(volMl);
    setVolumeUnitMode(targetMode);
    setCustomVolumeInput(targetMode === 'L' ? String(+(volMl / 1000).toFixed(3)) : String(volMl));
  };

  const handleCustomVolumeChange = (rawVal: string, mode: 'ML' | 'L') => {
    setCustomVolumeInput(rawVal);
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      const computedMl = mode === 'L' ? Math.round(parsed * 1000) : Math.round(parsed);
      if (computedMl >= 50 && computedMl <= 50000) {
        setSelectedVolumeMl(computedMl);
      }
    }
  };

  const buildVolumeVariantProduct = (baseProd: Product, targetVolMl: number): Product => {
    const branchPricing = getBranchProductPrice(baseProd, activeBranch);
    const baseVol = baseProd.volumeMl || 750;
    if (targetVolMl === baseVol) {
      return {
        ...baseProd,
        retailPriceKes: branchPricing.retailPriceKes,
        wholesalePriceKes: branchPricing.wholesalePriceKes
      };
    }
    const ratio = targetVolMl / baseVol;
    const roundTo10 = (val: number) => Math.max(50, Math.round((val * ratio) / 10) * 10);
    const scaledRetail = roundTo10(branchPricing.retailPriceKes);
    const scaledWholesale = roundTo10(branchPricing.wholesalePriceKes);
    const scaledCost = Math.max(30, Math.round(baseProd.warehouseCostKes * ratio));

    const strippedName = baseProd.name.replace(/\s*\(\d+\s*(ml|mL|L|l)\)/gi, '').trim();
    const volSuffix =
      targetVolMl >= 1000
        ? `${+(targetVolMl / 1000).toFixed(2)}L / ${targetVolMl}mL`
        : `${targetVolMl}mL / ${+(targetVolMl / 1000).toFixed(2)}L`;

    return {
      ...baseProd,
      id: `${baseProd.id}-vol-${targetVolMl}`,
      sku: `${baseProd.sku}-${targetVolMl >= 1000 ? `${+(targetVolMl / 1000).toFixed(2)}L` : `${targetVolMl}ML`}`,
      name: `${strippedName} (${volSuffix})`,
      volumeMl: targetVolMl,
      retailPriceKes: scaledRetail,
      wholesalePriceKes: scaledWholesale,
      warehouseCostKes: scaledCost
    };
  };

  // Shift & Cash Drawer Float Management
  const [shiftState, setShiftState] = useState<ShiftDrawerState>(() => {
    const saved = localStorage.getItem(`vaairo_shift_${activeBranch.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      isOpen: true,
      stationId: `POS-${activeBranch.code}-01`,
      cashierName: currentUser?.name || 'Authorized Cashier',
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      openingFloatKes: 0,
      cashSalesKes: 0,
      expectedCashKes: 0
    };
  });

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [tempFloatInput, setTempFloatInput] = useState('0');
  const [countedCashInput, setCountedCashInput] = useState('');
  const [shiftPinInput, setShiftPinInput] = useState('');
  const [drawerKickFeedback, setDrawerKickFeedback] = useState<string | null>(null);

  // Offline / Online simulation
  const [isOnline, setIsOnline] = useState(true);

  // Checkout inputs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerKraPin, setCustomerKraPin] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'CASH' | 'SPLIT' | 'BANK_TRANSFER'>('MPESA');
  const [holdNote, setHoldNote] = useState('');
  const [isHeldCartsOpen, setIsHeldCartsOpen] = useState(false);
  const [holdFeedback, setHoldFeedback] = useState<string | null>(null);
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [staffPinTarget, setStaffPinTarget] = useState<string | null>(null);
  const [staffSwitchPin, setStaffSwitchPin] = useState<string>('');
  const [staffPinError, setStaffPinError] = useState<string>('');
  const [activePinKey, setActivePinKey] = useState<string | null>(null);

  const staffRosterList = Array.from(
    new Set(
      [
        currentUser.name,
        ...employees
          .filter(
            e =>
              e.active &&
              e.department === 'POS' &&
              (currentRole === 'SUPER_ADMIN' || !e.branchId || e.branchId === activeBranch.id)
          )
          .map(e => e.name),
        ...affiliates
          .filter(
            a =>
              a.active &&
              (currentRole === 'SUPER_ADMIN' || !a.branchId || a.branchId === activeBranch.id)
          )
          .map(a => a.name)
      ].filter(Boolean)
    )
  );

  const openStaffPinPrompt = useCallback((targetName?: string) => {
    const defaultTarget =
      targetName ||
      staffRosterList.find(n => n !== currentUser.name) ||
      currentUser.name;
    setStaffPinTarget(defaultTarget);
    setStaffSwitchPin('');
    setStaffPinError('');
    setIsStaffPickerOpen(false);
  }, [currentUser.name, staffRosterList]);

  const confirmStaffSwitchWithPin = useCallback((pinValue: string, targetName: string) => {
    if (pinValue.length !== 6) {
      setStaffPinError(`Please enter all 6 digits of ${targetName}'s security PIN.`);
      return;
    }

    const matchedEmp = employees.find(e => e.name.toLowerCase() === targetName.trim().toLowerCase());
    const matchedAff = affiliates.find(a => a.name.toLowerCase() === targetName.trim().toLowerCase());
    const targetId = matchedAff?.id || matchedEmp?.id;
    const targetDept = matchedAff ? 'AFFILIATES' : matchedEmp?.department;

    // Enforce strict department & branch lock when a STAFF user is logged in
    if (currentRole === 'STAFF') {
      if (targetDept && targetDept !== currentDepartment) {
        setStaffPinError(`Access Restricted: Cannot switch from ${currentDepartment} to ${targetDept} without signing out.`);
        setStaffSwitchPin('');
        return;
      }
      const targetBranch = matchedAff?.branchId || matchedEmp?.branchId;
      if (targetBranch && currentUser.branchId && targetBranch !== currentUser.branchId) {
        setStaffPinError(`Access Restricted: ${targetName} belongs to a different branch.`);
        setStaffSwitchPin('');
        return;
      }
    }

    const pinCheck = instantLoginWithStaffPin(pinValue, targetDept, targetId);
    const matchesDirectPin =
      (matchedEmp && matchedEmp.loginPin && pinValue === matchedEmp.loginPin) ||
      (matchedAff && matchedAff.loginPin && pinValue === matchedAff.loginPin);

    if (
      (!pinCheck.success || (targetId && pinCheck.staffRecord?.id !== targetId)) &&
      !matchesDirectPin
    ) {
      setStaffPinError(
        `Incorrect 6-digit PIN for ${targetName}. Please enter the valid 6-digit login PIN assigned to ${targetName}.`
      );
      setStaffSwitchPin('');
      return;
    }

    if (matchedAff) {
      setSelectedAffiliate(matchedAff);
    }

    updateCurrentStaffName(targetName);
    setStaffPinTarget(null);
    setStaffSwitchPin('');
    setStaffPinError('');
    setHoldFeedback(`✓ Switched active POS staff to ${targetName} (6-Digit PIN Verified)`);
    setTimeout(() => setHoldFeedback(null), 4000);
  }, [
    employees,
    affiliates,
    currentRole,
    currentDepartment,
    currentUser.branchId,
    instantLoginWithStaffPin,
    setSelectedAffiliate,
    updateCurrentStaffName
  ]);

  // Auto-submit when 6 digits are entered for staff switch PIN
  useEffect(() => {
    if (staffPinTarget && staffSwitchPin.length === 6) {
      const timer = window.setTimeout(() => {
        confirmStaffSwitchWithPin(staffSwitchPin, staffPinTarget);
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [staffPinTarget, staffSwitchPin, confirmStaffSwitchWithPin]);

  // Physical keyboard support when Staff Switch PIN Prompt is open
  useEffect(() => {
    if (!staffPinTarget) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setActivePinKey(e.key);
        setTimeout(() => setActivePinKey(null), 140);
        setStaffPinError('');
        setStaffSwitchPin(prev => (prev.length >= 6 ? prev : prev + e.key));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setActivePinKey('BACKSPACE');
        setTimeout(() => setActivePinKey(null), 140);
        setStaffPinError('');
        setStaffSwitchPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setStaffPinError('');
        setStaffSwitchPin('');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setStaffPinTarget(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmStaffSwitchWithPin(staffSwitchPin, staffPinTarget);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [staffPinTarget, staffSwitchPin, confirmStaffSwitchWithPin]);
  
  // Multi-Tender Specifics
  const [cashTendered, setCashTendered] = useState<string>('');
  const [cardAuthCode, setCardAuthCode] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitMpesaAmount, setSplitMpesaAmount] = useState<string>('');
  const [digitalReceiptMode, setDigitalReceiptMode] = useState<'NONE' | 'SMS' | 'EMAIL'>('SMS');

  // STK Push state simulation
  const [isProcessingStk, setIsProcessingStk] = useState(false);
  const [stkStatusMessage, setStkStatusMessage] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastAuditNotice, setLastAuditNotice] = useState<{
    orderNumber: string;
    totalKes: number;
    companySalesKes: number;
    affiliateProfitKes: number;
    affiliateBaseCommKes: number;
    affiliateTotalEarnedKes: number;
    affiliateName?: string;
    etimsNumber: string;
    glVoucher: string;
    itemsSold?: Array<{
      productId: string;
      productName: string;
      sku?: string;
      quantity: number;
      stockBeforeSale: number;
      stockAfterSale: number;
      assetValueDeductedKes: number;
    }>;
    totalAssetDeductedKes?: number;
  } | null>(null);

  // Check branch restrictions
  const isWarehouse = !activeBranch.allowDirectSales;
  const isWholesaleStore = activeBranch.tier === 'MAIN_STORE' || activeBranch.tier === 'DISTRIBUTOR';
  const minThreshold = activeBranch.minWholesaleThresholdKes || 0;

  // 20-second automatic catalog reshuffle tick with real-time countdown
  const { tick: autoShuffleTick, secondsLeft: shuffleSecondsLeft, reshuffleNow } = useAutoReshuffleTimer(20000);
  const [manualShuffleOffset, setManualShuffleOffset] = useState<number>(0);
  const currentShuffleSeed = autoShuffleTick + manualShuffleOffset;

  // Filter products, scatter products of the same brand, and auto-reshuffle every 20 seconds
  const filteredProducts = React.useMemo(() => {
    const matched = products.filter(p => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesSubCategory =
        selectedSubCategory === 'ALL' ||
        p.subCategory === selectedSubCategory ||
        (selectedSubCategory === 'Rum' &&
          (p.subCategory === 'White Rum' || p.subCategory === 'Spiced & Dark Rum')) ||
        (selectedSubCategory === 'Liqueur & Cream' &&
          p.subCategory === 'Cream Liqueur');
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery) ||
        (p.subCategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSubCategory && matchesSearch;
    });

    // 1. Separate priority items (actively pinned barcode scan or items in current cart)
    const priorityItems: Product[] = [];
    const regularItems: Product[] = [];

    matched.forEach(p => {
      const isPinned = lastPinnedPosScan?.product.id === p.id;
      const isInCart = cart.some(
        c => (c.product.id.includes('-vol-') ? c.product.id.split('-vol-')[0] : c.product.id) === p.id
      );
      if (isPinned || isInCart) {
        priorityItems.push(p);
      } else {
        regularItems.push(p);
      }
    });

    // Sort priority items so pinned comes first, then recent cart additions
    priorityItems.sort((a, b) => {
      const aPinned = lastPinnedPosScan?.product.id === a.id;
      const bPinned = lastPinnedPosScan?.product.id === b.id;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return 0;
    });

    // 2. Scatter regular items across brands so same-brand items are never clumped together,
    // and reshuffle them based on the 20-second rotation seed
    const scatteredRegular = scatterAndReshuffleProducts(regularItems, currentShuffleSeed);

    return [...priorityItems, ...scatteredRegular];
  }, [
    products,
    selectedCategory,
    selectedSubCategory,
    searchQuery,
    lastPinnedPosScan?.product.id,
    cart,
    currentShuffleSeed
  ]);

  // Calculate totals with strict separation between Company Sales (at Company Price) and Affiliate Profit
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalAffiliateMarkup = cart.reduce((sum, item) => sum + item.affiliateMarkupPerUnit * item.quantity, 0);
  const companyBaselineSubtotal = Math.max(0, subtotal - totalAffiliateMarkup);
  const vatAmount = Math.round((companyBaselineSubtotal - (companyBaselineSubtotal / 1.16)) * 100) / 100;

  // Cash change calculation
  const parsedCashTendered = parseFloat(cashTendered) || 0;
  const cashChange = parsedCashTendered > subtotal ? parsedCashTendered - subtotal : 0;

  // Split calculations
  const parsedSplitCash = parseFloat(splitCashAmount) || 0;
  const parsedSplitMpesa = parseFloat(splitMpesaAmount) || 0;
  const splitTotalPaid = parsedSplitCash + parsedSplitMpesa;
  const splitRemaining = subtotal > splitTotalPaid ? subtotal - splitTotalPaid : 0;

  // Audio beep feedback simulator
  const playBeep = (freq = 880, duration = 80) => {
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration / 1000);
      }
    } catch (e) {
      // Audio not supported or blocked
    }
  };

  // Kick cash drawer simulation — strictly only allowed for POS Cashier, never Sales Affiliated Lady
  const handleKickDrawer = useCallback(() => {
    if (!isPosCashier) return;
    playBeep(440, 200);
    setDrawerKickFeedback(`ESC/POS Drawer Kick Triggered (Station ${shiftState.stationId})`);
    setTimeout(() => setDrawerKickFeedback(null), 3000);
  }, [shiftState.stationId, isPosCashier]);

  useEffect(() => {
    const onNavKickDrawer = () => {
      if (!isPosCashier) return;
      handleKickDrawer();
    };
    const onNavOpenShiftDrawer = () => {
      if (!isPosCashier) return;
      setIsShiftModalOpen(true);
    };
    window.addEventListener('vaairo:kick-drawer', onNavKickDrawer);
    window.addEventListener('vaairo:open-shift-drawer', onNavOpenShiftDrawer);
    return () => {
      window.removeEventListener('vaairo:kick-drawer', onNavKickDrawer);
      window.removeEventListener('vaairo:open-shift-drawer', onNavOpenShiftDrawer);
    };
  }, [handleKickDrawer, isPosCashier]);

  // Handle quick barcode enter with smart auto-pinning to exact product
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (awaitingNextPosScan) return;
    const raw = barcodeInput.trim();
    if (!raw) return;

    const matchedProd = products.find(
      p =>
        p.barcode === raw ||
        p.caseBarcode === raw ||
        p.sku.toLowerCase() === raw.toLowerCase() ||
        (raw.length === 14 && raw.startsWith('1') && p.barcode === raw.substring(1))
    );

    if (matchedProd) {
      const isCaseScan =
        matchedProd.caseBarcode === raw ||
        (raw.length === 14 && raw.startsWith('1') && matchedProd.barcode === raw.substring(1));
      const qtyToAdd = isCaseScan ? matchedProd.packSize || 12 : 1;
      const baseProdId = matchedProd.id.includes('-vol-') ? matchedProd.id.split('-vol-')[0] : matchedProd.id;
      const branchInv = inventoryItems.find(i => i.productId === baseProdId && i.branchId === activeBranch.id);
      const fallbackInv = inventoryItems.find(i => i.productId === baseProdId && i.bottlesOnHand > 0);
      const inv = branchInv && branchInv.bottlesOnHand > 0 ? branchInv : fallbackInv || branchInv;
      const stock = inv ? inv.bottlesOnHand : 0;
      const existingInCart = cart
        .filter(c => (c.product.id.includes('-vol-') ? c.product.id.split('-vol-')[0] : c.product.id) === baseProdId)
        .reduce((s, c) => s + c.quantity, 0);

      if (stock <= 0 || existingInCart + qtyToAdd > stock) {
        setBarcodeFeedback(
          `⚠️ Insufficient Available Stock for ${matchedProd.name}: ${stock} btls on hand (${existingInCart} already in cart).`
        );
        showErrorFeedback(
          'Insufficient Stock',
          `${matchedProd.name} only has ${stock} btls on hand`,
          `Cart has ${existingInCart} already`
        );
        playBeep(300, 150);
      } else {
        addToCart(matchedProd, qtyToAdd, 0);
        playBeep(1200, 70);
        showSuccessFeedback(
          'Scanned & Added!',
          `${qtyToAdd} × ${matchedProd.name}`,
          `Code: ${raw} • Stock left: ${Math.max(0, stock - (existingInCart + qtyToAdd))}`
        );
        const remainingAfterCart = Math.max(0, stock - (existingInCart + qtyToAdd));
        setLastPinnedPosScan({
          product: matchedProd,
          scannedCode: raw,
          isCaseScan,
          qtyAdded: qtyToAdd,
          stockOnHand: stock,
          remainingAfterCart
        });
        setBarcodeFeedback(
          `✓ AUTO-PINNED [${raw}] → ${matchedProd.name} (+${qtyToAdd} btl${qtyToAdd > 1 ? 's' : ''} added to cart • ${remainingAfterCart} btls remaining after sale)`
        );
        setBarcodeInput('');
        setAwaitingNextPosScan(true);
      }
    } else {
      setBarcodeFeedback(`Unknown Barcode: "${raw}". Not pinned to any SKU in catalog.`);
      showErrorFeedback(
        'Unknown Barcode',
        `No SKU matches barcode "${raw}"`,
        'Use Manual Search or Onboard'
      );
      playBeep(250, 200);
    }

    setTimeout(() => setBarcodeFeedback(null), 5500);
  };

  // Branch affiliates & POS Cashiers
  const branchAffiliates = affiliates.filter(a => a.branchId === activeBranch.id);
  const branchPosCashiers = employees.filter(
    e => e.department === 'POS' && e.active && e.branchId === activeBranch.id
  );
  const allPosCashiers = employees.filter(e => e.department === 'POS' && e.active);
  const availablePosCashiers = branchPosCashiers.length > 0 ? branchPosCashiers : allPosCashiers;

  // Identify active Sales Representative profile (when logged in as Sales Representative or selected in POS)
  const activeSalesLadyAffiliate =
    selectedAffiliate ||
    affiliates.find(
      a =>
        a.id === currentUser.id ||
        a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    ) ||
    null;

  // All previous sales orders for the active Sales Representative
  const activeRepPreviousOrders = activeSalesLadyAffiliate
    ? orders
        .filter(
          o =>
            o.affiliateId === activeSalesLadyAffiliate.id ||
            (o.affiliateName &&
              o.affiliateName.toLowerCase() === activeSalesLadyAffiliate.name.toLowerCase()) ||
            (o.cashierName &&
              o.cashierName.toLowerCase() === activeSalesLadyAffiliate.name.toLowerCase())
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  // Specific POS Cashier where the Sales Lady is working under
  const workingUnderCashier =
    (selectedWorkingCashierId && allPosCashiers.find(c => c.id === selectedWorkingCashierId)) ||
    (activeSalesLadyAffiliate?.assignedCashierId &&
      allPosCashiers.find(c => c.id === activeSalesLadyAffiliate.assignedCashierId)) ||
    (activeSalesLadyAffiliate?.assignedCashierName &&
      allPosCashiers.find(
        c =>
          c.name.trim().toLowerCase() ===
          activeSalesLadyAffiliate.assignedCashierName!.trim().toLowerCase()
      )) ||
    availablePosCashiers[0] ||
    null;

  // Identify the currently logged-in POS Cashier (when in Counter Cashier mode)
  const loggedInCashierEmployee =
    allPosCashiers.find(
      c =>
        c.id === currentUser.id ||
        c.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    ) || null;

  const activeCounterCashierId = loggedInCashierEmployee?.id || currentUser.id;
  const activeCounterCashierName = (loggedInCashierEmployee?.name || currentUser.name || '').trim();

  // Collection Queue for Counter Cashier: shows orders from Sales Reps (assigned to this cashier or all branch rep orders)
  const allBranchSalesRepHeldCarts = heldCarts.filter(h => h.branchId === activeBranch.id);

  const branchHeldCarts = heldCarts.filter(h => {
    if (h.branchId !== activeBranch.id) return false;

    // Collection Queue does NOT show on the Sales Lady's POS screen
    if (posStationMode === 'SALES_LADY') return false;

    if (filterRepIdForOrders !== 'ALL') {
      const matchesRep =
        h.affiliateId === filterRepIdForOrders ||
        affiliates.find(a => a.id === filterRepIdForOrders)?.name.trim().toLowerCase() ===
          (h.affiliateName || h.heldByName || '').trim().toLowerCase();
      if (!matchesRep) return false;
    }

    if (showAllBranchRepOrders) {
      return true;
    }

    // Look up the Sales Lady who submitted the order to check which POS Cashier she works under
    const orderSalesLady = affiliates.find(
      a =>
        (h.affiliateId && a.id === h.affiliateId) ||
        (h.affiliateName &&
          a.name.trim().toLowerCase() === h.affiliateName.trim().toLowerCase()) ||
        a.name.trim().toLowerCase() === h.heldByName.trim().toLowerCase()
    );

    const targetCashierId = h.targetCashierId || orderSalesLady?.assignedCashierId;
    const targetCashierName = h.targetCashierName || orderSalesLady?.assignedCashierName;

    // If the order (or its Sales Lady) is assigned to a specific POS Cashier, ONLY show it on that specific POS Cashier
    if (targetCashierId || targetCashierName) {
      const matchesById = Boolean(
        targetCashierId &&
          (targetCashierId === activeCounterCashierId ||
            (loggedInCashierEmployee && targetCashierId === loggedInCashierEmployee.id))
      );
      const matchesByName = Boolean(
        targetCashierName &&
          targetCashierName.trim().toLowerCase() === activeCounterCashierName.toLowerCase()
      );
      return matchesById || matchesByName;
    }

    // Unassigned orders or orders placed on hold by this Counter Cashier are always visible
    return true;
  });

  const readyForCollectionCount = branchHeldCarts.filter(
    h => h.queueStatus === 'READY_FOR_COLLECTION'
  ).length;
  const pendingPrepCount = branchHeldCarts.filter(
    h => !h.queueStatus || h.queueStatus === 'QUEUED_AT_COUNTER' || h.queueStatus === 'PREPARING_DRINKS'
  ).length;

  // Put current cart on hold (Counter Cashier)
  const handlePutCartOnHold = () => {
    if (cart.length === 0) return;
    const held = holdCurrentCart({
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerKraPin: customerKraPin.trim() || undefined,
      note: holdNote.trim() || undefined,
      submittedByRole: posStationMode,
      queueStatus: 'ON_HOLD_PENDING_PAYMENT',
      paymentOption: 'PAY_ON_COLLECTION',
      targetCashierId: activeCounterCashierId,
      targetCashierName: activeCounterCashierName
    });
    if (held) {
      playBeep(660, 110);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerKraPin('');
      setHoldNote('');
      setCashTendered('');
      setSplitCashAmount('');
      setSplitMpesaAmount('');
      setCheckoutError(null);
      setHoldFeedback(`Order placed on hold (${held.holdNumber} • Pending Payment) by ${currentUser.name}`);
      setTimeout(() => setHoldFeedback(null), 4500);
    }
  };

  // Sales Affiliate Lady: Submit picked customer order to the specific POS Cashier she is working under
  // Option 1: 'PAY_ON_COLLECTION' -> Goes to her assigned POS Cashier's queue to prepare drinks ready for collection
  // Option 2: 'PRINT_RECEIPT_AND_HOLD' -> Prints 80mm thermal receipt & puts order on hold at her assigned POS Cashier for pending payment
  const handleSalesLadySubmitToQueue = (option: 'PAY_ON_COLLECTION' | 'PRINT_RECEIPT_AND_HOLD') => {
    if (cart.length === 0) return;
    const isPrintAndHold = option === 'PRINT_RECEIPT_AND_HOLD';
    const targetCashierId =
      posStationMode === 'SALES_LADY'
        ? workingUnderCashier?.id || activeSalesLadyAffiliate?.assignedCashierId
        : activeCounterCashierId;
    const targetCashierName =
      posStationMode === 'SALES_LADY'
        ? workingUnderCashier?.name || activeSalesLadyAffiliate?.assignedCashierName || 'Assigned POS Cashier'
        : activeCounterCashierName;

    const queuedOrder = holdCurrentCart({
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerKraPin: customerKraPin.trim() || undefined,
      note:
        holdNote.trim() ||
        (isPrintAndHold
          ? 'Thermal Receipt Printed • On Hold for Pending Payment'
          : 'Pay on Collection at Counter'),
      submittedByRole: posStationMode,
      queueStatus: isPrintAndHold ? 'ON_HOLD_PENDING_PAYMENT' : 'QUEUED_AT_COUNTER',
      paymentOption: option,
      receiptPrinted: isPrintAndHold,
      targetCashierId,
      targetCashierName
    });

    if (queuedOrder) {
      playBeep(isPrintAndHold ? 1180 : 920, 130);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerKraPin('');
      setHoldNote('');
      setCashTendered('');
      setSplitCashAmount('');
      setSplitMpesaAmount('');
      setCheckoutError(null);

      if (isPrintAndHold) {
        setPrintingQueueTicket(queuedOrder);
        setHoldFeedback(
          `✓ Order ${queuedOrder.holdNumber} sent to POS Cashier ${targetCashierName}'s Queue ON HOLD (Pending Payment) & 80mm Thermal Receipt opened!`
        );
      } else {
        setHoldFeedback(
          `✓ Order ${queuedOrder.holdNumber} sent to POS Cashier ${targetCashierName}'s Collection Queue (Pay on Collection)!`
        );
      }
      if (posStationMode === 'COUNTER_CASHIER') {
        setIsHeldCartsOpen(true);
      } else {
        setIsHeldCartsOpen(false);
      }
      setTimeout(() => setHoldFeedback(null), 5000);
    }
  };

  // Recall a held cart back to active cart
  const handleRecallCart = (holdId: string) => {
    // If current cart has items, automatically put it on hold first so no items are lost
    if (cart.length > 0) {
      holdCurrentCart({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerKraPin: customerKraPin.trim() || undefined,
        note: 'Auto-held on recall'
      });
    }
    const recalled = recallHeldCart(holdId);
    if (recalled) {
      playBeep(1040, 90);
      setCustomerName(recalled.customerName || '');
      setCustomerPhone(recalled.customerPhone || '');
      setCustomerKraPin(recalled.customerKraPin || '');
      setHoldNote(recalled.note || '');
      setIsHeldCartsOpen(false);
      setMobilePosTab('CHECKOUT');
      if (recalled.affiliateId || recalled.affiliateName) {
        setCounterCashierSaleMode('RECEIVE_REP_ORDERS');
        setHoldFeedback(
          `Received Order ${recalled.holdNumber} from Sales Rep ${recalled.affiliateName || recalled.heldByName} (${recalled.items.length} items) into Counter Checkout`
        );
      } else {
        setCounterCashierSaleMode('DIRECT_SALE');
        setHoldFeedback(`Recalled ${recalled.holdNumber} (${recalled.items.length} items) to active cart`);
      }
      setTimeout(() => setHoldFeedback(null), 4000);
    }
  };

  // Complete checkout
  const handleCheckout = async () => {
    setCheckoutError(null);

    if (isWarehouse) {
      setCheckoutError('Cannot complete checkout: Active branch is a Central Warehouse (Storage Only).');
      return;
    }

    if (isWholesaleStore && minThreshold > 0 && subtotal < minThreshold) {
      setCheckoutError(`Minimum Wholesale Threshold of ${formatKes(minThreshold)} not reached. Current order total is ${formatKes(subtotal)}.`);
      return;
    }

    if (paymentMethod === 'CASH' && parsedCashTendered > 0 && parsedCashTendered < subtotal) {
      setCheckoutError(`Insufficient Cash Tendered: Cashier received ${formatKes(parsedCashTendered)}, but total is ${formatKes(subtotal)}.`);
      return;
    }

    if (paymentMethod === 'SPLIT' && splitRemaining > 0) {
      setCheckoutError(`Split Payment Incomplete: ${formatKes(splitRemaining)} balance remains unpaid.`);
      return;
    }

    // Step 4: Production Safaricom Daraja M-Pesa STK Push & Verification (no simulation)
    let resolvedCheckoutRequestId = posCheckoutRequestId || undefined;
    const cleanReceipt = posMpesaReceiptInput.trim().toUpperCase();

    if (paymentMethod === 'MPESA') {
      const posCarrier = detectKenyanMobileCarrier(customerPhone);
      if (!posCarrier.isValid && cleanReceipt.length < 6) {
        const msg =
          'Please enter a valid 10-digit Kenyan Safaricom/Airtel mobile number for STK Push or enter a verified M-Pesa Receipt Code.';
        setCheckoutError(msg);
        showErrorFeedback('M-Pesa Number Required', msg);
        return;
      }

      if (!resolvedCheckoutRequestId && cleanReceipt.length < 6) {
        setIsProcessingStk(true);
        const targetPhone = posCarrier.normalized254 || customerPhone.trim();
        setStkStatusMessage(`Dispatching Safaricom Daraja STK Push to ${posCarrier.formattedDisplay || targetPhone}...`);

        try {
          const stkRes = await fetch('/api/mpesa/stk-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              phone: targetPhone,
              amount: subtotal,
              orderNumber: `POS-${Date.now()}`,
              accountReference: `POS-${activeBranch.code}`,
              transactionDesc: `VAAIRO POS ${activeBranch.code}`,
              branchId: activeBranch.id,
              items: cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity
              }))
            })
          });
          const stkData = await stkRes.json().catch(() => ({}));
          if (!stkRes.ok || !stkData.success) {
            setIsProcessingStk(false);
            const errMsg =
              stkData.error ||
              'Safaricom Daraja STK Push could not be dispatched. Verify Daraja API credentials or enter customer M-Pesa receipt code.';
            setCheckoutError(errMsg);
            showErrorFeedback('Daraja Gateway Alert', errMsg);
            return;
          }

          resolvedCheckoutRequestId = String(stkData.checkoutRequestId || '');
          setPosCheckoutRequestId(resolvedCheckoutRequestId);
          setStkStatusMessage(
            stkData.customerMessage ||
              `STK Push sent (${resolvedCheckoutRequestId}). Awaiting customer PIN on handset...`
          );
          showSuccessFeedback(
            'STK Push Sent',
            `Prompt sent to ${posCarrier.formattedDisplay || targetPhone}`,
            formatKes(subtotal)
          );
          // Fade off the STK status prompt immediately after it has shown
          await new Promise(r => setTimeout(r, 480));
          setIsProcessingStk(false);
        } catch {
          setIsProcessingStk(false);
          const errMsg = 'Unable to reach Safaricom Daraja STK Push server endpoint (/api/mpesa/stk-push).';
          setCheckoutError(errMsg);
          showErrorFeedback('Connection Error', errMsg);
          return;
        }
      }
    }

    // Explicitly wire the relationship between Cashier and Salesperson
    let saleCashierId = activeCounterCashierId;
    let saleCashierName = activeCounterCashierName || currentUser.name;
    let salePersonId: string | undefined = undefined;
    let salePersonName: string | undefined = undefined;
    let saleCheckoutRole: 'SALES_REP_SELF_CHECKOUT' | 'COUNTER_CASHIER_DIRECT' | 'COUNTER_CASHIER_REP_RECALL' = 'COUNTER_CASHIER_DIRECT';

    if (posStationMode === 'SALES_LADY') {
      // 1. SALES PERSON SELF-CHECKOUT: Cashout by themselves without queueing to cashier
      salePersonId = activeSalesLadyAffiliate?.id || currentUser.id;
      salePersonName = activeSalesLadyAffiliate?.name || currentUser.name;
      saleCashierId = currentUser.id;
      saleCashierName = `${salePersonName} (Direct Self-Checkout)`;
      saleCheckoutRole = 'SALES_REP_SELF_CHECKOUT';
    } else {
      // 2. COUNTER CASHIER CHECKOUT:
      // Can checkout sales made directly from counter OR checkout orders received from sales reps
      if (recalledSalesPerson || selectedAffiliate) {
        salePersonId = recalledSalesPerson?.id || selectedAffiliate?.id;
        salePersonName = recalledSalesPerson?.name || selectedAffiliate?.name;
        saleCheckoutRole = 'COUNTER_CASHIER_REP_RECALL';
      } else {
        saleCheckoutRole = 'COUNTER_CASHIER_DIRECT';
      }
    }

    // Fire sale into ERP Context (verifies Daraja transaction via /api/mpesa/verify before committing)
    const res = await completeSale({
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerKraPin: customerKraPin.trim() || undefined,
      paymentMethod,
      mpesaPhone: customerPhone.trim() || undefined,
      mpesaReceiptNumber: cleanReceipt || undefined,
      checkoutRequestId: resolvedCheckoutRequestId,
      servedByName: posStationMode === 'SALES_LADY' ? salePersonName : saleCashierName,
      cashierId: saleCashierId,
      cashierName: saleCashierName,
      salesPersonId: salePersonId,
      salesPersonName: salePersonName,
      checkoutRole: saleCheckoutRole
    });

    if (!res.success) {
      setCheckoutError(res.error || 'Sale failed.');
      showErrorFeedback('Sale Failed', res.error || 'Transaction could not be completed');
    } else {
      playBeep(1760, 150);
      showSuccessFeedback(
        'Sale Completed!',
        `Order #${res.order?.orderNumber || 'COMPLETED'} recorded`,
        formatKes(res.order?.totalKes ?? subtotal)
      );

      // Update cash in drawer if cash was paid
      if (paymentMethod === 'CASH' || paymentMethod === 'SPLIT') {
        const cashAmountAdded = paymentMethod === 'CASH' ? subtotal : parsedSplitCash;
        setShiftState(prev => {
          const updated = {
            ...prev,
            cashSalesKes: prev.cashSalesKes + cashAmountAdded,
            expectedCashKes: prev.openingFloatKes + prev.cashSalesKes + cashAmountAdded
          };
          localStorage.setItem(`vaairo_shift_${activeBranch.id}`, JSON.stringify(updated));
          return updated;
        });
        handleKickDrawer();
      }

      const generatedOrderNum = res.order?.orderNumber || `ORD-${Date.now().toString().slice(-4)}`;
      const generatedEtims = res.invoice?.invoiceNumber || `VAT-INV-${Date.now().toString().slice(-5)}`;
      const glVoucher = `JV-2026-${Date.now().toString().slice(-4)}`;

      const soldItemsSummary = (res.order?.items || []).map(it => ({
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        stockBeforeSale: it.stockBeforeSale ?? 0,
        stockAfterSale: it.stockAfterSale ?? 0,
        assetValueDeductedKes: it.assetValueDeductedKes ?? 0
      }));
      const totalAssetDeductedKes = soldItemsSummary.reduce(
        (sum, it) => sum + (it.assetValueDeductedKes || 0),
        0
      );

      setLastAuditNotice({
        orderNumber: generatedOrderNum,
        totalKes: res.order?.totalKes ?? subtotal,
        companySalesKes: res.order?.companySalesKes ?? companyBaselineSubtotal,
        affiliateProfitKes: res.order?.affiliateMarkupTotalKes ?? totalAffiliateMarkup,
        affiliateBaseCommKes: res.order?.affiliateBaseCommissionKes ?? 0,
        affiliateTotalEarnedKes: res.order?.affiliateTotalEarnedKes ?? totalAffiliateMarkup,
        affiliateName: res.order?.affiliateName,
        etimsNumber: generatedEtims,
        glVoucher,
        itemsSold: soldItemsSummary,
        totalAssetDeductedKes
      });
      setLastPinnedPosScan(null);

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerKraPin('');
      setCashTendered('');
      setSplitCashAmount('');
      setSplitMpesaAmount('');
      setPosMpesaReceiptInput('');
      setPosCheckoutRequestId(null);
      setCheckoutError(null);
      setMobilePosTab('CATALOG');
    }
  };

  const lastOrder = orders.find(o => o.etimsInvoiceNumber === lastCompletedInvoice?.invoiceNumber);
  const totalCartUnits = cart.reduce((acc, i) => acc + i.quantity, 0);

  const handleOpenPosPrompt = useCallback(() => {
    if (cart.length === 0) {
      showErrorFeedback('Empty Cart', 'Add at least one drink to the cart before sending a payment prompt.');
      return;
    }
    setPaymentMethod('MPESA');
    setPromptModalError(null);
    setPromptModalSuccess(null);
    setIsPromptModalOpen(true);
  }, [cart.length, showErrorFeedback]);

  const handleDispatchStkPromptFromModal = async (autoCompleteCheckout = false) => {
    setPromptModalError(null);
    setPromptModalSuccess(null);
    if (cart.length === 0) {
      setPromptModalError('Cart is empty. Add items before sending an M-Pesa STK Prompt.');
      return;
    }
    const posCarrier = detectKenyanMobileCarrier(customerPhone);
    if (!posCarrier.isValid) {
      const msg = 'Enter a valid 10-digit Kenyan mobile number (e.g. 0712345678 or 0733123456) to send the STK Prompt.';
      setPromptModalError(msg);
      showErrorFeedback('Phone Number Required', msg);
      return;
    }

    setPaymentMethod('MPESA');
    setIsProcessingStk(true);
    const targetPhone = posCarrier.normalized254 || customerPhone.trim();
    setStkStatusMessage(`Sending M-Pesa STK Prompt (${formatKes(subtotal)}) to ${posCarrier.formattedDisplay || targetPhone}...`);

    try {
      const stkRes = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          phone: targetPhone,
          amount: subtotal,
          orderNumber: `POS-${Date.now()}`,
          accountReference: `POS-${activeBranch.code}`,
          transactionDesc: `VAAIRO POS ${activeBranch.code}`,
          branchId: activeBranch.id,
          items: cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        })
      });
      const stkData = await stkRes.json().catch(() => ({}));
      if (!stkRes.ok || !stkData.success) {
        setIsProcessingStk(false);
        const errMsg =
          stkData.error ||
          'Safaricom Daraja STK Push could not be dispatched. Verify Daraja credentials or enter customer M-Pesa receipt code.';
        setPromptModalError(errMsg);
        setCheckoutError(errMsg);
        showErrorFeedback('Daraja Gateway Alert', errMsg);
        return;
      }

      const reqId = String(stkData.checkoutRequestId || '');
      setPosCheckoutRequestId(reqId);
      const okMsg =
        stkData.customerMessage ||
        `STK Push Prompt sent (${reqId}) to ${posCarrier.formattedDisplay || targetPhone} for ${formatKes(subtotal)}.`;
      setStkStatusMessage(okMsg);
      setPromptModalSuccess(okMsg);
      showSuccessFeedback(
        'STK Prompt Sent',
        `Prompt dispatched to ${posCarrier.formattedDisplay || targetPhone}`,
        formatKes(subtotal)
      );
      await new Promise(r => setTimeout(r, 480));
      setIsProcessingStk(false);

      if (autoCompleteCheckout) {
        setIsPromptModalOpen(false);
        await handleCheckout();
      }
    } catch {
      setIsProcessingStk(false);
      const errMsg = 'Unable to reach Safaricom Daraja STK Push endpoint (/api/mpesa/stk-push).';
      setPromptModalError(errMsg);
      setCheckoutError(errMsg);
      showErrorFeedback('Connection Error', errMsg);
    }
  };

  useEffect(() => {
    const onBottomNavPrompt = () => {
      handleOpenPosPrompt();
    };
    const onBottomNavCheckout = () => {
      if (cart.length === 0) {
        showErrorFeedback('Empty Cart', 'Add items to cart before checking out.');
        return;
      }
      if (typeof window !== 'undefined' && window.innerWidth < 1024 && mobilePosTab !== 'CHECKOUT') {
        setMobilePosTab('CHECKOUT');
      }
      void handleCheckout();
    };
    window.addEventListener('vaairo:pos-prompt', onBottomNavPrompt);
    window.addEventListener('vaairo:pos-checkout', onBottomNavCheckout);
    return () => {
      window.removeEventListener('vaairo:pos-prompt', onBottomNavPrompt);
      window.removeEventListener('vaairo:pos-checkout', onBottomNavCheckout);
    };
  }, [cart.length, handleOpenPosPrompt, mobilePosTab, posStationMode, showErrorFeedback]);

  return (
    <div className="space-y-3 sm:space-y-5 pb-28 lg:pb-4">
      {/* MOBILE APP STICKY HEADER & TAB SWITCHER (< lg) */}
      <div className="lg:hidden sticky top-0 z-30 -mx-1 px-2 pt-1.5 pb-2 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs space-y-2 rounded-b-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-xs shrink-0 shadow-2xs">
              POS
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-montserrat font-black text-xs text-slate-900 truncate">
                  {activeBranch.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#0A006E]/10 text-[#0A006E] font-mono font-bold text-[9px] shrink-0">
                  {posStationMode === 'SALES_LADY' ? 'Sales Rep' : 'Cashier'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                Served by: <strong className="text-[#0A006E]">{currentUser.name}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="h-8 px-2.5 rounded-xl bg-slate-100 active:bg-slate-200 text-[#0A006E] border border-slate-200 font-montserrat font-bold text-[10px] flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>Scan</span>
            </button>
            <button
              type="button"
              onClick={() => openStaffPinPrompt()}
              className="h-8 px-2.5 rounded-xl bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/25 font-montserrat font-black text-[10px] flex items-center gap-1 shadow-2xs"
            >
              <Lock className="w-3 h-3" />
              <span>PIN</span>
            </button>
          </div>
        </div>

        {/* Segmented App Bar Tabs: 1. Catalog | 2. Queue (if Counter Cashier) | 3. Cart & Checkout */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMobilePosTab('CATALOG')}
            className={`py-2 px-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1 ${
              mobilePosTab === 'CATALOG'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Drinks ({filteredProducts.length})</span>
          </button>

          {posStationMode === 'COUNTER_CASHIER' ? (
            <button
              type="button"
              onClick={() => {
                setMobilePosTab('QUEUE');
                setCounterCashierSaleMode('RECEIVE_REP_ORDERS');
              }}
              className={`py-2 px-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1 relative ${
                mobilePosTab === 'QUEUE'
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Queue ({branchHeldCarts.length})</span>
              {branchHeldCarts.length > 0 && mobilePosTab !== 'QUEUE' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute top-1.5 right-1.5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRepHistoryPeriod('ALL');
                setRepHistorySearch('');
                setIsRepHistoryModalOpen(true);
              }}
              className="py-2 px-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900"
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sales ({activeRepPreviousOrders.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobilePosTab('CHECKOUT')}
            className={`py-2 px-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1 ${
              mobilePosTab === 'CHECKOUT'
                ? 'bg-[#34D186] text-[#FFDE00] shadow-xs'
                : cart.length > 0
                ? 'bg-[#FFDE00] text-[#0A006E]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cart ({totalCartUnits})</span>
          </button>
        </div>
      </div>
      {drawerKickFeedback && isPosCashier && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-montserrat font-bold text-amber-900 flex items-center gap-2 animate-in fade-in">
          <KeyRound className="w-4 h-4 text-amber-600 animate-bounce" />
          <span>{drawerKickFeedback}</span>
        </div>
      )}

      {/* Real-time Double-Entry & After-Sales Profit Separation Audit Notice */}
      {lastAuditNotice && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-xs text-[#1E9E60] flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#1E9E60] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-montserrat font-black text-sm">
                After-Sales Separation Complete: Order #{lastAuditNotice.orderNumber} (Gross Paid: {formatKes(lastAuditNotice.totalKes)})
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono font-bold text-[#0A006E]">
                  Company Sales (Company Price): {formatKes(lastAuditNotice.companySalesKes)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#34D186] text-[#FFDE00] font-mono font-black">
                  Separated Affiliate Profit: +{formatKes(lastAuditNotice.affiliateProfitKes)}
                </span>
                {lastAuditNotice.affiliateBaseCommKes > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#1E9E60] font-mono font-bold">
                    Base Commission: +{formatKes(lastAuditNotice.affiliateBaseCommKes)}
                  </span>
                )}
                {lastAuditNotice.affiliateTotalEarnedKes > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-montserrat font-black">
                    {lastAuditNotice.affiliateName || 'Sales Affiliate'} Earned: {formatKes(lastAuditNotice.affiliateTotalEarnedKes)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                • <strong>Company Revenue Protected:</strong> Only Company Price ({formatKes(lastAuditNotice.companySalesKes)}) is booked to Company Sales. Affiliate Profit ({formatKes(lastAuditNotice.affiliateTotalEarnedKes)}) is separated into Account 2045 for affiliate payout.<br />
                • <strong>16% VAT Enforcement:</strong> {lastAuditNotice.etimsNumber} recorded in Output VAT (16%) Tax Ledger.
              </p>

              {/* Live Proof of Stock Subtraction & Asset Cost Deduction per Item Sold */}
              {lastAuditNotice.itemsSold && lastAuditNotice.itemsSold.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-300/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#1E9E60] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#1E9E60]" />
                      <span>Verified Live Stock Subtraction &amp; Asset Deduction ({activeBranch.name})</span>
                    </span>
                    {typeof lastAuditNotice.totalAssetDeductedKes === 'number' && lastAuditNotice.totalAssetDeductedKes > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[10px]">
                        Inventory Asset Reduced: -{formatKes(lastAuditNotice.totalAssetDeductedKes)} (Moved to COGS)
                      </span>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-emerald-100/70 text-[#1E9E60] font-montserrat font-black text-[9px] uppercase">
                          <th className="py-1.5 px-2.5">Product Sold</th>
                          <th className="py-1.5 px-2 text-right">Stock Before</th>
                          <th className="py-1.5 px-2 text-right">Subtracted</th>
                          <th className="py-1.5 px-2 text-right">Available Now</th>
                          <th className="py-1.5 px-2.5 text-right">Asset Value Deducted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {lastAuditNotice.itemsSold.map((it, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900">
                              {it.productName}
                              {it.sku && <span className="ml-1.5 text-[9px] font-mono text-slate-400">({it.sku})</span>}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-600">
                              {it.stockBeforeSale} btls
                            </td>
                            <td className="py-1.5 px-2 text-right font-black text-red-600">
                              -{it.quantity} btls
                            </td>
                            <td className="py-1.5 px-2 text-right font-black text-[#1E9E60] bg-emerald-50/60">
                              {it.stockAfterSale} btls left
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-[#0A006E]">
                              -{formatKes(it.assetValueDeductedKes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setLastAuditNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Warehouse Direct Sales Prohibition */}
      {isWarehouse && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex items-start space-x-3 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-montserrat font-black text-amber-950 uppercase tracking-wide">
              Warehouse Storage Mode Active:
            </span>{' '}
            Branch <strong className="underline">{activeBranch.name}</strong> is classified as a Tier 1 Central Warehouse.
            Direct counter sales and retail checkouts are disabled in accordance with the 4-tier distribution hierarchy. Use{' '}
            <strong className="text-amber-950">Procurement &amp; Restock</strong> to fulfill requisitions from Main Stores.
          </div>
        </div>
      )}

      {/* Main Store Wholesale Threshold Notice */}
      {isWholesaleStore && minThreshold > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
          <div className="flex items-center space-x-2">
            <span className="font-montserrat font-black bg-[#0A006E] text-white px-2 py-0.5 rounded text-[10px]">
              WHOLESALE TIER
            </span>
            <span>
              Minimum Wholesale Purchase Threshold: <strong className="font-bold text-[#0A006E]">{formatKes(minThreshold)}</strong>
            </span>
          </div>
          <span className={`font-montserrat font-bold px-2.5 py-1 rounded-lg ${
            subtotal >= minThreshold ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
          }`}>
            Current Cart: {formatKes(subtotal)} ({subtotal >= minThreshold ? '✓ WHOLESALE PRICING APPLIED' : 'BELOW THRESHOLD'})
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        
        {/* Left Column: Role Station Bar, Live Counter Order Queue, Product Catalog & Barcode Lookup (7 Cols) */}
        <div className={`lg:col-span-7 space-y-3.5 sm:space-y-4 ${mobilePosTab === 'CHECKOUT' ? 'hidden lg:block' : 'block'}`}>
          {/* Two-Role POS Station Switcher & Counter Order Queue Status Banner */}
          <div className={`bg-white rounded-2xl border-2 border-[#0A006E]/15 p-3.5 sm:p-4 shadow-xs space-y-3.5 ${mobilePosTab === 'CATALOG' ? 'hidden sm:block' : 'block'}`}>
            {/* Top Row: Mode Badge + Cashier Title/Subtitle on Left, Station Switcher on Right */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center text-[10px] font-montserrat font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] shrink-0">
                    {posStationMode === 'SALES_LADY' ? 'Sales Representative Mode' : 'Counter Cashier Mode'}
                  </span>
                  <span className="text-xs sm:text-sm font-montserrat font-black text-slate-900 truncate">
                    {posStationMode === 'SALES_LADY'
                      ? `Working under POS Cashier: ${
                          workingUnderCashier?.name ||
                          activeSalesLadyAffiliate?.assignedCashierName ||
                          'Counter Cashier'
                        }`
                      : `POS Cashier Counter: ${activeCounterCashierName}`}
                  </span>
                </div>
                <p className="text-[11px] font-montserrat font-semibold text-slate-500 leading-snug">
                  {posStationMode === 'SALES_LADY'
                    ? 'Pick customer drinks at preferred price and send orders to your assigned POS Cashier queue'
                    : 'Sell Directly at Counter or Receive Orders from Sales Reps'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-start xl:justify-end gap-2 shrink-0">
                {activeSalesLadyAffiliate && (
                  <button
                    type="button"
                    onClick={() => {
                      setRepHistoryPeriod('ALL');
                      setRepHistorySearch('');
                      setIsRepHistoryModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#FFDE00] hover:bg-yellow-300 text-[#0A006E] border border-[#0A006E]/30 text-[11px] font-montserrat font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span>Previous Sales Records ({activeRepPreviousOrders.length})</span>
                  </button>
                )}

                {/* Station Mode Switcher Pills */}
                <div className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setPosStationMode('COUNTER_CASHIER')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        posStationMode === 'COUNTER_CASHIER'
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Counter Cashier ({branchHeldCarts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosStationMode('SALES_LADY')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        posStationMode === 'SALES_LADY'
                          ? 'bg-[#34D186] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Sales Representative</span>
                    </button>
                  </div>
              </div>
            </div>

            {/* Sales Lady Direct Self-Checkout & Optional Counter Queue Bar */}
            {posStationMode === 'SALES_LADY' && (
              <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/90 p-3 rounded-xl border border-emerald-300">
                <div className="text-[11px] font-montserrat font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span>
                    <strong className="text-[#0A006E] font-black uppercase">Direct Self-Checkout Active: </strong>
                    <span>You can cash out sales directly and issue customer receipts instantly, or optionally queue orders to counter cashier for collection.</span>
                  </span>
                </div>
                {availablePosCashiers.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500 font-semibold">Optional Counter Queue:</span>
                    <select
                      value={
                        workingUnderCashier?.id ||
                        activeSalesLadyAffiliate?.assignedCashierId ||
                        ''
                      }
                      onChange={(e) => {
                        const chosen = allPosCashiers.find(c => c.id === e.target.value);
                        setSelectedWorkingCashierId(e.target.value);
                        if (chosen && activeSalesLadyAffiliate) {
                          updateAffiliateAssignedCashier(
                            activeSalesLadyAffiliate.id,
                            chosen.id,
                            chosen.name
                          );
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white border border-[#0A006E]/30 rounded-lg text-xs font-montserrat font-bold text-[#0A006E] shrink-0"
                    >
                      {availablePosCashiers.map(cashier => (
                        <option key={cashier.id} value={cashier.id}>
                          POS Cashier: {cashier.name} ({cashier.employeeNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Counter Cashier Dual-Workflow Switcher: 1. Sell Directly vs 2. Receive Orders from Sales Reps */}
            {posStationMode === 'COUNTER_CASHIER' && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#0A006E] flex items-center gap-1.5 shrink-0">
                      <Layers className="w-3.5 h-3.5 text-[#0A006E]" />
                      <span>Cashier Mode</span>
                    </span>

                    {counterCashierSaleMode === 'DIRECT_SALE' ? (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-montserrat font-bold text-[#1E9E60]">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 whitespace-nowrap">
                          ✓ Direct Counter Checkout Active (Standard Company Prices)
                        </span>
                        {allBranchSalesRepHeldCarts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCounterCashierSaleMode('RECEIVE_REP_ORDERS')}
                            className="px-2.5 py-1 rounded-lg bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/30 font-black animate-pulse cursor-pointer whitespace-nowrap"
                          >
                            {allBranchSalesRepHeldCarts.length} Rep Order{allBranchSalesRepHeldCarts.length > 1 ? 's' : ''} Waiting →
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={filterRepIdForOrders}
                          onChange={(e) => setFilterRepIdForOrders(e.target.value)}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-montserrat font-bold text-slate-800"
                        >
                          <option value="ALL">All Sales Representatives</option>
                          {(branchAffiliates.length > 0 ? branchAffiliates : affiliates).map(rep => (
                            <option key={rep.id} value={rep.id}>
                              {rep.name} ({rep.code})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAllBranchRepOrders(prev => !prev)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-montserrat font-black border transition cursor-pointer whitespace-nowrap ${
                            showAllBranchRepOrders
                              ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {showAllBranchRepOrders ? 'Showing All Branch Orders' : 'Assigned to Me Only'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setCounterCashierSaleMode('DIRECT_SALE');
                        setSelectedAffiliate(null);
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        counterCashierSaleMode === 'DIRECT_SALE'
                          ? 'bg-[#34D186] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">1. Sell Directly (Walk-In Customer)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCounterCashierSaleMode('RECEIVE_REP_ORDERS');
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-[11px] font-montserrat font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        counterCashierSaleMode === 'RECEIVE_REP_ORDERS'
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">2. Receive Orders from Sales Reps ({allBranchSalesRepHeldCarts.length})</span>
                    </button>
                  </div>
                </div>

                {/* Live Counter Order Queue & Drink Preparation Strip — Shown when in RECEIVE_REP_ORDERS mode OR when orders are waiting */}
                {(counterCashierSaleMode === 'RECEIVE_REP_ORDERS' || branchHeldCarts.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-montserrat font-black uppercase text-[#0A006E] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {`Incoming Orders from Sales Representatives (${branchHeldCarts.length})`}
                          </span>
                        </span>
                        {readyForCollectionCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-[10px] font-montserrat font-black animate-pulse">
                            {readyForCollectionCount} Ready for Collection!
                          </span>
                        )}
                        {pendingPrepCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-montserrat font-black">
                            {pendingPrepCount} Awaiting Cashier Prep
                          </span>
                        )}
                      </div>

                      {/* Quick Ring-Up Order on Behalf of a Sales Rep */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-montserrat font-bold text-slate-500">
                          Or ring up order for Rep:
                        </span>
                        <select
                          value={activeSalesLadyAffiliate?.id || ''}
                          onChange={(e) => {
                            const aff = affiliates.find(a => a.id === e.target.value) || null;
                            setSelectedAffiliate(aff);
                          }}
                          className="px-2 py-1 bg-white border border-[#0A006E]/30 rounded-lg text-[11px] font-montserrat font-bold text-[#0A006E]"
                        >
                          <option value="">Select Sales Rep...</option>
                          {(branchAffiliates.length > 0 ? branchAffiliates : affiliates).map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {branchHeldCarts.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1">
                        <p className="text-xs font-montserrat font-black text-slate-700">
                          No Queued Orders from Sales Representatives Right Now
                        </p>
                        <p className="text-[11px] text-slate-500">
                          When a Sales Representative submits an order from their terminal, it will appear here immediately for you to prepare drinks and collect payment — or select a Sales Rep above to ring up their order directly.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {branchHeldCarts.map((ticket) => {
                          const status = ticket.queueStatus || 'QUEUED_AT_COUNTER';
                          const isReady = status === 'READY_FOR_COLLECTION';
                          const isPreparing = status === 'PREPARING_DRINKS';
                          const isOnHoldPending = status === 'ON_HOLD_PENDING_PAYMENT';

                          return (
                            <div
                              key={ticket.id}
                              className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                                isReady
                                  ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-xs'
                                  : isPreparing
                                  ? 'bg-blue-50/70 border-2 border-[#0A006E]'
                                  : isOnHoldPending
                                  ? 'bg-amber-50/80 border border-amber-300'
                                  : 'bg-slate-50 border border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-xs text-[#0A006E] bg-white px-2 py-0.5 rounded border border-slate-200">
                                      {ticket.holdNumber}
                                    </span>
                                    <span className="text-[10px] font-montserrat font-black text-slate-800 truncate">
                                      Rep: {ticket.affiliateName || ticket.heldByName}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-montserrat font-black uppercase px-2 py-0.5 rounded-full ${
                                      isReady
                                        ? 'bg-[#34D186] text-[#FFDE00]'
                                        : isPreparing
                                        ? 'bg-[#0A006E] text-[#FFDE00]'
                                        : isOnHoldPending
                                        ? 'bg-amber-200 text-amber-950'
                                        : 'bg-slate-200 text-slate-800'
                                    }`}
                                  >
                                    {isReady
                                      ? '✓ READY FOR COLLECTION'
                                      : isPreparing
                                      ? 'PREPARING DRINKS'
                                      : isOnHoldPending
                                      ? 'ON HOLD • PENDING PAYMENT'
                                      : 'QUEUED AT COUNTER'}
                                  </span>
                                </div>

                                <div className="text-[11px] font-bold text-slate-800 line-clamp-2">
                                  {ticket.items.map(i => `${i.quantity}× ${i.product.name}`).join(', ')}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
                                  <span className="font-mono">
                                    {ticket.paymentOption === 'PRINT_RECEIPT_AND_HOLD'
                                      ? 'Receipt Printed • Hold'
                                      : 'Pay on Collection'}
                                    {ticket.customerName ? ` • ${ticket.customerName}` : ''}
                                  </span>
                                  <span className="font-montserrat font-black text-xs text-[#0A006E]">
                                    {formatKes(ticket.totalKes)}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons for Counter Cashier */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/80">
                                {status === 'QUEUED_AT_COUNTER' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateHeldCartQueueStatus(ticket.id, {
                                        queueStatus: 'PREPARING_DRINKS',
                                        preparedByCashierName: currentUser.name
                                      });
                                      playBeep(880, 90);
                                      setHoldFeedback(`Counter Cashier received & started preparing drinks for ${ticket.holdNumber} (${ticket.affiliateName || ticket.heldByName})`);
                                      setTimeout(() => setHoldFeedback(null), 3500);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-white text-[10px] font-montserrat font-black transition cursor-pointer"
                                  >
                                    1. Receive &amp; Prepare
                                  </button>
                                )}

                                {status !== 'READY_FOR_COLLECTION' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateHeldCartQueueStatus(ticket.id, {
                                        queueStatus: 'READY_FOR_COLLECTION',
                                        preparedByCashierName: currentUser.name,
                                        readyAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      });
                                      playBeep(1320, 140);
                                      setHoldFeedback(`✓ Drinks for ${ticket.holdNumber} marked READY FOR COLLECTION by Sales Representative ${ticket.affiliateName || ticket.heldByName}!`);
                                      setTimeout(() => setHoldFeedback(null), 4000);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] text-[10px] font-montserrat font-black transition cursor-pointer"
                                  >
                                    ✓ Ready for Collection
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRecallCart(ticket.id)}
                                  className="px-2.5 py-1 rounded-lg bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border border-[#0A006E]/30 text-[10px] font-montserrat font-black transition cursor-pointer"
                                  title="Receive order into Counter Checkout to collect payment"
                                >
                                  Receive &amp; Settle Payment
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    updateHeldCartQueueStatus(ticket.id, {
                                      receiptPrinted: true,
                                      queueStatus:
                                        ticket.queueStatus === 'READY_FOR_COLLECTION'
                                          ? 'READY_FOR_COLLECTION'
                                          : 'ON_HOLD_PENDING_PAYMENT'
                                    });
                                    setPrintingQueueTicket(ticket);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-montserrat font-bold flex items-center gap-1 transition ml-auto cursor-pointer"
                                  title="Print 80mm Thermal Order Receipt & Hold for Pending Payment"
                                >
                                  <Printer className="w-3 h-3 text-[#0A006E]" />
                                  <span>Thermal Receipt</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Quick Barcode Scanner Input & App Search Bar */}
          <div className={`bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 ${mobilePosTab === 'QUEUE' ? 'hidden lg:block' : 'block'}`}>
            {awaitingNextPosScan ? (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 border-2 border-[#0A006E] animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0 text-xs font-montserrat font-bold text-[#0A006E]">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Scan complete ({lastPinnedPosScan?.product.name || 'Item added'}) — Scanner paused to prevent mistaken scan
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingNextPosScan(false);
                      setBarcodeInput('');
                      setTimeout(() => posBarcodeInputRef.current?.focus(), 30);
                    }}
                    className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Barcode className="w-4 h-4" />
                    <span>Scan Next Barcode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-montserrat font-bold text-xs border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                    title="Open Camera Barcode Scanner"
                  >
                    <Camera className="w-4 h-4 text-[#0A006E]" />
                    <span className="hidden sm:inline">Camera</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBarcodeSubmit} className="flex gap-1.5 sm:gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={posBarcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan barcode or enter SKU..."
                    className="w-full pl-9 sm:pl-11 pr-3 py-2.5 sm:py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A006E] text-slate-800"
                  />
                </div>

                {/* Camera Scanner Trigger */}
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(true)}
                  className="px-3 sm:px-3.5 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold text-xs border border-slate-200 transition flex items-center gap-1.5 shrink-0"
                  title="Open Camera Barcode Scanner"
                >
                  <Camera className="w-4 h-4 text-[#0A006E]" />
                  <span className="hidden sm:inline">Camera</span>
                </button>

                <button
                  type="submit"
                  className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-[#0A006E] text-white rounded-xl font-montserrat font-bold text-xs hover:bg-[#060046] transition flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <span>Add</span>
                </button>
              </form>
            )}

            {barcodeFeedback && (
              <div className="text-xs font-medium px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in fade-in flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{barcodeFeedback}</span>
              </div>
            )}

            {/* Auto-Pinned Barcode Product Verification Card */}
            {lastPinnedPosScan && (
              <div className="p-3 rounded-xl bg-emerald-950 text-white border-2 border-[#FFDE00] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase shrink-0 text-center">
                    <div>AUTO-PINNED</div>
                    <div className="font-mono text-[9px]">{lastPinnedPosScan.isCaseScan ? 'MASTER CASE' : 'SINGLE BTL'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-montserrat font-black text-[#FFDE00] truncate">
                      {lastPinnedPosScan.product.name} ({lastPinnedPosScan.product.volumeMl} mL)
                    </div>
                    <div className="text-[10px] font-mono text-emerald-200 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Barcode: <strong>{lastPinnedPosScan.scannedCode}</strong></span>
                      <span>•</span>
                      <span>SKU: <strong>{lastPinnedPosScan.product.sku}</strong></span>
                      <span>•</span>
                      <span>Added to Cart: <strong className="text-[#FFDE00]">+{lastPinnedPosScan.qtyAdded} btl(s)</strong></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-right font-mono">
                    <div className="text-[9px] text-emerald-300 uppercase">Stock Subtraction Preview</div>
                    <div className="text-xs font-black text-white">
                      {lastPinnedPosScan.stockOnHand} on hand → <span className="text-[#FFDE00]">{lastPinnedPosScan.remainingAfterCart} left</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastPinnedPosScan(null)}
                    className="text-emerald-300 hover:text-white p-1 text-xs font-bold"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition shrink-0 ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#0A006E] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All ({products.length})
                </button>
                <button
                  onClick={() => setSelectedCategory('IPS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shrink-0 ${
                    selectedCategory === 'IPS'
                      ? 'bg-[#34D186] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>IPS (Imported)</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('LPS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1 shrink-0 ${
                    selectedCategory === 'LPS'
                      ? 'bg-[#FFDE00] text-[#0A006E]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>LPS (Local)</span>
                </button>
              </div>

              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, brand (Tusker, Hennessy, Baileys)..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0A006E]"
                />
              </div>
            </div>

            {/* NairobiDrinks.co.ke Spirit & Drink Subcategory Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
              <button
                type="button"
                onClick={() => setSelectedSubCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold transition whitespace-nowrap ${
                  selectedSubCategory === 'ALL'
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Drinks
              </button>
              {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubCategory(sub)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold transition whitespace-nowrap ${
                    selectedSubCategory === sub
                      ? 'bg-[#34D186] text-[#FFDE00]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Product Catalog — Product Boxes Grid (Tap Box to Preview & Add by Liters or mL) */}
          <div className={`bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3 ${mobilePosTab === 'QUEUE' ? 'hidden lg:block' : 'block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                  Drinks Catalog ({filteredProducts.length})
                </span>
                <span className="text-[10px] font-mono font-bold text-[#1E9E60] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Tap Card to Customize mL / Price
                </span>
                <button
                  type="button"
                  onClick={() => {
                    reshuffleNow();
                    setManualShuffleOffset(m => m + 1);
                  }}
                  className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 active:scale-95 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                  title="Products of the same brand are scattered and automatically reshuffled every 20 seconds. Click to reshuffle now."
                >
                  <RotateCcw className="w-3 h-3 text-amber-600 animate-spin" style={{ animationDuration: '20s' }} />
                  <span>Scattered Brands • Reshuffling in {shuffleSecondsLeft}s</span>
                </button>
              </div>
              <span className="hidden sm:inline text-[11px] text-slate-500 font-medium">
                Tap any drink to customize volume or +1 for instant add
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No products match your search or category filter.
              </div>
            ) : (
              <div className="max-h-none lg:max-h-[520px] overflow-y-visible lg:overflow-y-auto pr-0 lg:pr-1.5 scroll-smooth grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredProducts.map((product) => {
                  const branchInv = inventoryItems.find(
                    i => i.productId === product.id && i.branchId === activeBranch.id
                  );
                  const fallbackInv = inventoryItems.find(
                    i => i.productId === product.id && i.bottlesOnHand > 0
                  );
                  const inv = branchInv && branchInv.bottlesOnHand > 0 ? branchInv : fallbackInv || branchInv;
                  const stock = inv ? inv.bottlesOnHand : 0;
                  const inCartQty = cart
                    .filter(c => (c.product.id.includes('-vol-') ? c.product.id.split('-vol-')[0] : c.product.id) === product.id)
                    .reduce((sum, c) => sum + c.quantity, 0);
                  const remainingAfterCart = Math.max(0, stock - inCartQty);
                  const branchPriceInfo = getBranchProductPrice(product, activeBranch);
                  const unitPrice = branchPriceInfo.effectiveUnitPriceKes;
                  const isOutOfStock = stock <= 0;
                  const litersText = +(product.volumeMl / 1000).toFixed(2);

                  return (
                    <div
                      key={product.id}
                      onClick={() => openProductPreviewModal(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openProductPreviewModal(product);
                        }
                      }}
                      className={`rounded-2xl border p-2.5 sm:p-3 transition-all cursor-pointer flex flex-col justify-between group text-left relative active:scale-[0.99] ${
                        isOutOfStock
                          ? 'opacity-75 border-slate-200 bg-slate-50/70 hover:border-amber-400'
                          : inCartQty > 0
                          ? 'border-2 border-[#34D186] bg-emerald-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-[#0A006E] hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Top Row: Category Badge & Stock Pill */}
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
                          <span className={`text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-md font-montserrat uppercase ${
                            product.category === 'IPS'
                              ? 'bg-[#34D186]/15 text-[#1E9E60]'
                              : 'bg-[#FFDE00]/50 text-[#0A006E]'
                          }`}>
                            {product.category}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md shrink-0 ${
                            remainingAfterCart > 10
                              ? 'bg-emerald-50 text-[#1E9E60] border border-emerald-200'
                              : remainingAfterCart > 0
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {inCartQty > 0
                              ? `${remainingAfterCart} left`
                              : `${stock} in stock`}
                          </span>
                        </div>

                        {/* Full-Fit Product Studio Image inside Box */}
                        <div className="w-full h-32 sm:h-40 rounded-xl overflow-hidden border border-slate-200/80 relative bg-slate-950">
                          <ProductImage
                            product={product}
                            size="full"
                            showVolumeBadge
                            className="w-full h-full rounded-none border-0"
                          />
                          {inCartQty > 0 && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[10px] shadow-md border border-[#FFDE00]/40">
                              {inCartQty} in Cart
                            </div>
                          )}
                        </div>

                        {/* Product Name & Volume (mL & L) */}
                        <div className="mt-2">
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                            {product.brand} • {product.subCategory || 'Spirit'}
                          </div>
                          <h4 className="font-montserrat font-black text-[11px] sm:text-xs text-slate-900 line-clamp-2 leading-snug mt-0.5 group-hover:text-[#0A006E]">
                            {product.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#0A006E] bg-[#0A006E]/5 px-1.5 py-0.5 rounded border border-[#0A006E]/15">
                              {product.volumeMl}mL ({litersText}L)
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500">
                              {product.alcoholPercentage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Price & App Quick Actions */}
                      <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] text-slate-400 uppercase font-bold">
                            {isWholesaleStore ? 'Wholesale' : 'Price'}
                          </span>
                          <span className="font-montserrat font-black text-xs sm:text-sm text-[#0A006E]">
                            {formatKes(unitPrice)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isWarehouse && stock <= 12 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
                                const created = createRestockRequest(
                                  mainWarehouse.id,
                                  [{ productId: product.id, casesRequested: isOutOfStock ? 5 : 3 }],
                                  {
                                    fromBranchId: activeBranch.id,
                                    initiationType: 'SHOP_REFILL_REQUEST',
                                    urgency: isOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK',
                                    notes: `${activeBranch.name} requested urgent refill for ${product.name} (${stock} btls remaining).`
                                  }
                                );
                                setBarcodeFeedback(
                                  `Order Request ${created.requestNumber} for ${product.name} sent to Inventory Controller!`
                                );
                                setTimeout(() => setBarcodeFeedback(null), 4500);
                              }}
                              className="p-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[10px] font-montserrat font-black transition shrink-0 shadow-2xs"
                              title="Request stock refill from Warehouse"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <div className="flex-1 py-2 px-2 bg-[#0A006E] group-hover:bg-[#060046] text-[#FFDE00] rounded-xl text-[10px] font-montserrat font-black transition flex items-center justify-center gap-1 shadow-2xs">
                            <span>Preview • mL</span>
                          </div>

                          {!isWarehouse && remainingAfterCart > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, 1, 0);
                                playBeep(1200, 70);
                                showSuccessFeedback(
                                  'Added to Cart!',
                                  `${product.name} (1 unit)`,
                                  formatKes(unitPrice)
                                );
                              }}
                              className="px-2.5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 active:scale-95 text-[#FFDE00] font-montserrat font-black text-[10px] transition shrink-0 shadow-2xs"
                              title="Quick add 1 standard bottle to cart"
                            >
                              +1
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Active Cart, Affiliate Markup & Multi-Tender Checkout (5 Cols) */}
        <div className={`lg:col-span-5 ${mobilePosTab === 'CHECKOUT' ? 'block' : 'hidden lg:block'}`}>
          
          <div className="sticky top-4 bg-white rounded-2xl border border-slate-200 shadow-lg p-3.5 sm:p-6 h-auto lg:h-[650px] flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-0.5 sm:pr-1 space-y-2.5 scrollbar-thin">
              {/* Mobile Back to Catalog Bar */}
              <div className="lg:hidden flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setMobilePosTab('CATALOG')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5"
                >
                  <span>← Add More Drinks</span>
                </button>
                <span className="text-[11px] font-mono font-bold text-[#1E9E60] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {totalCartUnits} unit(s) • {formatKes(subtotal)}
                </span>
              </div>
              {/* Cart Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-xs">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-montserrat font-black text-base text-slate-900">
                      {posStationMode === 'SALES_LADY'
                        ? 'Sales Representative POS (Direct Cash Out)'
                        : 'Counter Cashier POS (Direct Counter Checkout)'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {cart.length} unique line items • {posStationMode === 'SALES_LADY' ? 'Direct Self-Checkout / Cash Out' : 'Counter Settlement'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Kick Drawer Button — Strictly Visible ONLY to POS Counter Cashier, NOT Sales Affiliated Lady */}
                  {isPosCashier && posStationMode === 'COUNTER_CASHIER' && (
                    <button
                      type="button"
                      onClick={handleKickDrawer}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border border-[#0A006E]/30 text-[11px] font-montserrat font-black flex items-center gap-1 transition shadow-2xs"
                      title="Send RJ11 Drawer Kick Pulse via ESC/POS (POS Cashier Only)"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#0A006E]" />
                      <span>Kick Drawer</span>
                    </button>
                  )}

                  {/* Counter Order Queue / Held Carts Toggle Button — ONLY shown on POS Counter Cashier */}
                  {posStationMode === 'COUNTER_CASHIER' && (
                    <button
                      type="button"
                      onClick={() => setIsHeldCartsOpen(prev => !prev)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-montserrat font-bold flex items-center gap-1.5 border transition ${
                        branchHeldCarts.length > 0
                          ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E] shadow-2xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={`View Collection Queue for POS Cashier ${activeCounterCashierName}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Queue / Hold ({branchHeldCarts.length})</span>
                    </button>
                  )}

                  {/* Put on Hold Button */}
                  {posStationMode === 'COUNTER_CASHIER' && cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePutCartOnHold}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-montserrat font-bold flex items-center gap-1 transition shadow-2xs"
                      title="Put active cart on hold to serve next customer"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-amber-800" />
                      <span>Put on Hold</span>
                    </button>
                  )}

                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="px-2 py-1.5 rounded-lg text-[11px] text-red-600 hover:bg-red-50 font-semibold flex items-center gap-1 transition"
                      title="Clear cart"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Staff Relationship Attribution Banner (Cashier & Sales Rep Relationship) */}
              <div className="py-2.5 px-3 my-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserCheck className="w-4 h-4 text-[#0A006E] shrink-0" />
                    <div className="text-xs truncate">
                      {posStationMode === 'SALES_LADY' ? (
                        <span>
                          <span className="text-slate-500 font-medium">Sales Rep: </span>
                          <strong className="font-mono font-bold text-[#0A006E]">
                            {activeSalesLadyAffiliate?.name || currentUser.name}
                          </strong>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Self-Checkout (No Queueing)
                          </span>
                        </span>
                      ) : recalledSalesPerson || selectedAffiliate ? (
                        <span>
                          <span className="text-slate-500 font-medium">Cashier: </span>
                          <strong className="font-mono font-bold text-[#0A006E] mr-1">
                            {activeCounterCashierName}
                          </strong>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-medium ml-1">Sales Rep: </span>
                          <strong className="font-mono font-bold text-emerald-700">
                            {recalledSalesPerson?.name || selectedAffiliate?.name}
                          </strong>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-[#0A006E] text-[10px] font-bold">
                            Rep Order Linked
                          </span>
                        </span>
                      ) : (
                        <span>
                          <span className="text-slate-500 font-medium">Counter Cashier: </span>
                          <strong className="font-mono font-bold text-[#0A006E]">
                            {activeCounterCashierName}
                          </strong>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                            Direct Counter Sale
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStaffPinPrompt()}
                    className="text-[10px] font-montserrat font-black text-[#0A006E] bg-[#FFDE00] hover:bg-[#FFDE00]/85 px-2.5 py-1.5 rounded-lg border border-[#0A006E]/30 shrink-0 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Lock className="w-3 h-3 text-[#0A006E]" />
                    <span>Switch Staff</span>
                  </button>
                </div>

                {/* Sub-strip detailing relationship between Cashier and Salesperson */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 gap-1">
                  {posStationMode === 'SALES_LADY' ? (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400">Assigned Counter Cashier:</span>
                      <strong className="font-semibold text-slate-700">
                        {workingUnderCashier?.name || activeSalesLadyAffiliate?.assignedCashierName || 'Branch Cashier'}
                      </strong>
                      <span className="text-emerald-600 font-medium">(Available for optional collection handoff)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400">Checkout Mode:</span>
                      <strong className="font-semibold text-slate-700">
                        {recalledSalesPerson || selectedAffiliate
                          ? 'Recalled Rep Order (Both Rep Commission & Cashier Till Recorded)'
                          : 'Counter Direct Checkout (Walk-in Customer)'}
                      </strong>
                    </div>
                  )}

                  {posStationMode === 'COUNTER_CASHIER' && !recalledSalesPerson && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400">Link Rep:</span>
                      <select
                        value={selectedAffiliate?.id || ''}
                        onChange={(e) => {
                          const found = affiliates.find(a => a.id === e.target.value);
                          setSelectedAffiliate(found || null);
                        }}
                        className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-medium text-slate-700"
                      >
                        <option value="">None (Counter Walk-in)</option>
                        {(branchAffiliates.length > 0 ? branchAffiliates : affiliates).map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {holdFeedback && (
                <div className="my-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-medium flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <PauseCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{holdFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHoldFeedback(null)}
                    className="text-amber-700 hover:text-amber-950 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Expandable Counter Order Queue & Held Carts Panel — ONLY shown on POS Counter Cashier */}
              {posStationMode === 'COUNTER_CASHIER' && isHeldCartsOpen && (
                <div className="my-2 p-3 rounded-xl bg-slate-50 border-2 border-[#0A006E] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Collection Queue • Cashier {activeCounterCashierName} ({branchHeldCarts.length})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHeldCartsOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                    >
                      Close
                    </button>
                  </div>

                  {branchHeldCarts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      No orders currently in the counter queue or on hold.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {branchHeldCarts.map((held) => {
                        const status = held.queueStatus || 'QUEUED_AT_COUNTER';
                        const isReady = status === 'READY_FOR_COLLECTION';
                        return (
                          <div
                            key={held.id}
                            className={`p-2.5 rounded-xl bg-white border shadow-2xs space-y-2 ${
                              isReady ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-[#0A006E]">
                                    {held.holdNumber}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {held.createdAt}
                                  </span>
                                  <span className="text-[10px] font-bold text-[#1E9E60] bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {formatKes(held.totalKes)}
                                  </span>
                                  <span className="text-[9px] font-montserrat font-black uppercase px-1.5 py-0.5 rounded bg-[#0A006E]/10 text-[#0A006E]">
                                    {isReady
                                      ? '✓ Ready for Collection'
                                      : status === 'PREPARING_DRINKS'
                                      ? 'Preparing Drinks'
                                      : status === 'ON_HOLD_PENDING_PAYMENT'
                                      ? 'On Hold • Pending Payment'
                                      : 'Queued at Counter'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-800 font-bold truncate mt-0.5">
                                  {held.items.map(i => `${i.quantity}× ${i.product.name}`).join(', ')}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono truncate">
                                  Sales Rep: {held.affiliateName || held.heldByName} •{' '}
                                  {held.paymentOption === 'PRINT_RECEIPT_AND_HOLD'
                                    ? 'Receipt Printed (On Hold)'
                                    : 'Pay on Collection'}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setPrintingQueueTicket(held)}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-montserrat font-bold flex items-center gap-1 transition"
                                title="Print 80mm Thermal Receipt"
                              >
                                <Printer className="w-3 h-3 text-[#0A006E]" />
                                <span>Print Receipt</span>
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
                                    playBeep(1320, 140);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] text-[10px] font-montserrat font-bold transition"
                                >
                                  Ready for Collection
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRecallCart(held.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-[10px] font-montserrat font-bold flex items-center gap-1 transition"
                                title="Load into Counter Cart to settle payment"
                              >
                                <PlayCircle className="w-3 h-3" />
                                <span>{posStationMode === 'COUNTER_CASHIER' ? 'Collect Payment' : 'Recall'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeHeldCart(held.id)}
                                className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                                title="Discard order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Direct Counter Sale vs Sales Representative Order Attribution */}
              <div className="py-3 border-b border-slate-200 bg-amber-50/60 -mx-4 sm:-mx-5 px-4 sm:px-5 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#0A006E]" />
                    <span>
                      {posStationMode === 'COUNTER_CASHIER'
                        ? 'Sale Source: Direct Walk-In or Sales Rep Order'
                        : 'Sales Representative & Preferred Price Mode'}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {posStationMode === 'COUNTER_CASHIER' && activeSalesLadyAffiliate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAffiliate(null);
                          setCounterCashierSaleMode('DIRECT_SALE');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-montserrat font-bold text-[10px] transition cursor-pointer"
                        title="Switch to Direct Walk-In Counter Sale without Sales Rep"
                      >
                        Switch to Direct Sale
                      </button>
                    )}
                    {activeSalesLadyAffiliate && (
                      <button
                        type="button"
                        onClick={() => {
                          setRepHistoryPeriod('ALL');
                          setRepHistorySearch('');
                          setIsRepHistoryModalOpen(true);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <History className="w-3 h-3" />
                        <span>Previous Sales ({activeRepPreviousOrders.length})</span>
                      </button>
                    )}
                    {activeSalesLadyAffiliate && (
                      <span className="text-[10px] font-bold text-[#1E9E60] bg-emerald-100 px-2 py-0.5 rounded">
                        {activeSalesLadyAffiliate.code} • {activeSalesLadyAffiliate.commissionMode === 'PREFERRED_PRICE_PROFIT_ONLY' ? '100% Profit' : `${activeSalesLadyAffiliate.commissionRatePercent ?? defaultAffiliateCommissionRate}% + Profit`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={activeSalesLadyAffiliate?.id || ''}
                    onChange={(e) => {
                      const aff = affiliates.find(a => a.id === e.target.value) || null;
                      setSelectedAffiliate(aff);
                      if (aff && posStationMode === 'COUNTER_CASHIER') {
                        setCounterCashierSaleMode('RECEIVE_REP_ORDERS');
                      } else if (!aff && posStationMode === 'COUNTER_CASHIER') {
                        setCounterCashierSaleMode('DIRECT_SALE');
                      }
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0A006E]"
                  >
                    <option value="">Direct Counter Sale (Walk-In Customer • Standard Company Price)</option>
                    {(branchAffiliates.length > 0 ? branchAffiliates : affiliates).map(a => (
                      <option key={a.id} value={a.id}>
                        Order from Sales Rep: {a.name} ({a.code} • {a.allowPreferredPrice !== false ? 'Preferred Price Enabled' : 'Fixed Price'})
                      </option>
                    ))}
                  </select>
                </div>

                {activeSalesLadyAffiliate && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px]">
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeSalesLadyAffiliate.allowPreferredPrice !== false}
                        onChange={(e) => {
                          updateAffiliateCommissionSettings(activeSalesLadyAffiliate.id, {
                            allowPreferredPrice: e.target.checked
                          });
                        }}
                        className="rounded border-slate-300 text-[#1E9E60] focus:ring-[#34D186]"
                      />
                      <span>Allow Preferred Price (Company Price Unchanged)</span>
                    </label>
                    <span className="text-[#1E9E60] font-mono font-bold">
                      Profit = Preferred Price − Company Price
                    </span>
                  </div>
                )}
              </div>

              {/* Cart Items List — Full App List on Mobile, Compact Scroll on Desktop */}
              <div className="my-2">
                {cart.length > 1 && (
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#0A006E] bg-slate-100 px-2.5 py-1 rounded-t-lg border border-b-0 border-slate-200">
                    <span>{cart.length} products in active order ({totalCartUnits} units)</span>
                    <span>Scroll ↕</span>
                  </div>
                )}
                <div className={`divide-y divide-slate-100 max-h-[280px] lg:max-h-[128px] overflow-y-auto snap-y snap-mandatory px-2.5 border border-slate-200 ${cart.length > 1 ? 'rounded-b-xl' : 'rounded-xl'} bg-slate-50/40`}>
                  {cart.length === 0 ? (
                    <div className="py-5 text-center text-slate-400 space-y-1">
                      <ShoppingCart className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="text-xs font-medium">Cart is currently empty</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => {
                      const companyUnitPrice = getBranchProductPrice(
                        item.product,
                        activeBranch,
                        isWholesaleStore ? 'WHOLESALE' : 'RETAIL'
                      ).effectiveUnitPriceKes;
                      const lineTotal = item.unitPrice * item.quantity;
                      const lineAffiliateProfit = (item.affiliateMarkupPerUnit || 0) * item.quantity;
                      const canEditPreferredPrice =
                        (Boolean(activeSalesLadyAffiliate) || posStationMode === 'SALES_LADY') &&
                        (activeSalesLadyAffiliate ? activeSalesLadyAffiliate.allowPreferredPrice !== false : defaultAllowPreferredPrice);

                      const baseProdId = item.product.id.includes('-vol-')
                        ? item.product.id.split('-vol-')[0]
                        : item.product.id;
                      const branchItemInv = inventoryItems.find(
                        i => i.productId === baseProdId && i.branchId === activeBranch.id
                      );
                      const fallbackItemInv = inventoryItems.find(
                        i => i.productId === baseProdId && i.bottlesOnHand > 0
                      );
                      const itemInv =
                        branchItemInv && branchItemInv.bottlesOnHand > 0
                          ? branchItemInv
                          : fallbackItemInv || branchItemInv;
                      const stockBefore = itemInv ? itemInv.bottlesOnHand : 0;
                      const stockAfter = Math.max(0, stockBefore - item.quantity);

                      return (
                        <div key={item.product.id} className="snap-start py-2.5 min-h-[104px] flex flex-col justify-between gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ProductImage
                                product={item.product}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <h5 className="font-montserrat font-bold text-xs text-slate-900 truncate">
                                  {idx + 1}. {item.product.name}
                                </h5>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold text-[#0A006E] bg-[#0A006E]/10 px-1.5 py-0.2 rounded">
                                    Company Price: {formatKes(companyUnitPrice)}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-[#1E9E60] bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    Stock: {stockBefore} → {stockAfter} left
                                  </span>
                                  {lineAffiliateProfit > 0 && (
                                    <span className="text-[10px] font-mono font-black text-[#1E9E60] bg-emerald-100 px-1.5 py-0.2 rounded">
                                      Affiliate Profit: +{formatKes(lineAffiliateProfit)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            {/* Qty Controls */}
                            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shrink-0">
                              <button
                                onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                                className="px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 py-0.5 text-xs font-mono font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                                className="px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Affiliate Preferred Selling Price Input (Does NOT affect Company Price) */}
                            {canEditPreferredPrice && (
                              <div className="flex flex-wrap items-center gap-1 text-[10px] bg-amber-50 border border-amber-300 rounded-lg px-2 py-0.5">
                                <span className="font-bold text-amber-950 whitespace-nowrap">Pref:</span>
                                <input
                                  type="number"
                                  min={companyUnitPrice}
                                  step={50}
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      updateCartItemPreferredPrice(item.product.id, val);
                                    }
                                  }}
                                  className="w-16 px-1 py-0.5 bg-white border border-amber-400 rounded text-right font-mono font-black text-xs text-[#0A006E]"
                                  title="Enter Affiliate Preferred Selling Price per unit (Company price stays unchanged)"
                                />
                                {[100, 250, 500].map(inc => (
                                  <button
                                    key={inc}
                                    type="button"
                                    onClick={() =>
                                      updateCartItemPreferredPrice(item.product.id, item.unitPrice + inc)
                                    }
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-[#34D186] hover:text-[#FFDE00] active:scale-95 text-[#1E9E60] border border-emerald-300 font-mono font-black text-[9px] transition cursor-pointer select-none"
                                    title={`Tap to add +KES ${inc} (tap multiple times to keep increasing)`}
                                  >
                                    +{inc}
                                  </button>
                                ))}
                                {(item.affiliateMarkupPerUnit || 0) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCartItemPreferredPrice(item.product.id, companyUnitPrice)
                                    }
                                    className="px-1 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono font-bold text-[9px] transition cursor-pointer"
                                    title="Reset to Company Price"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="text-right shrink-0">
                              <div className="font-montserrat font-black text-xs text-[#0A006E] tabular-nums">
                                {formatKes(lineTotal)}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                                @{formatKes(item.unitPrice)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Financial Breakdown with Explicit Separation of Affiliate Profit from Company Sales */}
              {cart.length > 0 && (() => {
                const activeAffMode =
                  activeSalesLadyAffiliate?.commissionMode || defaultAffiliateCommissionMode || 'COMMISSION_AND_PROFIT';
                const activeAffRate =
                  activeSalesLadyAffiliate?.commissionRatePercent !== undefined
                    ? activeSalesLadyAffiliate.commissionRatePercent
                    : defaultAffiliateCommissionRate;
                const estBaseCommKes =
                  activeSalesLadyAffiliate &&
                  (activeAffMode === 'COMMISSION_AND_PROFIT' || activeAffMode === 'BASE_COMMISSION_ONLY')
                    ? Math.round(companyBaselineSubtotal * (activeAffRate / 100))
                    : 0;
                const estSeparatedProfitKes =
                  activeAffMode === 'BASE_COMMISSION_ONLY' ? 0 : totalAffiliateMarkup;
                const estTotalAffiliateEarnedKes = estSeparatedProfitKes + estBaseCommKes;

                return (
                  <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Company Sales (At Company Price):</span>
                      <span className="font-mono font-bold text-[#0A006E] tabular-nums">
                        {formatKes(companyBaselineSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Company 16% VAT (On Company Price):</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">{formatKes(vatAmount)}</span>
                    </div>

                    {(estSeparatedProfitKes > 0 || estBaseCommKes > 0 || activeSalesLadyAffiliate) && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 my-1">
                        <div className="flex items-center justify-between text-[10px] font-montserrat font-black uppercase text-[#1E9E60]">
                          <span>Separated from Company Sales</span>
                          <span>What Affiliate Earns</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-[#1E9E60]">
                          <span>Preferred Price Profit (Sold − Company):</span>
                          <span className="font-mono font-black tabular-nums">+{formatKes(estSeparatedProfitKes)}</span>
                        </div>
                        {estBaseCommKes > 0 && (
                          <div className="flex justify-between text-[11px] text-emerald-800">
                            <span>Base Commission ({activeAffRate}% of Company Sales):</span>
                            <span className="font-mono font-bold tabular-nums">+{formatKes(estBaseCommKes)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs font-montserrat font-black text-[#1E9E60] pt-1 border-t border-emerald-200">
                          <span>Total Affiliate Profit Earned:</span>
                          <span className="tabular-nums">{formatKes(estTotalAffiliateEarnedKes)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
                      <span className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-700">
                        Customer Total Payable:
                      </span>
                      <span className="font-montserrat font-black text-2xl sm:text-3xl text-[#0A006E] tracking-tight tabular-nums">
                        {formatKes(subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Customer Tax PIN & Phone (for 16% VAT Invoice) */}
              {cart.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-[11px] font-montserrat font-black text-slate-800 uppercase tracking-wider">
                    Customer Compliance &amp; Receipt
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Customer Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. John Kamau"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold text-slate-600">
                          Mobile Money (10-Digit)
                        </label>
                        {(() => {
                          const posCarrier = detectKenyanMobileCarrier(customerPhone);
                          return (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-montserrat font-black uppercase ${
                                posCarrier.carrier === 'AIRTEL'
                                  ? 'bg-red-600 text-white'
                                  : posCarrier.carrier === 'SAFARICOM'
                                  ? 'bg-[#34D186] text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {posCarrier.carrier === 'AIRTEL'
                                ? 'Airtel'
                                : posCarrier.carrier === 'SAFARICOM'
                                ? 'Safaricom'
                                : 'KE'}{' '}
                              {posCarrier.digitsCount}/10
                            </span>
                          );
                        })()}
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={sanitizeAndControlKenyanMobileInput(customerPhone)}
                        onChange={(e) =>
                          setCustomerPhone(sanitizeAndControlKenyanMobileInput(e.target.value))
                        }
                        placeholder="0712345678 / 0733123456"
                        className={`w-full px-2.5 py-1.5 bg-white border-2 rounded-lg text-xs font-mono font-bold text-[#0A006E] focus:outline-none ${
                          detectKenyanMobileCarrier(customerPhone).carrier === 'AIRTEL'
                            ? 'border-rose-400'
                            : detectKenyanMobileCarrier(customerPhone).carrier === 'SAFARICOM'
                            ? 'border-[#34D186]'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Customer Email (Receipt &amp; Invoice)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="client@email.com"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex justify-between">
                        <span>Customer KRA PIN</span>
                        <span className="text-slate-400">B2B Claim</span>
                      </label>
                      <input
                        type="text"
                        value={customerKraPin}
                        onChange={(e) => setCustomerKraPin(e.target.value.toUpperCase())}
                        placeholder="P05XXXXXXXX"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* Step 4: Multi-Tender Payment Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Payment Settlement Method
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('MPESA')}
                        className={`py-2 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-1 border transition ${
                          paymentMethod === 'MPESA'
                            ? 'bg-[#34D186] text-white border-[#34D186] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>M-Pesa STK</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CASH')}
                        className={`py-2 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-1 border transition ${
                          paymentMethod === 'CASH'
                            ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Cash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('BANK_TRANSFER')}
                        className={`py-2 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-1 border transition ${
                          paymentMethod === 'BANK_TRANSFER'
                            ? 'bg-purple-900 text-white border-purple-950 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Card/PDQ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('SPLIT')}
                        className={`py-2 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-1 border transition ${
                          paymentMethod === 'SPLIT'
                            ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Split</span>
                      </button>
                    </div>
                  </div>

                  {/* Modernized M-Pesa / Airtel Money STK Express Panel */}
                  {paymentMethod === 'MPESA' && (() => {
                    const posCarrier = detectKenyanMobileCarrier(customerPhone);
                    const isAirtel = posCarrier.carrier === 'AIRTEL';
                    return (
                      <div
                        className={`p-3 rounded-xl border-2 space-y-2 text-xs transition-all ${
                          isAirtel
                            ? 'bg-rose-50/80 border-rose-400'
                            : 'bg-emerald-50/80 border-[#34D186]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-montserrat font-black text-[11px] uppercase tracking-wide flex items-center gap-1.5 text-slate-900">
                            <Smartphone
                              className={`w-3.5 h-3.5 ${
                                isAirtel ? 'text-red-600' : 'text-[#1E9E60]'
                              }`}
                            />
                            <span>
                              {isAirtel
                                ? 'Airtel Money / M-Pesa STK Prompt'
                                : 'Safaricom M-Pesa STK Express'}
                            </span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-montserrat font-black uppercase text-white ${
                              isAirtel
                                ? 'bg-red-600'
                                : posCarrier.carrier === 'SAFARICOM'
                                ? 'bg-[#34D186]'
                                : 'bg-[#0A006E]'
                            }`}
                          >
                            {isAirtel
                              ? 'Airtel Identified'
                              : posCarrier.carrier === 'SAFARICOM'
                              ? 'Safaricom Identified'
                              : `${posCarrier.digitsCount}/10 Digits`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-600 font-semibold">STK Target Number:</span>
                          <span className="font-mono font-black text-[#0A006E]">
                            {posCarrier.formattedDisplay || '07XX XXX XXX (Enter 10 digits above)'}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Verified M-Pesa Receipt Code (If Paid Direct to Till/Paybill):
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
                            placeholder="e.g. QKA84X92LM (Leave blank for STK Push)"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs uppercase text-slate-900 focus:outline-none focus:border-[#0A006E]"
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cash Change Calculation Interface */}
                  {paymentMethod === 'CASH' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Cash Tendered (KES):</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCashTendered(subtotal.toString())}
                            className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold hover:bg-slate-300"
                          >
                            Exact
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashTendered((Math.ceil(subtotal / 1000) * 1000).toString())}
                            className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold hover:bg-slate-300"
                          >
                            Round 1k
                          </button>
                        </div>
                      </div>

                      <input
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={`e.g. ${subtotal}`}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0A006E]"
                      />

                      {parsedCashTendered > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                          <span className="font-bold text-[#1E9E60]">Change to Return:</span>
                          <span className="font-montserrat font-black text-sm text-[#1E9E60]">
                            {formatKes(cashChange)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Split Tender Interface */}
                  {paymentMethod === 'SPLIT' && (
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
                      <div className="font-bold text-amber-950">Split Tender Amounts:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600">Cash Portion (KES)</label>
                          <input
                            type="number"
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600">M-Pesa Portion (KES)</label>
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
                        <span>Remaining Unpaid:</span>
                        <span className={`font-bold ${splitRemaining === 0 ? 'text-[#1E9E60]' : 'text-red-700'}`}>
                          {formatKes(splitRemaining)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Card / PDQ Terminal Interface */}
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1.5 text-xs">
                      <label className="font-bold text-purple-950 block">PDQ Card Approval Code / Bank Ref:</label>
                      <input
                        type="text"
                        value={cardAuthCode}
                        onChange={(e) => setCardAuthCode(e.target.value)}
                        placeholder="e.g. AUTH-KCB-99420"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg font-mono text-xs"
                      />
                    </div>
                  )}

                </div>
              )}
            </div>

               {/* Step 5: Pinned / Floating Action Bar — Adapts for Sales Affiliate Lady vs Counter Cashier */}
            <div className="shrink-0 sticky bottom-0 z-20 bg-white pt-3 mt-2 border-t-2 border-slate-200 space-y-2 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.06)]">
              {checkoutError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {isProcessingStk && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-[#1E9E60] flex items-center space-x-2 animate-pulse">
                  <div className="w-4 h-4 rounded-full border-2 border-[#34D186] border-t-transparent animate-spin" />
                  <span>{stkStatusMessage}</span>
                </div>
              )}

              {/* High-Visibility Big View of Total Charge + Prompt & Checkout Action Bar */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-[#0A006E] space-y-3 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] sm:text-xs font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                      Total Charge
                    </div>
                    <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                      {cart.reduce((acc, i) => acc + i.quantity, 0)} unit(s) · Incl. 16% VAT ({formatKes(vatAmount)})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-montserrat font-black text-3xl sm:text-4xl text-[#FFDE00] tracking-tight tabular-nums leading-none drop-shadow-xs">
                      {formatKes(subtotal)}
                    </div>
                  </div>
                </div>

                {posStationMode === 'SALES_LADY' ? (
                  /* SALES REPRESENTATIVE ACTIONS: Prompt, Hold Slip, Queue to Cashier, and Direct Cash Out */
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={handleOpenPosPrompt}
                      disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                      className="col-span-3 py-3 px-1.5 bg-[#34D186] hover:bg-[#1E9E60] text-[#0A006E] border border-[#FFDE00]/60 rounded-xl font-montserrat font-black text-[11px] sm:text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1 text-center cursor-pointer"
                      title="Send M-Pesa STK Push Prompt to Customer Phone"
                    >
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                      <span>Prompt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSalesLadySubmitToQueue('PRINT_RECEIPT_AND_HOLD')}
                      disabled={cart.length === 0 || isWarehouse}
                      className="col-span-2 py-3 px-1 bg-white/10 hover:bg-white/20 text-white border border-white/25 rounded-xl font-montserrat font-bold text-[10px] shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-0.5 text-center cursor-pointer"
                      title="Print 80mm thermal slip & hold order"
                    >
                      <Printer className="w-3 h-3 text-[#FFDE00] shrink-0" />
                      <span>Slip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSalesLadySubmitToQueue('PAY_ON_COLLECTION')}
                      disabled={cart.length === 0 || isWarehouse}
                      className="col-span-2 py-3 px-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-xl font-montserrat font-bold text-[10px] shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1 text-center cursor-pointer"
                      title="Optional: Queue order to counter cashier for collection"
                    >
                      <Send className="w-3 h-3 text-[#FFDE00] shrink-0" />
                      <span>Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                      className="col-span-5 py-3 px-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#FFDE00] rounded-xl font-montserrat font-black text-xs sm:text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 text-center cursor-pointer"
                      title="Direct Self-Checkout: Cash out sale and issue receipt immediately by yourself without queuing to cashier"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#0A006E] shrink-0" />
                      <span>Cash Out (Self-Checkout)</span>
                    </button>
                  </div>
                ) : (
                  /* COUNTER CASHIER ACTIONS: Print & Hold, M-Pesa STK Prompt, and Counter Checkout */
                  <div className="grid grid-cols-12 gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={() => handleSalesLadySubmitToQueue('PRINT_RECEIPT_AND_HOLD')}
                      disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                      className="col-span-3 py-3 px-2 bg-white/10 hover:bg-white/20 text-white border border-white/25 rounded-xl font-montserrat font-black text-[11px] tracking-wide shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1 text-center cursor-pointer"
                      title="Print 80mm thermal receipt and put order on hold for pending payment"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
                      <span>Hold</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenPosPrompt}
                      disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                      className="col-span-4 py-3 px-3 bg-[#34D186] hover:bg-[#1E9E60] text-[#0A006E] border border-[#FFDE00]/60 rounded-xl font-montserrat font-black text-xs sm:text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 text-center cursor-pointer"
                      title="Send M-Pesa STK Push Prompt to Customer Phone"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>Prompt</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || isWarehouse || isProcessingStk}
                      className="col-span-5 py-3 px-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#FFDE00] rounded-xl font-montserrat font-black text-xs sm:text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 text-center cursor-pointer"
                      title={
                        recalledSalesPerson || selectedAffiliate
                          ? `Counter Checkout: Process order for Sales Rep ${recalledSalesPerson?.name || selectedAffiliate?.name} (both rep commission and cashier reconciliation recorded)`
                          : 'Counter Checkout: Complete direct sale made from counter & issue receipt immediately'
                      }
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {recalledSalesPerson || selectedAffiliate
                          ? 'Checkout Rep Order'
                          : 'Counter Checkout'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {isMultiItemOrder(cart) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-[#0A006E]/30 flex items-center justify-between gap-2 text-xs">
                  <div className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Multi-Item Order ({cart.reduce((acc, i) => acc + i.quantity, 0)} Units)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveOrderItemsDocument(
                          buildOrderDocumentFromCart({
                            channelLabel:
                              posStationMode === 'SALES_LADY'
                                ? `Sales Rep POS (${activeSalesLadyAffiliate?.name || currentUser.name})`
                                : `Counter POS (${activeBranch.name})`,
                            branchName: activeBranch.name,
                            customerName: customerName || 'Walk-in Customer',
                            customerPhone,
                            servedByOrRider:
                              posStationMode === 'SALES_LADY'
                                ? activeSalesLadyAffiliate?.name || currentUser.name
                                : currentUser.name,
                            cartItems: cart.map(c => ({
                              product: c.product,
                              quantity: c.quantity,
                              unitPriceKes: c.unitPrice
                            }))
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Generate Ordered Items Doc</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadOrderItemsHtmlDocument(
                          buildOrderDocumentFromCart({
                            channelLabel:
                              posStationMode === 'SALES_LADY'
                                ? `Sales Rep POS (${activeSalesLadyAffiliate?.name || currentUser.name})`
                                : `Counter POS (${activeBranch.name})`,
                            branchName: activeBranch.name,
                            customerName: customerName || 'Walk-in Customer',
                            customerPhone,
                            servedByOrRider:
                              posStationMode === 'SALES_LADY'
                                ? activeSalesLadyAffiliate?.name || currentUser.name
                                : currentUser.name,
                            cartItems: cart.map(c => ({
                              product: c.product,
                              quantity: c.quantity,
                              unitPriceKes: c.unitPrice
                            }))
                          })
                        )
                      }
                      className="p-1.5 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] cursor-pointer"
                      title="Download Ordered Items Document (.HTML)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MOBILE APP FLOATING BOTTOM CHECKOUT BAR (Visible on Mobile Catalog/Queue when Cart has items) */}
      {mobilePosTab !== 'CHECKOUT' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[8.25rem] md:bottom-3 left-3 right-3 z-40 bg-slate-950 text-white rounded-2xl border-2 border-[#FFDE00] p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                Total Charge
              </span>
              <span className="text-[11px] font-mono text-slate-300">
                · {totalCartUnits} {totalCartUnits === 1 ? 'Drink' : 'Drinks'}
              </span>
            </div>
            <div className="font-montserrat font-black text-2xl text-[#FFDE00] tabular-nums leading-none mt-1">
              {formatKes(subtotal)}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenPosPrompt}
              className="px-3.5 py-3 rounded-xl bg-[#34D186] hover:bg-[#1E9E60] active:scale-95 text-[#0A006E] border border-[#FFDE00]/50 font-montserrat font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Prompt</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobilePosTab('CHECKOUT');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-3 rounded-xl bg-[#FFDE00] hover:bg-amber-400 active:scale-95 text-[#0A006E] border border-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <span>Checkout</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Instant M-Pesa STK Push Prompt Modal (Triggered by Prompt Button on POS Bottom Nav) */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border-2 border-[#0A006E] animate-in zoom-in-95 duration-150">
            <div className="bg-[#0A006E] px-6 py-4 text-white flex items-center justify-between border-b-4 border-[#FFDE00]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#34D186] text-[#0A006E] flex items-center justify-center shadow-sm shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00] block">
                    Safaricom / Airtel STK Push
                  </span>
                  <h3 className="font-montserrat font-black italic text-base sm:text-lg text-white leading-tight">
                    Send Customer Payment Prompt
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Big Total Charge View in Prompt Modal */}
              <div className="p-4 rounded-2xl bg-slate-950 border-2 border-[#0A006E] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                    Total Charge to Prompt
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-0.5">
                    {totalCartUnits} {totalCartUnits === 1 ? 'item' : 'items'} · {activeBranch.name}
                  </div>
                </div>
                <div className="font-montserrat font-black text-2xl sm:text-3xl text-[#FFDE00] tabular-nums leading-none">
                  {formatKes(subtotal)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-montserrat font-black text-slate-800 uppercase tracking-wider">
                    Customer Mobile Number (10 Digits)
                  </label>
                  {(() => {
                    const c = detectKenyanMobileCarrier(customerPhone);
                    return (
                      <span className="text-[11px] font-mono font-bold text-[#0A006E]">
                        {c.carrier === 'SAFARICOM'
                          ? 'Safaricom M-Pesa'
                          : c.carrier === 'AIRTEL'
                          ? 'Airtel Money'
                          : 'KE'} · {c.digitsCount}/10
                      </span>
                    );
                  })()}
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoFocus
                  value={sanitizeAndControlKenyanMobileInput(customerPhone)}
                  onChange={e => {
                    setPromptModalError(null);
                    setCustomerPhone(sanitizeAndControlKenyanMobileInput(e.target.value));
                  }}
                  placeholder="0712345678"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-[#0A006E] rounded-xl font-mono font-black text-lg text-[#0A006E] tracking-wider focus:outline-none focus:ring-2 focus:ring-[#FFDE00]"
                />
              </div>

              {promptModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{promptModalError}</span>
                </div>
              )}

              {promptModalSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E9E60] shrink-0 mt-0.5" />
                  <span>{promptModalSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isProcessingStk || cart.length === 0}
                  onClick={() => void handleDispatchStkPromptFromModal(false)}
                  className="py-3.5 px-4 rounded-xl bg-[#34D186] hover:bg-[#1E9E60] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>{isProcessingStk ? 'Sending Prompt...' : 'Send STK Prompt'}</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessingStk || cart.length === 0}
                  onClick={() => void handleDispatchStkPromptFromModal(true)}
                  className="py-3.5 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] disabled:opacity-40 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Prompt &amp; Checkout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Drawer & Shift Reconciliation Modal — Strictly Visible ONLY to POS Cashier */}
      {isShiftModalOpen && isPosCashier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-base text-slate-900">
                    Station &amp; Cash Drawer Shift Control
                  </h3>
                  <p className="text-[11px] text-slate-500">Station: {shiftState.stationId} • {shiftState.cashierName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shift Metrics */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Shift Started At:</span>
                  <span className="font-mono font-bold text-slate-900">{shiftState.openedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Starting Float (Opening Cash):</span>
                  <span className="font-bold text-slate-900">{formatKes(shiftState.openingFloatKes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Sales Accumulated:</span>
                  <span className="font-bold text-[#1E9E60]">+{formatKes(shiftState.cashSalesKes)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-montserrat font-bold text-sm text-[#0A006E]">
                  <span>Total Expected in Drawer:</span>
                  <span>{formatKes(shiftState.expectedCashKes)}</span>
                </div>
              </div>

              {/* Adjust Opening Float */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs">Update Float Amount (KES):</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempFloatInput}
                    onChange={(e) => setTempFloatInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold"
                  />
                  <button
                    onClick={() => {
                      const newFloat = parseFloat(tempFloatInput) || 0;
                      setShiftState(prev => {
                        const updated = {
                          ...prev,
                          openingFloatKes: newFloat,
                          expectedCashKes: newFloat + prev.cashSalesKes
                        };
                        localStorage.setItem(`vaairo_shift_${activeBranch.id}`, JSON.stringify(updated));
                        return updated;
                      });
                      playBeep(880, 80);
                    }}
                    className="px-3.5 py-2 bg-[#0A006E] text-white rounded-xl font-bold text-xs"
                  >
                    Save Float
                  </button>
                </div>
              </div>

              {/* Count Cash for Z-Report */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 text-xs">Counted Physical Cash (Closing Drawer):</label>
                <input
                  type="number"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  placeholder={`Counted bills total (Expected ${shiftState.expectedCashKes})`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold"
                />
                {countedCashInput && (
                  <div className="flex justify-between text-xs p-2 rounded-lg bg-slate-100 font-medium mt-1">
                    <span>Cash Over / Short Variance:</span>
                    <span className={`font-bold ${
                      (parseFloat(countedCashInput) || 0) === shiftState.expectedCashKes
                        ? 'text-[#1E9E60]'
                        : 'text-red-700'
                    }`}>
                      {formatKes((parseFloat(countedCashInput) || 0) - shiftState.expectedCashKes)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  handleKickDrawer();
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Kick Drawer Open</span>
              </button>

              <button
                onClick={() => {
                  alert(`Z-Report Printed for ${shiftState.stationId}. Expected: ${formatKes(shiftState.expectedCashKes)}, Cash Sales: ${formatKes(shiftState.cashSalesKes)}. Ledgers reconciled.`);
                  setIsShiftModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-[#FFDE00]" />
                <span>Print Z-Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Staff Switch & 6-Digit PIN Prompt Modal */}
      {staffPinTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[32px] max-w-md w-full overflow-hidden shadow-2xl border-2 border-[#0A006E] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#0A006E] px-6 py-4 text-white flex items-center justify-between border-b-4 border-[#FFDE00]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-sm shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00] block">
                    POS Staff Security Verification
                  </span>
                  <h3 className="font-montserrat font-black italic text-base sm:text-lg text-white leading-tight">
                    Enter PIN for {staffPinTarget}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffPinTarget(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Select or Enter Specific Staff Member */}
              <div className="space-y-2">
                <label className="block text-[10px] font-montserrat font-black uppercase tracking-wider text-slate-500">
                  Select or Type Staff Member to Switch To:
                </label>
                {staffRosterList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {staffRosterList.map(staffName => {
                      const isTarget = staffPinTarget === staffName;
                      return (
                        <button
                          key={staffName}
                          type="button"
                          onClick={() => {
                            setStaffPinTarget(staffName);
                            setStaffSwitchPin('');
                            setStaffPinError('');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition border ${
                            isTarget
                              ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {staffName}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={staffPinTarget}
                  onChange={(e) => {
                    setStaffPinTarget(e.target.value);
                    setStaffPinError('');
                  }}
                  placeholder="Or type staff name..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              {/* 6-Digit PIN Display */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-[#0A006E]/40 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-montserrat font-bold text-slate-300">
                  <span className="text-[#FFDE00]">
                    PIN for {staffPinTarget}
                  </span>
                  <span className="font-mono text-white">{staffSwitchPin.length} / 6 Digits</span>
                </div>

                <div className="flex items-center justify-center gap-2 py-1">
                  {[0, 1, 2, 3, 4, 5].map(idx => {
                    const isFilled = staffSwitchPin.length > idx;
                    const isCurrent = staffSwitchPin.length === idx;
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-xl flex items-center justify-center text-xl font-mono font-black border-2 transition-all ${
                          isFilled
                            ? 'border-[#FFDE00] bg-[#FFDE00] text-[#0A006E] scale-105'
                            : isCurrent
                            ? 'border-[#FFDE00] bg-white/15 text-white ring-2 ring-[#FFDE00]/40'
                            : 'border-slate-700 bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isFilled ? '●' : ''}
                      </div>
                    );
                  })}
                </div>

                {staffPinError && (
                  <p className="text-[11px] text-red-400 text-center font-bold">{staffPinError}</p>
                )}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      setStaffPinError('');
                      setStaffSwitchPin(prev => (prev.length >= 6 ? prev : prev + digit));
                    }}
                    className={`py-3 rounded-2xl font-montserrat font-black text-lg border transition active:scale-95 ${
                      activePinKey === digit
                        ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                        : 'bg-slate-100 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200'
                    }`}
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setStaffPinError('');
                    setStaffSwitchPin('');
                  }}
                  className="py-3 rounded-2xl font-montserrat font-black text-xs uppercase bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStaffPinError('');
                    setStaffSwitchPin(prev => (prev.length >= 6 ? prev : prev + '0'));
                  }}
                  className={`py-3 rounded-2xl font-montserrat font-black text-lg border transition active:scale-95 ${
                    activePinKey === '0'
                      ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                      : 'bg-slate-100 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200'
                  }`}
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStaffSwitchPin(prev => prev.slice(0, -1));
                    setStaffPinError('');
                  }}
                  className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center justify-center transition"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => confirmStaffSwitchWithPin(staffSwitchPin, staffPinTarget)}
                disabled={staffSwitchPin.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-[#0A006E] hover:bg-[#060046] disabled:bg-slate-200 disabled:text-slate-400 text-[#FFDE00] font-montserrat font-black italic text-sm flex items-center justify-center gap-2 transition shadow-md"
              >
                <UserCheck className="w-4 h-4" />
                <span>Verify PIN &amp; Switch to {staffPinTarget}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Product Curtain Window: Left = Image Alone Aligned Left | Right = Optional mL Selection + Add to Cart Button */}
      {previewProduct && (() => {
        const baseInv = inventoryItems.find(
          i => i.productId === previewProduct.id && i.branchId === activeBranch.id
        );
        const stockOnHand = baseInv ? baseInv.bottlesOnHand : 0;
        const isOutOfStock = stockOnHand <= 0;
        const configuredProduct = buildVolumeVariantProduct(previewProduct, selectedVolumeMl);
        const unitBasePrice = isWholesaleStore
          ? configuredProduct.wholesalePriceKes
          : configuredProduct.retailPriceKes;
        const effectiveUnitPrice = unitBasePrice + previewMarkup;
        const totalPreviewPrice = effectiveUnitPrice * previewQty;

        const ALL_ML_OPTIONS = [
          ...ML_VOLUME_PRESETS.map(p => ({ ml: p.ml, label: `${p.ml} mL`, sub: p.sub })),
          ...LITER_VOLUME_PRESETS.map(p => ({ ml: p.ml, label: `${p.ml} mL`, sub: p.label }))
        ];

        return (
          <div
            onClick={() => setPreviewProduct(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-150"
          >
            {/* Mobile / Desktop Product Preview Window Panel (Aligned with Storefront Client-Side PDP) */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[32px] sm:rounded-3xl max-w-4xl w-full mx-auto my-0 sm:my-auto overflow-hidden shadow-2xl border-0 sm:border border-slate-200 h-[96dvh] sm:h-[88vh] max-h-[96dvh] sm:max-h-[88vh] flex flex-col md:flex-row items-stretch animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 relative"
            >
              {/* LARGE PRODUCT IMAGE HERO: Full Height & Prominent, Identical to Client-Side Storefront */}
              <div className="w-full md:w-[48%] h-72 sm:h-96 md:h-full bg-gradient-to-b from-slate-900 via-slate-950 to-black relative overflow-hidden shrink-0 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 group">
                {/* Ambient radial glow spotlight behind bottle */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700/25 via-slate-900/60 to-black pointer-events-none" />

                {/* Large Bottle Image Presentation — Large & Uncropped, Exactly Like Normal Client Side */}
                <div className="w-full h-full flex items-center justify-center p-6 sm:p-8 md:p-10 relative z-10">
                  <img
                    src={configuredProduct.image || getProductImageUrl(configuredProduct)}
                    alt={configuredProduct.name}
                    decoding="async"
                    onError={(e) => {
                      const driveId = extractGoogleDriveFileId(configuredProduct.image || '');
                      if (driveId && !(e.currentTarget.src || '').includes('lh3.googleusercontent.com')) {
                        e.currentTarget.src = `https://lh3.googleusercontent.com/d/${driveId}=w600`;
                        return;
                      }
                      e.currentTarget.src = generateStudioBottleSvgDataUri(configuredProduct);
                    }}
                    className={`max-h-[260px] sm:max-h-[340px] md:max-h-[460px] w-auto max-w-full object-contain object-center drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-105 select-none ${
                      isOutOfStock ? 'opacity-40 grayscale-[35%]' : ''
                    }`}
                  />
                </div>

                {/* Floating Top-Left SKU Badge & Category (Client Side style) */}
                <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-1 select-none pointer-events-none">
                  <span className="px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-xs border border-slate-200 text-[10px] font-mono font-bold text-slate-800 shadow-xs">
                    SKU: {configuredProduct.sku}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-montserrat font-bold text-[#FFDE00] border border-white/10 uppercase">
                    {configuredProduct.subCategory || previewProduct.category}
                  </span>
                </div>

                {/* Floating Top-Right Stock Badge + Mobile Close Button */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 select-none">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-montserrat font-black uppercase shadow-xs ${
                      isOutOfStock
                        ? 'bg-red-600 text-white'
                        : stockOnHand > 10
                        ? 'bg-emerald-100 text-[#1E9E60] border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isOutOfStock ? 'Out of Stock' : `In Stock (${stockOnHand})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewProduct(null)}
                    aria-label="Close Product Preview"
                    className="md:hidden w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/80 cursor-pointer shadow-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Floating Bottom Info Pill (Client Side style) */}
                <div className="absolute bottom-4 inset-x-4 z-20 text-center pointer-events-none select-none">
                  <span className="inline-block px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-montserrat font-bold text-white border border-white/20 shadow-md">
                    {previewProduct.brand} • {configuredProduct.volumeMl}ml ({configuredProduct.alcoholPercentage}% ABV)
                  </span>
                </div>
              </div>

              {/* RIGHT SIDE: Product Info + Scrollable Options + Floating Constant Action Bar */}
              <div className="w-full md:w-[52%] flex flex-col h-full bg-white relative overflow-hidden">
                {/* Top Header: Brand, Title, Pricing & Desktop Close Button (Pinned at top) */}
                <div className="border-b border-slate-100 p-4 sm:p-5 shrink-0 bg-white z-10">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-montserrat font-black uppercase px-2.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00]">
                          {previewProduct.brand}
                        </span>
                        <span className="text-[10px] font-montserrat font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {configuredProduct.subCategory || previewProduct.category}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          stockOnHand > 10
                            ? 'bg-emerald-50 text-[#1E9E60] border border-emerald-200'
                            : stockOnHand > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {stockOnHand} in stock at {activeBranch.name.split(' ')[0]}
                        </span>
                      </div>

                      <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900 leading-snug">
                        {configuredProduct.name}
                      </h3>

                      <div className="flex flex-wrap items-baseline gap-2 mt-1">
                        <span
                          className="font-montserrat font-black text-2xl sm:text-3xl text-[#0A006E] tracking-tight drop-shadow-xs"
                          style={{ fontWeight: 900 }}
                        >
                          {formatKes(effectiveUnitPrice)}
                        </span>
                        <span className="text-xs font-mono font-black text-slate-600" style={{ fontWeight: 900 }}>
                          ({formatVolumeBadgeText(selectedVolumeMl)})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewProduct(null)}
                      className="hidden md:inline-flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                      title="Close Preview"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Options Body (Options scroll smoothly while Floating Action Bar stays constant at bottom) */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 pb-6">
                  {/* Optional mL Selection */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <label className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                        Optional mL Selection
                      </label>
                      <span className="text-[10px] font-mono font-bold text-[#1E9E60] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Default: {previewProduct.volumeMl} mL
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {ALL_ML_OPTIONS.map(opt => {
                        const isSelected = selectedVolumeMl === opt.ml;
                        const isDefault = previewProduct.volumeMl === opt.ml;
                        const optProd = buildVolumeVariantProduct(previewProduct, opt.ml);
                        const optPrice = isWholesaleStore ? optProd.wholesalePriceKes : optProd.retailPriceKes;

                        return (
                          <button
                            key={opt.ml}
                            type="button"
                            onClick={() => handleSelectVolumePreset(opt.ml, opt.ml >= 1000 ? 'L' : 'ML')}
                            className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-2 border-[#0A006E] bg-[#0A006E] text-white shadow-xs'
                                : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-[#0A006E]/50 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-montserrat font-black text-[11px] ${isSelected ? 'text-[#FFDE00]' : 'text-[#0A006E]'}`}>
                                {opt.label}
                              </span>
                              {isDefault && (
                                <span className={`text-[8px] font-mono font-bold px-1 rounded ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-[#1E9E60]'
                                }`}>
                                  STD
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-mono font-black text-xs mt-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}
                              style={{ fontWeight: 900 }}
                            >
                              {formatKes(optPrice)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Optional mL Input */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-montserrat font-bold text-slate-600">
                        Custom mL (Optional):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={50}
                          step={50}
                          value={volumeUnitMode === 'L' ? Math.round(selectedVolumeMl) : customVolumeInput}
                          onChange={(e) => handleCustomVolumeChange(e.target.value, 'ML')}
                          className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
                          placeholder="750"
                        />
                        <span className="text-[10px] font-mono font-black text-[#0A006E]">mL</span>
                        {selectedVolumeMl !== previewProduct.volumeMl && (
                          <button
                            type="button"
                            onClick={() => handleSelectVolumePreset(previewProduct.volumeMl, 'ML')}
                            className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-montserrat font-bold transition"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Branch-Specific Preferred Selling Price Control (e.g. Donholm vs Kilimani / Westlands) */}
                    {(currentRole === 'SUPER_ADMIN' || currentDepartment === 'BRANCH_MANAGER' || currentDepartment === 'SALES_MANAGER') && (
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-300 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[10px] font-montserrat font-black uppercase text-emerald-950">
                            Branch Preferred Price for {activeBranch.name} ({activeBranch.location})
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            Catalog Baseline: {formatKes(previewProduct.retailPriceKes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-500">
                              KES
                            </span>
                            <input
                              type="number"
                              min={previewProduct.warehouseCostKes}
                              step={10}
                              value={unitBasePrice}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (!Number.isNaN(val) && val >= previewProduct.warehouseCostKes) {
                                  setBranchProductPreferredPrice(activeBranch.id, previewProduct.id, {
                                    retailPriceKes: isWholesaleStore ? undefined : val,
                                    wholesalePriceKes: isWholesaleStore ? val : undefined
                                  });
                                }
                              }}
                              className="w-full pl-9 pr-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg font-mono font-black text-xs text-slate-900"
                            />
                          </div>
                          {activeBranch.preferredProductPrices?.[previewProduct.id] && (
                            <button
                              type="button"
                              onClick={() =>
                                setBranchProductPreferredPrice(activeBranch.id, previewProduct.id, {
                                  retailPriceKes: null,
                                  wholesalePriceKes: null
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[10px] font-montserrat font-bold cursor-pointer"
                            >
                              Reset to Branch Tier
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-emerald-900">
                          Sets the official selling price of this drink specifically at <strong>{activeBranch.name}</strong> without changing other branches.
                        </p>
                      </div>
                    )}

                    {/* Sales Affiliate Preferred Selling Price Box (Without Affecting Company Price) */}
                    {(activeSalesLadyAffiliate ? activeSalesLadyAffiliate.allowPreferredPrice !== false : defaultAllowPreferredPrice) && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[10px] font-montserrat font-black uppercase text-[#0A006E]">
                            Affiliate Preferred Selling Price (Company Price Protected)
                          </span>
                          <span
                            className="text-[11px] font-mono font-black text-[#1E9E60] bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300"
                            style={{ fontWeight: 900 }}
                          >
                            Company Price: {formatKes(unitBasePrice)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-700">Sell At (KES):</span>
                            <input
                              type="number"
                              min={unitBasePrice}
                              step={50}
                              value={effectiveUnitPrice}
                              onChange={(e) => {
                                const enteredPref = parseFloat(e.target.value);
                                if (!isNaN(enteredPref)) {
                                  setPreviewMarkup(Math.max(0, Math.round(enteredPref - unitBasePrice)));
                                } else {
                                  setPreviewMarkup(0);
                                }
                              }}
                              className="w-28 px-2.5 py-1 bg-white border-2 border-[#0A006E] rounded-lg font-mono font-black text-xs text-[#0A006E] text-right"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            {[0, 100, 250, 500].map(addProfit => (
                              <button
                                key={addProfit}
                                type="button"
                                onClick={() =>
                                  setPreviewMarkup(prev => (addProfit === 0 ? 0 : prev + addProfit))
                                }
                                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[10px] border transition active:scale-95 cursor-pointer select-none ${
                                  addProfit === 0 && previewMarkup === 0
                                    ? 'bg-[#34D186] text-[#FFDE00] border-[#34D186]'
                                    : addProfit > 0 && previewMarkup > 0
                                    ? 'bg-white hover:bg-[#34D186] hover:text-[#FFDE00] text-[#1E9E60] border-emerald-400 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                                title={
                                  addProfit === 0
                                    ? 'Reset to Company Price'
                                    : `Add +KES ${addProfit} (tap multiple times to keep increasing)`
                                }
                              >
                                {addProfit === 0 ? 'Company' : `+${addProfit}`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-200/80">
                          <span className="text-slate-600 font-medium">
                            Separated Affiliate Profit (What Affiliate Earns):
                          </span>
                          <span
                            className="font-montserrat font-black text-sm text-[#1E9E60]"
                            style={{ fontWeight: 900 }}
                          >
                            +{formatKes(previewMarkup * previewQty)} ({formatKes(previewMarkup)}/unit)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* FLOATING CONSTANT ACTION BAR: Quantity + Amount + Add to Cart Button (Fixed/Sticky & Constant on Scroll) */}
                <div className="shrink-0 bg-white/98 backdrop-blur-md border-t border-slate-200 p-3.5 sm:p-4 shadow-[0_-12px_32px_rgba(0,0,0,0.14)] space-y-2.5 z-30">
                  <div className="flex items-center justify-between gap-3">
                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-montserrat font-black uppercase text-slate-500">
                        Qty:
                      </span>
                      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setPreviewQty(q => Math.max(1, q - 1))}
                          className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 font-bold transition active:scale-95 cursor-pointer"
                          title="Decrease Quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3.5 py-1.5 text-xs font-mono font-black text-slate-900 bg-white min-w-[2.25rem] text-center" style={{ fontWeight: 900 }}>
                          {previewQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewQty(q => q + 1)}
                          className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 font-bold transition active:scale-95 cursor-pointer"
                          title="Increase Quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Total Amount Display — Floating & Constant in Real-Time */}
                    <div className="text-right min-w-0">
                      <span className="text-[10px] font-mono uppercase font-black text-slate-500 block truncate tracking-wide">
                        Amount ({previewQty} × {selectedVolumeMl}mL)
                      </span>
                      <span
                        className="font-montserrat font-black text-2xl sm:text-3xl text-[#1E9E60] block leading-tight tracking-tight drop-shadow-xs"
                        style={{ fontWeight: 900 }}
                      >
                        {formatKes(totalPreviewPrice)}
                      </span>
                      {previewMarkup > 0 && (
                        <span className="text-[10px] font-mono font-black text-amber-700 block" style={{ fontWeight: 900 }}>
                          (+{formatKes(previewMarkup * previewQty)} profit)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add to Cart & Mobile Instant Checkout Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewProduct(null)}
                      className="hidden sm:inline-flex px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-montserrat font-bold transition cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={isWarehouse || isOutOfStock}
                      onClick={() => {
                        if (isOutOfStock) {
                          showErrorFeedback('Out of Stock', `${configuredProduct.name} is out of stock.`);
                          playBeep(300, 150);
                          return;
                        }
                        addToCart(configuredProduct, previewQty, previewMarkup);
                        playBeep(1200, 70);
                        showSuccessFeedback(
                          'Added to Cart!',
                          `${previewQty} × ${configuredProduct.name} (${selectedVolumeMl} mL)`,
                          `Total: ${formatKes(totalPreviewPrice)}`
                        );
                        setBarcodeFeedback(
                          `Added ${previewQty} × ${configuredProduct.name} (${selectedVolumeMl} mL) to cart`
                        );
                        setTimeout(() => setBarcodeFeedback(null), 4000);
                        setPreviewProduct(null);
                      }}
                      className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      <ShoppingCart className="w-4 h-4 shrink-0 fill-current" />
                      <span>
                        {isOutOfStock ? (
                          'Out of Stock'
                        ) : (
                          <>
                            Add to Cart • <strong className="font-montserrat font-black tracking-tight" style={{ fontWeight: 900 }}>{formatKes(totalPreviewPrice)}</strong>
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isWarehouse || isOutOfStock}
                      onClick={() => {
                        if (isOutOfStock) {
                          showErrorFeedback('Out of Stock', `${configuredProduct.name} is out of stock.`);
                          playBeep(300, 150);
                          return;
                        }
                        addToCart(configuredProduct, previewQty, previewMarkup);
                        playBeep(1320, 90);
                        showSuccessFeedback(
                          'Added to Cart!',
                          `Proceeding to Checkout with ${configuredProduct.name}`,
                          formatKes(totalPreviewPrice)
                        );
                        setPreviewProduct(null);
                        setMobilePosTab('CHECKOUT');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="sm:hidden px-3.5 py-3 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1 shrink-0 shadow-md disabled:opacity-40 cursor-pointer"
                    >
                      <span>Checkout</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Camera Barcode Scanner Modal (POS Selling Mode: Auto-pins scanned barcode to product & adds to POS Cart) */}
      {isCameraModalOpen && (
        <BarcodeScannerModal
          mode="SINGLE"
          purpose="POS_SELL"
          onPosProductScanned={(product, qtyToAdd, rawBarcode) => {
            const baseProdId = product.id.includes('-vol-') ? product.id.split('-vol-')[0] : product.id;
            const inv = inventoryItems.find(i => i.productId === baseProdId && i.branchId === activeBranch.id);
            const stock = inv ? inv.bottlesOnHand : 0;
            const existingInCart = cart
              .filter(c => (c.product.id.includes('-vol-') ? c.product.id.split('-vol-')[0] : c.product.id) === baseProdId)
              .reduce((s, c) => s + c.quantity, 0);

            if (stock <= 0 || existingInCart + qtyToAdd > stock) {
              setBarcodeFeedback(`⚠️ Insufficient stock for ${product.name}: ${stock} btls available.`);
              showErrorFeedback('Insufficient Stock', `${product.name} only has ${stock} btls available`);
              playBeep(300, 150);
              return;
            }
            addToCart(product, qtyToAdd, 0);
            playBeep(1200, 70);
            showSuccessFeedback(
              'Scanned & Added!',
              `${qtyToAdd} × ${product.name}`,
              `Barcode: ${rawBarcode}`
            );
            const remainingAfterCart = Math.max(0, stock - (existingInCart + qtyToAdd));
            setLastPinnedPosScan({
              product,
              scannedCode: rawBarcode,
              isCaseScan: qtyToAdd > 1,
              qtyAdded: qtyToAdd,
              stockOnHand: stock,
              remainingAfterCart
            });
            setBarcodeFeedback(
              `✓ Camera Auto-Pinned [${rawBarcode}] → ${product.name} (+${qtyToAdd} added to cart • ${remainingAfterCart} btls left)`
            );
          }}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}

      {/* 80mm Thermal Order Queue & Pending Payment Receipt Modal */}
      {printingQueueTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-[#0A006E] animate-in zoom-in-95 duration-150">
            <div className="bg-[#0A006E] text-white p-4 flex items-center justify-between border-b-4 border-[#FFDE00]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-montserrat font-black text-xs">
                  80MM
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm tracking-wide">
                    THERMAL ORDER &amp; HOLD SLIP
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Counter Queue Ticket • Pending Payment / Pay on Collection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintingQueueTicket(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 font-mono text-xs space-y-3.5 bg-slate-50/60">
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                <h2 className="font-montserrat font-black italic text-base text-slate-900">
                  VAAIRO BEVERAGES &amp; DISTRIBUTION LTD
                </h2>
                <p className="text-[11px] text-slate-600">{activeBranch.name} ({activeBranch.code})</p>
                <p className="text-[11px] text-slate-600">KRA PIN: <strong className="text-slate-900">{activeBranch.kraPin}</strong></p>
                <div className="mt-1.5 inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 font-montserrat font-black text-[10px] uppercase">
                  {printingQueueTicket.paymentOption === 'PRINT_RECEIPT_AND_HOLD'
                    ? 'ON HOLD • PENDING PAYMENT'
                    : 'COUNTER QUEUE • PAY ON COLLECTION'}
                </div>
              </div>

              <div className="space-y-1 text-slate-700 border-b border-dashed border-slate-300 pb-2.5">
                <div className="flex justify-between">
                  <span>QUEUE TICKET NO:</span>
                  <span className="font-black text-[#0A006E]">{printingQueueTicket.holdNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIME LOGGED:</span>
                  <span>{printingQueueTicket.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span>SALES REPRESENTATIVE:</span>
                  <span className="font-bold text-[#1E9E60]">
                    {printingQueueTicket.affiliateName || printingQueueTicket.heldByName}
                  </span>
                </div>
                {printingQueueTicket.targetCashierName && (
                  <div className="flex justify-between">
                    <span>POS CASHIER COUNTER:</span>
                    <span className="font-bold text-[#0A006E]">
                      {printingQueueTicket.targetCashierName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>COUNTER STATUS:</span>
                  <span className="font-bold text-[#0A006E]">
                    {printingQueueTicket.queueStatus === 'READY_FOR_COLLECTION'
                      ? 'READY FOR COLLECTION'
                      : printingQueueTicket.queueStatus === 'PREPARING_DRINKS'
                      ? 'PREPARING DRINKS'
                      : 'ON HOLD (PENDING PAYMENT)'}
                  </span>
                </div>
                {printingQueueTicket.customerName && (
                  <div className="flex justify-between">
                    <span>CUSTOMER / TABLE:</span>
                    <span className="font-bold">{printingQueueTicket.customerName}</span>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-slate-300 pb-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px]">
                      <th className="pb-1">DRINK / VOLUME</th>
                      <th className="pb-1 text-center">QTY</th>
                      <th className="pb-1 text-right">TOTAL (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {printingQueueTicket.items.map((item, idx) => (
                      <tr key={idx} className="text-slate-900">
                        <td className="py-1.5">
                          <div className="font-bold">{item.product.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {formatVolumeBadgeText(item.product.volumeMl)} • @{formatKes(item.unitPrice)}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                        <td className="py-1.5 text-right font-bold">
                          {formatKes(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-slate-800 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between text-slate-600">
                  <span>TAXABLE NET (EXCL. VAT):</span>
                  <span>{formatKes(Math.round(printingQueueTicket.totalKes / 1.16))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>16% VAT:</span>
                  <span>{formatKes(printingQueueTicket.totalKes - Math.round(printingQueueTicket.totalKes / 1.16))}</span>
                </div>
                <div className="flex justify-between text-sm font-montserrat font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>AMOUNT PAYABLE:</span>
                  <span className="text-[#0A006E]">{formatKes(printingQueueTicket.totalKes)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-bold text-slate-800">
                  PRESENT THIS SLIP AT THE COUNTER WHEN COLLECTING DRINKS OR SETTLING PAYMENT
                </p>
                <p>Order held in Counter Cashier Queue until payment is completed.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrintingQueueTicket(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-200 font-montserrat font-bold text-xs transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-md transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Representative Previous Sales Records Modal in POS */}
      {isRepHistoryModalOpen && activeSalesLadyAffiliate && (() => {
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

        const filteredRepOrders = activeRepPreviousOrders.filter(o => {
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

        const totalBottles = filteredRepOrders.reduce(
          (s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0),
          0
        );
        const totalGross = filteredRepOrders.reduce((s, o) => s + o.totalKes, 0);
        const totalCompany = filteredRepOrders.reduce(
          (s, o) => s + (o.companySalesKes ?? o.totalKes - (o.affiliateMarkupTotalKes || 0)),
          0
        );
        const totalMarkupProfit = filteredRepOrders.reduce(
          (s, o) => s + (o.affiliateMarkupTotalKes || 0),
          0
        );
        const totalBaseComm = filteredRepOrders.reduce(
          (s, o) => s + (o.affiliateBaseCommissionKes || 0),
          0
        );
        const totalEarned = filteredRepOrders.reduce(
          (s, o) => s + (o.affiliateTotalEarnedKes ?? (o.affiliateMarkupTotalKes || 0) + (o.affiliateBaseCommissionKes || 0)),
          0
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-none sm:rounded-3xl max-w-5xl w-full h-dvh sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col">
              <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b-4 border-[#FFDE00] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-montserrat font-black italic text-base sm:text-lg text-white">
                        Previous Sales Records — {activeSalesLadyAffiliate.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-mono font-black text-[11px]">
                        {activeSalesLadyAffiliate.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/15 text-white font-montserrat font-bold text-[10px]">
                        Sales Representative
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Complete record of previous POS sales, customer drinks sold, separated preferred price profit &amp; 16% VAT receipts.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepHistoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-montserrat font-black uppercase text-slate-500">
                      Previous Sales Count
                    </div>
                    <div className="font-montserrat font-black text-xl text-slate-900 mt-1">
                      {filteredRepOrders.length} Orders
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {totalBottles} Bottles Sold
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
                      Pending Payout: {formatKes(activeSalesLadyAffiliate.pendingCommissionKes || 0)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                    {(
                      [
                        { id: 'ALL', label: `All Previous (${activeRepPreviousOrders.length})` },
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

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[360px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-montserrat font-black uppercase text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-4">Order # &amp; Date</th>
                          <th className="py-3 px-3">Customer</th>
                          <th className="py-3 px-3">Drinks Sold</th>
                          <th className="py-3 px-3 text-right">Company Price</th>
                          <th className="py-3 px-3 text-right">Price Profit</th>
                          <th className="py-3 px-3 text-right">Rep Earned</th>
                          <th className="py-3 px-3 text-right">Customer Paid</th>
                          <th className="py-3 px-4 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredRepOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-500">
                              No previous sales records found for <strong>{activeSalesLadyAffiliate.name}</strong>.
                            </td>
                          </tr>
                        ) : (
                          filteredRepOrders.map(order => {
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-black text-[#0A006E]">{order.orderNumber}</span>
                                    {order.checkoutRole === 'SALES_REP_SELF_CHECKOUT' ? (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                        Self-Checkout
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[9px] font-bold">
                                        Counter Cashier: {order.cashierName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-500">
                                    {new Date(order.createdAt).toLocaleString()}
                                  </div>
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
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-800">
                                        <span className="font-bold">{item.quantity}× {item.productName}</span>
                                        <span className="text-[10px] font-mono text-slate-500 ml-1">
                                          (@{formatKes(item.unitPrice)})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-[#0A006E] tabular-nums">
                                  {formatKes(companyPortion)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-[#1E9E60] tabular-nums">
                                  {markupProfit > 0 ? `+${formatKes(markupProfit)}` : formatKes(0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 tabular-nums">
                                  +{formatKes(totalEarnedOrder)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                                  {formatKes(order.totalKes)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {isMultiItemOrder(order.items) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveOrderItemsDocument(
                                            buildOrderDocumentFromSaleOrder(order)
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-bold text-[10px] inline-flex items-center gap-1 transition cursor-pointer"
                                        title="Generate Ordered Items Document"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span>Items Doc</span>
                                      </button>
                                    )}
                                    {matchedInv ? (
                                      <button
                                        type="button"
                                        onClick={() => setLastCompletedInvoice(matchedInv)}
                                        className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[10px] inline-flex items-center gap-1 transition cursor-pointer"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span>Receipt</span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-mono text-slate-400">Verified</span>
                                    )}
                                  </div>
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

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-600">
                  Showing <strong>{filteredRepOrders.length}</strong> of <strong>{activeRepPreviousOrders.length}</strong> previous sales records
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepHistoryModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trigger printable 16% VAT Tax Invoice Receipt Modal */}
      {lastCompletedInvoice && (
        <EtimsReceiptModal
          invoice={lastCompletedInvoice}
          order={lastOrder}
          onClose={() => setLastCompletedInvoice(null)}
        />
      )}

      {/* Official Ordered Items List Document Modal (Multi-Item Orders) */}
      {activeOrderItemsDocument && (
        <OrderItemsDocumentModal
          document={activeOrderItemsDocument}
          onClose={() => setActiveOrderItemsDocument(null)}
        />
      )}

      {/* Center Screen Animated Feedback (Tick on Success / X on Error) */}
      <CenterScreenFeedback
        feedback={centerFeedback}
        onDismiss={() => setCenterFeedback(null)}
      />

    </div>
  );
};
