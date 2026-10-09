import React, { useState, useEffect, useRef } from 'react';
import { useErp } from '../../context/ErpContext';
import { Product } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from '../common/ProductImage';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Flashlight,
  RefreshCw,
  X,
  Plus,
  Minus,
  Search,
  Zap,
  ArrowRight
} from 'lucide-react';

export interface WizardOnboardedEntry {
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
}

interface Props {
  initialBarcode?: string;
  initialInvoiceId?: string;
  initialProductId?: string;
  initialPiecesIndicated?: number;
  initialStep?: 1 | 2 | 3 | 4;
  onProductOnboarded?: (entry: WizardOnboardedEntry) => void;
  onClose: () => void;
}

export const BarcodeOnboardingWizardModal: React.FC<Props> = ({
  initialBarcode = '',
  initialInvoiceId,
  initialProductId,
  initialPiecesIndicated,
  onProductOnboarded,
  onClose
}) => {
  const {
    products,
    inventoryItems,
    activeBranch,
    instantScanOnboardProduct
  } = useErp();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || products[0]?.id || ''
  );
  const [productSearch, setProductSearch] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'IN_STOCK'>('OUT_OF_STOCK');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [unitMode, setUnitMode] = useState<'BOTTLE' | 'CASE'>('BOTTLE');
  const [piecesIndicated, setPiecesIndicated] = useState<number>(() => {
    if (initialPiecesIndicated && initialPiecesIndicated > 0) return initialPiecesIndicated;
    const initialProd = products.find(p => p.id === initialProductId) || products[0];
    return initialProd?.packSize || 12;
  });
  const [barcodeInput, setBarcodeInput] = useState<string>(initialBarcode);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [scanFlash, setScanFlash] = useState<boolean>(false);
  const [lastScannedEntry, setLastScannedEntry] = useState<WizardOnboardedEntry | null>(null);
  const [awaitingNextScan, setAwaitingNextScan] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDetectedRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const executeScanRef = useRef<(code: string) => void>(() => {});
  const awaitingNextScanRef = useRef<boolean>(false);
  const barcodeInputElRef = useRef<HTMLInputElement | null>(null);
  const wedgeBufferRef = useRef<{ buffer: string; lastKeyTime: number }>({ buffer: '', lastKeyTime: 0 });
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  awaitingNextScanRef.current = awaitingNextScan;

  const handleConfirmScanNext = (openPicker = false) => {
    setAwaitingNextScan(false);
    awaitingNextScanRef.current = false;
    setLastScannedEntry(null);
    setBarcodeInput('');
    lastDetectedRef.current = { code: '', ts: Date.now() };
    if (openPicker) {
      setIsDropdownOpen(true);
    } else {
      window.setTimeout(() => {
        barcodeInputElRef.current?.focus();
      }, 30);
    }
  };

  // Find the selected product
  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Get stock for selected product at active branch
  const branchInv = inventoryItems.find(
    i => i.productId === selectedProduct?.id && i.branchId === activeBranch.id
  );
  const currentBottlesOnHand = branchInv?.bottlesOnHand ?? 0;
  const isCurrentlyOutOfStock = currentBottlesOnHand <= 0;

  // Filtered products for quick search
  const filteredProductList = React.useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    let list = products;

    if (stockFilter === 'OUT_OF_STOCK') {
      list = list.filter(p => {
        const inv = inventoryItems.find(i => i.productId === p.id && i.branchId === activeBranch.id);
        return !inv || inv.bottlesOnHand <= 0;
      });
    } else if (stockFilter === 'IN_STOCK') {
      list = list.filter(p => {
        const inv = inventoryItems.find(i => i.productId === p.id && i.branchId === activeBranch.id);
        return inv && inv.bottlesOnHand > 0;
      });
    }

    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(q))
      );
    }
    return list.slice(0, 50);
  }, [products, inventoryItems, activeBranch.id, productSearch, stockFilter]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playBeep = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40]);
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Ignore audio errors
    }
  };

  const executeScan = (rawCode?: string) => {
    if (awaitingNextScanRef.current) return;
    const cleanCode = (rawCode ?? barcodeInput).trim();
    const targetProduct = selectedProduct;
    if (!targetProduct) return;

    const finalBarcode = cleanCode || targetProduct.barcode;
    const packSize = Math.max(1, targetProduct.packSize || 12);
    const bottlesToAdd =
      unitMode === 'CASE' ? Math.max(1, piecesIndicated) * packSize : Math.max(1, piecesIndicated);
    const casesToAdd = Math.max(1, Math.ceil(bottlesToAdd / packSize));

    const res = instantScanOnboardProduct({
      invoiceId: initialInvoiceId,
      targetProductId: targetProduct.id,
      brand: targetProduct.brand,
      productName: targetProduct.name,
      sku: targetProduct.sku,
      subCategory: targetProduct.subCategory,
      alcoholPercentage: targetProduct.alcoholPercentage,
      countryOfOrigin: targetProduct.countryOfOrigin,
      caseBarcode: targetProduct.caseBarcode,
      targetBranchId: activeBranch.id,
      retailPriceKes: targetProduct.retailPriceKes,
      wholesalePriceKes: targetProduct.wholesalePriceKes,
      warehouseCostKes: targetProduct.warehouseCostKes,
      scannedBarcode: finalBarcode,
      category: targetProduct.category,
      volumeMl: targetProduct.volumeMl,
      packSize,
      casesSupplied: unitMode === 'CASE' ? Math.max(1, piecesIndicated) : casesToAdd,
      piecesIndicated: bottlesToAdd,
      setExactPieces: isCurrentlyOutOfStock,
      scanUnitMode: unitMode,
      image: targetProduct.image
    });

    const entry: WizardOnboardedEntry = {
      id: `scan-${Date.now()}`,
      product: res.product,
      invoiceNumber: res.invoice.invoiceNumber,
      bottlesAdded: res.bottlesAdded,
      casesAdded: res.casesAdded,
      previousBottlesOnHand: res.previousBottlesOnHand,
      newBottlesOnHand: res.newBottlesOnHand,
      assetValueAddedKes: res.assetValueAddedKes,
      newTotalProductAssetKes: res.newTotalProductAssetKes,
      scannedBarcode: finalBarcode,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isExistingUpdated: res.isExistingUpdated
    };

    playBeep();
    setScanFlash(true);
    window.setTimeout(() => setScanFlash(false), 200);
    setLastScannedEntry(entry);
    setAwaitingNextScan(true);
    awaitingNextScanRef.current = true;
    setBarcodeInput('');

    if (onProductOnboarded) {
      onProductOnboarded(entry);
    }
  };

  executeScanRef.current = (code: string) => {
    if (awaitingNextScanRef.current) return;
    executeScan(code);
  };

  // Hardware wedge barcode scanner support (USB / Bluetooth scanner guns)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (awaitingNextScanRef.current) {
        wedgeBufferRef.current = { buffer: '', lastKeyTime: 0 };
        return;
      }
      const activeEl = document.activeElement;
      const isInput =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (e.key === 'Enter') {
        const now = Date.now();
        const buf = wedgeBufferRef.current.buffer.trim();
        if (buf.length >= 6 && now - wedgeBufferRef.current.lastKeyTime < 300) {
          e.preventDefault();
          executeScanRef.current(buf);
          wedgeBufferRef.current = { buffer: '', lastKeyTime: 0 };
          return;
        }
        wedgeBufferRef.current = { buffer: '', lastKeyTime: 0 };
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInput) {
          const now = Date.now();
          if (now - wedgeBufferRef.current.lastKeyTime > 250) {
            wedgeBufferRef.current.buffer = '';
          }
          wedgeBufferRef.current.buffer += e.key;
          wedgeBufferRef.current.lastKeyTime = now;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Camera lifecycle & BarcodeDetector
  useEffect(() => {
    let mounted = true;
    let detectInterval: number | null = null;

    async function startCamera() {
      setIsCameraActive(false);
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera API not available in this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setIsCameraActive(true);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as {
            torch?: boolean;
          };
          setTorchSupported(Boolean(capabilities && capabilities.torch));
        }

        // Native BarcodeDetector if supported
        if ('BarcodeDetector' in window) {
          const BarcodeDetectorClass = (window as unknown as {
            BarcodeDetector: new (options?: { formats: string[] }) => {
              detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
            };
          }).BarcodeDetector;

          if (BarcodeDetectorClass) {
            const detector = new BarcodeDetectorClass({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']
            });
            let isDetecting = false;
            detectInterval = window.setInterval(async () => {
              if (
                awaitingNextScanRef.current ||
                isDetecting ||
                !videoRef.current ||
                videoRef.current.readyState < 2
              ) {
                return;
              }
              isDetecting = true;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && !awaitingNextScanRef.current) {
                  const rawVal = String(barcodes[0].rawValue || '').trim();
                  const now = Date.now();
                  if (
                    rawVal &&
                    (rawVal !== lastDetectedRef.current.code || now - lastDetectedRef.current.ts > 1500)
                  ) {
                    lastDetectedRef.current = { code: rawVal, ts: now };
                    executeScanRef.current(rawVal);
                  }
                }
              } catch {
                // ignore frame error
              } finally {
                isDetecting = false;
              }
            }, 120);
          }
        }
      } catch {
        if (mounted) {
          setCameraError('Camera permission denied or camera unavailable.');
          setIsCameraActive(false);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (detectInterval) window.clearInterval(detectInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet]
      });
      setTorchOn(nextTorch);
    } catch {
      setTorchSupported(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#0A006E] sm:bg-black/75 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Full-Screen on Mobile, Popup Window on Desktop */}
      <div
        className="w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-lg bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col my-0 sm:my-auto max-h-[100dvh] sm:max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Popup Header (Blue Branding) */}
        <div className="bg-[#0A006E] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm sm:text-base text-white">
                Barcode Stock Activator
              </h3>
              <p className="text-[11px] text-blue-200">
                {awaitingNextScan
                  ? 'Scan paused — confirm to scan next barcode'
                  : `Activate out-of-stock products to available stock (${activeBranch.name.split(' ')[0]})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  torchOn ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle Flashlight"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-red-600 text-white transition cursor-pointer"
              title="Close Scanner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative w-full h-56 sm:h-48 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
          {isCameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center px-6 space-y-1.5 text-slate-400">
              <Camera className="w-8 h-8 mx-auto text-[#FFDE00]" />
              <p className="text-xs font-semibold text-white">
                {cameraError || 'Starting Camera Viewfinder...'}
              </p>
              <p className="text-[11px] text-slate-400">
                Point camera at bottle barcode or enter barcode below
              </p>
            </div>
          )}

          {/* Simple Clean Targeting Frame */}
          {!awaitingNextScan && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div
                className={`w-56 h-32 sm:w-52 sm:h-28 rounded-2xl border-2 relative transition-all duration-150 flex items-center justify-center ${
                  scanFlash
                    ? 'border-blue-400 bg-blue-500/25 scale-105 shadow-[0_0_20px_#3b82f6]'
                    : 'border-[#FFDE00] shadow-[0_0_15px_rgba(255,222,0,0.3)]'
                }`}
              >
                <div className="w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
                <span className="absolute bottom-1.5 text-[9px] font-mono font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-full">
                  Align Barcode Here
                </span>
              </div>
            </div>
          )}

          {/* Post-Scan Lock Overlay to Prevent Mistaken Scanning */}
          {awaitingNextScan && lastScannedEntry && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-150">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-1.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-xs sm:text-sm font-montserrat font-black text-white truncate max-w-xs">
                {lastScannedEntry.product.name}
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                +{lastScannedEntry.bottlesAdded} pcs activated • Stock now {lastScannedEntry.newBottlesOnHand} pcs
              </div>
              <p className="text-[10px] text-slate-300 mt-1.5 mb-2.5">
                Scanner paused to prevent mistaken duplicate scan.
              </p>
              <div className="flex items-center gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => handleConfirmScanNext(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#FFDE00] hover:bg-yellow-300 text-[#0A006E] font-montserrat font-black text-xs inline-flex items-center justify-center gap-1 shadow-md cursor-pointer transition"
                >
                  <span>Scan Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmScanNext(true)}
                  className="py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-montserrat font-bold text-xs cursor-pointer transition"
                >
                  Pick Next SKU
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body / Controls */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* STEP 1: CHOOSE PRODUCT IN THE SYSTEM */}
          <div className="space-y-1.5" ref={searchContainerRef}>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0A006E] text-[#FFDE00] text-[9px] inline-flex items-center justify-center font-bold">1</span>
                <span>Product to Activate:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="text-[11px] font-montserrat font-bold text-[#0A006E] hover:underline cursor-pointer"
              >
                {isDropdownOpen ? 'Done Selecting' : 'Search / Switch Product'}
              </button>
            </div>

            {/* Selected Product Card */}
            {selectedProduct && (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border-2 border-[#0A006E]/20 flex items-center gap-3 transition cursor-pointer"
                title="Click to search or pick a different product"
              >
                <ProductImage product={selectedProduct} size="sm" showVolumeBadge />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <h4 className="font-montserrat font-black text-xs text-slate-900 truncate">
                      {selectedProduct.name}
                    </h4>
                    {isCurrentlyOutOfStock ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-montserrat font-black text-[9px] border border-red-200">
                        Out of Stock (0 pcs)
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-100 text-[#0A006E] font-montserrat font-black text-[9px] border border-blue-200">
                        In Stock ({currentBottlesOnHand} pcs)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-bold text-[#0A006E]">SKU: {selectedProduct.sku}</span>
                    <span>•</span>
                    <span>{selectedProduct.volumeMl}ml</span>
                    <span>•</span>
                    <span>Retail: {formatKes(selectedProduct.retailPriceKes)}</span>
                    {selectedProduct.barcode && (
                      <>
                        <span>•</span>
                        <span className="text-slate-700">Code: {selectedProduct.barcode}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search Dropdown / Picker */}
            {isDropdownOpen && (
              <div className="p-2.5 bg-white rounded-2xl border-2 border-[#0A006E] shadow-xl space-y-2 animate-in fade-in zoom-in-95">
                {/* Stock Status Filter Buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-[10px] font-montserrat font-bold">
                  <button
                    type="button"
                    onClick={() => setStockFilter('OUT_OF_STOCK')}
                    className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                      stockFilter === 'OUT_OF_STOCK'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Out of Stock Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('ALL')}
                    className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                      stockFilter === 'ALL'
                        ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Brands &amp; SKUs
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('IN_STOCK')}
                    className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                      stockFilter === 'IN_STOCK'
                        ? 'bg-[#0A006E] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    In Stock
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search by brand, name, or SKU..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-slate-900 focus:outline-none focus:border-[#0A006E]"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {filteredProductList.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No matching products found.
                    </div>
                  ) : (
                    filteredProductList.map(p => {
                      const inv = inventoryItems.find(
                        i => i.productId === p.id && i.branchId === activeBranch.id
                      );
                      const btls = inv?.bottlesOnHand ?? 0;
                      const isOut = btls <= 0;
                      const isCurrent = p.id === selectedProductId;

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setIsDropdownOpen(false);
                            setProductSearch('');
                            setPiecesIndicated(p.packSize || 12);
                            setAwaitingNextScan(false);
                            awaitingNextScanRef.current = false;
                            setLastScannedEntry(null);
                          }}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${
                            isCurrent
                              ? 'bg-blue-50 text-[#0A006E] font-bold'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-montserrat font-bold text-xs truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {p.brand} • {p.volumeMl}ml • {formatKes(p.retailPriceKes)}
                            </div>
                          </div>
                          <div>
                            {isOut ? (
                              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[9px]">
                                Out of Stock
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-[#0A006E] font-bold text-[9px]">
                                {btls} pcs
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: INDICATE HOW MANY PIECES */}
          <div className="p-3 rounded-2xl bg-blue-50/70 border-2 border-[#0A006E]/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0A006E] text-[#FFDE00] text-[9px] inline-flex items-center justify-center font-bold">2</span>
                <span>Indicate How Many Pieces:</span>
              </label>

              {/* Mode Toggle: Pieces (Bottles) vs Cases */}
              <div className="inline-flex p-0.5 bg-white rounded-lg border border-blue-200 text-[10px] font-montserrat font-bold">
                <button
                  type="button"
                  onClick={() => setUnitMode('BOTTLE')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    unitMode === 'BOTTLE' ? 'bg-[#0A006E] text-[#FFDE00]' : 'text-slate-600'
                  }`}
                >
                  Pieces (Bottles)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode('CASE')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    unitMode === 'CASE' ? 'bg-[#0A006E] text-[#FFDE00]' : 'text-slate-600'
                  }`}
                >
                  Cases
                </button>
              </div>
            </div>

            {/* Stepper + Big Numeric Input */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPiecesIndicated(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-black cursor-pointer shadow-xs"
                title="Minus 1"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="number"
                  min={1}
                  value={piecesIndicated}
                  onChange={e => setPiecesIndicated(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-10 px-3 bg-white border-2 border-[#0A006E] rounded-xl font-mono font-black text-base text-center text-[#0A006E] shadow-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">
                  {unitMode === 'BOTTLE'
                    ? 'pcs'
                    : `cs (${piecesIndicated * (selectedProduct?.packSize || 12)} btls)`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setPiecesIndicated(q => q + 1)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-black cursor-pointer shadow-xs"
                title="Plus 1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Click Quick Preset Buttons */}
            <div className="flex items-center justify-between gap-1 text-[10px] font-mono pt-0.5">
              <span className="text-slate-500 font-bold">Quick Select:</span>
              {[
                { label: '6 pcs', qty: 6, mode: 'BOTTLE' as const },
                { label: '12 pcs (1 cs)', qty: 12, mode: 'BOTTLE' as const },
                { label: '24 pcs (2 cs)', qty: 24, mode: 'BOTTLE' as const },
                { label: '48 pcs', qty: 48, mode: 'BOTTLE' as const },
                { label: '100 pcs', qty: 100, mode: 'BOTTLE' as const }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setUnitMode(preset.mode);
                    setPiecesIndicated(preset.qty);
                  }}
                  className={`px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition ${
                    unitMode === preset.mode && piecesIndicated === preset.qty
                      ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 3: SCAN BARCODE TO ACTIVATE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#0A006E] text-[#FFDE00] text-[9px] inline-flex items-center justify-center font-bold">3</span>
              <span>
                {awaitingNextScan
                  ? 'Scan Complete — Ready for Next Barcode:'
                  : 'Scan Barcode to Activate Available Stock:'}
              </span>
            </label>

            {awaitingNextScan ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmScanNext(false)}
                  className="flex-1 h-11 px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition inline-flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Barcode className="w-4 h-4" />
                  <span>Scan Next Barcode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmScanNext(true)}
                  className="h-11 px-4 bg-blue-50 hover:bg-blue-100 text-[#0A006E] border border-blue-200 rounded-xl font-montserrat font-bold text-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Select Next Product &amp; Scan</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  executeScan(barcodeInput);
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={barcodeInputElRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => {
                      const val = e.target.value;
                      setBarcodeInput(val);
                      const clean = val.trim();
                      // Auto-fire if an 8+ digit barcode is scanned
                      if (clean.length >= 8 && /^\d+$/.test(clean)) {
                        window.setTimeout(() => {
                          executeScanRef.current(clean);
                        }, 40);
                      }
                    }}
                    placeholder="Scan barcode with camera or scanner gun..."
                    className="w-full h-11 pl-10 pr-3 bg-slate-50 border-2 border-slate-300 focus:border-[#0A006E] focus:bg-white rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none transition shadow-2xs"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="h-11 px-5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md"
                >
                  <Zap className="w-4 h-4 fill-current text-[#FFDE00]" />
                  <span>
                    Scan &amp; Activate (
                    {unitMode === 'CASE'
                      ? `${piecesIndicated * (selectedProduct?.packSize || 12)} pcs`
                      : `${piecesIndicated} pcs`}
                    )
                  </span>
                </button>
              </form>
            )}
          </div>

          {/* Celebration / Last Scanned Confirmation Toast */}
          {lastScannedEntry && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-montserrat font-black truncate text-emerald-950 flex items-center gap-1.5">
                    <span>Activated to Available Stock!</span>
                    <span className="font-mono text-[10px] text-[#0A006E] bg-emerald-100 px-1.5 py-0.5 rounded">
                      [{lastScannedEntry.scannedBarcode}]
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 font-medium truncate">
                    {lastScannedEntry.product.name} • Stock: {lastScannedEntry.previousBottlesOnHand} →{' '}
                    <strong className="text-[#0A006E] font-black">{lastScannedEntry.newBottlesOnHand} pieces</strong>{' '}
                    (+{lastScannedEntry.bottlesAdded} pcs added)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleConfirmScanNext(false)}
                className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[11px] shrink-0 cursor-pointer inline-flex items-center gap-1 shadow-xs"
              >
                <span>Scan Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
