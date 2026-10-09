import {
  collection,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { getAuthHeaders } from './apiAuth';
import {
  db,
  OperationType,
  handleFirestoreError,
  isFirestoreWriteQuotaExhausted,
  isResourceExhaustedError,
  markFirestoreWriteQuotaExhausted
} from '../firebase';
import {
  Affiliate,
  AffiliateCommissionMode,
  CommissionRecord,
  DepartmentType,
  Employee,
  EmployeeLeaveRequest,
  HeldCart,
  PayrollRecord,
  SaleOrder,
  SalesRepOffDutyRequest,
  StaffEmploymentStatus
} from '../types';
import {
  generateCryptographicSalt,
  computeSaltedPinHashSync,
  verifyPinAgainstHash,
  constantTimeEquals
} from './cryptoSecurity';

export interface StaffPersonalDataPayload {
  staffId: string;
  commissions?: CommissionRecord[];
  leaveRequests?: EmployeeLeaveRequest[];
  offDutyRequests?: SalesRepOffDutyRequest[];
  payrollRecords?: PayrollRecord[];
  heldCarts?: HeldCart[];
  recentOrders?: SaleOrder[];
  preferredPrices?: Record<string, number>;
  lastActiveTab?: string;
  lastBranchId?: string;
  savedAt: string;
}

export interface StaffDirectoryRecord {
  id: string;
  recordType: 'EMPLOYEE' | 'AFFILIATE';
  name: string;
  codeOrNumber: string;
  roleTitle: string;
  department: DepartmentType;
  branchId: string;
  branchName?: string;
  pinHash?: string;
  pinSalt?: string;
  loginPin?: string;
  phone: string;
  employmentType: 'CASUAL' | 'SALARIED';
  compensationModel: 'COMMISSION_ONLY' | 'MONTHLY_SALARY';
  commissionRatePercent: number;
  commissionMode?: AffiliateCommissionMode;
  allowPreferredPrice?: boolean;
  assignedCashierId?: string;
  assignedCashierName?: string;
  totalSalesKes: number;
  companySalesTotalKes: number;
  preferredPriceProfitTotalKes: number;
  baseCommissionTotalKes: number;
  totalCommissionEarnedKes: number;
  paidCommissionKes: number;
  pendingCommissionKes: number;
  basicSalaryKes: number;
  houseAllowanceKes: number;
  transportAllowanceKes: number;
  kraPin: string;
  nssfNumber: string;
  nhifShifNumber: string;
  bankName: string;
  bankAccount: string;
  customSlug?: string;
  preferredPricesJson?: string;
  staffDataJson?: string;
  active: boolean;
  employmentStatus?: StaffEmploymentStatus;
  suspendedAt?: string;
  suspensionReason?: string;
  terminatedAt?: string;
  terminationReason?: string;
  lastLoginAt?: string;
  loginCount?: number;
  updatedAt: string;
}

const INDEPENDENT_STAFF_LOCAL_KEY = 'vaairo_independent_staff_db_v2_records';
const INDEPENDENT_STAFF_DATA_KEY = 'vaairo_independent_staff_db_v2_snapshots';
const DELETED_STAFF_IDS_KEY = 'vaairo_deleted_staff_ids_v2';
const IDB_NAME = 'VaairoIndependentStaffDB_v2';
const IDB_VERSION = 1;
const IDB_STORE_RECORDS = 'staff_directory';
const IDB_STORE_DATA = 'staff_workspace_data';
const FIRESTORE_COLLECTION = 'staffDirectory';

// Purge legacy v1 local storage & IndexedDB staff caches so wiped staff never resurrect
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('vaairo_independent_staff_db_v1_records');
    localStorage.removeItem('vaairo_independent_staff_db_v1_snapshots');
    localStorage.removeItem('vaairo_deleted_staff_ids_v1');
    if ('indexedDB' in window) {
      window.indexedDB.deleteDatabase('VaairoIndependentStaffDB');
    }
  } catch {
    // ignore cleanup warnings
  }
}

export function getDeletedStaffIdsSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_STAFF_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markStaffIdDeletedLocally(staffId: string): void {
  try {
    const set = getDeletedStaffIdsSet();
    set.add(staffId);
    localStorage.setItem(DELETED_STAFF_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage warning
  }
}

export function unmarkStaffIdDeletedLocally(staffId: string): void {
  try {
    const set = getDeletedStaffIdsSet();
    if (set.has(staffId)) {
      set.delete(staffId);
      localStorage.setItem(DELETED_STAFF_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore storage warning
  }
}

function sanitizeSixDigitPin(pin?: string): string {
  const digits = (pin || '').replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : digits.padEnd(6, '0');
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = val;
    }
  });
  return cleaned as T;
}

// ============================================================================
// TIER 1: Synchronous Dedicated Local Mirror (0ms Instant Login Read)
// ============================================================================
export function loadLocalIndependentStaffRecords(): StaffDirectoryRecord[] {
  try {
    const raw = localStorage.getItem(INDEPENDENT_STAFF_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deletedSet = getDeletedStaffIdsSet();
    return parsed.filter((r: StaffDirectoryRecord) => r && r.id && !deletedSet.has(r.id));
  } catch (e) {
    console.warn('Independent Staff DB local read warning:', e);
    return [];
  }
}

export function saveLocalIndependentStaffRecords(records: StaffDirectoryRecord[]): void {
  try {
    // Only non-sensitive roster identifiers and salted PIN hashes may be cached locally;
    // plaintext PINs, salaries, banking, and tax IDs are stripped from browser storage.
    const sanitized = records.map(rec => {
      const salt = rec.pinSalt || generateCryptographicSalt(16);
      const hasValidPlainPin =
        typeof rec.loginPin === 'string' &&
        /^\d{6}$/.test(rec.loginPin) &&
        (rec.loginPin !== '000000' || !rec.pinHash);
      const pinHash = hasValidPlainPin
        ? computeSaltedPinHashSync(sanitizeSixDigitPin(rec.loginPin), salt)
        : rec.pinHash || '';
      const copy: StaffDirectoryRecord = {
        ...rec,
        pinSalt: salt,
        pinHash,
        basicSalaryKes: 0,
        houseAllowanceKes: 0,
        transportAllowanceKes: 0,
        bankAccount: '',
        kraPin: '',
        nssfNumber: '',
        nhifShifNumber: '',
        staffDataJson: ''
      };
      delete copy.loginPin;
      return copy;
    });
    localStorage.setItem(INDEPENDENT_STAFF_LOCAL_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Independent Staff DB local write warning:', e);
  }
}

export function loadLocalStaffDataSnapshots(): Record<string, StaffPersonalDataPayload> {
  return {};
}

export function saveLocalStaffDataSnapshots(_map: Record<string, StaffPersonalDataPayload>): void {
  try {
    localStorage.removeItem(INDEPENDENT_STAFF_DATA_KEY);
  } catch {
    // ignore quota warning
  }
}

// ============================================================================
// TIER 2: Dedicated Browser IndexedDB (VaairoIndependentStaffDB)
// ============================================================================
function openStaffIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE_RECORDS)) {
          const store = database.createObjectStore(IDB_STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('by_pin', 'loginPin', { unique: false });
          store.createIndex('by_department', 'department', { unique: false });
          store.createIndex('by_branch', 'branchId', { unique: false });
        }
        if (!database.objectStoreNames.contains(IDB_STORE_DATA)) {
          database.createObjectStore(IDB_STORE_DATA, { keyPath: 'staffId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readAllFromStaffIndexedDb(): Promise<{
  records: StaffDirectoryRecord[];
  snapshots: Record<string, StaffPersonalDataPayload>;
}> {
  const idb = await openStaffIndexedDb();
  if (!idb) {
    return {
      records: loadLocalIndependentStaffRecords(),
      snapshots: loadLocalStaffDataSnapshots()
    };
  }

  return new Promise(resolve => {
    try {
      const tx = idb.transaction([IDB_STORE_RECORDS, IDB_STORE_DATA], 'readonly');
      const recStore = tx.objectStore(IDB_STORE_RECORDS);
      const dataStore = tx.objectStore(IDB_STORE_DATA);

      const recReq = recStore.getAll();
      const dataReq = dataStore.getAll();

      tx.oncomplete = () => {
        const records = (recReq.result as StaffDirectoryRecord[]) || [];
        const dataList = (dataReq.result as StaffPersonalDataPayload[]) || [];
        const snapshots: Record<string, StaffPersonalDataPayload> = {};
        dataList.forEach(item => {
          if (item && item.staffId) {
            snapshots[item.staffId] = item;
          }
        });
        resolve({ records, snapshots });
      };
      tx.onerror = () => {
        resolve({
          records: loadLocalIndependentStaffRecords(),
          snapshots: loadLocalStaffDataSnapshots()
        });
      };
    } catch {
      resolve({
        records: loadLocalIndependentStaffRecords(),
        snapshots: loadLocalStaffDataSnapshots()
      });
    }
  });
}

export async function writeRecordToStaffIndexedDb(
  record: StaffDirectoryRecord,
  snapshot?: StaffPersonalDataPayload
): Promise<void> {
  const idb = await openStaffIndexedDb();
  if (!idb) return;

  return new Promise(resolve => {
    try {
      const stores = snapshot ? [IDB_STORE_RECORDS, IDB_STORE_DATA] : [IDB_STORE_RECORDS];
      const tx = idb.transaction(stores, 'readwrite');
      tx.objectStore(IDB_STORE_RECORDS).put(record);
      if (snapshot) {
        tx.objectStore(IDB_STORE_DATA).put(snapshot);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteRecordFromStaffIndexedDb(staffId: string): Promise<void> {
  const idb = await openStaffIndexedDb();
  if (!idb) return;

  return new Promise(resolve => {
    try {
      const tx = idb.transaction([IDB_STORE_RECORDS, IDB_STORE_DATA], 'readwrite');
      tx.objectStore(IDB_STORE_RECORDS).delete(staffId);
      tx.objectStore(IDB_STORE_DATA).delete(staffId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllLocalIndependentStaffData(): Promise<void> {
  lastPushedStaffSignatureById.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(INDEPENDENT_STAFF_LOCAL_KEY);
      localStorage.removeItem(INDEPENDENT_STAFF_DATA_KEY);
      localStorage.removeItem(DELETED_STAFF_IDS_KEY);
      localStorage.removeItem('vaairo_independent_staff_db_v1_records');
      localStorage.removeItem('vaairo_independent_staff_db_v1_snapshots');
    } catch {
      // ignore
    }
  }
  const idb = await openStaffIndexedDb();
  if (!idb) return;
  return new Promise(resolve => {
    try {
      const tx = idb.transaction([IDB_STORE_RECORDS, IDB_STORE_DATA], 'readwrite');
      tx.objectStore(IDB_STORE_RECORDS).clear();
      tx.objectStore(IDB_STORE_DATA).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ============================================================================
// TIER 3: Firebase Firestore Real-Time Cloud Staff Directory
// ============================================================================
const lastPushedStaffSignatureById = new Map<string, string>();

function computeStaffSignature(record: StaffDirectoryRecord): string {
  return [
    record.id,
    record.recordType,
    record.name,
    record.codeOrNumber,
    record.roleTitle,
    record.department,
    record.branchId,
    record.phone,
    record.loginPin,
    record.commissionRatePercent,
    record.totalSalesKes,
    record.pendingCommissionKes,
    record.paidCommissionKes,
    record.basicSalaryKes,
    record.preferredPricesJson || '',
    record.assignedCashierId || '',
    record.employmentStatus || (record.active ? 'ACTIVE' : 'SUSPENDED'),
    record.active ? '1' : '0'
  ].join('|');
}

export async function pushStaffRecordToFirestore(
  record: StaffDirectoryRecord,
  force = false
): Promise<boolean> {
  try {
    const safeId = (record.id || `staff-${Date.now()}`).trim().slice(0, 120);
    const sig = computeStaffSignature(record);
    if (!force && lastPushedStaffSignatureById.get(safeId) === sig) {
      return true;
    }

    const validDepartments: DepartmentType[] = [
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
    ];
    const safeDept: DepartmentType = validDepartments.includes(record.department)
      ? record.department
      : record.recordType === 'AFFILIATE'
      ? 'AFFILIATES'
      : 'POS';
    const safeName = (record.name || 'Staff Member').trim().slice(0, 150) || 'Staff Member';
    const safeCode = (record.codeOrNumber || 'EMP-001').trim().slice(0, 60) || 'EMP-001';

    const hasRealPlaintextPin =
      typeof record.loginPin === 'string' &&
      /^\d{6}$/.test(record.loginPin) &&
      (record.loginPin !== '000000' || !record.pinHash);

    const salt = record.pinSalt || generateCryptographicSalt(16);
    const pinHash = hasRealPlaintextPin
      ? computeSaltedPinHashSync(sanitizeSixDigitPin(record.loginPin), salt)
      : record.pinHash || '';

    const cleanDoc = stripUndefined({
      ...record,
      id: safeId,
      recordType: record.recordType === 'AFFILIATE' ? 'AFFILIATE' : 'EMPLOYEE',
      name: safeName,
      codeOrNumber: safeCode,
      department: safeDept,
      pinHash,
      pinSalt: salt,
      active: Boolean(record.active ?? true),
      updatedAt: (record.updatedAt || new Date().toISOString()).slice(0, 60),
      // Mask sensitive banking and tax IDs in Firestore document
      bankAccount: record.bankAccount
        ? record.bankAccount.startsWith('****')
          ? record.bankAccount
          : `**** **** ${record.bankAccount.slice(-4)}`
        : '',
      kraPin: record.kraPin
        ? record.kraPin.includes('****')
          ? record.kraPin
          : `${record.kraPin.slice(0, 2)}****${record.kraPin.slice(-2)}`
        : '',
      nssfNumber: record.nssfNumber
        ? record.nssfNumber.startsWith('****')
          ? record.nssfNumber
          : `****${record.nssfNumber.slice(-4)}`
        : '',
      nhifShifNumber: record.nhifShifNumber
        ? record.nhifShifNumber.startsWith('****')
          ? record.nhifShifNumber
          : `****${record.nhifShifNumber.slice(-4)}`
        : ''
    });
    // Critical Security Protection: Never persist plaintext PIN or base compensation in public directory
    delete (cleanDoc as Record<string, unknown>).loginPin;
    delete (cleanDoc as Record<string, unknown>).basicSalaryKes;
    delete (cleanDoc as Record<string, unknown>).houseAllowanceKes;
    delete (cleanDoc as Record<string, unknown>).transportAllowanceKes;

    // Route staff directory mutation through VAAIRO Server API -> Central Cloud Firestore DAL + SSE cross-device broadcast
    const res = await fetch('/api/erp/staff-directory/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vaairo-terminal-sync': '1',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        staffId: safeId,
        record: cleanDoc,
        rawPin: hasRealPlaintextPin ? sanitizeSixDigitPin(record.loginPin) : undefined
      })
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({ persisted: true }));
      if (body && body.persisted === false) {
        return false;
      }
      lastPushedStaffSignatureById.set(safeId, sig);
      return true;
    }
    return false;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `${FIRESTORE_COLLECTION}/${record.id}`);
    } catch {
      // Ignore logging error
    }
    return false;
  }
}

export async function removeStaffRecordFromFirestore(staffId: string): Promise<boolean> {
  lastPushedStaffSignatureById.delete(staffId);
  markStaffIdDeletedLocally(staffId);
  try {
    const res = await fetch('/api/erp/staff-directory/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vaairo-terminal-sync': '1',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ staffId })
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({ persisted: true }));
    return body?.persisted !== false;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, `${FIRESTORE_COLLECTION}/${staffId}`);
    } catch {
      // Ignore
    }
    return false;
  }
}

export async function fetchAllStaffRecordsFromFirestore(): Promise<StaffDirectoryRecord[]> {
  const byId = new Map<string, StaffDirectoryRecord>();

  // 1. Fetch from Authoritative VAAIRO Server Cross-Device Store (works on all PC & Mobile browsers immediately, even before Google Auth)
  try {
    const apiRes = await fetch('/api/erp/staff-directory', {
      headers: {
        ...getAuthHeaders()
      }
    });
    if (apiRes.ok) {
      const apiData = await apiRes.json().catch(() => ({}));
      const serverRecords = Array.isArray(apiData?.records)
        ? (apiData.records as StaffDirectoryRecord[])
        : [];
      for (const rec of serverRecords) {
        if (rec && rec.id && rec.name) {
          byId.set(rec.id, rec);
        }
      }
    }
  } catch {
    // Fallback to Firestore / LocalStorage
  }

  // 2. Also merge from Firestore collection if reachable
  if (!isFirestoreWriteQuotaExhausted()) {
    try {
      const snap = await getDocs(collection(db, FIRESTORE_COLLECTION));
      snap.forEach(docSnap => {
        const data = docSnap.data() as StaffDirectoryRecord;
        if (data && data.id && data.name) {
          const existing = byId.get(data.id);
          const cloudTime = data.updatedAt || '';
          const existingTime = existing?.updatedAt || '';
          if (!existing || cloudTime >= existingTime) {
            byId.set(data.id, data);
          }
        }
      });
    } catch (error) {
      if (isResourceExhaustedError(error)) {
        markFirestoreWriteQuotaExhausted();
      }
    }
  }

  const merged = Array.from(byId.values());
  if (merged.length > 0) {
    for (const r of merged) {
      lastPushedStaffSignatureById.set(r.id, computeStaffSignature(r));
    }
    return merged;
  }
  return loadLocalIndependentStaffRecords();
}

export function subscribeToIndependentStaffDatabase(
  onUpdate: (records: StaffDirectoryRecord[]) => void
): Unsubscribe {
  let isDisposed = false;

  const sanitizeRecordForSync = (record: StaffDirectoryRecord): Record<string, unknown> => {
    const safeId = (record.id || `staff-${Date.now()}`).trim().slice(0, 120);
    const hasRealPlaintextPin =
      typeof record.loginPin === 'string' &&
      /^\d{6}$/.test(record.loginPin) &&
      (record.loginPin !== '000000' || !record.pinHash);
    const salt = record.pinSalt || generateCryptographicSalt(16);
    const pinHash = hasRealPlaintextPin
      ? computeSaltedPinHashSync(sanitizeSixDigitPin(record.loginPin), salt)
      : record.pinHash || '';

    const cleanDoc = stripUndefined({
      ...record,
      id: safeId,
      recordType: record.recordType === 'AFFILIATE' ? 'AFFILIATE' : 'EMPLOYEE',
      pinHash,
      pinSalt: salt,
      active: Boolean(record.active ?? true),
      updatedAt: (record.updatedAt || new Date().toISOString()).slice(0, 60)
    }) as Record<string, unknown>;
    delete cleanDoc.loginPin;
    delete cleanDoc.basicSalaryKes;
    delete cleanDoc.houseAllowanceKes;
    delete cleanDoc.transportAllowanceKes;
    return cleanDoc;
  };

  // Push any local or IndexedDB staff records to the unified central server/Firestore store on boot and pull all cross-device records
  const syncWithServerStore = async () => {
    if (isDisposed) return;
    try {
      const localRecords = loadLocalIndependentStaffRecords();
      const idbData = await readAllFromStaffIndexedDb().catch(() => ({ records: [] as StaffDirectoryRecord[] }));
      const deletedSet = getDeletedStaffIdsSet();
      const combinedById = new Map<string, StaffDirectoryRecord>();
      for (const r of idbData.records) {
        if (r && r.id && r.name && !deletedSet.has(r.id)) combinedById.set(r.id, r);
      }
      for (const r of localRecords) {
        if (r && r.id && r.name && !deletedSet.has(r.id)) {
          const existing = combinedById.get(r.id);
          combinedById.set(r.id, { ...existing, ...r, pinHash: r.pinHash || existing?.pinHash, pinSalt: r.pinSalt || existing?.pinSalt });
        }
      }
      const batchPayload = Array.from(combinedById.values()).map(sanitizeRecordForSync);
      const res = await fetch('/api/erp/staff-directory/sync-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vaairo-terminal-sync': '1',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ records: batchPayload })
      });
      if (res.ok && !isDisposed) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.records) && data.records.length > 0) {
          const serverRecords = data.records as StaffDirectoryRecord[];
          serverRecords.forEach(r => {
            if (r && r.id) {
              lastPushedStaffSignatureById.set(r.id, computeStaffSignature(r));
            }
          });
          onUpdate(serverRecords);
        }
      }
    } catch {
      // Ignore transient network errors
    }
  };

  const pollServerStaffDirectory = async () => {
    if (isDisposed) return;
    try {
      const res = await fetch('/api/erp/staff-directory', {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (res.ok && !isDisposed) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.records)) {
          const serverRecords = data.records as StaffDirectoryRecord[];
          if (serverRecords.length > 0) {
            serverRecords.forEach(r => {
              if (r && r.id) {
                lastPushedStaffSignatureById.set(r.id, computeStaffSignature(r));
              }
            });
            onUpdate(serverRecords);
          } else if (data?.wiped) {
            void clearAllLocalIndependentStaffData();
            onUpdate([]);
          }
        }
      }
    } catch {
      // Ignore transient network errors
    }
  };

  void syncWithServerStore();

  // Real-time Server-Sent Events (SSE) listener for instant PC <-> Mobile staff directory updates
  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/erp/live-stream');
      eventSource.addEventListener('INITIAL_SNAPSHOT', (evt: MessageEvent) => {
        if (isDisposed) return;
        try {
          const parsed = JSON.parse(evt.data);
          if (Array.isArray(parsed?.staffRecords) && parsed.staffRecords.length > 0) {
            onUpdate(parsed.staffRecords as StaffDirectoryRecord[]);
          }
        } catch {
          // Ignore malformed SSE payload
        }
      });
      eventSource.addEventListener('STAFF_DIRECTORY_UPDATED', () => {
        if (!isDisposed) void pollServerStaffDirectory();
      });
      eventSource.addEventListener('STAFF_DIRECTORY_DELETED', () => {
        if (!isDisposed) void pollServerStaffDirectory();
      });
      eventSource.addEventListener('STAFF_AND_BRANCHES_WIPED', () => {
        if (!isDisposed) {
          void clearAllLocalIndependentStaffData();
          onUpdate([]);
        }
      });
    } catch {
      eventSource = null;
    }
  }

  // Periodic background poll + focus/visibility re-sync for mobile browsers waking from background
  const pollInterval = setInterval(() => {
    void pollServerStaffDirectory();
  }, 4000);

  const handleVisibilityOrFocus = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void pollServerStaffDirectory();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  if (!isFirestoreWriteQuotaExhausted()) {
    firestoreUnsub = onSnapshot(
      collection(db, FIRESTORE_COLLECTION),
      snapshot => {
        if (isDisposed) return;
        const cloudRecords: StaffDirectoryRecord[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as StaffDirectoryRecord;
          if (data && data.id && data.name) {
            lastPushedStaffSignatureById.set(data.id, computeStaffSignature(data));
            cloudRecords.push(data);
          }
        });
        if (cloudRecords.length > 0) {
          onUpdate(cloudRecords);
        }
      },
      error => {
        if (isResourceExhaustedError(error)) {
          markFirestoreWriteQuotaExhausted();
        }
      }
    );
  }

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
    firestoreUnsub();
  };
}

// ============================================================================
// CONVERTERS: Employee / Affiliate <-> Independent StaffDirectoryRecord
// ============================================================================
export function serializeStaffPersonalData(payload?: StaffPersonalDataPayload): string {
  if (!payload) return '';
  try {
    const compact: StaffPersonalDataPayload = {
      staffId: payload.staffId,
      commissions: (payload.commissions || []).slice(0, 60),
      leaveRequests: (payload.leaveRequests || []).slice(0, 30),
      offDutyRequests: (payload.offDutyRequests || []).slice(0, 30),
      payrollRecords: (payload.payrollRecords || []).slice(0, 24),
      heldCarts: (payload.heldCarts || []).slice(0, 20),
      recentOrders: (payload.recentOrders || []).slice(0, 25),
      preferredPrices: payload.preferredPrices || {},
      lastActiveTab: payload.lastActiveTab,
      lastBranchId: payload.lastBranchId,
      savedAt: payload.savedAt || new Date().toISOString()
    };
    const json = JSON.stringify(compact);
    return json.length <= 850000 ? json : '';
  } catch {
    return '';
  }
}

export function parseStaffPersonalData(record: StaffDirectoryRecord): StaffPersonalDataPayload | null {
  if (!record.staffDataJson) return null;
  try {
    const parsed = JSON.parse(record.staffDataJson) as StaffPersonalDataPayload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function employeeToStaffDirectoryRecord(
  emp: Employee,
  branchName?: string,
  personalData?: StaffPersonalDataPayload,
  existingMeta?: { lastLoginAt?: string; loginCount?: number; pinHash?: string; pinSalt?: string }
): StaffDirectoryRecord {
  const isCasual =
    emp.department === 'POS' ||
    emp.department === 'AFFILIATES' ||
    emp.employmentType === 'CASUAL';

  const hasValidPin =
    typeof emp.loginPin === 'string' &&
    /^\d{6}$/.test(emp.loginPin) &&
    (emp.loginPin !== '000000' || (!emp.pinHash && !existingMeta?.pinHash));

  const resolvedSalt = emp.pinSalt || existingMeta?.pinSalt || generateCryptographicSalt(16);
  const resolvedHash = hasValidPin
    ? computeSaltedPinHashSync(sanitizeSixDigitPin(emp.loginPin), resolvedSalt)
    : emp.pinHash || existingMeta?.pinHash || '';

  return {
    id: emp.id,
    recordType: 'EMPLOYEE',
    name: emp.name.trim(),
    codeOrNumber: emp.employeeNumber || `EMP-${emp.id.slice(-4).toUpperCase()}`,
    roleTitle: emp.roleTitle || 'Operations Staff',
    department: emp.department,
    branchId: emp.branchId || '',
    branchName: branchName || '',
    loginPin: hasValidPin ? sanitizeSixDigitPin(emp.loginPin) : undefined,
    pinHash: resolvedHash,
    pinSalt: resolvedSalt,
    phone: emp.mPesaNumber || '+254700000000',
    employmentType: isCasual ? 'CASUAL' : 'SALARIED',
    compensationModel: isCasual ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY',
    commissionRatePercent: emp.commissionRatePercent ?? (isCasual ? 3 : 0),
    totalSalesKes: emp.totalSalesKes ?? 0,
    companySalesTotalKes: emp.totalSalesKes ?? 0,
    preferredPriceProfitTotalKes: 0,
    baseCommissionTotalKes: emp.totalCommissionEarnedKes ?? 0,
    totalCommissionEarnedKes: emp.totalCommissionEarnedKes ?? 0,
    paidCommissionKes: emp.paidCommissionKes ?? 0,
    pendingCommissionKes: emp.pendingCommissionKes ?? 0,
    basicSalaryKes: emp.basicSalaryKes ?? 0,
    houseAllowanceKes: emp.houseAllowanceKes ?? 0,
    transportAllowanceKes: emp.transportAllowanceKes ?? 0,
    kraPin: emp.kraPin || 'A009182736Z',
    nssfNumber: emp.nssfNumber || 'NSSF-0001',
    nhifShifNumber: emp.nhifShifNumber || 'SHIF-0001',
    bankName: emp.bankName || 'Equity Bank Kenya',
    bankAccount: emp.bankAccount || '018000000000',
    staffDataJson: serializeStaffPersonalData(personalData),
    active:
      emp.employmentStatus === 'SUSPENDED' || emp.employmentStatus === 'TERMINATED'
        ? false
        : emp.active ?? true,
    employmentStatus:
      emp.employmentStatus || (emp.active === false ? 'SUSPENDED' : 'ACTIVE'),
    suspendedAt: emp.suspendedAt,
    suspensionReason: emp.suspensionReason,
    terminatedAt: emp.terminatedAt,
    terminationReason: emp.terminationReason,
    lastLoginAt: existingMeta?.lastLoginAt,
    loginCount: existingMeta?.loginCount ?? 0,
    updatedAt: new Date().toISOString()
  };
}

export function affiliateToStaffDirectoryRecord(
  aff: Affiliate,
  branchName?: string,
  personalData?: StaffPersonalDataPayload,
  existingMeta?: { lastLoginAt?: string; loginCount?: number; pinHash?: string; pinSalt?: string }
): StaffDirectoryRecord {
  let preferredPricesJson = '';
  try {
    preferredPricesJson = JSON.stringify(aff.preferredPrices || {});
  } catch {
    preferredPricesJson = '{}';
  }

  const hasValidPin =
    typeof aff.loginPin === 'string' &&
    /^\d{6}$/.test(aff.loginPin) &&
    (aff.loginPin !== '000000' || (!aff.pinHash && !existingMeta?.pinHash));

  const resolvedSalt = aff.pinSalt || existingMeta?.pinSalt || generateCryptographicSalt(16);
  const resolvedHash = hasValidPin
    ? computeSaltedPinHashSync(sanitizeSixDigitPin(aff.loginPin), resolvedSalt)
    : aff.pinHash || existingMeta?.pinHash || '';

  return {
    id: aff.id,
    recordType: 'AFFILIATE',
    name: aff.name.trim(),
    codeOrNumber: aff.code || `SR-${aff.id.slice(-4).toUpperCase()}`,
    roleTitle: 'Sales Representative (Commission & Markup)',
    department: 'AFFILIATES',
    branchId: aff.branchId || '',
    branchName: branchName || '',
    loginPin: hasValidPin ? sanitizeSixDigitPin(aff.loginPin) : undefined,
    pinHash: resolvedHash,
    pinSalt: resolvedSalt,
    phone: aff.mpesaNumber || aff.phone || '+254700000000',
    employmentType: 'CASUAL',
    compensationModel: 'COMMISSION_ONLY',
    commissionRatePercent: aff.commissionRatePercent ?? 5,
    commissionMode: aff.commissionMode || 'COMMISSION_AND_PROFIT',
    allowPreferredPrice: aff.allowPreferredPrice ?? true,
    assignedCashierId: aff.assignedCashierId || '',
    assignedCashierName: aff.assignedCashierName || '',
    totalSalesKes: aff.totalSalesKes ?? 0,
    companySalesTotalKes: aff.companySalesTotalKes ?? 0,
    preferredPriceProfitTotalKes: aff.preferredPriceProfitTotalKes ?? 0,
    baseCommissionTotalKes: aff.baseCommissionTotalKes ?? 0,
    totalCommissionEarnedKes: aff.totalCommissionEarnedKes ?? 0,
    paidCommissionKes: aff.paidCommissionKes ?? 0,
    pendingCommissionKes: aff.pendingCommissionKes ?? 0,
    basicSalaryKes: 0,
    houseAllowanceKes: 0,
    transportAllowanceKes: 0,
    kraPin: 'A009182736Z',
    nssfNumber: 'N/A-CASUAL',
    nhifShifNumber: 'N/A-CASUAL',
    bankName: 'M-Pesa B2C Settlement',
    bankAccount: aff.mpesaNumber || aff.phone || '',
    customSlug: aff.customSlug || aff.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    preferredPricesJson,
    staffDataJson: serializeStaffPersonalData(personalData),
    active:
      aff.employmentStatus === 'SUSPENDED' || aff.employmentStatus === 'TERMINATED'
        ? false
        : aff.active ?? true,
    employmentStatus:
      aff.employmentStatus || (aff.active === false ? 'SUSPENDED' : 'ACTIVE'),
    suspendedAt: aff.suspendedAt,
    suspensionReason: aff.suspensionReason,
    terminatedAt: aff.terminatedAt,
    terminationReason: aff.terminationReason,
    lastLoginAt: existingMeta?.lastLoginAt,
    loginCount: existingMeta?.loginCount ?? 0,
    updatedAt: new Date().toISOString()
  };
}

export function staffDirectoryRecordToEmployee(rec: StaffDirectoryRecord): Employee {
  const status: StaffEmploymentStatus =
    rec.employmentStatus || (rec.active === false ? 'SUSPENDED' : 'ACTIVE');
  return {
    id: rec.id,
    employeeNumber: rec.codeOrNumber,
    name: rec.name,
    roleTitle: rec.roleTitle || 'Operations Staff',
    department: rec.department,
    employmentType: rec.employmentType || 'SALARIED',
    compensationModel: rec.compensationModel || 'MONTHLY_SALARY',
    commissionRatePercent: rec.commissionRatePercent ?? 0,
    totalSalesKes: rec.totalSalesKes ?? 0,
    totalCommissionEarnedKes: rec.totalCommissionEarnedKes ?? 0,
    paidCommissionKes: rec.paidCommissionKes ?? 0,
    pendingCommissionKes: rec.pendingCommissionKes ?? 0,
    branchId: rec.branchId || '',
    loginPin: rec.loginPin && /^\d{6}$/.test(rec.loginPin) ? rec.loginPin : '',
    pinHash: rec.pinHash,
    pinSalt: rec.pinSalt,
    basicSalaryKes: rec.basicSalaryKes ?? 0,
    houseAllowanceKes: rec.houseAllowanceKes ?? 0,
    transportAllowanceKes: rec.transportAllowanceKes ?? 0,
    kraPin: rec.kraPin || 'A009182736Z',
    nssfNumber: rec.nssfNumber || '',
    nhifShifNumber: rec.nhifShifNumber || '',
    bankName: rec.bankName || 'Equity Bank Kenya',
    bankAccount: rec.bankAccount || '',
    mPesaNumber: rec.phone || '',
    active: status === 'ACTIVE' && (rec.active ?? true),
    employmentStatus: status,
    suspendedAt: rec.suspendedAt,
    suspensionReason: rec.suspensionReason,
    terminatedAt: rec.terminatedAt,
    terminationReason: rec.terminationReason
  };
}

export function staffDirectoryRecordToAffiliate(rec: StaffDirectoryRecord): Affiliate {
  let preferredPrices: Record<string, number> = {};
  if (rec.preferredPricesJson) {
    try {
      preferredPrices = JSON.parse(rec.preferredPricesJson);
    } catch {
      preferredPrices = {};
    }
  }

  const status: StaffEmploymentStatus =
    rec.employmentStatus || (rec.active === false ? 'SUSPENDED' : 'ACTIVE');

  return {
    id: rec.id,
    name: rec.name,
    code: rec.codeOrNumber,
    phone: rec.phone || '',
    branchId: rec.branchId || '',
    assignedCashierId: rec.assignedCashierId || undefined,
    assignedCashierName: rec.assignedCashierName || undefined,
    employmentType: 'CASUAL',
    compensationModel: 'COMMISSION_ONLY',
    commissionRatePercent: rec.commissionRatePercent ?? 5,
    commissionMode: rec.commissionMode || 'COMMISSION_AND_PROFIT',
    allowPreferredPrice: rec.allowPreferredPrice ?? true,
    preferredPrices,
    customSlug: rec.customSlug || rec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    loginPin: rec.loginPin && /^\d{6}$/.test(rec.loginPin) ? rec.loginPin : '',
    pinHash: rec.pinHash,
    pinSalt: rec.pinSalt,
    totalSalesKes: rec.totalSalesKes ?? 0,
    companySalesTotalKes: rec.companySalesTotalKes ?? 0,
    preferredPriceProfitTotalKes: rec.preferredPriceProfitTotalKes ?? 0,
    baseCommissionTotalKes: rec.baseCommissionTotalKes ?? 0,
    totalCommissionEarnedKes: rec.totalCommissionEarnedKes ?? 0,
    paidCommissionKes: rec.paidCommissionKes ?? 0,
    pendingCommissionKes: rec.pendingCommissionKes ?? 0,
    mpesaNumber: rec.phone || '',
    active: status === 'ACTIVE' && (rec.active ?? true),
    employmentStatus: status,
    suspendedAt: rec.suspendedAt,
    suspensionReason: rec.suspensionReason,
    terminatedAt: rec.terminatedAt,
    terminationReason: rec.terminationReason
  };
}

// ============================================================================
// HIGH-LEVEL INDEPENDENT DATABASE SYNC & INSTANT PIN LOOKUP
// ============================================================================
export async function upsertStaffRecordAcrossAllTiers(
  record: StaffDirectoryRecord,
  personalData?: StaffPersonalDataPayload,
  force = false
): Promise<boolean> {
  unmarkStaffIdDeletedLocally(record.id);
  // Central database = source of truth. Write to central Firestore first.
  const ok = await pushStaffRecordToFirestore(record, force);
  if (!ok) {
    return false;
  }

  // Only update local browser cache after central database confirms success
  const existing = loadLocalIndependentStaffRecords();
  const next = existing.some(r => r.id === record.id)
    ? existing.map(r => (r.id === record.id ? record : r))
    : [record, ...existing];
  saveLocalIndependentStaffRecords(next);

  if (personalData) {
    const snaps = loadLocalStaffDataSnapshots();
    snaps[record.id] = personalData;
    saveLocalStaffDataSnapshots(snaps);
  }

  await writeRecordToStaffIndexedDb(record, personalData);
  return true;
}

export function findStaffByPinInstant(
  pin: string,
  records: StaffDirectoryRecord[],
  preferredDept?: DepartmentType,
  preferredStaffId?: string
): StaffDirectoryRecord | null {
  const cleanPin = sanitizeSixDigitPin(pin);
  const activeRecords = records.filter(r => r.active);

  const matchesRecordPin = (r: StaffDirectoryRecord): boolean => {
    // 1. Salted cryptographic hash verification
    if (r.pinHash && r.pinSalt) {
      return verifyPinAgainstHash(cleanPin, r.pinSalt, r.pinHash);
    }
    // 2. Legacy / unmigrated record fallback with constant-time equality check
    if (r.loginPin) {
      return constantTimeEquals(r.loginPin, cleanPin);
    }
    return false;
  };

  // 1. Exact selected staff ID + PIN match
  if (preferredStaffId) {
    const exactStaff = activeRecords.find(r => r.id === preferredStaffId && matchesRecordPin(r));
    if (exactStaff) return exactStaff;
  }

  // 2. Department + PIN match ONLY (never jump across departments when preferredDept is specified)
  if (preferredDept) {
    const deptMatch = activeRecords.find(
      r => r.department === preferredDept && matchesRecordPin(r)
    );
    return deptMatch || null;
  }

  // 3. Universal PIN match ONLY when no preferredDept constraint was provided
  const universalMatch = activeRecords.find(r => matchesRecordPin(r));
  return universalMatch || null;
}
