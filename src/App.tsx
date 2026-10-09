/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ErpProvider, useErp } from './context/ErpContext';
import { Header } from './components/common/Header';
import { Sidebar, ActiveNavTab } from './components/common/Sidebar';
import { LoginGateway } from './components/auth/LoginGateway';
import { PosTerminal } from './components/pos/PosTerminal';
import { InventoryManager } from './components/inventory/InventoryManager';
import { BranchHierarchy } from './components/branches/BranchHierarchy';
import { AccountingHub } from './components/accounting/AccountingHub';
import { PayrollManager } from './components/payroll/PayrollManager';
import { AffiliateManager } from './components/affiliates/AffiliateManager';
import { RestockManager } from './components/procurement/RestockManager';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { GeneralBusinessAnalytics } from './components/dashboard/GeneralBusinessAnalytics';
import { DeliveryManagerDashboard } from './components/delivery/DeliveryManagerDashboard';
import { SalesManagerDashboard } from './components/sales/SalesManagerDashboard';
import { AdminSettingsHub } from './components/settings/AdminSettingsHub';
import { DesktopBottomNav } from './components/common/DesktopBottomNav';
import { SessionSecurityMonitor, requestPlatformFullscreen } from './components/common/SessionSecurityMonitor';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { MobileSplashScreen } from './components/common/MobileSplashScreen';
import { CustomerStorefrontWebsite } from './components/storefront/CustomerStorefrontWebsite';
import { UniversalDashboardCommandBar } from './components/common/UniversalDashboardCommandBar';
import { getRolePermissions, isTabAllowed } from './utils/rbac';
import { ExternalLink, ShieldAlert, ArrowRight, RefreshCw, X, Shield, FileText, Cookie } from 'lucide-react';

const checkIsWebsiteRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  // Explicitly switch to Customer Storefront Website only when requested via /website, /store, /shop, /ref/*, or ?view=website / ?ref=*
  if (
    path === '/website' ||
    path.startsWith('/website/') ||
    path === '/store' ||
    path.startsWith('/store/') ||
    path === '/shop' ||
    path.startsWith('/shop/') ||
    path.startsWith('/ref/') ||
    search.get('view') === 'website' ||
    search.get('view') === 'store' ||
    search.get('mode') === 'website' ||
    search.has('ref')
  ) {
    return true;
  }
  // ERP Portal is the default landing page
  return false;
};

const ErpDashboard: React.FC = () => {
  const { currentRole, currentDepartment, currentUser, posStationMode, isAuthenticated, setIsAuthenticated, logUserActivity } = useErp();
  const permissions = getRolePermissions(currentRole, currentDepartment);

  // Initial tab set to authorized default
  const [activeTab, setActiveTabState] = useState<ActiveNavTab>(() => permissions.defaultTab);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<'POLICY' | 'TERMS' | 'COOKIES' | null>(null);
  const [isStorefrontMode, setIsStorefrontMode] = useState<boolean>(() => checkIsWebsiteRoute());
  const prevTabRef = React.useRef<ActiveNavTab>(activeTab);

  const setActiveTab = (nextTab: ActiveNavTab) => {
    if (!isTabAllowed(currentRole, currentDepartment, nextTab)) {
      const currentPerms = getRolePermissions(currentRole, currentDepartment);
      setActiveTabState(currentPerms.defaultTab);
      return;
    }
    setActiveTabState(nextTab);
  };

  // Log tab navigation safely inside an effect rather than inside a state updater
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      const previousTab = prevTabRef.current;
      prevTabRef.current = activeTab;
      if (isAuthenticated) {
        logUserActivity({
          actionType: 'TAB_NAVIGATION',
          actionTitle: `Opened ${activeTab.replace('_', ' ')} Dashboard`,
          actionDetails: `${currentUser.name} navigated from ${previousTab} to ${activeTab} dashboard.`,
          module: activeTab
        });
      }
    }
  }, [activeTab, isAuthenticated, currentUser.name]);

  const openStorefrontWebsite = () => {
    setIsStorefrontMode(true);
    requestPlatformFullscreen();
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ view: 'website' }, '', '/?view=website');
      } catch {
        // ignore history error in restricted iframe
      }
    }
  };

  const closeStorefrontToErp = () => {
    setIsStorefrontMode(false);
    requestPlatformFullscreen();
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ view: 'erp' }, '', '/');
      } catch {
        // ignore history error in restricted iframe
      }
    }
  };

  // Listen for custom events and browser popstate (for /website routing)
  useEffect(() => {
    const handleOpenStorefront = () => openStorefrontWebsite();
    const handleSelectTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: ActiveNavTab }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    const handlePopState = () => {
      setIsStorefrontMode(checkIsWebsiteRoute());
    };
    window.addEventListener('vaairo:open-storefront', handleOpenStorefront);
    window.addEventListener('vaairo:select-tab', handleSelectTab);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('vaairo:open-storefront', handleOpenStorefront);
      window.removeEventListener('vaairo:select-tab', handleSelectTab);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sync and enforce default tab (DASHBOARD for SUPER_ADMIN, POS for Sales Lady) when role, department, or auth state changes
  useEffect(() => {
    const updatedPermissions = getRolePermissions(currentRole, currentDepartment);
    setActiveTab(updatedPermissions.defaultTab);
    if (!isAuthenticated) {
      setIsLoginModalOpen(false);
    }
  }, [currentRole, currentDepartment, isAuthenticated]);

  if (isStorefrontMode) {
    return (
      <>
        <SessionSecurityMonitor />
        <CustomerStorefrontWebsite onSwitchToErp={closeStorefrontToErp} />
      </>
    );
  }

  const isSalesLadyLogin =
    currentRole === 'STAFF' && (currentDepartment === 'POS' || currentDepartment === 'AFFILIATES');
  const effectiveActiveTab: ActiveNavTab = isSalesLadyLogin ? 'POS' : activeTab;
  const isCurrentTabAllowed = isSalesLadyLogin
    ? true
    : isTabAllowed(currentRole, currentDepartment, effectiveActiveTab);

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F2F0]">
      {/* Auto Full-Screen Injector & 2-Min Inactivity -> 30s Auto Log-Off Countdown Popup */}
      <SessionSecurityMonitor />

      {/* Enterprise Header - Maintained on both login screen and dashboard */}
      <Header
        activeTab={effectiveActiveTab}
        onSelectTab={setActiveTab}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenStorefront={openStorefrontWebsite}
      />

      {!isAuthenticated ? (
        // PRE-DASHBOARD LOGIN WINDOW: Appears before accessing main dashboard
        <main className="flex-1 flex flex-col justify-center items-center py-10 sm:py-12 px-4 sm:px-6">
          <LoginGateway
            isOverlay={false}
            onSuccess={(role, dept) => {
              setIsAuthenticated(true);
              const updatedPermissions = getRolePermissions(role || currentRole, dept || currentDepartment);
              setActiveTab(updatedPermissions.defaultTab);
            }}
          />
        </main>
      ) : (
        // AUTHENTICATED MAIN DASHBOARD: Left-Docked Sidebar + Fluid Content Area
        <div className="flex-1 flex flex-col md:flex-row w-full">
          {/* Left Sidebar - Hidden on mobile so mobile uses Bottom Nav + Header Hamburger */}
          <Sidebar activeTab={effectiveActiveTab} onSelectTab={setActiveTab} />

          {/* Dynamic Module View with Strict RBAC Route Guard */}
          <main className="flex-1 min-w-0 p-3 pt-7 pb-32 sm:p-6 sm:pt-10 md:pb-10 lg:p-8 lg:pt-10">
            <div className="max-w-7xl mx-auto">
              {/* Universal Statement Generator + Live User Activity, Login & Device Monitor on EVERY Dashboard (Moved to Sidebar for Affiliate users on POS) */}
              {!(
                effectiveActiveTab === 'POS' &&
                (isSalesLadyLogin || currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY')
              ) && <UniversalDashboardCommandBar activeTab={effectiveActiveTab} />}

              {isSalesLadyLogin ? (
                <PosTerminal />
              ) : !isCurrentTabAllowed ? (
                // Access Restricted Boundary Enforced Screen
                <div className="bg-white rounded-3xl border-2 border-red-200 shadow-xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-inner">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-xs font-montserrat font-black uppercase tracking-widest px-3 py-1 bg-red-100 text-red-800 rounded-full">
                      Role-Based Access Control (RBAC) Boundary
                    </span>
                    <h2 className="font-montserrat font-black italic text-2xl sm:text-3xl text-slate-900 tracking-tight">
                      Module Access Restricted
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                      Your authenticated profile (<strong className="text-slate-900">{currentUser.name}</strong> • <strong className="text-[#0A006E]">{currentRole} - {currentDepartment.replace('_', ' ')}</strong>) is restricted from viewing the <strong className="text-red-700">{activeTab}</strong> module.
                    </p>
                  </div>

                  <div className="bg-[#F0F2F0] rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-200">
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span>Enforced Policy Rule:</span>
                      <span className="font-mono text-red-700">HTTP 403 Forbidden</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      {permissions.description}
                    </p>
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5 items-center">
                      <span className="font-bold text-slate-700 text-[11px]">Allowed Interfaces:</span>
                      {permissions.allowedTabs.map(tab => (
                        <span key={tab} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                          {tab}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab(permissions.defaultTab)}
                      className="w-full sm:w-auto px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-white rounded-xl font-montserrat font-black italic text-xs flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <span>Return to {permissions.defaultTab} Interface</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsLoginModalOpen(true)}
                      className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-montserrat font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Switch Role or Department</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Allowed Module Views
                <>
                  {effectiveActiveTab === 'DASHBOARD' && <ExecutiveDashboard />}
                  {effectiveActiveTab === 'ANALYTICS' && <GeneralBusinessAnalytics />}
                  {effectiveActiveTab === 'POS' && <PosTerminal />}
                  {effectiveActiveTab === 'DELIVERY_DASHBOARD' && <DeliveryManagerDashboard />}
                  {effectiveActiveTab === 'SALES_MANAGER_DASHBOARD' && <SalesManagerDashboard />}
                  {effectiveActiveTab === 'INVENTORY' && <InventoryManager />}
                  {effectiveActiveTab === 'BRANCHES' && <BranchHierarchy />}
                  {effectiveActiveTab === 'ACCOUNTING' && <AccountingHub />}
                  {effectiveActiveTab === 'PAYROLL' && <PayrollManager />}
                  {effectiveActiveTab === 'AFFILIATES' && <AffiliateManager />}
                  {effectiveActiveTab === 'RESTOCK' && <RestockManager />}
                  {effectiveActiveTab === 'SETTINGS' && <AdminSettingsHub />}
                </>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Role Switcher Modal (Available when authenticated) */}
      {isLoginModalOpen && (
        <LoginGateway
          isOverlay
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={(role, dept) => {
            setIsLoginModalOpen(false);
            const updatedPermissions = getRolePermissions(role || currentRole, dept || currentDepartment);
            setActiveTab(updatedPermissions.defaultTab);
          }}
        />
      )}

      {/* BOTTOM AREA: Conditional rendering based on Authentication */}
      {!isAuthenticated ? (
        // BEFORE LOGIN: Do NOT show bottom nav menu; show Policy, Terms, Cookies and All Rights Reserved
        <div className="relative sticky bottom-0 bg-white py-7 min-h-[5.5rem] flex items-center px-6 text-xs text-slate-600 z-30">
          {/* Single Wave Design at the top edge */}
          <div className="absolute left-0 right-0 -top-8 sm:-top-10 w-full leading-none pointer-events-none z-30">
            <svg
              viewBox="0 0 1200 70"
              preserveAspectRatio="none"
              className="w-full h-8 sm:h-10 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.08)]"
            >
              {/* White wave body matching bottom nav */}
              <path
                d="M0,71 L1200,71 L1200,56 C760,2 340,68 0,26 Z"
                fill="#ffffff"
              />
              {/* Golden Yellow Wave Stroke */}
              <path
                d="M0,26 C340,68 760,2 1200,56"
                fill="none"
                stroke="#FFDE00"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left relative z-20">
            {/* Copyright & All Rights Reserved */}
            <div className="flex items-center gap-2">
              <span className="font-montserrat font-bold text-slate-900">
                © {new Date().getFullYear()} VAAIRO ERP.
              </span>
              <span className="text-slate-600 font-medium">All rights reserved.</span>
              <span className="hidden md:inline text-slate-300">|</span>
              <span className="hidden md:inline text-[11px] text-slate-400 font-mono">
                Kenyan Alcohol Distribution Platform
              </span>
            </div>

            {/* Legal Links: Policy, Terms, Cookies */}
            <div className="flex items-center space-x-5 text-xs">
              <button
                onClick={() => setLegalModal('POLICY')}
                className="font-montserrat font-bold text-slate-600 hover:text-[#0A006E] transition hover:underline"
              >
                Policy
              </button>
              <button
                onClick={() => setLegalModal('TERMS')}
                className="font-montserrat font-bold text-slate-600 hover:text-[#0A006E] transition hover:underline"
              >
                Terms
              </button>
              <button
                onClick={() => setLegalModal('COOKIES')}
                className="font-montserrat font-bold text-slate-600 hover:text-[#0A006E] transition hover:underline"
              >
                Cookies
              </button>
              <span className="text-slate-300">|</span>
              <a
                href="https://urbantechdev.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-montserrat font-bold text-slate-700 hover:text-[#0A006E] transition hover:underline text-[11px]"
                title="Powered by urbantechdev"
              >
                <span>powered by <strong>urbantechdev</strong></span>
                <ExternalLink className="w-3 h-3 text-[#0A006E]" />
              </a>
            </div>
          </div>
        </div>
      ) : (
        // AFTER LOGIN: The Desktop Bottom Navigation Menu is now visible!
        <DesktopBottomNav 
          activeTab={effectiveActiveTab} 
          onSelectTab={setActiveTab} 
        />
      )}

      {/* Interactive Modal for Policy, Terms, and Cookies */}
      {legalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl p-6 sm:p-8 max-w-xl w-full h-dvh sm:h-auto max-h-dvh sm:max-h-[85vh] shadow-2xl border-0 sm:border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                  {legalModal === 'POLICY' && <Shield className="w-5 h-5" />}
                  {legalModal === 'TERMS' && <FileText className="w-5 h-5" />}
                  {legalModal === 'COOKIES' && <Cookie className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-lg text-slate-900">
                    {legalModal === 'POLICY' && 'Privacy & Compliance Policy'}
                    {legalModal === 'TERMS' && 'Distribution Terms of Service'}
                    {legalModal === 'COOKIES' && 'Cookie & Session Security'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    VAAIRO ERP • Regulatory Governance
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLegalModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 text-xs text-slate-600 leading-relaxed font-sans pr-1">
              {legalModal === 'POLICY' && (
                <>
                  <p>
                    <strong>1. Kenya Data Protection Act Compliance (2019):</strong> All employee credentials, customer phone numbers used for M-Pesa STK push requests, and KRA PIN registrations are encrypted at rest and in transit via SHA-256 and AES standards.
                  </p>
                  <p>
                    <strong>2. Statutory Audit Trails:</strong> Financial ledger mutations, 16% VAT compliance records, and inventory scrap write-offs are logged with irreversible cryptographic timestamps to satisfy tax audits.
                  </p>
                  <p>
                    <strong>3. Access Boundary Safeguards:</strong> Staff departmental profiles are isolated by design. No cashier or logistics personnel has access to financial balances, payroll records, or executive asset ledgers.
                  </p>
                </>
              )}

              {legalModal === 'TERMS' && (
                <>
                  <p>
                    <strong>1. Alcoholic Beverage Distribution Licensing:</strong> Use of this ERP is strictly authorized for licensed Kenyan merchants, wholesalers, and retail premises compliant with the Alcoholic Drinks Control Act and NACADA regulations.
                  </p>
                  <p>
                    <strong>2. Mandatory 16% VAT Enforcement:</strong> All point-of-sale and commercial transactions automatically enforce 16% Value Added Tax (VAT) and generate tax invoices recorded in the General Ledger. Users warrant that item excise stamps (LPS/IPS) match physical stock.
                  </p>
                  <p>
                    <strong>3. Role Integrity:</strong> Users are prohibited from sharing Google Workspace accounts or 6-digit staff terminal PINs across organizational hierarchies.
                  </p>
                </>
              )}

              {legalModal === 'COOKIES' && (
                <>
                  <p>
                    <strong>1. Strictly Necessary Security Tokens:</strong> VAAIRO ERP utilizes secure, origin-bound HTTP cookies and browser local storage strictly for maintaining role authentication sessions and encrypted JWT identity state.
                  </p>
                  <p>
                    <strong>2. Offline POS Cache:</strong> Local storage is utilized to temporarily buffer pending offline retail checkout cart data and KRA queue entries until network connectivity is re-established.
                  </p>
                  <p>
                    <strong>3. Zero Third-Party Advertising:</strong> No third-party advertising, commercial tracking, or marketing beacons are embedded in this enterprise ERP platform.
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-5 py-2.5 bg-[#0A006E] text-white rounded-xl font-montserrat font-bold text-xs hover:bg-[#060046] transition"
              >
                Understood &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const isForceSplash = typeof window !== 'undefined' && window.location.search.includes('splash');

  return (
    <ErpProvider>
      <OfflineIndicator />
      <MobileSplashScreen forceShow={isForceSplash} />
      <ErpDashboard />
    </ErpProvider>
  );
}
