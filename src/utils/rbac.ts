import { UserRole, DepartmentType } from '../types';
import { ActiveNavTab } from '../components/common/Sidebar';

export type GranularPermission =
  | 'sales.view'
  | 'sales.create'
  | 'sales.edit'
  | 'sales.refund'
  | 'inventory.view'
  | 'inventory.receive'
  | 'inventory.adjust'
  | 'inventory.transfer'
  | 'inventory.return'
  | 'invoice.view'
  | 'invoice.create'
  | 'invoice.cancel'
  | 'accounting.view'
  | 'accounting.post'
  | 'accounting.adjust'
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'settings.view'
  | 'settings.edit'
  | 'reports.view'
  | 'tax.configure'
  | 'period.close'
  | 'period.reopen';

export type ExtendedErpRole =
  | UserRole
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'INVENTORY_STAFF'
  | 'PROCUREMENT_STAFF'
  | 'REPORTING_USER'
  | 'BRANCH_MANAGER'
  | 'DELIVERY_MANAGER';

export interface RolePermissions {
  role: UserRole;
  department: DepartmentType;
  allowedTabs: ActiveNavTab[];
  defaultTab: ActiveNavTab;
  description: string;
  canModifyBranchStructure: boolean;
  canOverridePricing: boolean;
  canAccessGeneralLedger: boolean;
  canAccessEtimsLogs: boolean;
  canProcessSales: boolean;
  canAccessHrPayroll: boolean;
  isRestricted: boolean;
  allBranchesAccess: boolean;
  maxDiscountPercent: number;
  permissions: GranularPermission[];
}

const ALL_GRANULAR_PERMISSIONS: GranularPermission[] = [
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.refund',
  'inventory.view',
  'inventory.receive',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.return',
  'invoice.view',
  'invoice.create',
  'invoice.cancel',
  'accounting.view',
  'accounting.post',
  'accounting.adjust',
  'users.view',
  'users.create',
  'users.edit',
  'settings.view',
  'settings.edit',
  'reports.view',
  'tax.configure',
  'period.close',
  'period.reopen'
];

export function getRolePermissions(role: ExtendedErpRole, department: DepartmentType): RolePermissions {
  if (role === 'SUPER_ADMIN') {
    return {
      role: 'SUPER_ADMIN',
      department,
      allowedTabs: [
        'DASHBOARD',
        'ANALYTICS',
        'POS',
        'DELIVERY_DASHBOARD',
        'SALES_MANAGER_DASHBOARD',
        'INVENTORY',
        'BRANCHES',
        'ACCOUNTING',
        'PAYROLL',
        'AFFILIATES',
        'RESTOCK',
        'SETTINGS'
      ],
      defaultTab: 'DASHBOARD',
      description: 'Unrestricted global access. Master root control over asset valuations, branch structures, tax overrides, and audit trails.',
      canModifyBranchStructure: true,
      canOverridePricing: true,
      canAccessGeneralLedger: true,
      canAccessEtimsLogs: true,
      canProcessSales: true,
      canAccessHrPayroll: true,
      isRestricted: false,
      allBranchesAccess: true,
      maxDiscountPercent: 100,
      permissions: ALL_GRANULAR_PERMISSIONS
    };
  }

  if (role === 'ADMIN') {
    return {
      role: 'SUPER_ADMIN',
      department,
      allowedTabs: [
        'DASHBOARD',
        'ANALYTICS',
        'POS',
        'DELIVERY_DASHBOARD',
        'SALES_MANAGER_DASHBOARD',
        'INVENTORY',
        'BRANCHES',
        'ACCOUNTING',
        'PAYROLL',
        'AFFILIATES',
        'RESTOCK',
        'SETTINGS'
      ],
      defaultTab: 'DASHBOARD',
      description: 'Operational administrator with cross-branch oversight, user management, and operational controls.',
      canModifyBranchStructure: true,
      canOverridePricing: true,
      canAccessGeneralLedger: true,
      canAccessEtimsLogs: true,
      canProcessSales: true,
      canAccessHrPayroll: true,
      isRestricted: false,
      allBranchesAccess: true,
      maxDiscountPercent: 30,
      permissions: ALL_GRANULAR_PERMISSIONS.filter(p => p !== 'period.reopen')
    };
  }

  if (role === 'ACCOUNTANT') {
    return {
      role: 'ACCOUNTANT',
      department,
      allowedTabs: ['ACCOUNTING'],
      defaultTab: 'ACCOUNTING',
      description: 'Strictly scoped CPA Financial Ledger access: Automated 16% VAT tax logs, General Ledger, Commercial Invoicing, and M-Pesa reconciliation.',
      canModifyBranchStructure: false,
      canOverridePricing: false,
      canAccessGeneralLedger: true,
      canAccessEtimsLogs: true,
      canProcessSales: false,
      canAccessHrPayroll: false,
      isRestricted: true,
      allBranchesAccess: true,
      maxDiscountPercent: 0,
      permissions: [
        'sales.view',
        'inventory.view',
        'invoice.view',
        'invoice.create',
        'invoice.cancel',
        'accounting.view',
        'accounting.post',
        'accounting.adjust',
        'reports.view',
        'period.close'
      ]
    };
  }

  if (role === 'REPORTING_USER') {
    return {
      role: 'STAFF',
      department,
      allowedTabs: ['ANALYTICS'],
      defaultTab: 'ANALYTICS',
      description: 'Read-only reporting and analytics access strictly limited to the Analytics module for authorized branches.',
      canModifyBranchStructure: false,
      canOverridePricing: false,
      canAccessGeneralLedger: false,
      canAccessEtimsLogs: false,
      canProcessSales: false,
      canAccessHrPayroll: false,
      isRestricted: true,
      allBranchesAccess: false,
      maxDiscountPercent: 0,
      permissions: ['sales.view', 'inventory.view', 'invoice.view', 'reports.view']
    };
  }

  // Normalize explicit role aliases into department switches
  const effectiveDepartment: DepartmentType =
    role === 'MANAGER' || role === 'BRANCH_MANAGER'
      ? 'BRANCH_MANAGER'
      : role === 'CASHIER'
      ? 'POS'
      : role === 'INVENTORY_STAFF'
      ? 'INVENTORY'
      : role === 'PROCUREMENT_STAFF'
      ? 'PROCUREMENT'
      : role === 'DELIVERY_MANAGER'
      ? 'DELIVERY_MANAGER'
      : department;

  // STAFF Role: Strictly Categorical & Branch-Scoped Access
  switch (effectiveDepartment) {
    case 'BRANCH_MANAGER':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['BRANCHES'],
        defaultTab: 'BRANCHES',
        description: 'Branch Manager dashboard only. Creates Counter Cashiers & issues 6-digit login PINs and oversees operations strictly for their assigned branch.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: true,
        canProcessSales: true,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 15,
        permissions: [
          'sales.view',
          'sales.create',
          'sales.edit',
          'sales.refund',
          'inventory.view',
          'inventory.receive',
          'inventory.adjust',
          'inventory.transfer',
          'inventory.return',
          'invoice.view',
          'invoice.create',
          'users.view',
          'users.create',
          'users.edit',
          'reports.view'
        ]
      };

    case 'DELIVERY_MANAGER':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['DELIVERY_DASHBOARD'],
        defaultTab: 'DELIVERY_DASHBOARD',
        description: 'Branch Delivery Manager dashboard only. Coordinates customer deliveries, rider dispatch, and monitors orders strictly for their assigned branch.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: true,
        canProcessSales: false,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 0,
        permissions: ['sales.view', 'inventory.view', 'invoice.view']
      };

    case 'SALES_MANAGER':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['SALES_MANAGER_DASHBOARD'],
        defaultTab: 'SALES_MANAGER_DASHBOARD',
        description: 'Branch Sales Manager dashboard only. Manages branch sales affiliates, monitors branch orders, and tracks affiliated persons performance strictly for their assigned branch.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: true,
        canProcessSales: false,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 10,
        permissions: [
          'sales.view',
          'sales.edit',
          'invoice.view',
          'invoice.create',
          'users.view',
          'users.create',
          'users.edit',
          'reports.view'
        ]
      };

    case 'POS':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['POS'],
        defaultTab: 'POS',
        description: 'Frontline POS checkout terminal. Strictly blocked from ledgers, settings, HR files, and other department interfaces.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: false,
        canProcessSales: true,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 5,
        permissions: ['sales.view', 'sales.create', 'inventory.view', 'invoice.view']
      };

    case 'HR_PAYROLL':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['PAYROLL'],
        defaultTab: 'PAYROLL',
        description: 'Employee attendance, shift schedules, and statutory payroll logs (SHIF 2.75%, NSSF, PAYE). Blocked from POS sales and general accounting.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: false,
        canProcessSales: false,
        canAccessHrPayroll: true,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 0,
        permissions: ['users.view', 'users.create', 'users.edit', 'reports.view']
      };

    case 'INVENTORY':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['INVENTORY'],
        defaultTab: 'INVENTORY',
        description: 'Warehouse scanner & intake terminal. Bonded IPS & local LPS barcode scanner access. Blocked from financial ledgers & POS sales.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: false,
        canProcessSales: false,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 0,
        permissions: ['inventory.view', 'inventory.receive', 'inventory.adjust', 'inventory.transfer', 'inventory.return']
      };

    case 'PROCUREMENT':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['RESTOCK'],
        defaultTab: 'RESTOCK',
        description: 'Inter-branch restock requisition & dispatch verification. Blocked from financial ledgers and POS checkout.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: false,
        canProcessSales: false,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 0,
        permissions: ['inventory.view', 'inventory.receive', 'inventory.transfer']
      };

    case 'AFFILIATES':
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['POS'],
        defaultTab: 'POS',
        description: 'Sales Representative POS checkout terminal. Strictly restricted to POS only with automatic referral markup and commission tracking.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: false,
        canAccessEtimsLogs: false,
        canProcessSales: true,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 0,
        permissions: ['sales.view', 'sales.create', 'inventory.view']
      };

    case 'FINANCE':
    case 'BILLING':
    default:
      return {
        role: 'STAFF',
        department: effectiveDepartment,
        allowedTabs: ['ACCOUNTING'],
        defaultTab: 'ACCOUNTING',
        description: 'Billing and invoice viewer terminal. Blocked from administrative overrides and HR payroll records.',
        canModifyBranchStructure: false,
        canOverridePricing: false,
        canAccessGeneralLedger: true,
        canAccessEtimsLogs: true,
        canProcessSales: false,
        canAccessHrPayroll: false,
        isRestricted: true,
        allBranchesAccess: false,
        maxDiscountPercent: 5,
        permissions: ['invoice.view', 'invoice.create', 'accounting.view', 'reports.view']
      };
  }
}

export function isTabAllowed(role: ExtendedErpRole, department: DepartmentType, tab: ActiveNavTab): boolean {
  const permissions = getRolePermissions(role, department);
  return permissions.allowedTabs.includes(tab);
}

export function hasGranularPermission(
  role: ExtendedErpRole,
  department: DepartmentType,
  permission: GranularPermission
): boolean {
  const perms = getRolePermissions(role, department);
  return perms.permissions.includes(permission);
}

/**
 * Branch-level access isolation:
 * Administrators and Accountants can access all branches.
 * Branch-scoped staff can only access their assigned branchId.
 */
export function canAccessBranch(
  role: ExtendedErpRole,
  department: DepartmentType,
  userAssignedBranchId: string | undefined,
  targetBranchId: string | undefined
): boolean {
  const perms = getRolePermissions(role, department);
  if (perms.allBranchesAccess) return true;
  if (!targetBranchId || !userAssignedBranchId) return false;
  return userAssignedBranchId === targetBranchId;
}

/**
 * Maps an inventory transaction / operation type to the mandatory granular permission:
 * - RESTOCK / PURCHASE / OPENING_BALANCE -> inventory.receive
 * - ADJUSTMENT / DAMAGE / LOSS / STOCK_COUNT -> inventory.adjust
 * - DISPATCH / TRANSFER_OUT / TRANSFER_IN -> inventory.transfer
 * - RETURN -> inventory.return
 * - SALE -> sales.create
 */
export function getRequiredInventoryPermission(operationType: string): GranularPermission {
  const op = String(operationType || '').trim().toUpperCase();
  switch (op) {
    case 'RESTOCK':
    case 'PURCHASE':
    case 'OPENING_BALANCE':
      return 'inventory.receive';
    case 'DISPATCH':
    case 'TRANSFER':
    case 'TRANSFER_OUT':
    case 'TRANSFER_IN':
      return 'inventory.transfer';
    case 'RETURN':
      return 'inventory.return';
    case 'SALE':
      return 'sales.create';
    case 'ADJUSTMENT':
    case 'DAMAGE':
    case 'LOSS':
    case 'STOCK_COUNT':
    default:
      return 'inventory.adjust';
  }
}


