export type UserRole = 'SUPER_ADMIN' | 'ACCOUNTANT' | 'STAFF';

export type DepartmentType = 
  | 'POS' 
  | 'HR_PAYROLL' 
  | 'FINANCE' 
  | 'BILLING' 
  | 'PROCUREMENT' 
  | 'INVENTORY'
  | 'AFFILIATES'
  | 'DELIVERY_MANAGER'
  | 'SALES_MANAGER'
  | 'BRANCH_MANAGER';

export type BranchTier = 
  | 'WAREHOUSE' 
  | 'MAIN_STORE' 
  | 'DISTRIBUTOR' 
  | 'LIQUOR_STORE';

export type StockCategory = 'IPS' | 'LPS'; // Imported Products Stock vs Local Products Stock

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: DepartmentType;
  branchId: string;
  phone: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  loginPin?: string;
  primaryOrganizationId?: string;
  memberships?: OrganizationMembership[];
}

export type BranchMarketClassTier =
  | 'AFFLUENT_PREMIUM' // Prime / Affluent neighbourhoods (e.g. Kilimani, Westlands, Karen, Runda, Muthaiga)
  | 'UPMARKET_URBAN' // Upmarket Urban (e.g. Lavington, Kileleshwa, Riverside, Nyali)
  | 'STANDARD_RESIDENTIAL' // Standard Urban / Mid-Market (e.g. Nairobi CBD, Thika Road, Syokimau, Langata)
  | 'EASTLANDS_ECONOMY' // High-Volume Value / Neighbourhood Class (e.g. Donholm, Buruburu, Umoja, Embakasi, Kasarani)
  | 'CUSTOM'; // Custom branch preferred pricing

export interface BranchProductPriceOverride {
  retailPriceKes?: number;
  wholesalePriceKes?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  tier: BranchTier;
  location: string;
  county: string;
  contactPhone: string;
  kraPin: string;
  managerName: string;
  organizationId?: string; // Links branch to its parent Organization (Merchant, Distributor, or Retailer)
  organizationType?: OrganizationType;
  parentBranchId?: string; // Shops (LIQUOR_STORE) are strictly created under a Branch (DISTRIBUTOR Merchant or MAIN_STORE Main Branch Head Office)
  parentBranchName?: string; // Resolved name of the parent Branch (Merchant or Main Branch Head Office)
  isHeadOffice?: boolean; // True for the Main Branch (Head Office)
  minWholesaleThresholdKes?: number; // e.g. KES 50,000 for Main Branch (Head Office)
  allowDirectSales: boolean; // false for WAREHOUSE
  latitude?: number; // GPS Latitude for Nearest-Branch Haversine routing
  longitude?: number; // GPS Longitude for Nearest-Branch Haversine routing
  maxDeliveryRadiusKm?: number; // Maximum delivery coverage radius in km (e.g. 15 km)
  deliveryZones?: string[]; // Assigned delivery estates / service zones
  marketClassTier?: BranchMarketClassTier; // Neighbourhood market class tier (e.g. Kilimani/Westlands vs Donholm)
  priceMultiplierPercent?: number; // Branch-wide % adjustment relative to baseline price (e.g. +15 for Kilimani/Westlands, -10 for Donholm)
  preferredProductPrices?: Record<string, BranchProductPriceOverride>; // Per-product branch preferred selling prices (KES)
}

export interface Product {
  id: string;
  sku: string;
  barcode: string; // Bottle barcode
  caseBarcode: string; // Master case barcode
  name: string;
  category: StockCategory; // IPS or LPS
  brand: string;
  volumeMl: number; // e.g. 750, 1000, 500, 330
  alcoholPercentage: number; // e.g. 40%, 4.2%
  packSize: number; // e.g. 12 bottles per case, 24 cans per case
  countryOfOrigin: string; // Kenya, Scotland, France, Ireland
  
  // Pricing tiers (KES)
  warehouseCostKes: number; // Cost of acquisition / import
  wholesalePriceKes: number; // For Main Store & Distributors
  retailPriceKes: number; // Standard shelf price at Liquor Stores
  minWholesaleQty: number; // Minimum bottles for wholesale
  
  // Kenyan Tax Compliance
  vatRate: number; // 0.16 (16%)
  exciseDutyPerLitreKes: number; // KRA alcohol excise rate
  importDeclarationNumber?: string; // For IPS
  kraExciseStampType: 'DIGITAL_EXCISE_STAMP' | 'IMPORT_DUTY_STAMP';

  // Linked Archive Invoice Metadata
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  linkedInvoiceDate?: string;

  // Internal Provenance & Master Barcode Quality Governance (kept strictly internal to ERP)
  sourceUrl?: string;
  subCategory?: string;
  barcodeVerificationStatus?:
    | 'APPROVED_MASTER'
    | 'REMEDIATED_CHECK_DIGIT'
    | 'REMEDIATED_DUPLICATE'
    | 'REMEDIATED_FORMAT'
    | 'UNVERIFIED_SOURCE';
  internalProvenance?: {
    source: string;
    observationDate: string;
    sourceUrl?: string;
    rawSourceBarcode?: string;
    rawSourceCaseBarcode?: string;
    photographyRightsVerified: boolean;
    contentLicenseStatus: 'FIRST_PARTY_NORMALIZED' | 'THIRD_PARTY_OBSERVATION_ONLY' | 'LICENSED';
  };

  // Cream Liqueur & Shelf-Life / Temperature-Sensitivity ERP Tracking
  isCreamBased?: boolean; // True for dairy/cream liqueurs (Baileys, Amarula, Sheridan's, Tequila Rose, Strawberry Lips, Best Marula Cream)
  requiresBatchExpiryTracking?: boolean; // Enforces FEFO (First-Expired, First-Out) rotation alerts
  recommendedShelfLifeMonths?: number; // e.g. 24 months for Cream Liqueurs
  maxStorageTempCelsius?: number; // e.g. 25°C warehouse temperature threshold
  manufactureDate?: string; // Batch manufacturing date (YYYY-MM-DD)
  defaultExpiryDate?: string; // Default batch expiry date (YYYY-MM-DD)

  image?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  branchId: string;
  bottlesOnHand: number;
  casesOnHand: number;
  reorderLevel: number;
  batchNumber: string;
  manufactureDate?: string;
  expiryDate: string;
  lastScannedAt: string;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
}

export interface BarcodeScanRecord {
  id: string;
  rawBarcode: string;
  scannedAt: string;
  scannerUserId: string;
  branchId: string;
  type: 'SINGLE_BOTTLE' | 'MASTER_CASE';
  status: 'ACCEPTED' | 'DUPLICATE_BLOCKED' | 'UNKNOWN';
  productId?: string;
  productName?: string;
  unpackedBottles?: number;
  previousBottlesOnHand?: number;
  newBottlesOnHand?: number;
  assetValueAddedKes?: number;
  duplicateDetails?: string;
  batchId: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  companyUnitPrice?: number; // Immutable company baseline price per unit (KES)
  unitPrice: number; // Effective selling price per unit (Affiliate preferred price or company price)
  costPrice: number;
  vatAmount: number;
  companyTotalAmount?: number; // Company sales portion (companyUnitPrice * quantity)
  totalAmount: number; // Total customer paid for line (unitPrice * quantity)
  affiliateMarkupPerUnit?: number; // Preferred price profit per unit (unitPrice - companyUnitPrice)
  affiliateProfitAmount?: number; // Total separated affiliate profit on this line
  stockBeforeSale?: number; // Exact bottles available at branch before sale
  stockAfterSale?: number; // Exact bottles remaining at branch after sale subtraction
  assetValueDeductedKes?: number; // Cost asset value subtracted (quantity * costPrice)
}

export interface SaleOrder {
  id: string;
  orderNumber: string; // e.g. ORD-2026-0041 or WEB-2026-301
  orderSource?: 'POS' | 'WEBSITE'; // Identifies whether sale came from POS or User-Facing Website
  deliveryAddress?: string; // Customer delivery location for Website orders
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  consumerId?: string; // First-class Consumer identity reference
  organizationId?: string; // Fulfilling Organization (Retailer, Distributor, or Merchant)
  buyerOrganizationId?: string; // Buying Organization for B2B wholesale orders
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerKraPin?: string;
  saleType: 'RETAIL' | 'WHOLESALE';
  items: SaleItem[];
  subtotalKes: number; // Company taxable net (excl. VAT)
  vatAmountKes: number; // Company 16% VAT (on company price)
  exciseAmountKes: number;
  companySalesKes?: number; // Total company sales at company baseline price (separated from affiliate profit)
  totalKes: number; // Total gross customer paid (companySalesKes + affiliateMarkupTotalKes)
  affiliateMarkupTotalKes: number; // Separated affiliate profit from selling at preferred price
  affiliateBaseCommissionKes?: number; // Base % commission earned from commission setting
  affiliateTotalEarnedKes?: number; // Total affiliate earnings (preferred price profit + base commission)
  companySalesTotal?: number;
  totalAmount?: number;
  affiliateMarkupTotal?: number;
  affiliateProfitAmount?: number;
  affiliateBaseCommissionAmount?: number;
  affiliateCommissionAmount?: number;
  affiliateCommissionRate?: number;
  affiliateId?: string;
  affiliateName?: string;
  paymentMethod: 'MPESA' | 'CASH' | 'SPLIT' | 'BANK_TRANSFER';
  paymentStatus: 'PAID' | 'PENDING' | 'RECONCILED' | 'OFFLINE_QUEUED';
  authoritativeStatus?:
    | 'AUTHORITATIVE_COMMITTED'
    | 'OFFLINE_QUEUED'
    | 'PENDING_RECONCILIATION'
    | 'RECONCILIATION_FAILED';
  idempotencyKey?: string;
  mpesaReceiptNumber?: string;
  createdAt: string;
  etimsInvoiceNumber: string;
  etimsQrPayload: string;
  etimsTransmitted: boolean;
}

export interface OfflineQueuedCheckoutPayload {
  idempotencyKey: string;
  branchId: string;
  branchName: string;
  saleType: 'RETAIL' | 'WHOLESALE';
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    affiliateMarkupPerUnit?: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerKraPin?: string;
  paymentMethod: 'MPESA' | 'CASH' | 'SPLIT' | 'BANK_TRANSFER';
  mpesaPhone?: string;
  mpesaReceiptNumber?: string;
  servedByName?: string;
  queuedOrderId: string;
  queuedInvoiceId: string;
  queuedAt: string;
  retryCount: number;
  lastError?: string;
}

export type WebsiteDeliveryOrderStatus =
  | 'ON_HOLD_PENDING_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED_AWAITING_PAYMENT'
  | 'COMPLETED_AND_PAID';

export type BranchRoutingModel =
  | 'GPS_HAVERSINE'
  | 'SERVICE_ZONE_GEOFENCE'
  | 'STOCK_AWARE_FALLBACK'
  | 'MANUAL_SELECTION';

export interface WebsiteDeliveryOrder {
  id: string;
  orderNumber: string; // e.g. WEB-2026-301
  consumerId?: string; // First-class Consumer identity reference
  retailerOrganizationId?: string; // Fulfilling Retailer / Merchant Organization ID
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  deliveryLocation: string;
  deliveryNotes?: string;
  branchId: string;
  branchName: string;
  customerLatitude?: number;
  customerLongitude?: number;
  distanceKm?: number;
  estimatedEtaMinutes?: number;
  routingModel?: BranchRoutingModel;
  items: {
    product: Product;
    quantity: number;
    companyUnitPrice: number; // Strictly Company Price (no sales affiliate markup)
    preferredSellingUnitPrice?: number; // Optional Affiliate Preferred Price when sold via Sales Network
    totalAmount: number;
  }[];
  totalCompanyPriceKes: number; // Strictly Company Price
  grossSoldPriceKes?: number; // Gross customer price when sold via VAAIRO Sales Network
  affiliateId?: string;
  affiliateName?: string;
  affiliateCode?: string;
  salesNetworkCustomerId?: string;
  affiliateMarkupProfitKes?: number;
  affiliateBaseCommissionKes?: number;
  deliveryStatus: WebsiteDeliveryOrderStatus;
  riderName?: string;
  riderPhone?: string;
  createdAt: string;
  deliveredAt?: string;
  paidAt?: string;
  paymentPhone?: string;
  mpesaReceiptNumber?: string;
  completedSaleOrderId?: string;
  etimsInvoiceNumber?: string;
}

export interface ETimsInvoice {
  id: string;
  invoiceNumber: string; // e.g. KRA-ETIMS-2026-INV-8910
  orderId: string;
  branchId: string;
  sellerPin: string;
  sellerName: string;
  buyerPin?: string;
  buyerName?: string;
  servedBy?: string;
  deviceSerialNumber: string; // OSCU / VSCU
  cuSerialNumber: string; // Control Unit
  qrCodeUrl: string;
  kraControlCode: string;
  invoiceDate: string;
  taxableAmount: number;
  taxAmount: number;
  totalInvoiceAmount: number;
  transmissionStatus: 'TRANSMITTED' | 'QUEUED' | 'VERIFIED';
}

export type CounterQueueStatus =
  | 'QUEUED_AT_COUNTER'
  | 'PREPARING_DRINKS'
  | 'READY_FOR_COLLECTION'
  | 'ON_HOLD_PENDING_PAYMENT'
  | 'COLLECTED_AND_PAID';

export type QueuePaymentOption =
  | 'PAY_ON_COLLECTION'
  | 'PRINT_RECEIPT_AND_HOLD';

export interface HeldCart {
  id: string;
  holdNumber: string; // e.g. HOLD-101 or QUE-101
  branchId: string;
  heldById: string;
  heldByName: string;
  submittedByRole?: 'SALES_LADY' | 'COUNTER_CASHIER';
  queueStatus?: CounterQueueStatus;
  paymentOption?: QueuePaymentOption;
  receiptPrinted?: boolean;
  preparedByCashierName?: string;
  readyAt?: string;
  targetCashierId?: string;
  targetCashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerKraPin?: string;
  note?: string;
  affiliateId?: string;
  affiliateName?: string;
  items: {
    product: Product;
    quantity: number;
    unitPrice: number;
    affiliateMarkupPerUnit: number;
  }[];
  totalKes: number;
  createdAt: string;
}

export interface MpesaTransaction {
  id: string;
  receiptNumber: string; // e.g. TI84XJ90K2
  transactionType: 'Paybill' | 'Buy Goods Till' | 'B2C Payout';
  phoneNumber: string; // 2547XXXXXXXX
  customerName: string;
  amountKes: number;
  shortCode: string; // e.g. 4082211
  billRefNumber?: string; // Order / Invoice reference
  timestamp: string;
  status: 'COMPLETED' | 'PENDING' | 'RECONCILED';
  matchedInvoiceId?: string;
  matchedOrderNumber?: string;
  autoReconciled: boolean;
}

export type StaffEmploymentStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export type AffiliateCommissionMode =
  | 'PREFERRED_PRICE_PROFIT_ONLY'
  | 'COMMISSION_AND_PROFIT'
  | 'BASE_COMMISSION_ONLY';

export interface Affiliate {
  id: string;
  name: string;
  code: string; // e.g. 'SL-SARAH-01'
  phone: string;
  branchId: string; // Associated liquor store
  assignedCashierId?: string; // Specific POS Cashier this Sales Lady works under
  assignedCashierName?: string;
  employmentType?: 'CASUAL' | 'SALARIED'; // Casual employee (not on monthly salary)
  compensationModel?: 'COMMISSION_ONLY'; // Works on commission
  commissionRatePercent?: number; // Base commission % setting on company baseline sales
  commissionMode?: AffiliateCommissionMode; // How affiliate earnings are computed
  allowPreferredPrice?: boolean; // Option to allow selling with preferred price without affecting company price
  preferredPrices?: Record<string, number>; // Optional per-product preferred selling prices (productId -> KES)
  customSlug: string; // e.g. sarah-spirits
  loginPin: string; // 6-digit login PIN created for this affiliate lady
  pinHash?: string; // PBKDF2-SHA256 derived PIN hash preserved across cloud sync
  pinSalt?: string; // Unique per-record cryptographic salt preserved across cloud sync
  totalSalesKes: number; // Gross customer sales handled (at preferred selling price)
  companySalesTotalKes?: number; // Separated company sales portion (at fixed company price)
  preferredPriceProfitTotalKes?: number; // Separated affiliate profit from selling at preferred price
  baseCommissionTotalKes?: number; // Base % commission earned on company sales
  totalCommissionEarnedKes: number; // Total earned by affiliate (preferredPriceProfit + baseCommission)
  paidCommissionKes: number;
  pendingCommissionKes: number;
  mpesaNumber: string;
  active: boolean;
  employmentStatus?: StaffEmploymentStatus;
  suspendedAt?: string;
  suspensionReason?: string;
  terminatedAt?: string;
  terminationReason?: string;
}

export interface CommissionRecord {
  id: string;
  affiliateId: string;
  affiliateName: string;
  recipientRole?: 'AFFILIATE_SALES_LADY' | 'POS_CASHIER';
  commissionType?: 'MARKUP_AND_COMMISSION' | 'PREFERRED_PRICE_PROFIT' | 'POS_CASHIER_COMMISSION';
  commissionMode?: AffiliateCommissionMode;
  commissionRatePercent?: number;
  orderId: string;
  orderNumber: string;
  baselinePriceKes: number; // Company Sales amount (at Company Price)
  soldPriceKes: number; // Gross Sold amount (at Affiliate Preferred Price)
  preferredPriceProfitKes?: number; // Separated profit from preferred price (soldPriceKes - baselinePriceKes)
  baseCommissionKes?: number; // Base % commission from commission setting
  markupEarnedKes: number; // Total profit/commission earned by the affiliate on this sale
  status: 'PENDING' | 'PAID';
  createdAt: string;
  payoutMpesaRef?: string;
}

export interface RestockRequest {
  id: string;
  requestNumber: string;
  fromBranchId: string; // Receiving / Requesting Shop or Distributor
  fromBranchName: string;
  toBranchId: string; // Supplying Warehouse (Main Store) or Distributor
  toBranchName: string;
  requestedBy: string;
  initiationType?: 'SHOP_REFILL_REQUEST' | 'WAREHOUSE_AUTO_DISBURSE' | 'WAREHOUSE_CONTROLLER_PUSH';
  urgency?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STANDARD_REFILL';
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'REJECTED';
  items: {
    productId: string;
    productName: string;
    sku: string;
    casesRequested: number;
    bottlesTotal: number;
  }[];
  removedItems?: {
    productId: string;
    productName: string;
    sku: string;
    casesRequested: number;
    reason?: string;
  }[];
  editedByController?: string;
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  acceptedBy?: string;
}

// HR & Payroll Types
export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  roleTitle: string;
  department: DepartmentType;
  employmentType?: 'CASUAL' | 'SALARIED'; // POS Cashier & Affiliate Sales Lady are CASUAL and not on salary
  compensationModel?: 'COMMISSION_ONLY' | 'MONTHLY_SALARY'; // Casual POS Cashiers & Affiliate Sales Ladies work on commission
  commissionRatePercent?: number; // Sales commission % for Casual POS Cashiers (e.g. 3%)
  totalSalesKes?: number;
  totalCommissionEarnedKes?: number;
  paidCommissionKes?: number;
  pendingCommissionKes?: number;
  branchId: string;
  loginPin: string; // 6-digit login PIN created for this staff user
  pinHash?: string; // PBKDF2-SHA256 derived PIN hash preserved across cloud sync
  pinSalt?: string; // Unique per-record cryptographic salt preserved across cloud sync
  basicSalaryKes: number;
  houseAllowanceKes: number;
  transportAllowanceKes: number;
  kraPin: string;
  nssfNumber: string;
  nhifShifNumber: string;
  bankAccount: string;
  bankName: string;
  mPesaNumber: string;
  active: boolean;
  employmentStatus?: StaffEmploymentStatus;
  suspendedAt?: string;
  suspensionReason?: string;
  terminatedAt?: string;
  terminationReason?: string;
}

export interface PayrollRecord {
  id: string;
  monthYear: string; // e.g. "September 2026"
  employeeId: string;
  employeeName: string;
  department: DepartmentType;
  basicSalaryKes: number;
  allowancesKes: number;
  grossSalaryKes: number;
  payeKes: number; // Income tax to KRA
  nssfKes: number; // Tier I + II
  shifKes: number; // 2.75%
  housingLevyKes: number; // 1.5%
  netSalaryKes: number;
  paymentStatus: 'DRAFT' | 'PROCESSED' | 'SYNCED_TO_LEDGER';
  syncedJournalEntryId?: string;
  processedAt: string;
}

// Double-Entry Accounting Ledgers
export type AccountType = 
  | 'ASSET' 
  | 'LIABILITY' 
  | 'EQUITY' 
  | 'REVENUE' 
  | 'COGS' 
  | 'EXPENSE';

export interface ChartAccount {
  code: string; // e.g. "1010", "4010"
  name: string;
  type: AccountType;
  balanceKes: number; // Normal balance (Dr for Asset/Expense, Cr for Liab/Equity/Rev)
  description?: string;
  kraTaxMappable?: boolean;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debitKes: number;
  creditKes: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  referenceType: 'SALE_ETIMS' | 'PAYROLL_RUN' | 'MPESA_RECONCILIATION' | 'INVENTORY_PURCHASE' | 'MANUAL';
  referenceId: string;
  description: string;
  lines: JournalLine[];
  totalDebitKes: number;
  totalCreditKes: number;
  postedBy: string;
  branchId?: string;
}

// Supplier & Vendor Management
export type SupplierCategory = 'LOCAL_DISTILLERY' | 'IMPORT_AGENT' | 'BONDED_IMPORTER' | 'PACKAGING_LOGISTICS';
export type SupplierPaymentTerms = 'NET_15' | 'NET_30' | 'NET_60' | 'IMMEDIATE_CASH' | 'CONSIGNMENT';

export interface Supplier {
  id: string;
  code: string; // e.g. SUP-EABL-01
  name: string; // e.g. East African Breweries Ltd (EABL)
  kraPin: string; // e.g. P051123456Z
  category: SupplierCategory;
  contactPerson: string;
  email: string;
  phone: string;
  physicalAddress: string;
  county: string;
  paymentTerms: SupplierPaymentTerms;
  creditLimitKes: number;
  currentOutstandingKes: number;
  bankName: string;
  bankAccountNumber: string;
  active: boolean;
}

// Commercial Wholesale Distributors
export type DistributorTier = 'TIER_1_SUPER_WHOLESALER' | 'TIER_2_REGIONAL_DEPOT' | 'TIER_3_SUB_DISTRIBUTOR';
export type DistributorPaymentTerms = 'CASH_ON_DELIVERY' | 'NET_7' | 'NET_14' | 'NET_30';

export interface CommercialDistributor {
  id: string;
  code: string; // e.g. DST-RIFT-001
  companyName: string;
  kraPin: string;
  licenseNumber: string; // e.g. KRA-EXCISE-LIC-2026-991
  contactPerson: string;
  phone: string;
  email: string;
  county: string;
  region: string;
  tier: DistributorTier;
  creditLimitKes: number;
  currentReceivableKes: number;
  paymentTerms: DistributorPaymentTerms;
  active: boolean;
}

// Supply Invoices & Packing Lists (Inbound Stocking)
export interface SupplyInvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  category: StockCategory;
  casesSupplied: number;
  bottlesPerCase: number;
  totalBottles: number;
  unitCostKes: number;
  totalCostKes: number;
  vatAmountKes: number;
  batchNumber: string;
  expiryDate: string;
}

export interface SupplyInvoice {
  id: string;
  invoiceNumber: string; // e.g. SUP-INV-2026-0812
  supplierId: string;
  supplierName: string;
  supplierPin: string;
  branchId: string;
  branchName: string;
  deliveryDate: string;
  subtotalKes: number;
  vatKes: number;
  exciseDutyKes: number;
  totalAmountKes: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL';
  paymentMethod?: 'BANK_TRANSFER' | 'RTGS' | 'CHEQUE' | 'MPESA';
  // Packing list specifics
  packingListNumber: string; // e.g. PKL-2026-998
  containerNumber?: string;
  truckRegistration?: string;
  driverName?: string;
  driverNationalId?: string;
  sealNumber?: string;
  inspectorName?: string;
  items: SupplyInvoiceItem[];
  notes?: string;
  createdAt: string;
  syncedToLedger: boolean;
}

// Commercial Quotations / Proforma Invoices
export interface QuoteItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  cases?: number;
  totalBottles?: number;
  unitPriceKes: number;
  vatAmountKes: number;
  totalAmountKes: number;
}

export interface CommercialQuote {
  id: string;
  quoteNumber: string; // e.g. QT-2026-1042
  distributorOrClientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientKraPin?: string;
  distributorId?: string;
  branchId: string;
  branchName: string;
  issueDate: string;
  validUntil: string;
  items: QuoteItem[];
  subtotalKes: number;
  vatKes: number;
  totalKes: number;
  paymentTerms: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED_TO_INVOICE' | 'EXPIRED';
  convertedInvoiceNumber?: string;
  notes?: string;
}

// Commercial Sales Invoices (B2B Billing)
export interface CommercialInvoice {
  id: string;
  invoiceNumber: string; // e.g. B2B-INV-2026-302
  distributorId?: string;
  clientName: string;
  clientPhone: string;
  clientKraPin?: string;
  branchId: string;
  branchName: string;
  items: QuoteItem[];
  subtotalKes: number;
  vatKes: number;
  totalKes: number;
  issueDate: string;
  dueDate: string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paidAmountKes: number;
  paymentMethod?: 'MPESA' | 'BANK_TRANSFER' | 'CASH';
  etimsInvoiceNumber?: string;
  etimsTransmitted: boolean;
  notes?: string;
}

// Employee Leave Requests (Requested by Employees -> Reviewed by HR)
export type EmployeeLeaveType =
  | 'ANNUAL_LEAVE'
  | 'SICK_LEAVE'
  | 'MATERNITY_PATERNITY'
  | 'COMPASSIONATE_LEAVE'
  | 'EMERGENCY_LEAVE';

export type EmployeeLeaveStatus = 'PENDING_HR' | 'APPROVED' | 'REJECTED';

export interface EmployeeLeaveRequest {
  id: string;
  requestNumber: string; // e.g. LVE-2026-101
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: DepartmentType;
  branchId: string;
  branchName: string;
  leaveType: EmployeeLeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  handoverPersonName?: string;
  status: EmployeeLeaveStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  hrReviewNotes?: string;
}

// Sales Representative Off-Duty Requests (Requested by Sales Reps -> Reviewed by Sales Manager)
export type SalesRepOffDutyType =
  | 'SHIFT_OFF_DUTY'
  | 'REST_DAY'
  | 'PERSONAL_OFF_DUTY'
  | 'MEDICAL_OFF_DUTY';

export type SalesRepOffDutyStatus = 'PENDING_SALES_MANAGER' | 'APPROVED' | 'REJECTED';

export interface SalesRepOffDutyRequest {
  id: string;
  requestNumber: string; // e.g. OFF-2026-201
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  branchId: string;
  branchName: string;
  assignedCashierName?: string;
  offDutyType: SalesRepOffDutyType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOrShiftsCount: number;
  reason: string;
  coveringRepName?: string;
  status: SalesRepOffDutyStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  managerReviewNotes?: string;
}

// ==========================================
// ADMIN SETTINGS: BRAND, LOGO/FAVICON, PRICING, OFFERS, CAMPAIGNS, PROMOTIONS & ERP CONFIG
// ==========================================

export interface BrandPriceRule {
  id: string;
  brandName: string;
  category: StockCategory;
  countryOfOrigin: string;
  defaultVolumeMl: number;
  volumeMl?: number;
  defaultPackSize: number;
  baselineWarehouseCostKes: number;
  baselineWholesalePriceKes: number;
  baselineRetailPriceKes: number;
  warehouseCostKes?: number;
  wholesalePriceKes?: number;
  retailPriceKes?: number;
  minWholesaleQty: number;
  active: boolean;
  updatedAt: string;
}

export interface SpecialOfferSetting {
  id: string;
  title: string;
  offerType: 'DISCOUNT_PRICE' | 'PERCENTAGE_OFF' | 'BUY_X_GET_Y' | 'CASE_BUNDLE_DEAL' | 'HAPPY_HOUR';
  targetScope: 'PRODUCT' | 'BRAND' | 'CATEGORY' | 'ALL_CATALOG';
  targetProductId?: string;
  targetProductName?: string;
  targetBrand?: string;
  discountPercent?: number;
  offerPriceKes?: number;
  minQuantity: number;
  freeQuantity?: number;
  channel: 'ALL' | 'POS_ONLY' | 'STOREFRONT_ONLY';
  badgeLabel: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface MarketingCampaignSetting {
  id: string;
  name: string;
  campaignCode: string;
  headline: string;
  description: string;
  targetChannel: 'OMNICHANNEL' | 'POS_BRANCHES' | 'ONLINE_STOREFRONT' | 'WHOLESALE_DISTRIBUTORS';
  featuredBrand?: string;
  budgetKes: number;
  targetRevenueKes: number;
  bannerColor: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface PromotionSetting {
  id: string;
  name: string;
  promoCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_KES';
  discountValue: number;
  minOrderAmountKes: number;
  applicableBrand?: string;
  applicableCategory: 'ALL' | 'IPS' | 'LPS';
  autoApplyAtPos: boolean;
  validUntil: string;
  active: boolean;
}

export interface ErpSystemSettings {
  // Brand & Identity
  brandName: string;
  brandBadge: string;
  brandTagline: string;
  legalCompanyName: string;
  storefrontTitle: string;
  supportPhone: string;
  supportEmail: string;
  headOfficeAddress: string;
  primaryColorHex: string;
  accentColorHex: string;
  secondaryColorHex: string;

  // Logo & Favicon
  logoUrl: string;
  faviconUrl: string;
  showBrandScannerEffect: boolean;

  // Tax, KRA eTIMS & M-Pesa Daraja
  companyKraPin: string;
  exciseLicenseNumber: string;
  defaultVatRatePercent: number;
  defaultExciseDutyPerLitreKes: number;
  etimsDeviceSerial: string;
  etimsCuSerial: string;
  autoTransmitEtims: boolean;
  mpesaPaybillOrTill: string;
  mpesaAccountReferencePrefix: string;

  // POS, Wholesale & Receipt Config
  defaultMinWholesaleKes: number;
  defaultCounterCashierCommissionPercent: number;
  receiptHeaderNote: string;
  receiptFooterMessage: string;
  inactivityTimeoutMinutes: number;
  allowCashierDirectSales: boolean;
  allowCashierReceiveSalesRepOrders: boolean;
}

export type UserActivityActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TAB_NAVIGATION'
  | 'MODULE_NAVIGATION'
  | 'POS_SALE'
  | 'HOLD_CART'
  | 'STOCK_SCAN'
  | 'STOCK_ADJUST'
  | 'PRODUCT_UPDATE'
  | 'STAFF_CREATED'
  | 'PIN_UPDATED'
  | 'PAYROLL_RUN'
  | 'PAYROLL_ACTION'
  | 'COMMISSION_PAYOUT'
  | 'RESTOCK_ACTION'
  | 'DELIVERY_UPDATE'
  | 'STATEMENT_GENERATED'
  | 'BRANCH_CREATED'
  | 'INVOICE_POSTED'
  | 'SYSTEM_SETTINGS_UPDATED'
  | 'SYSTEM_ACTION';

export interface UserActivityLog {
  id: string;
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
  deviceUsed: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  browserOs: string;
  timestamp: string;
}

export interface UserSessionMonitorRecord {
  userId: string;
  userName: string;
  employeeNumberOrCode: string;
  userRole: UserRole;
  department: DepartmentType;
  branchId: string;
  branchName: string;
  isActiveLogin: boolean;
  activeLoginAt?: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  lastHeartbeatAt?: string;
  loginCount: number;
  lastActionTitle?: string;
  lastActionDetails?: string;
  lastActionAt?: string;
  currentModule?: string;
  deviceUsed: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  browserOs: string;
  authMethod?: 'STAFF_PIN' | 'INSTANT_DB_LOGIN' | 'GOOGLE_SSO' | 'ROLE_SWITCH';
  updatedAt: string;
}

export interface ProductRatingRecord {
  id: string; // Deterministic ID per product + rater: `${productId}_${raterKey}`
  productId: string;
  consumerId?: string; // Optional link to first-class Consumer identity
  raterKey: string; // Signed-in customer email/UID or persistent device voter ID
  raterName: string; // Customer name or 'Customer'
  stars: number; // 1 to 5
  comment?: string; // Optional genuine review comment
  isVerifiedBuyer?: boolean; // True if customer ordered this product
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FIRST-CLASS MULTI-TIER NETWORK DOMAIN MODEL:
// 1. Organization Hierarchy:
//    Organization
//    ├── Merchant
//    ├── Distributor
//    ├── Retailer
//    └── Supplier
// 2. Identity & Membership Hierarchy:
//    User -> Membership -> Organization -> Role
// 3. Individual Customer Identity:
//    Consumer
// ============================================================================

export type OrganizationType = 'MERCHANT' | 'DISTRIBUTOR' | 'RETAILER' | 'SUPPLIER';

export type OrganizationStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'INACTIVE';

export type MerchantTier =
  | 'PRIMARY_BRAND_OWNER'
  | 'NATIONAL_WHOLESALE_MERCHANT'
  | 'B2B_CORPORATE_MERCHANT'
  | 'HOSPITALITY_GROUP_MERCHANT';

export type RetailerCategory =
  | 'LIQUOR_STORE'
  | 'WINES_AND_SPIRITS'
  | 'LOUNGE_BAR_RESTAURANT'
  | 'SUPERMARKET_OUTLET'
  | 'CLUB_AND_ENTERTAINMENT';

export interface OrganizationBase {
  id: string;
  code: string; // e.g. ORG-MRC-001, ORG-DST-001, ORG-RTL-001, ORG-SUP-001
  name: string;
  legalName?: string;
  type: OrganizationType;
  status: OrganizationStatus;
  kraPin: string;
  licenseNumber?: string; // KRA Excise / County Liquor License
  contactPerson: string;
  email: string;
  phone: string;
  physicalAddress: string;
  county: string;
  region?: string;
  parentOrganizationId?: string; // e.g. Retailer -> Distributor -> Merchant
  linkedBranchIds?: string[]; // Associated operational Branch IDs
  creditLimitKes: number;
  currentBalanceKes: number; // Receivable (for Merchant/Distributor/Retailer) or Payable (for Supplier)
  paymentTerms: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Merchant extends OrganizationBase {
  type: 'MERCHANT';
  merchantTier: MerchantTier;
  settlementBankName?: string;
  settlementAccountNumber?: string;
  mpesaShortCode?: string;
  defaultWholesaleDiscountPercent?: number;
  authorizedDistributorIds?: string[];
  authorizedRetailerIds?: string[];
}

export interface DistributorOrganization extends OrganizationBase {
  type: 'DISTRIBUTOR';
  distributorTier: DistributorTier;
  paymentTerms: DistributorPaymentTerms;
  assignedTerritoryRegions: string[];
  suppliedRetailerIds?: string[];
  legacyDistributorId?: string; // Links 1:1 with CommercialDistributor.id
}

export interface Retailer extends OrganizationBase {
  type: 'RETAILER';
  retailerCategory: RetailerCategory;
  countyLiquorLicenseNumber: string;
  parentDistributorId?: string;
  parentMerchantId?: string;
  primaryBranchId?: string; // Links to Branch (tier === 'LIQUOR_STORE' | 'MAIN_STORE')
  posTerminalEnabled: boolean;
  storefrontDeliveryEnabled: boolean;
  minRestockOrderKes?: number;
  latitude?: number;
  longitude?: number;
  maxDeliveryRadiusKm?: number;
  deliveryZones?: string[];
}

export interface SupplierOrganization extends OrganizationBase {
  type: 'SUPPLIER';
  supplierCategory: SupplierCategory;
  paymentTerms: SupplierPaymentTerms;
  bondedWarehouseCode?: string;
  importPermitNumber?: string;
  bankName: string;
  bankAccountNumber: string;
  legacySupplierId?: string; // Links 1:1 with Supplier.id
}

export type Organization =
  | Merchant
  | DistributorOrganization
  | Retailer
  | SupplierOrganization;

export type OrganizationRole =
  | 'ORG_OWNER'
  | 'ORG_ADMIN'
  | 'FINANCE_ACCOUNTANT'
  | 'OPERATIONS_MANAGER'
  | 'SALES_MANAGER'
  | 'BRANCH_MANAGER'
  | 'PROCUREMENT_OFFICER'
  | 'INVENTORY_CONTROLLER'
  | 'POS_CASHIER'
  | 'AFFILIATE_REP'
  | 'DELIVERY_COURIER'
  | 'B2B_BUYER'
  | 'VIEWER';

export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';

/**
 * Represents the relational link:
 * User -> Membership -> Organization -> Role
 */
export interface OrganizationMembership {
  id: string; // Deterministic ID: `mem_${userId}_${organizationId}`
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: OrganizationRole;
  erpRole: UserRole; // Maps to SUPER_ADMIN | ACCOUNTANT | STAFF for backward compatibility
  department?: DepartmentType;
  assignedBranchIds: string[];
  defaultBranchId?: string;
  customPermissions?: string[];
  status: MembershipStatus;
  joinedAt: string;
  updatedAt: string;
}

export type ConsumerLoyaltyTier = 'STANDARD' | 'SILVER' | 'GOLD' | 'VIP_PRIVATE_CLIENT';

/**
 * First-class individual customer identity for B2C Storefront & Retail POS buyers.
 * Distinct from B2B Organizations (Merchant, Distributor, Retailer, Supplier).
 */
export interface Consumer {
  id: string; // e.g. `con_${normalizedPhoneOrUid}`
  consumerCode: string; // e.g. CON-2026-0001
  authUid?: string; // Optional Firebase Auth UID when signed in
  fullName: string;
  phone: string;
  email?: string;
  kraPin?: string; // Optional for consumers requesting eTIMS buyer PIN on receipts
  ageVerified: boolean; // Mandatory 18+ alcoholic beverage compliance
  defaultDeliveryLocation?: string;
  defaultDeliveryNotes?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  preferredBranchId?: string;
  preferredRetailerId?: string;
  loyaltyPoints: number;
  loyaltyTier: ConsumerLoyaltyTier;
  totalOrdersCount: number;
  lifetimeSpendKes: number;
  lastOrderAt?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SalesNetworkCustomerSegment =
  | 'RETAIL_CONSUMER'
  | 'BAR_LOUNGE'
  | 'EVENT_PLANNER'
  | 'CORPORATE_B2B'
  | 'VIP_PRIVATE_CLIENT';

/**
 * VAAIRO Sales Network — Customer Onboarded & Managed by a Sales Representative / Affiliate.
 * Tracks separated Company Sales, Affiliate Preferred Price Markup, and Base Commissions per customer.
 */
export interface SalesNetworkCustomer {
  id: string;
  customerCode: string; // e.g. SNC-2026-001
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  branchId: string;
  customerName: string;
  businessOrVenueName?: string;
  segment: SalesNetworkCustomerSegment;
  phone: string;
  email?: string;
  kraPin?: string;
  defaultDeliveryLocation: string;
  defaultDeliveryNotes?: string;
  totalOrdersCount: number;
  grossSpendKes: number; // Total paid by customer at Preferred Selling Price
  companySalesKes: number; // Protected Company Base Sales portion
  affiliateMarkupProfitKes: number; // Separated Preferred Price Markup earned by agent
  affiliateBaseCommissionKes: number; // Base % commission earned by agent
  active: boolean;
  onboardedAt: string;
  lastOrderAt?: string;
}

/**
 * Real-time Live Logged-In Storefront Customer Session visible to ERP Admins.
 */
export interface LiveLoggedInCustomer {
  uid: string;
  name: string;
  email: string;
  phone: string;
  carrier?: 'SAFARICOM' | 'AIRTEL' | 'TELKOM' | 'UNKNOWN';
  photoURL?: string;
  deliveryZone?: string;
  deliveryStreetAndHouse?: string;
  branchId?: string;
  branchName?: string;
  cartItemsCount: number;
  cartTotalKes: number;
  activeOrdersCount: number;
  status: 'ONLINE' | 'IN_CHECKOUT' | 'ORDER_PLACED';
  loginAt: string;
  lastActiveAt: string;
}








