/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Branch } from '../../types';
import { RealResolvedLocation } from '../../utils/realLocationService';
import {
  detectKenyanMobileCarrier,
  sanitizeAndControlKenyanMobileInput,
  formatKenyanMobileDisplay
} from '../../utils/kenyanMobileCarrier';
import {
  CenterScreenFeedback,
  CenterScreenFeedbackData,
  AnimatedErrorLogo
} from '../common/CenterScreenFeedback';
import {
  User,
  Smartphone,
  MapPin,
  Search,
  LocateFixed,
  Truck,
  Lock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  CreditCard,
  Building2,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  FileText,
  Download
} from 'lucide-react';

export interface StorefrontCustomerProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
}

export interface NearestBranchInfo {
  branch: Branch;
  distanceKm: number;
  estimatedEtaMinutes: number;
  routingModel: string;
}

export interface StorefrontCartItem {
  product: Product;
  quantity: number;
}

export const normalizeKenyanMpesaPhone = (raw: string): string => {
  return sanitizeAndControlKenyanMobileInput(raw);
};

export const isValidKenyanMpesaPhone = (raw: string): boolean => {
  return detectKenyanMobileCarrier(raw).isValid;
};

export const formatKes = (amount: number) => {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const POPULAR_DELIVERY_ZONES = [
  'Kilimani',
  'Westlands',
  'Kileleshwa',
  'Lavington',
  'Karen',
  'South B',
  'South C',
  'Ngong Road',
  'Parklands',
  'CBD',
  'Ruaka',
  'Langata'
];

export interface CustomerCheckoutWizardProps {
  webCart: StorefrontCartItem[];
  updateWebCartQty: (productId: string, quantity: number) => void;
  removeFromWebCart: (productId: string) => void;
  onGenerateOrderDoc?: () => void;
  onDownloadOrderDoc?: () => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  deliveryZone: string;
  setDeliveryZone: (zone: string) => void;
  deliveryStreetAndHouse: string;
  setDeliveryStreetAndHouse: (street: string) => void;
  deliveryNotes: string;
  setDeliveryNotes: (notes: string) => void;
  customerCoords: { lat: number; lng: number } | null;
  selectedFulfillingBranch: Branch;
  selectedNearestBranchInfo?: NearestBranchInfo;
  customerProfile: StorefrontCustomerProfile | null;
  totalCartCompanyPriceKes: number;
  totalCartItems: number;
  checkoutError: string | null;
  setCheckoutError: (error: string | null) => void;
  isLocatingGps: boolean;
  onLocateGps: () => void;
  placeSearchQuery: string;
  setPlaceSearchQuery: (query: string) => void;
  placeSearchResults: RealResolvedLocation[];
  setPlaceSearchResults: (results: RealResolvedLocation[]) => void;
  isSearchingPlaces: boolean;
  showPlaceSearchDropdown: boolean;
  setShowPlaceSearchDropdown: (show: boolean) => void;
  onApplyLocationSelection: (loc: RealResolvedLocation) => void;
  onRequireSignInForCheckout: (immediatePrompt: boolean) => void;
  onSubmitOrder: (promptImmediately: boolean) => void;
  compact?: boolean;
}

export const CustomerCheckoutWizard: React.FC<CustomerCheckoutWizardProps> = ({
  webCart,
  updateWebCartQty,
  removeFromWebCart,
  onGenerateOrderDoc,
  onDownloadOrderDoc,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  deliveryZone,
  setDeliveryZone,
  deliveryStreetAndHouse,
  setDeliveryStreetAndHouse,
  deliveryNotes,
  setDeliveryNotes,
  selectedFulfillingBranch,
  selectedNearestBranchInfo,
  customerProfile,
  totalCartCompanyPriceKes,
  totalCartItems,
  checkoutError,
  setCheckoutError,
  isLocatingGps,
  onLocateGps,
  placeSearchQuery,
  setPlaceSearchQuery,
  placeSearchResults,
  setPlaceSearchResults,
  isSearchingPlaces,
  showPlaceSearchDropdown,
  setShowPlaceSearchDropdown,
  onApplyLocationSelection,
  onRequireSignInForCheckout,
  onSubmitOrder,
  compact = false
}) => {
  // Collapsible Step-by-Step Accordion Wizard: only 1 step expanded at a time
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardFeedback, setWizardFeedback] = useState<CenterScreenFeedbackData | null>(null);

  useEffect(() => {
    if (checkoutError) {
      setWizardFeedback({
        type: 'ERROR',
        title: 'Action Required',
        message: checkoutError,
        durationMs: 550
      });
      const timer = setTimeout(() => {
        setCheckoutError(null);
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [checkoutError, setCheckoutError]);

  useEffect(() => {
    if (!customerName.trim() && customerProfile?.name) {
      setCustomerName(customerProfile.name);
    }
    if (!customerPhone.trim() && customerProfile?.phone) {
      setCustomerPhone(customerProfile.phone);
    }
  }, [customerProfile, customerName, customerPhone, setCustomerName, setCustomerPhone]);

  const handleProceedToStep2 = () => {
    setCheckoutError(null);
    if (webCart.length === 0) {
      setCheckoutError('Your cart is empty. Please add items to proceed.');
      return;
    }
    setCurrentStep(2);
  };

  const handleProceedToStep3 = () => {
    setCheckoutError(null);
    const resolvedName = customerName.trim() || customerProfile?.name?.trim() || '';
    if (!resolvedName) {
      setCheckoutError('Please enter your full name.');
      return;
    }
    const rawPhone = customerPhone.trim() || customerProfile?.phone?.trim() || '';
    if (!rawPhone || !isValidKenyanMpesaPhone(rawPhone)) {
      setCheckoutError('Enter a valid 10-digit Kenyan M-Pesa / Airtel number (e.g. 0712345678).');
      return;
    }
    setCurrentStep(3);
  };

  const handleProceedToStep4 = () => {
    setCheckoutError(null);
    if (!deliveryZone.trim()) {
      setCheckoutError('Please enter or select your delivery area.');
      return;
    }
    if (!deliveryStreetAndHouse.trim()) {
      setCheckoutError('Please enter your building, street, or house number.');
      return;
    }
    setCurrentStep(4);
  };

  const phoneCarrierInfo = detectKenyanMobileCarrier(customerPhone);
  const isPhoneValid = phoneCarrierInfo.isValid;
  const hasStep1Valid = webCart.length > 0;
  const hasStep2Valid = Boolean((customerName.trim() || customerProfile?.name) && isPhoneValid);
  const hasStep3Valid = Boolean(deliveryZone.trim() && deliveryStreetAndHouse.trim());

  const netSubtotalKes = Math.round((totalCartCompanyPriceKes / 1.16) * 100) / 100;
  const vatAmountKes = Math.round((totalCartCompanyPriceKes - netSubtotalKes) * 100) / 100;

  if (webCart.length === 0) {
    return (
      <div className="text-center py-6 px-4 space-y-2 bg-slate-50/80 rounded-xl border border-dashed border-slate-300">
        <ShoppingBag className="w-6 h-6 text-slate-400 mx-auto" />
        <div className="font-montserrat font-bold text-slate-900 text-xs">
          Your Delivery Cart is Empty
        </div>
        <p className="text-[11px] text-slate-500">
          Select drinks from the catalog to begin checkout.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? 'p-3 space-y-2' : 'space-y-2'}>
      <CenterScreenFeedback
        feedback={wizardFeedback}
        onDismiss={() => setWizardFeedback(null)}
      />

      {/* Compact Error Banner */}
      {checkoutError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-[11px] font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AnimatedErrorLogo size="sm" />
            <span className="truncate">{checkoutError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="text-red-500 hover:text-red-800 p-0.5 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* COLLAPSIBLE ACCORDION STEP 1: CART ITEMS                 */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
            currentStep === 1
              ? 'bg-[#0A006E] text-white'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {currentStep > 1 && hasStep1Valid ? (
              <CheckCircle2 className="w-4 h-4 text-[#34D186] shrink-0" />
            ) : (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  currentStep === 1 ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
            )}
            <span className="font-montserrat font-bold text-xs truncate">
              1. Cart Items
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`font-mono font-bold text-[11px] ${
                currentStep === 1 ? 'text-[#FFDE00]' : 'text-[#1E9E60]'
              }`}
            >
              {totalCartItems} btl{totalCartItems > 1 ? 's' : ''} • {formatKes(totalCartCompanyPriceKes)}
            </span>
            {currentStep === 1 ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </button>

        {currentStep === 1 && (
          <div className="p-3 space-y-2.5">
            {webCart.length >= 2 && onGenerateOrderDoc && onDownloadOrderDoc && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1.5 border-b border-slate-100">
                <span>Multi-item order manifest</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onGenerateOrderDoc}
                    className="text-[#0A006E] hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>View</span>
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={onDownloadOrderDoc}
                    className="text-[#1E9E60] hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 pr-0.5 space-y-1.5 scrollbar-thin">
              {webCart.map(item => (
                <div
                  key={item.product.id}
                  className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-montserrat font-bold text-slate-900 truncate text-[11px]">
                      {item.product.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {formatKes(item.product.retailPriceKes)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateWebCartQty(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3 text-slate-700" />
                    </button>
                    <span className="font-mono font-black text-xs w-5 text-center text-[#0A006E]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateWebCartQty(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-slate-700" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-[11px] text-[#0A006E] min-w-16 text-right">
                      {formatKes(item.product.retailPriceKes * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromWebCart(item.product.id)}
                      className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleProceedToStep2}
              className="w-full py-2.5 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Next: Contact &amp; M-Pesa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* COLLAPSIBLE ACCORDION STEP 2: CONTACT & M-PESA           */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => {
            if (hasStep1Valid) setCurrentStep(2);
          }}
          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
            currentStep === 2
              ? 'bg-[#0A006E] text-white'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasStep2Valid && currentStep !== 2 ? (
              <CheckCircle2 className="w-4 h-4 text-[#34D186] shrink-0" />
            ) : (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  currentStep === 2 ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
            )}
            <span className="font-montserrat font-bold text-xs truncate">
              2. Contact &amp; M-Pesa
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[11px] truncate max-w-36 ${
                currentStep === 2
                  ? 'text-[#FFDE00] font-semibold'
                  : hasStep2Valid
                  ? 'text-slate-700 font-mono font-bold'
                  : 'text-slate-400'
              }`}
            >
              {hasStep2Valid
                ? `${(customerName || customerProfile?.name || '').split(' ')[0]} • ${formatKenyanMobileDisplay(customerPhone)}`
                : 'Name & Phone'}
            </span>
            {currentStep === 2 ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </div>
        </button>

        {currentStep === 2 && (
          <div className="p-3 space-y-2.5">
            <div>
              <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value);
                    if (checkoutError) setCheckoutError(null);
                  }}
                  placeholder="e.g. Kelvin Mutua"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-montserrat font-bold text-slate-700">
                  M-Pesa / Airtel Phone <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {phoneCarrierInfo.carrier !== 'UNKNOWN' ? `${phoneCarrierInfo.carrier} • ` : ''}
                  {phoneCarrierInfo.digitsCount}/10 digits
                </span>
              </div>
              <div className="relative">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneCarrierInfo.cleanDigits}
                  onChange={e => {
                    setCustomerPhone(sanitizeAndControlKenyanMobileInput(e.target.value));
                    if (checkoutError) setCheckoutError(null);
                  }}
                  placeholder="0712345678"
                  className={`w-full pl-8 pr-16 py-2 rounded-lg bg-slate-50 border text-xs font-mono font-black tracking-wider text-[#0A006E] focus:bg-white focus:outline-none ${
                    isPhoneValid ? 'border-[#34D186]' : 'border-slate-300 focus:border-[#0A006E]'
                  }`}
                />
                {isPhoneValid && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-montserrat font-bold text-[#1E9E60] flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleProceedToStep3}
                className="flex-1 py-2 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Next: Delivery Location</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* COLLAPSIBLE ACCORDION STEP 3: DELIVERY LOCATION          */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => {
            if (hasStep1Valid && hasStep2Valid) {
              setCurrentStep(3);
            } else {
              handleProceedToStep3();
            }
          }}
          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
            currentStep === 3
              ? 'bg-[#0A006E] text-white'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasStep3Valid && currentStep !== 3 ? (
              <CheckCircle2 className="w-4 h-4 text-[#34D186] shrink-0" />
            ) : (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  currentStep === 3 ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
            )}
            <span className="font-montserrat font-bold text-xs truncate">
              3. Delivery Address
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[11px] truncate max-w-36 ${
                currentStep === 3
                  ? 'text-[#FFDE00] font-semibold'
                  : hasStep3Valid
                  ? 'text-slate-700 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              {hasStep3Valid ? `${deliveryZone} — ${deliveryStreetAndHouse}` : 'Area & Building'}
            </span>
            {currentStep === 3 ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </div>
        </button>

        {currentStep === 3 && (
          <div className="p-3 space-y-2.5">
            {/* Compact Search + GPS Row */}
            <div className="relative flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={placeSearchQuery}
                  onFocus={() => setShowPlaceSearchDropdown(true)}
                  onChange={e => {
                    setPlaceSearchQuery(e.target.value);
                    setShowPlaceSearchDropdown(true);
                  }}
                  placeholder="Search road, estate or building..."
                  className="w-full pl-8 pr-6 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                />
                {placeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlaceSearchQuery('');
                      setPlaceSearchResults([]);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onLocateGps}
                disabled={isLocatingGps}
                className="px-2.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                title="Detect my exact GPS coordinates"
              >
                <LocateFixed className={`w-3 h-3 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>{isLocatingGps ? '...' : 'GPS'}</span>
              </button>

              {showPlaceSearchDropdown && (isSearchingPlaces || placeSearchResults.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#0A006E] shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {isSearchingPlaces ? (
                    <div className="p-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <LocateFixed className="w-3 h-3 animate-spin text-[#0A006E]" />
                      <span>Searching Kenya locations...</span>
                    </div>
                  ) : (
                    placeSearchResults.map((loc, idx) => (
                      <button
                        key={`loc-${loc.latitude}-${loc.longitude}-${idx}`}
                        type="button"
                        onClick={() => onApplyLocationSelection(loc)}
                        className="w-full text-left p-2 hover:bg-slate-50 flex items-start gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#0A006E] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-montserrat font-bold text-[11px] text-slate-900 truncate">
                            {loc.streetOrBuilding} — {loc.areaOrSuburb}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{loc.displayName}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Area & Building in Compact 2-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-montserrat font-bold text-slate-600 mb-0.5">
                  Area / Suburb <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="vaairo-delivery-zones"
                  value={deliveryZone}
                  onChange={e => {
                    setDeliveryZone(e.target.value);
                    if (checkoutError) setCheckoutError(null);
                  }}
                  placeholder="e.g. Kilimani"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                />
                <datalist id="vaairo-delivery-zones">
                  {POPULAR_DELIVERY_ZONES.map(zone => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-bold text-slate-600 mb-0.5">
                  Building / House No. <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={deliveryStreetAndHouse}
                    onChange={e => {
                      setDeliveryStreetAndHouse(e.target.value);
                      if (checkoutError) setCheckoutError(null);
                    }}
                    placeholder="Rose Apts, Hse 4B"
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                  />
                </div>
              </div>
            </div>

            {/* Rider Note + Fulfilling Branch Line */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Delivery note (optional, e.g. call at gate)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:border-[#0A006E]"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Fulfilling Branch: <strong className="text-[#0A006E]">{selectedFulfillingBranch.name}</strong></span>
                {selectedNearestBranchInfo && (
                  <span className="font-mono">
                    {selectedNearestBranchInfo.distanceKm} km · ~{selectedNearestBranchInfo.estimatedEtaMinutes}m
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleProceedToStep4}
                className="flex-1 py-2 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Next: Review &amp; Pay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* COLLAPSIBLE ACCORDION STEP 4: CONFIRM & PAY              */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => {
            if (hasStep1Valid && hasStep2Valid && hasStep3Valid) {
              setCurrentStep(4);
            } else if (!hasStep2Valid) {
              setCurrentStep(2);
              handleProceedToStep3();
            } else {
              setCurrentStep(3);
              handleProceedToStep4();
            }
          }}
          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
            currentStep === 4
              ? 'bg-[#0A006E] text-white'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                currentStep === 4 ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-slate-200 text-slate-700'
              }`}
            >
              4
            </span>
            <span className="font-montserrat font-bold text-xs truncate">
              4. Confirm &amp; Pay
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`font-mono font-bold text-[11px] ${
                currentStep === 4 ? 'text-[#FFDE00]' : 'text-[#1E9E60]'
              }`}
            >
              {formatKes(totalCartCompanyPriceKes)}
            </span>
            {currentStep === 4 ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </button>

        {currentStep === 4 && (
          <div className="p-3 space-y-2.5">
            {/* Compact VAT & Total Box */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Excl. VAT):</span>
                <span className="font-mono font-semibold">{formatKes(netSubtotalKes)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Enforced 16% VAT:</span>
                <span className="font-mono font-semibold text-[#1E9E60]">{formatKes(vatAmountKes)}</span>
              </div>
              <div className="flex justify-between text-xs font-montserrat font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Total (Free Delivery):</span>
                <span className="font-mono text-[#1E9E60]">{formatKes(totalCartCompanyPriceKes)}</span>
              </div>
            </div>

            {!customerProfile ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  data-oauth-popup="true"
                  onClick={() => onRequireSignInForCheckout(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Sign In with Google to Order</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onSubmitOrder(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Pay Now via M-Pesa ({formatKenyanMobileDisplay(customerPhone) || 'STK Push'})
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSubmitOrder(false)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
                    <span className="truncate">Pay on Delivery (Hold Order)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
