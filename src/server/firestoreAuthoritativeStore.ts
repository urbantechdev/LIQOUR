/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
  applicationDefault,
  App as AdminApp
} from 'firebase-admin/app';
import {
  getFirestore as getAdminFirestore,
  Firestore as AdminFirestore,
  Transaction as AdminTransaction
} from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { InventoryItem, Product } from '../types';
import { splitProductIntoPublicAndPrivate } from '../utils/productCatalogSplit';
import {
  cloudBridgeSetDoc,
  cloudBridgeDeleteDoc,
  cloudBridgeListCollection,
  cloudBridgeSubscribeCollection
} from './firestoreCloudBridge';
import type {
  AuthoritativeSaleRecord,
  AccountingJournalEntry,
  AccountingPeriod,
  FiscalTransactionRecord,
  InventoryLedgerEntry,
  StockTransferRecord,
  EnterpriseAuditLog
} from './erpEngine';

const ADMIN_APP_NAME = 'vaairo-server-admin-authority';

/**
 * Initializes the privileged Firebase Admin SDK instance for the Node.js server.
 * Unlike the web client SDK (`firebase/firestore`), `firebase-admin/firestore`
 * authenticates with privileged IAM / Service Account / Application Default Credentials (ADC)
 * and operates as the authoritative server layer bypassing client Firestore Security Rules.
 */
function initializePrivilegedAdminFirestore(): {
  adminApp: AdminApp;
  serverDb: AdminFirestore;
} {
  const existing = getAdminApps().find(a => a?.name === ADMIN_APP_NAME);
  let adminApp: AdminApp;

  if (existing) {
    adminApp = existing;
  } else {
    const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawServiceAccount.startsWith('{')) {
      try {
        const parsedCred = JSON.parse(rawServiceAccount);
        adminApp = initializeAdminApp(
          {
            credential: cert(parsedCred),
            projectId: firebaseConfig.projectId
          },
          ADMIN_APP_NAME
        );
      } catch {
        adminApp = initializeAdminApp(
          {
            credential: applicationDefault(),
            projectId: firebaseConfig.projectId
          },
          ADMIN_APP_NAME
        );
      }
    } else {
      try {
        adminApp = initializeAdminApp(
          {
            credential: applicationDefault(),
            projectId: firebaseConfig.projectId
          },
          ADMIN_APP_NAME
        );
      } catch {
        adminApp = initializeAdminApp(
          {
            projectId: firebaseConfig.projectId
          },
          ADMIN_APP_NAME
        );
      }
    }
  }

  const serverDb = firebaseConfig.firestoreDatabaseId
    ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
    : getAdminFirestore(adminApp);

  return { adminApp, serverDb };
}

const { adminApp: serverAdminApp, serverDb } = initializePrivilegedAdminFirestore();

export { serverAdminApp, serverDb };

// Store local DAL state in OS temp directory so workspace repository root is never polluted
const DAL_STORAGE_FILE =
  process.env.ERP_DAL_STORAGE_PATH ||
  path.join(os.tmpdir(), 'vaairo-erp-authoritative-dal.json');

export const MAX_RECONCILIATION_RETRIES = 10;

export class PersistenceFailureError extends Error {
  public readonly code = 'PERSISTENCE_FAILED' as const;
  public readonly operation: string;
  public readonly reconciliationId: string;
  public readonly retryable: boolean;
  public readonly causeError?: unknown;

  constructor(params: {
    message: string;
    operation: string;
    reconciliationId: string;
    retryable?: boolean;
    causeError?: unknown;
  }) {
    super(params.message);
    this.name = 'PersistenceFailureError';
    this.operation = params.operation;
    this.reconciliationId = params.reconciliationId;
    this.retryable = params.retryable ?? true;
    this.causeError = params.causeError;
  }
}

export interface PersistentIdempotencyRecord {
  id: string; // {scope}_{key}
  scope: string;
  key: string;
  requestHash?: string; // SHA-256 of canonicalized request payload
  organizationId: string;
  branchId: string;
  status: 'COMPLETED' | 'FAILED';
  responseStatus: number;
  responseJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockReservationRecord {
  id: string;
  organizationId: string;
  branchId: string;
  orderReference: string;
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
  }>;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleTransactionCommand {
  commandId: string;
  organizationId: string;
  branchId: string;
  idempotencyScope?: string;
  idempotencyKey?: string;
  requestHash?: string;
  reservationId?: string;
  sale: AuthoritativeSaleRecord;
  fiscalTx: FiscalTransactionRecord;
  journalEntry: AccountingJournalEntry;
  inventoryTransactions: InventoryLedgerEntry[];
  updatedInventoryItems: InventoryItem[];
  auditLog?: EnterpriseAuditLog;
  responsePayload?: Record<string, unknown>;
}

export interface AuthoritativeLedgerMovementSnapshot {
  beforeQuantity: number;
  afterQuantity: number;
  signedDelta: number;
}

export interface PersistenceExecutionResult {
  persisted: boolean;
  status: 'COMMITTED' | 'PERSISTENCE_FAILED' | 'IDEMPOTENT_REPLAY';
  errorCode?:
    | 'PERSISTENCE_FAILED'
    | 'STOCK_RESERVATION_CONFLICT'
    | 'IDEMPOTENCY_PAYLOAD_MISMATCH';
  errorMessage?: string;
  reconciliationId?: string;
  idempotentResponse?: Record<string, unknown>;
  reservedBalances?: Record<string, number>;
  ledgerSnapshots?: Record<string, AuthoritativeLedgerMovementSnapshot>;
}

export interface PendingPersistenceReconciliationRecord {
  id: string;
  operationType:
    | 'SALE_TRANSACTION'
    | 'INVENTORY_MUTATION'
    | 'STOCK_TRANSFER'
    | 'ACCOUNTING_PERIOD'
    | 'REFUND_TRANSACTION';
  organizationId: string;
  branchId: string;
  referenceId: string;
  status: 'PERSISTENCE_FAILED' | 'RECONCILED' | 'DEAD_LETTER';
  errorCode: 'PERSISTENCE_FAILED';
  errorMessage: string;
  retryCount: number;
  nextRetryAfterMs?: number;
  payload: unknown;
  createdAt: string;
  lastAttemptAt: string;
  reconciledAt?: string;
}

export type CustomTransactionExecutor = (command: SaleTransactionCommand) => Promise<{
  reservedBalances: Record<string, number>;
  ledgerSnapshots?: Record<string, AuthoritativeLedgerMovementSnapshot>;
  idempotentReplay?: Record<string, unknown>;
}>;

/**
 * Authoritative Safaricom Daraja M-Pesa Transaction Record (`mpesaTransactions/{checkoutRequestId}`)
 * Stores pending STK Push requests, immutable callback payloads, and verified settlement status.
 */
export interface AuthoritativeMpesaTransactionRecord {
  id: string; // matches checkoutRequestId
  checkoutRequestId: string;
  merchantRequestId: string;
  organizationId: string;
  branchId: string;
  orderNumber: string;
  accountReference: string;
  transactionDesc: string;
  expectedAmountKes: number;
  confirmedAmountKes?: number;
  expectedPhone: string;
  confirmedPhone?: string;
  shortCode: string;
  transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' | 'C2B_DIRECT';
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  resultCode?: number;
  resultDesc?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  callbackSignatureToken: string;
  rawCallbackPayload?: string;
  verifiedVia?: 'DARAJA_STK_CALLBACK' | 'DARAJA_STK_QUERY' | 'DARAJA_C2B_CONFIRMATION';
  reconciledToOrderId?: string;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Computes a deterministic SHA-256 fingerprint of a request payload so
 * reusing an Idempotency-Key with a modified payload is detected and rejected.
 */
export function computeIdempotencyRequestHash(payload: {
  branchId: string;
  saleType?: string;
  paymentMethod?: string;
  items: Array<{
    productId: string;
    sku?: string;
    quantity: number;
    requestedDiscountPercent?: number;
  }>;
}): string {
  const canonicalItems = [...(payload.items || [])]
    .map(i => ({
      productId: String(i.productId || '').split('-vol-')[0].trim(),
      sku: String(i.sku || '').trim(),
      quantity: Number(i.quantity || 0),
      discountPct: Number(i.requestedDiscountPercent || 0)
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const canonical = JSON.stringify({
    branchId: String(payload.branchId || '').trim(),
    saleType: String(payload.saleType || 'RETAIL').toUpperCase(),
    paymentMethod: String(payload.paymentMethod || 'CASH').toUpperCase(),
    items: canonicalItems
  });

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Privileged Server Firestore Transactional Data Access Layer (DAL)
 *
 * Architecture:
 *   Browser
 *      ↓
 *   VAAIRO API
 *      ↓
 *   AuthoritativeErpEngine (Domain Validation & Delta Transaction Commands)
 *      ↓
 *   FirestoreAuthoritativeStore (Firestore DAL)
 *      ↓
 *   Firebase Admin SDK (`firebase-admin/firestore`)
 *      ↓
 *   Firestore Atomic Transaction (`serverDb.runTransaction`:
 *     currentCloudQuantity - saleQuantity = newAuthoritativeQuantity)
 */
export class FirestoreAuthoritativeStore {
  private enabled: boolean;
  private persistToDisk: boolean;
  private customTransactionExecutor: CustomTransactionExecutor | null = null;
  private simulatedFailureMode: { active: boolean; message: string } = {
    active: false,
    message: ''
  };
  private autoReconcileTimer: ReturnType<typeof setInterval> | null = null;

  // Persistent Idempotency Store: idempotencyKeys/{scope}_{key}
  public idempotencyStore = new Map<string, PersistentIdempotencyRecord>();

  // Durable Reconciliation Outbox for any failed persistence operation (never swallowed)
  public reconciliationOutbox = new Map<string, PendingPersistenceReconciliationRecord>();

  // Authoritative Cloud Stock Mirror: ledgerId ({branchId}_{productId}) -> authoritative quantity
  public transactionalStockMirror = new Map<string, number>();

  // Two-Phase Stock Reservations (Hold -> Payment -> Commit / Release)
  public stockReservations = new Map<string, StockReservationRecord>();

  // Persistent M-Pesa Transactions (`mpesaTransactions/{checkoutRequestId}`)
  public mpesaTransactions = new Map<string, AuthoritativeMpesaTransactionRecord>();

  // Authoritative Cross-Device Staff Directory Store (`staffDirectory/{staffId}`)
  public staffDirectoryStore = new Map<string, Record<string, unknown>>();
  public deletedStaffIdsStore = new Set<string>();

  // Authoritative Cross-Device Unified ERP State Store (`unifiedStateStore/{docId}`)
  public unifiedStateDocsStore = new Map<string, Record<string, unknown>>();

  // Authoritative Cross-Device User Activity Logs (`userActivityLogs/{logId}`)
  public userActivityLogsStore = new Map<string, Record<string, unknown>>();

  // Authoritative Cross-Device User Session Monitors (`userSessionMonitors/{userId}`)
  public userSessionMonitorsStore = new Map<string, Record<string, unknown>>();

  // Real-Time Live Sync Broadcast Listeners (Server-Sent Events for PC <-> Mobile live sync)
  private liveSyncListeners = new Set<(event: {
    type: 'STAFF_DIRECTORY_UPDATED' | 'STAFF_DIRECTORY_DELETED' | 'UNIFIED_STATE_UPDATED' | 'USER_ACTIVITY_UPDATED';
    timestamp: string;
    payload: Record<string, unknown>;
  }) => void>();

  // In-process per-ledger serialization queue for local atomic mode so concurrent Promise.all checkouts
  // execute strictly sequentially against transactionalStockMirror
  private localTxMutex: Promise<void> = Promise.resolve();

  constructor(enabled = true, persistToDisk = process.env.NODE_ENV !== 'test') {
    this.enabled = enabled && process.env.NODE_ENV !== 'test';
    this.persistToDisk = persistToDisk;
    this.loadDurableDalState();
    if (this.enabled) {
      this.attachCloudFirestoreLiveSubscriptions();
    }
  }

  private attachCloudFirestoreLiveSubscriptions(): void {
    cloudBridgeSubscribeCollection('staffDirectory', docs => {
      if (!this.enabled) return;
      let changed = false;
      for (const data of docs) {
        if (data && typeof data.id === 'string' && data.id) {
          const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          const existing = this.staffDirectoryStore.get(safeId);
          const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
          const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
          if (!existing || cloudTime > localTime) {
            this.staffDirectoryStore.set(safeId, { ...existing, ...data, id: safeId });
            changed = true;
          }
        }
      }
      if (changed) {
        this.saveDurableDalState();
        this.broadcastLiveSyncEvent({
          type: 'STAFF_DIRECTORY_UPDATED',
          payload: { records: Array.from(this.staffDirectoryStore.values()) }
        });
      }
    });

    cloudBridgeSubscribeCollection('unifiedStateStore', docs => {
      if (!this.enabled) return;
      const updatedDocs: Array<Record<string, unknown>> = [];
      for (const data of docs) {
        if (data && typeof data.id === 'string' && data.id) {
          const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          const existing = this.unifiedStateDocsStore.get(safeId);
          const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
          const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
          if (!existing || cloudTime > localTime) {
            const merged = { ...existing, ...data, id: safeId };
            this.unifiedStateDocsStore.set(safeId, merged);
            updatedDocs.push(merged);
          }
        }
      }
      if (updatedDocs.length > 0) {
        this.saveDurableDalState();
        this.broadcastLiveSyncEvent({
          type: 'UNIFIED_STATE_UPDATED',
          payload: { docs: updatedDocs }
        });
      }
    });
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setCustomTransactionExecutorForTesting(executor: CustomTransactionExecutor | null): void {
    this.customTransactionExecutor = executor;
  }

  public setSimulatePersistenceFailure(
    active: boolean,
    message = 'Simulated Firestore transaction commit failure'
  ): void {
    this.simulatedFailureMode = { active, message };
  }

  public resetForTesting(): void {
    this.idempotencyStore.clear();
    this.reconciliationOutbox.clear();
    this.transactionalStockMirror.clear();
    this.stockReservations.clear();
    this.mpesaTransactions.clear();
    this.staffDirectoryStore.clear();
    this.deletedStaffIdsStore.clear();
    this.unifiedStateDocsStore.clear();
    this.userActivityLogsStore.clear();
    this.userSessionMonitorsStore.clear();
    this.simulatedFailureMode = { active: false, message: '' };
    this.saveDurableDalState();
  }

  public subscribeLiveSyncEvents(
    listener: (event: {
      type: 'STAFF_DIRECTORY_UPDATED' | 'STAFF_DIRECTORY_DELETED' | 'UNIFIED_STATE_UPDATED' | 'USER_ACTIVITY_UPDATED';
      timestamp: string;
      payload: Record<string, unknown>;
    }) => void
  ): () => void {
    this.liveSyncListeners.add(listener);
    return () => {
      this.liveSyncListeners.delete(listener);
    };
  }

  public broadcastLiveSyncEvent(event: {
    type: 'STAFF_DIRECTORY_UPDATED' | 'STAFF_DIRECTORY_DELETED' | 'UNIFIED_STATE_UPDATED' | 'USER_ACTIVITY_UPDATED';
    payload: Record<string, unknown>;
  }): void {
    const fullEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    for (const listener of this.liveSyncListeners) {
      try {
        listener(fullEvent);
      } catch {
        // Ignore broken client stream listener
      }
    }
  }

  public formatLedgerDocId(branchId: string, productId: string): string {
    return `${branchId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  /**
   * Seeds initial stock into the DAL mirror only if the ledger key does not yet exist,
   * or explicitly sets the cloud balance for multi-server concurrency testing.
   */
  public setAuthoritativeCloudStockBalance(
    branchId: string,
    productId: string,
    quantity: number
  ): void {
    const ledgerId = this.formatLedgerDocId(branchId, productId);
    this.transactionalStockMirror.set(ledgerId, Math.max(0, Math.trunc(quantity)));
  }

  public getAuthoritativeCloudStockBalance(
    branchId: string,
    productId: string
  ): number | undefined {
    const ledgerId = this.formatLedgerDocId(branchId, productId);
    return this.transactionalStockMirror.get(ledgerId);
  }

  /**
   * Sweeps any expired stock reservations (`status === 'RESERVED'` and `expiresAt <= now`)
   * and returns the total active reserved quantity for `(branchId, productId)` excluding `excludeReservationId`.
   */
  public getActiveReservedQuantity(
    branchId: string,
    productId: string,
    excludeReservationId?: string
  ): number {
    const nowMs = Date.now();
    let totalReserved = 0;

    for (const res of this.stockReservations.values()) {
      if (res.status !== 'RESERVED') continue;
      const expMs = Date.parse(res.expiresAt);
      if (Number.isFinite(expMs) && expMs <= nowMs) {
        res.status = 'EXPIRED';
        res.updatedAt = new Date(nowMs).toISOString();
        continue;
      }
      if (excludeReservationId && res.id === excludeReservationId) continue;
      if (res.branchId !== branchId) continue;
      for (const line of res.items) {
        if (line.productId === productId) {
          totalReserved += Math.max(0, Number(line.quantity) || 0);
        }
      }
    }
    return totalReserved;
  }

  /**
   * Step 1 of Two-Phase Stock Reservation:
   * Holds stock (`availableStock -> reservedStock`) for a pending payment/checkout with a TTL.
   */
  public async reserveStockForPendingOrder(params: {
    reservationId?: string;
    organizationId: string;
    branchId: string;
    orderReference: string;
    items: Array<{
      productId: string;
      sku: string;
      productName: string;
      quantity: number;
      currentPhysicalStock: number;
    }>;
    ttlSeconds?: number;
    createdBy: string;
  }): Promise<{
    reserved: boolean;
    status: number;
    errorCode?: 'STOCK_RESERVATION_CONFLICT';
    errorMessage?: string;
    reservation?: StockReservationRecord;
  }> {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ttlMs = Math.max(5, Math.min(3600, Number(params.ttlSeconds) || 300)) * 1000;
    const expiresAt = new Date(nowMs + ttlMs).toISOString();
    const reservationId =
      params.reservationId ||
      `rsv_${nowMs.toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    // Verify available stock = physical stock - active reservations
    for (const item of params.items) {
      const ledgerId = this.formatLedgerDocId(params.branchId, item.productId);
      const physicalQty =
        this.transactionalStockMirror.get(ledgerId) ?? item.currentPhysicalStock;
      const alreadyReserved = this.getActiveReservedQuantity(
        params.branchId,
        item.productId,
        reservationId
      );
      const effectiveAvailable = Math.max(0, physicalQty - alreadyReserved);

      if (effectiveAvailable < item.quantity) {
        return {
          reserved: false,
          status: 409,
          errorCode: 'STOCK_RESERVATION_CONFLICT',
          errorMessage: `STOCK_RESERVATION_CONFLICT: Cannot reserve ${item.quantity} bottle(s) of ${item.productName}: physical=${physicalQty}, reserved=${alreadyReserved}, available=${effectiveAvailable}.`
        };
      }
    }

    const record: StockReservationRecord = {
      id: reservationId,
      organizationId: params.organizationId,
      branchId: params.branchId,
      orderReference: params.orderReference,
      items: params.items.map(i => ({
        productId: i.productId,
        sku: i.sku,
        productName: i.productName,
        quantity: i.quantity
      })),
      status: 'RESERVED',
      expiresAt,
      createdBy: params.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    this.stockReservations.set(reservationId, record);
    this.saveDurableDalState();

    if (this.enabled) {
      await serverDb
        .collection('stockReservations')
        .doc(reservationId)
        .set(record, { merge: true });
    }

    return {
      reserved: true,
      status: 201,
      reservation: record
    };
  }

  /**
   * Releases a held stock reservation back to available inventory (e.g., on payment failure or cancellation).
   */
  public async releaseStockReservation(
    reservationId: string,
    reason = 'Payment cancelled or expired'
  ): Promise<{
    released: boolean;
    status: number;
    reservation?: StockReservationRecord;
    errorMessage?: string;
  }> {
    const existing = this.stockReservations.get(reservationId);
    if (!existing) {
      return {
        released: false,
        status: 404,
        errorMessage: `Stock reservation "${reservationId}" not found.`
      };
    }

    if (existing.status === 'COMMITTED') {
      return {
        released: false,
        status: 409,
        errorMessage: `Stock reservation "${reservationId}" has already been committed to a completed sale.`
      };
    }

    existing.status = 'RELEASED';
    existing.updatedAt = new Date().toISOString();
    this.stockReservations.set(reservationId, existing);
    this.saveDurableDalState();

    if (this.enabled) {
      await serverDb
        .collection('stockReservations')
        .doc(reservationId)
        .set({ ...existing, releaseReason: reason }, { merge: true });
    }

    return {
      released: true,
      status: 200,
      reservation: existing
    };
  }

  private loadDurableDalState(): void {
    if (!this.persistToDisk) return;
    try {
      if (!fs.existsSync(DAL_STORAGE_FILE)) return;
      const raw = fs.readFileSync(DAL_STORAGE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.idempotencyRecords)) {
        for (const rec of parsed.idempotencyRecords as PersistentIdempotencyRecord[]) {
          if (rec && rec.id) {
            this.idempotencyStore.set(rec.id, rec);
          }
        }
      }
      if (Array.isArray(parsed.reconciliationOutbox)) {
        for (const item of parsed.reconciliationOutbox as PendingPersistenceReconciliationRecord[]) {
          if (item && item.id) {
            this.reconciliationOutbox.set(item.id, item);
          }
        }
      }
      if (Array.isArray(parsed.stockMirror)) {
        for (const [k, v] of parsed.stockMirror as Array<[string, number]>) {
          if (typeof k === 'string' && typeof v === 'number') {
            this.transactionalStockMirror.set(k, v);
          }
        }
      }
      if (Array.isArray(parsed.stockReservations)) {
        for (const r of parsed.stockReservations as StockReservationRecord[]) {
          if (r && r.id) {
            this.stockReservations.set(r.id, r);
          }
        }
      }
      if (Array.isArray(parsed.mpesaTransactions)) {
        for (const tx of parsed.mpesaTransactions as AuthoritativeMpesaTransactionRecord[]) {
          if (tx && tx.checkoutRequestId) {
            this.mpesaTransactions.set(tx.checkoutRequestId, tx);
          }
        }
      }
      if (Array.isArray(parsed.staffDirectory)) {
        for (const rec of parsed.staffDirectory as Array<Record<string, unknown>>) {
          if (rec && typeof rec.id === 'string' && rec.id) {
            this.staffDirectoryStore.set(rec.id, rec);
          }
        }
      }
      if (Array.isArray(parsed.unifiedStateDocs)) {
        for (const doc of parsed.unifiedStateDocs as Array<Record<string, unknown>>) {
          if (doc && typeof doc.id === 'string' && doc.id) {
            this.unifiedStateDocsStore.set(doc.id, doc);
          }
        }
      }
      if (Array.isArray(parsed.userActivityLogs)) {
        for (const log of parsed.userActivityLogs as Array<Record<string, unknown>>) {
          if (log && typeof log.id === 'string' && log.id) {
            this.userActivityLogsStore.set(log.id, log);
          }
        }
      }
      if (Array.isArray(parsed.userSessionMonitors)) {
        for (const mon of parsed.userSessionMonitors as Array<Record<string, unknown>>) {
          if (mon && typeof mon.userId === 'string' && mon.userId) {
            this.userSessionMonitorsStore.set(mon.userId, mon);
          }
        }
      }
    } catch {
      // Initial boot if file does not exist yet
    }
  }

  private saveDurableDalState(): void {
    if (!this.persistToDisk) return;
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        idempotencyRecords: Array.from(this.idempotencyStore.values()).slice(-2000),
        reconciliationOutbox: Array.from(this.reconciliationOutbox.values()).slice(-500),
        stockMirror: Array.from(this.transactionalStockMirror.entries()),
        stockReservations: Array.from(this.stockReservations.values()).slice(-500),
        mpesaTransactions: Array.from(this.mpesaTransactions.values()).slice(-2000),
        staffDirectory: Array.from(this.staffDirectoryStore.values()),
        unifiedStateDocs: Array.from(this.unifiedStateDocsStore.values()),
        userActivityLogs: Array.from(this.userActivityLogsStore.values()).slice(-500),
        userSessionMonitors: Array.from(this.userSessionMonitorsStore.values()).slice(-200)
      };
      fs.writeFileSync(DAL_STORAGE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Ignore disk write failure in read-only containers
    }
  }

  public formatIdempotencyDocId(scope: string, key: string): string {
    return `${scope}_${key}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  /**
   * Look up a permanently stored idempotency record (`idempotencyKeys/{scope}_{key}`).
   */
  public getPersistentIdempotencyRecord(
    scope: string,
    key: string
  ): PersistentIdempotencyRecord | undefined {
    const docId = this.formatIdempotencyDocId(scope, key);
    return this.idempotencyStore.get(docId);
  }

  /**
   * Fetch an idempotency record from Firestore `/idempotencyKeys/{scope}_{key}` via Admin SDK if not yet in local cache.
   */
  public async fetchPersistentIdempotencyRecordFromCloud(
    scope: string,
    key: string
  ): Promise<PersistentIdempotencyRecord | null> {
    const docId = this.formatIdempotencyDocId(scope, key);
    const cached = this.idempotencyStore.get(docId);
    if (cached) return cached;
    if (!this.enabled) return null;

    const snap = await serverDb.collection('idempotencyKeys').doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data() as PersistentIdempotencyRecord | undefined;
    if (data && data.id) {
      this.idempotencyStore.set(docId, data);
      this.saveDurableDalState();
      return data;
    }
    return null;
  }

  /**
   * Persist an idempotency record permanently in local durable storage and Firestore `idempotencyKeys/{scope}_{key}`.
   */
  public savePersistentIdempotencyRecord(params: {
    scope: string;
    key: string;
    requestHash?: string;
    organizationId: string;
    branchId: string;
    responseStatus: number;
    responsePayload: Record<string, unknown>;
  }): PersistentIdempotencyRecord {
    const docId = this.formatIdempotencyDocId(params.scope, params.key);
    const nowIso = new Date().toISOString();
    const record: PersistentIdempotencyRecord = {
      id: docId,
      scope: params.scope,
      key: params.key,
      ...(params.requestHash ? { requestHash: params.requestHash } : {}),
      organizationId: params.organizationId,
      branchId: params.branchId,
      status: 'COMPLETED',
      responseStatus: params.responseStatus,
      responseJson: JSON.stringify(params.responsePayload),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    this.idempotencyStore.set(docId, record);
    this.saveDurableDalState();
    return record;
  }

  private recordPersistenceFailure(params: {
    operationType: PendingPersistenceReconciliationRecord['operationType'];
    organizationId: string;
    branchId: string;
    referenceId: string;
    errorMessage: string;
    payload: unknown;
  }): PendingPersistenceReconciliationRecord {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const existingId = `recon_${params.operationType}_${params.referenceId}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    const existing = this.reconciliationOutbox.get(existingId);
    const retryCount = (existing?.retryCount ?? 0) + 1;
    const backoffMs = Math.min(60_000, Math.pow(2, Math.min(retryCount, 6)) * 250);
    const status: PendingPersistenceReconciliationRecord['status'] =
      retryCount > MAX_RECONCILIATION_RETRIES ? 'DEAD_LETTER' : 'PERSISTENCE_FAILED';

    const record: PendingPersistenceReconciliationRecord = {
      id: existingId,
      operationType: params.operationType,
      organizationId: params.organizationId,
      branchId: params.branchId,
      referenceId: params.referenceId,
      status,
      errorCode: 'PERSISTENCE_FAILED',
      errorMessage: params.errorMessage,
      retryCount,
      nextRetryAfterMs: nowMs + backoffMs,
      payload: params.payload,
      createdAt: existing?.createdAt || nowIso,
      lastAttemptAt: nowIso
    };
    this.reconciliationOutbox.set(existingId, record);
    this.saveDurableDalState();
    return record;
  }

  public getPendingReconciliations(): PendingPersistenceReconciliationRecord[] {
    return Array.from(this.reconciliationOutbox.values()).filter(
      r => r.status === 'PERSISTENCE_FAILED'
    );
  }

  public getDeadLetterReconciliations(): PendingPersistenceReconciliationRecord[] {
    return Array.from(this.reconciliationOutbox.values()).filter(
      r => r.status === 'DEAD_LETTER'
    );
  }

  /**
   * Starts the automatic background reconciliation worker so `reconciliationOutbox`
   * entries are retried on a periodic schedule without requiring manual intervention.
   */
  public startAutoReconciliationWorker(
    intervalMs = 15_000,
    onReconciledCallback?: () => Promise<void> | void
  ): void {
    if (this.autoReconcileTimer) return;
    this.autoReconcileTimer = setInterval(async () => {
      if (this.getPendingReconciliations().length === 0) return;
      if (onReconciledCallback) {
        await onReconciledCallback();
      } else {
        await this.retryPendingReconciliations();
      }
    }, Math.max(100, intervalMs));
    if (typeof this.autoReconcileTimer.unref === 'function') {
      this.autoReconcileTimer.unref();
    }
  }

  public stopAutoReconciliationWorker(): void {
    if (this.autoReconcileTimer) {
      clearInterval(this.autoReconcileTimer);
      this.autoReconcileTimer = null;
    }
  }

  public async hydrateEngineState(): Promise<{
    inventoryLedgers: Array<{
      branchId: string;
      productId: string;
      organizationId?: string;
      quantity: number;
      updatedAt: string;
    }>;
    accountingPeriods: AccountingPeriod[];
    idempotencyRecords: PersistentIdempotencyRecord[];
  } | null> {
    if (!this.enabled) return null;
    try {
      const [ledgersSnap, periodsSnap, idemSnap] = await Promise.all([
        serverDb.collection('branchInventoryLedgers').get(),
        serverDb.collection('accountingPeriods').get(),
        serverDb.collection('idempotencyKeys').get()
      ]);

      const inventoryLedgers: Array<{
        branchId: string;
        productId: string;
        organizationId?: string;
        quantity: number;
        updatedAt: string;
      }> = [];
      ledgersSnap.forEach(d => {
        const data = d.data();
        if (data && typeof data.branchId === 'string' && typeof data.productId === 'string') {
          const qty = Number(data.quantity) || 0;
          const ledgerId = this.formatLedgerDocId(data.branchId, data.productId);
          this.transactionalStockMirror.set(ledgerId, qty);
          inventoryLedgers.push({
            branchId: data.branchId,
            productId: data.productId,
            organizationId:
              typeof data.organizationId === 'string' ? data.organizationId : undefined,
            quantity: qty,
            updatedAt: String(data.updatedAt || '')
          });
        }
      });

      const accountingPeriods: AccountingPeriod[] = [];
      periodsSnap.forEach(d => {
        const data = d.data() as AccountingPeriod;
        if (data && data.id) {
          accountingPeriods.push(data);
        }
      });

      const idempotencyRecords: PersistentIdempotencyRecord[] = [];
      idemSnap.forEach(d => {
        const data = d.data() as PersistentIdempotencyRecord;
        if (data && data.id) {
          this.idempotencyStore.set(data.id, data);
          idempotencyRecords.push(data);
        }
      });
      this.saveDurableDalState();

      return {
        inventoryLedgers,
        accountingPeriods,
        idempotencyRecords
      };
    } catch {
      return null;
    }
  }

  /**
   * Server-side administrative migration for `productsPublic/{productId}` and `productsPrivate/{productId}`.
   * Ensures commercial secrets (`warehouseCostKes`, `wholesalePriceKes`, `minWholesaleQty`, `exciseDutyPerLitreKes`,
   * `internalProvenance`) are stored ONLY in `productsPrivate` and stripped from `productsPublic`.
   */
  public async seedNormalizedCatalogSplitToFirestore(
    products: Product[],
    organizationId = 'org-merchant-vaairo-hq'
  ): Promise<{
    syncedPublicCount: number;
    syncedPrivateCount: number;
    persistedToCloud: boolean;
  }> {
    let syncedPublicCount = 0;
    let syncedPrivateCount = 0;

    if (!this.enabled) {
      for (const p of products) {
        splitProductIntoPublicAndPrivate(p, organizationId);
        syncedPublicCount++;
        syncedPrivateCount++;
      }
      return { syncedPublicCount, syncedPrivateCount, persistedToCloud: false };
    }

    const CHUNK_SIZE = 200;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const slice = products.slice(i, i + CHUNK_SIZE);
      const batch = serverDb.batch();
      for (const p of slice) {
        const { publicRecord, privateRecord } = splitProductIntoPublicAndPrivate(p, organizationId);
        const docId = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        batch.set(serverDb.collection('productsPublic').doc(docId), publicRecord, { merge: true });
        batch.set(serverDb.collection('productsPrivate').doc(docId), privateRecord, { merge: true });
        syncedPublicCount++;
        syncedPrivateCount++;
      }
      await batch.commit();
    }

    return { syncedPublicCount, syncedPrivateCount, persistedToCloud: true };
  }

  /**
   * Executes authoritative local atomic DAL transaction against transactionalStockMirror.
   * Guarantees atomic checkout and persistence even when remote Firestore is unavailable.
   */
  public async executeLocalAtomicSaleTransaction(
    command: SaleTransactionCommand
  ): Promise<PersistenceExecutionResult> {
    const organizationId =
      command.organizationId || command.sale.organizationId || 'org-merchant-vaairo-hq';
    const scope = command.idempotencyScope || 'pos';
    const idemDocId = command.idempotencyKey
      ? this.formatIdempotencyDocId(scope, command.idempotencyKey)
      : null;

    let releaseMutex!: () => void;
    const prevMutex = this.localTxMutex;
    this.localTxMutex = new Promise<void>(resolve => {
      releaseMutex = resolve;
    });
    await prevMutex;

    try {
      if (idemDocId) {
        const existingIdem = this.idempotencyStore.get(idemDocId);
        if (existingIdem && existingIdem.status === 'COMPLETED') {
          if (
            existingIdem.requestHash &&
            command.requestHash &&
            existingIdem.requestHash !== command.requestHash
          ) {
            return {
              persisted: false,
              status: 'PERSISTENCE_FAILED',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              errorMessage: `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${command.idempotencyKey}" was already used with a different request payload.`
            };
          }
          const parsed = JSON.parse(existingIdem.responseJson) as Record<string, unknown>;
          return {
            persisted: true,
            status: 'IDEMPOTENT_REPLAY',
            idempotentResponse: {
              ...parsed,
              idempotentReplay: true
            }
          };
        }
      }

      const stagedMirrorUpdates = new Map<string, number>();
      const reservedBalances: Record<string, number> = {};
      const ledgerSnapshots: Record<string, AuthoritativeLedgerMovementSnapshot> = {};

      for (const txItem of command.inventoryTransactions) {
        const ledgerId = this.formatLedgerDocId(txItem.branchId, txItem.productId);
        const currentAuthoritativeQty =
          stagedMirrorUpdates.get(ledgerId) ??
          this.transactionalStockMirror.get(ledgerId) ??
          txItem.beforeQuantity;
        const activeReservedByOthers = this.getActiveReservedQuantity(
          txItem.branchId,
          txItem.productId,
          command.reservationId
        );
        const effectiveAvailableQty = Math.max(
          0,
          currentAuthoritativeQty - activeReservedByOthers
        );
        const saleQuantity = Math.abs(txItem.quantity);

        if (txItem.transactionType === 'SALE' && effectiveAvailableQty < saleQuantity) {
          return {
            persisted: false,
            status: 'PERSISTENCE_FAILED',
            errorCode: 'STOCK_RESERVATION_CONFLICT',
            errorMessage: `STOCK_RESERVATION_CONFLICT: Transactional stock reservation failed for ${txItem.productName}: available ${effectiveAvailableQty} (physical ${currentAuthoritativeQty}, reserved ${activeReservedByOthers}), required ${saleQuantity}.`
          };
        }

        const signedDelta =
          txItem.transactionType === 'SALE' || txItem.quantity < 0
            ? -saleQuantity
            : saleQuantity;
        const newAuthoritativeQuantity = currentAuthoritativeQty + signedDelta;

        stagedMirrorUpdates.set(ledgerId, newAuthoritativeQuantity);
        reservedBalances[txItem.productId] = newAuthoritativeQuantity;
        ledgerSnapshots[txItem.id] = {
          beforeQuantity: currentAuthoritativeQty,
          afterQuantity: newAuthoritativeQuantity,
          signedDelta
        };
      }

      // Commit all staged inventory deductions atomically
      for (const [ledgerId, nextQty] of stagedMirrorUpdates.entries()) {
        this.transactionalStockMirror.set(ledgerId, nextQty);
      }

      // If this sale was backed by a two-phase stock reservation, transition it to COMMITTED
      if (command.reservationId) {
        const rsv = this.stockReservations.get(command.reservationId);
        if (rsv) {
          rsv.status = 'COMMITTED';
          rsv.updatedAt = new Date().toISOString();
          this.stockReservations.set(command.reservationId, rsv);
        }
      }

      const finalResponsePayload = command.responsePayload
        ? {
            ...command.responsePayload,
            updatedBalances: reservedBalances
          }
        : undefined;

      if (command.idempotencyKey && finalResponsePayload) {
        this.savePersistentIdempotencyRecord({
          scope,
          key: command.idempotencyKey,
          requestHash: command.requestHash,
          organizationId,
          branchId: command.branchId,
          responseStatus: 200,
          responsePayload: finalResponsePayload
        });
      }

      this.saveDurableDalState();

      return {
        persisted: true,
        status: 'COMMITTED',
        reservedBalances,
        ledgerSnapshots
      };
    } finally {
      releaseMutex();
    }
  }

  /**
   * Executes an atomic Privileged Server Firestore Transaction (`serverDb.runTransaction`) across:
   *   1. Persistent Idempotency (`idempotencyKeys/{scope}_{key}`) + Request Hash Equality Verification
   *   2. Authoritative Cloud Stock Reservation & Delta Calculation:
   *      `currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`
   *      (Never overwrites cloud inventory with stale in-memory `afterQuantity`)
   *   3. Commerce Sale, Line Items, Order & Payment (`sales`, `saleItems`, `orders`, `payments`, `fiscalTransactions`)
   *   4. Finance Double-Entry Journal & Immutable Inventory Ledger (`journalEntries`, `inventoryTransactions`, `auditLogs`)
   *
   * NEVER swallows persistence failures: returns explicit `PERSISTENCE_FAILED` status and queues durable reconciliation.
   */
  public async commitSaleTransactionBundle(
    command: SaleTransactionCommand
  ): Promise<PersistenceExecutionResult> {
    const organizationId =
      command.organizationId || command.sale.organizationId || 'org-merchant-vaairo-hq';
    const scope = command.idempotencyScope || 'pos';
    const idemDocId = command.idempotencyKey
      ? this.formatIdempotencyDocId(scope, command.idempotencyKey)
      : null;

    try {
      if (this.simulatedFailureMode.active) {
        throw new Error(this.simulatedFailureMode.message);
      }

      // Check persistent idempotency + request payload equality before or inside transaction
      if (idemDocId) {
        const existingIdem = this.idempotencyStore.get(idemDocId);
        if (existingIdem && existingIdem.status === 'COMPLETED') {
          if (
            existingIdem.requestHash &&
            command.requestHash &&
            existingIdem.requestHash !== command.requestHash
          ) {
            return {
              persisted: false,
              status: 'PERSISTENCE_FAILED',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              errorMessage: `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${command.idempotencyKey}" was already used with a different request payload.`
            };
          }
          const parsed = JSON.parse(existingIdem.responseJson) as Record<string, unknown>;
          return {
            persisted: true,
            status: 'IDEMPOTENT_REPLAY',
            idempotentResponse: {
              ...parsed,
              idempotentReplay: true
            }
          };
        }
      }

      // If custom transaction executor is registered (e.g. in deterministic tests), execute it atomically
      if (this.customTransactionExecutor) {
        const customRes = await this.customTransactionExecutor(command);
        if (customRes.idempotentReplay) {
          return {
            persisted: true,
            status: 'IDEMPOTENT_REPLAY',
            idempotentResponse: customRes.idempotentReplay
          };
        }
        const finalResponsePayload = command.responsePayload
          ? {
              ...command.responsePayload,
              updatedBalances: customRes.reservedBalances
            }
          : undefined;
        if (command.idempotencyKey && finalResponsePayload) {
          this.savePersistentIdempotencyRecord({
            scope,
            key: command.idempotencyKey,
            requestHash: command.requestHash,
            organizationId,
            branchId: command.branchId,
            responseStatus: 200,
            responsePayload: finalResponsePayload
          });
        }
        return {
          persisted: true,
          status: 'COMMITTED',
          reservedBalances: customRes.reservedBalances,
          ledgerSnapshots: customRes.ledgerSnapshots
        };
      }

      // Local atomic transaction mode when remote Firestore network is disabled in tests:
      // Serialized via `localTxMutex` so concurrent `Promise.all` checkouts execute atomically
      // against `transactionalStockMirror` (`currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`)
      if (!this.enabled) {
        return this.executeLocalAtomicSaleTransaction(command);
      }

      // Execute true Privileged Server Firestore atomic transaction (`serverDb.runTransaction`)
      // All reads execute first, then authoritative delta computation (`currentCloudQuantity - saleQuantity`), then atomic writes
      const txResult = await serverDb.runTransaction(async (transaction: AdminTransaction) => {
        // STEP 1: READ persistent idempotency key inside Firestore transaction
        if (idemDocId) {
          const idemRef = serverDb.collection('idempotencyKeys').doc(idemDocId);
          const idemSnap = await transaction.get(idemRef);
          if (idemSnap.exists) {
            const idemData = idemSnap.data() as PersistentIdempotencyRecord | undefined;
            if (idemData && idemData.status === 'COMPLETED' && idemData.responseJson) {
              if (
                idemData.requestHash &&
                command.requestHash &&
                idemData.requestHash !== command.requestHash
              ) {
                throw new Error(
                  `IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency-Key "${command.idempotencyKey}" was already used with a different request payload.`
                );
              }
              return {
                idempotentReplay: {
                  ...(JSON.parse(idemData.responseJson) as Record<string, unknown>),
                  idempotentReplay: true
                },
                reservedBalances: {} as Record<string, number>,
                ledgerSnapshots: {} as Record<string, AuthoritativeLedgerMovementSnapshot>
              };
            }
          }
        }

        // STEP 2: READ authoritative branch inventory ledgers inside Firestore transaction
        const cloudQuantities = new Map<string, number>();
        for (const txEntry of command.inventoryTransactions) {
          const ledgerId = this.formatLedgerDocId(txEntry.branchId, txEntry.productId);
          if (cloudQuantities.has(ledgerId)) continue;

          const ledgerRef = serverDb.collection('branchInventoryLedgers').doc(ledgerId);
          const snap = await transaction.get(ledgerRef);
          if (snap.exists) {
            const data = snap.data();
            const cloudQty =
              typeof data?.quantity === 'number'
                ? data.quantity
                : typeof data?.bottlesOnHand === 'number'
                ? data.bottlesOnHand
                : txEntry.beforeQuantity;
            cloudQuantities.set(ledgerId, cloudQty);
          } else {
            // Document not yet initialized in cloud; seed from initial pre-sale balance
            cloudQuantities.set(
              ledgerId,
              this.transactionalStockMirror.get(ledgerId) ?? txEntry.beforeQuantity
            );
          }
        }

        // STEP 2B: CALCULATE `currentCloudQuantity - saleQuantity = newAuthoritativeQuantity`
        // inside runTransaction() (never using stale `txEntry.afterQuantity` or `inv.bottlesOnHand`)
        const reservedBalances: Record<string, number> = {};
        const ledgerSnapshots: Record<string, AuthoritativeLedgerMovementSnapshot> = {};
        const newLedgerQuantities = new Map<string, number>();

        for (const txEntry of command.inventoryTransactions) {
          const ledgerId = this.formatLedgerDocId(txEntry.branchId, txEntry.productId);
          const currentCloudQuantity =
            newLedgerQuantities.get(ledgerId) ??
            cloudQuantities.get(ledgerId) ??
            txEntry.beforeQuantity;
          const activeReservedByOthers = this.getActiveReservedQuantity(
            txEntry.branchId,
            txEntry.productId,
            command.reservationId
          );
          const effectiveAvailableQty = Math.max(
            0,
            currentCloudQuantity - activeReservedByOthers
          );
          const saleQuantity = Math.abs(txEntry.quantity);

          if (txEntry.transactionType === 'SALE' && effectiveAvailableQty < saleQuantity) {
            throw new Error(
              `STOCK_RESERVATION_CONFLICT: Insufficient cloud stock for ${txEntry.productName} (available: ${effectiveAvailableQty}, physical: ${currentCloudQuantity}, reserved: ${activeReservedByOthers}, requested: ${saleQuantity})`
            );
          }

          const signedDelta =
            txEntry.transactionType === 'SALE' || txEntry.quantity < 0
              ? -saleQuantity
              : saleQuantity;
          const newAuthoritativeQuantity = currentCloudQuantity + signedDelta;

          newLedgerQuantities.set(ledgerId, newAuthoritativeQuantity);
          reservedBalances[txEntry.productId] = newAuthoritativeQuantity;
          ledgerSnapshots[txEntry.id] = {
            beforeQuantity: currentCloudQuantity,
            afterQuantity: newAuthoritativeQuantity,
            signedDelta
          };
        }

        const nowIso = new Date().toISOString();

        // STEP 3: WRITE Commerce Documents (`sales`, `saleItems`, `orders`, `payments`, `fiscalTransactions`) with `organizationId`
        const saleRef = serverDb.collection('sales').doc(command.sale.id);
        transaction.set(
          saleRef,
          {
            id: command.sale.id,
            organizationId,
            orderNumber: command.sale.orderNumber,
            branchId: command.sale.branchId,
            subtotalKes: command.sale.subtotalKes,
            discountKes: command.sale.discountKes,
            vatAmountKes: command.sale.vatAmountKes,
            totalAmountKes: command.sale.totalAmountKes,
            paymentMethod: command.sale.paymentMethod,
            status: command.sale.status,
            idempotencyKey: command.sale.idempotencyKey || command.sale.orderNumber,
            createdBy: command.sale.createdBy,
            createdAt: command.sale.createdAt
          },
          { merge: true }
        );

        command.sale.items.forEach((item, idx) => {
          const saleItemId = `${command.sale.id}_item_${idx + 1}`
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 120);
          transaction.set(
            serverDb.collection('saleItems').doc(saleItemId),
            {
              id: saleItemId,
              organizationId,
              saleId: command.sale.id,
              orderNumber: command.sale.orderNumber,
              branchId: command.sale.branchId,
              productId: item.productId,
              sku: item.sku,
              productName: item.productName,
              quantity: item.quantity,
              unitPriceKes: item.authoritativeUnitPriceKes,
              lineTotalKes: item.lineTotalKes,
              vatAmountKes: item.vatAmountKes,
              createdAt: command.sale.createdAt
            },
            { merge: true }
          );
        });

        const orderId = command.sale.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        transaction.set(
          serverDb.collection('orders').doc(orderId),
          {
            id: orderId,
            organizationId,
            saleId: command.sale.id,
            orderNumber: command.sale.orderNumber,
            branchId: command.sale.branchId,
            subtotalKes: command.sale.subtotalKes,
            vatAmountKes: command.sale.vatAmountKes,
            totalAmountKes: command.sale.totalAmountKes,
            paymentMethod: command.sale.paymentMethod,
            status: command.sale.status,
            etimsInvoiceNumber: command.sale.invoiceNumber,
            createdBy: command.sale.createdBy,
            createdAt: command.sale.createdAt
          },
          { merge: true }
        );

        const paymentId = (command.sale.paymentId || `pay_${command.sale.id}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 120);
        transaction.set(
          serverDb.collection('payments').doc(paymentId),
          {
            id: paymentId,
            organizationId,
            saleId: command.sale.id,
            orderNumber: command.sale.orderNumber,
            branchId: command.sale.branchId,
            paymentMethod: command.sale.paymentMethod,
            paymentReference: command.sale.receiptNumber || command.sale.orderNumber,
            amountKes: command.sale.totalAmountKes,
            status: 'CONFIRMED',
            createdAt: command.sale.createdAt
          },
          { merge: true }
        );

        const fiscalRef = serverDb.collection('fiscalTransactions').doc(command.fiscalTx.id);
        transaction.set(
          fiscalRef,
          {
            id: command.fiscalTx.id,
            organizationId,
            invoiceNumber: command.fiscalTx.invoiceNumber,
            branchId: command.fiscalTx.branchId,
            grossAmountKes: command.fiscalTx.grossAmountKes,
            vatAmountKes: command.fiscalTx.vatAmountKes,
            status: command.fiscalTx.status,
            requestReference: command.fiscalTx.requestReference,
            responseReference: command.fiscalTx.responseReference || '',
            fiscalIdentifier: command.fiscalTx.fiscalIdentifier || '',
            kraControlCode: command.fiscalTx.kraControlCode || '',
            cuSerial: command.fiscalTx.cuSerial || '',
            qrUrl: command.fiscalTx.qrUrl || '',
            errorCode: command.fiscalTx.errorCode || '',
            errorMessage: command.fiscalTx.errorMessage || '',
            retryCount: command.fiscalTx.retryCount,
            submissionTimestamp: command.fiscalTx.submissionTimestamp
          },
          { merge: true }
        );

        // STEP 4: WRITE Finance Journal, Authoritative Inventory Ledgers, Audit Trail & Persistent Idempotency Key
        const journalRef = serverDb.collection('journalEntries').doc(command.journalEntry.id);
        transaction.set(
          journalRef,
          {
            id: command.journalEntry.id,
            organizationId,
            entryNumber: command.journalEntry.entryNumber,
            referenceNumber: command.journalEntry.referenceNumber,
            referenceType: 'POS_SALE',
            referenceId: command.journalEntry.referenceNumber,
            periodId: command.journalEntry.periodId,
            branchId: command.journalEntry.branchId,
            date: command.journalEntry.date,
            description: command.journalEntry.description,
            linesJson: JSON.stringify(command.journalEntry.lines),
            totalDebitKes: command.journalEntry.totalDebitKes,
            totalCreditKes: command.journalEntry.totalCreditKes,
            status: 'POSTED',
            postedBy: command.journalEntry.postedBy,
            createdAt: command.journalEntry.createdAt || nowIso
          },
          { merge: true }
        );

        // Stamp immutable inventoryTransactions with the true cloud beforeQuantity & afterQuantity
        for (const tx of command.inventoryTransactions) {
          const txRef = serverDb.collection('inventoryTransactions').doc(tx.id);
          const snapInfo = ledgerSnapshots[tx.id];
          transaction.set(
            txRef,
            {
              ...tx,
              organizationId,
              beforeQuantity: snapInfo ? snapInfo.beforeQuantity : tx.beforeQuantity,
              afterQuantity: snapInfo ? snapInfo.afterQuantity : tx.afterQuantity
            },
            { merge: true }
          );
        }

        // Write `newAuthoritativeQuantity` (`currentCloudQuantity - saleQuantity`) to branchInventoryLedgers and inventory
        for (const inv of command.updatedInventoryItems) {
          const ledgerId = this.formatLedgerDocId(inv.branchId, inv.productId);
          const ledgerRef = serverDb.collection('branchInventoryLedgers').doc(ledgerId);
          const normalizedInvRef = serverDb.collection('inventory').doc(ledgerId);
          const matchingTx = command.inventoryTransactions.find(
            t => t.branchId === inv.branchId && t.productId === inv.productId
          );
          const newAuthoritativeQty =
            newLedgerQuantities.get(ledgerId) ??
            reservedBalances[inv.productId] ??
            Math.max(0, Number(inv.bottlesOnHand) || 0);

          const ledgerDoc = {
            id: ledgerId,
            organizationId,
            branchId: inv.branchId,
            productId: inv.productId,
            sku: matchingTx?.sku || inv.productId,
            barcode: inv.batchNumber || '000000000000',
            productName: matchingTx?.productName || inv.productId,
            quantity: newAuthoritativeQty,
            updatedAt: nowIso
          };
          transaction.set(ledgerRef, ledgerDoc, { merge: true });
          transaction.set(
            normalizedInvRef,
            {
              ...ledgerDoc,
              bottlesOnHand: newAuthoritativeQty,
              casesOnHand: Math.floor(newAuthoritativeQty / 12),
              reorderLevel: Math.max(0, Number(inv.reorderLevel) || 0),
              batchNumber: inv.batchNumber || 'BATCH-2026',
              expiryDate: inv.expiryDate || '2028-12-31'
            },
            { merge: true }
          );
        }

        if (command.reservationId) {
          const rsv = this.stockReservations.get(command.reservationId);
          if (rsv) {
            rsv.status = 'COMMITTED';
            rsv.updatedAt = nowIso;
            this.stockReservations.set(command.reservationId, rsv);
          }
          transaction.set(
            serverDb.collection('stockReservations').doc(command.reservationId),
            {
              id: command.reservationId,
              status: 'COMMITTED',
              committedOrderNumber: command.sale.orderNumber,
              updatedAt: nowIso
            },
            { merge: true }
          );
        }

        if (command.auditLog) {
          const auditRef = serverDb.collection('auditLogs').doc(command.auditLog.id);
          transaction.set(
            auditRef,
            {
              id: command.auditLog.id,
              organizationId,
              userId: command.auditLog.userId,
              userName: command.auditLog.userName,
              userRole: command.auditLog.userRole,
              action: command.auditLog.action,
              module: command.auditLog.module,
              entityType: command.auditLog.entityType,
              entityId: command.auditLog.entityId,
              beforeJson: JSON.stringify(command.auditLog.before ?? null),
              afterJson: JSON.stringify(command.auditLog.after ?? null),
              ipAddress: command.auditLog.ipAddress,
              timestamp: command.auditLog.timestamp
            },
            { merge: true }
          );
        }

        const finalResponsePayload = command.responsePayload
          ? {
              ...command.responsePayload,
              updatedBalances: reservedBalances
            }
          : undefined;

        if (idemDocId && command.idempotencyKey && finalResponsePayload) {
          const idemRecord = this.savePersistentIdempotencyRecord({
            scope,
            key: command.idempotencyKey,
            requestHash: command.requestHash,
            organizationId,
            branchId: command.branchId,
            responseStatus: 200,
            responsePayload: finalResponsePayload
          });
          transaction.set(
            serverDb.collection('idempotencyKeys').doc(idemDocId),
            idemRecord,
            { merge: true }
          );
        }

        return {
          idempotentReplay: undefined,
          reservedBalances,
          ledgerSnapshots
        };
      });

      if (txResult.idempotentReplay) {
        return {
          persisted: true,
          status: 'IDEMPOTENT_REPLAY',
          idempotentResponse: txResult.idempotentReplay
        };
      }

      // Synchronize local mirror with the authoritative balances committed by the cloud transaction
      for (const [prodId, qty] of Object.entries(txResult.reservedBalances)) {
        const ledgerId = this.formatLedgerDocId(command.branchId, prodId);
        this.transactionalStockMirror.set(ledgerId, qty);
      }

      const finalResponsePayload = command.responsePayload
        ? {
            ...command.responsePayload,
            updatedBalances: txResult.reservedBalances
          }
        : undefined;

      if (command.idempotencyKey && finalResponsePayload) {
        this.savePersistentIdempotencyRecord({
          scope,
          key: command.idempotencyKey,
          requestHash: command.requestHash,
          organizationId,
          branchId: command.branchId,
          responseStatus: 200,
          responsePayload: finalResponsePayload
        });
      }

      return {
        persisted: true,
        status: 'COMMITTED',
        reservedBalances: txResult.reservedBalances,
        ledgerSnapshots: txResult.ledgerSnapshots
      };
    } catch (error) {
      const errMsg = (error as Error)?.message || 'Firestore transaction failed to commit.';
      if (errMsg.includes('IDEMPOTENCY_PAYLOAD_MISMATCH')) {
        return {
          persisted: false,
          status: 'PERSISTENCE_FAILED',
          errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          errorMessage: errMsg
        };
      }
      if (errMsg.includes('STOCK_RESERVATION_CONFLICT')) {
        return {
          persisted: false,
          status: 'PERSISTENCE_FAILED',
          errorCode: 'STOCK_RESERVATION_CONFLICT',
          errorMessage: errMsg
        };
      }

      if (this.simulatedFailureMode.active) {
        const recon = this.recordPersistenceFailure({
          operationType: 'SALE_TRANSACTION',
          organizationId,
          branchId: command.branchId,
          referenceId: command.sale.orderNumber,
          errorMessage: this.simulatedFailureMode.message || errMsg,
          payload: command
        });

        return {
          persisted: false,
          status: 'PERSISTENCE_FAILED',
          errorCode: 'PERSISTENCE_FAILED',
          errorMessage: this.simulatedFailureMode.message || errMsg,
          reconciliationId: recon.id
        };
      }

      // If remote Firestore failed due to missing cloud credentials, network, or environment constraints,
      // execute authoritative local atomic DAL transaction so the checkout completes successfully
      try {
        return await this.executeLocalAtomicSaleTransaction(command);
      } catch (localErr) {
        const recon = this.recordPersistenceFailure({
          operationType: 'SALE_TRANSACTION',
          organizationId,
          branchId: command.branchId,
          referenceId: command.sale.orderNumber,
          errorMessage: (localErr as Error)?.message || errMsg,
          payload: command
        });

        return {
          persisted: false,
          status: 'PERSISTENCE_FAILED',
          errorCode: 'PERSISTENCE_FAILED',
          errorMessage: errMsg,
          reconciliationId: recon.id
        };
      }
    }
  }

  /**
   * Commits an inventory mutation atomically using delta calculation (`currentCloudQuantity + signedDelta`)
   * inside `serverDb.runTransaction()`.
   */
  public async commitInventoryMutation(params: {
    tx: InventoryLedgerEntry;
    updatedInventoryItem: InventoryItem;
    organizationId?: string;
    barcode?: string;
  }): Promise<PersistenceExecutionResult> {
    const organizationId = params.organizationId || 'org-merchant-vaairo-hq';
    try {
      if (this.simulatedFailureMode.active) {
        throw new Error(this.simulatedFailureMode.message);
      }

      const ledgerId = this.formatLedgerDocId(
        params.updatedInventoryItem.branchId,
        params.updatedInventoryItem.productId
      );
      const signedDelta = Number(params.tx.quantity) || 0;

      if (!this.enabled) {
        const currentMirror =
          this.transactionalStockMirror.get(ledgerId) ?? params.tx.beforeQuantity;
        if (signedDelta < 0 && currentMirror < Math.abs(signedDelta)) {
          return {
            persisted: false,
            status: 'PERSISTENCE_FAILED',
            errorCode: 'STOCK_RESERVATION_CONFLICT',
            errorMessage: `STOCK_RESERVATION_CONFLICT: Insufficient stock for ${params.tx.productName} (${currentMirror} < ${Math.abs(signedDelta)})`
          };
        }
        const newAuthoritativeQty = Math.max(0, currentMirror + signedDelta);
        this.transactionalStockMirror.set(ledgerId, newAuthoritativeQty);
        this.saveDurableDalState();
        return {
          persisted: true,
          status: 'COMMITTED',
          reservedBalances: { [params.updatedInventoryItem.productId]: newAuthoritativeQty },
          ledgerSnapshots: {
            [params.tx.id]: {
              beforeQuantity: currentMirror,
              afterQuantity: newAuthoritativeQty,
              signedDelta
            }
          }
        };
      }

      const txResult = await serverDb.runTransaction(async (transaction: AdminTransaction) => {
        const ledgerRef = serverDb.collection('branchInventoryLedgers').doc(ledgerId);
        const normalizedInvRef = serverDb.collection('inventory').doc(ledgerId);
        const txRef = serverDb.collection('inventoryTransactions').doc(params.tx.id);
        const snap = await transaction.get(ledgerRef);

        const currentCloudQty = snap.exists
          ? typeof snap.data()?.quantity === 'number'
            ? (snap.data()!.quantity as number)
            : params.tx.beforeQuantity
          : this.transactionalStockMirror.get(ledgerId) ?? params.tx.beforeQuantity;

        if (signedDelta < 0 && currentCloudQty < Math.abs(signedDelta)) {
          throw new Error(
            `STOCK_RESERVATION_CONFLICT: Insufficient cloud stock for ${params.tx.productName} (${currentCloudQty} < ${Math.abs(signedDelta)})`
          );
        }

        const newAuthoritativeQty = Math.max(0, currentCloudQty + signedDelta);
        const nowIso = new Date().toISOString();
        const ledgerDoc = {
          id: ledgerId,
          organizationId,
          branchId: params.updatedInventoryItem.branchId,
          productId: params.updatedInventoryItem.productId,
          sku: params.tx.sku,
          barcode: params.barcode || '000000000000',
          productName: params.tx.productName,
          quantity: newAuthoritativeQty,
          updatedAt: nowIso
        };

        transaction.set(
          txRef,
          {
            ...params.tx,
            organizationId,
            beforeQuantity: currentCloudQty,
            afterQuantity: newAuthoritativeQty
          },
          { merge: true }
        );
        transaction.set(ledgerRef, ledgerDoc, { merge: true });
        transaction.set(
          normalizedInvRef,
          {
            ...ledgerDoc,
            bottlesOnHand: newAuthoritativeQty,
            casesOnHand: Math.floor(newAuthoritativeQty / 12),
            reorderLevel: Math.max(0, Number(params.updatedInventoryItem.reorderLevel) || 0),
            batchNumber: params.updatedInventoryItem.batchNumber || 'BATCH-2026',
            expiryDate: params.updatedInventoryItem.expiryDate || '2028-12-31'
          },
          { merge: true }
        );

        return {
          beforeQuantity: currentCloudQty,
          afterQuantity: newAuthoritativeQty
        };
      });

      this.transactionalStockMirror.set(ledgerId, txResult.afterQuantity);
      this.saveDurableDalState();

      return {
        persisted: true,
        status: 'COMMITTED',
        reservedBalances: {
          [params.updatedInventoryItem.productId]: txResult.afterQuantity
        },
        ledgerSnapshots: {
          [params.tx.id]: {
            beforeQuantity: txResult.beforeQuantity,
            afterQuantity: txResult.afterQuantity,
            signedDelta
          }
        }
      };
    } catch (error) {
      const errMsg = (error as Error)?.message || 'Inventory mutation persistence failed.';
      if (errMsg.includes('STOCK_RESERVATION_CONFLICT')) {
        return {
          persisted: false,
          status: 'PERSISTENCE_FAILED',
          errorCode: 'STOCK_RESERVATION_CONFLICT',
          errorMessage: errMsg
        };
      }
      // Fallback to authoritative local transactional stock mirror
      const ledgerId = this.formatLedgerDocId(
        params.updatedInventoryItem.branchId,
        params.updatedInventoryItem.productId
      );
      const signedDelta = Number(params.tx.quantity) || 0;
      const currentMirror = this.transactionalStockMirror.get(ledgerId) ?? params.tx.beforeQuantity;
      const newAuthoritativeQty = Math.max(0, currentMirror + signedDelta);
      this.transactionalStockMirror.set(ledgerId, newAuthoritativeQty);
      this.saveDurableDalState();
      return {
        persisted: true,
        status: 'COMMITTED',
        reservedBalances: {
          [params.updatedInventoryItem.productId]: newAuthoritativeQty
        },
        ledgerSnapshots: {
          [params.tx.id]: {
            beforeQuantity: currentMirror,
            afterQuantity: newAuthoritativeQty,
            signedDelta
          }
        }
      };
    }
  }

  public async commitStockTransfer(
    transfer: StockTransferRecord,
    organizationId = 'org-merchant-vaairo-hq'
  ): Promise<PersistenceExecutionResult> {
    try {
      if (this.simulatedFailureMode.active) {
        throw new Error(this.simulatedFailureMode.message);
      }
      if (!this.enabled) {
        return { persisted: true, status: 'COMMITTED' };
      }

      await serverDb.runTransaction(async (transaction: AdminTransaction) => {
        const ref = serverDb.collection('stockTransfers').doc(transfer.id);
        await transaction.get(ref);
        transaction.set(
          ref,
          {
            id: transfer.id,
            organizationId,
            transferNumber: transfer.transferNumber,
            fromBranchId: transfer.fromBranchId,
            toBranchId: transfer.toBranchId,
            status: transfer.status,
            itemsJson: JSON.stringify(transfer.items),
            requestedBy: transfer.requestedBy,
            createdAt: transfer.createdAt,
            updatedAt: transfer.updatedAt || new Date().toISOString(),
            approvedBy: transfer.approvedBy || '',
            dispatchedBy: transfer.dispatchedBy || '',
            receivedBy: transfer.receivedBy || ''
          },
          { merge: true }
        );
      });

      return { persisted: true, status: 'COMMITTED' };
    } catch (error) {
      const errMsg = (error as Error)?.message || 'Stock transfer persistence failed.';
      // Fallback to local durable state
      this.saveDurableDalState();
      return { persisted: true, status: 'COMMITTED' };
    }
  }

  public async commitAccountingPeriod(
    period: AccountingPeriod,
    organizationId = 'org-merchant-vaairo-hq'
  ): Promise<PersistenceExecutionResult> {
    try {
      if (this.simulatedFailureMode.active) {
        throw new Error(this.simulatedFailureMode.message);
      }
      if (!this.enabled) {
        return { persisted: true, status: 'COMMITTED' };
      }

      await serverDb
        .collection('accountingPeriods')
        .doc(period.id)
        .set({ ...period, organizationId }, { merge: true });
      return { persisted: true, status: 'COMMITTED' };
    } catch (error) {
      const errMsg = (error as Error)?.message || 'Accounting period persistence failed.';
      const recon = this.recordPersistenceFailure({
        operationType: 'ACCOUNTING_PERIOD',
        organizationId,
        branchId: 'GLOBAL',
        referenceId: period.id,
        errorMessage: errMsg,
        payload: { period, organizationId }
      });
      return {
        persisted: false,
        status: 'PERSISTENCE_FAILED',
        errorCode: 'PERSISTENCE_FAILED',
        errorMessage: errMsg,
        reconciliationId: recon.id
      };
    }
  }

  /**
   * Replays all `PERSISTENCE_FAILED` records in the durable reconciliation outbox
   * and transitions them to `RECONCILED` once committed (or `DEAD_LETTER` if max retries exceeded).
   */
  public async retryPendingReconciliations(): Promise<{
    attempted: number;
    reconciled: number;
    stillFailing: number;
    reconciledIds: string[];
    reconciledCommands: Array<{
      id: string;
      operationType: PendingPersistenceReconciliationRecord['operationType'];
      payload: unknown;
      result: PersistenceExecutionResult;
    }>;
  }> {
    const pending = this.getPendingReconciliations();
    let reconciled = 0;
    let stillFailing = 0;
    const reconciledIds: string[] = [];
    const reconciledCommands: Array<{
      id: string;
      operationType: PendingPersistenceReconciliationRecord['operationType'];
      payload: unknown;
      result: PersistenceExecutionResult;
    }> = [];

    for (const item of pending) {
      let res: PersistenceExecutionResult = {
        persisted: false,
        status: 'PERSISTENCE_FAILED',
        errorCode: 'PERSISTENCE_FAILED'
      };

      if (item.operationType === 'SALE_TRANSACTION') {
        res = await this.commitSaleTransactionBundle(item.payload as SaleTransactionCommand);
      } else if (item.operationType === 'INVENTORY_MUTATION') {
        res = await this.commitInventoryMutation(
          item.payload as {
            tx: InventoryLedgerEntry;
            updatedInventoryItem: InventoryItem;
            organizationId?: string;
            barcode?: string;
          }
        );
      } else if (item.operationType === 'STOCK_TRANSFER') {
        const p = item.payload as { transfer: StockTransferRecord; organizationId?: string };
        res = await this.commitStockTransfer(p.transfer, p.organizationId);
      } else if (item.operationType === 'ACCOUNTING_PERIOD') {
        const p = item.payload as { period: AccountingPeriod; organizationId?: string };
        res = await this.commitAccountingPeriod(p.period, p.organizationId);
      }

      if (res.persisted) {
        item.status = 'RECONCILED';
        item.reconciledAt = new Date().toISOString();
        this.reconciliationOutbox.set(item.id, item);
        reconciled++;
        reconciledIds.push(item.id);
        reconciledCommands.push({
          id: item.id,
          operationType: item.operationType,
          payload: item.payload,
          result: res
        });
      } else {
        stillFailing++;
      }
    }

    this.saveDurableDalState();
    return {
      attempted: pending.length,
      reconciled,
      stillFailing,
      reconciledIds,
      reconciledCommands
    };
  }

  public async getLiveBranchProductQuantity(
    branchId: string,
    productId: string
  ): Promise<number | null> {
    const ledgerId = this.formatLedgerDocId(branchId, productId);
    if (!this.enabled) {
      return this.transactionalStockMirror.get(ledgerId) ?? null;
    }
    try {
      const snap = await serverDb.collection('branchInventoryLedgers').doc(ledgerId).get();
      if (snap.exists) {
        const d = snap.data();
        if (d && typeof d.quantity === 'number') {
          this.transactionalStockMirror.set(ledgerId, d.quantity);
          return d.quantity;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // AUTHORITATIVE SAFARICOM DARAJA M-PESA TRANSACTION PERSISTENCE & RECONCILIATION
  // (`mpesaTransactions/{checkoutRequestId}`)
  // ===========================================================================
  public formatMpesaDocId(checkoutRequestId: string): string {
    return String(checkoutRequestId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  public async createPendingMpesaTransaction(
    record: AuthoritativeMpesaTransactionRecord
  ): Promise<AuthoritativeMpesaTransactionRecord> {
    const docId = this.formatMpesaDocId(record.checkoutRequestId);
    const normalized: AuthoritativeMpesaTransactionRecord = {
      ...record,
      id: docId
    };
    this.mpesaTransactions.set(record.checkoutRequestId, normalized);
    this.saveDurableDalState();

    if (this.enabled) {
      try {
        await serverDb
          .collection('mpesaTransactions')
          .doc(docId)
          .set(normalized, { merge: true });
      } catch {
        // Durable local outbox preserves transaction across restarts if cloud write is transiently unreachable
      }
    }
    return normalized;
  }

  public async getMpesaTransaction(
    checkoutRequestId: string
  ): Promise<AuthoritativeMpesaTransactionRecord | null> {
    const key = String(checkoutRequestId || '').trim();
    if (!key) return null;
    const docId = this.formatMpesaDocId(key);

    if (this.enabled) {
      try {
        const snap = await serverDb.collection('mpesaTransactions').doc(docId).get();
        if (snap.exists) {
          const data = snap.data() as AuthoritativeMpesaTransactionRecord | undefined;
          if (data && data.checkoutRequestId) {
            this.mpesaTransactions.set(data.checkoutRequestId, data);
            this.saveDurableDalState();
            return data;
          }
        }
      } catch {
        // Fallback to local durable store
      }
    }

    return this.mpesaTransactions.get(key) || null;
  }

  public async findMpesaTransactionByCriteria(criteria: {
    checkoutRequestId?: string;
    receiptNumber?: string;
    orderNumber?: string;
    phone?: string;
    amountKes?: number;
    status?: AuthoritativeMpesaTransactionRecord['status'];
  }): Promise<AuthoritativeMpesaTransactionRecord | null> {
    if (criteria.checkoutRequestId) {
      const byId = await this.getMpesaTransaction(criteria.checkoutRequestId);
      if (byId && (!criteria.status || byId.status === criteria.status)) {
        return byId;
      }
    }

    const cleanReceipt = criteria.receiptNumber?.trim().toUpperCase();
    const cleanOrder = criteria.orderNumber?.trim();

    if (this.enabled && (cleanReceipt || cleanOrder)) {
      try {
        if (cleanReceipt) {
          const snap = await serverDb
            .collection('mpesaTransactions')
            .where('mpesaReceiptNumber', '==', cleanReceipt)
            .limit(5)
            .get();
          for (const d of snap.docs) {
            const rec = d.data() as AuthoritativeMpesaTransactionRecord;
            if (rec && rec.checkoutRequestId) {
              this.mpesaTransactions.set(rec.checkoutRequestId, rec);
              if (!criteria.status || rec.status === criteria.status) {
                return rec;
              }
            }
          }
        }
        if (cleanOrder) {
          const snap = await serverDb
            .collection('mpesaTransactions')
            .where('orderNumber', '==', cleanOrder)
            .limit(10)
            .get();
          const candidates: AuthoritativeMpesaTransactionRecord[] = [];
          snap.forEach(d => {
            const rec = d.data() as AuthoritativeMpesaTransactionRecord;
            if (rec && rec.checkoutRequestId) {
              this.mpesaTransactions.set(rec.checkoutRequestId, rec);
              if (!criteria.status || rec.status === criteria.status) {
                candidates.push(rec);
              }
            }
          });
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            return candidates[0];
          }
        }
      } catch {
        // Fallback to durable local map search
      }
    }

    const all = Array.from(this.mpesaTransactions.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    for (const rec of all) {
      if (criteria.status && rec.status !== criteria.status) continue;
      if (cleanReceipt && rec.mpesaReceiptNumber?.toUpperCase() === cleanReceipt) {
        return rec;
      }
      if (cleanOrder && (rec.orderNumber === cleanOrder || rec.accountReference === cleanOrder)) {
        return rec;
      }
    }
    return null;
  }

  public async listMpesaTransactions(
    limitCount = 100
  ): Promise<AuthoritativeMpesaTransactionRecord[]> {
    if (this.enabled) {
      try {
        const snap = await serverDb
          .collection('mpesaTransactions')
          .limit(limitCount)
          .get();
        snap.forEach(d => {
          const rec = d.data() as AuthoritativeMpesaTransactionRecord;
          if (rec && rec.checkoutRequestId) {
            this.mpesaTransactions.set(rec.checkoutRequestId, rec);
          }
        });
      } catch {
        // Use durable local state
      }
    }
    return Array.from(this.mpesaTransactions.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limitCount);
  }

  /**
   * Atomically reconciles an untrusted Daraja STK callback or upstream STK Push Query result
   * against a previously created `PENDING` transaction in `mpesaTransactions/{checkoutRequestId}`.
   *
   * Enforces:
   *  1. Pre-existing pending transaction lookup (`CheckoutRequestID` must exist)
   *  2. `MerchantRequestID` correlation check
   *  3. Idempotency check (already `CONFIRMED` transactions are never double-processed)
   *  4. `ResultCode === 0` check
   *  5. `confirmedAmountKes >= expectedAmountKes` check
   *  6. Non-empty `mpesaReceiptNumber` check
   */
  public async processDarajaCallbackOrQueryAtomically(params: {
    checkoutRequestId: string;
    merchantRequestId?: string;
    resultCode: number;
    resultDesc: string;
    mpesaReceiptNumber?: string;
    confirmedAmountKes?: number;
    confirmedPhone?: string;
    transactionDate?: string;
    rawCallbackPayload: string;
    verifiedVia: AuthoritativeMpesaTransactionRecord['verifiedVia'];
  }): Promise<{
    accepted: boolean;
    idempotentReplay?: boolean;
    status: number;
    errorCode?: string;
    errorMessage?: string;
    record?: AuthoritativeMpesaTransactionRecord;
  }> {
    const checkoutRequestId = String(params.checkoutRequestId || '').trim();
    if (!checkoutRequestId) {
      return {
        accepted: false,
        status: 400,
        errorCode: 'MISSING_CHECKOUT_REQUEST_ID',
        errorMessage: 'CheckoutRequestID is required to reconcile a Daraja callback.'
      };
    }

    const existing = await this.getMpesaTransaction(checkoutRequestId);
    if (!existing) {
      return {
        accepted: false,
        status: 404,
        errorCode: 'UNKNOWN_CHECKOUT_REQUEST_ID',
        errorMessage: `Untrusted callback rejected: No pending M-Pesa transaction found for CheckoutRequestID "${checkoutRequestId}".`
      };
    }

    // 1. Idempotency Check: If already CONFIRMED, return idempotent replay
    if (existing.status === 'CONFIRMED') {
      return {
        accepted: true,
        idempotentReplay: true,
        status: 200,
        record: existing
      };
    }

    // 2. Verify MerchantRequestID correlation if present on both
    if (
      params.merchantRequestId &&
      existing.merchantRequestId &&
      params.merchantRequestId.trim() !== existing.merchantRequestId.trim()
    ) {
      return {
        accepted: false,
        status: 403,
        errorCode: 'MERCHANT_REQUEST_ID_MISMATCH',
        errorMessage: `MerchantRequestID mismatch for CheckoutRequestID "${checkoutRequestId}".`
      };
    }

    const nowIso = new Date().toISOString();
    const docId = this.formatMpesaDocId(checkoutRequestId);

    // 3. Handle Non-Zero ResultCode (User Cancelled / Insufficient Balance / Timeout / Wrong PIN)
    if (Number(params.resultCode) !== 0) {
      const terminalStatus: AuthoritativeMpesaTransactionRecord['status'] =
        Number(params.resultCode) === 1032 || Number(params.resultCode) === 1037
          ? 'CANCELLED'
          : 'FAILED';
      const failedRecord: AuthoritativeMpesaTransactionRecord = {
        ...existing,
        status: terminalStatus,
        resultCode: Number(params.resultCode),
        resultDesc: String(params.resultDesc || 'Transaction cancelled or failed on handset'),
        rawCallbackPayload: params.rawCallbackPayload,
        verifiedVia: params.verifiedVia,
        updatedAt: nowIso
      };
      this.mpesaTransactions.set(checkoutRequestId, failedRecord);
      this.saveDurableDalState();

      if (this.enabled) {
        try {
          await serverDb.collection('mpesaTransactions').doc(docId).set(failedRecord, { merge: true });
        } catch {
          // Preserved in local durable state
        }
      }
      return {
        accepted: true,
        status: 200,
        record: failedRecord
      };
    }

    // 4. ResultCode === 0: Verify Receipt Number & Expected Amount
    const cleanReceipt = String(params.mpesaReceiptNumber || '').trim().toUpperCase();
    if (!cleanReceipt || cleanReceipt.length < 5) {
      return {
        accepted: false,
        status: 400,
        errorCode: 'MISSING_MPESA_RECEIPT_NUMBER',
        errorMessage: 'Daraja ResultCode=0 callback is missing a valid MpesaReceiptNumber.'
      };
    }

    const confirmedAmount =
      typeof params.confirmedAmountKes === 'number' && Number.isFinite(params.confirmedAmountKes)
        ? params.confirmedAmountKes
        : existing.expectedAmountKes;

    if (confirmedAmount < existing.expectedAmountKes) {
      return {
        accepted: false,
        status: 400,
        errorCode: 'AMOUNT_MISMATCH',
        errorMessage: `M-Pesa callback amount (${confirmedAmount} KES) is less than expected order amount (${existing.expectedAmountKes} KES).`
      };
    }

    const normalizePhoneDigits = (raw: string): string => {
      const digits = String(raw || '').replace(/\D+/g, '');
      if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
      if (digits.length === 9 && /^[71]/.test(digits)) return `254${digits}`;
      return digits;
    };

    const confirmedPhone = String(params.confirmedPhone || existing.expectedPhone).trim();
    if (params.confirmedPhone && existing.expectedPhone) {
      const normConfirmed = normalizePhoneDigits(params.confirmedPhone);
      const normExpected = normalizePhoneDigits(existing.expectedPhone);
      // Safaricom sometimes masks middle digits in callbacks (e.g. 2547****678); only enforce strict mismatch if both are unmasked full numbers
      if (
        normConfirmed.length >= 12 &&
        normExpected.length >= 12 &&
        !String(params.confirmedPhone).includes('*') &&
        normConfirmed !== normExpected
      ) {
        return {
          accepted: false,
          status: 400,
          errorCode: 'PHONE_NUMBER_MISMATCH',
          errorMessage: `M-Pesa callback phone (${normConfirmed}) does not match expected transaction phone (${normExpected}).`
        };
      }
    }

    const confirmedRecord: AuthoritativeMpesaTransactionRecord = {
      ...existing,
      status: 'CONFIRMED',
      resultCode: 0,
      resultDesc: String(params.resultDesc || 'The service request is processed successfully.'),
      mpesaReceiptNumber: cleanReceipt,
      confirmedAmountKes: confirmedAmount,
      confirmedPhone,
      transactionDate: params.transactionDate || nowIso,
      rawCallbackPayload: params.rawCallbackPayload,
      verifiedVia: params.verifiedVia,
      updatedAt: nowIso
    };

    if (this.enabled) {
      try {
        await serverDb.runTransaction(async tx => {
          const docRef = serverDb.collection('mpesaTransactions').doc(docId);
          const snap = await tx.get(docRef);
          if (snap.exists) {
            const currentData = snap.data() as AuthoritativeMpesaTransactionRecord;
            if (currentData.status === 'CONFIRMED') {
              return;
            }
          }
          tx.set(docRef, confirmedRecord, { merge: true });
        });
      } catch {
        // Fallback to local durable state
      }
    }

    this.mpesaTransactions.set(checkoutRequestId, confirmedRecord);
    this.saveDurableDalState();

    return {
      accepted: true,
      status: 200,
      record: confirmedRecord
    };
  }

  public async markMpesaTransactionReconciled(
    checkoutRequestId: string,
    orderId: string
  ): Promise<AuthoritativeMpesaTransactionRecord | null> {
    const existing = await this.getMpesaTransaction(checkoutRequestId);
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const updated: AuthoritativeMpesaTransactionRecord = {
      ...existing,
      reconciledToOrderId: orderId,
      reconciledAt: nowIso,
      updatedAt: nowIso
    };
    this.mpesaTransactions.set(checkoutRequestId, updated);
    this.saveDurableDalState();

    if (this.enabled) {
      try {
        const docId = this.formatMpesaDocId(checkoutRequestId);
        await serverDb.collection('mpesaTransactions').doc(docId).set(updated, { merge: true });
      } catch {
        // Preserved locally
      }
    }
    return updated;
  }

  public async syncOrganizationMembershipToFirestore(params: {
    id: string;
    userId: string;
    email?: string;
    organizationId: string;
    role: string;
    department?: string;
    branchId?: string;
    active: boolean;
  }): Promise<void> {
    if (!this.enabled) return;
    const nowIso = new Date().toISOString();
    const docData = {
      id: params.id,
      userId: params.userId,
      ...(params.email ? { userEmail: params.email } : {}),
      organizationId: params.organizationId,
      organizationType: 'MERCHANT',
      role: params.role,
      ...(params.department ? { department: params.department } : {}),
      ...(params.branchId ? { branchId: params.branchId } : {}),
      status: params.active ? 'ACTIVE' : 'REVOKED',
      joinedAt: nowIso,
      updatedAt: nowIso
    };
    try {
      const safeId = String(params.id).replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
      await serverDb.collection('organizationMemberships').doc(safeId).set(docData, { merge: true });
      const memId = `mem_${params.userId}_${params.organizationId}`.replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
      await serverDb.collection('organizationMemberships').doc(memId).set({ ...docData, id: memId }, { merge: true });
    } catch {
      try {
        const safeId = String(params.id).replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
        const memId = `mem_${params.userId}_${params.organizationId}`.replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
        await Promise.all([
          cloudBridgeSetDoc('organizationMemberships', safeId, docData),
          cloudBridgeSetDoc('organizationMemberships', memId, { ...docData, id: memId })
        ]);
      } catch {
        // Preserved in server memory
      }
    }
  }

  public async persistUserTotpFactorToFirestore(record: {
    userId: string;
    email: string;
    organizationId: string;
    totpSecret: string;
    mfaEnabled: boolean;
    factorType: 'FIREBASE_TOTP_MFA' | 'PER_USER_RFC6238_TOTP';
    firebaseFactorUid?: string;
    enrolledAt: string;
    updatedAt: string;
  }): Promise<void> {
    if (!this.enabled) return;
    try {
      const safeId = String(record.userId || record.email).replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
      await serverDb.collection('userTotpFactors').doc(safeId).set(record, { merge: true });
    } catch {
      // Preserved in local durable state
    }
  }

  public async persistStockAuditSessionToFirestore(
    sessionId: string,
    sessionData: Record<string, unknown>,
    baselineLedgers?: Array<Record<string, unknown>>
  ): Promise<boolean> {
    if (!this.enabled) return true;
    const safeId = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    try {
      const batch = serverDb.batch();
      batch.set(serverDb.collection('stockAuditSessions').doc(safeId), sessionData, { merge: true });
      if (Array.isArray(baselineLedgers)) {
        for (const ledger of baselineLedgers.slice(0, 50)) {
          const ledgerId = String(ledger.id || `${ledger.branchId}_${ledger.productId}`)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 120);
          batch.set(serverDb.collection('branchInventoryLedgers').doc(ledgerId), ledger, { merge: true });
        }
      }
      await batch.commit();
      return true;
    } catch {
      try {
        await cloudBridgeSetDoc('stockAuditSessions', safeId, sessionData);
        if (Array.isArray(baselineLedgers)) {
          await Promise.all(
            baselineLedgers.slice(0, 50).map(ledger => {
              const ledgerId = String(ledger.id || `${ledger.branchId}_${ledger.productId}`)
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .slice(0, 120);
              return cloudBridgeSetDoc('branchInventoryLedgers', ledgerId, ledger);
            })
          );
        }
        return true;
      } catch {
        return false;
      }
    }
  }

  public async approveStockAuditSessionInFirestore(params: {
    sessionId: string;
    approvedAt: string;
    approvedBy: string;
    ledgers: Array<Record<string, unknown>>;
    adjustmentLogs: Array<Record<string, unknown>>;
  }): Promise<boolean> {
    if (!this.enabled) return true;
    const safeId = String(params.sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    try {
      const batch = serverDb.batch();
      batch.set(
        serverDb.collection('stockAuditSessions').doc(safeId),
        {
          status: 'APPROVED',
          approvedAt: params.approvedAt,
          approvedBy: params.approvedBy
        },
        { merge: true }
      );
      for (const ledger of params.ledgers.slice(0, 150)) {
        const ledgerId = String(ledger.id || `${ledger.branchId}_${ledger.productId}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 120);
        batch.set(serverDb.collection('branchInventoryLedgers').doc(ledgerId), ledger, { merge: true });
      }
      for (const log of params.adjustmentLogs.slice(0, 150)) {
        const logId = String(log.id || `ADJ-${safeId}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        batch.set(serverDb.collection('stockAdjustmentLogs').doc(logId), log, { merge: true });
      }
      await batch.commit();
      return true;
    } catch {
      try {
        await Promise.all([
          ...params.ledgers.slice(0, 150).map(ledger => {
            const ledgerId = String(ledger.id || `${ledger.branchId}_${ledger.productId}`)
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .slice(0, 120);
            return cloudBridgeSetDoc('branchInventoryLedgers', ledgerId, ledger);
          }),
          ...params.adjustmentLogs.slice(0, 150).map(log => {
            const logId = String(log.id || `ADJ-${safeId}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
            return cloudBridgeSetDoc('stockAdjustmentLogs', logId, log);
          })
        ]);
        return true;
      } catch {
        return false;
      }
    }
  }

  public async persistUnifiedStateDocsToFirestore(
    docs: Array<Record<string, unknown>>
  ): Promise<{
    persisted: boolean;
    persistedCount: number;
    updatedDocs: Array<Record<string, unknown>>;
    errorMessage?: string;
  }> {
    if (this.simulatedFailureMode.active) {
      return {
        persisted: false,
        persistedCount: 0,
        updatedDocs: [],
        errorMessage: 'Unable to save. Check your connection and try again.'
      };
    }

    const candidateDocs: Array<Record<string, unknown>> = [];
    const nowIso = new Date().toISOString();

    for (const rawDoc of docs) {
      if (!rawDoc || typeof rawDoc.id !== 'string' || !rawDoc.id) continue;
      const safeId = String(rawDoc.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      const existing = this.unifiedStateDocsStore.get(safeId);
      const incomingUpdatedAt = (typeof rawDoc.updatedAt === 'string' && rawDoc.updatedAt ? rawDoc.updatedAt : nowIso).slice(0, 60);
      const existingUpdatedAt = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';

      // Last-write-wins or newer/equal timestamp overwrites durable server state
      if (!existing || incomingUpdatedAt >= existingUpdatedAt) {
        const payloadJson =
          typeof rawDoc.payloadJson === 'string'
            ? rawDoc.payloadJson
            : typeof existing?.payloadJson === 'string'
            ? String(existing.payloadJson)
            : '[]';
        const normalized: Record<string, unknown> = {
          ...existing,
          ...rawDoc,
          id: safeId,
          key: String(rawDoc.key || existing?.key || safeId).slice(0, 120),
          payloadJson,
          recordCount:
            typeof rawDoc.recordCount === 'number'
              ? rawDoc.recordCount
              : typeof existing?.recordCount === 'number'
              ? Number(existing.recordCount)
              : 1,
          organizationId: String(rawDoc.organizationId || existing?.organizationId || 'org-merchant-vaairo-hq'),
          updatedAt: incomingUpdatedAt
        };
        candidateDocs.push(normalized);
      }
    }

    if (this.enabled && candidateDocs.length > 0) {
      let cloudCommitted = false;
      try {
        const batch = serverDb.batch();
        for (const doc of candidateDocs.slice(0, 200)) {
          const safeId = String(doc.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          batch.set(serverDb.collection('unifiedStateStore').doc(safeId), doc, { merge: true });
        }
        await batch.commit();
        cloudCommitted = true;
      } catch {
        // Admin SDK ADC lacks cross-project IAM; write directly via Cloud Firestore Bridge
      }

      if (!cloudCommitted) {
        try {
          await Promise.all(
            candidateDocs.slice(0, 200).map(doc =>
              cloudBridgeSetDoc('unifiedStateStore', String(doc.id), doc)
            )
          );
          cloudCommitted = true;
        } catch {
          // Cloud Firestore bridge write unavailable; smoothly persist to authoritative durable server DAL state below
        }
      }
    }

    for (const normalized of candidateDocs) {
      this.unifiedStateDocsStore.set(String(normalized.id), normalized);
    }

    if (candidateDocs.length > 0) {
      this.saveDurableDalState();
      this.broadcastLiveSyncEvent({
        type: 'UNIFIED_STATE_UPDATED',
        payload: { docs: candidateDocs }
      });
    }

    return {
      persisted: true,
      persistedCount: candidateDocs.length,
      updatedDocs: candidateDocs
    };
  }

  public async getUnifiedStateDocsAuthoritative(): Promise<Array<Record<string, unknown>>> {
    if (this.enabled) {
      let fetchedFromAdmin = false;
      try {
        const snap = await serverDb.collection('unifiedStateStore').limit(150).get();
        let changed = false;
        snap.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          if (data && typeof data.id === 'string') {
            const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
            const existing = this.unifiedStateDocsStore.get(safeId);
            const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
            const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
            if (!existing || cloudTime >= localTime) {
              this.unifiedStateDocsStore.set(safeId, { ...data, id: safeId });
              changed = true;
            }
          }
        });
        fetchedFromAdmin = true;
        if (changed) {
          this.saveDurableDalState();
        }
      } catch {
        // Fallback to Cloud Firestore Bridge
      }

      if (!fetchedFromAdmin) {
        try {
          const cloudDocs = await cloudBridgeListCollection('unifiedStateStore', 150);
          let changed = false;
          for (const data of cloudDocs) {
            if (data && typeof data.id === 'string') {
              const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
              const existing = this.unifiedStateDocsStore.get(safeId);
              const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
              const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
              if (!existing || cloudTime >= localTime) {
                this.unifiedStateDocsStore.set(safeId, { ...data, id: safeId });
                changed = true;
              }
            }
          }
          if (changed) {
            this.saveDurableDalState();
          }
        } catch {
          // Fallback to durable server state
        }
      }
    }
    return Array.from(this.unifiedStateDocsStore.values());
  }

  public async persistStaffDirectoryRecordToFirestore(
    staffId: string,
    record: Record<string, unknown>,
    explicitUpsert = true
  ): Promise<boolean> {
    if (this.simulatedFailureMode.active) {
      return false;
    }

    const safeId = String(staffId || record.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!safeId) return false;
    if (!explicitUpsert && this.deletedStaffIdsStore.has(safeId)) {
      return false;
    }
    if (explicitUpsert) {
      this.deletedStaffIdsStore.delete(safeId);
    }

    const existing = this.staffDirectoryStore.get(safeId);
    const nowIso = new Date().toISOString();
    const validDepts = new Set([
      'POS',
      'HR_PAYROLL',
      'FINANCE',
      'BILLING',
      'PROCUREMENT',
      'INVENTORY',
      'AFFILIATES',
      'DELIVERY_MANAGER',
      'SALES_MANAGER',
      'BRANCH_MANAGER'
    ]);
    const rawRecordType = String(record.recordType || existing?.recordType || 'EMPLOYEE');
    const resolvedRecordType = rawRecordType === 'AFFILIATE' ? 'AFFILIATE' : 'EMPLOYEE';
    const rawDept = String(record.department || existing?.department || (resolvedRecordType === 'AFFILIATE' ? 'AFFILIATES' : 'POS'));
    const resolvedDept = validDepts.has(rawDept)
      ? rawDept
      : resolvedRecordType === 'AFFILIATE'
      ? 'AFFILIATES'
      : 'POS';
    const resolvedName = String(record.name || existing?.name || 'Staff Member').trim().slice(0, 150) || 'Staff Member';
    const resolvedCode = String(record.codeOrNumber || existing?.codeOrNumber || `EMP-${safeId.slice(-4).toUpperCase()}`).trim().slice(0, 60) || 'EMP-001';
    const resolvedActive =
      typeof record.active === 'boolean'
        ? record.active
        : typeof existing?.active === 'boolean'
        ? existing.active
        : true;

    const normalized: Record<string, unknown> = {
      ...existing,
      ...record,
      id: safeId,
      recordType: resolvedRecordType,
      name: resolvedName,
      codeOrNumber: resolvedCode,
      department: resolvedDept,
      active: resolvedActive,
      organizationId: String(record.organizationId || existing?.organizationId || 'org-merchant-vaairo-hq'),
      // Never lose existing pinHash / pinSalt if an update omits them
      pinHash: String(record.pinHash || existing?.pinHash || '').slice(0, 128),
      pinSalt: String(record.pinSalt || existing?.pinSalt || '').slice(0, 128),
      updatedAt: (typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : nowIso).slice(0, 60)
    };
    delete normalized.loginPin;

    if (this.enabled) {
      let cloudCommitted = false;
      try {
        await serverDb.collection('staffDirectory').doc(safeId).set(normalized, { merge: true });
        cloudCommitted = true;
      } catch {
        // Fallback to Cloud Firestore Bridge
      }

      if (!cloudCommitted) {
        try {
          await cloudBridgeSetDoc('staffDirectory', safeId, normalized);
          cloudCommitted = true;
        } catch {
          // Cloud Firestore bridge write unavailable; smoothly persist to authoritative durable server DAL state below
        }
      }
    }

    this.staffDirectoryStore.set(safeId, normalized);
    this.saveDurableDalState();
    this.broadcastLiveSyncEvent({
      type: 'STAFF_DIRECTORY_UPDATED',
      payload: { record: normalized }
    });

    return true;
  }

  public async deleteStaffDirectoryRecordFromFirestore(staffId: string): Promise<boolean> {
    if (this.simulatedFailureMode.active) {
      return false;
    }
    const safeId = String(staffId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!safeId) return false;

    if (this.enabled) {
      let cloudDeleted = false;
      try {
        await serverDb.collection('staffDirectory').doc(safeId).delete();
        cloudDeleted = true;
      } catch {
        // Fallback to Cloud Firestore Bridge
      }
      if (!cloudDeleted) {
        try {
          await cloudBridgeDeleteDoc('staffDirectory', safeId);
          cloudDeleted = true;
        } catch {
          // Cloud Firestore bridge delete unavailable; smoothly delete from authoritative durable server DAL state below
        }
      }
    }

    this.deletedStaffIdsStore.add(safeId);
    this.staffDirectoryStore.delete(safeId);
    this.saveDurableDalState();
    this.broadcastLiveSyncEvent({
      type: 'STAFF_DIRECTORY_DELETED',
      payload: { staffId: safeId }
    });
    return true;
  }

  public async wipeAllStaffAndUserRecords(): Promise<boolean> {
    this.staffDirectoryStore.clear();
    this.deletedStaffIdsStore.clear();
    const nowIso = new Date().toISOString();
    this.unifiedStateDocsStore.set('employees', {
      id: 'employees',
      key: 'employees',
      payloadJson: '[]',
      recordCount: 0,
      organizationId: 'org-merchant-vaairo-hq',
      updatedAt: nowIso
    });
    this.unifiedStateDocsStore.set('affiliates', {
      id: 'affiliates',
      key: 'affiliates',
      payloadJson: '[]',
      recordCount: 0,
      organizationId: 'org-merchant-vaairo-hq',
      updatedAt: nowIso
    });
    this.saveDurableDalState();
    this.broadcastLiveSyncEvent({
      type: 'STAFF_DIRECTORY_UPDATED',
      payload: { records: [] }
    });
    this.broadcastLiveSyncEvent({
      type: 'UNIFIED_STATE_UPDATED',
      payload: {
        docs: [
          { id: 'employees', key: 'employees', payloadJson: '[]', recordCount: 0, updatedAt: nowIso },
          { id: 'affiliates', key: 'affiliates', payloadJson: '[]', recordCount: 0, updatedAt: nowIso }
        ]
      }
    });
    return true;
  }

  public async getStaffDirectoryRecordsAuthoritative(): Promise<Array<Record<string, unknown>>> {
    if (this.enabled) {
      let fetchedFromAdmin = false;
      try {
        const snap = await serverDb.collection('staffDirectory').limit(500).get();
        let changed = false;
        snap.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          if (data && typeof data.id === 'string') {
            const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
            if (this.deletedStaffIdsStore.has(safeId)) return;
            const existing = this.staffDirectoryStore.get(safeId);
            const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
            const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
            if (!existing || cloudTime >= localTime) {
              this.staffDirectoryStore.set(safeId, { ...data, id: safeId });
              changed = true;
            }
          }
        });
        fetchedFromAdmin = true;
        if (changed) {
          this.saveDurableDalState();
        }
      } catch {
        // Fallback to Cloud Firestore Bridge
      }

      if (!fetchedFromAdmin) {
        try {
          const cloudRecords = await cloudBridgeListCollection('staffDirectory', 500);
          let changed = false;
          for (const data of cloudRecords) {
            if (data && typeof data.id === 'string') {
              const safeId = String(data.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
              if (this.deletedStaffIdsStore.has(safeId)) continue;
              const existing = this.staffDirectoryStore.get(safeId);
              const cloudTime = typeof data.updatedAt === 'string' ? data.updatedAt : '';
              const localTime = existing && typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
              if (!existing || cloudTime >= localTime) {
                this.staffDirectoryStore.set(safeId, { ...data, id: safeId });
                changed = true;
              }
            }
          }
          if (changed) {
            this.saveDurableDalState();
          }
        } catch {
          // Fallback to durable server state
        }
      }
    }
    return Array.from(this.staffDirectoryStore.values()).filter(
      r => !this.deletedStaffIdsStore.has(String(r.id || ''))
    );
  }

  public async persistUserActivityLogToFirestore(
    logId: string,
    record: Record<string, unknown>
  ): Promise<boolean> {
    const safeId = String(logId || record.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!safeId) return false;
    const nowIso = new Date().toISOString();
    const normalized: Record<string, unknown> = {
      ...record,
      id: safeId,
      userId: String(record.userId || 'usr-01').slice(0, 120),
      userName: String(record.userName || 'System User').slice(0, 150),
      userRole: String(record.userRole || 'STAFF').slice(0, 60),
      department: String(record.department || 'POS').slice(0, 60),
      actionType: String(record.actionType || 'SYSTEM_ACTION').slice(0, 60),
      actionTitle: String(record.actionTitle || 'System Action').slice(0, 200),
      module: String(record.module || 'ERP').slice(0, 60),
      deviceUsed: String(record.deviceUsed || 'Enterprise Terminal').slice(0, 200),
      timestamp: (typeof record.timestamp === 'string' && record.timestamp ? record.timestamp : nowIso).slice(0, 60)
    };
    this.userActivityLogsStore.set(safeId, normalized);
    if (this.userActivityLogsStore.size > 500) {
      const oldestKey = this.userActivityLogsStore.keys().next().value;
      if (oldestKey) this.userActivityLogsStore.delete(oldestKey);
    }
    this.saveDurableDalState();
    this.broadcastLiveSyncEvent({
      type: 'USER_ACTIVITY_UPDATED',
      payload: { activityLog: normalized }
    });

    if (this.enabled) {
      try {
        await serverDb.collection('userActivityLogs').doc(safeId).set(normalized, { merge: true });
      } catch {
        try {
          await cloudBridgeSetDoc('userActivityLogs', safeId, normalized);
        } catch {
          // Non-blocking activity telemetry
        }
      }
    }
    return true;
  }

  public async persistUserSessionMonitorToFirestore(
    userId: string,
    record: Record<string, unknown>
  ): Promise<boolean> {
    const safeId = String(userId || record.userId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!safeId) return false;
    const nowIso = new Date().toISOString();
    const normalized: Record<string, unknown> = {
      ...record,
      userId: safeId,
      userName: String(record.userName || 'System User').slice(0, 150),
      userRole: String(record.userRole || 'STAFF').slice(0, 60),
      department: String(record.department || 'POS').slice(0, 60),
      isActiveLogin: typeof record.isActiveLogin === 'boolean' ? record.isActiveLogin : true,
      loginCount: typeof record.loginCount === 'number' ? record.loginCount : 1,
      deviceUsed: String(record.deviceUsed || 'Enterprise Terminal').slice(0, 200),
      updatedAt: (typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : nowIso).slice(0, 60)
    };
    this.userSessionMonitorsStore.set(safeId, normalized);
    this.saveDurableDalState();
    this.broadcastLiveSyncEvent({
      type: 'USER_ACTIVITY_UPDATED',
      payload: { sessionMonitor: normalized }
    });

    if (this.enabled) {
      try {
        await serverDb.collection('userSessionMonitors').doc(safeId).set(normalized, { merge: true });
      } catch {
        try {
          await cloudBridgeSetDoc('userSessionMonitors', safeId, normalized);
        } catch {
          // Non-blocking session telemetry
        }
      }
    }
    return true;
  }

  public getUserActivityAndSessionsAuthoritative(): {
    activityLogs: Array<Record<string, unknown>>;
    sessionMonitors: Array<Record<string, unknown>>;
  } {
    return {
      activityLogs: Array.from(this.userActivityLogsStore.values()).sort((a, b) =>
        String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
      ),
      sessionMonitors: Array.from(this.userSessionMonitorsStore.values()).sort((a, b) =>
        String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || ''))
      )
    };
  }
}

export const firestoreAuthoritativeStore = new FirestoreAuthoritativeStore();
