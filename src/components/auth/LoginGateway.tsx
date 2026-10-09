import React, { useState, useEffect, useCallback } from 'react';
import { auth, signInWithGooglePopup } from '../../firebase';
import { useErp } from '../../context/ErpContext';
import { DepartmentType, UserRole } from '../../types';
import { requestPlatformFullscreen } from '../common/SessionSecurityMonitor';
import { 
  ShieldCheck, 
  Calculator, 
  Users, 
  Store, 
  Boxes, 
  Truck, 
  Building2, 
  ArrowRight, 
  ArrowLeft, 
  Lock, 
  Delete,
  X,
  ChevronDown,
  ShieldAlert,
  BadgePercent,
  MapPin,
  TrendingUp,
  Database,
  Zap,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';
import { formatKes } from '../../utils/kenyaTax';
import { setStoredSessionToken } from '../../utils/apiAuth';
import {
  CenterScreenFeedback,
  CenterScreenFeedbackData
} from '../common/CenterScreenFeedback';

interface Props {
  onSuccess?: (role: UserRole, department: DepartmentType) => void;
  onClose?: () => void;
  isOverlay?: boolean;
}

interface StaffLevelOption {
  id: DepartmentType;
  title: string;
  badge: string;
  icon: React.ReactNode;
  desc: string;
  routeLabel: string;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const STAFF_LEVELS: StaffLevelOption[] = [
  {
    id: 'POS',
    title: 'POS & Counter Cashier',
    badge: 'POS Terminal Only',
    icon: <Store className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Front-of-house sales checkout, barcode scanning, 80mm thermal receipts & M-Pesa STK prompts.',
    routeLabel: 'POS Terminal',
  },
  {
    id: 'AFFILIATES',
    title: 'Sales Representative',
    badge: 'Sales Representative Only',
    icon: <BadgePercent className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Sales Representative POS checkout terminal with custom markup attribution & M-Pesa STK checkout.',
    routeLabel: 'Sales Representative',
  },
  {
    id: 'BRANCH_MANAGER',
    title: 'Branch Manager',
    badge: 'Branch & Cashiers Dashboard',
    icon: <Building2 className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Manage branch operations, create Counter Cashiers & issue 6-digit POS login PINs.',
    routeLabel: 'Branch Manager',
  },
  {
    id: 'DELIVERY_MANAGER',
    title: 'Delivery Manager',
    badge: 'Delivery Dashboard',
    icon: <MapPin className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Coordinate branch deliveries, dispatch riders, track delivery orders & view all orders made from your branch.',
    routeLabel: 'Delivery Manager Dashboard',
  },
  {
    id: 'SALES_MANAGER',
    title: 'Sales Manager',
    badge: 'Sales & Affiliates Dashboard',
    icon: <TrendingUp className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Manage branch sales affiliates, view branch orders & track affiliated persons performance per Day, Week, Month & Year.',
    routeLabel: 'Sales Manager Dashboard',
  },
  {
    id: 'HR_PAYROLL',
    title: 'HR & Payroll Officer',
    badge: 'HR / Payroll Only',
    icon: <Users className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Staff attendance, shift schedules, statutory payroll (SHIF 2.75%, NSSF, PAYE) & commissions.',
    routeLabel: 'HR & Payroll',
  },
  {
    id: 'INVENTORY',
    title: 'Warehouse & Inventory Scanner',
    badge: 'Inventory Only',
    icon: <Boxes className="w-6 h-6 text-[#0A006E]" />,
    desc: 'IPS bonded & LPS local excise barcode intake, pallet scanning & damaged bottle write-offs.',
    routeLabel: 'Inventory',
  },
  {
    id: 'PROCUREMENT',
    title: 'Procurement & Restock Lead',
    badge: 'Restock Only',
    icon: <Truck className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Inter-branch central stock requisitions and dispatch fulfillment tracking.',
    routeLabel: 'Restock & Dispatch',
  },
  {
    id: 'BILLING',
    title: 'Billing & 16% VAT Invoicing',
    badge: 'Billing Only',
    icon: <ShieldCheck className="w-6 h-6 text-[#0A006E]" />,
    desc: 'Mandatory 16% VAT tax invoice generation and commercial customer billing.',
    routeLabel: 'Accounts & Billing',
  },
];

export const LoginGateway: React.FC<Props> = ({ onSuccess, onClose, isOverlay = false }) => {
  const {
    loginAsRole,
    branches,
    setIsAuthenticated,
    employees,
    affiliates,
    addEmployee,
    registerAffiliate,
    staffDatabaseRecords,
    staffDbSyncStatus,
    instantLoginWithStaffPin,
    instantLoginByStaffRecord,
    syncAllStaffsToIndependentDb,
    confirmMfa,
    adminTotpSecret
  } = useErp();
  
  // View states: 'ROLE_BOXES' | 'STAFF_LEVELS' | 'STAFF_PIN' | 'GOOGLE_LOGIN' | 'MFA_CHALLENGE'
  const [viewMode, setViewMode] = useState<'ROLE_BOXES' | 'STAFF_LEVELS' | 'STAFF_PIN' | 'GOOGLE_LOGIN' | 'MFA_CHALLENGE'>('ROLE_BOXES');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState<boolean>(false);
  const [isPinDeptDropdownOpen, setIsPinDeptDropdownOpen] = useState<boolean>(false);
  const [isStaffNameDropdownOpen, setIsStaffNameDropdownOpen] = useState<boolean>(false);
  const [googleTargetRole, setGoogleTargetRole] = useState<'SUPER_ADMIN' | 'ACCOUNTANT'>('SUPER_ADMIN');
  const [selectedStaffDept, setSelectedStaffDept] = useState<DepartmentType>('POS');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[1]?.id || branches[0]?.id || '');

  // RFC 6238 TOTP Multi-Factor Authentication State
  const [totpInput, setTotpInput] = useState<string>('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState<number>(30);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [verifiedGoogleUser, setVerifiedGoogleUser] = useState<{
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ACCOUNTANT';
    idToken?: string;
  } | null>(null);

  useEffect(() => {
    if (viewMode !== 'MFA_CHALLENGE') return;
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      setTotpSecondsRemaining(30 - (nowSec % 30));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // Quick Add Staff to Independent Database Modal/Drawer state
  const [showQuickAddStaff, setShowQuickAddStaff] = useState<boolean>(false);
  const [quickStaffName, setQuickStaffName] = useState<string>('');
  const [quickStaffPin, setQuickStaffPin] = useState<string>('');
  const [quickStaffPhone, setQuickStaffPhone] = useState<string>('2547');
  const [quickStaffDept, setQuickStaffDept] = useState<DepartmentType>('POS');
  const [quickStaffBranchId, setQuickStaffBranchId] = useState<string>(branches[0]?.id || '');
  const [quickStaffFeedback, setQuickStaffFeedback] = useState<string | null>(null);

  // Staff 6-digit PIN state
  const [staffPin, setStaffPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<CenterScreenFeedbackData | null>(null);

  useEffect(() => {
    const activeErr = pinError || googleLoginError || totpError;
    if (activeErr) {
      setAuthFeedback({
        type: 'ERROR',
        title: 'Authentication Error',
        message: activeErr,
        durationMs: 2200
      });
    }
  }, [pinError, googleLoginError, totpError]);

  useEffect(() => {
    if (quickStaffFeedback) {
      setAuthFeedback({
        type: 'SUCCESS',
        title: 'Staff Saved',
        message: quickStaffFeedback,
        durationMs: 1800
      });
    }
  }, [quickStaffFeedback]);

  const getRosterForDept = useCallback((dept: DepartmentType) => {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        employeeNumber: string;
        department: DepartmentType;
        branchId: string;
        loginPin: string;
        isAffiliate: boolean;
        totalSalesKes?: number;
        pendingCommissionKes?: number;
      }
    >();

    // 1. Pull from Independent Staff Database first
    staffDatabaseRecords
      .filter(r => r.active && r.department === dept)
      .forEach(r => {
        byId.set(r.id, {
          id: r.id,
          name: r.name,
          employeeNumber: r.codeOrNumber,
          department: r.department,
          branchId: r.branchId,
          loginPin: r.loginPin || '',
          isAffiliate: r.recordType === 'AFFILIATE',
          totalSalesKes: r.totalSalesKes,
          pendingCommissionKes: r.pendingCommissionKes
        });
      });

    // 2. Merge live Affiliates & Employees state
    if (dept === 'AFFILIATES') {
      affiliates
        .filter(a => a.active)
        .forEach(a => {
          byId.set(a.id, {
            id: a.id,
            name: a.name,
            employeeNumber: a.code,
            department: 'AFFILIATES' as DepartmentType,
            branchId: a.branchId,
            loginPin: a.loginPin,
            isAffiliate: true,
            totalSalesKes: a.totalSalesKes,
            pendingCommissionKes: a.pendingCommissionKes
          });
        });
    }

    employees
      .filter(e => e.department === dept && e.active)
      .forEach(e => {
        byId.set(e.id, {
          id: e.id,
          name: e.name,
          employeeNumber: e.employeeNumber,
          department: e.department,
          branchId: e.branchId,
          loginPin: e.loginPin,
          isAffiliate: false,
          totalSalesKes: e.totalSalesKes,
          pendingCommissionKes: e.pendingCommissionKes
        });
      });

    return Array.from(byId.values());
  }, [affiliates, employees, staffDatabaseRecords]);

  // Staff members or Affiliate Ladies onboarded for the selected department
  const departmentStaffList = getRosterForDept(selectedStaffDept);
  const selectedEmployee =
    departmentStaffList.find(e => e.id === selectedEmployeeId) ||
    departmentStaffList[0] ||
    null;

  const flashKey = useCallback((key: string) => {
    setActiveKey(key);
    setTimeout(() => {
      setActiveKey(prev => (prev === key ? null : prev));
    }, 150);
  }, []);

  // Trigger Google Login for Admin or Accountant (do not enter fullscreen before OAuth popup)
  const handleOpenGoogleLogin = (role: 'SUPER_ADMIN' | 'ACCOUNTANT') => {
    setGoogleTargetRole(role);
    setGoogleLoginError(null);
    setViewMode('GOOGLE_LOGIN');
  };

  // Confirm Google Login (Real Firebase Google OAuth Authentication + Server Session Verification)
  const handleCompleteGoogleLogin = async () => {
    setIsSubmitting(true);
    setGoogleLoginError(null);

    try {
      const cred = await signInWithGooglePopup();
      if (!cred.user || !cred.user.email) {
        throw new Error('Google OAuth failed to provide a verified email address.');
      }
      const verifiedEmail = cred.user.email.trim().toLowerCase();
      const verifiedName = cred.user.displayName || verifiedEmail.split('@')[0];
      const idToken = await cred.user.getIdToken().catch(() => '');

      const builtInSuperAdmins = [
        'moraasdorcah@gmail.com',
        'muyamoz@gmail.com',
        'support@urbantechdev.com',
        'admin@vaairo.co.ke'
      ];
      const builtInAccountants = [
        'finance@vaairo.co.ke',
        'accountant@vaairo.co.ke'
      ];
      const isWhitelistedSuperAdmin = builtInSuperAdmins.includes(verifiedEmail);
      const isWhitelistedAccountant = builtInAccountants.includes(verifiedEmail);

      // Verify Google OAuth identity with authoritative backend
      let loginRes: Response | null = null;
      let loginData: Record<string, any> = {};
      try {
        loginRes = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: verifiedEmail,
            name: verifiedName,
            role: googleTargetRole,
            idToken
          })
        });
        loginData = await loginRes.json().catch(() => ({}));
      } catch {
        loginRes = null;
      }

      if (!loginRes || !loginRes.ok) {
        const canFallbackAuthorize =
          cred.user.emailVerified !== false &&
          loginData?.errorCode !== 'ONBOARDING_MEMBERSHIP_REQUIRED' &&
          (googleTargetRole === 'SUPER_ADMIN'
            ? isWhitelistedSuperAdmin
            : isWhitelistedSuperAdmin || isWhitelistedAccountant);

        if (canFallbackAuthorize) {
          // Verified by Firebase Google OAuth for whitelisted account:
          // Check if TOTP MFA is enabled for this user on the server before completing login
          let totpActive = false;
          try {
            const totpStatusRes = await fetch(
              `/api/auth/totp/status?email=${encodeURIComponent(verifiedEmail)}`
            );
            const totpStatusData = await totpStatusRes.json().catch(() => ({}));
            totpActive = Boolean(totpStatusData?.enabled);
          } catch {
            totpActive = false;
          }
          if (totpActive) {
            setVerifiedGoogleUser({
              name: verifiedName,
              email: verifiedEmail,
              role: googleTargetRole,
              idToken
            });
            setViewMode('MFA_CHALLENGE');
            setTotpInput('');
            setTotpError(null);
            setIsSubmitting(false);
            return;
          }

          const targetDept: DepartmentType =
            googleTargetRole === 'ACCOUNTANT' ? 'FINANCE' : 'BRANCH_MANAGER';
          try {
            const termRes = await fetch('/api/auth/terminal-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: cred.user.uid || `user-${verifiedEmail}`,
                name: verifiedName,
                email: verifiedEmail,
                role: googleTargetRole,
                department: targetDept,
                branchId: selectedBranchId
              })
            });
            if (termRes.ok) {
              const termData = await termRes.json().catch(() => ({}));
              if (termData.token) {
                setStoredSessionToken(termData.token);
              }
            }
          } catch {
            // Continue with local session
          }
          loginAsRole(googleTargetRole, targetDept, selectedBranchId, verifiedName);
          setIsAuthenticated(true);
          setIsSubmitting(false);
          if (onSuccess) onSuccess(googleTargetRole, targetDept);
          return;
        }

        throw new Error(
          loginData.error ||
            `Access Restricted: Account "${verifiedEmail}" is not authorized for ${
              googleTargetRole === 'SUPER_ADMIN' ? 'System Administrator' : 'CPA Accountant'
            } privileges.`
        );
      }

      // Enforce that non-Super-Admin memberships cannot escalate to SUPER_ADMIN by clicking the Super Admin card
      const serverAssignedRole = loginData.user?.role as string | undefined;
      if (
        googleTargetRole === 'SUPER_ADMIN' &&
        !isWhitelistedSuperAdmin &&
        serverAssignedRole &&
        serverAssignedRole !== 'SUPER_ADMIN' &&
        serverAssignedRole !== 'ADMIN'
      ) {
        throw new Error(
          `Access Restricted: Account "${verifiedEmail}" is assigned the ${serverAssignedRole} role and cannot access System Administrator privileges.`
        );
      }

      const effectiveExecutiveRole: 'SUPER_ADMIN' | 'ACCOUNTANT' =
        googleTargetRole === 'ACCOUNTANT' || serverAssignedRole === 'ACCOUNTANT'
          ? 'ACCOUNTANT'
          : 'SUPER_ADMIN';

      // If TOTP_ADMIN_SECRET is configured on the server, proceed to Step 2 RFC 6238 TOTP Challenge
      if (loginData.mfaRequired) {
        setVerifiedGoogleUser({
          name: verifiedName,
          email: verifiedEmail,
          role: effectiveExecutiveRole,
          idToken
        });
        setViewMode('MFA_CHALLENGE');
        setTotpInput('');
        setTotpError(null);
        setIsSubmitting(false);
        return;
      }

      // Otherwise complete login immediately with the server-issued session token
      if (loginData.token) {
        setStoredSessionToken(loginData.token);
      }

      const targetDept: DepartmentType =
        effectiveExecutiveRole === 'ACCOUNTANT' ? 'FINANCE' : 'BRANCH_MANAGER';
      // Ensure the session token matches the user's effective role
      if (effectiveExecutiveRole === 'ACCOUNTANT' && loginData.user?.role !== 'ACCOUNTANT') {
        try {
          const termRes = await fetch('/api/auth/terminal-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: cred.user.uid || `user-${verifiedEmail}`,
              name: verifiedName,
              email: verifiedEmail,
              role: effectiveExecutiveRole,
              department: targetDept,
              branchId: selectedBranchId
            })
          });
          if (termRes.ok) {
            const termData = await termRes.json().catch(() => ({}));
            if (termData.token) {
              setStoredSessionToken(termData.token);
            }
          }
        } catch {
          // Keep existing token
        }
      }

      loginAsRole(effectiveExecutiveRole, targetDept, selectedBranchId, verifiedName);
      setIsAuthenticated(true);
      setIsSubmitting(false);
      if (onSuccess) onSuccess(effectiveExecutiveRole, targetDept);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const code = (err as { code?: string })?.code || '';
      const rawMsg = (err as Error)?.message || '';
      let friendlyMsg = rawMsg || 'Google Authentication was cancelled or failed. Please try again.';
      if (code === 'auth/popup-blocked') {
        friendlyMsg = 'Your browser blocked the Google Sign-In popup. Please allow popups for this site and click Sign in with Google again.';
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        friendlyMsg = 'The Google Sign-In popup was closed before completing authentication. Please click Sign in with Google and select your account.';
      } else if (code === 'auth/unauthorized-domain') {
        friendlyMsg = `Domain "${window.location.hostname}" must be listed under Firebase Console → Authentication → Settings → Authorized domains.`;
      }
      setGoogleLoginError(friendlyMsg);
    }
  };

  // Real RFC 6238 TOTP Multi-Factor Authentication Verification (Server-Authoritative)
  const handleVerifyMfaChallenge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTotpError(null);
    const cleanCode = totpInput.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setTotpError('Please enter the full 6-digit verification code from your authenticator app.');
      return;
    }

    if (!verifiedGoogleUser) {
      setTotpError('Session expired. Please sign in with Google again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authoritative Backend Cryptographic Verification & Signed Token Generation
      const mfaRes = await fetch('/api/auth/verify-google-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifiedGoogleUser.email,
          name: verifiedGoogleUser.name,
          role: verifiedGoogleUser.role,
          totpCode: cleanCode,
          idToken: verifiedGoogleUser.idToken
        })
      });

      if (!mfaRes.ok) {
        const errorData = await mfaRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected TOTP verification. Please check the code in your Authenticator app.');
      }

      const data = await mfaRes.json();
      if (data.token) {
        setStoredSessionToken(data.token);
      }

      const targetDept: DepartmentType = verifiedGoogleUser.role === 'ACCOUNTANT' ? 'FINANCE' : 'BRANCH_MANAGER';
      loginAsRole(verifiedGoogleUser.role, targetDept, selectedBranchId, verifiedGoogleUser.name);
      setIsAuthenticated(true);
      setIsSubmitting(false);
      if (onSuccess) onSuccess(verifiedGoogleUser.role, targetDept);
    } catch (serverErr: any) {
      setIsSubmitting(false);
      setTotpError(
        serverErr?.message ||
          'Invalid or expired TOTP security code. Authenticator codes refresh every 30 seconds.'
      );
    }
  };

  // Staff selects department level -> open PIN entry
  const handleStaffLevelSelect = (dept: DepartmentType) => {
    requestPlatformFullscreen(true);
    setSelectedStaffDept(dept);
    const deptRoster = getRosterForDept(dept);
    setSelectedEmployeeId(deptRoster[0]?.id || '');
    setStaffPin('');
    setPinError('');
    setIsPinDeptDropdownOpen(false);
    setIsStaffNameDropdownOpen(false);
    setViewMode('STAFF_PIN');
  };

  // Handle PIN input digits and verify against server + Independent Staff Database
  const verifyPinAndLogin = useCallback(async (pinToVerify: string) => {
    if (pinToVerify.length !== 6) {
      setPinError('Please enter your 6-digit login PIN.');
      return;
    }

    requestPlatformFullscreen(true);
    setIsSubmitting(true);

    const loginResult = instantLoginWithStaffPin(
      pinToVerify,
      selectedStaffDept,
      selectedEmployee?.id
    );

    const targetStaffRecord = loginResult.success && loginResult.staffRecord ? loginResult.staffRecord : null;
    const targetDept = targetStaffRecord?.department || selectedStaffDept;
    const targetStaffName = targetStaffRecord?.name || selectedEmployee?.name || 'Staff Member';
    const targetStaffId = targetStaffRecord?.id || selectedEmployee?.id || '';

    if (!targetStaffId) {
      setIsSubmitting(false);
      setPinError('Unknown staff account. Only an authorized Manager or Administrator can provision staff accounts.');
      setStaffPin('');
      return;
    }

    // Request cryptographically signed session token from authoritative server backend
    try {
      const serverLoginRes = await fetch('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: targetStaffId,
          pin: pinToVerify,
          department: targetDept,
          branchId: targetStaffRecord?.branchId || selectedBranchId,
          staffName: targetStaffName,
          pinSalt: targetStaffRecord?.pinSalt,
          pinHash: targetStaffRecord?.pinHash
        })
      });
      if (serverLoginRes.ok) {
        const serverData = await serverLoginRes.json();
        if (serverData.token) {
          setStoredSessionToken(serverData.token);
        }
        if (!loginResult.success && serverData.user) {
          loginAsRole(
            'STAFF',
            (serverData.user.department as DepartmentType) || targetDept,
            serverData.user.branchId || selectedBranchId,
            serverData.user.name || targetStaffName
          );
          setIsAuthenticated(true);
          setTimeout(() => {
            setIsSubmitting(false);
            if (onSuccess) onSuccess('STAFF', (serverData.user.department as DepartmentType) || targetDept);
          }, 150);
          return;
        }
      } else if (!loginResult.success) {
        const errBody = await serverLoginRes.json().catch(() => ({}));
        setIsSubmitting(false);
        setPinError(
          errBody.error ||
            'Invalid staff ID or PIN. Only pre-registered staff accounts provisioned by a Manager or Admin are allowed.'
        );
        setStaffPin('');
        return;
      } else if (targetStaffRecord) {
        // Local Independent Staff Database verified the salted PIN hash; ensure terminal session token is hydrated
        const termRes = await fetch('/api/auth/terminal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetStaffRecord.id,
            name: targetStaffRecord.name,
            role: 'STAFF',
            department: targetStaffRecord.department,
            branchId: targetStaffRecord.branchId || selectedBranchId
          })
        });
        if (termRes.ok) {
          const termData = await termRes.json().catch(() => ({}));
          if (termData.token) {
            setStoredSessionToken(termData.token);
          }
        }
      }
    } catch {
      // Network unreachable: fall back to salted hash verification in Independent Staff Database
    }

    if (loginResult.success && loginResult.staffRecord) {
      const matched = loginResult.staffRecord;
      setSelectedStaffDept(matched.department);
      setSelectedEmployeeId(matched.id);
      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess('STAFF', matched.department);
      }, 150);
      return;
    }

    // Fallback check against in-memory selectedEmployee
    if (selectedEmployee && pinToVerify === selectedEmployee.loginPin) {
      setTimeout(() => {
        loginAsRole('STAFF', selectedEmployee.department, selectedEmployee.branchId || selectedBranchId, selectedEmployee.name);
        setIsAuthenticated(true);
        setIsSubmitting(false);
        if (onSuccess) onSuccess('STAFF', selectedEmployee.department);
      }, 150);
      return;
    }

    setIsSubmitting(false);
    setPinError(
      loginResult.error ||
        (selectedEmployee
          ? `Invalid 6-digit PIN for ${selectedEmployee.name}.`
          : 'No matching staff account found in the Independent Staff Database for that 6-digit PIN.')
    );
    setStaffPin('');
  }, [
    instantLoginWithStaffPin,
    loginAsRole,
    selectedEmployee,
    selectedStaffDept,
    selectedBranchId,
    setIsAuthenticated,
    onSuccess
  ]);

  // One-tap instant login directly from a saved Staff Record in the Independent Staff Database
  const handleInstantOneTapStaffLogin = async (staffId: string) => {
    requestPlatformFullscreen(true);
    setIsSubmitting(true);
    const res = instantLoginByStaffRecord(staffId);
    if (res.success && res.staffRecord) {
      try {
        const termRes = await fetch('/api/auth/terminal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: res.staffRecord.id,
            name: res.staffRecord.name,
            role: 'STAFF',
            department: res.staffRecord.department,
            branchId: res.staffRecord.branchId || selectedBranchId
          })
        });
        if (termRes.ok) {
          const termData = await termRes.json();
          if (termData.token) {
            setStoredSessionToken(termData.token);
          }
        }
      } catch {
        // Offline continuation
      }
      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess('STAFF', res.staffRecord!.department);
      }, 120);
    } else {
      setIsSubmitting(false);
      setPinError(res.error || 'Could not log in staff account.');
    }
  };

  // Quick Register & Store Staff directly into the Independent Staff Database
  const handleQuickStoreStaffInDb = async (e: React.FormEvent, loginImmediately = true) => {
    e.preventDefault();
    setPinError('');
    const trimmedName = quickStaffName.trim();
    const cleanPin = quickStaffPin.replace(/\D/g, '').slice(0, 6);
    if (!trimmedName) {
      setPinError('Please enter the staff member full name.');
      return;
    }
    if (cleanPin.length !== 6) {
      setPinError('Please assign a 6-digit numeric Login PIN (e.g. 123456).');
      return;
    }

    const targetDept = viewMode === 'STAFF_PIN' ? selectedStaffDept : quickStaffDept;
    const targetBranch = quickStaffBranchId || branches[0]?.id || selectedBranchId || '';

    try {
      if (targetDept === 'AFFILIATES') {
        const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const createdAff = await registerAffiliate({
          name: trimmedName,
          code: `SR-${trimmedName.split(' ')[0].toUpperCase()}-${(affiliates.length + 1).toString().padStart(2, '0')}`,
          phone: quickStaffPhone.trim() || '254722000000',
          branchId: targetBranch,
          employmentType: 'CASUAL',
          compensationModel: 'COMMISSION_ONLY',
          commissionRatePercent: 5,
          customSlug: slug || `rep-${Date.now().toString().slice(-3)}`,
          loginPin: cleanPin,
          mpesaNumber: quickStaffPhone.trim() || '254722000000',
          active: true
        });
        setSelectedStaffDept('AFFILIATES');
        setSelectedEmployeeId(createdAff.id);
        setQuickStaffFeedback(`Saved "${createdAff.name}" (PIN: ${cleanPin}) to Independent Staff Database!`);
        if (loginImmediately) {
          requestPlatformFullscreen(true);
          loginAsRole('STAFF', 'AFFILIATES', targetBranch, createdAff.name);
          setIsAuthenticated(true);
          if (onSuccess) onSuccess('STAFF', 'AFFILIATES');
        }
      } else {
        const isCasualPos = targetDept === 'POS';
        const deptObj = STAFF_LEVELS.find(s => s.id === targetDept);
        const createdEmp = await addEmployee({
          name: trimmedName,
          employeeNumber: `${targetDept.slice(0, 3)}-${(employees.length + 101).toString()}`,
          roleTitle: deptObj?.title || 'Operations Staff',
          department: targetDept,
          employmentType: isCasualPos ? 'CASUAL' : 'SALARIED',
          compensationModel: isCasualPos ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY',
          commissionRatePercent: isCasualPos ? 3 : 0,
          branchId: targetBranch,
          loginPin: cleanPin,
          basicSalaryKes: isCasualPos ? 0 : 45000,
          houseAllowanceKes: isCasualPos ? 0 : 10000,
          transportAllowanceKes: isCasualPos ? 0 : 5000,
          kraPin: 'A009182736Z',
          nssfNumber: `NSSF-${Date.now().toString().slice(-4)}`,
          nhifShifNumber: `SHIF-${Date.now().toString().slice(-4)}`,
          bankName: 'Equity Bank Kenya',
          bankAccount: '018029384710',
          mPesaNumber: quickStaffPhone.trim() || '254722000000',
          active: true
        });
        setSelectedStaffDept(targetDept);
        setSelectedEmployeeId(createdEmp.id);
        setQuickStaffFeedback(`Saved "${createdEmp.name}" (PIN: ${cleanPin}) to Independent Staff Database!`);
        if (loginImmediately) {
          requestPlatformFullscreen(true);
          loginAsRole('STAFF', targetDept, targetBranch, createdEmp.name);
          setIsAuthenticated(true);
          if (onSuccess) onSuccess('STAFF', targetDept);
        }
      }
    } catch (err) {
      setPinError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }

    setQuickStaffName('');
    setQuickStaffPin('');
    setShowQuickAddStaff(false);
    setTimeout(() => setQuickStaffFeedback(null), 4000);
  };

  const handlePinDigit = useCallback((digit: string) => {
    if (isSubmitting) return;
    setPinError('');
    setStaffPin(prev => {
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
  }, [isSubmitting]);

  useEffect(() => {
    if (viewMode === 'STAFF_PIN' && staffPin.length === 6 && !isSubmitting) {
      verifyPinAndLogin(staffPin);
    }
  }, [viewMode, staffPin, isSubmitting, verifyPinAndLogin]);

  const handlePinBackspace = useCallback(() => {
    if (isSubmitting) return;
    setStaffPin(prev => prev.slice(0, -1));
    setPinError('');
  }, [isSubmitting]);

  const handlePinClear = useCallback(() => {
    if (isSubmitting) return;
    setStaffPin('');
    setPinError('');
  }, [isSubmitting]);

  // Activate physical keyboard (0-9, Numpad, Backspace, Delete/Escape, Enter) when in STAFF_PIN view
  useEffect(() => {
    if (viewMode !== 'STAFF_PIN') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;
      // Ignore if modifier keys (Ctrl, Alt, Meta) are pressed
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        flashKey(e.key);
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        flashKey('BACKSPACE');
        handlePinBackspace();
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault();
        flashKey('CLEAR');
        handlePinClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (staffPin.length === 6) {
          verifyPinAndLogin(staffPin);
        } else {
          setPinError('Please enter all 6 digits of your staff PIN.');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isSubmitting, staffPin, handlePinDigit, handlePinBackspace, handlePinClear, verifyPinAndLogin, flashKey]);

  const selectedStaffOption = STAFF_LEVELS.find(s => s.id === selectedStaffDept) || STAFF_LEVELS[0];

  return (
    <div className={`w-full ${isOverlay ? 'fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto' : 'w-full max-w-5xl mx-auto my-auto'}`}>
      <CenterScreenFeedback
        feedback={authFeedback}
        onDismiss={() => setAuthFeedback(null)}
      />
      <div
        className={`w-full bg-white ${isOverlay ? 'rounded-none sm:rounded-[36px] min-h-dvh sm:min-h-0' : 'rounded-[36px]'} shadow-[0_24px_60px_-12px_rgba(10,0,110,0.32)] border border-slate-200/90 overflow-hidden relative mx-auto transition-all duration-200 ${
          viewMode === 'STAFF_PIN'
            ? 'max-w-4xl'
            : viewMode === 'GOOGLE_LOGIN'
            ? 'max-w-xl'
            : 'max-w-5xl'
        }`}
      >
        
        {/* Optional Top Bar when displayed as an overlay */}
        {isOverlay && onClose && (
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 bg-[#FFDE00] text-[#0A006E] border-b-2 border-[#0A006E]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-montserrat font-black italic text-sm text-[#0A006E]">
                VAAIRO Access Level &amp; Role Switcher
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition shadow-2xs cursor-pointer"
              title="Close gateway"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* VIEW 1: THE THREE CLEAN BOXES - NO TEXT, JUST ADMIN, ACCOUNTANT, STAFFS */}
        {viewMode === 'ROLE_BOXES' && (
          <div className="p-4 sm:p-8 md:p-12 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6 md:gap-8 items-stretch md:items-start">
              
              {/* BOX 1: ADMIN (#0A006E) */}
              <div 
                data-oauth-popup="true"
                onClick={() => handleOpenGoogleLogin('SUPER_ADMIN')}
                className="group cursor-pointer rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-12 text-white transition-all duration-300 transform active:scale-[0.99] md:hover:-translate-y-2 shadow-[0_10px_24px_-4px_rgba(10,0,110,0.32)] md:shadow-[0_14px_30px_-4px_rgba(10,0,110,0.35),0_6px_12px_-2px_rgba(0,0,0,0.18)] md:hover:shadow-[0_22px_40px_-6px_rgba(10,0,110,0.48),0_10px_20px_-4px_rgba(0,0,0,0.24)] relative overflow-hidden flex flex-row md:flex-col items-center justify-between md:justify-center text-left md:text-center border-2 border-transparent hover:border-[#FFDE00] bg-[#0A006E] min-h-[88px] sm:min-h-[120px] md:min-h-[240px]"
              >
                <div className="silent-scanner-beam" />
                <div className="absolute top-0 right-0 w-24 h-24 md:w-36 md:h-36 bg-white/5 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform" />
                
                <div className="flex items-center gap-3.5 md:flex-col md:gap-0 relative z-10">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner md:mb-6 group-hover:scale-110 group-hover:bg-[#FFDE00] group-hover:text-[#0A006E] transition-all shrink-0">
                    <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-[#FFDE00] group-hover:text-[#0A006E] transition-colors" />
                  </div>

                  <div>
                    <h3 className="font-montserrat font-black italic text-xl sm:text-2xl md:text-4xl text-white tracking-tight">
                      Admin
                    </h3>
                    <div className="md:hidden flex items-center gap-1.5 text-[11px] text-[#FFDE00] opacity-0 max-h-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-6 group-hover:mt-0.5 group-active:opacity-100 group-active:max-h-6 group-active:mt-0.5 transition-all duration-200 font-bold">
                      <GoogleIcon />
                      <span>Google Sign-In</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex mt-4 items-center gap-1.5 text-xs text-[#FFDE00] opacity-0 group-hover:opacity-100 transition-opacity font-bold relative z-10">
                  <GoogleIcon />
                  <span>Google Sign-In</span>
                </div>

                <div className="md:hidden w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FFDE00] shrink-0 relative z-10">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* BOX 2: ACCOUNTANT (#012606) */}
              <div 
                data-oauth-popup="true"
                onClick={() => handleOpenGoogleLogin('ACCOUNTANT')}
                className="group cursor-pointer rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-12 text-white transition-all duration-300 transform active:scale-[0.99] md:hover:-translate-y-2 shadow-[0_10px_24px_-4px_rgba(1,38,6,0.32)] md:shadow-[0_14px_30px_-4px_rgba(1,38,6,0.35),0_6px_12px_-2px_rgba(0,0,0,0.18)] md:hover:shadow-[0_22px_40px_-6px_rgba(1,38,6,0.48),0_10px_20px_-4px_rgba(0,0,0,0.24)] relative overflow-hidden flex flex-row md:flex-col items-center justify-between md:justify-center text-left md:text-center border-2 border-transparent hover:border-[#FFDE00] bg-[#012606] min-h-[88px] sm:min-h-[120px] md:min-h-[240px]"
              >
                <div className="silent-scanner-beam" style={{ animationDelay: '1.2s' }} />
                <div className="absolute top-0 right-0 w-24 h-24 md:w-36 md:h-36 bg-white/5 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform" />
                
                <div className="flex items-center gap-3.5 md:flex-col md:gap-0 relative z-10">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner md:mb-6 group-hover:scale-110 group-hover:bg-[#FFDE00] group-hover:text-[#012606] transition-all shrink-0">
                    <Calculator className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-[#FFDE00] group-hover:text-[#012606] transition-colors" />
                  </div>

                  <div>
                    <h3 className="font-montserrat font-black italic text-xl sm:text-2xl md:text-4xl text-white tracking-tight">
                      Accountant
                    </h3>
                    <div className="md:hidden flex items-center gap-1.5 text-[11px] text-[#FFDE00] opacity-0 max-h-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-6 group-hover:mt-0.5 group-active:opacity-100 group-active:max-h-6 group-active:mt-0.5 transition-all duration-200 font-bold">
                      <GoogleIcon />
                      <span>Google Sign-In</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex mt-4 items-center gap-1.5 text-xs text-[#FFDE00] opacity-0 group-hover:opacity-100 transition-opacity font-bold relative z-10">
                  <GoogleIcon />
                  <span>Google Sign-In</span>
                </div>

                <div className="md:hidden w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FFDE00] shrink-0 relative z-10">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* BOX 3: STAFFS (#FFDE00) */}
              <div 
                onClick={() => setIsStaffDropdownOpen(prev => !prev)}
                className={`group cursor-pointer rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-12 text-slate-900 transition-all duration-300 transform active:scale-[0.99] md:hover:-translate-y-2 shadow-[0_10px_24px_-4px_rgba(10,0,110,0.2)] md:shadow-[0_14px_30px_-4px_rgba(10,0,110,0.22),0_6px_12px_-2px_rgba(0,0,0,0.12)] md:hover:shadow-[0_22px_40px_-6px_rgba(10,0,110,0.34),0_10px_20px_-4px_rgba(0,0,0,0.18)] relative overflow-hidden flex flex-row md:flex-col items-center justify-between md:justify-center text-left md:text-center border-2 border-[#0A006E] bg-[#FFDE00] min-h-[88px] sm:min-h-[120px] md:min-h-[240px] ${
                  isStaffDropdownOpen ? 'ring-4 ring-[#0A006E]/25' : ''
                }`}
              >
                <div className="silent-scanner-beam-dark" style={{ animationDelay: '2.4s' }} />
                <div className="absolute top-0 right-0 w-24 h-24 md:w-36 md:h-36 bg-[#0A006E]/10 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform" />
                
                <div className="flex items-center gap-3.5 md:flex-col md:gap-0 relative z-10">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md md:mb-6 group-hover:scale-110 transition-all shrink-0">
                    <Users className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-montserrat font-black italic text-xl sm:text-2xl md:text-4xl text-[#0A006E] tracking-tight">
                        Staffs
                      </h3>
                      <ChevronDown
                        className={`hidden md:block w-6 h-6 text-[#0A006E] transition-transform duration-200 ${
                          isStaffDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    <div className="md:hidden mt-0.5 flex items-center gap-1.5 text-[11px] text-[#0A006E] font-bold">
                      <Lock className="w-3 h-3" />
                      <span>{isStaffDropdownOpen ? 'Select Department Below' : 'Tap for Department PIN'}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex mt-4 items-center gap-1.5 text-xs text-[#0A006E] font-bold relative z-10">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isStaffDropdownOpen ? 'Select Department Below' : 'Tap to Select Department'}</span>
                </div>

                <div className="md:hidden w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 relative z-10">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isStaffDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

            </div>

            {/* COMPACT STAFF DEPARTMENT DROPDOWN BELOW THE 3 BOXES */}
            {isStaffDropdownOpen && (
              <div className="w-full mt-5 bg-white rounded-[28px] border border-slate-200/90 shadow-[0_16px_36px_-8px_rgba(10,0,110,0.2)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-50/70">
                  {STAFF_LEVELS.map((level) => {
                    const isSelected = selectedStaffDept === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => handleStaffLevelSelect(level.id)}
                        className={`w-full px-4 py-3 rounded-2xl text-left transition-all flex items-center justify-between gap-2.5 group border shadow-2xs ${
                          isSelected
                            ? 'bg-[#FFDE00]/25 border-[#0A006E]/30'
                            : 'bg-white border-slate-200/80 hover:border-[#0A006E]/30 hover:bg-[#FFDE00]/15'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-[#0A006E] flex items-center justify-center shrink-0 shadow-2xs">
                            {React.cloneElement(level.icon as React.ReactElement<{ className?: string }>, {
                              className: 'w-4 h-4 text-[#FFDE00]'
                            })}
                          </div>
                          <div className="min-w-0">
                            <div className="font-montserrat font-black text-xs text-slate-900 group-hover:text-[#0A006E] truncate">
                              {level.routeLabel}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 truncate">
                              {level.badge}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0A006E] group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: GOOGLE LOGIN LEVEL FOR ADMIN & ACCOUNTANT */}
        {viewMode === 'GOOGLE_LOGIN' && (
          <div data-oauth-container="true" className="p-6 sm:p-10 bg-white space-y-6 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setViewMode('ROLE_BOXES')}
              className="inline-flex items-center gap-1.5 text-xs font-montserrat font-black text-[#0A006E] hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Role Selection</span>
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto shadow-sm">
                <GoogleIcon />
              </div>
              <h2 className="font-montserrat font-black italic text-xl text-slate-900">
                Sign in with Google Workspace SSO
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Strict Google OAuth authentication required for <strong className="text-[#0A006E]">{googleTargetRole === 'SUPER_ADMIN' ? 'System Administrator' : 'CPA Accountant'}</strong> privileges.
              </p>
            </div>

            {googleLoginError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{googleLoginError}</div>
              </div>
            )}

            {/* Primary Action: Real Google OAuth Popup */}
            <button
              type="button"
              data-oauth-popup="true"
              onClick={handleCompleteGoogleLogin}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <GoogleIcon />
              <span>
                {isSubmitting
                  ? 'Verifying Google Account...'
                  : `Sign in with Google (${googleTargetRole === 'SUPER_ADMIN' ? 'Admin' : 'Accountant'})`}
              </span>
            </button>
          </div>
        )}

        {/* VIEW 2B: RFC 6238 TOTP MULTI-FACTOR AUTHENTICATION CHALLENGE */}
        {viewMode === 'MFA_CHALLENGE' && verifiedGoogleUser && (
          <div className="p-6 sm:p-10 bg-white space-y-6 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setViewMode('GOOGLE_LOGIN');
                setVerifiedGoogleUser(null);
                setTotpInput('');
                setTotpError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-montserrat font-black text-[#0A006E] hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Switch Google Account</span>
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                <KeyRound className="w-7 h-7 text-emerald-700" />
              </div>
              <h2 className="font-montserrat font-black italic text-xl text-slate-900">
                Two-Factor Authentication
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Step 2: Enter the 6-digit TOTP security code from your Authenticator app.
              </p>
            </div>

            {/* Verified Account Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-montserrat font-bold text-slate-500 uppercase tracking-wide">
                  Verified Identity
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {verifiedGoogleUser.name}
                </div>
                <div className="text-[11px] font-mono text-[#0A006E] truncate">
                  {verifiedGoogleUser.email}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-montserrat font-black bg-[#0A006E] text-[#FFDE00] shrink-0">
                {verifiedGoogleUser.role === 'SUPER_ADMIN' ? 'ADMIN' : 'ACCOUNTANT'}
              </span>
            </div>

            {/* Live 30s Countdown Timer */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-xs font-bold text-amber-900">
                  TOTP Code expires in <strong className="font-mono text-sm">{totpSecondsRemaining}s</strong>
                </span>
              </div>
              <span className="text-[10px] font-montserrat font-bold text-amber-800 uppercase tracking-wider">
                RFC 6238
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleVerifyMfaChallenge} className="space-y-4">
              <div>
                <label className="block text-[11px] font-montserrat font-black text-slate-700 uppercase tracking-wider mb-2">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={totpInput}
                  onChange={e => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000"
                  className="w-full py-3.5 px-4 bg-white border-2 border-slate-300 focus:border-[#0A006E] rounded-2xl font-mono text-center text-2xl font-black tracking-widest text-[#0A006E] focus:outline-none transition shadow-inner"
                />
              </div>

              {totpError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{totpError}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={totpInput.length !== 6}
                className="w-full py-3.5 px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-[#FFDE00]" />
                <span>Verify Token & Unlock ERP</span>
              </button>
            </form>

            {/* Enterprise TOTP Security Notice (No secret exposed in browser) */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-montserrat font-bold text-slate-800 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-[#0A006E]" />
                <span>Server-Authoritative RFC 6238 TOTP Verification</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Enter the 6-digit code from your enrolled enterprise authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, or Authy). TOTP secrets are strictly validated on the server via <code className="font-mono text-slate-700">TOTP_ADMIN_SECRET</code> and never stored in browser storage.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 3: STAFF LEVEL SELECTION */}
        {viewMode === 'STAFF_LEVELS' && (
          <div className="p-6 sm:p-8 bg-white space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <button
                  onClick={() => setViewMode('ROLE_BOXES')}
                  className="inline-flex items-center gap-1.5 text-xs font-montserrat font-black text-[#0A006E] hover:underline mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Role Selection</span>
                </button>
                <h2 className="text-base sm:text-lg font-montserrat font-black italic text-slate-900 tracking-tight">
                  Select Staff Access Level
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose your assigned staff role to enter PIN authentication.
                </p>
              </div>
            </div>

            {/* List of Staff Levels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STAFF_LEVELS.map((level) => (
                <div
                  key={level.id}
                  onClick={() => handleStaffLevelSelect(level.id)}
                  className="group cursor-pointer p-5 rounded-2xl border-2 border-slate-200 hover:border-[#0A006E] bg-slate-50/70 hover:bg-[#FFDE00]/15 transition-all duration-200 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 group-hover:bg-[#0A006E] group-hover:text-white transition">
                        {level.icon}
                      </div>
                      <div>
                        <h4 className="font-montserrat font-black text-sm text-slate-900 group-hover:text-[#0A006E] transition">
                          {level.title}
                        </h4>
                        <span className="text-[10px] font-mono font-bold text-[#012606] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {level.badge}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#0A006E] group-hover:translate-x-1 transition-transform shrink-0 mt-1" />
                  </div>

                  <p className="text-xs text-slate-600 font-medium">
                    {level.desc}
                  </p>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono">Assigned Module:</span>
                    <strong className="text-[#0A006E] font-montserrat font-bold">
                      {level.routeLabel} Only
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 4: STAFF 6-DIGIT PIN ENTRY (CURVED WINDOW & SOFT EDGES) */}
        {viewMode === 'STAFF_PIN' && (
          <div className="p-6 sm:p-10 bg-white rounded-[36px] w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <button
                onClick={() => {
                  setIsStaffDropdownOpen(false);
                  setViewMode('ROLE_BOXES');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-[#0A006E] text-[#0A006E] hover:text-white text-xs sm:text-sm font-montserrat font-black transition shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Roles</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/15 flex items-center justify-center shadow-sm">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-montserrat font-black italic text-xl sm:text-2xl text-[#0A006E] tracking-tight">
                    Staff PIN Terminal
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Select department &amp; staff name, then enter your 6-digit PIN
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-[#012606] bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-full">
                {selectedStaffOption.badge}
              </span>
            </div>

            {/* Main 2-Column Terminal Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
              
              {/* Left Column (7 Cols): Soft Department Button, Soft Staff Selector & Curved 6-Digit PIN Display */}
              <div className="md:col-span-7 space-y-5">
                {/* Soft-Edge Staff Department Selector */}
                <div className="relative">
                  <label className="block text-xs font-montserrat font-black uppercase tracking-wider text-slate-600 mb-1.5 pl-1">
                    1. Staff Department
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPinDeptDropdownOpen(prev => !prev);
                      setIsStaffNameDropdownOpen(false);
                    }}
                    className="w-full px-5 py-4 rounded-[24px] border border-[#0A006E]/15 bg-gradient-to-r from-[#FFDE00]/25 via-[#FFDE00]/15 to-amber-50/40 hover:from-[#FFDE00]/35 hover:to-[#FFDE00]/25 transition-all duration-200 flex items-center justify-between gap-3 text-left shadow-[0_6px_20px_-6px_rgba(10,0,110,0.14)]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-sm">
                        {React.cloneElement(selectedStaffOption.icon as React.ReactElement<{ className?: string }>, {
                          className: 'w-5 h-5 text-[#FFDE00]'
                        })}
                      </div>
                      <div className="min-w-0">
                        <div className="font-montserrat font-black text-sm sm:text-base text-[#0A006E] truncate">
                          {selectedStaffOption.title}
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-600 truncate">
                          Module: {selectedStaffOption.routeLabel}
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shrink-0 shadow-2xs">
                      <ChevronDown
                        className={`w-4 h-4 text-[#0A006E] transition-transform duration-200 ${
                          isPinDeptDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isPinDeptDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-[24px] border border-slate-200 shadow-[0_20px_45px_-10px_rgba(10,0,110,0.28)] overflow-hidden divide-y divide-slate-100 z-30 max-h-64 overflow-y-auto p-1.5">
                      {STAFF_LEVELS.map((level) => {
                        const isCurrentDept = level.id === selectedStaffDept;
                        return (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => {
                              setSelectedStaffDept(level.id);
                              setQuickStaffDept(level.id);
                              const deptRoster = getRosterForDept(level.id);
                              setSelectedEmployeeId(deptRoster[0]?.id || '');
                              setIsPinDeptDropdownOpen(false);
                              setStaffPin('');
                              setPinError('');
                            }}
                            className={`w-full px-4 py-3 rounded-2xl text-left flex items-center justify-between gap-3 transition hover:bg-[#FFDE00]/20 ${
                              isCurrentDept ? 'bg-[#0A006E]/8 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                                {React.cloneElement(level.icon as React.ReactElement<{ className?: string }>, {
                                  className: 'w-4 h-4 text-[#FFDE00]'
                                })}
                              </div>
                              <span className="font-montserrat font-black text-xs sm:text-sm text-slate-900 truncate">
                                {level.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-[#0A006E] shrink-0">
                              {level.routeLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Soft-Edge Staff / Sales Representative Name Selector */}
                <div className="relative space-y-2">
                  <div className="flex items-center justify-between pl-1">
                    <label className="block text-xs font-montserrat font-black uppercase tracking-wider text-slate-600">
                      {selectedStaffDept === 'AFFILIATES'
                        ? `2. Sales Representative ${selectedEmployee ? `(${selectedEmployee.name})` : ''}`
                        : selectedStaffDept === 'POS'
                        ? `2. Counter Cashier ${selectedEmployee ? `(Served by - ${selectedEmployee.name})` : ''}`
                        : `2. Staff Member ${selectedEmployee ? `(Served by - ${selectedEmployee.name})` : ''}`}
                    </label>
                  </div>

                  {!selectedEmployee ? (
                    <div className="p-5 rounded-[24px] border-2 border-amber-300 bg-amber-50/80 space-y-2 text-xs shadow-xs">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-montserrat font-black text-sm text-amber-950">
                            {selectedStaffDept === 'AFFILIATES'
                              ? 'No Sales Representatives Created Yet'
                              : selectedStaffDept === 'POS'
                              ? 'No Counter Cashiers Created Yet'
                              : `No Staff Accounts Created in ${selectedStaffOption.routeLabel} Yet`}
                          </div>
                          <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                            {selectedStaffDept === 'AFFILIATES' ? (
                              <>
                                Sales Representatives are created by the <strong>Sales Manager</strong> (in the{' '}
                                <strong>Sales Manager Dashboard</strong>) and issued with a <strong>6-digit Login PIN</strong>. Once your Sales Manager creates your account and issues your PIN, select your name here and enter your 6-digit PIN to sign in.
                              </>
                            ) : selectedStaffDept === 'POS' ? (
                              <>
                                Counter Cashiers are created by the <strong>Branch Manager</strong> or <strong>Admin</strong> and issued with a <strong>6-digit Login PIN</strong>. Once your Branch Manager or Admin creates your Counter Cashier account and issues your PIN, select your name here and enter your 6-digit PIN to sign in.
                              </>
                            ) : (
                              <>
                                Staff accounts for <strong>{selectedStaffOption.title}</strong> are created by <strong>Admin</strong> or <strong>HR &amp; Payroll</strong> and issued with a <strong>6-digit Login PIN</strong>. Once your account and 6-digit PIN have been issued, select your name here to sign in.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsStaffNameDropdownOpen(prev => !prev);
                          setIsPinDeptDropdownOpen(false);
                        }}
                        className="w-full px-5 py-4 rounded-[24px] border border-slate-200/90 hover:border-[#0A006E]/30 bg-slate-50/80 hover:bg-slate-100/80 transition-all duration-200 flex items-center justify-between gap-3 text-left shadow-xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-base shrink-0 shadow-sm">
                            {selectedEmployee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-montserrat font-black text-sm sm:text-base text-slate-900 truncate">
                              {selectedEmployee.name}
                            </div>
                            <div className="text-xs font-mono font-bold text-[#012606] truncate">
                              {selectedStaffDept === 'AFFILIATES'
                                ? `Sales Representative - ${selectedEmployee.name} • Enter Sales Manager-Issued 6-Digit PIN`
                                : selectedStaffDept === 'POS'
                                ? `Counter Cashier - ${selectedEmployee.name} • Enter Branch Manager / Admin-Issued 6-Digit PIN`
                                : `Served by - ${selectedEmployee.name} • Enter HR-Issued 6-Digit PIN`}
                            </div>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                          <ChevronDown
                            className={`w-4 h-4 text-[#0A006E] transition-transform duration-200 ${
                              isStaffNameDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {isStaffNameDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-[24px] border border-slate-200 shadow-[0_20px_45px_-10px_rgba(10,0,110,0.28)] overflow-hidden divide-y divide-slate-100 z-30 max-h-60 overflow-y-auto p-1.5">
                          {departmentStaffList.map((emp) => {
                            const isSelectedEmp = emp.id === selectedEmployee.id;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId(emp.id);
                                  setIsStaffNameDropdownOpen(false);
                                  setStaffPin('');
                                  setPinError('');
                                }}
                                className={`w-full px-4 py-3 rounded-2xl text-left flex items-center justify-between gap-3 transition hover:bg-[#FFDE00]/20 ${
                                  isSelectedEmp ? 'bg-[#0A006E]/8 font-bold' : ''
                                }`}
                              >
                                <span className="font-montserrat font-black text-xs sm:text-sm text-slate-900 truncate">
                                  {emp.name}
                                </span>
                                <span className="text-[11px] font-mono font-bold text-[#012606] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                  {emp.employeeNumber} • {selectedStaffDept === 'AFFILIATES' ? 'Sales Manager Verified' : selectedStaffDept === 'POS' ? 'Branch Manager / Admin Verified' : 'HR Verified'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Curved High-Visibility 6-Digit PIN Display Box */}
                <div className="p-5 sm:p-6 rounded-[28px] bg-slate-900 border border-[#0A006E]/40 shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-xs font-montserrat font-bold text-slate-300 px-1">
                    <span className="uppercase tracking-wider text-[#FFDE00]">3. Enter 6-Digit Security PIN</span>
                    <span className="font-mono text-white">{staffPin.length} / 6 Digits</span>
                  </div>

                  <div
                    className="flex items-center justify-center gap-2.5 sm:gap-3.5 py-1"
                    title="Enter 6-digit staff PIN using keyboard or keypad"
                  >
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const isFilled = staffPin.length > idx;
                      const isCurrent = staffPin.length === idx;
                      return (
                        <div
                          key={idx}
                          className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-mono font-black border-2 transition-all ${
                            isFilled
                              ? 'border-[#FFDE00] bg-[#FFDE00] text-[#0A006E] shadow-md scale-105'
                              : isCurrent
                              ? 'border-[#FFDE00] bg-white/15 text-white ring-4 ring-[#FFDE00]/30'
                              : 'border-slate-700 bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isFilled ? '●' : ''}
                        </div>
                      );
                    })}
                  </div>

                  {pinError && (
                    <p className="text-xs text-red-400 text-center font-bold pt-1">{pinError}</p>
                  )}
                </div>
              </div>

              {/* Right Column (5 Cols): Soft-Curved Numeric Keypad & Sign In */}
              <div className="md:col-span-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handlePinDigit(digit)}
                      className={`py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-xl sm:text-2xl border transition active:scale-95 shadow-xs ${
                        activeKey === digit
                          ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] scale-95 ring-2 ring-[#FFDE00]'
                          : 'bg-slate-100/90 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200/80 hover:border-[#0A006E]'
                      }`}
                    >
                      {digit}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handlePinClear}
                    className={`py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-xs sm:text-sm uppercase border transition active:scale-95 ${
                      activeKey === 'CLEAR'
                        ? 'bg-red-700 text-white border-red-700 scale-95'
                        : 'bg-red-50/90 hover:bg-red-100 text-red-700 border-red-200/80'
                    }`}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePinDigit('0')}
                    className={`py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-xl sm:text-2xl border transition active:scale-95 shadow-xs ${
                      activeKey === '0'
                        ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] scale-95 ring-2 ring-[#FFDE00]'
                        : 'bg-slate-100/90 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200/80 hover:border-[#0A006E]'
                    }`}
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={handlePinBackspace}
                    className={`py-4 sm:py-5 rounded-[22px] flex items-center justify-center border transition active:scale-95 ${
                      activeKey === 'BACKSPACE'
                        ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] scale-95'
                        : 'bg-slate-100/90 hover:bg-slate-200 text-slate-800 border-slate-200/80'
                    }`}
                    title="Backspace"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => verifyPinAndLogin(staffPin)}
                  disabled={staffPin.length !== 6 || isSubmitting}
                  className={`w-full py-4 rounded-[24px] font-montserrat font-black italic text-sm sm:text-base flex items-center justify-center gap-2 transition shadow-lg ${
                    staffPin.length === 6 && !isSubmitting
                      ? 'bg-[#0A006E] text-[#FFDE00] hover:bg-[#060046]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{isSubmitting ? 'Signing in...' : `Sign In — ${selectedStaffOption.routeLabel}`}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
