import React, { useState, useEffect } from 'react';
import { useErp } from '../../context/ErpContext';
import { isTabAllowed, getRolePermissions } from '../../utils/rbac';
import { 
  LayoutDashboard,
  Store, 
  Boxes, 
  Network, 
  Calculator, 
  Users, 
  BadgePercent, 
  Truck, 
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  KeyRound,
  MapPin,
  TrendingUp,
  Calendar,
  Settings,
  BarChart3
} from 'lucide-react';
import { formatKes } from '../../utils/kenyaTax';
import { LeaveAndOffDutyModal } from './LeaveAndOffDutyModal';
import { UniversalDashboardCommandBar } from './UniversalDashboardCommandBar';

export type ActiveNavTab = 
  | 'DASHBOARD'
  | 'ANALYTICS'
  | 'POS' 
  | 'INVENTORY' 
  | 'BRANCHES' 
  | 'ACCOUNTING' 
  | 'PAYROLL' 
  | 'AFFILIATES' 
  | 'RESTOCK'
  | 'DELIVERY_DASHBOARD'
  | 'SALES_MANAGER_DASHBOARD'
  | 'SETTINGS';

interface Props {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
}

const NAV_ITEMS: { id: ActiveNavTab; label: string; icon: React.ReactNode }[] = [
  { id: 'DASHBOARD', label: 'Financial & Assets', icon: <LayoutDashboard className="w-8 h-8" /> },
  { id: 'ANALYTICS', label: 'Business Analytics', icon: <BarChart3 className="w-8 h-8" /> },
  { id: 'POS', label: 'POS Terminal', icon: <Store className="w-8 h-8" /> },
  { id: 'DELIVERY_DASHBOARD', label: 'Delivery Manager', icon: <MapPin className="w-8 h-8" /> },
  { id: 'SALES_MANAGER_DASHBOARD', label: 'Sales Manager', icon: <TrendingUp className="w-8 h-8" /> },
  { id: 'INVENTORY', label: 'Inventory (IPS/LPS)', icon: <Boxes className="w-8 h-8" /> },
  { id: 'BRANCHES', label: 'Distribution Chain', icon: <Network className="w-8 h-8" /> },
  { id: 'ACCOUNTING', label: 'Accounts', icon: <Calculator className="w-8 h-8" /> },
  { id: 'PAYROLL', label: 'HR & Payroll (SHIF)', icon: <Users className="w-8 h-8" /> },
  { id: 'AFFILIATES', label: 'Sales & Affiliate', icon: <BadgePercent className="w-8 h-8" /> },
  { id: 'RESTOCK', label: 'Restock & Dispatch', icon: <Truck className="w-8 h-8" /> },
];

export const Sidebar: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const {
    currentRole,
    currentDepartment,
    currentUser,
    posStationMode,
    isPosCashier,
    orders,
    etimsInvoices,
    setLastCompletedInvoice,
    employeeLeaveRequests,
    salesRepOffDutyRequests
  } = useErp();
  const permissions = getRolePermissions(currentRole, currentDepartment);
  const isStaffPosOnly =
    (currentRole === 'STAFF' && (currentDepartment === 'POS' || currentDepartment === 'AFFILIATES')) ||
    posStationMode === 'SALES_LADY';
  const isSalesRepLoggedIn =
    currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY';

  const [isLeaveOffDutyModalOpen, setIsLeaveOffDutyModalOpen] = useState(false);
  const [leaveOffDutyMode, setLeaveOffDutyMode] = useState<'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY'>(
    isSalesRepLoggedIn ? 'SALES_REP_OFF_DUTY' : 'EMPLOYEE_LEAVE'
  );

  useEffect(() => {
    const handleOpenLeaveOffDuty = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode?: 'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY' }>;
      if (customEvent.detail?.mode) {
        setLeaveOffDutyMode(customEvent.detail.mode);
      } else {
        setLeaveOffDutyMode(isSalesRepLoggedIn ? 'SALES_REP_OFF_DUTY' : 'EMPLOYEE_LEAVE');
      }
      setIsLeaveOffDutyModalOpen(true);
    };
    window.addEventListener('vaairo:open-leave-offduty', handleOpenLeaveOffDuty);
    return () => window.removeEventListener('vaairo:open-leave-offduty', handleOpenLeaveOffDuty);
  }, [isSalesRepLoggedIn]);

  // Count current user's leave or off-duty requests
  const myLeaveRequests = employeeLeaveRequests.filter(
    r =>
      r.employeeId === currentUser.id ||
      r.employeeName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase()
  );
  const myOffDutyRequests = salesRepOffDutyRequests.filter(
    r =>
      r.affiliateId === currentUser.id ||
      r.affiliateName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase()
  );

  // Strictly filter recent sales & total sold today ONLY to sales made by this specific sales person
  // Never fall back to or include sales made by another person
  const todayDatePrefix = new Date().toISOString().slice(0, 10);
  const currentSalesPersonNameNorm = (currentUser.name || '').trim().toLowerCase();

  const exactStaffOrders = orders.filter(o => {
    if (!currentSalesPersonNameNorm) return false;
    // The salesperson who made the sale is the Sales Lady (affiliateName) if attributed, otherwise the direct cashierName
    const orderSalesPersonName = (o.affiliateName || o.cashierName || '').trim().toLowerCase();
    return orderSalesPersonName === currentSalesPersonNameNorm;
  });

  const todayStaffOrders = exactStaffOrders.filter(o => {
    if (!o.createdAt) return true;
    return o.createdAt.slice(0, 10) === todayDatePrefix;
  });
  const totalSoldTodayKes = todayStaffOrders.reduce((sum, o) => sum + o.totalKes, 0);
  const recentStaffSales = [...exactStaffOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // If user is STAFF (or for categorical restrictions), completely omit tabs that do not belong to their access level
  const visibleNavItems = NAV_ITEMS.filter((item) => isTabAllowed(currentRole, currentDepartment, item.id));

  return (
    <>
    <aside className="hidden md:flex w-full md:w-72 lg:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 shrink-0 md:min-h-[calc(100vh-9rem)] flex-col justify-between pt-4 sm:pt-5">
      <div className="p-3 md:p-6 space-y-3">
        
        {/* Role & Boundary Indicator + Sales Representative Name & Total Sold Today */}
        <div className="p-3.5 rounded-2xl bg-[#F0F2F0] border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>Access Level</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black uppercase tracking-wider ${
              currentRole === 'SUPER_ADMIN' 
                ? 'bg-[#FFDE00] text-[#0A006E]' 
                : currentRole === 'ACCOUNTANT' 
                ? 'bg-[#012606] text-white' 
                : 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/20'
            }`}>
              {currentRole === 'SUPER_ADMIN' ? 'Super Admin' : currentRole === 'ACCOUNTANT' ? 'Accountant' : 'Sales Representative'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-montserrat font-black text-slate-900 truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-600 font-mono truncate mt-0.5">
                Role: <strong className="text-[#0A006E]">{currentDepartment === 'AFFILIATES' ? 'Sales Representative' : currentDepartment.replace('_', ' ')}</strong>
              </div>
            </div>

            {/* Total Sold Today next to Sales Representative Name */}
            <div
              className="px-2.5 py-1.5 rounded-xl bg-[#34D186] text-white border border-[#FFDE00]/40 text-right shrink-0 shadow-2xs"
              title={`Total sold today by ${currentUser.name} (${todayStaffOrders.length} orders)`}
            >
              <div className="text-[9px] font-montserrat font-black uppercase tracking-wider text-[#FFDE00] leading-none">
                Total Sold Today
              </div>
              <div className="text-xs sm:text-sm font-montserrat font-black text-white leading-tight mt-0.5">
                {formatKes(totalSoldTodayKes)}
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-1 text-[11px] font-montserrat font-black text-slate-400 uppercase tracking-wider hidden md:block">
          {currentRole === 'STAFF' ? 'Assigned Operational Modules' : 'System Modules'}
        </div>

        {/* Navigation list: Strictly only shows tabs belonging to the user's access level */}
        <div className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-2 md:pb-0 scrollbar-none">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group flex items-center justify-between px-4 py-3 rounded-xl text-xs sm:text-sm font-montserrat font-bold transition-all shrink-0 md:shrink relative ${
                  isActive
                    ? 'bg-[#0A006E] text-white shadow-md ring-2 ring-[#FFDE00]/40'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <span className={`shrink-0 ${
                    isActive 
                      ? 'text-[#FFDE00]' 
                      : 'text-slate-500 group-hover:text-slate-800'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="whitespace-nowrap font-bold">
                    {item.label}
                  </span>
                </div>

                <div className="hidden md:flex items-center">
                  <ChevronRight className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-[#FFDE00] translate-x-0.5' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                  }`} />
                </div>
              </button>
            );
          })}

          {/* Kick Drawer Action in Sidebar Nav — Strictly Visible ONLY to POS Cashier, NOT Sales Representative */}
          {isPosCashier && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('vaairo:kick-drawer'))}
              title="Send RJ11 Drawer Kick Pulse via ESC/POS (POS Cashier Only)"
              className="group flex items-center justify-between px-4 py-3 rounded-xl text-xs sm:text-sm font-montserrat font-bold transition-all shrink-0 md:shrink bg-amber-50 hover:bg-[#FFDE00] text-[#0A006E] border border-amber-300 shadow-2xs"
            >
              <div className="flex items-center space-x-3.5">
                <span className="shrink-0 text-amber-600 group-hover:text-[#0A006E]">
                  <KeyRound className="w-7 h-7" />
                </span>
                <span className="whitespace-nowrap font-black">
                  Kick Drawer
                </span>
              </div>
            </button>
          )}

          {/* Employee Leave Request (to HR) OR Sales Representative Off-Duty Request (to Sales Manager) */}
          <button
            type="button"
            onClick={() => {
              setLeaveOffDutyMode(isSalesRepLoggedIn ? 'SALES_REP_OFF_DUTY' : 'EMPLOYEE_LEAVE');
              setIsLeaveOffDutyModalOpen(true);
            }}
            className="group flex items-center justify-between px-4 py-3 rounded-xl text-xs sm:text-sm font-montserrat font-bold transition-all shrink-0 md:shrink bg-emerald-50 hover:bg-[#34D186] text-[#1E9E60] hover:text-[#FFDE00] border border-emerald-300 shadow-2xs cursor-pointer"
            title={
              isSalesRepLoggedIn
                ? 'Request Off-Duty from Branch Sales Manager'
                : 'Request Leave from HR Department'
            }
          >
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="whitespace-nowrap font-black leading-tight">
                  {isSalesRepLoggedIn ? 'Request Off-Duty' : 'Request HR Leave'}
                </div>
                <div className="text-[10px] font-semibold opacity-80">
                  {isSalesRepLoggedIn ? 'To Sales Manager' : 'To HR Department'}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-white/90 text-[#0A006E] font-mono font-black text-[10px] ml-2">
              {isSalesRepLoggedIn ? myOffDutyRequests.length : myLeaveRequests.length}
            </span>
          </button>
        </div>

        {/* Customized Sidebar POS Terminal & Live Activity Telemetry for Affiliate Users on POS */}
        {(isSalesRepLoggedIn || (activeTab === 'POS' && isStaffPosOnly)) && (
          <UniversalDashboardCommandBar activeTab="POS" variant="sidebar" />
        )}

        {/* Previous Sales Records by This Specific Sales Representative — Strictly on STAFF POS ONLY Sidebar */}
        {isStaffPosOnly && (
          <div className="pt-3 mt-2 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Receipt className="w-3.5 h-3.5 text-[#1E9E60] shrink-0" />
                <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#0A006E] truncate">
                  Previous Sales ({currentUser.name.split(' ')[0]})
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-mono font-black text-[10px] shrink-0">
                {recentStaffSales.length} Records
              </span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
              {recentStaffSales.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-[11px] text-slate-500">
                  No previous sales recorded by <strong className="text-slate-700">{currentUser.name}</strong> yet.
                </div>
              ) : (
                recentStaffSales.map((sale) => {
                  const isPaidSuccessful =
                    sale.paymentStatus === 'RECONCILED' ||
                    sale.paymentStatus === 'PAID' ||
                    Boolean(sale.paymentMethod);
                  const matchedInvoice = etimsInvoices.find(
                    inv => inv.orderId === sale.id || inv.invoiceNumber === sale.etimsInvoiceNumber
                  );
                  const saleMakerName = sale.affiliateName || sale.cashierName || currentUser.name;

                  return (
                    <div
                      key={sale.id}
                      onClick={() => {
                        onSelectTab('POS');
                        if (matchedInvoice) {
                          setLastCompletedInvoice(matchedInvoice);
                        }
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 transition cursor-pointer space-y-1.5 shadow-2xs"
                      title="Click to view thermal receipt"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div>
                          <span className="font-mono font-black text-[11px] text-[#0A006E]">
                            {sale.orderNumber}
                          </span>
                          <div className="text-[9px] font-mono text-slate-400">
                            {new Date(sale.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-montserrat font-black uppercase ${
                            isPaidSuccessful
                              ? 'bg-emerald-100 text-[#1E9E60] border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                          <span>{isPaidSuccessful ? 'PAID' : 'CREDIT'}</span>
                        </span>
                      </div>

                      <div className="text-[11px] font-medium text-slate-700 truncate">
                        {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[10px]">
                        <div className="text-slate-500 font-mono truncate">
                          <span className="font-bold text-slate-700">{sale.paymentMethod}</span>
                          {sale.mpesaReceiptNumber ? ` (${sale.mpesaReceiptNumber})` : ''}
                          {' • '}
                          <span>{saleMakerName.split(' ')[0]}</span>
                        </div>
                        <span className="font-montserrat font-black text-xs text-[#1E9E60] shrink-0">
                          {formatKes(sale.totalKes)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Staff Notice when single module is unlocked */}
        {currentRole === 'STAFF' && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 hidden md:block mt-2">
            <span className="font-bold">Categorical Access Enforced:</span> Non-assigned department tabs are completely hidden from your profile.
          </div>
        )}
      </div>

      {/* Powered by urbantechdev link */}
      <div className="p-4 mt-auto border-t border-slate-100 hidden md:block">
        <a
          href="https://urbantechdev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-xs text-slate-500 hover:text-[#0A006E] group transition px-2 py-1.5 rounded-lg hover:bg-slate-50"
          title="Powered by urbantechdev"
        >
          <span className="font-medium text-[11px]">
            Powered by <strong className="font-montserrat font-bold text-slate-800 group-hover:text-[#0A006E]">urbantechdev</strong>
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0A006E] transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </aside>

    {/* Employee Leave (to HR) & Sales Rep Off-Duty (to Sales Manager) Modal — Rendered outside hidden md:flex aside so Mobile Bottom Nav trigger works */}
    {isLeaveOffDutyModalOpen && (
      <LeaveAndOffDutyModal
        isOpen={isLeaveOffDutyModalOpen}
        onClose={() => setIsLeaveOffDutyModalOpen(false)}
        initialMode={leaveOffDutyMode}
      />
    )}
    </>
  );
};
