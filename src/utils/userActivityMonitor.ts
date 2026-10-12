import {
  collection,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
  limit
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
  DepartmentType,
  UserActivityActionType,
  UserActivityLog,
  UserRole,
  UserSessionMonitorRecord
} from '../types';

const LOCAL_ACTIVITY_LOGS_KEY = 'vaairo_user_activity_logs_v1';
const LOCAL_SESSION_MONITOR_KEY = 'vaairo_user_sessions_monitor_v1';
const FIRESTORE_ACTIVITY_COLLECTION = 'userActivityLogs';
const FIRESTORE_SESSION_COLLECTION = 'userSessionMonitors';

export interface DeviceProfile {
  deviceUsed: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  browserOs: string;
}

export function detectCurrentDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceUsed: 'Enterprise Terminal • Web Browser',
      deviceType: 'DESKTOP',
      browserOs: 'Web OS • Browser'
    };
  }

  const ua = navigator.userAgent || '';

  // Detect OS
  let os = 'Desktop OS';
  if (/Windows NT 10\.0/i.test(ua)) {
    os = 'Windows 10/11 PC';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows PC';
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android Device';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS Tablet';
  } else if (/iPhone|iPod/i.test(ua)) {
    os = 'iOS iPhone';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS Workstation';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS Terminal';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux Terminal';
  }

  // Detect Browser
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Apple Safari';
  }

  // Detect Device Type
  let deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' = 'DESKTOP';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'TABLET';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'MOBILE';
  }

  const screenW = window.screen?.width || window.innerWidth || 1440;
  const screenH = window.screen?.height || window.innerHeight || 900;
  const typeLabel =
    deviceType === 'MOBILE' ? 'Mobile' : deviceType === 'TABLET' ? 'Tablet' : 'Desktop POS';

  const browserOs = `${os} • ${browser}`;
  const deviceUsed = `${os} • ${browser} (${typeLabel} ${screenW}×${screenH})`;

  return {
    deviceUsed,
    deviceType,
    browserOs
  };
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

export function loadLocalActivityLogs(): UserActivityLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVITY_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalActivityLogs(logs: UserActivityLog[]): void {
  try {
    localStorage.setItem(LOCAL_ACTIVITY_LOGS_KEY, JSON.stringify(logs.slice(0, 350)));
  } catch {
    // ignore quota warning
  }
}

export function loadLocalSessionMonitors(): UserSessionMonitorRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_MONITOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalSessionMonitors(records: UserSessionMonitorRecord[]): void {
  try {
    localStorage.setItem(LOCAL_SESSION_MONITOR_KEY, JSON.stringify(records));
  } catch {
    // ignore quota warning
  }
}

const lastSessionWriteTimeByUserId = new Map<string, number>();

export async function pushActivityLogToFirestore(log: UserActivityLog): Promise<boolean> {
  if (isFirestoreWriteQuotaExhausted()) return true;
  // Skip writing frequent module-open navigation events to Firestore to conserve daily write quota
  if (log.actionType === 'MODULE_NAVIGATION') return true;
  try {
    const safeId = (log.id || `act-${Date.now()}`).trim().slice(0, 120);
    const cleanDoc = stripUndefined({
      ...log,
      id: safeId,
      userId: (log.userId || 'usr-01').slice(0, 120),
      userName: (log.userName || 'User').slice(0, 150),
      actionTitle: (log.actionTitle || 'System Action').slice(0, 200),
      actionDetails: (log.actionDetails || '').slice(0, 600),
      module: (log.module || 'DASHBOARD').slice(0, 80),
      deviceUsed: (log.deviceUsed || 'Desktop Terminal').slice(0, 200),
      browserOs: (log.browserOs || 'Web Browser').slice(0, 120),
      timestamp: (log.timestamp || new Date().toISOString()).slice(0, 60)
    });
    const res = await fetch('/api/audit/activity-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        logId: safeId,
        record: cleanDoc
      })
    });
    return res.ok;
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      markFirestoreWriteQuotaExhausted();
      return true;
    }
    try {
      handleFirestoreError(error, OperationType.WRITE, `${FIRESTORE_ACTIVITY_COLLECTION}/${log.id}`);
    } catch {
      // fallback to local storage silently
    }
    return false;
  }
}

export async function pushSessionMonitorToFirestore(
  session: UserSessionMonitorRecord
): Promise<boolean> {
  if (isFirestoreWriteQuotaExhausted()) return true;
  try {
    const safeId = (session.userId || `usr-${Date.now()}`).trim().slice(0, 120);
    const nowMs = Date.now();
    const lastMs = lastSessionWriteTimeByUserId.get(safeId) || 0;
    // Throttle session heartbeat writes per user to at most once every 60 seconds
    if (nowMs - lastMs < 60000) {
      return true;
    }
    lastSessionWriteTimeByUserId.set(safeId, nowMs);

    const cleanDoc = stripUndefined({
      ...session,
      userId: safeId,
      userName: (session.userName || 'User').slice(0, 150),
      employeeNumberOrCode: (session.employeeNumberOrCode || 'STAFF').slice(0, 60),
      deviceUsed: (session.deviceUsed || 'Desktop Terminal').slice(0, 200),
      browserOs: (session.browserOs || 'Web Browser').slice(0, 120),
      updatedAt: (session.updatedAt || new Date().toISOString()).slice(0, 60)
    });
    const res = await fetch('/api/audit/session-monitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        record: cleanDoc
      })
    });
    return res.ok;
  } catch (error) {
    if (isResourceExhaustedError(error)) {
      markFirestoreWriteQuotaExhausted();
      return true;
    }
    try {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_SESSION_COLLECTION}/${session.userId}`
      );
    } catch {
      // fallback to local storage silently
    }
    return false;
  }
}

export function subscribeToUserActivityLogs(
  onUpdate: (logs: UserActivityLog[]) => void
): Unsubscribe {
  let isDisposed = false;

  const pullActivityLogs = async () => {
    if (isDisposed) return;
    try {
      const res = await fetch('/api/audit/activity-state');
      if (res.ok && !isDisposed) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.activityLogs) && data.activityLogs.length > 0) {
          onUpdate(data.activityLogs as UserActivityLog[]);
        }
      }
    } catch {
      // Ignore transient network errors
    }
  };

  void pullActivityLogs();

  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/erp/live-stream');
      eventSource.addEventListener('USER_ACTIVITY_UPDATED', () => {
        if (!isDisposed) void pullActivityLogs();
      });
    } catch {
      eventSource = null;
    }
  }

  const pollTimer = setInterval(() => {
    void pullActivityLogs();
  }, 10000);

  let firestoreUnsub: Unsubscribe = () => {};
  if (!isFirestoreWriteQuotaExhausted()) {
    const q = query(
      collection(db, FIRESTORE_ACTIVITY_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    firestoreUnsub = onSnapshot(
      q,
      snapshot => {
        if (isDisposed) return;
        const cloudLogs: UserActivityLog[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as UserActivityLog;
          if (data && data.id && data.userName) {
            cloudLogs.push(data);
          }
        });
        if (cloudLogs.length > 0) {
          onUpdate(cloudLogs);
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
    clearInterval(pollTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    firestoreUnsub();
  };
}

export function subscribeToUserSessionMonitors(
  onUpdate: (sessions: UserSessionMonitorRecord[]) => void
): Unsubscribe {
  let isDisposed = false;

  const pullSessionMonitors = async () => {
    if (isDisposed) return;
    try {
      const res = await fetch('/api/audit/activity-state');
      if (res.ok && !isDisposed) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.sessionMonitors) && data.sessionMonitors.length > 0) {
          onUpdate(data.sessionMonitors as UserSessionMonitorRecord[]);
        }
      }
    } catch {
      // Ignore transient network errors
    }
  };

  void pullSessionMonitors();

  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/erp/live-stream');
      eventSource.addEventListener('USER_ACTIVITY_UPDATED', () => {
        if (!isDisposed) void pullSessionMonitors();
      });
    } catch {
      eventSource = null;
    }
  }

  const pollTimer = setInterval(() => {
    void pullSessionMonitors();
  }, 10000);

  let firestoreUnsub: Unsubscribe = () => {};
  if (!isFirestoreWriteQuotaExhausted()) {
    firestoreUnsub = onSnapshot(
      collection(db, FIRESTORE_SESSION_COLLECTION),
      snapshot => {
        if (isDisposed) return;
        const cloudSessions: UserSessionMonitorRecord[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as UserSessionMonitorRecord;
          if (data && data.userId && data.userName) {
            cloudSessions.push(data);
          }
        });
        if (cloudSessions.length > 0) {
          onUpdate(cloudSessions);
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
    clearInterval(pollTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    firestoreUnsub();
  };
}

export function buildActivityLogEntry(params: {
  userId: string;
  userName: string;
  userRole: UserRole;
  department: DepartmentType;
  branchId: string;
  branchName: string;
  actionType: UserActivityActionType;
  actionTitle: string;
  actionDetails: string;
  module: string;
}): UserActivityLog {
  const device = detectCurrentDeviceProfile();
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: params.userId || 'usr-01',
    userName: params.userName || 'System User',
    userRole: params.userRole,
    department: params.department,
    branchId: params.branchId || '',
    branchName: params.branchName || 'Head Office / All Branches',
    actionType: params.actionType,
    actionTitle: params.actionTitle,
    actionDetails: params.actionDetails,
    module: params.module || 'DASHBOARD',
    deviceUsed: device.deviceUsed,
    deviceType: device.deviceType,
    browserOs: device.browserOs,
    timestamp: new Date().toISOString()
  };
}
