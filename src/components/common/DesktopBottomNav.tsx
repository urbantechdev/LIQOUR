import React, { useState, useEffect } from 'react';
import { useErp } from '../../context/ErpContext';
import { ActiveNavTab } from './Sidebar';
import { isTabAllowed } from '../../utils/rbac';
import { formatKes } from '../../utils/kenyaTax';
import { FloatingWideKeyboard } from './FloatingWideKeyboard';
import { 
  LayoutDashboard,
  Store, 
  Boxes, 
  Network, 
  Calculator, 
  Users, 
  BadgePercent, 
  Truck, 
  ExternalLink,
  KeyRound,
  Keyboard,
  MapPin,
  TrendingUp,
  Settings,
  BarChart3,
  LayoutGrid,
  X,
  Globe,
  Calendar,
  Sparkles,
  Smartphone,
  CheckCircle2
} from 'lucide-react';

interface Props {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
}

const NAV_ITEMS: { id: ActiveNavTab; label: string; icon: React.ReactNode; shortLabel: string; adminOnly?: boolean }[] = [
  { id: 'DASHBOARD', label: 'Financial & Assets', shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'ANALYTICS', label: 'Business Analytics', shortLabel: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'POS', label: 'POS Terminal', shortLabel: 'POS', icon: <Store className="w-4 h-4" /> },
  { id: 'DELIVERY_DASHBOARD', label: 'Delivery Manager', shortLabel: 'Deliveries', icon: <MapPin className="w-4 h-4" /> },
  { id: 'SALES_MANAGER_DASHBOARD', label: 'Sales Manager', shortLabel: 'Sales Mgr', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'INVENTORY', label: 'Inventory (IPS/LPS)', shortLabel: 'Inventory', icon: <Boxes className="w-4 h-4" /> },
  { id: 'BRANCHES', label: 'Distribution Chain', shortLabel: 'Branches', icon: <Network className="w-4 h-4" /> },
  { id: 'ACCOUNTING', label: 'Accounts', shortLabel: 'Accounts', icon: <Calculator className="w-4 h-4" /> },
  { id: 'PAYROLL', label: 'HR & Payroll', shortLabel: 'Payroll', icon: <Users className="w-4 h-4" /> },
  { id: 'AFFILIATES', label: 'Sales & Affiliate', shortLabel: 'Affiliates', icon: <BadgePercent className="w-4 h-4" /> },
  { id: 'RESTOCK', label: 'Restock & Dispatch', shortLabel: 'Restock', icon: <Truck className="w-4 h-4" /> },
];

export const DesktopBottomNav: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { cart, currentRole, currentDepartment, isPosCashier } = useErp();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isMobileModulesSheetOpen, setIsMobileModulesSheetOpen] = useState(false);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalChargeKes = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const isAdmin = currentRole === 'SUPER_ADMIN';

  const handlePosPromptClick = () => {
    if (activeTab !== 'POS') {
      onSelectTab('POS');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vaairo:pos-prompt'));
      }, 60);
      return;
    }
    window.dispatchEvent(new CustomEvent('vaairo:pos-prompt'));
  };

  const handlePosCheckoutClick = () => {
    if (activeTab !== 'POS') {
      onSelectTab('POS');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vaairo:pos-checkout'));
      }, 60);
      return;
    }
    window.dispatchEvent(new CustomEvent('vaairo:pos-checkout'));
  };

  // Ensure keyboard is automatically closed if viewport is mobile (< 768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsKeyboardOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter standard tabs by RBAC access level
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.adminOnly ? isAdmin : isTabAllowed(currentRole, currentDepartment, item.id)
  );

  // Unified mobile tab selection helper: updates state, dispatches event, closes sheet, and scrolls to top
  const handleMobileSelectTab = (tabId: ActiveNavTab) => {
    setIsMobileModulesSheetOpen(false);
    onSelectTab(tabId);
    window.dispatchEvent(new CustomEvent('vaairo:select-tab', { detail: { tab: tabId } }));
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // Pick 4 primary tabs for Mobile Bottom Bar (plus the 5th "Modules" launcher)
  // Slot 1: Dashboard (or first allowed tab)
  // Slot 2: Inventory (or second allowed tab)
  // Slot 3 (Center): POS (or primary operational tab)
  // Slot 4: Settings (for Admin) or Accounting / fourth allowed tab
  const slot1Item = visibleNavItems.find(i => i.id === 'DASHBOARD') || visibleNavItems[0];
  const slot2Item =
    visibleNavItems.find(i => i.id === 'INVENTORY' && i.id !== slot1Item?.id) ||
    visibleNavItems.find(i => i.id !== slot1Item?.id && i.id !== 'POS');
  const centerItem =
    visibleNavItems.find(i => i.id === 'POS') ||
    visibleNavItems.find(i => i.id === 'DELIVERY_DASHBOARD') ||
    visibleNavItems.find(i => i.id === 'SALES_MANAGER_DASHBOARD') ||
    visibleNavItems[0];
  const slot4Item =
    visibleNavItems.find(
      i =>
        i.id === 'ACCOUNTING' &&
        i.id !== slot1Item?.id &&
        i.id !== slot2Item?.id &&
        i.id !== centerItem?.id
    ) ||
    visibleNavItems.find(
      i =>
        i.id !== slot1Item?.id &&
        i.id !== slot2Item?.id &&
        i.id !== centerItem?.id
    );

  // All mobile modules including Settings for Super Admin
  const allMobileModules: { id: ActiveNavTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    ...visibleNavItems,
    ...(isAdmin
      ? [
          {
            id: 'SETTINGS' as ActiveNavTab,
            label: 'Admin Settings',
            shortLabel: 'Settings',
            icon: <Settings className="w-4 h-4" />
          }
        ]
      : [])
  ];

  const isSecondaryModuleActive = !([
    slot1Item?.id,
    slot2Item?.id,
    centerItem?.id,
    isAdmin ? 'SETTINGS' : slot4Item?.id
  ] as (ActiveNavTab | undefined)[]).includes(activeTab);

  return (
    <>
      {/* =====================================================================
          MOBILE ERP APP BOTTOM NAVIGATION BAR (< md) — CURVED SINGLE WAVE TOP EDGE
          ===================================================================== */}
      <nav
        aria-label="Mobile ERP Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-[48] bg-white shadow-[0_-8px_28px_rgba(10,0,110,0.18)] select-none"
      >
        {/* Single Wave Design at the top edge of Mobile Bottom Nav (Admin & All Users) */}
        <div className="absolute left-0 right-0 -top-6 w-full leading-none pointer-events-none z-30">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-6 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.10)]"
          >
            {/* White wave body seamlessly curving the top edge of the bottom nav */}
            <path
              d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z"
              fill="#ffffff"
            />
            {/* Golden Yellow Single Wave Crest Stroke */}
            <path
              d="M0,22 C340,68 760,2 1200,54"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* POS Bottom Nav Big Total Charge View + Prompt & Checkout Buttons (Mobile < md) */}
        {activeTab === 'POS' && (
          <div className="relative z-30 px-2.5 pt-2 pb-2 bg-slate-950 border-b-2 border-[#FFDE00] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                  Total Charge
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  · {cartItemCount} {cartItemCount === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <div className="font-montserrat font-black text-xl sm:text-2xl text-[#FFDE00] tracking-tight tabular-nums leading-none mt-0.5">
                {formatKes(totalChargeKes)}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePosPromptClick}
                disabled={cartItemCount === 0}
                className="px-3 py-2.5 rounded-xl bg-[#34D186] hover:bg-[#1E9E60] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                title="Send M-Pesa STK Push Prompt to Customer Phone"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Prompt</span>
              </button>

              <button
                type="button"
                onClick={handlePosCheckoutClick}
                disabled={cartItemCount === 0}
                className="px-3.5 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                title="Complete POS Checkout"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Checkout</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Row: Horizontally Scrollable Direct Module Bar (Every Allowed Tab Accessible in 1 Tap) */}
        <div className="relative z-30 flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 overflow-x-auto scrollbar-none border-b border-slate-100 bg-white">
          {allMobileModules.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={`mob-strip-${item.id}`}
                type="button"
                onClick={() => handleMobileSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-montserrat font-black whitespace-nowrap shrink-0 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs ring-1 ring-[#FFDE00]'
                    : 'bg-white text-slate-700 hover:text-[#0A006E] border border-slate-200/90'
                }`}
              >
                <span className={isActive ? 'text-[#FFDE00]' : 'text-[#0A006E]'}>
                  {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                    className: 'w-3.5 h-3.5'
                  })}
                </span>
                <span>{item.shortLabel}</span>
                {item.id === 'POS' && cartItemCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      isActive ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-[#0A006E] text-white'
                    }`}
                  >
                    {cartItemCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Direct Website Portal Pill in Mobile Scroll Strip */}
          <button
            type="button"
            onClick={() => {
              setIsMobileModulesSheetOpen(false);
              window.dispatchEvent(new CustomEvent('vaairo:open-storefront'));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-montserrat font-black whitespace-nowrap shrink-0 bg-emerald-50 text-[#1E9E60] border border-emerald-300 transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#1E9E60]" />
            <span>Website</span>
          </button>

          {/* Replay Animated VAAIRO Mobile Splash Screen */}
          <button
            type="button"
            onClick={() => {
              setIsMobileModulesSheetOpen(false);
              window.dispatchEvent(new CustomEvent('vaairo-replay-splash'));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-montserrat font-black whitespace-nowrap shrink-0 bg-amber-50 text-amber-900 border border-amber-300 transition cursor-pointer"
            title="Replay Animated VAAIRO Mobile Splash Screen"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Splash</span>
          </button>
        </div>

        {/* Bottom Row: 5-Slot Primary Mobile Admin Dock */}
        <div className="grid grid-cols-5 h-16 px-1 items-center">
          {/* Slot 1: Dashboard (or Primary Tab) */}
          {slot1Item && (
            <button
              type="button"
              onClick={() => handleMobileSelectTab(slot1Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeTab === slot1Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              <span className={activeTab === slot1Item.id ? 'text-[#0A006E]' : 'text-slate-400'}>
                {React.cloneElement(slot1Item.icon as React.ReactElement<{ className?: string }>, {
                  className: 'w-5 h-5'
                })}
              </span>
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot1Item.shortLabel}
              </span>
            </button>
          )}

          {/* Slot 2: Inventory (or 2nd Tab / Website) */}
          {slot2Item ? (
            <button
              type="button"
              onClick={() => handleMobileSelectTab(slot2Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeTab === slot2Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              <span className={activeTab === slot2Item.id ? 'text-[#0A006E]' : 'text-slate-400'}>
                {React.cloneElement(slot2Item.icon as React.ReactElement<{ className?: string }>, {
                  className: 'w-5 h-5'
                })}
              </span>
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot2Item.shortLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMobileModulesSheetOpen(false);
                window.dispatchEvent(new CustomEvent('vaairo:open-storefront'));
              }}
              className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 hover:text-[#0A006E] transition cursor-pointer"
            >
              <Globe className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] font-montserrat font-bold">Website</span>
            </button>
          )}

          {/* Slot 3: Center Elevated Action Tab (POS Terminal or Primary Operational Module) */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              type="button"
              onClick={() => handleMobileSelectTab(centerItem?.id || 'POS')}
              aria-label={`Open ${centerItem?.label || 'POS Terminal'}`}
              className={`relative w-13 h-13 -mt-4 rounded-full border-2 border-[#FFDE00] ring-4 ring-white shadow-[0_-4px_16px_rgba(10,0,110,0.4)] flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 cursor-pointer ${
                activeTab === (centerItem?.id || 'POS')
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-linear-to-tr from-[#0A006E] to-[#1E3A8A] text-white'
              }`}
            >
              {centerItem ? (
                React.cloneElement(centerItem.icon as React.ReactElement<{ className?: string }>, {
                  className: 'w-5 h-5 text-[#FFDE00]'
                })
              ) : (
                <Store className="w-5 h-5 text-[#FFDE00]" />
              )}
              <span className="text-[8px] font-montserrat font-black uppercase tracking-wider text-white leading-none truncate max-w-[44px]">
                {centerItem?.id === 'POS' ? 'POS' : centerItem?.shortLabel.slice(0, 6) || 'POS'}
              </span>
              {centerItem?.id === 'POS' && cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFDE00] text-[#0A006E] font-mono text-[9px] font-black flex items-center justify-center border border-[#0A006E]">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>

          {/* Slot 4: Admin Settings (for SUPER_ADMIN) or 4th Quick Tab / Leave Request */}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => handleMobileSelectTab('SETTINGS')}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeTab === 'SETTINGS' ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              <Settings className={`w-5 h-5 ${activeTab === 'SETTINGS' ? 'text-[#0A006E]' : 'text-slate-400'}`} />
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                Settings
              </span>
            </button>
          ) : slot4Item ? (
            <button
              type="button"
              onClick={() => handleMobileSelectTab(slot4Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeTab === slot4Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              <span className={activeTab === slot4Item.id ? 'text-[#0A006E]' : 'text-slate-400'}>
                {React.cloneElement(slot4Item.icon as React.ReactElement<{ className?: string }>, {
                  className: 'w-5 h-5'
                })}
              </span>
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot4Item.shortLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMobileModulesSheetOpen(false);
                window.dispatchEvent(new CustomEvent('vaairo:open-leave-offduty'));
              }}
              className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 hover:text-[#0A006E] transition cursor-pointer"
            >
              <Calendar className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] font-montserrat font-bold">Leave</span>
            </button>
          )}

          {/* Slot 5: All ERP Modules Bottom Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileModulesSheetOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer relative ${
              isMobileModulesSheetOpen || isSecondaryModuleActive
                ? 'text-[#0A006E]'
                : 'text-slate-500 hover:text-[#0A006E]'
            }`}
          >
            <LayoutGrid
              className={`w-5 h-5 ${
                isMobileModulesSheetOpen || isSecondaryModuleActive ? 'text-[#0A006E]' : 'text-slate-400'
              }`}
            />
            <span className="text-[10px] font-montserrat font-bold">
              {isMobileModulesSheetOpen ? 'Close' : 'Modules'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile ERP Modules Bottom Sheet (< md) — Uses z-[47] so it sits cleanly above content while keeping the bottom dock (z-[48]) interactive */}
      {isMobileModulesSheetOpen && (
        <div
          onClick={() => setIsMobileModulesSheetOpen(false)}
          className="md:hidden fixed inset-0 z-[47] bg-black/65 backdrop-blur-xs flex flex-col justify-end pb-[6.5rem] animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl max-h-[74vh] flex flex-col overflow-hidden border-t-4 border-[#FFDE00] shadow-2xl"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-black italic text-sm text-[#0A006E]">
                  VAAIRO ERP Mobile Admin Modules ({allMobileModules.length})
                </h3>
                <p className="text-[10px] text-slate-500">Tap any module below to switch active workspace</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileModulesSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                aria-label="Close Modules Sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-3 gap-2.5">
              {allMobileModules.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMobileSelectTab(item.id)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
                      isActive
                        ? 'bg-[#0A006E] text-white border-[#0A006E] ring-2 ring-[#FFDE00]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className={isActive ? 'text-[#FFDE00]' : 'text-[#0A006E]'}>
                      {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                        className: 'w-5 h-5'
                      })}
                    </span>
                    <span className="text-[11px] font-montserrat font-bold leading-tight">
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsMobileModulesSheetOpen(false);
                  window.dispatchEvent(new CustomEvent('vaairo:open-leave-offduty'));
                }}
                className="p-3 rounded-2xl border border-blue-200 bg-blue-50/80 text-[#0A006E] flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-[#0A006E]" />
                <span className="text-[11px] font-montserrat font-bold leading-tight">HR Leave</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileModulesSheetOpen(false);
                  window.dispatchEvent(new CustomEvent('vaairo:open-storefront'));
                }}
                className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-[#1E9E60] flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
              >
                <Globe className="w-5 h-5 text-[#1E9E60]" />
                <span className="text-[11px] font-montserrat font-bold leading-tight">Website</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileModulesSheetOpen(false);
                  window.dispatchEvent(new CustomEvent('vaairo-replay-splash'));
                }}
                className="p-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="text-[11px] font-montserrat font-bold leading-tight">Splash Screen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DESKTOP BOTTOM NAVIGATION BAR (md+) — CURVED SINGLE WAVE TOP EDGE
          ===================================================================== */}
      <nav className="hidden md:flex relative sticky bottom-0 z-30 bg-white px-3 sm:px-6 h-24 min-h-[6rem] items-center justify-center">
      {/* Single Wave Design at the top edge */}
      <div className="absolute left-0 right-0 -top-8 sm:-top-10 w-full leading-none pointer-events-none z-30">
        <svg
          viewBox="0 0 1200 70"
          preserveAspectRatio="none"
          className="w-full h-8 sm:h-10 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.08)]"
        >
          {/* White wave body matching bottom nav */}
          <path
            d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z"
            fill="#ffffff"
          />
          {/* Golden Yellow Wave Stroke */}
          <path
            d="M0,22 C340,68 760,2 1200,54"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="w-full max-w-[96rem] mx-auto flex items-center justify-between gap-2 relative z-20">
        
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 lg:space-x-2 overflow-x-auto scrollbar-none py-1 min-w-0">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-xl text-xs font-montserrat font-bold transition-all shrink-0 shadow-2xs relative cursor-pointer ${
                  isActive
                    ? 'bg-[#0A006E] text-white shadow-md ring-2 ring-[#FFDE00]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-[#FFDE00]' : 'text-slate-400'}`}>
                  {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                    className: 'w-4 h-4 sm:w-5 sm:h-5'
                  })}
                </span>
                <span className="whitespace-nowrap">{item.shortLabel}</span>

                {item.id === 'POS' && cartItemCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-[#0A006E] text-white'
                  }`}>
                    {cartItemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* POS Bottom Nav Big Total Charge View + Prompt & Checkout Buttons (Desktop md+) */}
        {activeTab === 'POS' && (
          <div className="flex items-center gap-2.5 lg:gap-3 px-3.5 py-2 rounded-2xl bg-slate-950 border-2 border-[#0A006E] shadow-lg shrink-0">
            <div className="pr-2 border-r border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-montserrat font-black uppercase tracking-widest text-[#FFDE00]">
                  Total Charge
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  · {cartItemCount} {cartItemCount === 1 ? 'unit' : 'units'}
                </span>
              </div>
              <div className="font-montserrat font-black text-2xl lg:text-3xl text-[#FFDE00] tracking-tight tabular-nums leading-none mt-0.5">
                {formatKes(totalChargeKes)}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePosPromptClick}
              disabled={cartItemCount === 0}
              className="px-4 py-2.5 rounded-xl bg-[#34D186] hover:bg-[#1E9E60] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A006E] border border-[#FFDE00]/50 font-montserrat font-black text-xs lg:text-sm flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
              title="Trigger M-Pesa STK Push Prompt to Customer Handset"
            >
              <Smartphone className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>Prompt</span>
            </button>

            <button
              type="button"
              onClick={handlePosCheckoutClick}
              disabled={cartItemCount === 0}
              className="px-4 lg:px-5 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#0A006E] border-2 border-[#FFDE00] font-montserrat font-black text-xs lg:text-sm flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
              title="Settle & Complete POS Checkout"
            >
              <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
              <span>Checkout</span>
            </button>
          </div>
        )}

        {/* Right Pinned Actions: Admin Settings Icon (Strictly ONLY for Admin), Kick Drawer (Non-Admin POS Cashier only), Wide Keyboard Icon */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pl-2 border-l border-slate-200">
          {/* Admin Settings Icon Button in Bottom Desktop Nav — Strictly Visible ONLY for Admin (SUPER_ADMIN) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onSelectTab('SETTINGS')}
              title="Admin Setting (Brand & Product Prices CSV/Manual, Logo/Favicon, Offers, Campaigns & Promotions)"
              aria-label="Admin Setting"
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shrink-0 border shadow-sm cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-[#0A006E] text-[#FFDE00] border-[#FFDE00] ring-2 ring-[#FFDE00]'
                  : 'bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] border-[#0A006E]/30'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
            </button>
          )}

          {/* Kick Drawer Button in Bottom Nav — Strictly Visible ONLY to Non-Admin POS Cashier */}
          {isPosCashier && !isAdmin && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('vaairo:kick-drawer'))}
              title="Send RJ11 Drawer Kick Pulse via ESC/POS (POS Cashier Only)"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs font-montserrat font-black transition-all shrink-0 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border border-[#0A006E]/20 shadow-sm cursor-pointer"
            >
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A006E] shrink-0" />
              <span className="whitespace-nowrap hidden sm:inline">Kick Drawer</span>
            </button>
          )}

          {/* Open Wide Floating Keyboard Icon Button in Bottom Nav */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsKeyboardOpen(prev => !prev)}
            title={isKeyboardOpen ? 'Hide Wide Floating Touchscreen Keyboard' : 'Open Wide Floating Touchscreen Keyboard'}
            aria-label={isKeyboardOpen ? 'Hide Keyboard' : 'Open Wide Keyboard'}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shrink-0 border shadow-sm cursor-pointer ${
              isKeyboardOpen
                ? 'bg-[#34D186] text-[#FFDE00] border-[#FFDE00] ring-2 ring-[#FFDE00]/50'
                : 'bg-slate-900 hover:bg-[#0A006E] text-[#FFDE00] border-[#0A006E]/30'
            }`}
          >
            <Keyboard className="w-5 h-5 text-[#FFDE00] shrink-0" />
          </button>

          {/* Powered by urbantechdev branding */}
          <div className="hidden 2xl:flex items-center pl-1 shrink-0">
            <a
              href="https://urbantechdev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-[#0A006E] transition shadow-2xs group"
              title="Powered by urbantechdev"
            >
              <span className="text-[11px] font-medium">
                Powered by <strong className="font-montserrat font-bold text-slate-800 group-hover:text-[#0A006E]">urbantechdev</strong>
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#0A006E]" />
            </a>
          </div>
        </div>

      </div>
      </nav>

      {/* Wide Floating Touchscreen POS Keyboard */}
      <FloatingWideKeyboard
        isOpen={isKeyboardOpen}
        onClose={() => setIsKeyboardOpen(false)}
      />
    </>
  );
};
