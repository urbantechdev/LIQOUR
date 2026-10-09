/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Affiliate,
  Branch,
  CommercialDistributor,
  Consumer,
  ConsumerLoyaltyTier,
  DepartmentType,
  DistributorOrganization,
  Employee,
  Merchant,
  Organization,
  OrganizationMembership,
  OrganizationRole,
  OrganizationType,
  Retailer,
  SaleOrder,
  Supplier,
  SupplierOrganization,
  User,
  UserRole,
  WebsiteDeliveryOrder
} from '../types';
import { DEFAULT_BRANDING_CONFIG } from '../config/erpConfig';

/**
 * Maps an ERP UserRole + DepartmentType into the canonical OrganizationRole
 * in the User -> Membership -> Organization -> Role hierarchy.
 */
export function resolveOrganizationRole(
  userRole: UserRole,
  department?: DepartmentType
): OrganizationRole {
  if (userRole === 'SUPER_ADMIN') {
    return 'ORG_OWNER';
  }
  if (userRole === 'ACCOUNTANT' || department === 'FINANCE' || department === 'BILLING') {
    return 'FINANCE_ACCOUNTANT';
  }
  switch (department) {
    case 'BRANCH_MANAGER':
      return 'BRANCH_MANAGER';
    case 'SALES_MANAGER':
      return 'SALES_MANAGER';
    case 'PROCUREMENT':
      return 'PROCUREMENT_OFFICER';
    case 'INVENTORY':
      return 'INVENTORY_CONTROLLER';
    case 'AFFILIATES':
      return 'AFFILIATE_REP';
    case 'DELIVERY_MANAGER':
      return 'DELIVERY_COURIER';
    case 'POS':
      return 'POS_CASHIER';
    default:
      return 'OPERATIONS_MANAGER';
  }
}

/**
 * Maps an OrganizationRole back to the baseline ERP UserRole + DepartmentType.
 */
export function mapOrganizationRoleToErpRole(orgRole: OrganizationRole): {
  erpRole: UserRole;
  department: DepartmentType;
} {
  switch (orgRole) {
    case 'ORG_OWNER':
    case 'ORG_ADMIN':
      return { erpRole: 'SUPER_ADMIN', department: 'FINANCE' };
    case 'FINANCE_ACCOUNTANT':
      return { erpRole: 'ACCOUNTANT', department: 'FINANCE' };
    case 'BRANCH_MANAGER':
      return { erpRole: 'STAFF', department: 'BRANCH_MANAGER' };
    case 'SALES_MANAGER':
      return { erpRole: 'STAFF', department: 'SALES_MANAGER' };
    case 'PROCUREMENT_OFFICER':
      return { erpRole: 'STAFF', department: 'PROCUREMENT' };
    case 'INVENTORY_CONTROLLER':
      return { erpRole: 'STAFF', department: 'INVENTORY' };
    case 'POS_CASHIER':
      return { erpRole: 'STAFF', department: 'POS' };
    case 'AFFILIATE_REP':
      return { erpRole: 'STAFF', department: 'AFFILIATES' };
    case 'DELIVERY_COURIER':
      return { erpRole: 'STAFF', department: 'DELIVERY_MANAGER' };
    default:
      return { erpRole: 'STAFF', department: 'INVENTORY' };
  }
}

export function computeConsumerLoyaltyTier(lifetimeSpendKes: number): ConsumerLoyaltyTier {
  if (lifetimeSpendKes >= 250000) return 'VIP_PRIVATE_CLIENT';
  if (lifetimeSpendKes >= 75000) return 'GOLD';
  if (lifetimeSpendKes >= 20000) return 'SILVER';
  return 'STANDARD';
}

/**
 * Synchronizes and derives the 4-pillar Organization hierarchy:
 * Organization
 * ├── Merchant
 * ├── Distributor
 * ├── Retailer
 * └── Supplier
 */
export function synchronizeNetworkOrganizations(params: {
  existingOrganizations: Organization[];
  branches: Branch[];
  distributors: CommercialDistributor[];
  suppliers: Supplier[];
}): Organization[] {
  const nowIso = new Date().toISOString();
  const orgMap = new Map<string, Organization>();

  for (const org of params.existingOrganizations) {
    if (org && org.id) {
      orgMap.set(org.id, org);
    }
  }

  // 1. Primary Merchant Organization (Head Office / Main Store / Bonded Warehouse owner)
  const primaryMerchantId = 'org-merchant-vaairo-hq';
  const merchantBranchIds = params.branches
    .filter(b => b.tier === 'WAREHOUSE' || b.tier === 'MAIN_STORE')
    .map(b => b.id);

  if (!orgMap.has(primaryMerchantId)) {
    const hqMerchant: Merchant = {
      id: primaryMerchantId,
      code: 'ORG-MRC-001',
      name: DEFAULT_BRANDING_CONFIG.tradingName,
      legalName: DEFAULT_BRANDING_CONFIG.companyName,
      type: 'MERCHANT',
      status: 'ACTIVE',
      merchantTier: 'PRIMARY_BRAND_OWNER',
      kraPin: DEFAULT_BRANDING_CONFIG.kraPin,
      licenseNumber: 'KRA-EXCISE-2026-HQ',
      contactPerson: 'System Administrator',
      email: DEFAULT_BRANDING_CONFIG.supportEmail,
      phone: DEFAULT_BRANDING_CONFIG.supportPhone,
      physicalAddress: DEFAULT_BRANDING_CONFIG.headquartersAddress,
      county: 'Nairobi',
      region: 'Nairobi Metro',
      linkedBranchIds: merchantBranchIds,
      creditLimitKes: 50000000,
      currentBalanceKes: 0,
      paymentTerms: 'IMMEDIATE',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    orgMap.set(primaryMerchantId, hqMerchant);
  } else {
    const existingMerchant = orgMap.get(primaryMerchantId) as Merchant;
    orgMap.set(primaryMerchantId, {
      ...existingMerchant,
      linkedBranchIds: Array.from(new Set([...(existingMerchant.linkedBranchIds || []), ...merchantBranchIds]))
    });
  }

  // 2. Distributor Organizations (from CommercialDistributor & DISTRIBUTOR tier branches)
  for (const dist of params.distributors) {
    const orgId = `org-dist-${dist.id}`;
    const prev = orgMap.get(orgId) as DistributorOrganization | undefined;
    const distOrg: DistributorOrganization = {
      id: orgId,
      code: dist.code || `ORG-DST-${dist.id.slice(-4).toUpperCase()}`,
      name: dist.companyName,
      legalName: dist.companyName,
      type: 'DISTRIBUTOR',
      status: dist.active ? 'ACTIVE' : 'INACTIVE',
      distributorTier: dist.tier,
      kraPin: dist.kraPin,
      licenseNumber: dist.licenseNumber,
      contactPerson: dist.contactPerson,
      email: dist.email,
      phone: dist.phone,
      physicalAddress: `${dist.region}, ${dist.county}`,
      county: dist.county,
      region: dist.region,
      parentOrganizationId: prev?.parentOrganizationId || primaryMerchantId,
      assignedTerritoryRegions: prev?.assignedTerritoryRegions || [dist.region, dist.county].filter(Boolean),
      linkedBranchIds: prev?.linkedBranchIds || [],
      creditLimitKes: dist.creditLimitKes,
      currentBalanceKes: dist.currentReceivableKes,
      paymentTerms: dist.paymentTerms,
      legacyDistributorId: dist.id,
      active: dist.active,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso
    };
    orgMap.set(orgId, distOrg);
  }

  // 3. Retailer Organizations (from LIQUOR_STORE branches & standalone Retailer records)
  for (const branch of params.branches) {
    if (branch.tier === 'LIQUOR_STORE') {
      const orgId = branch.organizationId || `org-retailer-${branch.id}`;
      const prev = orgMap.get(orgId) as Retailer | undefined;
      const retailerOrg: Retailer = {
        id: orgId,
        code: `ORG-RTL-${branch.code || branch.id.slice(-4).toUpperCase()}`,
        name: branch.name,
        legalName: branch.name,
        type: 'RETAILER',
        status: 'ACTIVE',
        retailerCategory: prev?.retailerCategory || 'LIQUOR_STORE',
        kraPin: branch.kraPin,
        licenseNumber: prev?.countyLiquorLicenseNumber || `LIQ-LIC-${branch.county.toUpperCase().slice(0, 3)}-2026`,
        countyLiquorLicenseNumber:
          prev?.countyLiquorLicenseNumber || `LIQ-LIC-${branch.county.toUpperCase().slice(0, 3)}-2026`,
        contactPerson: branch.managerName,
        email: prev?.email || DEFAULT_BRANDING_CONFIG.supportEmail,
        phone: branch.contactPhone,
        physicalAddress: branch.location,
        county: branch.county,
        region: branch.county,
        parentOrganizationId: prev?.parentOrganizationId || primaryMerchantId,
        parentMerchantId: primaryMerchantId,
        primaryBranchId: branch.id,
        linkedBranchIds: [branch.id],
        posTerminalEnabled: branch.allowDirectSales,
        storefrontDeliveryEnabled: true,
        minRestockOrderKes: branch.minWholesaleThresholdKes || 15000,
        latitude: branch.latitude,
        longitude: branch.longitude,
        maxDeliveryRadiusKm: branch.maxDeliveryRadiusKm,
        deliveryZones: branch.deliveryZones,
        creditLimitKes: prev?.creditLimitKes ?? 250000,
        currentBalanceKes: prev?.currentBalanceKes ?? 0,
        paymentTerms: prev?.paymentTerms || 'CASH_ON_DELIVERY',
        active: true,
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso
      };
      orgMap.set(orgId, retailerOrg);
    } else if (branch.tier === 'DISTRIBUTOR') {
      const orgId = branch.organizationId || `org-dist-branch-${branch.id}`;
      if (!orgMap.has(orgId)) {
        const distBranchOrg: DistributorOrganization = {
          id: orgId,
          code: `ORG-DST-${branch.code || branch.id.slice(-4).toUpperCase()}`,
          name: branch.name,
          legalName: branch.name,
          type: 'DISTRIBUTOR',
          status: 'ACTIVE',
          distributorTier: 'TIER_2_REGIONAL_DEPOT',
          kraPin: branch.kraPin,
          licenseNumber: `KRA-DST-${branch.code}`,
          contactPerson: branch.managerName,
          email: DEFAULT_BRANDING_CONFIG.supportEmail,
          phone: branch.contactPhone,
          physicalAddress: branch.location,
          county: branch.county,
          region: branch.county,
          parentOrganizationId: primaryMerchantId,
          assignedTerritoryRegions: [branch.county],
          linkedBranchIds: [branch.id],
          creditLimitKes: 1500000,
          currentBalanceKes: 0,
          paymentTerms: 'NET_14',
          active: true,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        orgMap.set(orgId, distBranchOrg);
      }
    }
  }

  // 4. Supplier Organizations (from Supplier entities)
  for (const sup of params.suppliers) {
    const orgId = `org-sup-${sup.id}`;
    const prev = orgMap.get(orgId) as SupplierOrganization | undefined;
    const supOrg: SupplierOrganization = {
      id: orgId,
      code: sup.code || `ORG-SUP-${sup.id.slice(-4).toUpperCase()}`,
      name: sup.name,
      legalName: sup.name,
      type: 'SUPPLIER',
      status: sup.active ? 'ACTIVE' : 'INACTIVE',
      supplierCategory: sup.category,
      kraPin: sup.kraPin,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      physicalAddress: sup.physicalAddress,
      county: sup.county,
      region: sup.county,
      bankName: sup.bankName,
      bankAccountNumber: sup.bankAccountNumber,
      creditLimitKes: sup.creditLimitKes,
      currentBalanceKes: sup.currentOutstandingKes,
      paymentTerms: sup.paymentTerms,
      legacySupplierId: sup.id,
      active: sup.active,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso
    };
    orgMap.set(orgId, supOrg);
  }

  return Array.from(orgMap.values());
}

/**
 * Synchronizes the relational link:
 * User -> Membership -> Organization -> Role
 */
export function synchronizeOrganizationMemberships(params: {
  existingMemberships: OrganizationMembership[];
  organizations: Organization[];
  users: User[];
  employees: Employee[];
  affiliates: Affiliate[];
  branches: Branch[];
}): OrganizationMembership[] {
  const nowIso = new Date().toISOString();
  const membershipMap = new Map<string, OrganizationMembership>();

  for (const m of params.existingMemberships) {
    if (m && m.id) {
      membershipMap.set(m.id, m);
    }
  }

  const primaryMerchant =
    params.organizations.find(o => o.type === 'MERCHANT') || params.organizations[0];

  const findOrgForBranch = (branchId?: string): Organization | undefined => {
    if (!branchId) return primaryMerchant;
    const byBranchLink = params.organizations.find(
      o =>
        o.linkedBranchIds?.includes(branchId) ||
        (o.type === 'RETAILER' && o.primaryBranchId === branchId)
    );
    return byBranchLink || primaryMerchant;
  };

  // 1. System Users
  for (const usr of params.users) {
    const targetOrg =
      (usr.primaryOrganizationId &&
        params.organizations.find(o => o.id === usr.primaryOrganizationId)) ||
      findOrgForBranch(usr.branchId);
    if (!targetOrg) continue;

    const memId = `mem_${usr.id}_${targetOrg.id}`;
    const prev = membershipMap.get(memId);
    const role = prev?.role || resolveOrganizationRole(usr.role, usr.department);

    membershipMap.set(memId, {
      id: memId,
      userId: usr.id,
      userName: usr.name,
      userEmail: usr.email,
      organizationId: targetOrg.id,
      organizationName: targetOrg.name,
      organizationType: targetOrg.type,
      role,
      erpRole: usr.role,
      department: usr.department,
      assignedBranchIds: usr.branchId ? [usr.branchId] : targetOrg.linkedBranchIds || [],
      defaultBranchId: usr.branchId || targetOrg.linkedBranchIds?.[0],
      status: prev?.status || 'ACTIVE',
      joinedAt: prev?.joinedAt || nowIso,
      updatedAt: nowIso
    });
  }

  // 2. Staff Employees
  for (const emp of params.employees) {
    const targetOrg = findOrgForBranch(emp.branchId);
    if (!targetOrg) continue;
    const memId = `mem_${emp.id}_${targetOrg.id}`;
    const prev = membershipMap.get(memId);
    const erpRole: UserRole = emp.department === 'FINANCE' ? 'ACCOUNTANT' : 'STAFF';

    membershipMap.set(memId, {
      id: memId,
      userId: emp.id,
      userName: emp.name,
      userEmail: `${emp.employeeNumber.toLowerCase()}@urbantechdev.com`,
      organizationId: targetOrg.id,
      organizationName: targetOrg.name,
      organizationType: targetOrg.type,
      role: prev?.role || resolveOrganizationRole(erpRole, emp.department),
      erpRole,
      department: emp.department,
      assignedBranchIds: emp.branchId ? [emp.branchId] : [],
      defaultBranchId: emp.branchId,
      status: emp.active ? 'ACTIVE' : 'SUSPENDED',
      joinedAt: prev?.joinedAt || nowIso,
      updatedAt: nowIso
    });
  }

  // 3. Affiliate Sales Representatives
  for (const aff of params.affiliates) {
    const targetOrg = findOrgForBranch(aff.branchId);
    if (!targetOrg) continue;
    const memId = `mem_${aff.id}_${targetOrg.id}`;
    const prev = membershipMap.get(memId);

    membershipMap.set(memId, {
      id: memId,
      userId: aff.id,
      userName: aff.name,
      userEmail: `${aff.code.toLowerCase()}@urbantechdev.com`,
      organizationId: targetOrg.id,
      organizationName: targetOrg.name,
      organizationType: targetOrg.type,
      role: 'AFFILIATE_REP',
      erpRole: 'STAFF',
      department: 'AFFILIATES',
      assignedBranchIds: aff.branchId ? [aff.branchId] : [],
      defaultBranchId: aff.branchId,
      status: aff.active ? 'ACTIVE' : 'SUSPENDED',
      joinedAt: prev?.joinedAt || nowIso,
      updatedAt: nowIso
    });
  }

  return Array.from(membershipMap.values());
}

/**
 * Synchronizes first-class Consumer identities from B2C Storefront & Retail POS orders
 * while preserving explicitly registered Consumer profiles.
 */
export function synchronizeConsumers(params: {
  existingConsumers: Consumer[];
  orders: SaleOrder[];
  websiteDeliveryOrders: WebsiteDeliveryOrder[];
}): Consumer[] {
  const nowIso = new Date().toISOString();
  const consumerMap = new Map<string, Consumer>();

  for (const c of params.existingConsumers) {
    if (c && c.id) {
      consumerMap.set(c.id, {
        ...c,
        totalOrdersCount: 0,
        lifetimeSpendKes: 0
      });
    }
  }

  const normalizePhoneKey = (phone?: string, email?: string, name?: string): string | null => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 9) {
      return `con_${cleanPhone.slice(-9)}`;
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail.includes('@')) {
      return `con_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    }
    const cleanName = (name || '').trim().toLowerCase();
    if (cleanName && cleanName !== 'walk-in customer' && cleanName !== 'counter customer') {
      return `con_${cleanName.replace(/[^a-z0-9]/g, '_')}`;
    }
    return null;
  };

  let seq = consumerMap.size + 1;

  // Aggregate from retail SaleOrders
  for (const order of params.orders) {
    if (order.saleType === 'WHOLESALE') continue;
    const key = order.consumerId || normalizePhoneKey(order.customerPhone, order.customerEmail, order.customerName);
    if (!key) continue;

    const existing = consumerMap.get(key);
    const totalAmount = Number(order.totalKes || 0);
    const newSpend = (existing?.lifetimeSpendKes || 0) + totalAmount;
    const newCount = (existing?.totalOrdersCount || 0) + 1;
    const newPoints = Math.floor(newSpend / 100);

    consumerMap.set(key, {
      id: key,
      consumerCode: existing?.consumerCode || `CON-2026-${String(seq++).padStart(4, '0')}`,
      authUid: existing?.authUid,
      fullName: order.customerName || existing?.fullName || 'Verified Consumer',
      phone: order.customerPhone || existing?.phone || '',
      email: order.customerEmail || existing?.email,
      kraPin: order.customerKraPin || existing?.kraPin,
      ageVerified: true,
      defaultDeliveryLocation: order.deliveryAddress || existing?.defaultDeliveryLocation,
      preferredBranchId: order.branchId || existing?.preferredBranchId,
      preferredRetailerId: order.organizationId || existing?.preferredRetailerId,
      loyaltyPoints: newPoints,
      loyaltyTier: computeConsumerLoyaltyTier(newSpend),
      totalOrdersCount: newCount,
      lifetimeSpendKes: newSpend,
      lastOrderAt:
        !existing?.lastOrderAt || order.createdAt > existing.lastOrderAt
          ? order.createdAt
          : existing.lastOrderAt,
      active: existing?.active ?? true,
      createdAt: existing?.createdAt || order.createdAt || nowIso,
      updatedAt: nowIso
    });
  }

  // Aggregate from WebsiteDeliveryOrders not yet completed into SaleOrders
  for (const webOrder of params.websiteDeliveryOrders) {
    if (webOrder.completedSaleOrderId) continue;
    const key =
      webOrder.consumerId ||
      normalizePhoneKey(webOrder.customerPhone, webOrder.customerEmail, webOrder.customerName);
    if (!key) continue;

    const existing = consumerMap.get(key);
    const totalAmount = Number(webOrder.totalCompanyPriceKes || 0);
    const newSpend = (existing?.lifetimeSpendKes || 0) + totalAmount;
    const newCount = (existing?.totalOrdersCount || 0) + 1;
    const newPoints = Math.floor(newSpend / 100);

    consumerMap.set(key, {
      id: key,
      consumerCode: existing?.consumerCode || `CON-2026-${String(seq++).padStart(4, '0')}`,
      authUid: existing?.authUid,
      fullName: webOrder.customerName || existing?.fullName || 'Storefront Consumer',
      phone: webOrder.customerPhone || existing?.phone || '',
      email: webOrder.customerEmail || existing?.email,
      ageVerified: true,
      defaultDeliveryLocation: webOrder.deliveryLocation || existing?.defaultDeliveryLocation,
      defaultDeliveryNotes: webOrder.deliveryNotes || existing?.defaultDeliveryNotes,
      defaultLatitude: webOrder.customerLatitude ?? existing?.defaultLatitude,
      defaultLongitude: webOrder.customerLongitude ?? existing?.defaultLongitude,
      preferredBranchId: webOrder.branchId || existing?.preferredBranchId,
      preferredRetailerId: webOrder.retailerOrganizationId || existing?.preferredRetailerId,
      loyaltyPoints: newPoints,
      loyaltyTier: computeConsumerLoyaltyTier(newSpend),
      totalOrdersCount: newCount,
      lifetimeSpendKes: newSpend,
      lastOrderAt:
        !existing?.lastOrderAt || webOrder.createdAt > existing.lastOrderAt
          ? webOrder.createdAt
          : existing.lastOrderAt,
      active: existing?.active ?? true,
      createdAt: existing?.createdAt || webOrder.createdAt || nowIso,
      updatedAt: nowIso
    });
  }

  return Array.from(consumerMap.values());
}

/**
 * Checks whether a User has an active Membership with one of the allowed OrganizationRoles
 * for a given Organization (or any Organization of a specified OrganizationType).
 */
export function hasUserOrganizationRole(params: {
  userId: string;
  memberships: OrganizationMembership[];
  organizationId?: string;
  organizationType?: OrganizationType;
  allowedRoles?: OrganizationRole[];
}): boolean {
  return params.memberships.some(m => {
    if (m.userId !== params.userId || m.status !== 'ACTIVE') return false;
    if (params.organizationId && m.organizationId !== params.organizationId) return false;
    if (params.organizationType && m.organizationType !== params.organizationType) return false;
    if (m.role === 'ORG_OWNER' || m.role === 'ORG_ADMIN') return true;
    if (params.allowedRoles && params.allowedRoles.length > 0) {
      return params.allowedRoles.includes(m.role);
    }
    return true;
  });
}
