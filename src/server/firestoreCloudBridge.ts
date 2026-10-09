/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  setLogLevel,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {
  // Ignore if unavailable
}

const BRIDGE_APP_NAME = 'vaairo-server-cloud-firestore-bridge';

const bridgeApp = getApps().some(a => a.name === BRIDGE_APP_NAME)
  ? getApp(BRIDGE_APP_NAME)
  : initializeApp(firebaseConfig, BRIDGE_APP_NAME);

export const cloudBridgeDb = getFirestore(bridgeApp, firebaseConfig.firestoreDatabaseId);

function sanitizeFirestoreObject(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = sanitizeFirestoreObject(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export async function cloudBridgeSetDoc(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const safeId = String(docId || '').replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
  if (!safeId) return false;
  const cleanData = sanitizeFirestoreObject(data);
  await setDoc(doc(cloudBridgeDb, collectionName, safeId), cleanData, { merge: true });
  return true;
}

export async function cloudBridgeDeleteDoc(
  collectionName: string,
  docId: string
): Promise<boolean> {
  const safeId = String(docId || '').replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
  if (!safeId) return false;
  await deleteDoc(doc(cloudBridgeDb, collectionName, safeId));
  return true;
}

export async function cloudBridgeGetDoc(
  collectionName: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  const safeId = String(docId || '').replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 120);
  if (!safeId) return null;
  const snap = await getDoc(doc(cloudBridgeDb, collectionName, safeId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Record<string, unknown>), id: snap.id };
}

export async function cloudBridgeListCollection(
  collectionName: string,
  maxDocs = 500
): Promise<Array<Record<string, unknown>>> {
  const q = query(collection(cloudBridgeDb, collectionName), limit(maxDocs));
  const snap = await getDocs(q);
  const results: Array<Record<string, unknown>> = [];
  snap.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    if (data && typeof data === 'object') {
      results.push({ ...data, id: String(data.id || d.id) });
    }
  });
  return results;
}

export function cloudBridgeSubscribeCollection(
  collectionName: string,
  onSnapshotUpdate: (docs: Array<Record<string, unknown>>) => void,
  maxDocs = 500
): Unsubscribe {
  try {
    const q = query(collection(cloudBridgeDb, collectionName), limit(maxDocs));
    return onSnapshot(
      q,
      snap => {
        const docs: Array<Record<string, unknown>> = [];
        snap.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          if (data && typeof data === 'object') {
            docs.push({ ...data, id: String(data.id || d.id) });
          }
        });
        onSnapshotUpdate(docs);
      },
      () => {
        // Ignore transient stream errors
      }
    );
  } catch {
    return () => {};
  }
}

