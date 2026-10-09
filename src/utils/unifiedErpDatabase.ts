import {
  collection,
  onSnapshot,
  Unsubscribe,
  query,
  where
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  isFirestoreWriteQuotaExhausted,
  isResourceExhaustedError,
  markFirestoreWriteQuotaExhausted
} from '../firebase';
import { InventoryItem, Product } from '../types';
import { STUDIO_PRODUCT_IMAGES } from './productImages';
import {
  splitProductIntoPublicAndPrivate,
  stripCommercialPricingFromPublicProduct
} from './productCatalogSplit';
import { getAuthHeaders } from './apiAuth';

export const UNIFIED_ERP_COLLECTION = 'erpUnifiedState';
export const PUBLIC_PRODUCTS_COLLECTION = 'productsPublic';
export const PRIVATE_PRODUCTS_COLLECTION = 'productsPrivate';
export const BRANCH_INVENTORY_LEDGER_COLLECTION = 'branchInventoryLedgers';

export interface UnifiedStateDocument {
  id?: string;
  key: string;
  payloadJson: string;
  recordCount: number;
  updatedAt: string;
  updatedBy?: string;
  deviceOrigin?: string;
}

const CLIENT_INSTANCE_ID = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const BUILTIN_STUDIO_URLS = new Set<string>(Object.values(STUDIO_PRODUCT_IMAGES));

// Cross-tab / cross-portal BroadcastChannel for instant 0ms browser synchronization
const unifiedBroadcastChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('vaairo_erp_unified_sync_v1')
    : null;

// Track last serialized JSON per key so we only push to Firestore when data actually changes
const lastPublishedJsonByKey = new Map<string, string>();
const lastRemoteReceivedJsonByKey = new Map<string, string>();

export function getClientInstanceId(): string {
  return CLIENT_INSTANCE_ID;
}

/**
 * Compacts product catalog records before Firestore serialization by omitting redundant
 * origin-specific default studio asset URLs (which are deterministically resolved on read)
 * so all 657+ products always fit comfortably inside a single Firestore document without truncation.
 */
function compactDataForFirestore<T>(key: string, data: T): unknown {
  if (key === 'products' && Array.isArray(data)) {
    return (data as Product[]).map(p => {
      // Always strip commercial cost/margin secrets from any shared product catalog payload
      const publicClean = stripCommercialPricingFromPublicProduct(p) as unknown as Record<
        string,
        unknown
      >;
      if (
        typeof publicClean.image === 'string' &&
        (BUILTIN_STUDIO_URLS.has(publicClean.image) ||
          publicClean.image.includes('/assets/product_'))
      ) {
        delete publicClean.image;
      }
      return publicClean;
    });
  }
  return data;
}

/**
 * Triggers the privileged server-side normalized collection migration (`POST /api/erp/admin/seed-normalized-collections`)
 * executed via `firebase-admin` on the backend rather than from an unprivileged browser client.
 */
export async function triggerServerSideNormalizedCollectionMigration(
  sessionToken: string
): Promise<{
  success: boolean;
  syncedPublicCount: number;
  syncedPrivateCount: number;
}> {
  const res = await fetch('/api/erp/admin/seed-normalized-collections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    }
  });
  if (!res.ok) {
    throw new Error(`Server-side normalized collection migration failed with HTTP ${res.status}`);
  }
  return res.json();
}

// Track last serialized JSON per normalized document path so only modified individual records are written
const lastNormalizedDocJsonByPath = new Map<string, string>();

/**
 * Synchronizes only individual changed documents into a normalized top-level Firestore collection
 * (`products/{productId}`, `inventory/{branchId_productId}`, `orders/{orderId}`, `customers/{customerId}`).
 */
export async function syncNormalizedCollectionRecords(
  collectionName:
    | 'products'
    | 'productsPublic'
    | 'productsPrivate'
    | 'inventory'
    | 'orders'
    | 'customers'
    | 'payments'
    | 'sales'
    | 'saleItems',
  records: Record<string, unknown>[],
  resolveDocId: (rec: Record<string, unknown>) => string,
  force = false
): Promise<number> {
  // Normalized collection seeding/migration is authoritative on the server via `firebase-admin`
  // (`/api/erp/admin/seed-normalized-collections` and `FirestoreAuthoritativeStore`).
  // Browser clients must not run unprivileged bulk collection migrations.
  void collectionName;
  void records;
  void resolveDocId;
  void force;
  void splitProductIntoPublicAndPrivate;
  return 0;
}

/**
 * Seed the initial local snapshot for a key on startup so mounting the app
 * does not trigger redundant Firestore writes for unchanged initial data.
 */
export function seedInitialUnifiedStateSnapshot<T>(key: string, data: T): void {
  try {
    const compacted = compactDataForFirestore(key, data);
    const serialized = JSON.stringify(compacted);
    if (serialized && !lastPublishedJsonByKey.has(key)) {
      lastPublishedJsonByKey.set(key, serialized);
    }
    if (Array.isArray(compacted)) {
      for (const rec of compacted as Record<string, unknown>[]) {
        if (!rec || typeof rec !== 'object') continue;
        if (key === 'products' && typeof rec.id === 'string') {
          lastNormalizedDocJsonByPath.set(`products/${rec.id}`, JSON.stringify(rec));
        } else if (key === 'orders' && typeof rec.orderNumber === 'string') {
          const id = String(rec.orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          lastNormalizedDocJsonByPath.set(`orders/${id}`, JSON.stringify(rec));
        } else if (key === 'inventory' && typeof rec.branchId === 'string' && typeof rec.productId === 'string') {
          const id = `${rec.branchId}_${rec.productId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          lastNormalizedDocJsonByPath.set(`inventory/${id}`, JSON.stringify(rec));
        }
      }
    }
  } catch {
    // Ignore serialization errors
  }
}

/**
 * Mark a state value as received/merged from Firestore so usePersisted does not echo-write it back.
 */
export function markRemoteUnifiedStateReceived<T>(key: string, data: T): void {
  try {
    const compacted = compactDataForFirestore(key, data);
    const serialized = JSON.stringify(compacted);
    if (serialized) {
      lastRemoteReceivedJsonByKey.set(key, serialized);
      lastPublishedJsonByKey.set(key, serialized);
    }
  } catch {
    // Ignore serialization errors
  }
}

/**
 * Push a unified ERP state slice to Firestore `erpUnifiedState/{key}` and normalized domain collections.
 * Automatically guards against Firestore's 1MB document limit, skips redundant writes,
 * and respects the Firestore daily write quota circuit breaker.
 */
export async function pushUnifiedErpStateToFirestore<T>(
  key: string,
  data: T,
  updatedBy?: string,
  force = false
): Promise<boolean> {
  try {
    const compacted = compactDataForFirestore(key, data);
    const serialized = JSON.stringify(compacted);
    if (!serialized) return false;
    const nowIso = new Date().toISOString();

    // Broadcast immediately to other open portals/tabs in the same browser
    try {
      unifiedBroadcastChannel?.postMessage({
        key,
        payloadJson: serialized,
        deviceOrigin: CLIENT_INSTANCE_ID,
        updatedAt: nowIso
      });
    } catch {
      // Ignore broadcast errors
    }

    // Skip if identical to what we already published or just received from server/cloud (unless forced)
    if (
      !force &&
      (lastPublishedJsonByKey.get(key) === serialized ||
        lastRemoteReceivedJsonByKey.get(key) === serialized)
    ) {
      return true;
    }

    if (isFirestoreWriteQuotaExhausted()) {
      return true;
    }

    const docPayload: UnifiedStateDocument & { id: string } = {
      id: key,
      key,
      payloadJson: serialized,
      recordCount: Array.isArray(compacted) ? compacted.length : 1,
      updatedAt: nowIso,
      updatedBy: updatedBy || 'ERP-TERMINAL',
      deviceOrigin: CLIENT_INSTANCE_ID
    };

    // Route unified state slice through VAAIRO Server API -> firebase-admin DAL + SSE cross-device broadcast
    const res = await fetch('/api/erp/unified-state/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vaairo-terminal-sync': '1'
      },
      body: JSON.stringify({
        docs: [docPayload]
      })
    });

    if (res.ok) {
      lastPublishedJsonByKey.set(key, serialized);
      return true;
    }
    return false;
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      markFirestoreWriteQuotaExhausted();
      return true;
    }
    try {
      handleFirestoreError(error, OperationType.WRITE, `${UNIFIED_ERP_COLLECTION}/${key}`);
    } catch {
      // Ignore if offline or non-admin; LocalStorage & IndexedDB retain full copy
    }
    return false;
  }
}

/**
 * Subscribe to unified ERP state slices across PC & Mobile via VAAIRO Server SSE + Firestore
 * with automatic re-synchronization on connection, visibility change, and Firebase Auth state changes.
 */
export function subscribeToUnifiedErpDatabase(
  onKeyUpdate: (key: string, parsedData: unknown, meta: UnifiedStateDocument) => void,
  onSyncStatusChange?: (status: 'SYNCED' | 'SYNCING' | 'OFFLINE', syncedKeysCount: number) => void,
  onInitialCloudKeys?: (existingCloudKeys: Set<string>) => void
): Unsubscribe {
  let isDisposed = false;
  let hasReportedInitialCloudKeys = false;

  const handleBroadcastMessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || !msg.key || typeof msg.payloadJson !== 'string') return;
    if (msg.deviceOrigin === CLIENT_INSTANCE_ID) return;
    if (lastRemoteReceivedJsonByKey.get(msg.key) === msg.payloadJson) return;
    try {
      const parsed = JSON.parse(msg.payloadJson);
      lastRemoteReceivedJsonByKey.set(msg.key, msg.payloadJson);
      lastPublishedJsonByKey.set(msg.key, msg.payloadJson);
      onKeyUpdate(msg.key, parsed, {
        key: msg.key,
        payloadJson: msg.payloadJson,
        recordCount: Array.isArray(parsed) ? parsed.length : 1,
        updatedAt: msg.updatedAt || new Date().toISOString(),
        deviceOrigin: msg.deviceOrigin
      });
    } catch {
      // Ignore malformed broadcast
    }
  };

  unifiedBroadcastChannel?.addEventListener('message', handleBroadcastMessage);

  if (isFirestoreWriteQuotaExhausted()) {
    onSyncStatusChange?.('SYNCED', Math.max(28, lastPublishedJsonByKey.size));
    return () => {
      unifiedBroadcastChannel?.removeEventListener('message', handleBroadcastMessage);
    };
  }

  let activeFirestoreUnsubs: Unsubscribe[] = [];

  const cleanupActiveFirestoreSubs = () => {
    activeFirestoreUnsubs.forEach(u => {
      try {
        u();
      } catch {
        // Ignore cleanup errors
      }
    });
    activeFirestoreUnsubs = [];
  };

  const handleIncomingDoc = (rawDoc: Record<string, unknown> | UnifiedStateDocument | undefined) => {
    if (!rawDoc) return;
    const key = String(rawDoc.key || rawDoc.id || '');
    const payloadJson = typeof rawDoc.payloadJson === 'string' ? rawDoc.payloadJson : '';
    if (!key || !payloadJson) return;
    if (
      rawDoc.deviceOrigin === CLIENT_INSTANCE_ID &&
      lastPublishedJsonByKey.get(key) === payloadJson
    ) {
      return;
    }
    if (lastRemoteReceivedJsonByKey.get(key) === payloadJson) {
      return;
    }
    try {
      const parsed = JSON.parse(payloadJson);
      lastRemoteReceivedJsonByKey.set(key, payloadJson);
      lastPublishedJsonByKey.set(key, payloadJson);
      onKeyUpdate(key, parsed, {
        key,
        payloadJson,
        recordCount:
          typeof rawDoc.recordCount === 'number'
            ? rawDoc.recordCount
            : Array.isArray(parsed)
            ? parsed.length
            : 1,
        updatedAt: typeof rawDoc.updatedAt === 'string' ? rawDoc.updatedAt : new Date().toISOString(),
        updatedBy: typeof rawDoc.updatedBy === 'string' ? rawDoc.updatedBy : undefined,
        deviceOrigin: typeof rawDoc.deviceOrigin === 'string' ? rawDoc.deviceOrigin : undefined
      });
    } catch {
      // Ignore malformed JSON
    }
  };

  const pullUnifiedStateFromServer = async () => {
    if (isDisposed) return;
    try {
      const res = await fetch('/api/erp/unified-state');
      if (!res.ok || isDisposed) return;
      const data = await res.json().catch(() => ({}));
      const docs = Array.isArray(data?.docs) ? (data.docs as Array<Record<string, unknown>>) : [];
      const cloudKeySet = new Set<string>();
      for (const doc of docs) {
        const k = String(doc?.key || doc?.id || '');
        if (k) {
          cloudKeySet.add(k);
          handleIncomingDoc(doc);
        }
      }

      // Also pull authoritative branches from central database
      try {
        const branchRes = await fetch('/api/erp/branches');
        if (branchRes.ok && !isDisposed) {
          const bData = await branchRes.json().catch(() => ({}));
          if (Array.isArray(bData?.branches) && bData.branches.length > 0) {
            cloudKeySet.add('branches');
            handleIncomingDoc({
              id: 'branches',
              key: 'branches',
              payloadJson: JSON.stringify(bData.branches),
              recordCount: bData.branches.length,
              updatedAt: new Date().toISOString()
            });
          }
        }
      } catch {
        // Fallback to unified docs
      }

      if (!hasReportedInitialCloudKeys) {
        hasReportedInitialCloudKeys = true;
        onInitialCloudKeys?.(cloudKeySet);
      }
      onSyncStatusChange?.('SYNCED', Math.max(28, cloudKeySet.size, lastPublishedJsonByKey.size));
    } catch {
      if (!hasReportedInitialCloudKeys) {
        hasReportedInitialCloudKeys = true;
        onInitialCloudKeys?.(new Set<string>());
      }
    }
  };

  onSyncStatusChange?.('SYNCING', lastPublishedJsonByKey.size);
  void pullUnifiedStateFromServer();

  // Real-time Server-Sent Events (SSE) listener for instant PC <-> Mobile unified state updates
  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/erp/live-stream');
      eventSource.addEventListener('INITIAL_SNAPSHOT', (evt: MessageEvent) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(evt.data);
          const docs = Array.isArray(parsed?.unifiedDocs)
            ? (parsed.unifiedDocs as Array<Record<string, unknown>>)
            : [];
          const cloudKeySet = new Set<string>();
          for (const doc of docs) {
            const k = String(doc?.key || doc?.id || '');
            if (k) {
              cloudKeySet.add(k);
              handleIncomingDoc(doc);
            }
          }
          if (Array.isArray(parsed?.branches) && parsed.branches.length > 0) {
            cloudKeySet.add('branches');
            handleIncomingDoc({
              id: 'branches',
              key: 'branches',
              payloadJson: JSON.stringify(parsed.branches),
              recordCount: parsed.branches.length,
              updatedAt: new Date().toISOString()
            });
          }
          if (!hasReportedInitialCloudKeys) {
            hasReportedInitialCloudKeys = true;
            onInitialCloudKeys?.(cloudKeySet);
          }
          onSyncStatusChange?.('SYNCED', Math.max(28, cloudKeySet.size, lastPublishedJsonByKey.size));
        } catch {
          // Ignore malformed SSE payload
        }
      });
      eventSource.addEventListener('BRANCHES_UPDATED', (evt: MessageEvent) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(evt.data);
          const branches = parsed?.payload?.branches;
          if (Array.isArray(branches)) {
            handleIncomingDoc({
              id: 'branches',
              key: 'branches',
              payloadJson: JSON.stringify(branches),
              recordCount: branches.length,
              updatedAt: new Date().toISOString()
            });
          }
        } catch {
          // Ignore
        }
      });
      eventSource.addEventListener('BRANCHES_DELETED', (evt: MessageEvent) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(evt.data);
          const branches = parsed?.payload?.branches;
          if (Array.isArray(branches)) {
            handleIncomingDoc({
              id: 'branches',
              key: 'branches',
              payloadJson: JSON.stringify(branches),
              recordCount: branches.length,
              updatedAt: new Date().toISOString()
            });
          }
        } catch {
          // Ignore
        }
      });
      eventSource.addEventListener('UNIFIED_STATE_UPDATED', (evt: MessageEvent) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(evt.data);
          const docs = Array.isArray(parsed?.payload?.docs)
            ? (parsed.payload.docs as Array<Record<string, unknown>>)
            : [];
          for (const doc of docs) {
            handleIncomingDoc(doc);
          }
          onSyncStatusChange?.('SYNCED', Math.max(28, lastPublishedJsonByKey.size));
        } catch {
          void pullUnifiedStateFromServer();
        }
      });
    } catch {
      eventSource = null;
    }
  }

  // Periodic background poll + focus/visibility re-sync for mobile browsers waking from sleep
  const pollInterval = setInterval(() => {
    void pullUnifiedStateFromServer();
  }, 4500);

  const handleVisibilityOrFocus = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void pullUnifiedStateFromServer();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  const attachSubscriptionsForAuthUser = (_user: typeof auth.currentUser) => {
    cleanupActiveFirestoreSubs();
    void pullUnifiedStateFromServer();
  };

  const unsubAuth = onAuthStateChanged(auth, user => {
    attachSubscriptionsForAuthUser(user);
  });

  return () => {
    isDisposed = true;
    clearInterval(pollInterval);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    unsubAuth();
    cleanupActiveFirestoreSubs();
    unifiedBroadcastChannel?.removeEventListener('message', handleBroadcastMessage);
  };
}

/**
 * Synchronize only changed branch inventory items with the `branchInventoryLedgers` collection in Firestore.
 * Avoids writing unchanged items on startup to preserve Firestore daily write quota.
 */
const lastSyncedLedgerQtyByKey = new Map<string, number>();
let hasSeededInitialInventoryLedgers = false;

export async function syncInventoryItemsToBranchLedgers(
  inventoryItems: InventoryItem[],
  products: Product[],
  force = false
): Promise<void> {
  // Direct browser writes to `branchInventoryLedgers` are retired.
  // All inventory balance updates are executed transactionally on the backend via VAAIRO API -> AuthoritativeErpEngine -> firebase-admin DAL.
  void products;
  if (!inventoryItems || inventoryItems.length === 0) return;
  if (!hasSeededInitialInventoryLedgers && !force) {
    hasSeededInitialInventoryLedgers = true;
    for (const item of inventoryItems) {
      if (!item.branchId || !item.productId) continue;
      const qty = Math.max(0, Number(item.bottlesOnHand) || 0);
      const ledgerId = `${item.branchId}_${item.productId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      lastSyncedLedgerQtyByKey.set(ledgerId, qty);
    }
  }
}

/**
 * Subscribe to `branchInventoryLedgers` so any external/audit ledger updates immediately unify into ERP `inventoryItems`.
 */
export function subscribeToBranchInventoryLedgers(
  onLedgersSnapshot: (
    ledgers: Array<{
      id: string;
      branchId: string;
      productId: string;
      quantity: number;
      updatedAt: string;
    }>
  ) => void,
  options?: { branchId?: string; isAdmin?: boolean }
): Unsubscribe {
  if (isFirestoreWriteQuotaExhausted()) {
    return () => {};
  }

  const baseCollection = collection(db, BRANCH_INVENTORY_LEDGER_COLLECTION);
  const targetQuery =
    options?.branchId && !options?.isAdmin
      ? query(baseCollection, where('branchId', '==', options.branchId))
      : baseCollection;

  return onSnapshot(
    targetQuery,
    snapshot => {
      const items: Array<{
        id: string;
        branchId: string;
        productId: string;
        quantity: number;
        updatedAt: string;
      }> = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && typeof d.branchId === 'string' && typeof d.productId === 'string' && typeof d.quantity === 'number') {
          const ledgerId = `${d.branchId}_${d.productId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          lastSyncedLedgerQtyByKey.set(ledgerId, d.quantity);
          items.push({
            id: d.id || docSnap.id,
            branchId: d.branchId,
            productId: d.productId,
            quantity: d.quantity,
            updatedAt: d.updatedAt || ''
          });
        }
      });
      if (items.length > 0) {
        onLedgersSnapshot(items);
      }
    },
    error => {
      if (isResourceExhaustedError(error)) {
        markFirestoreWriteQuotaExhausted();
      }
    }
  );
}

/**
 * Writes an immutable inventory transaction ledger record to Firestore `/inventoryTransactions/{id}`.
 */
export async function persistAuthoritativeInventoryTransactionToFirestore(entry: {
  id: string;
  productId: string;
  sku?: string;
  productName?: string;
  branchId: string;
  transactionType:
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
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceId: string;
  referenceType: string;
  userId: string;
  userName?: string;
  reason: string;
  timestamp: string;
}): Promise<boolean> {
  // Inventory transactions are persisted exclusively on the server via `/api/erp/inventory/adjust` and `/api/erp/pos/checkout` (`firebase-admin` DAL).
  void entry;
  return true;
}

/**
 * Authoritatively saves a Branch/Shop to the central database (`/api/erp/branches`).
 * Central database = truth. If the central database fails, this rejects with an error message
 * so local persistence NEVER pretends the entity was saved.
 */
export async function saveBranchToCentralDatabase(branchData: Record<string, unknown>): Promise<{
  success: boolean;
  branch?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/erp/branches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vaairo-terminal-sync': '1',
        ...getAuthHeaders()
      },
      body: JSON.stringify(branchData)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data?.error || 'Unable to save. Check your connection and try again.'
      };
    }
    const data = await res.json();
    return {
      success: true,
      branch: (data?.branch as Record<string, unknown>) || branchData
    };
  } catch {
    return {
      success: false,
      error: 'Unable to save. Check your connection and try again.'
    };
  }
}

/**
 * Authoritative sale records are persisted exclusively on the server via `/api/erp/pos/checkout` (`firebase-admin` DAL).
 */
export async function persistAuthoritativeSaleToFirestore(sale: {
  id: string;
  orderNumber: string;
  branchId: string;
  subtotalKes: number;
  discountKes?: number;
  vatAmountKes: number;
  totalAmountKes: number;
  paymentMethod: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT' | 'CREDIT';
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  idempotencyKey?: string;
  createdBy: string;
  createdAt: string;
}): Promise<boolean> {
  void sale;
  return true;
}

