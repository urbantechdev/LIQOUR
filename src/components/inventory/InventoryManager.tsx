import React, { useState, useEffect, useRef } from 'react';
import { useErp } from '../../context/ErpContext';
import { StockCategory, Product, SupplyInvoice } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { StockAuditSessionPanel } from './StockAuditSessionPanel';
import { 
  Boxes, 
  Barcode, 
  Camera, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  Ban, 
  RefreshCw,
  Building2,
  PackageCheck,
  Archive,
  Save,
  Users,
  Trash2,
  Eye,
  Printer,
  Calendar,
  Bell,
  Minus,
  XCircle,
  X,
  Globe,
  DownloadCloud,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  Bluetooth,
  Smartphone,
  Zap,
  Pencil,
  HardDrive,
  Link2,
  RotateCcw,
  Menu
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BarcodeOnboardingWizardModal } from './BarcodeOnboardingWizardModal';
import { OnboardingCenterModal, OnboardingTabType } from '../common/OnboardingCenterModal';
import { ProductImage } from '../common/ProductImage';
import { ProductImageSourcePicker } from '../common/ProductImageSourcePicker';
import {
  STUDIO_IMAGE_PRESETS,
  getProductImageUrl,
  generateStudioBottleSvgDataUri,
  compressImageFileToDataUrl,
  normalizeProductImageUrl
} from '../../utils/productImages';
import {
  NAIROBI_DRINKS_PRODUCTS,
  NAIROBI_DRINKS_SUB_CATEGORIES
} from '../../data/nairobiDrinksCatalog';

export const InventoryManager: React.FC = () => {
  const { 
    products, 
    inventoryItems, 
    activeBranch, 
    branches, 
    switchBranch, 
    scanHistory, 
    activeScanBatchId, 
    startNewScanBatch,
    adjustStockManually,
    updateInventoryBatchExpiry,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductImage,
    cloneNairobiDrinksCatalog,
    cloneNairobiDrinksFromUrl,
    suppliers,
    addSupplier,
    supplyInvoices,
    createSupplyInvoice,
    addProductsUnderInvoice,
    instantScanOnboardProduct,
    brandPriceRules,
    restockRequests,
    createRestockRequest,
    warehouseDisburseStock,
    triggerWarehouseAutoDisburseForAllLowStockShops,
    updateRestockRequestItemQty,
    removeUnavailableItemFromRestockRequest,
    removeAllUnavailableItemsFromRequest,
    acceptAndFulfillRestockRequest,
    rejectRestockRequest
  } = useErp();

  const [activeCategory, setActiveCategory] = useState<StockCategory | 'ALL'>('ALL');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('ALL');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>('ALL');
  const [stockAvailabilityFilter, setStockAvailabilityFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CREAM_FEFO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerModalMode, setScannerModalMode] = useState<'SINGLE' | 'BULK' | null>(null);
  const [isBarcodeWizardOpen, setIsBarcodeWizardOpen] = useState<boolean>(false);
  const [wizardInitialBarcode, setWizardInitialBarcode] = useState<string>('');
  const [wizardInitialProductId, setWizardInitialProductId] = useState<string>('');
  const [wizardInitialPieces, setWizardInitialPieces] = useState<number | undefined>(undefined);
  const [wizardInitialStep, setWizardInitialStep] = useState<1 | 2 | 3 | 4 | undefined>(undefined);
  const [productIndicatedPiecesMap, setProductIndicatedPiecesMap] = useState<Record<string, number>>({});
  const [productDirectBarcodeMap, setProductDirectBarcodeMap] = useState<Record<string, string>>({});
  const productScanTimersRef = useRef<Record<string, number>>({});
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Batch Manufacturing & Expiry Date (FEFO) Modal State for Cream Liqueurs & Stock Rotation
  const [editingBatchProduct, setEditingBatchProduct] = useState<Product | null>(null);
  const [batchNumInput, setBatchNumInput] = useState('');
  const [batchMfgDateInput, setBatchMfgDateInput] = useState('2025-11-01');
  const [batchExpDateInput, setBatchExpDateInput] = useState('2027-11-01');

  // NairobiDrinks.co.ke Clone Modal State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneUrlInput, setCloneUrlInput] = useState('https://nairobidrinks.co.ke/product/');
  const [cloneUrlPrice, setCloneUrlPrice] = useState<number>(3500);
  const [cloneUrlCases, setCloneUrlCases] = useState<number>(10);
  const [cloneModalSubCat, setCloneModalSubCat] = useState<string>('ALL');
  const [cloneWhCases, setCloneWhCases] = useState<number>(15);
  const [cloneShopCases, setCloneShopCases] = useState<number>(4);

  // Onboarding Center Modal State
  const [onboardingTab, setOnboardingTab] = useState<OnboardingTabType | null>(null);

  // 1. Create Invoice Modal State
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [invSupplierId, setInvSupplierId] = useState(suppliers[0]?.id || '');
  const [invCustomSupplierName, setInvCustomSupplierName] = useState('');
  const [invBranchId, setInvBranchId] = useState(activeBranch.id);
  const [invCustomNumber, setInvCustomNumber] = useState('');
  const [invDeliveryDate, setInvDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
  const [invPackingList, setInvPackingList] = useState('');
  const [invTruckReg, setInvTruckReg] = useState('');
  const [invSealNumber, setInvSealNumber] = useState('');
  const [invPaymentMethod, setInvPaymentMethod] = useState<'RTGS' | 'BANK_TRANSFER' | 'MPESA' | 'CHEQUE'>('RTGS');
  const [invNotes, setInvNotes] = useState('');

  // 2. Select Invoice & Create Products Modal State
  const [isInvoiceProductModalOpen, setIsInvoiceProductModalOpen] = useState(false);
  const [selectedTargetInvoiceId, setSelectedTargetInvoiceId] = useState<string>(supplyInvoices[0]?.id || '');

  // Keep selectedTargetInvoiceId synced to the latest created invoice when accountant creates a new invoice
  useEffect(() => {
    if (supplyInvoices.length > 0 && (!selectedTargetInvoiceId || !supplyInvoices.some(inv => inv.id === selectedTargetInvoiceId))) {
      setSelectedTargetInvoiceId(supplyInvoices[0].id);
    }
  }, [supplyInvoices, selectedTargetInvoiceId]);

  // Instant Scan Product Onboarding State (1. Select Invoice -> 2. Select Brand -> 3. Choose ML -> 4. Scan) — Open by default at top of Inventory
  const [isInstantScanOpen, setIsInstantScanOpen] = useState<boolean>(false);
  const [isIncomingOrdersOpen, setIsIncomingOrdersOpen] = useState<boolean>(false);
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState<boolean>(false);

  // Easy Inline Spreadsheet Edit Mode, Lite Mode & Pagination State
  const [isInlineEditMode, setIsInlineEditMode] = useState<boolean>(false);
  const [showProductThumbnails, setShowProductThumbnails] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(40);
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [recentlySavedRows, setRecentlySavedRows] = useState<Record<string, string>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkStockBottlesInput, setBulkStockBottlesInput] = useState<string>('');
  const [bulkRetailPriceInput, setBulkRetailPriceInput] = useState<string>('');
  const [bulkSubCategoryInput, setBulkSubCategoryInput] = useState<string>('');

  // Quick Inline Add Product Row State
  const [isQuickAddRowOpen, setIsQuickAddRowOpen] = useState<boolean>(false);
  const [quickAddForm, setQuickAddForm] = useState<{
    name: string;
    brand: string;
    sku: string;
    category: StockCategory;
    subCategory: string;
    volumeMl: number;
    packSize: number;
    bottlesOnHand: number;
    warehouseCostKes: number;
    wholesalePriceKes: number;
    retailPriceKes: number;
    barcode: string;
  }>({
    name: '',
    brand: '',
    sku: '',
    category: 'IPS',
    subCategory: 'Whisky',
    volumeMl: 750,
    packSize: 12,
    bottlesOnHand: 24,
    warehouseCostKes: 2200,
    wholesalePriceKes: 2700,
    retailPriceKes: 3200,
    barcode: ''
  });

  const markProductRowSaved = (productId: string, label = 'Saved') => {
    setRecentlySavedRows(prev => ({ ...prev, [productId]: label }));
    window.setTimeout(() => {
      setRecentlySavedRows(prev => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
    }, 2200);
  };

  const handleInlineFieldUpdate = (
    product: Product,
    updates: Partial<Omit<Product, 'id'>>,
    updatedBranchBottles?: number,
    saveLabel = 'Saved'
  ) => {
    updateProduct(product.id, updates, updatedBranchBottles);
    markProductRowSaved(product.id, saveLabel);
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleQuickAddRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) return;
    const autoSku =
      quickAddForm.sku.trim().toUpperCase() ||
      `SKU-${quickAddForm.category}-${Date.now().toString().slice(-4)}`;
    const autoBrand = quickAddForm.brand.trim() || quickAddForm.name.trim().split(' ')[0] || 'Premium';
    const packSize = Math.max(1, quickAddForm.packSize || 12);
    const created = addProduct(
      {
        name: quickAddForm.name.trim(),
        brand: autoBrand,
        sku: autoSku,
        barcode: quickAddForm.barcode.trim() || `616${Date.now().toString().slice(-10)}`,
        caseBarcode: `1616${Date.now().toString().slice(-10)}`,
        category: quickAddForm.category,
        subCategory: quickAddForm.subCategory,
        volumeMl: quickAddForm.volumeMl || 750,
        alcoholPercentage: 40,
        packSize,
        countryOfOrigin: quickAddForm.category === 'IPS' ? 'Imported' : 'Kenya',
        warehouseCostKes: Math.max(0, quickAddForm.warehouseCostKes),
        wholesalePriceKes: Math.max(0, quickAddForm.wholesalePriceKes),
        retailPriceKes: Math.max(1, quickAddForm.retailPriceKes),
        minWholesaleQty: 6,
        vatRate: 0.16,
        exciseDutyPerLitreKes: 356.4,
        kraExciseStampType:
          quickAddForm.category === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
        importDeclarationNumber:
          quickAddForm.category === 'IPS'
            ? `IDF/2026/NRB/${Date.now().toString().slice(-5)}`
            : undefined,
        image: getProductImageUrl({
          name: quickAddForm.name.trim(),
          brand: autoBrand,
          category: quickAddForm.category,
          subCategory: quickAddForm.subCategory
        })
      },
      0
    );
    updateProduct(created.id, {}, Math.max(0, quickAddForm.bottlesOnHand));
    markProductRowSaved(created.id, 'Added!');
    setFeedbackBanner(
      `✓ Added "${created.name}" (${created.sku}) with ${quickAddForm.bottlesOnHand} btls at ${activeBranch.name}!`
    );
    setTimeout(() => setFeedbackBanner(null), 4000);
    setQuickAddForm({
      name: '',
      brand: '',
      sku: '',
      category: 'IPS',
      subCategory: 'Whisky',
      volumeMl: 750,
      packSize: 12,
      bottlesOnHand: 24,
      warehouseCostKes: 2200,
      wholesalePriceKes: 2700,
      retailPriceKes: 3200,
      barcode: ''
    });
    setIsQuickAddRowOpen(false);
  };
  const [instantTargetProductId, setInstantTargetProductId] = useState<string>('');
  const [instantSelectedBrandGroup, setInstantSelectedBrandGroup] = useState<string>('ALL');
  const [instantBrand, setInstantBrand] = useState<string>('Johnnie Walker Black Label');
  const [instantVolumeMl, setInstantVolumeMl] = useState<number>(750);
  const [instantRetailPrice, setInstantRetailPrice] = useState<number>(4200);
  const [instantScanUnitMode, setInstantScanUnitMode] = useState<'CASE' | 'BOTTLE'>('BOTTLE');
  const [instantCasesQty, setInstantCasesQty] = useState<number>(12);
  const [instantScannerSource, setInstantScannerSource] = useState<'BLUETOOTH' | 'MOBILE_CAMERA'>('BLUETOOTH');
  const [instantBarcodeInput, setInstantBarcodeInput] = useState<string>('');
  const [instantCustomImage, setInstantCustomImage] = useState<string>('');
  const [showInstantImagePicker, setShowInstantImagePicker] = useState<boolean>(false);
  const [instantCameraError, setInstantCameraError] = useState<string | null>(null);
  const [instantCameraActive, setInstantCameraActive] = useState<boolean>(false);
  const [isAwaitingNextInstantScan, setIsAwaitingNextInstantScan] = useState<boolean>(false);
  const [autoPinnedScanInfo, setAutoPinnedScanInfo] = useState<{
    productId: string;
    rawBarcode: string;
    previousBottlesOnHand: number;
    newBottlesOnHand: number;
    bottlesAdded: number;
    assetValueAddedKes: number;
    newTotalProductAssetKes: number;
    scannedAt: string;
  } | null>(null);
  const [instantLoadedFeed, setInstantLoadedFeed] = useState<
    Array<{
      id: string;
      product: Product;
      invoiceNumber: string;
      bottlesAdded: number;
      casesAdded: number;
      previousBottlesOnHand: number;
      newBottlesOnHand: number;
      assetValueAddedKes: number;
      newTotalProductAssetKes: number;
      scannedBarcode: string;
      time: string;
      isExistingUpdated: boolean;
    }>
  >([]);

  const bluetoothInputRef = useRef<HTMLInputElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileStreamRef = useRef<MediaStream | null>(null);
  const lastMobileScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const autoScanTimerRef = useRef<number | null>(null);
  const awaitingNextInstantScanRef = useRef<boolean>(false);
  const executeInstantScanRef = useRef<(rawCode: string) => void>(() => {});

  awaitingNextInstantScanRef.current = isAwaitingNextInstantScan;

  const handleConfirmNextInstantScan = () => {
    setIsAwaitingNextInstantScan(false);
    awaitingNextInstantScanRef.current = false;
    setInstantBarcodeInput('');
    lastMobileScanRef.current = { code: '', ts: Date.now() };
    setTimeout(() => {
      bluetoothInputRef.current?.focus();
    }, 30);
  };

  const BRAND_QUICK_PRESETS = [
    { brand: 'Johnnie Walker Black Label', price: 4200, vol: 750 },
    { brand: 'Jameson Irish Whiskey', price: 3200, vol: 750 },
    { brand: 'Hennessy VS Cognac', price: 6800, vol: 700 },
    { brand: 'Gilbeys London Dry Gin', price: 1650, vol: 750 },
    { brand: 'Tusker Lager', price: 250, vol: 500 },
    { brand: 'Chrome Vodka', price: 950, vol: 750 },
    { brand: 'Kenya Cane Smooth', price: 1100, vol: 750 },
    { brand: 'Captain Morgan Spiced Gold', price: 2200, vol: 750 },
    { brand: 'Tanqueray London Dry Gin', price: 3400, vol: 750 },
    { brand: 'Baileys Original Irish Cream', price: 3100, vol: 750 }
  ];

  // Helper: Resolve Brand + ML selection and auto-load Pre-Set Price from Settings (brandPriceRules) or Catalog
  const applyBrandAndMlSelection = (
    targetBrandOrName: string,
    targetVolMl: number,
    explicitProdId?: string
  ) => {
    const cleanName = targetBrandOrName.trim();
    setInstantVolumeMl(targetVolMl);

    // 1. Check explicit product or find product matching Brand + targetVolMl
    const explicitProd = explicitProdId ? products.find(p => p.id === explicitProdId) : undefined;
    const baseBrandKey = (explicitProd?.brand || cleanName).toLowerCase();
    const baseTitleKey = (explicitProd?.name || cleanName)
      .replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '')
      .trim()
      .toLowerCase();

    const exactVolVariant =
      products.find(
        p =>
          p.volumeMl === targetVolMl &&
          (p.name
            .replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '')
            .trim()
            .toLowerCase() === baseTitleKey ||
            (p.brand || '').toLowerCase() === baseBrandKey)
      ) ||
      explicitProd ||
      products.find(
        p =>
          (p.brand || '').toLowerCase() === baseBrandKey ||
          p.name.toLowerCase().includes(baseBrandKey)
      );

    // 2. Check Settings Pre-Set Brand Price Rules for (Brand + targetVolMl)
    const matchedRule = brandPriceRules.find(
      r =>
        r.active &&
        r.volumeMl === targetVolMl &&
        (r.brandName.toLowerCase() === baseBrandKey ||
          baseTitleKey.includes(r.brandName.toLowerCase()) ||
          r.brandName.toLowerCase().includes(baseBrandKey))
    );

    const ruleRetailPrice = matchedRule?.retailPriceKes ?? matchedRule?.baselineRetailPriceKes ?? 0;

    if (exactVolVariant) {
      setInstantTargetProductId(exactVolVariant.id);
      setInstantBrand(
        exactVolVariant.volumeMl === targetVolMl
          ? exactVolVariant.name
          : `${exactVolVariant.name.replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '').trim()} (${targetVolMl}ml)`
      );
      if (ruleRetailPrice > 0) {
        setInstantRetailPrice(ruleRetailPrice);
      } else if (exactVolVariant.volumeMl === targetVolMl) {
        setInstantRetailPrice(exactVolVariant.retailPriceKes);
      } else {
        const ratio = targetVolMl / Math.max(50, exactVolVariant.volumeMl || 750);
        setInstantRetailPrice(Math.max(100, Math.round((exactVolVariant.retailPriceKes * ratio) / 50) * 50));
      }
    } else {
      setInstantTargetProductId('');
      setInstantBrand(cleanName.includes('ml') ? cleanName : `${cleanName} (${targetVolMl}ml)`);
      if (ruleRetailPrice > 0) {
        setInstantRetailPrice(ruleRetailPrice);
      }
    }
  };

  const executeInstantScanOnboard = (rawCode: string) => {
    if (awaitingNextInstantScanRef.current) return;
    const clean = rawCode.trim();
    if (!clean) return;

    const selectedInv =
      supplyInvoices.find(inv => inv.id === selectedTargetInvoiceId) || supplyInvoices[0];

    const result = instantScanOnboardProduct({
      invoiceId: selectedInv?.id,
      targetProductId: instantTargetProductId || undefined,
      brand: instantBrand.trim() || 'Premium Spirit',
      productName: instantBrand.trim() || undefined,
      targetBranchId: selectedInv?.branchId || activeBranch.id,
      retailPriceKes: instantRetailPrice || 2500,
      scannedBarcode: clean,
      volumeMl: instantVolumeMl,
      casesSupplied: instantCasesQty,
      piecesIndicated: instantScanUnitMode === 'BOTTLE' ? Math.max(1, instantCasesQty) : undefined,
      scanUnitMode: instantScanUnitMode,
      image: instantCustomImage.trim() || undefined
    });

    setSelectedTargetInvoiceId(result.invoice.id);
    setInstantTargetProductId(result.product.id);
    setInstantBrand(result.product.name);
    setInstantRetailPrice(result.product.retailPriceKes);
    setInstantVolumeMl(result.product.volumeMl);
    setInstantBarcodeInput('');
    // Ensure page 1 is shown so the newly activated product appears right at the top
    setCurrentPage(1);

    setAutoPinnedScanInfo({
      productId: result.product.id,
      rawBarcode: clean,
      previousBottlesOnHand: result.previousBottlesOnHand,
      newBottlesOnHand: result.newBottlesOnHand,
      bottlesAdded: result.bottlesAdded,
      assetValueAddedKes: result.assetValueAddedKes,
      newTotalProductAssetKes: result.newTotalProductAssetKes,
      scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    const entry = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      product: result.product,
      invoiceNumber: result.invoice.invoiceNumber,
      bottlesAdded: result.bottlesAdded,
      casesAdded: result.casesAdded,
      previousBottlesOnHand: result.previousBottlesOnHand,
      newBottlesOnHand: result.newBottlesOnHand,
      assetValueAddedKes: result.assetValueAddedKes,
      newTotalProductAssetKes: result.newTotalProductAssetKes,
      scannedBarcode: clean,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isExistingUpdated: result.isExistingUpdated
    };

    setInstantLoadedFeed(prev => [entry, ...prev.slice(0, 9)]);
    setIsAwaitingNextInstantScan(true);
    awaitingNextInstantScanRef.current = true;
    setFeedbackBanner(
      `⚡ ACTIVATED & PINNED ON TOP: "${result.product.name}" (${result.product.volumeMl}ml) under Invoice ${result.invoice.invoiceNumber} — Stock: ${result.previousBottlesOnHand} → ${result.newBottlesOnHand} btls (+${result.bottlesAdded} btls) • Synced uniformly across Platform & Database!`
    );
  };

  useEffect(() => {
    executeInstantScanRef.current = executeInstantScanOnboard;
  });

  // Direct Scan Barcode Under a Specific Product -> Activates Product as Available in Stock based on Indicated Pieces
  const handleScanBarcodeUnderSpecificProduct = (
    product: Product,
    rawBarcode?: string,
    piecesOverride?: number,
    setExactPiecesMode?: boolean
  ) => {
    const cleanCode = (rawBarcode ?? productDirectBarcodeMap[product.id] ?? product.barcode ?? '').trim() || product.barcode;
    const indicatedPieces = Math.max(
      1,
      Math.round(piecesOverride ?? productIndicatedPiecesMap[product.id] ?? product.packSize ?? 12)
    );
    const selectedInv =
      supplyInvoices.find(inv => inv.id === selectedTargetInvoiceId) || supplyInvoices[0];

    const result = instantScanOnboardProduct({
      invoiceId: selectedInv?.id,
      targetProductId: product.id,
      brand: product.brand || product.name.split(' ')[0] || 'VAAIRO',
      productName: product.name,
      sku: product.sku,
      category: product.category,
      subCategory: product.subCategory,
      volumeMl: product.volumeMl,
      packSize: product.packSize,
      targetBranchId: activeBranch.id,
      retailPriceKes: product.retailPriceKes,
      wholesalePriceKes: product.wholesalePriceKes,
      warehouseCostKes: product.warehouseCostKes,
      scannedBarcode: cleanCode,
      casesSupplied: indicatedPieces,
      piecesIndicated: indicatedPieces,
      setExactPieces: setExactPiecesMode,
      scanUnitMode: 'BOTTLE',
      image: product.image
    });

    setProductDirectBarcodeMap(prev => ({ ...prev, [product.id]: '' }));
    setCurrentPage(1);
    markProductRowSaved(product.id, `In Stock: ${result.newBottlesOnHand} pcs`);

    setAutoPinnedScanInfo({
      productId: result.product.id,
      rawBarcode: cleanCode,
      previousBottlesOnHand: result.previousBottlesOnHand,
      newBottlesOnHand: result.newBottlesOnHand,
      bottlesAdded: result.bottlesAdded,
      assetValueAddedKes: result.assetValueAddedKes,
      newTotalProductAssetKes: result.newTotalProductAssetKes,
      scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    const entry = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      product: result.product,
      invoiceNumber: result.invoice.invoiceNumber,
      bottlesAdded: result.bottlesAdded,
      casesAdded: result.casesAdded,
      previousBottlesOnHand: result.previousBottlesOnHand,
      newBottlesOnHand: result.newBottlesOnHand,
      assetValueAddedKes: result.assetValueAddedKes,
      newTotalProductAssetKes: result.newTotalProductAssetKes,
      scannedBarcode: cleanCode,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isExistingUpdated: result.isExistingUpdated
    };

    setInstantLoadedFeed(prev => [entry, ...prev.slice(0, 9)]);
    setFeedbackBanner(
      `✓ STOCK ACTIVATED: "${result.product.name}" is now AVAILABLE IN STOCK with ${result.newBottlesOnHand} pieces (${indicatedPieces} pcs indicated • Barcode ${cleanCode})!`
    );
  };

  // Auto-pin preview & Instant Auto-Fire when barcode scanner streams or user pastes/scans barcode
  const handleBluetoothBarcodeChange = (val: string) => {
    if (awaitingNextInstantScanRef.current) return;
    setInstantBarcodeInput(val);
    if (autoScanTimerRef.current) {
      window.clearTimeout(autoScanTimerRef.current);
    }
    const clean = val.trim();
    if (!clean) return;

    const matched = products.find(
      p =>
        p.barcode === clean ||
        p.caseBarcode === clean ||
        p.sku.toLowerCase() === clean.toLowerCase() ||
        (clean.startsWith('1') && p.barcode === clean.slice(1))
    );
    if (matched) {
      if (!instantTargetProductId) {
        setInstantTargetProductId(matched.id);
        setInstantBrand(matched.name);
        setInstantRetailPrice(matched.retailPriceKes);
        setInstantVolumeMl(matched.volumeMl);
      }
      autoScanTimerRef.current = window.setTimeout(() => {
        setInstantBarcodeInput('');
        executeInstantScanRef.current(clean);
      }, 25);
      return;
    }

    // Standard 8-16 digit EAN/UPC/ITF barcode auto-triggers after 50ms debounce so 13th digit is never cut off
    if (clean.length >= 8 && /^\d+$/.test(clean)) {
      autoScanTimerRef.current = window.setTimeout(() => {
        setInstantBarcodeInput('');
        executeInstantScanRef.current(clean);
      }, 50);
    }
  };

  // Mobile Phone Camera Scanner Lifecycle + Native BarcodeDetector Loop
  useEffect(() => {
    if (!isInstantScanOpen || instantScannerSource !== 'MOBILE_CAMERA') {
      if (mobileStreamRef.current) {
        mobileStreamRef.current.getTracks().forEach(t => t.stop());
        mobileStreamRef.current = null;
      }
      setInstantCameraActive(false);
      return;
    }

    let mounted = true;
    let detectInterval: number | null = null;

    async function startMobileScanner() {
      setInstantCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setInstantCameraError('Camera API unavailable on this device. Use the quick-scan buttons or Bluetooth mode.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        mobileStreamRef.current = stream;
        if (mobileVideoRef.current) {
          mobileVideoRef.current.srcObject = stream;
        }
        setInstantCameraActive(true);

        // Native BarcodeDetector (supported on mobile Chrome / Edge / Android WebView) — High-speed 100ms (10 FPS) loop
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']
          });
          let isDetecting = false;
          detectInterval = window.setInterval(async () => {
            if (
              awaitingNextInstantScanRef.current ||
              isDetecting ||
              !mobileVideoRef.current ||
              mobileVideoRef.current.readyState < 2
            ) {
              return;
            }
            isDetecting = true;
            try {
              const barcodes = await detector.detect(mobileVideoRef.current);
              if (barcodes && barcodes.length > 0 && !awaitingNextInstantScanRef.current) {
                const rawVal = (barcodes[0].rawValue || '').trim();
                const now = Date.now();
                if (
                  rawVal &&
                  (rawVal !== lastMobileScanRef.current.code || now - lastMobileScanRef.current.ts > 900)
                ) {
                  lastMobileScanRef.current = { code: rawVal, ts: now };
                  executeInstantScanRef.current(rawVal);
                }
              }
            } catch {
              // ignore frame detection error
            } finally {
              isDetecting = false;
            }
          }, 100);
        }
      } catch (err: any) {
        if (mounted) {
          setInstantCameraError(err?.message || 'Camera permission denied. Allow camera access on your phone or use Bluetooth scanner.');
          setInstantCameraActive(false);
        }
      }
    }

    startMobileScanner();

    return () => {
      mounted = false;
      if (detectInterval) window.clearInterval(detectInterval);
      if (mobileStreamRef.current) {
        mobileStreamRef.current.getTracks().forEach(t => t.stop());
        mobileStreamRef.current = null;
      }
    };
  }, [isInstantScanOpen, instantScannerSource, selectedTargetInvoiceId, instantBrand, instantRetailPrice, instantVolumeMl, instantCasesQty, instantScanUnitMode]);
  const [draftInvoiceProducts, setDraftInvoiceProducts] = useState<Array<{
    name: string;
    sku: string;
    category: StockCategory;
    packSize: number;
    casesSupplied: number;
    warehouseCostKes: number;
    wholesalePriceKes: number;
    retailPriceKes: number;
    batchNumber: string;
    expiryDate: string;
  }>>([
    {
      name: '',
      sku: '',
      category: 'IPS',
      packSize: 12,
      casesSupplied: 10,
      warehouseCostKes: 2400,
      wholesalePriceKes: 2950,
      retailPriceKes: 3600,
      batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
      expiryDate: '2030-12-31'
    }
  ]);

  // 3. Multi-Year Historical Invoice Retrieval State
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveYearFilter, setArchiveYearFilter] = useState<string>('ALL');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [viewingArchivedInvoice, setViewingArchivedInvoice] = useState<SupplyInvoice | null>(null);
  
  // Stock adjust modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Inventory Audit Intake');

  // New Product Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<StockCategory>('IPS');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCaseBarcode, setNewProdCaseBarcode] = useState('');
  const [newProdCost, setNewProdCost] = useState(2500);
  const [newProdWholesale, setNewProdWholesale] = useState(3000);
  const [newProdRetail, setNewProdRetail] = useState(3800);
  const [newProdPackSize, setNewProdPackSize] = useState(12);
  const [newProdInitialCases, setNewProdInitialCases] = useState(10);
  const [newProdImage, setNewProdImage] = useState<string>(STUDIO_IMAGE_PRESETS[0].url);

  // Product Image Lightbox / Editor Modal State
  const [editingImageProduct, setEditingImageProduct] = useState<Product | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string>('');

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    brand: string;
    sku: string;
    category: StockCategory;
    subCategory: string;
    volumeMl: number;
    alcoholPercentage: number;
    packSize: number;
    countryOfOrigin: string;
    barcode: string;
    caseBarcode: string;
    warehouseCostKes: number;
    wholesalePriceKes: number;
    retailPriceKes: number;
    exciseDutyPerLitreKes: number;
    importDeclarationNumber: string;
    image: string;
    branchBottlesOnHand: number;
  }>({
    name: '',
    brand: '',
    sku: '',
    category: 'IPS',
    subCategory: 'Whisky',
    volumeMl: 750,
    alcoholPercentage: 40,
    packSize: 12,
    countryOfOrigin: 'Imported',
    barcode: '',
    caseBarcode: '',
    warehouseCostKes: 2500,
    wholesalePriceKes: 3000,
    retailPriceKes: 3800,
    exciseDutyPerLitreKes: 356.4,
    importDeclarationNumber: '',
    image: '',
    branchBottlesOnHand: 0
  });

  // Delete Product Confirmation & Undo State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [lastDeletedProduct, setLastDeletedProduct] = useState<{
    product: Product;
    casesOnHand: number;
  } | null>(null);

  const openEditProductModal = (product: Product) => {
    const branchInv = inventoryItems.find(
      i => i.productId === product.id && i.branchId === activeBranch.id
    );
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      brand: product.brand || product.name.split(' ')[0] || 'VAAIRO',
      sku: product.sku,
      category: product.category,
      subCategory: product.subCategory || 'Whisky',
      volumeMl: product.volumeMl || 750,
      alcoholPercentage: product.alcoholPercentage ?? 40,
      packSize: product.packSize || 12,
      countryOfOrigin: product.countryOfOrigin || (product.category === 'IPS' ? 'Imported' : 'Kenya'),
      barcode: product.barcode,
      caseBarcode: product.caseBarcode,
      warehouseCostKes: product.warehouseCostKes,
      wholesalePriceKes: product.wholesalePriceKes,
      retailPriceKes: product.retailPriceKes,
      exciseDutyPerLitreKes: product.exciseDutyPerLitreKes ?? 356.4,
      importDeclarationNumber: product.importDeclarationNumber || '',
      image: getProductImageUrl(product),
      branchBottlesOnHand: branchInv?.bottlesOnHand ?? 0
    });
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updated = updateProduct(
      editingProduct.id,
      {
        name: editForm.name.trim() || editingProduct.name,
        brand: editForm.brand.trim() || editingProduct.brand,
        sku: editForm.sku.trim().toUpperCase() || editingProduct.sku,
        category: editForm.category,
        subCategory: editForm.subCategory,
        volumeMl: editForm.volumeMl,
        alcoholPercentage: editForm.alcoholPercentage,
        packSize: editForm.packSize,
        countryOfOrigin: editForm.countryOfOrigin.trim() || 'Kenya',
        barcode: editForm.barcode.trim() || editingProduct.barcode,
        caseBarcode: editForm.caseBarcode.trim() || editingProduct.caseBarcode,
        warehouseCostKes: editForm.warehouseCostKes,
        wholesalePriceKes: editForm.wholesalePriceKes,
        retailPriceKes: editForm.retailPriceKes,
        exciseDutyPerLitreKes: editForm.exciseDutyPerLitreKes,
        importDeclarationNumber: editForm.importDeclarationNumber.trim() || undefined,
        image: editForm.image
      },
      editForm.branchBottlesOnHand
    );

    if (updated) {
      setFeedbackBanner(
        `Updated product "${updated.name}" (${updated.sku}) — Retail ${formatKes(updated.retailPriceKes)}, Stock: ${editForm.branchBottlesOnHand} btls at ${activeBranch.name}!`
      );
      setTimeout(() => setFeedbackBanner(null), 5000);
    }
    setEditingProduct(null);
  };

  const handleConfirmDeleteProduct = () => {
    if (!deletingProduct) return;
    const branchInv = inventoryItems.find(
      i => i.productId === deletingProduct.id && i.branchId === activeBranch.id
    );
    const casesBackup = branchInv?.casesOnHand ?? 0;
    const deleted = deleteProduct(deletingProduct.id);
    if (deleted) {
      setLastDeletedProduct({ product: deleted, casesOnHand: casesBackup });
      setFeedbackBanner(`Deleted product "${deleted.name}" (${deleted.sku}) from inventory catalog.`);
    }
    setDeletingProduct(null);
  };

  const handleUndoDeleteProduct = () => {
    if (!lastDeletedProduct) return;
    const { product: restored, casesOnHand } = lastDeletedProduct;
    const { id: _ignoreId, ...restData } = restored;
    addProduct(restData, casesOnHand);
    setLastDeletedProduct(null);
    setFeedbackBanner(`Restored product "${restored.name}" (${restored.sku}) back into inventory!`);
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onLoaded: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      onLoaded(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onLoaded(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Fast O(1) Lookup Maps for Products and Active Branch Inventory
  const productByIdMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    for (let i = 0; i < products.length; i++) {
      map.set(products[i].id, products[i]);
    }
    return map;
  }, [products]);

  const { branchItems, branchInventoryByProductMap } = React.useMemo(() => {
    const items: typeof inventoryItems = [];
    const map = new Map<string, (typeof inventoryItems)[number]>();
    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      if (item.branchId === activeBranch.id) {
        items.push(item);
        map.set(item.productId, item);
      }
    }
    // Fallback for any product that has activated stock in unified inventory across branches
    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const existing = map.get(item.productId);
      if ((!existing || existing.bottlesOnHand <= 0) && item.bottlesOnHand > 0) {
        map.set(item.productId, item);
        if (!existing) {
          items.push(item);
        }
      }
    }
    return { branchItems: items, branchInventoryByProductMap: map };
  }, [inventoryItems, activeBranch.id]);

  // Build a recency rank map of all already-scanned products (0 = most recently scanned)
  const scannedProductRankMap = React.useMemo(() => {
    const map = new Map<string, number>();
    let rank = 0;

    if (autoPinnedScanInfo?.productId) {
      map.set(autoPinnedScanInfo.productId, rank++);
    }

    instantLoadedFeed.forEach(entry => {
      if (entry.product?.id && !map.has(entry.product.id)) {
        map.set(entry.product.id, rank++);
      }
    });

    scanHistory.forEach(scan => {
      if (scan.status !== 'ACCEPTED') return;
      const pid =
        scan.productId ||
        products.find(
          p => p.barcode === scan.rawBarcode || p.caseBarcode === scan.rawBarcode
        )?.id;
      if (pid && !map.has(pid)) {
        map.set(pid, rank++);
      }
    });

    return map;
  }, [autoPinnedScanInfo, instantLoadedFeed, scanHistory, products]);

  // Precompute subcategory counts in a single O(N) pass
  const subCategoryCountMap = React.useMemo(() => {
    const counts = new Map<string, number>();
    NAIROBI_DRINKS_SUB_CATEGORIES.forEach(sub => counts.set(sub, 0));
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      for (let j = 0; j < NAIROBI_DRINKS_SUB_CATEGORIES.length; j++) {
        const sub = NAIROBI_DRINKS_SUB_CATEGORIES[j];
        if (
          p.subCategory === sub ||
          (sub === 'Rum' && (p.subCategory === 'White Rum' || p.subCategory === 'Spiced & Dark Rum')) ||
          (sub === 'Liqueur & Cream' && (p.subCategory === 'Cream Liqueur' || p.isCreamBased)) ||
          (sub === 'Cream Liqueur' && p.isCreamBased)
        ) {
          counts.set(sub, (counts.get(sub) || 0) + 1);
        }
      }
    }
    return counts;
  }, [products]);

  // Distinct sorted brands in catalog for the Inventory Search & Brand Filter Bar
  const availableBrandList = React.useMemo(() => {
    const brandCounts = new Map<string, number>();
    for (let i = 0; i < products.length; i++) {
      const b = (products[i].brand || 'Other').trim();
      if (b) brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
    }
    return Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  // Filter products & Pin All Already-Scanned Products to Top (most recently scanned first)
  const filteredProducts = React.useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return products
      .filter(p => {
        const matchesCategory = activeCategory === 'ALL' || p.category === activeCategory;
        if (!matchesCategory) return false;

        const matchesBrand =
          activeBrandFilter === 'ALL' ||
          (p.brand || '').toLowerCase() === activeBrandFilter.toLowerCase();
        if (!matchesBrand) return false;

        const matchesSubCategory =
          activeSubCategory === 'ALL' ||
          p.subCategory === activeSubCategory ||
          (activeSubCategory === 'Rum' &&
            (p.subCategory === 'White Rum' || p.subCategory === 'Spiced & Dark Rum')) ||
          (activeSubCategory === 'Liqueur & Cream' &&
            (p.subCategory === 'Cream Liqueur' || p.isCreamBased)) ||
          (activeSubCategory === 'Cream Liqueur' && p.isCreamBased);
        if (!matchesSubCategory) return false;

        const inv = branchInventoryByProductMap.get(p.id);
        const btlCount = inv?.bottlesOnHand ?? 0;
        const reorderLvl = inv?.reorderLevel || 12;
        const isJustActivatedOnTop =
          autoPinnedScanInfo?.productId === p.id ||
          scannedProductRankMap.get(p.id) === 0;
        const matchesAvailability =
          isJustActivatedOnTop ||
          (stockAvailabilityFilter === 'ALL'
            ? true
            : stockAvailabilityFilter === 'IN_STOCK'
            ? btlCount > 0
            : stockAvailabilityFilter === 'LOW_STOCK'
            ? btlCount > 0 && btlCount <= reorderLvl
            : stockAvailabilityFilter === 'CREAM_FEFO'
            ? Boolean(p.isCreamBased || p.subCategory === 'Cream Liqueur' || p.requiresBatchExpiryTracking)
            : btlCount <= 0);
        if (!matchesAvailability) return false;

        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.subCategory || '').toLowerCase().includes(q) ||
          String(p.volumeMl || '').includes(q) ||
          p.barcode.includes(q) ||
          p.caseBarcode.includes(q)
        );
      })
      .sort((a, b) => {
        const rankA = scannedProductRankMap.get(a.id);
        const rankB = scannedProductRankMap.get(b.id);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        // When filtering by Cream FEFO, sort by earliest expiry date first (First-Expired, First-Out)
        if (stockAvailabilityFilter === 'CREAM_FEFO') {
          const invA = branchInventoryByProductMap.get(a.id);
          const invB = branchInventoryByProductMap.get(b.id);
          const expA = invA?.expiryDate || a.defaultExpiryDate || '2030-12-31';
          const expB = invB?.expiryDate || b.defaultExpiryDate || '2030-12-31';
          return expA.localeCompare(expB);
        }
        return 0;
      });
  }, [
    products,
    activeCategory,
    activeBrandFilter,
    activeSubCategory,
    stockAvailabilityFilter,
    deferredSearchQuery,
    branchInventoryByProductMap,
    scannedProductRankMap
  ]);

  // Reset pagination to page 1 when filters, branch, or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, activeBrandFilter, activeSubCategory, stockAvailabilityFilter, deferredSearchQuery, activeBranch.id]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = React.useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(startIdx, startIdx + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  const selectedProductIdSet = React.useMemo(
    () => new Set(selectedProductIds),
    [selectedProductIds]
  );

  const openBatchExpiryModal = (product: Product) => {
    const inv = branchInventoryByProductMap.get(product.id);
    setEditingBatchProduct(product);
    setBatchNumInput(inv?.batchNumber || `BAT-2026-${product.sku.slice(-6)}`);
    setBatchMfgDateInput(inv?.manufactureDate || product.manufactureDate || '2025-10-15');
    setBatchExpDateInput(inv?.expiryDate || product.defaultExpiryDate || '2027-10-15');
  };

  const handleBatchExpirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchProduct) return;
    updateInventoryBatchExpiry(editingBatchProduct.id, activeBranch.id, {
      batchNumber: batchNumInput,
      manufactureDate: batchMfgDateInput,
      expiryDate: batchExpDateInput
    });
    setFeedbackBanner(
      `FEFO Batch & Expiry Updated for "${editingBatchProduct.name}" (${editingBatchProduct.sku}): Batch ${batchNumInput} • Mfg: ${batchMfgDateInput} • Exp: ${batchExpDateInput}. Older batches are automatically flagged for rotation before newer stock!`
    );
    setTimeout(() => setFeedbackBanner(null), 5000);
    setEditingBatchProduct(null);
  };

  // Memoized O(N) Totals & Exact Live Asset Values (Cost & Retail)
  const {
    totalIpsProducts,
    totalLpsProducts,
    creamFefoSkuCount,
    totalBottlesInBranch,
    totalCasesInBranch,
    inStockSkuCount,
    outOfStockSkuCount,
    lowStockSkuCount,
    branchIpsCostAssetKes,
    branchLpsCostAssetKes,
    totalBranchCostAssetKes,
    totalBranchRetailValueKes,
    projectedBranchGrossMarginKes,
    totalCompanyCostAssetKes
  } = React.useMemo(() => {
    let ipsCount = 0;
    let lpsCount = 0;
    let fefoCount = 0;
    let inStockCount = 0;
    let lowStockCount = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.category === 'IPS') ipsCount++;
      else if (p.category === 'LPS') lpsCount++;
      if (p.isCreamBased || p.subCategory === 'Cream Liqueur' || p.requiresBatchExpiryTracking) {
        fefoCount++;
      }
      const inv = branchInventoryByProductMap.get(p.id);
      const btls = inv?.bottlesOnHand ?? 0;
      if (btls > 0) {
        inStockCount++;
        if (btls <= (inv?.reorderLevel || 12)) {
          lowStockCount++;
        }
      }
    }

    let bottlesInBr = 0;
    let casesInBr = 0;
    let ipsCostKes = 0;
    let lpsCostKes = 0;
    let retailValKes = 0;

    for (let i = 0; i < branchItems.length; i++) {
      const item = branchItems[i];
      bottlesInBr += item.bottlesOnHand;
      casesInBr += item.casesOnHand;
      const prod = productByIdMap.get(item.productId);
      if (prod) {
        const costVal = item.bottlesOnHand * prod.warehouseCostKes;
        if (prod.category === 'IPS') ipsCostKes += costVal;
        else if (prod.category === 'LPS') lpsCostKes += costVal;
        retailValKes += item.bottlesOnHand * prod.retailPriceKes;
      }
    }

    let companyCostKes = 0;
    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const prod = productByIdMap.get(item.productId);
      if (prod) {
        companyCostKes += item.bottlesOnHand * prod.warehouseCostKes;
      }
    }

    const branchCostKes = ipsCostKes + lpsCostKes;
    return {
      totalIpsProducts: ipsCount,
      totalLpsProducts: lpsCount,
      creamFefoSkuCount: fefoCount,
      totalBottlesInBranch: bottlesInBr,
      totalCasesInBranch: casesInBr,
      inStockSkuCount: inStockCount,
      outOfStockSkuCount: products.length - inStockCount,
      lowStockSkuCount: lowStockCount,
      branchIpsCostAssetKes: ipsCostKes,
      branchLpsCostAssetKes: lpsCostKes,
      totalBranchCostAssetKes: branchCostKes,
      totalBranchRetailValueKes: retailValKes,
      projectedBranchGrossMarginKes: Math.max(0, retailValKes - branchCostKes),
      totalCompanyCostAssetKes: companyCostKes
    };
  }, [products, branchItems, inventoryItems, branchInventoryByProductMap, productByIdMap]);

  const blockedDuplicates = React.useMemo(
    () => scanHistory.filter(s => s.status === 'DUPLICATE_BLOCKED'),
    [scanHistory]
  );

  const handleStockAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    adjustStockManually(adjustingProduct.id, activeBranch.id, adjustQty, adjustReason);
    setAdjustingProduct(null);
    setAdjustQty(0);
  };

  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdSku) return;

    addProduct(
      {
        name: newProdName,
        sku: newProdSku,
        barcode: newProdBarcode || `616${Date.now().toString().slice(-10)}`,
        caseBarcode: newProdCaseBarcode || `1616${Date.now().toString().slice(-10)}`,
        category: newProdCategory,
        brand: newProdName.split(' ')[0],
        volumeMl: 750,
        alcoholPercentage: 40,
        packSize: newProdPackSize,
        countryOfOrigin: newProdCategory === 'IPS' ? 'United Kingdom' : 'Kenya',
        warehouseCostKes: newProdCost,
        wholesalePriceKes: newProdWholesale,
        retailPriceKes: newProdRetail,
        minWholesaleQty: newProdPackSize,
        vatRate: 0.16,
        exciseDutyPerLitreKes: 356.40,
        kraExciseStampType: newProdCategory === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
        importDeclarationNumber: newProdCategory === 'IPS' ? `IDF/2026/NRB/${Date.now().toString().slice(-5)}` : undefined,
        image: newProdImage || getProductImageUrl({ name: newProdName, category: newProdCategory })
      },
      newProdInitialCases
    );

    setIsAddProductOpen(false);
    setFeedbackBanner(
      `Registered SKU "${newProdName}" (${newProdSku}) with ${newProdInitialCases} initial cases (${newProdInitialCases * newProdPackSize} btls) at ${activeBranch.name}!`
    );
    setTimeout(() => setFeedbackBanner(null), 4500);
    setNewProdName('');
    setNewProdSku('');
  };

  // Handler: Create New Invoice (Saved to Multi-Year Archive)
  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let supplier = suppliers.find(s => s.id === invSupplierId) || suppliers[0];
    const branch = branches.find(b => b.id === invBranchId) || activeBranch;

    if (!supplier) {
      const fallbackName = invCustomSupplierName.trim() || 'Primary Beverage Supplier';
      const fallbackSupplierId = `sup-${Date.now().toString().slice(-4)}`;
      addSupplier({
        code: `SUP-${Date.now().toString().slice(-3)}`,
        name: fallbackName,
        kraPin: 'P051000000A',
        category: 'LOCAL_DISTILLERY',
        contactPerson: 'Supply Desk',
        email: 'supply@partner.co.ke',
        phone: '+254 700 000 000',
        physicalAddress: 'Nairobi',
        county: 'Nairobi',
        paymentTerms: 'NET_30',
        creditLimitKes: 10000000,
        bankName: 'KCB Bank Kenya',
        bankAccountNumber: '1100000000',
        active: true
      });
      supplier = {
        id: fallbackSupplierId,
        code: `SUP-${Date.now().toString().slice(-3)}`,
        name: fallbackName,
        kraPin: 'P051000000A',
        category: 'LOCAL_DISTILLERY',
        contactPerson: 'Supply Desk',
        email: 'supply@partner.co.ke',
        phone: '+254 700 000 000',
        physicalAddress: 'Nairobi',
        county: 'Nairobi',
        paymentTerms: 'NET_30',
        creditLimitKes: 10000000,
        currentOutstandingKes: 0,
        bankName: 'KCB Bank Kenya',
        bankAccountNumber: '1100000000',
        active: true
      };
    }

    const created = createSupplyInvoice({
      customInvoiceNumber: invCustomNumber.trim() || undefined,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierPin: supplier.kraPin,
      branchId: branch.id,
      branchName: branch.name,
      deliveryDate: invDeliveryDate,
      subtotalKes: 0,
      vatKes: 0,
      exciseDutyKes: 0,
      totalAmountKes: 0,
      paymentStatus: 'PENDING',
      paymentMethod: invPaymentMethod,
      packingListNumber: invPackingList.trim() || `PKL-${invDeliveryDate.substring(0, 4)}-${Date.now().toString().slice(-4)}`,
      truckRegistration: invTruckReg.trim() || undefined,
      sealNumber: invSealNumber.trim() || undefined,
      items: [],
      notes: invNotes.trim() || 'Created in Inventory Archive — ready for product onboarding.'
    });

    setIsCreateInvoiceOpen(false);
    setInvCustomNumber('');
    setInvCustomSupplierName('');
    setInvPackingList('');
    setInvTruckReg('');
    setInvSealNumber('');
    setInvNotes('');
    setSelectedTargetInvoiceId(created.id);
    setFeedbackBanner(
      `Invoice ${created.invoiceNumber} (${created.deliveryDate}) created & archived permanently. You can now select it to create products under it.`
    );
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // Handler: Save Products Created Under Selected Invoice
  const handleSaveProductsUnderInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = draftInvoiceProducts.filter(r => r.name.trim() && r.sku.trim());
    if (validRows.length === 0) return;

    let targetInvId = selectedTargetInvoiceId || supplyInvoices[0]?.id;
    if (!targetInvId) {
      const autoCreatedInv = createSupplyInvoice({
        supplierId: suppliers[0]?.id || 'sup-auto-01',
        supplierName: suppliers[0]?.name || 'Direct Inventory Intake Supplier',
        supplierPin: suppliers[0]?.kraPin || 'P051000000A',
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        deliveryDate: new Date().toISOString().substring(0, 10),
        subtotalKes: 0,
        vatKes: 0,
        exciseDutyKes: 0,
        totalAmountKes: 0,
        paymentStatus: 'PENDING',
        paymentMethod: 'RTGS',
        packingListNumber: `PKL-${Date.now().toString().slice(-4)}`,
        items: [],
        notes: 'Auto-created supply invoice during product intake.'
      });
      targetInvId = autoCreatedInv.id;
      setSelectedTargetInvoiceId(autoCreatedInv.id);
    }

    const { createdProducts, updatedInvoice } = addProductsUnderInvoice(targetInvId, validRows);
    if (createdProducts.length > 0 && updatedInvoice) {
      setIsInvoiceProductModalOpen(false);
      setDraftInvoiceProducts([
        {
          name: '',
          sku: '',
          category: 'IPS',
          packSize: 12,
          casesSupplied: 10,
          warehouseCostKes: 2400,
          wholesalePriceKes: 2950,
          retailPriceKes: 3600,
          batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
          expiryDate: '2030-12-31'
        }
      ]);
      setFeedbackBanner(
        `Saved ${createdProducts.length} product(s) under Invoice ${updatedInvoice.invoiceNumber} and stocked into ${updatedInvoice.branchName}!`
      );
      setTimeout(() => setFeedbackBanner(null), 5000);
    }
  };

  const handleAddDraftProductRow = () => {
    setDraftInvoiceProducts(prev => [
      ...prev,
      {
        name: '',
        sku: '',
        category: 'IPS',
        packSize: 12,
        casesSupplied: 10,
        warehouseCostKes: 2000,
        wholesalePriceKes: 2500,
        retailPriceKes: 3100,
        batchNumber: `BAT-${Date.now().toString().slice(-4)}-${prev.length + 1}`,
        expiryDate: '2030-12-31'
      }
    ]);
  };

  const handleRemoveDraftProductRow = (idx: number) => {
    if (draftInvoiceProducts.length <= 1) return;
    setDraftInvoiceProducts(prev => prev.filter((_, i) => i !== idx));
  };

  // Compute available years for Multi-Year Invoice Archive Retrieval
  const availableInvoiceYears = Array.from(
    new Set([
      ...supplyInvoices.map(inv => (inv.deliveryDate || inv.createdAt || '2026').substring(0, 4)),
      '2026',
      '2025',
      '2024'
    ])
  ).sort((a, b) => b.localeCompare(a));

  const filteredArchivedInvoices = supplyInvoices.filter(inv => {
    const invYear = (inv.deliveryDate || inv.createdAt || '').substring(0, 4);
    const matchesYear = archiveYearFilter === 'ALL' || invYear === archiveYearFilter;
    const q = archiveSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q) ||
      inv.packingListNumber.toLowerCase().includes(q) ||
      inv.items.some(item => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
    return matchesYear && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            {lastDeletedProduct && (
              <button
                type="button"
                onClick={handleUndoDeleteProduct}
                className="px-3 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[11px] inline-flex items-center gap-1 shadow-2xs transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo Delete ({lastDeletedProduct.product.sku})</span>
              </button>
            )}
            <button onClick={() => setFeedbackBanner(null)} className="text-emerald-700 hover:text-emerald-950 font-black">
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* 4-Step Firebase Stock-Taking Audit Session Workflow (Collapsible for Fast Inventory Editing) */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#1E9E60] shrink-0" />
          <span className="font-montserrat font-black text-xs text-slate-900">
            4-Step Physical Stock-Taking Audit Session &amp; Shop Order Requests
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAuditPanelOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer ${
              isAuditPanelOpen
                ? 'bg-[#34D186] text-[#FFDE00]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAuditPanelOpen ? 'Hide Audit Session' : 'Open Stock Audit Session'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsIncomingOrdersOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer ${
              isIncomingOrdersOpen
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'bg-blue-50 hover:bg-blue-100 text-[#0A006E] border border-blue-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              Shop Order Requests (
              {
                restockRequests.filter(
                  r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISPATCHED'
                ).length
              }
              )
            </span>
          </button>
        </div>
      </div>

      {isAuditPanelOpen && <StockAuditSessionPanel />}

      {/* Top Banner / Live Asset Valuation & Available Stock KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. EXACT ASSET VALUE (COST VALUATION) */}
        <div className="bg-white p-6 sm:p-7 min-h-[195px] rounded-2xl border-2 border-[#34D186] shadow-sm flex flex-col justify-between hover-card-lift">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-montserrat font-black text-[#1E9E60] text-xs uppercase tracking-wider">
              Exact Branch Asset Value (Cost)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#34D186] text-[#FFDE00] text-[10px] font-mono font-bold">
              GL 1200 / 1210
            </span>
          </div>
          <div>
            <div className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#1E9E60] tracking-tight truncate tabular-nums">
              {formatKes(totalBranchCostAssetKes)}
            </div>
            <div className="text-[11px] font-mono text-slate-600 mt-1">
              IPS Asset: <strong>{formatKes(branchIpsCostAssetKes)}</strong> • LPS Asset: <strong>{formatKes(branchLpsCostAssetKes)}</strong>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>All Branches Asset:</span>
            <strong className="font-mono text-slate-900">{formatKes(totalCompanyCostAssetKes)}</strong>
          </div>
        </div>

        {/* 2. RETAIL STOCK VALUATION & PROJECTED MARGIN */}
        <div className="bg-white p-6 sm:p-7 min-h-[195px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-montserrat font-black text-[#0A006E] text-xs uppercase tracking-wider">
              Retail Stock Value &amp; Margin
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#FFDE00]/40 text-[#0A006E] text-[10px] font-bold">
              Shelf Value
            </span>
          </div>
          <div>
            <div className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#0A006E] tracking-tight truncate tabular-nums">
              {formatKes(totalBranchRetailValueKes)}
            </div>
            <div className="text-[11px] font-mono text-emerald-700 font-bold mt-1">
              Projected Gross Profit: +{formatKes(projectedBranchGrossMarginKes)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-1 truncate">
            {totalIpsProducts} IPS SKUs • {totalLpsProducts} LPS SKUs in Catalog
          </div>
        </div>

        {/* 3. AVAILABLE STOCK AT ACTIVE BRANCH */}
        <div className="bg-white p-6 sm:p-7 min-h-[195px] rounded-2xl border-2 border-[#0A006E] shadow-sm flex flex-col justify-between hover-card-lift">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-montserrat font-black text-slate-800 text-xs uppercase tracking-wider">
              Available Stock ({activeBranch.name.split(' ')[0]})
            </span>
            <Building2 className="w-4 h-4 text-[#0A006E]" />
          </div>
          <div>
            <div className="font-montserrat font-black text-xl sm:text-2xl xl:text-3xl text-[#0A006E] tracking-tight truncate tabular-nums">
              {totalBottlesInBranch.toLocaleString()} btls
            </div>
            <div className="text-[11px] font-mono text-slate-600 mt-1">
              Across <strong>{totalCasesInBranch.toLocaleString()}</strong> unpacked master cases
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] flex items-center justify-between mt-1">
            <span className="text-emerald-700 font-bold">{inStockSkuCount} In Stock</span>
            <span className="text-amber-700 font-bold">{lowStockSkuCount} Low</span>
            <span className="text-red-600 font-bold">{outOfStockSkuCount} Out (0)</span>
          </div>
        </div>

        {/* 4. BARCODE AUTO-PIN & DUPLICATE BLOCKER STATUS */}
        <div className="bg-white p-6 sm:p-7 min-h-[195px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-montserrat font-black text-slate-800 text-xs uppercase tracking-wider">
              Barcode Auto-Pin &amp; Redis Guard
            </span>
            <Barcode className="w-4 h-4 text-[#1E9E60]" />
          </div>
          <div>
            <div className="font-montserrat font-black text-xl sm:text-2xl text-slate-900 tracking-tight truncate">
              {scanHistory.filter(s => s.status === 'ACCEPTED').length} Scans Verified
            </div>
            <div className="text-[11px] font-mono text-red-600 font-bold mt-1">
              {blockedDuplicates.length} Duplicate Scans Blocked
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-1 truncate">
            {autoPinnedScanInfo
              ? `Pinned: ${products.find(p => p.id === autoPinnedScanInfo.productId)?.name || 'SKU'}`
              : 'Scan any barcode to auto-pin exact product'}
          </div>
        </div>
      </div>

      {/* Barcode Onboarding Action Bar */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        {/* Text Above + Mobile Hamburger Trigger */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-montserrat font-black italic text-base sm:text-xl text-slate-900 flex items-center gap-2">
              <Barcode className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A006E] shrink-0" />
              <span>Barcode Onboarding &amp; Intake Modes</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 font-medium">
              Active Batch: <strong className="font-mono text-slate-900">{activeScanBatchId}</strong> • Enforcing unique SKU constraints &amp; Redis token cache.
            </p>
          </div>

          {/* Mobile Hamburger Button to Collapse Action Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Inventory Action Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Symmetrical Inventory Action Toolbar — Collapsed Inside Hamburger on Mobile */}
        <div
          className={`${
            isHeroMenuOpen ? 'block' : 'hidden sm:block'
          } pt-3.5 sm:pt-4 border-t border-slate-100 space-y-3 animate-in fade-in`}
        >
          {/* Primary Operations Grid */}
          <div className="flex flex-col sm:grid sm:grid-cols-3 2xl:grid-cols-6 gap-2">
            {/* 1. Create Invoice Button */}
            <button
              type="button"
              onClick={() => {
                setInvSupplierId(suppliers[0]?.id || '');
                setInvBranchId(activeBranch.id);
                setIsCreateInvoiceOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="h-10 sm:h-11 px-3 sm:px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span className="truncate">Create Invoice</span>
            </button>

            {/* 2. Select Invoice & Create Products Under Invoice Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedTargetInvoiceId && supplyInvoices[0]) {
                  setSelectedTargetInvoiceId(supplyInvoices[0].id);
                }
                setIsInvoiceProductModalOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="h-10 sm:h-11 px-3 sm:px-4 bg-[#FFDE00] hover:bg-[#FFDE00]/90 text-[#0A006E] border-2 border-[#0A006E] rounded-xl font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#0A006E] shrink-0" />
              <span className="truncate">Add Invoice Stock</span>
            </button>

            {/* 3. Retrieve Historical Invoices (Multi-Year Archive) */}
            <button
              type="button"
              onClick={() => {
                setIsArchiveOpen(prev => !prev);
                setIsHeroMenuOpen(false);
              }}
              className={`h-10 sm:h-11 px-3 sm:px-4 rounded-xl font-montserrat font-bold text-xs inline-flex items-center justify-center gap-2 transition border whitespace-nowrap cursor-pointer ${
                isArchiveOpen
                  ? 'bg-[#34D186] text-white border-[#34D186]'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border-emerald-200'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" />
              <span className="truncate">Archive ({supplyInvoices.length})</span>
            </button>

            {/* 4. Warehouse Controller Auto-Disburse Stock */}
            <button
              type="button"
              onClick={() => {
                const res = triggerWarehouseAutoDisburseForAllLowStockShops();
                setFeedbackBanner(
                  res.count > 0
                    ? `Warehouse (Main Store) Controller auto-disbursed stock to ${res.count} shop(s)! Notifications pending acceptance.`
                    : 'All shops currently have healthy stock or already have pending refill notifications.'
                );
                setTimeout(() => setFeedbackBanner(null), 5000);
                setIsHeroMenuOpen(false);
              }}
              className="h-10 sm:h-11 px-3 sm:px-4 bg-purple-900 hover:bg-purple-950 text-[#FFDE00] rounded-xl font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span className="truncate">Auto-Disburse</span>
            </button>

            {/* 5. Onboard Suppliers, Distributors & Staff */}
            <button
              type="button"
              onClick={() => {
                setOnboardingTab('SUPPLIER');
                setIsHeroMenuOpen(false);
              }}
              className="h-10 sm:h-11 px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-montserrat font-bold text-xs inline-flex items-center justify-center gap-2 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span className="truncate">Onboard Partners</span>
            </button>

            {/* 6. Create New Branch */}
            <button
              type="button"
              onClick={() => {
                setOnboardingTab('BRANCH');
                setIsHeroMenuOpen(false);
              }}
              className="h-10 sm:h-11 px-3 sm:px-4 bg-[#34D186] hover:bg-emerald-950 text-white rounded-xl font-montserrat font-bold text-xs inline-flex items-center justify-center gap-2 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span className="truncate">+ New Branch</span>
            </button>
          </div>

          {/* Secondary Scanner & Quick SKU Sub-Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-400">
              Barcode Scanner &amp; SKU Tools
            </span>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              {/* Simplified Independent Popup Barcode Scanner Button */}
              <button
                type="button"
                onClick={() => {
                  setWizardInitialBarcode('');
                  setWizardInitialProductId('');
                  setIsBarcodeWizardOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="h-10 px-4 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] border-2 border-[#FFDE00] font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-sm whitespace-nowrap cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span>Scan Barcode &amp; Activate Stock</span>
              </button>

              {/* Clone from NairobiDrinks.co.ke */}
              <button
                type="button"
                onClick={() => {
                  setIsCloneModalOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="h-10 px-4 bg-[#FFDE00] hover:bg-[#FFDE00]/90 text-[#0A006E] rounded-xl font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-xs border border-[#0A006E]/20 whitespace-nowrap cursor-pointer"
                title="Clone & Sync Products from https://nairobidrinks.co.ke/product"
              >
                <DownloadCloud className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span>Clone NairobiDrinks.co.ke ({NAIROBI_DRINKS_PRODUCTS.length})</span>
              </button>

              {/* Quick Register SKU */}
              <button
                type="button"
                onClick={() => {
                  setIsAddProductOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="h-10 px-4 bg-[#0A006E] hover:bg-[#060046] text-white rounded-xl font-montserrat font-bold text-xs inline-flex items-center justify-center gap-2 transition shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span>Quick SKU</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* EXPRESS STOCK ONBOARDING STATION (1. Select Invoice Created -> 2. Select Brand -> 3. Choose ML & Pieces -> 4. Scan Barcode) */}
      {isInstantScanOpen && (
        <div className="bg-white rounded-2xl border-2 border-[#34D186] shadow-md overflow-hidden animate-in fade-in">
          <div className="bg-[#34D186] px-4 sm:px-5 py-3 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-montserrat font-black italic text-sm sm:text-base text-[#FFDE00]">
                    Express Stock Onboarding (1. Select Invoice Created → 2. Select Brand → 3. Choose ML → 4. Scan)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-[#FFDE00]/50 text-[#FFDE00] font-mono font-black text-[10px] uppercase">
                    ⚡ 0ms Instant Scan • Activated Product Appears on Top
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100">
                  Select the invoice created by Accountant, choose brand &amp; ML (price auto-loads from Settings), and scan — adds uniformly across Platform &amp; Database and auto-deducts when sold!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setWizardInitialProductId(instantTargetProductId);
                  setWizardInitialBarcode(instantBarcodeInput.trim());
                  setWizardInitialStep(3);
                  setIsBarcodeWizardOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#FFDE00] hover:bg-[#FFDE00]/90 text-[#0A006E] font-montserrat font-black text-xs inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Full-Screen Big Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInstantImagePicker(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-montserrat font-bold text-xs inline-flex items-center gap-1.5 transition border cursor-pointer ${
                  showInstantImagePicker || instantCustomImage
                    ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00]'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{instantCustomImage ? 'Custom Image Attached' : '+ Photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInstantScanOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                Hide
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* 4-Step Express Stock Onboarding Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {/* STEP 1: SELECT INVOICE CREATED (BY ACCOUNTANT / PROCUREMENT) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-montserrat font-black uppercase text-[#0A006E] flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>1. Select Invoice Created</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreateInvoiceOpen(true)}
                    className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] text-[10px] font-montserrat font-black hover:bg-[#060046] cursor-pointer"
                  >
                    + New Invoice
                  </button>
                </div>
                <select
                  value={selectedTargetInvoiceId}
                  onChange={(e) => setSelectedTargetInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-[#0A006E] rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {supplyInvoices.length === 0 ? (
                    <option value="">Auto-Create Supply Invoice on Scan</option>
                  ) : (
                    supplyInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} • {inv.supplierName} ({inv.deliveryDate}) [{inv.items.length} items]
                      </option>
                    ))
                  )}
                </select>
                <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                  <span>
                    Branch: <strong className="text-[#1E9E60]">{activeBranch.name}</strong>
                  </span>
                  <span className="text-emerald-700 font-bold">✓ Uniform Sync</span>
                </div>
              </div>

              {/* STEP 2: SELECT BRAND WE NEED TO START ONBOARDING */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-montserrat font-black uppercase text-[#0A006E]">
                    2. Select Brand to Onboard
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-black text-[9px]">
                    {outOfStockSkuCount} Out of Stock
                  </span>
                </div>

                {/* Brand Filter / Selector Dropdown */}
                <select
                  value={instantSelectedBrandGroup}
                  onChange={(e) => {
                    const chosenBrand = e.target.value;
                    setInstantSelectedBrandGroup(chosenBrand);
                    if (chosenBrand !== 'ALL') {
                      const brandProds = products.filter(
                        p => (p.brand || '').toLowerCase() === chosenBrand.toLowerCase()
                      );
                      const preferredProd =
                        brandProds.find(p => p.volumeMl === instantVolumeMl) ||
                        brandProds.find(p => (branchInventoryByProductMap.get(p.id)?.bottlesOnHand ?? 0) <= 0) ||
                        brandProds[0];
                      if (preferredProd) {
                        applyBrandAndMlSelection(preferredProd.name, preferredProd.volumeMl || instantVolumeMl, preferredProd.id);
                      } else {
                        applyBrandAndMlSelection(chosenBrand, instantVolumeMl);
                      }
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] cursor-pointer"
                >
                  <option value="ALL">All Brands ({availableBrandList.length} Brands) — Filter or Pick Below</option>
                  {availableBrandList.map(([brandName, count]) => {
                    const outCountForBrand = products.filter(
                      p =>
                        (p.brand || '').toLowerCase() === brandName.toLowerCase() &&
                        (branchInventoryByProductMap.get(p.id)?.bottlesOnHand ?? 0) <= 0
                    ).length;
                    return (
                      <option key={brandName} value={brandName}>
                        {brandName} ({count} SKUs • {outCountForBrand} Out of Stock)
                      </option>
                    );
                  })}
                </select>

                {/* Product / Brand Variant Selector (Prioritizing Out-of-Stock & Scanned) */}
                <select
                  value={instantTargetProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setInstantTargetProductId(pid);
                    const matched = products.find(p => p.id === pid);
                    if (matched) {
                      setInstantSelectedBrandGroup(matched.brand || 'ALL');
                      applyBrandAndMlSelection(matched.name, matched.volumeMl || 750, matched.id);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-emerald-50 border-2 border-[#34D186] rounded-xl text-[11px] font-montserrat font-bold text-[#1E9E60] cursor-pointer"
                >
                  <option value="">📌 Pick Brand Product (or Auto-Match by Scanned Barcode)...</option>
                  {[...products]
                    .filter(
                      p =>
                        instantSelectedBrandGroup === 'ALL' ||
                        (p.brand || '').toLowerCase() === instantSelectedBrandGroup.toLowerCase()
                    )
                    .sort((a, b) => {
                      const btlsA = branchInventoryByProductMap.get(a.id)?.bottlesOnHand ?? 0;
                      const btlsB = branchInventoryByProductMap.get(b.id)?.bottlesOnHand ?? 0;
                      if ((btlsA <= 0) !== (btlsB <= 0)) return btlsA <= 0 ? -1 : 1;
                      const rankA = scannedProductRankMap.get(a.id);
                      const rankB = scannedProductRankMap.get(b.id);
                      if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                      if (rankA !== undefined) return -1;
                      if (rankB !== undefined) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map(p => {
                      const inv = branchInventoryByProductMap.get(p.id);
                      const btls = inv?.bottlesOnHand ?? 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {btls <= 0 ? '🔴 [OUT OF STOCK] ' : `🟢 [${btls} btls] `}
                          {p.name} • {p.volumeMl}ml • {formatKes(p.retailPriceKes)}
                        </option>
                      );
                    })}
                </select>

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {BRAND_QUICK_PRESETS.slice(0, 6).map(preset => (
                    <button
                      key={preset.brand}
                      type="button"
                      onClick={() => {
                        applyBrandAndMlSelection(preset.brand, instantVolumeMl || preset.vol);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
                        instantBrand.toLowerCase().includes(preset.brand.split(' ')[0].toLowerCase())
                          ? 'bg-[#0A006E] text-[#FFDE00]'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.brand.split(' ').slice(0, 2).join(' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 3: CHOOSE ML (MEASUREMENT) & PIECES / CASES (PRICE AUTO-SET FROM SETTINGS) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-montserrat font-black uppercase text-[#0A006E]">
                    3. Choose ML &amp; Pieces
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#1E9E60] font-mono font-black text-[10px]">
                    Settings: {formatKes(instantRetailPrice)}
                  </span>
                </div>

                {/* One-Tap ML (Measurement) Selector Buttons */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1">
                    Choose Bottle Measurement (ML / Litre):
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[250, 330, 350, 500, 750, 1000].map(ml => (
                      <button
                        key={ml}
                        type="button"
                        onClick={() => applyBrandAndMlSelection(instantBrand, ml, instantTargetProductId || undefined)}
                        className={`py-1.5 rounded-lg font-mono font-black text-[10px] border transition cursor-pointer ${
                          instantVolumeMl === ml
                            ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {ml === 1000 ? '1L' : `${ml}ml`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pieces / Cases + Price Row */}
                <div className="grid grid-cols-12 gap-1.5 items-center pt-0.5">
                  <div className="col-span-5">
                    <div className="inline-flex w-full rounded-lg bg-white p-0.5 border border-slate-300 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setInstantScanUnitMode('BOTTLE')}
                        className={`flex-1 py-1 rounded-md cursor-pointer ${
                          instantScanUnitMode === 'BOTTLE' ? 'bg-[#34D186] text-[#FFDE00]' : 'text-slate-600'
                        }`}
                      >
                        Pieces
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstantScanUnitMode('CASE')}
                        className={`flex-1 py-1 rounded-md cursor-pointer ${
                          instantScanUnitMode === 'CASE' ? 'bg-[#34D186] text-[#FFDE00]' : 'text-slate-600'
                        }`}
                      >
                        Cases
                      </button>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min={1}
                      value={instantCasesQty}
                      onChange={(e) => setInstantCasesQty(Math.max(1, parseInt(e.target.value) || 1))}
                      title="Pieces or Cases per scan"
                      className="w-full px-2 py-1.5 bg-white border-2 border-[#34D186] rounded-lg text-xs font-mono font-black text-center text-[#1E9E60]"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      min={50}
                      value={instantRetailPrice}
                      onChange={(e) => setInstantRetailPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      title="Retail Price (KES) — auto-loaded from Settings"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-right text-[#0A006E]"
                    />
                  </div>
                </div>

                {/* Quick Pieces Presets */}
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span className="text-slate-500">Quick Qty:</span>
                  {[
                    { label: '1 Pc', qty: 1, mode: 'BOTTLE' as const },
                    { label: '6 Pcs', qty: 6, mode: 'BOTTLE' as const },
                    { label: '12 Pcs', qty: 12, mode: 'BOTTLE' as const },
                    { label: '24 Pcs', qty: 24, mode: 'BOTTLE' as const },
                    { label: '1 Case', qty: 1, mode: 'CASE' as const }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setInstantScanUnitMode(preset.mode);
                        setInstantCasesQty(preset.qty);
                      }}
                      className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                        instantScanUnitMode === preset.mode && instantCasesQty === preset.qty
                          ? 'bg-[#34D186] text-[#FFDE00] border-[#34D186]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 4: SCAN BARCODE (0MS INSTANT AUTO-TRIGGER + 1-CLICK ACTIVATE) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border-2 border-[#34D186] space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-montserrat font-black uppercase text-[#1E9E60] flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>4. Scan &amp; Activate</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setInstantScannerSource('BLUETOOTH')}
                      className={`px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer ${
                        instantScannerSource === 'BLUETOOTH' ? 'bg-[#0A006E] text-[#FFDE00]' : 'text-slate-600'
                      }`}
                    >
                      <Bluetooth className="w-3 h-3" />
                      <span>Scanner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstantScannerSource('MOBILE_CAMERA')}
                      className={`px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer ${
                        instantScannerSource === 'MOBILE_CAMERA' ? 'bg-[#0A006E] text-[#FFDE00]' : 'text-slate-600'
                      }`}
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>Camera</span>
                    </button>
                  </div>
                </div>

                {instantScannerSource === 'BLUETOOTH' ? (
                  isAwaitingNextInstantScan ? (
                    <div className="p-2.5 rounded-xl bg-white border-2 border-[#0A006E] space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-montserrat font-bold text-emerald-800">
                        <span className="truncate">
                          ✓ Scanned {instantLoadedFeed[0]?.product.name || instantBrand} (+{instantLoadedFeed[0]?.bottlesAdded ?? instantCasesQty} pcs)
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase shrink-0">
                          Paused
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleConfirmNextInstantScan}
                        className="w-full py-2 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                      >
                        <Barcode className="w-4 h-4" />
                        <span>Scan Next Barcode</span>
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (instantBarcodeInput.trim()) {
                          executeInstantScanOnboard(instantBarcodeInput);
                        } else {
                          const targetProd =
                            products.find(p => p.id === instantTargetProductId) ||
                            products.find(p => p.name.toLowerCase().includes(instantBrand.toLowerCase())) ||
                            products[0];
                          const codeToScan = targetProd
                            ? instantScanUnitMode === 'CASE'
                              ? targetProd.caseBarcode
                              : targetProd.barcode
                            : `616${Date.now().toString().slice(-9)}`;
                          executeInstantScanOnboard(codeToScan);
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        ref={bluetoothInputRef}
                        type="text"
                        value={instantBarcodeInput}
                        onChange={(e) => handleBluetoothBarcodeChange(e.target.value)}
                        placeholder="Scan barcode (0ms auto-fires)..."
                        className="flex-1 px-3 py-2 bg-white border-2 border-[#34D186] rounded-xl text-xs font-mono font-bold text-slate-900"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs shrink-0 cursor-pointer"
                      >
                        Scan
                      </button>
                    </form>
                  )
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-montserrat font-bold text-[#FFDE00]">
                        <Smartphone className="w-4 h-4 animate-pulse" />
                        <span>Camera Popup Open</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInstantScannerSource('BLUETOOTH')}
                        className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Close Camera
                      </button>
                    </div>

                    {/* INDEPENDENT SIMPLIFIED CAMERA BARCODE POPUP WINDOW */}
                    <div
                      className="fixed inset-0 z-[100] bg-[#0A006E] sm:bg-black/75 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
                      onClick={() => setInstantScannerSource('BLUETOOTH')}
                    >
                      <div
                        className="w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col justify-between"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="bg-[#0A006E] text-white px-5 py-4 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0">
                              <Camera className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-montserrat font-black text-sm text-white">
                                Barcode Scanner
                              </h3>
                              <p className="text-[11px] text-blue-200 truncate max-w-[220px]">
                                {isAwaitingNextInstantScan
                                  ? 'Scan paused — confirm to scan next barcode'
                                  : `${instantBrand || 'Scan barcode'} (${instantVolumeMl}ml • ${instantCasesQty} ${
                                      instantScanUnitMode === 'BOTTLE' ? 'Pcs' : 'Cases'
                                    })`}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setInstantScannerSource('BLUETOOTH')}
                            className="p-2 rounded-xl bg-white/10 hover:bg-red-600 text-white transition cursor-pointer"
                            title="Close Scanner"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="relative w-full flex-1 sm:flex-initial min-h-[260px] sm:h-64 bg-slate-950 flex items-center justify-center overflow-hidden">
                          <video
                            ref={mobileVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          {!instantCameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-slate-950/80">
                              <span className="text-xs text-slate-300 font-medium">
                                {instantCameraError || 'Starting camera...'}
                              </span>
                            </div>
                          )}
                          {!isAwaitingNextInstantScan && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                              <div className="w-64 sm:w-56 h-40 sm:h-36 rounded-2xl border-2 border-[#FFDE00] relative">
                                <div className="w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse mt-18 sm:mt-16" />
                              </div>
                            </div>
                          )}
                          {isAwaitingNextInstantScan && (
                            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center animate-in fade-in duration-150">
                              <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-2">
                                <CheckCircle2 className="w-6 h-6" />
                              </div>
                              <div className="text-sm font-montserrat font-black text-white truncate max-w-xs">
                                {instantLoadedFeed[0]?.product.name || instantBrand}
                              </div>
                              <div className="text-xs text-emerald-300 font-semibold mt-0.5">
                                +{instantLoadedFeed[0]?.bottlesAdded ?? instantCasesQty} pcs added • Stock now {instantLoadedFeed[0]?.newBottlesOnHand ?? 0} pcs
                              </div>
                              <p className="text-[11px] text-slate-300 mt-2 mb-3">
                                Scanner paused to prevent mistaken duplicate scan.
                              </p>
                              <div className="flex items-center gap-2.5 w-full max-w-xs">
                                <button
                                  type="button"
                                  onClick={handleConfirmNextInstantScan}
                                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FFDE00] hover:bg-yellow-300 text-[#0A006E] font-montserrat font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition"
                                >
                                  <Barcode className="w-4 h-4" />
                                  <span>Scan Next Barcode</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInstantScannerSource('BLUETOOTH')}
                                  className="py-2.5 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-montserrat font-bold text-xs cursor-pointer transition"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-3 bg-white shrink-0">
                          {feedbackBanner && (
                            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-[#0A006E] text-xs font-semibold">
                              {feedbackBanner}
                            </div>
                          )}

                          {isAwaitingNextInstantScan ? (
                            <button
                              type="button"
                              onClick={handleConfirmNextInstantScan}
                              className="w-full py-3 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
                            >
                              <Barcode className="w-4 h-4" />
                              <span>Scan Next Barcode</span>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={instantBarcodeInput}
                                onChange={e => handleBluetoothBarcodeChange(e.target.value)}
                                placeholder="Scan or enter barcode..."
                                className="flex-1 px-3.5 py-2.5 rounded-xl bg-blue-50/40 border border-blue-200 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-[#0A006E]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const targetProd =
                                    products.find(p => p.id === instantTargetProductId) ||
                                    products.find(p => p.name.toLowerCase().includes(instantBrand.toLowerCase())) ||
                                    products[0];
                                  const codeToScan =
                                    instantBarcodeInput.trim() ||
                                    (targetProd
                                      ? instantScanUnitMode === 'CASE'
                                        ? targetProd.caseBarcode
                                        : targetProd.barcode
                                      : `616${Date.now().toString().slice(-9)}`);
                                  executeInstantScanOnboard(codeToScan);
                                }}
                                className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs shrink-0 cursor-pointer"
                              >
                                Scan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!isAwaitingNextInstantScan && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetProd =
                        products.find(p => p.id === instantTargetProductId) ||
                        products.find(p => p.name.toLowerCase().includes(instantBrand.toLowerCase())) ||
                        products[0];
                      const codeToScan =
                        instantBarcodeInput.trim() ||
                        (targetProd
                          ? instantScanUnitMode === 'CASE'
                            ? targetProd.caseBarcode
                            : targetProd.barcode
                          : `616${Date.now().toString().slice(-9)}`);
                      executeInstantScanOnboard(codeToScan);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] border border-[#FFDE00]/50 font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#FFDE00]" />
                    <span>
                      ⚡ Scan &amp; Activate ({instantVolumeMl}ml • {instantCasesQty}{' '}
                      {instantScanUnitMode === 'BOTTLE' ? 'Pcs' : 'Cases'})
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Optional Image Upload from Drive or Link for Instant Scan */}
            {showInstantImagePicker && (
              <ProductImageSourcePicker
                value={instantCustomImage}
                onChange={setInstantCustomImage}
                productContext={{
                  name: instantBrand,
                  brand: instantBrand,
                  volumeMl: instantVolumeMl
                }}
                compact
              />
            )}

            {/* Recently Scanned Instant Feed with Direct Edit / Image / Delete Actions */}
            {instantLoadedFeed.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-montserrat font-black uppercase text-slate-500">
                  Recently Loaded via Instant Scan ({instantLoadedFeed.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {instantLoadedFeed.slice(0, 3).map(entry => {
                    const liveProd = products.find(p => p.id === entry.product.id) || entry.product;
                    return (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProductImage
                            product={liveProd}
                            size="xs"
                            onClick={() => {
                              setEditingImageProduct(liveProd);
                              setEditingImageUrl(getProductImageUrl(liveProd));
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[8px] uppercase">
                                AUTO-PINNED
                              </span>
                              <span className="font-montserrat font-bold text-slate-900 truncate">
                                {liveProd.name}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                              Stock: {entry.previousBottlesOnHand} → <strong>{entry.newBottlesOnHand} btls</strong> (+{entry.bottlesAdded})
                            </div>
                            <div className="text-[10px] font-mono font-bold text-[#0A006E]">
                              Asset Added: +{formatKes(entry.assetValueAddedKes)} (Total: {formatKes(entry.newTotalProductAssetKes)})
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditProductModal(liveProd)}
                            className="p-1.5 rounded-lg bg-white hover:bg-blue-50 text-[#0A006E] border border-slate-200"
                            title="Edit Product"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingImageProduct(liveProd);
                              setEditingImageUrl(getProductImageUrl(liveProd));
                            }}
                            className="p-1.5 rounded-lg bg-white hover:bg-blue-50 text-[#1E9E60] border border-slate-200"
                            title="Upload Image from Drive or Link"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(liveProd)}
                            className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-slate-200"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Controller Only — Incoming Shop Order Requests (Collapsible) */}
      {isIncomingOrdersOpen && (() => {
        const pendingOrders = restockRequests.filter(
          r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISPATCHED'
        );

        return (
          <div className="bg-white rounded-2xl border-2 border-[#0A006E] shadow-md overflow-hidden animate-in fade-in">
            <div className="bg-[#0A006E] px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#FFDE00] shrink-0" />
                <div>
                  <h3 className="font-montserrat font-black italic text-sm sm:text-base text-white">
                    Inventory Controller — Incoming Shop Order Requests ({pendingOrders.length})
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Order requests are only received by the Inventory Controller • Edit requested quantities or remove unavailable products before accepting
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-xs">
                  {pendingOrders.length} Awaiting Controller Acceptance
                </span>
                <button
                  type="button"
                  onClick={() => setIsIncomingOrdersOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  Hide
                </button>
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No pending shop order requests awaiting Inventory Controller acceptance.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {pendingOrders.map(req => {
                  const hasUnavailableItems = req.items.some(it => {
                    const whInv = inventoryItems.find(
                      inv => inv.branchId === req.toBranchId && inv.productId === it.productId
                    );
                    return (whInv?.bottlesOnHand ?? 0) < it.bottlesTotal || (whInv?.bottlesOnHand ?? 0) <= 0;
                  });

                  return (
                    <div key={req.id} className="p-5 hover:bg-slate-50/80 transition space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-xs text-[#0A006E] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                            {req.requestNumber}
                          </span>
                          <span className="text-xs font-montserrat font-black text-slate-900">
                            From Shop: <span className="text-[#0A006E]">{req.fromBranchName}</span> → Supplying Store:{' '}
                            <span className="text-[#1E9E60]">{req.toBranchName}</span>
                          </span>
                          {req.editedByController && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-montserrat font-black">
                              Edited by {req.editedByController}
                            </span>
                          )}
                        </div>

                        {hasUnavailableItems && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = removeAllUnavailableItemsFromRequest(req.id);
                              setFeedbackBanner(
                                `Removed ${res.removedCount} unavailable product(s) from ${req.requestNumber}. ${res.remainingCount} available item(s) ready for acceptance.`
                              );
                              setTimeout(() => setFeedbackBanner(null), 4500);
                            }}
                            className="px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-montserrat font-black text-[11px] flex items-center gap-1.5 transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Auto-Remove / Cap Unavailable Stock</span>
                          </button>
                        )}
                      </div>

                      {/* Editable Requested Stock List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {req.items.map(it => {
                          const whInv = inventoryItems.find(
                            inv => inv.branchId === req.toBranchId && inv.productId === it.productId
                          );
                          const prod = products.find(p => p.id === it.productId);
                          const packSize = prod?.packSize || 12;
                          const availBottles = whInv?.bottlesOnHand ?? 0;
                          const availCases = Math.floor(availBottles / packSize);
                          const isOut = availBottles <= 0;
                          const isShort = availBottles < it.bottlesTotal;

                          return (
                            <div
                              key={it.productId}
                              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                                isOut || isShort
                                  ? 'bg-red-50/70 border-red-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-montserrat font-black text-xs text-slate-900">
                                    {it.productName}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    SKU: {it.sku} • {packSize} btls/case
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                                    isOut
                                      ? 'bg-red-600 text-white'
                                      : isShort
                                      ? 'bg-amber-200 text-amber-950'
                                      : 'bg-emerald-100 text-[#1E9E60]'
                                  }`}
                                >
                                  {isOut
                                    ? 'UNAVAILABLE IN STOCK (0)'
                                    : `WH Stock: ${availCases} cs (${availBottles} btls)`}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-600">Edit Cases:</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRestockRequestItemQty(
                                        req.id,
                                        it.productId,
                                        Math.max(1, it.casesRequested - 1)
                                      )
                                    }
                                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-800"
                                    title="Decrease cases"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.casesRequested}
                                    onChange={(e) =>
                                      updateRestockRequestItemQty(
                                        req.id,
                                        it.productId,
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                    className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-black text-xs text-center text-[#0A006E]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRestockRequestItemQty(req.id, it.productId, it.casesRequested + 1)
                                    }
                                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-800"
                                    title="Increase cases"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    ({it.bottlesTotal} btls)
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    removeUnavailableItemFromRestockRequest(
                                      req.id,
                                      it.productId,
                                      'Removed by Inventory Controller — product unavailable in stock list'
                                    );
                                    setFeedbackBanner(
                                      `Inventory Controller removed unavailable product "${it.productName}" from ${req.requestNumber} stock list.`
                                    );
                                    setTimeout(() => setFeedbackBanner(null), 4000);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-montserrat font-black text-[10px] flex items-center gap-1 transition"
                                  title="Remove unavailable product from the order request stock list"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove Unavailable</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {req.removedItems && req.removedItems.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                          <strong>Removed Unavailable Products from Stock List:</strong>{' '}
                          {req.removedItems.map(r => `${r.productName} (${r.casesRequested} cs)`).join(', ')}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="text-[11px] text-slate-500 italic">
                          {req.notes} — <strong className="not-italic text-slate-700">{req.requestedBy}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              rejectRestockRequest(req.id, 'Rejected by Inventory Controller');
                              setFeedbackBanner(`Order request ${req.requestNumber} rejected by Inventory Controller.`);
                              setTimeout(() => setFeedbackBanner(null), 4000);
                            }}
                            className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-montserrat font-bold text-xs flex items-center gap-1.5 transition"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject Request</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              acceptAndFulfillRestockRequest(req.id);
                              setFeedbackBanner(
                                `Inventory Controller accepted ${req.requestNumber}! Available stock disbursed from ${req.toBranchName} to ${req.fromBranchName}.`
                              );
                              setTimeout(() => setFeedbackBanner(null), 4500);
                            }}
                            className="px-4 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md transition"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                            <span>Accept Edited Request &amp; Disburse Stock</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Multi-Year Invoice Archive & Retrieval Drawer (Retrievable Years into the Future) */}
      {isArchiveOpen && (
        <div className="bg-white rounded-2xl border-2 border-[#0A006E] p-5 sm:p-6 shadow-lg space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-montserrat font-black italic text-base sm:text-lg text-slate-900">
                  Permanent Multi-Year Invoice Archive &amp; Retrieval Vault
                </h3>
                <p className="text-xs text-slate-500">
                  Retrieve any supplier or inventory invoice across any fiscal year, inspect linked products, or onboard new SKUs under it.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateInvoiceOpen(true)}
                className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close Vault
              </button>
            </div>
          </div>

          {/* Year Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setArchiveYearFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition ${
                  archiveYearFilter === 'ALL'
                    ? 'bg-[#0A006E] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Years ({supplyInvoices.length})
              </button>
              {availableInvoiceYears.map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setArchiveYearFilter(yr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                    archiveYearFilter === yr
                      ? 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  FY {yr}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Search invoice #, supplier, SKU, or product..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
              />
            </div>
          </div>

          {/* Archived Invoices List */}
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
            {filteredArchivedInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No archived invoices found matching your year or search query.
              </div>
            ) : (
              filteredArchivedInvoices.map(inv => (
                <div
                  key={inv.id}
                  className="p-3.5 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs text-[#0A006E]">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-montserrat font-bold text-xs text-slate-900">
                        {inv.supplierName}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Date: {inv.deliveryDate}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-mono text-emerald-800 font-bold">
                        {inv.items.length} Product SKU(s)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Branch: <strong className="text-slate-700">{inv.branchName}</strong> · Packing List:{' '}
                      <span className="font-mono">{inv.packingListNumber}</span> · Total:{' '}
                      <strong className="text-[#0A006E]">{formatKes(inv.totalAmountKes)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingArchivedInvoice(inv)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-montserrat font-bold flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0A006E]" />
                      <span>Retrieve &amp; View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTargetInvoiceId(inv.id);
                        setIsInvoiceProductModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-xs font-montserrat font-bold flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Products Under Invoice</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* EASY INVENTORY QUICK-EDIT & BRANCH CONTROL BAR */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E] p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-2xs">
              <Pencil className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-montserrat font-black italic text-sm sm:text-base text-slate-900">
                  Easy Inventory Editor — {activeBranch.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#1E9E60] font-montserrat font-black text-[10px]">
                  ✓ Instant Auto-Save Enabled
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Adjust stock in 1 tap or enable Inline Quick-Edit to update Name, SKU, Category, Barcodes, Stock or Prices directly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-2 shrink-0">
            {/* Branch Switcher right on the Inventory Editor */}
            <div className="sm:col-span-2 lg:col-span-1 flex items-center justify-between gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 min-h-[38px]">
              <div className="flex items-center gap-1.5 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                <span className="text-[10px] font-montserrat font-black uppercase text-slate-500">
                  Branch:
                </span>
              </div>
              <select
                value={activeBranch.id}
                onChange={(e) => switchBranch(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-montserrat font-bold text-[#0A006E] focus:outline-none cursor-pointer min-w-0 flex-1 sm:flex-initial"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.tier.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Lite Mode / Photo Toggle */}
            <button
              type="button"
              onClick={() => setShowProductThumbnails(prev => !prev)}
              className={`h-[38px] px-3.5 rounded-xl font-montserrat font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap ${
                showProductThumbnails
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  : 'bg-[#0A006E] text-[#FFDE00] border border-[#0A006E]'
              }`}
              title="Toggle product photos on/off for ultra-lite performance on mobile or desktop"
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{showProductThumbnails ? 'Photos: ON' : '⚡ Lite Mode (No Photos)'}</span>
            </button>

            {/* Inline Quick-Edit Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsInlineEditMode(prev => !prev)}
              className={`h-[38px] px-3.5 rounded-xl font-montserrat font-black text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap ${
                isInlineEditMode
                  ? 'bg-[#34D186] text-[#FFDE00] border-2 border-[#FFDE00]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
              title="Toggle direct spreadsheet editing in table cells"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>{isInlineEditMode ? '⚡ Inline Quick-Edit: ON' : 'Enable Inline Quick-Edit'}</span>
            </button>

            {/* Quick Add Row Button */}
            <button
              type="button"
              onClick={() => setIsQuickAddRowOpen(prev => !prev)}
              className="sm:col-span-2 lg:col-span-1 h-[38px] px-3.5 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] border border-[#0A006E]/30 font-montserrat font-black text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{isQuickAddRowOpen ? 'Close Quick-Add Row' : '+ Quick Add Product'}</span>
            </button>
          </div>
        </div>

        {/* INLINE QUICK-ADD PRODUCT FORM ROW */}
        {isQuickAddRowOpen && (
          <form
            onSubmit={handleQuickAddRowSubmit}
            className="p-3.5 rounded-2xl bg-emerald-50/70 border-2 border-[#34D186] space-y-2.5 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-montserrat font-black uppercase text-[#1E9E60]">
                ➕ Fast Inline New Product Entry (Saves directly to {activeBranch.name})
              </span>
              <button
                type="button"
                onClick={() => setIsQuickAddRowOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                ✕ Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Product Name *</label>
                <input
                  type="text"
                  required
                  value={quickAddForm.name}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jameson Black Barrel 750ml"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">SKU (Optional)</label>
                <input
                  type="text"
                  value={quickAddForm.sku}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                  placeholder="Auto-SKU"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">IPS / LPS &amp; Type</label>
                <div className="flex gap-1">
                  <select
                    value={quickAddForm.category}
                    onChange={e => setQuickAddForm(prev => ({ ...prev, category: e.target.value as StockCategory }))}
                    className="w-16 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="IPS">IPS</option>
                    <option value="LPS">LPS</option>
                  </select>
                  <select
                    value={quickAddForm.subCategory}
                    onChange={e => setQuickAddForm(prev => ({ ...prev, subCategory: e.target.value }))}
                    className="flex-1 min-w-0 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#1E9E60] mb-0.5">Stock (Bottles)</label>
                <input
                  type="number"
                  min={0}
                  value={quickAddForm.bottlesOnHand}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, bottlesOnHand: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full px-2.5 py-1.5 bg-white border-2 border-[#34D186] rounded-lg text-xs font-mono font-black text-[#1E9E60]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Unit Cost (KES)</label>
                <input
                  type="number"
                  min={0}
                  value={quickAddForm.warehouseCostKes}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, warehouseCostKes: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#0A006E] mb-0.5">Retail Price (KES) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quickAddForm.retailPriceKes}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, retailPriceKes: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0A006E] rounded-lg text-xs font-mono font-black text-[#0A006E]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full h-[34px] rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save SKU</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* BULK MULTI-PRODUCT EDIT BAR (Appears when rows are checked or via Select All) */}
        {selectedProductIds.length > 0 && (
          <div className="p-3 rounded-xl bg-blue-50/90 border-2 border-[#0A006E] flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs">
                {selectedProductIds.length} Selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Bulk Stock Add/Subtract */}
              <button
                type="button"
                onClick={() => {
                  selectedProductIds.forEach(id => {
                    const p = products.find(prod => prod.id === id);
                    const inv = inventoryItems.find(i => i.productId === id && i.branchId === activeBranch.id);
                    if (p) {
                      updateProduct(id, {}, (inv?.bottlesOnHand || 0) + (p.packSize || 12));
                      markProductRowSaved(id, '+1 Case');
                    }
                  });
                  setFeedbackBanner(`Added +1 Case to ${selectedProductIds.length} selected product(s) at ${activeBranch.name}!`);
                  setTimeout(() => setFeedbackBanner(null), 3500);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[11px] cursor-pointer"
              >
                +1 Case All
              </button>

              <button
                type="button"
                onClick={() => {
                  selectedProductIds.forEach(id => {
                    const p = products.find(prod => prod.id === id);
                    const inv = inventoryItems.find(i => i.productId === id && i.branchId === activeBranch.id);
                    if (p) {
                      updateProduct(id, {}, (inv?.bottlesOnHand || 0) + (p.packSize || 12) * 5);
                      markProductRowSaved(id, '+5 Cases');
                    }
                  });
                  setFeedbackBanner(`Added +5 Cases to ${selectedProductIds.length} selected product(s) at ${activeBranch.name}!`);
                  setTimeout(() => setFeedbackBanner(null), 3500);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-montserrat font-black text-[11px] cursor-pointer"
              >
                +5 Cases All
              </button>

              {/* Set Exact Bottles for Selected */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300">
                <input
                  type="number"
                  min={0}
                  value={bulkStockBottlesInput}
                  onChange={e => setBulkStockBottlesInput(e.target.value)}
                  placeholder="Set btls..."
                  className="w-20 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(bulkStockBottlesInput);
                    if (isNaN(val) || val < 0) return;
                    selectedProductIds.forEach(id => {
                      updateProduct(id, {}, val);
                      markProductRowSaved(id, `Stock=${val}`);
                    });
                    setBulkStockBottlesInput('');
                    setFeedbackBanner(`Set stock to ${val} btls for ${selectedProductIds.length} selected product(s)!`);
                    setTimeout(() => setFeedbackBanner(null), 3500);
                  }}
                  className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] cursor-pointer"
                >
                  Apply Stock
                </button>
              </div>

              {/* Set Exact Retail Price for Selected */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300">
                <input
                  type="number"
                  min={1}
                  value={bulkRetailPriceInput}
                  onChange={e => setBulkRetailPriceInput(e.target.value)}
                  placeholder="Set KES..."
                  className="w-20 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(bulkRetailPriceInput);
                    if (isNaN(val) || val <= 0) return;
                    selectedProductIds.forEach(id => {
                      updateProduct(id, { retailPriceKes: val });
                      markProductRowSaved(id, `KES ${val}`);
                    });
                    setBulkRetailPriceInput('');
                    setFeedbackBanner(`Updated Retail Price to ${formatKes(val)} for ${selectedProductIds.length} selected product(s)!`);
                    setTimeout(() => setFeedbackBanner(null), 3500);
                  }}
                  className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] cursor-pointer"
                >
                  Apply Price
                </button>
              </div>

              {/* Bulk Change Sub-Category */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300">
                <select
                  value={bulkSubCategoryInput}
                  onChange={e => setBulkSubCategoryInput(e.target.value)}
                  className="text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="">Move to Category...</option>
                  {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                {bulkSubCategoryInput && (
                  <button
                    type="button"
                    onClick={() => {
                      selectedProductIds.forEach(id => {
                        updateProduct(id, { subCategory: bulkSubCategoryInput });
                        markProductRowSaved(id, bulkSubCategoryInput);
                      });
                      setFeedbackBanner(`Moved ${selectedProductIds.length} product(s) to ${bulkSubCategoryInput}!`);
                      setBulkSubCategoryInput('');
                      setTimeout(() => setFeedbackBanner(null), 3500);
                    }}
                    className="px-2 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[10px] cursor-pointer"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unified Catalogue Filter & Prominent Search Panel */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/20 p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Top Prominent Inventory Search & Out-of-Stock Activation Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            {/* Global Inventory Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#0A006E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Inventory by Product Name, Brand, SKU, Volume, or Barcode..."
                className="h-11 w-full pl-10 pr-20 bg-slate-50 focus:bg-white border-2 border-[#0A006E] rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none transition shadow-2xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                >
                  Clear ✕
                </button>
              ) : (
                <span className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">
                  {filteredProducts.length} / {products.length} SKUs
                </span>
              )}
            </div>

            {/* Brand Quick Filter Dropdown */}
            <select
              value={activeBrandFilter}
              onChange={(e) => setActiveBrandFilter(e.target.value)}
              className="h-11 px-3 bg-slate-50 border-2 border-slate-200 focus:border-[#0A006E] rounded-xl text-xs font-montserrat font-bold text-slate-800 cursor-pointer shrink-0"
              title="Filter Inventory by Brand"
            >
              <option value="ALL">All Brands ({availableBrandList.length})</option>
              {availableBrandList.map(([brandName, count]) => (
                <option key={brandName} value={brandName}>
                  {brandName} ({count})
                </option>
              ))}
            </select>

            {(searchQuery ||
              activeCategory !== 'ALL' ||
              activeSubCategory !== 'ALL' ||
              activeBrandFilter !== 'ALL' ||
              stockAvailabilityFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('ALL');
                  setActiveSubCategory('ALL');
                  setActiveBrandFilter('ALL');
                  setStockAvailabilityFilter('ALL');
                }}
                className="h-11 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-xs whitespace-nowrap cursor-pointer shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* 1-Click Out-of-Stock Onboarding & Activation Wizard Launcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setWizardInitialBarcode('');
                setWizardInitialProductId('');
                setWizardInitialStep(3);
                setIsBarcodeWizardOpen(true);
              }}
              className="h-11 px-4 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] border-2 border-[#FFDE00] font-montserrat font-black text-xs inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer w-full sm:w-auto"
            >
              <Barcode className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span>Onboard / Activate Out-of-Stock Wizard ({outOfStockSkuCount} Out)</span>
            </button>
          </div>
        </div>

        {/* Row 1: IPS/LPS Category Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`h-10 px-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-montserrat font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-[#0A006E] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>All Stocks</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-black/15 rounded font-mono">{products.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('IPS')}
              className={`h-10 px-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-montserrat font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'IPS'
                  ? 'bg-[#34D186] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="sm:hidden">IPS</span>
              <span className="hidden sm:inline">IPS (Imported Stock)</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-black/15 rounded font-mono">{totalIpsProducts}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('LPS')}
              className={`h-10 px-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-montserrat font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'LPS'
                  ? 'bg-[#FFDE00] text-[#0A006E] shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="sm:hidden">LPS</span>
              <span className="hidden sm:inline">LPS (Local Stock)</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-black/10 rounded font-mono">{totalLpsProducts}</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
            <span>
              Matching Results: <strong className="text-[#0A006E]">{filteredProducts.length}</strong> of {products.length} SKUs
            </span>
          </div>
        </div>

        {/* Row 2: NairobiDrinks.co.ke Spirit & Beverage Subcategory Filter Bar */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSubCategory('ALL')}
            className={`h-8 px-3 rounded-lg text-xs font-montserrat font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubCategory === 'ALL'
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Categories ({products.length})
          </button>
          {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => {
            const count = subCategoryCountMap.get(sub) || 0;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setActiveSubCategory(sub)}
                className={`h-8 px-3 rounded-lg text-xs font-montserrat font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSubCategory === sub
                    ? 'bg-[#34D186] text-[#FFDE00] shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sub} ({count})
              </button>
            );
          })}
        </div>

        {/* Row 3: Live Stock Availability Filter Bar + Auto-Pinned Barcode Match Banner */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 lg:flex-wrap">
            <span className="text-[10px] font-montserrat font-black uppercase text-slate-400 mr-1 shrink-0">
              Stock Status:
            </span>
            {(
              [
                { id: 'ALL', label: `All Catalog (${products.length})` },
                { id: 'IN_STOCK', label: `✓ In Stock (${inStockSkuCount})` },
                { id: 'LOW_STOCK', label: `⚠️ Low Stock (${lowStockSkuCount})` },
                { id: 'OUT_OF_STOCK', label: `✕ Out of Stock (${outOfStockSkuCount})` },
                { id: 'CREAM_FEFO', label: `❄️ Cream FEFO Rotation (${creamFefoSkuCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockAvailabilityFilter(tab.id)}
                className={`h-8 px-3 rounded-lg text-xs font-montserrat font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  stockAvailabilityFilter === tab.id
                    ? 'bg-[#34D186] text-[#FFDE00] shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {autoPinnedScanInfo && (() => {
            const pinnedProd = productByIdMap.get(autoPinnedScanInfo.productId);
            if (!pinnedProd) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border-2 border-[#34D186] text-xs">
                <span className="px-2 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[10px]">
                  📌 AUTO-PINNED ROW #1
                </span>
                <span className="font-montserrat font-black text-slate-900">
                  {pinnedProd.name} ({pinnedProd.sku})
                </span>
                <span className="font-mono text-[11px] text-[#1E9E60] font-bold">
                  Stock: {autoPinnedScanInfo.previousBottlesOnHand} → {autoPinnedScanInfo.newBottlesOnHand} btls (+{autoPinnedScanInfo.bottlesAdded})
                </span>
                <span className="font-mono text-[11px] text-[#0A006E] font-bold">
                  Asset: {formatKes(autoPinnedScanInfo.newTotalProductAssetKes)} (+{formatKes(autoPinnedScanInfo.assetValueAddedKes)})
                </span>
                <button
                  type="button"
                  onClick={() => setAutoPinnedScanInfo(null)}
                  className="text-slate-400 hover:text-slate-800 font-bold ml-1 cursor-pointer"
                  title="Unpin from top"
                >
                  ✕
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main Inventory Catalogue (Responsive Mobile Cards + Aligned Desktop Ledger Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Pagination & Fast Rendering Bar */}
        <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 text-slate-600">
            <span className="font-montserrat font-bold text-slate-800">
              Showing{' '}
              {filteredProducts.length === 0
                ? 0
                : (safeCurrentPage - 1) * pageSize + 1}
              –{Math.min(safeCurrentPage * pageSize, filteredProducts.length)} of{' '}
              <strong className="text-[#0A006E]">{filteredProducts.length}</strong> SKUs
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#1E9E60] border border-emerald-200 font-mono text-[10px] font-bold">
              ⚡ Fast Paginated View
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 cursor-pointer"
              >
                <option value={25}>25 / page</option>
                <option value={40}>40 / page</option>
                <option value={100}>100 / page</option>
                <option value={1000}>All ({filteredProducts.length})</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 font-montserrat font-bold text-xs text-slate-800 cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-2 font-mono font-bold text-xs text-[#0A006E] whitespace-nowrap">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] disabled:opacity-40 text-[#FFDE00] font-montserrat font-bold text-xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE & TABLET CATALOGUE VIEW (lg:hidden) — Cleanly Aligned Cards */}
        <div className="lg:hidden">
          {/* Mobile Select All Bar */}
          <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs">
            <label className="inline-flex items-center gap-2 font-montserrat font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  paginatedProducts.length > 0 &&
                  paginatedProducts.every(p => selectedProductIdSet.has(p.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedProductIds(prev =>
                      Array.from(new Set([...prev, ...paginatedProducts.map(p => p.id)]))
                    );
                  } else {
                    const pageIds = new Set(paginatedProducts.map(p => p.id));
                    setSelectedProductIds(prev => prev.filter(id => !pageIds.has(id)));
                  }
                }}
                className="w-4 h-4 rounded accent-[#0A006E] cursor-pointer"
              />
              <span>Select All on Page ({paginatedProducts.length})</span>
            </label>
            <span className="text-[11px] font-mono text-slate-500">
              Branch: <strong className="text-[#0A006E]">{activeBranch.name.split(' ')[0]}</strong>
            </span>
          </div>

          {paginatedProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-montserrat font-bold">
              No matching catalogue products found for the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 bg-slate-50/60">
              {paginatedProducts.map((product) => {
                const inv = branchInventoryByProductMap.get(product.id);
                const bottles = inv?.bottlesOnHand || 0;
                const packSize = Math.max(1, product.packSize || 12);
                const cases = Math.floor(bottles / packSize);
                const isLowStock = bottles <= (inv?.reorderLevel || 12);
                const isAutoPinned = autoPinnedScanInfo?.productId === product.id;
                const isAlreadyScanned = scannedProductRankMap.has(product.id);
                const savedBadgeText = recentlySavedRows[product.id];
                const isSelected = selectedProductIdSet.has(product.id);
                const lineCostAssetKes = bottles * product.warehouseCostKes;
                const lineRetailAssetKes = bottles * product.retailPriceKes;

                return (
                  <div
                    key={`mob-${product.id}`}
                    className={`rounded-xl border p-3.5 bg-white shadow-2xs flex flex-col justify-between gap-3 transition ${
                      isAutoPinned
                        ? 'border-[#34D186] ring-2 ring-[#34D186] bg-emerald-50/40'
                        : isAlreadyScanned
                        ? 'border-l-4 border-l-[#34D186] border-slate-200'
                        : isSelected
                        ? 'border-[#0A006E] bg-blue-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Header: Checkbox + Image + Product Title/SKU + IPS/LPS Badge */}
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="w-4 h-4 mt-1 rounded accent-[#0A006E] shrink-0 cursor-pointer"
                      />
                      {showProductThumbnails && (
                        <div className="shrink-0">
                          <ProductImage
                            product={product}
                            size="sm"
                            showVolumeBadge
                            onClick={() => {
                              setEditingImageProduct(product);
                              setEditingImageUrl(getProductImageUrl(product));
                            }}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-montserrat font-black text-xs text-slate-900 leading-snug line-clamp-2">
                            {product.name}
                          </h4>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-black font-montserrat ${
                              product.category === 'IPS'
                                ? 'bg-[#34D186]/10 text-[#1E9E60] border border-[#34D186]/20'
                                : 'bg-[#FFDE00]/40 text-[#0A006E] border border-[#FFDE00]'
                            }`}
                          >
                            {product.category}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500">
                          <span className="font-bold text-slate-700">{product.sku}</span>
                          <span>•</span>
                          <span>{product.volumeMl}ml</span>
                          <span>•</span>
                          <span>1 cs = {packSize} btls</span>
                          {product.subCategory && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0A006E] font-montserrat font-bold text-[9px]">
                              {product.subCategory}
                            </span>
                          )}
                        </div>

                        {(isAutoPinned || isAlreadyScanned || savedBadgeText) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {isAutoPinned && (
                              <span className="px-2 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[9px] uppercase">
                                ⚡ ACTIVATED • ON TOP
                              </span>
                            )}
                            {isAlreadyScanned && !isAutoPinned && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[9px] uppercase">
                                ✓ ACTIVATED &amp; SCANNED
                              </span>
                            )}
                            {(inv?.linkedInvoiceNumber || product.linkedInvoiceNumber) && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0A006E] border border-blue-200 font-mono font-bold text-[9px]">
                                Inv: {inv?.linkedInvoiceNumber || product.linkedInvoiceNumber}
                              </span>
                            )}
                            {savedBadgeText && (
                              <span className="px-2 py-0.5 rounded-full bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[9px]">
                                ✓ {savedBadgeText}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle 2x2 Aligned Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      {/* Stock Box */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-montserrat font-bold uppercase text-slate-400">
                            Stock ({activeBranch.name.split(' ')[0]})
                          </span>
                          {bottles <= 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const pcs = productIndicatedPiecesMap[product.id] ?? packSize;
                                setWizardInitialProductId(product.id);
                                setWizardInitialBarcode(product.barcode);
                                setWizardInitialPieces(pcs);
                                setWizardInitialStep(3);
                                setIsBarcodeWizardOpen(true);
                              }}
                              className="px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-montserrat font-black text-[9px] cursor-pointer inline-flex items-center gap-0.5 border border-red-300 transition"
                              title="Click to scan barcode and activate stock"
                            >
                              <Zap className="w-2.5 h-2.5 fill-current" />
                              <span>OUT (ACTIVATE)</span>
                            </button>
                          ) : isLowStock ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-montserrat font-black text-[9px]">
                              LOW
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[9px]">
                              OK
                            </span>
                          )}
                        </div>

                        {isInlineEditMode ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              defaultValue={bottles}
                              key={`mob-btls-${product.id}-${activeBranch.id}-${bottles}`}
                              onBlur={(e) => {
                                const nextBtls = Math.max(0, parseInt(e.target.value) || 0);
                                if (nextBtls !== bottles) {
                                  handleInlineFieldUpdate(product, {}, nextBtls, `${nextBtls} btls`);
                                }
                              }}
                              className="w-16 px-1.5 py-1 bg-white border-2 border-[#34D186] rounded font-montserrat font-black text-xs text-[#1E9E60] text-center tabular-nums"
                            />
                            <span className="text-[10px] font-mono text-slate-500">btls ({cases} cs)</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-montserrat font-black text-sm text-slate-900 tabular-nums">
                              {bottles} btls
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                              ({cases} cs)
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleInlineFieldUpdate(
                                product,
                                {},
                                Math.max(0, bottles - packSize),
                                `-${packSize} btls`
                              )
                            }
                            className="h-6 rounded bg-white hover:bg-red-50 text-slate-700 border border-slate-200 font-mono font-bold text-[10px] cursor-pointer"
                          >
                            -1C
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleInlineFieldUpdate(product, {}, Math.max(0, bottles - 1), '-1 btl')
                            }
                            className="h-6 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-mono font-black text-[10px] cursor-pointer"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleInlineFieldUpdate(product, {}, bottles + 1, '+1 btl')
                            }
                            className="h-6 rounded bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-200 font-mono font-black text-[10px] cursor-pointer"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleInlineFieldUpdate(
                                product,
                                {},
                                bottles + packSize,
                                `+1 Case (+${packSize})`
                              )
                            }
                            className="h-6 rounded bg-[#34D186] text-[#FFDE00] font-mono font-bold text-[10px] cursor-pointer"
                          >
                            +1C
                          </button>
                        </div>
                      </div>

                      {/* Pricing & Asset Box */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-sans text-slate-500">Retail:</span>
                          {isInlineEditMode ? (
                            <input
                              type="number"
                              min={1}
                              defaultValue={product.retailPriceKes}
                              key={`mob-ret-${product.id}-${product.retailPriceKes}`}
                              onBlur={(e) => {
                                const nextRetail = Math.max(1, parseFloat(e.target.value) || product.retailPriceKes);
                                if (nextRetail !== product.retailPriceKes) {
                                  handleInlineFieldUpdate(
                                    product,
                                    { retailPriceKes: nextRetail },
                                    undefined,
                                    `Retail ${formatKes(nextRetail)}`
                                  );
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 bg-white border border-[#0A006E] rounded font-bold text-right text-[#0A006E] tabular-nums"
                            />
                          ) : (
                            <span className="font-bold text-slate-900 tabular-nums">
                              {formatKes(product.retailPriceKes)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-sans text-slate-500">Unit Cost:</span>
                          {isInlineEditMode ? (
                            <input
                              type="number"
                              min={0}
                              defaultValue={product.warehouseCostKes}
                              key={`mob-cost-${product.id}-${product.warehouseCostKes}`}
                              onBlur={(e) => {
                                const nextCost = Math.max(0, parseFloat(e.target.value) || product.warehouseCostKes);
                                if (nextCost !== product.warehouseCostKes) {
                                  handleInlineFieldUpdate(
                                    product,
                                    { warehouseCostKes: nextCost },
                                    undefined,
                                    `Cost ${formatKes(nextCost)}`
                                  );
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-right text-[#1E9E60] tabular-nums"
                            />
                          ) : (
                            <span className="text-slate-600 tabular-nums">
                              {formatKes(product.warehouseCostKes)}
                            </span>
                          )}
                        </div>
                        <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between">
                          <span className="text-[10px] font-sans font-bold text-[#1E9E60]">Asset:</span>
                          <span className="font-black text-[#1E9E60] tabular-nums">
                            {formatKes(lineCostAssetKes)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scan Barcode Under This Specific Product (Indicate Pieces -> Scan Barcode -> Activate Stock) */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60] flex items-center gap-1">
                            <Barcode className="w-3 h-3" />
                            <span>Scan Barcode to Activate Stock</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-600">Pieces:</span>
                            <input
                              type="number"
                              min={1}
                              value={productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize)}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setProductIndicatedPiecesMap(prev => ({ ...prev, [product.id]: val }));
                              }}
                              className="w-14 h-6 px-1.5 bg-white border-2 border-[#34D186] rounded-md font-mono font-black text-xs text-center text-[#1E9E60]"
                              title="Indicate how many pieces to activate on barcode scan"
                            />
                            <span className="text-[10px] font-mono font-bold text-[#1E9E60]">pcs</span>
                          </div>
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                            handleScanBarcodeUnderSpecificProduct(
                              product,
                              productDirectBarcodeMap[product.id] || product.barcode,
                              pcs,
                              true
                            );
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={productDirectBarcodeMap[product.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProductDirectBarcodeMap(prev => ({ ...prev, [product.id]: val }));
                              if (productScanTimersRef.current[product.id]) {
                                window.clearTimeout(productScanTimersRef.current[product.id]);
                              }
                              const clean = val.trim();
                              if (clean.length >= 8 && /^\d+$/.test(clean)) {
                                productScanTimersRef.current[product.id] = window.setTimeout(() => {
                                  const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                                  handleScanBarcodeUnderSpecificProduct(product, clean, pcs, true);
                                }, 50);
                              }
                            }}
                            placeholder={`Scan barcode (${product.barcode})...`}
                            className="flex-1 h-7 px-2 bg-white border border-emerald-300 rounded-lg text-[11px] font-mono text-slate-900 focus:outline-none focus:border-[#34D186]"
                          />
                          <button
                            type="submit"
                            className="h-7 px-2.5 bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-lg text-[10px] font-montserrat font-black inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Activate product in stock with the indicated pieces"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Activate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                              setWizardInitialProductId(product.id);
                              setWizardInitialBarcode(product.barcode);
                              setWizardInitialPieces(pcs);
                              setWizardInitialStep(3);
                              setIsBarcodeWizardOpen(true);
                            }}
                            className="h-7 px-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-lg text-[10px] font-montserrat font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Open Camera / Scanner Gun for this product with the indicated pieces"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Cam</span>
                          </button>
                        </form>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                          Btl: <span className="text-slate-700 font-semibold">{product.barcode}</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => openEditProductModal(product)}
                            className="h-7 px-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingImageProduct(product);
                              setEditingImageUrl(getProductImageUrl(product));
                            }}
                            className="h-7 px-2 bg-emerald-50 text-[#1E9E60] border border-emerald-200 rounded-lg text-[11px] inline-flex items-center justify-center cursor-pointer"
                            title="Update Photo"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openBatchExpiryModal(product)}
                            className="h-7 px-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] inline-flex items-center justify-center cursor-pointer"
                            title="Batch & Expiry"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(product)}
                            className="h-7 px-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] inline-flex items-center justify-center cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DESKTOP CATALOGUE TABLE VIEW (hidden lg:block) — Strictly Aligned Columns & Tabular Numbers */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 pl-4 pr-2 w-10 align-middle">
                  <input
                    type="checkbox"
                    checked={
                      paginatedProducts.length > 0 &&
                      paginatedProducts.every(p => selectedProductIdSet.has(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProductIds(prev =>
                          Array.from(new Set([...prev, ...paginatedProducts.map(p => p.id)]))
                        );
                      } else {
                        const pageIds = new Set(paginatedProducts.map(p => p.id));
                        setSelectedProductIds(prev => prev.filter(id => !pageIds.has(id)));
                      }
                    }}
                    className="w-3.5 h-3.5 rounded accent-[#0A006E] cursor-pointer"
                    title="Select all visible products on this page for bulk editing"
                  />
                </th>
                <th className="py-3 px-3 align-middle">Product, SKU &amp; Volume</th>
                <th className="py-3 px-3 align-middle">Classification &amp; Pack</th>
                <th className="py-3 px-3 align-middle">Barcodes (Bottle / Case)</th>
                <th className="py-3 px-3 align-middle">Available Stock ({activeBranch.name.split(' ')[0]})</th>
                <th className="py-3 px-3 align-middle text-right">Pricing (Retail / Cost KES)</th>
                <th className="py-3 px-3 align-middle text-right">Exact Asset &amp; FEFO Batch</th>
                <th className="py-3 pl-3 pr-4 align-middle text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map((product) => {
                const inv = branchInventoryByProductMap.get(product.id);
                const bottles = inv?.bottlesOnHand || 0;
                const packSize = Math.max(1, product.packSize || 12);
                const cases = Math.floor(bottles / packSize);
                const isLowStock = bottles <= (inv?.reorderLevel || 12);
                const isAutoPinned = autoPinnedScanInfo?.productId === product.id;
                const isAlreadyScanned = scannedProductRankMap.has(product.id);
                const savedBadgeText = recentlySavedRows[product.id];
                const isSelected = selectedProductIdSet.has(product.id);
                const lineCostAssetKes = bottles * product.warehouseCostKes;
                const lineRetailAssetKes = bottles * product.retailPriceKes;

                return (
                  <tr
                    key={product.id}
                    className={`transition ${
                      isAutoPinned
                        ? 'bg-emerald-50/90 ring-2 ring-inset ring-[#34D186]'
                        : isAlreadyScanned
                        ? 'bg-emerald-50/50 border-l-4 border-l-[#34D186]'
                        : savedBadgeText
                        ? 'bg-emerald-50/60'
                        : isSelected
                        ? 'bg-blue-50/50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Bulk Select Checkbox */}
                    <td className="py-3 pl-4 pr-2 align-middle w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="w-3.5 h-3.5 rounded accent-[#0A006E] cursor-pointer"
                      />
                    </td>

                    {/* Name, SKU, Brand, Volume + Product Image */}
                    <td className="py-3 px-3 align-middle min-w-[250px] max-w-[320px]">
                      <div className="flex items-center gap-3">
                        {showProductThumbnails && (
                          <div className="shrink-0">
                            <ProductImage
                              product={product}
                              size="sm"
                              showVolumeBadge
                              onClick={() => {
                                setEditingImageProduct(product);
                                setEditingImageUrl(getProductImageUrl(product));
                              }}
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          {(isAutoPinned || isAlreadyScanned || savedBadgeText) && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isAutoPinned && (
                                <span className="px-2 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[9px] uppercase">
                                  ⚡ ACTIVATED • ON TOP
                                </span>
                              )}
                              {isAlreadyScanned && !isAutoPinned && (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[9px] uppercase">
                                  ✓ ACTIVATED &amp; SCANNED
                                </span>
                              )}
                              {(inv?.linkedInvoiceNumber || product.linkedInvoiceNumber) && (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0A006E] border border-blue-200 font-mono font-bold text-[9px]">
                                  Inv: {inv?.linkedInvoiceNumber || product.linkedInvoiceNumber}
                                </span>
                              )}
                              {savedBadgeText && (
                                <span className="px-2 py-0.5 rounded-full bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[9px] inline-flex items-center gap-1 animate-in fade-in">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>✓ {savedBadgeText}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {isInlineEditMode ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                defaultValue={product.name}
                                key={`name-${product.id}-${product.name}`}
                                onBlur={(e) => {
                                  const nextName = e.target.value.trim();
                                  if (nextName && nextName !== product.name) {
                                    handleInlineFieldUpdate(product, { name: nextName }, undefined, 'Name Saved');
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-full px-2 py-1 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded-lg font-montserrat font-bold text-xs text-slate-900 focus:outline-none transition"
                                title="Click to edit product name directly"
                              />
                              <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                                <span className="text-slate-400">SKU:</span>
                                <input
                                  type="text"
                                  defaultValue={product.sku}
                                  key={`sku-${product.id}-${product.sku}`}
                                  onBlur={(e) => {
                                    const nextSku = e.target.value.trim().toUpperCase();
                                    if (nextSku && nextSku !== product.sku) {
                                      handleInlineFieldUpdate(product, { sku: nextSku }, undefined, 'SKU Saved');
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  }}
                                  className="w-24 px-1.5 py-0.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded font-mono font-bold text-[10px] text-slate-800 focus:outline-none"
                                  title="Edit SKU"
                                />
                                <input
                                  type="number"
                                  min={50}
                                  defaultValue={product.volumeMl}
                                  key={`vol-${product.id}-${product.volumeMl}`}
                                  onBlur={(e) => {
                                    const nextVol = Math.max(50, parseInt(e.target.value) || 750);
                                    if (nextVol !== product.volumeMl) {
                                      handleInlineFieldUpdate(product, { volumeMl: nextVol }, undefined, `${nextVol}ml`);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  }}
                                  className="w-14 px-1.5 py-0.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded font-mono text-[10px] text-slate-800 focus:outline-none"
                                  title="Bottle Volume (ml)"
                                />
                                <span className="text-slate-400">ml</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingImageProduct(product);
                                    setEditingImageUrl(getProductImageUrl(product));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#0A006E] border border-blue-200 font-montserrat font-bold text-[9px] inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title="Change product photo"
                                >
                                  <Upload className="w-2.5 h-2.5" />
                                  <span>Photo</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-montserrat font-bold text-slate-900 truncate" title={product.name}>
                                {product.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-700">{product.sku}</span>
                                <span>•</span>
                                <span>{product.brand} ({product.volumeMl}ml)</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* IPS vs LPS + SubCategory + Pack Size */}
                    <td className="py-3 px-3 align-middle whitespace-nowrap">
                      {isInlineEditMode ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const nextCat: StockCategory = product.category === 'IPS' ? 'LPS' : 'IPS';
                                handleInlineFieldUpdate(product, { category: nextCat }, undefined, nextCat);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-black font-montserrat transition cursor-pointer ${
                                product.category === 'IPS'
                                  ? 'bg-[#34D186] text-[#FFDE00]'
                                  : 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/30'
                              }`}
                              title="Click to toggle between IPS (Imported) and LPS (Local)"
                            >
                              {product.category === 'IPS' ? 'IPS • IMPORTED ⇄' : 'LPS • LOCAL ⇄'}
                            </button>
                          </div>

                          <select
                            value={product.subCategory || 'Whisky'}
                            onChange={(e) =>
                              handleInlineFieldUpdate(
                                product,
                                { subCategory: e.target.value },
                                undefined,
                                e.target.value
                              )
                            }
                            className="w-full px-2 py-1 bg-slate-50 hover:bg-white border border-slate-200 focus:border-[#0A006E] rounded-lg text-[11px] font-montserrat font-bold text-[#0A006E] focus:outline-none cursor-pointer"
                            title="Change Spirit / Beverage Sub-Category"
                          >
                            {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <span>1 Case =</span>
                            <input
                              type="number"
                              min={1}
                              defaultValue={product.packSize}
                              key={`pack-${product.id}-${product.packSize}`}
                              onBlur={(e) => {
                                const nextPack = Math.max(1, parseInt(e.target.value) || 12);
                                if (nextPack !== product.packSize) {
                                  handleInlineFieldUpdate(
                                    product,
                                    { packSize: nextPack },
                                    undefined,
                                    `${nextPack}/cs`
                                  );
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-11 px-1 py-0.5 bg-white border border-slate-200 rounded text-center font-bold text-slate-800"
                            />
                            <span>btls</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black font-montserrat ${
                              product.category === 'IPS'
                                ? 'bg-[#34D186]/10 text-[#1E9E60] border border-[#34D186]/20'
                                : 'bg-[#FFDE00]/30 text-[#0A006E] border border-[#FFDE00]'
                            }`}>
                              {product.category === 'IPS' ? 'IPS • IMPORTED' : 'LPS • LOCAL'}
                            </span>
                            {product.subCategory && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[#0A006E] font-montserrat font-bold text-[10px]">
                                {product.subCategory}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            1 Case = {product.packSize} btls
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Barcodes (Bottle / Case) */}
                    <td className="py-3 px-3 align-middle font-mono text-[11px] whitespace-nowrap">
                      {isInlineEditMode ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 w-8">Btl:</span>
                            <input
                              type="text"
                              defaultValue={product.barcode}
                              key={`btlcode-${product.id}-${product.barcode}`}
                              onBlur={(e) => {
                                const nextCode = e.target.value.trim();
                                if (nextCode && nextCode !== product.barcode) {
                                  handleInlineFieldUpdate(product, { barcode: nextCode }, undefined, 'Barcode Saved');
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-32 px-1.5 py-0.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded text-[10px] font-mono text-slate-800 focus:outline-none"
                              title="Edit Bottle Barcode"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 w-8">Case:</span>
                            <input
                              type="text"
                              defaultValue={product.caseBarcode}
                              key={`casecode-${product.id}-${product.caseBarcode}`}
                              onBlur={(e) => {
                                const nextCaseCode = e.target.value.trim();
                                if (nextCaseCode && nextCaseCode !== product.caseBarcode) {
                                  handleInlineFieldUpdate(product, { caseBarcode: nextCaseCode }, undefined, 'Case Code Saved');
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-32 px-1.5 py-0.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded text-[10px] font-mono text-slate-600 focus:outline-none"
                              title="Edit Master Case Barcode"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="space-y-0.5">
                            <div className="text-slate-800">
                              <span className="inline-block w-9 text-slate-400">Btl:</span>
                              <span className="tabular-nums">{product.barcode}</span>
                            </div>
                            <div className="text-slate-500">
                              <span className="inline-block w-9 text-slate-400">Case:</span>
                              <span className="tabular-nums">{product.caseBarcode}</span>
                            </div>
                          </div>

                          {/* Direct Product Barcode Scan + Pieces Activator */}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                              handleScanBarcodeUnderSpecificProduct(
                                product,
                                productDirectBarcodeMap[product.id] || product.barcode,
                                pcs,
                                true
                              );
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 space-y-1 max-w-[210px]"
                          >
                            <div className="flex items-center justify-between gap-1 font-sans">
                              <span className="text-[9px] font-montserrat font-black uppercase text-[#1E9E60]">
                                Pieces:
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  value={productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize)}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setProductIndicatedPiecesMap(prev => ({ ...prev, [product.id]: val }));
                                  }}
                                  className="w-12 h-5 px-1 bg-white border border-[#34D186] rounded font-mono font-black text-[10px] text-center text-[#1E9E60]"
                                  title="Indicate how many pieces to activate in stock when scanning barcode"
                                />
                                <span className="text-[9px] font-mono font-bold text-[#1E9E60]">pcs</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={productDirectBarcodeMap[product.id] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProductDirectBarcodeMap(prev => ({ ...prev, [product.id]: val }));
                                  if (productScanTimersRef.current[product.id]) {
                                    window.clearTimeout(productScanTimersRef.current[product.id]);
                                  }
                                  const clean = val.trim();
                                  if (clean.length >= 8 && /^\d+$/.test(clean)) {
                                    productScanTimersRef.current[product.id] = window.setTimeout(() => {
                                      const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                                      handleScanBarcodeUnderSpecificProduct(product, clean, pcs, true);
                                    }, 50);
                                  }
                                }}
                                placeholder="Scan barcode here..."
                                className="w-28 h-6 px-1.5 bg-white border border-emerald-300 rounded text-[10px] font-mono text-slate-900 focus:outline-none focus:border-[#34D186]"
                                title="Scan barcode under this specific product to activate stock based on indicated pieces"
                              />
                              <button
                                type="submit"
                                className="h-6 px-1.5 rounded bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[9px] inline-flex items-center gap-0.5 cursor-pointer"
                                title="Activate stock with indicated pieces"
                              >
                                <Zap className="w-2.5 h-2.5" />
                                <span>Scan</span>
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </td>

                    {/* Available Stock level (Direct Inline Bottles & Cases Editor + Quick Steppers) */}
                    <td className="py-3 px-3 align-middle whitespace-nowrap">
                      {isInlineEditMode ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            {/* Direct Bottles Input */}
                            <div className="flex items-center bg-white border-2 border-[#34D186] rounded-lg px-1.5 py-0.5">
                              <input
                                type="number"
                                min={0}
                                defaultValue={bottles}
                                key={`btls-${product.id}-${activeBranch.id}-${bottles}`}
                                onBlur={(e) => {
                                  const nextBtls = Math.max(0, parseInt(e.target.value) || 0);
                                  if (nextBtls !== bottles) {
                                    handleInlineFieldUpdate(product, {}, nextBtls, `${nextBtls} btls`);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-14 font-montserrat font-black text-xs text-[#1E9E60] text-center focus:outline-none tabular-nums"
                                title="Type exact bottle count and press Enter"
                              />
                              <span className="text-[9px] font-mono font-bold text-slate-500">btls</span>
                            </div>

                            {/* Direct Cases Input */}
                            <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-0.5">
                              <input
                                type="number"
                                min={0}
                                defaultValue={cases}
                                key={`cases-${product.id}-${activeBranch.id}-${cases}`}
                                onBlur={(e) => {
                                  const nextCases = Math.max(0, parseInt(e.target.value) || 0);
                                  if (nextCases !== cases) {
                                    const computedBtls = nextCases * packSize;
                                    handleInlineFieldUpdate(product, {}, computedBtls, `${nextCases} cs`);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-10 font-mono font-bold text-xs text-[#0A006E] text-center bg-transparent focus:outline-none tabular-nums"
                                title={`Type case count (1 case = ${packSize} btls)`}
                              />
                              <span className="text-[9px] font-mono text-slate-500">cs</span>
                            </div>
                          </div>

                          {/* 1-Click Stock Stepper Buttons (-1C, -1, +1, +1C) */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  Math.max(0, bottles - packSize),
                                  `-${packSize} btls`
                                )
                              }
                              className="h-6 px-1.5 rounded bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-800 border border-slate-200 font-mono font-bold text-[10px] transition cursor-pointer"
                              title={`Subtract 1 Case (-${packSize} bottles)`}
                            >
                              -1C
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  Math.max(0, bottles - 1),
                                  '-1 btl'
                                )
                              }
                              className="h-6 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-mono font-black text-[10px] transition cursor-pointer"
                              title="Subtract 1 Bottle"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(product, {}, bottles + 1, '+1 btl')
                              }
                              className="h-6 px-2 rounded bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-200 font-mono font-black text-[10px] transition cursor-pointer"
                              title="Add 1 Bottle"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  bottles + packSize,
                                  `+1 Case (+${packSize})`
                                )
                              }
                              className="h-6 px-1.5 rounded bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-mono font-bold text-[10px] transition cursor-pointer"
                              title={`Add 1 Case (+${packSize} bottles)`}
                            >
                              +1C
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-montserrat font-black text-sm text-slate-900 tabular-nums">
                              {bottles} btls
                            </span>
                            <span className="text-slate-500 text-[11px] font-mono tabular-nums">
                              ({cases} cs)
                            </span>
                            {bottles <= 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const pcs = productIndicatedPiecesMap[product.id] ?? packSize;
                                  setWizardInitialProductId(product.id);
                                  setWizardInitialBarcode(product.barcode);
                                  setWizardInitialPieces(pcs);
                                  setWizardInitialStep(3);
                                  setIsBarcodeWizardOpen(true);
                                }}
                                className="px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[9px] font-montserrat font-black inline-flex items-center gap-1 cursor-pointer transition"
                                title="Click to scan barcode and activate stock"
                              >
                                <Zap className="w-2.5 h-2.5 fill-current" />
                                <span>Out (Activate)</span>
                              </button>
                            ) : isLowStock ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-montserrat font-bold">
                                Low
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-montserrat font-bold">
                                In Stock
                              </span>
                            )}
                          </div>
                          {/* Lightweight 1-Click Stock Stepper Buttons (-1C, -1, +1, +1C) */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  Math.max(0, bottles - packSize),
                                  `-${packSize} btls`
                                )
                              }
                              className="h-6 px-1.5 rounded bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-800 border border-slate-200 font-mono font-bold text-[10px] transition cursor-pointer"
                              title={`Subtract 1 Case (-${packSize} bottles)`}
                            >
                              -1C
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  Math.max(0, bottles - 1),
                                  '-1 btl'
                                )
                              }
                              className="h-6 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-mono font-black text-[10px] transition cursor-pointer"
                              title="Subtract 1 Bottle"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(product, {}, bottles + 1, '+1 btl')
                              }
                              className="h-6 px-2 rounded bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-200 font-mono font-black text-[10px] transition cursor-pointer"
                              title="Add 1 Bottle"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldUpdate(
                                  product,
                                  {},
                                  bottles + packSize,
                                  `+1 Case (+${packSize})`
                                )
                              }
                              className="h-6 px-1.5 rounded bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-mono font-bold text-[10px] transition cursor-pointer"
                              title={`Add 1 Case (+${packSize} bottles)`}
                            >
                              +1C
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Pricing: Direct Inline Edit for Retail, Wholesale & Unit Cost */}
                    <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                      {isInlineEditMode ? (
                        <div className="space-y-1 font-mono text-[11px] inline-block text-left min-w-[155px]">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-sans font-bold text-[#0A006E]">Retail:</span>
                            <div className="flex items-center bg-white border-2 border-[#0A006E] rounded-lg px-1.5 py-0.5">
                              <span className="text-[9px] text-slate-400 mr-1">KES</span>
                              <input
                                type="number"
                                min={1}
                                defaultValue={product.retailPriceKes}
                                key={`ret-${product.id}-${product.retailPriceKes}`}
                                onBlur={(e) => {
                                  const nextRetail = Math.max(1, parseFloat(e.target.value) || product.retailPriceKes);
                                  if (nextRetail !== product.retailPriceKes) {
                                    handleInlineFieldUpdate(
                                      product,
                                      { retailPriceKes: nextRetail },
                                      undefined,
                                      `Retail ${formatKes(nextRetail)}`
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-16 font-mono font-black text-xs text-[#0A006E] text-right focus:outline-none tabular-nums"
                                title="Edit Retail Selling Price (KES)"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-sans text-slate-500">Whsle:</span>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
                              <span className="text-[9px] text-slate-400 mr-1">KES</span>
                              <input
                                type="number"
                                min={0}
                                defaultValue={product.wholesalePriceKes}
                                key={`whs-${product.id}-${product.wholesalePriceKes}`}
                                onBlur={(e) => {
                                  const nextWhs = Math.max(0, parseFloat(e.target.value) || product.wholesalePriceKes);
                                  if (nextWhs !== product.wholesalePriceKes) {
                                    handleInlineFieldUpdate(
                                      product,
                                      { wholesalePriceKes: nextWhs },
                                      undefined,
                                      `Whsle ${formatKes(nextWhs)}`
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-16 font-mono font-bold text-[11px] text-slate-800 bg-transparent text-right focus:outline-none tabular-nums"
                                title="Edit Wholesale Price (KES)"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-sans text-slate-500">Cost:</span>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
                              <span className="text-[9px] text-slate-400 mr-1">KES</span>
                              <input
                                type="number"
                                min={0}
                                defaultValue={product.warehouseCostKes}
                                key={`cost-${product.id}-${product.warehouseCostKes}`}
                                onBlur={(e) => {
                                  const nextCost = Math.max(0, parseFloat(e.target.value) || product.warehouseCostKes);
                                  if (nextCost !== product.warehouseCostKes) {
                                    handleInlineFieldUpdate(
                                      product,
                                      { warehouseCostKes: nextCost },
                                      undefined,
                                      `Cost ${formatKes(nextCost)}`
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-16 font-mono font-bold text-[11px] text-[#1E9E60] bg-transparent text-right focus:outline-none tabular-nums"
                                title="Edit Warehouse Unit Cost (KES)"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5 tabular-nums">
                          <div className="text-slate-900 font-bold font-mono text-xs">
                            <span className="text-[10px] text-slate-400 font-sans font-normal mr-1.5">Retail:</span>
                            {formatKes(product.retailPriceKes)}
                          </div>
                          <div className="text-slate-500 text-[11px] font-mono">
                            <span className="text-[10px] text-slate-400 font-sans mr-1.5">Cost:</span>
                            {formatKes(product.warehouseCostKes)}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Exact Asset Value (Cost & Retail) + Tax / Batch FEFO */}
                    <td className="py-3 px-3 align-middle text-right whitespace-nowrap tabular-nums">
                      <div className="font-mono font-black text-xs text-[#1E9E60]">
                        <span className="text-[9px] font-sans font-bold text-slate-400 mr-1.5">Cost:</span>
                        {formatKes(lineCostAssetKes)}
                      </div>
                      <div className="font-mono text-[11px] text-[#0A006E] font-bold">
                        <span className="text-[9px] font-sans font-normal text-slate-400 mr-1.5">Retail:</span>
                        {formatKes(lineRetailAssetKes)}
                      </div>
                      {(product.isCreamBased || product.subCategory === 'Cream Liqueur' || inv?.expiryDate) && (() => {
                        const batchNo = inv?.batchNumber || `BAT-26-${product.sku.slice(-5)}`;
                        const expDate = inv?.expiryDate || product.defaultExpiryDate || '2027-10-15';
                        const daysLeft = Math.ceil((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isExpired = daysLeft <= 0;
                        const isRotateSoon = daysLeft > 0 && daysLeft <= 180;
                        return (
                          <div className="mt-1 pt-1 border-t border-slate-100 font-mono text-[10px]">
                            <button
                              type="button"
                              onClick={() => openBatchExpiryModal(product)}
                              className={`hover:underline ${
                                isExpired ? 'text-red-700 font-bold' : isRotateSoon ? 'text-amber-700 font-bold' : 'text-slate-500'
                              }`}
                              title="Click to edit Batch & Expiry Date"
                            >
                              {batchNo} • Exp: {expDate}
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 pl-3 pr-4 align-middle text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const pcs = productIndicatedPiecesMap[product.id] ?? (bottles > 0 ? bottles : packSize);
                            setWizardInitialProductId(product.id);
                            setWizardInitialBarcode(product.barcode);
                            setWizardInitialPieces(pcs);
                            setWizardInitialStep(3);
                            setIsBarcodeWizardOpen(true);
                          }}
                          className="h-8 px-2.5 bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-lg text-xs font-montserrat font-black inline-flex items-center justify-center gap-1 transition whitespace-nowrap cursor-pointer shadow-2xs"
                          title="Choose product, indicate pieces, and scan barcode to activate stock"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                          <span>Scan &amp; Activate</span>
                        </button>

                        {/* Edit Product Modal Button */}
                        <button
                          type="button"
                          onClick={() => openEditProductModal(product)}
                          className="h-8 px-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-lg text-xs font-montserrat font-bold inline-flex items-center justify-center gap-1 transition whitespace-nowrap cursor-pointer shadow-2xs"
                          title="Open Full Edit Modal"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Upload Image (Drive / Link) Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingImageProduct(product);
                            setEditingImageUrl(getProductImageUrl(product));
                          }}
                          className="h-8 w-8 bg-emerald-50 hover:bg-[#34D186] hover:text-[#FFDE00] text-[#1E9E60] border border-emerald-200 rounded-lg text-xs font-montserrat font-bold inline-flex items-center justify-center transition cursor-pointer"
                          title="Upload product image from Drive or Link"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>

                        {/* Batch/Expiry Button */}
                        <button
                          type="button"
                          onClick={() => openBatchExpiryModal(product)}
                          className="h-8 w-8 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-montserrat font-bold inline-flex items-center justify-center transition cursor-pointer"
                          title="Edit Batch & Expiry Date (FEFO)"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Product Button */}
                        <button
                          type="button"
                          onClick={() => setDeletingProduct(product)}
                          className="h-8 w-8 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 rounded-lg text-xs font-montserrat font-bold inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete product from catalog"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 font-medium">
              Page <strong className="text-slate-900">{safeCurrentPage}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({filteredProducts.length} total matching SKUs)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 font-montserrat font-bold text-xs text-slate-700 cursor-pointer"
              >
                First
              </button>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 font-montserrat font-bold text-xs text-slate-800 cursor-pointer"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] disabled:opacity-40 text-[#FFDE00] font-montserrat font-bold text-xs cursor-pointer"
              >
                Next →
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 font-montserrat font-bold text-xs text-slate-700 cursor-pointer"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Audit Log / Recent Scans */}
      {scanHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-montserrat font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-[#0A006E]" />
              <span>Barcode Intake &amp; Duplicate Audit Log (Redis Session Cache)</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              Total session logs: {scanHistory.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto text-xs">
            {scanHistory.slice(0, 10).map((scan) => (
              <div key={scan.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className={`w-2 h-2 rounded-full ${
                    scan.status === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <span className="font-bold text-slate-800">
                      {scan.productName || 'Unrecognized Item'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 ml-2">
                      [{scan.rawBarcode}]
                    </span>
                    {scan.type === 'MASTER_CASE' && (
                      <span className="ml-2 text-[10px] font-bold text-[#0A006E] bg-blue-50 px-1.5 py-0.2 rounded">
                        Case Unpacked ({scan.unpackedBottles} btls)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded font-montserrat ${
                    scan.status === 'ACCEPTED'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-800'
                  }`}>
                    {scan.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(scan.scannedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal (Single or Bulk Continuous) */}
      {scannerModalMode && (
        <BarcodeScannerModal
          mode={scannerModalMode}
          purpose="INVENTORY_INTAKE"
          onProductScanned={(prod, code) => {
            const inv = inventoryItems.find(
              i => i.productId === prod.id && i.branchId === activeBranch.id
            );
            const prevBtls = inv?.bottlesOnHand ?? 0;
            const added = scannerModalMode === 'BULK' || code === prod.caseBarcode ? prod.packSize : 1;
            const nextBtls = prevBtls + added;
            setAutoPinnedScanInfo({
              productId: prod.id,
              rawBarcode: code,
              previousBottlesOnHand: prevBtls,
              newBottlesOnHand: nextBtls,
              bottlesAdded: added,
              assetValueAddedKes: added * prod.warehouseCostKes,
              newTotalProductAssetKes: nextBtls * prod.warehouseCostKes,
              scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
          }}
          onOpenOnboardingWizard={(unrecognizedBarcode) => {
            setScannerModalMode(null);
            setWizardInitialBarcode(unrecognizedBarcode);
            setIsBarcodeWizardOpen(true);
          }}
          onClose={() => setScannerModalMode(null)}
        />
      )}

      {/* Step-by-Step Stock Activation & Barcode Onboarding Wizard */}
      {isBarcodeWizardOpen && (
        <BarcodeOnboardingWizardModal
          initialBarcode={wizardInitialBarcode}
          initialProductId={wizardInitialProductId}
          initialPiecesIndicated={wizardInitialPieces}
          initialStep={wizardInitialStep}
          initialInvoiceId={selectedTargetInvoiceId || supplyInvoices[0]?.id}
          onProductOnboarded={(entry) => {
            setAutoPinnedScanInfo({
              productId: entry.product.id,
              rawBarcode: entry.scannedBarcode,
              previousBottlesOnHand: entry.previousBottlesOnHand,
              newBottlesOnHand: entry.newBottlesOnHand,
              bottlesAdded: entry.bottlesAdded,
              assetValueAddedKes: entry.assetValueAddedKes,
              newTotalProductAssetKes: entry.newTotalProductAssetKes,
              scannedAt: entry.time
            });
            setInstantLoadedFeed(prev => [entry, ...prev.slice(0, 9)]);
            setFeedbackBanner(
              `📲 STOCK ACTIVATED "${entry.product.name}" (${entry.product.sku}): Stock ${entry.previousBottlesOnHand} → ${entry.newBottlesOnHand} btls (+${entry.bottlesAdded} btls) • Asset Value Added: +${formatKes(entry.assetValueAddedKes)}!`
            );
          }}
          onClose={() => {
            setIsBarcodeWizardOpen(false);
            setWizardInitialBarcode('');
            setWizardInitialProductId('');
            setWizardInitialPieces(undefined);
            setWizardInitialStep(undefined);
          }}
        />
      )}

      {/* Floating Mobile Thumb-Friendly Barcode Wizard Quick Launcher */}
      <div className="sm:hidden fixed bottom-5 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            setWizardInitialBarcode('');
            setIsBarcodeWizardOpen(true);
          }}
          className="h-14 px-4 rounded-2xl bg-[#34D186] text-[#FFDE00] border-2 border-[#FFDE00] shadow-2xl font-montserrat font-black text-xs flex items-center gap-2 active:scale-95 transition"
        >
          <Smartphone className="w-5 h-5 text-[#FFDE00] shrink-0" />
          <span>Scan &amp; Onboard</span>
        </button>
      </div>

      {/* Batch Manufacturing & Expiry Date (FEFO) Modal for Cream Liqueurs & Stock Rotation */}
      {editingBatchProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-montserrat font-black text-base text-slate-900">
                FEFO Batch &amp; Expiry Rotation Tracker
              </h3>
              <button
                type="button"
                onClick={() => setEditingBatchProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Tracking batch manufacturing and expiry dates for <strong className="text-slate-900">{editingBatchProduct.name}</strong> at <strong>{activeBranch.name}</strong>.
              {(editingBatchProduct.isCreamBased || editingBatchProduct.subCategory === 'Cream Liqueur') && (
                <span className="block mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                  ❄️ <strong>Cream Liqueur Storage Advisory:</strong> Keep below {editingBatchProduct.maxStorageTempCelsius || 25}°C. Rotate older batches out before newer inventory (FEFO) to prevent dairy/cream spoilage on warehouse shelves.
                </span>
              )}
            </p>

            <form onSubmit={handleBatchExpirySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Warehouse Batch / Lot Number
                </label>
                <input
                  type="text"
                  value={batchNumInput}
                  onChange={e => setBatchNumInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  placeholder="e.g. BAT-2026-CRM-104"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    value={batchMfgDateInput}
                    onChange={e => setBatchMfgDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batch Expiry Date (FEFO)
                  </label>
                  <input
                    type="date"
                    value={batchExpDateInput}
                    onChange={e => setBatchExpDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#0A006E]"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBatchProduct(null)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#34D186] text-[#FFDE00] rounded-lg text-xs font-montserrat font-bold hover:bg-emerald-950"
                >
                  Save Batch &amp; Expiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="font-montserrat font-black text-lg text-slate-900 mb-1">
              Adjust Stock Level
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating quantity for <strong className="text-slate-800">{adjustingProduct.name}</strong> at {activeBranch.name}.
            </p>

            <form onSubmit={handleStockAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Change (+ to add, - to write-off)
                </label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900"
                  placeholder="e.g. +24 or -2"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Audit / Adjustment Reason
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Physical Count Reconciliation">Physical Count Reconciliation</option>
                  <option value="Damaged / Broken Bottle Write-Off">Damaged / Broken Bottle Write-Off</option>
                  <option value="Supplier Replacement Delivery">Supplier Replacement Delivery</option>
                  <option value="KRA Tax Audit Adjustment">KRA Tax Audit Adjustment</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0A006E] text-white rounded-lg text-xs font-montserrat font-bold hover:bg-[#060046]"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register SKU Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="font-montserrat font-black text-lg text-slate-900 mb-1">
              Register New Alcohol SKU
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add new IPS (Imported) or LPS (Local) stock item to ERP master catalog.
            </p>

            <form onSubmit={handleCreateProductSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProdCategory('IPS')}
                    className={`py-2 text-xs font-montserrat font-bold rounded-lg border ${
                      newProdCategory === 'IPS' ? 'bg-[#34D186] text-white border-[#34D186]' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    IPS (Imported Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProdCategory('LPS')}
                    className={`py-2 text-xs font-montserrat font-bold rounded-lg border ${
                      newProdCategory === 'LPS' ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E]' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    LPS (Local Stock)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  value={newProdName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewProdName(val);
                    setNewProdImage(getProductImageUrl({ name: val, category: newProdCategory }));
                  }}
                  placeholder="e.g. Singleton 12 Year Single Malt Scotch 700ml"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              {/* Product Image Picker & Upload (From Drive & Link) */}
              <ProductImageSourcePicker
                value={newProdImage}
                onChange={setNewProdImage}
                productContext={{
                  name: newProdName || 'New Alcohol SKU',
                  category: newProdCategory
                }}
                compact
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Master SKU</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value.toUpperCase())}
                    placeholder="IPS-SGL-700"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pack Size (Btls/Case)</label>
                  <input
                    type="number"
                    min={1}
                    value={newProdPackSize}
                    onChange={(e) => setNewProdPackSize(parseInt(e.target.value) || 12)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Cases</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdInitialCases}
                    onChange={(e) => setNewProdInitialCases(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#0A006E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Cost (KES)</label>
                  <input
                    type="number"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Wholesale (KES)</label>
                  <input
                    type="number"
                    value={newProdWholesale}
                    onChange={(e) => setNewProdWholesale(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Retail (KES)</label>
                  <input
                    type="number"
                    value={newProdRetail}
                    onChange={(e) => setNewProdRetail(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0A006E] text-white rounded-lg text-xs font-montserrat font-bold hover:bg-[#060046]"
                >
                  Save &amp; Generate Barcode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE INVOICE FORM (PERMANENT MULTI-YEAR ARCHIVE) */}
      {isCreateInvoiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900">
                    Create Supply / Inventory Invoice
                  </h3>
                  <p className="text-xs text-slate-500">
                    Saved permanently in the Multi-Year Invoice Vault — retrievable at any time in the future.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateInvoiceOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Supplier *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateInvoiceOpen(false);
                        setOnboardingTab('SUPPLIER');
                      }}
                      className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                    >
                      + Onboard New Supplier
                    </button>
                  </div>
                  {suppliers.length > 0 ? (
                    <select
                      value={invSupplierId}
                      onChange={(e) => setInvSupplierId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={invCustomSupplierName}
                      onChange={(e) => setInvCustomSupplierName(e.target.value)}
                      placeholder="Enter Supplier Name (auto-registers supplier)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      required
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Receiving Branch / Warehouse *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateInvoiceOpen(false);
                        setOnboardingTab('BRANCH');
                      }}
                      className="text-[10px] font-montserrat font-bold text-[#1E9E60] hover:underline"
                    >
                      + New Branch (Liquor Shop / Store / Merchant)
                    </button>
                  </div>
                  <select
                    value={invBranchId}
                    onChange={(e) => setInvBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    required
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={invCustomNumber}
                    onChange={(e) => setInvCustomNumber(e.target.value.toUpperCase())}
                    placeholder="Auto: SUP-INV-2026-XXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice / Delivery Date *
                  </label>
                  <input
                    type="date"
                    value={invDeliveryDate}
                    onChange={(e) => setInvDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Packing List Ref
                  </label>
                  <input
                    type="text"
                    value={invPackingList}
                    onChange={(e) => setInvPackingList(e.target.value.toUpperCase())}
                    placeholder="e.g. PKL-2026-901"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Truck Reg / Container No.
                  </label>
                  <input
                    type="text"
                    value={invTruckReg}
                    onChange={(e) => setInvTruckReg(e.target.value.toUpperCase())}
                    placeholder="e.g. KDK 440M"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    KRA / Factory Seal No.
                  </label>
                  <input
                    type="text"
                    value={invSealNumber}
                    onChange={(e) => setInvSealNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. KRA-SEAL-8821"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Settlement Mode
                  </label>
                  <select
                    value={invPaymentMethod}
                    onChange={(e) => setInvPaymentMethod(e.target.value as 'RTGS' | 'BANK_TRANSFER' | 'MPESA' | 'CHEQUE')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="BANK_TRANSFER">Bank EFT</option>
                    <option value="MPESA">M-Pesa B2B</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Archival Notes / Bill of Lading Details
                </label>
                <input
                  type="text"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  placeholder="Permanent archival notes for multi-year KRA & inventory audit..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Invoice to Archive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SELECT INVOICE & CREATE PRODUCTS UNDER THAT INVOICE WITH SAVE BUTTON */}
      {isInvoiceProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-sm">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900">
                    Select Invoice &amp; Create Products Under Inventory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select an archived invoice below, enter the products received under it, and click Save.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductsUnderInvoice} className="space-y-5 pt-4">
              {/* Step 1: Select Target Invoice */}
              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                    1. Select Invoice to Attach Products To *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInvoiceProductModalOpen(false);
                      setIsCreateInvoiceOpen(true);
                    }}
                    className="text-xs font-montserrat font-bold text-[#0A006E] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Invoice First</span>
                  </button>
                </div>

                <select
                  value={selectedTargetInvoiceId}
                  onChange={(e) => setSelectedTargetInvoiceId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-[#0A006E] rounded-xl text-xs sm:text-sm font-montserrat font-bold text-slate-900 focus:outline-none"
                  required
                >
                  {supplyInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.supplierName} (Date: {inv.deliveryDate} • Branch: {inv.branchName} • {inv.items.length} SKUs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Product Rows to Create Under Selected Invoice */}
              <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-700">
                    2. Products to Create Under Selected Invoice ({draftInvoiceProducts.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddDraftProductRow}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A006E] text-xs font-montserrat font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Product Row</span>
                  </button>
                </div>

                {draftInvoiceProducts.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-montserrat font-black text-[#0A006E]">
                        Product #{idx + 1}
                      </span>
                      {draftInvoiceProducts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftProductRow(idx)}
                          className="text-xs text-red-600 hover:underline flex items-center gap-1 font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].name = e.target.value;
                            setDraftInvoiceProducts(updated);
                          }}
                          placeholder="e.g. Hennessy VSOP Privilege 700ml"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          SKU Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={row.sku}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].sku = e.target.value.toUpperCase();
                            setDraftInvoiceProducts(updated);
                          }}
                          placeholder="HNY-VSOP-700"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Stock Category
                        </label>
                        <select
                          value={row.category}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].category = e.target.value as StockCategory;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                        >
                          <option value="IPS">IPS (Imported)</option>
                          <option value="LPS">LPS (Local)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Bottles / Case
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.packSize}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].packSize = parseInt(e.target.value) || 12;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Cases Supplied
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.casesSupplied}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].casesSupplied = parseInt(e.target.value) || 1;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Unit Cost (KES)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.warehouseCostKes}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].warehouseCostKes = parseFloat(e.target.value) || 0;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Wholesale (KES)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.wholesalePriceKes}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].wholesalePriceKes = parseFloat(e.target.value) || 0;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          Retail Price (KES)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.retailPriceKes}
                          onChange={(e) => {
                            const updated = [...draftInvoiceProducts];
                            updated[idx].retailPriceKes = parseFloat(e.target.value) || 0;
                            setDraftInvoiceProducts(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#0A006E]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Total new bottles to stock:{' '}
                  <strong className="text-[#0A006E] font-mono">
                    {draftInvoiceProducts.reduce((sum, r) => sum + (r.packSize || 12) * (r.casesSupplied || 1), 0)} btls
                  </strong>
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceProductModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-lg transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Products to Invoice &amp; Inventory</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RETRIEVED ARCHIVAL INVOICE VIEWER (MULTI-YEAR AUDIT RECORD) */}
      {viewingArchivedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-slate-200 my-auto space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono font-bold text-emerald-800">
                  PERMANENT ARCHIVAL INVOICE RECORD • FY {(viewingArchivedInvoice.deliveryDate || '2026').substring(0, 4)}
                </div>
                <h3 className="font-montserrat font-black italic text-xl sm:text-2xl text-[#0A006E] mt-0.5">
                  {viewingArchivedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supplier: <strong className="text-slate-800">{viewingArchivedInvoice.supplierName}</strong> (KRA PIN: {viewingArchivedInvoice.supplierPin})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-montserrat font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-[#0A006E]" />
                  <span>Print Record</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingArchivedInvoice(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Date</span>
                <strong className="font-mono text-slate-900">{viewingArchivedInvoice.deliveryDate}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Receiving Branch</span>
                <strong className="text-slate-900">{viewingArchivedInvoice.branchName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Packing List</span>
                <strong className="font-mono text-slate-900">{viewingArchivedInvoice.packingListNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Invoice Value</span>
                <strong className="font-montserrat font-black text-[#0A006E]">{formatKes(viewingArchivedInvoice.totalAmountKes)}</strong>
              </div>
            </div>

            {/* Products Onboarded Under This Invoice */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-700">
                  Products Created &amp; Stocked Under This Invoice ({viewingArchivedInvoice.items.length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const invId = viewingArchivedInvoice.id;
                    setViewingArchivedInvoice(null);
                    setSelectedTargetInvoiceId(invId);
                    setIsInvoiceProductModalOpen(true);
                  }}
                  className="text-xs font-montserrat font-bold text-[#0A006E] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More Products to This Invoice</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-montserrat font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Product &amp; SKU</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Cases / Bottles</th>
                      <th className="py-2.5 px-3">Batch &amp; Expiry</th>
                      <th className="py-2.5 px-3 text-right">Line Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingArchivedInvoice.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No products added to this invoice yet. Click &ldquo;Add More Products to This Invoice&rdquo; above.
                        </td>
                      </tr>
                    ) : (
                      viewingArchivedInvoice.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-xs text-[#0A006E]">
                            {item.category}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {item.casesSupplied} cs ({item.totalBottles} btls)
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {item.batchNumber} • Exp: {item.expiryDate}
                          </td>
                          <td className="py-2.5 px-3 text-right font-montserrat font-bold text-slate-900">
                            {formatKes(item.totalCostKes)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewingArchivedInvoice.notes && (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700">
                <strong>Archival Notes:</strong> {viewingArchivedInvoice.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: ONBOARDING CENTER (SUPPLIERS, DISTRIBUTORS, STAFF) */}
      {onboardingTab && (
        <OnboardingCenterModal
          initialTab={onboardingTab}
          onClose={() => setOnboardingTab(null)}
        />
      )}

      {/* MODAL 5: CLONE PRODUCTS FROM NAIROBIDRINKS.CO.KE/PRODUCT */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl border border-slate-200 my-auto space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-md">
                  <DownloadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    LIVE PLATFORM CLONE • HTTPS://NAIROBIDRINKS.CO.KE/PRODUCT
                  </span>
                  <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900 mt-1">
                    Clone &amp; Sync Products from NairobiDrinks.co.ke
                  </h3>
                  <p className="text-xs text-slate-500">
                    All {NAIROBI_DRINKS_PRODUCTS.length} flagship products from <code className="font-mono text-[#0A006E]">https://nairobidrinks.co.ke/product</code> with Kenyan retail/wholesale pricing, EAN barcodes, and KRA tax parameters.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloneModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Direct URL Cloner for any https://nairobidrinks.co.ke/product/... URL */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cloneUrlInput.trim()) return;
                const { product, isNew } = cloneNairobiDrinksFromUrl(
                  cloneUrlInput,
                  cloneUrlPrice,
                  cloneUrlCases
                );
                setFeedbackBanner(
                  `${isNew ? 'Cloned new product' : 'Synced stock for'} "${product.name}" (${product.sku}) from ${product.sourceUrl} with ${cloneUrlCases} cases!`
                );
                setTimeout(() => setFeedbackBanner(null), 5000);
                setCloneUrlInput('https://nairobidrinks.co.ke/product/');
              }}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-montserrat font-black text-[#0A006E] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#1E9E60]" />
                  <span>Clone Any Specific NairobiDrinks.co.ke Product URL</span>
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  e.g. https://nairobidrinks.co.ke/product/macallan-12-years-double-cask
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    NairobiDrinks Product URL *
                  </label>
                  <input
                    type="text"
                    required
                    value={cloneUrlInput}
                    onChange={(e) => setCloneUrlInput(e.target.value)}
                    placeholder="https://nairobidrinks.co.ke/product/..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Retail (KES)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={cloneUrlPrice}
                    onChange={(e) => setCloneUrlPrice(parseInt(e.target.value) || 1500)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Initial Cases
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={cloneUrlCases}
                    onChange={(e) => setCloneUrlCases(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full h-[38px] bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Clone URL</span>
                  </button>
                </div>
              </div>
            </form>

            {/* 2. Full NairobiDrinks.co.ke Catalog Browser & Bulk Sync */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setCloneModalSubCat('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition ${
                      cloneModalSubCat === 'ALL'
                        ? 'bg-[#0A006E] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All ({NAIROBI_DRINKS_PRODUCTS.length})
                  </button>
                  {NAIROBI_DRINKS_SUB_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCloneModalSubCat(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition whitespace-nowrap ${
                        cloneModalSubCat === cat
                          ? 'bg-[#34D186] text-[#FFDE00]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat} ({NAIROBI_DRINKS_PRODUCTS.filter(p => p.subCategory === cat).length})
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                {NAIROBI_DRINKS_PRODUCTS.filter(
                  p => cloneModalSubCat === 'ALL' || p.subCategory === cloneModalSubCat
                ).map(item => {
                  const isAlreadyCloned = products.some(p => p.sku === item.sku);
                  return (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <ProductImage product={item} size="sm" showVolumeBadge />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-montserrat font-bold text-slate-900">{item.name}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[#0A006E] font-mono font-bold text-[10px]">
                              {item.subCategory}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-montserrat font-black ${
                                item.category === 'IPS'
                                  ? 'bg-[#34D186]/10 text-[#1E9E60]'
                                  : 'bg-[#FFDE00]/40 text-[#0A006E]'
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-md">{item.sourceUrl}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-montserrat font-black text-[#0A006E]">
                            {formatKes(item.retailPriceKes)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            WH: {formatKes(item.wholesalePriceKes)}
                          </div>
                        </div>
                        {isAlreadyCloned ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-montserrat font-bold text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Cloned in ERP</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              cloneNairobiDrinksCatalog({
                                productIds: [item.id],
                                warehouseCases: cloneWhCases,
                                shopCases: cloneShopCases
                              });
                              setFeedbackBanner(`Cloned "${item.name}" from nairobidrinks.co.ke/product!`);
                              setTimeout(() => setFeedbackBanner(null), 4000);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#0A006E] text-[#FFDE00] font-montserrat font-bold text-[11px]"
                          >
                            + Clone SKU
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bulk Clone & Stock Allocation Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-600">Warehouse Cases/SKU:</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={cloneWhCases}
                    onChange={(e) => setCloneWhCases(Math.max(1, parseInt(e.target.value) || 15))}
                    className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-center"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-600">Shop Cases/SKU:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={cloneShopCases}
                    onChange={(e) => setCloneShopCases(Math.max(1, parseInt(e.target.value) || 4))}
                    className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCloneModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = cloneNairobiDrinksCatalog({
                      warehouseCases: cloneWhCases,
                      shopCases: cloneShopCases
                    });
                    setIsCloneModalOpen(false);
                    setFeedbackBanner(
                      `Synced ${NAIROBI_DRINKS_PRODUCTS.length} products from https://nairobidrinks.co.ke/product (${res.clonedCount} new SKUs added, ${res.updatedStockCount} branch stock records synced)!`
                    );
                    setTimeout(() => setFeedbackBanner(null), 5000);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Sync All {NAIROBI_DRINKS_PRODUCTS.length} NairobiDrinks.co.ke Products</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PRODUCT IMAGE VIEWER & UPLOADER (FROM DRIVE & LINK) */}
      {editingImageProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-200 my-auto space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0A006E] bg-blue-50 px-2 py-0.5 rounded">
                  SKU: {editingImageProduct.sku} • {editingImageProduct.subCategory || editingImageProduct.category}
                </span>
                <h3 className="font-montserrat font-black italic text-lg text-slate-900 mt-1">
                  Upload Image (Drive or Link) — {editingImageProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingImageProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Large Studio Image Preview — Full Fit */}
            <div className="w-full h-56 sm:h-64 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
              <img
                src={editingImageUrl || getProductImageUrl(editingImageProduct)}
                alt={editingImageProduct.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = generateStudioBottleSvgDataUri(editingImageProduct);
                }}
                className="w-full h-full object-cover object-center block"
              />
              <div className="absolute bottom-2.5 inset-x-3 text-center">
                <span className="inline-block px-3 py-1 rounded-full bg-black/75 backdrop-blur-xs text-xs font-montserrat font-bold text-white border border-white/15">
                  {editingImageProduct.brand} • {editingImageProduct.volumeMl}ml ({editingImageProduct.alcoholPercentage}% ABV)
                </span>
              </div>
            </div>

            {/* Unified Drive + Link + Studio Preset Picker */}
            <ProductImageSourcePicker
              value={editingImageUrl}
              onChange={setEditingImageUrl}
              productContext={editingImageProduct}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingImageProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingImageUrl.trim()) {
                    updateProductImage(editingImageProduct.id, normalizeProductImageUrl(editingImageUrl));
                    setFeedbackBanner(`Updated product photo for "${editingImageProduct.name}"!`);
                    setTimeout(() => setFeedbackBanner(null), 4000);
                  }
                  setEditingImageProduct(null);
                }}
                className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Product Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: EDIT PRODUCT MODAL (DETAILS, PRICING, BARCODES, STOCK & DRIVE/LINK IMAGE) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl border border-slate-200 my-auto space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-xs">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1E9E60] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    EDIT MASTER SKU • {editingProduct.sku}
                  </span>
                  <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900 mt-0.5">
                    Edit Product &amp; Image
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              {/* Product Image Upload (Drive & Link) */}
              <ProductImageSourcePicker
                value={editForm.image}
                onChange={(newUrl) => setEditForm(prev => ({ ...prev, image: newUrl }))}
                productContext={{
                  name: editForm.name,
                  brand: editForm.brand,
                  subCategory: editForm.subCategory,
                  volumeMl: editForm.volumeMl,
                  alcoholPercentage: editForm.alcoholPercentage,
                  category: editForm.category
                }}
                compact
              />

              {/* Name, Brand & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Brand *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.brand}
                    onChange={(e) => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* SKU, Classification & Sub-Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Master SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stock Classification
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value as StockCategory }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="IPS">IPS (Imported Stock)</option>
                    <option value="LPS">LPS (Local Stock)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Spirit / Drink Sub-Category
                  </label>
                  <select
                    value={editForm.subCategory}
                    onChange={(e) => setEditForm(prev => ({ ...prev, subCategory: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prices: Cost, Wholesale, Retail */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-blue-50/50 border border-blue-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Warehouse Cost (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.warehouseCostKes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, warehouseCostKes: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Wholesale Price (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.wholesalePriceKes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, wholesalePriceKes: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#0A006E] mb-1">
                    Retail Price (KES) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.retailPriceKes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, retailPriceKes: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white border-2 border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E]"
                  />
                </div>
              </div>

              {/* Volume, ABV, Pack Size & Branch Stock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bottle Volume (ml)
                  </label>
                  <input
                    type="number"
                    min={50}
                    value={editForm.volumeMl}
                    onChange={(e) => setEditForm(prev => ({ ...prev, volumeMl: parseInt(e.target.value) || 750 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Alcohol (ABV %)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={90}
                    value={editForm.alcoholPercentage}
                    onChange={(e) => setEditForm(prev => ({ ...prev, alcoholPercentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pack Size (Btls/Case)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.packSize}
                    onChange={(e) => setEditForm(prev => ({ ...prev, packSize: Math.max(1, parseInt(e.target.value) || 12) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1E9E60] mb-1">
                    Stock ({activeBranch.name.split(' ')[0]} Btls)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.branchBottlesOnHand}
                    onChange={(e) => setEditForm(prev => ({ ...prev, branchBottlesOnHand: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-mono font-black text-[#1E9E60]"
                  />
                </div>
              </div>

              {/* Bottle Barcode, Case Barcode & Origin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Scan / Enter Bottle Barcode (EAN)
                  </label>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={(e) => {
                      const nextBarcode = e.target.value;
                      setEditForm(prev => ({
                        ...prev,
                        barcode: nextBarcode,
                        branchBottlesOnHand:
                          prev.branchBottlesOnHand > 0 ? prev.branchBottlesOnHand : prev.packSize || 12
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editingProduct && editForm.barcode.trim()) {
                        e.preventDefault();
                        const pcs = Math.max(1, editForm.branchBottlesOnHand || editForm.packSize || 12);
                        handleScanBarcodeUnderSpecificProduct(
                          editingProduct,
                          editForm.barcode.trim(),
                          pcs,
                          true
                        );
                        setEditingProduct(null);
                      }
                    }}
                    placeholder="Scan barcode to activate stock..."
                    className="w-full px-3 py-2 bg-emerald-50/70 border-2 border-[#34D186] rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="block text-[10px] text-emerald-800 mt-1 font-medium">
                    Scan a barcode here &amp; press Enter to immediately activate {Math.max(1, editForm.branchBottlesOnHand || editForm.packSize || 12)} pcs in stock
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Master Case Barcode
                  </label>
                  <input
                    type="text"
                    value={editForm.caseBarcode}
                    onChange={(e) => setEditForm(prev => ({ ...prev, caseBarcode: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Country of Origin
                  </label>
                  <input
                    type="text"
                    value={editForm.countryOfOrigin}
                    onChange={(e) => setEditForm(prev => ({ ...prev, countryOfOrigin: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingProduct;
                    setEditingProduct(null);
                    setDeletingProduct(target);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-montserrat font-bold inline-flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Product</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs inline-flex items-center gap-2 shadow-md transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Product Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: DELETE PRODUCT CONFIRMATION MODAL */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-montserrat font-black text-base sm:text-lg text-slate-900">
                  Delete Product from Inventory?
                </h3>
                <p className="text-xs text-slate-500">
                  This removes the SKU from the master catalog and active branch stock.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <ProductImage product={deletingProduct} size="sm" />
              <div className="min-w-0">
                <div className="font-montserrat font-bold text-xs text-slate-900 truncate">
                  {deletingProduct.name}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  SKU: {deletingProduct.sku} • Retail: {formatKes(deletingProduct.retailPriceKes)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-montserrat font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
