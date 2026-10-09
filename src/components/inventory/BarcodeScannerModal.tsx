import React, { useState, useEffect, useRef } from 'react';
import { useErp } from '../../context/ErpContext';
import { Product } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from '../common/ProductImage';
import {
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Barcode,
  RefreshCw,
  Flashlight,
  ArrowRight
} from 'lucide-react';

interface Props {
  mode: 'SINGLE' | 'BULK';
  purpose?: 'INVENTORY_INTAKE' | 'POS_SELL';
  onProductScanned?: (product: Product, rawBarcode: string) => void;
  onPosProductScanned?: (product: Product, qtyToAdd: number, rawBarcode: string) => void;
  onOpenOnboardingWizard?: (unrecognizedBarcode: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<Props> = ({
  mode: initialMode,
  purpose = 'INVENTORY_INTAKE',
  onProductScanned,
  onPosProductScanned,
  onOpenOnboardingWizard,
  onClose
}) => {
  const {
    products,
    inventoryItems,
    handleBarcodeScan,
    activeBranch,
    addToCart,
    cart
  } = useErp();

  const [scanMode, setScanMode] = useState<'SINGLE' | 'BULK'>(initialMode);
  const [manualCode, setManualCode] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const [awaitingNextScan, setAwaitingNextScan] = useState(false);

  const [scanFeedback, setScanFeedback] = useState<{
    ok: boolean;
    title: string;
    subtitle: string;
    product?: Product;
    rawBarcode?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDetectedRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const triggerScanRef = useRef<(code: string) => void>(() => {});
  const awaitingNextScanRef = useRef<boolean>(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const wedgeBufferRef = useRef<{ buffer: string; lastKeyTime: number }>({ buffer: '', lastKeyTime: 0 });

  awaitingNextScanRef.current = awaitingNextScan;

  const handleConfirmScanNext = () => {
    setAwaitingNextScan(false);
    awaitingNextScanRef.current = false;
    setScanFeedback(null);
    setManualCode('');
    lastDetectedRef.current = { code: '', ts: Date.now() };
    window.setTimeout(() => {
      manualInputRef.current?.focus();
    }, 30);
  };

  const playBeep = (isError = false) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(isError ? [100, 40, 100] : [40]);
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isError ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isError ? 240 : 1046.5, ctx.currentTime);
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

  const triggerScan = (code: string) => {
    if (awaitingNextScanRef.current) return;
    const clean = code.trim();
    if (!clean) return;

    if (purpose === 'POS_SELL') {
      const matched = products.find(
        p =>
          p.barcode === clean ||
          p.caseBarcode === clean ||
          p.sku.toLowerCase() === clean.toLowerCase() ||
          (clean.startsWith('1') && p.barcode === clean.slice(1))
      );

      if (!matched) {
        playBeep(true);
        setScanFeedback({
          ok: false,
          title: 'Unrecognized Barcode',
          subtitle: `No product found for "${clean}".`,
          rawBarcode: clean
        });
        return;
      }

      const branchInv = inventoryItems.find(
        i => i.productId === matched.id && i.branchId === activeBranch.id
      );
      const fallbackInv = inventoryItems.find(
        i => i.productId === matched.id && i.bottlesOnHand > 0
      );
      const avail =
        branchInv && branchInv.bottlesOnHand > 0
          ? branchInv.bottlesOnHand
          : fallbackInv?.bottlesOnHand ?? branchInv?.bottlesOnHand ?? 0;
      const existingCartItem = cart.find(c => c.product.id === matched.id);
      const currentInCart = existingCartItem?.quantity ?? 0;

      if (avail <= 0 || currentInCart >= avail) {
        playBeep(true);
        setScanFeedback({
          ok: false,
          title: 'Out of Stock',
          subtitle: `${matched.name} has ${avail} bottles available.`,
          product: matched,
          rawBarcode: clean
        });
        return;
      }

      const isCaseScan =
        matched.caseBarcode === clean ||
        (clean.startsWith('1') && matched.barcode === clean.slice(1));
      const qtyToAdd = isCaseScan ? matched.packSize || 12 : 1;

      playBeep(false);
      if (onPosProductScanned) {
        onPosProductScanned(matched, qtyToAdd, clean);
      } else {
        addToCart(matched, qtyToAdd, 0);
      }

      setScanFeedback({
        ok: true,
        title: `Added +${qtyToAdd} to Cart`,
        subtitle: `${matched.name} • ${formatKes(matched.retailPriceKes)}`,
        product: matched,
        rawBarcode: clean
      });
      setAwaitingNextScan(true);
      awaitingNextScanRef.current = true;

      if (onProductScanned) {
        onProductScanned(matched, clean);
      }
      return;
    }

    // INVENTORY_INTAKE mode
    const res = handleBarcodeScan(clean, scanMode);
    if (res.success && res.product) {
      playBeep(false);
      setScanFeedback({
        ok: true,
        title: `Added +${res.unpackedBottles} Bottles to Stock`,
        subtitle: `${res.product.name} • Stock now ${res.newBottlesOnHand ?? 0} btls`,
        product: res.product,
        rawBarcode: clean
      });
      setAwaitingNextScan(true);
      awaitingNextScanRef.current = true;
      if (onProductScanned) {
        onProductScanned(res.product, clean);
      }
    } else {
      playBeep(true);
      setScanFeedback({
        ok: false,
        title: res.status === 'UNKNOWN' ? 'Unrecognized Barcode' : 'Scan Notice',
        subtitle: res.message,
        product: res.product,
        rawBarcode: clean
      });
    }
  };

  triggerScanRef.current = (code: string) => {
    if (awaitingNextScanRef.current) return;
    setScanFlash(true);
    window.setTimeout(() => setScanFlash(false), 200);
    triggerScan(code);
  };

  // Global USB / Bluetooth barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (awaitingNextScanRef.current) {
        wedgeBufferRef.current = { buffer: '', lastKeyTime: 0 };
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const now = Date.now();
      if (e.key === 'Enter') {
        const code = wedgeBufferRef.current.buffer.trim();
        if (code.length >= 5) {
          e.preventDefault();
          wedgeBufferRef.current = { buffer: '', lastKeyTime: 0 };
          triggerScanRef.current(code);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const elapsed = now - wedgeBufferRef.current.lastKeyTime;
        wedgeBufferRef.current = {
          buffer: elapsed > 120 ? e.key : wedgeBufferRef.current.buffer + e.key,
          lastKeyTime: now
        };
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Camera stream & BarcodeDetector loop
  useEffect(() => {
    let mounted = true;
    let detectInterval: number | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera not available on this device.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (mounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setIsCameraActive(true);

          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
            const caps = videoTrack.getCapabilities() as Record<string, unknown>;
            setTorchSupported(Boolean(caps && caps.torch));
          } else {
            setTorchSupported(false);
          }

          const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
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
                    (rawVal !== lastDetectedRef.current.code || now - lastDetectedRef.current.ts > 1200)
                  ) {
                    lastDetectedRef.current = { code: rawVal, ts: now };
                    triggerScanRef.current(rawVal);
                  }
                }
              } catch {
                // ignore frame error
              } finally {
                isDetecting = false;
              }
            }, 120);
          }
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      } catch {
        if (mounted) {
          setCameraError('Camera permission denied or unavailable.');
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (awaitingNextScan) return;
    if (!manualCode.trim()) return;
    triggerScan(manualCode);
    setManualCode('');
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#0A006E] sm:bg-black/75 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Full-Screen on Mobile, Popup Window on Desktop */}
      <div
        className="w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col justify-between"
        onClick={e => e.stopPropagation()}
      >
        {/* Popup Header (Blue Branding) */}
        <div className="bg-[#0A006E] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm text-white">
                Barcode Scanner
              </h3>
              <p className="text-[11px] text-blue-200">
                {awaitingNextScan
                  ? 'Scan paused — confirm to scan next item'
                  : purpose === 'POS_SELL'
                  ? 'Scan to add to cart'
                  : 'Scan to update inventory'}
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

        {/* Camera Viewfinder — Full Flex Height on Mobile */}
        <div className="relative w-full flex-1 sm:flex-initial min-h-[260px] sm:h-64 bg-slate-950 flex items-center justify-center overflow-hidden">
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
                {cameraError || 'Starting camera...'}
              </p>
              <p className="text-[11px] text-slate-400">
                Point camera at barcode or type below
              </p>
            </div>
          )}

          {/* Simple Scan Frame */}
          {!awaitingNextScan && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div
                className={`w-64 sm:w-56 h-40 sm:h-36 rounded-2xl border-2 relative transition-all duration-150 ${
                  scanFlash
                    ? 'border-blue-400 bg-blue-500/20 scale-105'
                    : 'border-[#FFDE00]'
                }`}
              >
                <div className="w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse mt-18 sm:mt-16" />
              </div>
            </div>
          )}

          {/* Post-Scan Lock Overlay to Prevent Mistaken Scanning */}
          {awaitingNextScan && scanFeedback?.ok && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-2.5">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="text-sm font-montserrat font-black text-white">
                {scanFeedback.title}
              </div>
              <div className="text-xs text-emerald-300 font-semibold mt-0.5 max-w-xs truncate">
                {scanFeedback.subtitle}
              </div>
              {scanFeedback.rawBarcode && (
                <span className="mt-1 px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFDE00] font-mono text-[10px] font-bold">
                  Barcode: {scanFeedback.rawBarcode}
                </span>
              )}
              <p className="text-[11px] text-slate-300 mt-2.5 mb-3">
                Scanner paused to avoid mistaken double-scanning.
              </p>
              <div className="flex items-center gap-2.5 w-full max-w-xs">
                <button
                  type="button"
                  onClick={handleConfirmScanNext}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FFDE00] hover:bg-yellow-300 text-[#0A006E] font-montserrat font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition"
                >
                  <span>Scan Next Barcode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-montserrat font-bold text-xs cursor-pointer transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Simplified Controls & Feedback */}
        <div className="p-5 space-y-4 bg-white shrink-0">
          {/* Simple Bottle vs Case toggle for Inventory Intake */}
          {purpose === 'INVENTORY_INTAKE' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-blue-50 rounded-xl border border-blue-100">
              <button
                type="button"
                onClick={() => setScanMode('SINGLE')}
                className={`py-2 rounded-lg font-montserrat font-bold text-xs transition cursor-pointer ${
                  scanMode === 'SINGLE'
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'text-[#0A006E] hover:bg-blue-100/60'
                }`}
              >
                Single Bottle (+1)
              </button>
              <button
                type="button"
                onClick={() => setScanMode('BULK')}
                className={`py-2 rounded-lg font-montserrat font-bold text-xs transition cursor-pointer ${
                  scanMode === 'BULK'
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'text-[#0A006E] hover:bg-blue-100/60'
                }`}
              >
                Full Case
              </button>
            </div>
          )}

          {/* Last Scan Feedback */}
          {scanFeedback && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                scanFeedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {scanFeedback.product ? (
                  <ProductImage product={scanFeedback.product} size="xs" />
                ) : scanFeedback.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-montserrat font-bold truncate">
                    {scanFeedback.title}
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    {scanFeedback.subtitle}
                  </div>
                </div>
              </div>

              {scanFeedback.ok && awaitingNextScan && (
                <button
                  type="button"
                  onClick={handleConfirmScanNext}
                  className="px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs shrink-0 cursor-pointer inline-flex items-center gap-1 shadow-xs"
                >
                  <span>Scan Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {!scanFeedback.ok && scanFeedback.rawBarcode && onOpenOnboardingWizard && (
                <button
                  type="button"
                  onClick={() => onOpenOnboardingWizard(scanFeedback.rawBarcode!)}
                  className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Assign Product
                </button>
              )}
            </div>
          )}

          {/* Manual / USB Scanner Input (or Scan Next Prompt Button when paused) */}
          {awaitingNextScan ? (
            <button
              type="button"
              onClick={handleConfirmScanNext}
              className="w-full py-3 px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Barcode className="w-4 h-4" />
              <span>Scan Next Barcode</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-[#0A006E]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={e => {
                    const val = e.target.value;
                    setManualCode(val);
                    const clean = val.trim();
                    if (clean.length >= 8) {
                      const exactMatch = products.find(
                        p =>
                          p.barcode === clean ||
                          p.caseBarcode === clean ||
                          p.sku.toLowerCase() === clean.toLowerCase()
                      );
                      if (exactMatch) {
                        window.setTimeout(() => {
                          triggerScanRef.current(clean);
                          setManualCode('');
                        }, 0);
                      }
                    }
                  }}
                  placeholder="Scan or enter barcode..."
                  className="w-full pl-10 pr-3 py-2.5 bg-blue-50/40 border border-blue-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#0A006E]"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs transition shrink-0 cursor-pointer"
              >
                Scan
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
