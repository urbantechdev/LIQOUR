/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc } from 'firebase/firestore';
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  isFirestoreWriteQuotaExhausted,
  isResourceExhaustedError,
  markFirestoreWriteQuotaExhausted
} from '../firebase';
import { Product, User } from '../types';
import { getAuthHeaders } from './apiAuth';
import { stripCommercialPricingFromPublicProduct } from './productCatalogSplit';

export interface UserSyncPayload {
  id?: string;
  userId?: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  branchId?: string;
  organizationId?: string;
  phone?: string;
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  updatedAt?: string;
  active?: boolean;
}

export interface ProductScanMetadata {
  branchId?: string;
  branchName?: string;
  scanType?: 'SINGLE_BOTTLE' | 'CASE_BOX' | 'INVENTORY_AUDIT' | 'RESTOCK_INTAKE' | string;
  barcode?: string;
  sku?: string;
  scannerUserId?: string;
  scannerName?: string;
  scannedAt?: string;
  bottlesCount?: number;
  mode?: 'SINGLE' | 'BULK' | string;
}

export type DocumentTypeKey =
  | 'ORDER'
  | 'ETIMS'
  | 'COMMERCIAL_INVOICE'
  | 'SUPPLY_INVOICE'
  | 'QUOTE'
  | 'STOCK_TRANSFER'
  | 'PURCHASE_ORDER'
  | 'STOCK_AUDIT'
  | 'WEBSITE_ORDER'
  | 'PAYROLL'
  | 'CREDIT_NOTE'
  | string;

// Debounce map to avoid thrashing duplicate rapid network requests for identical records
const lastSyncSignatures = new Map<string, string>();

/**
 * 1. Synchronizes User Record to Firebase:
 * - Authoritatively via /api/users/sync (persisting to /users & /organizationMemberships)
 * - Directly to client Firestore /users/{userId} when authenticated
 */
export async function syncUserToFirebase(user: Partial<User> & { id: string }): Promise<boolean> {
  const safeId = String(user.id || user.email || 'user-unknown').replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
  if (!safeId) return false;

  const nowIso = new Date().toISOString();
  const payload: UserSyncPayload = {
    userId: safeId,
    id: safeId,
    name: String(user.name || 'System User').trim(),
    email: String(user.email || '').trim().toLowerCase(),
    role: String(user.role || 'STAFF'),
    department: String(user.department || 'POS'),
    branchId: String(user.branchId || 'branch-hq-main'),
    organizationId: 'org-merchant-vaairo-hq',
    phone: (user as any).phone ? String((user as any).phone) : '',
    mfaEnabled: Boolean((user as any).mfaEnabled),
    lastLoginAt: (user as any).lastLoginAt || nowIso,
    updatedAt: nowIso,
    active: true
  };

  const sig = JSON.stringify(payload);
  if (lastSyncSignatures.get(`user_${safeId}`) === sig) {
    return true;
  }

  let serverSuccess = false;
  try {
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      serverSuccess = true;
      lastSyncSignatures.set(`user_${safeId}`, sig);
    }
  } catch {
    // Non-blocking, fallback to direct Firestore if available
  }

  // Direct Client-Side Firestore Sync (if authenticated with Google/Firebase)
  if (!isFirestoreWriteQuotaExhausted() && auth.currentUser) {
    try {
      const userRef = doc(db, 'users', safeId);
      await setDoc(userRef, payload, { merge: true });
      lastSyncSignatures.set(`user_${safeId}`, sig);
      return true;
    } catch (error) {
      if (isResourceExhaustedError(error)) {
        markFirestoreWriteQuotaExhausted();
      } else {
        handleFirestoreError(error, OperationType.WRITE, `users/${safeId}`);
      }
    }
  }

  return serverSuccess;
}

/**
 * 2A. Synchronizes Product to Firebase when CREATED or UPDATED:
 * - Normalized top-level Firestore collections: /products, /productsPublic, /productsPrivate
 * - Authoritatively via /api/products/sync-record
 */
export async function syncProductCreatedToFirebase(product: Product): Promise<boolean> {
  const safeId = String(product.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!safeId) return false;

  const nowIso = new Date().toISOString();
  const normalizedProduct = {
    ...product,
    id: safeId,
    barcode: String(product.barcode || '').trim(),
    sku: String(product.sku || '').trim(),
    name: String(product.name || '').trim(),
    updatedAt: nowIso
  };

  const sig = JSON.stringify(normalizedProduct);
  if (lastSyncSignatures.get(`prod_${safeId}`) === sig) {
    return true;
  }

  let serverSuccess = false;
  try {
    const res = await fetch('/api/products/sync-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        product: normalizedProduct,
        isScan: false
      })
    });
    if (res.ok) {
      serverSuccess = true;
      lastSyncSignatures.set(`prod_${safeId}`, sig);
    }
  } catch {
    // Non-blocking
  }

  return serverSuccess;
}

/**
 * 2B. Synchronizes Product to Firebase when SCANNED:
 * - Updates product metadata (lastScannedAt, scanCount) in /products
 * - Records scan event in /scanHistory
 * - Dispatches via /api/products/sync-record with isScan=true
 */
export async function syncProductScannedToFirebase(
  product: Product,
  scanMetadata: ProductScanMetadata
): Promise<boolean> {
  const safeId = String(product.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!safeId) return false;

  const nowIso = new Date().toISOString();
  const enrichedMetadata: ProductScanMetadata = {
    ...scanMetadata,
    barcode: scanMetadata.barcode || product.barcode || product.sku,
    scannedAt: scanMetadata.scannedAt || nowIso
  };

  try {
    const res = await fetch('/api/products/sync-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        product: {
          ...product,
          id: safeId,
          lastScannedAt: nowIso
        },
        isScan: true,
        scanMetadata: enrichedMetadata
      })
    });
    return res.ok;
  } catch {
    // Non-blocking scan dispatch
    return false;
  }
}

/**
 * 3. Synchronizes Documents to Firebase:
 * Supports Orders, eTIMS Invoices, Commercial Invoices, Supply Invoices, Quotes,
 * Stock Transfers, Purchase Orders, and Stock Audit Sessions.
 */
export async function syncDocumentToFirebase(
  documentType: DocumentTypeKey,
  documentId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const safeId = String(documentId || payload.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!safeId) return false;

  const nowIso = new Date().toISOString();
  const normalizedPayload = {
    ...payload,
    id: safeId,
    updatedAt: payload.updatedAt || nowIso
  };

  const sigKey = `doc_${documentType}_${safeId}`;
  const sig = JSON.stringify(normalizedPayload);
  if (lastSyncSignatures.get(sigKey) === sig) {
    return true;
  }

  let serverSuccess = false;
  try {
    const res = await fetch('/api/documents/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        documentType,
        documentId: safeId,
        payload: normalizedPayload
      })
    });
    if (res.ok) {
      serverSuccess = true;
      lastSyncSignatures.set(sigKey, sig);
    }
  } catch {
    // Non-blocking
  }

  return serverSuccess;
}
