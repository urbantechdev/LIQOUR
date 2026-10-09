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
  Consumer
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
    id: 'usr-01',
    name: 'System Administrator',
    email: 'support@urbantechdev.com',
    role: 'SUPER_ADMIN',
    department: 'FINANCE',
    branchId: '',
    phone: '+254700000000',
    mfaEnabled: true
  },
  {
    id: 'user-moraasdorcah@gmail.com',
    name: 'Moraa Dorcah (Super Admin)',
    email: 'moraasdorcah@gmail.com',
    role: 'SUPER_ADMIN',
    department: 'BRANCH_MANAGER',
    branchId: '',
    phone: '+254700000001',
    mfaEnabled: true
  },
  {
    id: 'user-muyamoz@gmail.com',
    name: 'Muya Moz (Super Admin)',
    email: 'muyamoz@gmail.com',
    role: 'SUPER_ADMIN',
    department: 'BRANCH_MANAGER',
    branchId: '',
    phone: '+254700000002',
    mfaEnabled: true
  }
];

export const INITIAL_AFFILIATES: Affiliate[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_CHART_OF_ACCOUNTS: ChartAccount[] = [
  { code: '1010', name: 'Cash on Hand - Retail Tills', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1020', name: 'M-Pesa Paybill & Till Clearing Account', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1030', name: 'KCB Corporate Operating Account', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1100', name: 'Accounts Receivable - B2B Merchants', type: 'ASSET', balanceKes: 0, kraTaxMappable: false },
  { code: '1200', name: 'Inventory Asset - Bonded & Duty Paid Stock', type: 'ASSET', balanceKes: 0, kraTaxMappable: true },
  { code: '2010', name: 'Accounts Payable - Distilleries & Importers', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: false },
  { code: '2020', name: 'KRA VAT Output Payable (16%)', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2030', name: 'KRA PAYE & Statutory Deductions Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2040', name: 'SHIF (2.75%) & Affordable Housing Levy Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: true },
  { code: '2050', name: 'Sales Rep Commissions Payable', type: 'LIABILITY', balanceKes: 0, kraTaxMappable: false },
  { code: '3010', name: 'Share Capital & Retained Earnings', type: 'EQUITY', balanceKes: 0, kraTaxMappable: false },
  { code: '4010', name: 'Alcohol Beverage Sales - Retail & Wholesale', type: 'REVENUE', balanceKes: 0, kraTaxMappable: true },
  { code: '5010', name: 'Cost of Goods Sold (COGS) - Excise & Landed Cost', type: 'COGS', balanceKes: 0, kraTaxMappable: true },
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
