import {
  Branch,
  Product,
  User,
  Affiliate,
  Employee,
  ChartAccount,
  InventoryItem,
  MpesaTransaction,
  SaleOrder,
  ETimsInvoice,
  JournalEntry,
  Supplier,
  CommercialDistributor,
  SupplyInvoice,
  CommercialQuote,
  CommercialInvoice,
  Organization,
  OrganizationMembership,
  Consumer,
  DailyRouteCashUpRecord,
  EmptiesDepositRecord,
  BreweryRebateClaimRecord,
  PayrollRecord,
  StaffDeductionItem
} from '../types';

export const MAIN_HEAD_OFFICE_BRANCH: Branch = {
  id: 'branch-hq-main',
  name: 'Main Branch (Head Office)',
  code: 'MB-HQ-01',
  tier: 'MAIN_STORE',
  location: 'Head Office — Nairobi CBD',
  county: 'Nairobi',
  contactPhone: '+254 700 000 000',
  kraPin: 'P051829301A',
  managerName: 'Head Office Director',
  isHeadOffice: true,
  minWholesaleThresholdKes: 50000,
  allowDirectSales: true,
  latitude: -1.286389,
  longitude: 36.817223,
  maxDeliveryRadiusKm: 25,
  deliveryZones: ['Nairobi CBD & Upper Hill'],
  marketClassTier: 'STANDARD_RESIDENTIAL',
  priceMultiplierPercent: 0,
  preferredProductPrices: {}
};

export const INITIAL_BRANCHES: Branch[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Executive Administrator',
    email: 'msabine327@gmail.com',
    role: 'SUPER_ADMIN',
    department: 'BRANCH_MANAGER',
    branchId: 'branch-hq-main',
    phone: '',
    mfaEnabled: true
  }
];

export const INITIAL_AFFILIATES: Affiliate[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-06624',
    name: 'Peter Omboga',
    employeeNumber: 'EMP-HR-001',
    department: 'HR_PAYROLL',
    roleTitle: 'HR & Personnel Officer',
    branchId: 'branch-hq-main',
    employmentType: 'SALARIED',
    compensationModel: 'MONTHLY_SALARY',
    commissionRatePercent: 0,
    totalSalesKes: 0,
    totalCommissionEarnedKes: 0,
    paidCommissionKes: 0,
    pendingCommissionKes: 0,
    basicSalaryKes: 65000,
    houseAllowanceKes: 10000,
    transportAllowanceKes: 5000,
    kraPin: 'A009182374Z',
    nssfNumber: '10928374',
    nhifShifNumber: '9928174',
    bankAccount: '011092837461',
    bankName: 'KCB Bank Kenya',
    mPesaNumber: '254722123456',
    active: true,
    employmentStatus: 'ACTIVE',
    loginPin: '112233'
  },
  {
    id: 'emp-07215',
    name: 'Sephan Juma',
    employeeNumber: 'EMP-OPS-002',
    department: 'BRANCH_MANAGER',
    roleTitle: 'Branch Operations Manager',
    branchId: 'branch-hq-main',
    employmentType: 'SALARIED',
    compensationModel: 'MONTHLY_SALARY',
    commissionRatePercent: 0,
    totalSalesKes: 0,
    totalCommissionEarnedKes: 0,
    paidCommissionKes: 0,
    pendingCommissionKes: 0,
    basicSalaryKes: 85000,
    houseAllowanceKes: 15000,
    transportAllowanceKes: 10000,
    kraPin: 'A012345678B',
    nssfNumber: '20938475',
    nhifShifNumber: '8837192',
    bankAccount: '022093847562',
    bankName: 'Equity Bank',
    mPesaNumber: '254711987654',
    active: true,
    employmentStatus: 'ACTIVE',
    loginPin: '223344'
  },
  {
    id: 'emp-1791123659015-zeo2',
    name: 'Peter Kaluma',
    employeeNumber: 'EMP-WH-003',
    department: 'INVENTORY',
    roleTitle: 'Warehouse & Stock Lead',
    branchId: 'branch-hq-main',
    employmentType: 'SALARIED',
    compensationModel: 'MONTHLY_SALARY',
    commissionRatePercent: 0,
    totalSalesKes: 0,
    totalCommissionEarnedKes: 0,
    paidCommissionKes: 0,
    pendingCommissionKes: 0,
    basicSalaryKes: 50000,
    houseAllowanceKes: 6000,
    transportAllowanceKes: 4000,
    kraPin: 'A023456789C',
    nssfNumber: '30948576',
    nhifShifNumber: '7746283',
    bankAccount: '033094857663',
    bankName: 'Co-operative Bank',
    mPesaNumber: '254733456789',
    active: true,
    employmentStatus: 'ACTIVE',
    loginPin: '334455'
  },
  {
    id: 'emp-08341',
    name: 'David Ochieng',
    employeeNumber: 'EMP-LOG-004',
    department: 'DELIVERY_MANAGER',
    roleTitle: 'Route Van Driver & Logistics',
    branchId: 'branch-hq-main',
    employmentType: 'SALARIED',
    compensationModel: 'MONTHLY_SALARY',
    commissionRatePercent: 0,
    totalSalesKes: 0,
    totalCommissionEarnedKes: 0,
    paidCommissionKes: 0,
    pendingCommissionKes: 0,
    basicSalaryKes: 48000,
    houseAllowanceKes: 5000,
    transportAllowanceKes: 5000,
    kraPin: 'A034567890D',
    nssfNumber: '40958677',
    nhifShifNumber: '6655394',
    bankAccount: '044095867764',
    bankName: 'NCBA Bank Kenya',
    mPesaNumber: '254744567890',
    active: true,
    employmentStatus: 'ACTIVE',
    loginPin: '445566'
  }
];


export const INITIAL_CHART_OF_ACCOUNTS: ChartAccount[] = [
  { code: '1010', name: 'Cash on Hand - Retail Tills', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1020', name: 'M-Pesa Paybill & Till Clearing Account', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1030', name: 'KCB Corporate Operating Account', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1050', name: 'Staff Salary Advances Receivable', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1060', name: 'Route Driver & Cashier Shortage Suspense', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1070', name: 'Returnable Glass & Crate Deposits with Breweries (EABL/UDV)', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1100', name: 'Accounts Receivable - B2B Merchants', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1120', name: 'Post-Dated Cheques in Hand (PDC)', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1200', name: 'Inventory Asset - Bonded & Duty Paid Stock', type: 'ASSET', balanceKes: 0, kraTaxMappable: true },
  { code: '2010', name: 'Accounts Payable - Distilleries & Importers', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: false },
  { code: '2020', name: 'KRA VAT Output Payable (16%)', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2030', name: 'KRA PAYE & Statutory Deductions Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2040', name: 'SHIF (2.75%) & Affordable Housing Levy Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2050', name: 'Sales Rep Commissions Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: false },
  { code: '2070', name: 'Customer Bottle & Crate Deposits Liability', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: false },
  { code: '3010', name: 'Share Capital & Retained Earnings', type: 'EQUITY', balanceKes: 0, kraTaxMappable: false },
  { code: '4010', name: 'Alcohol Beverage Sales - Retail & Wholesale', type: 'REVENUE', balanceKes: 0, kraTaxMappable: true },
  { code: '4090', name: 'Staff Penalties & Disciplinary Recovery Income', type: 'REVENUE', balanceKes: 0, kraTaxMappable: true },
  { code: '5010', name: 'Cost of Goods Sold (COGS) - Excise & Landed Cost', type: 'COGS', balanceKes: 0, kraTaxMappable: true },
  { code: '5040', name: 'Stock Breakage, Transit Loss & Spoilage Offset', type: 'COGS', balanceKes: 0, kraTaxMappable: true },
  { code: '6010', name: 'Salaries, Wages & Employer NSSF/AHL Contributions', type: 'EXPENSE', balanceKes: 0, kraTaxMappable: true },
  { code: '6020', name: 'Sales Rep Commission Expense', type: 'EXPENSE', balanceKes: 0, kraTaxMappable: true },
  { code: '6030', name: 'Bonded Warehouse & Cold Chain Logistics Expense', type: 'EXPENSE', balanceKes: 0, kraTaxMappable: true }
];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [];

export const INITIAL_MPESA_TRANSACTIONS: MpesaTransaction[] = [];

export const INITIAL_ORDERS: SaleOrder[] = [];

export const INITIAL_ETIMS_INVOICES: ETimsInvoice[] = [];

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_DISTRIBUTORS: CommercialDistributor[] = [];

export const INITIAL_SUPPLY_INVOICES: SupplyInvoice[] = [];

export const INITIAL_QUOTES: CommercialQuote[] = [];

export const INITIAL_COMMERCIAL_INVOICES: CommercialInvoice[] = [];

export const INITIAL_ORGANIZATIONS: Organization[] = [];

export const INITIAL_ORGANIZATION_MEMBERSHIPS: OrganizationMembership[] = [];

export const INITIAL_CONSUMERS: Consumer[] = [];

export const INITIAL_ROUTE_CASHUPS: DailyRouteCashUpRecord[] = [
  {
    id: 'rcu-2026-001',
    date: '2026-10-12',
    routeCode: 'ROUTE-CBD-01',
    routeName: 'Nairobi CBD & Upper Hill Bars',
    vehicleReg: 'KDM 284P (Isuzu 4-Ton Canter)',
    driverName: 'Peter Kamau',
    salesRepName: 'Brian Kiprop',
    invoicedValueKes: 384500,
    cashCollectedKes: 145000,
    mpesaCollectedKes: 165500,
    chequesCollectedKes: 40000,
    b2bCreditInvoicedKes: 30000,
    breakagesValueKes: 4000,
    varianceKes: 0,
    status: 'BALANCED',
    emptiesReturnedCrates: 65,
    emptiesReturnedBottles: 1625,
    reconciledBy: 'Corporate Accountant',
    reconciledAt: '2026-10-12T04:15:00Z',
    notes: 'Route balanced. 1 case Tusker Lager bottle neck chip recorded under transit breakage claim.'
  },
  {
    id: 'rcu-2026-002',
    date: '2026-10-12',
    routeCode: 'ROUTE-WESTLANDS-02',
    routeName: 'Westlands, Parklands & MPESA Hubs',
    vehicleReg: 'KDF 192A (Mitsubishi Fuso 7-Ton)',
    driverName: 'David Ochieng',
    salesRepName: 'Moses Muya',
    invoicedValueKes: 512000,
    cashCollectedKes: 210000,
    mpesaCollectedKes: 228000,
    chequesCollectedKes: 55000,
    b2bCreditInvoicedKes: 15000,
    breakagesValueKes: 2500,
    varianceKes: -1500, // KES 1,500 route cash shortage
    status: 'SHORTAGE_FLAGGED',
    emptiesReturnedCrates: 84,
    emptiesReturnedBottles: 2100,
    notes: 'Route completed with KES 1,500 till/cash shortage flagged against van driver float.'
  },
  {
    id: 'rcu-2026-003',
    date: '2026-10-11',
    routeCode: 'ROUTE-KILIMANI-03',
    routeName: 'Kilimani, Lavington & Ngong Road Lounges',
    vehicleReg: 'KDK 883M (Hino 500)',
    driverName: 'Peter Kaluma',
    salesRepName: 'Kevin Omondi',
    invoicedValueKes: 440000,
    cashCollectedKes: 195000,
    mpesaCollectedKes: 185000,
    chequesCollectedKes: 40000,
    b2bCreditInvoicedKes: 20000,
    breakagesValueKes: 0,
    varianceKes: 0,
    status: 'RECONCILED_TO_LEDGER',
    emptiesReturnedCrates: 70,
    emptiesReturnedBottles: 1750,
    reconciledBy: 'Corporate Accountant',
    reconciledAt: '2026-10-11T18:30:00Z',
    journalEntryId: 'JE-RCU-882104'
  }
];

export const INITIAL_EMPTIES_DEPOSITS: EmptiesDepositRecord[] = [
  {
    id: 'emp-dep-001',
    date: '2026-10-12',
    partnerType: 'BREWERY_SUPPLIER',
    partnerName: 'East African Breweries Ltd (EABL / UDV Ruaraka)',
    crateType: 'BEER_CRATE_25BTL',
    quantityCrates: 240,
    unitDepositRateKes: 1200,
    totalDepositKes: 288000,
    movementType: 'RETURNS_SETTLED',
    breakageCount: 3,
    status: 'RECONCILED',
    reconciledBy: 'Corporate Accountant',
    reconciledAt: '2026-10-12T03:00:00Z',
    notes: '240 returnable Tusker/Guinness plastic crates handed over at EABL Central Depot. Deposit float credited.'
  },
  {
    id: 'emp-dep-002',
    date: '2026-10-12',
    partnerType: 'B2B_CUSTOMER',
    partnerName: 'K1 Klub House & Lounge (Parklands)',
    crateType: 'BEER_CRATE_25BTL',
    quantityCrates: 45,
    unitDepositRateKes: 1200,
    totalDepositKes: 54000,
    movementType: 'DEPOSIT_COLLECTED_IN',
    breakageCount: 2,
    status: 'OPEN',
    notes: 'Customer returned 45 empties; refund balance credited to B2B delivery invoice.'
  },
  {
    id: 'emp-dep-003',
    date: '2026-10-10',
    partnerType: 'BREWERY_SUPPLIER',
    partnerName: 'Kenya Breweries Ltd (KBL)',
    crateType: 'KEG_BARREL_50L',
    quantityCrates: 30,
    unitDepositRateKes: 6000,
    totalDepositKes: 180000,
    movementType: 'DEPOSIT_PAID_OUT',
    breakageCount: 0,
    status: 'RECONCILED',
    reconciledBy: 'Corporate Accountant',
    reconciledAt: '2026-10-10T12:00:00Z',
    notes: '30 Senator / Balozi Keg 50L stainless steel barrels drawn on deposit.'
  }
];

export const INITIAL_BREWERY_REBATES: BreweryRebateClaimRecord[] = [
  {
    id: 'reb-2026-q3',
    month: 'September 2026',
    supplierName: 'East African Breweries Ltd (EABL)',
    targetTurnoverKes: 12000000,
    actualAchievedVolumeKes: 13450000,
    rebateRatePercent: 2.5,
    rebateAmountKes: 336250,
    claimStatus: 'CREDIT_NOTE_RECEIVED',
    creditNoteNumber: 'EABL-CN-2026-90412',
    reconciledAt: '2026-10-05T09:00:00Z',
    reconciledBy: 'Corporate Accountant'
  },
  {
    id: 'reb-2026-q4',
    month: 'October 2026',
    supplierName: 'United Distillers & Vintners (UDV Kenya)',
    targetTurnoverKes: 6000000,
    actualAchievedVolumeKes: 6850000,
    rebateRatePercent: 3.0,
    rebateAmountKes: 205500,
    claimStatus: 'SUBMITTED'
  }
];

export const INITIAL_PAYROLL_RECORDS: PayrollRecord[] = [
  {
    id: 'pay-emp-06624-sep',
    monthYear: 'September 2026',
    employeeId: 'emp-06624',
    employeeName: 'Peter Omboga',
    department: 'HR_PAYROLL',
    basicSalaryKes: 65000,
    allowancesKes: 15000,
    grossSalaryKes: 80000,
    payeKes: 14850,
    nssfKes: 2160,
    shifKes: 2200,
    housingLevyKes: 1200,
    totalDeductionsKes: 5000,
    totalPenaltiesKes: 0,
    deductionsList: [
      {
        id: 'ded-adv-001',
        payrollId: 'pay-emp-06624-sep',
        employeeId: 'emp-06624',
        employeeName: 'Peter Omboga',
        monthYear: 'September 2026',
        type: 'SALARY_ADVANCE',
        title: 'Mid-Month Salary Advance',
        amountKes: 5000,
        incidentDate: '2026-09-15',
        referenceDocNumber: 'ADV-SEP-15',
        reason: 'Emergency medical advance requested and disbursed via M-Pesa.',
        isPenalty: false,
        status: 'RECONCILED',
        reconciledBy: 'Corporate Accountant',
        reconciledAt: '2026-09-30T10:00:00Z',
        recoveryAccountCode: '1050',
        journalEntryId: 'JE-PAY-ADV-01',
        createdAt: '2026-09-15T12:00:00Z'
      }
    ],
    netSalaryKes: 54590,
    paymentStatus: 'PROCESSED',
    reconciliationStatus: 'RECONCILED',
    processedAt: '2026-09-30T17:00:00Z'
  },
  {
    id: 'pay-emp-07215-sep',
    monthYear: 'September 2026',
    employeeId: 'emp-07215',
    employeeName: 'Sephan Juma',
    department: 'BRANCH_MANAGER',
    basicSalaryKes: 85000,
    allowancesKes: 25000,
    grossSalaryKes: 110000,
    payeKes: 24150,
    nssfKes: 2160,
    shifKes: 3025,
    housingLevyKes: 1650,
    totalDeductionsKes: 8500,
    totalPenaltiesKes: 8500,
    deductionsList: [
      {
        id: 'ded-brk-001',
        payrollId: 'pay-emp-07215-sep',
        employeeId: 'emp-07215',
        employeeName: 'Sephan Juma',
        monthYear: 'September 2026',
        type: 'STOCK_BREAKAGE',
        title: 'Warehouse Handling Breakage: 2x Johnnie Walker Black 1L',
        amountKes: 6200,
        incidentDate: '2026-09-22',
        referenceDocNumber: 'BRK-WH-0922',
        reason: 'Careless forklift pallet handling resulting in 2 broken 1L bottles.',
        isPenalty: true,
        status: 'APPLIED',
        createdAt: '2026-09-22T14:30:00Z'
      },
      {
        id: 'ded-fine-002',
        payrollId: 'pay-emp-07215-sep',
        employeeId: 'emp-07215',
        employeeName: 'Sephan Juma',
        monthYear: 'September 2026',
        type: 'LATE_ABSENCE_PENALTY',
        title: 'Unauthorized Weekend Branch Absence',
        amountKes: 2300,
        incidentDate: '2026-09-26',
        referenceDocNumber: 'HR-DISC-0926',
        reason: 'Unexcused absence during Saturday morning stock replenishment rush.',
        isPenalty: true,
        status: 'APPLIED',
        createdAt: '2026-09-26T10:00:00Z'
      }
    ],
    netSalaryKes: 70515,
    paymentStatus: 'DRAFT',
    reconciliationStatus: 'PENDING_RECONCILIATION',
    processedAt: '2026-09-30T17:00:00Z'
  },
  {
    id: 'pay-emp-1791123659015-zeo2-sep',
    monthYear: 'September 2026',
    employeeId: 'emp-1791123659015-zeo2',
    employeeName: 'Peter Kaluma',
    department: 'INVENTORY',
    basicSalaryKes: 50000,
    allowancesKes: 10000,
    grossSalaryKes: 60000,
    payeKes: 9850,
    nssfKes: 2160,
    shifKes: 1650,
    housingLevyKes: 900,
    totalDeductionsKes: 3500,
    totalPenaltiesKes: 3500,
    deductionsList: [
      {
        id: 'ded-short-003',
        payrollId: 'pay-emp-1791123659015-zeo2-sep',
        employeeId: 'emp-1791123659015-zeo2',
        employeeName: 'Peter Kaluma',
        monthYear: 'September 2026',
        type: 'CASH_SHORTAGE',
        title: 'Dispatch Delivery Cash Discrepancy',
        amountKes: 3500,
        incidentDate: '2026-09-18',
        referenceDocNumber: 'DISP-VAR-18',
        reason: 'Cash collection remittance shortage following route van dispatch.',
        isPenalty: true,
        status: 'APPLIED',
        createdAt: '2026-09-18T16:00:00Z'
      }
    ],
    netSalaryKes: 41940,
    paymentStatus: 'DRAFT',
    reconciliationStatus: 'PENDING_RECONCILIATION',
    processedAt: '2026-09-30T17:00:00Z'
  }
];

export const INITIAL_STAFF_DEDUCTIONS: StaffDeductionItem[] = [
  {
    id: 'ded-brk-001',
    payrollId: 'pay-emp-07215-sep',
    employeeId: 'emp-07215',
    employeeName: 'Sephan Juma',
    monthYear: 'September 2026',
    type: 'STOCK_BREAKAGE',
    title: 'Warehouse Handling Breakage: 2x Johnnie Walker Black 1L',
    amountKes: 6200,
    incidentDate: '2026-09-22',
    referenceDocNumber: 'BRK-WH-0922',
    reason: 'Careless forklift pallet handling resulting in 2 broken 1L bottles.',
    isPenalty: true,
    status: 'APPLIED',
    createdAt: '2026-09-22T14:30:00Z'
  },
  {
    id: 'ded-fine-002',
    payrollId: 'pay-emp-07215-sep',
    employeeId: 'emp-07215',
    employeeName: 'Sephan Juma',
    monthYear: 'September 2026',
    type: 'LATE_ABSENCE_PENALTY',
    title: 'Unauthorized Weekend Branch Absence',
    amountKes: 2300,
    incidentDate: '2026-09-26',
    referenceDocNumber: 'HR-DISC-0926',
    reason: 'Unexcused absence during Saturday morning stock replenishment rush.',
    isPenalty: true,
    status: 'APPLIED',
    createdAt: '2026-09-26T10:00:00Z'
  },
  {
    id: 'ded-short-003',
    payrollId: 'pay-emp-1791123659015-zeo2-sep',
    employeeId: 'emp-1791123659015-zeo2',
    employeeName: 'Peter Kaluma',
    monthYear: 'September 2026',
    type: 'CASH_SHORTAGE',
    title: 'Dispatch Delivery Cash Discrepancy',
    amountKes: 3500,
    incidentDate: '2026-09-18',
    referenceDocNumber: 'DISP-VAR-18',
    reason: 'Cash collection remittance shortage following route van dispatch.',
    isPenalty: true,
    status: 'APPLIED',
    createdAt: '2026-09-18T16:00:00Z'
  },
  {
    id: 'ded-adv-001',
    payrollId: 'pay-emp-06624-sep',
    employeeId: 'emp-06624',
    employeeName: 'Peter Omboga',
    monthYear: 'September 2026',
    type: 'SALARY_ADVANCE',
    title: 'Mid-Month Salary Advance',
    amountKes: 5000,
    incidentDate: '2026-09-15',
    referenceDocNumber: 'ADV-SEP-15',
    reason: 'Emergency medical advance requested and disbursed via M-Pesa.',
    isPenalty: false,
    status: 'RECONCILED',
    reconciledBy: 'Corporate Accountant',
    reconciledAt: '2026-09-30T10:00:00Z',
    recoveryAccountCode: '1050',
    journalEntryId: 'JE-PAY-ADV-01',
    createdAt: '2026-09-15T12:00:00Z'
  },
  {
    id: 'ded-brk-004',
    employeeId: 'emp-08341',
    employeeName: 'David Ochieng',
    monthYear: 'October 2026',
    type: 'STOCK_BREAKAGE',
    title: 'Transit Breakage: 1 Case Tusker Cider (25 Bottles)',
    amountKes: 4200,
    incidentDate: '2026-10-08',
    referenceDocNumber: 'BRK-VAN-1008',
    reason: 'Unsecured crate stack fell during transit along Thika Superhighway.',
    isPenalty: true,
    status: 'APPLIED',
    createdAt: '2026-10-08T11:20:00Z'
  },
  {
    id: 'ded-short-005',
    employeeId: 'emp-08341',
    employeeName: 'David Ochieng',
    monthYear: 'October 2026',
    type: 'CASH_SHORTAGE',
    title: 'Westlands Route Evening Cash Shortage',
    amountKes: 1500,
    incidentDate: '2026-10-12',
    referenceDocNumber: 'RCU-2026-002-SHORT',
    reason: 'Evening route van reconciliation shortage flagged by route accountant on ROUTE-WESTLANDS-02.',
    isPenalty: true,
    status: 'APPLIED',
    createdAt: '2026-10-12T17:15:00Z'
  }
];

