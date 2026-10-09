import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Trash2,
  PauseCircle,
  Ban,
  CheckCircle2,
  X,
  Save,
  KeyRound,
  Building2,
  Phone,
  Briefcase,
  ShieldAlert,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import {
  Affiliate,
  DepartmentType,
  Employee,
  StaffEmploymentStatus
} from '../../types';
import { StaffDirectoryRecord } from '../../utils/staffDatabase';
import { useErp } from '../../context/ErpContext';

export interface UnifiedStaffTarget {
  id: string;
  recordType: 'EMPLOYEE' | 'AFFILIATE';
  name: string;
  codeOrNumber: string;
  roleTitle: string;
  department: DepartmentType;
  branchId?: string;
  phone: string;
  mpesaNumber: string;
  loginPin?: string;
  active: boolean;
  employmentStatus: StaffEmploymentStatus;
  suspendedAt?: string;
  suspensionReason?: string;
  terminatedAt?: string;
  terminationReason?: string;
  basicSalaryKes?: number;
  commissionRatePercent?: number;
  kraPin?: string;
  bankName?: string;
  bankAccount?: string;
}

export function normalizeStaffTarget(
  item: Employee | Affiliate | StaffDirectoryRecord
): UnifiedStaffTarget {
  const isAffiliate =
    ('recordType' in item && item.recordType === 'AFFILIATE') ||
    (!('recordType' in item) && 'code' in item && !('employeeNumber' in item));

  const status: StaffEmploymentStatus =
    item.employmentStatus || (item.active === false ? 'SUSPENDED' : 'ACTIVE');

  if ('recordType' in item) {
    // StaffDirectoryRecord
    return {
      id: item.id,
      recordType: item.recordType,
      name: item.name,
      codeOrNumber: item.codeOrNumber,
      roleTitle: item.roleTitle,
      department: item.department,
      branchId: item.branchId,
      phone: item.phone || '',
      mpesaNumber: item.phone || '',
      loginPin: item.loginPin,
      active: status === 'ACTIVE',
      employmentStatus: status,
      suspendedAt: item.suspendedAt,
      suspensionReason: item.suspensionReason,
      terminatedAt: item.terminatedAt,
      terminationReason: item.terminationReason,
      basicSalaryKes: item.basicSalaryKes,
      commissionRatePercent: item.commissionRatePercent,
      kraPin: item.kraPin,
      bankName: item.bankName,
      bankAccount: item.bankAccount
    };
  }

  if (isAffiliate) {
    const aff = item as Affiliate;
    return {
      id: aff.id,
      recordType: 'AFFILIATE',
      name: aff.name,
      codeOrNumber: aff.code,
      roleTitle: 'Sales Representative',
      department: 'AFFILIATES',
      branchId: aff.branchId,
      phone: aff.phone || aff.mpesaNumber || '',
      mpesaNumber: aff.mpesaNumber || aff.phone || '',
      loginPin: aff.loginPin,
      active: status === 'ACTIVE',
      employmentStatus: status,
      suspendedAt: aff.suspendedAt,
      suspensionReason: aff.suspensionReason,
      terminatedAt: aff.terminatedAt,
      terminationReason: aff.terminationReason,
      commissionRatePercent: aff.commissionRatePercent ?? 5
    };
  }

  const emp = item as Employee;
  return {
    id: emp.id,
    recordType: 'EMPLOYEE',
    name: emp.name,
    codeOrNumber: emp.employeeNumber,
    roleTitle: emp.roleTitle,
    department: emp.department,
    branchId: emp.branchId,
    phone: emp.mPesaNumber || '',
    mpesaNumber: emp.mPesaNumber || '',
    loginPin: emp.loginPin,
    active: status === 'ACTIVE',
    employmentStatus: status,
    suspendedAt: emp.suspendedAt,
    suspensionReason: emp.suspensionReason,
    terminatedAt: emp.terminatedAt,
    terminationReason: emp.terminationReason,
    basicSalaryKes: emp.basicSalaryKes,
    commissionRatePercent: emp.commissionRatePercent,
    kraPin: emp.kraPin,
    bankName: emp.bankName,
    bankAccount: emp.bankAccount
  };
}

export const StaffStatusBadge: React.FC<{
  status?: StaffEmploymentStatus;
  active?: boolean;
  reason?: string;
  compact?: boolean;
}> = ({ status, active, reason, compact = false }) => {
  const resolved: StaffEmploymentStatus =
    status || (active === false ? 'SUSPENDED' : 'ACTIVE');

  if (resolved === 'TERMINATED') {
    return (
      <span
        title={reason ? `Terminated: ${reason}` : 'Employment Terminated (Login Revoked)'}
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300 ${
          compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        Terminated
      </span>
    );
  }

  if (resolved === 'SUSPENDED') {
    return (
      <span
        title={reason ? `Suspended: ${reason}` : 'Account Suspended (Login Blocked)'}
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 ${
          compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        Suspended
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 ${
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
      Active
    </span>
  );
};

interface StaffActionButtonsProps {
  staff: Employee | Affiliate | StaffDirectoryRecord;
  compact?: boolean;
  onActionComplete?: (message: string) => void;
}

export const StaffActionButtons: React.FC<StaffActionButtonsProps> = ({
  staff,
  compact = false,
  onActionComplete
}) => {
  const {
    reactivateStaffMember,
    deleteStaffFromIndependentDb
  } = useErp();

  const [modalMode, setModalMode] = useState<'EDIT' | 'SUSPEND' | 'TERMINATE' | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const normalized = normalizeStaffTarget(staff);

  const handleInstantDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyAction) return;
    setBusyAction('DELETE');
    try {
      await deleteStaffFromIndependentDb(normalized.id);
      onActionComplete?.(`Instantly deleted ${normalized.name} (${normalized.codeOrNumber}) from all databases.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleInstantReactivate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyAction) return;
    setBusyAction('REACTIVATE');
    try {
      await reactivateStaffMember(normalized.id);
      onActionComplete?.(`Reactivated ${normalized.name} (${normalized.codeOrNumber}).`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickSuspend = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('SUSPEND');
  };

  const handleQuickTerminate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('TERMINATE');
  };

  return (
    <>
      <div
        className="inline-flex items-center gap-1.5 flex-wrap"
        onClick={e => e.stopPropagation()}
      >
        {/* EDIT */}
        <button
          type="button"
          onClick={() => setModalMode('EDIT')}
          title={`Edit ${normalized.name}`}
          className={`inline-flex items-center gap-1 rounded-lg font-bold bg-blue-50 hover:bg-blue-100 text-[#0A006E] border border-blue-200 transition-all cursor-pointer ${
            compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
          }`}
        >
          <Edit3 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>Edit</span>
        </button>

        {/* SUSPEND or REACTIVATE */}
        {normalized.employmentStatus === 'ACTIVE' ? (
          <button
            type="button"
            onClick={handleQuickSuspend}
            disabled={busyAction !== null}
            title={`Suspend ${normalized.name} (temporarily block PIN login)`}
            className={`inline-flex items-center gap-1 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all cursor-pointer ${
              compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
            }`}
          >
            <PauseCircle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>Suspend</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleInstantReactivate}
            disabled={busyAction !== null}
            title={`Reactivate ${normalized.name}`}
            className={`inline-flex items-center gap-1 rounded-lg font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer ${
              compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
            }`}
          >
            <UserCheck className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>{busyAction === 'REACTIVATE' ? 'Restoring...' : 'Reactivate'}</span>
          </button>
        )}

        {/* TERMINATE */}
        {normalized.employmentStatus !== 'TERMINATED' && (
          <button
            type="button"
            onClick={handleQuickTerminate}
            disabled={busyAction !== null}
            title={`Terminate ${normalized.name} (revoke access permanently)`}
            className={`inline-flex items-center gap-1 rounded-lg font-bold bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 transition-all cursor-pointer ${
              compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
            }`}
          >
            <Ban className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>Terminate</span>
          </button>
        )}

        {/* INSTANT DELETE */}
        <button
          type="button"
          onClick={handleInstantDelete}
          disabled={busyAction !== null}
          title={`Instant Delete ${normalized.name} from all databases`}
          className={`inline-flex items-center gap-1 rounded-lg font-bold bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 transition-all cursor-pointer ${
            compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
          }`}
        >
          <Trash2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>{busyAction === 'DELETE' ? 'Deleting...' : 'Instant Delete'}</span>
        </button>
      </div>

      {modalMode && (
        <StaffLifecycleModal
          staff={normalized}
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onSuccess={msg => {
            setModalMode(null);
            onActionComplete?.(msg);
          }}
        />
      )}
    </>
  );
};

interface StaffLifecycleModalProps {
  staff: UnifiedStaffTarget;
  initialMode: 'EDIT' | 'SUSPEND' | 'TERMINATE';
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const StaffLifecycleModal: React.FC<StaffLifecycleModalProps> = ({
  staff,
  initialMode,
  onClose,
  onSuccess
}) => {
  const {
    branches,
    updateEmployee,
    updateAffiliate,
    suspendStaffMember,
    terminateStaffMember,
    reactivateStaffMember,
    deleteStaffFromIndependentDb
  } = useErp();

  const [mode, setMode] = useState<'EDIT' | 'SUSPEND' | 'TERMINATE'>(initialMode);
  const [name, setName] = useState(staff.name);
  const [codeOrNumber, setCodeOrNumber] = useState(staff.codeOrNumber);
  const [roleTitle, setRoleTitle] = useState(staff.roleTitle);
  const [department, setDepartment] = useState<DepartmentType>(staff.department);
  const [branchId, setBranchId] = useState(staff.branchId || branches[0]?.id || 'branch-1');
  const [phone, setPhone] = useState(staff.phone || staff.mpesaNumber || '');
  const [loginPin, setLoginPin] = useState(staff.loginPin || '');
  const [basicSalaryKes, setBasicSalaryKes] = useState(String(staff.basicSalaryKes ?? 45000));
  const [commissionRatePercent, setCommissionRatePercent] = useState(
    String(staff.commissionRatePercent ?? (staff.recordType === 'AFFILIATE' ? 5 : 3))
  );
  const [kraPin, setKraPin] = useState(staff.kraPin || '');
  const [bankName, setBankName] = useState(staff.bankName || '');
  const [bankAccount, setBankAccount] = useState(staff.bankAccount || '');
  const [reason, setReason] = useState(
    initialMode === 'SUSPEND'
      ? staff.suspensionReason || 'Administrative review / temporary disciplinary suspension'
      : staff.terminationReason || 'Contract ended / employment terminated by management'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const generateRandomPin = () => {
    const randomSix = String(Math.floor(100000 + Math.random() * 900000));
    setLoginPin(randomSix);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Staff full name is required.');
      return;
    }
    const cleanPin = loginPin.replace(/\D/g, '');
    if (cleanPin && cleanPin.length !== 6) {
      setErrorMsg('Staff Login PIN must be exactly 6 digits.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (staff.recordType === 'EMPLOYEE') {
        const ok = await updateEmployee(staff.id, {
          name: name.trim(),
          employeeNumber: codeOrNumber.trim() || staff.codeOrNumber,
          roleTitle: roleTitle.trim() || staff.roleTitle,
          department,
          branchId,
          mPesaNumber: phone.trim(),
          loginPin: cleanPin || staff.loginPin,
          basicSalaryKes: Math.max(0, Number(basicSalaryKes) || 0),
          commissionRatePercent: Math.max(0, Math.min(100, Number(commissionRatePercent) || 0)),
          kraPin: kraPin.trim() || staff.kraPin,
          bankName: bankName.trim() || staff.bankName,
          bankAccount: bankAccount.trim() || staff.bankAccount
        });
        if (!ok) {
          setErrorMsg('Unable to update staff record. Please try again.');
          return;
        }
      } else {
        const pct = Math.max(0, Math.min(100, Number(commissionRatePercent) || 5));
        const ok = await updateAffiliate(staff.id, {
          name: name.trim(),
          code: codeOrNumber.trim() || staff.codeOrNumber,
          branchId,
          phone: phone.trim(),
          mpesaNumber: phone.trim(),
          loginPin: cleanPin || staff.loginPin,
          commissionRatePercent: pct
        });
        if (!ok) {
          setErrorMsg('Unable to update sales representative record. Please try again.');
          return;
        }
      }
      onSuccess?.(`Updated staff profile for ${name.trim()}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSuspend = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await suspendStaffMember(staff.id, reason.trim());
      if (!ok) {
        setErrorMsg('Failed to suspend staff member.');
        return;
      }
      onSuccess?.(`Suspended ${staff.name}. PIN login access is now blocked.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTerminate = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await terminateStaffMember(staff.id, reason.trim());
      if (!ok) {
        setErrorMsg('Failed to terminate staff member.');
        return;
      }
      onSuccess?.(`Terminated ${staff.name}. All system credentials have been revoked.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await reactivateStaffMember(staff.id);
      if (!ok) {
        setErrorMsg('Failed to reactivate staff member.');
        return;
      }
      onSuccess?.(`Reactivated ${staff.name}. Active status restored.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstantDelete = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteStaffFromIndependentDb(staff.id);
      onSuccess?.(`Instantly deleted ${staff.name} (${staff.codeOrNumber}) from all databases.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
              {staff.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{staff.name}</h3>
                <StaffStatusBadge
                  status={staff.employmentStatus}
                  active={staff.active}
                  compact
                />
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {staff.codeOrNumber} • {staff.roleTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('EDIT')}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              mode === 'EDIT'
                ? 'border-blue-400 text-blue-300 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Details
          </button>
          <button
            type="button"
            onClick={() => setMode('SUSPEND')}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              mode === 'SUSPEND'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5" />
            Suspend / Restore
          </button>
          <button
            type="button"
            onClick={() => setMode('TERMINATE')}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              mode === 'TERMINATE'
                ? 'border-red-400 text-red-300 bg-red-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            Terminate / Delete
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* EDIT MODE */}
        {mode === 'EDIT' && (
          <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {staff.recordType === 'EMPLOYEE' ? 'Employee Number' : 'Sales Rep Code'}
                </label>
                <input
                  type="text"
                  value={codeOrNumber}
                  onChange={e => setCodeOrNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Assigned Branch / Shop
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <select
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.location})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {staff.recordType === 'EMPLOYEE' ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value as DepartmentType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    <option value="POS">POS Counter Cashier</option>
                    <option value="SALES_MANAGER">Branch Sales Manager</option>
                    <option value="BRANCH_MANAGER">Branch / Merchant Manager</option>
                    <option value="INVENTORY">Inventory Control</option>
                    <option value="DELIVERY_MANAGER">Delivery & Dispatch Manager</option>
                    <option value="HR_PAYROLL">HR & Payroll</option>
                    <option value="FINANCE">Finance & Accounting</option>
                    <option value="PROCUREMENT">Procurement</option>
                    <option value="BILLING">Billing & Invoicing</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={commissionRatePercent}
                    onChange={e => setCommissionRatePercent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
              )}

              {staff.recordType === 'EMPLOYEE' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Job Title / Role
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={e => setRoleTitle(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {department === 'POS' ? (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        POS Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={commissionRatePercent}
                        onChange={e => setCommissionRatePercent(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Monthly Base Salary (KES)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={basicSalaryKes}
                        onChange={e => setBasicSalaryKes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Phone / M-Pesa Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="2547XXXXXXXX"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  6-Digit Staff Login PIN
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      maxLength={6}
                      value={loginPin}
                      onChange={e => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit PIN"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-sm font-mono tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    title="Generate new 6-digit PIN"
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    New PIN
                  </button>
                </div>
              </div>

              {staff.recordType === 'EMPLOYEE' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      KRA PIN
                    </label>
                    <input
                      type="text"
                      value={kraPin}
                      onChange={e => setKraPin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Bank Name &amp; Account
                    </label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={e => setBankAccount(e.target.value)}
                      placeholder="Bank Account Number"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Saving to Central DB...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* SUSPEND / RESTORE MODE */}
        {mode === 'SUSPEND' && (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <PauseCircle className="w-4 h-4" />
                <span>Suspend Staff Account</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Suspending <strong>{staff.name}</strong> immediately blocks their 6-digit PIN login across all POS terminals and browsers while preserving their historical sales, commissions, and payroll records.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Suspension Reason / Audit Note
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason for suspension..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              {staff.employmentStatus !== 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={handleReactivate}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Reactivate Account Now
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Account is currently ACTIVE</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSuspend}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <PauseCircle className="w-4 h-4" />
                  {isSubmitting ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TERMINATE / INSTANT DELETE MODE */}
        {mode === 'TERMINATE' && (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-orange-300 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>Terminate Employment</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Terminating <strong>{staff.name}</strong> permanently revokes their PIN credentials, removes them from active shift scheduling, and marks their HR record as <strong>TERMINATED</strong> for audit &amp; KRA payroll history.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Termination Reason / Exit Note
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter termination reason..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-orange-400 focus:outline-none"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirmTerminate}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  {isSubmitting ? 'Terminating...' : 'Terminate Staff Member'}
                </button>
              </div>
            </div>

            {/* Instant Permanent Purge Section */}
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Instant Permanent Delete
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Completely erase {staff.name} from the Central Firestore Database, Server PIN Registry, and all connected browsers immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={handleInstantDelete}
                disabled={isSubmitting}
                className="shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-red-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {isSubmitting ? 'Deleting...' : 'Instant Delete Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
