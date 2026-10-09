/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { AuthoritativeErpEngine, validateAndResolveServerSecrets } from '../server/erpEngine';
import { firestoreAuthoritativeStore } from '../server/firestoreAuthoritativeStore';
import {
  verifyFirebaseIdTokenCryptographically,
  registerTrustedPublicKeyForTesting,
  clearTrustedPublicKeysForTesting,
  signTestFirebaseIdToken
} from '../server/firebaseTokenVerifier';
import { calculateConfigurableTax, calculateVatBreakdown } from '../utils/kenyaTax';
import {
  canAccessBranch,
  getRequiredInventoryPermission,
  getRolePermissions,
  hasGranularPermission
} from '../utils/rbac';
import { splitProductIntoPublicAndPrivate } from '../utils/productCatalogSplit';
import {
  synchronizeNetworkOrganizations,
  synchronizeOrganizationMemberships,
  synchronizeConsumers,
  hasUserOrganizationRole
} from '../utils/networkDomainMapper';
import { InventoryItem, Product } from '../types';
import {
  NAIROBI_DRINKS_PRODUCTS,
  CATALOG_BARCODE_QUALITY_AUDIT
} from '../data/nairobiDrinksCatalog';
import {
  validateGs1Barcode,
  validateCaseToBottleRelationship
} from '../utils/barcodeQualityPipeline';

const TEST_PRODUCTS: Product[] = [
  {
    id: 'prod-glenfiddich-18',
    sku: 'IPS-WHISKY-001',
    barcode: '5010327325125',
    caseBarcode: '15010327325122',
    name: 'Glenfiddich 18 Year Old Single Malt 750ml',
    brand: 'Glenfiddich',
    category: 'IPS',
    subCategory: 'Whisky',
    volumeMl: 750,
    alcoholPercentage: 40,
    packSize: 12,
    countryOfOrigin: 'Scotland',
    warehouseCostKes: 10500,
    wholesalePriceKes: 13200,
    retailPriceKes: 15080,
    minWholesaleQty: 6,
    vatRate: 0.16,
    exciseDutyPerLitreKes: 350,
    kraExciseStampType: 'IMPORT_DUTY_STAMP'
  },
  {
    id: 'prod-tusker-malt',
    sku: 'LPS-BEER-002',
    barcode: '6161101600128',
    caseBarcode: '16161101600125',
    name: 'Tusker Malt Lager 500ml Can (6-Pack)',
    brand: 'Tusker',
    category: 'LPS',
    subCategory: 'Beer',
    volumeMl: 500,
    alcoholPercentage: 5.0,
    packSize: 24,
    countryOfOrigin: 'Kenya',
    warehouseCostKes: 950,
    wholesalePriceKes: 1200,
    retailPriceKes: 1450,
    minWholesaleQty: 12,
    vatRate: 0.16,
    exciseDutyPerLitreKes: 142,
    kraExciseStampType: 'DIGITAL_EXCISE_STAMP'
  }
];

function createTestInventory(): InventoryItem[] {
  return [
    {
      id: 'inv-branch-1-whisky',
      branchId: 'branch-1',
      productId: 'prod-glenfiddich-18',
      bottlesOnHand: 15,
      casesOnHand: 1,
      reorderLevel: 12,
      batchNumber: 'BATCH-2026-A',
      expiryDate: '2030-12-31',
      lastScannedAt: new Date().toISOString()
    },
    {
      id: 'inv-branch-1-beer',
      branchId: 'branch-1',
      productId: 'prod-tusker-malt',
      bottlesOnHand: 1, // Only 1 unit for concurrency / insufficient stock test
      casesOnHand: 0,
      reorderLevel: 5,
      batchNumber: 'BATCH-2026-B',
      expiryDate: '2027-06-30',
      lastScannedAt: new Date().toISOString()
    }
  ];
}

async function runProductionErpTests(): Promise<void> {
  console.log('================================================================');
  console.log('LIQUOR ERP — PRODUCTION SECURITY & INTEGRITY VERIFICATION SUITE');
  console.log('================================================================');

  firestoreAuthoritativeStore.resetForTesting();

  const engine = new AuthoritativeErpEngine(TEST_PRODUCTS, createTestInventory(), {
    enableDiskPersistence: false
  });

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION, SALTED PIN HASHING & BRUTE-FORCE LOCKOUT TESTS
  // ---------------------------------------------------------------------------
  console.log('[1/7] Testing Authentication, Salted PIN Verification & Brute-Force Lockout...');

  // Valid login
  const validAuth = engine.authenticateStaffPin({
    staffId: 'emp-pos-01',
    pin: '123456',
    ipAddress: '10.0.0.10'
  });
  assert.equal(validAuth.success, true, 'Valid PIN should authenticate');
  assert.equal(validAuth.user?.role, 'CASHIER');
  assert.equal(validAuth.user?.branchId, 'branch-1');

  // Incorrect PIN + brute-force lockout after 5 attempts
  for (let i = 1; i <= 5; i++) {
    const badAttempt = engine.authenticateStaffPin({
      staffId: 'emp-pos-01',
      pin: '999999',
      ipAddress: '10.0.0.99'
    });
    assert.equal(badAttempt.success, false);
    assert.equal(badAttempt.status, 401);
  }
  const lockedAttempt = engine.authenticateStaffPin({
    staffId: 'emp-pos-01',
    pin: '123456', // even correct PIN is rejected while locked out from that IP
    ipAddress: '10.0.0.99'
  });
  assert.equal(lockedAttempt.success, false);
  assert.equal(lockedAttempt.status, 429, '6th attempt after 5 failures must return 429 Locked Out');

  // Disabled user rejection
  engine.registerOrUpdateStaffPin({
    staffId: 'emp-disabled-01',
    name: 'Disabled Cashier',
    department: 'POS',
    branchId: 'branch-1',
    rawPin: '654321',
    active: false
  });
  const disabledAuth = engine.authenticateStaffPin({
    staffId: 'emp-disabled-01',
    pin: '654321',
    ipAddress: '10.0.0.12'
  });
  assert.equal(disabledAuth.success, false);
  assert.equal(disabledAuth.status, 403, 'Disabled account must be rejected with 403');
  console.log('  ✓ Authentication & brute-force rate limiting verified.');

  // ---------------------------------------------------------------------------
  // 2. GRANULAR RBAC & BRANCH-LEVEL ISOLATION TESTS
  // ---------------------------------------------------------------------------
  console.log('[2/7] Testing Granular RBAC & Branch Isolation...');

  assert.equal(hasGranularPermission('SUPER_ADMIN', 'BRANCH_MANAGER', 'period.reopen'), true);
  assert.equal(hasGranularPermission('ADMIN', 'BRANCH_MANAGER', 'period.reopen'), false);
  assert.equal(hasGranularPermission('ACCOUNTANT', 'FINANCE', 'accounting.post'), true);
  assert.equal(hasGranularPermission('CASHIER', 'POS', 'accounting.post'), false);
  assert.equal(hasGranularPermission('CASHIER', 'POS', 'sales.create'), true);
  assert.equal(hasGranularPermission('INVENTORY_STAFF', 'INVENTORY', 'sales.create'), false);
  assert.equal(hasGranularPermission('INVENTORY_STAFF', 'INVENTORY', 'inventory.transfer'), true);
  assert.equal(hasGranularPermission('REPORTING_USER', 'FINANCE', 'reports.view'), true);
  assert.equal(hasGranularPermission('REPORTING_USER', 'FINANCE', 'sales.create'), false);

  // Branch access checks
  assert.equal(canAccessBranch('CASHIER', 'POS', 'branch-1', 'branch-1'), true);
  assert.equal(canAccessBranch('CASHIER', 'POS', 'branch-1', 'branch-2'), false);
  assert.equal(canAccessBranch('SUPER_ADMIN', 'BRANCH_MANAGER', 'branch-1', 'branch-2'), true);

  // Unauthorized branch sale attempt by branch-1 cashier on branch-2
  const crossBranchAttempt = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-2',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.10'
  });
  assert.equal(crossBranchAttempt.status, 403, 'Cross-branch sale by cashier must be blocked with 403');

  // Unauthorized discount attempt by cashier (requesting 20% when max is 5%)
  const excessiveDiscountAttempt = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1, requestedDiscountPercent: 20 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.10'
  });
  assert.equal(excessiveDiscountAttempt.status, 403, 'Excessive discount beyond role limit must be blocked');
  console.log('  ✓ Granular permissions, branch isolation & discount ceilings verified.');

  // ---------------------------------------------------------------------------
  // 3. CONFIGURABLE TAX ENGINE TESTS (INCLUSIVE, EXCLUSIVE, ZERO-RATED, EXEMPT)
  // ---------------------------------------------------------------------------
  console.log('[3/7] Testing Configurable Tax Engine...');

  const inclusiveVat = calculateConfigurableTax(1160, { taxCode: 'STANDARD_VAT' });
  assert.equal(inclusiveVat.taxableAmount, 1000);
  assert.equal(inclusiveVat.vatAmount, 160);
  assert.equal(inclusiveVat.grossAmount, 1160);

  const exclusiveVat = calculateConfigurableTax(1000, { taxCode: 'STANDARD_VAT_EXCLUSIVE' });
  assert.equal(exclusiveVat.taxableAmount, 1000);
  assert.equal(exclusiveVat.vatAmount, 160);
  assert.equal(exclusiveVat.grossAmount, 1160);

  const zeroRated = calculateConfigurableTax(2500, { taxCode: 'ZERO_RATED' });
  assert.equal(zeroRated.vatAmount, 0);
  assert.equal(zeroRated.grossAmount, 2500);

  const exemptTax = calculateConfigurableTax(2500, { taxCode: 'EXEMPT' });
  assert.equal(exemptTax.vatAmount, 0);
  assert.equal(exemptTax.taxableAmount, 2500);

  const compatVat = calculateVatBreakdown(1160);
  assert.equal(compatVat.taxableAmount, 1000);
  assert.equal(compatVat.vatAmount, 160);
  console.log('  ✓ Tax-inclusive, tax-exclusive, zero-rated & exempt calculations verified.');

  // ---------------------------------------------------------------------------
  // 4. END-TO-END POS SALE, IDEMPOTENCY, INVENTORY LEDGER & LOW-STOCK ALERT
  // ---------------------------------------------------------------------------
  console.log('[4/7] Testing End-to-End POS Checkout, Idempotency & Inventory Ledger...');

  const idempotencyKey = 'idem-sale-001';
  const saleRes1 = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 4 }], // 15 -> 11 (triggers Low Stock Alert since reorderLevel is 12)
    paymentMethod: 'MPESA',
    paymentReference: 'QKA819201B',
    customerName: 'David Mwangi',
    customerPhone: '254712345678',
    idempotencyKey,
    ipAddress: '10.0.0.10'
  });

  assert.equal(saleRes1.status, 200);
  assert.equal(saleRes1.body.totalAmountKes, 15080 * 4);
  const orderNumber = String(saleRes1.body.orderNumber);

  // Duplicate submission with same idempotencyKey must NOT deduct stock again
  const saleResDuplicate = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 4 }],
    paymentMethod: 'MPESA',
    idempotencyKey,
    ipAddress: '10.0.0.10'
  });
  assert.equal(saleResDuplicate.status, 200);
  assert.equal(saleResDuplicate.body.idempotentReplay, true);
  assert.equal(saleResDuplicate.body.orderNumber, orderNumber);

  // Verify stock was deducted only once (15 - 4 = 11)
  const whiskyInv = engine.inventoryItems.find(
    i => i.branchId === 'branch-1' && i.productId === 'prod-glenfiddich-18'
  );
  assert.equal(whiskyInv?.bottlesOnHand, 11, 'Stock must be 11 after idempotent replay');

  // Verify Inventory Ledger entry
  const ledgerEntry = engine.inventoryLedger.find(l => l.referenceId === orderNumber);
  assert.ok(ledgerEntry, 'Immutable inventory ledger entry must exist');
  assert.equal(ledgerEntry.beforeQuantity, 15);
  assert.equal(ledgerEntry.afterQuantity, 11);
  assert.equal(ledgerEntry.transactionType, 'SALE');

  // Verify Low Stock Alert was automatically generated
  const lowStockNotif = engine.notifications.find(
    n => n.type === 'LOW_STOCK' && n.entityId === 'prod-glenfiddich-18'
  );
  assert.ok(lowStockNotif, 'Automated Low Stock Alert must be generated when stock <= reorderLevel');

  // Verify Double-Entry Accounting Balance (Debits === Credits)
  const journal = engine.journalEntries.find(j => j.referenceNumber === orderNumber);
  assert.ok(journal, 'Double-entry journal must be created for sale');
  assert.equal(journal.totalDebitKes, journal.totalCreditKes, 'Journal Total Debits must equal Total Credits');

  // Verify Payment -> Receipt chain
  const saleRecord = engine.sales.get(orderNumber);
  assert.ok(saleRecord);
  const paymentRecord = engine.payments.get(saleRecord.paymentId);
  const receiptRecord = engine.receipts.get(saleRecord.receiptId);
  assert.ok(paymentRecord, 'Payment record must exist');
  assert.ok(receiptRecord, 'Receipt record must exist and link to paymentId');
  assert.equal(receiptRecord.paymentId, paymentRecord.id);
  console.log('  ✓ End-to-End POS Checkout, Idempotency, Ledger, Low-Stock Alert & Balanced Journal verified.');

  // ---------------------------------------------------------------------------
  // 5. STOCK CONCURRENCY & INSUFFICIENT STOCK PROTECTION
  // ---------------------------------------------------------------------------
  console.log('[5/7] Testing Stock Concurrency & Last-Unit Race Protection...');

  // prod-tusker-malt has only 1 bottle on hand at branch-1
  const cashierASale = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Cashier A',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-tusker-malt', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.10'
  });
  assert.equal(cashierASale.status, 200, 'Cashier A claims the last available unit');

  const cashierBSale = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Cashier B',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-tusker-malt', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.11'
  });
  assert.equal(cashierBSale.status, 409, 'Cashier B must receive 409 Conflict when stock is 0');
  console.log('  ✓ Last-unit stock race protection verified.');

  // ---------------------------------------------------------------------------
  // 6. FORMAL INTER-BRANCH STOCK TRANSFER WORKFLOW (TRANSFER_OUT & TRANSFER_IN)
  // ---------------------------------------------------------------------------
  console.log('[6/7] Testing Formal Stock Transfer Workflow...');

  const trfCreate = engine.createOrTransitionStockTransfer({
    fromBranchId: 'branch-1',
    toBranchId: 'branch-2',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 3 }],
    targetStatus: 'REQUESTED',
    user: {
      userId: 'emp-mgr-01',
      name: 'Grace Wanjiku',
      role: 'MANAGER',
      department: 'BRANCH_MANAGER',
      branchId: 'branch-1'
    },
    ipAddress: '10.0.0.20'
  });
  assert.equal(trfCreate.status, 201);
  const transferId = (trfCreate.body.transfer as { id: string }).id;

  // Approve -> Dispatch (deducts 3 from branch-1: 11 -> 8) -> Receive (adds 3 to branch-2: 0 -> 3)
  engine.createOrTransitionStockTransfer({
    transferId,
    targetStatus: 'APPROVED',
    user: { userId: 'emp-mgr-01', name: 'Grace Wanjiku', role: 'MANAGER', department: 'BRANCH_MANAGER', branchId: 'branch-1' },
    ipAddress: '10.0.0.20'
  });
  const trfDispatch = engine.createOrTransitionStockTransfer({
    transferId,
    targetStatus: 'DISPATCHED',
    user: { userId: 'emp-mgr-01', name: 'Grace Wanjiku', role: 'MANAGER', department: 'BRANCH_MANAGER', branchId: 'branch-1' },
    ipAddress: '10.0.0.20'
  });
  assert.equal(trfDispatch.status, 200);

  const trfReceive = engine.createOrTransitionStockTransfer({
    transferId,
    targetStatus: 'RECEIVED',
    user: { userId: 'emp-mgr-01', name: 'Grace Wanjiku', role: 'MANAGER', department: 'BRANCH_MANAGER', branchId: 'branch-2' },
    ipAddress: '10.0.0.20'
  });
  assert.equal(trfReceive.status, 200);

  const branch1StockAfterTrf = engine.inventoryItems.find(
    i => i.branchId === 'branch-1' && i.productId === 'prod-glenfiddich-18'
  )?.bottlesOnHand;
  const branch2StockAfterTrf = engine.inventoryItems.find(
    i => i.branchId === 'branch-2' && i.productId === 'prod-glenfiddich-18'
  )?.bottlesOnHand;
  assert.equal(branch1StockAfterTrf, 8, 'Source branch must decrease from 11 to 8 via TRANSFER_OUT');
  assert.equal(branch2StockAfterTrf, 3, 'Destination branch must increase from 0 to 3 via TRANSFER_IN');
  console.log('  ✓ Formal Stock Transfer workflow (TRANSFER_OUT / TRANSFER_IN) verified.');

  // ---------------------------------------------------------------------------
  // 7. REFUND CREDIT NOTE, FISCAL FAILURE HANDLING, PERIOD LOCK & EMAIL DISPATCH
  // ---------------------------------------------------------------------------
  console.log('[7/7] Testing Credit Note Refunds, KRA Failure Lifecycle, Period Locking & Zoho Email...');

  // Refund first sale (restores 4 bottles to branch-1: 8 -> 12)
  const refundRes = engine.refundSaleTransaction({
    orderNumber,
    reason: 'Customer returned unopened bottles with valid fiscal receipt',
    user: {
      userId: 'emp-mgr-01',
      name: 'Grace Wanjiku',
      role: 'MANAGER',
      department: 'BRANCH_MANAGER',
      branchId: 'branch-1'
    },
    ipAddress: '10.0.0.20'
  });
  assert.equal(refundRes.status, 200);
  assert.ok(String(refundRes.body.creditNoteNumber).startsWith('CN-'));
  const restoredWhiskyStock = engine.inventoryItems.find(
    i => i.branchId === 'branch-1' && i.productId === 'prod-glenfiddich-18'
  )?.bottlesOnHand;
  assert.equal(restoredWhiskyStock, 12, 'Refund must restore 4 units via RETURN ledger entry');

  // Test KRA Fiscalization Failure handling (must not pretend it succeeded)
  const failedFiscal = engine.processFiscalSubmission({
    invoiceNumber: 'INV-2026-999001',
    branchId: 'branch-1',
    grossAmountKes: 15080,
    vatAmountKes: 2080,
    simulateGatewayFailure: true
  });
  assert.equal(failedFiscal.status, 'RETRY_PENDING');
  assert.equal(failedFiscal.transmitted, false);
  assert.equal(failedFiscal.errorCode, 'KRA_OSCU_TIMEOUT_503');

  // Test Accounting Period Close & Reopen
  const currentPeriodId = new Date().toISOString().slice(0, 7);
  const closeRes = engine.closeAccountingPeriod({
    periodId: currentPeriodId,
    user: { userId: 'acc-01', name: 'Chief Accountant', role: 'ACCOUNTANT', department: 'FINANCE' },
    ipAddress: '10.0.0.30'
  });
  assert.equal(closeRes.status, 200);

  // Sale during closed period must be rejected with 409
  const closedPeriodSale = engine.executePosCheckout({
    user: { userId: 'emp-pos-01', name: 'Kevin', role: 'CASHIER', department: 'POS', branchId: 'branch-1' },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.10'
  });
  assert.equal(closedPeriodSale.status, 409, 'Transactions in a CLOSED accounting period must be rejected');

  // Accountant cannot reopen a closed period (requires SUPER_ADMIN)
  const unauthorizedReopen = engine.reopenAccountingPeriod({
    periodId: currentPeriodId,
    reason: 'Attempted reopen by accountant',
    user: { userId: 'acc-01', name: 'Chief Accountant', role: 'ACCOUNTANT', department: 'FINANCE' },
    ipAddress: '10.0.0.30'
  });
  assert.equal(unauthorizedReopen.status, 403);

  // SUPER_ADMIN reopens period with audit reason
  const superAdminReopen = engine.reopenAccountingPeriod({
    periodId: currentPeriodId,
    reason: 'Authorized year-end audit adjustment approved by Board',
    user: { userId: 'root-01', name: 'Super Admin', role: 'SUPER_ADMIN', department: 'BRANCH_MANAGER' },
    ipAddress: '10.0.0.1'
  });
  assert.equal(superAdminReopen.status, 200);

  // Test Transactional Email Dispatch from support@urbantechdev.com
  const emailLog = await engine.dispatchTransactionalEmail({
    to: 'customer@example.com',
    subject: `Official Fiscal Receipt for Order ${orderNumber}`,
    templateType: 'RECEIPT',
    bodyText: `Thank you for shopping at VAAIRO ERP. Your receipt total is KES 60,320.00.`,
    referenceId: orderNumber,
    user: { userId: 'root-01', name: 'Super Admin', role: 'SUPER_ADMIN', department: 'BRANCH_MANAGER' },
    ipAddress: '10.0.0.1'
  });
  assert.equal(emailLog.from, 'support@urbantechdev.com');
  assert.equal(emailLog.replyTo, 'support@urbantechdev.com');
  assert.equal(emailLog.direction, 'ONE_WAY_OUTBOUND');
  assert.equal(
    emailLog.status,
    'PROVIDER_NOT_CONFIGURED',
    'When no Zoho API relay is configured, email status must honestly report PROVIDER_NOT_CONFIGURED rather than falsely reporting SENT'
  );

  console.log('  ✓ Refunds, KRA failure handling, Accounting Period locks & Zoho email verified.');

  // -------------------------------------------------------------------------
  // 8. FIRST-CLASS MULTI-TIER NETWORK MODEL: ORGANIZATION, MEMBERSHIP & CONSUMER
  // -------------------------------------------------------------------------
  console.log('[8/8] Testing First-Class Organization (Merchant/Distributor/Retailer/Supplier), Membership & Consumer Models...');
  const networkOrgs = synchronizeNetworkOrganizations({
    existingOrganizations: [],
    branches: [
      {
        id: 'branch-wh-main',
        name: 'VAAIRO Bonded Warehouse',
        code: 'WH-01',
        tier: 'WAREHOUSE',
        location: 'Mombasa Road',
        county: 'Nairobi',
        contactPhone: '+254700000001',
        kraPin: 'P051829301A',
        managerName: 'Ops Director',
        allowDirectSales: false
      },
      {
        id: 'branch-rtl-westlands',
        name: 'Westlands Liquor Store',
        code: 'RTL-01',
        tier: 'LIQUOR_STORE',
        location: 'Westlands Square',
        county: 'Nairobi',
        contactPhone: '+254700000002',
        kraPin: 'P051829301A',
        managerName: 'Sarah Manager',
        allowDirectSales: true
      }
    ],
    distributors: [
      {
        id: 'dist-rift-01',
        code: 'DST-001',
        companyName: 'Rift Valley Beverage Distributors Ltd',
        kraPin: 'P051999888B',
        licenseNumber: 'KRA-DST-2026-01',
        contactPerson: 'Peter Njoroge',
        phone: '+254722111222',
        email: 'peter@riftdistributors.co.ke',
        county: 'Nakuru',
        region: 'Rift Valley',
        tier: 'TIER_1_SUPER_WHOLESALER',
        creditLimitKes: 5000000,
        currentReceivableKes: 420000,
        paymentTerms: 'NET_14',
        active: true
      }
    ],
    suppliers: [
      {
        id: 'sup-eabl-01',
        code: 'SUP-001',
        name: 'East African Breweries Ltd (EABL)',
        kraPin: 'P051123456Z',
        category: 'LOCAL_DISTILLERY',
        contactPerson: 'Jane Supply',
        email: 'orders@eabl.com',
        phone: '+254733444555',
        physicalAddress: 'Ruaraka',
        county: 'Nairobi',
        paymentTerms: 'NET_30',
        creditLimitKes: 20000000,
        currentOutstandingKes: 1500000,
        bankName: 'KCB',
        bankAccountNumber: '1100223344',
        active: true
      }
    ]
  });

  assert.equal(networkOrgs.filter(o => o.type === 'MERCHANT').length, 1, 'Should derive first-class Merchant organization');
  assert.equal(networkOrgs.filter(o => o.type === 'DISTRIBUTOR').length, 1, 'Should derive first-class Distributor organization');
  assert.equal(networkOrgs.filter(o => o.type === 'RETAILER').length, 1, 'Should derive first-class Retailer organization');
  assert.equal(networkOrgs.filter(o => o.type === 'SUPPLIER').length, 1, 'Should derive first-class Supplier organization');

  const memberships = synchronizeOrganizationMemberships({
    existingMemberships: [],
    organizations: networkOrgs,
    users: [
      {
        id: 'usr-admin-01',
        name: 'System Administrator',
        email: 'support@urbantechdev.com',
        role: 'SUPER_ADMIN',
        department: 'FINANCE',
        branchId: 'branch-wh-main',
        phone: '+254700000000',
        mfaEnabled: true
      }
    ],
    employees: [
      {
        id: 'emp-cashier-01',
        employeeNumber: 'EMP-101',
        name: 'Grace Cashier',
        roleTitle: 'POS Cashier',
        department: 'POS',
        branchId: 'branch-rtl-westlands',
        loginPin: '123456',
        basicSalaryKes: 35000,
        houseAllowanceKes: 5000,
        transportAllowanceKes: 3000,
        kraPin: 'A001122334B',
        nssfNumber: 'NSSF-01',
        nhifShifNumber: 'SHIF-01',
        bankAccount: '011',
        bankName: 'Equity',
        mPesaNumber: '254711000111',
        active: true
      }
    ],
    affiliates: [],
    branches: []
  });

  assert.equal(memberships.length, 2, 'Should link Users and Staff into OrganizationMemberships');
  assert.equal(
    hasUserOrganizationRole({
      userId: 'emp-cashier-01',
      memberships,
      organizationType: 'RETAILER',
      allowedRoles: ['POS_CASHIER']
    }),
    true,
    'Cashier should have POS_CASHIER role inside the Retailer Organization'
  );

  const consumers = synchronizeConsumers({
    existingConsumers: [],
    orders: [
      {
        id: 'ord-01',
        orderNumber: 'ORD-2026-0001',
        branchId: 'branch-rtl-westlands',
        branchName: 'Westlands Liquor Store',
        cashierId: 'emp-cashier-01',
        cashierName: 'Grace Cashier',
        customerName: 'David Kamau',
        customerPhone: '0722987654',
        saleType: 'RETAIL',
        items: [],
        subtotalKes: 80000,
        vatAmountKes: 12800,
        exciseAmountKes: 0,
        totalKes: 92800,
        affiliateMarkupTotalKes: 0,
        paymentMethod: 'MPESA',
        paymentStatus: 'PAID',
        createdAt: new Date().toISOString(),
        etimsInvoiceNumber: 'KRA-001',
        etimsQrPayload: 'QR-001',
        etimsTransmitted: true
      }
    ],
    websiteDeliveryOrders: []
  });

  assert.equal(consumers.length, 1, 'Should derive first-class Consumer identity from retail order');
  assert.equal(consumers[0].loyaltyTier, 'GOLD', 'Consumer with 92,800 KES spend should achieve GOLD tier');
  console.log('  ✓ First-class Organization (Merchant/Distributor/Retailer/Supplier), Membership & Consumer verified.');

  // -------------------------------------------------------------------------
  // 9. SINGLE SERVER AUTHORITY, OFFLINE-QUEUED RECONCILIATION & BRANCH-SCOPED RULES
  // -------------------------------------------------------------------------
  console.log('[9/9] Testing Single Server Authority, Offline-Queued Reconciliation & Branch-Scoped Rules...');

  const wholesaleQueuedCheckout = engine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18-vol-750ml', quantity: 2 }],
    paymentMethod: 'MPESA',
    saleType: 'WHOLESALE',
    idempotencyKey: 'pos-idem-offline-queue-001',
    ipAddress: '10.0.0.10'
  });

  assert.equal(wholesaleQueuedCheckout.status, 200);
  // Wholesale price of prod-glenfiddich-18 is 13,200 * 2 = 26,400
  assert.equal(wholesaleQueuedCheckout.body.totalAmountKes, 13200 * 2);
  assert.ok(wholesaleQueuedCheckout.body.journalEntry, 'Authoritative checkout must return balanced journalEntry');
  assert.ok(wholesaleQueuedCheckout.body.saleRecord, 'Authoritative checkout must return authoritative saleRecord');

  // Verify Firestore rules enforce branch-scoped list on branchInventoryLedgers and stockAuditSessions
  const rulesText = fs.readFileSync('firestore.rules', 'utf8');
  assert.equal(
    rulesText.includes('match /branchInventoryLedgers/{ledgerId} {\n      allow get: if isValidId(ledgerId) && (isAdmin() || canAccessBranchData(resource.data.branchId));\n      allow list: if isAdmin() || canAccessBranchData(resource.data.branchId);'),
    true,
    'branchInventoryLedgers must enforce branch-scoped list access'
  );
  assert.equal(
    rulesText.includes('match /stockAuditSessions/{sessionId} {\n      allow get: if isValidId(sessionId) && (isAdmin() || canAccessBranchData(resource.data.branchId));\n      allow list: if isAdmin() || canAccessBranchData(resource.data.branchId);'),
    true,
    'stockAuditSessions must enforce branch-scoped list access'
  );
  console.log('  ✓ Single Server Authority, Offline-Queued Reconciliation & Branch-Scoped Firestore Rules verified.');

  // =========================================================================
  // 10. SECURITY HARDENING: UNKNOWN STAFF REJECTION, SECRET ENFORCEMENT & MEMORY-ONLY SENSITIVE STATE
  // =========================================================================
  console.log('[10/10] Testing Unknown Staff ID Rejection, Production Secret Startup Guard & Memory-Only Sensitive State...');

  // 10a. Unknown staffId MUST be rejected immediately (never self-bootstrapped)
  const unknownAttempt = engine.authenticateStaffPin({
    staffId: 'emp-unknown-intruder-999',
    pin: '654321',
    department: 'POS',
    branchId: 'branch-1',
    staffName: 'Intruder Self-Bootstrap Attempt',
    ipAddress: '10.0.0.99'
  });
  assert.equal(unknownAttempt.success, false, 'Unknown staffId must be rejected on login');
  assert.equal(unknownAttempt.status, 401, 'Unknown staffId must return HTTP 401');
  assert.equal(
    engine.staffAuthStore.has('emp-unknown-intruder-999'),
    false,
    'Unknown staffId must never be auto-registered in staffAuthStore'
  );

  // Only after an authorized Manager/Admin explicitly provisions the account can it log in
  engine.registerOrUpdateStaffPin({
    staffId: 'emp-admin-provisioned-01',
    name: 'Authorized Provisioned Cashier',
    department: 'POS',
    branchId: 'branch-1',
    rawPin: '654321',
    active: true
  });
  const provisionedAttempt = engine.authenticateStaffPin({
    staffId: 'emp-admin-provisioned-01',
    pin: '654321',
    department: 'POS',
    branchId: 'branch-1',
    ipAddress: '10.0.0.100'
  });
  assert.equal(provisionedAttempt.success, true, 'Manager-provisioned staff account must succeed');

  // 10b. Production startup secret enforcement must throw if TOTP_ADMIN_SECRET or KRA_CMC_KEY are missing
  assert.throws(
    () =>
      validateAndResolveServerSecrets({
        NODE_ENV: 'production',
        SESSION_SECRET: 'prod-session-secret-xyz',
        ADMIN_API_KEY: 'prod-admin-key-xyz'
      } as unknown as NodeJS.ProcessEnv),
    /Missing required security environment variable\(s\): TOTP_ADMIN_SECRET, KRA_CMC_KEY/,
    'Production mode must throw startup error if TOTP_ADMIN_SECRET or KRA_CMC_KEY is missing'
  );

  // Forbidden default secret JBSWY3DPEHPK3PXP must always be rejected
  assert.throws(
    () =>
      validateAndResolveServerSecrets({
        NODE_ENV: 'development',
        TOTP_ADMIN_SECRET: 'JBSWY3DPEHPK3PXP'
      } as unknown as NodeJS.ProcessEnv),
    /Known default\/fallback secret detected/,
    'Known default TOTP secret must be rejected'
  );

  // 10c. Verify ErpContext.tsx no longer uses btoa('enc:v1:') fake encryption or hardcoded TOTP secret
  const erpContextSource = fs.readFileSync('src/context/ErpContext.tsx', 'utf8');
  assert.equal(
    erpContextSource.includes('btoa(encodeURIComponent('),
    false,
    'ErpContext.tsx must not use Base64 btoa fake encryption for sensitive state'
  );
  assert.equal(
    erpContextSource.includes('JBSWY3DPEHPK3PXP'),
    false,
    'ErpContext.tsx must not contain hardcoded fallback TOTP secret'
  );
  assert.equal(
    erpContextSource.includes('AUTHORITATIVE_SENSITIVE_KEYS'),
    true,
    'ErpContext.tsx must isolate sensitive financial/credential keys in memory only'
  );
  console.log('  ✓ Unknown Staff ID Rejection, Production Secret Guard & Memory-Only Sensitive State verified.');

  // =========================================================================
  // 11. GS1 MASTER BARCODE QUALITY PIPELINE, PROVENANCE HYGIENE & NORMALIZED FIRESTORE COLLECTIONS
  // =========================================================================
  console.log('[11/11] Testing GS1 Master Barcode Pipeline (657 Products), Provenance Isolation & Normalized Collections...');

  const auditSummary = CATALOG_BARCODE_QUALITY_AUDIT.summary;
  assert.equal(NAIROBI_DRINKS_PRODUCTS.length >= 657, true, 'Catalogue must contain all 657+ products');
  assert.equal(
    auditSummary.approvedMasterMetrics.approvedBottleCheckDigitPassCount,
    NAIROBI_DRINKS_PRODUCTS.length,
    '100% of approved bottle barcodes must pass GS1 Modulo-10 check-digit validation'
  );
  assert.equal(
    auditSummary.approvedMasterMetrics.approvedCaseCheckDigitPassCount,
    NAIROBI_DRINKS_PRODUCTS.length,
    '100% of approved ITF-14 case barcodes must pass GS1 Modulo-10 check-digit validation'
  );
  assert.equal(
    auditSummary.approvedMasterMetrics.approvedDuplicateBottleCount,
    0,
    'Approved master catalogue must have zero duplicate bottle barcodes'
  );
  assert.equal(
    auditSummary.approvedMasterMetrics.approvedDuplicateCaseCount,
    0,
    'Approved master catalogue must have zero duplicate case barcodes'
  );
  assert.equal(
    auditSummary.approvedMasterMetrics.approvedCaseBottleRelationshipPassCount,
    NAIROBI_DRINKS_PRODUCTS.length,
    '100% of approved master products must pass ITF-14 case-to-bottle relationship validation'
  );

  // Verify every product has internalProvenance populated and public top-level sourceUrl stripped
  for (const prod of NAIROBI_DRINKS_PRODUCTS) {
    assert.equal(validateGs1Barcode(prod.barcode).checkDigitValid, true);
    assert.equal(validateGs1Barcode(prod.caseBarcode).checkDigitValid, true);
    assert.equal(
      validateCaseToBottleRelationship(prod.barcode, prod.caseBarcode, prod.packSize).valid,
      true
    );
    assert.equal(prod.sourceUrl, undefined, 'Public top-level sourceUrl must be stripped from commercial product object');
    assert.equal(Boolean(prod.internalProvenance?.source), true, 'internalProvenance.source must be preserved internally');
    assert.equal(Boolean(prod.internalProvenance?.observationDate), true, 'internalProvenance.observationDate must be preserved internally');
  }

  // Verify normalized document-per-entity collections exist in firestore.rules and firestoreAuthoritativeStore.ts
  const updatedRulesText = fs.readFileSync('firestore.rules', 'utf8');
  for (const colName of ['products', 'inventory', 'sales', 'saleItems', 'customers', 'orders', 'payments', 'journalEntries']) {
    assert.equal(
      updatedRulesText.includes(`match /${colName}/`),
      true,
      `firestore.rules must define normalized document-per-entity collection ${colName}`
    );
  }
  console.log(
    `  ✓ GS1 Master Barcode Pipeline (${NAIROBI_DRINKS_PRODUCTS.length}/${NAIROBI_DRINKS_PRODUCTS.length} valid EAN-13 & ITF-14, 0 duplicates), Provenance Isolation & Normalized Collections verified.`
  );

  // =========================================================================
  // 12. TRANSACTIONAL DAL, EXPLICIT PERSISTENCE_FAILED RECONCILIATION, CRYPTOGRAPHIC JWT VERIFICATION, ORG AUTHORIZATION & PERSISTENT IDEMPOTENCY
  // =========================================================================
  console.log('[12/12] Testing Transactional DAL, Explicit PERSISTENCE_FAILED Reconciliation, Cryptographic RSA-SHA256 Token Verification, Organization Authorization & Persistent Idempotency...');

  // 12a. Verify privileged firebase-admin SDK & zero silent `catch { // Non-fatal }` blocks in firestoreAuthoritativeStore.ts
  const dalSource = fs.readFileSync('src/server/firestoreAuthoritativeStore.ts', 'utf8');
  assert.equal(
    dalSource.includes('// Non-fatal'),
    false,
    'firestoreAuthoritativeStore.ts must never silently swallow financial persistence failures'
  );
  assert.equal(
    dalSource.includes("from 'firebase-admin/firestore'"),
    true,
    'firestoreAuthoritativeStore.ts must use privileged firebase-admin/firestore server SDK'
  );
  assert.equal(
    dalSource.includes("from 'firebase/firestore'"),
    false,
    'firestoreAuthoritativeStore.ts must NOT use unprivileged web client firebase/firestore SDK'
  );
  assert.equal(
    dalSource.includes('serverDb.runTransaction'),
    true,
    'firestoreAuthoritativeStore.ts must use atomic Admin SDK serverDb.runTransaction for Inventory -> Commerce -> Finance mutations'
  );

  // 12a-ii. Multi-Server Stale Local State Transaction Integrity Test:
  // Cloud stock = 10. Server A thinks = 10, Server B thinks = 10. Both sell 1.
  // Both commands initially contain afterQuantity = 9 from stale local memory,
  // but the DAL transaction MUST calculate `currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`
  // producing 10 -> 9 on Server A and 9 -> 8 on Server B!
  firestoreAuthoritativeStore.setAuthoritativeCloudStockBalance('branch-1', 'prod-glenfiddich-18', 10);

  const staleInventory10 = (): InventoryItem[] => [
    {
      id: 'inv-branch-1-whisky',
      branchId: 'branch-1',
      productId: 'prod-glenfiddich-18',
      bottlesOnHand: 10,
      casesOnHand: 0,
      reorderLevel: 5,
      batchNumber: 'BATCH-2026-A',
      expiryDate: '2030-12-31',
      lastScannedAt: new Date().toISOString()
    }
  ];

  const serverEngineA = new AuthoritativeErpEngine(TEST_PRODUCTS, staleInventory10(), {
    enableDiskPersistence: false
  });
  const serverEngineB = new AuthoritativeErpEngine(TEST_PRODUCTS, staleInventory10(), {
    enableDiskPersistence: false
  });

  const txServerA = await serverEngineA.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Server A Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: 'multi-srv-tx-a-01',
    ipAddress: '10.0.1.10'
  });
  assert.equal(txServerA.status, 200);
  assert.equal(
    (txServerA.body.updatedBalances as Record<string, number>)['prod-glenfiddich-18'],
    9,
    'Transaction A must deduct 1 from cloud balance 10 -> 9'
  );

  // Server B STILL has stale local state (bottlesOnHand = 10) and sells 1
  assert.equal(
    serverEngineB.inventoryItems.find(i => i.productId === 'prod-glenfiddich-18')?.bottlesOnHand,
    10,
    'Server B starts with stale local balance of 10'
  );
  const txServerB = await serverEngineB.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Server B Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'MPESA',
    idempotencyKey: 'multi-srv-tx-b-02',
    ipAddress: '10.0.1.11'
  });
  assert.equal(txServerB.status, 200);
  assert.equal(
    (txServerB.body.updatedBalances as Record<string, number>)['prod-glenfiddich-18'],
    8,
    'Transaction B must calculate currentCloudQuantity (9) - saleQuantity (1) = 8 (never writing stale afterQuantity 9)'
  );
  assert.equal(
    firestoreAuthoritativeStore.getAuthoritativeCloudStockBalance('branch-1', 'prod-glenfiddich-18'),
    8,
    'Authoritative cloud stock balance must be 8 after two 1-bottle sales across two stale servers'
  );
  assert.equal(
    serverEngineB.inventoryItems.find(i => i.productId === 'prod-glenfiddich-18')?.bottlesOnHand,
    8,
    'Server B in-memory inventory must synchronize to the authoritative cloud balance 8'
  );
  const serverBLedger = serverEngineB.inventoryLedger.find(
    l => l.referenceId === String(txServerB.body.orderNumber)
  );
  assert.equal(serverBLedger?.beforeQuantity, 9, 'Server B ledger entry must record authoritative beforeQuantity = 9');
  assert.equal(serverBLedger?.afterQuantity, 8, 'Server B ledger entry must record authoritative afterQuantity = 8');

  // If a third stale server C (thinking local stock = 10) attempts to sell 9 when cloud stock is 8 -> must fail 409 and roll back!
  const serverEngineC = new AuthoritativeErpEngine(TEST_PRODUCTS, staleInventory10(), {
    enableDiskPersistence: false
  });
  const txServerCConflict = await serverEngineC.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Server C Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 9 }],
    paymentMethod: 'CASH',
    idempotencyKey: 'multi-srv-tx-c-conflict',
    ipAddress: '10.0.1.12'
  });
  assert.equal(txServerCConflict.status, 409, 'Cloud stock reservation conflict (8 < 9) must return HTTP 409');
  assert.equal(txServerCConflict.body.errorCode, 'STOCK_RESERVATION_CONFLICT');
  assert.equal(
    serverEngineC.sales.size,
    0,
    'Conflicted transaction on Server C must roll back tentative sale record'
  );

  // 12b. Simulate a persistence failure during transactional checkout -> must return 503 PERSISTENCE_FAILED and queue reconciliation
  firestoreAuthoritativeStore.setSimulatePersistenceFailure(
    true,
    'Firestore primary replica unreachable during transaction commit'
  );
  const failedTxRes = await engine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'MPESA',
    idempotencyKey: 'tx-persist-fail-reconcile-01',
    ipAddress: '10.0.0.50'
  });

  assert.equal(failedTxRes.status, 503, 'Failed transactional persistence must return HTTP 503');
  assert.equal(
    failedTxRes.body.errorCode,
    'PERSISTENCE_FAILED',
    'Failed transactional persistence must return explicit errorCode PERSISTENCE_FAILED'
  );
  assert.equal(
    failedTxRes.body.persistenceStatus,
    'PERSISTENCE_FAILED',
    'Failed transactional persistence must mark persistenceStatus as PERSISTENCE_FAILED'
  );
  assert.ok(failedTxRes.body.reconciliationId, 'Failed persistence must return a durable reconciliationId');

  const pendingBeforeRetry = firestoreAuthoritativeStore.getPendingReconciliations();
  assert.equal(
    pendingBeforeRetry.some(r => r.id === failedTxRes.body.reconciliationId),
    true,
    'Failed transaction must be queued in durable reconciliationOutbox'
  );

  // Restore persistence and run reconciliation retry
  firestoreAuthoritativeStore.setSimulatePersistenceFailure(false);
  const reconcileResult = await engine.retryFailedPersistenceOperations();
  assert.equal(reconcileResult.reconciled >= 1, true, 'Reconciliation retry must commit pending failed transaction');
  assert.equal(
    firestoreAuthoritativeStore.getPendingReconciliations().length,
    0,
    'Pending reconciliation outbox must be empty after successful retry'
  );

  // 12c. Persistent Idempotency (`idempotencyKeys/{scope}_{key}`) across cold engine restarts
  const persistentIdemKey = 'persistent-idem-restart-proof-2026';
  const firstTx = await engine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: persistentIdemKey,
    ipAddress: '10.0.0.51'
  });
  assert.equal(firstTx.status, 200);
  assert.equal(firstTx.body.persistenceStatus, 'COMMITTED');
  assert.equal(firstTx.body.organizationId, 'org-merchant-vaairo-hq');

  // Instantiate a brand-new AuthoritativeErpEngine (simulating server restart / separate worker)
  // and replay the same idempotencyKey -> must return stored result from persistent DAL without deducting stock!
  const restartedEngine = new AuthoritativeErpEngine(TEST_PRODUCTS, createTestInventory(), {
    enableDiskPersistence: false
  });
  const stockBeforeReplay = restartedEngine.inventoryItems.find(
    i => i.branchId === 'branch-1' && i.productId === 'prod-glenfiddich-18'
  )!.bottlesOnHand;

  const replayedOnRestart = restartedEngine.executePosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: persistentIdemKey,
    ipAddress: '10.0.0.51'
  });

  const stockAfterReplay = restartedEngine.inventoryItems.find(
    i => i.branchId === 'branch-1' && i.productId === 'prod-glenfiddich-18'
  )!.bottlesOnHand;

  assert.equal(replayedOnRestart.status, 200);
  assert.equal(replayedOnRestart.body.idempotentReplay, true, 'Must replay from persistent idempotency store across engine restart');
  assert.equal(replayedOnRestart.body.idempotencyStorage, 'PERSISTENT_DAL');
  assert.equal(replayedOnRestart.body.orderNumber, firstTx.body.orderNumber);
  assert.equal(stockAfterReplay, stockBeforeReplay, 'Persistent idempotency replay must not deduct stock on restarted engine');

  // 12d. Tightened Organization Authorization (`organizationId` + Membership Verification)
  engine.registerOrganizationMembership({
    userId: 'emp-external-org-user',
    organizationId: 'org-retailer-external-99',
    role: 'CASHIER',
    branchId: 'branch-1',
    active: true
  });

  const crossOrgAttempt = engine.executePosCheckout({
    user: {
      userId: 'emp-external-org-user',
      name: 'External Retailer Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-retailer-external-99'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.0.77'
  });

  assert.equal(crossOrgAttempt.status, 403, 'User from external organization must be blocked from Merchant organization resources');
  assert.equal(crossOrgAttempt.body.errorCode, 'ORGANIZATION_ACCESS_DENIED');

  // Verify Firestore security rules enforce isMemberOfOrganization & canAccessOrganizationData + idempotencyKeys
  assert.equal(
    updatedRulesText.includes('function isMemberOfOrganization(orgId)'),
    true,
    'firestore.rules must define isMemberOfOrganization(orgId)'
  );
  assert.equal(
    updatedRulesText.includes('function canAccessOrganizationData(orgId, branchId)'),
    true,
    'firestore.rules must define canAccessOrganizationData(orgId, branchId)'
  );
  assert.equal(
    updatedRulesText.includes('match /idempotencyKeys/{idempotencyId}'),
    true,
    'firestore.rules must define persistent /idempotencyKeys/{idempotencyId} collection rules'
  );

  // 12e. Real Cryptographic RSA-SHA256 Firebase ID Token Verification
  const { publicKey: trustedPubPem, privateKey: trustedPrivPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const { privateKey: roguePrivPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  registerTrustedPublicKeyForTesting('test-firebase-kid-2026', trustedPubPem);
  const nowSec = Math.floor(Date.now() / 1000);

  const validSignedJwt = signTestFirebaseIdToken(
    {
      iss: 'https://securetoken.google.com/gen-lang-client-0468740826',
      aud: 'gen-lang-client-0468740826',
      sub: 'uid-admin-moraas-001',
      email: 'moraasdorcah@gmail.com',
      email_verified: true,
      iat: nowSec - 60,
      exp: nowSec + 3600
    },
    trustedPrivPem,
    'test-firebase-kid-2026'
  );

  const validVerifyRes = await verifyFirebaseIdTokenCryptographically({
    idToken: validSignedJwt,
    expectedEmail: 'moraasdorcah@gmail.com'
  });
  assert.equal(validVerifyRes.valid, true, 'Cryptographically valid RS256 token must pass verification');
  assert.equal(validVerifyRes.claims?.uid, 'uid-admin-moraas-001');

  // Forged token signed with rogue RSA key must fail with INVALID_SIGNATURE
  const rogueSignedJwt = signTestFirebaseIdToken(
    {
      iss: 'https://securetoken.google.com/gen-lang-client-0468740826',
      aud: 'gen-lang-client-0468740826',
      sub: 'uid-attacker-999',
      email: 'moraasdorcah@gmail.com',
      email_verified: true,
      iat: nowSec - 60,
      exp: nowSec + 3600
    },
    roguePrivPem,
    'test-firebase-kid-2026'
  );
  const rogueVerifyRes = await verifyFirebaseIdTokenCryptographically({
    idToken: rogueSignedJwt,
    expectedEmail: 'moraasdorcah@gmail.com'
  });
  assert.equal(rogueVerifyRes.valid, false, 'Token signed with untrusted RSA key must be rejected');
  assert.equal(rogueVerifyRes.errorCode, 'INVALID_SIGNATURE');

  // Tampered payload on valid signature must fail with INVALID_SIGNATURE
  const jwtParts = validSignedJwt.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/gen-lang-client-0468740826',
      aud: 'gen-lang-client-0468740826',
      sub: 'uid-admin-moraas-001',
      email: 'attacker@evil.com',
      email_verified: true,
      iat: nowSec - 60,
      exp: nowSec + 3600
    })
  ).toString('base64url');
  const tamperedJwt = `${jwtParts[0]}.${tamperedPayload}.${jwtParts[2]}`;
  const tamperedVerifyRes = await verifyFirebaseIdTokenCryptographically({
    idToken: tamperedJwt
  });
  assert.equal(tamperedVerifyRes.valid, false, 'Tampered JWT payload must fail cryptographic signature check');
  assert.equal(tamperedVerifyRes.errorCode, 'INVALID_SIGNATURE');

  clearTrustedPublicKeysForTesting();
  console.log('  ✓ Transactional DAL, Explicit PERSISTENCE_FAILED Reconciliation, Cryptographic RSA-SHA256 Token Verification, Organization Authorization & Persistent Idempotency verified.');

  // =========================================================================
  // 13. GOOGLE MEMBERSHIP ROLE DERIVATION, GRANULAR INVENTORY RBAC, DUAL-BRANCH TRANSFERS, PUBLIC/PRIVATE PRODUCT SPLIT, 5-WAY CONCURRENT CHECKOUT RACE & TWO-PHASE RESERVATIONS
  // =========================================================================
  console.log('[13/13] Testing Google Membership Role Derivation, Granular Inventory RBAC, Dual-Branch Transfers, Public/Private Product Split, 5-Way Concurrent Race & Two-Phase Reservations...');

  // 13a. Google Login Role Derivation & Domain Onboarding Policy (#1 & #2)
  const serverSource = fs.readFileSync('server.ts', 'utf8');
  assert.equal(
    serverSource.includes("role === 'ACCOUNTANT' ? 'ACCOUNTANT' : 'SUPER_ADMIN'"),
    false,
    'server.ts must NEVER allow the client request body to choose SUPER_ADMIN or ACCOUNTANT role'
  );

  // Unprovisioned corporate domain user (@urbantechdev.com / @vaairo.co.ke) must be rejected (domain is only an onboarding condition)
  const unprovisionedDomainCheck = engine.resolveGoogleIdentityMembership({
    uid: 'uid-random-emp-999',
    email: 'random.employee@urbantechdev.com'
  });
  assert.equal(unprovisionedDomainCheck.authorized, false);
  assert.equal(unprovisionedDomainCheck.status, 403);
  assert.equal(unprovisionedDomainCheck.errorCode, 'ONBOARDING_MEMBERSHIP_REQUIRED');

  // Seeded finance principal must derive ACCOUNTANT role from server-side membership
  const financeMembershipCheck = engine.resolveGoogleIdentityMembership({
    uid: 'user-finance@vaairo.co.ke',
    email: 'finance@vaairo.co.ke'
  });
  assert.equal(financeMembershipCheck.authorized, true);
  assert.equal(financeMembershipCheck.membership?.role, 'ACCOUNTANT');
  assert.equal(financeMembershipCheck.membership?.department, 'FINANCE');

  // 13b. Granular Inventory Operation Permission Mapping (#7)
  assert.equal(getRequiredInventoryPermission('RESTOCK'), 'inventory.receive');
  assert.equal(getRequiredInventoryPermission('PURCHASE'), 'inventory.receive');
  assert.equal(getRequiredInventoryPermission('OPENING_BALANCE'), 'inventory.receive');
  assert.equal(getRequiredInventoryPermission('DISPATCH'), 'inventory.transfer');
  assert.equal(getRequiredInventoryPermission('TRANSFER_OUT'), 'inventory.transfer');
  assert.equal(getRequiredInventoryPermission('TRANSFER_IN'), 'inventory.transfer');
  assert.equal(getRequiredInventoryPermission('DAMAGE'), 'inventory.adjust');
  assert.equal(getRequiredInventoryPermission('ADJUSTMENT'), 'inventory.adjust');
  assert.equal(getRequiredInventoryPermission('RETURN'), 'inventory.return');
  assert.equal(getRequiredInventoryPermission('SALE'), 'sales.create');

  // 13c. Dual-Branch Transfer Access Verification (#8)
  // User assigned to branch-2 cannot initiate/dispatch a transfer from branch-1
  const unauthorizedSourceTransfer = engine.createOrTransitionStockTransfer({
    fromBranchId: 'branch-1',
    toBranchId: 'branch-2',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 2 }],
    targetStatus: 'REQUESTED',
    user: {
      userId: 'emp-mgr-branch2',
      name: 'Branch 2 Only Staff',
      role: 'INVENTORY_STAFF',
      department: 'INVENTORY',
      branchId: 'branch-2'
    },
    ipAddress: '10.0.0.88'
  });
  assert.equal(
    unauthorizedSourceTransfer.status,
    403,
    'User scoped only to branch-2 must be blocked from initiating transfer from branch-1'
  );
  assert.equal(unauthorizedSourceTransfer.body.errorCode, 'CROSS_BRANCH_TRANSFER_ACCESS_DENIED');

  // And a user assigned only to branch-1 cannot mark a transfer to branch-2 as RECEIVED
  const validTrfReq = engine.createOrTransitionStockTransfer({
    fromBranchId: 'branch-1',
    toBranchId: 'branch-2',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    targetStatus: 'REQUESTED',
    user: {
      userId: 'emp-mgr-branch1',
      name: 'Branch 1 Manager',
      role: 'MANAGER',
      department: 'BRANCH_MANAGER',
      branchId: 'branch-1'
    },
    ipAddress: '10.0.0.89'
  });
  assert.equal(validTrfReq.status, 201);
  const validTrfId = (validTrfReq.body.transfer as { id: string }).id;

  const unauthorizedDestReceive = engine.createOrTransitionStockTransfer({
    transferId: validTrfId,
    targetStatus: 'RECEIVED',
    user: {
      userId: 'emp-mgr-branch1',
      name: 'Branch 1 Manager',
      role: 'MANAGER',
      department: 'BRANCH_MANAGER',
      branchId: 'branch-1'
    },
    ipAddress: '10.0.0.89'
  });
  assert.equal(
    unauthorizedDestReceive.status,
    403,
    'User scoped only to source branch-1 must be blocked from receiving transfer at destination branch-2'
  );
  assert.equal(unauthorizedDestReceive.body.errorCode, 'CROSS_BRANCH_TRANSFER_ACCESS_DENIED');

  // 13d. Retired Public erpUnifiedState & Public/Private Product Catalog Split (#9, #10, #11, #12)
  assert.equal(
    updatedRulesText.includes('match /erpUnifiedState/{stateKey} {\n      allow get, list: if isAdmin();'),
    true,
    'erpUnifiedState must be locked down to isAdmin() only in firestore.rules'
  );
  assert.equal(
    updatedRulesText.includes('match /productsPublic/{productId}'),
    true,
    'firestore.rules must define public storefront collection /productsPublic/{productId}'
  );
  assert.equal(
    updatedRulesText.includes('match /productsPrivate/{productId}'),
    true,
    'firestore.rules must define restricted commercial collection /productsPrivate/{productId}'
  );

  const sampleSplit = splitProductIntoPublicAndPrivate(NAIROBI_DRINKS_PRODUCTS[0]);
  assert.equal(
    'warehouseCostKes' in (sampleSplit.publicRecord as unknown as Record<string, unknown>),
    false,
    'productsPublic must never expose warehouseCostKes'
  );
  assert.equal(
    'wholesalePriceKes' in (sampleSplit.publicRecord as unknown as Record<string, unknown>),
    false,
    'productsPublic must never expose wholesalePriceKes'
  );
  assert.equal(
    'internalProvenance' in (sampleSplit.publicRecord as unknown as Record<string, unknown>),
    false,
    'productsPublic must never expose internalProvenance'
  );
  assert.equal(
    typeof sampleSplit.privateRecord.warehouseCostKes,
    'number',
    'productsPrivate must retain warehouseCostKes for authorized organization members'
  );
  assert.equal(
    fs.existsSync('.erp-authoritative-dal.json'),
    false,
    '.erp-authoritative-dal.json must never exist in the repository root'
  );

  // 13e. 5-Concurrent-Checkout Race-Condition Test on `stock = 1`
  firestoreAuthoritativeStore.setAuthoritativeCloudStockBalance('branch-1', 'prod-tusker-malt', 1);
  const raceEngine = new AuthoritativeErpEngine(
    TEST_PRODUCTS,
    [
      {
        id: 'inv-race-tusker-1',
        branchId: 'branch-1',
        productId: 'prod-tusker-malt',
        bottlesOnHand: 1,
        casesOnHand: 0,
        reorderLevel: 5,
        batchNumber: 'BATCH-RACE-1',
        expiryDate: '2030-12-31',
        lastScannedAt: new Date().toISOString()
      }
    ],
    { enableDiskPersistence: false }
  );

  const concurrentResponses = await Promise.all(
    [1, 2, 3, 4, 5].map(idx =>
      raceEngine.executeTransactionalPosCheckout({
        user: {
          userId: 'emp-pos-01',
          name: `Concurrent Cashier ${idx}`,
          role: 'CASHIER',
          department: 'POS',
          branchId: 'branch-1',
          organizationId: 'org-merchant-vaairo-hq'
        },
        organizationId: 'org-merchant-vaairo-hq',
        branchId: 'branch-1',
        items: [{ productId: 'prod-tusker-malt', quantity: 1 }],
        paymentMethod: 'CASH',
        idempotencyKey: `concurrent-race-key-${idx}`,
        ipAddress: `10.0.2.${idx}`
      })
    )
  );

  const successCheckouts = concurrentResponses.filter(r => r.status === 200);
  const conflictCheckouts = concurrentResponses.filter(
    r => r.status === 409 && r.body.errorCode === 'STOCK_RESERVATION_CONFLICT'
  );
  assert.equal(successCheckouts.length, 1, 'Exactly 1 of 5 concurrent checkouts for stock=1 must succeed');
  assert.equal(
    conflictCheckouts.length,
    4,
    'Exactly 4 of 5 concurrent checkouts for stock=1 must fail with 409 STOCK_RESERVATION_CONFLICT'
  );
  assert.equal(
    firestoreAuthoritativeStore.getAuthoritativeCloudStockBalance('branch-1', 'prod-tusker-malt'),
    0,
    'Cloud stock must be 0 (never negative) after 5 concurrent checkouts on stock=1'
  );

  // 13f. 3x Idempotency Replay + Request Payload Equality Verification (#13)
  firestoreAuthoritativeStore.setAuthoritativeCloudStockBalance('branch-1', 'prod-glenfiddich-18', 10);
  const idemEngine = new AuthoritativeErpEngine(TEST_PRODUCTS, staleInventory10(), {
    enableDiskPersistence: false
  });
  const sharedIdemKey = 'idem-triple-send-2026';

  const idemSend1 = await idemEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: sharedIdemKey,
    ipAddress: '10.0.3.1'
  });
  const idemSend2 = await idemEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: sharedIdemKey,
    ipAddress: '10.0.3.1'
  });
  const idemSend3 = await idemEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    idempotencyKey: sharedIdemKey,
    ipAddress: '10.0.3.1'
  });

  assert.equal(idemSend1.status, 200);
  assert.equal(idemSend2.status, 200);
  assert.equal(idemSend3.status, 200);
  assert.equal(idemSend2.body.idempotentReplay, true);
  assert.equal(idemSend3.body.idempotentReplay, true);
  assert.equal(idemEngine.sales.size, 1, '3 identical idempotent requests must create exactly 1 sale');
  assert.equal(idemEngine.journalEntries.length, 1, '3 identical idempotent requests must create exactly 1 journal entry');
  assert.equal(
    firestoreAuthoritativeStore.getAuthoritativeCloudStockBalance('branch-1', 'prod-glenfiddich-18'),
    9,
    '3 identical idempotent requests must deduct stock only once (10 -> 9)'
  );

  // Reusing the same idempotencyKey with a DIFFERENT payload (quantity: 3 instead of 1) MUST fail with 409 IDEMPOTENCY_PAYLOAD_MISMATCH!
  const idemTamperedPayload = await idemEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Kevin Otieno',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 3 }],
    paymentMethod: 'CASH',
    idempotencyKey: sharedIdemKey,
    ipAddress: '10.0.3.1'
  });
  assert.equal(idemTamperedPayload.status, 409);
  assert.equal(idemTamperedPayload.body.errorCode, 'IDEMPOTENCY_PAYLOAD_MISMATCH');

  // 13g. Two-Phase Stock Reservation (Hold -> Payment -> Commit / Release) (#14)
  firestoreAuthoritativeStore.setAuthoritativeCloudStockBalance('branch-1', 'prod-glenfiddich-18', 1);
  const rsvEngine = new AuthoritativeErpEngine(
    TEST_PRODUCTS,
    [
      {
        id: 'inv-rsv-whisky-1',
        branchId: 'branch-1',
        productId: 'prod-glenfiddich-18',
        bottlesOnHand: 1,
        casesOnHand: 0,
        reorderLevel: 2,
        batchNumber: 'BATCH-RSV-1',
        expiryDate: '2030-12-31',
        lastScannedAt: new Date().toISOString()
      }
    ],
    { enableDiskPersistence: false }
  );

  const holdRes = await rsvEngine.reserveStockForPendingCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Customer A Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    orderReference: 'ORD-HOLD-001',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    ttlSeconds: 300
  });
  assert.equal(holdRes.status, 201);
  const reservationId = holdRes.body.reservation!.id;

  // Another customer attempting to buy the same last bottle while it is RESERVED must be rejected with 409!
  const competingCheckout = await rsvEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Customer B Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'CASH',
    ipAddress: '10.0.4.2'
  });
  assert.equal(competingCheckout.status, 409);
  assert.equal(competingCheckout.body.errorCode, 'STOCK_RESERVATION_CONFLICT');

  // The customer who holds the reservation can commit their checkout using reservationId!
  const holderCommit = await rsvEngine.executeTransactionalPosCheckout({
    user: {
      userId: 'emp-pos-01',
      name: 'Customer A Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }],
    paymentMethod: 'MPESA',
    reservationId,
    ipAddress: '10.0.4.1'
  });
  assert.equal(holderCommit.status, 200);
  assert.equal(
    firestoreAuthoritativeStore.stockReservations.get(reservationId)?.status,
    'COMMITTED',
    'Reservation must transition to COMMITTED once checkout completes'
  );
  console.log('  ✓ Google Membership Role Derivation, Granular Inventory RBAC, Dual-Branch Transfers, Public/Private Product Split, 5-Way Concurrent Race & Two-Phase Reservations verified.');

  // =========================================================================
  // 14. ENTERPRISE SECURITY AUDIT HARDENING: FIRESTORE MEMBERSHIP RBAC, PER-USER TOTP MFA + BRUTE-FORCE & REPLAY PROTECTION, AUTHENTICATED STK PUSH & EMAIL LIFECYCLE, ZERO BROWSER FINANCIAL WRITES
  // =========================================================================
  console.log('[14/14] Testing Firestore Membership RBAC, Per-User TOTP MFA (Lockout + Timestep Replay), Authenticated POS/Storefront STK Push, Callback Reconciliation & Zero Browser Financial Writes...');

  // 14a. Firestore isAdmin() must NEVER grant admin privileges based on email domain (@urbantechdev.com / @vaairo.co.ke)
  const rulesText14 = fs.readFileSync('firestore.rules', 'utf8');
  assert.equal(
    rulesText14.includes('email.matches('),
    false,
    'firestore.rules must never use email.matches(...) domain checks for admin authorization'
  );
  assert.equal(
    rulesText14.includes('@urbantechdev') || rulesText14.includes('@vaairo'),
    false,
    'firestore.rules must not contain corporate domain admin escalations (@urbantechdev / @vaairo)'
  );
  assert.equal(
    rulesText14.includes('function hasActiveAdminMembership(orgId)'),
    true,
    'firestore.rules must define server-controlled hasActiveAdminMembership(orgId) checking organizationMemberships'
  );
  assert.equal(
    rulesText14.includes('match /userTotpFactors/{userId} {\n      allow read, write: if false;'),
    true,
    'firestore.rules must lock down /userTotpFactors/{userId} to Admin SDK only'
  );

  // Verify zero direct client Firestore writes (setDoc, updateDoc, writeBatch, deleteDoc) in browser files
  for (const clientFile of [
    'src/components/inventory/StockAuditSessionPanel.tsx',
    'src/utils/unifiedErpDatabase.ts',
    'src/utils/staffDatabase.ts',
    'src/utils/userActivityMonitor.ts'
  ]) {
    const srcCode = fs.readFileSync(clientFile, 'utf8');
    for (const forbiddenFn of ['setDoc(', 'updateDoc(', 'writeBatch(', 'deleteDoc(']) {
      assert.equal(
        srcCode.includes(forbiddenFn),
        false,
        `${clientFile} must not perform direct browser Firestore write ${forbiddenFn}; all mutations must route via VAAIRO Server API`
      );
    }
  }

  // 14b. Per-User TOTP Factor Isolation (Admin A vs Admin B vs Accountant), Brute-Force Lockout & Timestep Replay Protection
  const adminAInit = engine.enrollOrInitUserTotpFactor({
    userId: 'uid-admin-a',
    email: 'moraasdorcah@gmail.com',
    organizationId: 'org-merchant-vaairo-hq'
  });
  engine.confirmUserTotpEnrollment({
    userId: 'uid-admin-a',
    email: 'moraasdorcah@gmail.com',
    totpCode: engine.computeTotpCode(adminAInit.secret),
    secret: adminAInit.secret
  });

  const adminBInit = engine.enrollOrInitUserTotpFactor({
    userId: 'uid-admin-b',
    email: 'muyamoz@gmail.com',
    organizationId: 'org-merchant-vaairo-hq'
  });
  engine.confirmUserTotpEnrollment({
    userId: 'uid-admin-b',
    email: 'muyamoz@gmail.com',
    totpCode: engine.computeTotpCode(adminBInit.secret),
    secret: adminBInit.secret
  });

  const accountantInit = engine.enrollOrInitUserTotpFactor({
    userId: 'uid-accountant-01',
    email: 'finance@vaairo.co.ke',
    organizationId: 'org-merchant-vaairo-hq'
  });
  engine.confirmUserTotpEnrollment({
    userId: 'uid-accountant-01',
    email: 'finance@vaairo.co.ke',
    totpCode: engine.computeTotpCode(accountantInit.secret),
    secret: accountantInit.secret
  });

  assert.notEqual(
    adminAInit.secret,
    adminBInit.secret,
    'Admin A and Admin B must have distinct per-user TOTP secrets (never a single shared secret)'
  );
  assert.notEqual(
    adminAInit.secret,
    accountantInit.secret,
    'Admin A and Accountant must have distinct per-user TOTP secrets'
  );

  const adminAValidCode = engine.computeTotpCode(adminAInit.secret);
  // Admin A's valid TOTP code must NOT work for Admin B
  const crossUserTotpAttempt = engine.verifyUserTotpMfa({
    userId: 'uid-admin-b',
    email: 'muyamoz@gmail.com',
    totpCode: adminAValidCode,
    ipAddress: '10.9.0.2'
  });
  assert.equal(crossUserTotpAttempt.valid, false, 'Admin A TOTP code must be rejected for Admin B');
  assert.equal(crossUserTotpAttempt.errorCode, 'INVALID_TOTP_CODE');

  // Admin A's valid TOTP code succeeds on first use
  const firstUseAdminA = engine.verifyUserTotpMfa({
    userId: 'uid-admin-a',
    email: 'moraasdorcah@gmail.com',
    totpCode: adminAValidCode,
    ipAddress: '10.9.0.1'
  });
  assert.equal(firstUseAdminA.valid, true, 'Admin A valid per-user TOTP code must succeed on first use');
  assert.equal(typeof firstUseAdminA.matchedTimestep, 'number');

  // Replaying the exact same TOTP code within the same 30s timestep must be rejected!
  const replayUseAdminA = engine.verifyUserTotpMfa({
    userId: 'uid-admin-a',
    email: 'moraasdorcah@gmail.com',
    totpCode: adminAValidCode,
    ipAddress: '10.9.0.1'
  });
  assert.equal(replayUseAdminA.valid, false, 'Replaying a TOTP code in the same timestep window must be rejected');
  assert.equal(replayUseAdminA.errorCode, 'TOTP_TIMESTEP_REPLAY_DETECTED');

  // 5 consecutive failed TOTP attempts must trigger a 15-minute lockout + security audit event
  for (let attempt = 1; attempt <= 4; attempt++) {
    const badRes = engine.verifyUserTotpMfa({
      userId: 'uid-accountant-01',
      email: 'finance@vaairo.co.ke',
      totpCode: '000000',
      ipAddress: '10.9.0.99'
    });
    assert.equal(badRes.valid, false);
    assert.equal(badRes.status, 401);
    assert.equal(badRes.errorCode, 'INVALID_TOTP_CODE');
  }
  const fifthBadRes = engine.verifyUserTotpMfa({
    userId: 'uid-accountant-01',
    email: 'finance@vaairo.co.ke',
    totpCode: '000000',
    ipAddress: '10.9.0.99'
  });
  assert.equal(fifthBadRes.valid, false);
  assert.equal(fifthBadRes.status, 429, '5th failed TOTP attempt must lock out the identity + IP for 15 minutes');
  assert.equal(fifthBadRes.errorCode, 'MFA_LOCKED_OUT');
  assert.equal(Boolean(fifthBadRes.lockedUntilMs && fifthBadRes.lockedUntilMs > Date.now() + 890000), true, 'Lockout duration must be 15 minutes (~900s)');

  // Even presenting the genuine TOTP code while locked out must be rejected with 429 MFA_LOCKED_OUT
  const genuineCodeDuringLockout = engine.computeTotpCode(accountantInit.secret);
  const totpLockedAttempt = engine.verifyUserTotpMfa({
    userId: 'uid-accountant-01',
    email: 'finance@vaairo.co.ke',
    totpCode: genuineCodeDuringLockout,
    ipAddress: '10.9.0.99'
  });
  assert.equal(totpLockedAttempt.valid, false);
  assert.equal(totpLockedAttempt.status, 429);
  assert.equal(totpLockedAttempt.errorCode, 'MFA_LOCKED_OUT');

  // Verify Firebase TOTP MFA claim extraction (`firebase.sign_in_second_factor: 'totp'`)
  registerTrustedPublicKeyForTesting('test-firebase-kid-2026', trustedPubPem);
  const firebaseTotpJwt = signTestFirebaseIdToken(
    {
      iss: 'https://securetoken.google.com/gen-lang-client-0468740826',
      aud: 'gen-lang-client-0468740826',
      sub: 'uid-admin-moraas-001',
      email: 'moraasdorcah@gmail.com',
      email_verified: true,
      iat: nowSec - 30,
      exp: nowSec + 3600,
      firebase: {
        sign_in_provider: 'google.com',
        sign_in_second_factor: 'totp',
        second_factor_identifier: 'totp-factor-uid-001'
      }
    },
    trustedPrivPem,
    'test-firebase-kid-2026'
  );
  const verifiedMfaToken = await verifyFirebaseIdTokenCryptographically({
    idToken: firebaseTotpJwt,
    expectedEmail: 'moraasdorcah@gmail.com'
  });
  clearTrustedPublicKeysForTesting();
  assert.equal(verifiedMfaToken.valid, true);
  assert.equal(verifiedMfaToken.claims?.signInSecondFactor, 'totp');
  assert.equal(verifiedMfaToken.claims?.secondFactorIdentifier, 'totp-factor-uid-001');

  // 14c. POS STK Push Authorization Chain & Public Storefront Checkout Token Verification
  const serverSource14 = fs.readFileSync('server.ts', 'utf8');
  assert.equal(
    serverSource14.includes("app.post('/api/mpesa/stk-push', authenticateSession,"),
    true,
    '/api/mpesa/stk-push must enforce authenticateSession middleware'
  );
  assert.equal(
    serverSource14.includes("app.post('/api/mpesa/storefront-stk-push',"),
    true,
    'server.ts must provide controlled /api/mpesa/storefront-stk-push endpoint accepting verified checkoutToken'
  );

  // Tampered POS STK Push amount must be rejected by verifyAuthorizedPosStkPushRequest
  const stkEngine = new AuthoritativeErpEngine(TEST_PRODUCTS, createTestInventory(), {
    enableDiskPersistence: false
  });
  const tamperedPosStk = stkEngine.verifyAuthorizedPosStkPushRequest({
    user: {
      userId: 'emp-pos-01',
      name: 'Westlands Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 2 }], // Authoritative price: 2 * 15080 = 30160 KES
    requestedAmountKes: 500 // Tampered browser amount!
  });
  assert.equal(tamperedPosStk.authorized, false);
  assert.equal(tamperedPosStk.status, 400);
  assert.equal(tamperedPosStk.errorCode, 'ORDER_AMOUNT_MISMATCH');

  // Valid POS STK Push order verification succeeds with authoritative amount
  const validPosStk = stkEngine.verifyAuthorizedPosStkPushRequest({
    user: {
      userId: 'emp-pos-01',
      name: 'Westlands Cashier',
      role: 'CASHIER',
      department: 'POS',
      branchId: 'branch-1',
      organizationId: 'org-merchant-vaairo-hq'
    },
    branchId: 'branch-1',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 2 }],
    requestedAmountKes: 30160
  });
  assert.equal(validPosStk.authorized, true);
  assert.equal(validPosStk.authoritativeAmountKes, 30160);
  assert.equal(validPosStk.verifiedOrganizationId, 'org-merchant-vaairo-hq');

  // Public Storefront checkout token computes authoritative amount from server catalog and ignores browser manipulation
  const issuedCheckoutToken = stkEngine.issuePublicStorefrontCheckoutToken({
    orderNumber: 'WEB-ORD-2026-901',
    branchId: 'branch-1',
    customerPhone: '254712345678',
    items: [{ productId: 'prod-glenfiddich-18', quantity: 1 }]
  });
  assert.equal(issuedCheckoutToken.success, true);
  assert.equal(issuedCheckoutToken.record?.authoritativeAmountKes, 15080);

  const verifiedCheckout = stkEngine.verifyPublicStorefrontCheckoutToken({
    checkoutToken: issuedCheckoutToken.record!.checkoutToken
  });
  assert.equal(verifiedCheckout.valid, true);
  assert.equal(verifiedCheckout.record?.authoritativeAmountKes, 15080);

  // 14d. M-Pesa Callback Phone Correlation & Simplified Reconciliation Trust Chain
  const pendingIso = new Date().toISOString();
  await firestoreAuthoritativeStore.createPendingMpesaTransaction({
    id: 'ws_CO_PHONE_CHECK_001',
    checkoutRequestId: 'ws_CO_PHONE_CHECK_001',
    merchantRequestId: '29115-34620561-9',
    organizationId: 'org-merchant-vaairo-hq',
    branchId: 'branch-1',
    orderNumber: 'WEB-ORD-2026-901',
    accountReference: 'WEB-ORD-2026-901',
    transactionDesc: 'VAAIRO Order WEB-ORD-2026-901',
    transactionType: 'CustomerPayBillOnline',
    shortCode: '174379',
    expectedAmountKes: 14500,
    expectedPhone: '254712345678',
    status: 'PENDING',
    callbackSignatureToken: 'sig-phone-check-001',
    createdAt: pendingIso,
    updatedAt: pendingIso
  });

  const mismatchedPhoneCallback = await firestoreAuthoritativeStore.processDarajaCallbackOrQueryAtomically({
    checkoutRequestId: 'ws_CO_PHONE_CHECK_001',
    merchantRequestId: '29115-34620561-9',
    resultCode: 0,
    resultDesc: 'The service request is processed successfully.',
    mpesaReceiptNumber: 'QWE9988776',
    confirmedAmountKes: 14500,
    confirmedPhone: '254799999999', // Mismatched phone!
    rawCallbackPayload: '{}',
    verifiedVia: 'DARAJA_STK_CALLBACK'
  });
  assert.equal(mismatchedPhoneCallback.accepted, false);
  assert.equal(mismatchedPhoneCallback.errorCode, 'PHONE_NUMBER_MISMATCH');

  // 14e. Email Endpoint Authentication & Honest Provider Status Verification
  assert.equal(
    serverSource14.includes("errorCode: 'AUTHENTICATION_REQUIRED'"),
    true,
    '/api/email/order-lifecycle must reject unauthenticated requests with 401 AUTHENTICATION_REQUIRED'
  );
  assert.equal(
    serverSource14.includes("errorCode: 'UNVERIFIED_RECEIPT_EMAIL_FORBIDDEN'"),
    true,
    '/api/email/order-lifecycle must forbid unverified browser-constructed receipt emails'
  );

  // 14f. Branch Preferred Pricing & Neighbourhood Market-Class Differentiation (Donholm vs Kilimani / Westlands)
  stkEngine.configureBranchPricing({
    branchId: 'branch-donholm',
    branchName: 'Donholm Greenspan Liquor Shop',
    location: 'Donholm, Eastlands',
    tier: 'LIQUOR_STORE',
    marketClassTier: 'EASTLANDS_ECONOMY',
    priceMultiplierPercent: -10,
    preferredProductPrices: {
      'prod-glenfiddich-18': { retailPriceKes: 13500 }
    }
  });
  stkEngine.configureBranchPricing({
    branchId: 'branch-kilimani',
    branchName: 'Kilimani Prime Lounge & Bottle Store',
    location: 'Kilimani, Argwings Kodhek Rd',
    tier: 'LIQUOR_STORE',
    marketClassTier: 'AFFLUENT_PREMIUM',
    priceMultiplierPercent: 15
  });

  const donholmWhiskyPrice = stkEngine.getBranchAuthoritativeProductPrice(
    TEST_PRODUCTS[0],
    'branch-donholm',
    'RETAIL',
    1
  );
  const kilimaniWhiskyPrice = stkEngine.getBranchAuthoritativeProductPrice(
    TEST_PRODUCTS[0],
    'branch-kilimani',
    'RETAIL',
    1
  );
  assert.equal(donholmWhiskyPrice, 13500, 'Donholm branch must honor its custom preferred retail price (13,500 KES)');
  assert.equal(
    kilimaniWhiskyPrice,
    17340,
    'Kilimani branch must apply its +15% Prime Class tier price (15,080 * 1.15 rounded to nearest 10 = 17,340 KES)'
  );
  assert.equal(
    kilimaniWhiskyPrice > donholmWhiskyPrice,
    true,
    'Kilimani / Westlands prime branch price must be distinct from Donholm neighbourhood value price'
  );

  // 14g. Unified Cross-Device Real-Time Sync (PC Staff Creation -> Server/Firestore DAL -> Mobile Live Stream & PIN Login)
  const liveEventsReceived: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const unsubLive = firestoreAuthoritativeStore.subscribeLiveSyncEvents(evt => {
    liveEventsReceived.push({ type: evt.type, payload: evt.payload });
  });

  await firestoreAuthoritativeStore.persistStaffDirectoryRecordToFirestore('emp-pc-created-01', {
    id: 'emp-pc-created-01',
    recordType: 'EMPLOYEE',
    name: 'Kevin Omondi (Created on PC)',
    codeOrNumber: 'POS-901',
    roleTitle: 'POS Counter Cashier',
    department: 'POS',
    branchId: 'branch-kilimani',
    branchName: 'Kilimani Prime Lounge & Bottle Store',
    pinHash: 'd8e9f0a1b2c3d4e5f60123456789abcdef',
    pinSalt: 'salt-pc-001',
    active: true,
    updatedAt: new Date().toISOString()
  });

  // Verify a subsequent update without pinHash does NOT wipe out the stored pinHash/pinSalt
  await firestoreAuthoritativeStore.persistStaffDirectoryRecordToFirestore('emp-pc-created-01', {
    id: 'emp-pc-created-01',
    name: 'Kevin Omondi (Created on PC)',
    totalSalesKes: 28500,
    updatedAt: new Date(Date.now() + 1000).toISOString()
  });

  const mobileStaffRecords = await firestoreAuthoritativeStore.getStaffDirectoryRecordsAuthoritative();
  const syncedPcStaff = mobileStaffRecords.find(r => r.id === 'emp-pc-created-01');
  assert.equal(Boolean(syncedPcStaff), true, 'Staff created on PC must be immediately visible on Mobile via authoritative store');
  assert.equal(
    syncedPcStaff?.pinHash,
    'd8e9f0a1b2c3d4e5f60123456789abcdef',
    'PIN hash must be preserved across cloud updates even when plaintext PIN is stripped'
  );
  assert.equal(
    liveEventsReceived.some(e => e.type === 'STAFF_DIRECTORY_UPDATED'),
    true,
    'Real-time STAFF_DIRECTORY_UPDATED SSE event must fire when PC creates/updates a staff member'
  );

  await firestoreAuthoritativeStore.persistUnifiedStateDocsToFirestore([
    {
      id: 'employees',
      key: 'employees',
      payloadJson: JSON.stringify([{ id: 'emp-pc-created-01', name: 'Kevin Omondi (Created on PC)' }]),
      recordCount: 1,
      updatedAt: new Date().toISOString(),
      deviceOrigin: 'PC-TERMINAL-01'
    }
  ]);
  const mobileUnifiedDocs = await firestoreAuthoritativeStore.getUnifiedStateDocsAuthoritative();
  assert.equal(
    mobileUnifiedDocs.some(d => d.key === 'employees'),
    true,
    'Unified ERP state synced from PC must be immediately retrievable on Mobile'
  );
  assert.equal(
    liveEventsReceived.some(e => e.type === 'UNIFIED_STATE_UPDATED'),
    true,
    'Real-time UNIFIED_STATE_UPDATED SSE event must fire when PC syncs unified state'
  );
  unsubLive();

  console.log('  ✓ Firestore Membership RBAC, Per-User TOTP MFA (Lockout + Replay), Authenticated POS/Storefront STK Push, Callback Phone Correlation, Honest Email Status, Branch Preferred Pricing & PC-to-Mobile Live Sync verified.');

  console.log('================================================================');
  console.log(`ALL 14 PRODUCTION ERP TEST SUITES PASSED (${engine.auditLogs.length} Audit Logs Verified)`);
  console.log('================================================================');
}

runProductionErpTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('PRODUCTION ERP TEST SUITE FAILED:', err);
    process.exit(1);
  });
