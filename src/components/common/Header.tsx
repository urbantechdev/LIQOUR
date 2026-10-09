import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useErp } from '../../context/ErpContext';
import { 
  User, 
  ChevronDown, 
  LogOut, 
  Sparkles, 
  ShieldCheck, 
  UserCheck,
  Mail,
  Briefcase,
  Wine,
  ExternalLink,
  KeyRound,
  Lock,
  UserPlus,
  Store,
  Plus,
  Maximize2,
  Minimize2,
  Bell,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowRight,
  Zap,
  Trash2,
  Minus,
  Clock,
  Globe,
  Calendar,
  Menu,
  X,
  LayoutDashboard,
  BarChart3,
  Boxes,
  Network,
  Calculator,
  Users,
  BadgePercent,
  MapPin,
  TrendingUp,
  Settings
} from 'lucide-react';
import { OnboardingCenterModal, OnboardingTabType } from './OnboardingCenterModal';
import { LeaveAndOffDutyModal } from './LeaveAndOffDutyModal';
import { PWAInstallButton } from './PWAInstallButton';
import {
  isPlatformFullscreen,
  requestPlatformFullscreen,
  exitPlatformFullscreen
} from './SessionSecurityMonitor';
import { getRolePermissions, isTabAllowed } from '../../utils/rbac';
import { ActiveNavTab } from './Sidebar';

interface Props {
  activeTab?: ActiveNavTab;
  onSelectTab?: (tab: ActiveNavTab) => void;
  onOpenLoginModal: () => void;
  onOpenStorefront?: () => void;
}

const MOBILE_ERP_MODULES: {
  id: ActiveNavTab;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  group: 'EXECUTIVE' | 'OPERATIONS' | 'COMMERCIAL';
}[] = [
  { id: 'DASHBOARD', label: 'Financial & Assets', shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, group: 'EXECUTIVE' },
  { id: 'ANALYTICS', label: 'Business Analytics', shortLabel: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, group: 'EXECUTIVE' },
  { id: 'ACCOUNTING', label: 'Accounts & Ledgers', shortLabel: 'Accounts', icon: <Calculator className="w-4 h-4" />, group: 'EXECUTIVE' },
  { id: 'POS', label: 'POS Terminal', shortLabel: 'POS', icon: <Store className="w-4 h-4" />, group: 'OPERATIONS' },
  { id: 'INVENTORY', label: 'Inventory (IPS/LPS)', shortLabel: 'Inventory', icon: <Boxes className="w-4 h-4" />, group: 'OPERATIONS' },
  { id: 'RESTOCK', label: 'Restock & Dispatch', shortLabel: 'Restock', icon: <Truck className="w-4 h-4" />, group: 'OPERATIONS' },
  { id: 'DELIVERY_DASHBOARD', label: 'Delivery Manager', shortLabel: 'Deliveries', icon: <MapPin className="w-4 h-4" />, group: 'OPERATIONS' },
  { id: 'BRANCHES', label: 'Distribution Chain', shortLabel: 'Branches', icon: <Network className="w-4 h-4" />, group: 'COMMERCIAL' },
  { id: 'SALES_MANAGER_DASHBOARD', label: 'Sales Manager', shortLabel: 'Sales Mgr', icon: <TrendingUp className="w-4 h-4" />, group: 'COMMERCIAL' },
  { id: 'AFFILIATES', label: 'Sales & Affiliates', shortLabel: 'Affiliates', icon: <BadgePercent className="w-4 h-4" />, group: 'COMMERCIAL' },
  { id: 'PAYROLL', label: 'HR & Payroll', shortLabel: 'Payroll', icon: <Users className="w-4 h-4" />, group: 'COMMERCIAL' },
  { id: 'SETTINGS', label: 'Admin Settings', shortLabel: 'Settings', icon: <Settings className="w-4 h-4" />, group: 'EXECUTIVE' },
];

export const Header: React.FC<Props> = ({ activeTab = 'DASHBOARD', onSelectTab, onOpenLoginModal, onOpenStorefront }) => {
  const { 
    currentUser, 
    currentRole, 
    currentDepartment,
    isPosCashier,
    isAuthenticated,
    logout,
    branches,
    activeBranch,
    switchBranch,
    products,
    inventoryItems,
    restockRequests,
    websiteDeliveryOrders,
    updateRestockRequestItemQty,
    removeUnavailableItemFromRestockRequest,
    acceptAndFulfillRestockRequest,
    rejectRestockRequest,
    triggerWarehouseAutoDisburseForAllLowStockShops,
    autoDisburseEnabled,
    setAutoDisburseEnabled,
    posStationMode,
    employeeLeaveRequests,
    salesRepOffDutyRequests,
    systemSettings
  } = useErp();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isMobileHamburgerOpen, setIsMobileHamburgerOpen] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [onboardingTab, setOnboardingTab] = useState<OnboardingTabType | null>(null);
  const [leaveModalMode, setLeaveModalMode] = useState<'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [navDrawerKickNotice, setNavDrawerKickNotice] = useState<string | null>(null);
  const [selectedHeaderIcon, setSelectedHeaderIcon] = useState<string | null>(null);

  // Immediately close all portaled dropdowns/drawers/modals when session locks or auto-logs off
  useEffect(() => {
    if (!isAuthenticated) {
      setIsProfileMenuOpen(false);
      setIsNotifMenuOpen(false);
      setIsMobileHamburgerOpen(false);
      setSelectedHeaderIcon(null);
      setOnboardingTab(null);
      setLeaveModalMode(null);
    }
  }, [isAuthenticated]);

  const triggerDrawerKickFeedback = () => {
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // ignore audio errors
    }
    setNavDrawerKickNotice(`ESC/POS Drawer Kick Triggered (POS-${activeBranch.code}-01)`);
    setTimeout(() => setNavDrawerKickNotice(null), 3000);
  };

  const handleNavKickDrawer = () => {
    if (!isPosCashier) return;
    window.dispatchEvent(new CustomEvent('vaairo:kick-drawer'));
  };

  useEffect(() => {
    const onKick = () => {
      if (!isPosCashier) return;
      triggerDrawerKickFeedback();
    };
    window.addEventListener('vaairo:kick-drawer', onKick);
    return () => window.removeEventListener('vaairo:kick-drawer', onKick);
  }, [activeBranch.code, isPosCashier]);

  const permissions = getRolePermissions(currentRole, currentDepartment);
  // Order requests are ONLY received by the Inventory Controller
  const isInventoryController =
    (currentRole === 'STAFF' && currentDepartment === 'INVENTORY') || currentRole === 'SUPER_ADMIN';
  // Super Admin only header actions (New Branch, Onboard Suppliers / Distributors / Staff across enterprise)
  const isAdminOrAccountant = currentRole === 'SUPER_ADMIN';
  // Staff POS login (POS Cashier or Sales Representative) — strictly show ONLY User and Logout icon in Header
  const isStaffPos =
    isAuthenticated &&
    currentRole === 'STAFF' &&
    (currentDepartment === 'POS' || currentDepartment === 'AFFILIATES');

  const pendingNotifications = restockRequests.filter(r => {
    if (r.status !== 'PENDING' && r.status !== 'APPROVED' && r.status !== 'DISPATCHED') return false;
    if (
      !permissions.allBranchesAccess &&
      activeBranch.tier !== 'WAREHOUSE' &&
      activeBranch.tier !== 'MAIN_STORE'
    ) {
      return r.fromBranchId === activeBranch.id || r.toBranchId === activeBranch.id;
    }
    return true;
  });

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

  // Role icon badge — White background by default, Yellow (#FFDE00) background on hover/select
  const getRoleBadge = () => {
    const isRoleSelected = selectedHeaderIcon === 'ROLE_BADGE';
    const baseClasses = `w-10 h-10 rounded-xl flex items-center justify-center border transition shadow-sm shrink-0 cursor-pointer ${
      isRoleSelected
        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
    }`;

    switch (currentRole) {
      case 'SUPER_ADMIN':
        return (
          <button
            type="button"
            onClick={() => setSelectedHeaderIcon(prev => (prev === 'ROLE_BADGE' ? null : 'ROLE_BADGE'))}
            className={baseClasses}
            title="Active Role: SUPER ADMIN"
          >
            <Sparkles className="w-4 h-4 text-[#0A006E]" />
          </button>
        );
      case 'ACCOUNTANT':
        return (
          <button
            type="button"
            onClick={() => setSelectedHeaderIcon(prev => (prev === 'ROLE_BADGE' ? null : 'ROLE_BADGE'))}
            className={baseClasses}
            title="Active Role: ACCOUNTANT (CPA-K)"
          >
            <ShieldCheck className="w-4 h-4 text-[#0A006E]" />
          </button>
        );
      case 'STAFF':
      default:
        return (
          <button
            type="button"
            onClick={() => setSelectedHeaderIcon(prev => (prev === 'ROLE_BADGE' ? null : 'ROLE_BADGE'))}
            className={baseClasses}
            title={`Active Role: STAFF (${currentUser.department?.replace('_', ' ') || 'POS'})`}
          >
            <UserCheck className="w-4 h-4 text-[#0A006E]" />
          </button>
        );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="relative bg-[#0A006E] text-white sticky top-0 z-40 min-h-[4.75rem] sm:min-h-[6rem] lg:min-h-[10.5rem] py-2.5 sm:py-3.5 lg:py-5 flex items-center">
      {/* Moving Silent Scanner Sweep Container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        <div className="silent-scanner-beam" />
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="flex flex-row items-center justify-between gap-3">
          
          {/* Left: Brand Identity */}
          <div className="flex items-center space-x-3 sm:space-x-4 lg:space-x-5 min-w-0">
            <div 
              onClick={() => setSelectedHeaderIcon(prev => (prev === 'BRAND_LOGO' ? null : 'BRAND_LOGO'))}
              className={`w-11 h-11 sm:w-14 sm:h-14 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl flex items-center justify-center text-[#0A006E] shadow-xl border-2 lg:border-3 shrink-0 group hover:scale-105 transition relative overflow-hidden cursor-pointer ${
                selectedHeaderIcon === 'BRAND_LOGO'
                  ? 'bg-[#FFDE00] border-[#FFDE00]'
                  : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00]'
              }`}
              title={`${systemSettings?.brandName || 'VAAIRO'} Wines & Spirits ERP & POS`}
            >
              <div className="silent-scanner-beam-fast" />
              {systemSettings?.logoUrl ? (
                <img
                  src={systemSettings.logoUrl}
                  alt={systemSettings.brandName || 'Brand Logo'}
                  className="w-full h-full object-contain p-1.5 relative z-10"
                />
              ) : (
                <Wine className="w-6 h-6 sm:w-8 sm:h-8 lg:w-13 lg:h-13 text-[#0A006E] stroke-[2.4] drop-shadow-xs relative z-10" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                <h1 className="font-montserrat font-black italic text-2xl sm:text-4xl lg:text-7xl tracking-tighter text-white drop-shadow-md leading-none truncate">
                  {systemSettings?.brandName || 'VAAIRO'}
                </h1>
                <span
                  className="bg-[#FFDE00] text-[#0A006E] text-[10px] sm:text-xs lg:text-sm font-montserrat font-black italic px-2 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider inline-flex items-center shadow-md"
                  title={systemSettings?.brandBadge || 'ERP'}
                >
                  <span>{systemSettings?.brandBadge || 'ERP'}</span>
                </span>
              </div>
              <p className="font-subtitle font-montserrat font-semibold text-[10px] sm:text-sm lg:text-base text-slate-200 tracking-wide mt-0.5 sm:mt-1.5 truncate">
                Choose it, get it, Drink it
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Trigger (< lg) — Single Clean Hamburger Button, Everything Collapsed Inside */}
          <div className="flex lg:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileHamburgerOpen(prev => !prev)}
              aria-label="Open Mobile Menu"
              title="Open Menu"
              className={`relative w-10 h-10 rounded-xl border-2 flex items-center justify-center transition shadow-md cursor-pointer ${
                isMobileHamburgerOpen
                  ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                  : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E]'
              }`}
            >
              {isMobileHamburgerOpen ? (
                <X className="w-5 h-5 text-[#0A006E] stroke-[2.5]" />
              ) : (
                <Menu className="w-5 h-5 text-[#0A006E] stroke-[2.5]" />
              )}
              {isAuthenticated && isInventoryController && !isStaffPos && pendingNotifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white border border-white font-mono text-[9px] font-black flex items-center justify-center">
                  {pendingNotifications.length}
                </span>
              )}
            </button>
          </div>

          {/* Right: Desktop User Profile & Role Actions (Hidden on Mobile, Right-Aligned on Desktop) */}
          <div className="hidden lg:flex lg:w-auto items-center justify-end gap-2.5 sm:gap-3">
            {/* In-App PWA Install Button (Windows 11 Icon) - Hidden on login screen */}
            {isAuthenticated && !isStaffPos && <PWAInstallButton />}

            {/* Direct User-Facing Customer Website Portal Icon Button (https://liqour.urbantechdev.com/website) */}
            {onOpenStorefront && !isStaffPos && (
              <button
                type="button"
                onClick={() => {
                  setSelectedHeaderIcon('STOREFRONT');
                  onOpenStorefront();
                }}
                aria-label="Customer Website"
                className={`w-10 h-10 rounded-xl border font-montserrat font-black text-xs flex items-center justify-center transition shadow-md shrink-0 cursor-pointer relative ${
                  selectedHeaderIcon === 'STOREFRONT'
                    ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                    : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                }`}
                title="Open Customer Website (https://liqour.urbantechdev.com/website)"
              >
                <Globe className="w-4 h-4 shrink-0 text-[#0A006E]" />
                {websiteDeliveryOrders.filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID').length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0A006E] text-[#FFDE00] border border-white font-mono text-[10px] flex items-center justify-center">
                    {websiteDeliveryOrders.filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID').length}
                  </span>
                )}
              </button>
            )}

            {/* Full-Screen Mode Icon Button (Hidden on Staff POS) */}
            {!isStaffPos && (
              <button
                type="button"
                data-fullscreen-toggle="true"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition shadow-xs shrink-0 cursor-pointer ${
                  isFullscreen
                    ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                    : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                }`}
                title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-[#0A006E]" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-[#0A006E]" />
                )}
              </button>
            )}
            
            {!isAuthenticated ? (
              // Unauthenticated state on pre-dashboard login window
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedHeaderIcon(prev => (prev === 'LOCK' ? null : 'LOCK'))}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm shrink-0 transition cursor-pointer ${
                    selectedHeaderIcon === 'LOCK'
                      ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                      : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                  }`}
                  title="Gateway Access Locked"
                >
                  <Lock className="w-4 h-4 text-[#0A006E]" />
                </button>
                <button
                  onClick={() => {
                    setSelectedHeaderIcon('LOGIN_MODAL');
                    onOpenLoginModal();
                  }}
                  aria-label="Choose Access Level"
                  title="Choose Access Level"
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition shadow-sm shrink-0 cursor-pointer ${
                    selectedHeaderIcon === 'LOGIN_MODAL'
                      ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                      : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-[#0A006E]" />
                </button>
              </div>
            ) : (
              // Authenticated Profile & Action Icons
              <>
                {/* Kick Drawer Button in Nav — Hidden on Staff POS header */}
                {isPosCashier && !isStaffPos && (
                  <button
                    type="button"
                    onClick={handleNavKickDrawer}
                    title="Send RJ11 Drawer Kick Pulse via ESC/POS (POS Cashier Only)"
                    className={`h-10 px-3 rounded-xl border font-montserrat font-black text-xs flex items-center gap-1.5 transition shadow-md shrink-0 cursor-pointer ${
                      navDrawerKickNotice
                        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 shrink-0 text-[#0A006E]" />
                    <span className="hidden sm:inline">Kick Drawer</span>
                  </button>
                )}

                {/* Active Branch Switcher (Hidden on Staff POS) */}
                {!isStaffPos && (
                  <div
                    className={`hidden md:flex items-center gap-1.5 border rounded-xl p-1 h-10 transition ${
                      onboardingTab === 'BRANCH'
                        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E]'
                    }`}
                  >
                    <Store className="w-4 h-4 ml-2 shrink-0 text-[#0A006E]" />
                    <select
                      value={branches.length === 0 ? '' : activeBranch.id}
                      onChange={(e) => {
                        if (e.target.value && permissions.allBranchesAccess) {
                          switchBranch(e.target.value);
                        }
                      }}
                      disabled={!permissions.allBranchesAccess || branches.length === 0}
                      className="bg-transparent text-[#0A006E] text-xs font-montserrat font-bold pr-1 py-1 focus:outline-none cursor-pointer disabled:cursor-default max-w-[165px] truncate"
                      title={
                        permissions.allBranchesAccess
                          ? 'Switch Active Branch'
                          : `Locked to Assigned Branch: ${activeBranch.name}`
                      }
                    >
                      {branches.length === 0 ? (
                        <option value="" className="text-slate-900 font-bold">
                          No Branches Created Yet
                        </option>
                      ) : (
                        (permissions.allBranchesAccess
                          ? branches
                          : branches.filter(b => b.id === activeBranch.id)
                        ).map(b => {
                          const parentBr = branches.find(p => p.id === b.parentBranchId);
                          const roleLabel =
                            b.tier === 'MAIN_STORE'
                              ? `[Head Office] ${b.name}`
                              : b.tier === 'DISTRIBUTOR'
                              ? `[Branch • Merchant] ${b.name}`
                              : b.tier === 'LIQUOR_STORE'
                              ? `↳ [Shop under ${parentBr?.name || b.parentBranchName || 'Branch'}] ${b.name}`
                              : `[HQ Warehouse] ${b.name}`;
                          return (
                            <option key={b.id} value={b.id} className="text-slate-900 font-bold">
                              {roleLabel} ({b.code})
                            </option>
                          );
                        })
                      )}
                    </select>
                    {isAdminOrAccountant && (
                      <button
                        type="button"
                        onClick={() => setOnboardingTab('BRANCH')}
                        aria-label="Create New Branch"
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition shadow-xs shrink-0 cursor-pointer ${
                          onboardingTab === 'BRANCH'
                            ? 'bg-[#0A006E] border-[#0A006E] text-[#FFDE00]'
                            : 'bg-white hover:bg-[#FFDE00] border-slate-200 hover:border-[#0A006E] text-[#0A006E]'
                        }`}
                        title="Create New Branch (Liquor Shop, Merchant, Store, Warehouse)"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                )}

                {/* Global Onboarding Hub Icon Button — Strictly Shown ONLY on Super Admin & Accountant Login */}
                {isAdminOrAccountant && !isStaffPos && (
                  <button
                    type="button"
                    onClick={() => setOnboardingTab('SUPPLIER')}
                    aria-label="Onboard Suppliers, Merchants, Staff & Branches"
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md transition shrink-0 cursor-pointer ${
                      onboardingTab !== null && onboardingTab !== 'BRANCH'
                        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                    }`}
                    title="Onboard Suppliers, Merchants, Staff & Branches"
                  >
                    <UserPlus className="w-4 h-4 text-[#0A006E]" />
                  </button>
                )}

                {/* Order Requests Bell Icon Button — Strictly Received by Inventory Controller Only */}
                {isInventoryController && !isStaffPos && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifMenuOpen(prev => !prev);
                        setIsProfileMenuOpen(false);
                      }}
                      aria-label="Inventory Controller Order Requests"
                      className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition shadow-md shrink-0 cursor-pointer ${
                        isNotifMenuOpen
                          ? 'bg-[#FFDE00] text-[#0A006E] border-[#FFDE00]'
                          : 'bg-white hover:bg-[#FFDE00] text-[#0A006E] border-white hover:border-[#FFDE00] active:bg-[#FFDE00]'
                      }`}
                      title="Inventory Controller Only: Incoming Shop Order Requests (Edit & Accept)"
                    >
                      <Bell className="w-4 h-4 shrink-0 text-[#0A006E]" />
                      <span
                        className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-mono font-black flex items-center justify-center shadow-xs ${
                          pendingNotifications.length > 0
                            ? 'bg-red-600 text-white border border-white'
                            : 'bg-[#0A006E] text-[#FFDE00] border border-white'
                        }`}
                      >
                        {pendingNotifications.length}
                      </span>
                    </button>

                    {isNotifMenuOpen &&
                      typeof document !== 'undefined' &&
                      createPortal(
                        <div
                          className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[1px] flex items-start justify-end sm:p-4 sm:pt-24 lg:pt-32"
                          onClick={() => setIsNotifMenuOpen(false)}
                        >
                          <div
                            className="w-screen sm:w-[490px] h-dvh sm:h-auto sm:max-h-[calc(100dvh-7rem)] bg-white text-slate-900 rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col overflow-hidden z-[9999] animate-in fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-[#FFDE00] px-4 py-3.5 text-[#0A006E] flex items-center justify-between border-b-2 border-[#0A006E] shrink-0">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Bell className="w-4 h-4 text-[#0A006E]" />
                                  <span className="font-montserrat font-black italic text-sm text-[#0A006E]">
                                    Inventory Controller — Shop Order Requests
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#0A006E]/80 font-semibold mt-0.5">
                                  Received by Inventory Controller only • Edit quantities or remove unavailable products before accepting
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsNotifMenuOpen(false)}
                                className="w-8 h-8 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] font-bold flex items-center justify-center text-xs transition cursor-pointer shrink-0"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Warehouse Controller Auto-Disburse Bar */}
                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                              <label className="flex items-center gap-1.5 font-montserrat font-bold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={autoDisburseEnabled}
                                  onChange={(e) => setAutoDisburseEnabled(e.target.checked)}
                                  className="rounded text-[#0A006E]"
                                />
                                <span>Auto-Disburse on Shop Low Stock</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const res = triggerWarehouseAutoDisburseForAllLowStockShops();
                                  setNotifFeedback(
                                    res.count > 0
                                      ? `Inventory Controller auto-disbursed ${res.count} stock refill(s) pending acceptance!`
                                      : 'All shops already have sufficient stock or pending refills.'
                                  );
                                  setTimeout(() => setNotifFeedback(null), 4000);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1 transition cursor-pointer"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Auto-Disburse Low Shops Now</span>
                              </button>
                            </div>

                            {notifFeedback && (
                              <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-[11px] font-bold shrink-0">
                                {notifFeedback}
                              </div>
                            )}

                            <div className="flex-1 max-h-96 overflow-y-auto divide-y divide-slate-100">
                              {pendingNotifications.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                                  <div className="font-bold text-slate-700">No Pending Order Requests</div>
                                  <div>All shop refill requests have been reviewed and accepted by the Inventory Controller.</div>
                                </div>
                              ) : (
                                pendingNotifications.map(req => {
                                  const isAutoDisb =
                                    req.initiationType === 'WAREHOUSE_AUTO_DISBURSE' ||
                                    req.initiationType === 'WAREHOUSE_CONTROLLER_PUSH';
                                  return (
                                    <div key={req.id} className="p-3.5 hover:bg-slate-50 transition space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono font-black text-[11px] text-[#0A006E] bg-blue-50 px-2 py-0.5 rounded">
                                            {req.requestNumber}
                                          </span>
                                          <span
                                            className={`text-[10px] font-montserrat font-black px-2 py-0.5 rounded-full ${
                                              isAutoDisb
                                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                                            }`}
                                          >
                                            {isAutoDisb ? 'WAREHOUSE AUTO-DISBURSE' : 'SHOP ORDER REQUEST'}
                                          </span>
                                          <span className="text-[10px] font-montserrat font-black px-2 py-0.5 rounded bg-red-50 text-red-700">
                                            INVENTORY CONTROLLER REVIEW
                                          </span>
                                        </div>
                                      </div>

                                      <div className="text-xs font-montserrat font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                        <Truck className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                                        <span className="text-[#1E9E60]">{req.toBranchName}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="text-[#0A006E]">{req.fromBranchName}</span>
                                      </div>

                                      {/* Editable Product List — Inventory Controller can edit qty or remove unavailable products */}
                                      <div className="text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                                        <div className="text-[10px] font-montserrat font-black uppercase text-slate-500 flex items-center justify-between">
                                          <span>Requested Stock List (Editable)</span>
                                          <span>Adjust / Remove Unavailable</span>
                                        </div>
                                        {req.items.map((it) => {
                                          const whInv = inventoryItems.find(
                                            inv => inv.branchId === req.toBranchId && inv.productId === it.productId
                                          );
                                          const prod = products.find(p => p.id === it.productId);
                                          const packSize = prod?.packSize || 12;
                                          const availBottles = whInv?.bottlesOnHand ?? 0;
                                          const availCases = Math.floor(availBottles / packSize);
                                          const isUnavailable = availBottles < it.bottlesTotal || availBottles <= 0;

                                          return (
                                            <div
                                              key={it.productId}
                                              className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
                                                isUnavailable
                                                  ? 'bg-red-50/70 border-red-200'
                                                  : 'bg-white border-slate-200'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-slate-900 truncate">{it.productName}</span>
                                                <span
                                                  className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded shrink-0 ${
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

                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateRestockRequestItemQty(
                                                        req.id,
                                                        it.productId,
                                                        Math.max(1, it.casesRequested - 1)
                                                      )
                                                    }
                                                    className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-bold"
                                                    title="Decrease cases"
                                                  >
                                                    <Minus className="w-3 h-3" />
                                                  </button>
                                                  <span className="font-mono font-black text-xs text-[#0A006E] px-2">
                                                    {it.casesRequested} cs ({it.bottlesTotal} btls)
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateRestockRequestItemQty(req.id, it.productId, it.casesRequested + 1)
                                                    }
                                                    className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-bold"
                                                    title="Increase cases"
                                                  >
                                                    <Plus className="w-3 h-3" />
                                                  </button>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    removeUnavailableItemFromRestockRequest(
                                                      req.id,
                                                      it.productId,
                                                      'Removed by Inventory Controller — product unavailable in stock list'
                                                    );
                                                    setNotifFeedback(
                                                      `Removed ${it.productName} from ${req.requestNumber} stock list.`
                                                    );
                                                    setTimeout(() => setNotifFeedback(null), 3500);
                                                  }}
                                                  className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 font-montserrat font-black text-[10px] flex items-center gap-1 transition"
                                                  title="Remove unavailable product from this order request"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                  <span>Remove Unavailable</span>
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {req.removedItems && req.removedItems.length > 0 && (
                                          <div className="text-[10px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
                                            <strong>Removed Unavailable:</strong>{' '}
                                            {req.removedItems.map(r => r.productName).join(', ')}
                                          </div>
                                        )}
                                      </div>

                                      {req.notes && (
                                        <div className="text-[10px] text-slate-500 italic">
                                          {req.notes}
                                        </div>
                                      )}

                                      <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            rejectRestockRequest(req.id, 'Declined by Inventory Controller');
                                            setNotifFeedback(`Declined ${req.requestNumber}`);
                                            setTimeout(() => setNotifFeedback(null), 3000);
                                          }}
                                          className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-montserrat font-bold text-[11px] flex items-center gap-1 transition"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                          <span>Reject</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            acceptAndFulfillRestockRequest(req.id);
                                            setNotifFeedback(
                                              `Accepted ${req.requestNumber}! Available stock disbursed from ${req.toBranchName} into ${req.fromBranchName}.`
                                            );
                                            setTimeout(() => setNotifFeedback(null), 4000);
                                          }}
                                          className="px-3.5 py-1.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1.5 shadow-sm transition"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-[#FFDE00]" />
                                          <span>Accept &amp; Disburse Stock</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                      setIsNotifMenuOpen(false);
                    }}
                    aria-label="User Profile & Account"
                    className={`${
                      isStaffPos ? 'w-10 h-10 justify-center' : 'h-10 px-2'
                    } rounded-xl border flex items-center gap-1.5 transition shadow-2xs group shrink-0 cursor-pointer ${
                      isProfileMenuOpen
                        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                    }`}
                    title={`${currentUser.name} (${currentUser.department?.replace('_', ' ') || 'Enterprise'}) — Click for Profile & Account`}
                  >
                    {isStaffPos ? (
                      <User className="w-4 h-4 text-[#0A006E]" />
                    ) : (
                      <>
                        {/* Profile Icon Avatar */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-montserrat font-black text-xs shadow-xs shrink-0 group-hover:scale-105 transition ${
                            isProfileMenuOpen
                              ? 'bg-[#0A006E] text-[#FFDE00]'
                              : 'bg-[#0A006E]/10 group-hover:bg-[#0A006E] text-[#0A006E] group-hover:text-[#FFDE00]'
                          }`}
                        >
                          {currentUser.name ? getInitials(currentUser.name) : <User className="w-4 h-4" />}
                        </div>

                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 transition-transform text-[#0A006E] ${
                            isProfileMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>

                  {/* Profile Dropdown Popover — Portaled to document.body at z-[9999] so it appears on top of everything */}
                  {isProfileMenuOpen &&
                    typeof document !== 'undefined' &&
                    createPortal(
                      <div
                        className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[1px] flex items-start justify-end sm:p-4 sm:pt-24 lg:pt-32"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <div
                          className="w-screen sm:w-80 h-dvh sm:h-auto sm:max-h-[calc(100dvh-7rem)] bg-white text-slate-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border-2 border-[#0A006E] overflow-hidden z-[9999] overflow-y-auto animate-in fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-[#FFDE00] px-4 py-3.5 border-b-2 border-[#0A006E] flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-base shadow-sm shrink-0">
                                {currentUser.name ? getInitials(currentUser.name) : <User className="w-6 h-6" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-montserrat font-black text-[#0A006E] text-sm truncate">
                                  {currentUser.name}
                                </div>
                                <div className="text-[11px] text-[#0A006E]/80 font-semibold truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3 text-[#0A006E] shrink-0" />
                                  <span className="truncate">{currentUser.email}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-8 h-8 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center text-xs font-bold shrink-0 transition cursor-pointer"
                              aria-label="Close Profile Menu"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="px-4 py-2 text-xs space-y-1.5 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">System Role:</span>
                              <strong className="text-[#0A006E] font-bold text-[11px]">{currentUser.role}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">Department:</span>
                              <span className="font-bold text-slate-700 text-[11px]">{currentUser.department}</span>
                            </div>
                          </div>

                          <div className="p-2 space-y-1">
                            {isAdminOrAccountant && (
                              <>
                                <button
                                  onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    setOnboardingTab('BRANCH');
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-[#1E9E60] bg-emerald-50 hover:bg-emerald-100 transition flex items-center gap-2 cursor-pointer"
                                >
                                  <Store className="w-4 h-4 text-[#1E9E60]" />
                                  <span>Create New Branch (Liquor Shop / Merchant / Store)</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    setOnboardingTab('SUPPLIER');
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] bg-[#FFDE00]/20 hover:bg-[#FFDE00]/40 transition flex items-center gap-2 cursor-pointer"
                                >
                                  <UserPlus className="w-4 h-4 text-[#0A006E]" />
                                  <span>Onboard Suppliers / Merchants / Staff</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                setLeaveModalMode(
                                  currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
                                    ? 'SALES_REP_OFF_DUTY'
                                    : 'EMPLOYEE_LEAVE'
                                );
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] bg-indigo-50 hover:bg-indigo-100 transition flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[#0A006E]" />
                                <span>
                                  {currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
                                    ? 'Request Off Duty (Sales Manager)'
                                    : 'Request Leave from HR'}
                                </span>
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono text-[9px] font-black">
                                {currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
                                  ? salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER').length
                                  : employeeLeaveRequests.filter(r => r.status === 'PENDING_HR').length}
                              </span>
                            </button>

                            <PWAInstallButton variant="menu" />

                            <button
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                onOpenLoginModal();
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-slate-700 hover:bg-slate-100 hover:text-[#0A006E] transition flex items-center gap-2 cursor-pointer"
                            >
                              <Briefcase className="w-4 h-4 text-[#0A006E]" />
                              <span>Switch Departmental Role</span>
                            </button>

                            {!isStaffPos && (
                              <button
                                onClick={() => {
                                  setIsProfileMenuOpen(false);
                                  window.dispatchEvent(new CustomEvent('vaairo:trigger-countdown'));
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-slate-700 hover:bg-slate-100 hover:text-[#0A006E] transition flex items-center gap-2 cursor-pointer"
                              >
                                <Clock className="w-4 h-4 text-[#0A006E]" />
                                <span>Start 30s Session Countdown</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                logout();
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-montserrat font-bold text-red-600 hover:bg-red-50 transition flex items-center gap-2 cursor-pointer"
                            >
                              <LogOut className="w-4 h-4 text-red-500" />
                              <span>Lock / Log Out to Gateway</span>
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                </div>

                {/* Role Badge (Hidden on Staff POS) */}
                {!isStaffPos && getRoleBadge()}

                {/* Countdown Button (Hidden on Staff POS) */}
                {!isStaffPos && (
                  <button
                    onClick={() => {
                      setSelectedHeaderIcon('COUNTDOWN');
                      window.dispatchEvent(new CustomEvent('vaairo:trigger-countdown'));
                      setTimeout(() => setSelectedHeaderIcon(prev => (prev === 'COUNTDOWN' ? null : prev)), 2500);
                    }}
                    aria-label="Preview Session Countdown Lock"
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer ${
                      selectedHeaderIcon === 'COUNTDOWN'
                        ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                        : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                    }`}
                    title="Trigger 30s Auto Log-Off Countdown Window"
                  >
                    <Clock className="w-4 h-4 text-[#0A006E]" />
                  </button>
                )}

                {/* Logout Icon Button */}
                <button
                  onClick={() => {
                    setSelectedHeaderIcon('LOGOUT');
                    logout();
                  }}
                  aria-label="Lock session & return to login gateway"
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer ${
                    selectedHeaderIcon === 'LOGOUT'
                      ? 'bg-[#FFDE00] border-[#FFDE00] text-[#0A006E]'
                      : 'bg-white hover:bg-[#FFDE00] border-white hover:border-[#FFDE00] text-[#0A006E] active:bg-[#FFDE00]'
                  }`}
                  title="Lock session & return to login gateway"
                >
                  <LogOut className="w-4 h-4 text-[#0A006E]" />
                </button>
              </>
            )}

          </div>

        </div>
      </div>

      {/* Single Wave Design at the bottom edge */}
      <div className="absolute left-0 right-0 -bottom-8 sm:-bottom-10 w-full leading-none pointer-events-none z-10">
        <svg
          viewBox="0 0 1200 70"
          preserveAspectRatio="none"
          className="w-full h-8 sm:h-10 block drop-shadow-[0_6px_10px_rgba(10,0,110,0.2)]"
        >
          {/* Navy Wave Solid Body */}
          <path
            d="M0,-1 L1200,-1 L1200,14 C860,68 340,2 0,44 Z"
            fill="#0A006E"
          />
          {/* Golden Yellow Wave Stroke */}
          <path
            d="M0,44 C340,2 860,68 1200,14"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Header Icon Quick Preview Window (Brand Logo, Role Badge, Lock Icon) — Portaled at z-[9999] on top of everything */}
      {(selectedHeaderIcon === 'BRAND_LOGO' ||
        selectedHeaderIcon === 'ROLE_BADGE' ||
        selectedHeaderIcon === 'LOCK') &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[1px] flex items-start justify-center sm:justify-end p-4 pt-20 sm:pt-24 lg:pt-32"
            onClick={() => setSelectedHeaderIcon(null)}
          >
            <div
              className="w-full max-w-sm bg-white text-slate-900 rounded-3xl shadow-2xl border-2 border-[#0A006E] overflow-hidden z-[9999] animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#FFDE00] px-5 py-4 text-[#0A006E] flex items-center justify-between border-b-2 border-[#0A006E]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                    {selectedHeaderIcon === 'BRAND_LOGO' ? (
                      <Wine className="w-5 h-5" />
                    ) : selectedHeaderIcon === 'LOCK' ? (
                      <Lock className="w-5 h-5" />
                    ) : currentRole === 'SUPER_ADMIN' ? (
                      <Sparkles className="w-5 h-5" />
                    ) : currentRole === 'ACCOUNTANT' ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-montserrat font-black italic text-sm text-[#0A006E] truncate">
                      {selectedHeaderIcon === 'BRAND_LOGO'
                        ? `${systemSettings?.brandName || 'VAAIRO'} Liquor Hub ERP`
                        : selectedHeaderIcon === 'LOCK'
                        ? 'Gateway Security Lock Active'
                        : `Active Role: ${currentRole.replace('_', ' ')}`}
                    </div>
                    <div className="text-[11px] text-[#0A006E]/80 font-semibold truncate">
                      {selectedHeaderIcon === 'BRAND_LOGO'
                        ? `Active Outlet: ${activeBranch.name} (${activeBranch.code})`
                        : selectedHeaderIcon === 'LOCK'
                        ? 'Authenticate to unlock ERP workspace'
                        : `Department: ${currentDepartment.replace('_', ' ')}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHeaderIcon(null)}
                  className="w-8 h-8 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {selectedHeaderIcon === 'BRAND_LOGO' && (
                  <>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Active Branch:</span>
                        <span className="font-montserrat font-black text-[#0A006E]">
                          {activeBranch.name} ({activeBranch.code})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Location:</span>
                        <span className="font-bold text-slate-800">
                          {activeBranch.location} ({activeBranch.county})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">KRA PIN:</span>
                        <span className="font-mono font-bold text-[#1E9E60]">
                          {activeBranch.kraPin}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAuthenticated && onSelectTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHeaderIcon(null);
                            onSelectTab('DASHBOARD');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          <span>Main Dashboard</span>
                        </button>
                      )}
                      {onOpenStorefront && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHeaderIcon(null);
                            onOpenStorefront();
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Globe className="w-4 h-4" />
                          <span>Customer Website</span>
                        </button>
                      )}
                    </div>
                  </>
                )}

                {selectedHeaderIcon === 'ROLE_BADGE' && (
                  <>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Signed-In User:</span>
                        <span className="font-montserrat font-black text-slate-900">
                          {currentUser.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Access Level:</span>
                        <span className="font-mono font-black text-[#0A006E]">
                          {currentRole}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Department:</span>
                        <span className="font-bold text-slate-800">
                          {currentDepartment.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHeaderIcon(null);
                          onOpenLoginModal();
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Switch Role</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHeaderIcon(null);
                          setIsProfileMenuOpen(true);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-montserrat font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <User className="w-4 h-4 text-[#0A006E]" />
                        <span>Full Profile</span>
                      </button>
                    </div>
                  </>
                )}

                {selectedHeaderIcon === 'LOCK' && (
                  <>
                    <p className="text-slate-600 font-medium leading-relaxed">
                      The VAAIRO ERP &amp; POS workspace is currently locked. Sign in with your departmental PIN or Executive Google SSO to continue.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHeaderIcon(null);
                        onOpenLoginModal();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Sign In / Choose Access Level</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Mobile Hamburger Drawer (< lg) — Portaled to document.body at z-[9999] so it appears on top of everything */}
      {isMobileHamburgerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="lg:hidden fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in"
            onClick={() => setIsMobileHamburgerOpen(false)}
          >
            <div
              className="bg-white text-slate-900 w-full max-w-sm h-dvh flex flex-col justify-between shadow-2xl border-l-2 border-[#0A006E] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Drawer Top Header */}
            <div className="bg-[#FFDE00] px-4 py-4 text-[#0A006E] flex items-center justify-between border-b-2 border-[#0A006E] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-sm shadow-sm shrink-0">
                  {isAuthenticated && currentUser.name ? getInitials(currentUser.name) : <Wine className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-montserrat font-black text-sm text-[#0A006E] truncate">
                    {isAuthenticated ? currentUser.name : `${systemSettings?.brandName || 'VAAIRO'} ERP`}
                  </div>
                  <div className="text-[11px] text-[#0A006E]/80 font-mono font-bold truncate">
                    {isAuthenticated
                      ? `${currentRole} • ${currentDepartment.replace('_', ' ')}`
                      : 'Gateway Access Locked'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileHamburgerOpen(false)}
                className="w-9 h-9 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition cursor-pointer shrink-0"
                aria-label="Close Mobile Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 1. Executive Profile & Active Role Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-mono font-black text-[9px] uppercase">
                    {isAuthenticated ? currentRole : 'LOCKED'}
                  </span>
                  <div className="font-montserrat font-black text-xs text-white truncate mt-1">
                    {isAuthenticated ? currentUser.name : 'Not Signed In'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {isAuthenticated ? `Dept: ${currentDepartment.replace('_', ' ')}` : 'Authenticate to unlock ERP'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileHamburgerOpen(false);
                    onOpenLoginModal();
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-[#FFDE00] text-[#FFDE00] hover:text-[#0A006E] border border-white/15 font-montserrat font-black text-[11px] flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isAuthenticated ? 'Switch Role' : 'Sign In'}</span>
                </button>
              </div>

              {/* 2. Active Branch Switcher & Quick Onboarding Bar */}
              {isAuthenticated && !isStaffPos && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/15 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E] flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#0A006E]" />
                      <span>Active Branch / Outlet</span>
                    </span>
                    {isAdminOrAccountant && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileHamburgerOpen(false);
                          setOnboardingTab('BRANCH');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-[10px] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ New Branch</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={branches.length === 0 ? '' : activeBranch.id}
                    onChange={(e) => {
                      if (e.target.value) switchBranch(e.target.value);
                    }}
                    className="w-full min-h-[42px] bg-white border-2 border-[#0A006E] rounded-xl px-3 py-2 text-xs font-montserrat font-black text-[#0A006E] focus:outline-none"
                  >
                    {branches.map(b => {
                      const parentBr = branches.find(p => p.id === b.parentBranchId);
                      const roleLabel =
                        b.tier === 'MAIN_STORE'
                          ? `[Head Office] ${b.name}`
                          : b.tier === 'DISTRIBUTOR'
                          ? `[Branch • Merchant] ${b.name}`
                          : b.tier === 'LIQUOR_STORE'
                          ? `↳ [Shop under ${parentBr?.name || b.parentBranchName || 'Branch'}] ${b.name}`
                          : `[HQ Warehouse] ${b.name}`;
                      return (
                        <option key={b.id} value={b.id}>
                          {roleLabel} ({b.code})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* 3. ERP Admin Modules Visual Grid (Moved to Top Priority on Mobile Menu) */}
              {isAuthenticated && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                      ERP Workspace Modules
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      Tap to Open
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MOBILE_ERP_MODULES.filter(m =>
                      m.id === 'SETTINGS'
                        ? currentRole === 'SUPER_ADMIN'
                        : isTabAllowed(currentRole, currentDepartment, m.id)
                    ).map(mod => {
                      const isModActive = activeTab === mod.id;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            setIsMobileHamburgerOpen(false);
                            if (onSelectTab) {
                              onSelectTab(mod.id);
                            } else {
                              window.dispatchEvent(new CustomEvent('vaairo:select-tab', { detail: { tab: mod.id } }));
                            }
                          }}
                          className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                            isModActive
                              ? 'bg-[#0A006E] text-white border-[#0A006E] ring-2 ring-[#FFDE00] shadow-sm'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isModActive
                                ? 'bg-[#FFDE00] text-[#0A006E]'
                                : 'bg-slate-100 text-[#0A006E]'
                            }`}
                          >
                            {mod.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="font-montserrat font-black text-xs leading-tight truncate">
                              {mod.shortLabel}
                            </div>
                            <div
                              className={`text-[10px] truncate mt-0.5 ${
                                isModActive ? 'text-[#FFDE00]' : 'text-slate-500'
                              }`}
                            >
                              {mod.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Quick Executive & System Actions */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-[11px] font-montserrat font-black uppercase tracking-wider text-slate-500 px-1">
                  Quick Executive Tools
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Customer Website */}
                  {onOpenStorefront && !isStaffPos && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileHamburgerOpen(false);
                        onOpenStorefront();
                      }}
                      className="p-3 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#34D186] text-[#FFDE00] flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-[#1E9E60] truncate">
                          Web Store
                        </div>
                        <div className="text-[10px] text-emerald-800 truncate">
                          {websiteDeliveryOrders.filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID').length} Active Orders
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Onboard Hub (Admin / Accountant) */}
                  {isAuthenticated && isAdminOrAccountant && !isStaffPos && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileHamburgerOpen(false);
                        setOnboardingTab('SUPPLIER');
                      }}
                      className="p-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-[#0A006E] truncate">
                          Onboard Hub
                        </div>
                        <div className="text-[10px] text-slate-600 truncate">
                          Staff, Vendors &amp; Shops
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Shop Order Requests */}
                  {isAuthenticated && isInventoryController && !isStaffPos && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileHamburgerOpen(false);
                        if (onSelectTab) {
                          onSelectTab('RESTOCK');
                        } else {
                          window.dispatchEvent(new CustomEvent('vaairo:select-tab', { detail: { tab: 'RESTOCK' } }));
                        }
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-slate-900 truncate">
                          Refill Orders
                        </div>
                        <div className="text-[10px] font-mono font-bold text-red-600 truncate">
                          {pendingNotifications.length} Pending
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Leave / Off-Duty Request */}
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileHamburgerOpen(false);
                        setLeaveModalMode(
                          currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
                            ? 'SALES_REP_OFF_DUTY'
                            : 'EMPLOYEE_LEAVE'
                        );
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0A006E] flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-slate-900 truncate">
                          {currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
                            ? 'Off-Duty Req'
                            : 'HR Leave'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">Shift &amp; Leave</div>
                      </div>
                    </button>
                  )}

                  {/* Fullscreen Toggle */}
                  {!isStaffPos && (
                    <button
                      type="button"
                      data-fullscreen-toggle="true"
                      onClick={() => {
                        handleToggleFullscreen();
                        setIsMobileHamburgerOpen(false);
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-slate-900 truncate">
                          {isFullscreen ? 'Exit Full' : 'Full Screen'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">Immersive View</div>
                      </div>
                    </button>
                  )}

                  {/* 30s Security Lock */}
                  {isAuthenticated && !isStaffPos && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileHamburgerOpen(false);
                        window.dispatchEvent(new CustomEvent('vaairo:trigger-countdown'));
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-xs text-slate-900 truncate">
                          Auto-Lock
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">30s Timer</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* PWA Install Row - Hidden on login screen */}
                {isAuthenticated && !isStaffPos && (
                  <div className="pt-1">
                    <PWAInstallButton variant="menu" />
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer: Lock / Logout */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileHamburgerOpen(false);
                    logout();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Lock / Log Out to Gateway</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileHamburgerOpen(false);
                    onOpenLoginModal();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In / Choose Access Level</span>
                </button>
              )}
            </div>
          </div>
          </div>,
          document.body
        )}

      {/* Global Onboarding Center Modal (Suppliers, Distributors, Staffs) */}
      {onboardingTab && (
        <OnboardingCenterModal
          initialTab={onboardingTab}
          onClose={() => setOnboardingTab(null)}
        />
      )}

      {/* Employee Leave (to HR) & Sales Rep Off-Duty (to Sales Manager) Modal */}
      {leaveModalMode && (
        <LeaveAndOffDutyModal
          mode={leaveModalMode}
          onClose={() => setLeaveModalMode(null)}
        />
      )}

      {/* Drawer Kick Toast Notification in Nav */}
      {navDrawerKickNotice &&
        isPosCashier &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-28 right-6 z-[10000] px-4 py-2.5 rounded-2xl bg-[#FFDE00] text-[#0A006E] border-2 border-[#0A006E] shadow-xl font-montserrat font-black text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <KeyRound className="w-4 h-4 text-[#0A006E] animate-bounce shrink-0" />
            <span>{navDrawerKickNotice}</span>
          </div>,
          document.body
        )}
    </header>
  );
};
