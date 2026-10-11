import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { DepartmentType } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Users, 
  Calculator, 
  CheckCircle2, 
  DollarSign, 
  Send, 
  FileCheck, 
  ShieldCheck, 
  Building2, 
  Plus, 
  Calendar,
  AlertCircle,
  UserPlus,
  KeyRound,
  Clock,
  XCircle,
  Menu,
  X
} from 'lucide-react';
import { OnboardingCenterModal, OnboardingTabType } from '../common/OnboardingCenterModal';
import { LeaveAndOffDutyModal } from '../common/LeaveAndOffDutyModal';
import { StaffActionButtons, StaffStatusBadge } from '../common/StaffLifecycleActionsModal';

export const PayrollManager: React.FC = () => {
  const { 
    employees, 
    addEmployee,
    updateEmployeePin,
    updateEmployeeCommissionRate,
    payoutEmployeeCommission,
    affiliates,
    registerAffiliate,
    updateAffiliatePin,
    updateAffiliateCommissionRate,
    payoutAffiliateCommission,
    branches,
    payrollRecords, 
    runPayrollForMonth, 
    syncPayrollRecordToLedger,
    currentRole,
    activeBranch,
    employeeLeaveRequests,
    reviewEmployeeLeaveRequest
  } = useErp();

  const isBranchScopedHr = currentRole !== 'SUPER_ADMIN';
  const scopedEmployees = React.useMemo(
    () =>
      isBranchScopedHr
        ? employees.filter(e => !e.branchId || e.branchId === activeBranch.id)
        : employees,
    [employees, isBranchScopedHr, activeBranch.id]
  );

  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [onboardingTab, setOnboardingTab] = useState<OnboardingTabType | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'ALL' | 'PENDING_HR' | 'APPROVED' | 'REJECTED'>('ALL');
  const [hrLeaveNotesMap, setHrLeaveNotesMap] = useState<Record<string, string>>({});
  const [editingPinEmpId, setEditingPinEmpId] = useState<string | null>(null);
  const [editingPinValue, setEditingPinValue] = useState<string>('');

  // HR Staff User & 6-Digit Login PIN Creation State
  const [showHrCreateForm, setShowHrCreateForm] = useState<boolean>(false);
  const [hrEmpName, setHrEmpName] = useState('');
  const [hrEmpDept, setHrEmpDept] = useState<DepartmentType>(currentRole === 'SUPER_ADMIN' ? 'POS' : 'BRANCH_MANAGER');
  const [hrEmpTitle, setHrEmpTitle] = useState(currentRole === 'SUPER_ADMIN' ? 'Counter Cashier (Casual • Commission)' : 'Branch Operations Manager');
  const [hrEmpBranchId, setHrEmpBranchId] = useState(branches[1]?.id || branches[0]?.id || 'branch-ls-01');
  const [hrEmpPin, setHrEmpPin] = useState('');
  const [hrEmpSalary, setHrEmpSalary] = useState<number>(45000);
  const [hrCommissionRate, setHrCommissionRate] = useState<number>(3);
  const [hrPinError, setHrPinError] = useState<string | null>(null);

  const isHrDeptCasual = hrEmpDept === 'POS' || hrEmpDept === 'AFFILIATES';

  const salariedEmployees = scopedEmployees.filter(
    emp =>
      emp.department !== 'POS' &&
      emp.department !== 'AFFILIATES' &&
      emp.employmentType !== 'CASUAL' &&
      emp.basicSalaryKes > 0
  );
  const casualPosCashiers = scopedEmployees.filter(
    emp => emp.department === 'POS' || emp.employmentType === 'CASUAL'
  );

  const handleHrCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setHrPinError(null);
    if (!hrEmpName.trim()) {
      setHrPinError('Please enter the staff member or Sales Representative full name.');
      return;
    }
    const cleanPin = hrEmpPin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setHrPinError('HR must assign a 6-digit numeric Login Security PIN for login.');
      return;
    }

    try {
      if (hrEmpDept === 'AFFILIATES') {
        const slug = hrEmpName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const createdAff = await registerAffiliate({
          name: hrEmpName.trim(),
          code: `SR-${hrEmpName.trim().split(' ')[0].toUpperCase()}-${(affiliates.length + 1).toString().padStart(2, '0')}`,
          phone: '254722000000',
          branchId: hrEmpBranchId,
          employmentType: 'CASUAL',
          compensationModel: 'COMMISSION_ONLY',
          commissionRatePercent: hrCommissionRate || 5,
          customSlug: slug || `rep-${affiliates.length + 1}`,
          loginPin: cleanPin,
          mpesaNumber: '254722000000',
          active: true
        });
        setSyncFeedback(
          `HR onboarded Casual Employee — Sales Representative "${createdAff.name}" (${createdAff.code} • Works on ${createdAff.commissionRatePercent}% Commission + 100% Markup, Not on Salary) with 6-Digit Login PIN: ${cleanPin}`
        );
      } else {
        const isCasualPos = hrEmpDept === 'POS';
        const created = await addEmployee({
          name: hrEmpName.trim(),
          employeeNumber: `EMP-${(employees.length + 101).toString()}`,
          roleTitle: isCasualPos ? 'POS Cashier (Casual • Commission)' : (hrEmpTitle.trim() || 'Operations Staff'),
          department: hrEmpDept,
          employmentType: isCasualPos ? 'CASUAL' : 'SALARIED',
          compensationModel: isCasualPos ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY',
          commissionRatePercent: isCasualPos ? (hrCommissionRate || 3) : 0,
          branchId: hrEmpBranchId,
          loginPin: cleanPin,
          basicSalaryKes: isCasualPos ? 0 : hrEmpSalary,
          houseAllowanceKes: isCasualPos ? 0 : 10000,
          transportAllowanceKes: isCasualPos ? 0 : 5000,
          kraPin: 'A009182736Z',
          nssfNumber: `NSSF-${Date.now().toString().slice(-5)}`,
          nhifShifNumber: `SHIF-${Date.now().toString().slice(-5)}`,
          bankName: 'Equity Bank Kenya',
          bankAccount: '018029384710',
          mPesaNumber: '254722000000',
          active: true
        });

        setSyncFeedback(
          isCasualPos
            ? `HR onboarded Casual Employee — POS Cashier "${created.name}" (Works on ${created.commissionRatePercent}% Commission • Not on Monthly Salary) with 6-Digit Login PIN: ${cleanPin}`
            : `HR onboarded Salaried Employee "${created.name}" (${created.department}) with 6-Digit Login PIN: ${cleanPin}`
        );
      }

      setTimeout(() => setSyncFeedback(null), 5000);
      setHrEmpName('');
      setHrEmpPin('');
      setShowHrCreateForm(false);
    } catch (err) {
      setHrPinError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const scopedEmpIds = new Set(scopedEmployees.map(e => e.id));
  const monthRecords = payrollRecords.filter(
    r => r.monthYear === selectedMonth && (!isBranchScopedHr || scopedEmpIds.has(r.employeeId))
  );

  const totalGross = monthRecords.reduce((acc, r) => acc + r.grossSalaryKes, 0);
  const totalPaye = monthRecords.reduce((acc, r) => acc + r.payeKes, 0);
  const totalNssf = monthRecords.reduce((acc, r) => acc + r.nssfKes, 0);
  const totalShif = monthRecords.reduce((acc, r) => acc + r.shifKes, 0);
  const totalHousing = monthRecords.reduce((acc, r) => acc + r.housingLevyKes, 0);
  const totalNet = monthRecords.reduce((acc, r) => acc + r.netSalaryKes, 0);

  const handleGeneratePayroll = () => {
    runPayrollForMonth(selectedMonth);
    setSyncFeedback(
      salariedEmployees.length > 0
        ? `Payroll computed for ${salariedEmployees.length} salaried employee(s) for ${selectedMonth}. Casual staff (${casualPosCashiers.length} POS Cashier(s) & ${affiliates.length} Sales Representative(s)) work on commission and are not on monthly salary.`
        : `No salaried employees on monthly payroll yet (${casualPosCashiers.length} POS Cashier(s) & ${affiliates.length} Sales Representative(s) are Casual Employees who work on commission, not monthly salary).`
    );
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const handleSyncToLedger = (payrollId: string, empName: string) => {
    const success = syncPayrollRecordToLedger(payrollId);
    if (success) {
      setSyncFeedback(`Statutory deductions & salaries for ${empName} successfully synced into General Ledger.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleSyncAllToLedger = () => {
    let count = 0;
    for (const record of monthRecords) {
      if (record.paymentStatus !== 'SYNCED_TO_LEDGER') {
        syncPayrollRecordToLedger(record.id);
        count++;
      }
    }
    setSyncFeedback(`Synced ${count} employee payroll records directly to double-entry general ledger.`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  return (
    <div className="space-y-5">
      
      {/* Header & Month Selector */}
      <div className="bg-[#FFDE00] rounded-2xl border-2 border-[#0A006E]/15 p-4 sm:p-6 lg:p-8 shadow-md flex flex-col justify-between gap-4 sm:gap-5 hover-card-lift">
        {/* Text Above + Mobile Hamburger Trigger */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-md shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-[#0A006E] tracking-tight leading-tight">
                Kenyan HR &amp; Statutory Payroll (SHIF 2.75%)
              </h2>
              <p className="text-xs sm:text-sm text-[#0A006E]/80 mt-0.5 sm:mt-1 font-semibold">
                Automated statutory tax deduction calculator &amp; direct double-entry ledger integration. Zero manual spreadsheet calculations.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle HR Payroll Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Menu Below — Collapsed Inside Hamburger on Mobile, Visible on Desktop */}
        <div
          className={`${
            isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
          } pt-3.5 sm:pt-4 border-t border-[#0A006E]/15 flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in`}
        >
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-white border border-[#0A006E]/15 rounded-xl px-3.5 py-2.5 text-xs shadow-2xs">
            <span className="flex items-center gap-1.5 text-slate-500 font-bold">
              <Calendar className="w-4 h-4 text-[#0A006E]" />
              <span>Period:</span>
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setIsHeroMenuOpen(false);
              }}
              className="bg-transparent font-montserrat font-black text-[#0A006E] focus:outline-none cursor-pointer"
            >
              <option value="September 2026">September 2026</option>
              <option value="October 2026">October 2026</option>
              <option value="August 2026">August 2026</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsLeaveModalOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black transition shadow-sm flex items-center justify-between sm:justify-center gap-2 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span>Employee Leave Requests</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-mono text-[10px] font-black shrink-0">
                {employeeLeaveRequests.filter(r => r.status === 'PENDING_HR').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOnboardingTab('STAFF');
                setIsHeroMenuOpen(false);
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#0A006E] shrink-0" />
              <span>Onboard New Staff</span>
            </button>

            <button
              onClick={() => {
                handleGeneratePayroll();
                setIsHeroMenuOpen(false);
              }}
              className="px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-white rounded-xl text-xs font-montserrat font-bold transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-[#FFDE00]" />
              <span>Run {selectedMonth} Payroll</span>
            </button>
          </div>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Employee Leave Requests — HR Approval Queue & Leave Register */}
      <div className="bg-white rounded-2xl border-2 border-[#0A006E]/15 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-montserrat font-black text-sm sm:text-base text-[#0A006E] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A006E]" />
                <span>Employee Leave Requests — HR Approval Queue ({employeeLeaveRequests.length})</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-montserrat font-black text-[10px]">
                {employeeLeaveRequests.filter(r => r.status === 'PENDING_HR').length} Awaiting HR Approval
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[10px]">
                {employeeLeaveRequests.filter(r => r.status === 'APPROVED').length} Approved
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Employees across all branches and departments submit leave requests to HR. Approve or reject pending leave requests below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'PENDING_HR', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setLeaveStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-montserrat font-black text-[11px] border transition cursor-pointer ${
                  leaveStatusFilter === st
                    ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL'
                  ? `All (${employeeLeaveRequests.length})`
                  : st === 'PENDING_HR'
                  ? `Pending HR (${employeeLeaveRequests.filter(r => r.status === 'PENDING_HR').length})`
                  : st === 'APPROVED'
                  ? `Approved (${employeeLeaveRequests.filter(r => r.status === 'APPROVED').length})`
                  : `Rejected (${employeeLeaveRequests.filter(r => r.status === 'REJECTED').length})`}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Submit / Manage Leave</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {employeeLeaveRequests
            .filter(r => (leaveStatusFilter === 'ALL' ? true : r.status === leaveStatusFilter))
            .map(req => {
              const leaveLabel =
                req.leaveType === 'ANNUAL_LEAVE'
                  ? 'Annual Leave'
                  : req.leaveType === 'SICK_LEAVE'
                  ? 'Sick / Medical Leave'
                  : req.leaveType === 'MATERNITY_PATERNITY'
                  ? 'Maternity / Paternity'
                  : req.leaveType === 'COMPASSIONATE_LEAVE'
                  ? 'Compassionate Leave'
                  : 'Emergency Leave';

              return (
                <div
                  key={req.id}
                  className="p-4 hover:bg-slate-50/80 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs text-[#0A006E] bg-[#0A006E]/10 px-2 py-0.5 rounded">
                        {req.requestNumber}
                      </span>
                      <span className="font-montserrat font-black text-sm text-slate-900">
                        {req.employeeName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        ({req.employeeNumber} • {req.department} • {req.branchName})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#0A006E] border border-indigo-200 font-montserrat font-bold text-[10px]">
                        {leaveLabel}
                      </span>
                      {req.status === 'PENDING_HR' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-montserrat font-black text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>PENDING HR APPROVAL</span>
                        </span>
                      )}
                      {req.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E9E60] border border-emerald-300 font-montserrat font-black text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>APPROVED BY HR</span>
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-montserrat font-black text-[10px]">
                          <XCircle className="w-3 h-3" />
                          <span>DECLINED BY HR</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Reason:</span> {req.reason}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                      <span>
                        Dates: <strong className="font-mono text-slate-800">{req.startDate}</strong> to{' '}
                        <strong className="font-mono text-slate-800">{req.endDate}</strong> (
                        <strong className="text-[#0A006E]">{req.daysCount} day{req.daysCount === 1 ? '' : 's'}</strong>)
                      </span>
                      {req.handoverPersonName && (
                        <span>
                          Relief / Handover: <strong className="text-slate-800">{req.handoverPersonName}</strong>
                        </span>
                      )}
                      <span>
                        Requested: <strong className="font-mono">{new Date(req.requestedAt).toLocaleString()}</strong>
                      </span>
                    </div>

                    {req.hrReviewNotes && (
                      <div className="text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <strong className="text-slate-800">HR Review Note ({req.reviewedBy || 'HR'}):</strong>{' '}
                        {req.hrReviewNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <input
                      type="text"
                      value={hrLeaveNotesMap[req.id] || ''}
                      onChange={(e) =>
                        setHrLeaveNotesMap(prev => ({
                          ...prev,
                          [req.id]: e.target.value
                        }))
                      }
                      placeholder="HR review note (optional)..."
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A006E] w-full sm:w-48"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        reviewEmployeeLeaveRequest(
                          req.id,
                          'APPROVED',
                          hrLeaveNotesMap[req.id] || 'Approved by HR Department'
                        );
                        setSyncFeedback(
                          `HR approved Leave Request ${req.requestNumber} for ${req.employeeName} (${req.daysCount} days: ${req.startDate} to ${req.endDate}).`
                        );
                      }}
                      disabled={req.status === 'APPROVED'}
                      className={`px-3.5 py-2 rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 opacity-60 cursor-not-allowed'
                          : 'bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] shadow-2xs'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Leave</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        reviewEmployeeLeaveRequest(
                          req.id,
                          'REJECTED',
                          hrLeaveNotesMap[req.id] || 'Declined by HR Department'
                        );
                        setSyncFeedback(
                          `HR declined Leave Request ${req.requestNumber} for ${req.employeeName}.`
                        );
                      }}
                      disabled={req.status === 'REJECTED'}
                      className={`px-3 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center justify-center gap-1 border transition cursor-pointer ${
                        req.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700 border-red-200 opacity-60 cursor-not-allowed'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Staff Roster & 6-Digit Login PIN Directory */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-black text-sm text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#0A006E]" />
              <span>
                HR Staff Roster, Casual Employees &amp; 6-Digit Login PINs ({employees.length + affiliates.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              <strong>Counter Cashiers</strong> are created by the <strong>Branch Manager</strong> or <strong>Admin</strong>, and <strong>Sales Representatives</strong> are created by the <strong>Sales Manager</strong> (both work on commission as Casual Employees, not on monthly salary). Salaried department staff are processed on the monthly statutory payroll.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHrCreateForm(prev => !prev)}
              className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 shadow-2xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showHrCreateForm ? 'Close Quick Form' : '+ HR Create Staff & 6-Digit PIN'}</span>
            </button>
            <button
              type="button"
              onClick={() => setOnboardingTab('STAFF')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold shrink-0"
            >
              Full HR Form
            </button>
          </div>
        </div>

        {/* Inline HR Staff User & 6-Digit Login PIN Creation Form */}
        {showHrCreateForm && (
          <form
            onSubmit={handleHrCreateStaff}
            className="p-4 bg-slate-50 border-b border-slate-200 space-y-3"
          >
            {hrPinError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {hrPinError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Staff Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={hrEmpName}
                  onChange={(e) => setHrEmpName(e.target.value)}
                  placeholder="e.g. Brian Omondi"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Department / Role *
                </label>
                <select
                  value={hrEmpDept}
                  onChange={(e) => {
                    const nextDept = e.target.value as DepartmentType;
                    setHrEmpDept(nextDept);
                    if (nextDept === 'POS') {
                      setHrEmpTitle('Counter Cashier (Casual • Commission)');
                      setHrCommissionRate(3);
                    } else if (nextDept === 'BRANCH_MANAGER') {
                      setHrEmpTitle('Branch Operations Manager');
                    } else if (nextDept === 'DELIVERY_MANAGER') {
                      setHrEmpTitle('Branch Delivery Manager');
                    } else if (nextDept === 'SALES_MANAGER') {
                      setHrEmpTitle('Branch Sales & Affiliates Manager');
                    } else {
                      setHrEmpTitle('Department Operations Staff');
                    }
                  }}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  {currentRole === 'SUPER_ADMIN' && (
                    <option value="POS">Counter Cashier (Admin / Branch Mgr Created • Casual)</option>
                  )}
                  <option value="BRANCH_MANAGER">Branch Manager (Salaried)</option>
                  <option value="DELIVERY_MANAGER">Delivery Manager (Salaried)</option>
                  <option value="SALES_MANAGER">Sales Manager (Salaried)</option>
                  <option value="INVENTORY">Inventory (Salaried)</option>
                  <option value="PROCUREMENT">Procurement (Salaried)</option>
                  <option value="BILLING">Billing &amp; 16% VAT (Salaried)</option>
                  <option value="HR_PAYROLL">HR &amp; Payroll (Salaried)</option>
                  <option value="FINANCE">Finance (Salaried)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Assigned Branch *
                </label>
                <select
                  value={hrEmpBranchId}
                  onChange={(e) => setHrEmpBranchId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-montserrat font-black text-[#0A006E]">
                    HR 6-Digit Login PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                      setHrEmpPin(randomPin);
                      setHrPinError(null);
                    }}
                    className="text-[10px] font-montserrat font-black text-[#1E9E60] hover:underline"
                  >
                    Generate PIN
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={hrEmpPin}
                  onChange={(e) => setHrEmpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digits (e.g. 482910)"
                  className="w-full px-3 py-2 bg-[#FFDE00]/20 border-2 border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E] tracking-widest"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full h-[36px] bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create &amp; Issue PIN</span>
                </button>
              </div>
            </div>

            {/* Employment Classification Notice inside HR Quick Create */}
            {isHrDeptCasual ? (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                    Casual • Commission Only
                  </span>
                  <span>
                    {hrEmpDept === 'AFFILIATES'
                      ? 'Sales Representative is a Casual Employee who works on commission (100% custom markup + base sales commission % — Not on Monthly Salary).'
                      : 'POS Cashier is a Casual Employee who works on sales commission (Not on Monthly Salary).'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-[11px] font-bold text-amber-950">
                    Sales Commission Rate (%):
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={hrCommissionRate}
                    onChange={(e) => setHrCommissionRate(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-white border border-amber-400 rounded-lg text-xs font-mono font-black text-[#0A006E] text-center"
                  />
                  <span className="font-mono font-black text-[11px] text-amber-950 bg-white px-2 py-1 rounded border border-amber-300">
                    Monthly Salary: KES 0
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="px-2 py-0.5 rounded bg-[#34D186] text-white font-montserrat font-black text-[10px] uppercase">
                    Salaried Staff
                  </span>
                  <span>Included in Monthly Statutory Payroll Register (PAYE, NSSF, SHIF 2.75%, Housing Levy).</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-700">Basic Salary (KES):</label>
                  <input
                    type="number"
                    value={hrEmpSalary}
                    onChange={(e) => setHrEmpSalary(parseInt(e.target.value) || 0)}
                    className="w-28 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            )}
          </form>
        )}

        {/* HR Employment Classification Summary Bar */}
        <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-montserrat font-black">
              Casual Employees (Work on Commission • No Salary): {casualPosCashiers.length + affiliates.length}
            </span>
            <span className="text-slate-600 font-medium">
              • POS Cashiers ({casualPosCashiers.length}) &amp; Sales Representatives ({affiliates.length}) earn sales commissions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#1E9E60] font-montserrat font-black">
              Salaried Staff on Monthly Payroll: {salariedEmployees.length}
            </span>
          </div>
        </div>

        {employees.length === 0 && affiliates.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No staff users or Sales Representatives onboarded yet. Click <strong>+ HR Create Staff &amp; 6-Digit PIN</strong> to onboard staff or Sales Representatives and assign their 6-digit login PIN.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => {
              const isCasualEmp =
                emp.department === 'POS' ||
                emp.department === 'AFFILIATES' ||
                emp.employmentType === 'CASUAL';
              return (
              <div
                key={emp.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 text-xs ${
                  isCasualEmp
                    ? 'bg-amber-50/40 border-amber-200/90'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-montserrat font-black text-slate-900 truncate">{emp.name}</span>
                      <StaffStatusBadge
                        status={emp.employmentStatus}
                        active={emp.active}
                        reason={emp.suspensionReason || emp.terminationReason}
                        compact
                      />
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {emp.employeeNumber} • {emp.department === 'POS' ? 'POS CASHIER' : emp.department}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-600 mt-0.5">
                      {isCasualEmp
                        ? `Casual Employee • Works on Commission (${emp.commissionRatePercent ?? 3}% POS Sales) • Not on Salary`
                        : `Salaried Staff • ${emp.roleTitle}`}
                    </div>
                  </div>
                  {isCasualEmp ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-montserrat font-black text-[10px] shrink-0">
                      Casual • {emp.commissionRatePercent ?? 3}% Comm.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] shrink-0">
                      {formatKes(emp.basicSalaryKes)}
                    </span>
                  )}
                </div>

                {isCasualEmp && (
                  <div className="p-2 rounded-lg bg-white/90 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold">Earned:</span>
                      <span className="font-mono font-black text-emerald-800">
                        {formatKes(emp.totalCommissionEarnedKes || 0)}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 font-semibold">Pending:</span>
                      <span className="font-mono font-black text-amber-800">
                        {formatKes(emp.pendingCommissionKes || 0)}
                      </span>
                    </div>
                    {(emp.pendingCommissionKes || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const pendingAmt = emp.pendingCommissionKes || 0;
                          if (payoutEmployeeCommission(emp.id)) {
                            setSyncFeedback(
                              `Disbursed ${formatKes(pendingAmt)} commission via M-Pesa B2C to Casual POS Cashier ${emp.name}.`
                            );
                            setTimeout(() => setSyncFeedback(null), 4500);
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[10px] transition"
                      >
                        Pay Commission
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Login PIN:</span>
                    <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[11px] tracking-widest">
                      {emp.loginPin || '------'}
                    </span>
                  </div>

                  {editingPinEmpId === emp.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={editingPinValue}
                        onChange={(e) => setEditingPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 digits"
                        className="w-20 px-2 py-1 bg-white border border-[#0A006E] rounded-lg font-mono font-bold text-[11px] text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingPinValue.length === 6) {
                            updateEmployeePin(emp.id, editingPinValue);
                            setEditingPinEmpId(null);
                            setSyncFeedback(`Updated 6-Digit Login PIN for ${emp.name} to ${editingPinValue}.`);
                            setTimeout(() => setSyncFeedback(null), 4000);
                          }
                        }}
                        disabled={editingPinValue.length !== 6}
                        className="px-2 py-1 rounded-lg bg-[#34D186] text-white font-bold text-[10px] disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPinEmpId(null)}
                        className="px-1 py-1 text-slate-400 hover:text-slate-700 font-bold text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPinEmpId(emp.id);
                        setEditingPinValue(emp.loginPin || '');
                      }}
                      className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                    >
                      Edit PIN
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <StaffActionButtons
                    staff={emp}
                    compact
                    onActionComplete={msg => {
                      setSyncFeedback(msg);
                      setTimeout(() => setSyncFeedback(null), 4500);
                    }}
                  />
                </div>
              </div>
              );
            })}

            {affiliates.map(aff => (
              <div key={aff.id} className="p-3.5 rounded-xl bg-amber-50/50 border border-[#0A006E]/20 flex flex-col justify-between gap-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-montserrat font-black text-slate-900 truncate">{aff.name}</span>
                      <StaffStatusBadge
                        status={aff.employmentStatus}
                        active={aff.active}
                        reason={aff.suspensionReason || aff.terminationReason}
                        compact
                      />
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {aff.code} • SALES REPRESENTATIVE (/ref/{aff.customSlug})
                    </div>
                    <div className="text-[10px] font-semibold text-slate-600 mt-0.5">
                      Casual Employee • Works on Commission ({aff.commissionRatePercent ?? 5}% + 100% Markup) • Not on Salary
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] shrink-0">
                    Casual • Commission
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-white/90 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold">Earned:</span>
                    <span className="font-mono font-black text-emerald-800">
                      {formatKes(aff.totalCommissionEarnedKes || 0)}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 font-semibold">Pending:</span>
                    <span className="font-mono font-black text-amber-800">
                      {formatKes(aff.pendingCommissionKes || 0)}
                    </span>
                  </div>
                  {(aff.pendingCommissionKes || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const pendingAmt = aff.pendingCommissionKes || 0;
                        if (payoutAffiliateCommission(aff.id)) {
                          setSyncFeedback(
                            `Disbursed ${formatKes(pendingAmt)} commission via M-Pesa B2C to Casual Sales Representative ${aff.name}.`
                          );
                          setTimeout(() => setSyncFeedback(null), 4500);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[10px] transition"
                    >
                      Pay Commission
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Login PIN:</span>
                    <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-[11px] tracking-widest">
                      {aff.loginPin || '------'}
                    </span>
                  </div>

                  {editingPinEmpId === aff.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={editingPinValue}
                        onChange={(e) => setEditingPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 digits"
                        className="w-20 px-2 py-1 bg-white border border-[#0A006E] rounded-lg font-mono font-bold text-[11px] text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingPinValue.length === 6) {
                            updateAffiliatePin(aff.id, editingPinValue);
                            setEditingPinEmpId(null);
                            setSyncFeedback(`Updated 6-Digit Login PIN for Sales Representative ${aff.name} to ${editingPinValue}.`);
                            setTimeout(() => setSyncFeedback(null), 4000);
                          }
                        }}
                        disabled={editingPinValue.length !== 6}
                        className="px-2 py-1 rounded-lg bg-[#34D186] text-white font-bold text-[10px] disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPinEmpId(null)}
                        className="px-1 py-1 text-slate-400 hover:text-slate-700 font-bold text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPinEmpId(aff.id);
                        setEditingPinValue(aff.loginPin || '');
                      }}
                      className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline"
                    >
                      Edit PIN
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <StaffActionButtons
                    staff={aff}
                    compact
                    onActionComplete={msg => {
                      setSyncFeedback(msg);
                      setTimeout(() => setSyncFeedback(null), 4500);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Casual Employees Commission Register (POS Cashiers & Sales Representatives) */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-black text-sm text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#0A006E]" />
              <span>
                Casual Employees Commission Register — POS Cashiers &amp; Sales Representatives
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Both <strong>POS Cashiers</strong> and <strong>Sales Representatives</strong> are casual employees (not on monthly salary) and earn commission on every POS sale.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs shrink-0">
            {casualPosCashiers.length + affiliates.length} Commission-Based Casual Staff
          </span>
        </div>

        {casualPosCashiers.length === 0 && affiliates.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No Casual POS Cashiers or Sales Representatives onboarded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Casual Employee</th>
                  <th className="py-3 px-3">Role / Classification</th>
                  <th className="py-3 px-3">Commission Structure</th>
                  <th className="py-3 px-3">Total Sales Handled</th>
                  <th className="py-3 px-3">Commission Earned</th>
                  <th className="py-3 px-3">Pending Payout</th>
                  <th className="py-3 px-4 text-right">M-Pesa B2C Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {casualPosCashiers.map(emp => (
                  <tr key={emp.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-montserrat font-bold text-slate-900">{emp.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {emp.employeeNumber} • M-Pesa: {emp.mPesaNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-montserrat font-black text-[10px]">
                        POS Cashier • Casual (No Salary)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0.5}
                          max={50}
                          step={0.5}
                          value={emp.commissionRatePercent ?? 3}
                          onChange={(e) =>
                            updateEmployeeCommissionRate(emp.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-center text-[#0A006E]"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">% of POS Sales</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {formatKes(emp.totalSalesKes || 0)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                      {formatKes(emp.totalCommissionEarnedKes || 0)}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-amber-800">
                      {formatKes(emp.pendingCommissionKes || 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={(emp.pendingCommissionKes || 0) <= 0}
                        onClick={() => {
                          const amt = emp.pendingCommissionKes || 0;
                          if (payoutEmployeeCommission(emp.id)) {
                            setSyncFeedback(
                              `Disbursed ${formatKes(amt)} commission via Safaricom M-Pesa B2C to POS Cashier ${emp.name}.`
                            );
                            setTimeout(() => setSyncFeedback(null), 4500);
                          }
                        }}
                        className="px-3 py-1.5 bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold transition disabled:opacity-40"
                      >
                        Pay Commission
                      </button>
                    </td>
                  </tr>
                ))}

                {affiliates.map(aff => (
                  <tr key={aff.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-montserrat font-bold text-slate-900">{aff.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {aff.code} • M-Pesa: {aff.mpesaNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px]">
                        Sales Representative • Casual (No Salary)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0.5}
                          max={50}
                          step={0.5}
                          value={aff.commissionRatePercent ?? 5}
                          onChange={(e) =>
                            updateAffiliateCommissionRate(aff.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-center text-[#0A006E]"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">
                          % + 100% Markup
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {formatKes(aff.totalSalesKes || 0)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                      {formatKes(aff.totalCommissionEarnedKes || 0)}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-amber-800">
                      {formatKes(aff.pendingCommissionKes || 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={(aff.pendingCommissionKes || 0) <= 0}
                        onClick={() => {
                          const amt = aff.pendingCommissionKes || 0;
                          if (payoutAffiliateCommission(aff.id)) {
                            setSyncFeedback(
                              `Disbursed ${formatKes(amt)} commission via Safaricom M-Pesa B2C to Sales Representative ${aff.name}.`
                            );
                            setTimeout(() => setSyncFeedback(null), 4500);
                          }
                        }}
                        className="px-3 py-1.5 bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold transition disabled:opacity-40"
                      >
                        Pay Commission
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statutory Deductions KPI Grid */}
      {monthRecords.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Salary Pool</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-slate-900 mt-1 tracking-tight truncate"
              title={formatKes(totalGross)}
            >
              {formatKes(totalGross)}
            </div>
            <div className="text-[10px] text-slate-400">Total Company Payroll</div>
          </div>

          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">KRA PAYE (Relief 2,400)</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-purple-900 mt-1 tracking-tight truncate"
              title={formatKes(totalPaye)}
            >
              {formatKes(totalPaye)}
            </div>
            <div className="text-[10px] text-purple-600">Tax Deductions</div>
          </div>

          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">NSSF Tier I &amp; II</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-blue-900 mt-1 tracking-tight truncate"
              title={formatKes(totalNssf)}
            >
              {formatKes(totalNssf)}
            </div>
            <div className="text-[10px] text-blue-600">Retirement Funds</div>
          </div>

          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-[#1E9E60] uppercase tracking-wider">SHIF (2.75% New)</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-[#1E9E60] mt-1 tracking-tight truncate"
              title={formatKes(totalShif)}
            >
              {formatKes(totalShif)}
            </div>
            <div className="text-[10px] text-emerald-600">Social Health Auth</div>
          </div>

          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Housing Levy (1.5%)</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-amber-900 mt-1 tracking-tight truncate"
              title={formatKes(totalHousing)}
            >
              {formatKes(totalHousing)}
            </div>
            <div className="text-[10px] text-amber-600">Affordable Housing</div>
          </div>

          <div className="bg-white p-5 sm:p-6 min-h-[140px] sm:min-h-[160px] rounded-2xl border border-slate-200 bg-emerald-50/40 shadow-sm flex flex-col justify-between hover-card-lift">
            <span className="text-[10px] font-bold text-[#1E9E60] uppercase tracking-wider">Net Salary Disbursed</span>
            <div 
              className="font-montserrat font-black text-sm sm:text-base xl:text-lg text-[#1E9E60] mt-1 tracking-tight truncate"
              title={formatKes(totalNet)}
            >
              {formatKes(totalNet)}
            </div>
            <div className="text-[10px] text-[#1E9E60] font-bold">Via M-Pesa B2C / Bank</div>
          </div>
        </div>
      )}

      {/* Main Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-montserrat font-black text-sm text-slate-900">
              Employee Payroll Register ({selectedMonth})
            </h3>
            <p className="text-xs text-slate-500">
              Computes KRA tax relief, statutory contributions, and net bank disbursement.
            </p>
          </div>

          {monthRecords.length > 0 && (
            <button
              onClick={handleSyncAllToLedger}
              className="px-3.5 py-1.5 bg-[#34D186] hover:bg-emerald-950 text-white rounded-lg text-xs font-montserrat font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5 text-[#FFDE00]" />
              <span>Sync All to General Ledger</span>
            </button>
          )}
        </div>

        {monthRecords.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              No monthly statutory payroll processed yet for {selectedMonth}.
            </p>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              Note: <strong>POS Cashiers</strong> and <strong>Sales Representatives</strong> are classified in HR as <strong>Casual Employees</strong> who <strong>work on commission</strong> (not on monthly salary). Only salaried department staff ({salariedEmployees.length}) are included in the monthly payroll run.
            </p>
            <button
              onClick={handleGeneratePayroll}
              className="px-4 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold shadow-sm"
            >
              Calculate Salaried Payroll Now ({salariedEmployees.length} Salaried Staff)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">Gross Pay</th>
                  <th className="py-3 px-3">PAYE (Tax)</th>
                  <th className="py-3 px-3">NSSF</th>
                  <th className="py-3 px-3">SHIF (2.75%)</th>
                  <th className="py-3 px-3">Housing (1.5%)</th>
                  <th className="py-3 px-3">Net Pay (Bank)</th>
                  <th className="py-3 px-3">Ledger Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthRecords.map((record) => {
                  const emp = employees.find(e => e.id === record.employeeId);
                  const isSynced = record.paymentStatus === 'SYNCED_TO_LEDGER';

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-montserrat font-bold text-slate-900">
                          {record.employeeName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          PIN: {emp?.kraPin} • {emp?.roleTitle} ({record.department})
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {formatKes(record.grossSalaryKes)}
                      </td>

                      <td className="py-3 px-3 font-mono text-purple-900">
                        {formatKes(record.payeKes)}
                      </td>

                      <td className="py-3 px-3 font-mono text-blue-900">
                        {formatKes(record.nssfKes)}
                      </td>

                      <td className="py-3 px-3 font-mono text-emerald-900">
                        {formatKes(record.shifKes)}
                      </td>

                      <td className="py-3 px-3 font-mono text-amber-900">
                        {formatKes(record.housingLevyKes)}
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-slate-900">
                        {formatKes(record.netSalaryKes)}
                      </td>

                      <td className="py-3 px-3">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-montserrat">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SYNCED TO LEDGER</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-montserrat">
                            <span>DRAFT READY</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isSynced ? (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {record.syncedJournalEntryId}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSyncToLedger(record.id, record.employeeName)}
                            className="px-2.5 py-1 bg-[#34D186] hover:bg-emerald-950 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Sync to Ledger
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statutory Compliance Footer Notice */}
      <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex items-start space-x-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900">Kenyan Compliance Note:</span> In accordance with the Kenya Social Health Insurance Act 2023 and Tax Laws, SHIF is deducted at 2.75% of Gross Salary with a KES 300 statutory minimum floor. Personal relief of KES 2,400 is automatically deducted from monthly PAYE liability.
        </div>
      </div>

      {onboardingTab && (
        <OnboardingCenterModal
          initialTab={onboardingTab}
          onClose={() => setOnboardingTab(null)}
        />
      )}

      {isLeaveModalOpen && (
        <LeaveAndOffDutyModal
          mode="EMPLOYEE_LEAVE"
          onClose={() => setIsLeaveModalOpen(false)}
        />
      )}

    </div>
  );
};
