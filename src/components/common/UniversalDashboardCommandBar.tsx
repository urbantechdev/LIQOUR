import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useErp } from '../../context/ErpContext';
import { ActiveNavTab } from './Sidebar';
import {
  DepartmentType,
  UserActivityActionType,
  UserActivityLog,
  UserSessionMonitorRecord,
  LiveLoggedInCustomer
} from '../../types';
import {
  detectKenyanMobileCarrier,
  formatKenyanMobileDisplay
} from '../../utils/kenyanMobileCarrier';
import {
  FileText,
  Activity,
  Monitor,
  Smartphone,
  Tablet,
  Printer,
  Download,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  Building2,
  Calendar,
  ArrowUpRight,
  LogIn,
  LogOut,
  Eye,
  Database,
  RefreshCw
} from 'lucide-react';

interface UniversalDashboardCommandBarProps {
  activeTab: ActiveNavTab;
  variant?: 'top' | 'sidebar';
}

const DASHBOARD_LABELS: Record<ActiveNavTab, { title: string; department: DepartmentType; subtitle: string }> = {
  DASHBOARD: {
    title: 'Executive Command Dashboard',
    department: 'FINANCE',
    subtitle: 'Consolidated Revenue, Branch Stock, 16% VAT & Multi-Branch Telemetry'
  },
  ANALYTICS: {
    title: 'General Business Analytics',
    department: 'FINANCE',
    subtitle: 'Cross-Branch SKU Velocity, Margin Performance & Demand Intelligence'
  },
  POS: {
    title: 'Point of Sale (POS) & Counter Terminal',
    department: 'POS',
    subtitle: 'Retail & Wholesale Checkout, Counter Queue & M-Pesa/Cash Settlement'
  },
  DELIVERY_DASHBOARD: {
    title: 'Branch Delivery & Rider Dispatch Dashboard',
    department: 'DELIVERY_MANAGER',
    subtitle: 'Last-Mile Storefront Orders, Rider Routing & Pay-on-Delivery'
  },
  SALES_MANAGER_DASHBOARD: {
    title: 'Branch Sales Manager Dashboard',
    department: 'SALES_MANAGER',
    subtitle: 'Branch Sales Representatives, Counter Cashiers & Target Oversight'
  },
  INVENTORY: {
    title: 'Inventory, Barcode & Excise Stamp Hub',
    department: 'INVENTORY',
    subtitle: 'Physical Stock Counts, Case-to-Bottle Unpacking & Valuation'
  },
  BRANCHES: {
    title: 'Multi-Branch Hierarchy & Store Network',
    department: 'INVENTORY',
    subtitle: 'Main Store Warehouses, Regional Merchants & Retail Liquor Stores'
  },
  ACCOUNTING: {
    title: 'CPA Accounting, General Ledger & 16% VAT',
    department: 'FINANCE',
    subtitle: 'Double-Entry Journal Postings, Trial Balance, Enforced 16% VAT & B2B Invoicing'
  },
  PAYROLL: {
    title: 'HR, Statutory Payroll & Casual Commissions',
    department: 'HR_PAYROLL',
    subtitle: 'PAYE, NSSF, SHIF, Housing Levy & Staff Onboarding Directory'
  },
  AFFILIATES: {
    title: 'Sales Representatives & Commission Engine',
    department: 'AFFILIATES',
    subtitle: 'Separated Preferred Price Profit, Base Commissions & B2C Payouts'
  },
  RESTOCK: {
    title: 'Restock, Procurement & Warehouse Disbursement',
    department: 'PROCUREMENT',
    subtitle: 'Shop Refill Orders, Supplier Invoices & Auto-Disbursement'
  },
  SETTINGS: {
    title: 'Enterprise System Administration & RBAC',
    department: 'FINANCE',
    subtitle: 'Security Policies, Tax Rates, Daraja API & Audit Controls'
  }
};

export const UniversalDashboardCommandBar: React.FC<UniversalDashboardCommandBarProps> = ({
  activeTab,
  variant = 'top'
}) => {
  const {
    currentUser,
    currentRole,
    currentDepartment,
    posStationMode,
    activeBranch,
    branches,
    orders,
    etimsInvoices,
    products,
    inventoryItems,
    employees,
    affiliates,
    commissions,
    payrollRecords,
    journalEntries,
    restockRequests,
    websiteDeliveryOrders,
    staffDatabaseRecords,
    userActivityLogs,
    userSessionMonitors,
    logUserActivity,
    unifiedDbSyncStatus,
    lastUnifiedDbSyncAt,
    unifiedCollectionsCount,
    totalUnifiedRecordsCount,
    syncAllDataToUnifiedDatabase,
    liveLoggedInCustomers,
    consumers
  } = useErp();

  const [isSyncingUnifiedDb, setIsSyncingUnifiedDb] = useState(false);

  const [isActivityPanelExpanded, setIsActivityPanelExpanded] = useState(false);
  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState(false);
  const [monitorTab, setMonitorTab] = useState<'SESSIONS' | 'ACTIVITIES' | 'CUSTOMERS'>('SESSIONS');

  // Merge live logged-in customer sessions with active website order customers & registered online consumers
  const mergedLiveCustomers = useMemo<LiveLoggedInCustomer[]>(() => {
    const byKey = new Map<string, LiveLoggedInCustomer>();
    liveLoggedInCustomers.forEach(c => {
      const key = (c.email || c.uid || c.phone).toLowerCase();
      if (!key) return;
      const carrierInfo = detectKenyanMobileCarrier(c.phone || '');
      byKey.set(key, {
        ...c,
        phone: carrierInfo.cleanDigits || c.phone || '',
        carrier: carrierInfo.carrier !== 'UNKNOWN' ? carrierInfo.carrier : c.carrier || 'UNKNOWN'
      });
    });
    websiteDeliveryOrders.forEach(ord => {
      const email = (ord.customerEmail || '').trim().toLowerCase();
      const key = email || ord.customerPhone || ord.id;
      const existing = byKey.get(key);
      const carrierInfo = detectKenyanMobileCarrier(ord.customerPhone || '');
      const isHold = ord.deliveryStatus !== 'COMPLETED_AND_PAID';
      if (!existing) {
        byKey.set(key, {
          uid: `web-cust-${ord.id}`,
          name: ord.customerName || 'Online Customer',
          email: ord.customerEmail || `${ord.customerName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
          phone: carrierInfo.cleanDigits || ord.customerPhone || '',
          carrier: carrierInfo.carrier,
          deliveryZone: ord.deliveryLocation,
          branchId: ord.branchId,
          branchName: ord.branchName,
          cartItemsCount: ord.items.reduce((s, i) => s + i.quantity, 0),
          cartTotalKes: ord.totalCompanyPriceKes,
          activeOrdersCount: isHold ? 1 : 0,
          status: isHold ? 'ORDER_PLACED' : 'ONLINE',
          loginAt: ord.createdAt,
          lastActiveAt: ord.deliveredAt || ord.createdAt
        });
      }
    });
    consumers.forEach(con => {
      const email = (con.email || '').trim().toLowerCase();
      const key = email || con.phone || con.id;
      if (!byKey.has(key) && (email || con.phone)) {
        const carrierInfo = detectKenyanMobileCarrier(con.phone || '');
        byKey.set(key, {
          uid: con.id,
          name: con.fullName,
          email: con.email || `${con.fullName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
          phone: carrierInfo.cleanDigits || con.phone,
          carrier: carrierInfo.carrier,
          deliveryZone: con.defaultDeliveryLocation,
          branchId: con.preferredBranchId,
          cartItemsCount: 0,
          cartTotalKes: con.lifetimeSpendKes || 0,
          activeOrdersCount: con.totalOrdersCount || 0,
          status: 'ONLINE',
          loginAt: con.lastOrderAt || new Date().toISOString(),
          lastActiveAt: con.lastOrderAt || new Date().toISOString()
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) =>
      String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || ''))
    );
  }, [liveLoggedInCustomers, websiteDeliveryOrders, consumers]);

  // Statement Generator Modal State
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementScope, setStatementScope] = useState<'CURRENT_DASHBOARD' | 'USER_STATEMENT' | 'ALL_ENTERPRISE'>('CURRENT_DASHBOARD');
  const [selectedStatementDashboard, setSelectedStatementDashboard] = useState<ActiveNavTab>(activeTab);
  const [selectedStatementUserId, setSelectedStatementUserId] = useState<string>('ALL');
  const [selectedStatementBranchId, setSelectedStatementBranchId] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS'>('ALL');

  // Filters for Activity & Session Monitor
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [filterActionType, setFilterActionType] = useState<string>('ALL');
  const [filterDeviceType, setFilterDeviceType] = useState<string>('ALL');

  const dashboardMeta = DASHBOARD_LABELS[activeTab] || DASHBOARD_LABELS.DASHBOARD;

  // Build unified user session monitor list combining live sessions + all registered staff/affiliates/employees
  const unifiedUserMonitors = useMemo<UserSessionMonitorRecord[]>(() => {
    const byId = new Map<string, UserSessionMonitorRecord>();

    // 1. Seed with live session monitors
    userSessionMonitors.forEach(s => {
      byId.set(s.userId, s);
    });

    // 2. Ensure currently logged-in user is always represented as Active Login
    if (currentUser?.id) {
      const existing = byId.get(currentUser.id);
      const nowIso = new Date().toISOString();
      if (!existing) {
        byId.set(currentUser.id, {
          userId: currentUser.id,
          userName: currentUser.name,
          employeeNumberOrCode:
            currentRole === 'SUPER_ADMIN'
              ? 'EXEC-ADMIN'
              : currentRole === 'ACCOUNTANT'
              ? 'CPA-ACCT'
              : 'ACTIVE-STAFF',
          userRole: currentRole,
          department: currentDepartment,
          branchId: activeBranch.id,
          branchName: activeBranch.name,
          isActiveLogin: true,
          activeLoginAt: nowIso,
          lastLoginAt: nowIso,
          lastHeartbeatAt: nowIso,
          loginCount: 1,
          lastActionTitle: `Viewing ${dashboardMeta.title}`,
          lastActionDetails: `Active session in ${activeTab}`,
          lastActionAt: nowIso,
          currentModule: activeTab,
          deviceUsed:
            typeof navigator !== 'undefined'
              ? /Mobile|Android|iPhone/i.test(navigator.userAgent)
                ? 'Mobile Smartphone • Web Browser'
                : 'Desktop Workstation • Web Browser'
              : 'Desktop Workstation',
          deviceType:
            typeof navigator !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent)
              ? 'MOBILE'
              : 'DESKTOP',
          browserOs: 'Active Browser Session',
          authMethod: currentRole === 'STAFF' ? 'STAFF_PIN' : 'GOOGLE_SSO',
          updatedAt: nowIso
        });
      } else {
        byId.set(currentUser.id, {
          ...existing,
          isActiveLogin: true,
          currentModule: activeTab
        });
      }
    }

    // 3. Merge all registered records from Independent Staff Database, Employees & Affiliates
    staffDatabaseRecords.forEach(rec => {
      const existing = byId.get(rec.id);
      const userLogs = userActivityLogs.filter(
        l => l.userId === rec.id || l.userName.toLowerCase() === rec.name.toLowerCase()
      );
      const latestLog = userLogs[0];
      if (!existing) {
        byId.set(rec.id, {
          userId: rec.id,
          userName: rec.name,
          employeeNumberOrCode: rec.codeOrNumber,
          userRole: 'STAFF',
          department: rec.department,
          branchId: rec.branchId,
          branchName: rec.branchName || 'Assigned Branch',
          isActiveLogin: currentUser?.id === rec.id,
          activeLoginAt: currentUser?.id === rec.id ? rec.lastLoginAt || rec.updatedAt : undefined,
          lastLoginAt: rec.lastLoginAt || latestLog?.timestamp,
          loginCount: rec.loginCount || (rec.lastLoginAt ? 1 : 0),
          lastActionTitle: latestLog?.actionTitle || 'Account Provisioned in Staff DB',
          lastActionDetails:
            latestLog?.actionDetails || `${rec.roleTitle} • Ready for 6-digit PIN login`,
          lastActionAt: latestLog?.timestamp || rec.updatedAt,
          currentModule: latestLog?.module || rec.department,
          deviceUsed: latestLog?.deviceUsed || 'Awaiting Terminal Login',
          deviceType: latestLog?.deviceType || 'DESKTOP',
          browserOs: latestLog?.browserOs || 'Not Yet Connected',
          authMethod: 'STAFF_PIN',
          updatedAt: rec.updatedAt
        });
      }
    });

    employees.forEach(emp => {
      if (!byId.has(emp.id)) {
        const br = branches.find(b => b.id === emp.branchId);
        const latestLog = userActivityLogs.find(
          l => l.userId === emp.id || l.userName.toLowerCase() === emp.name.toLowerCase()
        );
        byId.set(emp.id, {
          userId: emp.id,
          userName: emp.name,
          employeeNumberOrCode: emp.employeeNumber,
          userRole: 'STAFF',
          department: emp.department,
          branchId: emp.branchId,
          branchName: br?.name || 'Assigned Branch',
          isActiveLogin: currentUser?.id === emp.id,
          lastLoginAt: latestLog?.timestamp,
          loginCount: latestLog ? 1 : 0,
          lastActionTitle: latestLog?.actionTitle || 'Registered Employee',
          lastActionDetails: latestLog?.actionDetails || `${emp.roleTitle} (${emp.department})`,
          lastActionAt: latestLog?.timestamp,
          currentModule: latestLog?.module || emp.department,
          deviceUsed: latestLog?.deviceUsed || 'Awaiting Terminal Login',
          deviceType: latestLog?.deviceType || 'DESKTOP',
          browserOs: latestLog?.browserOs || '—',
          authMethod: 'STAFF_PIN',
          updatedAt: new Date().toISOString()
        });
      }
    });

    affiliates.forEach(aff => {
      if (!byId.has(aff.id)) {
        const br = branches.find(b => b.id === aff.branchId);
        const latestLog = userActivityLogs.find(
          l => l.userId === aff.id || l.userName.toLowerCase() === aff.name.toLowerCase()
        );
        byId.set(aff.id, {
          userId: aff.id,
          userName: aff.name,
          employeeNumberOrCode: aff.code,
          userRole: 'STAFF',
          department: 'AFFILIATES',
          branchId: aff.branchId,
          branchName: br?.name || 'Assigned Branch',
          isActiveLogin: currentUser?.id === aff.id,
          lastLoginAt: latestLog?.timestamp,
          loginCount: latestLog ? 1 : 0,
          lastActionTitle: latestLog?.actionTitle || 'Registered Sales Representative',
          lastActionDetails:
            latestLog?.actionDetails || `Sales Representative (${aff.commissionRatePercent}% Comm)`,
          lastActionAt: latestLog?.timestamp,
          currentModule: latestLog?.module || 'AFFILIATES',
          deviceUsed: latestLog?.deviceUsed || 'Awaiting Terminal Login',
          deviceType: latestLog?.deviceType || 'MOBILE',
          browserOs: latestLog?.browserOs || '—',
          authMethod: 'STAFF_PIN',
          updatedAt: new Date().toISOString()
        });
      }
    });

    const isBranchManagerRole =
      currentDepartment === 'BRANCH_MANAGER' ||
      currentDepartment === 'SALES_MANAGER' ||
      currentDepartment === 'HR_PAYROLL';

    return Array.from(byId.values())
      .filter(u => {
        if (currentRole === 'SUPER_ADMIN' || currentRole === 'ACCOUNTANT') return true;
        if (
          u.userId === currentUser?.id ||
          u.userName.toLowerCase() === (currentUser?.name || '').toLowerCase()
        ) {
          return true;
        }
        if (isBranchManagerRole) {
          return !u.branchId || u.branchId === activeBranch.id;
        }
        return false;
      })
      .sort((a, b) => {
        if (a.isActiveLogin !== b.isActiveLogin) return a.isActiveLogin ? -1 : 1;
        return (b.lastLoginAt || b.updatedAt || '').localeCompare(a.lastLoginAt || a.updatedAt || '');
      });
  }, [
    userSessionMonitors,
    currentUser,
    currentRole,
    currentDepartment,
    activeBranch,
    activeTab,
    dashboardMeta.title,
    staffDatabaseRecords,
    employees,
    affiliates,
    branches,
    userActivityLogs
  ]);

  const activeUsersCount = useMemo(
    () => unifiedUserMonitors.filter(u => u.isActiveLogin).length,
    [unifiedUserMonitors]
  );

  // Filtered Activity Logs
  const filteredActivities = useMemo<UserActivityLog[]>(() => {
    const isBranchManagerRole =
      currentDepartment === 'BRANCH_MANAGER' ||
      currentDepartment === 'SALES_MANAGER' ||
      currentDepartment === 'HR_PAYROLL';

    return userActivityLogs.filter(log => {
      if (currentRole === 'STAFF') {
        const isOwnLog =
          log.userId === currentUser?.id ||
          log.userName.toLowerCase() === (currentUser?.name || '').toLowerCase();
        if (!isOwnLog) {
          if (!isBranchManagerRole) return false;
          if (log.branchId && log.branchId !== activeBranch.id) return false;
        }
      }
      if (filterUserId !== 'ALL' && log.userId !== filterUserId) return false;
      if (filterActionType !== 'ALL' && log.actionType !== filterActionType) return false;
      if (filterDeviceType !== 'ALL' && log.deviceType !== filterDeviceType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          log.userName.toLowerCase().includes(q) ||
          log.actionTitle.toLowerCase().includes(q) ||
          log.actionDetails.toLowerCase().includes(q) ||
          log.deviceUsed.toLowerCase().includes(q) ||
          log.module.toLowerCase().includes(q) ||
          (log.branchName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    userActivityLogs,
    currentRole,
    currentDepartment,
    currentUser,
    activeBranch.id,
    filterUserId,
    filterActionType,
    filterDeviceType,
    searchQuery
  ]);

  // Filtered User Sessions
  const filteredSessions = useMemo<UserSessionMonitorRecord[]>(() => {
    return unifiedUserMonitors.filter(session => {
      if (filterUserId !== 'ALL' && session.userId !== filterUserId) return false;
      if (filterDeviceType !== 'ALL' && session.deviceType !== filterDeviceType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          session.userName.toLowerCase().includes(q) ||
          (session.employeeNumberOrCode || '').toLowerCase().includes(q) ||
          session.department.toLowerCase().includes(q) ||
          session.deviceUsed.toLowerCase().includes(q) ||
          (session.lastActionTitle || '').toLowerCase().includes(q) ||
          (session.branchName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [unifiedUserMonitors, filterUserId, filterDeviceType, searchQuery]);

  const openDashboardStatementModal = (
    scope: 'CURRENT_DASHBOARD' | 'USER_STATEMENT' | 'ALL_ENTERPRISE' = 'CURRENT_DASHBOARD',
    targetUserId?: string
  ) => {
    const effectiveScope =
      currentRole !== 'SUPER_ADMIN' && scope === 'ALL_ENTERPRISE' ? 'CURRENT_DASHBOARD' : scope;
    setStatementScope(effectiveScope);
    setSelectedStatementDashboard(activeTab);
    if (currentRole === 'STAFF') {
      setSelectedStatementBranchId(activeBranch.id);
    }
    if (
      currentRole === 'STAFF' &&
      (currentDepartment === 'POS' || currentDepartment === 'AFFILIATES')
    ) {
      setSelectedStatementUserId(currentUser.id);
    } else if (targetUserId) {
      setSelectedStatementUserId(targetUserId);
    } else {
      setSelectedStatementUserId('ALL');
    }
    setIsStatementModalOpen(true);

    const targetUserObj = targetUserId
      ? unifiedUserMonitors.find(u => u.userId === targetUserId)
      : null;

    logUserActivity({
      actionType: 'STATEMENT_GENERATED',
      actionTitle:
        effectiveScope === 'USER_STATEMENT' && targetUserObj
          ? `Generated User Statement for ${targetUserObj.userName}`
          : `Generated ${DASHBOARD_LABELS[activeTab]?.title || activeTab} Statement`,
      actionDetails: `Statement generated from ${activeTab} dashboard by ${currentUser.name} (${currentRole}).`,
      module: activeTab
    });
  };

  // Compute Statement Data dynamically based on selected dashboard, user, branch & date filter
  const statementData = useMemo(() => {
    if (!isStatementModalOpen) {
      return {
        targetUser: null,
        scopedOrders: [],
        scopedCommissions: [],
        scopedActivities: [],
        totalRevenueKes: 0,
        totalCompanySalesKes: 0,
        totalCommissionsKes: 0,
        pendingCommissionsKes: 0,
        paidCommissionsKes: 0,
        totalStockBottles: 0,
        totalStockValueKes: 0,
        tableHeaders: [] as string[],
        tableRows: [] as string[][]
      };
    }

    const productById = new Map(products.map(p => [p.id, p]));
    const now = Date.now();
    const isWithinDate = (isoOrDate?: string) => {
      if (!isoOrDate || dateFilter === 'ALL') return true;
      const parsed = Date.parse(isoOrDate);
      if (Number.isNaN(parsed)) return true;
      const diffMs = now - parsed;
      if (dateFilter === 'TODAY') return diffMs <= 24 * 3600 * 1000;
      if (dateFilter === '7_DAYS') return diffMs <= 7 * 24 * 3600 * 1000;
      if (dateFilter === '30_DAYS') return diffMs <= 30 * 24 * 3600 * 1000;
      return true;
    };

    const targetUser =
      selectedStatementUserId !== 'ALL'
        ? unifiedUserMonitors.find(u => u.userId === selectedStatementUserId)
        : null;

    const scopedOrders = orders.filter(o => {
      if (currentRole === 'STAFF' && o.branchId !== activeBranch.id) return false;
      if (selectedStatementBranchId !== 'ALL' && o.branchId !== selectedStatementBranchId) return false;
      if (!isWithinDate(o.createdAt)) return false;
      if (
        currentRole === 'STAFF' &&
        (currentDepartment === 'POS' || currentDepartment === 'AFFILIATES')
      ) {
        const myName = currentUser.name.toLowerCase();
        return (
          o.cashierId === currentUser.id ||
          o.affiliateId === currentUser.id ||
          (o.cashierName || '').toLowerCase() === myName ||
          (o.affiliateName || '').toLowerCase() === myName
        );
      }
      if (targetUser) {
        const uName = targetUser.userName.toLowerCase();
        return (
          o.cashierId === targetUser.userId ||
          o.affiliateId === targetUser.userId ||
          (o.cashierName || '').toLowerCase() === uName ||
          (o.affiliateName || '').toLowerCase() === uName
        );
      }
      return true;
    });

    const scopedCommissions = commissions.filter(c => {
      if (!isWithinDate(c.createdAt)) return false;
      if (targetUser) {
        return (
          c.affiliateId === targetUser.userId ||
          c.affiliateName.toLowerCase().includes(targetUser.userName.toLowerCase())
        );
      }
      return true;
    });

    const scopedActivities = userActivityLogs.filter(a => {
      if (selectedStatementBranchId !== 'ALL' && a.branchId && a.branchId !== selectedStatementBranchId)
        return false;
      if (!isWithinDate(a.timestamp)) return false;
      if (targetUser) {
        return (
          a.userId === targetUser.userId ||
          a.userName.toLowerCase() === targetUser.userName.toLowerCase()
        );
      }
      return true;
    });

    const scopedInventory = inventoryItems.filter(inv => {
      if (selectedStatementBranchId !== 'ALL' && inv.branchId !== selectedStatementBranchId) return false;
      return true;
    });

    const totalRevenueKes = scopedOrders.reduce((s, o) => s + (o.totalKes ?? o.totalAmount ?? 0), 0);
    const totalCompanySalesKes = scopedOrders.reduce(
      (s, o) => s + (o.companySalesKes ?? o.companySalesTotal ?? o.totalKes ?? 0),
      0
    );
    const totalCommissionsKes = scopedCommissions.reduce((s, c) => s + c.markupEarnedKes, 0);
    const pendingCommissionsKes = scopedCommissions
      .filter(c => c.status === 'PENDING')
      .reduce((s, c) => s + c.markupEarnedKes, 0);
    const paidCommissionsKes = scopedCommissions
      .filter(c => c.status === 'PAID')
      .reduce((s, c) => s + c.markupEarnedKes, 0);

    const totalStockBottles = scopedInventory.reduce((s, i) => s + i.bottlesOnHand, 0);
    const totalStockValueKes = scopedInventory.reduce((s, i) => {
      const p = productById.get(i.productId);
      return s + i.bottlesOnHand * (p?.retailPriceKes || 0);
    }, 0);

    // Build rows depending on statement scope & selected dashboard
    const targetDash = selectedStatementDashboard;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    if (statementScope === 'USER_STATEMENT' && targetUser) {
      tableHeaders = ['Timestamp', 'Action / Event', 'Details & Reference', 'Module', 'Device Used'];
      const combinedRows: string[][] = [];
      scopedOrders.forEach(o => {
        combinedRows.push([
          o.createdAt.replace('T', ' ').slice(0, 19),
          `SALE (${o.saleType})`,
          `Order ${o.orderNumber} • KES ${(o.totalKes ?? o.totalAmount ?? 0).toLocaleString()} (${o.paymentMethod})`,
          'POS',
          targetUser.deviceUsed
        ]);
      });
      scopedCommissions.forEach(c => {
        combinedRows.push([
          c.createdAt.replace('T', ' ').slice(0, 19),
          `COMMISSION (${c.status})`,
          `Order ${c.orderNumber} • Earned KES ${c.markupEarnedKes.toLocaleString()}`,
          'COMMISSIONS',
          targetUser.deviceUsed
        ]);
      });
      scopedActivities.forEach(act => {
        combinedRows.push([
          act.timestamp.replace('T', ' ').slice(0, 19),
          act.actionType,
          `${act.actionTitle} — ${act.actionDetails}`,
          act.module,
          act.deviceUsed
        ]);
      });
      tableRows = combinedRows.slice(0, 80);
    } else if (targetDash === 'INVENTORY' || targetDash === 'BRANCHES') {
      tableHeaders = ['SKU', 'Product Name', 'Branch', 'Bottles On Hand', 'Cases', 'Retail Value (KES)'];
      tableRows = scopedInventory.slice(0, 80).map(inv => {
        const prod = productById.get(inv.productId);
        const br = branches.find(b => b.id === inv.branchId);
        const val = inv.bottlesOnHand * (prod?.retailPriceKes || 0);
        return [
          prod?.sku || inv.productId,
          prod?.name || 'Beverage SKU',
          br?.name || inv.branchId,
          inv.bottlesOnHand.toLocaleString(),
          inv.casesOnHand.toLocaleString(),
          `KES ${val.toLocaleString()}`
        ];
      });
    } else if (targetDash === 'PAYROLL') {
      tableHeaders = ['Staff / Code', 'Department', 'Model / Role', 'Salary / Sales (KES)', 'Commission / Net Pay', 'Last Login & Device'];
      tableRows = unifiedUserMonitors.slice(0, 80).map(u => {
        const emp = employees.find(e => e.id === u.userId);
        const aff = affiliates.find(a => a.id === u.userId);
        const salesOrBasic = emp
          ? emp.employmentType === 'CASUAL'
            ? emp.totalSalesKes || 0
            : emp.basicSalaryKes
          : aff?.totalSalesKes || 0;
        const commOrNet = emp
          ? emp.employmentType === 'CASUAL'
            ? emp.totalCommissionEarnedKes || 0
            : emp.basicSalaryKes + emp.houseAllowanceKes + emp.transportAllowanceKes
          : aff?.totalCommissionEarnedKes || 0;
        return [
          `${u.userName} (${u.employeeNumberOrCode || 'STAFF'})`,
          u.department,
          emp?.roleTitle || (aff ? 'Sales Representative' : u.userRole),
          `KES ${salesOrBasic.toLocaleString()}`,
          `KES ${commOrNet.toLocaleString()}`,
          `${u.lastLoginAt ? u.lastLoginAt.replace('T', ' ').slice(0, 16) : 'Never'} • ${u.deviceUsed}`
        ];
      });
    } else if (targetDash === 'AFFILIATES' || targetDash === 'SALES_MANAGER_DASHBOARD') {
      tableHeaders = ['Date', 'Representative / Cashier', 'Order Ref', 'Company Price', 'Earned Comm/Profit', 'Status'];
      tableRows = scopedCommissions.slice(0, 80).map(c => [
        c.createdAt.replace('T', ' ').slice(0, 16),
        c.affiliateName,
        c.orderNumber,
        `KES ${c.baselinePriceKes.toLocaleString()}`,
        `KES ${c.markupEarnedKes.toLocaleString()}`,
        c.status
      ]);
      if (tableRows.length === 0) {
        tableHeaders = ['Rep / Cashier', 'Code', 'Branch', 'Total Sales (KES)', 'Total Earned (KES)', 'Pending Payout'];
        tableRows = [
          ...affiliates.map(a => [
            a.name,
            a.code,
            branches.find(b => b.id === a.branchId)?.name || 'Branch',
            `KES ${a.totalSalesKes.toLocaleString()}`,
            `KES ${a.totalCommissionEarnedKes.toLocaleString()}`,
            `KES ${a.pendingCommissionKes.toLocaleString()}`
          ]),
          ...employees
            .filter(e => e.department === 'POS')
            .map(e => [
              `${e.name} (Cashier)`,
              e.employeeNumber,
              branches.find(b => b.id === e.branchId)?.name || 'Branch',
              `KES ${(e.totalSalesKes || 0).toLocaleString()}`,
              `KES ${(e.totalCommissionEarnedKes || 0).toLocaleString()}`,
              `KES ${(e.pendingCommissionKes || 0).toLocaleString()}`
            ])
        ];
      }
    } else if (targetDash === 'ACCOUNTING') {
      tableHeaders = ['Date', 'Entry #', 'Reference', 'Description', 'Debit (KES)', 'Credit (KES)'];
      tableRows = journalEntries.slice(0, 80).map(je => [
        je.date,
        je.entryNumber,
        `${je.referenceType}: ${je.referenceId}`,
        je.description,
        `KES ${je.totalDebitKes.toLocaleString()}`,
        `KES ${je.totalCreditKes.toLocaleString()}`
      ]);
    } else if (targetDash === 'RESTOCK') {
      tableHeaders = ['Created', 'Request #', 'From Shop', 'Supplying Store', 'SKUs', 'Status'];
      tableRows = restockRequests.slice(0, 80).map(r => [
        r.createdAt.replace('T', ' ').slice(0, 16),
        r.requestNumber,
        r.fromBranchName,
        r.toBranchName,
        `${r.items.length} SKU(s)`,
        r.status
      ]);
    } else if (targetDash === 'DELIVERY_DASHBOARD') {
      tableHeaders = ['Created', 'Web Order #', 'Customer & Location', 'Fulfilling Branch', 'Total (KES)', 'Status'];
      tableRows = websiteDeliveryOrders.slice(0, 80).map(w => [
        w.createdAt.replace('T', ' ').slice(0, 16),
        w.orderNumber,
        `${w.customerName} (${w.deliveryLocation})`,
        w.branchName,
        `KES ${w.totalCompanyPriceKes.toLocaleString()}`,
        w.deliveryStatus
      ]);
    } else {
      // Default / Executive / POS / Analytics: Show Orders + Recent User Activities if no orders yet
      if (scopedOrders.length > 0) {
        tableHeaders = ['Date & Time', 'Order / VAT Invoice #', 'Served By', 'Payment', 'Company Sales', 'Total Paid (KES)'];
        tableRows = scopedOrders.slice(0, 80).map(o => [
          o.createdAt.replace('T', ' ').slice(0, 16),
          `${o.orderNumber} (${o.etimsInvoiceNumber})`,
          o.cashierName || o.affiliateName || 'Counter Staff',
          o.paymentMethod,
          `KES ${(o.companySalesKes ?? o.companySalesTotal ?? o.totalKes ?? 0).toLocaleString()}`,
          `KES ${(o.totalKes ?? o.totalAmount ?? 0).toLocaleString()}`
        ]);
      } else {
        tableHeaders = ['Timestamp', 'User & Role', 'Action', 'Details', 'Module', 'Device Used'];
        tableRows = scopedActivities.slice(0, 80).map(a => [
          a.timestamp.replace('T', ' ').slice(0, 19),
          `${a.userName} (${a.userRole})`,
          a.actionTitle,
          a.actionDetails,
          a.module,
          a.deviceUsed
        ]);
      }
    }

    return {
      targetUser,
      scopedOrders,
      scopedCommissions,
      scopedActivities,
      totalRevenueKes,
      totalCompanySalesKes,
      totalCommissionsKes,
      pendingCommissionsKes,
      paidCommissionsKes,
      totalStockBottles,
      totalStockValueKes,
      tableHeaders,
      tableRows
    };
  }, [
    isStatementModalOpen,
    dateFilter,
    selectedStatementUserId,
    selectedStatementBranchId,
    selectedStatementDashboard,
    statementScope,
    unifiedUserMonitors,
    orders,
    commissions,
    userActivityLogs,
    inventoryItems,
    products,
    branches,
    employees,
    affiliates,
    journalEntries,
    restockRequests,
    websiteDeliveryOrders
  ]);

  const handleExportStatementCsv = () => {
    const lines: string[] = [];
    const statementRef = `STM-${selectedStatementDashboard.slice(0, 4)}-${Date.now().toString().slice(-6)}`;
    lines.push(`"VAAIRO ERP OFFICIAL STATEMENT","${statementRef}"`);
    lines.push(
      `"Dashboard / Module","${DASHBOARD_LABELS[selectedStatementDashboard]?.title || selectedStatementDashboard}"`
    );
    lines.push(`"Generated By","${currentUser.name} (${currentRole} - ${currentDepartment})"`);
    lines.push(`"Generated At","${new Date().toISOString()}"`);
    if (statementData.targetUser) {
      lines.push(
        `"Target User","${statementData.targetUser.userName} (${statementData.targetUser.employeeNumberOrCode || ''})"`
      );
      lines.push(`"Last Login","${statementData.targetUser.lastLoginAt || 'N/A'}"`);
      lines.push(`"Device Used","${statementData.targetUser.deviceUsed}"`);
    }
    lines.push('');
    lines.push(statementData.tableHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    statementData.tableRows.forEach(row => {
      lines.push(row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${statementRef.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderDeviceIcon = (deviceType?: 'DESKTOP' | 'MOBILE' | 'TABLET') => {
    if (deviceType === 'MOBILE') return <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    if (deviceType === 'TABLET') return <Tablet className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
    return <Monitor className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />;
  };

  const formatTimestampShort = (iso?: string) => {
    if (!iso) return 'Not Logged In Yet';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const isAffiliateOnPos =
    currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY';

  const latestDisplayActivity = useMemo<UserActivityLog | null>(() => {
    if (isAffiliateOnPos && currentUser?.name) {
      const affiliateLog = userActivityLogs.find(
        l =>
          l.userId === currentUser.id ||
          l.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
      if (affiliateLog) return affiliateLog;
    }
    return userActivityLogs[0] || null;
  }, [isAffiliateOnPos, currentUser?.id, currentUser?.name, userActivityLogs]);

  return (
    <div className={variant === 'sidebar' ? 'space-y-2.5 print:hidden' : 'mb-5 space-y-3 print:hidden'}>
      {variant === 'sidebar' ? (
        /* CUSTOMIZED SIDEBAR CARD FOR AFFILIATE USERS ON POS (WHITE BACKGROUND) */
        <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm p-3.5 space-y-3">
          {/* Latest User Activity Box (Customized for Affiliate User on POS) */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
            <div className="font-montserrat font-black uppercase tracking-wider text-[10px] text-[#0A006E]">
              Latest User Activity:
            </div>
            {latestDisplayActivity ? (
              <div className="space-y-1">
                <div className="text-xs leading-snug">
                  <span className="font-montserrat font-black text-slate-900">
                    {latestDisplayActivity.userName}
                  </span>
                  <span className="text-slate-400 mx-1.5">•</span>
                  <span className="text-slate-700 font-medium">
                    {latestDisplayActivity.actionTitle}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[10px] w-full">
                  {renderDeviceIcon(latestDisplayActivity.deviceType)}
                  <span className="truncate">{latestDisplayActivity.deviceUsed}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  ({formatTimestampShort(latestDisplayActivity.timestamp)})
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs leading-snug">
                  <span className="font-montserrat font-black text-slate-900">{currentUser.name}</span>
                  <span className="text-slate-400 mx-1.5">•</span>
                  <span className="text-slate-700 font-medium">
                    Signed In as {currentUser.name} ({currentDepartment})
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  ({formatTimestampShort(new Date().toISOString())})
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Compact Actions for Affiliate POS User */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => openDashboardStatementModal('USER_STATEMENT', currentUser.id)}
              className="px-2.5 py-2 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] border border-[#0A006E]/20 font-montserrat font-black text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Generate personal statement for this affiliate user"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">My Statement</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMonitorModalOpen(true);
                setMonitorTab('SESSIONS');
              }}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-montserrat font-bold text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Open User & Device Activity Monitor"
            >
              <Monitor className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Devices ({unifiedUserMonitors.length})</span>
            </button>
          </div>
        </div>
      ) : (
      /* TOP COMMAND BAR: Available on EVERY Dashboard */
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-3 py-2.5 sm:px-5 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Active Dashboard Identity + Live Session Telemetry — Desktop Only (md+), Removed on Mobile */}
        <div className="hidden md:flex flex-wrap items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-montserrat font-black italic text-xs sm:text-sm text-slate-900 truncate">
                {dashboardMeta.title}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeUsersCount} Active Login{activeUsersCount === 1 ? '' : 's'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                <Users className="w-3 h-3 text-[#0A006E]" />
                {unifiedUserMonitors.length} Monitored Users
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMonitorModalOpen(true);
                  setMonitorTab('CUSTOMERS');
                }}
                title="View live logged-in storefront customers (Name, Email & Mobile Contact)"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-[#34D186] text-[#1E9E60] text-[10px] font-mono font-bold transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D186] animate-pulse" />
                <span>Live Customers ({mergedLiveCustomers.length})</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSyncingUnifiedDb(true);
                  const res = await syncAllDataToUnifiedDatabase();
                  setIsSyncingUnifiedDb(false);
                  logUserActivity({
                    actionType: 'SYSTEM_SETTINGS_UPDATED',
                    actionTitle: `Unified System & Cloud Database Synced (${res.syncedCollections} Collections)`,
                    actionDetails: `All ${res.totalRecords.toLocaleString()} ERP records unified across System State, IndexedDB & Cloud Firestore.`,
                    module: activeTab
                  });
                }}
                title={
                  lastUnifiedDbSyncAt
                    ? `All ${unifiedCollectionsCount} ERP collections unified in System & Firestore DB • Last synced: ${formatTimestampShort(lastUnifiedDbSyncAt)}`
                    : 'Click to force unify & sync all ERP collections with Cloud Database'
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#0A006E] text-[10px] font-mono font-bold transition cursor-pointer"
              >
                <Database className="w-3 h-3 text-[#0A006E]" />
                <span>
                  Unified DB: {unifiedDbSyncStatus} ({totalUnifiedRecordsCount.toLocaleString()} Recs)
                </span>
                <RefreshCw
                  className={`w-2.5 h-2.5 text-indigo-600 ${
                    isSyncingUnifiedDb || unifiedDbSyncStatus === 'SYNCING' ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>

            {/* Latest Live Activity Ticker */}
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-600">
              <span className="font-bold text-[#0A006E] uppercase tracking-wider text-[10px]">
                Latest User Activity:
              </span>
              {latestDisplayActivity ? (
                <div className="flex flex-wrap items-center gap-1.5 truncate">
                  <span className="font-semibold text-slate-900">{latestDisplayActivity.userName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-700 truncate max-w-xs sm:max-w-md">
                    {latestDisplayActivity.actionTitle}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                    {renderDeviceIcon(latestDisplayActivity.deviceType)}
                    <span className="truncate max-w-[160px]">{latestDisplayActivity.deviceUsed}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({formatTimestampShort(latestDisplayActivity.timestamp)})
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 italic">
                  Session active on {currentUser.name} — all actions &amp; logins monitored live.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Universal Statement Generator & User Activity Monitor Triggers */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openDashboardStatementModal('CURRENT_DASHBOARD')}
            className="px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-black italic text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#FFDE00]" />
            <span>Generate Dashboard Statement</span>
          </button>

          <button
            type="button"
            onClick={() => openDashboardStatementModal('USER_STATEMENT', currentUser.id)}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-slate-900 border border-amber-300 font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Generate personal statement for the current user or any staff member"
          >
            <Printer className="w-3.5 h-3.5 text-[#0A006E]" />
            <span>User Statement</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMonitorModalOpen(true);
              setMonitorTab('SESSIONS');
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Monitor Users &amp; Devices ({unifiedUserMonitors.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsActivityPanelExpanded(prev => !prev)}
            className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-xs flex items-center gap-1 border border-slate-200 transition cursor-pointer"
            title="Toggle Recent User Activities Feed on this Dashboard"
          >
            <span>Recent Activities</span>
            {isActivityPanelExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* EXPANDABLE INLINE RECENT ACTIVITIES & ACTIVE LOGINS DRAWER ON EVERY DASHBOARD */}
      {isActivityPanelExpanded && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-montserrat font-black italic text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0A006E]" />
                <span>Live User Sessions, Recent Activities &amp; Device Telemetry</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Real-time visibility into every user&apos;s active login status, last login timestamp, recent activity actions, and device used.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMonitorModalOpen(true);
                  setMonitorTab('SESSIONS');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0A006E] text-white text-[11px] font-montserrat font-bold flex items-center gap-1.5 hover:bg-[#060046] transition"
              >
                <Eye className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Open Full Activity &amp; Device Monitor</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 5 cols: Active & Recent User Logins */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-montserrat font-bold text-slate-700">
                <span>User Login &amp; Device Status</span>
                <span className="text-[10px] font-mono text-emerald-700">
                  {activeUsersCount} Online Now
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {unifiedUserMonitors.slice(0, 8).map(u => (
                  <div
                    key={u.userId}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            u.isActiveLogin ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span className="font-montserrat font-bold text-slate-900 truncate">
                          {u.userName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0A006E] font-mono text-[10px] font-bold">
                          {u.department}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            u.isActiveLogin
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {u.isActiveLogin ? 'ACTIVE LOGIN' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        <strong>Action:</strong> {u.lastActionTitle || 'Logged in'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>Last Login: {formatTimestampShort(u.lastLoginAt)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          {renderDeviceIcon(u.deviceType)}
                          {u.deviceUsed}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDashboardStatementModal('USER_STATEMENT', u.userId)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 text-[#0A006E] border border-slate-200 font-montserrat font-bold text-[10px] shrink-0 transition"
                      title={`Generate Statement for ${u.userName}`}
                    >
                      Statement
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 7 cols: Chronological Recent Activities from Every User */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs font-montserrat font-bold text-slate-700">
                <span>Recent Activities From Every User</span>
                <span className="text-[10px] font-mono text-slate-500">
                  Showing latest {Math.min(10, userActivityLogs.length)} of {userActivityLogs.length} events
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {userActivityLogs.slice(0, 10).map(act => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-montserrat font-bold text-slate-900">
                          {act.userName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[9px] font-bold">
                          {act.actionType}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 font-mono text-[9px] font-semibold">
                          {act.module}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800 text-[11px]">
                        {act.actionTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {act.actionDetails}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-[10px] font-mono text-slate-500">
                        {formatTimestampShort(act.timestamp)}
                      </div>
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[9px]">
                        {renderDeviceIcon(act.deviceType)}
                        <span className="max-w-[140px] truncate">{act.deviceUsed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FULL USER ACTIVITY, LOGIN & DEVICE TELEMETRY MONITOR */}
      {isMonitorModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#FFDE00] text-[#0A006E] px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-[#0A006E]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-md">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-montserrat font-black italic text-base sm:text-lg tracking-tight text-[#0A006E]">
                      User Activity, Login &amp; Device Telemetry Monitor
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-mono text-[10px] font-bold">
                      LIVE TELEMETRY
                    </span>
                  </div>
                  <p className="text-xs text-[#0A006E]/80 font-semibold">
                    Monitor every user&apos;s active login state, last login timestamp, recent activity action, device used, and generate per-user statements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMonitorModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center self-end sm:self-auto transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                  Total Monitored Users
                </span>
                <div className="text-xl font-montserrat font-black text-slate-900 mt-0.5">
                  {unifiedUserMonitors.length}
                </div>
                <span className="text-[10px] text-slate-500">Executives, Staff &amp; Sales Reps</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-montserrat font-bold uppercase text-emerald-700">
                  Active Logins Right Now
                </span>
                <div className="text-xl font-montserrat font-black text-emerald-700 mt-0.5 flex items-center gap-2">
                  <span>{activeUsersCount}</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <span className="text-[10px] text-emerald-600">Live authenticated sessions</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                  Total Logged Actions
                </span>
                <div className="text-xl font-montserrat font-black text-[#0A006E] mt-0.5">
                  {userActivityLogs.length}
                </div>
                <span className="text-[10px] text-slate-500">Sales, Logins, Stock &amp; Statements</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                  Current Device Session
                </span>
                <div className="text-xs font-montserrat font-bold text-slate-900 mt-1 truncate">
                  {unifiedUserMonitors.find(u => u.userId === currentUser.id)?.deviceUsed ||
                    'Desktop Workstation'}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  User: {currentUser.name}
                </span>
              </div>
            </div>

            {/* Filter & Tab Controls */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonitorTab('SESSIONS')}
                  className={`px-4 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center gap-2 transition ${
                    monitorTab === 'SESSIONS'
                      ? 'bg-[#0A006E] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>User Sessions, Last Login &amp; Device ({filteredSessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorTab('CUSTOMERS')}
                  className={`px-4 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center gap-2 transition ${
                    monitorTab === 'CUSTOMERS'
                      ? 'bg-[#34D186] text-white shadow-xs'
                      : 'bg-emerald-50 text-[#1E9E60] border border-[#34D186]/40 hover:bg-emerald-100'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Live Logged-In Customers ({mergedLiveCustomers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorTab('ACTIVITIES')}
                  className={`px-4 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center gap-2 transition ${
                    monitorTab === 'ACTIVITIES'
                      ? 'bg-[#0A006E] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>All User Activities Stream ({filteredActivities.length})</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search user, action, device..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-[#0A006E]"
                  />
                </div>

                <select
                  value={filterUserId}
                  onChange={e => setFilterUserId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium text-slate-700"
                >
                  <option value="ALL">All Users ({unifiedUserMonitors.length})</option>
                  {unifiedUserMonitors.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.userName} ({u.department})
                    </option>
                  ))}
                </select>

                {monitorTab === 'ACTIVITIES' && (
                  <select
                    value={filterActionType}
                    onChange={e => setFilterActionType(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="ALL">All Action Types</option>
                    <option value="LOGIN">Logins</option>
                    <option value="LOGOUT">Logouts</option>
                    <option value="POS_SALE">POS Sales</option>
                    <option value="HOLD_CART">Held / Queued Orders</option>
                    <option value="STATEMENT_GENERATED">Statements Generated</option>
                    <option value="STAFF_CREATED">Staff Onboarding</option>
                    <option value="COMMISSION_PAYOUT">Commission Payouts</option>
                    <option value="PAYROLL_ACTION">Payroll Runs</option>
                    <option value="RESTOCK_ACTION">Restock Actions</option>
                    <option value="TAB_NAVIGATION">Module Switches</option>
                  </select>
                )}

                <select
                  value={filterDeviceType}
                  onChange={e => setFilterDeviceType(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium text-slate-700"
                >
                  <option value="ALL">All Devices</option>
                  <option value="DESKTOP">Desktop PC / Mac</option>
                  <option value="MOBILE">Mobile Smartphone</option>
                  <option value="TABLET">Tablet</option>
                </select>
              </div>
            </div>

            {/* Body Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {monitorTab === 'SESSIONS' ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] font-montserrat font-black uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">User &amp; Role</th>
                        <th className="py-3 px-3">Active Login Status</th>
                        <th className="py-3 px-3">Last Login &amp; Active Since</th>
                        <th className="py-3 px-4">Latest Activity Action</th>
                        <th className="py-3 px-4">Device Used &amp; OS</th>
                        <th className="py-3 px-3 text-right">Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredSessions.map(s => (
                        <tr key={s.userId} className="hover:bg-slate-50/90 transition">
                          <td className="py-3 px-4">
                            <div className="font-montserrat font-bold text-slate-900">
                              {s.userName}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0A006E] font-mono text-[10px] font-bold">
                                {s.department}
                              </span>
                              {s.employeeNumberOrCode && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {s.employeeNumberOrCode}
                                </span>
                              )}
                              {s.branchName && (
                                <span className="text-[10px] text-slate-500">
                                  • {s.branchName}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {s.isActiveLogin ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                ACTIVE LOGIN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                OFFLINE
                              </span>
                            )}
                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                              Logins: <strong>{s.loginCount || 0}</strong> • Auth: {s.authMethod || 'PIN'}
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-[11px]">
                            <div className="text-slate-900 font-semibold">
                              Last: {formatTimestampShort(s.lastLoginAt)}
                            </div>
                            {s.isActiveLogin && s.activeLoginAt && (
                              <div className="text-emerald-700 text-[10px]">
                                Active since: {formatTimestampShort(s.activeLoginAt)}
                              </div>
                            )}
                            {!s.isActiveLogin && s.lastLogoutAt && (
                              <div className="text-slate-500 text-[10px]">
                                Ended: {formatTimestampShort(s.lastLogoutAt)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">
                              {s.lastActionTitle || 'No recent activity'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {s.lastActionDetails}
                            </div>
                            {s.lastActionAt && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                {formatTimestampShort(s.lastActionAt)} in {s.currentModule || s.department}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-[10px] font-semibold">
                              {renderDeviceIcon(s.deviceType)}
                              <span>{s.deviceUsed}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setIsMonitorModalOpen(false);
                                openDashboardStatementModal('USER_STATEMENT', s.userId);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#FFDE00]" />
                              <span>User Statement</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : monitorTab === 'ACTIVITIES' ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] font-montserrat font-black uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">User &amp; Department</th>
                        <th className="py-3 px-3">Action Type</th>
                        <th className="py-3 px-4">Activity Action &amp; Details</th>
                        <th className="py-3 px-3">Dashboard / Module</th>
                        <th className="py-3 px-4">Device Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredActivities.map(act => (
                        <tr key={act.id} className="hover:bg-slate-50/90 transition">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {formatTimestampShort(act.timestamp)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-montserrat font-bold text-slate-900">
                              {act.userName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {act.userRole} • {act.department}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0A006E] font-mono text-[10px] font-bold">
                              {act.actionType}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <div className="font-semibold text-slate-900">{act.actionTitle}</div>
                            <div className="text-[11px] text-slate-600">{act.actionDetails}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                            {act.module}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-[10px]">
                              {renderDeviceIcon(act.deviceType)}
                              <span>{act.deviceUsed}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] font-montserrat font-black uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Contact / Mobile Number</th>
                        <th className="py-3 px-3">Network</th>
                        <th className="py-3 px-4">Delivery Location &amp; Branch</th>
                        <th className="py-3 px-3">Live Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {mergedLiveCustomers
                        .filter(c => {
                          const q = searchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.email.toLowerCase().includes(q) ||
                            c.phone.toLowerCase().includes(q) ||
                            (c.deliveryZone || '').toLowerCase().includes(q)
                          );
                        })
                        .map(cust => {
                          const carrierInfo = detectKenyanMobileCarrier(cust.phone || '');
                          const isAirtel =
                            carrierInfo.carrier === 'AIRTEL' || cust.carrier === 'AIRTEL';
                          const isSafaricom =
                            carrierInfo.carrier === 'SAFARICOM' || cust.carrier === 'SAFARICOM';
                          return (
                            <tr key={cust.uid + cust.email} className="hover:bg-slate-50/90 transition">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[#34D186] animate-pulse shrink-0" />
                                  <div>
                                    <div className="font-montserrat font-black text-slate-900">
                                      {cust.name}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-500">
                                      Last Active: {formatTimestampShort(cust.lastActiveAt)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#0A006E]">
                                <a href={`mailto:${cust.email}`} className="hover:underline">
                                  {cust.email}
                                </a>
                              </td>
                              <td className="py-3 px-4 font-mono font-black text-slate-900">
                                {cust.phone ? (
                                  <a href={`tel:${cust.phone}`} className="hover:text-[#0A006E]">
                                    {formatKenyanMobileDisplay(cust.phone)}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">Pending phone</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                {isAirtel ? (
                                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-montserrat font-black text-[9px] uppercase">
                                    Airtel
                                  </span>
                                ) : isSafaricom ? (
                                  <span className="px-2 py-0.5 rounded-full bg-[#34D186] text-white font-montserrat font-black text-[9px] uppercase">
                                    Safaricom
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-montserrat font-bold text-[9px] uppercase">
                                    Mobile
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                <div className="font-semibold">
                                  {cust.deliveryZone || 'Nairobi Metro'}
                                </div>
                                {cust.branchName && (
                                  <div className="text-[10px] text-slate-500">
                                    Branch: {cust.branchName}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] font-montserrat font-black text-[10px] uppercase">
                                  {cust.status.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                All logins, active sessions, POS transactions, and device signatures are synced in real time.
              </span>
              <button
                type="button"
                onClick={() => setIsMonitorModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-montserrat font-bold text-xs hover:bg-slate-800 transition"
              >
                Close Monitor
              </button>
            </div>
          </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: UNIVERSAL DASHBOARD & USER STATEMENT GENERATOR */}
      {isStatementModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Top Controls */}
            <div className="bg-[#FFDE00] text-[#0A006E] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-[#0A006E]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-montserrat font-black italic text-base sm:text-lg text-[#0A006E]">
                    Official Statement Generator
                  </h2>
                  <p className="text-xs text-[#0A006E]/80 font-semibold">
                    Generate, print, or export CSV statements for any dashboard, branch, or individual user.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportStatementCsv}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A006E] border border-[#0A006E]/30 font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#0A006E]" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black italic text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Statement Configuration Bar */}
            <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-montserrat font-bold uppercase text-slate-500 mb-1">
                  Statement Type
                </label>
                <select
                  value={statementScope}
                  onChange={e =>
                    setStatementScope(
                      e.target.value as 'CURRENT_DASHBOARD' | 'USER_STATEMENT' | 'ALL_ENTERPRISE'
                    )
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="CURRENT_DASHBOARD">Dashboard Module Statement</option>
                  <option value="USER_STATEMENT">Individual User / Staff Statement</option>
                  <option value="ALL_ENTERPRISE">Consolidated Enterprise Statement</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-bold uppercase text-slate-500 mb-1">
                  Dashboard / Department
                </label>
                <select
                  value={selectedStatementDashboard}
                  onChange={e => setSelectedStatementDashboard(e.target.value as ActiveNavTab)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  {(Object.keys(DASHBOARD_LABELS) as ActiveNavTab[]).map(tabKey => (
                    <option key={tabKey} value={tabKey}>
                      {DASHBOARD_LABELS[tabKey].title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-bold uppercase text-slate-500 mb-1">
                  Filter by User / Staff
                </label>
                <select
                  value={selectedStatementUserId}
                  onChange={e => {
                    setSelectedStatementUserId(e.target.value);
                    if (e.target.value !== 'ALL') {
                      setStatementScope('USER_STATEMENT');
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="ALL">All Users / Whole Dashboard</option>
                  {unifiedUserMonitors.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.userName} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-bold uppercase text-slate-500 mb-1">
                  Period &amp; Branch
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={dateFilter}
                    onChange={e =>
                      setDateFilter(e.target.value as 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS')
                    }
                    className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                  >
                    <option value="ALL">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="7_DAYS">Last 7 Days</option>
                    <option value="30_DAYS">Last 30 Days</option>
                  </select>
                  <select
                    value={selectedStatementBranchId}
                    onChange={e => setSelectedStatementBranchId(e.target.value)}
                    className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                  >
                    <option value="ALL">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Printable Statement Document Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              {/* Official Letterhead */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#0A006E]">
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-[#0A006E] font-bold">
                    VAAIRO BEVERAGES &amp; MERCHANTS LTD • OFFICIAL ERP STATEMENT
                  </div>
                  <h1 className="font-montserrat font-black italic text-xl sm:text-2xl text-slate-900 mt-1">
                    {statementScope === 'USER_STATEMENT' && statementData.targetUser
                      ? `User Activity & Financial Statement: ${statementData.targetUser.userName}`
                      : `${DASHBOARD_LABELS[selectedStatementDashboard]?.title || selectedStatementDashboard} Statement`}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {DASHBOARD_LABELS[selectedStatementDashboard]?.subtitle}
                  </p>
                </div>
                <div className="text-left sm:text-right font-mono text-xs space-y-0.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">
                    REF: STM-{selectedStatementDashboard.slice(0, 4)}-{Date.now().toString().slice(-5)}
                  </div>
                  <div className="text-slate-600">
                    Date: {new Date().toLocaleString()}
                  </div>
                  <div className="text-slate-600">
                    Prepared By: {currentUser.name} ({currentRole})
                  </div>
                  <div className="text-[#0A006E] font-bold">
                    KRA PIN: {activeBranch.kraPin || 'P051902841K'}
                  </div>
                </div>
              </div>

              {/* If Individual User Statement is selected, show User Login & Device Telemetry Card */}
              {statementData.targetUser && (
                <div className="bg-blue-50/70 rounded-2xl p-4 border border-blue-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Staff / User Profile
                    </span>
                    <strong className="text-slate-900 text-sm">
                      {statementData.targetUser.userName}
                    </strong>
                    <div className="text-[11px] text-[#0A006E] font-mono">
                      {statementData.targetUser.department} •{' '}
                      {statementData.targetUser.employeeNumberOrCode || 'STAFF'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Session Status &amp; Logins
                    </span>
                    <strong
                      className={
                        statementData.targetUser.isActiveLogin
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                      }
                    >
                      {statementData.targetUser.isActiveLogin ? 'ACTIVE LOGIN' : 'OFFLINE'} (
                      {statementData.targetUser.loginCount || 0} Logins)
                    </strong>
                    <div className="text-[11px] text-slate-600 font-mono">
                      Last Login: {formatTimestampShort(statementData.targetUser.lastLoginAt)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Device Used
                    </span>
                    <strong className="text-slate-900">
                      {statementData.targetUser.deviceUsed}
                    </strong>
                    <div className="text-[11px] text-slate-600 font-mono">
                      Branch: {statementData.targetUser.branchName || activeBranch.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Latest Activity Action
                    </span>
                    <strong className="text-slate-900 block truncate">
                      {statementData.targetUser.lastActionTitle || 'Account Active'}
                    </strong>
                    <div className="text-[11px] text-slate-600 truncate">
                      {statementData.targetUser.lastActionDetails}
                    </div>
                  </div>
                </div>
              )}

              {/* Executive Statement Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                    Total Sales Volume
                  </span>
                  <div className="text-lg font-montserrat font-black text-slate-900 mt-0.5">
                    KES {statementData.totalRevenueKes.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {statementData.scopedOrders.length} Order(s) • Company: KES{' '}
                    {statementData.totalCompanySalesKes.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                    Commissions &amp; Profit
                  </span>
                  <div className="text-lg font-montserrat font-black text-[#0A006E] mt-0.5">
                    KES {statementData.totalCommissionsKes.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Pending: KES {statementData.pendingCommissionsKes.toLocaleString()} | Paid: KES{' '}
                    {statementData.paidCommissionsKes.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                    Stock Valuation
                  </span>
                  <div className="text-lg font-montserrat font-black text-emerald-800 mt-0.5">
                    KES {statementData.totalStockValueKes.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {statementData.totalStockBottles.toLocaleString()} Bottles On Hand
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                    Recorded User Actions
                  </span>
                  <div className="text-lg font-montserrat font-black text-slate-900 mt-0.5">
                    {statementData.scopedActivities.length}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Verified Audit Trail Events
                  </span>
                </div>
              </div>

              {/* Statement Primary Ledger Table */}
              <div className="space-y-2">
                <h3 className="font-montserrat font-black italic text-xs uppercase tracking-wider text-slate-700">
                  Itemized Statement Schedule ({statementData.tableRows.length} Records)
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 text-[11px] font-montserrat font-bold border-b border-slate-200">
                        {statementData.tableHeaders.map((h, i) => (
                          <th key={i} className="py-2.5 px-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {statementData.tableRows.length > 0 ? (
                        statementData.tableRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 text-slate-700 font-medium">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={statementData.tableHeaders.length || 5}
                            className="py-8 text-center text-slate-400 italic"
                          >
                            No ledger entries recorded for the selected filter criteria yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent User Activities Appendix on Every Statement */}
              <div className="space-y-2 pt-2">
                <h3 className="font-montserrat font-black italic text-xs uppercase tracking-wider text-slate-700">
                  Recent User Activity &amp; Login Audit Trail (Last 15 Events)
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-[10px] font-montserrat font-bold uppercase border-b border-slate-200">
                        <th className="py-2 px-3">Timestamp</th>
                        <th className="py-2 px-3">User</th>
                        <th className="py-2 px-3">Action</th>
                        <th className="py-2 px-3">Module</th>
                        <th className="py-2 px-3">Device Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {statementData.scopedActivities.slice(0, 15).map(act => (
                        <tr key={act.id}>
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {formatTimestampShort(act.timestamp)}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {act.userName} ({act.department})
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <strong>{act.actionTitle}</strong> — {act.actionDetails}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{act.module}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{act.deviceUsed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          </div>,
          document.body
        )}
    </div>
  );
};
