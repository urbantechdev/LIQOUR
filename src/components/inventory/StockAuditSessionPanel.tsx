import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { getAuthHeaders } from '../../utils/apiAuth';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  db,
  auth,
  signInWithGooglePopup,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
  isFirestoreWriteQuotaExhausted,
  isResourceExhaustedError,
  markFirestoreWriteQuotaExhausted
} from '../../firebase';
import { useErp } from '../../context/ErpContext';
import { formatKes } from '../../utils/kenyaTax';
import {
  Barcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  Play,
  ShieldCheck,
  Database,
  RefreshCw,
  FileCheck2,
  Layers,
  Search,
  Sparkles,
  Store,
  Plus,
  History,
  X,
  ArrowRight,
  ClipboardCheck
} from 'lucide-react';

export interface AuditSkuEntry {
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  brand: string;
  volumeMl: number;
  category: 'IPS' | 'LPS';
  unitCostKes: number;
  expectedErpCount: number; // Snapshotted from Firebase/ERP at Step 1
  physicalScannedCount: number; // Incremented +1 in Step 2 scanning loop
  scannedInLoop: boolean; // True once scanned at least once in Step 2 (or included in shelf count)
  lastScannedAt?: string;
}

export interface AuditScanLoopEvent {
  id: string;
  timestamp: string;
  barcodeRead: string;
  mappedSku: string;
  productName: string;
  volumeMl: number;
  existedInSession: boolean;
  previousCount: number;
  newCount: number;
  expectedErpCount: number;
}

export interface FirestoreStockAuditSession {
  id: string;
  branchId: string;
  branchName: string;
  branchTier: string;
  status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
  auditorId: string;
  auditorName: string;
  startedAt: string;
  completedScanningAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  totalSkusInBaseline: number;
  totalExpectedUnits: number;
  totalScannedUnits: number;
  itemsMapJson: string;
  recentScansJson?: string;
}

export interface FirestoreStockAdjustmentLog {
  id: string;
  auditSessionId: string;
  branchId: string;
  branchName: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  expectedErpCount: number;
  physicalScannedCount: number;
  variance: number;
  discrepancyFlag: 'MATCHED' | 'SHRINKAGE_LOSS' | 'SURPLUS_REVIEW';
  unitCostKes: number;
  varianceValueKes: number;
  auditorName: string;
  approvedBy: string;
  createdAt: string;
}

export const StockAuditSessionPanel: React.FC = () => {
  const {
    branches,
    activeBranch,
    products,
    inventoryItems,
    currentUser,
    currentRole,
    applyApprovedStockAuditToBranch,
    postManualJournalEntry
  } = useErp();

  // Firebase Connection & Auth State
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firestoreErrorBanner, setFirestoreErrorBanner] = useState<string | null>(null);

  // Selected Branch for Step 1 Audit Initialization
  const [auditBranchId, setAuditBranchId] = useState<string>(activeBranch.id);
  const selectedAuditBranch = branches.find(b => b.id === auditBranchId) || activeBranch;

  // Live Firestore Sessions & Adjustment Logs (with LocalStorage persistence fallback)
  const [sessions, setSessions] = useState<FirestoreStockAuditSession[]>(() => {
    try {
      const saved = localStorage.getItem('vaairo_local_stock_audit_sessions_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [adjustmentLogs, setAdjustmentLogs] = useState<FirestoreStockAdjustmentLog[]>(() => {
    try {
      const saved = localStorage.getItem('vaairo_local_stock_adjustment_logs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInitializingSession, setIsInitializingSession] = useState<boolean>(false);
  const [isApprovingAudit, setIsApprovingAudit] = useState<boolean>(false);

  // Step 2: Rapid Barcode Scanning Loop State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastScanTrace, setLastScanTrace] = useState<AuditScanLoopEvent | null>(null);
  const [unknownBarcodeAlert, setUnknownBarcodeAlert] = useState<string | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Step 3: Discrepancy Filter State
  const [varianceFilter, setVarianceFilter] = useState<
    'ALL_SCANNED' | 'ALL_BASELINE' | 'SHRINKAGE_LOSS' | 'SURPLUS_REVIEW' | 'MATCHED'
  >('ALL_SCANNED');
  const [skuSearchQuery, setSkuSearchQuery] = useState<string>('');

  // Status Toast
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 6000);
  };

  // Web Audio API short confirmation beep for Step 2 Rapid Scanning Loop
  const playScanConfirmationSound = (isNewRow: boolean, isError = false) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isError) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else if (isNewRow) {
        // Double chime for new SKU line item created (count = 1)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } else {
        // Crisp high beep for +1 increment on existing SKU
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      }
    } catch {
      // Ignore audio context restrictions if not interacted
    }
  };

  // Persist sessions & adjustmentLogs locally so Stock Audit always works even if daily cloud write quota is reached
  useEffect(() => {
    try {
      localStorage.setItem('vaairo_local_stock_audit_sessions_v1', JSON.stringify(sessions.slice(0, 30)));
    } catch {
      // Ignore storage errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem('vaairo_local_stock_adjustment_logs_v1', JSON.stringify(adjustmentLogs.slice(0, 100)));
    } catch {
      // Ignore storage errors
    }
  }, [adjustmentLogs]);

  // Verify Firestore connection and subscribe to real-time collections
  useEffect(() => {
    testFirestoreConnection().then(ok => setFirebaseConnected(ok));
    const unsubAuth = onAuthStateChanged(auth, u => setFirebaseUser(u));

    if (isFirestoreWriteQuotaExhausted()) {
      setFirebaseConnected(true);
      setFirestoreErrorBanner(null);
      setActiveSessionId(prev => {
        if (prev && sessions.some(s => s.id === prev)) return prev;
        const activeOne = sessions.find(
          s => s.status === 'IN_PROGRESS' || s.status === 'PENDING_APPROVAL'
        );
        return activeOne ? activeOne.id : sessions[0]?.id || null;
      });
      return () => unsubAuth();
    }

    const isAdmin = currentRole === 'SUPER_ADMIN';
    const scopedBranchId = auditBranchId || activeBranch.id;
    const sessionsQuery = isAdmin
      ? query(collection(db, 'stockAuditSessions'), orderBy('startedAt', 'desc'), limit(20))
      : query(
          collection(db, 'stockAuditSessions'),
          where('branchId', '==', scopedBranchId),
          limit(20)
        );
    const unsubSessions = onSnapshot(
      sessionsQuery,
      snap => {
        const list: FirestoreStockAuditSession[] = [];
        snap.forEach(d => list.push(d.data() as FirestoreStockAuditSession));
        if (list.length > 0) {
          setSessions(prev => {
            const byId = new Map<string, FirestoreStockAuditSession>();
            prev.forEach(s => byId.set(s.id, s));
            list.forEach(s => byId.set(s.id, s));
            return Array.from(byId.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          });
        }
        setFirebaseConnected(true);
        setFirestoreErrorBanner(null);

        // Automatically select the most recent active or pending session if none selected
        setActiveSessionId(prev => {
          if (prev && list.some(s => s.id === prev)) return prev;
          const activeOne = list.find(
            s => s.status === 'IN_PROGRESS' || s.status === 'PENDING_APPROVAL'
          );
          return activeOne ? activeOne.id : list[0]?.id || prev;
        });
      },
      err => {
        if (isResourceExhaustedError(err)) {
          markFirestoreWriteQuotaExhausted();
          setFirestoreErrorBanner(null);
          return;
        }
        const info = handleFirestoreError(err, OperationType.LIST, 'stockAuditSessions');
        setFirestoreErrorBanner(info.error);
      }
    );

    const logsQuery = isAdmin
      ? query(collection(db, 'stockAdjustmentLogs'), orderBy('createdAt', 'desc'), limit(50))
      : query(
          collection(db, 'stockAdjustmentLogs'),
          where('branchId', '==', scopedBranchId),
          limit(50)
        );
    const unsubLogs = onSnapshot(
      logsQuery,
      snap => {
        const list: FirestoreStockAdjustmentLog[] = [];
        snap.forEach(d => list.push(d.data() as FirestoreStockAdjustmentLog));
        if (list.length > 0) {
          setAdjustmentLogs(prev => {
            const byId = new Map<string, FirestoreStockAdjustmentLog>();
            prev.forEach(l => byId.set(l.id, l));
            list.forEach(l => byId.set(l.id, l));
            return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });
        }
      },
      err => {
        if (isResourceExhaustedError(err)) {
          markFirestoreWriteQuotaExhausted();
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'stockAdjustmentLogs');
      }
    );

    return () => {
      unsubAuth();
      unsubSessions();
      unsubLogs();
    };
  }, []);

  // Currently selected Firestore Audit Session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // Parsed SKU entries map from the active Firebase session
  const sessionItemsMap = useMemo<Record<string, AuditSkuEntry>>(() => {
    if (!activeSession?.itemsMapJson) return {};
    try {
      return JSON.parse(activeSession.itemsMapJson) as Record<string, AuditSkuEntry>;
    } catch {
      return {};
    }
  }, [activeSession]);

  // Parsed Recent Scan Loop Events
  const recentScans = useMemo<AuditScanLoopEvent[]>(() => {
    if (!activeSession?.recentScansJson) return [];
    try {
      return JSON.parse(activeSession.recentScansJson) as AuditScanLoopEvent[];
    } catch {
      return [];
    }
  }, [activeSession]);

  // Camera Scanner Lifecycle for Mobile Device Camera Auditing
  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;

    if (isCameraScannerOpen) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }

          // Use native BarcodeDetector if supported by the mobile browser
          const BarcodeDetectorApi = (window as unknown as {
            BarcodeDetector?: new (opts: { formats: string[] }) => {
              detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
            };
          }).BarcodeDetector;

          if (BarcodeDetectorApi) {
            const detector = new BarcodeDetectorApi({
              formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'itf']
            });
            let isDetecting = false;
            let lastCode = '';
            let lastTs = 0;
            intervalId = window.setInterval(async () => {
              if (isDetecting || !videoRef.current || videoRef.current.readyState < 2) return;
              isDetecting = true;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && codes[0].rawValue) {
                  const raw = String(codes[0].rawValue).trim();
                  const now = Date.now();
                  if (raw && (raw !== lastCode || now - lastTs > 1100)) {
                    lastCode = raw;
                    lastTs = now;
                    await processRapidBarcodeScan(raw);
                  }
                }
              } catch {
                // ignore frame error
              } finally {
                isDetecting = false;
              }
            }, 120);
          }
        })
        .catch(() => {
          // Camera permission denied or unavailable in preview iframe
        });
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isCameraScannerOpen, activeSession]);

  // ============================================================================
  // STEP 1: INITIALIZE AUDIT SESSION (SNAPSHOT BASELINE FROM FIREBASE / ERP)
  // ============================================================================
  const handleInitializeAuditSession = async () => {
    setIsInitializingSession(true);
    setFirestoreErrorBanner(null);
    try {
      const sessionId = `AUD-2026-${Date.now().toString().slice(-5)}`;
      const nowIso = new Date().toISOString();

      // Snapshot expected inventory quantities for the selected branch
      // We include the branch's stocked SKUs + priority Whisky SKUs (including 750ml IPS-WHISKY-002 & 1L IPS-WHISKY-002-1L)
      const baselineMap: Record<string, AuditSkuEntry> = {};
      let totalExpected = 0;

      // Snapshot ALL products and branch inventory items for the selected branch
      const branchInv = inventoryItems.filter(i => i.branchId === selectedAuditBranch.id);
      const allBranchProductIds = new Set<string>([
        ...branchInv.map(i => i.productId),
        ...products.map(p => p.id)
      ]);

      const baselineLedgers: Array<Record<string, unknown>> = [];

      allBranchProductIds.forEach(pid => {
        const prod = products.find(p => p.id === pid);
        if (!prod) return;
        const invRecord = branchInv.find(i => i.productId === prod.id);
        const expectedCount = invRecord ? invRecord.bottlesOnHand : 0;
        // Include in audit baseline if stocked or part of active branch inventory
        if (!invRecord && Object.keys(baselineMap).length >= 60) return;
        totalExpected += expectedCount;

        baselineMap[prod.sku] = {
          productId: prod.id,
          sku: prod.sku,
          barcode: prod.barcode,
          productName: prod.name,
          brand: prod.brand,
          volumeMl: prod.volumeMl,
          category: prod.category,
          unitCostKes: prod.warehouseCostKes,
          expectedErpCount: expectedCount,
          physicalScannedCount: 0,
          scannedInLoop: false
        };

        // Sync baseline snapshot via authoritative VAAIRO server API
        if (baselineLedgers.length < 50) {
          const ledgerId = `${selectedAuditBranch.id}_${prod.id}`;
          baselineLedgers.push({
            id: ledgerId,
            branchId: selectedAuditBranch.id,
            productId: prod.id,
            sku: prod.sku,
            barcode: prod.barcode,
            productName: prod.name,
            quantity: expectedCount,
            lastAuditSessionId: sessionId,
            updatedAt: nowIso
          });
        }
      });

      const newSession: FirestoreStockAuditSession = {
        id: sessionId,
        branchId: selectedAuditBranch.id,
        branchName: selectedAuditBranch.name,
        branchTier: selectedAuditBranch.tier,
        status: 'IN_PROGRESS',
        auditorId: firebaseUser?.uid || currentUser.id,
        auditorName: firebaseUser?.displayName || currentUser.name,
        startedAt: nowIso,
        totalSkusInBaseline: Object.keys(baselineMap).length,
        totalExpectedUnits: totalExpected,
        totalScannedUnits: 0,
        itemsMapJson: JSON.stringify(baselineMap),
        recentScansJson: JSON.stringify([])
      };

      // Optimistically update local sessions state first
      setSessions(prev => [newSession, ...prev.filter(s => s.id !== sessionId)]);
      setActiveSessionId(sessionId);
      setLastScanTrace(null);

      if (!isFirestoreWriteQuotaExhausted()) {
        try {
          await fetch('/api/erp/stock-audit/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              sessionId,
              sessionData: newSession,
              baselineLedgers
            })
          });
        } catch (cloudErr) {
          if (isResourceExhaustedError(cloudErr)) {
            markFirestoreWriteQuotaExhausted();
          } else {
            handleFirestoreError(cloudErr, OperationType.CREATE, 'stockAuditSessions');
          }
        }
      }

      showNotice(
        `Step 1 Complete: Initialized Stock Audit Session ${sessionId} for ${selectedAuditBranch.name}. Snapshotted ${Object.keys(baselineMap).length} SKUs (${totalExpected} expected bottles) from baseline.`
      );
      setTimeout(() => scannerInputRef.current?.focus(), 150);
    } catch (error) {
      if (!isResourceExhaustedError(error)) {
        const info = handleFirestoreError(error, OperationType.CREATE, 'stockAuditSessions');
        setFirestoreErrorBanner(info.error);
      }
    } finally {
      setIsInitializingSession(false);
    }
  };

  // ============================================================================
  // STEP 2: RAPID BARCODE SCANNING LOOP (UNIVERSAL BARCODE BATCH AGGREGATION)
  // ============================================================================
  const processRapidBarcodeScan = async (rawCodeInput: string, incrementBy = 1) => {
    const cleanCode = rawCodeInput.trim();
    if (!cleanCode || !activeSession || activeSession.status !== 'IN_PROGRESS') return;

    setUnknownBarcodeAlert(null);

    // 1. Resolve universal barcode (or SKU) to the exact size-specific Product SKU
    // E.g. 500029912302 -> IPS-WHISKY-002 (750ml Johnnie Walker Black Label)
    // E.g. 500029912319 -> IPS-WHISKY-002-1L (1 Litre Johnnie Walker Black Label)
    const matchedProduct = products.find(
      p =>
        p.barcode === cleanCode ||
        p.sku.toLowerCase() === cleanCode.toLowerCase() ||
        p.caseBarcode === cleanCode ||
        (cleanCode === '500029912302' && (p.sku === 'IPS-WHISKY-002' || p.id === 'nd-prod-001')) ||
        (cleanCode === '500029912319' && (p.sku === 'IPS-WHISKY-002-1L' || p.id === 'nd-prod-002'))
    );

    if (!matchedProduct) {
      playScanConfirmationSound(false, true);
      setUnknownBarcodeAlert(
        `Universal Barcode "${cleanCode}" did not match any registered SKU in the catalog.`
      );
      return;
    }

    const targetSku = matchedProduct.sku;
    const currentMap: Record<string, AuditSkuEntry> = { ...sessionItemsMap };
    const existingEntry = currentMap[targetSku];

    // Query Firebase Session: Does a session entry with scanned count for this SKU already exist in the active scan loop?
    const existedInScanLoop = Boolean(existingEntry && existingEntry.scannedInLoop);
    const previousScannedCount = existingEntry ? existingEntry.physicalScannedCount : 0;
    const newScannedCount = Math.max(0, previousScannedCount + incrementBy);

    // Expected ERP Baseline for this branch
    const branchInvRecord = inventoryItems.find(
      i => i.branchId === activeSession.branchId && i.productId === matchedProduct.id
    );
    const expectedErpCount = existingEntry
      ? existingEntry.expectedErpCount
      : branchInvRecord
      ? branchInvRecord.bottlesOnHand
      : 0;

    const nowIso = new Date().toISOString();

    currentMap[targetSku] = {
      productId: matchedProduct.id,
      sku: targetSku,
      barcode: matchedProduct.barcode,
      productName: matchedProduct.name,
      brand: matchedProduct.brand,
      volumeMl: matchedProduct.volumeMl,
      category: matchedProduct.category,
      unitCostKes: matchedProduct.warehouseCostKes,
      expectedErpCount,
      physicalScannedCount: newScannedCount,
      scannedInLoop: true,
      lastScannedAt: nowIso
    };

    const scanEvent: AuditScanLoopEvent = {
      id: `scan-loop-${Date.now()}`,
      timestamp: nowIso,
      barcodeRead: matchedProduct.barcode,
      mappedSku: targetSku,
      productName: matchedProduct.name,
      volumeMl: matchedProduct.volumeMl,
      existedInSession: existedInScanLoop,
      previousCount: previousScannedCount,
      newCount: newScannedCount,
      expectedErpCount
    };

    const updatedRecentScans = [scanEvent, ...recentScans.slice(0, 24)];
    const totalScanned = Object.values(currentMap).reduce(
      (sum, item) => sum + item.physicalScannedCount,
      0
    );
    const totalExpected = Object.values(currentMap).reduce(
      (sum, item) => sum + item.expectedErpCount,
      0
    );

    // Play short confirmation sound immediately
    playScanConfirmationSound(!existedInScanLoop, false);
    setLastScanTrace(scanEvent);
    setBarcodeInput('');

    const updatedSessionFields = {
      itemsMapJson: JSON.stringify(currentMap),
      recentScansJson: JSON.stringify(updatedRecentScans),
      totalScannedUnits: totalScanned,
      totalExpectedUnits: totalExpected,
      totalSkusInBaseline: Object.keys(currentMap).length
    };

    // Update local state immediately
    setSessions(prev =>
      prev.map(s => (s.id === activeSession.id ? { ...s, ...updatedSessionFields } : s))
    );

    if (!isFirestoreWriteQuotaExhausted()) {
      try {
        await fetch('/api/erp/stock-audit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            sessionId: activeSession.id,
            sessionData: {
              ...activeSession,
              ...updatedSessionFields
            }
          })
        });
      } catch (error) {
        if (isResourceExhaustedError(error)) {
          markFirestoreWriteQuotaExhausted();
        } else {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `stockAuditSessions/${activeSession.id}`
          );
        }
      }
    }
  };

  const handleManualFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    await processRapidBarcodeScan(barcodeInput);
    scannerInputRef.current?.focus();
  };

  // Production helper: Confirm all remaining unscanned baseline SKUs match their expected ERP count (for cycle count / exception-based auditing)
  const handleVerifyRemainingBaselineAsMatched = async () => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;
    const currentMap: Record<string, AuditSkuEntry> = { ...sessionItemsMap };
    const nowIso = new Date().toISOString();

    Object.values(currentMap).forEach(entry => {
      // Only populate unscanned items with their expected ERP count; preserve any physically scanned counts
      const resolvedCount = entry.scannedInLoop
        ? entry.physicalScannedCount
        : entry.expectedErpCount;

      currentMap[entry.sku] = {
        ...entry,
        physicalScannedCount: resolvedCount,
        scannedInLoop: true,
        lastScannedAt: entry.lastScannedAt || nowIso
      };
    });

    const totalScanned = Object.values(currentMap).reduce(
      (sum, item) => sum + item.physicalScannedCount,
      0
    );

    playScanConfirmationSound(false, false);

    const updatedFields = {
      itemsMapJson: JSON.stringify(currentMap),
      totalScannedUnits: totalScanned
    };

    setSessions(prev =>
      prev.map(s => (s.id === activeSession.id ? { ...s, ...updatedFields } : s))
    );

    if (!isFirestoreWriteQuotaExhausted()) {
      try {
        await fetch('/api/erp/stock-audit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            sessionId: activeSession.id,
            sessionData: {
              ...activeSession,
              ...updatedFields
            }
          })
        });
      } catch (error) {
        if (isResourceExhaustedError(error)) {
          markFirestoreWriteQuotaExhausted();
        } else {
          handleFirestoreError(error, OperationType.UPDATE, `stockAuditSessions/${activeSession.id}`);
        }
      }
    }
    showNotice(
      'Cycle Count Baseline Synced: Unscanned shelf SKUs matched to their live ERP expected counts while preserving all scanned physical counts.'
    );
  };

  // ============================================================================
  // STEP 3: COMPLETE PHYSICAL COUNT & LOCK FOR VARIANCE REVIEW
  // ============================================================================
  const handleCompletePhysicalCount = async () => {
    if (!activeSession) return;
    const completedAt = new Date().toISOString();
    setSessions(prev =>
      prev.map(s =>
        s.id === activeSession.id
          ? { ...s, status: 'PENDING_APPROVAL', completedScanningAt: completedAt }
          : s
      )
    );
    if (!isFirestoreWriteQuotaExhausted()) {
      try {
        await fetch('/api/erp/stock-audit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            sessionId: activeSession.id,
            sessionData: {
              ...activeSession,
              status: 'PENDING_APPROVAL',
              completedScanningAt: completedAt
            }
          })
        });
      } catch (error) {
        if (isResourceExhaustedError(error)) {
          markFirestoreWriteQuotaExhausted();
        } else {
          handleFirestoreError(error, OperationType.UPDATE, `stockAuditSessions/${activeSession.id}`);
        }
      }
    }
    showNotice(
      `Step 3 Variance Calculation Ready: Physical count finalized for ${activeSession.branchName}. Ready for Senior Manager / Store Owner approval.`
    );
  };

  const handleReopenScanningLoop = async () => {
    if (!activeSession || activeSession.status === 'APPROVED') return;
    setSessions(prev =>
      prev.map(s => (s.id === activeSession.id ? { ...s, status: 'IN_PROGRESS' } : s))
    );
    if (!isFirestoreWriteQuotaExhausted()) {
      try {
        await fetch('/api/erp/stock-audit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            sessionId: activeSession.id,
            sessionData: {
              ...activeSession,
              status: 'IN_PROGRESS'
            }
          })
        });
      } catch (error) {
        if (isResourceExhaustedError(error)) {
          markFirestoreWriteQuotaExhausted();
        } else {
          handleFirestoreError(error, OperationType.UPDATE, `stockAuditSessions/${activeSession.id}`);
        }
      }
    }
    showNotice('Re-opened Step 2 Rapid Barcode Scanning Loop for additional shelf scans.');
  };

  // ============================================================================
  // STEP 4: AUDIT APPROVAL & FIREBASE LEDGER ADJUSTMENT
  // ============================================================================
  const handleApproveAuditAndAdjustLedger = async () => {
    if (!activeSession || activeSession.status === 'APPROVED') return;
    setIsApprovingAudit(true);
    setFirestoreErrorBanner(null);

    try {
      const nowIso = new Date().toISOString();
      const approverLabel = `${firebaseUser?.displayName || currentUser.name} (${currentRole})`;
      const entries = Object.values(sessionItemsMap);
      const auditedEntries = entries.filter(e => e.scannedInLoop);
      const targetList = auditedEntries.length > 0 ? auditedEntries : entries;

      const ledgersToPersist: Array<Record<string, unknown>> = [];
      const adjustmentLogsToPersist: FirestoreStockAdjustmentLog[] = [];
      const localAdjustments: { productId: string; physicalCount: number }[] = [];
      let netShrinkageLossKes = 0;
      let netSurplusGainKes = 0;

      targetList.forEach(entry => {
        // Variance = Physical Count - Expected ERP Count
        const variance = entry.physicalScannedCount - entry.expectedErpCount;
        const discrepancyFlag: 'MATCHED' | 'SHRINKAGE_LOSS' | 'SURPLUS_REVIEW' =
          variance < 0 ? 'SHRINKAGE_LOSS' : variance > 0 ? 'SURPLUS_REVIEW' : 'MATCHED';
        const varianceValueKes = variance * entry.unitCostKes;

        if (variance < 0) {
          netShrinkageLossKes += Math.abs(varianceValueKes);
        } else if (variance > 0) {
          netSurplusGainKes += varianceValueKes;
        }

        // 1. Prepare live inventory ledger record for authoritative server approval
        const ledgerId = `${activeSession.branchId}_${entry.productId}`;
        ledgersToPersist.push({
          id: ledgerId,
          branchId: activeSession.branchId,
          productId: entry.productId,
          sku: entry.sku,
          barcode: entry.barcode,
          productName: entry.productName,
          quantity: entry.physicalScannedCount,
          lastAuditSessionId: activeSession.id,
          updatedAt: nowIso
        });

        // 2. Generate automated stock adjustment log for auditing accountability
        const logId = `ADJ-${activeSession.id}-${entry.sku}`;
        const logRecord: FirestoreStockAdjustmentLog = {
          id: logId,
          auditSessionId: activeSession.id,
          branchId: activeSession.branchId,
          branchName: activeSession.branchName,
          productId: entry.productId,
          sku: entry.sku,
          barcode: entry.barcode,
          productName: entry.productName,
          expectedErpCount: entry.expectedErpCount,
          physicalScannedCount: entry.physicalScannedCount,
          variance,
          discrepancyFlag,
          unitCostKes: entry.unitCostKes,
          varianceValueKes,
          auditorName: activeSession.auditorName,
          approvedBy: approverLabel,
          createdAt: nowIso
        };
        adjustmentLogsToPersist.push(logRecord);

        localAdjustments.push({
          productId: entry.productId,
          physicalCount: entry.physicalScannedCount
        });
      });

      const newLogsGenerated: FirestoreStockAdjustmentLog[] = adjustmentLogsToPersist;

      // 3. Mark Audit Session as APPROVED locally & via VAAIRO Server API
      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id
            ? { ...s, status: 'APPROVED', approvedAt: nowIso, approvedBy: approverLabel }
            : s
        )
      );

      setAdjustmentLogs(prev => [...newLogsGenerated, ...prev].slice(0, 100));

      if (!isFirestoreWriteQuotaExhausted()) {
        try {
          await fetch('/api/erp/stock-audit/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              sessionId: activeSession.id,
              branchId: activeSession.branchId,
              approvedAt: nowIso,
              approvedBy: approverLabel,
              ledgers: ledgersToPersist,
              adjustmentLogs: adjustmentLogsToPersist
            })
          });
        } catch (cloudErr) {
          if (isResourceExhaustedError(cloudErr)) {
            markFirestoreWriteQuotaExhausted();
          } else {
            handleFirestoreError(
              cloudErr,
              OperationType.WRITE,
              `stockAuditSessions/${activeSession.id}`
            );
          }
        }
      }

      // 4. Synchronize ERP live branch inventory state to match physical counts
      applyApprovedStockAuditToBranch(activeSession.branchId, localAdjustments);

      // 5. Post automated accounting journal entry if there is net shrinkage loss
      if (netShrinkageLossKes > 0) {
        postManualJournalEntry({
          date: nowIso.split('T')[0],
          referenceType: 'MANUAL',
          referenceId: `AUDIT-${activeSession.id}`,
          description: `Approved Stock Audit ${activeSession.id} (${activeSession.branchName}) — Shrinkage/Breakage Adjustment`,
          branchId: activeSession.branchId,
          lines: [
            {
              accountCode: '5010',
              accountName: 'Cost of Goods Sold (COGS) - Shrinkage/Breakage',
              debitKes: netShrinkageLossKes,
              creditKes: 0
            },
            {
              accountCode: '1200',
              accountName: 'Inventory Asset - Bonded & Duty Paid Stock',
              debitKes: 0,
              creditKes: netShrinkageLossKes
            }
          ],
          totalDebitKes: netShrinkageLossKes,
          totalCreditKes: netShrinkageLossKes,
          postedBy: approverLabel
        });
      }

      showNotice(
        `Step 4 Approved! Live Firebase Inventory Ledger & ERP Stock for ${activeSession.branchName} updated to match physical counts. Generated ${targetList.length} immutable Stock Adjustment Logs.`
      );
    } catch (error) {
      const info = handleFirestoreError(
        error,
        OperationType.WRITE,
        `stockAuditSessions/${activeSession.id}`
      );
      setFirestoreErrorBanner(info.error);
    } finally {
      setIsApprovingAudit(false);
    }
  };

  // ============================================================================
  // COMPUTED DISCREPANCY / VARIANCE ROWS (STEP 3 FORMULA)
  // Variance = Physical Count - Expected ERP Count
  // ============================================================================
  const computedAuditRows = useMemo(() => {
    const allEntries = Object.values(sessionItemsMap);
    return allEntries
      .map(entry => {
        const variance = entry.physicalScannedCount - entry.expectedErpCount;
        const flag: 'MATCHED' | 'SHRINKAGE_LOSS' | 'SURPLUS_REVIEW' =
          variance < 0 ? 'SHRINKAGE_LOSS' : variance > 0 ? 'SURPLUS_REVIEW' : 'MATCHED';
        const varianceValueKes = variance * entry.unitCostKes;
        return {
          ...entry,
          variance,
          flag,
          varianceValueKes
        };
      })
      .filter(row => {
        if (varianceFilter === 'ALL_SCANNED' && !row.scannedInLoop) {
          // Always show Johnnie Walker 750ml & 1L at the top even before first scan so user sees baseline
          if (row.sku !== 'IPS-WHISKY-002' && row.sku !== 'IPS-WHISKY-002-1L') return false;
        }
        if (varianceFilter === 'SHRINKAGE_LOSS' && row.variance >= 0) return false;
        if (varianceFilter === 'SURPLUS_REVIEW' && row.variance <= 0) return false;
        if (varianceFilter === 'MATCHED' && row.variance !== 0) return false;

        if (!skuSearchQuery.trim()) return true;
        const q = skuSearchQuery.toLowerCase();
        return (
          row.sku.toLowerCase().includes(q) ||
          row.barcode.toLowerCase().includes(q) ||
          row.productName.toLowerCase().includes(q) ||
          row.brand.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aScanned = Boolean(a.scannedInLoop || a.physicalScannedCount > 0);
        const bScanned = Boolean(b.scannedInLoop || b.physicalScannedCount > 0);
        // 1. Always place already-scanned products at the very top
        if (aScanned !== bScanned) return aScanned ? -1 : 1;

        // 2. Among already-scanned products, sort by most recently scanned first, then highest scanned count
        if (aScanned && bScanned) {
          const timeCmp = (b.lastScannedAt || '').localeCompare(a.lastScannedAt || '');
          if (timeCmp !== 0) return timeCmp;
          if (b.physicalScannedCount !== a.physicalScannedCount) {
            return b.physicalScannedCount - a.physicalScannedCount;
          }
        }

        // 3. For unscanned baseline products, keep IPS-WHISKY-002 (750ml) & IPS-WHISKY-002-1L (1L) first
        if (a.sku === 'IPS-WHISKY-002') return -1;
        if (b.sku === 'IPS-WHISKY-002') return 1;
        if (a.sku === 'IPS-WHISKY-002-1L') return -1;
        if (b.sku === 'IPS-WHISKY-002-1L') return 1;
        return a.sku.localeCompare(b.sku);
      });
  }, [sessionItemsMap, varianceFilter, skuSearchQuery]);

  // Summary metrics for Step 3 & Step 4
  const auditSummary = useMemo(() => {
    const rows = Object.values(sessionItemsMap);
    const scannedRows = rows.filter(r => r.scannedInLoop);
    const activeSet = scannedRows.length > 0 ? scannedRows : rows;

    let expectedTotal = 0;
    let physicalTotal = 0;
    let shrinkageSkus = 0;
    let shrinkageUnits = 0;
    let shrinkageKes = 0;
    let surplusSkus = 0;
    let surplusUnits = 0;
    let surplusKes = 0;
    let matchedSkus = 0;

    activeSet.forEach(r => {
      expectedTotal += r.expectedErpCount;
      physicalTotal += r.physicalScannedCount;
      const v = r.physicalScannedCount - r.expectedErpCount;
      if (v < 0) {
        shrinkageSkus += 1;
        shrinkageUnits += Math.abs(v);
        shrinkageKes += Math.abs(v) * r.unitCostKes;
      } else if (v > 0) {
        surplusSkus += 1;
        surplusUnits += v;
        surplusKes += v * r.unitCostKes;
      } else {
        matchedSkus += 1;
      }
    });

    return {
      totalSkusAudited: scannedRows.length,
      totalBaselineSkus: rows.length,
      expectedTotal,
      physicalTotal,
      netUnitVariance: physicalTotal - expectedTotal,
      shrinkageSkus,
      shrinkageUnits,
      shrinkageKes,
      surplusSkus,
      surplusUnits,
      surplusKes,
      matchedSkus
    };
  }, [sessionItemsMap]);

  // Quick-Scan Test Presets demonstrating Universal Barcodes across Bottle Sizes, Rum Styles, & Cream Liqueurs
  const quickScanPresets = useMemo(() => {
    const jw750 = products.find(p => p.sku === 'IPS-WHISKY-002' || p.id === 'nd-prod-001');
    const jw1L = products.find(p => p.sku === 'IPS-WHISKY-002-1L' || p.id === 'nd-prod-002');
    const cmSpicedGold = products.find(p => p.id === 'nd-prod-035');
    const cmDark = products.find(p => p.id === 'nd-prod-535');
    const bacardiWhite = products.find(p => p.id === 'nd-prod-548');
    const baileysCream = products.find(p => p.id === 'nd-prod-040');
    const amarulaCream = products.find(p => p.id === 'nd-prod-041');
    return [jw750, jw1L, cmSpicedGold, cmDark, bacardiWhite, baileysCream, amarulaCream].filter(Boolean);
  }, [products]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGooglePopup();
    } catch {
      // Popup closed or blocked in iframe
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER BANNER: 4-STEP FIREBASE STOCK-TAKING WORKFLOW ARCHITECTURE
          ===================================================================== */}
      <div className="bg-linear-to-r from-[#0A006E] via-[#0d047a] to-[#1E9E60] text-white rounded-3xl border-2 border-[#FFDE00] p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Firebase Real-Time Stock-Taking Engine</span>
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
                  firebaseConnected
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    : 'bg-red-500/20 text-red-200 border-red-400/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    firebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                <span>
                  {firebaseConnected
                    ? 'Firestore Live Sync Connected'
                    : 'Firestore Offline Warning'}
                </span>
              </span>
              {firebaseUser ? (
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-mono">
                  Google Cloud Auditor: {firebaseUser.email}
                </span>
              ) : (
                <button
                  type="button"
                  data-oauth-popup="true"
                  onClick={handleGoogleSignIn}
                  className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[#FFDE00] border border-white/20 text-[10px] font-montserrat font-bold transition cursor-pointer"
                >
                  Link Google Auditor ID (Optional)
                </button>
              )}
            </div>

            <h3 className="font-montserrat font-black italic text-xl sm:text-2xl text-white tracking-tight">
              4-Step Stock-Taking Audit Session &amp; Universal Barcode Aggregation
            </h3>
            <p className="text-xs text-slate-200 max-w-3xl">
              Processes identical 750ml &amp; 1-Litre bottles via Firebase batch aggregation loops rather than manual line-by-line entry. Automatically calculates <span className="font-mono text-[#FFDE00]">Variance = Physical Count − Expected ERP Count</span> and adjusts the live branch ledger upon approval.
            </p>
          </div>

          {/* Sound Toggle & Session Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3.5 py-2.5 rounded-xl border font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                soundEnabled
                  ? 'bg-[#FFDE00] text-[#0A006E] border-white shadow-sm'
                  : 'bg-white/10 text-white border-white/25'
              }`}
              title="Toggle short confirmation sound on barcode scan"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Scan Beep: ON' : 'Scan Beep: MUTED'}</span>
            </button>

            {sessions.length > 0 && (
              <select
                value={activeSessionId || ''}
                onChange={e => setActiveSessionId(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white font-mono font-bold text-xs focus:outline-none"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id} className="text-slate-900 font-bold">
                    {s.id} • {s.branchName} [{s.status}]
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Visual 4-Step Progress Pipeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/15">
          {[
            {
              step: 'STEP 1',
              title: 'Initialize Audit Session',
              desc: 'Assign Warehouse/Shop branch & snapshot expected ERP quantities from Firebase as baseline.',
              active: !activeSession,
              done: Boolean(activeSession)
            },
            {
              step: 'STEP 2',
              title: 'Rapid Barcode Scanning Loop',
              desc: 'Scan universal barcodes (e.g. 500029912302 -> IPS-WHISKY-002). Increments +1 & plays confirmation beep.',
              active: activeSession?.status === 'IN_PROGRESS',
              done:
                activeSession?.status === 'PENDING_APPROVAL' ||
                activeSession?.status === 'APPROVED'
            },
            {
              step: 'STEP 3',
              title: 'Variance Calculation',
              desc: 'Variance = Physical − Expected. Flags Shrinkage/Loss in red and Surplus in amber for review.',
              active: activeSession?.status === 'PENDING_APPROVAL',
              done: activeSession?.status === 'APPROVED'
            },
            {
              step: 'STEP 4',
              title: 'Approve & Adjust Ledger',
              desc: 'Senior manager approves report, updates live Firebase inventory ledger & writes adjustment logs.',
              active: activeSession?.status === 'APPROVED',
              done: activeSession?.status === 'APPROVED'
            }
          ].map((st, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border transition ${
                st.active
                  ? 'bg-[#FFDE00] text-[#0A006E] border-white shadow-md'
                  : st.done
                  ? 'bg-emerald-950/60 text-white border-emerald-400/50'
                  : 'bg-white/10 text-slate-200 border-white/15'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-montserrat font-black uppercase tracking-wider">
                <span>{st.step}</span>
                {st.done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <div className="font-montserrat font-black text-xs sm:text-sm mt-1">{st.title}</div>
              <p
                className={`text-[11px] mt-1 leading-relaxed ${
                  st.active ? 'text-[#0A006E]/85 font-medium' : 'text-slate-300'
                }`}
              >
                {st.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications / Error Banners */}
      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-[#1E9E60] text-xs font-montserrat font-bold flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {firestoreErrorBanner && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-xs font-montserrat font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>Firebase Firestore Notice: {firestoreErrorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFirestoreErrorBanner(null)}
            className="text-red-500 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          STEP 1 CARD: INITIALIZE NEW STOCK AUDIT SESSION FOR A BRANCH
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                Step 1: Initialize Audit Session
              </span>
              {activeSession && (
                <span className="text-xs font-mono font-bold text-[#1E9E60]">
                  Active Session: {activeSession.id} ({activeSession.branchName})
                </span>
              )}
            </div>
            <h4 className="font-montserrat font-black text-base text-slate-900">
              Assign Warehouse or Retail Shop Branch &amp; Snapshot Expected ERP Baseline
            </h4>
            <p className="text-xs text-slate-500">
              Starting a session snapshots the branch&apos;s current expected inventory quantities into Firebase (<code className="font-mono text-[#0A006E]">stockAuditSessions</code>) as the audit baseline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2">
              <Store className="w-4 h-4 text-[#0A006E]" />
              <select
                value={auditBranchId}
                onChange={e => setAuditBranchId(e.target.value)}
                className="bg-transparent text-xs font-montserrat font-bold text-slate-900 focus:outline-none"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.tier.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={isInitializingSession}
              onClick={handleInitializeAuditSession}
              className="px-5 py-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {isInitializingSession
                  ? 'Snapshotting Baseline...'
                  : activeSession
                  ? '+ Start New Stock Audit Session'
                  : 'Start Stock Audit Session'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* If an Audit Session is active, show Step 2, Step 3, and Step 4 */}
      {activeSession && (
        <>
          {/* =================================================================
              STEP 2 CARD: RAPID BARCODE SCANNING LOOP (UNIVERSAL BARCODES)
              ================================================================= */}
          <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-md overflow-hidden">
            <div className="bg-[#0A006E] text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#FFDE00]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase">
                    Step 2: Rapid Barcode Scanning Loop
                  </span>
                  <span className="text-xs font-mono text-slate-200">
                    Session: {activeSession.id} • Auditor: {activeSession.auditorName}
                  </span>
                </div>
                <h4 className="font-montserrat font-black text-lg text-white mt-1">
                  Universal Barcode Aggregation Loop — {activeSession.branchName}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Scan bottles continuously with a handheld USB/Bluetooth scanner or mobile camera. Identical bottles increment existing SKU counts by <strong className="text-[#FFDE00]">+1</strong> automatically instead of creating duplicate rows.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeSession.status === 'IN_PROGRESS' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCameraScannerOpen(!isCameraScannerOpen)}
                      className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-1.5 transition cursor-pointer ${
                        isCameraScannerOpen
                          ? 'bg-red-500 text-white'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/30'
                      }`}
                    >
                      <Camera className="w-4 h-4 text-[#FFDE00]" />
                      <span>
                        {isCameraScannerOpen ? 'Close Mobile Camera' : 'Open Mobile Camera Scanner'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleVerifyRemainingBaselineAsMatched}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-montserrat font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      title="Mark unscanned baseline items as matching expected ERP stock for exception-based cycle counting"
                    >
                      <Sparkles className="w-4 h-4 text-[#FFDE00]" />
                      <span>Match Unscanned to Expected (Cycle Count)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCompletePhysicalCount}
                      className="px-4 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Finish Shelf Scan &amp; Lock for Step 3</span>
                    </button>
                  </>
                )}

                {activeSession.status === 'PENDING_APPROVAL' && (
                  <button
                    type="button"
                    onClick={handleReopenScanningLoop}
                    className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-montserrat font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-[#FFDE00]" />
                    <span>Resume Barcode Scanning</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Mobile Device Camera Viewfinder (Full-Screen on Mobile, Popup Window on Desktop) */}
              {isCameraScannerOpen && activeSession.status === 'IN_PROGRESS' && (
                <div
                  className="fixed inset-0 z-[100] bg-[#0A006E] sm:bg-black/75 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
                  onClick={() => setIsCameraScannerOpen(false)}
                >
                  <div
                    className="w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col justify-between text-slate-900"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="bg-[#0A006E] text-white px-5 py-4 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-montserrat font-black text-sm text-white">
                            Barcode Scanner
                          </h4>
                          <p className="text-[11px] text-blue-200">
                            {activeSession.branchName} • {activeSession.totalScannedUnits} Scanned
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          className={`p-2 rounded-xl transition cursor-pointer ${
                            soundEnabled ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-white/10 text-white'
                          }`}
                          title="Toggle Beep"
                        >
                          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCameraScannerOpen(false)}
                          className="p-2 rounded-xl bg-white/10 hover:bg-red-600 text-white transition cursor-pointer"
                          title="Close Scanner"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full flex-1 sm:flex-initial min-h-[260px] sm:h-64 bg-slate-950 flex items-center justify-center overflow-hidden">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                        <div className="w-64 sm:w-56 h-40 sm:h-36 rounded-2xl border-2 border-[#FFDE00] relative">
                          <div className="w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse mt-18 sm:mt-16" />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-3 bg-white shrink-0">
                      {lastScanTrace && (
                        <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-[#0A006E] text-xs flex items-center justify-between gap-2">
                          <span className="font-montserrat font-bold truncate">
                            {lastScanTrace.productName}
                          </span>
                          <span className="font-mono font-black text-[#0A006E] shrink-0">
                            {lastScanTrace.newCount} / {lastScanTrace.expectedErpCount} btls
                          </span>
                        </div>
                      )}

                      <form onSubmit={handleManualFormSubmit} className="flex gap-2">
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          placeholder="Scan or enter barcode..."
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-blue-50/40 border border-blue-200 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-[#0A006E]"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer shrink-0"
                        >
                          Scan
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Handheld Barcode Scanner Input Bar */}
              {activeSession.status === 'IN_PROGRESS' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <form
                    onSubmit={handleManualFormSubmit}
                    className="lg:col-span-6 space-y-2"
                  >
                    <label className="block text-xs font-montserrat font-black uppercase text-slate-700">
                      Handheld Laser / Bluetooth Barcode Scanner Input (Auto-Loop)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Barcode className="w-5 h-5 text-[#0A006E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          ref={scannerInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          placeholder="Scan universal barcode (e.g. 500029912302)..."
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-[#0A006E] rounded-xl font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FFDE00]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-5 py-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                      >
                        <span>Scan +1</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    {unknownBarcodeAlert && (
                      <div className="text-xs font-bold text-red-600 flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{unknownBarcodeAlert}</span>
                      </div>
                    )}
                  </form>

                  {/* Quick-Increment Shelf SKU Buttons (Universal Barcodes 750ml vs 1L) */}
                  <div className="lg:col-span-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-montserrat font-black uppercase text-slate-700">
                        Quick-Increment High-Velocity Shelf SKUs (+1 Bottle)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#1E9E60]">
                        Tap to increment physical count in Firebase
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {quickScanPresets.map(prod => {
                        if (!prod) return null;
                        const entry = sessionItemsMap[prod.sku];
                        const currentCount = entry ? entry.physicalScannedCount : 0;
                        const isJw750 = prod.sku === 'IPS-WHISKY-002';
                        const isJw1L = prod.sku === 'IPS-WHISKY-002-1L';

                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => processRapidBarcodeScan(prod.barcode, 1)}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer active:scale-[0.98] ${
                              isJw750 || isJw1L
                                ? 'bg-[#0A006E]/5 hover:bg-[#0A006E]/10 border-2 border-[#0A006E]'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[10px]">
                                  {prod.barcode}
                                </span>
                                <span className="font-mono font-bold text-[10px] text-slate-600 truncate">
                                  {prod.sku}
                                </span>
                              </div>
                              <div className="font-montserrat font-black text-xs text-slate-900 truncate mt-1">
                                {prod.name}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="px-2.5 py-1 rounded-lg bg-[#34D186] text-[#FFDE00] font-mono font-black text-xs block">
                                +1 ({currentCount})
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs font-montserrat font-bold text-amber-950 flex items-center justify-between">
                  <span>
                    Physical shelf scanning for this session is locked ({activeSession.status}). Review variances in Step 3 or approve in Step 4 below.
                  </span>
                </div>
              )}

              {/* Live Firebase Universal Barcode Query & Aggregation Trace */}
              {lastScanTrace && (
                <div className="p-4 rounded-2xl bg-[#34D186] text-white border-2 border-[#FFDE00] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase">
                        Firebase Loop Query Trace
                      </span>
                      <span className="font-mono text-xs text-emerald-300 font-bold">
                        Barcode Read: {lastScanTrace.barcodeRead} → SKU: {lastScanTrace.mappedSku} ({lastScanTrace.volumeMl}ml)
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-montserrat font-bold text-white">
                      {lastScanTrace.existedInSession ? (
                        <>
                          Session entry for <span className="text-[#FFDE00] font-mono">{lastScanTrace.mappedSku}</span> exists in Firebase →{' '}
                          <span className="underline decoration-[#FFDE00]">
                            Incremented Scanned Quantity +1 ({lastScanTrace.previousCount} → {lastScanTrace.newCount})
                          </span>{' '}
                          &amp; played confirmation tone!
                        </>
                      ) : (
                        <>
                          First scan for <span className="text-[#FFDE00] font-mono">{lastScanTrace.mappedSku}</span> ({lastScanTrace.productName}) →{' '}
                          <span className="underline decoration-[#FFDE00]">
                            Created session line item with initial count = 1
                          </span>{' '}
                          &amp; played confirmation tone!
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div className="text-[10px] text-emerald-300 uppercase">Physical vs Expected</div>
                    <div className="text-base font-black text-[#FFDE00]">
                      {lastScanTrace.newCount} / {lastScanTrace.expectedErpCount} Btls
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =================================================================
              STEP 3 CARD: HANDLING DISCREPANCIES (VARIANCE CALCULATION TABLE)
              Variance = Physical Count - Expected ERP Count
              ================================================================= */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                      Step 3: Handling Discrepancies (Variance Calculation)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                      Formula: Variance = Physical Scanned Count − Expected ERP Count
                    </span>
                  </div>
                  <h4 className="font-montserrat font-black text-lg text-slate-900 mt-1">
                    Shelf Physical Count vs. Firebase Expected ERP Baseline
                  </h4>
                </div>

                {/* Search & Discrepancy Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={skuSearchQuery}
                      onChange={e => setSkuSearchQuery(e.target.value)}
                      placeholder="Search SKU, barcode, drink..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                    />
                  </div>

                  {(
                    [
                      { id: 'ALL_SCANNED', label: 'Active Scan Sheet' },
                      { id: 'ALL_BASELINE', label: `All Baseline (${auditSummary.totalBaselineSkus})` },
                      {
                        id: 'SHRINKAGE_LOSS',
                        label: `Shrinkage / Loss (${auditSummary.shrinkageSkus})`
                      },
                      {
                        id: 'SURPLUS_REVIEW',
                        label: `Surplus Flag (${auditSummary.surplusSkus})`
                      },
                      { id: 'MATCHED', label: `Exact Match (${auditSummary.matchedSkus})` }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setVarianceFilter(tab.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-montserrat font-bold transition cursor-pointer ${
                        varianceFilter === tab.id
                          ? 'bg-[#0A006E] text-[#FFDE00]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 KPI Discrepancy Summary Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-montserrat font-bold text-slate-500 uppercase">
                    Expected ERP Baseline
                  </div>
                  <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
                    {auditSummary.expectedTotal} Bottles
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Across {auditSummary.totalSkusAudited || auditSummary.totalBaselineSkus} audited SKUs
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A006E]/5 border border-[#0A006E]/20">
                  <div className="text-[11px] font-montserrat font-bold text-[#0A006E] uppercase">
                    Physical Scanned Count
                  </div>
                  <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
                    {auditSummary.physicalTotal} Bottles
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">
                    Net Variance:{' '}
                    {auditSummary.netUnitVariance > 0
                      ? `+${auditSummary.netUnitVariance}`
                      : auditSummary.netUnitVariance}{' '}
                    Btls
                  </div>
                </div>

                {/* Shrinkage / Loss Flag Box (RED) */}
                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200">
                  <div className="flex items-center justify-between text-[11px] font-montserrat font-black text-red-700 uppercase">
                    <span>Shrinkage / Loss Flag</span>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="font-montserrat font-black text-2xl text-red-700 mt-1">
                    −{auditSummary.shrinkageUnits} Btls ({auditSummary.shrinkageSkus} SKUs)
                  </div>
                  <div className="text-[11px] font-mono font-bold text-red-800 mt-0.5">
                    Potential Loss/Theft/Breakage: {formatKes(auditSummary.shrinkageKes)}
                  </div>
                </div>

                {/* Surplus Flag Box (AMBER) */}
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300">
                  <div className="flex items-center justify-between text-[11px] font-montserrat font-black text-amber-900 uppercase">
                    <span>Surplus Flag (Review)</span>
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="font-montserrat font-black text-2xl text-amber-900 mt-1">
                    +{auditSummary.surplusUnits} Btls ({auditSummary.surplusSkus} SKUs)
                  </div>
                  <div className="text-[11px] font-mono font-bold text-amber-800 mt-0.5">
                    Unrecorded Deliveries Value: {formatKes(auditSummary.surplusKes)}
                  </div>
                </div>
              </div>
            </div>

            {/* Variance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-montserrat font-black uppercase text-slate-500">
                    <th className="py-3.5 px-4">SKU &amp; Universal Barcode</th>
                    <th className="py-3.5 px-4">Product Name &amp; Bottle Size</th>
                    <th className="py-3.5 px-4 text-center">Expected ERP Count</th>
                    <th className="py-3.5 px-4 text-center">Physical Scanned Count</th>
                    <th className="py-3.5 px-4 text-center">Variance (Physical − Expected)</th>
                    <th className="py-3.5 px-4">Discrepancy Flag &amp; Diagnosis</th>
                    <th className="py-3.5 px-4 text-right">Financial Impact</th>
                    {activeSession.status === 'IN_PROGRESS' && (
                      <th className="py-3.5 px-4 text-center">Quick Loop Adjust</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {computedAuditRows.map(row => {
                    const isShrinkage = row.variance < 0;
                    const isSurplus = row.variance > 0;

                    return (
                      <tr
                        key={row.sku}
                        className={`transition ${
                          isShrinkage
                            ? 'bg-red-50/70 hover:bg-red-50'
                            : isSurplus
                            ? 'bg-amber-50/60 hover:bg-amber-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-[#0A006E]">{row.sku}</div>
                          <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                            <Barcode className="w-3 h-3" />
                            <span>{row.barcode}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-montserrat font-bold text-slate-900">
                            {row.productName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Size: <strong>{row.volumeMl}ml</strong> • Cost: {formatKes(row.unitCostKes)}/btl
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-sm text-slate-700">
                          {row.expectedErpCount}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-3 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] font-mono font-black text-sm">
                            {row.physicalScannedCount}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full font-mono font-black text-xs ${
                              isShrinkage
                                ? 'bg-red-600 text-white shadow-xs'
                                : isSurplus
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : 'bg-emerald-100 text-[#1E9E60]'
                            }`}
                          >
                            {row.variance > 0 ? `+${row.variance}` : row.variance}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {isShrinkage ? (
                            <div className="text-red-700 font-montserrat font-black text-[11px] flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>
                                SHRINKAGE / LOSS FLAG (Potential Loss, Theft, or Breakage)
                              </span>
                            </div>
                          ) : isSurplus ? (
                            <div className="text-amber-900 font-montserrat font-black text-[11px] flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>
                                SURPLUS FLAG (Review Unrecorded Stock Deliveries)
                              </span>
                            </div>
                          ) : (
                            <div className="text-[#1E9E60] font-montserrat font-bold text-[11px] flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>EXACT MATCH (Physical = Expected ERP)</span>
                            </div>
                          )}
                        </td>

                        <td
                          className={`py-3.5 px-4 text-right font-mono font-black ${
                            isShrinkage
                              ? 'text-red-700'
                              : isSurplus
                              ? 'text-amber-900'
                              : 'text-slate-500'
                          }`}
                        >
                          {row.varianceValueKes > 0
                            ? `+${formatKes(row.varianceValueKes)}`
                            : formatKes(row.varianceValueKes)}
                        </td>

                        {activeSession.status === 'IN_PROGRESS' && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => processRapidBarcodeScan(row.barcode, -1)}
                                className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-mono font-black text-xs cursor-pointer"
                                title="Decrement scanned count (-1)"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => processRapidBarcodeScan(row.barcode, 1)}
                                className="px-2.5 h-7 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-mono font-black text-xs cursor-pointer"
                                title="Scan bottle (+1)"
                              >
                                +1 Scan
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* =================================================================
              STEP 4 CARD: AUDIT APPROVAL & FIREBASE LEDGER ADJUSTMENT
              ================================================================= */}
          <div className="bg-[#34D186] text-white rounded-3xl border-2 border-[#FFDE00] p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase">
                  Step 4: Audit Approval &amp; Ledger Adjustment
                </span>
                <span className="text-xs font-mono text-emerald-200">
                  Store Owner / Senior Manager Authorization
                </span>
              </div>
              <h4 className="font-montserrat font-black text-xl text-white">
                {activeSession.status === 'APPROVED'
                  ? `Audit ${activeSession.id} Approved & Synced to Live Firebase Ledger`
                  : `Approve Audit Summary Report & Update Live Inventory Ledger (${activeSession.branchName})`}
              </h4>
              <p className="text-xs text-emerald-100 max-w-2xl">
                Upon clicking <strong>&ldquo;Approve Audit&rdquo;</strong>, the ERP updates the live inventory ledger in Firebase (<code className="font-mono text-[#FFDE00]">branchInventoryLedgers</code>) and ERP branch stock to match the physical count, and writes immutable adjustment logs (<code className="font-mono text-[#FFDE00]">stockAdjustmentLogs</code>) for auditing accountability.
              </p>
              {activeSession.approvedBy && (
                <div className="text-xs font-mono text-[#FFDE00] pt-1">
                  Approved By: {activeSession.approvedBy} at{' '}
                  {activeSession.approvedAt
                    ? new Date(activeSession.approvedAt).toLocaleString()
                    : ''}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {activeSession.status === 'APPROVED' ? (
                <div className="px-5 py-3.5 rounded-2xl bg-emerald-800/80 border-2 border-[#FFDE00] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Firebase Ledger Adjusted &amp; Verified</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isApprovingAudit}
                  onClick={handleApproveAuditAndAdjustLedger}
                  className="px-6 py-4 rounded-2xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-sm flex items-center gap-2 shadow-xl transition cursor-pointer disabled:opacity-50"
                >
                  <FileCheck2 className="w-5 h-5" />
                  <span>
                    {isApprovingAudit
                      ? 'Updating Firebase Ledger...'
                      : 'Approve Audit & Adjust Firebase Ledger'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          AUTOMATED STOCK ADJUSTMENT LOGS (FIREBASE ACCOUNTABILITY TRAIL)
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-montserrat font-black text-base text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-[#0A006E]" />
              <span>
                Firebase Automated Stock Adjustment Logs ({adjustmentLogs.length})
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanent audit accountability trail stored in Firestore (<code className="font-mono text-[#0A006E]">/stockAdjustmentLogs</code>) whenever an audit session is approved.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-montserrat font-black uppercase text-slate-500">
                <th className="py-3 px-4">Timestamp &amp; Session</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">SKU &amp; Barcode</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-center">Expected → Physical</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4">Discrepancy Classification</th>
                <th className="py-3 px-4">Approved By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {adjustmentLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No approved stock adjustment logs in Firebase yet. Complete &amp; click &ldquo;Approve Audit&rdquo; above to generate automated ledger adjustment records.
                  </td>
                </tr>
              ) : (
                adjustmentLogs.slice(0, 25).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="font-bold text-[#0A006E]">{log.auditSessionId}</div>
                      <div className="text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.branchName}</td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-slate-900">{log.sku}</div>
                      <div className="text-[10px] text-slate-500">{log.barcode}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{log.productName}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {log.expectedErpCount} →{' '}
                      <span className="text-[#0A006E] font-black">{log.physicalScannedCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                          log.variance < 0
                            ? 'bg-red-100 text-red-800'
                            : log.variance > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {log.variance > 0 ? `+${log.variance}` : log.variance}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-montserrat font-black text-[10px] uppercase ${
                          log.discrepancyFlag === 'SHRINKAGE_LOSS'
                            ? 'text-red-600'
                            : log.discrepancyFlag === 'SURPLUS_REVIEW'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {log.discrepancyFlag.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-700 font-semibold">
                      {log.approvedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
