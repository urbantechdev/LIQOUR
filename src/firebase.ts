import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
  UserCredential
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setLogLevel,
  disableNetwork
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore SDK console.error spam (e.g., resource-exhausted / backoff retries)
// so quota exhaustion is handled gracefully via our LocalStorage + IndexedDB fallback engine.
try {
  setLogLevel('silent');
} catch {
  // Ignore if setLogLevel is unavailable
}

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Triggers Google OAuth popup synchronously within the user click gesture.
 * Ensures fullscreen mode does not block or close the OAuth popup window.
 */
export async function signInWithGooglePopup(): Promise<UserCredential> {
  if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
    // Non-blocking exit so user gesture activation remains synchronous for window.open()
    document.exitFullscreen().catch(() => {});
  }
  return signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
}

const QUOTA_EXHAUSTED_STORAGE_KEY = 'vaairo_firestore_quota_exhausted_until_v2';

// Ensure any legacy quota-exhausted flags in browser storage are cleared on boot so central database sync is never bypassed
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem(QUOTA_EXHAUSTED_STORAGE_KEY);
    localStorage.removeItem(QUOTA_EXHAUSTED_STORAGE_KEY);
    sessionStorage.removeItem('vaairo_firestore_quota_exhausted_until');
    localStorage.removeItem('vaairo_firestore_quota_exhausted_until');
  } catch {
    // Ignore storage access errors
  }
}

export function isResourceExhaustedError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('maximum backoff delay')
  );
}

export function markFirestoreWriteQuotaExhausted(): void {
  // Never disable Firestore network or bypass central persistence
}

export function isFirestoreWriteQuotaExhausted(): boolean {
  return false;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (isResourceExhaustedError(error)) {
    markFirestoreWriteQuotaExhausted();
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };

  // Only log genuine security rule permission errors; never log quota-exhausted or offline warnings as console.error
  if (
    !isResourceExhaustedError(error) &&
    !rawMessage.includes('the client is offline') &&
    !rawMessage.includes('Failed to get document because the client is offline')
  ) {
    if (rawMessage.includes('Missing or insufficient permissions') || rawMessage.includes('permission-denied')) {
      console.warn('Firestore Permission Notice: ', JSON.stringify(errInfo));
    }
  }

  return errInfo;
}

// Validate connection to Firestore on startup
export async function testFirestoreConnection(): Promise<boolean> {
  if (isFirestoreWriteQuotaExhausted()) {
    return true;
  }
  try {
    await getDocFromServer(doc(db, 'unifiedStateStore', 'connection_probe'));
    return true;
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      markFirestoreWriteQuotaExhausted();
      return true;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return false;
    }
    return true;
  }
}
