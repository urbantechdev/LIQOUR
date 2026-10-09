import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useErp } from '../../context/ErpContext';
import {
  BranchTier,
  DepartmentType,
  DistributorPaymentTerms,
  DistributorTier,
  SupplierCategory,
  SupplierPaymentTerms
} from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import {
  X,
  Factory,
  Network,
  Users,
  CheckCircle2,
  Plus,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  Store,
  Warehouse,
  Layers,
  MapPin
} from 'lucide-react';
import { StaffActionButtons, StaffStatusBadge } from './StaffLifecycleActionsModal';

export type OnboardingTabType = 'SUPPLIER' | 'DISTRIBUTOR' | 'STAFF' | 'BRANCH';

interface Props {
  initialTab?: OnboardingTabType;
  onClose: () => void;
}

export const OnboardingCenterModal: React.FC<Props> = ({ initialTab = 'SUPPLIER', onClose }) => {
  const {
    suppliers,
    addSupplier,
    distributors,
    addDistributor,
    employees,
    addEmployee,
    updateEmployeePin,
    affiliates,
    registerAffiliate,
    updateAffiliatePin,
    branches,
    addBranch,
    switchBranch,
    activeBranch
  } = useErp();

  const [activeTab, setActiveTab] = useState<OnboardingTabType>(initialTab);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [staffErrorMsg, setStaffErrorMsg] = useState<string | null>(null);
  const [editingPinEmpId, setEditingPinEmpId] = useState<string | null>(null);
  const [editingPinValue, setEditingPinValue] = useState<string>('');

  // 1. Supplier Form State
  const [supName, setSupName] = useState('');
  const [supCode, setSupCode] = useState('');
  const [supPin, setSupPin] = useState('');
  const [supCategory, setSupCategory] = useState<SupplierCategory>('LOCAL_DISTILLERY');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supCounty, setSupCounty] = useState('Nairobi');
  const [supTerms, setSupTerms] = useState<SupplierPaymentTerms>('NET_30');
  const [supCreditLimit, setSupCreditLimit] = useState<number>(5000000);
  const [supBankName, setSupBankName] = useState('KCB Bank Kenya');
  const [supBankAcc, setSupBankAcc] = useState('');

  // 2. Distributor Form State
  const [dstCompany, setDstCompany] = useState('');
  const [dstCode, setDstCode] = useState('');
  const [dstPin, setDstPin] = useState('');
  const [dstLicense, setDstLicense] = useState('');
  const [dstTier, setDstTier] = useState<DistributorTier>('TIER_2_REGIONAL_DEPOT');
  const [dstContact, setDstContact] = useState('');
  const [dstPhone, setDstPhone] = useState('');
  const [dstEmail, setDstEmail] = useState('');
  const [dstCounty, setDstCounty] = useState('Nakuru');
  const [dstRegion, setDstRegion] = useState('Rift Valley');
  const [dstTerms, setDstTerms] = useState<DistributorPaymentTerms>('NET_14');
  const [dstCreditLimit, setDstCreditLimit] = useState<number>(3000000);

  // 3. Staff Form State
  const [empName, setEmpName] = useState('');
  const [empNumber, setEmpNumber] = useState('');
  const [empLoginPin, setEmpLoginPin] = useState('');
  const [empTitle, setEmpTitle] = useState('POS Cashier (Casual • Commission)');
  const [empDept, setEmpDept] = useState<DepartmentType>('POS');
  const [empBranchId, setEmpBranchId] = useState(branches[0]?.id || 'branch-wh-01');
  const [empAssignedCashierId, setEmpAssignedCashierId] = useState<string>('');
  const posCashiers = employees.filter(e => e.department === 'POS' && e.active);
  const isCasualStaffDept = empDept === 'POS' || empDept === 'AFFILIATES';
  const [empCommissionRate, setEmpCommissionRate] = useState<number>(3);
  const [empBasicSalary, setEmpBasicSalary] = useState<number>(45000);
  const [empHouseAllowance, setEmpHouseAllowance] = useState<number>(12000);
  const [empTransportAllowance, setEmpTransportAllowance] = useState<number>(6000);
  const [empPin, setEmpPin] = useState('');
  const [empNssf, setEmpNssf] = useState('');
  const [empShif, setEmpShif] = useState('');
  const [empBankName, setEmpBankName] = useState('Equity Bank Kenya');
  const [empBankAcc, setEmpBankAcc] = useState('');
  const [empMpesa, setEmpMpesa] = useState('');

  // 4. Branch & Shop Creation Form State:
  // - Main Branch is the Head Office (MAIN_STORE)
  // - Branches are the Merchants (DISTRIBUTOR)
  // - Shops are strictly created under a Branch (LIQUOR_STORE)
  const parentEligibleBranches = branches.filter(
    b => b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE'
  );
  const headOfficeMainBranch = branches.find(b => b.tier === 'MAIN_STORE') || branches[0];
  const [branchCategoryPreset, setBranchCategoryPreset] = useState<'LIQUOR_SHOP' | 'DISTRIBUTOR' | 'STORE' | 'WAREHOUSE'>('DISTRIBUTOR');
  const [branchNumber, setBranchNumber] = useState<number>(1);
  const [branchName, setBranchName] = useState('Branch 1 (Merchant)');
  const [branchCode, setBranchCode] = useState('BR-MRC-01');
  const [branchTier, setBranchTier] = useState<BranchTier>('DISTRIBUTOR');
  const [selectedParentBranchId, setSelectedParentBranchId] = useState<string>(
    parentEligibleBranches.find(b => b.tier === 'DISTRIBUTOR')?.id ||
      headOfficeMainBranch?.id ||
      ''
  );
  const [branchLocation, setBranchLocation] = useState('Nairobi CBD');
  const [branchCounty, setBranchCounty] = useState('Nairobi');
  const [branchManager, setBranchManager] = useState('Branch Operations Manager');
  const [branchPhone, setBranchPhone] = useState('+254 722 100 001');
  const [branchKraPin, setBranchKraPin] = useState('P051982736Z');
  const [branchMinThreshold, setBranchMinThreshold] = useState<number>(50000);
  const [switchImmediately, setSwitchImmediately] = useState<boolean>(true);

  const applyBranchPreset = (
    presetType: 'LIQUOR_SHOP' | 'DISTRIBUTOR' | 'STORE' | 'WAREHOUSE',
    num: number
  ) => {
    setBranchCategoryPreset(presetType);
    setBranchNumber(num);
    const padded = String(num).padStart(2, '0');
    if (presetType === 'LIQUOR_SHOP') {
      const targetParent =
        parentEligibleBranches.find(b => b.id === selectedParentBranchId) ||
        parentEligibleBranches.find(b => b.tier === 'DISTRIBUTOR') ||
        headOfficeMainBranch;
      setBranchTier('LIQUOR_STORE');
      if (targetParent) {
        setSelectedParentBranchId(targetParent.id);
        const parentShort = targetParent.name
          .replace(/\s*\(Merchant\)|\s*\(Head Office\)/gi, '')
          .trim();
        setBranchName(`${parentShort} — Shop ${num}`);
        setBranchLocation(targetParent.location || branchLocation);
        setBranchCounty(targetParent.county || branchCounty);
      } else {
        setBranchName(`Liquor Shop ${num}`);
      }
      setBranchCode(`SHP-${padded}`);
    } else if (presetType === 'DISTRIBUTOR') {
      setBranchTier('DISTRIBUTOR');
      setSelectedParentBranchId(headOfficeMainBranch?.id || '');
      setBranchName(`Branch ${num} (Merchant)`);
      setBranchCode(`BR-MRC-${padded}`);
    } else if (presetType === 'STORE') {
      setBranchTier('MAIN_STORE');
      setSelectedParentBranchId('');
      setBranchName(num === 1 ? 'Main Branch (Head Office)' : `Main Branch ${num} (Head Office)`);
      setBranchCode(`MB-HQ-${padded}`);
    } else {
      setBranchTier('WAREHOUSE');
      setSelectedParentBranchId(headOfficeMainBranch?.id || '');
      setBranchName(`Head Office Warehouse ${num}`);
      setBranchCode(`WH-HQ-${padded}`);
    }
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    try {
      await addSupplier({
        name: supName.trim(),
        code: supCode.trim().toUpperCase() || `SUP-${Date.now().toString().slice(-4)}`,
        kraPin: supPin.trim().toUpperCase() || 'P051920192K',
        category: supCategory,
        contactPerson: supContact.trim() || 'Supply Manager',
        phone: supPhone.trim() || '+254 722 000 111',
        email: supEmail.trim() || 'supply@vendor.co.ke',
        physicalAddress: supAddress.trim() || 'Industrial Area, Nairobi',
        county: supCounty.trim() || 'Nairobi',
        paymentTerms: supTerms,
        creditLimitKes: supCreditLimit,
        bankName: supBankName.trim() || 'KCB Bank Kenya',
        bankAccountNumber: supBankAcc.trim() || '1109283741',
        active: true
      });

      showToast(`Supplier "${supName.trim()}" onboarded and saved.`);
      setSupName('');
      setSupCode('');
      setSupPin('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
      setSupAddress('');
      setSupBankAcc('');
    } catch (err) {
      setStaffErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const handleSaveDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dstCompany.trim()) return;

    try {
      await addDistributor({
        companyName: dstCompany.trim(),
        code: dstCode.trim().toUpperCase() || `MRC-${Date.now().toString().slice(-4)}`,
        kraPin: dstPin.trim().toUpperCase() || 'P051883920M',
        licenseNumber: dstLicense.trim().toUpperCase() || `KRA-EXCISE-LIC-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`,
        tier: dstTier,
        contactPerson: dstContact.trim() || 'Operations Director',
        phone: dstPhone.trim() || '+254 733 111 222',
        email: dstEmail.trim() || 'orders@merchant.co.ke',
        county: dstCounty.trim() || 'Nairobi',
        region: dstRegion.trim() || 'Nairobi Metro',
        paymentTerms: dstTerms,
        creditLimitKes: dstCreditLimit,
        active: true
      });

      showToast(`Merchant "${dstCompany.trim()}" onboarded and saved.`);
      setDstCompany('');
      setDstCode('');
      setDstPin('');
      setDstLicense('');
      setDstContact('');
      setDstPhone('');
      setDstEmail('');
    } catch (err) {
      setStaffErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffErrorMsg(null);
    if (!empName.trim()) return;

    const cleanLoginPin = empLoginPin.replace(/\D/g, '');
    if (cleanLoginPin.length !== 6) {
      setStaffErrorMsg('Each staff or Sales Representative user must be created with a 6-digit numeric Login Security PIN (e.g. 482910).');
      return;
    }

    try {
      if (empDept === 'AFFILIATES') {
        const slug = empName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const matchedCashier =
          posCashiers.find(c => c.id === empAssignedCashierId) ||
          posCashiers.find(c => c.branchId === empBranchId) ||
          posCashiers[0];
        const createdAff = await registerAffiliate({
          name: empName.trim(),
          code: empNumber.trim().toUpperCase() || `SR-${empName.trim().split(' ')[0].toUpperCase()}-${(affiliates.length + 1).toString().padStart(2, '0')}`,
          phone: empMpesa.trim() || '254722000000',
          branchId: empBranchId,
          assignedCashierId: matchedCashier?.id,
          assignedCashierName: matchedCashier?.name,
          employmentType: 'CASUAL',
          compensationModel: 'COMMISSION_ONLY',
          commissionRatePercent: empCommissionRate || 5,
          customSlug: slug || `rep-${affiliates.length + 1}`,
          loginPin: cleanLoginPin,
          mpesaNumber: empMpesa.trim() || '254722000000',
          active: true
        });
        showToast(
          `Casual Employee — Sales Representative "${createdAff.name}" (${createdAff.code} • Works on ${createdAff.commissionRatePercent}% Commission + 100% Markup, Not on Salary) onboarded under POS Cashier ${matchedCashier?.name || 'Counter Cashier'} with 6-Digit Login PIN (${cleanLoginPin}).`
        );
      } else {
        const isCasualPos = empDept === 'POS';
        await addEmployee({
          name: empName.trim(),
          employeeNumber: empNumber.trim().toUpperCase() || `EMP-${(employees.length + 101).toString()}`,
          roleTitle: isCasualPos ? 'POS Cashier (Casual • Commission)' : (empTitle.trim() || 'Operations Staff'),
          department: empDept,
          employmentType: isCasualPos ? 'CASUAL' : 'SALARIED',
          compensationModel: isCasualPos ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY',
          commissionRatePercent: isCasualPos ? (empCommissionRate || 3) : 0,
          branchId: empBranchId,
          loginPin: cleanLoginPin,
          basicSalaryKes: isCasualPos ? 0 : empBasicSalary,
          houseAllowanceKes: isCasualPos ? 0 : empHouseAllowance,
          transportAllowanceKes: isCasualPos ? 0 : empTransportAllowance,
          kraPin: empPin.trim().toUpperCase() || 'A009182736Z',
          nssfNumber: empNssf.trim() || `NSSF-${Date.now().toString().slice(-5)}`,
          nhifShifNumber: empShif.trim() || `SHIF-${Date.now().toString().slice(-5)}`,
          bankName: empBankName.trim() || 'Equity Bank Kenya',
          bankAccount: empBankAcc.trim() || '018029384710',
          mPesaNumber: empMpesa.trim() || '254722000000',
          active: true
        });

        showToast(
          isCasualPos
            ? `Casual Employee — POS Cashier "${empName.trim()}" (Works on ${empCommissionRate || 3}% Commission • Not on Monthly Salary) onboarded with 6-Digit Login PIN (${cleanLoginPin}).`
            : `Salaried Staff member "${empName.trim()}" onboarded to ${empDept} with 6-Digit Login PIN (${cleanLoginPin}).`
        );
      }

      setEmpName('');
      setEmpNumber('');
      setEmpLoginPin('');
      setEmpPin('');
      setEmpNssf('');
      setEmpShif('');
      setEmpBankAcc('');
      setEmpMpesa('');
    } catch (err) {
      setStaffErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    const finalCode = branchCode.trim().toUpperCase() || `BR-${Date.now().toString().slice(-4)}`;
    const resolvedParent =
      branchTier === 'LIQUOR_STORE'
        ? parentEligibleBranches.find(b => b.id === selectedParentBranchId) ||
          parentEligibleBranches.find(b => b.tier === 'DISTRIBUTOR') ||
          headOfficeMainBranch
        : branchTier === 'DISTRIBUTOR' || branchTier === 'WAREHOUSE'
        ? headOfficeMainBranch
        : undefined;

    try {
      await addBranch({
        name: branchName.trim(),
        code: finalCode,
        tier: branchTier,
        isHeadOffice: branchTier === 'MAIN_STORE',
        parentBranchId: resolvedParent?.id,
        parentBranchName: resolvedParent?.name,
        location: branchLocation.trim() || 'Main Street',
        county: branchCounty.trim() || 'Nairobi',
        contactPhone: branchPhone.trim() || '+254 722 000 000',
        kraPin: branchKraPin.trim().toUpperCase() || 'P051982736Z',
        managerName: branchManager.trim() || 'Branch Manager',
        allowDirectSales: branchTier !== 'WAREHOUSE',
        minWholesaleThresholdKes: branchTier === 'MAIN_STORE' ? branchMinThreshold : undefined
      });

      showToast(
        branchTier === 'LIQUOR_STORE'
          ? `Shop "${branchName.trim()}" (${finalCode}) created under Branch "${resolvedParent?.name || 'Main Branch (Head Office)'}"!`
          : branchTier === 'DISTRIBUTOR'
          ? `Branch (Merchant) "${branchName.trim()}" (${finalCode}) created under Main Branch (Head Office)!`
          : `Main Branch (Head Office) "${branchName.trim()}" (${finalCode}) created!`
      );
      const nextNum = branchNumber + 1;
      applyBranchPreset(branchCategoryPreset, nextNum);
    } catch (err) {
      setStaffErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save. Check your connection and try again.'
      );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-[32px] max-w-4xl w-full min-h-dvh sm:min-h-0 shadow-2xl border-0 sm:border border-slate-200 overflow-y-auto sm:overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-6 py-5 bg-[#FFDE00] text-[#0A006E] border-b-2 border-[#0A006E] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-montserrat font-black italic text-lg sm:text-xl text-[#0A006E]">
                Enterprise Onboarding &amp; Branch Center
              </h3>
              <p className="text-xs text-[#0A006E]/80 font-semibold">
                Main Branch is the Head Office • Branches are the Merchants • Shops are only created under a Branch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] flex items-center justify-center transition cursor-pointer"
            title="Close Onboarding Center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="px-6 pt-4 pb-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('SUPPLIER')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 transition ${
              activeTab === 'SUPPLIER'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>1. Onboard Supplier ({suppliers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISTRIBUTOR')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 transition ${
              activeTab === 'DISTRIBUTOR'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>2. Onboard Merchant ({distributors.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 transition ${
              activeTab === 'STAFF'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Onboard Staff ({employees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BRANCH')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 transition ${
              activeTab === 'BRANCH'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>4. Create Branch ({branches.length})</span>
          </button>
        </div>

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
          {/* TAB 1: ONBOARD SUPPLIER */}
          {activeTab === 'SUPPLIER' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveSupplier} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier / Distillery Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="e.g. Keroche Breweries Ltd or Bacardi Martini Global"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier Code
                    </label>
                    <input
                      type="text"
                      value={supCode}
                      onChange={(e) => setSupCode(e.target.value.toUpperCase())}
                      placeholder="SUP-KBL-05"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      KRA PIN *
                    </label>
                    <input
                      type="text"
                      required
                      value={supPin}
                      onChange={(e) => setSupPin(e.target.value.toUpperCase())}
                      placeholder="P051234567X"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier Category
                    </label>
                    <select
                      value={supCategory}
                      onChange={(e) => setSupCategory(e.target.value as SupplierCategory)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="LOCAL_DISTILLERY">Local Distillery (LPS)</option>
                      <option value="BONDED_IMPORTER">Bonded Importer (IPS)</option>
                      <option value="IMPORT_AGENT">Authorized Import Agent</option>
                      <option value="PACKAGING_LOGISTICS">Packaging &amp; Logistics</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Terms
                    </label>
                    <select
                      value={supTerms}
                      onChange={(e) => setSupTerms(e.target.value as SupplierPaymentTerms)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="NET_30">NET 30 Days</option>
                      <option value="NET_15">NET 15 Days</option>
                      <option value="NET_60">NET 60 Days</option>
                      <option value="IMMEDIATE_CASH">Immediate Cash / RTGS</option>
                      <option value="CONSIGNMENT">Consignment</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={supContact}
                      onChange={(e) => setSupContact(e.target.value)}
                      placeholder="e.g. James Kariuki"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={supPhone}
                      onChange={(e) => setSupPhone(e.target.value)}
                      placeholder="+254 722 000 000"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={supEmail}
                      onChange={(e) => setSupEmail(e.target.value)}
                      placeholder="orders@supplier.co.ke"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Physical Address &amp; County
                    </label>
                    <input
                      type="text"
                      value={supAddress}
                      onChange={(e) => setSupAddress(e.target.value)}
                      placeholder="Industrial Area, Nairobi"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Settlement Bank
                    </label>
                    <input
                      type="text"
                      value={supBankName}
                      onChange={(e) => setSupBankName(e.target.value)}
                      placeholder="Stanbic Bank"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Account No.
                    </label>
                    <input
                      type="text"
                      value={supBankAcc}
                      onChange={(e) => setSupBankAcc(e.target.value)}
                      placeholder="0100293847"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save &amp; Onboard Supplier</span>
                  </button>
                </div>
              </form>

              {/* Existing Suppliers Directory */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  Active Onboarded Suppliers ({suppliers.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                  {suppliers.map(s => (
                    <div key={s.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-montserrat font-bold text-slate-900 truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {s.code} · PIN: {s.kraPin} · {s.contactPerson}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#1E9E60] shrink-0">
                        {s.paymentTerms}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ONBOARD MERCHANT */}
          {activeTab === 'DISTRIBUTOR' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveDistributor} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Merchant Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={dstCompany}
                      onChange={(e) => setDstCompany(e.target.value)}
                      placeholder="e.g. Lake Basin Beverages & Spirits Depot Ltd"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Merchant Code
                    </label>
                    <input
                      type="text"
                      value={dstCode}
                      onChange={(e) => setDstCode(e.target.value.toUpperCase())}
                      placeholder="MRC-KSM-005"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      KRA PIN *
                    </label>
                    <input
                      type="text"
                      required
                      value={dstPin}
                      onChange={(e) => setDstPin(e.target.value.toUpperCase())}
                      placeholder="P051992837L"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Excise / Liquor License No.
                    </label>
                    <input
                      type="text"
                      value={dstLicense}
                      onChange={(e) => setDstLicense(e.target.value.toUpperCase())}
                      placeholder="KRA-EXCISE-LIC-2026-881"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Merchant Tier
                    </label>
                    <select
                      value={dstTier}
                      onChange={(e) => setDstTier(e.target.value as DistributorTier)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="TIER_1_SUPER_WHOLESALER">Tier 1 Super Wholesaler</option>
                      <option value="TIER_2_REGIONAL_DEPOT">Tier 2 Regional Depot</option>
                      <option value="TIER_3_SUB_DISTRIBUTOR">Tier 3 Sub-Merchant</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={dstContact}
                      onChange={(e) => setDstContact(e.target.value)}
                      placeholder="e.g. Mary Atieno"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={dstPhone}
                      onChange={(e) => setDstPhone(e.target.value)}
                      placeholder="+254 722 999 888"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={dstEmail}
                      onChange={(e) => setDstEmail(e.target.value)}
                      placeholder="orders@merchant.co.ke"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      County
                    </label>
                    <input
                      type="text"
                      value={dstCounty}
                      onChange={(e) => setDstCounty(e.target.value)}
                      placeholder="Kisumu"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Region
                    </label>
                    <input
                      type="text"
                      value={dstRegion}
                      onChange={(e) => setDstRegion(e.target.value)}
                      placeholder="Western / Nyanza"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Terms
                    </label>
                    <select
                      value={dstTerms}
                      onChange={(e) => setDstTerms(e.target.value as DistributorPaymentTerms)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="CASH_ON_DELIVERY">Cash On Delivery</option>
                      <option value="NET_7">NET 7 Days</option>
                      <option value="NET_14">NET 14 Days</option>
                      <option value="NET_30">NET 30 Days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Credit Limit (KES)
                    </label>
                    <input
                      type="number"
                      value={dstCreditLimit}
                      onChange={(e) => setDstCreditLimit(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save &amp; Onboard Merchant</span>
                  </button>
                </div>
              </form>

              {/* Existing Merchants Directory */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  Active Onboarded Merchants ({distributors.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                  {distributors.map(d => (
                    <div key={d.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-montserrat font-bold text-slate-900 truncate">{d.companyName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {d.code} · {d.county} · PIN: {d.kraPin}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#0A006E] shrink-0">
                        Limit: {formatKes(d.creditLimitKes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ONBOARD STAFF */}
          {activeTab === 'STAFF' && (
            <div className="space-y-6">
              {staffErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                  {staffErrorMsg}
                </div>
              )}

              <form onSubmit={handleSaveStaff} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Staff Full Name (Appears on POS Receipt &amp; Payroll) *
                    </label>
                    <input
                      type="text"
                      required
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      placeholder="e.g. Cynthia Moraa or Kelvin Kipchoge"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Employee Staff ID
                    </label>
                    <input
                      type="text"
                      value={empNumber}
                      onChange={(e) => setEmpNumber(e.target.value.toUpperCase())}
                      placeholder={`EMP-${employees.length + 101}`}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-montserrat font-black text-[#0A006E]">
                        6-Digit Login PIN *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                          setEmpLoginPin(randomPin);
                          setStaffErrorMsg(null);
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
                      value={empLoginPin}
                      onChange={(e) => {
                        setEmpLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setStaffErrorMsg(null);
                      }}
                      placeholder="6-digit PIN (e.g. 482910)"
                      className="w-full px-3.5 py-2.5 bg-[#FFDE00]/20 border-2 border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E] tracking-widest"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assigned Department
                    </label>
                    <select
                      value={empDept}
                      onChange={(e) => {
                        const nextDept = e.target.value as DepartmentType;
                        setEmpDept(nextDept);
                        if (nextDept === 'POS') {
                          setEmpTitle('Counter Cashier (Casual • Commission)');
                          setEmpCommissionRate(3);
                        } else if (nextDept === 'AFFILIATES') {
                          setEmpTitle('Sales Representative (Casual • Commission)');
                          setEmpCommissionRate(5);
                        } else if (nextDept === 'BRANCH_MANAGER') {
                          setEmpTitle('Branch Operations Manager');
                        } else if (nextDept === 'DELIVERY_MANAGER') {
                          setEmpTitle('Branch Delivery Manager');
                        } else if (nextDept === 'SALES_MANAGER') {
                          setEmpTitle('Branch Sales & Affiliates Manager');
                        } else {
                          setEmpTitle('Department Operations Staff');
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="POS">Counter Cashier (Created by Branch Manager or Admin • Casual Commission)</option>
                      <option value="BRANCH_MANAGER">Branch Manager (Manage Branch &amp; Create Counter Cashiers • Salaried)</option>
                      <option value="AFFILIATES">Sales Representative (Casual • Commission Only, Not on Salary)</option>
                      <option value="DELIVERY_MANAGER">Delivery Manager (Coordinate Deliveries • Salaried)</option>
                      <option value="SALES_MANAGER">Sales Manager (Manage Affiliates &amp; Branch Sales • Salaried)</option>
                      <option value="INVENTORY">Inventory &amp; Stock Control (Salaried)</option>
                      <option value="PROCUREMENT">Procurement &amp; Restock (Salaried)</option>
                      <option value="BILLING">Commercial B2B Billing (Salaried)</option>
                      <option value="HR_PAYROLL">HR &amp; Statutory Payroll (Salaried)</option>
                      <option value="FINANCE">Finance &amp; Accounting (Salaried)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      value={empTitle}
                      onChange={(e) => setEmpTitle(e.target.value)}
                      placeholder="POS Cashier / Stock Controller"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assigned Branch
                    </label>
                    <select
                      value={empBranchId}
                      onChange={(e) => setEmpBranchId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      {branches.length === 0 ? (
                        <option value="">No Branch Created Yet (Create in Branch Tab first)</option>
                      ) : (
                        branches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {empDept === 'AFFILIATES' && (
                  <div className="p-3.5 rounded-2xl bg-[#FFDE00]/15 border border-[#0A006E]/20">
                    <label className="block text-xs font-montserrat font-black text-[#0A006E] mb-1">
                      Working Under POS Cashier (Specific Counter Cashier Who Receives Their Collection Queue)
                    </label>
                    <select
                      value={empAssignedCashierId}
                      onChange={(e) => setEmpAssignedCashierId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#0A006E]/30 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="">Auto-Assign Store POS Cashier</option>
                      {posCashiers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.employeeNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isCasualStaffDept ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase shrink-0">
                        Casual • Commission Only
                      </span>
                      <span className="font-semibold">
                        {empDept === 'AFFILIATES'
                          ? 'Sales Representative is a Casual Employee in HR who works on commission (100% markup + base sales commission % — Not on Monthly Salary).'
                          : 'POS Cashier is a Casual Employee in HR who works on sales commission (Not on Monthly Salary).'}
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
                        value={empCommissionRate}
                        onChange={(e) => setEmpCommissionRate(parseFloat(e.target.value) || 0)}
                        className="w-20 px-2.5 py-1 bg-white border border-amber-400 rounded-lg text-xs font-mono font-black text-[#0A006E] text-center"
                      />
                      <span className="font-mono font-black text-[11px] bg-white px-2.5 py-1 rounded-lg border border-amber-300">
                        Monthly Salary: KES 0
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Basic Salary (KES)
                      </label>
                      <input
                        type="number"
                        value={empBasicSalary}
                        onChange={(e) => setEmpBasicSalary(parseInt(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        House Allowance (KES)
                      </label>
                      <input
                        type="number"
                        value={empHouseAllowance}
                        onChange={(e) => setEmpHouseAllowance(parseInt(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Transport Allowance (KES)
                      </label>
                      <input
                        type="number"
                        value={empTransportAllowance}
                        onChange={(e) => setEmpTransportAllowance(parseInt(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Staff KRA PIN
                    </label>
                    <input
                      type="text"
                      value={empPin}
                      onChange={(e) => setEmpPin(e.target.value.toUpperCase())}
                      placeholder="A012345678Z"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NSSF Number
                    </label>
                    <input
                      type="text"
                      value={empNssf}
                      onChange={(e) => setEmpNssf(e.target.value)}
                      placeholder="NSSF-88210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SHIF / NHIF No.
                    </label>
                    <input
                      type="text"
                      value={empShif}
                      onChange={(e) => setEmpShif(e.target.value)}
                      placeholder="SHIF-99102"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      M-Pesa Phone
                    </label>
                    <input
                      type="text"
                      value={empMpesa}
                      onChange={(e) => setEmpMpesa(e.target.value)}
                      placeholder="254722000111"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save &amp; Onboard Staff Member</span>
                  </button>
                </div>
              </form>

              {/* Existing Staff & Sales Representatives Directory */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  Active Onboarded Staff, Sales Representatives &amp; Login PINs ({employees.length + affiliates.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {employees.map(emp => {
                    const isCasualEmp =
                      emp.department === 'POS' ||
                      emp.department === 'AFFILIATES' ||
                      emp.employmentType === 'CASUAL';
                    return (
                    <div key={emp.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-montserrat font-bold text-slate-900 truncate">{emp.name}</span>
                            <StaffStatusBadge
                              status={emp.employmentStatus}
                              active={emp.active}
                              reason={emp.suspensionReason || emp.terminationReason}
                              compact
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {emp.employeeNumber} · {emp.department === 'POS' ? 'POS CASHIER' : emp.department} · {isCasualEmp ? `Casual (${emp.commissionRatePercent ?? 3}% Commission)` : emp.roleTitle}
                          </div>
                        </div>
                        {isCasualEmp ? (
                          <span className="text-[10px] font-montserrat font-black text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shrink-0">
                            Casual • {emp.commissionRatePercent ?? 3}% Comm.
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold text-[#1E9E60] shrink-0">
                            {formatKes(emp.basicSalaryKes)}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
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
                                  showToast(`Updated 6-Digit Login PIN for ${emp.name} to ${editingPinValue}`);
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
                              className="px-1.5 py-1 text-slate-400 hover:text-slate-700 text-[10px] font-bold"
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
                            Change PIN
                          </button>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                        <StaffActionButtons
                          staff={emp}
                          compact
                          onActionComplete={msg => showToast(msg)}
                        />
                      </div>
                    </div>
                    );
                  })}

                  {affiliates.map(aff => (
                    <div key={aff.id} className="p-3 rounded-xl bg-amber-50/50 border border-[#0A006E]/20 flex flex-col justify-between gap-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-montserrat font-bold text-slate-900 truncate">{aff.name}</span>
                            <StaffStatusBadge
                              status={aff.employmentStatus}
                              active={aff.active}
                              reason={aff.suspensionReason || aff.terminationReason}
                              compact
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {aff.code} · SALES REPRESENTATIVE · Casual ({aff.commissionRatePercent ?? 5}% + 100% Markup)
                          </div>
                        </div>
                        <span className="text-[10px] font-montserrat font-black text-[#0A006E] bg-[#FFDE00] px-2 py-0.5 rounded shrink-0">
                          Casual • Commission
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
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
                                  showToast(`Updated 6-Digit Login PIN for Sales Representative ${aff.name} to ${editingPinValue}`);
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
                              className="px-1.5 py-1 text-slate-400 hover:text-slate-700 text-[10px] font-bold"
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
                            Change PIN
                          </button>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                        <StaffActionButtons
                          staff={aff}
                          compact
                          onActionComplete={msg => showToast(msg)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREATE NEW BRANCH (LIQUOR SHOP 1, DISTRIBUTOR 1, STORE 1, ETC.) */}
          {activeTab === 'BRANCH' && (
            <div className="space-y-6">
              {/* Quick Preset Selector Cards */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                    1. Choose Branch Type &amp; Number (e.g. Liquor Shop 1, Merchant 1, Store 1)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Branch #:</span>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => applyBranchPreset(branchCategoryPreset, n)}
                        className={`w-7 h-7 rounded-lg font-mono font-black text-xs transition ${
                          branchNumber === n
                            ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={branchNumber}
                      onChange={(e) => applyBranchPreset(branchCategoryPreset, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                      title="Custom Branch Number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyBranchPreset('DISTRIBUTOR', branchNumber)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      branchCategoryPreset === 'DISTRIBUTOR'
                        ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Layers className={`w-4 h-4 ${branchCategoryPreset === 'DISTRIBUTOR' ? 'text-[#FFDE00]' : 'text-amber-600'}`} />
                      <span className="text-[10px] font-mono font-bold opacity-80">BR-MRC-{String(branchNumber).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <div className="font-montserrat font-black text-xs">Branch {branchNumber} (Merchant)</div>
                      <div className={`text-[10px] ${branchCategoryPreset === 'DISTRIBUTOR' ? 'text-blue-200' : 'text-slate-400'}`}>
                        Merchant Under Head Office
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyBranchPreset('LIQUOR_SHOP', branchNumber)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      branchCategoryPreset === 'LIQUOR_SHOP'
                        ? 'bg-[#34D186] text-white border-[#34D186] shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Store className={`w-4 h-4 ${branchCategoryPreset === 'LIQUOR_SHOP' ? 'text-[#FFDE00]' : 'text-[#1E9E60]'}`} />
                      <span className="text-[10px] font-mono font-bold opacity-80">SHP-{String(branchNumber).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <div className="font-montserrat font-black text-xs">Shop {branchNumber}</div>
                      <div className={`text-[10px] ${branchCategoryPreset === 'LIQUOR_SHOP' ? 'text-emerald-200' : 'text-slate-400'}`}>
                        Created Under a Branch
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyBranchPreset('STORE', branchNumber)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      branchCategoryPreset === 'STORE'
                        ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Building2 className={`w-4 h-4 ${branchCategoryPreset === 'STORE' ? 'text-[#FFDE00]' : 'text-[#0A006E]'}`} />
                      <span className="text-[10px] font-mono font-bold opacity-80">MB-HQ-{String(branchNumber).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <div className="font-montserrat font-black text-xs">Main Branch (HQ)</div>
                      <div className={`text-[10px] ${branchCategoryPreset === 'STORE' ? 'text-blue-200' : 'text-slate-400'}`}>
                        Head Office Hub
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyBranchPreset('WAREHOUSE', branchNumber)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      branchCategoryPreset === 'WAREHOUSE'
                        ? 'bg-purple-950 text-white border-purple-950 shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Warehouse className={`w-4 h-4 ${branchCategoryPreset === 'WAREHOUSE' ? 'text-[#FFDE00]' : 'text-purple-700'}`} />
                      <span className="text-[10px] font-mono font-bold opacity-80">WH-HQ-{String(branchNumber).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <div className="font-montserrat font-black text-xs">HQ Warehouse {branchNumber}</div>
                      <div className={`text-[10px] ${branchCategoryPreset === 'WAREHOUSE' ? 'text-purple-200' : 'text-slate-400'}`}>
                        Head Office Storage
                      </div>
                    </div>
                  </button>
                </div>

                {/* One-Click Quick Presets Bar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Quick Templates:</span>
                  {[
                    { label: 'Branch 1 (Merchant)', type: 'DISTRIBUTOR' as const, num: 1 },
                    { label: 'Branch 2 (Merchant)', type: 'DISTRIBUTOR' as const, num: 2 },
                    { label: 'Shop 1 (Under Branch)', type: 'LIQUOR_SHOP' as const, num: 1 },
                    { label: 'Shop 2 (Under Branch)', type: 'LIQUOR_SHOP' as const, num: 2 },
                    { label: 'Main Branch (Head Office)', type: 'STORE' as const, num: 1 },
                    { label: 'HQ Warehouse 1', type: 'WAREHOUSE' as const, num: 1 }
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => applyBranchPreset(item.type, item.num)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFDE00]/40 border border-slate-200 text-[11px] font-montserrat font-bold text-[#0A006E] transition"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-4">
                {branchTier === 'LIQUOR_STORE' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/90 border-2 border-[#0A006E] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-montserrat font-black text-[#0A006E]">
                        Parent Branch (Merchant / Head Office) * — Shops Are Only Created Under a Branch
                      </label>
                      <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px] uppercase">
                        Required
                      </span>
                    </div>
                    <select
                      required
                      value={
                        selectedParentBranchId ||
                        parentEligibleBranches.find(b => b.tier === 'DISTRIBUTOR')?.id ||
                        headOfficeMainBranch?.id ||
                        ''
                      }
                      onChange={e => {
                        const parentId = e.target.value;
                        setSelectedParentBranchId(parentId);
                        const pBr = parentEligibleBranches.find(b => b.id === parentId);
                        if (pBr) {
                          setBranchLocation(pBr.location || branchLocation);
                          setBranchCounty(pBr.county || branchCounty);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#0A006E] rounded-xl text-xs font-montserrat font-bold text-slate-900"
                    >
                      {parentEligibleBranches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.tier === 'MAIN_STORE'
                            ? `[Head Office] ${b.name} (${b.code})`
                            : `[Branch • Merchant] ${b.name} (${b.code}) — ${b.location}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {branchTier === 'LIQUOR_STORE'
                        ? 'Shop Name (Under Selected Branch) *'
                        : branchTier === 'DISTRIBUTOR'
                        ? 'Branch (Merchant) Name *'
                        : 'Main Branch (Head Office) Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="e.g. Kilimani Branch (Merchant) / Shop 1"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-[#0A006E]/30 rounded-xl text-xs font-montserrat font-black text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      placeholder="BR-MRC-01 / SHP-01 / MB-HQ-01"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hierarchy Role
                    </label>
                    <select
                      value={branchTier}
                      onChange={(e) => setBranchTier(e.target.value as BranchTier)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="DISTRIBUTOR">Branch (Merchant — Under Head Office)</option>
                      <option value="LIQUOR_STORE">Shop (Created Strictly Under a Branch)</option>
                      <option value="MAIN_STORE">Main Branch (Head Office)</option>
                      <option value="WAREHOUSE">Head Office Warehouse (Bonded Storage)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Physical Location / Town
                    </label>
                    <input
                      type="text"
                      value={branchLocation}
                      onChange={(e) => setBranchLocation(e.target.value)}
                      placeholder="e.g. Westlands, Nairobi"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      County
                    </label>
                    <input
                      type="text"
                      value={branchCounty}
                      onChange={(e) => setBranchCounty(e.target.value)}
                      placeholder="Nairobi"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Branch Manager Name
                    </label>
                    <input
                      type="text"
                      value={branchManager}
                      onChange={(e) => setBranchManager(e.target.value)}
                      placeholder="e.g. David Mwangi"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      placeholder="+254 722 100 001"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Branch KRA PIN
                    </label>
                    <input
                      type="text"
                      value={branchKraPin}
                      onChange={(e) => setBranchKraPin(e.target.value.toUpperCase())}
                      placeholder="P051982736Z"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {branchTier === 'MAIN_STORE' && (
                  <div className="w-full sm:w-1/2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Minimum Wholesale Order Threshold (KES)
                    </label>
                    <input
                      type="number"
                      value={branchMinThreshold}
                      onChange={(e) => setBranchMinThreshold(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save &amp; Create Branch ({branchName})</span>
                  </button>
                </div>
              </form>

              {/* Existing Branches Directory */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-montserrat font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  All Active Branches ({branches.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                  {branches.map(b => {
                    const isCurrent = b.id === activeBranch.id;
                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                          isCurrent ? 'bg-blue-50/70 border-[#0A006E]' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-montserrat font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <span>{b.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[#0A006E]">
                              {b.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {b.tier.replace('_', ' ')} · {b.location} ({b.county})
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] font-montserrat font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg shrink-0">
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              switchBranch(b.id);
                              showToast(`Switched active terminal to ${b.name}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#0A006E] text-white text-[10px] font-montserrat font-bold shrink-0 hover:bg-[#060046]"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
