import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useErp } from '../../context/ErpContext';
import {
  EmployeeLeaveType,
  SalesRepOffDutyType
} from '../../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  X,
  UserCheck,
  FileText,
  Sparkles,
  Building2
} from 'lucide-react';

interface LeaveAndOffDutyModalProps {
  isOpen?: boolean;
  onClose: () => void;
  mode?: 'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY';
  initialMode?: 'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY';
  preselectedEmployeeId?: string;
  preselectedAffiliateId?: string;
}

const LEAVE_TYPE_LABELS: Record<EmployeeLeaveType, string> = {
  ANNUAL_LEAVE: 'Annual Leave',
  SICK_LEAVE: 'Sick / Medical Leave',
  MATERNITY_PATERNITY: 'Maternity / Paternity Leave',
  COMPASSIONATE_LEAVE: 'Compassionate Leave',
  EMERGENCY_LEAVE: 'Emergency Leave'
};

const OFF_DUTY_TYPE_LABELS: Record<SalesRepOffDutyType, string> = {
  SHIFT_OFF_DUTY: 'Shift Off-Duty',
  REST_DAY: 'Scheduled Rest Day',
  PERSONAL_OFF_DUTY: 'Personal Off-Duty',
  MEDICAL_OFF_DUTY: 'Medical Off-Duty'
};

export const LeaveAndOffDutyModal: React.FC<LeaveAndOffDutyModalProps> = ({
  isOpen = true,
  onClose,
  mode,
  initialMode,
  preselectedEmployeeId,
  preselectedAffiliateId
}) => {
  const {
    currentUser,
    currentRole,
    currentDepartment,
    posStationMode,
    employees,
    affiliates,
    selectedAffiliate,
    employeeLeaveRequests,
    salesRepOffDutyRequests,
    submitEmployeeLeaveRequest,
    reviewEmployeeLeaveRequest,
    submitSalesRepOffDutyRequest,
    reviewSalesRepOffDutyRequest
  } = useErp();

  const isSalesRepUser =
    currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY';
  const defaultMode: 'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY' =
    mode || initialMode || (isSalesRepUser ? 'SALES_REP_OFF_DUTY' : 'EMPLOYEE_LEAVE');

  const [activeMode, setActiveMode] = useState<'EMPLOYEE_LEAVE' | 'SALES_REP_OFF_DUTY'>(defaultMode);

  // Determine permissions
  const canApproveHrLeave =
    currentRole === 'SUPER_ADMIN' ||
    currentRole === 'ACCOUNTANT' ||
    currentDepartment === 'HR_PAYROLL';
  const canApproveSalesRepOffDuty =
    currentRole === 'SUPER_ADMIN' ||
    currentRole === 'ACCOUNTANT' ||
    currentDepartment === 'SALES_MANAGER';
  const canSwitchBetweenLeaveAndOffDuty =
    currentRole === 'SUPER_ADMIN' ||
    currentRole === 'ACCOUNTANT' ||
    currentDepartment === 'HR_PAYROLL' ||
    currentDepartment === 'SALES_MANAGER';

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Employee Leave Form State
  const matchedCurrentEmployee =
    employees.find(
      e =>
        (preselectedEmployeeId && e.id === preselectedEmployeeId) ||
        e.id === currentUser.id ||
        e.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    ) || employees[0];

  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    preselectedEmployeeId || matchedCurrentEmployee?.id || ''
  );
  const [leaveType, setLeaveType] = useState<EmployeeLeaveType>('ANNUAL_LEAVE');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(todayIso);
  const [leaveEndDate, setLeaveEndDate] = useState<string>(tomorrowIso);
  const [leaveHandover, setLeaveHandover] = useState<string>('');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Sales Rep Off-Duty Form State
  const matchedCurrentAffiliate =
    affiliates.find(
      a =>
        (preselectedAffiliateId && a.id === preselectedAffiliateId) ||
        a.id === currentUser.id ||
        a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase() ||
        (selectedAffiliate && a.id === selectedAffiliate.id)
    ) ||
    selectedAffiliate ||
    affiliates[0];

  const [selectedAffId, setSelectedAffId] = useState<string>(
    preselectedAffiliateId || matchedCurrentAffiliate?.id || ''
  );
  const [offDutyType, setOffDutyType] = useState<SalesRepOffDutyType>('REST_DAY');
  const [offDutyStartDate, setOffDutyStartDate] = useState<string>(todayIso);
  const [offDutyEndDate, setOffDutyEndDate] = useState<string>(tomorrowIso);
  const [coveringRepName, setCoveringRepName] = useState<string>('');
  const [offDutyReason, setOffDutyReason] = useState<string>('');

  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const calculateDaysBetween = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
    return Math.max(1, Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1);
  };

  const leaveDaysCount = calculateDaysBetween(leaveStartDate, leaveEndDate);
  const offDutyDaysCount = calculateDaysBetween(offDutyStartDate, offDutyEndDate);

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    const targetEmp =
      employees.find(emp => emp.id === selectedEmpId) || matchedCurrentEmployee;

    const created = submitEmployeeLeaveRequest({
      employeeId: targetEmp?.id || currentUser.id,
      employeeName: targetEmp?.name || currentUser.name,
      employeeNumber: targetEmp?.employeeNumber || 'EMP-STAFF',
      department: targetEmp?.department || currentDepartment,
      branchId: targetEmp?.branchId,
      leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      daysCount: leaveDaysCount,
      reason: leaveReason,
      handoverPersonName: leaveHandover
    });

    setLeaveReason('');
    setLeaveHandover('');
    setFeedbackBanner(
      `✓ Leave Request ${created.requestNumber} (${LEAVE_TYPE_LABELS[leaveType]} • ${created.daysCount} day(s)) submitted to HR for approval.`
    );
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  const handleOffDutySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offDutyReason.trim()) return;

    const targetAff =
      affiliates.find(aff => aff.id === selectedAffId) || matchedCurrentAffiliate;

    const created = submitSalesRepOffDutyRequest({
      affiliateId: targetAff?.id || currentUser.id,
      affiliateName: targetAff?.name || currentUser.name,
      affiliateCode: targetAff?.code || 'SR-REP',
      branchId: targetAff?.branchId,
      offDutyType,
      startDate: offDutyStartDate,
      endDate: offDutyEndDate,
      daysOrShiftsCount: offDutyDaysCount,
      reason: offDutyReason,
      coveringRepName
    });

    setOffDutyReason('');
    setCoveringRepName('');
    setFeedbackBanner(
      `✓ Off-Duty Request ${created.requestNumber} (${OFF_DUTY_TYPE_LABELS[offDutyType]} • ${created.daysOrShiftsCount} day/shift(s)) sent to Sales Manager for approval.`
    );
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // Filter visible requests
  const visibleLeaveRequests = canApproveHrLeave
    ? employeeLeaveRequests
    : employeeLeaveRequests.filter(
        r =>
          r.employeeId === currentUser.id ||
          r.employeeName.toLowerCase() === currentUser.name.trim().toLowerCase() ||
          (selectedEmpId && r.employeeId === selectedEmpId)
      );

  const visibleOffDutyRequests = canApproveSalesRepOffDuty
    ? salesRepOffDutyRequests
    : salesRepOffDutyRequests.filter(
        r =>
          r.affiliateId === currentUser.id ||
          r.affiliateName.toLowerCase() === currentUser.name.trim().toLowerCase() ||
          (selectedAffiliate && r.affiliateId === selectedAffiliate.id) ||
          (selectedAffId && r.affiliateId === selectedAffId)
      );

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-3xl max-w-4xl w-full h-dvh sm:h-auto sm:max-h-[92vh] overflow-hidden shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#FFDE00] text-[#0A006E] px-6 py-4 flex items-center justify-between border-b-4 border-[#0A006E] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-montserrat font-black italic text-base sm:text-lg text-[#0A006E]">
                {activeMode === 'EMPLOYEE_LEAVE'
                  ? 'Employee Leave Request Portal (Submitted to HR)'
                  : 'Sales Representative Off-Duty Request (Submitted to Sales Manager)'}
              </h3>
              <p className="text-xs text-[#0A006E]/80 font-semibold">
                {activeMode === 'EMPLOYEE_LEAVE'
                  ? 'Employees request official leave from HR • HR reviews & approves leave requests.'
                  : 'Sales Representatives request shift off-duty or rest days from the Branch Sales Manager.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs (if manager/admin or if switching between Employee Leave & Sales Rep Off-Duty) */}
        {canSwitchBetweenLeaveAndOffDuty && (
          <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMode('EMPLOYEE_LEAVE')}
              className={`px-4 py-2 rounded-t-xl font-montserrat font-black text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeMode === 'EMPLOYEE_LEAVE'
                  ? 'bg-white text-[#0A006E] border-[#0A006E]'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Employee Leave Requests (HR)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px]">
                {employeeLeaveRequests.filter(r => r.status === 'PENDING_HR').length} Pending
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('SALES_REP_OFF_DUTY')}
              className={`px-4 py-2 rounded-t-xl font-montserrat font-black text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeMode === 'SALES_REP_OFF_DUTY'
                  ? 'bg-white text-[#0A006E] border-[#0A006E]'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Sales Rep Off-Duty Requests (Sales Manager)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px]">
                {salesRepOffDutyRequests.filter(r => r.status === 'PENDING_SALES_MANAGER').length} Pending
              </span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {feedbackBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{feedbackBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-emerald-800 hover:text-emerald-950 font-black"
              >
                ✕
              </button>
            </div>
          )}

          {activeMode === 'EMPLOYEE_LEAVE' ? (
            <>
              {/* EMPLOYEE LEAVE REQUEST FORM -> TO HR */}
              <form
                onSubmit={handleLeaveSubmit}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-montserrat font-black text-sm text-[#0A006E] uppercase">
                      Request Leave from HR Department
                    </h4>
                    <p className="text-xs text-slate-600">
                      Submit your leave dates and handover colleague. Your request goes directly to <strong>HR &amp; Payroll</strong> for approval.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-xs">
                    Approver: HR Department
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Employee Requesting Leave *
                    </label>
                    <select
                      value={selectedEmpId}
                      onChange={e => setSelectedEmpId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeNumber} • {emp.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Leave Category *
                    </label>
                    <select
                      value={leaveType}
                      onChange={e => setLeaveType(e.target.value as EmployeeLeaveType)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      {Object.entries(LEAVE_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveStartDate}
                      onChange={e => {
                        setLeaveStartDate(e.target.value);
                        if (e.target.value > leaveEndDate) {
                          setLeaveEndDate(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      End Date ({leaveDaysCount} Day{leaveDaysCount > 1 ? 's' : ''}) *
                    </label>
                    <input
                      type="date"
                      required
                      min={leaveStartDate}
                      value={leaveEndDate}
                      onChange={e => setLeaveEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Duty Handover Staff Member (Optional)
                    </label>
                    <input
                      type="text"
                      value={leaveHandover}
                      onChange={e => setLeaveHandover(e.target.value)}
                      placeholder="Colleague covering your duties"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Reason / Notes for HR *
                    </label>
                    <input
                      type="text"
                      required
                      value={leaveReason}
                      onChange={e => setLeaveReason(e.target.value)}
                      placeholder="State reason for requesting leave from HR..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Leave Request to HR ({leaveDaysCount} Day{leaveDaysCount > 1 ? 's' : ''})</span>
                  </button>
                </div>
              </form>

              {/* EMPLOYEE LEAVE REQUESTS HISTORY & HR APPROVAL LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-montserrat font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0A006E]" />
                    <span>
                      Employee Leave Requests ({visibleLeaveRequests.length})
                    </span>
                  </h4>
                  {canApproveHrLeave && (
                    <span className="text-[11px] font-semibold text-[#1E9E60]">
                      HR Approval Mode Active — You can Approve or Decline requests below
                    </span>
                  )}
                </div>

                {visibleLeaveRequests.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    No employee leave requests recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleLeaveRequests.map(req => {
                      const isPending = req.status === 'PENDING_HR';
                      const isApproved = req.status === 'APPROVED';

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isPending
                              ? 'bg-amber-50/70 border-amber-300'
                              : isApproved
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-red-50/50 border-red-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-xs text-[#0A006E]">
                                {req.requestNumber}
                              </span>
                              <span className="font-montserrat font-black text-sm text-slate-900">
                                {req.employeeName}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                {req.employeeNumber} • {req.department}
                              </span>
                              <span className="text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00]">
                                {LEAVE_TYPE_LABELS[req.leaveType]} ({req.daysCount}d)
                              </span>
                              <span
                                className={`text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full uppercase ${
                                  isPending
                                    ? 'bg-amber-200 text-amber-950'
                                    : isApproved
                                    ? 'bg-emerald-200 text-[#1E9E60]'
                                    : 'bg-red-200 text-red-900'
                                }`}
                              >
                                {isPending
                                  ? '⏳ PENDING HR APPROVAL'
                                  : isApproved
                                  ? '✓ APPROVED BY HR'
                                  : '✕ DECLINED BY HR'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-800 font-medium">
                              <strong>Dates:</strong> {req.startDate} to {req.endDate} ({req.daysCount} day{req.daysCount > 1 ? 's' : ''})
                              {req.handoverPersonName ? ` • Handover: ${req.handoverPersonName}` : ''}
                              {' • '}
                              <span className="text-slate-600">{req.branchName}</span>
                            </div>

                            <div className="text-xs text-slate-600">
                              <strong>Reason:</strong> {req.reason}
                            </div>

                            {req.hrReviewNotes && (
                              <div className="text-[11px] font-semibold text-[#1E9E60] pt-0.5">
                                HR Decision ({req.reviewedBy}): &ldquo;{req.hrReviewNotes}&rdquo;
                              </div>
                            )}
                          </div>

                          {canApproveHrLeave && isPending && (
                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                              <input
                                type="text"
                                value={reviewNoteDrafts[req.id] || ''}
                                onChange={e =>
                                  setReviewNoteDrafts(prev => ({ ...prev, [req.id]: e.target.value }))
                                }
                                placeholder="Optional HR note..."
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] w-full sm:w-48"
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    reviewEmployeeLeaveRequest(
                                      req.id,
                                      'APPROVED',
                                      reviewNoteDrafts[req.id]
                                    );
                                    setFeedbackBanner(
                                      `✓ HR Approved leave request ${req.requestNumber} for ${req.employeeName}.`
                                    );
                                    setTimeout(() => setFeedbackBanner(null), 4000);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1 cursor-pointer"
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
                                      reviewNoteDrafts[req.id]
                                    );
                                    setFeedbackBanner(
                                      `Declined leave request ${req.requestNumber} for ${req.employeeName}.`
                                    );
                                    setTimeout(() => setFeedbackBanner(null), 4000);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-montserrat font-black text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Decline</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* SALES REPRESENTATIVE OFF-DUTY REQUEST FORM -> TO SALES MANAGER */}
              <form
                onSubmit={handleOffDutySubmit}
                className="p-5 rounded-2xl bg-amber-50/70 border border-[#0A006E]/20 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A006E]/15 pb-3">
                  <div>
                    <h4 className="font-montserrat font-black text-sm text-[#0A006E] uppercase">
                      Request Off-Duty from Branch Sales Manager
                    </h4>
                    <p className="text-xs text-slate-600">
                      Sales Representatives can request shift off-duty or rest days directly from their <strong>Sales Manager</strong>.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs">
                    Approver: Sales Manager
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sales Representative *
                    </label>
                    <select
                      value={selectedAffId}
                      onChange={e => setSelectedAffId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      {affiliates.map(aff => (
                        <option key={aff.id} value={aff.id}>
                          {aff.name} ({aff.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Off-Duty Type *
                    </label>
                    <select
                      value={offDutyType}
                      onChange={e => setOffDutyType(e.target.value as SalesRepOffDutyType)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      {Object.entries(OFF_DUTY_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Off-Duty Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={offDutyStartDate}
                      onChange={e => {
                        setOffDutyStartDate(e.target.value);
                        if (e.target.value > offDutyEndDate) {
                          setOffDutyEndDate(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      End Date ({offDutyDaysCount} Day/Shift{offDutyDaysCount > 1 ? 's' : ''}) *
                    </label>
                    <input
                      type="date"
                      required
                      min={offDutyStartDate}
                      value={offDutyEndDate}
                      onChange={e => setOffDutyEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Covering Sales Representative (Optional)
                    </label>
                    <select
                      value={coveringRepName}
                      onChange={e => setCoveringRepName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="">Select Covering Sales Rep...</option>
                      {affiliates
                        .filter(a => a.id !== selectedAffId)
                        .map(a => (
                          <option key={a.id} value={a.name}>
                            {a.name} ({a.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Reason for Off-Duty Request (To Sales Manager) *
                    </label>
                    <input
                      type="text"
                      required
                      value={offDutyReason}
                      onChange={e => setOffDutyReason(e.target.value)}
                      placeholder="State reason for requesting off-duty from Sales Manager..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Request Off-Duty from Sales Manager ({offDutyDaysCount} Shift/Day{offDutyDaysCount > 1 ? 's' : ''})</span>
                  </button>
                </div>
              </form>

              {/* SALES REPRESENTATIVE OFF-DUTY REQUESTS LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-montserrat font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0A006E]" />
                    <span>
                      Sales Representative Off-Duty Requests ({visibleOffDutyRequests.length})
                    </span>
                  </h4>
                  {canApproveSalesRepOffDuty && (
                    <span className="text-[11px] font-semibold text-[#1E9E60]">
                      Sales Manager Approval Mode Active — Approve or Decline off-duty requests below
                    </span>
                  )}
                </div>

                {visibleOffDutyRequests.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    No Sales Representative off-duty requests recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleOffDutyRequests.map(req => {
                      const isPending = req.status === 'PENDING_SALES_MANAGER';
                      const isApproved = req.status === 'APPROVED';

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isPending
                              ? 'bg-amber-50/70 border-amber-300'
                              : isApproved
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-red-50/50 border-red-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-xs text-[#0A006E]">
                                {req.requestNumber}
                              </span>
                              <span className="font-montserrat font-black text-sm text-slate-900">
                                {req.affiliateName}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-[#0A006E] font-bold">
                                {req.affiliateCode} • Sales Representative
                              </span>
                              <span className="text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00]">
                                {OFF_DUTY_TYPE_LABELS[req.offDutyType]} ({req.daysOrShiftsCount}d)
                              </span>
                              <span
                                className={`text-[10px] font-montserrat font-black px-2.5 py-0.5 rounded-full uppercase ${
                                  isPending
                                    ? 'bg-amber-200 text-amber-950'
                                    : isApproved
                                    ? 'bg-emerald-200 text-[#1E9E60]'
                                    : 'bg-red-200 text-red-900'
                                }`}
                              >
                                {isPending
                                  ? '⏳ PENDING SALES MANAGER'
                                  : isApproved
                                  ? '✓ OFF-DUTY APPROVED'
                                  : '✕ DECLINED BY SALES MANAGER'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-800 font-medium">
                              <strong>Off-Duty Dates:</strong> {req.startDate} to {req.endDate} ({req.daysOrShiftsCount} day/shift{req.daysOrShiftsCount > 1 ? 's' : ''})
                              {req.coveringRepName ? ` • Covered by: ${req.coveringRepName}` : ''}
                              {' • '}
                              <span className="text-slate-600">{req.branchName}</span>
                            </div>

                            <div className="text-xs text-slate-600">
                              <strong>Reason:</strong> {req.reason}
                            </div>

                            {req.managerReviewNotes && (
                              <div className="text-[11px] font-semibold text-[#1E9E60] pt-0.5">
                                Sales Manager Decision ({req.reviewedBy}): &ldquo;{req.managerReviewNotes}&rdquo;
                              </div>
                            )}
                          </div>

                          {canApproveSalesRepOffDuty && isPending && (
                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                              <input
                                type="text"
                                value={reviewNoteDrafts[req.id] || ''}
                                onChange={e =>
                                  setReviewNoteDrafts(prev => ({ ...prev, [req.id]: e.target.value }))
                                }
                                placeholder="Sales Manager note..."
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] w-full sm:w-48"
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    reviewSalesRepOffDutyRequest(
                                      req.id,
                                      'APPROVED',
                                      reviewNoteDrafts[req.id]
                                    );
                                    setFeedbackBanner(
                                      `✓ Sales Manager approved Off-Duty request ${req.requestNumber} for ${req.affiliateName}.`
                                    );
                                    setTimeout(() => setFeedbackBanner(null), 4000);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve Off-Duty</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    reviewSalesRepOffDutyRequest(
                                      req.id,
                                      'REJECTED',
                                      reviewNoteDrafts[req.id]
                                    );
                                    setFeedbackBanner(
                                      `Declined Off-Duty request ${req.requestNumber} for ${req.affiliateName}.`
                                    );
                                    setTimeout(() => setFeedbackBanner(null), 4000);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-montserrat font-black text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Decline</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#1E9E60]" />
            <span>
              {activeMode === 'EMPLOYEE_LEAVE'
                ? 'Employee Leave Requests are routed to HR & Payroll.'
                : 'Sales Representative Off-Duty Requests are routed to Branch Sales Manager.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
