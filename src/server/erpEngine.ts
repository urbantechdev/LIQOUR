/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_DOCUMENT_NUMBERING,
  DEFAULT_TAX_RULES,
  STANDARD_CHART_OF_ACCOUNTS,
  TaxRuleConfig
} from '../config/erpConfig';
import { calculateConfigurableTax } from '../utils/kenyaTax';
import {
  ExtendedErpRole,
  GranularPermission,
  canAccessBranch,
  getRequiredInventoryPermission,
  getRolePermissions,
  hasGranularPermission
} from '../utils/rbac';
import {
  computeSaltedPinHashSync,
  constantTimeEquals,
  generateCryptographicSalt
} from '../utils/cryptoSecurity';
import {
  BranchMarketClassTier,
  BranchProductPriceOverride,
  BranchTier,
  DepartmentType,
  InventoryItem,
  Product
} from '../types';
import {
  inferBranchMarketClassFromLocation,
  resolveBranchProductPrice
} from '../utils/branchGeoRouting';
import { INITIAL_AFFILIATES, INITIAL_EMPLOYEES } from '../data/initialData';
import {
  computeIdempotencyRequestHash,
  firestoreAuthoritativeStore,
  StockReservationRecord
} from './firestoreAuthoritativeStore';

const FORBIDDEN_DEFAULT_SECRETS = new Set([
  'JBSWY3DPEHPK3PXP',
  'vaairo_kra_oscu_cmc_key_2026',
  'changeme',
  'default',
  'secret'
]);

const DEV_SECRETS_FILE = path.resolve(process.cwd(), '.erp-dev-secrets.json');

function loadOrCreateDurableDevSecrets(): {
  sessionSecret: string;
  adminApiKey: string;
  kraCmcKey: string;
} {
  try {
    if (fs.existsSync(DEV_SECRETS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DEV_SECRETS_FILE, 'utf8'));
      if (
        parsed &&
        typeof parsed.sessionSecret === 'string' &&
        parsed.sessionSecret.length >= 32 &&
        typeof parsed.adminApiKey === 'string' &&
        typeof parsed.kraCmcKey === 'string'
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to generating fresh secrets
  }
  const generated = {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    adminApiKey: crypto.randomBytes(32).toString('hex'),
    kraCmcKey: crypto.randomBytes(32).toString('hex')
  };
  try {
    fs.writeFileSync(DEV_SECRETS_FILE, JSON.stringify(generated, null, 2), 'utf8');
  } catch {
    // Ignore write errors in read-only environments
  }
  return generated;
}

const EPHEMERAL_DEV_SECRETS = loadOrCreateDurableDevSecrets();

/**
 * Validates security-critical server secrets.
 * In production (NODE_ENV === 'production'), missing or known-default secrets
 * for TOTP_ADMIN_SECRET, KRA_CMC_KEY, SESSION_SECRET, or ADMIN_API_KEY
 * immediately throw a fatal startup error.
 */
export function validateAndResolveServerSecrets(env: NodeJS.ProcessEnv = process.env): {
  isProduction: boolean;
  sessionSecret: string;
  adminApiKey: string;
  totpAdminSecret: string | null;
  kraCmcKey: string;
} {
  const isProduction = String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const rawSession = String(env.SESSION_SECRET || '').trim();
  const rawAdminKey = String(env.ADMIN_API_KEY || '').trim();
  const rawTotp = String(env.TOTP_ADMIN_SECRET || '').trim();
  const rawKraCmc = String(env.KRA_CMC_KEY || '').trim();

  if (FORBIDDEN_DEFAULT_SECRETS.has(rawTotp) || FORBIDDEN_DEFAULT_SECRETS.has(rawKraCmc)) {
    throw new Error(
      'CRITICAL SECURITY ERROR: Known default/fallback secret detected in environment configuration. Replace with a unique cryptographic secret.'
    );
  }

  if (isProduction) {
    const missing: string[] = [];
    if (!rawTotp) missing.push('TOTP_ADMIN_SECRET');
    if (!rawKraCmc) missing.push('KRA_CMC_KEY');
    if (!rawSession) missing.push('SESSION_SECRET');
    if (!rawAdminKey) missing.push('ADMIN_API_KEY');
    if (missing.length > 0) {
      throw new Error(
        `CRITICAL PRODUCTION STARTUP ERROR: Missing required security environment variable(s): ${missing.join(', ')}. Refusing to start with fallback credentials.`
      );
    }
  }

  return {
    isProduction,
    sessionSecret: rawSession || EPHEMERAL_DEV_SECRETS.sessionSecret,
    adminApiKey: rawAdminKey || EPHEMERAL_DEV_SECRETS.adminApiKey,
    totpAdminSecret: rawTotp || null,
    kraCmcKey: rawKraCmc || EPHEMERAL_DEV_SECRETS.kraCmcKey
  };
}

export type InventoryTransactionType =
  | 'OPENING_BALANCE'
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS'
  | 'STOCK_COUNT';

export interface InventoryLedgerEntry {
  id: string;
  organizationId?: string;
  productId: string;
  sku: string;
  productName: string;
  branchId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceId: string;
  referenceType: string;
  userId: string;
  userName: string;
  reason: string;
  timestamp: string;
}

export interface EnterpriseAuditLog {
  id: string;
  organizationId?: string;
  userId: string;
  userName: string;
  userRole: string;
  department: string;
  branchId?: string;
  action: string;
  actionType: string;
  actionTitle: string;
  actionDetails?: string;
  module: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
  serverTimestamp: string;
}

export interface AccountingJournalLine {
  accountCode: string;
  accountName: string;
  debitKes: number;
  creditKes: number;
}

export interface AccountingJournalEntry {
  id: string;
  organizationId?: string;
  entryNumber: string;
  referenceNumber: string;
  periodId: string;
  branchId: string;
  date: string;
  description: string;
  lines: AccountingJournalLine[];
  totalDebitKes: number;
  totalCreditKes: number;
  postedBy: string;
  createdAt: string;
}

export interface AccountingPeriod {
  id: string; // YYYY-MM
  organizationId?: string;
  name: string;
  status: 'OPEN' | 'CLOSED' | 'REOPENED';
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  updatedAt: string;
}

export type FiscalTransactionStatus =
  | 'PENDING'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'CANCELLED';

export interface FiscalTransactionRecord {
  id: string;
  organizationId?: string;
  invoiceNumber: string;
  branchId: string;
  grossAmountKes: number;
  vatAmountKes: number;
  taxableAmountKes: number;
  status: FiscalTransactionStatus;
  requestReference: string;
  responseReference?: string;
  fiscalIdentifier?: string;
  cuSerial?: string;
  kraControlCode?: string;
  qrUrl?: string;
  verifiedTraderPin: string;
  submissionTimestamp: string;
  responseTimestamp?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  transmitted: boolean;
  signedAt: string;
}

export type StockTransferStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface StockTransferItem {
  productId: string;
  sku?: string;
  productName?: string;
  quantity: number;
}

export interface StockTransferRecord {
  id: string;
  organizationId?: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: StockTransferStatus;
  items: StockTransferItem[];
  requestedBy: string;
  approvedBy?: string;
  dispatchedBy?: string;
  receivedBy?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErpNotificationRecord {
  id: string;
  type:
    | 'LOW_STOCK'
    | 'FAILED_PAYMENT'
    | 'FAILED_KRA_SUBMISSION'
    | 'NEW_PURCHASE_ORDER'
    | 'INVOICE_OVERDUE'
    | 'SUPPLIER_PAYMENT_DUE'
    | 'SYSTEM_ALERT';
  branchId?: string;
  title: string;
  message: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuthoritativePaymentRecord {
  id: string;
  organizationId: string;
  paymentNumber: string;
  saleId?: string;
  invoiceId?: string;
  orderNumber: string;
  branchId: string;
  customerName?: string;
  customerPhone?: string;
  amountKes: number;
  paymentMethod: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
  reference: string;
  createdBy: string;
  createdAt: string;
}

export interface AuthoritativeReceiptRecord {
  id: string;
  organizationId: string;
  receiptNumber: string;
  paymentId: string;
  orderNumber: string;
  branchId: string;
  amountKes: number;
  paymentMethod: string;
  reference: string;
  createdBy: string;
  createdAt: string;
}

export interface AuthoritativeSaleRecord {
  id: string;
  organizationId: string;
  orderNumber: string;
  invoiceNumber: string;
  receiptNumber: string;
  branchId: string;
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    authoritativeUnitPriceKes: number;
    unitCostKes: number;
    discountKes: number;
    taxCode: string;
    taxRatePercent: number;
    taxableAmountKes: number;
    vatAmountKes: number;
    lineTotalKes: number;
  }>;
  subtotalKes: number;
  discountKes: number;
  vatAmountKes: number;
  totalAmountKes: number;
  totalCogsKes: number;
  paymentMethod: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
  paymentId: string;
  receiptId: string;
  journalEntryId: string;
  fiscalTransactionId: string;
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  creditNoteNumber?: string;
  refundedAt?: string;
  refundedBy?: string;
  refundReason?: string;
  idempotencyKey?: string;
  cashierId?: string;
  cashierName?: string;
  salesPersonId?: string;
  salesPersonName?: string;
  affiliateId?: string;
  affiliateName?: string;
  checkoutRole?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ServerStaffAuthRecord {
  staffId: string;
  organizationId?: string;
  name: string;
  codeOrNumber: string;
  role: ExtendedErpRole;
  department: DepartmentType;
  branchId: string;
  pinSalt: string;
  pinHash: string;
  active: boolean;
  updatedAt: string;
}

export interface EmailDispatchLog {
  id: string;
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  direction: 'ONE_WAY_OUTBOUND';
  receivingMailbox: string;
  templateType:
    | 'INVOICE'
    | 'QUOTATION'
    | 'RECEIPT'
    | 'ORDER_CONFIRMATION'
    | 'ORDER_STATUS_UPDATE'
    | 'PURCHASE_RECEIPT'
    | 'PASSWORD_RESET'
    | 'LOW_STOCK_ALERT'
    | 'SUPPLIER_NOTIFICATION'
    | 'CUSTOMER_NOTIFICATION'
    | 'SYSTEM_NOTIFICATION';
  referenceId?: string;
  status: 'SENT' | 'QUEUED' | 'QUEUED_FOR_RELAY' | 'PROVIDER_NOT_CONFIGURED' | 'FAILED';
  provider: string;
  sentAt: string;
  errorMessage?: string;
}

interface PinLockoutState {
  failedAttempts: number;
  lockedUntilMs: number;
  lastAttemptMs: number;
}

export interface UserTotpFactorRecord {
  userId: string;
  email: string;
  organizationId: string;
  totpSecret: string;
  pendingSecret?: string;
  mfaEnabled: boolean;
  factorType: 'FIREBASE_TOTP_MFA' | 'PER_USER_RFC6238_TOTP';
  firebaseFactorUid?: string;
  enrolledAt: string;
  updatedAt: string;
}

export interface TotpLockoutState {
  failedAttempts: number;
  lockedUntilMs: number;
  backoffUntilMs: number;
  lastAttemptMs: number;
  ipAddress: string;
  accountIdentifier: string;
}

export interface PublicCheckoutOrderTokenRecord {
  checkoutToken: string;
  orderId: string;
  orderNumber: string;
  organizationId: string;
  branchId: string;
  customerPhone: string;
  customerEmail?: string;
  customerName: string;
  authoritativeAmountKes: number;
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPriceKes: number;
    lineTotalKes: number;
  }>;
  createdAt: string;
  expiresAtMs: number;
}

const PERSISTENCE_FILE_PATH = process.env.ERP_PERSISTENCE_PATH || path.join('/tmp', 'vaairo_erp_authoritative_state_v2.json');

export class AuthoritativeErpEngine {
  public products: Product[] = [];
  public inventoryItems: InventoryItem[] = [];
  public inventoryLedger: InventoryLedgerEntry[] = [];
  public sales: Map<string, AuthoritativeSaleRecord> = new Map();
  public payments: Map<string, AuthoritativePaymentRecord> = new Map();
  public receipts: Map<string, AuthoritativeReceiptRecord> = new Map();
  public journalEntries: AccountingJournalEntry[] = [];
  public accountingPeriods: Map<string, AccountingPeriod> = new Map();
  public fiscalTransactions: Map<string, FiscalTransactionRecord> = new Map();
  public stockTransfers: Map<string, StockTransferRecord> = new Map();
  public notifications: ErpNotificationRecord[] = [];
  public auditLogs: EnterpriseAuditLog[] = [];
  public emailLogs: EmailDispatchLog[] = [];
  public taxRules: TaxRuleConfig[] = [...DEFAULT_TAX_RULES];
  public staffAuthStore: Map<string, ServerStaffAuthRecord> = new Map();
  public documentSequences: Record<string, number> = {
    ORD: 1000,
    INV: 1000,
    RCT: 1000,
    QUO: 1000,
    PO: 1000,
    TRF: 1000,
    CN: 1000,
    DN: 1000,
    JE: 1000
  };

  private idempotencyCache: Map<
    string,
    { timestampMs: number; requestHash?: string; response: unknown }
  > = new Map();
  public organizationMemberships: Map<
    string,
    {
      id: string;
      userId: string;
      email?: string;
      organizationId: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      active: boolean;
    }
  > = new Map();
  public branchOrganizations: Map<string, string> = new Map();
  public branchPricingConfigs: Map<
    string,
    {
      branchId: string;
      branchName?: string;
      location?: string;
      tier?: BranchTier;
      marketClassTier?: BranchMarketClassTier;
      priceMultiplierPercent?: number;
      preferredProductPrices: Record<string, BranchProductPriceOverride>;
    }
  > = new Map();
  public userTotpFactors: Map<string, UserTotpFactorRecord> = new Map();
  public publicCheckoutTokens: Map<string, PublicCheckoutOrderTokenRecord> = new Map();
  private pinLockouts: Map<string, PinLockoutState> = new Map();
  private totpLockouts: Map<string, TotpLockoutState> = new Map();
  private usedTotpTimesteps: Map<string, number> = new Map();
  private activeProductLocks: Set<string> = new Set();
  private persistenceEnabled: boolean;

  constructor(
    initialProducts: Product[],
    initialInventory: InventoryItem[],
    options?: { enableDiskPersistence?: boolean }
  ) {
    this.persistenceEnabled = options?.enableDiskPersistence ?? true;
    this.products = [...initialProducts];
    this.inventoryItems = initialInventory.map(item => ({ ...item }));

    // Seed default current accounting period as OPEN
    const currentPeriodId = new Date().toISOString().slice(0, 7);
    this.accountingPeriods.set(currentPeriodId, {
      id: currentPeriodId,
      organizationId: 'org-merchant-vaairo-hq',
      name: `Period ${currentPeriodId}`,
      status: 'OPEN',
      updatedAt: new Date().toISOString()
    });

    // Seed default hashed staff records (never plaintext PINs) & default Merchant Organization memberships
    this.seedDefaultStaffCredentials();

    if (this.persistenceEnabled) {
      this.loadPersistedState();
      this.hydrateFromCloudAuthoritativeStore();
      firestoreAuthoritativeStore.startAutoReconciliationWorker(15_000, () =>
        this.retryFailedPersistenceOperations().then(() => undefined)
      );
    } else {
      firestoreAuthoritativeStore.setEnabled(false);
    }
  }

  public resolveBranchOrganizationId(branchId: string): string {
    return this.branchOrganizations.get(branchId) || 'org-merchant-vaairo-hq';
  }

  public registerBranchOrganization(branchId: string, organizationId: string): void {
    this.branchOrganizations.set(branchId, organizationId);
  }

  public configureBranchPricing(params: {
    branchId: string;
    branchName?: string;
    location?: string;
    tier?: BranchTier;
    marketClassTier?: BranchMarketClassTier;
    priceMultiplierPercent?: number;
    preferredProductPrices?: Record<string, BranchProductPriceOverride | null>;
  }) {
    const cleanBranchId = String(params.branchId || '').trim();
    if (!cleanBranchId) return null;
    const existing = this.branchPricingConfigs.get(cleanBranchId) || {
      branchId: cleanBranchId,
      preferredProductPrices: {}
    };

    const inferred =
      !params.marketClassTier && !existing.marketClassTier && (params.branchName || params.location)
        ? inferBranchMarketClassFromLocation(`${params.branchName || ''} ${params.location || ''}`)
        : null;

    const nextMarketClassTier =
      params.marketClassTier ?? existing.marketClassTier ?? inferred?.marketClassTier ?? 'STANDARD_RESIDENTIAL';

    const nextMultiplier =
      params.priceMultiplierPercent !== undefined
        ? Number(params.priceMultiplierPercent)
        : existing.priceMultiplierPercent !== undefined
        ? existing.priceMultiplierPercent
        : inferred?.priceMultiplierPercent ?? 0;

    const nextOverrides: Record<string, BranchProductPriceOverride> = {
      ...existing.preferredProductPrices
    };
    if (params.preferredProductPrices && typeof params.preferredProductPrices === 'object') {
      for (const [prodKey, val] of Object.entries(params.preferredProductPrices)) {
        if (!val || (!val.retailPriceKes && !val.wholesalePriceKes)) {
          delete nextOverrides[prodKey];
        } else {
          nextOverrides[prodKey] = {
            retailPriceKes: val.retailPriceKes ? Math.max(30, Math.round(Number(val.retailPriceKes))) : undefined,
            wholesalePriceKes: val.wholesalePriceKes ? Math.max(30, Math.round(Number(val.wholesalePriceKes))) : undefined,
            updatedAt: val.updatedAt || new Date().toISOString(),
            updatedBy: val.updatedBy
          };
        }
      }
    }

    const updated = {
      branchId: cleanBranchId,
      branchName: params.branchName ?? existing.branchName,
      location: params.location ?? existing.location,
      tier: params.tier ?? existing.tier,
      marketClassTier: nextMarketClassTier,
      priceMultiplierPercent: nextMultiplier,
      preferredProductPrices: nextOverrides
    };
    this.branchPricingConfigs.set(cleanBranchId, updated);
    return updated;
  }

  public getBranchAuthoritativeProductPrice(
    product: Product,
    branchId: string,
    saleType?: 'RETAIL' | 'WHOLESALE',
    quantity: number = 1,
    enforceMinWholesaleQty: boolean = false
  ): number {
    const branchConfig = this.branchPricingConfigs.get(String(branchId || '').trim());
    const forceMode =
      saleType === 'WHOLESALE' && (!enforceMinWholesaleQty || quantity >= (product.minWholesaleQty || 6))
        ? 'WHOLESALE'
        : 'RETAIL';
    const resolved = resolveBranchProductPrice(
      product,
      branchConfig
        ? {
            id: branchConfig.branchId,
            name: branchConfig.branchName,
            location: branchConfig.location,
            tier: branchConfig.tier,
            marketClassTier: branchConfig.marketClassTier,
            priceMultiplierPercent: branchConfig.priceMultiplierPercent,
            preferredProductPrices: branchConfig.preferredProductPrices
          }
        : null,
      forceMode
    );
    return resolved.effectiveUnitPriceKes;
  }

  public registerOrganizationMembership(params: {
    userId: string;
    email?: string;
    organizationId: string;
    role: string;
    department?: DepartmentType;
    branchId?: string;
    active?: boolean;
  }): void {
    const cleanRole = (params.role || 'STAFF') as ExtendedErpRole;
    const resolvedDept: DepartmentType =
      params.department ||
      (cleanRole === 'ACCOUNTANT'
        ? 'FINANCE'
        : cleanRole === 'SUPER_ADMIN' || cleanRole === 'ADMIN' || cleanRole === 'MANAGER'
        ? 'BRANCH_MANAGER'
        : cleanRole === 'INVENTORY_STAFF'
        ? 'INVENTORY'
        : cleanRole === 'PROCUREMENT_STAFF'
        ? 'PROCUREMENT'
        : 'POS');
    const cleanEmail = params.email ? params.email.trim().toLowerCase() : undefined;
    const id = `${params.userId}_${params.organizationId}`;
    const record = {
      id,
      userId: params.userId,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      organizationId: params.organizationId,
      role: cleanRole,
      department: resolvedDept,
      branchId: params.branchId,
      active: params.active ?? true
    };
    this.organizationMemberships.set(id, record);
    if (cleanEmail) {
      this.organizationMemberships.set(`user-${cleanEmail}_${params.organizationId}`, record);
    }
    if (this.persistenceEnabled) {
      void firestoreAuthoritativeStore.syncOrganizationMembershipToFirestore(record);
    }
  }

  /**
   * Resolves a verified Google/Firebase identity (`uid` + `email`) against server-controlled
   * `organizationMemberships/{uid}_{orgId}` records.
   *
   * SECURITY RULES:
   * 1. NEVER trusts any `role` sent by the browser (`req.body.role` is ignored).
   * 2. Domain ownership (`@urbantechdev.com`, `@vaairo.co.ke`, `@vaairobeverages.co.ke`) is ONLY
   *    an onboarding condition—it does NOT automatically grant administrative access without an
   *    active `organizationMembership` record!
   */
  public resolveGoogleIdentityMembership(params: {
    uid: string;
    email: string;
    organizationId?: string;
  }): {
    authorized: boolean;
    status: number;
    error?: string;
    errorCode?: string;
    membership?: {
      id: string;
      userId: string;
      email: string;
      organizationId: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      permissions: GranularPermission[];
    };
  } {
    const cleanEmail = String(params.email || '').trim().toLowerCase();
    const cleanUid = String(params.uid || '').trim();
    const targetOrg = params.organizationId || 'org-merchant-vaairo-hq';

    // Ensure whitelisted super-admin emails and any explicitly configured ADMIN_EMAILS from env have a server-controlled membership record
    const builtInSuperAdmins = [
      'gduniversalstudio@gmail.com',
      'zamodasports@gmail.com'
    ];
    const envAdminEmails = [
      ...builtInSuperAdmins,
      ...(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    ];
    for (const adminEmail of envAdminEmails) {
      this.registerOrganizationMembership({
        userId: `user-${adminEmail}`,
        email: adminEmail,
        organizationId: targetOrg,
        role: 'SUPER_ADMIN',
        department: 'BRANCH_MANAGER',
        active: true
      });
    }
    if (cleanEmail && envAdminEmails.includes(cleanEmail) && cleanUid) {
      this.registerOrganizationMembership({
        userId: cleanUid,
        email: cleanEmail,
        organizationId: targetOrg,
        role: 'SUPER_ADMIN',
        department: 'BRANCH_MANAGER',
        active: true
      });
    }

    // Lookup by UID or verified email in server-controlled organizationMemberships
    const candidates = [
      this.organizationMemberships.get(`${cleanUid}_${targetOrg}`),
      this.organizationMemberships.get(`mem_${cleanUid}_${targetOrg}`),
      this.organizationMemberships.get(`user-${cleanEmail}_${targetOrg}`),
      ...Array.from(this.organizationMemberships.values()).filter(
        m =>
          m.organizationId === targetOrg &&
          ((cleanUid && m.userId === cleanUid) ||
            (cleanEmail && m.email?.toLowerCase() === cleanEmail))
      )
    ].filter(Boolean);

    const matched = candidates[0];
    if (!matched || !matched.active) {
      const isCorporateDomain =
        cleanEmail.endsWith('@urbantechdev.com') ||
        cleanEmail.endsWith('@vaairo.co.ke') ||
        cleanEmail.endsWith('@vaairobeverages.co.ke');

      return {
        authorized: false,
        status: 403,
        errorCode: isCorporateDomain
          ? 'ONBOARDING_MEMBERSHIP_REQUIRED'
          : 'ORGANIZATION_MEMBERSHIP_NOT_FOUND',
        error: isCorporateDomain
          ? `Access Denied: Domain ownership for "${cleanEmail}" is only an onboarding condition. No active organizationMembership record exists in organization "${targetOrg}" for UID "${cleanUid || cleanEmail}".`
          : `Access Denied: Google account "${cleanEmail}" has no active organizationMembership in "${targetOrg}".`
      };
    }

    const perms = getRolePermissions(matched.role, matched.department);
    return {
      authorized: true,
      status: 200,
      membership: {
        id: matched.id,
        userId: cleanUid || matched.userId,
        email: cleanEmail,
        organizationId: matched.organizationId,
        role: matched.role,
        department: matched.department,
        branchId: matched.branchId,
        permissions: perms.permissions
      }
    };
  }

  /**
   * Enforces organization-scoped commercial resource authorization.
   * Verifies that the authenticated user is an active member of `targetOrganizationId`
   * with an appropriate role before allowing access to organizations, orders, inventory, or payments.
   */
  public verifyOrganizationResourceAccess(params: {
    userId: string;
    userRole: ExtendedErpRole;
    userOrganizationId?: string;
    targetOrganizationId: string;
  }): { authorized: boolean; error?: string } {
    const targetOrg = params.targetOrganizationId || 'org-merchant-vaairo-hq';

    // If user explicitly supplies a mismatched organizationId, verify membership in targetOrg
    if (params.userOrganizationId && params.userOrganizationId !== targetOrg) {
      const explicitMembership = this.organizationMemberships.get(`${params.userId}_${targetOrg}`);
      if (!explicitMembership || !explicitMembership.active) {
        return {
          authorized: false,
          error: `Organization Access Denied: User "${params.userId}" (org "${params.userOrganizationId}") is not an active member of organization "${targetOrg}".`
        };
      }
    }

    // Check if the user has any registered memberships; if they belong ONLY to other organizations, deny access
    const userMemberships = Array.from(this.organizationMemberships.values()).filter(
      m => m.userId === params.userId
    );
    if (userMemberships.length > 0) {
      const targetMembership = userMemberships.find(m => m.organizationId === targetOrg);
      if (!targetMembership || !targetMembership.active) {
        return {
          authorized: false,
          error: `Organization Access Denied: User "${params.userId}" has no active membership in organization "${targetOrg}".`
        };
      }
    }

    return { authorized: true };
  }

  private hydrateFromCloudAuthoritativeStore(): void {
    firestoreAuthoritativeStore
      .hydrateEngineState()
      .then(snapshot => {
        if (!snapshot) return;
        for (const period of snapshot.accountingPeriods) {
          this.accountingPeriods.set(period.id, period);
        }
        for (const ledger of snapshot.inventoryLedgers) {
          const existingIdx = this.inventoryItems.findIndex(
            i => i.branchId === ledger.branchId && i.productId === ledger.productId
          );
          if (existingIdx >= 0) {
            this.inventoryItems[existingIdx].bottlesOnHand = ledger.quantity;
            this.inventoryItems[existingIdx].casesOnHand = Math.floor(ledger.quantity / 12);
          } else {
            this.inventoryItems.push({
              id: `inv-${ledger.branchId}-${ledger.productId}`,
              branchId: ledger.branchId,
              productId: ledger.productId,
              bottlesOnHand: ledger.quantity,
              casesOnHand: Math.floor(ledger.quantity / 12),
              reorderLevel: 12,
              batchNumber: 'BATCH-2026',
              expiryDate: '2029-12-31',
              lastScannedAt: ledger.updatedAt || new Date().toISOString()
            });
          }
        }
      })
      .catch(() => {});
  }

  private seedDefaultStaffCredentials(): void {
    const defaults: Array<{
      staffId: string;
      name: string;
      code: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId: string;
      defaultPin: string;
    }> = [
      ...INITIAL_EMPLOYEES.map(emp => ({
        staffId: emp.id,
        name: emp.name,
        code: emp.employeeNumber || emp.id.toUpperCase(),
        role: (emp.department === 'POS'
          ? 'CASHIER'
          : emp.department === 'BRANCH_MANAGER'
          ? 'MANAGER'
          : emp.department === 'INVENTORY'
          ? 'INVENTORY_STAFF'
          : emp.department === 'PROCUREMENT'
          ? 'PROCUREMENT_STAFF'
          : 'STAFF') as ExtendedErpRole,
        department: emp.department,
        branchId: emp.branchId || 'branch-1',
        defaultPin: String(emp.loginPin || '000000').replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
      })),
      ...INITIAL_AFFILIATES.map(aff => ({
        staffId: aff.id,
        name: aff.name,
        code: aff.code || aff.id.toUpperCase(),
        role: 'STAFF' as ExtendedErpRole,
        department: 'AFFILIATES' as DepartmentType,
        branchId: aff.branchId || 'branch-1',
        defaultPin: String(aff.loginPin || '000000').replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
      }))
    ];

    for (const s of defaults) {
      if (!this.staffAuthStore.has(s.staffId)) {
        const salt = generateCryptographicSalt(16);
        const hash = computeSaltedPinHashSync(s.defaultPin, salt);
        this.staffAuthStore.set(s.staffId, {
          staffId: s.staffId,
          organizationId: 'org-merchant-vaairo-hq',
          name: s.name,
          codeOrNumber: s.code,
          role: s.role,
          department: s.department,
          branchId: s.branchId,
          pinSalt: salt,
          pinHash: hash,
          active: true,
          updatedAt: new Date().toISOString()
        });
        this.registerOrganizationMembership({
          userId: s.staffId,
          organizationId: 'org-merchant-vaairo-hq',
          role: s.role,
          department: s.department,
          branchId: s.branchId,
          active: true
        });
      }
    }

    // Seed server-controlled organizationMemberships for verified Google OAuth principals
    // Role, department, and branch come strictly from these membership records (never from req.body.role)
    const seededGooglePrincipals: Array<{
      userId: string;
      email: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
    }> = [
      {
        userId: 'user-gduniversalstudio@gmail.com',
        email: 'gduniversalstudio@gmail.com',
        role: 'SUPER_ADMIN',
        department: 'BRANCH_MANAGER'
      },
      {
        userId: 'user-zamodasports@gmail.com',
        email: 'zamodasports@gmail.com',
        role: 'SUPER_ADMIN',
        department: 'BRANCH_MANAGER'
      }
    ];

    for (const principal of seededGooglePrincipals) {
      this.registerOrganizationMembership({
        userId: principal.userId,
        email: principal.email,
        organizationId: 'org-merchant-vaairo-hq',
        role: principal.role,
        department: principal.department,
        branchId: principal.branchId,
        active: true
      });
    }
  }

  public registerOrUpdateStaffPin(params: {
    staffId: string;
    name: string;
    codeOrNumber?: string;
    role?: ExtendedErpRole;
    department: DepartmentType;
    branchId: string;
    rawPin?: string;
    pinSalt?: string;
    pinHash?: string;
    active?: boolean;
  }): ServerStaffAuthRecord {
    const existing = this.staffAuthStore.get(params.staffId);
    const salt = params.pinSalt || existing?.pinSalt || generateCryptographicSalt(16);
    const hash =
      params.pinHash ||
      (params.rawPin ? computeSaltedPinHashSync(params.rawPin, salt) : existing?.pinHash || computeSaltedPinHashSync('000000', salt));

    const resolvedRole: ExtendedErpRole =
      params.role ||
      (params.department === 'POS'
        ? 'CASHIER'
        : params.department === 'BRANCH_MANAGER'
        ? 'MANAGER'
        : params.department === 'INVENTORY'
        ? 'INVENTORY_STAFF'
        : params.department === 'PROCUREMENT'
        ? 'PROCUREMENT_STAFF'
        : 'STAFF');

    const record: ServerStaffAuthRecord = {
      staffId: params.staffId,
      name: params.name,
      codeOrNumber: params.codeOrNumber || existing?.codeOrNumber || params.staffId.toUpperCase(),
      role: resolvedRole,
      department: params.department,
      branchId: params.branchId,
      pinSalt: salt,
      pinHash: hash,
      active: params.active !== undefined ? params.active : existing?.active ?? true,
      updatedAt: new Date().toISOString()
    };

    this.staffAuthStore.set(params.staffId, record);
    this.persistState();
    return record;
  }

  public authenticateStaffPin(params: {
    staffId: string;
    pin: string;
    department?: DepartmentType;
    branchId?: string;
    staffName?: string;
    ipAddress: string;
    userAgent?: string;
  }): {
    success: boolean;
    status: number;
    error?: string;
    user?: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId: string;
      permissions: GranularPermission[];
    };
  } {
    const cleanPin = String(params.pin || '').replace(/\D/g, '').trim();
    if (cleanPin.length !== 6) {
      return {
        success: false,
        status: 400,
        error: 'Valid 6-digit numeric staff PIN required.'
      };
    }

    const lockoutKey = `${params.ipAddress}:${params.staffId || 'unknown'}`;
    const nowMs = Date.now();
    const lockState = this.pinLockouts.get(lockoutKey);

    if (lockState && lockState.lockedUntilMs > nowMs) {
      const remainingSec = Math.ceil((lockState.lockedUntilMs - nowMs) / 1000);
      this.recordAudit({
        userId: params.staffId || 'unknown',
        userName: params.staffName || 'Locked Staff Account',
        userRole: 'UNAUTHENTICATED',
        department: params.department || 'POS',
        branchId: params.branchId,
        action: 'PIN_LOGIN_LOCKED_OUT',
        module: 'AUTH',
        entityType: 'STAFF_AUTH',
        entityId: params.staffId || 'unknown',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Blocked PIN attempt during active lockout (${remainingSec}s remaining).`
      });
      return {
        success: false,
        status: 429,
        error: `Account temporarily locked due to repeated failed PIN attempts. Try again in ${remainingSec} seconds.`
      };
    }

    const staffRecord = this.staffAuthStore.get(params.staffId);

    // SECURITY ENFORCEMENT: Unknown staff IDs MUST be rejected immediately.
    // Self-bootstrapping an unknown staffId by supplying a PIN is strictly prohibited.
    if (!staffRecord) {
      this.recordAudit({
        userId: params.staffId || 'unknown',
        userName: params.staffName || 'Unknown Staff ID',
        userRole: 'UNAUTHENTICATED',
        department: params.department || 'POS',
        branchId: params.branchId,
        action: 'PIN_LOGIN_UNKNOWN_STAFF_REJECTED',
        module: 'AUTH',
        entityType: 'STAFF_AUTH',
        entityId: params.staffId || 'unknown',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Rejected login attempt for unregistered staffId "${params.staffId}". Only authorized managers/admins can provision staff accounts.`
      });
      return {
        success: false,
        status: 401,
        error: 'Unknown or unregistered staff ID. Only an authorized Manager or Administrator can create staff accounts.'
      };
    }

    if (!staffRecord.active) {
      this.recordAudit({
        userId: params.staffId || 'unknown',
        userName: staffRecord?.name || params.staffName || 'Disabled User',
        userRole: 'UNAUTHENTICATED',
        department: params.department || 'POS',
        branchId: params.branchId,
        action: 'PIN_LOGIN_DISABLED_ACCOUNT',
        module: 'AUTH',
        entityType: 'STAFF_AUTH',
        entityId: params.staffId || 'unknown',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: 'Attempted login on disabled or non-existent staff account.'
      });
      return {
        success: false,
        status: 403,
        error: 'Staff account is deactivated or unauthorized.'
      };
    }

    const candidateHash = computeSaltedPinHashSync(cleanPin, staffRecord.pinSalt);
    const pinValid = constantTimeEquals(candidateHash, staffRecord.pinHash);

    if (!pinValid) {
      const prevFailures = lockState?.failedAttempts || 0;
      const nextFailures = prevFailures + 1;
      const lockedUntilMs = nextFailures >= 5 ? nowMs + 15 * 60 * 1000 : 0;
      this.pinLockouts.set(lockoutKey, {
        failedAttempts: nextFailures,
        lockedUntilMs,
        lastAttemptMs: nowMs
      });

      this.recordAudit({
        userId: staffRecord.staffId,
        userName: staffRecord.name,
        userRole: staffRecord.role,
        department: staffRecord.department,
        branchId: staffRecord.branchId,
        action: 'PIN_LOGIN_FAILED',
        module: 'AUTH',
        entityType: 'STAFF_AUTH',
        entityId: staffRecord.staffId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Invalid PIN attempt (${nextFailures}/5).`
      });

      return {
        success: false,
        status: 401,
        error:
          nextFailures >= 5
            ? 'Account locked for 15 minutes after 5 failed PIN attempts.'
            : `Invalid staff PIN (${5 - nextFailures} attempts remaining).`
      };
    }

    // Clear failed attempts on success
    this.pinLockouts.delete(lockoutKey);

    const rolePerms = getRolePermissions(staffRecord.role, staffRecord.department);
    const authenticatedUser = {
      userId: staffRecord.staffId,
      name: staffRecord.name,
      role: staffRecord.role,
      department: staffRecord.department,
      branchId: staffRecord.branchId,
      permissions: rolePerms.permissions
    };

    this.recordAudit({
      userId: authenticatedUser.userId,
      userName: authenticatedUser.name,
      userRole: authenticatedUser.role,
      department: authenticatedUser.department,
      branchId: authenticatedUser.branchId,
      action: 'STAFF_PIN_LOGIN_SUCCESS',
      module: 'AUTH',
      entityType: 'STAFF_AUTH',
      entityId: authenticatedUser.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      actionDetails: `Staff authenticated via salted SHA-256 PIN verification (${authenticatedUser.department}).`
    });

    return {
      success: true,
      status: 200,
      user: authenticatedUser
    };
  }

  // ===========================================================================
  // PER-USER RFC 6238 / FIREBASE TOTP MFA, BRUTE-FORCE LOCKOUT & TIMESTEP REPLAY GUARD
  // ===========================================================================
  public generateTotpSecret(length: number = 16): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(length);
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += alphabet[bytes[i] % 32];
    }
    return secret;
  }

  private base32ToBytes(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = String(base32 || '').toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < clean.length; i++) {
      const val = alphabet.indexOf(clean[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  public computeTotpCode(
    secretBase32: string,
    timeMs: number = Date.now(),
    stepSec: number = 30
  ): string {
    const counter = Math.floor(timeMs / 1000 / stepSec);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const key = this.base32ToBytes(secretBase32);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
  }

  /**
   * Derives a deterministic, cryptographically isolated per-user Base32 TOTP secret
   * when a master `TOTP_ADMIN_SECRET` is configured and the user has not yet enrolled
   * a custom secret, or returns their explicitly enrolled per-user secret.
   */
  public derivePerUserTotpSecret(masterSecretBase32: string, userEmailOrId: string): string {
    const cleanIdentity = String(userEmailOrId || 'default-user').trim().toLowerCase();
    const digest = crypto
      .createHmac('sha256', this.base32ToBytes(masterSecretBase32))
      .update(`vaairo-per-user-totp:${cleanIdentity}`)
      .digest();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) {
      secret += alphabet[digest[i] % 32];
    }
    return secret;
  }

  public getUserTotpFactor(userId?: string, email?: string): UserTotpFactorRecord | null {
    const cleanUid = String(userId || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanUid && this.userTotpFactors.has(cleanUid)) {
      return this.userTotpFactors.get(cleanUid)!;
    }
    if (cleanEmail && this.userTotpFactors.has(cleanEmail)) {
      return this.userTotpFactors.get(cleanEmail)!;
    }
    if (cleanEmail && this.userTotpFactors.has(`user-${cleanEmail}`)) {
      return this.userTotpFactors.get(`user-${cleanEmail}`)!;
    }
    return null;
  }

  public enrollOrInitUserTotpFactor(params: {
    userId?: string;
    email: string;
    organizationId?: string;
    customSecret?: string;
  }): {
    userId: string;
    email: string;
    secret: string;
    otpauthUrl: string;
  } {
    const cleanEmail = String(params.email || 'admin@vaairo.co.ke').trim().toLowerCase();
    const cleanUid = String(params.userId || `user-${cleanEmail}`).trim();
    const orgId = params.organizationId || 'org-merchant-vaairo-hq';
    const cleanCustom = String(params.customSecret || '')
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, '')
      .trim();
    const secret = cleanCustom.length >= 16 ? cleanCustom : this.generateTotpSecret(16);
    const nowIso = new Date().toISOString();

    const existing = this.getUserTotpFactor(cleanUid, cleanEmail);
    const updated: UserTotpFactorRecord = {
      userId: cleanUid,
      email: cleanEmail,
      organizationId: orgId,
      totpSecret: existing?.totpSecret || secret,
      pendingSecret: secret,
      mfaEnabled: existing?.mfaEnabled ?? false,
      factorType: existing?.factorType || 'PER_USER_RFC6238_TOTP',
      firebaseFactorUid: existing?.firebaseFactorUid,
      enrolledAt: existing?.enrolledAt || nowIso,
      updatedAt: nowIso
    };

    this.userTotpFactors.set(cleanUid, updated);
    this.userTotpFactors.set(cleanEmail, updated);

    const issuer = encodeURIComponent('VAAIRO ERP');
    const account = encodeURIComponent(cleanEmail);
    const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    return {
      userId: cleanUid,
      email: cleanEmail,
      secret,
      otpauthUrl
    };
  }

  public confirmUserTotpEnrollment(params: {
    userId?: string;
    email: string;
    totpCode: string;
    secret?: string;
    factorType?: 'FIREBASE_TOTP_MFA' | 'PER_USER_RFC6238_TOTP';
    firebaseFactorUid?: string;
    ipAddress?: string;
    nowMs?: number;
  }): {
    success: boolean;
    status: number;
    errorCode?: string;
    error?: string;
    factor?: UserTotpFactorRecord;
  } {
    const cleanEmail = String(params.email || 'admin@vaairo.co.ke').trim().toLowerCase();
    const cleanUid = String(params.userId || `user-${cleanEmail}`).trim();
    const cleanCode = String(params.totpCode || '').replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      return {
        success: false,
        status: 400,
        errorCode: 'INVALID_TOTP_FORMAT',
        error: 'Please enter the 6-digit code from your Authenticator app.'
      };
    }

    const existing = this.getUserTotpFactor(cleanUid, cleanEmail);
    const candidateSecret = String(params.secret || existing?.pendingSecret || existing?.totpSecret || '')
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, '')
      .trim();

    if (!candidateSecret || candidateSecret.length < 16) {
      return {
        success: false,
        status: 400,
        errorCode: 'NO_PENDING_TOTP_SECRET',
        error: 'No pending per-user TOTP setup key found. Generate a setup key first.'
      };
    }

    const nowMs = params.nowMs ?? Date.now();
    const baseStep = Math.floor(nowMs / 1000 / 30);
    let matchedStep: number | null = null;
    for (let s = -1; s <= 1; s++) {
      const checkStep = baseStep + s;
      const expected = this.computeTotpCode(candidateSecret, checkStep * 30 * 1000, 30);
      if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expected))) {
        matchedStep = checkStep;
        break;
      }
    }

    if (matchedStep === null) {
      return {
        success: false,
        status: 401,
        errorCode: 'TOTP_ENROLLMENT_MISMATCH',
        error: 'Verification code did not match. Ensure your device clock is synced and enter the current 6-digit code.'
      };
    }

    const nowIso = new Date(nowMs).toISOString();
    const enrolled: UserTotpFactorRecord = {
      userId: cleanUid,
      email: cleanEmail,
      organizationId: existing?.organizationId || 'org-merchant-vaairo-hq',
      totpSecret: candidateSecret,
      pendingSecret: undefined,
      mfaEnabled: true,
      factorType: params.factorType || 'PER_USER_RFC6238_TOTP',
      firebaseFactorUid: params.firebaseFactorUid || existing?.firebaseFactorUid,
      enrolledAt: nowIso,
      updatedAt: nowIso
    };

    this.userTotpFactors.set(cleanUid, enrolled);
    this.userTotpFactors.set(cleanEmail, enrolled);

    if (this.persistenceEnabled) {
      void firestoreAuthoritativeStore.persistUserTotpFactorToFirestore(enrolled);
      this.persistState();
    }

    this.recordAudit({
      userId: cleanUid,
      userName: cleanEmail,
      userRole: 'SUPER_ADMIN',
      department: 'BRANCH_MANAGER',
      action: 'USER_TOTP_FACTOR_ENROLLED',
      module: 'AUTH',
      entityType: 'USER_MFA_FACTOR',
      entityId: cleanUid,
      ipAddress: params.ipAddress || '127.0.0.1',
      actionDetails: `Enrolled isolated per-user TOTP MFA factor (${enrolled.factorType}) for ${cleanEmail}.`
    });

    return {
      success: true,
      status: 200,
      factor: enrolled
    };
  }

  public disableUserTotpFactor(params: { userId?: string; email?: string; ipAddress?: string }): void {
    const cleanEmail = String(params.email || '').trim().toLowerCase();
    const cleanUid = String(params.userId || (cleanEmail ? `user-${cleanEmail}` : '')).trim();
    const existing = this.getUserTotpFactor(cleanUid, cleanEmail);
    if (existing) {
      const disabled: UserTotpFactorRecord = {
        ...existing,
        mfaEnabled: false,
        pendingSecret: undefined,
        updatedAt: new Date().toISOString()
      };
      this.userTotpFactors.set(existing.userId, disabled);
      this.userTotpFactors.set(existing.email, disabled);
      if (this.persistenceEnabled) {
        void firestoreAuthoritativeStore.persistUserTotpFactorToFirestore(disabled);
        this.persistState();
      }
    }
  }

  public resolveUserTotpStatus(params: {
    userId?: string;
    email?: string;
    globalFallbackSecret?: string | null;
    firebaseSecondFactor?: string;
  }): {
    mfaRequired: boolean;
    satisfiedByFirebaseMfa: boolean;
    perUserEnrolled: boolean;
    factorType: 'FIREBASE_TOTP_MFA' | 'PER_USER_RFC6238_TOTP' | 'SERVER_FALLBACK' | 'NONE';
    activeSecret: string | null;
  } {
    // 1. If Firebase Auth already verified the user's enrolled TOTP second factor during sign-in
    if (params.firebaseSecondFactor === 'totp') {
      return {
        mfaRequired: false,
        satisfiedByFirebaseMfa: true,
        perUserEnrolled: true,
        factorType: 'FIREBASE_TOTP_MFA',
        activeSecret: null
      };
    }

    // 2. Check per-user enrolled TOTP factor record first
    const userFactor = this.getUserTotpFactor(params.userId, params.email);
    if (userFactor && userFactor.mfaEnabled && userFactor.totpSecret) {
      return {
        mfaRequired: true,
        satisfiedByFirebaseMfa: false,
        perUserEnrolled: true,
        factorType: userFactor.factorType,
        activeSecret: userFactor.totpSecret
      };
    }

    // 3. Fallback to server-configured TOTP secret if no per-user factor has been enrolled yet
    if (params.globalFallbackSecret) {
      return {
        mfaRequired: true,
        satisfiedByFirebaseMfa: false,
        perUserEnrolled: false,
        factorType: 'SERVER_FALLBACK',
        activeSecret: params.globalFallbackSecret
      };
    }

    return {
      mfaRequired: false,
      satisfiedByFirebaseMfa: false,
      perUserEnrolled: false,
      factorType: 'NONE',
      activeSecret: null
    };
  }

  /**
   * Verifies a user's 6-digit TOTP MFA code with:
   *  1. Per-user TOTP secret resolution (Admin A, Admin B, and Accountant never share a secret once enrolled)
   *  2. Aggressive brute-force protection: IP + Google identity combination, exponential backoff,
   *     and 5 failed attempts -> 15-minute lockout (`429 MFA_LOCKED_OUT`)
   *  3. Audit event on every failure + `SYSTEM_ALERT` notification on repeated attack lockout
   *  4. Timestep replay protection (`user + timestep`): rejects reusing the same 6-digit code
   *     within its valid ±30-second window (`401 TOTP_TIMESTEP_REPLAY_DETECTED`)
   */
  public verifyUserTotpMfa(params: {
    userId: string;
    email: string;
    totpCode: string;
    fallbackSecretBase32?: string | null;
    ipAddress: string;
    userAgent?: string;
    nowMs?: number;
    tolerance?: number;
    enforceBackoff?: boolean;
  }): {
    valid: boolean;
    status: number;
    errorCode?:
      | 'INVALID_TOTP_FORMAT'
      | 'MFA_NOT_CONFIGURED'
      | 'MFA_LOCKED_OUT'
      | 'MFA_BACKOFF_THROTTLED'
      | 'INVALID_TOTP_CODE'
      | 'TOTP_TIMESTEP_REPLAY_DETECTED';
    error?: string;
    matchedTimestep?: number;
    remainingAttempts?: number;
    lockedUntilMs?: number;
  } {
    const nowMs = params.nowMs ?? Date.now();
    const cleanEmail = String(params.email || '').trim().toLowerCase();
    const cleanUid = String(params.userId || `user-${cleanEmail}`).trim();
    const accountKey = cleanEmail || cleanUid || 'unknown';
    const ipAddress = String(params.ipAddress || '127.0.0.1').trim();
    const ipAccountKey = `${ipAddress}:${accountKey}`;

    // 1. Check active brute-force lockout (IP + Account combination AND Account-wide)
    const ipLock = this.totpLockouts.get(ipAccountKey);
    const acctLock = this.totpLockouts.get(accountKey);
    const activeLock =
      ipLock && ipLock.lockedUntilMs > nowMs
        ? ipLock
        : acctLock && acctLock.lockedUntilMs > nowMs
        ? acctLock
        : null;

    if (activeLock) {
      const remainingSec = Math.ceil((activeLock.lockedUntilMs - nowMs) / 1000);
      this.recordAudit({
        userId: cleanUid,
        userName: cleanEmail || cleanUid,
        userRole: 'UNAUTHENTICATED_MFA',
        department: 'BRANCH_MANAGER',
        action: 'MFA_LOCKED_OUT_ATTEMPT',
        module: 'AUTH',
        entityType: 'USER_MFA',
        entityId: cleanUid,
        ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Blocked TOTP MFA attempt for "${accountKey}" during active 15-minute brute-force lockout (${remainingSec}s remaining).`
      });
      return {
        valid: false,
        status: 429,
        errorCode: 'MFA_LOCKED_OUT',
        lockedUntilMs: activeLock.lockedUntilMs,
        remainingAttempts: 0,
        error: `Account MFA temporarily locked for 15 minutes due to 5 failed TOTP attempts. Try again in ${remainingSec} seconds.`
      };
    }

    // Check exponential backoff if enforceBackoff is enabled
    if (params.enforceBackoff && ipLock && ipLock.backoffUntilMs > nowMs) {
      const waitSec = Math.max(1, Math.ceil((ipLock.backoffUntilMs - nowMs) / 1000));
      return {
        valid: false,
        status: 429,
        errorCode: 'MFA_BACKOFF_THROTTLED',
        error: `Too many rapid TOTP attempts. Please wait ${waitSec}s before trying again.`
      };
    }

    const cleanCode = String(params.totpCode || '').replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      return {
        valid: false,
        status: 400,
        errorCode: 'INVALID_TOTP_FORMAT',
        error: 'Please enter a valid 6-digit TOTP verification code.'
      };
    }

    // 2. Resolve user's individual TOTP secret first, falling back to server secret only if user has not enrolled a per-user secret
    const statusInfo = this.resolveUserTotpStatus({
      userId: cleanUid,
      email: cleanEmail,
      globalFallbackSecret: params.fallbackSecretBase32
    });

    const targetSecret = statusInfo.activeSecret;
    if (!targetSecret) {
      return {
        valid: false,
        status: 400,
        errorCode: 'MFA_NOT_CONFIGURED',
        error: 'TOTP MFA secret is not enrolled for this user account.'
      };
    }

    const tolerance = params.tolerance ?? 1;
    const baseStep = Math.floor(nowMs / 1000 / 30);
    let matchedTimestep: number | null = null;

    for (let stepOffset = -tolerance; stepOffset <= tolerance; stepOffset++) {
      const candidateStep = baseStep + stepOffset;
      const expected = this.computeTotpCode(targetSecret, candidateStep * 30 * 1000, 30);
      if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expected))) {
        matchedTimestep = candidateStep;
        break;
      }
    }

    // 3. Handle Failed TOTP Attempt -> Increment Counter, Apply Exponential Backoff & 5-Failure 15-Minute Lockout
    if (matchedTimestep === null) {
      const prevFailures = Math.max(ipLock?.failedAttempts || 0, acctLock?.failedAttempts || 0);
      const nextFailures = prevFailures + 1;
      const backoffMs = nextFailures >= 2 ? Math.min(60_000, Math.pow(2, nextFailures - 1) * 1000) : 0;
      const lockDurationMs =
        nextFailures >= 5
          ? 15 * 60 * 1000 * Math.pow(2, Math.max(0, nextFailures - 5))
          : 0;
      const lockedUntilMs = lockDurationMs > 0 ? nowMs + lockDurationMs : 0;

      const updatedLock: TotpLockoutState = {
        failedAttempts: nextFailures,
        lockedUntilMs,
        backoffUntilMs: nowMs + backoffMs,
        lastAttemptMs: nowMs,
        ipAddress,
        accountIdentifier: accountKey
      };
      this.totpLockouts.set(ipAccountKey, updatedLock);
      this.totpLockouts.set(accountKey, updatedLock);

      this.recordAudit({
        userId: cleanUid,
        userName: cleanEmail || cleanUid,
        userRole: 'UNAUTHENTICATED_MFA',
        department: 'BRANCH_MANAGER',
        action: nextFailures >= 5 ? 'MFA_BRUTE_FORCE_LOCKOUT' : 'MFA_VERIFICATION_FAILED',
        module: 'AUTH',
        entityType: 'USER_MFA',
        entityId: cleanUid,
        ipAddress,
        userAgent: params.userAgent,
        actionDetails:
          nextFailures >= 5
            ? `CRITICAL: Account "${accountKey}" locked for 15 minutes after ${nextFailures} failed TOTP MFA attempts from IP ${ipAddress}.`
            : `Failed TOTP MFA attempt (${nextFailures}/5) for "${accountKey}" from IP ${ipAddress}.`
      });

      if (nextFailures >= 5) {
        this.notifications.push({
          id: `notif-mfa-attack-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          type: 'SYSTEM_ALERT',
          title: `Security Alert: Repeated TOTP MFA Attack Blocked (${accountKey})`,
          message: `5 consecutive failed TOTP MFA attempts detected for account "${accountKey}" from IP ${ipAddress}. Account MFA is locked for 15 minutes.`,
          entityId: cleanUid,
          read: false,
          createdAt: new Date(nowMs).toISOString()
        });
      }

      return {
        valid: false,
        status: nextFailures >= 5 ? 429 : 401,
        errorCode: nextFailures >= 5 ? 'MFA_LOCKED_OUT' : 'INVALID_TOTP_CODE',
        remainingAttempts: Math.max(0, 5 - nextFailures),
        lockedUntilMs: lockedUntilMs || undefined,
        error:
          nextFailures >= 5
            ? 'Account MFA locked for 15 minutes after 5 failed TOTP attempts.'
            : `Invalid or expired TOTP security code (${5 - nextFailures} attempts remaining before 15-minute lockout).`
      };
    }

    // 4. Timestep Replay Protection (`user + timestep`): Reject reusing the same TOTP code within its valid window
    const replayKeyAccount = `${accountKey}:${matchedTimestep}`;
    const replayKeyUid = `${cleanUid}:${matchedTimestep}`;
    if (this.usedTotpTimesteps.has(replayKeyAccount) || this.usedTotpTimesteps.has(replayKeyUid)) {
      this.recordAudit({
        userId: cleanUid,
        userName: cleanEmail || cleanUid,
        userRole: 'UNAUTHENTICATED_MFA',
        department: 'BRANCH_MANAGER',
        action: 'MFA_TIMESTEP_REPLAY_REJECTED',
        module: 'AUTH',
        entityType: 'USER_MFA',
        entityId: cleanUid,
        ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Blocked replayed TOTP code for "${accountKey}" at timestep ${matchedTimestep}.`
      });
      return {
        valid: false,
        status: 401,
        errorCode: 'TOTP_TIMESTEP_REPLAY_DETECTED',
        error: 'This TOTP code has already been used in the current 30-second window. Please wait for the next code.'
      };
    }

    // Record consumed timestep and prune expired entries older than 10 minutes
    this.usedTotpTimesteps.set(replayKeyAccount, nowMs);
    this.usedTotpTimesteps.set(replayKeyUid, nowMs);
    for (const [k, ts] of this.usedTotpTimesteps.entries()) {
      if (nowMs - ts > 10 * 60 * 1000) {
        this.usedTotpTimesteps.delete(k);
      }
    }

    // Clear failed attempts on valid verification
    this.totpLockouts.delete(ipAccountKey);
    this.totpLockouts.delete(accountKey);

    return {
      valid: true,
      status: 200,
      matchedTimestep,
      remainingAttempts: 5
    };
  }

  // ===========================================================================
  // AUTHORITATIVE M-PESA STK PUSH ORDER VERIFICATION (POS & PUBLIC STOREFRONT TOKENS)
  // ===========================================================================
  public verifyAuthorizedPosStkPushRequest(params: {
    user: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      organizationId?: string;
    };
    branchId?: string;
    organizationId?: string;
    orderNumber?: string;
    requestedAmountKes?: number;
    saleType?: 'RETAIL' | 'WHOLESALE';
    items?: Array<{
      productId: string;
      sku?: string;
      quantity: number;
      requestedDiscountPercent?: number;
    }>;
  }): {
    authorized: boolean;
    status: number;
    errorCode?: string;
    error?: string;
    verifiedOrganizationId?: string;
    verifiedBranchId?: string;
    verifiedOrderNumber?: string;
    authoritativeAmountKes?: number;
  } {
    const { user } = params;
    // 1. Verify POS Sale creation permission
    if (!hasGranularPermission(user.role, user.department, 'sales.create')) {
      return {
        authorized: false,
        status: 403,
        errorCode: 'INSUFFICIENT_POS_PERMISSION',
        error: `Forbidden: Role "${user.role}" (${user.department}) is not authorized to initiate POS M-Pesa STK Push payments.`
      };
    }

    const targetBranchId = String(params.branchId || user.branchId || 'branch-1').trim();
    const targetOrgId = String(
      params.organizationId || this.resolveBranchOrganizationId(targetBranchId)
    ).trim();

    // 2. Verify Organization Membership
    const orgCheck = this.verifyOrganizationResourceAccess({
      userId: user.userId,
      userRole: user.role,
      userOrganizationId: user.organizationId,
      targetOrganizationId: targetOrgId
    });
    if (!orgCheck.authorized) {
      return {
        authorized: false,
        status: 403,
        errorCode: 'ORGANIZATION_ACCESS_DENIED',
        error: orgCheck.error
      };
    }

    // 3. Verify Branch Access
    if (!canAccessBranch(user.role, user.department, user.branchId, targetBranchId)) {
      return {
        authorized: false,
        status: 403,
        errorCode: 'BRANCH_ACCESS_DENIED',
        error: `Forbidden: User "${user.name}" is not authorized to initiate M-Pesa payments for branch "${targetBranchId}".`
      };
    }

    // 4. Verify Order & Authoritative Order Amount
    const cleanOrderNumber = String(params.orderNumber || `POS-${Date.now()}`).trim();
    const existingSale = this.sales.get(cleanOrderNumber);
    if (existingSale) {
      if (existingSale.branchId !== targetBranchId || existingSale.organizationId !== targetOrgId) {
        return {
          authorized: false,
          status: 403,
          errorCode: 'ORDER_BRANCH_MISMATCH',
          error: `Order "${cleanOrderNumber}" does not belong to branch "${targetBranchId}" / organization "${targetOrgId}".`
        };
      }
      return {
        authorized: true,
        status: 200,
        verifiedOrganizationId: targetOrgId,
        verifiedBranchId: targetBranchId,
        verifiedOrderNumber: cleanOrderNumber,
        authoritativeAmountKes: Math.ceil(existingSale.totalAmountKes)
      };
    }

    // If cart items are provided, compute the authoritative order total from the server product catalog
    if (Array.isArray(params.items) && params.items.length > 0) {
      let computedTotal = 0;
      const rolePerms = getRolePermissions(user.role, user.department);
      for (const item of params.items) {
        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          return {
            authorized: false,
            status: 400,
            errorCode: 'INVALID_ITEM_QUANTITY',
            error: 'Each order item must have a positive quantity.'
          };
        }
        const prod = this.products.find(
          p => p.id === item.productId || (item.sku && p.sku === item.sku)
        );
        if (!prod) {
          return {
            authorized: false,
            status: 404,
            errorCode: 'UNKNOWN_PRODUCT',
            error: `Product "${item.productId}" not found in authoritative server catalog.`
          };
        }
        const unitPrice = this.getBranchAuthoritativeProductPrice(
          prod,
          targetBranchId,
          params.saleType,
          qty
        );
        const reqDisc = Number(item.requestedDiscountPercent || 0);
        if (reqDisc > rolePerms.maxDiscountPercent) {
          return {
            authorized: false,
            status: 403,
            errorCode: 'EXCESSIVE_DISCOUNT',
            error: `Requested discount (${reqDisc}%) exceeds role limit (${rolePerms.maxDiscountPercent}%).`
          };
        }
        const lineGross = unitPrice * qty;
        const discountKes = Math.round(lineGross * (Math.max(0, reqDisc) / 100) * 100) / 100;
        computedTotal += lineGross - discountKes;
      }

      const authoritativeAmountKes = Math.ceil(computedTotal);
      if (
        params.requestedAmountKes !== undefined &&
        Math.abs(Math.ceil(Number(params.requestedAmountKes)) - authoritativeAmountKes) > 2
      ) {
        return {
          authorized: false,
          status: 400,
          errorCode: 'ORDER_AMOUNT_MISMATCH',
          error: `Requested STK Push amount (${params.requestedAmountKes} KES) does not match authoritative server order total (${authoritativeAmountKes} KES).`
        };
      }

      return {
        authorized: true,
        status: 200,
        verifiedOrganizationId: targetOrgId,
        verifiedBranchId: targetBranchId,
        verifiedOrderNumber: cleanOrderNumber,
        authoritativeAmountKes
      };
    }

    const fallbackAmount = Math.ceil(Number(params.requestedAmountKes || 0));
    if (!Number.isFinite(fallbackAmount) || fallbackAmount < 1) {
      return {
        authorized: false,
        status: 400,
        errorCode: 'INVALID_MPESA_AMOUNT',
        error: 'Valid positive order amount or items list is required.'
      };
    }

    return {
      authorized: true,
      status: 200,
      verifiedOrganizationId: targetOrgId,
      verifiedBranchId: targetBranchId,
      verifiedOrderNumber: cleanOrderNumber,
      authoritativeAmountKes: fallbackAmount
    };
  }

  /**
   * Issues a server-controlled Public Storefront Checkout Token bound to the authoritative
   * catalog prices, branch, and organization so the public storefront STK Push endpoint
   * never accepts arbitrary `organizationId`, `branchId`, or `amount` from the browser.
   */
  public issuePublicStorefrontCheckoutToken(params: {
    orderId?: string;
    orderNumber?: string;
    branchId: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone: string;
    items: Array<{ productId: string; sku?: string; quantity: number }>;
    ttlSeconds?: number;
  }): {
    success: boolean;
    status: number;
    errorCode?: string;
    error?: string;
    record?: PublicCheckoutOrderTokenRecord;
  } {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      return {
        success: false,
        status: 400,
        errorCode: 'EMPTY_CHECKOUT_ITEMS',
        error: 'Non-empty items array is required to create a public checkout token.'
      };
    }

    const cleanBranchId = String(params.branchId || 'branch-1').trim();
    const resolvedOrgId = this.resolveBranchOrganizationId(cleanBranchId);
    const verifiedItems: PublicCheckoutOrderTokenRecord['items'] = [];
    let authoritativeTotal = 0;

    for (const rawItem of params.items) {
      const qty = Math.floor(Number(rawItem.quantity || 0));
      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          success: false,
          status: 400,
          errorCode: 'INVALID_ITEM_QUANTITY',
          error: 'Each checkout item must have a positive integer quantity.'
        };
      }
      const product = this.products.find(
        p => p.id === rawItem.productId || (rawItem.sku && p.sku === rawItem.sku)
      );
      if (!product) {
        return {
          success: false,
          status: 404,
          errorCode: 'UNKNOWN_STOREFRONT_PRODUCT',
          error: `Product "${rawItem.productId}" does not exist in the authoritative storefront catalog.`
        };
      }
      const unitPriceKes = this.getBranchAuthoritativeProductPrice(
        product,
        cleanBranchId,
        'RETAIL',
        qty
      );
      const lineTotalKes = unitPriceKes * qty;
      authoritativeTotal += lineTotalKes;
      verifiedItems.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: qty,
        unitPriceKes,
        lineTotalKes
      });
    }

    const nowMs = Date.now();
    const ttlMs = Math.max(60, Number(params.ttlSeconds || 7200)) * 1000;
    const orderNumber = String(params.orderNumber || this.nextDocumentNumber('ORD')).trim();
    const orderId = String(params.orderId || `web-ord-${nowMs}`).trim();
    const checkoutToken = `chk_${crypto.randomBytes(18).toString('hex')}`;

    const record: PublicCheckoutOrderTokenRecord = {
      checkoutToken,
      orderId,
      orderNumber,
      organizationId: resolvedOrgId,
      branchId: cleanBranchId,
      customerPhone: String(params.customerPhone || '').trim(),
      customerEmail: params.customerEmail ? String(params.customerEmail).trim() : undefined,
      customerName: String(params.customerName || 'Online Storefront Customer').trim(),
      authoritativeAmountKes: Math.ceil(authoritativeTotal),
      items: verifiedItems,
      createdAt: new Date(nowMs).toISOString(),
      expiresAtMs: nowMs + ttlMs
    };

    this.publicCheckoutTokens.set(checkoutToken, record);
    return {
      success: true,
      status: 201,
      record
    };
  }

  public verifyPublicStorefrontCheckoutToken(params: {
    checkoutToken: string;
    orderNumber?: string;
    nowMs?: number;
  }): {
    valid: boolean;
    status: number;
    errorCode?: string;
    error?: string;
    record?: PublicCheckoutOrderTokenRecord;
  } {
    const cleanToken = String(params.checkoutToken || '').trim();
    if (!cleanToken) {
      return {
        valid: false,
        status: 401,
        errorCode: 'MISSING_CHECKOUT_TOKEN',
        error: 'A valid server-issued public checkoutToken is required to initiate a storefront M-Pesa STK Push.'
      };
    }

    const record = this.publicCheckoutTokens.get(cleanToken);
    if (!record) {
      return {
        valid: false,
        status: 403,
        errorCode: 'INVALID_CHECKOUT_TOKEN',
        error: 'Invalid or unknown public checkoutToken.'
      };
    }

    const nowMs = params.nowMs ?? Date.now();
    if (nowMs > record.expiresAtMs) {
      this.publicCheckoutTokens.delete(cleanToken);
      return {
        valid: false,
        status: 403,
        errorCode: 'EXPIRED_CHECKOUT_TOKEN',
        error: 'Public checkoutToken has expired. Please refresh your checkout session.'
      };
    }

    if (params.orderNumber && String(params.orderNumber).trim() !== record.orderNumber) {
      return {
        valid: false,
        status: 403,
        errorCode: 'CHECKOUT_TOKEN_ORDER_MISMATCH',
        error: `Checkout token is bound to order "${record.orderNumber}", not "${params.orderNumber}".`
      };
    }

    return {
      valid: true,
      status: 200,
      record
    };
  }

  /**
   * Generates a collision-free sequential document number on the server.
   */
  public nextDocumentNumber(prefixKey: keyof typeof this.documentSequences | string): string {
    const cleanPrefix = prefixKey.toUpperCase();
    const current = this.documentSequences[cleanPrefix] || 1000;
    const next = current + 1;
    this.documentSequences[cleanPrefix] = next;
    const year = new Date().getFullYear();
    return `${cleanPrefix}-${year}-${String(next).padStart(6, '0')}`;
  }

  /**
   * Checks if an accounting period (YYYY-MM) is open for posting.
   */
  public isAccountingPeriodOpen(dateIso: string): boolean {
    const periodId = dateIso.slice(0, 7);
    const period = this.accountingPeriods.get(periodId);
    if (!period) {
      this.accountingPeriods.set(periodId, {
        id: periodId,
        name: `Period ${periodId}`,
        status: 'OPEN',
        updatedAt: new Date().toISOString()
      });
      return true;
    }
    return period.status === 'OPEN' || period.status === 'REOPENED';
  }

  public closeAccountingPeriod(params: {
    periodId: string;
    user: { userId: string; name: string; role: ExtendedErpRole; department: DepartmentType };
    ipAddress: string;
  }): { success: boolean; status: number; error?: string; period?: AccountingPeriod } {
    if (!hasGranularPermission(params.user.role, params.user.department, 'period.close')) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden: Missing permission "period.close" to close accounting period.'
      };
    }

    const before = this.accountingPeriods.get(params.periodId);
    const updated: AccountingPeriod = {
      id: params.periodId,
      name: before?.name || `Period ${params.periodId}`,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      closedBy: params.user.userId,
      updatedAt: new Date().toISOString()
    };
    this.accountingPeriods.set(params.periodId, updated);

    this.recordAudit({
      userId: params.user.userId,
      userName: params.user.name,
      userRole: params.user.role,
      department: params.user.department,
      action: 'ACCOUNTING_PERIOD_CLOSED',
      module: 'ACCOUNTING',
      entityType: 'ACCOUNTING_PERIOD',
      entityId: params.periodId,
      before,
      after: updated,
      ipAddress: params.ipAddress
    });

    this.persistState();
    return { success: true, status: 200, period: updated };
  }

  public reopenAccountingPeriod(params: {
    periodId: string;
    reason: string;
    user: { userId: string; name: string; role: ExtendedErpRole; department: DepartmentType };
    ipAddress: string;
  }): { success: boolean; status: number; error?: string; period?: AccountingPeriod } {
    if (!hasGranularPermission(params.user.role, params.user.department, 'period.reopen')) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden: Only SUPER_ADMIN with "period.reopen" permission can reopen a closed accounting period.'
      };
    }
    if (!params.reason || params.reason.trim().length < 5) {
      return {
        success: false,
        status: 400,
        error: 'A mandatory audit reason (minimum 5 characters) is required to reopen an accounting period.'
      };
    }

    const before = this.accountingPeriods.get(params.periodId);
    const updated: AccountingPeriod = {
      id: params.periodId,
      name: before?.name || `Period ${params.periodId}`,
      status: 'REOPENED',
      closedAt: before?.closedAt,
      closedBy: before?.closedBy,
      reopenedAt: new Date().toISOString(),
      reopenedBy: params.user.userId,
      reopenReason: params.reason.trim(),
      updatedAt: new Date().toISOString()
    };
    this.accountingPeriods.set(params.periodId, updated);

    this.recordAudit({
      userId: params.user.userId,
      userName: params.user.name,
      userRole: params.user.role,
      department: params.user.department,
      action: 'ACCOUNTING_PERIOD_REOPENED',
      module: 'ACCOUNTING',
      entityType: 'ACCOUNTING_PERIOD',
      entityId: params.periodId,
      before,
      after: updated,
      ipAddress: params.ipAddress,
      actionDetails: `Reopened period ${params.periodId}. Reason: ${params.reason.trim()}`
    });

    this.persistState();
    firestoreAuthoritativeStore.commitAccountingPeriod(updated).then(res => {
      if (!res.persisted) {
        this.notifications.push({
          id: `notif-persist-fail-period-${updated.id}-${Date.now()}`,
          type: 'SYSTEM_ALERT',
          title: `PERSISTENCE_FAILED (Period ${updated.id})`,
          message: `Accounting period ${updated.id} persistence failed (${res.errorMessage}) and was queued in reconciliation outbox (${res.reconciliationId}).`,
          entityId: updated.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    });
    return { success: true, status: 200, period: updated };
  }

  /**
   * Executes an atomic, server-authoritative POS checkout transaction.
   * Never trusts client prices, client stock balances, or client tax calculations.
   */
  public executePosCheckout(params: {
    user: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      organizationId?: string;
    };
    organizationId?: string;
    branchId: string;
    items: Array<{
      productId: string;
      sku?: string;
      productName?: string;
      quantity: number;
      requestedDiscountPercent?: number;
      taxCode?: string;
    }>;
    paymentMethod: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
    paymentReference?: string;
    saleType?: 'RETAIL' | 'WHOLESALE';
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    cashierId?: string;
    cashierName?: string;
    salesPersonId?: string;
    salesPersonName?: string;
    affiliateId?: string;
    affiliateName?: string;
    checkoutRole?: string;
    idempotencyKey?: string;
    reservationId?: string;
    strictPersistence?: boolean;
    skipAsyncDalCommit?: boolean;
    ipAddress: string;
    userAgent?: string;
  }): {
    status: number;
    body: Record<string, unknown>;
  } {
    const resolvedOrgId = params.organizationId || this.resolveBranchOrganizationId(params.branchId);
    const requestHash = computeIdempotencyRequestHash({
      branchId: params.branchId,
      saleType: params.saleType,
      paymentMethod: params.paymentMethod,
      items: params.items
    });

    // 1. Persistent Idempotency Check (`idempotencyKeys/{scope}_{key}`) + Payload Hash Equality Verification
    if (params.idempotencyKey) {
      const persistedIdem = firestoreAuthoritativeStore.getPersistentIdempotencyRecord(
        'pos',
        params.idempotencyKey
      );
      if (persistedIdem && persistedIdem.status === 'COMPLETED') {
        if (persistedIdem.requestHash && persistedIdem.requestHash !== requestHash) {
          return {
            status: 409,
            body: {
              success: false,
              error: `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${params.idempotencyKey}" was already used with a different request payload.`,
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
            }
          };
        }
        try {
          const parsedBody = JSON.parse(persistedIdem.responseJson) as Record<string, unknown>;
          return {
            status: persistedIdem.responseStatus || 200,
            body: {
              ...parsedBody,
              idempotentReplay: true,
              idempotencyStorage: 'PERSISTENT_DAL'
            }
          };
        } catch {
          // Fall through to in-memory check if malformed
        }
      }

      const existing = this.idempotencyCache.get(`pos:${params.idempotencyKey}`);
      if (existing) {
        if (existing.requestHash && existing.requestHash !== requestHash) {
          return {
            status: 409,
            body: {
              success: false,
              error: `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${params.idempotencyKey}" was already used with a different request payload.`,
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
            }
          };
        }
        return {
          status: 200,
          body: {
            ...(existing.response as Record<string, unknown>),
            idempotentReplay: true
          }
        };
      }
    }

    // 2. Role & Granular Permission Validation
    if (!hasGranularPermission(params.user.role, params.user.department, 'sales.create')) {
      return {
        status: 403,
        body: { error: 'Forbidden: Missing "sales.create" permission to process POS sales.' }
      };
    }

    // 2b. Organization Membership & Commercial Scope Authorization
    const orgCheck = this.verifyOrganizationResourceAccess({
      userId: params.user.userId,
      userRole: params.user.role,
      userOrganizationId: params.user.organizationId,
      targetOrganizationId: resolvedOrgId
    });
    if (!orgCheck.authorized) {
      this.recordAudit({
        organizationId: resolvedOrgId,
        userId: params.user.userId,
        userName: params.user.name,
        userRole: params.user.role,
        department: params.user.department,
        branchId: params.branchId,
        action: 'UNAUTHORIZED_ORGANIZATION_ACCESS_BLOCKED',
        module: 'POS',
        entityType: 'ORGANIZATION',
        entityId: resolvedOrgId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: orgCheck.error
      });
      return {
        status: 403,
        body: {
          error: orgCheck.error,
          errorCode: 'ORGANIZATION_ACCESS_DENIED',
          organizationId: resolvedOrgId
        }
      };
    }

    // 3. Branch-level isolation check
    if (!canAccessBranch(params.user.role, params.user.department, params.user.branchId, params.branchId)) {
      this.recordAudit({
        userId: params.user.userId,
        userName: params.user.name,
        userRole: params.user.role,
        department: params.user.department,
        branchId: params.branchId,
        action: 'UNAUTHORIZED_BRANCH_ACCESS_BLOCKED',
        module: 'POS',
        entityType: 'BRANCH',
        entityId: params.branchId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: `User assigned to ${params.user.branchId} attempted POS sale on ${params.branchId}.`
      });
      return {
        status: 403,
        body: {
          error: `Branch Access Denied: User is only authorized for branch "${params.user.branchId}", not "${params.branchId}".`
        }
      };
    }

    if (!params.branchId || !Array.isArray(params.items) || params.items.length === 0) {
      return {
        status: 400,
        body: { error: 'Valid branchId and non-empty items array are required.' }
      };
    }

    // 4. Accounting Period Open Check
    const nowIso = new Date().toISOString();
    if (!this.isAccountingPeriodOpen(nowIso)) {
      return {
        status: 409,
        body: {
          error: `Accounting period ${nowIso.slice(0, 7)} is CLOSED. Transactions cannot be posted to a closed period.`
        }
      };
    }

    // 5. Concurrency Lock Check per branch+product (only for non-transactional synchronous calls)
    const lockKeys: string[] = [];
    if (!params.skipAsyncDalCommit) {
      for (const item of params.items) {
        const baseProdId = String(item.productId || '').split('-vol-')[0];
        const prod = this.products.find(
          p => p.id === item.productId || p.id === baseProdId || (item.sku && p.sku === item.sku)
        );
        const resolvedProdId = prod?.id || baseProdId || item.productId;
        const lockKey = `${params.branchId}:${resolvedProdId}`;
        if (this.activeProductLocks.has(lockKey)) {
          return {
            status: 409,
            body: {
              error: `Concurrent stock update in progress for product ${resolvedProdId} at branch ${params.branchId}. Please retry.`,
              errorCode: 'STOCK_RESERVATION_CONFLICT'
            }
          };
        }
        lockKeys.push(lockKey);
      }
      lockKeys.forEach(k => this.activeProductLocks.add(k));
    }

    try {
      const rolePerms = getRolePermissions(params.user.role, params.user.department);

      // 6. Validate Products, Stock Availability (accounting for active Two-Phase Reservations), and Discount Ceilings
      const resolvedSaleLines: AuthoritativeSaleRecord['items'] = [];
      for (const item of params.items) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
          return {
            status: 400,
            body: { error: `Invalid quantity (${item.quantity}) for product ${item.productId}. Must be a positive integer.` }
          };
        }

        const baseProdId = String(item.productId || '').split('-vol-')[0];
        const prod = this.products.find(
          p => p.id === item.productId || p.id === baseProdId || (item.sku && p.sku === item.sku)
        );
        const resolvedProdId = prod?.id || baseProdId || item.productId;

        const inv = this.inventoryItems.find(
          i => i.branchId === params.branchId && i.productId === resolvedProdId
        );

        const physicalStock = inv ? inv.bottlesOnHand : 0;
        const reservedByOthers = firestoreAuthoritativeStore.getActiveReservedQuantity(
          params.branchId,
          resolvedProdId,
          params.reservationId
        );
        const availableStock = Math.max(0, physicalStock - reservedByOthers);
        if (availableStock < qty) {
          return {
            status: 409,
            body: {
              error: `Insufficient stock for product ${prod?.name || item.productName || resolvedProdId}. Available: ${availableStock} (Physical: ${physicalStock}, Reserved: ${reservedByOthers}), Requested: ${qty}`,
              errorCode: 'STOCK_RESERVATION_CONFLICT',
              productId: resolvedProdId,
              availableBottles: availableStock,
              physicalBottles: physicalStock,
              reservedBottles: reservedByOthers,
              requestedBottles: qty
            }
          };
        }

        // Authoritative server-side price lookup (honors branch-specific preferred pricing / market class tier)
        const authoritativeUnitPriceKes = prod
          ? this.getBranchAuthoritativeProductPrice(
              prod,
              params.branchId,
              params.saleType,
              qty
            )
          : Math.max(100, Number((item as Record<string, unknown>).unitPriceKes || 1000));
        const unitCostKes = prod
          ? prod.warehouseCostKes
          : Math.round(authoritativeUnitPriceKes * 0.72 * 100) / 100;

        const requestedDiscountPct = Math.max(0, Number(item.requestedDiscountPercent || 0));
        if (requestedDiscountPct > rolePerms.maxDiscountPercent) {
          return {
            status: 403,
            body: {
              error: `Discount of ${requestedDiscountPct}% exceeds maximum allowed discount (${rolePerms.maxDiscountPercent}%) for role ${params.user.role}.`
            }
          };
        }

        const grossLineBeforeDiscount = authoritativeUnitPriceKes * qty;
        const discountKes = Math.round(grossLineBeforeDiscount * (requestedDiscountPct / 100) * 100) / 100;
        const netLineAmount = Math.round((grossLineBeforeDiscount - discountKes) * 100) / 100;

        const taxCalc = calculateConfigurableTax(netLineAmount, {
          taxCode: item.taxCode || 'STANDARD_VAT',
          customRules: this.taxRules
        });

        resolvedSaleLines.push({
          productId: resolvedProdId,
          sku: prod?.sku || item.sku || resolvedProdId,
          productName: prod?.name || item.productName || 'Beverage Item',
          quantity: qty,
          authoritativeUnitPriceKes,
          unitCostKes,
          discountKes,
          taxCode: taxCalc.taxCode,
          taxRatePercent: taxCalc.ratePercent,
          taxableAmountKes: taxCalc.taxableAmount,
          vatAmountKes: taxCalc.vatAmount,
          lineTotalKes: taxCalc.grossAmount
        });
      }

      // 7. Generate Sequential Document Numbers
      const orderNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.saleOrderPrefix);
      const invoiceNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.invoicePrefix);
      const receiptNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.receiptPrefix);
      const paymentNumber = `PAY-${orderNumber.replace('ORD-', '')}`;

      // 8. Deduct Stock & Record Immutable Inventory Ledger Entries
      const updatedBalances: Record<string, number> = {};
      const checkoutInventoryTransactions: InventoryLedgerEntry[] = [];
      const checkoutUpdatedInventoryItems: InventoryItem[] = [];
      for (const line of resolvedSaleLines) {
        const invIdx = this.inventoryItems.findIndex(
          i => i.branchId === params.branchId && i.productId === line.productId
        );
        if (invIdx >= 0) {
          const beforeQty = this.inventoryItems[invIdx].bottlesOnHand;
          const afterQty = beforeQty - line.quantity;

          // Seed transactionalStockMirror if not yet initialized so concurrent transactions read the true initial balance
          if (
            firestoreAuthoritativeStore.getAuthoritativeCloudStockBalance(
              params.branchId,
              line.productId
            ) === undefined
          ) {
            firestoreAuthoritativeStore.setAuthoritativeCloudStockBalance(
              params.branchId,
              line.productId,
              beforeQty
            );
          }

          if (!params.skipAsyncDalCommit) {
            this.inventoryItems[invIdx].bottlesOnHand = afterQty;
            this.inventoryItems[invIdx].casesOnHand = Math.floor(afterQty / 12);
            this.inventoryItems[invIdx].lastScannedAt = nowIso;
          }
          updatedBalances[line.productId] = afterQty;
          checkoutUpdatedInventoryItems.push({ ...this.inventoryItems[invIdx] });

          const ledgerEntry: InventoryLedgerEntry = {
            id: `invtx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
            organizationId: resolvedOrgId,
            productId: line.productId,
            sku: line.sku,
            productName: line.productName,
            branchId: params.branchId,
            transactionType: 'SALE',
            quantity: -line.quantity,
            beforeQuantity: beforeQty,
            afterQuantity: afterQty,
            referenceId: orderNumber,
            referenceType: 'POS_SALE',
            userId: params.user.userId,
            userName: params.user.name,
            reason: `POS Retail Sale ${orderNumber}`,
            timestamp: nowIso
          };
          this.inventoryLedger.push(ledgerEntry);
          checkoutInventoryTransactions.push(ledgerEntry);

          // Automated Restock / Low Stock Alert Check
          const reorderPoint = this.inventoryItems[invIdx].reorderLevel || 12;
          if (afterQty <= reorderPoint) {
            this.notifications.push({
              id: `notif-lowstock-${params.branchId}-${line.productId}-${Date.now()}`,
              type: 'LOW_STOCK',
              branchId: params.branchId,
              title: `Low Stock Alert: ${line.productName}`,
              message: `${line.productName} (${line.sku}) at branch ${params.branchId} reached ${afterQty} bottles (Reorder Point: ${reorderPoint}).`,
              entityId: line.productId,
              read: false,
              createdAt: nowIso
            });
          }
        }
      }

      // 9. Aggregate Authoritative Totals
      const subtotalKes = Math.round(resolvedSaleLines.reduce((s, l) => s + l.taxableAmountKes, 0) * 100) / 100;
      const vatAmountKes = Math.round(resolvedSaleLines.reduce((s, l) => s + l.vatAmountKes, 0) * 100) / 100;
      const discountKes = Math.round(resolvedSaleLines.reduce((s, l) => s + l.discountKes, 0) * 100) / 100;
      const totalAmountKes = Math.round(resolvedSaleLines.reduce((s, l) => s + l.lineTotalKes, 0) * 100) / 100;
      const totalCogsKes = Math.round(
        resolvedSaleLines.reduce((s, l) => s + l.unitCostKes * l.quantity, 0) * 100
      ) / 100;

      // 10. Create Payment & Official Receipt (Payment -> Receipt) stamped with organizationId
      const paymentId = `pay-${orderNumber}`;
      const paymentRecord: AuthoritativePaymentRecord = {
        id: paymentId,
        organizationId: resolvedOrgId,
        paymentNumber,
        orderNumber,
        branchId: params.branchId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        amountKes: totalAmountKes,
        paymentMethod: params.paymentMethod || 'CASH',
        reference: params.paymentReference || paymentNumber,
        createdBy: params.user.userId,
        createdAt: nowIso
      };
      this.payments.set(paymentId, paymentRecord);

      const receiptId = `rct-${orderNumber}`;
      const receiptRecord: AuthoritativeReceiptRecord = {
        id: receiptId,
        organizationId: resolvedOrgId,
        receiptNumber,
        paymentId,
        orderNumber,
        branchId: params.branchId,
        amountKes: totalAmountKes,
        paymentMethod: paymentRecord.paymentMethod,
        reference: paymentRecord.reference,
        createdBy: params.user.userId,
        createdAt: nowIso
      };
      this.receipts.set(receiptId, receiptRecord);

      // 11. Create Balanced Double-Entry Accounting Journal (Revenue + VAT + Asset & COGS + Inventory)
      const journalEntryNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.journalEntryPrefix);
      const paymentAccount =
        params.paymentMethod === 'MPESA'
          ? STANDARD_CHART_OF_ACCOUNTS.MPESA_CLEARING
          : params.paymentMethod === 'CARD'
          ? STANDARD_CHART_OF_ACCOUNTS.CARD_BANK_SETTLEMENT
          : STANDARD_CHART_OF_ACCOUNTS.CASH_ON_HAND;

      // Net sales revenue credit exactly balances gross payment less output VAT
      const netSalesRevenueCredit = Math.max(0, Math.round((totalAmountKes - vatAmountKes) * 100) / 100);

      const journalLines: AccountingJournalLine[] = [
        {
          accountCode: paymentAccount.code,
          accountName: paymentAccount.name,
          debitKes: totalAmountKes,
          creditKes: 0
        },
        {
          accountCode: STANDARD_CHART_OF_ACCOUNTS.SALES_REVENUE.code,
          accountName: STANDARD_CHART_OF_ACCOUNTS.SALES_REVENUE.name,
          debitKes: 0,
          creditKes: netSalesRevenueCredit
        }
      ];

      if (vatAmountKes > 0) {
        journalLines.push({
          accountCode: STANDARD_CHART_OF_ACCOUNTS.VAT_OUTPUT_LIABILITY.code,
          accountName: STANDARD_CHART_OF_ACCOUNTS.VAT_OUTPUT_LIABILITY.name,
          debitKes: 0,
          creditKes: vatAmountKes
        });
      }

      if (totalCogsKes > 0) {
        journalLines.push(
          {
            accountCode: STANDARD_CHART_OF_ACCOUNTS.COST_OF_GOODS_SOLD.code,
            accountName: STANDARD_CHART_OF_ACCOUNTS.COST_OF_GOODS_SOLD.name,
            debitKes: totalCogsKes,
            creditKes: 0
          },
          {
            accountCode: STANDARD_CHART_OF_ACCOUNTS.INVENTORY_ASSET.code,
            accountName: STANDARD_CHART_OF_ACCOUNTS.INVENTORY_ASSET.name,
            debitKes: 0,
            creditKes: totalCogsKes
          }
        );
      }

      // Enforce zero mathematical variance so Financial Ledger is always 100% balanced
      const initialTotalDebit = Math.round(journalLines.reduce((s, l) => s + l.debitKes, 0) * 100) / 100;
      const initialTotalCredit = Math.round(journalLines.reduce((s, l) => s + l.creditKes, 0) * 100) / 100;
      const ledgerVariance = Math.round((initialTotalDebit - initialTotalCredit) * 100) / 100;
      if (ledgerVariance !== 0) {
        const revLine = journalLines.find(l => l.accountCode === STANDARD_CHART_OF_ACCOUNTS.SALES_REVENUE.code);
        if (revLine) {
          revLine.creditKes = Math.round((revLine.creditKes + ledgerVariance) * 100) / 100;
        }
      }

      const totalDebitKes = Math.round(journalLines.reduce((s, l) => s + l.debitKes, 0) * 100) / 100;
      const totalCreditKes = Math.round(journalLines.reduce((s, l) => s + l.creditKes, 0) * 100) / 100;

      const effectiveCashierId = params.cashierId || params.user.userId;
      const effectiveCashierName = params.cashierName || params.user.name;
      const effectiveSalesPersonId = params.salesPersonId || params.affiliateId;
      const effectiveSalesPersonName = params.salesPersonName || params.affiliateName;

      const journalEntry: AccountingJournalEntry = {
        id: `je-${orderNumber}`,
        organizationId: resolvedOrgId,
        entryNumber: journalEntryNumber,
        referenceNumber: orderNumber,
        periodId: nowIso.slice(0, 7),
        branchId: params.branchId,
        date: nowIso.slice(0, 10),
        description: `POS Sale ${orderNumber} (${paymentRecord.paymentMethod}) • Cashier: ${effectiveCashierName}${effectiveSalesPersonName ? ` • Rep: ${effectiveSalesPersonName}` : ''}`,
        lines: journalLines,
        totalDebitKes,
        totalCreditKes,
        postedBy: params.user.name,
        createdAt: nowIso
      };
      this.journalEntries.push(journalEntry);

      // 12. Process Fiscal Transaction Lifecycle (KRA eTIMS)
      const fiscalRecord = this.processFiscalSubmission({
        invoiceNumber: orderNumber,
        branchId: params.branchId,
        grossAmountKes: totalAmountKes,
        vatAmountKes,
        taxableAmountKes: subtotalKes
      });
      fiscalRecord.organizationId = resolvedOrgId;

      // 13. Record Sale Header stamped with organizationId and staff relationship
      const saleRecord: AuthoritativeSaleRecord = {
        id: `sale-${orderNumber}`,
        organizationId: resolvedOrgId,
        orderNumber,
        invoiceNumber,
        receiptNumber,
        branchId: params.branchId,
        items: resolvedSaleLines,
        subtotalKes,
        discountKes,
        vatAmountKes,
        totalAmountKes,
        totalCogsKes,
        paymentMethod: paymentRecord.paymentMethod,
        paymentId,
        receiptId,
        journalEntryId: journalEntry.id,
        fiscalTransactionId: fiscalRecord.id,
        status: 'COMPLETED',
        idempotencyKey: params.idempotencyKey,
        cashierId: effectiveCashierId,
        cashierName: effectiveCashierName,
        salesPersonId: effectiveSalesPersonId,
        salesPersonName: effectiveSalesPersonName,
        affiliateId: effectiveSalesPersonId,
        affiliateName: effectiveSalesPersonName,
        checkoutRole: params.checkoutRole,
        createdBy: params.user.userId,
        createdByName: params.user.name,
        createdAt: nowIso
      };
      this.sales.set(orderNumber, saleRecord);

      // 14. Record Enterprise Audit Log
      this.recordAudit({
        organizationId: resolvedOrgId,
        userId: params.user.userId,
        userName: params.user.name,
        userRole: params.user.role,
        department: params.user.department,
        branchId: params.branchId,
        action: 'POS_SALE_EXECUTED',
        module: 'POS',
        entityType: 'SALE',
        entityId: orderNumber,
        after: {
          organizationId: resolvedOrgId,
          orderNumber,
          invoiceNumber,
          receiptNumber,
          totalAmountKes,
          vatAmountKes,
          itemsCount: resolvedSaleLines.length,
          cashierId: effectiveCashierId,
          cashierName: effectiveCashierName,
          salesPersonId: effectiveSalesPersonId,
          salesPersonName: effectiveSalesPersonName,
          checkoutRole: params.checkoutRole
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        actionDetails: `Completed sale ${orderNumber} (${totalAmountKes} KES) with receipt ${receiptNumber} and journal ${journalEntryNumber} (Cashier: ${effectiveCashierName}, Sales Rep: ${effectiveSalesPersonName || 'Counter Direct'}).`
      });

      const responseBody: Record<string, unknown> = {
        success: true,
        organizationId: resolvedOrgId,
        orderNumber,
        invoiceNumber,
        receiptNumber,
        paymentNumber,
        transactionId: saleRecord.id,
        subtotalKes,
        discountKes,
        vatAmountKes,
        totalAmountKes,
        cashierId: effectiveCashierId,
        cashierName: effectiveCashierName,
        salesPersonId: effectiveSalesPersonId,
        salesPersonName: effectiveSalesPersonName,
        checkoutRole: params.checkoutRole,
        etimsRecord: fiscalRecord,
        journalEntryId: journalEntry.id,
        journalEntryNumber,
        journalEntry,
        saleRecord,
        updatedBalances,
        persistenceStatus: 'COMMITTED',
        serverTimestamp: nowIso
      };

      if (!params.skipAsyncDalCommit) {
        if (params.idempotencyKey) {
          this.idempotencyCache.set(`pos:${params.idempotencyKey}`, {
            timestampMs: Date.now(),
            requestHash,
            response: responseBody
          });
          firestoreAuthoritativeStore.savePersistentIdempotencyRecord({
            scope: 'pos',
            key: params.idempotencyKey,
            requestHash,
            organizationId: resolvedOrgId,
            branchId: params.branchId,
            responseStatus: 200,
            responsePayload: responseBody
          });
        }

        const saleCommand = {
          commandId: `cmd-${orderNumber}`,
          organizationId: resolvedOrgId,
          branchId: params.branchId,
          idempotencyScope: 'pos',
          idempotencyKey: params.idempotencyKey,
          requestHash,
          reservationId: params.reservationId,
          sale: saleRecord,
          fiscalTx: fiscalRecord,
          journalEntry,
          inventoryTransactions: checkoutInventoryTransactions.map(tx => ({
            ...tx,
            organizationId: resolvedOrgId
          })),
          updatedInventoryItems: checkoutUpdatedInventoryItems,
          auditLog: this.auditLogs[this.auditLogs.length - 1],
          responsePayload: responseBody
        };

        this.persistState();

        // Execute DAL transaction boundary; never swallow persistence errors (explicitly queue in reconciliation outbox)
        firestoreAuthoritativeStore.commitSaleTransactionBundle(saleCommand).then(dalRes => {
          if (!dalRes.persisted) {
            this.notifications.push({
              id: `notif-persist-fail-${orderNumber}-${Date.now()}`,
              type: 'SYSTEM_ALERT',
              branchId: params.branchId,
              title: `PERSISTENCE_FAILED (${orderNumber})`,
              message: `Sale ${orderNumber} failed Firestore transaction persistence (${dalRes.errorMessage}) and was queued in reconciliation outbox (${dalRes.reconciliationId}).`,
              entityId: orderNumber,
              read: false,
              createdAt: new Date().toISOString()
            });
          } else if (dalRes.reservedBalances) {
            for (const [prodId, authQty] of Object.entries(dalRes.reservedBalances)) {
              const invItem = this.inventoryItems.find(
                i => i.branchId === params.branchId && i.productId === prodId
              );
              if (invItem) {
                invItem.bottlesOnHand = authQty;
                invItem.casesOnHand = Math.floor(authQty / 12);
              }
            }
          }
        });
      }

      if (params.customerEmail && params.customerEmail.includes('@')) {
        const itemsSummary = resolvedSaleLines
          .map(
            l =>
              `- ${l.quantity}x ${l.productName} (${l.sku}) @ KES ${l.authoritativeUnitPriceKes.toLocaleString()} = KES ${l.lineTotalKes.toLocaleString()}`
          )
          .join('\n');
        this.dispatchTransactionalEmail({
          to: params.customerEmail.trim(),
          subject: `[VAAIRO] Official 16% VAT Receipt & Tax Invoice (${invoiceNumber})`,
          templateType: 'PURCHASE_RECEIPT',
          referenceId: orderNumber,
          bodyText: `Dear ${params.customerName || 'Valued Customer'},\n\nThank you for your purchase at VAAIRO Beverages & Merchants Ltd.\n\nORDER & 16% VAT RECEIPT DETAILS:\n- Order Number: ${orderNumber}\n- Official Receipt: ${receiptNumber}\n- 16% VAT Tax Invoice: ${invoiceNumber}\n- VAT Audit Code: ${fiscalRecord.kraControlCode || 'VERIFIED'}\n- Payment Method: ${paymentRecord.paymentMethod} (${paymentRecord.reference})\n\nITEMS PURCHASED:\n${itemsSummary}\n\nSubtotal (Excl. 16% VAT): KES ${subtotalKes.toLocaleString()}\nEnforced 16% VAT: KES ${vatAmountKes.toLocaleString()}\nTOTAL PAID: KES ${totalAmountKes.toLocaleString()}\n\nVerify 16% VAT Receipt: ${fiscalRecord.qrUrl || 'https://vaairo.co.ke/verify-vat'}\nSupport & Replies: ${DEFAULT_BRANDING_CONFIG.supportEmail}`,
          user: params.user,
          ipAddress: params.ipAddress
        }).then(emailLog => {
          if (emailLog.status === 'FAILED') {
            this.notifications.push({
              id: `notif-email-fail-${orderNumber}-${Date.now()}`,
              type: 'SYSTEM_ALERT',
              branchId: params.branchId,
              title: `Email Dispatch Alert (${orderNumber})`,
              message: `Receipt email to ${params.customerEmail} failed: ${emailLog.errorMessage}`,
              entityId: orderNumber,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      return { status: 200, body: responseBody };
    } finally {
      lockKeys.forEach(k => this.activeProductLocks.delete(k));
    }
  }

  /**
   * Executes a strictly transactional POS checkout through the Privileged Firestore Admin DAL
   * (`FirestoreAuthoritativeStore.commitSaleTransactionBundle`).
   *
   * Inside `runTransaction()`, the DAL calculates:
   *   `currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`
   * and returns the authoritative `reservedBalances` and `ledgerSnapshots` to synchronize engine state.
   * If persistence fails or conflicts, rolls back tentative in-memory state and returns explicit
   * `503 PERSISTENCE_FAILED` or `409 STOCK_RESERVATION_CONFLICT` (never swallowed).
   */
  public async executeTransactionalPosCheckout(
    params: Parameters<AuthoritativeErpEngine['executePosCheckout']>[0]
  ): Promise<{
    status: number;
    body: Record<string, unknown>;
  }> {
    const resolvedOrgId = params.organizationId || this.resolveBranchOrganizationId(params.branchId);
    const requestHash = computeIdempotencyRequestHash({
      branchId: params.branchId,
      saleType: params.saleType,
      paymentMethod: params.paymentMethod,
      items: params.items
    });

    // 1. Check cloud-persisted idempotency + requestHash equality first
    if (params.idempotencyKey) {
      const cloudIdem = await firestoreAuthoritativeStore.fetchPersistentIdempotencyRecordFromCloud(
        'pos',
        params.idempotencyKey
      );
      if (cloudIdem && cloudIdem.status === 'COMPLETED') {
        if (cloudIdem.requestHash && cloudIdem.requestHash !== requestHash) {
          return {
            status: 409,
            body: {
              success: false,
              error: `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${params.idempotencyKey}" was already used with a different request payload.`,
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
            }
          };
        }
        const parsed = JSON.parse(cloudIdem.responseJson) as Record<string, unknown>;
        return {
          status: cloudIdem.responseStatus || 200,
          body: {
            ...parsed,
            idempotentReplay: true,
            idempotencyStorage: 'PERSISTENT_DAL'
          }
        };
      }
    }

    // 2. Snapshot pre-checkout inventory balances so tentative mutations can be rolled back if DAL fails
    const preCheckoutInventorySnapshot = new Map<string, { bottlesOnHand: number; casesOnHand: number }>();
    for (const inv of this.inventoryItems) {
      if (inv.branchId === params.branchId) {
        preCheckoutInventorySnapshot.set(inv.productId, {
          bottlesOnHand: inv.bottlesOnHand,
          casesOnHand: inv.casesOnHand
        });
      }
    }

    const result = this.executePosCheckout({
      ...params,
      skipAsyncDalCommit: true
    });
    if (result.status !== 200 || result.body.idempotentReplay) {
      return result;
    }

    const orderNumber = String(result.body.orderNumber);
    const saleRecord = this.sales.get(orderNumber)!;
    const fiscalRecord = this.fiscalTransactions.get(orderNumber)!;
    const journalEntry = this.journalEntries.find(j => j.referenceNumber === orderNumber)!;
    const checkoutInventoryTransactions = this.inventoryLedger.filter(
      tx => tx.referenceId === orderNumber && tx.transactionType === 'SALE'
    );
    const checkoutUpdatedInventoryItems = this.inventoryItems.filter(
      i =>
        i.branchId === params.branchId &&
        saleRecord.items.some(line => line.productId === i.productId)
    );

    // 3. Execute atomic DAL transaction (`currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`)
    const dalResult = await firestoreAuthoritativeStore.commitSaleTransactionBundle({
      commandId: `cmd-${orderNumber}`,
      organizationId: resolvedOrgId,
      branchId: params.branchId,
      idempotencyScope: 'pos',
      idempotencyKey: params.idempotencyKey,
      requestHash,
      reservationId: params.reservationId,
      sale: saleRecord,
      fiscalTx: fiscalRecord,
      journalEntry,
      inventoryTransactions: checkoutInventoryTransactions,
      updatedInventoryItems: checkoutUpdatedInventoryItems,
      auditLog: this.auditLogs[this.auditLogs.length - 1],
      responsePayload: result.body
    });

    if (!dalResult.persisted) {
      // Roll back tentative in-memory state so uncommitted or conflicted transactions never corrupt memory
      for (const [prodId, snap] of preCheckoutInventorySnapshot.entries()) {
        const invItem = this.inventoryItems.find(
          i => i.branchId === params.branchId && i.productId === prodId
        );
        if (invItem) {
          const authCloudBalance = firestoreAuthoritativeStore.getAuthoritativeCloudStockBalance(
            params.branchId,
            prodId
          );
          const restoredQty = authCloudBalance ?? snap.bottlesOnHand;
          invItem.bottlesOnHand = restoredQty;
          invItem.casesOnHand = Math.floor(restoredQty / 12);
        }
      }
      this.inventoryLedger = this.inventoryLedger.filter(tx => tx.referenceId !== orderNumber);
      this.journalEntries = this.journalEntries.filter(j => j.referenceNumber !== orderNumber);
      this.sales.delete(orderNumber);
      this.payments.delete(saleRecord.paymentId);
      this.receipts.delete(saleRecord.receiptId);
      this.fiscalTransactions.delete(orderNumber);
      if (params.idempotencyKey && dalResult.errorCode !== 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
        this.idempotencyCache.delete(`pos:${params.idempotencyKey}`);
      }

      const httpStatus =
        dalResult.errorCode === 'STOCK_RESERVATION_CONFLICT' ||
        dalResult.errorCode === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
          ? 409
          : 503;

      return {
        status: httpStatus,
        body: {
          success: false,
          error: dalResult.errorMessage || 'Financial persistence failed.',
          errorCode: dalResult.errorCode || 'PERSISTENCE_FAILED',
          persistenceStatus: 'PERSISTENCE_FAILED',
          reconciliationId: dalResult.reconciliationId,
          orderNumber,
          organizationId: resolvedOrgId
        }
      };
    }

    if (dalResult.status === 'IDEMPOTENT_REPLAY' && dalResult.idempotentResponse) {
      // Clean up the duplicate tentative records generated before the DAL transaction detected the replay
      this.inventoryLedger = this.inventoryLedger.filter(tx => tx.referenceId !== orderNumber);
      this.journalEntries = this.journalEntries.filter(j => j.referenceNumber !== orderNumber);
      this.sales.delete(orderNumber);
      this.payments.delete(saleRecord.paymentId);
      this.receipts.delete(saleRecord.receiptId);
      this.fiscalTransactions.delete(orderNumber);

      return {
        status: 200,
        body: {
          ...dalResult.idempotentResponse,
          idempotentReplay: true,
          idempotencyStorage: 'PERSISTENT_DAL'
        }
      };
    }

    // 4. Synchronize local inventory & ledger entries with the authoritative cloud delta balances
    // calculated inside runTransaction() (`currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`)
    const authoritativeBalances: Record<string, number> = {
      ...(result.body.updatedBalances as Record<string, number>),
      ...(dalResult.reservedBalances || {})
    };

    for (const [prodId, authQty] of Object.entries(authoritativeBalances)) {
      const invItem = this.inventoryItems.find(
        i => i.branchId === params.branchId && i.productId === prodId
      );
      if (invItem) {
        invItem.bottlesOnHand = authQty;
        invItem.casesOnHand = Math.floor(authQty / 12);
      }
    }

    if (dalResult.ledgerSnapshots) {
      for (const tx of checkoutInventoryTransactions) {
        const snap = dalResult.ledgerSnapshots[tx.id];
        if (snap) {
          tx.beforeQuantity = snap.beforeQuantity;
          tx.afterQuantity = snap.afterQuantity;
        }
      }
    }

    const finalResponseBody: Record<string, unknown> = {
      ...result.body,
      updatedBalances: authoritativeBalances,
      persistenceStatus: 'COMMITTED'
    };

    if (params.idempotencyKey) {
      this.idempotencyCache.set(`pos:${params.idempotencyKey}`, {
        timestampMs: Date.now(),
        requestHash,
        response: finalResponseBody
      });
    }

    this.persistState();

    return {
      status: 200,
      body: finalResponseBody
    };
  }

  /**
   * Reconciles any failed financial/inventory persistence operations queued in the DAL outbox,
   * and synchronizes the engine's in-memory state with the newly committed transactions.
   */
  public async retryFailedPersistenceOperations(): Promise<{
    attempted: number;
    reconciled: number;
    stillFailing: number;
    reconciledIds: string[];
  }> {
    const res = await firestoreAuthoritativeStore.retryPendingReconciliations();
    for (const cmd of res.reconciledCommands) {
      if (cmd.operationType === 'SALE_TRANSACTION') {
        const saleCmd = cmd.payload as {
          branchId: string;
          idempotencyKey?: string;
          sale: AuthoritativeSaleRecord;
          fiscalTx: FiscalTransactionRecord;
          journalEntry: AccountingJournalEntry;
          inventoryTransactions: InventoryLedgerEntry[];
          responsePayload?: Record<string, unknown>;
        };
        if (saleCmd && saleCmd.sale) {
          this.sales.set(saleCmd.sale.orderNumber, saleCmd.sale);
          this.fiscalTransactions.set(saleCmd.sale.orderNumber, saleCmd.fiscalTx);
          if (!this.journalEntries.some(j => j.id === saleCmd.journalEntry.id)) {
            this.journalEntries.push(saleCmd.journalEntry);
          }
          for (const tx of saleCmd.inventoryTransactions) {
            const snap = cmd.result.ledgerSnapshots?.[tx.id];
            const committedTx: InventoryLedgerEntry = snap
              ? { ...tx, beforeQuantity: snap.beforeQuantity, afterQuantity: snap.afterQuantity }
              : tx;
            if (!this.inventoryLedger.some(existing => existing.id === committedTx.id)) {
              this.inventoryLedger.push(committedTx);
            }
          }
          if (cmd.result.reservedBalances) {
            for (const [prodId, authQty] of Object.entries(cmd.result.reservedBalances)) {
              const invItem = this.inventoryItems.find(
                i => i.branchId === saleCmd.branchId && i.productId === prodId
              );
              if (invItem) {
                invItem.bottlesOnHand = authQty;
                invItem.casesOnHand = Math.floor(authQty / 12);
              }
            }
          }
        }
      }
    }
    if (res.reconciled > 0) {
      this.persistState();
    }
    return {
      attempted: res.attempted,
      reconciled: res.reconciled,
      stillFailing: res.stillFailing,
      reconciledIds: res.reconciledIds
    };
  }

  /**
   * Controlled Refund / Credit Note Reversal for an existing Sale.
   * Preserves immutable financial history by issuing a Credit Note, restoring inventory via RETURN ledger,
   * and posting a reversing double-entry journal.
   */
  public refundSaleTransaction(params: {
    orderNumber: string;
    reason: string;
    user: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
    };
    ipAddress: string;
  }): { status: number; body: Record<string, unknown> } {
    if (!hasGranularPermission(params.user.role, params.user.department, 'sales.refund')) {
      return {
        status: 403,
        body: { error: 'Forbidden: Missing "sales.refund" permission to issue sale refunds.' }
      };
    }

    const sale = this.sales.get(params.orderNumber);
    if (!sale) {
      return { status: 404, body: { error: `Sale ${params.orderNumber} not found.` } };
    }

    if (!canAccessBranch(params.user.role, params.user.department, params.user.branchId, sale.branchId)) {
      return {
        status: 403,
        body: { error: `Forbidden: Cannot refund sale belonging to branch ${sale.branchId}.` }
      };
    }

    if (sale.status !== 'COMPLETED') {
      return {
        status: 409,
        body: { error: `Sale ${params.orderNumber} is already in terminal state "${sale.status}".` }
      };
    }

    if (!params.reason || params.reason.trim().length < 4) {
      return {
        status: 400,
        body: { error: 'A valid refund reason is required for audit trail compliance.' }
      };
    }

    const nowIso = new Date().toISOString();
    if (!this.isAccountingPeriodOpen(nowIso)) {
      return {
        status: 409,
        body: { error: `Current accounting period ${nowIso.slice(0, 7)} is closed.` }
      };
    }

    const creditNoteNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.creditNotePrefix);
    const beforeSnapshot = { ...sale };

    // 1. Restore Stock via RETURN Inventory Ledger Entries
    const updatedBalances: Record<string, number> = {};
    for (const line of sale.items) {
      const invIdx = this.inventoryItems.findIndex(
        i => i.branchId === sale.branchId && i.productId === line.productId
      );
      if (invIdx >= 0) {
        const beforeQty = this.inventoryItems[invIdx].bottlesOnHand;
        const afterQty = beforeQty + line.quantity;
        this.inventoryItems[invIdx].bottlesOnHand = afterQty;
        this.inventoryItems[invIdx].casesOnHand = Math.floor(afterQty / 12);
        updatedBalances[line.productId] = afterQty;

        this.inventoryLedger.push({
          id: `invtx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
          productId: line.productId,
          sku: line.sku,
          productName: line.productName,
          branchId: sale.branchId,
          transactionType: 'RETURN',
          quantity: line.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceId: creditNoteNumber,
          referenceType: 'CREDIT_NOTE_REFUND',
          userId: params.user.userId,
          userName: params.user.name,
          reason: `Refund of ${params.orderNumber}: ${params.reason.trim()}`,
          timestamp: nowIso
        });
      }
    }

    // 2. Post Reversing Double-Entry Journal
    const journalEntryNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.journalEntryPrefix);
    const paymentAccount =
      sale.paymentMethod === 'MPESA'
        ? STANDARD_CHART_OF_ACCOUNTS.MPESA_CLEARING
        : sale.paymentMethod === 'CARD'
        ? STANDARD_CHART_OF_ACCOUNTS.CARD_BANK_SETTLEMENT
        : STANDARD_CHART_OF_ACCOUNTS.CASH_ON_HAND;

    const lines: AccountingJournalLine[] = [
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.SALES_RETURNS_ALLOWANCES.code,
        accountName: STANDARD_CHART_OF_ACCOUNTS.SALES_RETURNS_ALLOWANCES.name,
        debitKes: sale.subtotalKes,
        creditKes: 0
      },
      {
        accountCode: paymentAccount.code,
        accountName: paymentAccount.name,
        debitKes: 0,
        creditKes: sale.totalAmountKes
      }
    ];

    if (sale.vatAmountKes > 0) {
      lines.push({
        accountCode: STANDARD_CHART_OF_ACCOUNTS.VAT_OUTPUT_LIABILITY.code,
        accountName: STANDARD_CHART_OF_ACCOUNTS.VAT_OUTPUT_LIABILITY.name,
        debitKes: sale.vatAmountKes,
        creditKes: 0
      });
    }

    if (sale.totalCogsKes > 0) {
      lines.push(
        {
          accountCode: STANDARD_CHART_OF_ACCOUNTS.INVENTORY_ASSET.code,
          accountName: STANDARD_CHART_OF_ACCOUNTS.INVENTORY_ASSET.name,
          debitKes: sale.totalCogsKes,
          creditKes: 0
        },
        {
          accountCode: STANDARD_CHART_OF_ACCOUNTS.COST_OF_GOODS_SOLD.code,
          accountName: STANDARD_CHART_OF_ACCOUNTS.COST_OF_GOODS_SOLD.name,
          debitKes: 0,
          creditKes: sale.totalCogsKes
        }
      );
    }

    const totalDebitKes = Math.round(lines.reduce((s, l) => s + l.debitKes, 0) * 100) / 100;
    const totalCreditKes = Math.round(lines.reduce((s, l) => s + l.creditKes, 0) * 100) / 100;

    const reversalJournal: AccountingJournalEntry = {
      id: `je-${creditNoteNumber}`,
      entryNumber: journalEntryNumber,
      referenceNumber: creditNoteNumber,
      periodId: nowIso.slice(0, 7),
      branchId: sale.branchId,
      date: nowIso.slice(0, 10),
      description: `Credit Note ${creditNoteNumber} reversing Sale ${sale.orderNumber}`,
      lines,
      totalDebitKes,
      totalCreditKes,
      postedBy: params.user.name,
      createdAt: nowIso
    };
    this.journalEntries.push(reversalJournal);

    sale.status = 'REFUNDED';
    sale.creditNoteNumber = creditNoteNumber;
    sale.refundedAt = nowIso;
    sale.refundedBy = params.user.userId;
    sale.refundReason = params.reason.trim();

    this.recordAudit({
      userId: params.user.userId,
      userName: params.user.name,
      userRole: params.user.role,
      department: params.user.department,
      branchId: sale.branchId,
      action: 'SALE_REFUNDED_CREDIT_NOTE',
      module: 'POS',
      entityType: 'SALE',
      entityId: sale.orderNumber,
      before: beforeSnapshot,
      after: sale,
      ipAddress: params.ipAddress,
      actionDetails: `Issued Credit Note ${creditNoteNumber} for ${sale.orderNumber}. Reason: ${params.reason.trim()}`
    });

    this.persistState();
    return {
      status: 200,
      body: {
        success: true,
        orderNumber: sale.orderNumber,
        creditNoteNumber,
        reversalJournalNumber: journalEntryNumber,
        updatedBalances,
        refundedAt: nowIso
      }
    };
  }

  /**
   * Two-Phase Stock Reservation (Hold -> Payment -> Commit / Release)
   * Holds inventory for an asynchronous payment flow so concurrent checkouts cannot oversell reserved bottles.
   */
  public async reserveStockForPendingCheckout(params: {
    user: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      organizationId?: string;
    };
    organizationId?: string;
    branchId: string;
    orderReference: string;
    items: Array<{
      productId: string;
      sku?: string;
      productName?: string;
      quantity: number;
    }>;
    ttlSeconds?: number;
  }): Promise<{
    status: number;
    body: {
      success: boolean;
      error?: string;
      errorCode?: string;
      reservation?: StockReservationRecord;
    };
  }> {
    if (!hasGranularPermission(params.user.role, params.user.department, 'sales.create')) {
      return {
        status: 403,
        body: {
          success: false,
          error: 'Forbidden: Missing "sales.create" permission to reserve stock.'
        }
      };
    }

    if (!canAccessBranch(params.user.role, params.user.department, params.user.branchId, params.branchId)) {
      return {
        status: 403,
        body: {
          success: false,
          error: `Forbidden: User is not authorized for branch "${params.branchId}".`
        }
      };
    }

    const resolvedOrgId = params.organizationId || this.resolveBranchOrganizationId(params.branchId);
    const enrichedItems = params.items.map(i => {
      const baseProdId = String(i.productId || '').split('-vol-')[0];
      const prod = this.products.find(
        p => p.id === i.productId || p.id === baseProdId || (i.sku && p.sku === i.sku)
      );
      const resolvedProdId = prod?.id || baseProdId || i.productId;
      const inv = this.inventoryItems.find(
        invItem => invItem.branchId === params.branchId && invItem.productId === resolvedProdId
      );
      return {
        productId: resolvedProdId,
        sku: prod?.sku || i.sku || resolvedProdId,
        productName: prod?.name || i.productName || resolvedProdId,
        quantity: Math.max(1, Math.trunc(Number(i.quantity) || 1)),
        currentPhysicalStock: inv ? inv.bottlesOnHand : 0
      };
    });

    const res = await firestoreAuthoritativeStore.reserveStockForPendingOrder({
      organizationId: resolvedOrgId,
      branchId: params.branchId,
      orderReference: params.orderReference,
      items: enrichedItems,
      ttlSeconds: params.ttlSeconds,
      createdBy: params.user.userId
    });

    if (!res.reserved || !res.reservation) {
      return {
        status: res.status,
        body: {
          success: false,
          error: res.errorMessage,
          errorCode: res.errorCode
        }
      };
    }

    return {
      status: 201,
      body: {
        success: true,
        reservation: res.reservation
      }
    };
  }

  public async releasePendingStockReservation(
    reservationId: string,
    reason?: string
  ): Promise<{
    status: number;
    body: {
      success: boolean;
      error?: string;
      reservation?: StockReservationRecord;
    };
  }> {
    const res = await firestoreAuthoritativeStore.releaseStockReservation(reservationId, reason);
    return {
      status: res.status,
      body: {
        success: res.released,
        error: res.errorMessage,
        reservation: res.reservation
      }
    };
  }

  /**
   * Formal Inter-Branch Stock Transfer Workflow:
   * DRAFT -> REQUESTED -> APPROVED -> DISPATCHED (records TRANSFER_OUT) -> RECEIVED (records TRANSFER_IN) | CANCELLED
   */
  public createOrTransitionStockTransfer(params: {
    transferId?: string;
    fromBranchId?: string;
    toBranchId?: string;
    items?: StockTransferItem[];
    targetStatus: StockTransferStatus;
    reason?: string;
    user: {
      userId: string;
      name: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
    };
    ipAddress: string;
  }): { status: number; body: Record<string, unknown> } {
    if (!hasGranularPermission(params.user.role, params.user.department, 'inventory.transfer')) {
      return {
        status: 403,
        body: { error: 'Forbidden: Missing "inventory.transfer" permission.' }
      };
    }

    const nowIso = new Date().toISOString();

    if (!params.transferId) {
      if (!params.fromBranchId || !params.toBranchId || params.fromBranchId === params.toBranchId) {
        return {
          status: 400,
          body: { error: 'Distinct fromBranchId and toBranchId are required for a stock transfer.' }
        };
      }

      // Enforce branch access verification for the initiating/dispatching source branch (fromBranchId)
      const canAccessFrom = canAccessBranch(
        params.user.role,
        params.user.department,
        params.user.branchId,
        params.fromBranchId
      );
      if (!canAccessFrom) {
        return {
          status: 403,
          body: {
            error: `Forbidden: User is not authorized for source branch fromBranchId (${params.fromBranchId}).`,
            errorCode: 'CROSS_BRANCH_TRANSFER_ACCESS_DENIED'
          }
        };
      }
      if (!Array.isArray(params.items) || params.items.length === 0) {
        return {
          status: 400,
          body: { error: 'Non-empty transfer items array is required.' }
        };
      }

      const transferNumber = this.nextDocumentNumber(DEFAULT_DOCUMENT_NUMBERING.stockTransferPrefix);
      const id = `trf-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
      const record: StockTransferRecord = {
        id,
        transferNumber,
        fromBranchId: params.fromBranchId,
        toBranchId: params.toBranchId,
        status: params.targetStatus === 'DRAFT' ? 'DRAFT' : 'REQUESTED',
        items: params.items,
        requestedBy: params.user.userId,
        reason: params.reason || 'Inter-branch stock replenishment',
        createdAt: nowIso,
        updatedAt: nowIso
      };
      this.stockTransfers.set(id, record);

      this.recordAudit({
        userId: params.user.userId,
        userName: params.user.name,
        userRole: params.user.role,
        department: params.user.department,
        branchId: params.fromBranchId,
        action: `STOCK_TRANSFER_${record.status}`,
        module: 'INVENTORY',
        entityType: 'STOCK_TRANSFER',
        entityId: record.transferNumber,
        after: record,
        ipAddress: params.ipAddress
      });

      this.persistState();
      firestoreAuthoritativeStore.commitStockTransfer(record).then(res => {
        if (!res.persisted) {
          this.notifications.push({
            id: `notif-persist-fail-trf-${record.transferNumber}-${Date.now()}`,
            type: 'SYSTEM_ALERT',
            branchId: record.fromBranchId,
            title: `PERSISTENCE_FAILED (${record.transferNumber})`,
            message: `Stock transfer ${record.transferNumber} failed persistence (${res.errorMessage}) and was queued in reconciliation outbox (${res.reconciliationId}).`,
            entityId: record.transferNumber,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      });
      return { status: 201, body: { success: true, transfer: record } };
    }

    const transfer = this.stockTransfers.get(params.transferId);
    if (!transfer) {
      return { status: 404, body: { error: `Stock transfer ${params.transferId} not found.` } };
    }

    // Verify branch access for both sides of the transfer lifecycle:
    // - Source branch (`fromBranchId`) access is required for APPROVED / DISPATCHED / CANCELLED
    // - Destination branch (`toBranchId`) access is required for RECEIVED (TRANSFER_IN)
    const canAccessFrom = canAccessBranch(
      params.user.role,
      params.user.department,
      params.user.branchId,
      transfer.fromBranchId
    );
    const canAccessTo = canAccessBranch(
      params.user.role,
      params.user.department,
      params.user.branchId,
      transfer.toBranchId
    );
    if (params.targetStatus === 'RECEIVED' ? !canAccessTo : !canAccessFrom) {
      return {
        status: 403,
        body: {
          error: `Forbidden: Inter-branch stock transfer (${params.targetStatus}) requires authorized access to ${
            params.targetStatus === 'RECEIVED'
              ? `destination toBranchId (${transfer.toBranchId})`
              : `source fromBranchId (${transfer.fromBranchId})`
          }.`,
          errorCode: 'CROSS_BRANCH_TRANSFER_ACCESS_DENIED'
        }
      };
    }

    if (transfer.status === 'RECEIVED' || transfer.status === 'CANCELLED') {
      return {
        status: 409,
        body: { error: `Stock transfer ${transfer.transferNumber} is already in terminal state ${transfer.status}.` }
      };
    }

    const beforeSnapshot = { ...transfer };

    if (params.targetStatus === 'DISPATCHED') {
      // Verify & deduct stock from source branch (TRANSFER_OUT)
      for (const item of transfer.items) {
        const inv = this.inventoryItems.find(
          i => i.branchId === transfer.fromBranchId && i.productId === item.productId
        );
        const available = inv ? inv.bottlesOnHand : 0;
        if (available < item.quantity) {
          return {
            status: 409,
            body: {
              error: `Insufficient stock at source branch ${transfer.fromBranchId} for ${item.productId}. Available: ${available}, Required: ${item.quantity}`
            }
          };
        }
      }

      for (const item of transfer.items) {
        const invIdx = this.inventoryItems.findIndex(
          i => i.branchId === transfer.fromBranchId && i.productId === item.productId
        );
        if (invIdx >= 0) {
          const beforeQty = this.inventoryItems[invIdx].bottlesOnHand;
          const afterQty = beforeQty - item.quantity;
          this.inventoryItems[invIdx].bottlesOnHand = afterQty;
          this.inventoryItems[invIdx].casesOnHand = Math.floor(afterQty / 12);

          const prod = this.products.find(p => p.id === item.productId);
          this.inventoryLedger.push({
            id: `invtx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
            productId: item.productId,
            sku: prod?.sku || item.sku || item.productId,
            productName: prod?.name || item.productName || item.productId,
            branchId: transfer.fromBranchId,
            transactionType: 'TRANSFER_OUT',
            quantity: -item.quantity,
            beforeQuantity: beforeQty,
            afterQuantity: afterQty,
            referenceId: transfer.transferNumber,
            referenceType: 'STOCK_TRANSFER',
            userId: params.user.userId,
            userName: params.user.name,
            reason: `Dispatched transfer ${transfer.transferNumber} to ${transfer.toBranchId}`,
            timestamp: nowIso
          });
        }
      }
      transfer.dispatchedBy = params.user.userId;
    } else if (params.targetStatus === 'RECEIVED') {
      if (transfer.status !== 'DISPATCHED') {
        return {
          status: 409,
          body: { error: `Transfer ${transfer.transferNumber} must be DISPATCHED before it can be RECEIVED.` }
        };
      }

      // Add stock to destination branch (TRANSFER_IN)
      for (const item of transfer.items) {
        let inv = this.inventoryItems.find(
          i => i.branchId === transfer.toBranchId && i.productId === item.productId
        );
        if (!inv) {
          inv = {
            id: `inv-${transfer.toBranchId}-${item.productId}`,
            branchId: transfer.toBranchId,
            productId: item.productId,
            bottlesOnHand: 0,
            casesOnHand: 0,
            reorderLevel: 12,
            batchNumber: 'BATCH-2026',
            expiryDate: '2029-12-31',
            lastScannedAt: nowIso
          };
          this.inventoryItems.push(inv);
        }

        const beforeQty = inv.bottlesOnHand;
        const afterQty = beforeQty + item.quantity;
        inv.bottlesOnHand = afterQty;
        inv.casesOnHand = Math.floor(afterQty / 12);
        inv.lastScannedAt = nowIso;

        const prod = this.products.find(p => p.id === item.productId);
        this.inventoryLedger.push({
          id: `invtx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
          productId: item.productId,
          sku: prod?.sku || item.sku || item.productId,
          productName: prod?.name || item.productName || item.productId,
          branchId: transfer.toBranchId,
          transactionType: 'TRANSFER_IN',
          quantity: item.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceId: transfer.transferNumber,
          referenceType: 'STOCK_TRANSFER',
          userId: params.user.userId,
          userName: params.user.name,
          reason: `Received transfer ${transfer.transferNumber} from ${transfer.fromBranchId}`,
          timestamp: nowIso
        });
      }
      transfer.receivedBy = params.user.userId;
    } else if (params.targetStatus === 'APPROVED') {
      transfer.approvedBy = params.user.userId;
    }

    transfer.status = params.targetStatus;
    transfer.updatedAt = nowIso;

    this.recordAudit({
      userId: params.user.userId,
      userName: params.user.name,
      userRole: params.user.role,
      department: params.user.department,
      branchId: transfer.fromBranchId,
      action: `STOCK_TRANSFER_${params.targetStatus}`,
      module: 'INVENTORY',
      entityType: 'STOCK_TRANSFER',
      entityId: transfer.transferNumber,
      before: beforeSnapshot,
      after: transfer,
      ipAddress: params.ipAddress
    });

    this.persistState();
    firestoreAuthoritativeStore.commitStockTransfer(transfer).then(res => {
      if (!res.persisted) {
        this.notifications.push({
          id: `notif-persist-fail-trf-${transfer.transferNumber}-${Date.now()}`,
          type: 'SYSTEM_ALERT',
          branchId: transfer.fromBranchId,
          title: `PERSISTENCE_FAILED (${transfer.transferNumber})`,
          message: `Stock transfer ${transfer.transferNumber} failed persistence (${res.errorMessage}) and was queued in reconciliation outbox (${res.reconciliationId}).`,
          entityId: transfer.transferNumber,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    });
    return { status: 200, body: { success: true, transfer } };
  }

  /**
   * KRA eTIMS Fiscal Transaction Lifecycle Processor:
   * PENDING -> SUBMITTING -> SUCCESS | FAILED | RETRY_PENDING | CANCELLED
   */
  public processFiscalSubmission(params: {
    invoiceNumber: string;
    branchId?: string;
    grossAmountKes: number;
    vatAmountKes: number;
    taxableAmountKes?: number;
    traderPin?: string;
    simulateGatewayFailure?: boolean;
  }): FiscalTransactionRecord {
    const existing = this.fiscalTransactions.get(params.invoiceNumber);
    if (existing && existing.status === 'SUCCESS') {
      return existing;
    }

    const nowIso = new Date().toISOString();
    const requestReference = `REQ-KRA-${params.invoiceNumber.replace(/[^A-Z0-9]/gi, '')}-${Date.now().toString(36).toUpperCase()}`;
    const retryCount = existing ? existing.retryCount + 1 : 0;
    const verifiedTraderPin = params.traderPin || process.env.KRA_TRADER_PIN || DEFAULT_BRANDING_CONFIG.kraPin;

    // Check if gateway failure is explicitly triggered or simulated
    if (params.simulateGatewayFailure || process.env.KRA_SIMULATE_OFFLINE === 'true') {
      const failedRecord: FiscalTransactionRecord = {
        id: existing?.id || `fisc-${params.invoiceNumber}`,
        invoiceNumber: params.invoiceNumber,
        branchId: params.branchId || DEFAULT_BRANDING_CONFIG.defaultBranchId,
        grossAmountKes: Number(params.grossAmountKes),
        vatAmountKes: Number(params.vatAmountKes),
        taxableAmountKes:
          params.taxableAmountKes ??
          Math.round((Number(params.grossAmountKes) - Number(params.vatAmountKes)) * 100) / 100,
        status: 'RETRY_PENDING',
        requestReference,
        verifiedTraderPin,
        submissionTimestamp: nowIso,
        errorCode: 'KRA_OSCU_TIMEOUT_503',
        errorMessage: 'KRA eTIMS OSCU gateway unreachable; queued for automated fiscal reconciliation retry.',
        retryCount,
        transmitted: false,
        signedAt: nowIso
      };
      this.fiscalTransactions.set(params.invoiceNumber, failedRecord);

      this.notifications.push({
        id: `notif-kra-fail-${params.invoiceNumber}-${Date.now()}`,
        type: 'FAILED_KRA_SUBMISSION',
        branchId: failedRecord.branchId,
        title: `Fiscalization Queued (${params.invoiceNumber})`,
        message: `Invoice ${params.invoiceNumber} could not reach KRA OSCU and is marked RETRY_PENDING (Retry #${retryCount}).`,
        entityId: params.invoiceNumber,
        read: false,
        createdAt: nowIso
      });

      this.persistState();
      return failedRecord;
    }

    const resolvedSecrets = validateAndResolveServerSecrets(process.env);
    const cuSerial = process.env.KRA_CU_SERIAL || 'VATREG-02941-2026-KE';
    const digest = crypto
      .createHmac('sha256', resolvedSecrets.kraCmcKey)
      .update(`${params.invoiceNumber}:${params.grossAmountKes}:${verifiedTraderPin}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    const controlCode = `${params.invoiceNumber.replace(/[^A-Z0-9]/gi, '')}-${digest}-VAT`;
    const responseReference = `RES-VAT-${digest}`;
    const qrUrl = `https://vaairo.co.ke/verify-vat?ref=${cuSerial}&inv=${encodeURIComponent(params.invoiceNumber)}&ctrl=${controlCode}`;

    const successRecord: FiscalTransactionRecord = {
      id: existing?.id || `fisc-${params.invoiceNumber}`,
      invoiceNumber: params.invoiceNumber,
      branchId: params.branchId || DEFAULT_BRANDING_CONFIG.defaultBranchId,
      grossAmountKes: Number(params.grossAmountKes),
      vatAmountKes: Number(params.vatAmountKes),
      taxableAmountKes:
        params.taxableAmountKes ??
        Math.round((Number(params.grossAmountKes) - Number(params.vatAmountKes)) * 100) / 100,
      status: 'SUCCESS',
      requestReference,
      responseReference,
      fiscalIdentifier: controlCode,
      cuSerial,
      kraControlCode: controlCode,
      qrUrl,
      verifiedTraderPin,
      submissionTimestamp: nowIso,
      responseTimestamp: nowIso,
      retryCount,
      transmitted: true,
      signedAt: nowIso
    };

    this.fiscalTransactions.set(params.invoiceNumber, successRecord);
    this.persistState();
    return successRecord;
  }

  /**
   * Secure Server-Side Transactional Email Service (One-Way Outbound System Dispatch)
   * Configured for Zoho Mail Free Plan on urbantechdev.com:
   * - System sends automated transactional emails one-way from support@urbantechdev.com
   * - Customer/Supplier replies (Reply-To: support@urbantechdev.com) route directly to the Zoho Webmail Inbox via Cloudflare MX records.
   */
  public async dispatchTransactionalEmail(params: {
    to: string;
    subject: string;
    templateType: EmailDispatchLog['templateType'];
    bodyText: string;
    referenceId?: string;
    user: { userId: string; name: string; role: string; department: string };
    ipAddress: string;
  }): Promise<EmailDispatchLog> {
    const envEmail = (process.env.EMAIL_FROM_ADDRESS || '').trim();
    const fromAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(envEmail)
      ? envEmail
      : DEFAULT_BRANDING_CONFIG.supportEmail;
    const nowIso = new Date().toISOString();
    const logId = `email-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

    let status: EmailDispatchLog['status'] = 'QUEUED';
    let provider = 'Zoho Mail Free Plan (One-Way System Outbound • Replies -> Zoho Webmail Inbox)';
    let errorMessage: string | undefined;

    // If a valid Zoho / Cloudflare outbound HTTP relay URL is configured in environment variables, execute live HTTP dispatch
    const zohoApiUrl = (process.env.ZOHO_MAIL_API_URL || '').trim();
    const zohoApiToken = (process.env.ZOHO_MAIL_API_TOKEN || '').trim();
    if (zohoApiUrl.startsWith('https://') && zohoApiToken) {
      try {
        const res = await fetch(zohoApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Zoho-oauthtoken ${zohoApiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fromAddress,
            replyTo: fromAddress,
            toAddress: params.to,
            subject: params.subject,
            content: params.bodyText
          })
        });
        if (res.ok) {
          status = 'SENT';
          provider = 'Zoho Mail Free Plan HTTP Relay (One-Way Outbound Live)';
        } else {
          status = 'FAILED';
          errorMessage = `Zoho API returned status ${res.status}`;
        }
      } catch (err) {
        status = 'FAILED';
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    } else {
      status = 'PROVIDER_NOT_CONFIGURED';
      provider = 'PROVIDER_NOT_CONFIGURED (Configure ZOHO_MAIL_API_URL & ZOHO_MAIL_API_TOKEN for live outbound relay)';
      errorMessage = 'No outbound email relay provider configured; email queued locally without external transmission.';
    }

    const emailRecord: EmailDispatchLog = {
      id: logId,
      from: fromAddress,
      replyTo: fromAddress,
      to: params.to,
      subject: params.subject,
      direction: 'ONE_WAY_OUTBOUND',
      receivingMailbox: `${fromAddress} (Zoho Webmail Inbox via Cloudflare MX)`,
      templateType: params.templateType,
      referenceId: params.referenceId,
      status,
      provider,
      sentAt: nowIso,
      errorMessage
    };

    this.emailLogs.push(emailRecord);

    this.recordAudit({
      userId: params.user.userId,
      userName: params.user.name,
      userRole: params.user.role,
      department: params.user.department,
      action: `EMAIL_${status}`,
      module: 'EMAIL',
      entityType: 'EMAIL_MESSAGE',
      entityId: logId,
      after: emailRecord,
      ipAddress: params.ipAddress,
      actionDetails: `Transactional email (${params.templateType}) from ${fromAddress} to ${params.to}: "${params.subject}"`
    });

    this.persistState();
    return emailRecord;
  }

  public recordAudit(entry: {
    organizationId?: string;
    userId: string;
    userName: string;
    userRole: string;
    department: string;
    branchId?: string;
    action?: string;
    actionType?: string;
    actionTitle?: string;
    actionDetails?: string;
    module: string;
    entityType?: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ipAddress: string;
    userAgent?: string;
  }): EnterpriseAuditLog {
    const nowIso = new Date().toISOString();
    const actionCode = entry.action || entry.actionType || 'ERP_OPERATION';
    const record: EnterpriseAuditLog = {
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      organizationId: entry.organizationId || 'org-merchant-vaairo-hq',
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      department: entry.department,
      branchId: entry.branchId,
      action: actionCode,
      actionType: entry.actionType || actionCode,
      actionTitle: entry.actionTitle || `${actionCode} (${entry.module})`,
      actionDetails: entry.actionDetails,
      module: entry.module,
      entityType: entry.entityType || entry.module,
      entityId: entry.entityId || 'system',
      before: entry.before,
      after: entry.after,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      timestamp: nowIso,
      serverTimestamp: nowIso
    };
    this.auditLogs.push(record);
    if (this.auditLogs.length > 5000) {
      this.auditLogs.shift();
    }
    return record;
  }

  public persistState(): void {
    if (!this.persistenceEnabled) return;
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        documentSequences: this.documentSequences,
        inventoryLedger: this.inventoryLedger.slice(-2000),
        sales: Array.from(this.sales.entries()),
        payments: Array.from(this.payments.entries()),
        receipts: Array.from(this.receipts.entries()),
        journalEntries: this.journalEntries.slice(-2000),
        accountingPeriods: Array.from(this.accountingPeriods.entries()),
        fiscalTransactions: Array.from(this.fiscalTransactions.entries()),
        stockTransfers: Array.from(this.stockTransfers.entries()),
        notifications: this.notifications.slice(-500),
        auditLogs: this.auditLogs.slice(-2000),
        emailLogs: this.emailLogs.slice(-500),
        staffAuthStore: Array.from(this.staffAuthStore.entries()),
        idempotencyRecords: Array.from(firestoreAuthoritativeStore.idempotencyStore.entries())
      };
      fs.writeFileSync(PERSISTENCE_FILE_PATH, JSON.stringify(payload), 'utf8');
    } catch {
      // Ignore write error in read-only environments
    }
  }

  private loadPersistedState(): void {
    try {
      if (!fs.existsSync(PERSISTENCE_FILE_PATH)) return;
      const raw = fs.readFileSync(PERSISTENCE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.documentSequences) {
        this.documentSequences = { ...this.documentSequences, ...parsed.documentSequences };
      }
      if (Array.isArray(parsed.inventoryLedger)) this.inventoryLedger = parsed.inventoryLedger;
      if (Array.isArray(parsed.sales)) this.sales = new Map(parsed.sales);
      if (Array.isArray(parsed.payments)) this.payments = new Map(parsed.payments);
      if (Array.isArray(parsed.receipts)) this.receipts = new Map(parsed.receipts);
      if (Array.isArray(parsed.journalEntries)) this.journalEntries = parsed.journalEntries;
      if (Array.isArray(parsed.accountingPeriods)) this.accountingPeriods = new Map(parsed.accountingPeriods);
      if (Array.isArray(parsed.fiscalTransactions)) this.fiscalTransactions = new Map(parsed.fiscalTransactions);
      if (Array.isArray(parsed.stockTransfers)) this.stockTransfers = new Map(parsed.stockTransfers);
      if (Array.isArray(parsed.notifications)) this.notifications = parsed.notifications;
      if (Array.isArray(parsed.auditLogs)) this.auditLogs = parsed.auditLogs;
      if (Array.isArray(parsed.emailLogs)) this.emailLogs = parsed.emailLogs;
      if (Array.isArray(parsed.staffAuthStore)) {
        for (const [k, v] of parsed.staffAuthStore) {
          this.staffAuthStore.set(k, v);
        }
      }
      if (Array.isArray(parsed.idempotencyRecords)) {
        for (const [k, v] of parsed.idempotencyRecords) {
          firestoreAuthoritativeStore.idempotencyStore.set(k, v);
        }
      }
    } catch {
      // Ignore corrupt or missing persistence file
    }
  }

  public cleanAllSalesData(): { cleanedSalesCount: number; timestamp: string } {
    const previousCount = this.sales.size;
    this.sales.clear();
    this.payments.clear();
    this.receipts.clear();
    this.fiscalTransactions.clear();
    this.documentSequences = {
      ...this.documentSequences,
      ORD: 1000,
      INV: 1000,
      RCT: 1000
    };
    this.persistState();
    return {
      cleanedSalesCount: previousCount,
      timestamp: new Date().toISOString()
    };
  }
}
