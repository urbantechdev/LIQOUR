import React from 'react';
import { PayrollRecord, Employee } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  X, 
  Printer, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  FileText,
  DollarSign
} from 'lucide-react';

interface Props {
  record: PayrollRecord;
  employee?: Employee;
  branchName?: string;
  onClose: () => void;
}

export const PayslipDocumentModal: React.FC<Props> = ({
  record,
  employee,
  branchName = 'Nairobi Central Depot & Head Office',
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const deductions = record.deductionsList || [];
  const penalties = deductions.filter(d => d.isPenalty && d.status !== 'WAIVED');
  const nonPenalties = deductions.filter(d => !d.isPenalty && d.status !== 'WAIVED');
  const totalDeductions = record.totalDeductionsKes || 0;
  const totalPenalties = record.totalPenaltiesKes || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-base sm:text-lg text-white tracking-tight">
                Official Staff Payslip &amp; Deductions Statement
              </h3>
              <p className="text-xs text-[#FFDE00] font-semibold">
                {record.monthYear} • Republic of Kenya Statutory Pay Statement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3 py-1.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Slip</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payslip Printable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs text-slate-700 font-sans print:p-0">
          
          {/* Company & Branch Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="font-montserrat font-black text-xl text-[#0A006E] tracking-tight">
                VAAIRO BEVERAGE DISTRIBUTORS LTD
              </div>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                Authorized Liquor &amp; Spirits Distributor • KRA PIN: P051829301A
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                {branchName} • Nairobi, Kenya
              </div>
            </div>

            <div className="sm:text-right bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Payroll Reference</div>
              <div className="font-mono font-bold text-slate-900">{record.id}</div>
              <div className="text-[11px] text-slate-600 font-medium">Period: {record.monthYear}</div>
            </div>
          </div>

          {/* Employee Demographic Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Staff Name</span>
              <div className="font-montserrat font-bold text-slate-900 text-sm mt-0.5">{record.employeeName}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Department / Role</span>
              <div className="font-semibold text-slate-800 text-xs mt-0.5">{employee?.roleTitle || record.department}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">KRA PIN</span>
              <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">{employee?.kraPin || 'A009182374Z'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">NSSF / SHIF #</span>
              <div className="font-mono font-semibold text-slate-800 text-xs mt-0.5">
                {employee?.nssfNumber || 'N/A'} / {employee?.nhifShifNumber || 'N/A'}
              </div>
            </div>
          </div>

          {/* 1. Earnings Breakdown Table */}
          <div className="space-y-2">
            <h4 className="font-montserrat font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>1. Gross Earnings Breakdown</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Earning Item</th>
                    <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="py-2 px-3 text-slate-700">Contractual Basic Salary</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatKes(record.basicSalaryKes)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700">Fixed House &amp; Transport Allowances</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatKes(record.allowancesKes)}</td>
                  </tr>
                  <tr className="bg-emerald-50/60 font-bold">
                    <td className="py-2.5 px-3 text-emerald-950 font-montserrat">TOTAL GROSS EARNINGS</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-950 font-black">{formatKes(record.grossSalaryKes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Statutory Taxes & Contributions */}
          <div className="space-y-2">
            <h4 className="font-montserrat font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              <span>2. Kenya Statutory Deductions (Tax &amp; Health)</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Statutory Fund</th>
                    <th className="py-2.5 px-3">Rate / Authority</th>
                    <th className="py-2.5 px-3 text-right">Deduction (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="py-2 px-3 text-slate-800 font-medium">KRA PAYE (Income Tax)</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">Tax Bracket Less KES 2,400 Relief</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-900">-{formatKes(record.payeKes)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800 font-medium">NSSF Retirement Fund</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">Tier I &amp; II Contribution</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">-{formatKes(record.nssfKes)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800 font-medium">SHIF (Social Health Authority)</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">Statutory 2.75% of Gross</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900">-{formatKes(record.shifKes)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800 font-medium">Affordable Housing Levy (AHL)</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">Statutory 1.5% of Gross</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-900">-{formatKes(record.housingLevyKes)}</td>
                  </tr>
                  <tr className="bg-purple-50/60 font-bold">
                    <td colSpan={2} className="py-2.5 px-3 text-purple-950 font-montserrat">TOTAL STATUTORY DEDUCTIONS</td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-950 font-black">
                      -{formatKes(record.payeKes + record.nssfKes + record.shifKes + record.housingLevyKes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Disciplinary Penalties & Monies Deducted (Itemized) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-montserrat font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                <span>3. Company Deductions &amp; Disciplinary Penalties</span>
              </h4>
              <span className="text-[11px] font-mono font-bold text-rose-700">
                Total: -{formatKes(totalDeductions)} ({deductions.length} item{deductions.length === 1 ? '' : 's'})
              </span>
            </div>

            {deductions.length === 0 ? (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero disciplinary fines, breakages, or shortages recorded for this pay period. Clean record!</span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Reason / Incident Ref</th>
                      <th className="py-2.5 px-3">Accountant Audit Status</th>
                      <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {deductions.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-montserrat font-bold text-slate-900">{item.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.isPenalty ? (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-montserrat font-black text-[9px]">
                                PENALTY
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-montserrat font-bold text-[9px]">
                                ADVANCE
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">{item.type}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 text-xs">{item.reason}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Doc: {item.referenceDocNumber || 'N/A'} • Date: {item.incidentDate}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.status === 'RECONCILED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Reconciled to Ledger</span>
                            </span>
                          ) : item.status === 'WAIVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              <span>Waived by Management</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Accountant Audit</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          -{formatKes(item.amountKes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Final Net Pay Box */}
          <div className="bg-[#0A006E] text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-xs uppercase font-bold text-[#FFDE00] tracking-wider">Final Net Pay (Take Home)</span>
              <div className="font-montserrat font-black text-2xl sm:text-3xl text-white mt-0.5 tracking-tight">
                {formatKes(record.netSalaryKes)}
              </div>
              <p className="text-xs text-white/80 mt-1">
                Disbursement Method: Bank Transfer ({employee?.bankName || 'KCB Bank'} • {employee?.bankAccount || '*****'}) / M-Pesa ({employee?.mPesaNumber || '254700000000'})
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-start sm:items-end gap-1.5">
              {record.paymentStatus === 'SYNCED_TO_LEDGER' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-montserrat font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>SYNCED TO GENERAL LEDGER</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-montserrat font-bold text-xs">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>DRAFT READY</span>
                </div>
              )}
              <span className="text-[10px] font-mono text-white/60">
                Timestamp: {record.processedAt ? new Date(record.processedAt).toLocaleString('en-KE') : 'Pending'}
              </span>
            </div>
          </div>

          {/* Compliance Declaration */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              This payslip has been prepared in accordance with Kenyan Employment Act Section 31, KRA eTIMS statutory compliance, and Section 19 on authorized company deductions and loss recoveries. All statutory deductions are remitted on or before the 9th day of the subsequent month.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Staff Signature: _______________________
          </span>
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-montserrat font-bold transition cursor-pointer"
          >
            Close Payslip
          </button>
        </div>

      </div>
    </div>
  );
};
