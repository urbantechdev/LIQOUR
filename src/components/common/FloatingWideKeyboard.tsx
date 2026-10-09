import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useErp } from '../../context/ErpContext';
import { Product } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from './ProductImage';
import {
  Keyboard,
  Delete,
  CornerDownLeft,
  Space,
  ArrowBigUp,
  X,
  RotateCcw,
  ArrowUpDown,
  Sparkles,
  ShoppingCart,
  Check,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface FloatingWideKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const QWERTY_ROWS_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '/'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '@'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-']
];

const QWERTY_ROWS_UPPER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '_', '/'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '@'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '_']
];

const NUMPAD_KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', '00', '.']
];

export const FloatingWideKeyboard: React.FC<FloatingWideKeyboardProps> = ({ isOpen, onClose }) => {
  const { products, inventoryItems, activeBranch, addToCart } = useErp();

  const [isShift, setIsShift] = useState(false);
  const [isCaps, setIsCaps] = useState(false);
  const [activeKeyFlash, setActiveKeyFlash] = useState<string | null>(null);
  const [activeFieldLabel, setActiveFieldLabel] = useState<string>('POS Product Search / Active Input');
  const [activeFieldValue, setActiveFieldValue] = useState<string>('');
  const [dockPosition, setDockPosition] = useState<'BOTTOM' | 'TOP'>('BOTTOM');
  const [widthMode, setWidthMode] = useState<'ULTRA_WIDE' | 'WIDE'>('ULTRA_WIDE');
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);

  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const isWholesaleStore =
    activeBranch.tier === 'MAIN_STORE' || activeBranch.tier === 'DISTRIBUTOR';

  const isEditableInput = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement => {
    if (!el) return false;
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
    if (el instanceof HTMLInputElement) {
      const nonTextTypes = ['checkbox', 'radio', 'file', 'submit', 'button', 'range', 'color', 'hidden'];
      return !nonTextTypes.includes(el.type) && !el.disabled && !el.readOnly;
    }
    return false;
  };

  const describeInput = (el: HTMLInputElement | HTMLTextAreaElement | null): string => {
    if (!el) return 'POS Product Search / Active Input';
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
    if (el.type === 'number') return 'Numeric Input Field';
    return 'Active Input Field';
  };

  const findPreferredProductInput = (): HTMLInputElement | HTMLTextAreaElement | null => {
    const allInputs = Array.from(document.querySelectorAll('input, textarea')).filter(el => {
      if (!isEditableInput(el)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) as Array<HTMLInputElement | HTMLTextAreaElement>;

    // Prefer POS product search input or barcode scanner input so typing immediately searches/autofills products
    const searchInput = allInputs.find(
      el =>
        el instanceof HTMLInputElement &&
        (el.placeholder.toLowerCase().includes('search name, brand') ||
          el.placeholder.toLowerCase().includes('search') ||
          el.placeholder.toLowerCase().includes('product'))
    );
    if (searchInput) return searchInput;

    const barcodeInput = allInputs.find(
      el =>
        el instanceof HTMLInputElement &&
        (el.placeholder.toLowerCase().includes('scan bottle barcode') ||
          el.placeholder.toLowerCase().includes('barcode') ||
          el.placeholder.toLowerCase().includes('sku'))
    );
    if (barcodeInput) return barcodeInput;

    return allInputs[0] || null;
  };

  // Track focused input across the application
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (isEditableInput(target)) {
        lastFocusedInputRef.current = target;
        setActiveFieldLabel(describeInput(target));
        setActiveFieldValue(target.value || '');
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as Element | null;
      if (target && target === lastFocusedInputRef.current && isEditableInput(target)) {
        setActiveFieldValue(target.value || '');
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('input', handleInput, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('input', handleInput, true);
    };
  }, []);

  // When opened, ensure we have a valid target input focused (preferring POS Product Search)
  useEffect(() => {
    if (!isOpen) return;
    if (isEditableInput(document.activeElement)) {
      lastFocusedInputRef.current = document.activeElement;
      setActiveFieldLabel(describeInput(document.activeElement));
      setActiveFieldValue(document.activeElement.value || '');
      return;
    }
    if (lastFocusedInputRef.current && document.body.contains(lastFocusedInputRef.current)) {
      setActiveFieldLabel(describeInput(lastFocusedInputRef.current));
      setActiveFieldValue(lastFocusedInputRef.current.value || '');
      return;
    }
    const preferred = findPreferredProductInput();
    if (preferred) {
      lastFocusedInputRef.current = preferred;
      preferred.focus();
      setActiveFieldLabel(describeInput(preferred));
      setActiveFieldValue(preferred.value || '');
    }
  }, [isOpen]);

  const setNativeValueAndTriggerReact = (el: HTMLInputElement | HTMLTextAreaElement, nextValue: string) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, nextValue);
    } else {
      el.value = nextValue;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setActiveFieldValue(nextValue);
  };

  const playClickTone = (freq = 620) => {
    try {
      const AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.035);
      }
    } catch {
      // ignore audio error
    }
  };

  const resolveTargetInput = (): HTMLInputElement | HTMLTextAreaElement | null => {
    if (isEditableInput(document.activeElement)) {
      lastFocusedInputRef.current = document.activeElement;
      return document.activeElement;
    }
    if (lastFocusedInputRef.current && document.body.contains(lastFocusedInputRef.current)) {
      return lastFocusedInputRef.current;
    }
    const fallback = findPreferredProductInput();
    if (fallback) {
      lastFocusedInputRef.current = fallback;
      return fallback;
    }
    return null;
  };

  // Real-time Product Autofill Engine based on what the user is typing
  const autofillProducts = useMemo(() => {
    const q = activeFieldValue.trim().toLowerCase();
    if (!q) {
      return products.slice(0, 12);
    }

    const scored = products
      .map(p => {
        const nameLower = p.name.toLowerCase();
        const brandLower = p.brand.toLowerCase();
        const skuLower = p.sku.toLowerCase();
        const subCatLower = (p.subCategory || '').toLowerCase();
        const barcode = p.barcode.toLowerCase();

        let score = 0;
        if (nameLower.startsWith(q)) score += 100;
        else if (brandLower.startsWith(q)) score += 85;
        else if (skuLower.startsWith(q) || barcode.startsWith(q)) score += 80;
        else if (nameLower.includes(q)) score += 60;
        else if (brandLower.includes(q)) score += 50;
        else if (subCatLower.includes(q)) score += 40;
        else if (skuLower.includes(q) || barcode.includes(q)) score += 30;

        return { product: p, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 12).map(s => s.product);
  }, [products, activeFieldValue]);

  const topAutofillProduct: Product | null =
    activeFieldValue.trim().length > 0 && autofillProducts.length > 0
      ? autofillProducts[0]
      : null;

  // Autofill a selected product into the active input (and POS search/barcode field)
  const handleAutofillSelectProduct = useCallback(
    (product: Product, alsoAddToCart = false) => {
      playClickTone(880);
      const target = resolveTargetInput() || findPreferredProductInput();

      if (target) {
        const placeholderLower = (target.placeholder || '').toLowerCase();
        const isBarcodeField =
          placeholderLower.includes('barcode') || placeholderLower.includes('scan bottle');
        const isNumberInput = target instanceof HTMLInputElement && target.type === 'number';

        const valueToFill = isNumberInput
          ? String(isWholesaleStore ? product.wholesalePriceKes : product.retailPriceKes)
          : isBarcodeField
          ? product.barcode || product.sku
          : product.name;

        target.focus();
        setActiveFieldLabel(describeInput(target));
        setNativeValueAndTriggerReact(target, valueToFill);
      } else {
        setActiveFieldValue(product.name);
      }

      if (alsoAddToCart) {
        addToCart(product, 1, 0);
        setAutofillNotice(`✓ Autofilled & Added "${product.name}" to Cart`);
      } else {
        setAutofillNotice(`✓ Autofilled "${product.name}"`);
      }
      setTimeout(() => setAutofillNotice(null), 2800);
    },
    [addToCart, isWholesaleStore]
  );

  const handleKeyPress = useCallback(
    (keyToken: string) => {
      playClickTone();
      setActiveKeyFlash(keyToken);
      setTimeout(() => setActiveKeyFlash(prev => (prev === keyToken ? null : prev)), 130);

      if (keyToken === 'TAB_AUTOFILL') {
        if (topAutofillProduct) {
          handleAutofillSelectProduct(topAutofillProduct, false);
        }
        return;
      }

      // Dispatch global keydown for PIN modals or listeners
      if (keyToken === 'BACKSPACE') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      } else if (keyToken === 'CLEAR') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      } else if (keyToken === 'ENTER') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else if (keyToken.length === 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: keyToken, bubbles: true }));
      }

      const target = resolveTargetInput();
      if (!target) {
        // Update local buffer even if no input is on the current screen so product autofill still works
        if (keyToken === 'BACKSPACE') {
          setActiveFieldValue(prev => prev.slice(0, -1));
        } else if (keyToken === 'CLEAR') {
          setActiveFieldValue('');
        } else if (keyToken !== 'ENTER') {
          const textToInsert = keyToken === 'SPACE' ? ' ' : keyToken;
          setActiveFieldValue(prev => prev + textToInsert);
        }
        return;
      }

      target.focus();
      setActiveFieldLabel(describeInput(target));

      const currentVal = target.value || '';
      const isNumberInput = target instanceof HTMLInputElement && target.type === 'number';

      if (keyToken === 'BACKSPACE') {
        if (!isNumberInput && target.selectionStart !== null && target.selectionEnd !== null) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          if (start !== end) {
            const next = currentVal.slice(0, start) + currentVal.slice(end);
            setNativeValueAndTriggerReact(target, next);
            requestAnimationFrame(() => target.setSelectionRange(start, start));
            return;
          } else if (start > 0) {
            const next = currentVal.slice(0, start - 1) + currentVal.slice(start);
            setNativeValueAndTriggerReact(target, next);
            requestAnimationFrame(() => target.setSelectionRange(start - 1, start - 1));
            return;
          }
        }
        setNativeValueAndTriggerReact(target, currentVal.slice(0, -1));
        return;
      }

      if (keyToken === 'CLEAR') {
        setNativeValueAndTriggerReact(target, '');
        return;
      }

      if (keyToken === 'ENTER') {
        if (topAutofillProduct && currentVal.trim().length > 0 && currentVal.trim().toLowerCase() !== topAutofillProduct.name.toLowerCase()) {
          handleAutofillSelectProduct(topAutofillProduct, false);
          return;
        }
        if (target.form) {
          target.form.requestSubmit();
        }
        return;
      }

      const textToInsert = keyToken === 'SPACE' ? ' ' : keyToken;

      if (isNumberInput && !/^[0-9.-]+$/.test(textToInsert)) {
        return;
      }

      if (!isNumberInput && target.selectionStart !== null && target.selectionEnd !== null) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const next = currentVal.slice(0, start) + textToInsert + currentVal.slice(end);
        setNativeValueAndTriggerReact(target, next);
        const newCursor = start + textToInsert.length;
        requestAnimationFrame(() => target.setSelectionRange(newCursor, newCursor));
      } else {
        setNativeValueAndTriggerReact(target, currentVal + textToInsert);
      }

      if (isShift && !isCaps) {
        setIsShift(false);
      }
    },
    [isShift, isCaps, topAutofillProduct, handleAutofillSelectProduct]
  );

  if (!isOpen) return null;

  const isUpperActive = isShift || isCaps;
  const activeRows = isUpperActive ? QWERTY_ROWS_UPPER : QWERTY_ROWS_LOWER;

  const keyboardContent = (
    <div
      className={`hidden md:block fixed left-1/2 -translate-x-1/2 z-[85] transition-all duration-200 rounded-3xl bg-slate-950/98 backdrop-blur-xl text-white border-2 border-[#FFDE00] shadow-[0_24px_80px_rgba(0,0,0,0.88)] px-3 sm:px-6 lg:px-8 py-3.5 select-none animate-in fade-in duration-150 ${
        widthMode === 'ULTRA_WIDE'
          ? 'w-[99vw] max-w-none'
          : 'w-[94vw] max-w-[1680px]'
      } ${dockPosition === 'BOTTOM' ? 'bottom-28' : 'top-24'}`}
    >
      {/* Top Bar: Keyboard Title, Live Input with Inline Ghost Autofill & Width/Dock/Close Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0 shadow-xs">
            <Keyboard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                Ultra-Wide Touchscreen POS Keyboard • Live Product Autofill
              </span>
              {autofillNotice && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-montserrat font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{autofillNotice}</span>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300 truncate max-w-xs sm:max-w-lg">
              Active Input Target: <strong className="text-white">{activeFieldLabel}</strong>
            </div>
          </div>
        </div>

        {/* Wide Live Typed Buffer Preview + Instant Top Autofill Completion */}
        <div className="flex-1 min-w-[280px] mx-2 px-4 py-2 rounded-2xl bg-slate-900 border-2 border-[#FFDE00]/60 font-mono text-sm flex items-center justify-between gap-3 shadow-inner">
          <div className="truncate flex items-center gap-1 min-w-0">
            <span className="text-[#FFDE00] font-bold">
              {activeFieldValue || (
                <span className="text-slate-400 italic font-normal text-xs sm:text-sm">
                  Start typing product name, brand, barcode, or SKU across the wide keyboard...
                </span>
              )}
            </span>
            {topAutofillProduct &&
              topAutofillProduct.name.toLowerCase().startsWith(activeFieldValue.trim().toLowerCase()) &&
              activeFieldValue.trim().length > 0 && (
                <span className="text-slate-500 truncate">
                  {topAutofillProduct.name.slice(activeFieldValue.trim().length)}
                </span>
              )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {topAutofillProduct && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAutofillSelectProduct(topAutofillProduct, false);
                }}
                className="px-3 py-1 rounded-xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] text-xs font-montserrat font-black flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
                title="Autofill top matching product"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="truncate max-w-[240px]">Autofill: {topAutofillProduct.name}</span>
              </button>
            )}
            {activeFieldValue && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress('CLEAR');
                }}
                className="px-2.5 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-montserrat font-bold shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: Width Span Toggle, Move Top/Bottom & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWidthMode(prev => (prev === 'ULTRA_WIDE' ? 'WIDE' : 'ULTRA_WIDE'));
            }}
            className="px-3 py-2 rounded-xl bg-[#0A006E] hover:bg-[#14049c] text-[#FFDE00] text-xs font-montserrat font-black flex items-center gap-1.5 border border-[#FFDE00]/50 transition whitespace-nowrap"
            title="Toggle between 99vw Full-Bleed Ultra-Wide and 94vw Wide"
          >
            {widthMode === 'ULTRA_WIDE' ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span className="hidden sm:inline">99% Full-Wide</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span className="hidden sm:inline">Expand 99% Wide</span>
              </>
            )}
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDockPosition(prev => (prev === 'BOTTOM' ? 'TOP' : 'BOTTOM'));
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-montserrat font-bold flex items-center gap-1.5 border border-slate-700 transition whitespace-nowrap"
            title="Dock keyboard to top or bottom of screen"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FFDE00]" />
            <span className="hidden sm:inline">{dockPosition === 'BOTTOM' ? 'Dock Top' : 'Dock Bottom'}</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-montserrat font-black flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
            title="Close Wide Keyboard"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Live Product Autofill Suggestion Strip — Spans Full Wide Viewport */}
      <div className="mb-3 pb-2.5 border-b border-slate-800/90">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#FFDE00] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FFDE00]" />
            <span>
              {activeFieldValue.trim()
                ? `Product Autofill Matches for "${activeFieldValue.trim()}" (${autofillProducts.length})`
                : 'Quick Product Autofill Suggestions (Tap any card to Autofill or + Cart)'}
            </span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            Full-width POS autofill ribbon • Tap card to fill field • Tap + Cart for instant sale
          </span>
        </div>

        {autofillProducts.length === 0 ? (
          <div className="py-2.5 px-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400">
            No products matching &ldquo;{activeFieldValue}&rdquo;.
          </div>
        ) : (
          <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {autofillProducts.map((prod, idx) => {
              const inv = inventoryItems.find(
                i => i.productId === prod.id && i.branchId === activeBranch.id
              );
              const stock = inv ? inv.bottlesOnHand : 0;
              const price = isWholesaleStore ? prod.wholesalePriceKes : prod.retailPriceKes;
              const isTopMatch = idx === 0 && activeFieldValue.trim().length > 0;

              return (
                <div
                  key={prod.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAutofillSelectProduct(prod, false);
                  }}
                  className={`shrink-0 w-68 sm:w-76 p-2 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                    isTopMatch
                      ? 'bg-[#0A006E] border-2 border-[#FFDE00] shadow-md'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/90 hover:border-[#FFDE00]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-950">
                      <ProductImage
                        product={prod}
                        size="full"
                        showVolumeBadge={false}
                        className="w-full h-full rounded-none border-0"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {isTopMatch && (
                          <span className="px-1.5 py-0.2 rounded bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[8px] uppercase shrink-0">
                            TOP MATCH
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-300 truncate">
                          {prod.brand} • {prod.volumeMl}mL
                        </span>
                      </div>
                      <div className="font-montserrat font-black text-xs text-white truncate">
                        {prod.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-montserrat font-black text-[11px] text-[#FFDE00] tabular-nums">
                          {formatKes(price)}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded tabular-nums ${
                            stock > 0
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {stock} in stock
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct + Cart Button on Autofill Card */}
                  <button
                    type="button"
                    disabled={stock <= 0 || !activeBranch.allowDirectSales}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAutofillSelectProduct(prod, true);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-800 disabled:opacity-40 text-[#FFDE00] border border-[#FFDE00]/40 font-montserrat font-black text-[10px] flex flex-col items-center justify-center gap-0.5 shrink-0 transition"
                    title="Autofill & Add 1 bottle to Cart"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>+ Cart</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ultra-Wide Split POS Deck: Left = Edge-to-Edge Full QWERTY (9 cols) | Right = Wide POS Numpad (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* LEFT: Full-Stretch Wide QWERTY Keyboard (No max-width cap on keys!) */}
        <div className="lg:col-span-9 space-y-2 w-full">
          {activeRows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full">
              {/* Left Modifier Keys per Row for authentic Wide Deck */}
              {rowIdx === 1 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleKeyPress('TAB_AUTOFILL');
                  }}
                  className="h-12 sm:h-14 px-4 sm:px-5 rounded-2xl bg-[#0A006E] hover:bg-[#1506a3] text-[#FFDE00] border-2 border-[#FFDE00]/40 font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shrink-0 whitespace-nowrap"
                  title="Tab / Autofill Top Match"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Tab Fill</span>
                </button>
              )}

              {rowIdx === 2 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsCaps(prev => !prev);
                  }}
                  className={`h-12 sm:h-14 px-4 sm:px-6 rounded-2xl font-montserrat font-black text-xs sm:text-sm border-2 transition shrink-0 whitespace-nowrap ${
                    isCaps
                      ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00] shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  CAPS
                </button>
              )}

              {rowIdx === 3 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsShift(prev => !prev);
                  }}
                  className={`h-12 sm:h-14 px-5 sm:px-7 rounded-2xl font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition shrink-0 whitespace-nowrap ${
                    isShift
                      ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00] shadow-md'
                      : 'bg-[#0A006E] hover:bg-[#120596] text-white border-slate-700'
                  }`}
                >
                  <ArrowBigUp className="w-5 h-5" />
                  <span className="hidden sm:inline">Shift</span>
                </button>
              )}

              {/* Stretchable Wide Keys */}
              {row.map((char) => {
                const isFlashed = activeKeyFlash === char;
                return (
                  <button
                    key={char}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleKeyPress(char);
                    }}
                    className={`flex-1 h-12 sm:h-14 min-w-[38px] rounded-2xl font-montserrat font-black text-xl sm:text-2xl uppercase flex items-center justify-center border-2 transition active:scale-96 ${
                      isFlashed
                        ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00] scale-96'
                        : 'bg-slate-900 hover:bg-[#0A006E] text-white hover:text-[#FFDE00] border-slate-700/90 shadow-sm'
                    }`}
                  >
                    {isUpperActive ? char.toUpperCase() : char}
                  </button>
                );
              })}

              {/* Right Action Keys per Row */}
              {rowIdx === 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleKeyPress('BACKSPACE');
                  }}
                  className="h-12 sm:h-14 px-5 sm:px-7 rounded-2xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-2 border-amber-500/40 font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shrink-0 whitespace-nowrap"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                  <span className="hidden sm:inline">Backspace</span>
                </button>
              )}

              {rowIdx === 2 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleKeyPress('ENTER');
                  }}
                  className="h-12 sm:h-14 px-6 sm:px-8 rounded-2xl bg-[#34D186] hover:bg-emerald-800 text-[#FFDE00] border-2 border-emerald-500 font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-sm shrink-0 whitespace-nowrap"
                  title="Autofill Top Match / Enter"
                >
                  <CornerDownLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Enter</span>
                </button>
              )}

              {rowIdx === 3 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsShift(prev => !prev);
                  }}
                  className={`h-12 sm:h-14 px-5 sm:px-7 rounded-2xl font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition shrink-0 whitespace-nowrap ${
                    isShift
                      ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00] shadow-md'
                      : 'bg-[#0A006E] hover:bg-[#120596] text-white border-slate-700'
                  }`}
                >
                  <ArrowBigUp className="w-5 h-5" />
                  <span className="hidden sm:inline">Shift</span>
                </button>
              )}
            </div>
          ))}

          {/* Bottom Extra-Wide Spacebar & Kenyan Liquor POS Quick-Insert Row */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 pt-0.5 w-full">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('TAB_AUTOFILL');
              }}
              className="h-12 sm:h-14 px-4 sm:px-5 rounded-2xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#FFDE00] font-montserrat font-black text-xs sm:text-sm flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
              title="Autofill Top Matching Product"
            >
              <Sparkles className="w-4 h-4" />
              <span>Autofill</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('2547');
              }}
              className="h-12 sm:h-14 px-4 rounded-2xl bg-slate-800 hover:bg-[#0A006E] text-[#FFDE00] border-2 border-slate-700 font-mono font-black text-sm sm:text-base transition shrink-0 whitespace-nowrap"
              title="Insert Kenyan Phone Prefix 2547"
            >
              2547
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('350ml');
              }}
              className="hidden sm:flex h-12 sm:h-14 px-3.5 rounded-2xl bg-slate-800 hover:bg-[#0A006E] text-slate-200 hover:text-[#FFDE00] border-2 border-slate-700 font-mono font-black text-xs sm:text-sm items-center justify-center transition shrink-0 whitespace-nowrap"
            >
              350ml
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('SPACE');
              }}
              className="flex-[3] h-12 sm:h-14 rounded-2xl bg-slate-900 hover:bg-[#0A006E] text-white hover:text-[#FFDE00] border-2 border-slate-700 font-montserrat font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition shadow-xs"
            >
              <Space className="w-5 h-5" />
              <span className="tracking-widest">WIDE SPACEBAR</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('750ml');
              }}
              className="h-12 sm:h-14 px-4 rounded-2xl bg-slate-800 hover:bg-[#0A006E] text-white hover:text-[#FFDE00] border-2 border-slate-700 font-mono font-black text-xs sm:text-sm transition shrink-0 whitespace-nowrap"
            >
              750ml
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('1000ml');
              }}
              className="hidden md:flex h-12 sm:h-14 px-3.5 rounded-2xl bg-slate-800 hover:bg-[#0A006E] text-slate-200 hover:text-[#FFDE00] border-2 border-slate-700 font-mono font-black text-xs sm:text-sm items-center justify-center transition shrink-0 whitespace-nowrap"
            >
              1000ml
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('CLEAR');
              }}
              className="h-12 sm:h-14 px-4 sm:px-5 rounded-2xl bg-red-950/80 hover:bg-red-700 text-red-200 border-2 border-red-800 font-montserrat font-black text-xs sm:text-sm flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* RIGHT: Wide Dedicated POS Numeric Keypad (for Quantities, Cash Tendered, PINs, Barcodes) */}
        <div className="lg:col-span-3 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-2 lg:pt-0 flex flex-col justify-between gap-2">
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD_KEYS.flat().map((numKey) => {
              const isFlashed = activeKeyFlash === numKey;
              return (
                <button
                  key={numKey}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleKeyPress(numKey);
                  }}
                  className={`h-12 sm:h-14 rounded-2xl font-mono font-black text-xl sm:text-2xl tabular-nums flex items-center justify-center border-2 transition active:scale-96 ${
                    isFlashed
                      ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00]'
                      : 'bg-[#0A006E]/85 hover:bg-[#FFDE00] text-[#FFDE00] hover:text-[#0A006E] border-[#FFDE00]/30 shadow-xs'
                  }`}
                >
                  {numKey}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('BACKSPACE');
              }}
              className="h-12 sm:h-14 rounded-2xl bg-slate-800 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-2 border-slate-700 font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition"
            >
              <Delete className="w-4 h-4" />
              <span>Del</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleKeyPress('ENTER');
              }}
              className="h-12 sm:h-14 rounded-2xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-sm"
            >
              <CornerDownLeft className="w-4 h-4" />
              <span>Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(keyboardContent, document.body)
    : keyboardContent;
};
