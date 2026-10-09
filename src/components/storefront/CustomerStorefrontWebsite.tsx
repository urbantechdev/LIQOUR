import React, { useState, useMemo, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, signInWithGooglePopup } from '../../firebase';
import { useErp } from '../../context/ErpContext';
import { Product, WebsiteDeliveryOrder, ETimsInvoice, SaleOrder } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { getProductImageUrl } from '../../utils/productImages';
import {
  buildProductJsonLdSchema,
  buildStorefrontCatalogJsonLd,
  buildCleanProductDescription,
  resolveHighResProductImageUrl
} from '../../utils/seoMerchantFeed';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import { OrderItemsDocumentModal } from '../common/OrderItemsDocumentModal';
import { CustomerCheckoutWizard } from './CustomerCheckoutWizard';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  CenterScreenFeedback,
  CenterScreenFeedbackData,
  AnimatedSuccessTickLogo,
  AnimatedErrorLogo
} from '../common/CenterScreenFeedback';
import { scatterAndReshuffleProducts, useAutoReshuffleTimer } from '../../utils/productScattering';
import {
  isPlatformFullscreen,
  requestPlatformFullscreen,
  exitPlatformFullscreen
} from '../common/SessionSecurityMonitor';
import { MerchantSeoDiagnosticsModal } from './MerchantSeoDiagnosticsModal';
import {
  OrderItemsDocumentPayload,
  isMultiItemOrder,
  buildOrderDocumentFromWebsiteDeliveryOrder,
  buildOrderDocumentFromCart,
  downloadOrderItemsHtmlDocument
} from '../../utils/orderItemsDocumentGenerator';
import {
  DELIVERY_ZONE_GEO_DIRECTORY,
  rankBranchesForCustomer,
  findNearestStockedBranchForProduct
} from '../../utils/branchGeoRouting';
import {
  RealResolvedLocation,
  detectUserRealWorldLocation,
  searchRealPlaces,
  buildOpenStreetMapEmbedUrl,
  buildOpenStreetMapDirectUrl
} from '../../utils/realLocationService';
import {
  detectKenyanMobileCarrier,
  sanitizeAndControlKenyanMobileInput,
  formatKenyanMobileDisplay
} from '../../utils/kenyanMobileCarrier';
import {
  Wine,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Search,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Clock,
  Smartphone,
  ArrowRight,
  Sparkles,
  PackageCheck,
  RotateCcw,
  X,
  Receipt,
  Building2,
  Lock,
  ExternalLink,
  Rss,
  LayoutGrid,
  Menu,
  Navigation,
  LocateFixed,
  Store,
  Mail,
  LogOut,
  FileText,
  Download,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star
} from 'lucide-react';

const GoogleGIcon = ({ className = 'w-4 h-4 shrink-0' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface StorefrontCustomerProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
}

const CUSTOMER_STORAGE_KEY = 'vaairo_storefront_gmail_customer_v1';
const WEB_CART_STORAGE_KEY = 'vaairo_storefront_web_cart_v1';

const normalizeKenyanMpesaPhone = (raw: string): string => {
  const digitsAndPlus = raw.trim().replace(/[\s()-]/g, '');
  if (digitsAndPlus.startsWith('+254')) return `0${digitsAndPlus.slice(4)}`;
  if (digitsAndPlus.startsWith('254') && digitsAndPlus.length === 12) return `0${digitsAndPlus.slice(3)}`;
  return digitsAndPlus;
};

const isValidKenyanMpesaPhone = (raw: string): boolean => {
  const cleaned = raw.trim().replace(/[\s()-]/g, '');
  return /^(?:\+?254|0)(?:7|1)\d{8}$/.test(cleaned);
};

interface StorefrontCartItem {
  product: Product;
  quantity: number;
}

interface Props {
  onSwitchToErp: () => void;
}

const DRINK_CATEGORIES = [
  { id: 'ALL', label: 'All Drinks' },
  { id: 'WHISKY', label: 'Whisky' },
  { id: 'COGNAC', label: 'Cognac & Brandy' },
  { id: 'GIN', label: 'Gin' },
  { id: 'VODKA', label: 'Vodka' },
  { id: 'WINE', label: 'Wine & Champagne' },
  { id: 'TEQUILA', label: 'Tequila' },
  { id: 'WHITE_RUM', label: 'White Rum' },
  { id: 'SPICED_DARK_RUM', label: 'Spiced, Dark & Aged Rum' },
  { id: 'CREAM_LIQUEUR', label: 'Cream Liqueurs' },
  { id: 'LIQUEUR', label: 'Liqueurs & Aperitifs' },
  { id: 'RUM', label: 'All Rum & Liqueur' },
  { id: 'BEER', label: 'Beer & Cider' }
];

const DELIVERY_ZONES = DELIVERY_ZONE_GEO_DIRECTORY.map(z => z.label);

export const CustomerStorefrontWebsite: React.FC<Props> = ({ onSwitchToErp }) => {
  const {
    products,
    inventoryItems,
    branches,
    activeBranch,
    scanHistory,
    websiteDeliveryOrders,
    placeWebsiteDeliveryOrder,
    updateWebsiteDeliveryOrderStatus,
    completeWebsiteDeliveryOrderWithMpesaPrompt,
    productRatings,
    submitProductRating,
    upsertLiveCustomerSession,
    removeLiveCustomerSession
  } = useErp();

  // Client-Side Gmail User Authentication State
  const [customerProfile, setCustomerProfile] = useState<StorefrontCustomerProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StorefrontCustomerProfile;
        if (parsed && parsed.email) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    if (auth.currentUser?.email) {
      return {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        email: auth.currentUser.email,
        photoURL: auth.currentUser.photoURL || undefined
      };
    }
    return null;
  });
  const [isCustomerLoginModalOpen, setIsCustomerLoginModalOpen] = useState(false);
  const [isEditingCustomerProfile, setIsEditingCustomerProfile] = useState(false);
  const [gmailLoginNameInput, setGmailLoginNameInput] = useState(
    () => customerProfile?.name || auth.currentUser?.displayName || ''
  );
  const [gmailLoginEmailInput, setGmailLoginEmailInput] = useState(
    () => customerProfile?.email || auth.currentUser?.email || ''
  );
  const [gmailLoginPhoneInput, setGmailLoginPhoneInput] = useState(
    () => customerProfile?.phone || ''
  );
  const [isSigningInWithGmail, setIsSigningInWithGmail] = useState(false);
  const [gmailLoginError, setGmailLoginError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promptImmediatelyOnCheckout, setPromptImmediatelyOnCheckout] = useState(false);
  const [isPendingCheckoutSignIn, setIsPendingCheckoutSignIn] = useState(false);

  // Delivery Checkout Form & Nearest-Branch Geo-Routing State
  const [customerName, setCustomerName] = useState(() => customerProfile?.name || '');
  const [customerPhone, setCustomerPhone] = useState(() => customerProfile?.phone || '');
  const [deliveryZone, setDeliveryZone] = useState(DELIVERY_ZONES[0]);
  const [deliveryStreetAndHouse, setDeliveryStreetAndHouse] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [checkoutBanner, setCheckoutBanner] = useState<string | null>(null);
  const [storefrontFeedback, setStorefrontFeedback] = useState<CenterScreenFeedbackData | null>(null);

  // Trigger animated tick logo for success banners and animated error logo for error states, then fade off instantly thereafter
  useEffect(() => {
    if (checkoutBanner) {
      const isErr = /no valid|error|failed|unable|invalid|rejected|unpaid/i.test(checkoutBanner);
      setStorefrontFeedback({
        type: isErr ? 'ERROR' : 'SUCCESS',
        title: isErr ? 'Action Required' : 'Success',
        message: checkoutBanner,
        durationMs: 520
      });
      const bannerFadeTimer = setTimeout(() => {
        setCheckoutBanner(null);
      }, 720);
      return () => clearTimeout(bannerFadeTimer);
    }
  }, [checkoutBanner]);

  useEffect(() => {
    if (gmailLoginError) {
      setStorefrontFeedback({
        type: 'ERROR',
        title: 'Sign-In Error',
        message: gmailLoginError,
        durationMs: 550
      });
      const errFadeTimer = setTimeout(() => {
        setGmailLoginError(null);
      }, 850);
      return () => clearTimeout(errFadeTimer);
    }
  }, [gmailLoginError]);

  // Sync Firebase Auth state with Client Storefront Gmail Customer Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      if (firebaseUser && firebaseUser.email) {
        setCustomerProfile(prev => {
          const updated: StorefrontCustomerProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || prev?.name || firebaseUser.email!.split('@')[0],
            email: firebaseUser.email!,
            photoURL: firebaseUser.photoURL || prev?.photoURL,
            phone: prev?.phone || ''
          };
          try {
            window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore storage error
          }
          return updated;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Keep checkout name & phone pre-populated from authenticated Gmail profile
  useEffect(() => {
    if (customerProfile) {
      if (!customerName.trim() && customerProfile.name) {
        setCustomerName(customerProfile.name);
      }
      if (!customerPhone.trim() && customerProfile.phone) {
        setCustomerPhone(customerProfile.phone);
      }
      setGmailLoginNameInput(customerProfile.name);
      setGmailLoginEmailInput(customerProfile.email);
      if (customerProfile.phone) {
        setGmailLoginPhoneInput(customerProfile.phone);
      }
    }
  }, [customerProfile]);

  const handleCustomerGmailSignIn = async (usePopup = true, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGmailLoginError(null);
    setIsSigningInWithGmail(true);

    let resolvedProfile: StorefrontCustomerProfile | null = null;

    if (usePopup) {
      try {
        const cred = await signInWithGooglePopup();
        if (cred.user?.email) {
          resolvedProfile = {
            uid: cred.user.uid,
            name: cred.user.displayName || gmailLoginNameInput.trim() || cred.user.email.split('@')[0],
            email: cred.user.email,
            photoURL: cred.user.photoURL || undefined,
            phone: gmailLoginPhoneInput.trim() || customerPhone.trim() || undefined
          };
        }
      } catch (err: unknown) {
        // If popup is blocked or closed inside preview iframe, fall back to entered Gmail identity if provided
        if (!gmailLoginEmailInput.trim()) {
          setIsSigningInWithGmail(false);
          setIsCustomerLoginModalOpen(true);
          const code = (err as { code?: string })?.code || '';
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            setGmailLoginError('Google Sign-In popup was closed. Click "Continue with Google" again or enter your Gmail address below.');
          } else {
            setGmailLoginError('Google popup could not open in this window. Please enter your Gmail address below to continue immediately.');
          }
          return;
        }
      }
    }

    if (!resolvedProfile) {
      const cleanEmail = gmailLoginEmailInput.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setIsSigningInWithGmail(false);
        setGmailLoginError('Please enter a valid Gmail address (e.g. yourname@gmail.com).');
        return;
      }
      const cleanName =
        gmailLoginNameInput.trim() ||
        cleanEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      resolvedProfile = {
        uid: auth.currentUser?.uid || `gmail-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        photoURL: auth.currentUser?.photoURL || undefined,
        phone: gmailLoginPhoneInput.trim() || customerPhone.trim() || undefined
      };
    }

    setCustomerProfile(resolvedProfile);
    setCustomerName(resolvedProfile.name);
    if (resolvedProfile.phone) {
      setCustomerPhone(resolvedProfile.phone);
    }
    try {
      window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(resolvedProfile));
    } catch {
      // ignore storage error
    }
    setIsSigningInWithGmail(false);
    setIsCustomerLoginModalOpen(false);
    setCheckoutError(null);
    if (isPendingCheckoutSignIn) {
      setIsPendingCheckoutSignIn(false);
      setCheckoutBanner(
        `Signed in as ${resolvedProfile.name} (${resolvedProfile.email})! Your cart is ready — click Checkout to complete your order.`
      );
    } else {
      setCheckoutBanner(`Signed in with Gmail as ${resolvedProfile.name} (${resolvedProfile.email})`);
    }
    setTimeout(() => setCheckoutBanner(null), 4500);
  };

  const handleCustomerGmailSignOut = async () => {
    const emailToRemove = customerProfile?.email || customerProfile?.uid || '';
    if (emailToRemove) {
      removeLiveCustomerSession(emailToRemove);
    }
    try {
      await signOut(auth);
    } catch {
      // ignore signOut error
    }
    setCustomerProfile(null);
    try {
      window.localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {
      // ignore storage error
    }
    setIsCustomerLoginModalOpen(false);
    setCheckoutBanner('Signed out of your Gmail customer account.');
    setTimeout(() => setCheckoutBanner(null), 3500);
  };

  // Nearest-Branch Geo-Routing (Real GPS + OpenStreetMap Reverse Geocoding + Real Place Search)
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [realResolvedLocation, setRealResolvedLocation] = useState<RealResolvedLocation | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<RealResolvedLocation[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPlaceSearchDropdown, setShowPlaceSearchDropdown] = useState(false);
  const [selectedBranchOverrideId, setSelectedBranchOverrideId] = useState<string | null>(null);
  const [onlyInStockAtNearestBranch, setOnlyInStockAtNearestBranch] = useState<boolean>(false);

  const applyRealLocationSelection = (resolved: RealResolvedLocation, announce = true) => {
    setRealResolvedLocation(resolved);
    setCustomerCoords({ lat: resolved.latitude, lng: resolved.longitude });
    setDeliveryZone(`${resolved.areaOrSuburb} (${resolved.cityOrTown})`);
    setDeliveryStreetAndHouse(resolved.streetOrBuilding);
    setPlaceSearchQuery(resolved.displayName);
    setShowPlaceSearchDropdown(false);
    setSelectedBranchOverrideId(null);
    if (announce) {
      setCheckoutBanner(
        `Real Location Verified: ${resolved.streetOrBuilding}, ${resolved.areaOrSuburb} (${resolved.latitude.toFixed(5)}, ${resolved.longitude.toFixed(5)})`
      );
      setTimeout(() => setCheckoutBanner(null), 4500);
    }
  };

  // Auto-detect real location on initial storefront load
  useEffect(() => {
    let mounted = true;
    setIsLocatingGps(true);
    detectUserRealWorldLocation()
      .then(resolved => {
        if (!mounted) return;
        applyRealLocationSelection(resolved, false);
        setIsLocatingGps(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsLocatingGps(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced live OpenStreetMap Nominatim real-place search
  useEffect(() => {
    const q = placeSearchQuery.trim();
    if (!showPlaceSearchDropdown || q.length < 2) {
      setPlaceSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      const results = await searchRealPlaces(q, 'ke');
      setPlaceSearchResults(results);
      setIsSearchingPlaces(false);
    }, 320);
    return () => clearTimeout(timer);
  }, [placeSearchQuery, showPlaceSearchDropdown]);

  // Rank all customer-facing branches from #1 Nearest to Farthest
  const rankedNearestBranches = useMemo(() => {
    return rankBranchesForCustomer({
      branches,
      inventoryItems,
      customerCoords,
      selectedDeliveryZone: deliveryZone,
      manualBranchId: selectedBranchOverrideId
    });
  }, [branches, inventoryItems, customerCoords, deliveryZone, selectedBranchOverrideId]);

  const selectedNearestBranchInfo = useMemo(() => {
    if (selectedBranchOverrideId) {
      const manualMatch = rankedNearestBranches.find(
        rb => rb.branch.id === selectedBranchOverrideId
      );
      if (manualMatch) return manualMatch;
    }
    return rankedNearestBranches[0] || null;
  }, [rankedNearestBranches, selectedBranchOverrideId]);

  const selectedFulfillingBranch = selectedNearestBranchInfo?.branch || activeBranch;

  const handleLocateNearestBranchViaGps = async () => {
    setIsLocatingGps(true);
    try {
      const resolved = await detectUserRealWorldLocation();
      applyRealLocationSelection(resolved, true);
    } catch (err) {
      setCheckoutBanner(
        err instanceof Error
          ? err.message
          : 'Could not detect real GPS location. Please search your street or building name.'
      );
      setTimeout(() => setCheckoutBanner(null), 4000);
    } finally {
      setIsLocatingGps(false);
    }
  };

  // Live ERP Inventory stock lookup scoped to the customer's Nearest Fulfilling Branch (falling back to platform-wide stock when not restricted)
  const getProductStock = (productId: string, branchIdOverride?: string): number => {
    const targetBranchId = branchIdOverride || selectedFulfillingBranch.id;
    const branchInv = inventoryItems.find(
      i => i.productId === productId && i.branchId === targetBranchId
    );
    if (branchInv && branchInv.bottlesOnHand > 0) {
      return branchInv.bottlesOnHand;
    }
    if (onlyInStockAtNearestBranch) {
      return branchInv ? Math.max(0, branchInv.bottlesOnHand) : 0;
    }
    const anyBranchInv = inventoryItems.filter(i => i.productId === productId);
    if (anyBranchInv.length > 0) {
      return Math.max(0, anyBranchInv.reduce((sum, item) => Math.max(sum, item.bottlesOnHand), 0));
    }
    return 0;
  };

  // Independent Website Cart State (Completely separate from ERP POS Cart; persisted so guests can add to cart before signing in)
  const [webCart, setWebCart] = useState<StorefrontCartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(WEB_CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            item => item && item.product && typeof item.product.id === 'string' && typeof item.quantity === 'number' && item.quantity > 0
          );
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WEB_CART_STORAGE_KEY, JSON.stringify(webCart));
    } catch {
      // ignore storage errors
    }
  }, [webCart]);

  // Keep webCart and selectedProductDetail synchronized with live unified ERP products
  useEffect(() => {
    if (products.length === 0) return;
    const prodMap = new Map(products.map(p => [p.id, p]));
    setWebCart(prev => {
      let changed = false;
      const next = prev.map(item => {
        const latest = prodMap.get(item.product.id);
        if (
          latest &&
          (latest.retailPriceKes !== item.product.retailPriceKes ||
            latest.name !== item.product.name ||
            latest.barcode !== item.product.barcode ||
            latest.image !== item.product.image)
        ) {
          changed = true;
          return { ...item, product: latest };
        }
        return item;
      });
      return changed ? next : prev;
    });
    setSelectedProductDetail(prev => (prev ? prodMap.get(prev.id) || prev : null));
  }, [products]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isRightCartHighlighted, setIsRightCartHighlighted] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [activeOrderItemsDocument, setActiveOrderItemsDocument] = useState<OrderItemsDocumentPayload | null>(null);

  // Storefront Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [isMerchantSeoModalOpen, setIsMerchantSeoModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isPlatformFullscreen());
  // Automatic 20-second catalog reshuffle tick with live countdown
  const {
    tick: storefrontShuffleTick,
    secondsLeft: storefrontSecondsLeft,
    reshuffleNow: reshuffleStorefrontNow
  } = useAutoReshuffleTimer(20000);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(isPlatformFullscreen());
    };
    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    window.addEventListener('vaairo:fullscreen-change', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      window.removeEventListener('vaairo:fullscreen-change', syncFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (isPlatformFullscreen()) {
      await exitPlatformFullscreen();
      setIsFullscreen(false);
    } else {
      await requestPlatformFullscreen(true);
      setIsFullscreen(isPlatformFullscreen());
    }
  };
  const [isCategoriesMenuOpen, setIsCategoriesMenuOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [deviceRaterKey] = useState<string>(() => {
    if (typeof window === 'undefined') return 'guest-device';
    try {
      const existing = window.localStorage.getItem('vaairo_customer_rater_id_v1');
      if (existing && existing.trim()) return existing.trim();
      const generated = `voter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      window.localStorage.setItem('vaairo_customer_rater_id_v1', generated);
      // Remove any legacy local rating cache key
      window.localStorage.removeItem('vaairo_product_user_ratings_v1');
      return generated;
    } catch {
      return 'guest-device';
    }
  });
  const [reviewCommentDraft, setReviewCommentDraft] = useState('');
  const [ratingSavedNotice, setRatingSavedNotice] = useState<string | null>(null);
  const detailModalScrollRef = useRef<HTMLDivElement | null>(null);

  const activeRaterKey = (
    customerProfile?.email?.trim().toLowerCase() ||
    customerProfile?.uid ||
    deviceRaterKey
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '_');

  const activeRaterName =
    customerProfile?.name?.trim() ||
    customerName.trim() ||
    (customerProfile?.email ? customerProfile.email.split('@')[0] : 'Customer');

  const hasCustomerPurchasedProduct = (productId: string): boolean => {
    const emailNorm = customerProfile?.email?.trim().toLowerCase();
    const phoneNorm = (customerProfile?.phone || customerPhone).replace(/\D/g, '').slice(-9);
    return websiteDeliveryOrders.some(ord => {
      const matchEmail = emailNorm && ord.customerEmail?.trim().toLowerCase() === emailNorm;
      const matchPhone =
        phoneNorm.length >= 9 && ord.customerPhone.replace(/\D/g, '').slice(-9) === phoneNorm;
      if (!matchEmail && !matchPhone) return false;
      return ord.items.some(item => item.product.id === productId);
    });
  };

  // 100% Genuine Product Rating calculation — zero synthetic/pre-populated numbers
  const getProductRatingInfo = (product: Product) => {
    const records = productRatings.filter(
      r => r.productId === product.id && Number(r.stars) >= 1 && Number(r.stars) <= 5
    );
    const count = records.length;
    const sum = records.reduce((acc, r) => acc + Number(r.stars || 0), 0);
    const rating = count > 0 ? Number((sum / count).toFixed(1)) : 0;
    const myRecord = records.find(
      r => r.raterKey === activeRaterKey || r.raterKey === deviceRaterKey
    );
    return {
      rating,
      count,
      userScore: myRecord ? myRecord.stars : null,
      userComment: myRecord?.comment || '',
      records
    };
  };

  // Genuine Brand Rating aggregated strictly from real customer ratings of that brand's drinks
  const getBrandRatingInfo = (brandName: string) => {
    const normBrand = (brandName || '').trim().toLowerCase();
    const brandProductIds = new Set(
      products
        .filter(p => (p.brand || '').trim().toLowerCase() === normBrand)
        .map(p => p.id)
    );
    const records = productRatings.filter(
      r => brandProductIds.has(r.productId) && Number(r.stars) >= 1 && Number(r.stars) <= 5
    );
    const count = records.length;
    const sum = records.reduce((acc, r) => acc + Number(r.stars || 0), 0);
    const rating = count > 0 ? Number((sum / count).toFixed(1)) : 0;
    return { rating, count };
  };

  const handleRateProduct = (productId: string, stars: number, customComment?: string) => {
    const commentToSave =
      customComment !== undefined ? customComment : reviewCommentDraft.trim() || undefined;
    submitProductRating({
      productId,
      raterKey: activeRaterKey,
      raterName: activeRaterName,
      stars,
      comment: commentToSave,
      isVerifiedBuyer: hasCustomerPurchasedProduct(productId)
    });
    setRatingSavedNotice(`Saved your ${stars}★ rating`);
    window.setTimeout(() => setRatingSavedNotice(null), 2800);
  };
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const headerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const headerSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const [isSearchPinnedToHeader, setIsSearchPinnedToHeader] = useState(false);
  const catalogSectionRef = useRef<HTMLElement | null>(null);
  const rightCartPanelRef = useRef<HTMLDivElement | null>(null);
  const topCategoryScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollTopCategoryRow = (direction: 'left' | 'right') => {
    if (!topCategoryScrollRef.current) return;
    topCategoryScrollRef.current.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth'
    });
  };

  // Pin search bar onto the sticky header bar ONLY on desktop (md+ >= 768px); never on mobile scroll
  useEffect(() => {
    let rafId: number | null = null;
    const handleScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const isDesktop = window.innerWidth >= 768;
        if (!isDesktop) {
          setIsSearchPinnedToHeader(false);
          return;
        }
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        setIsSearchPinnedToHeader(prev => {
          if (!prev && y > 115) return true;
          if (prev && y < 65) return false;
          return prev;
        });
      });
    };
    handleScrollOrResize();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleFocusOrOpenWebsiteCart = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && rightCartPanelRef.current) {
      rightCartPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setIsRightCartHighlighted(true);
      setTimeout(() => setIsRightCartHighlighted(false), 1800);
    } else {
      setIsCartDrawerOpen(true);
    }
  };

  // Close auto-show search dropdown when clicking outside both main and pinned header search containers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMain =
        searchContainerRef.current && searchContainerRef.current.contains(target);
      const insideHeader =
        headerSearchContainerRef.current && headerSearchContainerRef.current.contains(target);
      if (!insideMain && !insideHeader) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const siteOrigin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('run.app')
      ? window.location.origin
      : 'https://liqour.urbantechdev.com';

  // Deep-link support for canonical product URLs (?product=SKU)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const skuParam = params.get('product') || params.get('sku');
    if (skuParam) {
      const matched = products.find(p => p.sku.toLowerCase() === skuParam.trim().toLowerCase());
      if (matched) {
        setSelectedProductDetail(matched);
      }
    }
  }, [products]);

  // Step 1: Dynamically inject strictly aligned JSON-LD Product / Catalog Schema into <head>
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let scriptEl = document.getElementById('vaairo-seo-jsonld') as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'vaairo-seo-jsonld';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }

    if (selectedProductDetail) {
      const stock = getProductStock(selectedProductDetail.id);
      const rawImg = selectedProductDetail.image || getProductImageUrl(selectedProductDetail);
      const highResImg = resolveHighResProductImageUrl(selectedProductDetail, siteOrigin, rawImg);
      const productSchema = buildProductJsonLdSchema(
        selectedProductDetail,
        stock,
        siteOrigin,
        highResImg
      );
      scriptEl.textContent = JSON.stringify(productSchema);

      const pageTitle = `${selectedProductDetail.name} — KES ${selectedProductDetail.retailPriceKes.toLocaleString()} | VAAIRO LIQUOR HUB`;
      const pageDesc = buildCleanProductDescription(selectedProductDetail);
      document.title = pageTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', pageDesc);
    } else {
      const catalogSchema = buildStorefrontCatalogJsonLd(
        products,
        inventoryItems,
        activeBranch.id,
        siteOrigin,
        prod => prod.image || getProductImageUrl(prod)
      );
      scriptEl.textContent = JSON.stringify(catalogSchema);
      document.title = 'VAAIRO LIQUOR HUB — Direct Company Price Alcohol & Drinks Delivery';
    }
  }, [selectedProductDetail, products, inventoryItems, activeBranch.id, siteOrigin]);

  // Production Safaricom Daraja STK Push & Verification State (for On-Hold Delivery Orders)
  const [promptPhones, setPromptPhones] = useState<Record<string, string>>({});
  const [activeStkPromptOrder, setActiveStkPromptOrder] = useState<WebsiteDeliveryOrder | null>(null);
  const [stkPromptPhone, setStkPromptPhone] = useState('');
  const [stkReceiptInput, setStkReceiptInput] = useState('');
  const [activeStkCheckoutRequestId, setActiveStkCheckoutRequestId] = useState<string | null>(null);
  const [stkGatewayStatusMessage, setStkGatewayStatusMessage] = useState<string | null>(null);
  const [stkGatewayError, setStkGatewayError] = useState<string | null>(null);
  const [isStkModalFadingOut, setIsStkModalFadingOut] = useState(false);
  const [isProcessingStk, setIsProcessingStk] = useState(false);
  const [completedReceiptModal, setCompletedReceiptModal] = useState<{
    invoice: ETimsInvoice;
    order: SaleOrder;
  } | null>(null);

  // Categorization helper
  const matchesDrinkCategory = (prod: Product, catId: string): boolean => {
    if (catId === 'ALL') return true;
    const text = `${prod.name} ${prod.brand} ${prod.subCategory || ''}`.toLowerCase();
    switch (catId) {
      case 'WHISKY':
        return (
          prod.subCategory === 'Whisky' ||
          text.includes('whisk') ||
          text.includes('scotch') ||
          text.includes('malt') ||
          text.includes('bourbon') ||
          text.includes('walker') ||
          text.includes('ballantine') ||
          text.includes('vat 69') ||
          text.includes('black & white') ||
          text.includes('chivas') ||
          text.includes('royal salute') ||
          text.includes('famous grouse') ||
          text.includes('grant') ||
          text.includes('bond 7') ||
          text.includes('best whisky') ||
          text.includes('jameson') ||
          text.includes('bushmills') ||
          text.includes('jack daniel') ||
          text.includes('jim beam') ||
          text.includes('maker') ||
          text.includes('bulleit') ||
          text.includes('glenfiddich') ||
          text.includes('glenlivet') ||
          text.includes('singleton') ||
          text.includes('glenmorangie') ||
          text.includes('macallan') ||
          text.includes('monkey shoulder')
        );
      case 'COGNAC':
        return (
          prod.subCategory === 'Cognac & Brandy' ||
          text.includes('cognac') ||
          text.includes('brandy') ||
          text.includes('hennessy') ||
          text.includes('martell') ||
          text.includes('remy') ||
          text.includes('rémy') ||
          text.includes('courvoisier') ||
          text.includes('richot') ||
          text.includes('viceroy') ||
          text.includes('three barrels') ||
          text.includes('bardinet') ||
          text.includes('beehive') ||
          text.includes('napoleon') ||
          text.includes('don montego') ||
          text.includes('metaxa') ||
          text.includes('torres') ||
          text.includes('dusse') ||
          text.includes("d'ussé") ||
          text.includes('camus') ||
          text.includes('bisquit') ||
          text.includes('meukow')
        );
      case 'GIN':
        return (
          prod.subCategory === 'Gin' ||
          text.includes('gin') ||
          text.includes('gilbey') ||
          text.includes('gordon') ||
          text.includes('bustani') ||
          text.includes('safari') ||
          text.includes('tanqueray') ||
          text.includes('bombay') ||
          text.includes('beefeater') ||
          text.includes('bulldog') ||
          text.includes('new amsterdam') ||
          text.includes('hendrick') ||
          text.includes('roku') ||
          text.includes('malfy') ||
          text.includes('whitley neill') ||
          text.includes('botanist') ||
          text.includes('opihr')
        );
      case 'VODKA':
        return (
          prod.subCategory === 'Vodka' ||
          text.includes('vodka') ||
          text.includes('kibao') ||
          text.includes('triple ace') ||
          text.includes('smirnoff') ||
          text.includes('flirt') ||
          text.includes('skyy') ||
          text.includes('magic moments') ||
          text.includes('ciroc') ||
          text.includes('cîroc') ||
          text.includes('absolut') ||
          text.includes('stolichnaya') ||
          text.includes('stoli') ||
          text.includes('russian standard') ||
          text.includes('ketel') ||
          text.includes('tito') ||
          text.includes('belvedere') ||
          text.includes('grey goose') ||
          text.includes('beluga')
        );
      case 'WINE':
        return (
          prod.subCategory === 'Champagne & Wine' ||
          text.includes('wine') ||
          text.includes('champagne') ||
          text.includes('prosecco') ||
          text.includes('sparkling') ||
          text.includes('moet') ||
          text.includes('moët') ||
          text.includes('veuve') ||
          text.includes('belaire') ||
          text.includes('mumm') ||
          text.includes('piper-heidsieck') ||
          text.includes('laurent-perrier') ||
          text.includes('taittinger') ||
          text.includes('perrier-jouet') ||
          text.includes('perrier-jouët') ||
          text.includes('bollinger') ||
          text.includes('ruinart') ||
          text.includes('dom perignon') ||
          text.includes('dom pérignon') ||
          text.includes('armand de brignac') ||
          text.includes('ace of spades') ||
          text.includes('cristal') ||
          text.includes('krug') ||
          text.includes('muscador') ||
          text.includes('zonin') ||
          text.includes('teresa rizzi') ||
          text.includes('leleshwa') ||
          text.includes('4th street') ||
          text.includes('6th street') ||
          text.includes('four cousins') ||
          text.includes('cellar') ||
          text.includes('drostdy') ||
          text.includes('overmeer') ||
          text.includes('namaqua') ||
          text.includes('nederburg') ||
          text.includes('tall horse') ||
          (text.includes('kwv') && prod.subCategory !== 'Cognac & Brandy') ||
          text.includes('frontera') ||
          text.includes('gato negro') ||
          text.includes('casillero') ||
          text.includes('alamos') ||
          text.includes('trapiche') ||
          text.includes('asconi') ||
          (text.includes('chenet') && prod.subCategory !== 'Cognac & Brandy') ||
          text.includes('carlo rossi') ||
          text.includes('lambrusco') ||
          text.includes('fragolino') ||
          text.includes('mouton cadet') ||
          text.includes('robertson') ||
          text.includes('belair') ||
          text.includes('rose') ||
          text.includes('rosé') ||
          text.includes('cabernet') ||
          text.includes('merlot') ||
          text.includes('shiraz') ||
          text.includes('malbec') ||
          text.includes('sauvignon') ||
          text.includes('chardonnay')
        );
      case 'TEQUILA':
        return (
          prod.subCategory === 'Tequila' ||
          text.includes('tequila') ||
          text.includes('mezcal') ||
          text.includes('cuervo') ||
          text.includes('olmeca') ||
          text.includes('camino real') ||
          text.includes('sierra') ||
          text.includes('don julio') ||
          text.includes('patron') ||
          text.includes('patrón') ||
          text.includes('casamigos') ||
          text.includes('1800') ||
          text.includes('clase azul') ||
          text.includes('espolon') ||
          text.includes('espolòn')
        );
      case 'WHITE_RUM':
        return (
          prod.subCategory === 'White Rum' ||
          prod.sku.toUpperCase().includes('-RUM-WHT-') ||
          text.includes('carta blanca') ||
          text.includes('white rum') ||
          text.includes('white spiced') ||
          text.includes('3 years cuban white')
        );
      case 'SPICED_DARK_RUM':
        return (
          prod.subCategory === 'Spiced & Dark Rum' ||
          prod.sku.toUpperCase().includes('-RUM-SPC-') ||
          prod.sku.toUpperCase().includes('-RUM-GLD-') ||
          prod.sku.toUpperCase().includes('-RUM-DRK-') ||
          prod.sku.toUpperCase().includes('-RUM-AGD-') ||
          text.includes('sailor jerry') ||
          text.includes('malibu black') ||
          text.includes('carta oro') ||
          text.includes('anejo especial') ||
          text.includes('añejo especial') ||
          text.includes('old monk') ||
          text.includes('myers') ||
          text.includes("lamb's") ||
          text.includes('kraken') ||
          text.includes('appleton estate') ||
          text.includes('ron zacapa') ||
          text.includes('diplomático') ||
          text.includes('diplomatico') ||
          text.includes('bumbu')
        );
      case 'CREAM_LIQUEUR':
        return (
          prod.subCategory === 'Cream Liqueur' ||
          prod.isCreamBased === true ||
          text.includes('baileys') ||
          (text.includes('amarula') && !text.includes('amarula gold')) ||
          text.includes('sheridan') ||
          text.includes('tequila rose') ||
          text.includes('strawberry lips') ||
          text.includes('best marula') ||
          text.includes('cream liqueur')
        );
      case 'LIQUEUR':
        return (
          prod.subCategory === 'Liqueur & Cream' ||
          prod.subCategory === 'Cream Liqueur' ||
          text.includes('liqueur') ||
          text.includes('baileys') ||
          text.includes('amarula') ||
          text.includes('sheridan') ||
          text.includes('tequila rose') ||
          text.includes('strawberry lips') ||
          text.includes('best marula') ||
          text.includes('jagermeister') ||
          text.includes('jägermeister') ||
          text.includes('kahlúa') ||
          text.includes('kahlua') ||
          text.includes('fireball') ||
          text.includes('tia maria') ||
          text.includes('frangelico') ||
          text.includes('cointreau') ||
          text.includes('grand marnier') ||
          text.includes('campari') ||
          text.includes('aperol') ||
          text.includes('archers') ||
          text.includes('schnapps') ||
          text.includes('disaronno') ||
          text.includes('amaretto') ||
          text.includes('butlers') ||
          text.includes('triple sec') ||
          text.includes('curacao') ||
          text.includes('curaçao') ||
          text.includes('martini bianco') ||
          text.includes('martini rosso') ||
          text.includes('martini extra dry') ||
          text.includes('vermouth') ||
          text.includes('zappa')
        );
      case 'RUM':
        return (
          prod.subCategory === 'Rum' ||
          prod.subCategory === 'White Rum' ||
          prod.subCategory === 'Spiced & Dark Rum' ||
          prod.subCategory === 'Liqueur & Cream' ||
          prod.subCategory === 'Cream Liqueur' ||
          text.includes('rum') ||
          text.includes('bacardi') ||
          text.includes('captain morgan') ||
          text.includes('sailor jerry') ||
          text.includes('malibu') ||
          text.includes('havana club') ||
          text.includes('old nick') ||
          text.includes('old monk') ||
          text.includes('myers') ||
          text.includes("lamb's") ||
          text.includes('kraken') ||
          text.includes('appleton') ||
          text.includes('zacapa') ||
          text.includes('diplomático') ||
          text.includes('bumbu') ||
          text.includes('baileys') ||
          text.includes('jagermeister') ||
          text.includes('jägermeister') ||
          text.includes('amarula') ||
          text.includes('sheridan') ||
          text.includes('kahlúa') ||
          text.includes('kahlua') ||
          text.includes('fireball') ||
          text.includes('cointreau') ||
          text.includes('grand marnier') ||
          text.includes('campari') ||
          text.includes('aperol') ||
          text.includes('disaronno') ||
          text.includes('butlers') ||
          text.includes('vermouth') ||
          text.includes('liqueur')
        );
      case 'BEER':
        return (
          prod.subCategory === 'Beer & Cider' ||
          text.includes('beer') ||
          text.includes('lager') ||
          text.includes('stout') ||
          text.includes('tusker') ||
          text.includes('guinness') ||
          text.includes('heineken') ||
          text.includes('whitecap') ||
          text.includes('white cap') ||
          text.includes('balozi') ||
          text.includes('pilsner') ||
          text.includes('allsopps') ||
          text.includes('summit') ||
          text.includes('manyatta') ||
          text.includes('sikera') ||
          text.includes('senator') ||
          text.includes('bila shaka') ||
          text.includes('254 brewing') ||
          text.includes('kenyan originals') ||
          text.includes('desperados') ||
          text.includes('tonic') ||
          text.includes('savanna') ||
          text.includes('snapp') ||
          text.includes('cider')
        );
      default:
        return true;
    }
  };

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(p => {
      const brandName = (p.brand || '').trim();
      if (brandName) {
        counts.set(brandName, (counts.get(brandName) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const matched = products.filter(p => {
      if (tokens.length > 0) {
        const searchableText = `${p.name} ${p.brand} ${p.sku} ${p.subCategory || ''} ${p.category || ''} ${p.volumeMl || 750}ml`.toLowerCase();
        const allTokensMatch = tokens.every(token => searchableText.includes(token));
        if (!allTokensMatch) return false;
      } else if (!matchesDrinkCategory(p, activeCategory)) {
        return false;
      }

      // If user also explicitly selected a category and is searching, still prioritize matches across catalog
      if (tokens.length === 0 && !matchesDrinkCategory(p, activeCategory)) {
        return false;
      }

      if (onlyInStockAtNearestBranch) {
        return getProductStock(p.id, selectedFulfillingBranch.id) > 0;
      }
      return true;
    });

    // If user is searching specific tokens, rank matches by exact prefix and scatter any grouped items
    if (tokens.length > 0) {
      const sortedMatches = [...matched].sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) || a.brand.toLowerCase().startsWith(q) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(q) || b.brand.toLowerCase().startsWith(q) ? 1 : 0;
        return bStarts - aStarts;
      });
      return scatterAndReshuffleProducts(sortedMatches, storefrontShuffleTick);
    }

    // Browsing catalog: scatter drinks so products of the same brand are not clumped together,
    // and reshuffle them dynamically every 20 seconds!
    const inStock = matched.filter(p => getProductStock(p.id, selectedFulfillingBranch.id) > 0);
    const outOfStock = matched.filter(p => getProductStock(p.id, selectedFulfillingBranch.id) <= 0);

    const scatteredInStock = scatterAndReshuffleProducts(inStock, storefrontShuffleTick);
    const scatteredOutOfStock = scatterAndReshuffleProducts(outOfStock, storefrontShuffleTick);

    return [...scatteredInStock, ...scatteredOutOfStock];
  }, [
    products,
    searchQuery,
    activeCategory,
    onlyInStockAtNearestBranch,
    selectedFulfillingBranch.id,
    inventoryItems,
    scanHistory,
    storefrontShuffleTick
  ]);

  // Cart Helpers — Strictly Company Price & Enforced Against Live ERP Inventory Stock
  const addToWebCart = (product: Product, qty: number = 1) => {
    const availableStock = getProductStock(product.id);
    if (availableStock <= 0) return;

    setWebCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const cappedQty = Math.min(availableStock, existing.quantity + qty);
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: cappedQty } : item
        );
      }
      const initialQty = Math.min(availableStock, qty);
      return [...prev, { product, quantity: initialQty }];
    });
    setCheckoutBanner(`Added ${qty}x ${product.name} at Direct Company Price (${formatKes(product.retailPriceKes)})`);
    setTimeout(() => setCheckoutBanner(null), 3500);
  };

  const updateWebCartQty = (productId: string, newQty: number) => {
    const availableStock = getProductStock(productId);
    if (newQty <= 0 || availableStock <= 0) {
      setWebCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    const cappedQty = Math.min(availableStock, newQty);
    setWebCart(prev =>
      prev.map(item => (item.product.id === productId ? { ...item, quantity: cappedQty } : item))
    );
  };

  const removeFromWebCart = (productId: string) => {
    setWebCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const totalCartItems = webCart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartCompanyPriceKes = webCart.reduce(
    (sum, item) => sum + item.product.retailPriceKes * item.quantity,
    0
  );

  // Strictly filter website delivery orders to ONLY the currently logged-in Gmail user's specific orders
  const myWebsiteDeliveryOrders = useMemo(() => {
    if (!customerProfile || !customerProfile.email) return [];
    const loggedEmail = customerProfile.email.trim().toLowerCase();
    return websiteDeliveryOrders.filter(o => {
      if (o.customerEmail && o.customerEmail.trim().toLowerCase() === loggedEmail) {
        return true;
      }
      if (o.deliveryNotes && o.deliveryNotes.toLowerCase().includes(loggedEmail)) {
        return true;
      }
      return false;
    });
  }, [websiteDeliveryOrders, customerProfile]);

  // Active On-Hold Website Orders belonging exclusively to this logged-in user
  const onHoldDeliveryOrders = useMemo(
    () => myWebsiteDeliveryOrders.filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID'),
    [myWebsiteDeliveryOrders]
  );
  const completedWebsiteOrders = useMemo(
    () => myWebsiteDeliveryOrders.filter(o => o.deliveryStatus === 'COMPLETED_AND_PAID'),
    [myWebsiteDeliveryOrders]
  );

  // Broadcast live logged-in customer session (Name, Email, Contact Phone, Carrier & Cart Status) to ERP Admin
  useEffect(() => {
    if (!customerProfile || !customerProfile.email) return;
    const resolvedPhone = sanitizeAndControlKenyanMobileInput(
      customerPhone || customerProfile.phone || gmailLoginPhoneInput || ''
    );
    const carrierInfo = detectKenyanMobileCarrier(resolvedPhone);
    const sessionStatus =
      onHoldDeliveryOrders.length > 0
        ? 'ORDER_PLACED'
        : totalCartItems > 0
        ? 'IN_CHECKOUT'
        : 'ONLINE';

    upsertLiveCustomerSession({
      uid: customerProfile.uid || `cust-${customerProfile.email}`,
      name: customerName.trim() || customerProfile.name || customerProfile.email.split('@')[0],
      email: customerProfile.email,
      phone: resolvedPhone,
      carrier: carrierInfo.carrier,
      photoURL: customerProfile.photoURL,
      deliveryZone,
      deliveryStreetAndHouse,
      branchId: selectedFulfillingBranch.id,
      branchName: selectedFulfillingBranch.name,
      cartItemsCount: totalCartItems,
      cartTotalKes: totalCartCompanyPriceKes,
      activeOrdersCount: onHoldDeliveryOrders.length,
      status: sessionStatus
    });
  }, [
    customerProfile,
    customerName,
    customerPhone,
    gmailLoginPhoneInput,
    deliveryZone,
    deliveryStreetAndHouse,
    selectedFulfillingBranch.id,
    selectedFulfillingBranch.name,
    totalCartItems,
    totalCartCompanyPriceKes,
    onHoldDeliveryOrders.length,
    upsertLiveCustomerSession
  ]);

  // Gate Checkout Behind Sign-In: Users can freely add to cart as guests, but must sign in when checking out
  const handleRequireSignInForCheckout = (promptImmediately: boolean) => {
    setPromptImmediatelyOnCheckout(promptImmediately);
    setIsPendingCheckoutSignIn(true);
    setGmailLoginError(null);
    setCheckoutError(null);
    if (customerName.trim() && !gmailLoginNameInput.trim()) {
      setGmailLoginNameInput(customerName.trim());
    }
    if (customerPhone.trim() && !gmailLoginPhoneInput.trim()) {
      setGmailLoginPhoneInput(customerPhone.trim());
    }
    setIsEditingCustomerProfile(false);
    // Directly invoke Google OAuth popup on user click; if blocked or closed, the modal opens automatically
    void handleCustomerGmailSignIn(true);
  };

  // Step 2: Place Order on Hold Until Delivery is Done (or Immediately Prompt M-Pesa using Checkout Phone Number)
  const handlePlaceDeliveryOrderOnHold = (e?: React.FormEvent, immediatePromptOverride?: boolean) => {
    if (e) e.preventDefault();
    setCheckoutError(null);
    if (webCart.length === 0) return;

    const shouldPromptImmediately =
      immediatePromptOverride !== undefined ? immediatePromptOverride : promptImmediatelyOnCheckout;

    // 1. Enforce Sign-In on Checkout (Guests can add to cart freely, but must sign in when checking out)
    if (!customerProfile || !customerProfile.email) {
      handleRequireSignInForCheckout(shouldPromptImmediately);
      return;
    }

    // 2. Enforce Customer Name
    const resolvedCustomerName = customerName.trim() || customerProfile.name.trim();
    if (!resolvedCustomerName) {
      setCheckoutError('Please enter your full name for delivery.');
      return;
    }

    // 3. Enforce Valid Kenyan M-Pesa Phone Number on Checkout (System uses this exact number when prompting for M-Pesa)
    const rawPhone = customerPhone.trim() || customerProfile.phone?.trim() || '';
    if (!rawPhone || !isValidKenyanMpesaPhone(rawPhone)) {
      setCheckoutError(
        'Please enter a valid M-Pesa phone number (e.g. 07XX XXX XXX or 01XX XXX XXX). The system will use this number to send your M-Pesa payment prompt.'
      );
      return;
    }

    // 4. Enforce Delivery Location Details
    if (!deliveryZone.trim()) {
      setCheckoutError('Please enter or select your delivery area / town.');
      return;
    }
    if (!deliveryStreetAndHouse.trim()) {
      setCheckoutError('Please enter your road, estate, building, or house number for the delivery rider.');
      return;
    }

    const normalizedCheckoutPhone = normalizeKenyanMpesaPhone(rawPhone);

    // Save the verified checkout M-Pesa phone number to the customer's Gmail profile
    const updatedProfile: StorefrontCustomerProfile = {
      ...customerProfile,
      name: customerName.trim() || customerProfile.name,
      phone: normalizedCheckoutPhone
    };
    setCustomerProfile(updatedProfile);
    setCustomerPhone(normalizedCheckoutPhone);
    try {
      window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch {
      // ignore storage error
    }

    const fullLocation = deliveryStreetAndHouse.trim()
      ? `${deliveryZone} — ${deliveryStreetAndHouse.trim()}`
      : deliveryZone;

    const createdOrder = placeWebsiteDeliveryOrder({
      customerName: updatedProfile.name || 'Online Portal Customer',
      customerEmail: updatedProfile.email,
      customerPhone: normalizedCheckoutPhone,
      deliveryLocation: fullLocation,
      deliveryNotes:
        deliveryNotes.trim() ||
        `Gmail Account: ${updatedProfile.email} • Routed to Nearest Branch (${selectedFulfillingBranch.name})`,
      branchId: selectedFulfillingBranch.id,
      customerLatitude: customerCoords?.lat,
      customerLongitude: customerCoords?.lng,
      distanceKm: selectedNearestBranchInfo?.distanceKm,
      estimatedEtaMinutes: selectedNearestBranchInfo?.estimatedEtaMinutes,
      routingModel: selectedNearestBranchInfo?.routingModel || 'SERVICE_ZONE_GEOFENCE',
      items: webCart
    });

    // Lock the checkout M-Pesa phone number for this order's STK push prompt
    setPromptPhones(prev => ({ ...prev, [createdOrder.id]: normalizedCheckoutPhone }));

    const orderHasMultipleItems = isMultiItemOrder(createdOrder.items);
    const generatedItemsDoc = orderHasMultipleItems
      ? buildOrderDocumentFromWebsiteDeliveryOrder(createdOrder)
      : null;

    setWebCart([]);
    setIsCartDrawerOpen(false);

    if (shouldPromptImmediately) {
      setPromptImmediatelyOnCheckout(false);
      updateWebsiteDeliveryOrderStatus(createdOrder.id, 'DELIVERED_AWAITING_PAYMENT');
      setStkPromptPhone(normalizedCheckoutPhone);
      setActiveStkPromptOrder({
        ...createdOrder,
        deliveryStatus: 'DELIVERED_AWAITING_PAYMENT'
      });
      setCheckoutBanner(
        `Order ${createdOrder.orderNumber} placed! Sending M-Pesa STK Push prompt directly to your checkout phone number (${normalizedCheckoutPhone}).${
          orderHasMultipleItems ? ' Ordered Items List Document generated.' : ''
        }`
      );
    } else {
      setIsEditingCustomerProfile(false);
      if (generatedItemsDoc) {
        setActiveOrderItemsDocument(generatedItemsDoc);
      } else {
        setIsCustomerLoginModalOpen(true);
      }
      setCheckoutBanner(
        `Order ${createdOrder.orderNumber} placed by ${updatedProfile.email}!${
          orderHasMultipleItems
            ? ` Official Ordered Items Document (${generatedItemsDoc?.totalUnitsCount} items) generated.`
            : ' Track your specific delivery inside your logged-in Gmail account.'
        }`
      );
    }
  };

  // Helper to smoothly fade off the STK prompt modal immediately after it has shown/dispatched
  const fadeOutAndCloseStkModal = (delayMs = 450) => {
    setTimeout(() => {
      setIsStkModalFadingOut(true);
      setTimeout(() => {
        setActiveStkPromptOrder(null);
        setIsStkModalFadingOut(false);
        setIsProcessingStk(false);
      }, 220);
    }, delayMs);
  };

  // Poll Safaricom Daraja /api/mpesa/query in background after STK Push is dispatched to customer handset
  const startDarajaStkStatusPolling = (
    order: WebsiteDeliveryOrder,
    phoneUsed: string,
    checkoutRequestId: string
  ) => {
    let attempts = 0;
    const maxAttempts = 20; // ~60s polling window
    const pollInterval = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const qRes = await fetch('/api/mpesa/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkoutRequestId,
            orderNumber: order.orderNumber,
            phone: phoneUsed,
            amount: order.totalCompanyPriceKes
          })
        });
        const qData = await qRes.json().catch(() => ({}));
        if (qRes.status === 200 && qData.verified && qData.receiptNumber) {
          clearInterval(pollInterval);
          const completion = await completeWebsiteDeliveryOrderWithMpesaPrompt(
            order.id,
            phoneUsed,
            {
              checkoutRequestId,
              receiptNumber: qData.receiptNumber
            }
          );
          if (completion.success && completion.order && completion.invoice) {
            setCheckoutBanner(
              `Safaricom Daraja Payment Confirmed (${completion.order.mpesaReceiptNumber})! Order ${completion.order.orderNumber} completed at Company Price (${formatKes(completion.order.totalKes)}).`
            );
            setCompletedReceiptModal({
              invoice: completion.invoice,
              order: completion.order
            });
          }
        } else if (qRes.status === 402 && (qData.status === 'CANCELLED' || qData.status === 'FAILED')) {
          clearInterval(pollInterval);
          setCheckoutBanner(
            qData.error || `M-Pesa payment for ${order.orderNumber} was cancelled or declined on handset.`
          );
        }
      } catch {
        // Continue polling until timeout
      }
    }, 3000);
  };

  // Step 3: Trigger Production Safaricom Daraja M-Pesa STK Push Using the Phone Number Entered at Checkout
  const handleInitiateSelfPrompt = (order: WebsiteDeliveryOrder) => {
    const checkoutMpesaPhone = sanitizeAndControlKenyanMobileInput(
      order.customerPhone || promptPhones[order.id] || customerPhone || customerProfile?.phone || ''
    );
    if (!checkoutMpesaPhone || checkoutMpesaPhone.length < 9) {
      setCheckoutBanner('No valid checkout M-Pesa phone number found on this order.');
      return;
    }
    if (order.deliveryStatus !== 'DELIVERED_AWAITING_PAYMENT') {
      updateWebsiteDeliveryOrderStatus(order.id, 'DELIVERED_AWAITING_PAYMENT');
    }
    setStkGatewayError(null);
    setStkGatewayStatusMessage(null);
    setStkReceiptInput('');
    setActiveStkCheckoutRequestId(null);
    setIsStkModalFadingOut(false);
    setStkPromptPhone(checkoutMpesaPhone);
    setActiveStkPromptOrder(order);
  };

  const handleConfirmStkPromptPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStkPromptOrder) return;
    setStkGatewayError(null);
    setStkGatewayStatusMessage(null);
    setIsProcessingStk(true);

    const carrierInfo = detectKenyanMobileCarrier(stkPromptPhone);
    const cleanReceipt = stkReceiptInput.trim().toUpperCase();

    // Path A: Customer entered an existing M-Pesa Confirmation Receipt Code to verify against Daraja ledger
    if (cleanReceipt.length >= 6) {
      const res = await completeWebsiteDeliveryOrderWithMpesaPrompt(
        activeStkPromptOrder.id,
        carrierInfo.normalized254 || stkPromptPhone,
        {
          checkoutRequestId: activeStkCheckoutRequestId || undefined,
          receiptNumber: cleanReceipt
        }
      );
      setIsProcessingStk(false);

      if (res.success && res.order && res.invoice) {
        setStkGatewayStatusMessage(
          `Verified M-Pesa Receipt ${res.order.mpesaReceiptNumber}! Generating 16% VAT Tax Receipt...`
        );
        fadeOutAndCloseStkModal(320);
        setCheckoutBanner(
          `Payment Confirmed (${res.order.mpesaReceiptNumber})! Order ${res.order.orderNumber} completed at Company Price (${formatKes(res.order.totalKes)}).`
        );
        setCompletedReceiptModal({ invoice: res.invoice, order: res.order });
      } else {
        const errMsg =
          res.error || 'Could not verify that M-Pesa receipt code with Safaricom Daraja.';
        setStkGatewayError(errMsg);
        setStorefrontFeedback({
          type: 'ERROR',
          title: 'Verification Failed',
          message: errMsg,
          durationMs: 620
        });
      }
      return;
    }

    // Path B: Dispatch Live Production Safaricom Daraja STK Push via controlled public storefront endpoint (/api/mpesa/storefront-stk-push)
    // First obtain a server-verified checkoutToken (which calculates the authoritative amount from server catalog prices)
    try {
      const targetPhone = carrierInfo.normalized254 || stkPromptPhone;
      const tokenRes = await fetch('/api/mpesa/storefront-checkout-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: activeStkPromptOrder.orderNumber,
          branchId: activeStkPromptOrder.branchId,
          customerPhone: targetPhone,
          items: activeStkPromptOrder.items.map(it => ({
            productId: it.product.id,
            quantity: it.quantity
          }))
        })
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.checkoutToken) {
        setIsProcessingStk(false);
        const errMsg =
          tokenData.error ||
          'Could not issue server-verified checkout token for this order.';
        setStkGatewayError(errMsg);
        setStorefrontFeedback({
          type: 'ERROR',
          title: 'Checkout Token Alert',
          message: errMsg,
          durationMs: 620
        });
        return;
      }

      const stkRes = await fetch('/api/mpesa/storefront-stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutToken: tokenData.checkoutToken,
          phone: targetPhone
        })
      });
      const stkData = await stkRes.json().catch(() => ({}));
      setIsProcessingStk(false);

      if (!stkRes.ok || !stkData.success) {
        const errMsg =
          stkData.error ||
          'Safaricom Daraja STK Push could not be dispatched. Please check your Daraja API configuration or verify via Paybill receipt.';
        setStkGatewayError(errMsg);
        setStorefrontFeedback({
          type: 'ERROR',
          title: 'Daraja Gateway Alert',
          message: errMsg,
          durationMs: 620
        });
        return;
      }

      const checkoutReqId = String(stkData.checkoutRequestId || '');
      setActiveStkCheckoutRequestId(checkoutReqId);
      setStkGatewayStatusMessage(
        stkData.customerMessage ||
          `STK Push dispatched to ${carrierInfo.formattedDisplay || stkPromptPhone}. Enter your M-Pesa PIN on your handset.`
      );
      setStorefrontFeedback({
        type: 'SUCCESS',
        title: 'STK Prompt Sent',
        message: `Check ${carrierInfo.formattedDisplay || stkPromptPhone} to enter M-Pesa PIN`,
        subtext: formatKes(activeStkPromptOrder.totalCompanyPriceKes),
        durationMs: 540
      });

      // Start background polling for handset PIN confirmation and fade off the prompt modal instantly after showing
      if (checkoutReqId) {
        startDarajaStkStatusPolling(
          activeStkPromptOrder,
          carrierInfo.normalized254 || stkPromptPhone,
          checkoutReqId
        );
      }
      fadeOutAndCloseStkModal(480);
    } catch {
      setIsProcessingStk(false);
      const errMsg = 'Network error communicating with Safaricom Daraja STK Push server endpoint.';
      setStkGatewayError(errMsg);
      setStorefrontFeedback({
        type: 'ERROR',
        title: 'Connection Error',
        message: errMsg,
        durationMs: 620
      });
    }
  };

  const renderLiveSearchDropdown = () => {
    if (!isSearchDropdownOpen || searchQuery.trim().length === 0) return null;
    return (
      <div className="mt-2 w-full bg-white rounded-2xl border-2 border-[#0A006E] shadow-[0_20px_50px_rgba(10,0,110,0.28)] overflow-hidden text-left animate-in fade-in slide-in-from-top-1 duration-150 z-[80]">
        <div className="px-4 py-2.5 bg-[#0A006E] text-white flex items-center justify-between gap-2 border-b border-[#FFDE00]">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
            <span className="font-montserrat font-black text-xs truncate">
              {filteredProducts.length > 0
                ? `Found ${filteredProducts.length} Matching Drink${filteredProducts.length === 1 ? '' : 's'} for "${searchQuery.trim()}"`
                : `No Drinks Found Matching "${searchQuery.trim()}"`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsSearchDropdownOpen(false);
                  catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-2.5 py-1 rounded-lg bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] hover:bg-amber-300 transition cursor-pointer"
              >
                View Grid ({filteredProducts.length}) ↓
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSearchDropdownOpen(false)}
              className="text-white/80 hover:text-white p-1 text-xs font-bold cursor-pointer"
              title="Close live results"
            >
              ✕
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Wine className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-montserrat font-bold text-sm text-slate-800">
              No matching drinks found for &ldquo;{searchQuery.trim()}&rdquo;
            </div>
            <p className="text-xs text-slate-500">
              Try searching by brand name (e.g. Jameson, Hennessy, Tanqueray, Tusker) or clear the search filter.
            </p>
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-y-auto divide-y divide-slate-100">
            {filteredProducts.slice(0, 8).map((product, idx) => {
              const inCartItem = webCart.find(i => i.product.id === product.id);
              const imgUrl = product.image || getProductImageUrl(product);
              const stock = getProductStock(product.id);
              const isOutOfStock = stock <= 0;

              return (
                <div
                  key={product.id}
                  className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition ${
                    idx === 0
                      ? 'bg-amber-50/40 hover:bg-amber-50/80'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Clickable Product Thumbnail + Info (Opens Product Detail Preview Modal) */}
                  <div
                    onClick={() => {
                      setSelectedProductDetail(product);
                      setDetailQty(1);
                      setIsSearchDropdownOpen(false);
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 relative">
                      <img
                        src={imgUrl}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform ${
                          isOutOfStock ? 'opacity-50 grayscale' : ''
                        }`}
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-[#0A006E]/90 text-[#FFDE00] text-[8px] font-montserrat font-black uppercase text-center py-0.5">
                          Top Match
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-montserrat font-bold uppercase tracking-wider text-slate-400">
                          {product.brand}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          • {product.volumeMl || 750}ML
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-montserrat font-black uppercase ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-[#1E9E60]'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : `In Stock (${stock})`}
                        </span>
                      </div>

                      <div className="font-montserrat font-black text-xs sm:text-sm text-slate-900 group-hover:text-[#0A006E] truncate mt-0.5">
                        {product.name}
                      </div>

                      {(() => {
                        const ratingInfo = getProductRatingInfo(product);
                        return ratingInfo.count > 0 ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex items-center gap-0.5 text-amber-500">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              <span className="font-mono font-black text-[11px] text-slate-800">
                                {ratingInfo.rating.toFixed(1)}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({ratingInfo.count} rating{ratingInfo.count === 1 ? '' : 's'})
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5 text-slate-400">
                            <Star className="w-3 h-3 text-slate-300" />
                            <span className="text-[10px] font-semibold">No ratings yet</span>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-black text-sm text-[#0A006E]">
                          {formatKes(product.retailPriceKes)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 hidden sm:inline">
                          • Direct Company Price
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Instant Action Buttons: Preview & Add to Cart / Quantity Stepper */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductDetail(product);
                        setDetailQty(1);
                        setIsSearchDropdownOpen(false);
                      }}
                      className="hidden sm:inline-flex px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-[11px] transition cursor-pointer"
                    >
                      Preview
                    </button>

                    {isOutOfStock ? (
                      <span className="px-2.5 py-2 rounded-xl bg-slate-100 text-slate-400 font-montserrat font-bold text-[11px]">
                        Out of Stock
                      </span>
                    ) : inCartItem ? (
                      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => updateWebCartQty(product.id, inCartItem.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-black text-xs text-[#1E9E60] px-1.5">
                          {inCartItem.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={inCartItem.quantity >= stock}
                          onClick={() => updateWebCartQty(product.id, inCartItem.quantity + 1)}
                          className={`w-7 h-7 rounded-lg bg-[#34D186] text-[#FFDE00] flex items-center justify-center font-bold shadow-2xs ${
                            inCartItem.quantity >= stock
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-emerald-950 cursor-pointer'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToWebCart(product, 1)}
                        className="px-3 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-[#FFDE00]" />
                        <span>+ Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-[#F5F6F4] text-slate-900 scroll-smooth">
      {/* =====================================================================
          CLEAN FIXED-HEIGHT STICKY HEADER (Zero Layout Shift on Scroll)
          Left: Brand Identity | Center: Pinned Search on Scroll | Right: Cart & Hamburger Only
          ===================================================================== */}
      <header className="sticky top-0 z-50 bg-[#0A006E] text-white h-16 sm:h-20 flex items-center shadow-lg">
        {/* Moving Silent Scanner Sweep Container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
          <div className="silent-scanner-beam" />
        </div>

        <div ref={headerSearchContainerRef} className="w-full max-w-[92rem] mx-auto px-3 sm:px-6 lg:px-8 relative z-20">
          <div className="flex items-center justify-between gap-2 sm:gap-4 h-full">
            {/* Left: Brand Identity (Compacts to icon on mobile when search is pinned so single row stays aligned) */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 shrink-0">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#FFDE00] flex items-center justify-center text-[#0A006E] shadow-md border-2 border-white shrink-0 group hover:scale-105 transition-transform relative overflow-hidden cursor-pointer"
                onClick={() => {
                  setActiveCategory('ALL');
                  setSearchQuery('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title="VAAIRO Online Drinks Portal — Direct Company Price"
              >
                <div className="silent-scanner-beam-fast" />
                <Wine className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A006E] stroke-[2.4] relative z-10" />
              </div>

              <div className="min-w-0 block">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-montserrat font-black italic text-xl sm:text-3xl tracking-tighter text-white drop-shadow-xs leading-none">
                    VAAIRO
                  </h1>
                  <span
                    className="bg-[#FFDE00] text-[#0A006E] text-[9px] sm:text-xs font-montserrat font-black italic px-2 py-0.5 rounded-full tracking-wider inline-flex items-center gap-1 shadow-xs"
                    title="Direct Online Store — Company Price Guaranteed"
                  >
                    <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#0A006E]" />
                    <span>Delivery</span>
                  </span>
                </div>
                <p className="font-subtitle font-montserrat font-semibold text-[9px] sm:text-xs text-slate-200 tracking-wide mt-0.5 leading-none">
                  Choose it, get it, Drink it
                </p>
              </div>
            </div>

            {/* Center: Single-Row Pinned Search Bar (Strictly Desktop Only on Scroll) */}
            {isSearchPinnedToHeader && (
              <div className="hidden md:block flex-1 max-w-xl mx-3 relative z-50">
                <div className="relative flex items-center bg-white rounded-xl border-2 border-[#FFDE00] focus-within:ring-2 focus-within:ring-[#FFDE00]/60 shadow-md overflow-hidden h-10 sm:h-11">
                  <Search className="w-4 h-4 text-[#0A006E] absolute left-3 pointer-events-none shrink-0" />
                  <input
                    ref={headerSearchInputRef}
                    type="text"
                    value={searchQuery}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) {
                        setIsSearchDropdownOpen(true);
                      }
                    }}
                    onChange={e => {
                      const nextVal = e.target.value;
                      setSearchQuery(nextVal);
                      if (nextVal.trim().length > 0) {
                        setActiveCategory('ALL');
                        setIsSearchDropdownOpen(true);
                      } else {
                        setIsSearchDropdownOpen(false);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredProducts.length === 1) {
                          setSelectedProductDetail(filteredProducts[0]);
                          setDetailQty(1);
                          setIsSearchDropdownOpen(false);
                        } else {
                          setIsSearchDropdownOpen(false);
                          catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      } else if (e.key === 'Escape') {
                        setIsSearchDropdownOpen(false);
                      }
                    }}
                    placeholder="Search drinks, brands, SKU..."
                    className="w-full pl-9 pr-16 sm:pr-22 py-2 bg-transparent text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none text-left"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchDropdownOpen(false);
                        headerSearchInputRef.current?.focus();
                      }}
                      className="absolute right-13 sm:right-18 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (filteredProducts.length === 1) {
                        setSelectedProductDetail(filteredProducts[0]);
                        setDetailQty(1);
                        setIsSearchDropdownOpen(false);
                      } else {
                        setIsSearchDropdownOpen(false);
                        catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="mr-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] sm:text-[11px] transition shrink-0 cursor-pointer"
                  >
                    Search
                  </button>
                </div>

                {/* Live Search Dropdown anchored beneath Pinned Header Search */}
                <div className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-0 top-16 sm:top-full z-[90]">
                  {renderLiveSearchDropdown()}
                </div>
              </div>
            )}

            {/* Right: Track My Order, Cart & Hamburger Menu */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Track My Order Button */}
              <button
                type="button"
                onClick={() => {
                  setIsEditingCustomerProfile(false);
                  setIsCustomerLoginModalOpen(true);
                }}
                className={`h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-xl border flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer relative ${
                  isCustomerLoginModalOpen || isOrdersModalOpen || onHoldDeliveryOrders.length > 0
                    ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                    : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E]'
                }`}
                title="Track My Order"
                aria-label="Track My Order"
              >
                <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A006E] shrink-0" />
                <span className="hidden sm:inline font-montserrat font-black text-xs text-[#0A006E]">
                  Track My Order
                </span>
                {customerProfile && onHoldDeliveryOrders.length > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#1E9E60] text-white text-[10px] font-mono font-black flex items-center justify-center">
                    {onHoldDeliveryOrders.length}
                  </span>
                )}
              </button>

              {/* Shopping Cart Icon Button */}
              <button
                type="button"
                onClick={handleFocusOrOpenWebsiteCart}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition shadow-md cursor-pointer relative ${
                  isCartDrawerOpen || isRightCartHighlighted || totalCartItems > 0
                    ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                    : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E]'
                }`}
                title={`View Delivery Shopping Cart (${totalCartItems} items • ${formatKes(totalCartCompanyPriceKes)} Direct Company Price)`}
                aria-label="Shopping Cart"
              >
                <ShoppingBag className="w-5 h-5 text-[#0A006E]" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0A006E] text-[#FFDE00] border border-white text-[10px] font-mono font-black flex items-center justify-center shadow-xs">
                    {totalCartItems}
                  </span>
                )}
              </button>

              {/* Hamburger Menu Icon Button */}
              <button
                type="button"
                onClick={() => setIsCategoriesMenuOpen(prev => !prev)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition shadow-md cursor-pointer ${
                  isCategoriesMenuOpen
                    ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                    : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                }`}
                title="Open Website Navigation & Categories Menu"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-[#0A006E] stroke-[2.4]" />
              </button>
            </div>
          </div>
        </div>

        {/* Subtle Wave Accent at the bottom edge */}
        <div className="absolute left-0 right-0 -bottom-4 sm:-bottom-6 w-full leading-none pointer-events-none z-10">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-4 sm:h-6 block drop-shadow-[0_4px_8px_rgba(10,0,110,0.15)]"
          >
            <path
              d="M0,-1 L1200,-1 L1200,14 C860,68 340,2 0,44 Z"
              fill="#0A006E"
            />
            <path
              d="M0,44 C340,2 860,68 1200,14"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[92rem] w-full min-w-0 mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 space-y-6">
        <CenterScreenFeedback
          feedback={storefrontFeedback}
          onDismiss={() => setStorefrontFeedback(null)}
        />
        {/* Feedback Toast Banner with Animated Tick / Error Logo */}
        {checkoutBanner && (
          <div className="p-4 rounded-2xl bg-[#34D186] text-white border-2 border-[#FFDE00] shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-montserrat font-bold">
              <AnimatedSuccessTickLogo size="sm" />
              <span>{checkoutBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutBanner(null)}
              className="text-white/80 hover:text-white text-xs font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ===================================================================
            CENTERED SEARCH BAR & CATEGORY FILTERS
            =================================================================== */}
        <section className="py-3 sm:py-6 w-full min-w-0 flex flex-col items-center justify-center text-center space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34D186] border border-emerald-700 text-[#FFDE00] font-montserrat font-semibold text-[11px] sm:text-xs shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFDE00] shrink-0" />
            <span>100% Company Price (No Affiliate Markup)</span>
          </div>

          <div ref={searchContainerRef} className="w-full max-w-2xl mx-auto relative z-40">
            <div className="relative flex items-center bg-white rounded-2xl border-2 border-[#0A006E]/30 focus-within:border-[#0A006E] focus-within:ring-4 focus-within:ring-[#FFDE00]/40 shadow-md transition overflow-hidden">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A006E] absolute left-3.5 sm:left-4 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setIsSearchDropdownOpen(true);
                  }
                }}
                onChange={e => {
                  const nextVal = e.target.value;
                  setSearchQuery(nextVal);
                  if (nextVal.trim().length > 0) {
                    setActiveCategory('ALL');
                    setIsSearchDropdownOpen(true);
                  } else {
                    setIsSearchDropdownOpen(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredProducts.length === 1) {
                      setSelectedProductDetail(filteredProducts[0]);
                      setDetailQty(1);
                      setIsSearchDropdownOpen(false);
                    } else {
                      setIsSearchDropdownOpen(false);
                      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchDropdownOpen(false);
                  }
                }}
                placeholder="Search drinks by name, brand, or SKU..."
                className="w-full pl-10 sm:pl-12 pr-24 sm:pr-28 py-3 sm:py-3.5 bg-transparent text-xs sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none text-left"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchDropdownOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-20 sm:right-24 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (filteredProducts.length === 1) {
                    setSelectedProductDetail(filteredProducts[0]);
                    setDetailQty(1);
                    setIsSearchDropdownOpen(false);
                  } else {
                    setIsSearchDropdownOpen(false);
                    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="mr-1.5 sm:mr-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs transition shrink-0 cursor-pointer"
              >
                Search
              </button>
            </div>

            {/* ===============================================================
                INSTANT AUTO-SHOW PRODUCT RESULTS PANEL AS CUSTOMER TYPES
                =============================================================== */}
            {!isSearchPinnedToHeader && renderLiveSearchDropdown()}
          </div>

          {/* ===============================================================
              SIMPLIFIED NEAREST BRANCH BAR (Aligned on Both Mobile & Desktop)
              =============================================================== */}
          <div
            className={`w-full max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 px-3 py-2 shadow-2xs flex items-center justify-between gap-2 text-left ${
              searchQuery.trim().length > 0 ? 'hidden' : 'flex'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="hidden sm:inline text-xs font-montserrat font-bold text-slate-600 shrink-0">
                Nearest Branch:
              </span>
              <select
                value={selectedBranchOverrideId || 'AUTO_NEAREST'}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedBranchOverrideId(val === 'AUTO_NEAREST' ? null : val);
                }}
                className="flex-1 min-w-0 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-montserrat font-black text-[#0A006E] focus:outline-none focus:border-[#0A006E] cursor-pointer truncate"
                title="Select Fulfilling Branch"
              >
                <option value="AUTO_NEAREST">
                  {selectedFulfillingBranch.name} ({selectedFulfillingBranch.code})
                </option>
                {rankedNearestBranches.map(rb => (
                  <option key={rb.branch.id} value={rb.branch.id}>
                    {rb.branch.name} ({rb.branch.code}) — {rb.distanceKm} km
                  </option>
                ))}
              </select>
              {selectedNearestBranchInfo && (
                <span className="hidden md:inline-block px-2 py-0.5 rounded-lg bg-emerald-50 text-[#1E9E60] font-mono font-bold text-[10px] shrink-0">
                  ~{selectedNearestBranchInfo.estimatedEtaMinutes} mins
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleLocateNearestBranchViaGps}
              disabled={isLocatingGps}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] sm:text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Auto-detect nearest branch using GPS"
            >
              <LocateFixed className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>
                {isLocatingGps ? 'Locating...' : customerCoords ? 'GPS Active' : 'Use GPS'}
              </span>
            </button>
          </div>

          {/* Wide Single-Row Category Filter Menu: Pinned "All Drinks" + Left Arrow + Scrollable Categories + Right Arrow */}
          <div className="w-full max-w-7xl mx-auto flex items-center gap-1.5 pb-1">
            {/* Pinned "All Drinks" Button (Never Moves on Scroll) */}
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3.5 py-2 rounded-xl font-montserrat font-bold text-xs whitespace-nowrap shrink-0 transition cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {DRINK_CATEGORIES.find(c => c.id === 'ALL')?.label || 'All Drinks'}
            </button>

            {/* Silent Left Scroll Arrow (Desktop — Comes Right After "All Drinks") */}
            <button
              type="button"
              onClick={() => scrollTopCategoryRow('left')}
              aria-label="Scroll categories left"
              title="Scroll categories left"
              className="hidden md:flex w-7 h-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#0A006E] hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={topCategoryScrollRef}
              className="flex-1 min-w-0 overflow-x-auto scrollbar-none scroll-smooth"
            >
              <div className="flex flex-nowrap items-center gap-2 px-1 w-max">
                {DRINK_CATEGORIES.filter(cat => cat.id !== 'ALL').map(cat => {
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3.5 py-2 rounded-xl font-montserrat font-bold text-xs whitespace-nowrap shrink-0 transition cursor-pointer ${
                        active
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Silent Right Scroll Arrow (Desktop) */}
            <button
              type="button"
              onClick={() => scrollTopCategoryRow('right')}
              aria-label="Scroll categories right"
              title="Scroll categories right"
              className="hidden md:flex w-7 h-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#0A006E] hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ===================================================================
            POS-STYLE 2-COLUMN STOREFRONT LAYOUT:
            LEFT (7/8 Cols): FEATURED COLLECTION PRODUCT GRID
            RIGHT (5/4 Cols): STICKY ACTIVE WEBSITE DELIVERY CART & CHECKOUT
            =================================================================== */}
        <section ref={catalogSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: PRODUCT CATALOG GRID */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Catalog Info & 20-Second Brand Scatter Auto-Reshuffle Countdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-montserrat font-black text-slate-800 uppercase tracking-wide">
                  Drinks Catalog ({filteredProducts.length})
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#1E9E60] font-mono font-bold text-[10px] border border-emerald-200">
                  Direct Company Price
                </span>
              </div>
              <button
                type="button"
                onClick={reshuffleStorefrontNow}
                className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 active:scale-95 px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                title="Products of the same brand are scattered and automatically reshuffled every 20 seconds. Click to reshuffle now."
              >
                <RotateCcw className="w-3 h-3 text-amber-600 animate-spin" style={{ animationDuration: '20s' }} />
                <span>Scattered Brands • Reshuffling in {storefrontSecondsLeft}s</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProducts.map(product => {
                const inCartItem = webCart.find(i => i.product.id === product.id);
                const imgUrl = product.image || getProductImageUrl(product);
                const stock = getProductStock(product.id);
                const isOutOfStock = stock <= 0;
                const highResImgUrl = resolveHighResProductImageUrl(product, siteOrigin, imgUrl);
                const itemSchemaJson = buildProductJsonLdSchema(product, stock, siteOrigin, highResImgUrl);

                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-2xl border overflow-hidden shadow-xs transition-all flex flex-col justify-between group ${
                      isOutOfStock
                        ? 'border-slate-200/80 bg-slate-50/60'
                        : 'border-slate-200 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Step 1: Embedded JSON-LD Product Schema strictly aligned with visible card data */}
                    <script
                      type="application/ld+json"
                      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemSchemaJson) }}
                    />
                    <div>
                      {/* Product Image Area — Full-Fit Edge-to-Edge inside Product Box */}
                      <div
                        onClick={() => {
                          setSelectedProductDetail(product);
                          setDetailQty(1);
                        }}
                        className="relative h-56 w-full bg-slate-900 cursor-pointer overflow-hidden border-b border-slate-100"
                      >
                        <img
                          src={imgUrl}
                          alt={product.name}
                          className={`w-full h-full object-cover object-center block transition-transform duration-300 ${
                            isOutOfStock
                              ? 'opacity-50 grayscale-[35%]'
                              : 'group-hover:scale-105'
                          }`}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-xs border border-slate-200 text-[10px] font-montserrat font-bold text-slate-700 uppercase">
                          {product.volumeMl || 750}ML • {product.alcoholPercentage || 40}% ABV
                        </span>

                        {/* Live ERP Inventory Stock Status Badge */}
                        <span
                          className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-montserrat font-black uppercase shadow-2xs ${
                            isOutOfStock
                              ? 'bg-red-600 text-white border border-red-700'
                              : stock <= 12
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-50/95 text-[#1E9E60] border border-emerald-200'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : `In Stock (${stock})`}
                        </span>

                        {isOutOfStock && (
                          <div className="absolute inset-x-0 bottom-0 bg-red-600/90 text-white text-[10px] font-montserrat font-black uppercase tracking-wider py-1 text-center">
                            Out of Stock in ERP Inventory
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-montserrat font-bold uppercase tracking-wider text-slate-400 truncate">
                            {product.brand}
                          </div>
                          {(() => {
                            const ratingInfo = getProductRatingInfo(product);
                            return (
                              <div
                                onClick={() => {
                                  setSelectedProductDetail(product);
                                  setDetailQty(1);
                                  setReviewCommentDraft(ratingInfo.userComment || '');
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border cursor-pointer shrink-0 transition ${
                                  ratingInfo.count > 0
                                    ? 'bg-amber-50 border-amber-200/80 hover:border-amber-400'
                                    : 'bg-slate-50 border-slate-200 hover:border-[#0A006E]'
                                }`}
                                title={
                                  ratingInfo.count > 0
                                    ? `Rated ${ratingInfo.rating.toFixed(1)} / 5.0 from ${ratingInfo.count} genuine customer rating${ratingInfo.count === 1 ? '' : 's'}`
                                    : 'No ratings yet — Click to rate this drink'
                                }
                              >
                                <Star
                                  className={`w-3 h-3 ${
                                    ratingInfo.count > 0
                                      ? 'fill-amber-400 text-amber-500'
                                      : 'text-slate-400'
                                  }`}
                                />
                                {ratingInfo.count > 0 ? (
                                  <>
                                    <span className="font-mono font-black text-[11px] text-slate-800">
                                      {ratingInfo.rating.toFixed(1)}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400">
                                      ({ratingInfo.count})
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-montserrat font-bold text-[10px] text-slate-500">
                                    Rate
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <h4
                          onClick={() => {
                            setSelectedProductDetail(product);
                            setDetailQty(1);
                          }}
                          className={`font-montserrat font-bold text-sm sm:text-base line-clamp-2 min-h-[2.5rem] cursor-pointer ${
                            isOutOfStock
                              ? 'text-slate-500'
                              : 'text-slate-900 hover:text-[#0A006E]'
                          }`}
                        >
                          {product.name}
                        </h4>

                        <div className="pt-1 flex items-baseline justify-between">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-emerald-700">
                              Direct Company Price
                            </div>
                            <div className={`font-mono font-black text-lg ${isOutOfStock ? 'text-slate-400' : 'text-[#0A006E]'}`}>
                              {formatKes(product.retailPriceKes)}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              isOutOfStock ? 'text-red-600 uppercase' : 'text-slate-400'
                            }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : `${stock} btls in stock`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add to Cart / Quantity Stepper */}
                    <div className="p-4 pt-0">
                      {isOutOfStock ? (() => {
                        const fallbackStocked = findNearestStockedBranchForProduct({
                          productId: product.id,
                          requiredQty: 1,
                          rankedBranches: rankedNearestBranches,
                          inventoryItems
                        });
                        if (
                          fallbackStocked &&
                          fallbackStocked.rankedBranch.branch.id !== selectedFulfillingBranch.id
                        ) {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBranchOverrideId(fallbackStocked.rankedBranch.branch.id);
                                setCheckoutBanner(
                                  `Switched fulfilling branch to ${fallbackStocked.rankedBranch.branch.name} (${fallbackStocked.rankedBranch.distanceKm} km away) where ${product.name} has ${fallbackStocked.stock} bottles in stock!`
                                );
                                setTimeout(() => setCheckoutBanner(null), 4500);
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-montserrat font-black text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                              title="Switch to the next-nearest branch that has this product in stock"
                            >
                              <Navigation className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                              <span className="truncate">
                                In Stock at {fallbackStocked.rankedBranch.branch.name} ({fallbackStocked.rankedBranch.distanceKm} km) • Switch
                              </span>
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2.5 px-4 rounded-xl bg-[#0A006E] text-white font-montserrat font-bold text-xs flex items-center justify-center gap-2 opacity-35 cursor-not-allowed select-none"
                            title="This product is currently out of stock in ERP Inventory"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-[#FFDE00]" />
                            <span>Out of Stock • Add to Cart</span>
                          </button>
                        );
                      })() : inCartItem ? (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl p-1.5">
                          <button
                            type="button"
                            onClick={() => updateWebCartQty(product.id, inCartItem.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-center">
                            <div className="font-mono font-black text-xs text-[#1E9E60]">
                              {inCartItem.quantity} in Cart
                            </div>
                            <div className="text-[10px] font-mono text-emerald-800">
                              {formatKes(inCartItem.quantity * product.retailPriceKes)}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={inCartItem.quantity >= stock}
                            onClick={() => updateWebCartQty(product.id, inCartItem.quantity + 1)}
                            className={`w-8 h-8 rounded-lg bg-[#34D186] text-[#FFDE00] flex items-center justify-center font-bold shadow-2xs ${
                              inCartItem.quantity >= stock
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-emerald-950 cursor-pointer'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToWebCart(product, 1)}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-[#FFDE00]" />
                          <span>Add to Delivery Cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =================================================================
              RIGHT COLUMN: POS-STYLE STICKY WEBSITE DELIVERY CART & CHECKOUT
              ================================================================= */}
          <div ref={rightCartPanelRef} className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-44">
            <div
              className={`bg-white rounded-2xl border-2 shadow-xl overflow-hidden flex flex-col justify-between transition-all max-h-[82vh] lg:max-h-[calc(100vh-12rem)] ${
                isRightCartHighlighted
                  ? 'border-[#FFDE00] ring-4 ring-[#FFDE00]/50'
                  : 'border-[#0A006E]/20'
              }`}
            >
              {/* POS-Style Cart Header */}
              <div className="bg-[#0A006E] text-white p-4 flex items-center justify-between border-b-2 border-[#FFDE00] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0 shadow-xs">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-montserrat font-black italic text-sm sm:text-base truncate">
                      Website Delivery Cart
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-300 truncate">
                      {webCart.length} unique drink{webCart.length === 1 ? '' : 's'} • {totalCartItems} unit{totalCartItems === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-white/15 text-[#FFDE00] font-mono font-black text-xs border border-white/20">
                    {formatKes(totalCartCompanyPriceKes)}
                  </span>
                  {webCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWebCart([])}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 transition cursor-pointer"
                      title="Clear Cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Step-by-Step Checkout Container */}
              <div className="p-3 space-y-2.5">
                {/* Single-Line Account & Active Order Tracker Bar */}
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <GoogleGIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-semibold text-slate-700 text-[11px]">
                      {customerProfile ? customerProfile.name : 'Guest Checkout'}
                    </span>
                    {onHoldDeliveryOrders.length > 0 && (
                      <span className="text-[10px] font-mono font-bold text-[#1E9E60] shrink-0">
                        · {onHoldDeliveryOrders.length} Active
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    data-oauth-popup="true"
                    onClick={() => {
                      setIsEditingCustomerProfile(false);
                      setIsCustomerLoginModalOpen(true);
                    }}
                    className="text-[11px] font-montserrat font-bold text-[#0A006E] hover:underline shrink-0 cursor-pointer"
                  >
                    {customerProfile
                      ? onHoldDeliveryOrders.length > 0
                        ? 'Track / Pay →'
                        : `Orders (${myWebsiteDeliveryOrders.length})`
                      : 'Sign In'}
                  </button>
                </div>

                {webCart.length === 0 ? (
                  <div className="text-center py-6 px-3 space-y-2 bg-slate-50/70 rounded-xl border border-dashed border-slate-300">
                    <ShoppingBag className="w-7 h-7 text-slate-300 mx-auto" />
                    <div className="font-montserrat font-bold text-slate-800 text-xs">
                      Your Website Cart is Empty
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Select drinks from the catalog to start your step-by-step checkout.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Collapsed Step-by-Step Customer Checkout Wizard */}
                    <CustomerCheckoutWizard
                      webCart={webCart}
                      updateWebCartQty={updateWebCartQty}
                      removeFromWebCart={removeFromWebCart}
                      onGenerateOrderDoc={() =>
                        setActiveOrderItemsDocument(
                          buildOrderDocumentFromCart({
                            channelLabel: 'Website Direct Company Price Order',
                            branchName: selectedFulfillingBranch.name,
                            customerName: customerName || customerProfile?.name,
                            customerPhone: customerPhone || customerProfile?.phone,
                            customerEmail: customerProfile?.email,
                            deliveryLocation: deliveryStreetAndHouse.trim()
                              ? `${deliveryZone} — ${deliveryStreetAndHouse.trim()}`
                              : deliveryZone,
                            notes: deliveryNotes,
                            cartItems: webCart
                          })
                        )
                      }
                      onDownloadOrderDoc={() =>
                        downloadOrderItemsHtmlDocument(
                          buildOrderDocumentFromCart({
                            channelLabel: 'Website Direct Company Price Order',
                            branchName: selectedFulfillingBranch.name,
                            customerName: customerName || customerProfile?.name,
                            customerPhone: customerPhone || customerProfile?.phone,
                            customerEmail: customerProfile?.email,
                            deliveryLocation: deliveryStreetAndHouse.trim()
                              ? `${deliveryZone} — ${deliveryStreetAndHouse.trim()}`
                              : deliveryZone,
                            notes: deliveryNotes,
                            cartItems: webCart
                          })
                        )
                      }
                      customerName={customerName}
                      setCustomerName={setCustomerName}
                      customerPhone={customerPhone}
                      setCustomerPhone={setCustomerPhone}
                      deliveryZone={deliveryZone}
                      setDeliveryZone={setDeliveryZone}
                      deliveryStreetAndHouse={deliveryStreetAndHouse}
                      setDeliveryStreetAndHouse={setDeliveryStreetAndHouse}
                      deliveryNotes={deliveryNotes}
                      setDeliveryNotes={setDeliveryNotes}
                      customerCoords={customerCoords}
                      selectedFulfillingBranch={selectedFulfillingBranch}
                      selectedNearestBranchInfo={selectedNearestBranchInfo}
                      customerProfile={customerProfile}
                      totalCartItems={totalCartItems}
                      totalCartCompanyPriceKes={totalCartCompanyPriceKes}
                      checkoutError={checkoutError}
                      setCheckoutError={setCheckoutError}
                      isLocatingGps={isLocatingGps}
                      onLocateGps={handleLocateNearestBranchViaGps}
                      placeSearchQuery={placeSearchQuery}
                      setPlaceSearchQuery={setPlaceSearchQuery}
                      placeSearchResults={placeSearchResults}
                      setPlaceSearchResults={setPlaceSearchResults}
                      isSearchingPlaces={isSearchingPlaces}
                      showPlaceSearchDropdown={showPlaceSearchDropdown}
                      setShowPlaceSearchDropdown={setShowPlaceSearchDropdown}
                      onApplyLocationSelection={loc => applyRealLocationSelection(loc, true)}
                      onRequireSignInForCheckout={handleRequireSignInForCheckout}
                      onSubmitOrder={promptImmediately => handlePlaceDeliveryOrderOnHold(undefined, promptImmediately)}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          CONTIGUOUS PRODUCT DETAIL MODAL (PDP) WITH RATINGS & BRAND SUGGESTIONS
          ===================================================================== */}
      {selectedProductDetail && (() => {
        const detailStock = getProductStock(selectedProductDetail.id);
        const isDetailOutOfStock = detailStock <= 0;
        const detailRating = getProductRatingInfo(selectedProductDetail);

        // Build Suggested Brands in the same category (or storewide top brands)
        const sameCatProducts = products.filter(
          p => p.category === selectedProductDetail.category
        );
        const brandMap = new Map<string, { brand: string; count: number; sampleProduct: Product; inStockCount: number }>();
        (sameCatProducts.length >= 4 ? sameCatProducts : products).forEach(p => {
          const bName = (p.brand || 'Official Brand').trim();
          const pStock = getProductStock(p.id);
          const existing = brandMap.get(bName);
          if (!existing) {
            brandMap.set(bName, {
              brand: bName,
              count: 1,
              sampleProduct: p,
              inStockCount: pStock > 0 ? 1 : 0
            });
          } else {
            existing.count += 1;
            if (pStock > 0) {
              existing.inStockCount += 1;
              if (getProductStock(existing.sampleProduct.id) <= 0) {
                existing.sampleProduct = p;
              }
            }
          }
        });

        const suggestedBrands = Array.from(brandMap.values())
          .sort((a, b) => {
            const aIsCurrent = a.brand.toLowerCase() === selectedProductDetail.brand.toLowerCase() ? 1 : 0;
            const bIsCurrent = b.brand.toLowerCase() === selectedProductDetail.brand.toLowerCase() ? 1 : 0;
            if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;
            if (b.inStockCount !== a.inStockCount) return b.inStockCount - a.inStockCount;
            return b.count - a.count;
          })
          .slice(0, 10);

        // Build Suggested Drinks (same brand other sizes + top similar category drinks)
        const suggestedProducts = products
          .filter(p => p.id !== selectedProductDetail.id)
          .sort((a, b) => {
            const aSameBrand = a.brand.toLowerCase() === selectedProductDetail.brand.toLowerCase() ? 1 : 0;
            const bSameBrand = b.brand.toLowerCase() === selectedProductDetail.brand.toLowerCase() ? 1 : 0;
            if (aSameBrand !== bSameBrand) return bSameBrand - aSameBrand;

            const aSameCat = a.category === selectedProductDetail.category ? 1 : 0;
            const bSameCat = b.category === selectedProductDetail.category ? 1 : 0;
            if (aSameCat !== bSameCat) return bSameCat - aSameCat;

            const aInStock = getProductStock(a.id) > 0 ? 1 : 0;
            const bInStock = getProductStock(b.id) > 0 ? 1 : 0;
            if (aInStock !== bInStock) return bInStock - aInStock;

            return getProductRatingInfo(b).rating - getProductRatingInfo(a).rating;
          })
          .slice(0, 6);

        return (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-3xl max-w-3xl w-full h-dvh sm:h-auto max-h-dvh sm:max-h-[92vh] overflow-hidden shadow-2xl border-0 sm:border border-slate-200 flex flex-col relative animate-in fade-in zoom-in-95">
              {/* Scrollable Product Preview + Below Suggestions Body */}
              <div ref={detailModalScrollRef} className="flex-1 overflow-y-auto pb-28 sm:pb-6">
                {/* Top 2-Column Product Hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100">
                  <div className="bg-slate-900 min-h-[19rem] md:min-h-full relative overflow-hidden shrink-0">
                    <img
                      src={selectedProductDetail.image || getProductImageUrl(selectedProductDetail)}
                      alt={selectedProductDetail.name}
                      decoding="async"
                      className={`w-full h-full object-cover object-center block ${isDetailOutOfStock ? 'opacity-50 grayscale-[35%]' : ''}`}
                    />
                    <span className="absolute top-4 left-4 px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-xs border border-slate-200 text-[10px] font-mono font-bold text-slate-800 shadow-xs">
                      SKU: {selectedProductDetail.sku}
                    </span>
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-montserrat font-black uppercase shadow-xs ${
                          isDetailOutOfStock
                            ? 'bg-red-600 text-white'
                            : 'bg-emerald-100 text-[#1E9E60] border border-emerald-300'
                        }`}
                      >
                        {isDetailOutOfStock ? 'Out of Stock' : `In Stock (${detailStock})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedProductDetail(null)}
                        aria-label="Close Product Preview"
                        className="md:hidden w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/80 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 sm:p-7 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-montserrat font-bold uppercase tracking-wider text-slate-400">
                          {selectedProductDetail.brand} • {selectedProductDetail.volumeMl || 750}ML
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedProductDetail(null)}
                          className="hidden md:inline-flex p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <h3 className="font-montserrat font-black text-xl text-slate-900">
                        {selectedProductDetail.name}
                      </h3>

                      {/* Genuine Product Star Rating & Customer Review Box */}
                      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(starIdx => {
                                const activeStar =
                                  detailRating.count > 0
                                    ? starIdx <= Math.round(detailRating.userScore || detailRating.rating)
                                    : starIdx <= (detailRating.userScore || 0);
                                return (
                                  <button
                                    key={starIdx}
                                    type="button"
                                    onClick={() => handleRateProduct(selectedProductDetail.id, starIdx)}
                                    className="p-0.5 hover:scale-110 transition cursor-pointer"
                                    title={`Give ${starIdx} star${starIdx === 1 ? '' : 's'}`}
                                  >
                                    <Star
                                      className={`w-4 h-4 ${
                                        activeStar
                                          ? 'fill-amber-400 text-amber-500'
                                          : 'text-slate-300 hover:text-amber-400'
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                            {detailRating.count > 0 ? (
                              <>
                                <span className="font-mono font-black text-xs text-slate-900">
                                  {detailRating.rating.toFixed(1)}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600">
                                  ({detailRating.count} genuine rating{detailRating.count === 1 ? '' : 's'})
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-500">
                                No ratings yet
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-montserrat font-bold text-[#0A006E]">
                            {ratingSavedNotice
                              ? ratingSavedNotice
                              : detailRating.userScore
                              ? `You rated ${detailRating.userScore}★`
                              : 'Tap stars to rate'}
                          </span>
                        </div>

                        {/* Optional Genuine Review Note Input */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={reviewCommentDraft}
                            onChange={e => setReviewCommentDraft(e.target.value)}
                            placeholder={
                              detailRating.userComment
                                ? `Your review: "${detailRating.userComment}" (edit...)`
                                : 'Add a short genuine review comment (optional)...'
                            }
                            maxLength={160}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-[11px] font-medium text-slate-800 focus:outline-none focus:border-[#0A006E]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleRateProduct(
                                selectedProductDetail.id,
                                detailRating.userScore || 5,
                                reviewCommentDraft.trim()
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] shrink-0 cursor-pointer"
                          >
                            {detailRating.userScore ? 'Update' : 'Post 5★'}
                          </button>
                        </div>

                        {/* Recent Genuine Customer Reviews List */}
                        {detailRating.records.length > 0 && (
                          <div className="pt-1.5 border-t border-amber-200/60 space-y-1.5 max-h-28 overflow-y-auto">
                            {detailRating.records.slice(0, 4).map(rec => (
                              <div
                                key={rec.id}
                                className="text-[11px] bg-white/80 rounded-lg px-2.5 py-1.5 border border-amber-100 flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-montserrat font-bold text-slate-800 truncate">
                                      {rec.raterName}
                                    </span>
                                    {rec.isVerifiedBuyer && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[9px] uppercase shrink-0">
                                        Verified Buyer
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-bold text-amber-600 text-[10px] shrink-0">
                                    {'★'.repeat(rec.stars)}{'☆'.repeat(Math.max(0, 5 - rec.stars))}
                                  </span>
                                </div>
                                {rec.comment && (
                                  <p className="text-[11px] text-slate-600 italic leading-snug">
                                    &ldquo;{rec.comment}&rdquo;
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                        <div className="text-[10px] font-montserrat font-black uppercase text-[#1E9E60]">
                          Direct Portal Company Price (No Affiliate Markup)
                        </div>
                        <div
                          className="font-montserrat font-black text-3xl sm:text-4xl text-[#0A006E] tracking-tight drop-shadow-xs"
                          style={{ fontWeight: 900 }}
                        >
                          {formatKes(selectedProductDetail.retailPriceKes)}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-800">
                          {isDetailOutOfStock
                            ? 'Currently Out of Stock in ERP Inventory.'
                            : `Available in ERP Inventory: ${detailStock} bottles ready for delivery.`}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-700">Quantity:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDetailOutOfStock}
                            onClick={() => setDetailQty(q => Math.max(1, q - 1))}
                            className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold ${
                              isDetailOutOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-200'
                            }`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-black text-sm w-8 text-center">
                            {isDetailOutOfStock ? 0 : detailQty}
                          </span>
                          <button
                            type="button"
                            disabled={isDetailOutOfStock || detailQty >= detailStock}
                            onClick={() => setDetailQty(q => Math.min(detailStock, q + 1))}
                            className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold ${
                              isDetailOutOfStock || detailQty >= detailStock
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-slate-200'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Floating Non-Scrollable Action Bar on Mobile, Inline on Desktop */}
                    <div className="fixed sm:static bottom-0 inset-x-0 z-30 p-4 sm:p-0 sm:pt-2 bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t border-slate-200 sm:border-slate-100 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] sm:shadow-none">
                      <button
                        type="button"
                        disabled={isDetailOutOfStock}
                        onClick={() => {
                          if (isDetailOutOfStock) return;
                          addToWebCart(selectedProductDetail, detailQty);
                          setSelectedProductDetail(null);
                          handleFocusOrOpenWebsiteCart();
                        }}
                        className={`w-full py-3.5 sm:py-3 rounded-2xl sm:rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-lg sm:shadow-md transition ${
                          isDetailOutOfStock
                            ? 'opacity-35 cursor-not-allowed select-none'
                            : 'hover:bg-[#060046] cursor-pointer active:scale-[0.99]'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>
                          {isDetailOutOfStock ? (
                            'Out of Stock • Add to Cart'
                          ) : (
                            <>
                              Add {detailQty} to Delivery Cart • <strong className="font-montserrat font-black tracking-tight" style={{ fontWeight: 900 }}>{formatKes(selectedProductDetail.retailPriceKes * detailQty)}</strong>
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* =============================================================
                    BELOW PRODUCT PREVIEW: SUGGESTED BRANDS & SIMILAR DRINKS
                    ============================================================= */}
                <div className="p-5 sm:p-6 bg-slate-50/70 space-y-5">
                  {/* 1. Suggested Brands Pills */}
                  {suggestedBrands.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#0A006E]" />
                          <span>Suggested Brands to Explore</span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Click a brand to preview or filter
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {suggestedBrands.map(({ brand, count, sampleProduct }) => {
                          const isCurrentBrand =
                            brand.toLowerCase() === selectedProductDetail.brand.toLowerCase();
                          const brandRatingInfo = getBrandRatingInfo(brand);
                          return (
                            <button
                              key={`preview-sug-brand-${brand}`}
                              type="button"
                              onClick={() => {
                                if (isCurrentBrand) {
                                  setActiveCategory('ALL');
                                  setSearchQuery(brand);
                                  setSelectedProductDetail(null);
                                  setTimeout(() => {
                                    catalogSectionRef.current?.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'start'
                                    });
                                  }, 100);
                                } else {
                                  setSelectedProductDetail(sampleProduct);
                                  setDetailQty(1);
                                  setReviewCommentDraft('');
                                  detailModalScrollRef.current?.scrollTo({
                                    top: 0,
                                    behavior: 'smooth'
                                  });
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-montserrat font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                isCurrentBrand
                                  ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-2xs'
                                  : 'bg-white hover:bg-[#FFDE00]/25 text-slate-800 border-slate-200 hover:border-[#0A006E]'
                              }`}
                            >
                              <span>{brand}</span>
                              {brandRatingInfo.count > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-500">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                  {brandRatingInfo.rating.toFixed(1)}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                                  isCurrentBrand
                                    ? 'bg-white/15 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Suggested Drinks from Same & Related Brands */}
                  {suggestedProducts.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-600">
                          More from {selectedProductDetail.brand} &amp; Similar Brands
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategory('ALL');
                            setSearchQuery(selectedProductDetail.brand);
                            setSelectedProductDetail(null);
                            setTimeout(() => {
                              catalogSectionRef.current?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                              });
                            }, 100);
                          }}
                          className="text-[11px] font-montserrat font-bold text-[#0A006E] hover:underline cursor-pointer"
                        >
                          View All {selectedProductDetail.brand} →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {suggestedProducts.map(sugProd => {
                          const sugStock = getProductStock(sugProd.id);
                          const sugOutOfStock = sugStock <= 0;
                          const sugRating = getProductRatingInfo(sugProd);
                          const sugImg = sugProd.image || getProductImageUrl(sugProd);
                          return (
                            <div
                              key={`sug-prod-${sugProd.id}`}
                              onClick={() => {
                                setSelectedProductDetail(sugProd);
                                setDetailQty(1);
                                detailModalScrollRef.current?.scrollTo({
                                  top: 0,
                                  behavior: 'smooth'
                                });
                              }}
                              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-[#0A006E] shadow-2xs hover:shadow-sm transition flex items-center gap-2.5 cursor-pointer group"
                            >
                              <div className="w-14 h-14 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-100">
                                <img
                                  src={sugImg}
                                  alt={sugProd.name}
                                  className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform ${
                                    sugOutOfStock ? 'opacity-50 grayscale' : ''
                                  }`}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-montserrat font-bold uppercase text-slate-400 truncate">
                                    {sugProd.brand} • {sugProd.volumeMl || 750}ML
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-slate-700 shrink-0">
                                    <Star
                                      className={`w-2.5 h-2.5 ${
                                        sugRating.count > 0
                                          ? 'fill-amber-400 text-amber-500'
                                          : 'text-slate-300'
                                      }`}
                                    />
                                    {sugRating.count > 0
                                      ? `${sugRating.rating.toFixed(1)} (${sugRating.count})`
                                      : 'Unrated'}
                                  </span>
                                </div>

                                <div className="font-montserrat font-bold text-xs text-slate-900 group-hover:text-[#0A006E] truncate mt-0.5">
                                  {sugProd.name}
                                </div>

                                <div className="flex items-center justify-between gap-1 mt-1">
                                  <span className="font-mono font-black text-xs text-[#0A006E]">
                                    {formatKes(sugProd.retailPriceKes)}
                                  </span>
                                  {!sugOutOfStock ? (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        addToWebCart(sugProd, 1);
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] cursor-pointer"
                                    >
                                      + Cart
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-bold text-red-600">
                                      Out
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          SLIDE-OVER SHOPPING CART & DELIVERY HOLD CHECKOUT DRAWER
          ===================================================================== */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col justify-between shadow-2xl border-l border-slate-200 animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="bg-[#FFDE00] text-[#0A006E] p-5 flex items-center justify-between border-b-2 border-[#0A006E]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-base text-[#0A006E]">
                    Direct Company Price Delivery Cart
                  </h3>
                  <p className="text-[11px] text-[#0A006E]/80 font-semibold">
                    Purchase stays on hold until delivery is done at your location
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items & Delivery Form */}
            <div className={webCart.length === 0 ? 'flex-1 overflow-y-auto p-5 space-y-5' : 'flex-1 min-h-0 overflow-hidden flex flex-col'}>
              {webCart.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                  <div className="font-montserrat font-bold text-slate-800 text-sm">
                    Your Delivery Cart is Empty
                  </div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Add drinks from the catalog at Direct Company Price to schedule doorstep delivery.
                  </p>
                </div>
              ) : (
                <>
                  {/* Step-by-Step Customer Checkout Wizard */}
                  <CustomerCheckoutWizard
                    webCart={webCart}
                    updateWebCartQty={updateWebCartQty}
                    removeFromWebCart={removeFromWebCart}
                    onGenerateOrderDoc={() =>
                      setActiveOrderItemsDocument(
                        buildOrderDocumentFromCart({
                          channelLabel: 'Website Direct Company Price Order',
                          branchName: selectedFulfillingBranch.name,
                          customerName: customerName || customerProfile?.name,
                          customerPhone: customerPhone || customerProfile?.phone,
                          customerEmail: customerProfile?.email,
                          deliveryLocation: deliveryStreetAndHouse.trim()
                            ? `${deliveryZone} — ${deliveryStreetAndHouse.trim()}`
                            : deliveryZone,
                          notes: deliveryNotes,
                          cartItems: webCart
                        })
                      )
                    }
                    onDownloadOrderDoc={() =>
                      downloadOrderItemsHtmlDocument(
                        buildOrderDocumentFromCart({
                          channelLabel: 'Website Direct Company Price Order',
                          branchName: selectedFulfillingBranch.name,
                          customerName: customerName || customerProfile?.name,
                          customerPhone: customerPhone || customerProfile?.phone,
                          customerEmail: customerProfile?.email,
                          deliveryLocation: deliveryStreetAndHouse.trim()
                            ? `${deliveryZone} — ${deliveryStreetAndHouse.trim()}`
                            : deliveryZone,
                          notes: deliveryNotes,
                          cartItems: webCart
                        })
                      )
                    }
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    customerPhone={customerPhone}
                    setCustomerPhone={setCustomerPhone}
                    deliveryZone={deliveryZone}
                    setDeliveryZone={setDeliveryZone}
                    deliveryStreetAndHouse={deliveryStreetAndHouse}
                    setDeliveryStreetAndHouse={setDeliveryStreetAndHouse}
                    deliveryNotes={deliveryNotes}
                    setDeliveryNotes={setDeliveryNotes}
                    customerCoords={customerCoords}
                    selectedFulfillingBranch={selectedFulfillingBranch}
                    selectedNearestBranchInfo={selectedNearestBranchInfo}
                    customerProfile={customerProfile}
                    totalCartItems={totalCartItems}
                    totalCartCompanyPriceKes={totalCartCompanyPriceKes}
                    checkoutError={checkoutError}
                    setCheckoutError={setCheckoutError}
                    isLocatingGps={isLocatingGps}
                    onLocateGps={handleLocateNearestBranchViaGps}
                    placeSearchQuery={placeSearchQuery}
                    setPlaceSearchQuery={setPlaceSearchQuery}
                    placeSearchResults={placeSearchResults}
                    setPlaceSearchResults={setPlaceSearchResults}
                    isSearchingPlaces={isSearchingPlaces}
                    showPlaceSearchDropdown={showPlaceSearchDropdown}
                    setShowPlaceSearchDropdown={setShowPlaceSearchDropdown}
                    onApplyLocationSelection={loc => applyRealLocationSelection(loc, true)}
                    onRequireSignInForCheckout={handleRequireSignInForCheckout}
                    onSubmitOrder={promptImmediately => handlePlaceDeliveryOrderOnHold(undefined, promptImmediately)}
                    compact
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PRODUCTION SAFARICOM DARAJA M-PESA & AIRTEL MONEY STK PUSH GATEWAY MODAL
          Fades off instantly once the STK Push prompt has shown
          ===================================================================== */}
      {activeStkPromptOrder && (() => {
        const stkCarrierInfo = detectKenyanMobileCarrier(stkPromptPhone);
        const isAirtelStk = stkCarrierInfo.carrier === 'AIRTEL';
        return (
        <div
          className={`fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ease-out ${
            isStkModalFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div
            className={`bg-white rounded-none sm:rounded-3xl max-w-md w-full h-dvh sm:h-auto max-h-dvh overflow-y-auto shadow-2xl border-0 sm:border-2 flex flex-col transition-all duration-200 ease-out ${
              isStkModalFadingOut
                ? 'opacity-0 scale-95 -translate-y-2'
                : 'opacity-100 scale-100 translate-y-0 animate-in fade-in zoom-in-95'
            } ${isAirtelStk ? 'border-rose-500' : 'border-[#34D186]'}`}
          >
            <div
              className={`text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00] ${
                isAirtelStk
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700'
                  : 'bg-gradient-to-r from-[#1E9E60] via-[#34D186] to-[#28B873]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-sm">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-montserrat font-black text-sm uppercase tracking-wider text-white">
                      {isAirtelStk ? 'Airtel Money / Daraja Gateway' : 'Safaricom Daraja STK Push'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[9px] font-black">
                      LIVE PRODUCTION API
                    </span>
                  </div>
                  <p className="text-[11px] text-white/90">
                    {stkCarrierInfo.formattedDisplay || stkPromptPhone} • {stkCarrierInfo.carrierName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fadeOutAndCloseStkModal(0)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmStkPromptPayment} className="p-6 space-y-4">
              <div
                className={`p-4 rounded-2xl border space-y-2 text-xs ${
                  isAirtelStk
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase ${
                      isAirtelStk ? 'text-rose-800' : 'text-emerald-800'
                    }`}
                  >
                    Lipa Na M-Pesa Online (Daraja v2)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-montserrat font-black text-[9px] uppercase text-white ${
                      isAirtelStk ? 'bg-red-600' : 'bg-[#34D186]'
                    }`}
                  >
                    {isAirtelStk ? 'Airtel Identified' : 'Safaricom Identified'}
                  </span>
                </div>
                <p className="text-slate-800 font-medium leading-relaxed">
                  Dispatch an authoritative Safaricom Daraja STK Push for{' '}
                  <strong className="text-[#1E9E60] font-mono">
                    {formatKes(activeStkPromptOrder.totalCompanyPriceKes)}
                  </strong>{' '}
                  (Order <strong className="font-mono">{activeStkPromptOrder.orderNumber}</strong>) to{' '}
                  <strong className="font-mono">
                    {stkCarrierInfo.formattedDisplay || stkPromptPhone}
                  </strong>
                  . You will enter your M-Pesa PIN directly on your physical phone handset.
                </p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/80 flex justify-between">
                  <span>Paybill / ShortCode:</span>
                  <strong className="text-[#0A006E] font-mono">
                    4082211 • Ref: {activeStkPromptOrder.orderNumber}
                  </strong>
                </div>
              </div>

              {stkGatewayStatusMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-[#34D186] text-xs font-semibold text-[#1E9E60] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34D186]" />
                  <span>{stkGatewayStatusMessage}</span>
                </div>
              )}

              {stkGatewayError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-800 flex items-start gap-2">
                  <AnimatedErrorLogo size="xs" />
                  <span>{stkGatewayError}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-montserrat font-bold text-slate-700">
                    10-Digit Mobile Money Number (Safaricom / Airtel):
                  </label>
                  <span className="font-mono font-bold text-[10px] text-[#0A006E]">
                    {stkCarrierInfo.digitsCount}/10 Digits
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={stkCarrierInfo.cleanDigits}
                    onChange={e => setStkPromptPhone(sanitizeAndControlKenyanMobileInput(e.target.value))}
                    placeholder="0712345678 or 0733123456"
                    className={`w-full px-3.5 py-2.5 pr-28 rounded-xl bg-white border-2 font-mono font-black text-sm text-[#0A006E] focus:outline-none ${
                      isAirtelStk ? 'border-rose-400' : 'border-[#34D186]'
                    }`}
                  />
                  <span
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-montserrat font-black uppercase px-2 py-0.5 rounded text-white ${
                      isAirtelStk ? 'bg-red-600' : 'bg-[#34D186]'
                    }`}
                  >
                    {isAirtelStk ? 'Airtel Line' : 'Safaricom Line'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                  Already Paid via Paybill / Till? Enter Verified M-Pesa Receipt Code (Optional):
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={stkReceiptInput}
                  onChange={e =>
                    setStkReceiptInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                  }
                  placeholder="e.g. QKA84X92LM (Leave blank to send STK Push)"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-xs uppercase text-slate-900 focus:border-[#0A006E] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => fadeOutAndCloseStkModal(0)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-montserrat font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isProcessingStk || (!stkCarrierInfo.isValid && stkReceiptInput.trim().length < 6)}
                  className={`flex-2 py-2.5 px-4 rounded-xl text-white font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50 ${
                    isAirtelStk
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#34D186] hover:bg-[#1E9E60]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isProcessingStk
                      ? 'Connecting to Daraja...'
                      : stkReceiptInput.trim().length >= 6
                      ? `Verify Receipt (${stkReceiptInput.trim()})`
                      : `Send STK Push (${formatKes(activeStkPromptOrder.totalCompanyPriceKes)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Official 16% VAT Tax Receipt Modal upon completing Website Buy */}
      {completedReceiptModal && (
        <EtimsReceiptModal
          invoice={completedReceiptModal.invoice}
          order={completedReceiptModal.order}
          onClose={() => setCompletedReceiptModal(null)}
        />
      )}

      {/* Official Ordered Items List Document Modal (Multi-Item Orders) */}
      {activeOrderItemsDocument && (
        <OrderItemsDocumentModal
          document={activeOrderItemsDocument}
          onClose={() => setActiveOrderItemsDocument(null)}
        />
      )}

      {/* =====================================================================
          TRACK MY ORDER & CUSTOMER ACCOUNT MODAL (PROPERLY ALIGNED)
          ===================================================================== */}
      {(isCustomerLoginModalOpen || isOrdersModalOpen) && (
        <div
          data-oauth-container="true"
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={() => {
            setIsCustomerLoginModalOpen(false);
            setIsOrdersModalOpen(false);
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`bg-white rounded-2xl sm:rounded-3xl w-full max-h-[88dvh] overflow-hidden shadow-2xl border-2 border-[#0A006E] flex flex-col justify-between animate-in fade-in zoom-in-95 ${
              customerProfile ? 'max-w-2xl' : 'max-w-md'
            }`}
          >
            {/* Modal Header */}
            <div className="bg-[#0A006E] text-white px-5 py-4 flex items-center justify-between gap-3 border-b-2 border-[#FFDE00] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xs shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-montserrat font-black italic text-sm sm:text-base text-white truncate">
                    {customerProfile
                      ? 'Track My Order'
                      : isPendingCheckoutSignIn && webCart.length > 0
                      ? 'Sign In to Complete Checkout'
                      : 'Track My Order'}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-300 truncate">
                    {customerProfile
                      ? `${customerProfile.name} · ${customerProfile.email}`
                      : isPendingCheckoutSignIn && webCart.length > 0
                      ? `${totalCartItems} item(s) (${formatKes(totalCartCompanyPriceKes)}) ready for checkout`
                      : 'Sign in with Gmail to view live delivery status & M-Pesa prompt'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomerLoginModalOpen(false);
                  setIsOrdersModalOpen(false);
                }}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#FFDE00] text-white hover:text-[#0A006E] flex items-center justify-center transition cursor-pointer shrink-0"
                aria-label="Close Track My Order window"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              {customerProfile ? (
                <>
                  {/* 1. Compact Aligned Customer Account Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <GoogleGIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-montserrat font-bold text-xs text-slate-900 truncate">
                            {customerProfile.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#1E9E60] shrink-0">
                            · {myWebsiteDeliveryOrders.length} Order{myWebsiteDeliveryOrders.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {customerProfile.email}
                          {customerProfile.phone ? ` · ${customerProfile.phone}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsEditingCustomerProfile(prev => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#0A006E] border border-slate-300 font-montserrat font-bold text-[11px] cursor-pointer"
                      >
                        {isEditingCustomerProfile ? 'Cancel' : 'Edit Info'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCustomerGmailSignOut}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-montserrat font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional Collapsible Profile Update Form */}
                  {isEditingCustomerProfile && (
                    <form
                      onSubmit={e => {
                        handleCustomerGmailSignIn(false, e);
                        setIsEditingCustomerProfile(false);
                      }}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="text-[11px] font-montserrat font-black uppercase text-[#0A006E]">
                        Update Delivery Contact Details
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-montserrat font-bold text-slate-600 mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={gmailLoginNameInput}
                            onChange={e => setGmailLoginNameInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-montserrat font-bold text-slate-600 mb-1">
                            Gmail Address *
                          </label>
                          <input
                            type="email"
                            required
                            value={gmailLoginEmailInput}
                            onChange={e => setGmailLoginEmailInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-semibold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-montserrat font-bold text-slate-600 mb-1">
                            M-Pesa Phone (10 Digits)
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={sanitizeAndControlKenyanMobileInput(gmailLoginPhoneInput)}
                            onChange={e =>
                              setGmailLoginPhoneInput(sanitizeAndControlKenyanMobileInput(e.target.value))
                            }
                            placeholder="0712345678"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-[#0A006E]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-xs cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 2. ACTIVE DELIVERY ORDERS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-montserrat font-black text-xs uppercase tracking-wider text-[#0A006E] flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[#0A006E]" />
                        <span>Active Deliveries ({onHoldDeliveryOrders.length})</span>
                      </h4>
                    </div>

                    {onHoldDeliveryOrders.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5">
                        <PackageCheck className="w-7 h-7 text-emerald-600 mx-auto" />
                        <div className="font-montserrat font-bold text-xs text-slate-800">
                          No Active Delivery in Progress
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Orders placed on the website will appear here with real-time rider dispatch status and M-Pesa payment prompt.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {onHoldDeliveryOrders.map(ord => {
                          const phoneVal = promptPhones[ord.id] ?? ord.customerPhone ?? '';
                          const isDelivered = ord.deliveryStatus === 'DELIVERED_AWAITING_PAYMENT';
                          const isOutForDelivery = ord.deliveryStatus === 'OUT_FOR_DELIVERY';

                          return (
                            <div
                              key={ord.id}
                              className="p-4 rounded-2xl bg-white border-2 border-slate-200 space-y-3 shadow-2xs"
                            >
                              {/* Aligned Order Top Bar */}
                              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-black text-xs text-[#0A006E] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                                    {ord.orderNumber}
                                  </span>
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-montserrat font-black uppercase truncate ${
                                      isDelivered
                                        ? 'bg-emerald-100 text-[#1E9E60]'
                                        : isOutForDelivery
                                        ? 'bg-blue-100 text-[#0A006E]'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {isDelivered
                                      ? '✓ Arrived · Ready to Pay'
                                      : isOutForDelivery
                                      ? 'Rider En Route'
                                      : 'Dispatched · On Hold'}
                                  </span>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="font-mono font-black text-sm sm:text-base text-[#1E9E60]">
                                    {formatKes(ord.totalCompanyPriceKes)}
                                  </div>
                                </div>
                              </div>

                              {/* 3-Step Horizontal Delivery Progress Tracker */}
                              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-montserrat font-bold">
                                <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[#1E9E60] border border-emerald-200 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">1. Dispatched</span>
                                </div>
                                <div
                                  className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                                    isOutForDelivery || isDelivered
                                      ? 'bg-emerald-50 text-[#1E9E60] border-emerald-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  <Truck className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">2. En Route</span>
                                </div>
                                <div
                                  className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                                    isDelivered
                                      ? 'bg-emerald-50 text-[#1E9E60] border-emerald-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">3. Arrived &amp; Pay</span>
                                </div>
                              </div>

                              {/* Aligned 2-Column Destination & Dispatch Details */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-[10px] font-montserrat font-bold uppercase text-slate-400">
                                    Delivery Destination
                                  </div>
                                  <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                                    <span className="truncate">{ord.deliveryLocation}</span>
                                  </div>
                                  {ord.customerLatitude !== undefined && ord.customerLongitude !== undefined && (
                                    <a
                                      href={buildOpenStreetMapDirectUrl(ord.customerLatitude, ord.customerLongitude)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block text-[10px] font-mono font-bold text-[#0A006E] hover:underline"
                                    >
                                      View GPS Pin on Map ↗
                                    </a>
                                  )}
                                </div>

                                <div className="min-w-0 space-y-0.5 sm:border-l sm:border-slate-200 sm:pl-3">
                                  <div className="text-[10px] font-montserrat font-bold uppercase text-slate-400">
                                    Fulfilling Branch &amp; Rider
                                  </div>
                                  <div className="font-semibold text-slate-900 truncate">
                                    {ord.branchName}
                                    {ord.estimatedEtaMinutes ? ` · ~${ord.estimatedEtaMinutes} mins` : ''}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    Rider: <strong className="text-slate-700">{ord.riderName}</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Compact Ordered Items List */}
                              <div className="rounded-xl p-2.5 bg-slate-50/60 border border-slate-200/70 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[10px] font-montserrat font-bold uppercase text-slate-400 pb-1 border-b border-slate-200/60">
                                  <span>
                                    Items ({ord.items.reduce((s, i) => s + i.quantity, 0)} Bottles)
                                  </span>
                                  {isMultiItemOrder(ord.items) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveOrderItemsDocument(
                                          buildOrderDocumentFromWebsiteDeliveryOrder(ord)
                                        )
                                      }
                                      className="text-[#0A006E] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Items Manifest</span>
                                    </button>
                                  )}
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                                  {ord.items.map((it, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="text-slate-800 truncate">
                                        <strong>{it.quantity}x</strong> {it.product.name}
                                      </span>
                                      <span className="font-mono font-bold text-slate-900 shrink-0">
                                        {formatKes(it.totalAmount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Aligned Bottom Action Row */}
                              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center justify-between sm:justify-start gap-2">
                                  <span className="text-[11px] text-slate-600 font-mono">
                                    M-Pesa: <strong className="text-[#0A006E]">{ord.customerPhone || phoneVal}</strong>
                                  </span>
                                  {!isDelivered && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateWebsiteDeliveryOrderStatus(
                                          ord.id,
                                          'DELIVERED_AWAITING_PAYMENT'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0A006E] font-montserrat font-bold text-[11px] transition cursor-pointer shrink-0"
                                    >
                                      Confirm Rider Arrival
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleInitiateSelfPrompt(ord)}
                                  className="px-4 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                                >
                                  <Smartphone className="w-4 h-4 shrink-0" />
                                  <span>Pay via M-Pesa · {formatKes(ord.totalCompanyPriceKes)}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. COMPLETED & PAID ORDERS */}
                  {completedWebsiteOrders.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-200">
                      <h4 className="font-montserrat font-black text-xs uppercase tracking-wider text-[#1E9E60] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1E9E60]" />
                        <span>Completed Orders ({completedWebsiteOrders.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {completedWebsiteOrders.map(ord => (
                          <div
                            key={ord.id}
                            className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-[#0A006E]">
                                  {ord.orderNumber}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#1E9E60]">
                                  PAID · {ord.mpesaReceiptNumber}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {ord.deliveryLocation}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isMultiItemOrder(ord.items) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveOrderItemsDocument(
                                      buildOrderDocumentFromWebsiteDeliveryOrder(ord)
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] font-montserrat font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>Manifest</span>
                                </button>
                              )}
                              <span className="font-mono font-black text-xs text-[#1E9E60]">
                                {formatKes(ord.totalCompanyPriceKes)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3.5">
                  {isPendingCheckoutSignIn && webCart.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-[#0A006E]/30 flex items-center justify-between gap-2 text-xs">
                      <span className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Sign in to complete your order</span>
                      </span>
                      <span className="font-mono font-black text-[#1E9E60] shrink-0">
                        {formatKes(totalCartCompanyPriceKes)}
                      </span>
                    </div>
                  )}

                  {gmailLoginError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <AnimatedErrorLogo size="sm" />
                      <span>{gmailLoginError}</span>
                    </div>
                  )}

                  {/* One-Tap Google / Gmail Popup SSO Button */}
                  <button
                    type="button"
                    data-oauth-popup="true"
                    disabled={isSigningInWithGmail}
                    onClick={() => handleCustomerGmailSignIn(true)}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-[#0A006E] font-montserrat font-black text-xs flex items-center justify-center gap-2.5 shadow-xs transition cursor-pointer"
                  >
                    <GoogleGIcon className="w-4 h-4 shrink-0" />
                    <span>
                      {isSigningInWithGmail
                        ? 'Connecting to Google...'
                        : 'Continue with Google Popup'}
                    </span>
                  </button>

                  <div className="relative flex py-0.5 items-center">
                    <div className="grow border-t border-slate-200" />
                    <span className="shrink mx-2.5 text-[10px] font-montserrat font-bold uppercase text-slate-400">
                      Or Enter Details Directly
                    </span>
                    <div className="grow border-t border-slate-200" />
                  </div>

                  <form
                    onSubmit={e => handleCustomerGmailSignIn(false, e)}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={gmailLoginNameInput}
                          onChange={e => setGmailLoginNameInput(e.target.value)}
                          placeholder="e.g. Dorcah Moraa"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                        Gmail Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={gmailLoginEmailInput}
                          onChange={e => setGmailLoginEmailInput(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#0A006E]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-montserrat font-bold text-slate-700">
                          M-Pesa / Airtel Phone (10 Digits)
                        </label>
                        {gmailLoginPhoneInput && (
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {detectKenyanMobileCarrier(gmailLoginPhoneInput).digitsCount}/10 digits
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={sanitizeAndControlKenyanMobileInput(gmailLoginPhoneInput)}
                          onChange={e =>
                            setGmailLoginPhoneInput(sanitizeAndControlKenyanMobileInput(e.target.value))
                          }
                          placeholder="0712345678"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-[#0A006E] focus:bg-white focus:outline-none focus:border-[#0A006E]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSigningInWithGmail}
                      className="w-full py-3 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <GoogleGIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {isPendingCheckoutSignIn && webCart.length > 0
                          ? `Sign In & Continue (${formatKes(totalCartCompanyPriceKes)})`
                          : 'Sign In & Track My Order'}
                      </span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {customerProfile && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 truncate">
                  Real-time dispatch &amp; M-Pesa payment tracker
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomerLoginModalOpen(false);
                    setIsOrdersModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0A006E] text-white font-montserrat font-bold text-xs hover:bg-[#060046] transition cursor-pointer shrink-0"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Merchant Center Feed & JSON-LD Schema Diagnostics Modal */}
      <MerchantSeoDiagnosticsModal
        isOpen={isMerchantSeoModalOpen}
        onClose={() => setIsMerchantSeoModalOpen(false)}
        products={products}
        inventoryItems={inventoryItems}
        activeBranchId={activeBranch.id}
      />

      {/* Storefront Footer with Matching Wave Design */}
      <footer className="relative bg-white pt-7 pb-24 md:pb-7 min-h-[5.5rem] flex items-center px-6 text-xs text-slate-600 mt-auto border-t border-slate-200">
        <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-montserrat font-bold text-slate-900">
              © {new Date().getFullYear()} VAAIRO Direct Online Portal.
            </span>
            <a
              href="https://liqour.urbantechdev.com/website"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-[#0A006E] hover:underline"
            >
              https://liqour.urbantechdev.com/website
            </a>
            <span className="text-slate-600">
              • 100% Company Price • Doorstep Delivery • Pay on Delivery via M-Pesa Self-Prompt
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setIsMerchantSeoModalOpen(true)}
              className="font-montserrat font-bold text-[#1E9E60] hover:underline flex items-center gap-1.5 cursor-pointer"
              title="Inspect JSON-LD Product Schema, Google Merchant Center XML/CSV Feed & Rich Results Diagnostics"
            >
              <Rss className="w-3.5 h-3.5 text-[#1E9E60]" />
              <span>Google Merchant &amp; SEO Schema</span>
            </button>
            <a
              href="/feeds/google-shopping.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-slate-500 hover:text-[#0A006E] hover:underline flex items-center gap-1"
              title="Live Google Merchant Center XML Product Feed"
            >
              <span>XML Feed</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={onSwitchToErp}
              className="font-montserrat font-bold text-[#0A006E] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open ERP Admin Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          HAMBURGER NAVIGATION & CATEGORIES DRAWER (Right-Aligned on Desktop, Full Screen on Mobile)
          ===================================================================== */}
      {isCategoriesMenuOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsCategoriesMenuOpen(false)}
        >
          <div
            className="bg-white w-full md:max-w-md h-dvh max-h-dvh flex flex-col overflow-hidden shadow-2xl border-l-0 md:border-l-2 border-[#0A006E]"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="py-4 px-5 bg-[#FFDE00] text-[#0A006E] border-b-2 border-[#0A006E] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-montserrat font-black italic text-base text-[#0A006E] flex items-center gap-2">
                  <Menu className="w-4 h-4 text-[#0A006E]" />
                  <span>Menu • Location, Categories &amp; Brands</span>
                </h3>
                <p className="text-[11px] text-[#0A006E]/80 font-semibold mt-0.5">
                  Set delivery location, nearest branch, category, or brand
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoriesMenuOpen(false)}
                className="w-9 h-9 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center cursor-pointer transition"
                aria-label="Close Categories Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Location (Mobile), Categories & Brands Content */}
            <div className="p-5 overflow-y-auto space-y-6 pb-8 flex-1">
              {/* Section 0 (Mobile): Simplified Nearest Branch Bar */}
              <div className="md:hidden bg-slate-50 rounded-2xl border border-slate-200 p-3 text-left space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                      <Navigation className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-montserrat font-black text-xs text-[#0A006E] truncate">
                      Nearest Branch
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLocateNearestBranchViaGps}
                    disabled={isLocatingGps}
                    className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>{isLocatingGps ? 'Locating...' : customerCoords ? 'GPS Active' : 'Use GPS'}</span>
                  </button>
                </div>

                <select
                  value={selectedBranchOverrideId || 'AUTO_NEAREST'}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedBranchOverrideId(val === 'AUTO_NEAREST' ? null : val);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-[#0A006E] focus:outline-none focus:border-[#0A006E]"
                >
                  <option value="AUTO_NEAREST">
                    {selectedFulfillingBranch.name} ({selectedFulfillingBranch.code})
                  </option>
                  {rankedNearestBranches.map(rb => (
                    <option key={rb.branch.id} value={rb.branch.id}>
                      {rb.branch.name} ({rb.branch.code}) — {rb.distanceKm} km
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 1: Drink Categories */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-400">
                  Drink Categories
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {DRINK_CATEGORIES.map(cat => {
                    const count = products.filter(p => matchesDrinkCategory(p, cat.id)).length;
                    const isSelected = activeCategory === cat.id && !searchQuery;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setSearchQuery('');
                          setIsCategoriesMenuOpen(false);
                          setTimeout(() => {
                            catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                        className={`p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span className="font-montserrat font-bold text-xs truncate pr-2">
                          {cat.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 ${
                            isSelected
                              ? 'bg-[#FFDE00] text-[#0A006E]'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Official Brands (Collapsed Dropdown) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBrandDropdownOpen(prev => !prev)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                        Shop by Brand ({availableBrands.length})
                      </span>
                      {searchQuery &&
                        availableBrands.some(
                          b => b.brand.toLowerCase() === searchQuery.trim().toLowerCase()
                        ) && (
                          <span className="px-2 py-0.5 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] truncate">
                            {searchQuery}
                          </span>
                        )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#0A006E] shrink-0 transition-transform duration-200 ${
                        isBrandDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsCategoriesMenuOpen(false);
                      }}
                      className="px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-montserrat font-bold shrink-0 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {isBrandDropdownOpen && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                    {/* Native Select Dropdown for Quick Brand Jump */}
                    <select
                      value={
                        availableBrands.find(
                          b => b.brand.toLowerCase() === searchQuery.trim().toLowerCase()
                        )?.brand || ''
                      }
                      onChange={e => {
                        const chosenBrand = e.target.value;
                        setActiveCategory('ALL');
                        setSearchQuery(chosenBrand);
                        if (chosenBrand) {
                          setIsCategoriesMenuOpen(false);
                          setTimeout(() => {
                            catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-montserrat font-bold text-[#0A006E] focus:outline-none focus:border-[#0A006E] cursor-pointer"
                    >
                      <option value="">-- Choose a Brand ({availableBrands.length} Brands) --</option>
                      {availableBrands.map(({ brand, count }) => (
                        <option key={`select-${brand}`} value={brand}>
                          {brand} ({count})
                        </option>
                      ))}
                    </select>

                    {/* Scrollable Brand Chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {availableBrands.map(({ brand, count }) => {
                        const isBrandActive = searchQuery.trim().toLowerCase() === brand.toLowerCase();
                        return (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => {
                              setActiveCategory('ALL');
                              setSearchQuery(brand);
                              setIsCategoriesMenuOpen(false);
                              setTimeout(() => {
                                catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 100);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-montserrat font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              isBrandActive
                                ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span>{brand}</span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                                isBrandActive ? 'bg-[#FFDE00] text-[#0A006E] font-black' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Customer Account, Fullscreen & Staff ERP Portal Access */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoriesMenuOpen(false);
                      setGmailLoginError(null);
                      setIsEditingCustomerProfile(false);
                      setIsCustomerLoginModalOpen(true);
                    }}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-montserrat font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <GoogleGIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {customerProfile ? `My Orders (${onHoldDeliveryOrders.length})` : 'Sign In'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-fullscreen-toggle="true"
                    onClick={() => {
                      handleToggleFullscreen();
                      setIsCategoriesMenuOpen(false);
                    }}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-montserrat font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4 text-[#0A006E]" />
                        <span>Exit Fullscreen</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4 text-[#0A006E]" />
                        <span>Full Screen</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCategoriesMenuOpen(false);
                    onSwitchToErp();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-between shadow-md transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#FFDE00]" />
                    <span>Switch to VAAIRO ERP Admin &amp; POS Portal</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#FFDE00]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          WEBSITE BOTTOM NAVIGATION BAR (Categories Aligned on the Right Side)
          ===================================================================== */}
      <nav
        aria-label="Storefront Bottom Navigation"
        className="sticky bottom-0 inset-x-0 z-40 bg-white text-slate-600 shadow-[0_-6px_24px_rgba(15,23,42,0.08)]"
      >
        {/* Single Wave Design at the top edge (Matching ERP Bottom Nav) */}
        <div className="absolute left-0 right-0 -top-6 w-full leading-none pointer-events-none z-20">
          <svg
            viewBox="0 0 1200 60"
            preserveAspectRatio="none"
            className="w-full h-6 block drop-shadow-[0_-5px_10px_rgba(0,0,0,0.06)]"
          >
            {/* White wave body matching bottom nav */}
            <path
              d="M0,61 L1200,61 L1200,42 C750,4 350,56 0,26 Z"
              fill="#ffffff"
            />
            {/* Golden Yellow Wave Stroke */}
            <path
              d="M0,26 C350,56 750,4 1200,42"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Desktop Bottom Nav: Categories Aligned on the Right Side */}
        <div className="hidden md:flex max-w-7xl mx-auto px-6 h-20 items-center justify-between gap-4 relative z-30">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('ALL');
                setSearchQuery('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Wine className="w-4 h-4 text-[#0A006E]" />
              <span>Shop Top</span>
            </button>
          </div>

          {/* Categories Aligned on the Right Side */}
          <div className="flex items-center justify-end gap-2 ml-auto overflow-x-auto scrollbar-none py-1">
            {DRINK_CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`px-3.5 py-2 rounded-xl font-montserrat font-bold text-xs whitespace-nowrap shrink-0 transition cursor-pointer ${
                    active
                      ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs ring-2 ring-[#FFDE00]'
                      : 'bg-slate-100 hover:bg-[#FFDE00] text-slate-700 hover:text-[#0A006E]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCategoriesMenuOpen(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
                isCategoriesMenuOpen
                  ? 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]'
                  : 'bg-[#0A006E] hover:bg-[#FFDE00] text-white hover:text-[#0A006E]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>All Categories</span>
            </button>
          </div>
        </div>

        {/* Mobile Bottom Nav: Categories Positioned on the Far Right Side */}
        <div className="md:hidden grid grid-cols-5 h-16 px-2 items-center relative z-30">
          {/* 1. Shop / All Drinks (Left) */}
          <button
            type="button"
            onClick={() => {
              setActiveCategory('ALL');
              setSearchQuery('');
              setIsCategoriesMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#0A006E] transition cursor-pointer h-full"
          >
            <Wine className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] font-montserrat font-bold">Shop</span>
          </button>

          {/* 2. My Deliveries (Inside Logged-In User Account) */}
          <button
            type="button"
            onClick={() => {
              setIsCategoriesMenuOpen(false);
              setIsEditingCustomerProfile(false);
              setIsCustomerLoginModalOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 relative text-slate-500 hover:text-[#0A006E] transition cursor-pointer h-full"
          >
            <div className="relative">
              <Truck className="w-5 h-5 text-slate-500" />
              {customerProfile && onHoldDeliveryOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-600 text-white text-[9px] font-mono font-black flex items-center justify-center">
                  {onHoldDeliveryOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-montserrat font-bold">My Order</span>
          </button>

          {/* 3. Center Icon — Big Round Floating Blue Design with Glow & Shimmer Effect */}
          <div className="flex flex-col items-center justify-center relative">
            {/* Outer Subtle Pulse Glow Ring */}
            <span className="absolute -top-6 w-14 h-14 rounded-full bg-[#0A006E]/30 animate-ping pointer-events-none" />
            <button
              type="button"
              onClick={() => {
                setIsCategoriesMenuOpen(false);
                if (isSearchPinnedToHeader && headerSearchInputRef.current) {
                  headerSearchInputRef.current.focus();
                } else {
                  searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => searchInputRef.current?.focus(), 250);
                }
              }}
              aria-label="Search Drinks"
              className="relative overflow-hidden w-14 h-14 -mt-6 rounded-full bg-linear-to-tr from-[#0A006E] via-[#12088F] to-[#1E3A8A] hover:from-[#12088F] hover:to-[#2563EB] text-white border-2 border-[#FFDE00] ring-4 ring-white shadow-[0_-6px_20px_rgba(10,0,110,0.45)] hover:shadow-[0_0_24px_rgba(255,222,0,0.65)] flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group"
            >
              <div className="silent-scanner-beam-fast" />
              <Search className="w-6 h-6 text-[#FFDE00] group-hover:text-white stroke-[2.4] drop-shadow-xs relative z-10 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-[8px] font-montserrat font-black text-white group-hover:text-[#FFDE00] leading-none relative z-10 tracking-wider uppercase">
                Search
              </span>
            </button>
          </div>

          {/* 4. Delivery Cart */}
          <button
            type="button"
            onClick={() => {
              setIsCategoriesMenuOpen(false);
              setIsCartDrawerOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 relative text-slate-500 hover:text-[#0A006E] transition cursor-pointer h-full"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-slate-500" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#0A006E] text-[#FFDE00] text-[9px] font-mono font-black flex items-center justify-center">
                  {totalCartItems}
                </span>
              )}
            </div>
            <span className="text-[10px] font-montserrat font-bold">Cart</span>
          </button>

          {/* 5. Categories Menu */}
          <button
            type="button"
            onClick={() => setIsCategoriesMenuOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center gap-1 transition cursor-pointer h-full ${
              isCategoriesMenuOpen ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
            }`}
          >
            <LayoutGrid className={`w-5 h-5 ${isCategoriesMenuOpen ? 'text-[#0A006E]' : 'text-slate-500'}`} />
            <span className="text-[10px] font-montserrat font-bold">Categories</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
