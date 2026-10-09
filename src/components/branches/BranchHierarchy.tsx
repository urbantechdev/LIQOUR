import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { Branch, BranchMarketClassTier, BranchTier } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import {
  BRANCH_MARKET_CLASS_PRESETS,
  DELIVERY_ZONE_GEO_DIRECTORY,
  inferBranchMarketClassFromLocation,
  resolveBranchGeoProfile,
  resolveBranchProductPrice
} from '../../utils/branchGeoRouting';
import { 
  Network, 
  Building2, 
  Warehouse, 
  Store, 
  Layers, 
  Plus, 
  Sliders, 
  ShieldAlert, 
  ArrowDown, 
  ArrowRight, 
  Check, 
  Edit3,
  MapPin,
  Phone,
  UserCheck,
  UserPlus,
  KeyRound,
  CheckCircle2,
  Navigation,
  LocateFixed,
  Menu,
  X,
  Tag,
  Search
} from 'lucide-react';
import { StaffActionButtons, StaffStatusBadge } from '../common/StaffLifecycleActionsModal';

export const BranchHierarchy: React.FC = () => {
  const { 
    branches, 
    addBranch, 
    updateBranchParent,
    updateBranchThreshold,
    getBranchProductPrice,
    updateBranchPricingPolicy,
    setBranchProductPreferredPrice,
    currentRole, 
    currentDepartment,
    switchBranch, 
    activeBranchId,
    inventoryItems,
    products,
    employees,
    addEmployee,
    updateEmployeePin
  } = useErp();

  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [editingThresholdBranch, setEditingThresholdBranch] = useState<Branch | null>(null);
  const [newThresholdValue, setNewThresholdValue] = useState<number>(50000);

  // Branch Preferred Pricing & Market-Class Modal State
  const [pricingModalBranchId, setPricingModalBranchId] = useState<string | null>(null);
  const [pricingModalTab, setPricingModalTab] = useState<'BRANCH_OVERRIDES' | 'CLASS_COMPARISON'>('BRANCH_OVERRIDES');
  const [pricingSearchQuery, setPricingSearchQuery] = useState('');
  const [draftProductPrices, setDraftProductPrices] = useState<Record<string, { retail?: string; wholesale?: string }>>({});
  const [pricingFeedback, setPricingFeedback] = useState<string | null>(null);

  // Counter Cashier Creation & 6-Digit PIN state (Branch Manager & Admin)
  const canCreateCounterCashier = currentRole === 'SUPER_ADMIN' || currentDepartment === 'BRANCH_MANAGER';
  const [showCreateCashierForm, setShowCreateCashierForm] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [cashierCode, setCashierCode] = useState('');
  const [cashierBranchId, setCashierBranchId] = useState(branches[0]?.id || '');
  const [cashierCommissionRate, setCashierCommissionRate] = useState<number>(3);
  const [cashierMpesa, setCashierMpesa] = useState('2547');
  const [cashierPin, setCashierPin] = useState('');
  const [cashierFeedback, setCashierFeedback] = useState<string | null>(null);
  const [cashierError, setCashierError] = useState<string | null>(null);
  const [editingCashierPinId, setEditingCashierPinId] = useState<string | null>(null);
  const [editingCashierPinVal, setEditingCashierPinVal] = useState('');

  const isBranchScopedManager = currentRole !== 'SUPER_ADMIN';
  const allowedBranchIds = React.useMemo(() => {
    if (!isBranchScopedManager) {
      return new Set(branches.map(b => b.id));
    }
    const set = new Set<string>([activeBranchId]);
    branches.forEach(b => {
      if (b.parentBranchId === activeBranchId) {
        set.add(b.id);
      }
    });
    return set;
  }, [isBranchScopedManager, branches, activeBranchId]);

  const counterCashiers = employees.filter(
    e => e.department === 'POS' && e.active && (!isBranchScopedManager || allowedBranchIds.has(e.branchId))
  );

  const handleCreateCounterCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashierError(null);
    if (!cashierName.trim()) {
      setCashierError('Please enter the Counter Cashier full name.');
      return;
    }
    const cleanPin = cashierPin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setCashierError('Branch Manager or Admin must issue a 6-digit numeric Login PIN for the Counter Cashier.');
      return;
    }

    const targetBranchId = isBranchScopedManager
      ? activeBranchId
      : cashierBranchId || branches[0]?.id || activeBranchId;
    try {
      const created = await addEmployee({
        name: cashierName.trim(),
        employeeNumber: cashierCode.trim().toUpperCase() || `CSH-${(counterCashiers.length + 101).toString()}`,
        roleTitle: 'Counter Cashier (Casual • Commission)',
        department: 'POS',
        employmentType: 'CASUAL',
        compensationModel: 'COMMISSION_ONLY',
        commissionRatePercent: cashierCommissionRate || 3,
        branchId: targetBranchId,
        loginPin: cleanPin,
        basicSalaryKes: 0,
        houseAllowanceKes: 0,
        transportAllowanceKes: 0,
        kraPin: 'A009182736Z',
        nssfNumber: `NSSF-${Date.now().toString().slice(-5)}`,
        nhifShifNumber: `SHIF-${Date.now().toString().slice(-5)}`,
        bankName: 'Equity Bank Kenya',
        bankAccount: '018029384710',
        mPesaNumber: cashierMpesa.trim() || '254722000000',
        active: true
      });

      setCashierFeedback(
        `Counter Cashier "${created.name}" (${created.employeeNumber}) created by ${currentDepartment === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Admin'} and issued 6-Digit Login PIN: ${cleanPin}`
      );
      setTimeout(() => setCashierFeedback(null), 5000);
      setCashierName('');
      setCashierCode('');
      setCashierPin('');
      setShowCreateCashierForm(false);
    } catch (err) {
      setCashierError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  // New branch form state
  const [presetCategory, setPresetCategory] = useState<'LIQUOR_SHOP' | 'DISTRIBUTOR' | 'STORE' | 'WAREHOUSE'>('LIQUOR_SHOP');
  const [branchNumber, setBranchNumber] = useState<number>(1);
  const [name, setName] = useState('Liquor Shop 1');
  const [code, setCode] = useState('LS-01');
  const [tier, setTier] = useState<BranchTier>('LIQUOR_STORE');
  const [location, setLocation] = useState('Nairobi CBD');
  const [county, setCounty] = useState('Nairobi');
  const [contactPhone, setContactPhone] = useState('+254 722 100 001');
  const [kraPin, setKraPin] = useState('P051982736Z');
  const [managerName, setManagerName] = useState('');
  const [minWholesaleThresholdKes, setMinWholesaleThresholdKes] = useState(50000);
  const [selectedServiceZone, setSelectedServiceZone] = useState<string>(
    DELIVERY_ZONE_GEO_DIRECTORY[0].label
  );
  const [branchLat, setBranchLat] = useState<string>(
    String(DELIVERY_ZONE_GEO_DIRECTORY[0].latitude)
  );
  const [branchLng, setBranchLng] = useState<string>(
    String(DELIVERY_ZONE_GEO_DIRECTORY[0].longitude)
  );
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState<number>(15);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [newBranchMarketClass, setNewBranchMarketClass] = useState<BranchMarketClassTier>(
    DELIVERY_ZONE_GEO_DIRECTORY[0].defaultMarketClassTier || 'AFFLUENT_PREMIUM'
  );
  const [newBranchPriceMultiplier, setNewBranchPriceMultiplier] = useState<number>(
    DELIVERY_ZONE_GEO_DIRECTORY[0].defaultPriceMultiplierPercent ?? 15
  );

  const handleSelectServiceZonePreset = (zoneLabel: string) => {
    setSelectedServiceZone(zoneLabel);
    const zoneObj = DELIVERY_ZONE_GEO_DIRECTORY.find(z => z.label === zoneLabel);
    if (zoneObj) {
      setLocation(zoneObj.label);
      setCounty(zoneObj.county);
      setBranchLat(String(zoneObj.latitude));
      setBranchLng(String(zoneObj.longitude));
      setMaxDeliveryRadiusKm(zoneObj.defaultRadiusKm);
      if (zoneObj.defaultMarketClassTier) {
        setNewBranchMarketClass(zoneObj.defaultMarketClassTier);
      }
      if (zoneObj.defaultPriceMultiplierPercent !== undefined) {
        setNewBranchPriceMultiplier(zoneObj.defaultPriceMultiplierPercent);
      }
    }
  };

  const handleDetectCurrentGpsForBranch = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBranchLat(pos.coords.latitude.toFixed(6));
        setBranchLng(pos.coords.longitude.toFixed(6));
        setIsDetectingGps(false);
      },
      () => {
        setIsDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Group branches by rigid tiers:
  // - Tier 1: Central Storage Warehouses (Head Office Storage)
  // - Tier 2: Main Branch (Head Office)
  // - Tier 3: Branches (Merchants operating under Main Branch Head Office)
  // - Tier 4: Shops (Retail Liquor Outlets strictly created under a Branch)
  const visibleBranches = isBranchScopedManager
    ? branches.filter(b => allowedBranchIds.has(b.id))
    : branches;
  const warehouses = visibleBranches.filter(b => b.tier === 'WAREHOUSE');
  const mainStores = visibleBranches.filter(b => b.tier === 'MAIN_STORE');
  const distributors = visibleBranches.filter(b => b.tier === 'DISTRIBUTOR');
  const liquorStores = visibleBranches.filter(b => b.tier === 'LIQUOR_STORE');
  const parentEligibleBranches = [...distributors, ...mainStores];
  const headOfficeMainBranch = mainStores[0] || branches[0];

  const [selectedParentBranchId, setSelectedParentBranchId] = useState<string>(
    distributors[0]?.id || mainStores[0]?.id || ''
  );

  const applyBranchPreset = (
    category: 'LIQUOR_SHOP' | 'DISTRIBUTOR' | 'STORE' | 'WAREHOUSE',
    num: number,
    explicitParentBranch?: Branch
  ) => {
    setPresetCategory(category);
    setBranchNumber(num);
    const padded = String(num).padStart(2, '0');
    if (category === 'LIQUOR_SHOP') {
      const targetParent =
        explicitParentBranch ||
        branches.find(b => b.id === selectedParentBranchId && (b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE')) ||
        distributors[0] ||
        mainStores[0];
      setTier('LIQUOR_STORE');
      if (targetParent) {
        setSelectedParentBranchId(targetParent.id);
        const parentShort = targetParent.name
          .replace(/\s*\(Merchant\)|\s*\(Head Office\)/gi, '')
          .trim();
        setName(`${parentShort} — Shop ${num}`);
        setLocation(targetParent.location || location);
        setCounty(targetParent.county || county);
        if (targetParent.marketClassTier) {
          setNewBranchMarketClass(targetParent.marketClassTier);
        }
        if (targetParent.priceMultiplierPercent !== undefined) {
          setNewBranchPriceMultiplier(targetParent.priceMultiplierPercent);
        }
      } else {
        setName(`Liquor Shop ${num}`);
      }
      setCode(`SHP-${padded}`);
    } else if (category === 'DISTRIBUTOR') {
      setTier('DISTRIBUTOR');
      setSelectedParentBranchId(headOfficeMainBranch?.id || '');
      setName(`Branch ${num} (Merchant)`);
      setCode(`BR-MRC-${padded}`);
    } else if (category === 'STORE') {
      setTier('MAIN_STORE');
      setSelectedParentBranchId('');
      setName(num === 1 ? 'Main Branch (Head Office)' : `Main Branch ${num} (Head Office)`);
      setCode(`MB-HQ-${padded}`);
    } else {
      setTier('WAREHOUSE');
      setSelectedParentBranchId(headOfficeMainBranch?.id || '');
      setName(`Head Office Warehouse ${num}`);
      setCode(`WH-HQ-${padded}`);
    }
  };

  const openCreateShopUnderBranch = (parentBranch: Branch) => {
    const childCount = liquorStores.filter(s => s.parentBranchId === parentBranch.id).length;
    setSelectedParentBranchId(parentBranch.id);
    applyBranchPreset('LIQUOR_SHOP', childCount + 1, parentBranch);
    setIsAddBranchOpen(true);
    setIsHeroMenuOpen(false);
  };

  const canEditRules = currentRole === 'SUPER_ADMIN' || currentDepartment === 'BRANCH_MANAGER';

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    const parsedLat = parseFloat(branchLat);
    const parsedLng = parseFloat(branchLng);

    const resolvedParentBranch =
      tier === 'LIQUOR_STORE'
        ? parentEligibleBranches.find(b => b.id === selectedParentBranchId) ||
          distributors[0] ||
          mainStores[0]
        : tier === 'DISTRIBUTOR' || tier === 'WAREHOUSE'
        ? headOfficeMainBranch
        : undefined;

    try {
      await addBranch({
        name,
        code: code.toUpperCase(),
        tier,
        isHeadOffice: tier === 'MAIN_STORE',
        parentBranchId: resolvedParentBranch?.id,
        parentBranchName: resolvedParentBranch?.name,
        location,
        county,
        contactPhone,
        kraPin,
        managerName:
          managerName ||
          (tier === 'MAIN_STORE'
            ? 'Head Office Director'
            : tier === 'DISTRIBUTOR'
            ? 'Branch Merchant Manager'
            : 'Shop Manager'),
        allowDirectSales: tier !== 'WAREHOUSE',
        minWholesaleThresholdKes: tier === 'MAIN_STORE' ? minWholesaleThresholdKes : undefined,
        latitude: !Number.isNaN(parsedLat) ? parsedLat : undefined,
        longitude: !Number.isNaN(parsedLng) ? parsedLng : undefined,
        maxDeliveryRadiusKm: maxDeliveryRadiusKm || 15,
        deliveryZones: selectedServiceZone ? [selectedServiceZone] : undefined,
        marketClassTier: newBranchMarketClass,
        priceMultiplierPercent: newBranchPriceMultiplier,
        preferredProductPrices: {}
      });

      setIsAddBranchOpen(false);
      applyBranchPreset(presetCategory, branchNumber + 1);
    } catch {
      // Global persistence error banner is automatically shown by ErpContext
    }
  };

  const handleUpdateThresholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThresholdBranch) return;
    updateBranchThreshold(editingThresholdBranch.id, newThresholdValue);
    setEditingThresholdBranch(null);
  };

  const getBranchStockValue = (branchId: string) => {
    const items = inventoryItems.filter(i => i.branchId === branchId);
    let val = 0;
    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        val += item.bottlesOnHand * prod.warehouseCostKes;
      }
    }
    return val;
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Add Branch */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        {/* Text Above + Mobile Hamburger Trigger */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-md shrink-0">
              <Network className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                Main Branch (Head Office) • Branches (Merchants) • Shops Hierarchy
              </h2>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 mt-0.5 sm:mt-1 max-w-2xl font-semibold">
                <strong>Main Branch is the Head Office.</strong> Branches are the <strong>Merchants</strong> operating under Head Office, and <strong>Shops are only created under a Branch</strong>.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Distribution Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Menu Below — Collapsed Inside Hamburger on Mobile, Visible on Desktop */}
        <div
          className={`${
            isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex-col lg:flex-row lg:items-center justify-between gap-3 animate-in fade-in`}
        >
          <div className="bg-white/90 p-2 rounded-2xl border border-[#0A006E]/15 shadow-2xs space-y-1.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <span className="block sm:inline text-[10px] sm:text-xs text-[#0A006E] font-montserrat font-black uppercase tracking-wider px-1">
              Quick Create:
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('DISTRIBUTOR', distributors.length + 1);
                  setIsAddBranchOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-400 text-xs font-montserrat font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>+ Branch {distributors.length + 1} (Merchant)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaultParent = distributors[0] || mainStores[0];
                  applyBranchPreset('LIQUOR_SHOP', liquorStores.length + 1, defaultParent);
                  setIsAddBranchOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-[#1E9E60] border border-[#34D186]/30 text-xs font-montserrat font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Store className="w-3.5 h-3.5 shrink-0" />
                <span>+ Shop {liquorStores.length + 1} (Under a Branch)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('STORE', mainStores.length + 1);
                  setIsAddBranchOpen(true);
                  setIsHeroMenuOpen(false);
                }}
                className="px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#0A006E] border border-[#0A006E]/30 text-xs font-montserrat font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>+ Main Branch (Head Office)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const targetId = activeBranchId || branches[0]?.id || 'CLASS_MATRIX_PREVIEW';
                setPricingModalBranchId(targetId);
                setPricingModalTab(branches.length > 0 ? 'BRANCH_OVERRIDES' : 'CLASS_COMPARISON');
                setIsHeroMenuOpen(false);
              }}
              className="px-4 py-3 sm:py-2.5 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Tag className="w-4 h-4 text-[#1E9E60] shrink-0" />
              <span>Branch Preferred Pricing (Donholm vs Kilimani / Westlands)</span>
            </button>

            <button
              onClick={() => {
                applyBranchPreset('DISTRIBUTOR', distributors.length + 1);
                setIsAddBranchOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-5 py-3 sm:py-2.5 bg-[#0A006E] hover:bg-[#060046] text-white rounded-xl font-montserrat font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-sm shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span>Create Branch (Merchant) or Shop Under Branch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Counter Cashiers Management Panel — Created by Branch Manager or Admin */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/20 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-[#0A006E]">
                  Counter Cashiers &amp; 6-Digit Login PINs ({counterCashiers.length})
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[10px] uppercase">
                  Created by Branch Manager or Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Counter Cashiers are created by the <strong>Branch Manager</strong> or <strong>Admin</strong> and issued with a <strong>6-Digit Login PIN</strong> to sign in to the POS Terminal.
              </p>
            </div>
          </div>

          {canCreateCounterCashier && (
            <button
              type="button"
              onClick={() => {
                if (!cashierBranchId && branches[0]?.id) {
                  setCashierBranchId(branches[0].id);
                }
                setShowCreateCashierForm(prev => !prev);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showCreateCashierForm ? 'Close Form' : '+ Create Counter Cashier & Issue 6-Digit PIN'}</span>
            </button>
          )}
        </div>

        {cashierFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cashierFeedback}</span>
          </div>
        )}

        {showCreateCashierForm && canCreateCounterCashier && (
          <form onSubmit={handleCreateCounterCashier} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            {cashierError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {cashierError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Counter Cashier Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={cashierName}
                  onChange={e => setCashierName(e.target.value)}
                  placeholder="e.g. Mercy Wanjiku"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cashier ID
                </label>
                <input
                  type="text"
                  value={cashierCode}
                  onChange={e => setCashierCode(e.target.value.toUpperCase())}
                  placeholder={`CSH-${counterCashiers.length + 101}`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Assigned Branch *
                </label>
                <select
                  value={cashierBranchId}
                  onChange={e => setCashierBranchId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  {branches.length === 0 ? (
                    <option value="">No Branch Created Yet (Create Branch First)</option>
                  ) : (
                    branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={cashierCommissionRate}
                  onChange={e => setCashierCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-montserrat font-black text-[#0A006E]">
                    6-Digit PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                      setCashierPin(randomPin);
                      setCashierError(null);
                    }}
                    className="text-[10px] font-montserrat font-black text-[#1E9E60] hover:underline"
                  >
                    Generate
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={cashierPin}
                  onChange={e => {
                    setCashierPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setCashierError(null);
                  }}
                  placeholder="e.g. 482910"
                  className="w-full px-3 py-2 bg-[#FFDE00]/20 border-2 border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E] tracking-widest"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span>M-Pesa Number:</span>
                <input
                  type="text"
                  value={cashierMpesa}
                  onChange={e => setCashierMpesa(e.target.value)}
                  placeholder="254722000000"
                  className="w-36 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Counter Cashier &amp; Issue PIN</span>
              </button>
            </div>
          </form>
        )}

        {counterCashiers.length === 0 ? (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-dashed border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong className="font-montserrat font-black">No Counter Cashiers Created Yet.</strong> Counter Cashiers must be created by the <strong>Branch Manager</strong> or <strong>Admin</strong> and issued with a 6-digit Login PIN.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {counterCashiers.map(csh => {
              const assignedBranch = branches.find(b => b.id === csh.branchId);
              return (
                <div key={csh.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-montserrat font-black text-slate-900 truncate">{csh.name}</span>
                        <StaffStatusBadge
                          status={csh.employmentStatus}
                          active={csh.active}
                          reason={csh.suspensionReason || csh.terminationReason}
                          compact
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {csh.employeeNumber} • {assignedBranch ? assignedBranch.name : 'Unassigned Branch'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 font-montserrat font-black text-[10px] shrink-0">
                      {csh.commissionRatePercent ?? 3}% Comm.
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Login PIN:</span>
                      <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[11px] tracking-widest">
                        {csh.loginPin || '------'}
                      </span>
                    </div>

                    {canCreateCounterCashier && (
                      editingCashierPinId === csh.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={editingCashierPinVal}
                            onChange={e => setEditingCashierPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6 digits"
                            className="w-20 px-2 py-1 bg-white border border-[#0A006E] rounded-lg font-mono font-bold text-[11px] text-center"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingCashierPinVal.length === 6) {
                                updateEmployeePin(csh.id, editingCashierPinVal);
                                setEditingCashierPinId(null);
                                setCashierFeedback(`Updated 6-Digit Login PIN for Counter Cashier ${csh.name} to ${editingCashierPinVal}`);
                                setTimeout(() => setCashierFeedback(null), 4000);
                              }
                            }}
                            disabled={editingCashierPinVal.length !== 6}
                            className="px-2 py-1 rounded-lg bg-[#34D186] text-white font-bold text-[10px] disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCashierPinId(null)}
                            className="px-1.5 py-1 text-slate-400 hover:text-slate-700 text-[10px] font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCashierPinId(csh.id);
                            setEditingCashierPinVal(csh.loginPin || '');
                          }}
                          className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                        >
                          Reset PIN
                        </button>
                      )
                    )}
                  </div>

                  {canCreateCounterCashier && (
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                      <StaffActionButtons
                        staff={csh}
                        compact
                        onActionComplete={msg => {
                          setCashierFeedback(msg);
                          setTimeout(() => setCashierFeedback(null), 4500);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Architectural Hierarchy Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 min-h-[260px] shadow-sm overflow-x-auto hover-card-lift">
        <h3 className="font-montserrat font-black text-xs text-slate-400 uppercase tracking-widest mb-6">
          Architectural Supply Chain Workflow
        </h3>

        <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 min-w-[700px]">
          
          {/* Tier 1: Head Office Storage */}
          <div className="flex-1 bg-purple-50/70 border-2 border-purple-200 rounded-2xl p-5 sm:p-6 text-center space-y-3 min-h-[170px] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-purple-200 text-purple-900 rounded-full font-montserrat">
                Head Office Storage • Fulfillment Only
              </span>
              <h4 className="font-montserrat font-black text-base text-purple-950 mt-2">
                Bonded Central Warehouse
              </h4>
              <p className="text-xs text-purple-800 mt-1">
                IPS &amp; LPS Master Storage at Head Office. No direct retail sales.
              </p>
            </div>
            <div className="text-xs text-purple-700 font-bold border-t border-purple-200/60 pt-2">
              {warehouses.length} Active Warehouse Facility
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-6 h-6 hidden md:block text-[#0A006E]" />
            <ArrowDown className="w-6 h-6 md:hidden text-[#0A006E]" />
            <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Head Office Supply</span>
          </div>

          {/* Tier 2: Main Branch (Head Office) */}
          <div className="flex-1 bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-5 sm:p-6 text-center space-y-3 min-h-[170px] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-200 text-blue-900 rounded-full font-montserrat">
                Head Office • Main Branch
              </span>
              <h4 className="font-montserrat font-black text-base text-blue-950 mt-2">
                Main Branch (Head Office)
              </h4>
              <p className="text-xs text-blue-800 mt-1">
                Central Head Office &amp; Primary Wholesale Hub overseeing all Merchant Branches.
              </p>
            </div>
            <div className="text-xs text-blue-700 font-bold border-t border-blue-200/60 pt-2">
              {mainStores.length} Main Branch (Head Office)
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-6 h-6 hidden md:block text-[#0A006E]" />
            <ArrowDown className="w-6 h-6 md:hidden text-[#0A006E]" />
            <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Merchant Branches</span>
          </div>

          {/* Tier 3: Branches = Merchants */}
          <div className="flex-1 bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 text-center space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-montserrat">
                Branches = Merchants
              </span>
              <h4 className="font-montserrat font-black text-sm text-amber-950 mt-2">
                Branches (Merchants)
              </h4>
              <p className="text-[11px] text-amber-800 mt-1">
                Every Branch is a Merchant under Main Branch (Head Office) and hosts its own Retail Shops.
              </p>
            </div>
            <div className="text-[10px] text-amber-700 font-bold border-t border-amber-200/60 pt-2">
              {distributors.length} Branch Merchant(s)
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-6 h-6 hidden md:block text-[#0A006E]" />
            <ArrowDown className="w-6 h-6 md:hidden text-[#0A006E]" />
            <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Shops Under Branch</span>
          </div>

          {/* Tier 4: Shops Under a Branch */}
          <div className="flex-1 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl p-4 text-center space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-montserrat">
                Created Under a Branch
              </span>
              <h4 className="font-montserrat font-black text-sm text-emerald-950 mt-2">
                Shops (Liquor Outlets)
              </h4>
              <p className="text-[11px] text-emerald-800 mt-1">
                Shops are strictly created under a Branch (Merchant or Main Branch Head Office).
              </p>
            </div>
            <div className="text-[10px] text-emerald-700 font-bold border-t border-emerald-200/60 pt-2">
              {liquorStores.length} Shop(s) Under Branches
            </div>
          </div>

        </div>
      </div>

      {/* Detailed Branch Hierarchy Grids by Tier */}
      <div className="space-y-6">
        
        {/* SECTION 1: WAREHOUSES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-montserrat font-black text-sm text-purple-950 uppercase tracking-wide flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-purple-800" />
              <span>Tier 1: Central Storage Warehouses (Fulfillment Only)</span>
            </h3>
            <span className="text-xs text-slate-500">{warehouses.length} locations</span>
          </div>

          {warehouses.length === 0 ? (
            <div className="p-5 rounded-2xl bg-purple-50/40 border border-dashed border-purple-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950">
              <div>
                <div className="font-montserrat font-black text-sm">No Central Storage Warehouses Created Yet</div>
                <p className="text-purple-800 mt-0.5">All branches and warehouses must be created by you. Click to create your first Warehouse.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('WAREHOUSE', 1);
                  setIsAddBranchOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple-950 text-white font-montserrat font-bold text-xs shrink-0 hover:bg-purple-900 transition"
              >
                + Create Warehouse 1
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  isActive={branch.id === activeBranchId}
                  onSelect={() => switchBranch(branch.id)}
                  stockValue={getBranchStockValue(branch.id)}
                  canEdit={canEditRules}
                  onEditThreshold={() => {
                    setEditingThresholdBranch(branch);
                    setNewThresholdValue(branch.minWholesaleThresholdKes || 50000);
                  }}
                  onOpenBranchPricing={() => {
                    setPricingModalBranchId(branch.id);
                    setPricingModalTab('BRANCH_OVERRIDES');
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2: MAIN BRANCH (HEAD OFFICE) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-montserrat font-black text-sm text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#0A006E]" />
              <span>Main Branch — Head Office (Central Wholesale &amp; Merchant Governance)</span>
            </h3>
            <span className="text-xs text-slate-500">{mainStores.length} Head Office Main Branch</span>
          </div>

          {mainStores.length === 0 ? (
            <div className="p-5 rounded-2xl bg-blue-50/40 border border-dashed border-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
              <div>
                <div className="font-montserrat font-black text-sm">No Main Branch (Head Office) Created Yet</div>
                <p className="text-blue-800 mt-0.5">Main Branch is the Head Office overseeing all Merchant Branches and Shops.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('STORE', 1);
                  setIsAddBranchOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#0A006E] text-white font-montserrat font-bold text-xs shrink-0 hover:bg-[#060046] transition"
              >
                + Create Main Branch (Head Office)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mainStores.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  allBranches={branches}
                  childShops={liquorStores.filter(s => s.parentBranchId === branch.id)}
                  isActive={branch.id === activeBranchId}
                  onSelect={() => switchBranch(branch.id)}
                  onSelectBranchId={switchBranch}
                  stockValue={getBranchStockValue(branch.id)}
                  canEdit={canEditRules}
                  onEditThreshold={() => {
                    setEditingThresholdBranch(branch);
                    setNewThresholdValue(branch.minWholesaleThresholdKes || 50000);
                  }}
                  onOpenBranchPricing={() => {
                    setPricingModalBranchId(branch.id);
                    setPricingModalTab('BRANCH_OVERRIDES');
                  }}
                  onCreateShopUnderBranch={() => openCreateShopUnderBranch(branch)}
                  onChangeParentBranch={updateBranchParent}
                />
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: BRANCHES (MERCHANTS) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-montserrat font-black text-sm text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-700" />
                <span>Branches (Merchants — Operating Under Main Branch Head Office)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Branches are the Merchants. Create a Branch (Merchant) here, then create Retail Shops directly under that Branch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{distributors.length} Branch Merchant(s)</span>
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('DISTRIBUTOR', distributors.length + 1);
                  setIsAddBranchOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-bold text-xs hover:bg-[#060046] transition cursor-pointer"
              >
                + New Branch (Merchant)
              </button>
            </div>
          </div>

          {distributors.length === 0 ? (
            <div className="p-5 rounded-2xl bg-amber-50/50 border border-dashed border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div>
                <div className="font-montserrat font-black text-sm">No Merchant Branches Created Yet</div>
                <p className="text-amber-800 mt-0.5">
                  Branches are the Merchants (e.g. Kilimani Branch, Westlands Branch, Donholm Branch) operating under Main Branch (Head Office). Create your first Branch (Merchant) so you can create Shops under it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  applyBranchPreset('DISTRIBUTOR', 1);
                  setIsAddBranchOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-900 text-[#FFDE00] font-montserrat font-bold text-xs shrink-0 hover:bg-amber-950 transition cursor-pointer"
              >
                + Create Branch 1 (Merchant)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {distributors.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  allBranches={branches}
                  childShops={liquorStores.filter(s => s.parentBranchId === branch.id)}
                  isActive={branch.id === activeBranchId}
                  onSelect={() => switchBranch(branch.id)}
                  onSelectBranchId={switchBranch}
                  stockValue={getBranchStockValue(branch.id)}
                  canEdit={canEditRules}
                  onEditThreshold={() => {
                    setEditingThresholdBranch(branch);
                    setNewThresholdValue(branch.minWholesaleThresholdKes || 50000);
                  }}
                  onOpenBranchPricing={() => {
                    setPricingModalBranchId(branch.id);
                    setPricingModalTab('BRANCH_OVERRIDES');
                  }}
                  onCreateShopUnderBranch={() => openCreateShopUnderBranch(branch)}
                  onChangeParentBranch={updateBranchParent}
                />
              ))}
            </div>
          )}
        </div>

        {/* SECTION 4: SHOPS (CREATED STRICTLY UNDER A BRANCH) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-montserrat font-black text-sm text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#1E9E60]" />
                <span>Shops (Retail Liquor Outlets — Created Strictly Under a Branch)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Every Shop belongs to and is created under a Branch (Merchant) or the Main Branch (Head Office).
              </p>
            </div>
            <span className="text-xs text-slate-500">{liquorStores.length} Shop(s)</span>
          </div>

          {liquorStores.length === 0 ? (
            <div className="p-5 rounded-2xl bg-emerald-50/50 border border-dashed border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
              <div>
                <div className="font-montserrat font-black text-sm">No Shops Created Under a Branch Yet</div>
                <p className="text-emerald-800 mt-0.5">
                  Shops are only created under a Branch (Merchant or Main Branch Head Office). Click below to create a Shop under{' '}
                  <strong>{(distributors[0] || mainStores[0])?.name || 'Main Branch (Head Office)'}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaultParent = distributors[0] || mainStores[0];
                  if (defaultParent) {
                    openCreateShopUnderBranch(defaultParent);
                  } else {
                    applyBranchPreset('DISTRIBUTOR', 1);
                    setIsAddBranchOpen(true);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#34D186] text-[#FFDE00] font-montserrat font-bold text-xs shrink-0 hover:bg-emerald-950 transition cursor-pointer"
              >
                + Create Shop 1 Under {(distributors[0] || mainStores[0])?.name || 'Branch'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liquorStores.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  allBranches={branches}
                  childShops={[]}
                  isActive={branch.id === activeBranchId}
                  onSelect={() => switchBranch(branch.id)}
                  onSelectBranchId={switchBranch}
                  stockValue={getBranchStockValue(branch.id)}
                  canEdit={canEditRules}
                  onEditThreshold={() => {
                    setEditingThresholdBranch(branch);
                    setNewThresholdValue(branch.minWholesaleThresholdKes || 50000);
                  }}
                  onOpenBranchPricing={() => {
                    setPricingModalBranchId(branch.id);
                    setPricingModalTab('BRANCH_OVERRIDES');
                  }}
                  onChangeParentBranch={updateBranchParent}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Threshold Editor Modal */}
      {editingThresholdBranch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="font-montserrat font-black text-lg text-slate-900 mb-1">
              Configure Wholesale Minimum Threshold
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Super Admin pricing rule override for <strong className="text-slate-800">{editingThresholdBranch.name}</strong>.
            </p>

            <form onSubmit={handleUpdateThresholdSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Minimum Order Amount Threshold (KES)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">
                    KES
                  </span>
                  <input
                    type="number"
                    step={5000}
                    value={newThresholdValue}
                    onChange={(e) => setNewThresholdValue(parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  POS orders below this value will be automatically blocked by the checkout engine.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingThresholdBranch(null)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0A006E] text-white rounded-lg text-xs font-montserrat font-bold hover:bg-[#060046]"
                >
                  Save Policy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Branch Modal */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in my-auto">
            <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-slate-900 mb-1">
              {tier === 'LIQUOR_STORE'
                ? 'Create Shop Under a Branch'
                : tier === 'DISTRIBUTOR'
                ? 'Create Branch (Merchant) Under Main Branch (Head Office)'
                : tier === 'MAIN_STORE'
                ? 'Create Main Branch (Head Office)'
                : 'Create Head Office Bonded Warehouse'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              <strong>Main Branch is the Head Office.</strong> Branches are the <strong>Merchants</strong>, and <strong>Shops are only created under a Branch</strong>.
            </p>

            {/* Quick Branch Preset Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                  Select Entity Type &amp; Number:
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => applyBranchPreset(presetCategory, n)}
                      className={`w-6 h-6 rounded-md font-mono font-bold text-xs transition ${
                        branchNumber === n
                          ? 'bg-[#0A006E] text-[#FFDE00]'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyBranchPreset('DISTRIBUTOR', branchNumber)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-montserrat font-bold transition ${
                    presetCategory === 'DISTRIBUTOR'
                      ? 'bg-[#0A006E] text-white border-[#0A006E]'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>Branch {branchNumber} (Merchant)</div>
                  <div className="text-[10px] font-mono opacity-75">BR-MRC-{String(branchNumber).padStart(2, '0')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyBranchPreset('LIQUOR_SHOP', branchNumber)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-montserrat font-bold transition ${
                    presetCategory === 'LIQUOR_SHOP'
                      ? 'bg-[#34D186] text-white border-[#34D186]'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>Shop {branchNumber} (Under Branch)</div>
                  <div className="text-[10px] font-mono opacity-75">SHP-{String(branchNumber).padStart(2, '0')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyBranchPreset('STORE', branchNumber)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-montserrat font-bold transition ${
                    presetCategory === 'STORE'
                      ? 'bg-[#0A006E] text-white border-[#0A006E]'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>Main Branch (HQ)</div>
                  <div className="text-[10px] font-mono opacity-75">MB-HQ-{String(branchNumber).padStart(2, '0')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyBranchPreset('WAREHOUSE', branchNumber)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-montserrat font-bold transition ${
                    presetCategory === 'WAREHOUSE'
                      ? 'bg-purple-950 text-white border-purple-950'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>HQ Warehouse {branchNumber}</div>
                  <div className="text-[10px] font-mono opacity-75">WH-HQ-{String(branchNumber).padStart(2, '0')}</div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hierarchy Role</label>
                <select
                  value={tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as BranchTier;
                    setTier(nextTier);
                    if (nextTier === 'LIQUOR_STORE' && !selectedParentBranchId) {
                      const defaultParent = distributors[0] || mainStores[0];
                      if (defaultParent) setSelectedParentBranchId(defaultParent.id);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="DISTRIBUTOR">Branch (Merchant — Operating Under Main Branch Head Office)</option>
                  <option value="LIQUOR_STORE">Shop (Retail Liquor Outlet — Created Strictly Under a Branch)</option>
                  <option value="MAIN_STORE">Main Branch (Head Office — Central Wholesale &amp; HQ)</option>
                  <option value="WAREHOUSE">Head Office Bonded Warehouse (Fulfillment Only, No Direct Sales)</option>
                </select>
              </div>

              {/* Mandatory Parent Branch Selector when creating a Shop */}
              {tier === 'LIQUOR_STORE' && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 border-2 border-[#0A006E] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-montserrat font-black text-[#0A006E]">
                      Parent Branch (Merchant / Head Office) * — Shops Are Only Created Under a Branch
                    </label>
                    <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                      Required
                    </span>
                  </div>
                  <select
                    required
                    value={selectedParentBranchId || (distributors[0] || mainStores[0])?.id || ''}
                    onChange={e => {
                      const parentId = e.target.value;
                      setSelectedParentBranchId(parentId);
                      const pBr = parentEligibleBranches.find(b => b.id === parentId);
                      if (pBr) {
                        setCounty(pBr.county || county);
                        setLocation(pBr.location || location);
                        if (pBr.marketClassTier) setNewBranchMarketClass(pBr.marketClassTier);
                        if (pBr.priceMultiplierPercent !== undefined) {
                          setNewBranchPriceMultiplier(pBr.priceMultiplierPercent);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#0A006E] rounded-lg text-xs font-montserrat font-bold text-slate-900"
                  >
                    {parentEligibleBranches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.tier === 'MAIN_STORE'
                          ? `[Head Office] ${b.name} (${b.code})`
                          : `[Branch • Merchant] ${b.name} (${b.code}) — ${b.location}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-700 font-semibold">
                    This Shop will operate under{' '}
                    <strong className="text-[#0A006E]">
                      {parentEligibleBranches.find(b => b.id === selectedParentBranchId)?.name ||
                        (distributors[0] || mainStores[0])?.name ||
                        'Main Branch (Head Office)'}
                    </strong>
                    .
                  </p>
                </div>
              )}

              {tier === 'DISTRIBUTOR' && (
                <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-950 font-semibold flex items-center justify-between gap-2">
                  <span>
                    <strong>Branch Role:</strong> Merchant operating under{' '}
                    <strong className="text-[#0A006E]">{headOfficeMainBranch?.name || 'Main Branch (Head Office)'}</strong>. You can create multiple Retail Shops under this Branch.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Eldoret Highland Wholesale Main Store"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MS-ELD-06"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">County</label>
                  <input
                    type="text"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    placeholder="Uasin Gishu"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Location Address</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    const inferred = inferBranchMarketClassFromLocation(`${name} ${e.target.value}`);
                    setNewBranchMarketClass(inferred.marketClassTier);
                    setNewBranchPriceMultiplier(inferred.priceMultiplierPercent);
                  }}
                  placeholder="e.g. Donholm Greenspan / Kilimani Argwings Kodhek / Westlands Square"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Neighbourhood Market Class & Branch Preferred Pricing Tier */}
              {tier !== 'WAREHOUSE' && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-montserrat font-black text-emerald-950">
                      <Tag className="w-3.5 h-3.5 text-[#1E9E60]" />
                      <span>Neighbourhood Market Class &amp; Branch Preferred Pricing</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800">
                      {newBranchPriceMultiplier > 0 ? `+${newBranchPriceMultiplier}%` : `${newBranchPriceMultiplier}%`} vs Baseline
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-900">
                    Tailor selling prices to the branch neighbourhood class (e.g. <strong>Donholm / Eastlands Value Class</strong> vs <strong>Kilimani / Westlands Prime Class</strong>). You can also customize individual product prices after creation.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewBranchMarketClass('EASTLANDS_ECONOMY');
                        setNewBranchPriceMultiplier(-10);
                      }}
                      className={`p-2 rounded-lg border text-left text-[11px] transition cursor-pointer ${
                        newBranchMarketClass === 'EASTLANDS_ECONOMY'
                          ? 'bg-[#0A006E] text-white border-[#0A006E]'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-[#0A006E]/40'
                      }`}
                    >
                      <div className="font-montserrat font-black">Donholm / Eastlands</div>
                      <div className="text-[10px] opacity-80">Value Class (-10%)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewBranchMarketClass('STANDARD_RESIDENTIAL');
                        setNewBranchPriceMultiplier(0);
                      }}
                      className={`p-2 rounded-lg border text-left text-[11px] transition cursor-pointer ${
                        newBranchMarketClass === 'STANDARD_RESIDENTIAL'
                          ? 'bg-[#0A006E] text-white border-[#0A006E]'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-[#0A006E]/40'
                      }`}
                    >
                      <div className="font-montserrat font-black">CBD / Standard</div>
                      <div className="text-[10px] opacity-80">Baseline Price (0%)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewBranchMarketClass('AFFLUENT_PREMIUM');
                        setNewBranchPriceMultiplier(15);
                      }}
                      className={`p-2 rounded-lg border text-left text-[11px] transition cursor-pointer ${
                        newBranchMarketClass === 'AFFLUENT_PREMIUM'
                          ? 'bg-[#0A006E] text-white border-[#0A006E]'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-[#0A006E]/40'
                      }`}
                    >
                      <div className="font-montserrat font-black">Kilimani / Westlands</div>
                      <div className="text-[10px] opacity-80">Prime Class (+15%)</div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                        Market Class Tier
                      </label>
                      <select
                        value={newBranchMarketClass}
                        onChange={e => {
                          const selectedTier = e.target.value as BranchMarketClassTier;
                          setNewBranchMarketClass(selectedTier);
                          const preset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === selectedTier);
                          if (preset && selectedTier !== 'CUSTOM') {
                            setNewBranchPriceMultiplier(preset.defaultMultiplierPercent);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        {BRANCH_MARKET_CLASS_PRESETS.map(p => (
                          <option key={p.tier} value={p.tier}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                        Default Branch Price Adjustment (%)
                      </label>
                      <input
                        type="number"
                        min={-40}
                        max={150}
                        step={1}
                        value={newBranchPriceMultiplier}
                        onChange={e => setNewBranchPriceMultiplier(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Website Nearest-Branch Geo-Routing & Delivery Service Zone Config */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-[#0A006E]/20 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-montserrat font-black text-[#0A006E]">
                    <Navigation className="w-3.5 h-3.5 text-[#0A006E]" />
                    <span>Website Nearest-Branch Geo-Routing &amp; Service Zone</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectCurrentGpsForBranch}
                    disabled={isDetectingGps}
                    className="px-2 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] text-[10px] font-montserrat font-bold flex items-center gap-1 hover:bg-[#060046] transition cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>{isDetectingGps ? 'Detecting...' : 'Use Live GPS'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Primary Delivery Service Zone (Maps Website Customers to Nearest Branch)
                  </label>
                  <select
                    value={selectedServiceZone}
                    onChange={e => handleSelectServiceZonePreset(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    {DELIVERY_ZONE_GEO_DIRECTORY.map(z => (
                      <option key={z.id} value={z.label}>
                        {z.label} ({z.county})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={branchLat}
                      onChange={e => setBranchLat(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={branchLng}
                      onChange={e => setBranchLng(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Max Radius (km)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={maxDeliveryRadiusKm}
                      onChange={e => setMaxDeliveryRadiusKm(parseFloat(e.target.value) || 15)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Manager Name</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="e.g. Kennedy Ruto"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {tier === 'MAIN_STORE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Wholesale Threshold (KES)
                  </label>
                  <input
                    type="number"
                    value={minWholesaleThresholdKes}
                    onChange={(e) => setMinWholesaleThresholdKes(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#0A006E] text-white rounded-lg text-xs font-montserrat font-bold hover:bg-[#060046]"
                >
                  Create &amp; Provision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Preferred Pricing & Market-Class Matrix Modal */}
      {pricingModalBranchId && (() => {
        const selectedBranch =
          branches.find(b => b.id === pricingModalBranchId) ||
          branches[0] || {
            id: 'preview-branch',
            name: 'Preview Branch',
            code: 'PRV-01',
            tier: 'LIQUOR_STORE' as BranchTier,
            location: 'Nairobi',
            county: 'Nairobi',
            contactPhone: '+254700000000',
            kraPin: 'P051982736Z',
            managerName: 'Branch Manager',
            allowDirectSales: true,
            marketClassTier: 'STANDARD_RESIDENTIAL' as BranchMarketClassTier,
            priceMultiplierPercent: 0,
            preferredProductPrices: {}
          };

        const filteredPricingProducts = products
          .filter(p => {
            if (!pricingSearchQuery.trim()) return true;
            const q = pricingSearchQuery.toLowerCase();
            return (
              p.name.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              (p.subCategory || '').toLowerCase().includes(q)
            );
          })
          .slice(0, 40);

        const customOverridesCount = Object.keys(selectedBranch.preferredProductPrices || {}).length;

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#0A006E] text-white p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#FFDE00] font-montserrat font-black uppercase tracking-wider">
                    <Tag className="w-4 h-4" />
                    <span>Branch Preferred Pricing &amp; Neighbourhood Class Engine</span>
                  </div>
                  <h3 className="font-montserrat font-black text-lg sm:text-xl text-white mt-0.5">
                    {branches.length > 0
                      ? `${selectedBranch.name} (${selectedBranch.location})`
                      : 'Neighbourhood Class Pricing Matrix (Donholm vs Kilimani / Westlands)'}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    Configure different selling prices per branch based on customer neighbourhood class or set exact per-product branch prices.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {branches.length > 1 && (
                    <select
                      value={selectedBranch.id}
                      onChange={e => {
                        setPricingModalBranchId(e.target.value);
                        setDraftProductPrices({});
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 border border-white/25 text-white text-xs font-montserrat font-bold"
                    >
                      {branches
                        .filter(b => b.tier !== 'WAREHOUSE')
                        .map(b => (
                          <option key={b.id} value={b.id} className="text-slate-900">
                            {b.name} — {b.location}
                          </option>
                        ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPricingModalBranchId(null);
                      setDraftProductPrices({});
                    }}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sub-navigation Tabs */}
              <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPricingModalTab('BRANCH_OVERRIDES')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-montserrat font-black transition cursor-pointer ${
                      pricingModalTab === 'BRANCH_OVERRIDES'
                        ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    Branch Preferred Product Prices ({customOverridesCount} Custom)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingModalTab('CLASS_COMPARISON')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-montserrat font-black transition cursor-pointer ${
                      pricingModalTab === 'CLASS_COMPARISON'
                        ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    Compare Donholm vs CBD vs Kilimani / Westlands
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pricingSearchQuery}
                    onChange={e => setPricingSearchQuery(e.target.value)}
                    placeholder="Search drink name, brand or SKU..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {pricingFeedback && (
                <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pricingFeedback}</span>
                </div>
              )}

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {pricingModalTab === 'BRANCH_OVERRIDES' ? (
                  <>
                    {branches.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-montserrat font-black text-sm">
                            Create Your First Retail Branch (e.g. Donholm, Kilimani, or Westlands)
                          </div>
                          <p className="mt-0.5 text-amber-800">
                            Once a branch is created, you can assign its Market Class Tier and set custom per-product selling prices for that specific branch.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPricingModalBranchId(null);
                            setIsAddBranchOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs shrink-0 cursor-pointer"
                        >
                          + Create Branch Now
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="font-montserrat font-black text-sm text-[#0A006E]">
                              1. Branch Neighbourhood Class &amp; Default Price Adjustment
                            </h4>
                            <p className="text-xs text-slate-600">
                              Applies automatically to all products at <strong>{selectedBranch.name}</strong> unless a specific product has an exact KES preferred price below.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                updateBranchPricingPolicy(selectedBranch.id, {
                                  marketClassTier: 'EASTLANDS_ECONOMY',
                                  priceMultiplierPercent: -10
                                });
                                setPricingFeedback(`Applied Donholm / Eastlands Value Class (-10%) to ${selectedBranch.name}.`);
                                setTimeout(() => setPricingFeedback(null), 4000);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-montserrat font-bold border transition cursor-pointer ${
                                selectedBranch.marketClassTier === 'EASTLANDS_ECONOMY'
                                  ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Donholm / Eastlands (-10%)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateBranchPricingPolicy(selectedBranch.id, {
                                  marketClassTier: 'STANDARD_RESIDENTIAL',
                                  priceMultiplierPercent: 0
                                });
                                setPricingFeedback(`Applied Standard Mid-Market Baseline (0%) to ${selectedBranch.name}.`);
                                setTimeout(() => setPricingFeedback(null), 4000);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-montserrat font-bold border transition cursor-pointer ${
                                (!selectedBranch.marketClassTier || selectedBranch.marketClassTier === 'STANDARD_RESIDENTIAL') &&
                                (!selectedBranch.priceMultiplierPercent || selectedBranch.priceMultiplierPercent === 0)
                                  ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Standard CBD (0%)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateBranchPricingPolicy(selectedBranch.id, {
                                  marketClassTier: 'AFFLUENT_PREMIUM',
                                  priceMultiplierPercent: 15
                                });
                                setPricingFeedback(`Applied Kilimani / Westlands Prime Class (+15%) to ${selectedBranch.name}.`);
                                setTimeout(() => setPricingFeedback(null), 4000);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-montserrat font-bold border transition cursor-pointer ${
                                selectedBranch.marketClassTier === 'AFFLUENT_PREMIUM'
                                  ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Kilimani / Westlands (+15%)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Neighbourhood Market Class
                            </label>
                            <select
                              value={selectedBranch.marketClassTier || 'STANDARD_RESIDENTIAL'}
                              onChange={e => {
                                const nextTier = e.target.value as BranchMarketClassTier;
                                const preset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === nextTier);
                                updateBranchPricingPolicy(selectedBranch.id, {
                                  marketClassTier: nextTier,
                                  priceMultiplierPercent:
                                    preset && nextTier !== 'CUSTOM'
                                      ? preset.defaultMultiplierPercent
                                      : selectedBranch.priceMultiplierPercent ?? 0
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                            >
                              {BRANCH_MARKET_CLASS_PRESETS.map(p => (
                                <option key={p.tier} value={p.tier}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Branch Default Price Multiplier (%)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={-40}
                                max={150}
                                step={1}
                                value={selectedBranch.priceMultiplierPercent ?? 0}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  updateBranchPricingPolicy(selectedBranch.id, {
                                    marketClassTier: 'CUSTOM',
                                    priceMultiplierPercent: Number.isNaN(val) ? 0 : val
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-black text-slate-900"
                              />
                              <span className="text-xs font-mono font-bold text-slate-600 shrink-0">%</span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-end">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700">
                              <div>
                                Active Rule:{' '}
                                <strong className="text-[#0A006E]">
                                  {(selectedBranch.priceMultiplierPercent ?? 0) > 0
                                    ? `+${selectedBranch.priceMultiplierPercent}% Above Baseline`
                                    : (selectedBranch.priceMultiplierPercent ?? 0) < 0
                                    ? `${selectedBranch.priceMultiplierPercent}% Below Baseline`
                                    : 'Baseline Catalog Price (0%)'}
                                </strong>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {customOverridesCount} individual product price override(s) active
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Per-Product Preferred Selling Price Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-montserrat font-black text-sm text-slate-900">
                          2. Individual Product Preferred Prices for {selectedBranch.name}
                        </h4>
                        <span className="text-xs text-slate-500">
                          Showing {filteredPricingProducts.length} of {products.length} products
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-montserrat font-black text-[11px] uppercase border-b border-slate-200">
                              <th className="py-2.5 px-3">Product &amp; Volume</th>
                              <th className="py-2.5 px-3">Landed Cost</th>
                              <th className="py-2.5 px-3">Company Baseline</th>
                              <th className="py-2.5 px-3">Effective {selectedBranch.name} Price</th>
                              <th className="py-2.5 px-3">Set Branch Preferred Retail (KES)</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredPricingProducts.map(prod => {
                              const resolved = getBranchProductPrice(prod, selectedBranch);
                              const draftVal =
                                draftProductPrices[prod.id]?.retail !== undefined
                                  ? draftProductPrices[prod.id]!.retail!
                                  : String(resolved.retailPriceKes);

                              return (
                                <tr key={prod.id} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-3">
                                    <div className="font-montserrat font-bold text-slate-900">{prod.name}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      {prod.sku} · {prod.volumeMl}mL · {prod.brand}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500">
                                    {formatKes(prod.warehouseCostKes)}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                                    {formatKes(prod.retailPriceKes)}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-mono font-black text-sm text-[#0A006E]">
                                      {formatKes(resolved.retailPriceKes)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {resolved.isCustomProductOverride
                                        ? 'Custom Branch Price'
                                        : resolved.priceDifferenceKes !== 0
                                        ? `${resolved.priceDifferenceKes > 0 ? '+' : ''}${formatKes(resolved.priceDifferenceKes)} (${resolved.effectiveMultiplierPercent > 0 ? '+' : ''}${resolved.effectiveMultiplierPercent}%)`
                                        : 'Standard Baseline'}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-mono text-slate-400">KES</span>
                                      <input
                                        type="number"
                                        min={prod.warehouseCostKes}
                                        step={10}
                                        value={draftVal}
                                        onChange={e =>
                                          setDraftProductPrices(prev => ({
                                            ...prev,
                                            [prod.id]: { ...prev[prod.id], retail: e.target.value }
                                          }))
                                        }
                                        className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-slate-900"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={branches.length === 0}
                                        onClick={() => {
                                          const numVal = parseFloat(draftVal);
                                          if (!Number.isNaN(numVal) && numVal > 0) {
                                            setBranchProductPreferredPrice(selectedBranch.id, prod.id, {
                                              retailPriceKes: numVal
                                            });
                                            setPricingFeedback(
                                              `Saved preferred price ${formatKes(numVal)} for "${prod.name}" at ${selectedBranch.name}.`
                                            );
                                            setTimeout(() => setPricingFeedback(null), 3500);
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[11px] disabled:opacity-40 cursor-pointer"
                                      >
                                        Save Price
                                      </button>
                                      {resolved.isCustomProductOverride && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setBranchProductPreferredPrice(selectedBranch.id, prod.id, {
                                              retailPriceKes: null,
                                              wholesalePriceKes: null
                                            });
                                            setDraftProductPrices(prev => {
                                              const next = { ...prev };
                                              delete next[prod.id];
                                              return next;
                                            });
                                          }}
                                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-[11px] font-bold cursor-pointer"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Multi-Branch / Neighbourhood Class Comparison Matrix (Donholm vs CBD vs Kilimani / Westlands) */
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-[#0A006E]/20 text-xs text-slate-700">
                      <strong className="font-montserrat font-black text-[#0A006E]">
                        Neighbourhood Purchasing-Power Price Comparison:
                      </strong>{' '}
                      Compare how products are priced across <strong>Donholm / Eastlands (Value Class -10%)</strong>,{' '}
                      <strong>Standard CBD (0% Baseline)</strong>, and <strong>Kilimani / Westlands (Prime Class +15%)</strong>, alongside any custom branch overrides.
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-montserrat font-black text-[11px] uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3">Donholm / Eastlands (-10%)</th>
                            <th className="py-2.5 px-3">Standard CBD (Baseline)</th>
                            <th className="py-2.5 px-3">Kilimani / Westlands (+15%)</th>
                            {branches
                              .filter(b => b.tier !== 'WAREHOUSE')
                              .slice(0, 3)
                              .map(b => (
                                <th key={b.id} className="py-2.5 px-3 text-[#0A006E]">
                                  {b.name} ({b.code})
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPricingProducts.map(prod => {
                            const donholmPrice = resolveBranchProductPrice(prod, {
                              tier: 'LIQUOR_STORE',
                              marketClassTier: 'EASTLANDS_ECONOMY',
                              priceMultiplierPercent: -10
                            }).retailPriceKes;
                            const cbdPrice = prod.retailPriceKes;
                            const kilimaniWestlandsPrice = resolveBranchProductPrice(prod, {
                              tier: 'LIQUOR_STORE',
                              marketClassTier: 'AFFLUENT_PREMIUM',
                              priceMultiplierPercent: 15
                            }).retailPriceKes;

                            return (
                              <tr key={prod.id} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3">
                                  <div className="font-montserrat font-bold text-slate-900">{prod.name}</div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {prod.sku} · Cost: {formatKes(prod.warehouseCostKes)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-black text-emerald-700">
                                  {formatKes(donholmPrice)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                                  {formatKes(cbdPrice)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-black text-[#0A006E]">
                                  {formatKes(kilimaniWestlandsPrice)}
                                </td>
                                {branches
                                  .filter(b => b.tier !== 'WAREHOUSE')
                                  .slice(0, 3)
                                  .map(b => {
                                    const brPrice = getBranchProductPrice(prod, b);
                                    return (
                                      <td key={b.id} className="py-2.5 px-3 font-mono font-black text-slate-900">
                                        {formatKes(brPrice.effectiveUnitPriceKes)}
                                      </td>
                                    );
                                  })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

interface BranchCardProps {
  branch: Branch;
  allBranches?: Branch[];
  childShops?: Branch[];
  isActive: boolean;
  onSelect: () => void;
  onSelectBranchId?: (branchId: string) => void;
  stockValue: number;
  canEdit: boolean;
  onEditThreshold: () => void;
  onOpenBranchPricing: () => void;
  onCreateShopUnderBranch?: () => void;
  onChangeParentBranch?: (branchId: string, parentBranchId: string) => void;
}

const BranchCard: React.FC<BranchCardProps> = ({
  branch,
  allBranches = [],
  childShops = [],
  isActive,
  onSelect,
  onSelectBranchId,
  stockValue,
  canEdit,
  onEditThreshold,
  onOpenBranchPricing,
  onCreateShopUnderBranch,
  onChangeParentBranch
}) => {
  const parentEligibleBranches = allBranches.filter(
    b => (b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE') && b.id !== branch.id
  );
  const resolvedParentBranch =
    allBranches.find(b => b.id === branch.parentBranchId) ||
    (branch.tier === 'LIQUOR_STORE'
      ? parentEligibleBranches[0]
      : branch.tier === 'DISTRIBUTOR'
      ? allBranches.find(b => b.tier === 'MAIN_STORE')
      : undefined);

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isActive
        ? 'bg-white border-[#0A006E] ring-2 ring-[#0A006E]/20 shadow-md'
        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-[#0A006E] bg-blue-50 px-2 py-0.5 rounded">
              {branch.code}
            </span>
            {branch.tier === 'MAIN_STORE' && (
              <span className="text-[10px] font-montserrat font-black px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] uppercase">
                Main Branch • Head Office
              </span>
            )}
            {branch.tier === 'DISTRIBUTOR' && (
              <span className="text-[10px] font-montserrat font-black px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 uppercase">
                Branch • Merchant
              </span>
            )}
            {branch.tier === 'LIQUOR_STORE' && (
              <span className="text-[10px] font-montserrat font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                Shop (Under Branch)
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Active Terminal
              </span>
            )}
          </div>
          <h4 className="font-montserrat font-black text-sm text-slate-900 mt-1">
            {branch.name}
          </h4>
        </div>

        {!isActive && (
          <button
            onClick={onSelect}
            className="px-2.5 py-1 bg-slate-100 hover:bg-[#0A006E] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
          >
            {branch.tier === 'LIQUOR_STORE' ? 'Switch to Shop' : 'Switch to Branch'}
          </button>
        )}
      </div>

      {/* Parent Branch Lineage Badge for Shops and Merchant Branches */}
      {branch.tier === 'LIQUOR_STORE' && (
        <div className="mb-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="text-emerald-950 font-semibold">
            Created Under Branch:{' '}
            <strong className="font-montserrat font-black text-[#0A006E]">
              {resolvedParentBranch?.name || branch.parentBranchName || 'Main Branch (Head Office)'}
            </strong>
          </div>
          {canEdit && onChangeParentBranch && parentEligibleBranches.length > 1 && (
            <select
              value={resolvedParentBranch?.id || ''}
              onChange={e => {
                if (e.target.value) onChangeParentBranch(branch.id, e.target.value);
              }}
              className="px-2 py-0.5 rounded-lg bg-white border border-emerald-300 text-[10px] font-montserrat font-bold text-[#0A006E]"
              title="Reassign Shop Parent Branch"
            >
              {parentEligibleBranches.map(pb => (
                <option key={pb.id} value={pb.id}>
                  Move under: {pb.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {branch.tier === 'DISTRIBUTOR' && (
        <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-950">
          <span>
            Head Office:{' '}
            <strong className="font-montserrat font-black text-[#0A006E]">
              {resolvedParentBranch?.name || 'Main Branch (Head Office)'}
            </strong>
          </span>
          <span className="font-mono font-bold text-[10px] text-amber-800">
            {childShops.length} Shop(s) Under Branch
          </span>
        </div>
      )}

      <div className="space-y-1 text-xs text-slate-600 my-3">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{branch.location} ({branch.county})</span>
        </div>
        {branch.allowDirectSales && (() => {
          const geo = resolveBranchGeoProfile(branch);
          return (
            <div className="flex items-center gap-1.5 text-[11px] text-[#0A006E] font-semibold">
              <Navigation className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
              <span className="truncate">
                Website Geo-Pin: {geo.latitude.toFixed(4)}, {geo.longitude.toFixed(4)} • {geo.maxDeliveryRadiusKm}km radius
              </span>
            </div>
          );
        })()}
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Manager: {branch.managerName}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{branch.contactPhone}</span>
        </div>
      </div>

      {/* Nested Shops Created Under This Branch (Merchant / Head Office) */}
      {(branch.tier === 'DISTRIBUTOR' || branch.tier === 'MAIN_STORE') && (
        <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-montserrat font-black text-[#0A006E] flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-[#1E9E60]" />
              <span>Shops Created Under {branch.name} ({childShops.length})</span>
            </span>
            {onCreateShopUnderBranch && (
              <button
                type="button"
                onClick={onCreateShopUnderBranch}
                className="px-2.5 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Shop Under Branch</span>
              </button>
            )}
          </div>

          {childShops.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              No Shops created under this branch yet. Click <strong>+ Add Shop Under Branch</strong> to create a retail shop under {branch.name}.
            </p>
          ) : (
            <div className="space-y-1.5">
              {childShops.map(shop => (
                <div
                  key={shop.id}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-montserrat font-bold text-slate-900 truncate">
                      {shop.name}{' '}
                      <span className="font-mono text-[10px] text-[#0A006E]">({shop.code})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {shop.location} ({shop.county})
                    </div>
                  </div>
                  {onSelectBranchId && (
                    <button
                      type="button"
                      onClick={() => onSelectBranchId(shop.id)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-[#0A006E] hover:text-white text-slate-700 font-bold text-[10px] shrink-0 cursor-pointer"
                    >
                      Open Shop
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-400">Inventory Cost Value:</span>
          <div className="font-montserrat font-black text-slate-900">
            {formatKes(stockValue)}
          </div>
        </div>

        {branch.tier === 'MAIN_STORE' && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400">Min. Wholesale Order:</span>
            <div className="flex items-center gap-1 justify-end">
              <span className="font-montserrat font-bold text-[#0A006E]">
                {formatKes(branch.minWholesaleThresholdKes || 0)}
              </span>
              {canEdit && (
                <button
                  onClick={onEditThreshold}
                  className="p-1 text-slate-400 hover:text-[#0A006E]"
                  title="Super Admin: Override Wholesale Threshold"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {branch.tier === 'WAREHOUSE' && (
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">
            Fulfillment Only (No Sales)
          </span>
        )}

        {branch.tier === 'LIQUOR_STORE' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">
              {branch.marketClassTier === 'EASTLANDS_ECONOMY'
                ? `Value Class (${branch.priceMultiplierPercent ?? -10}%)`
                : branch.marketClassTier === 'AFFLUENT_PREMIUM'
                ? `Prime Class (+${branch.priceMultiplierPercent ?? 15}%)`
                : branch.priceMultiplierPercent
                ? `Branch Adj (${branch.priceMultiplierPercent > 0 ? '+' : ''}${branch.priceMultiplierPercent}%)`
                : 'Standard Price'}
              {Object.keys(branch.preferredProductPrices || {}).length > 0 &&
                ` · ${Object.keys(branch.preferredProductPrices || {}).length} Custom`}
            </span>
            <button
              type="button"
              onClick={onOpenBranchPricing}
              className="px-2.5 py-1 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
            >
              <Tag className="w-3 h-3" />
              <span>Shop Prices</span>
            </button>
          </div>
        )}

        {(branch.tier === 'MAIN_STORE' || branch.tier === 'DISTRIBUTOR') && (
          <button
            type="button"
            onClick={onOpenBranchPricing}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0A006E] hover:text-white text-slate-700 font-montserrat font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
          >
            <Tag className="w-3 h-3" />
            <span>Branch Prices</span>
          </button>
        )}
      </div>
    </div>
  );
};
