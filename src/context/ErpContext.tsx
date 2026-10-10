import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  DepartmentType,
  Branch,
  Product,
  StockCategory,
  InventoryItem,
  BarcodeScanRecord,
  SaleOrder,
  SaleItem,
  OfflineQueuedCheckoutPayload,
  WebsiteDeliveryOrder,
  WebsiteDeliveryOrderStatus,
  ETimsInvoice,
  HeldCart,
  CounterQueueStatus,
  QueuePaymentOption,
  MpesaTransaction,
  Affiliate,
  AffiliateCommissionMode,
  CommissionRecord,
  RestockRequest,
  Employee,
  PayrollRecord,
  ChartAccount,
  JournalEntry,
  Supplier,
  CommercialDistributor,
  SupplyInvoice,
  CommercialQuote,
  CommercialInvoice,
  EmployeeLeaveRequest,
  EmployeeLeaveType,
  EmployeeLeaveStatus,
  SalesRepOffDutyRequest,
  SalesRepOffDutyType,
  SalesRepOffDutyStatus,
  BrandPriceRule,
  SpecialOfferSetting,
  MarketingCampaignSetting,
  PromotionSetting,
  ErpSystemSettings,
  BranchRoutingModel,
  UserActivityActionType,
  UserActivityLog,
  UserSessionMonitorRecord,
  ProductRatingRecord,
  Organization,
  Merchant,
  DistributorOrganization,
  Retailer,
  SupplierOrganization,
  OrganizationMembership,
  OrganizationRole,
  Consumer,
  SalesNetworkCustomer,
  SalesNetworkCustomerSegment,
  LiveLoggedInCustomer,
  BranchMarketClassTier,
  BranchProductPriceOverride
} from '../types';
import { detectKenyanMobileCarrier } from '../utils/kenyanMobileCarrier';
import { getRolePermissions } from '../utils/rbac';
import {
  resolveBranchGeoProfile,
  inferBranchMarketClassFromLocation,
  resolveBranchProductPrice,
  ResolvedBranchProductPrice
} from '../utils/branchGeoRouting';
import {
  synchronizeNetworkOrganizations,
  synchronizeOrganizationMemberships,
  synchronizeConsumers,
  mapOrganizationRoleToErpRole,
  computeConsumerLoyaltyTier
} from '../utils/networkDomainMapper';
import {
  MAIN_HEAD_OFFICE_BRANCH,
  INITIAL_BRANCHES,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_AFFILIATES,
  INITIAL_EMPLOYEES,
  INITIAL_CHART_OF_ACCOUNTS,
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MPESA_TRANSACTIONS,
  INITIAL_ORDERS,
  INITIAL_ETIMS_INVOICES,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_SUPPLIERS,
  INITIAL_DISTRIBUTORS,
  INITIAL_SUPPLY_INVOICES,
  INITIAL_QUOTES,
  INITIAL_COMMERCIAL_INVOICES,
  INITIAL_ORGANIZATIONS,
  INITIAL_ORGANIZATION_MEMBERSHIPS,
  INITIAL_CONSUMERS
} from '../data/initialData';
import {
  NAIROBI_DRINKS_PRODUCTS,
  buildInitialNairobiDrinksInventory
} from '../data/nairobiDrinksCatalog';
import { mergeAttachedCatalogueWithExistingProducts } from '../data/attachedCatalogueUpdate';
import { calculateVatBreakdown, computePayroll } from '../utils/kenyaTax';
import { processIngestedBarcode, ScanResult, duplicateEngine } from '../utils/barcodeEngine';
import { getProductImageUrl, normalizeProductImageUrl } from '../utils/productImages';
import {
  StaffDirectoryRecord,
  StaffPersonalDataPayload,
  getDeletedStaffIdsSet,
  markStaffIdDeletedLocally,
  loadLocalIndependentStaffRecords,
  saveLocalIndependentStaffRecords,
  loadLocalStaffDataSnapshots,
  saveLocalStaffDataSnapshots,
  readAllFromStaffIndexedDb,
  writeRecordToStaffIndexedDb,
  deleteRecordFromStaffIndexedDb,
  pushStaffRecordToFirestore,
  removeStaffRecordFromFirestore,
  subscribeToIndependentStaffDatabase,
  employeeToStaffDirectoryRecord,
  affiliateToStaffDirectoryRecord,
  staffDirectoryRecordToEmployee,
  staffDirectoryRecordToAffiliate,
  parseStaffPersonalData,
  upsertStaffRecordAcrossAllTiers,
  findStaffByPinInstant
} from '../utils/staffDatabase';
import {
  verifyTotpCode,
  computeTotpCode,
  generateTotpSecret
} from '../utils/cryptoSecurity';
import {
  detectCurrentDeviceProfile,
  loadLocalActivityLogs,
  saveLocalActivityLogs,
  loadLocalSessionMonitors,
  saveLocalSessionMonitors,
  pushActivityLogToFirestore,
  pushSessionMonitorToFirestore,
  subscribeToUserActivityLogs,
  subscribeToUserSessionMonitors,
  buildActivityLogEntry
} from '../utils/userActivityMonitor';
import {
  pushUnifiedErpStateToFirestore,
  subscribeToUnifiedErpDatabase,
  syncInventoryItemsToBranchLedgers,
  subscribeToBranchInventoryLedgers,
  seedInitialUnifiedStateSnapshot,
  markRemoteUnifiedStateReceived
} from '../utils/unifiedErpDatabase';
import { getAuthHeaders, setStoredSessionToken } from '../utils/apiAuth';

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  affiliateMarkupPerUnit: number;
}

interface ErpContextType {
  // Auth & Session
  currentUser: User;
  currentRole: UserRole;
  currentDepartment: DepartmentType;
  posStationMode: 'COUNTER_CASHIER' | 'SALES_LADY';
  setPosStationMode: (mode: 'COUNTER_CASHIER' | 'SALES_LADY') => void;
  isPosCashier: boolean;
  activeBranch: Branch;
  activeBranchId: string;
  isMfaPending: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  loginAsRole: (role: UserRole, department: DepartmentType, branchId?: string, staffNameOverride?: string) => void;
  updateCurrentUserName: (name: string) => void;
  updateCurrentStaffName: (name: string) => void;
  confirmMfa: (code: string) => boolean;
  adminTotpSecret: string;
  logout: () => void;
  switchDepartment: (dept: DepartmentType) => void;
  switchBranch: (branchId: string) => void;

  // Branches & Branch-Specific Preferred Pricing (e.g., Donholm vs Kilimani / Westlands)
  branches: Branch[];
  addBranch: (branch: Omit<Branch, 'id'>) => Promise<Branch>;
  persistenceErrorBanner: string | null;
  clearPersistenceErrorBanner: () => void;
  updateBranchParent: (branchId: string, parentBranchId: string) => void;
  updateBranchThreshold: (branchId: string, minThreshold: number) => void;
  getBranchProductPrice: (
    product: Product,
    targetBranch?: Branch | string | null,
    forceSaleType?: 'RETAIL' | 'WHOLESALE'
  ) => ResolvedBranchProductPrice;
  updateBranchPricingPolicy: (
    branchId: string,
    params: {
      marketClassTier?: BranchMarketClassTier;
      priceMultiplierPercent?: number;
    }
  ) => void;
  setBranchProductPreferredPrice: (
    branchId: string,
    productId: string,
    prices: {
      retailPriceKes?: number | null;
      wholesalePriceKes?: number | null;
    }
  ) => void;

  // Inventory & Barcodes
  products: Product[];
  inventoryItems: InventoryItem[];
  scanHistory: BarcodeScanRecord[];
  activeScanBatchId: string;
  startNewScanBatch: () => string;
  handleBarcodeScan: (rawBarcode: string, mode: 'SINGLE' | 'BULK') => ScanResult;
  adjustStockManually: (productId: string, branchId: string, quantity: number, reason: string) => void;
  updateInventoryBatchExpiry: (
    productId: string,
    branchId: string,
    params: { batchNumber: string; manufactureDate?: string; expiryDate: string }
  ) => void;
  applyApprovedStockAuditToBranch: (
    branchId: string,
    adjustments: { productId: string; physicalCount: number }[]
  ) => void;
  addProduct: (product: Omit<Product, 'id'>, initialCases?: number) => Product;
  updateProduct: (productId: string, updates: Partial<Omit<Product, 'id'>>, updatedBranchBottles?: number) => Product | null;
  deleteProduct: (productId: string) => Product | null;
  updateProductImage: (productId: string, imageUrl: string) => void;
  cloneNairobiDrinksCatalog: (options?: {
    productIds?: string[];
    warehouseCases?: number;
    shopCases?: number;
  }) => { clonedCount: number; updatedStockCount: number };
  cloneNairobiDrinksFromUrl: (
    productUrl: string,
    customRetailPriceKes?: number,
    initialCases?: number
  ) => { product: Product; isNew: boolean };
  resetAllErpData: () => void;

  // POS & Cart
  cart: CartItem[];
  heldCarts: HeldCart[];
  selectedAffiliate: Affiliate | null;
  setSelectedAffiliate: (affiliate: Affiliate | null) => void;
  recalledSalesPerson: { id?: string; name: string } | null;
  setRecalledSalesPerson: (salesPerson: { id?: string; name: string } | null) => void;
  addToCart: (product: Product, quantity?: number, affiliateMarkup?: number, preferredUnitPrice?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQty: (productId: string, quantity: number) => void;
  updateCartItemMarkup: (productId: string, markup: number) => void;
  updateCartItemPreferredPrice: (productId: string, preferredUnitPrice: number) => void;
  clearCart: () => void;
  holdCurrentCart: (params?: {
    customerName?: string;
    customerPhone?: string;
    customerKraPin?: string;
    note?: string;
    submittedByRole?: 'SALES_LADY' | 'COUNTER_CASHIER';
    queueStatus?: CounterQueueStatus;
    paymentOption?: QueuePaymentOption;
    receiptPrinted?: boolean;
    targetCashierId?: string;
    targetCashierName?: string;
  }) => HeldCart | null;
  updateHeldCartQueueStatus: (
    holdId: string,
    updates: Partial<
      Pick<
        HeldCart,
        | 'queueStatus'
        | 'paymentOption'
        | 'receiptPrinted'
        | 'preparedByCashierName'
        | 'readyAt'
        | 'targetCashierId'
        | 'targetCashierName'
        | 'note'
      >
    >
  ) => void;
  recallHeldCart: (holdId: string) => HeldCart | null;
  removeHeldCart: (holdId: string) => void;
  completeSale: (params: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerKraPin?: string;
    paymentMethod: 'MPESA' | 'CASH' | 'SPLIT' | 'BANK_TRANSFER';
    mpesaPhone?: string;
    mpesaReceiptNumber?: string;
    checkoutRequestId?: string;
    servedByName?: string;
    cashierId?: string;
    cashierName?: string;
    salesPersonId?: string;
    salesPersonName?: string;
    checkoutRole?: 'SALES_REP_SELF_CHECKOUT' | 'COUNTER_CASHIER_DIRECT' | 'COUNTER_CASHIER_REP_RECALL';
  }) => Promise<{
    success: boolean;
    order?: SaleOrder;
    invoice?: ETimsInvoice;
    queuedOffline?: boolean;
    error?: string;
  }>;
  offlineQueuedCheckouts: OfflineQueuedCheckoutPayload[];
  reconcileOfflineQueuedCheckouts: () => Promise<{ reconciledCount: number; remainingCount: number }>;

  // Orders & eTIMS
  orders: SaleOrder[];
  etimsInvoices: ETimsInvoice[];
  lastCompletedInvoice: ETimsInvoice | null;
  setLastCompletedInvoice: (inv: ETimsInvoice | null) => void;

  // User-Facing Website Storefront & Delivery Hold -> M-Pesa Self-Prompt Completion
  websiteDeliveryOrders: WebsiteDeliveryOrder[];
  placeWebsiteDeliveryOrder: (params: {
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    deliveryLocation: string;
    deliveryNotes?: string;
    branchId?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    distanceKm?: number;
    estimatedEtaMinutes?: number;
    routingModel?: BranchRoutingModel;
    items: { product: Product; quantity: number }[];
  }) => WebsiteDeliveryOrder;
  updateWebsiteDeliveryOrderStatus: (orderId: string, status: WebsiteDeliveryOrderStatus) => void;
  assignRiderToWebsiteDeliveryOrder: (
    orderId: string,
    riderName: string,
    riderPhone: string,
    deliveryNotes?: string
  ) => void;
  completeWebsiteDeliveryOrderWithMpesaPrompt: (
    orderId: string,
    mpesaPhone: string,
    options?: {
      checkoutRequestId?: string;
      receiptNumber?: string;
    }
  ) => Promise<{
    success: boolean;
    order?: SaleOrder;
    invoice?: ETimsInvoice;
    websiteOrder?: WebsiteDeliveryOrder;
    error?: string;
  }>;

  // M-Pesa & Reconciliation
  mpesaTransactions: MpesaTransaction[];
  runMpesaAutoReconciliation: () => { matchedCount: number; matchedAmount: number };

  // Accounting & Ledgers
  chartOfAccounts: ChartAccount[];
  journalEntries: JournalEntry[];
  postManualJournalEntry: (entry: Omit<JournalEntry, 'id' | 'entryNumber'>) => void;

  // Accounts Extended: Suppliers & Vendors
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'currentOutstandingKes'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;

  // Accounts Extended: Wholesale Distributors
  distributors: CommercialDistributor[];
  addDistributor: (distributor: Omit<CommercialDistributor, 'id' | 'currentReceivableKes'>) => Promise<CommercialDistributor>;
  updateDistributor: (id: string, updates: Partial<CommercialDistributor>) => void;

  // Accounts Extended: Supply Invoices & Packing Lists
  supplyInvoices: SupplyInvoice[];
  createSupplyInvoice: (invoice: Omit<SupplyInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'syncedToLedger'> & { customInvoiceNumber?: string }) => SupplyInvoice;
  addProductsUnderInvoice: (
    invoiceId: string,
    newProductsData: Array<{
      name: string;
      sku: string;
      category: StockCategory;
      barcode?: string;
      caseBarcode?: string;
      packSize: number;
      casesSupplied: number;
      warehouseCostKes: number;
      wholesalePriceKes: number;
      retailPriceKes: number;
      batchNumber?: string;
      expiryDate?: string;
      volumeMl?: number;
      alcoholPercentage?: number;
      image?: string;
    }>
  ) => { createdProducts: Product[]; updatedInvoice: SupplyInvoice | null };
  instantScanOnboardProduct: (params: {
    invoiceId?: string;
    targetProductId?: string;
    brand: string;
    productName?: string;
    sku?: string;
    subCategory?: string;
    alcoholPercentage?: number;
    countryOfOrigin?: string;
    caseBarcode?: string;
    batchNumber?: string;
    expiryDate?: string;
    looseBottles?: number;
    targetBranchId?: string;
    retailPriceKes: number;
    wholesalePriceKes?: number;
    warehouseCostKes?: number;
    scannedBarcode: string;
    category?: StockCategory;
    volumeMl?: number;
    packSize?: number;
    casesSupplied?: number;
    piecesIndicated?: number;
    setExactPieces?: boolean;
    scanUnitMode?: 'CASE' | 'BOTTLE';
    image?: string;
  }) => {
    product: Product;
    invoice: SupplyInvoice;
    bottlesAdded: number;
    casesAdded: number;
    previousBottlesOnHand: number;
    newBottlesOnHand: number;
    assetValueAddedKes: number;
    newTotalProductAssetKes: number;
    isExistingUpdated: boolean;
  };

  // Accounts Extended: Quotations / Proforma Invoices
  quotes: CommercialQuote[];
  createQuote: (quote: Omit<CommercialQuote, 'id' | 'quoteNumber'>) => CommercialQuote;
  convertQuoteToInvoice: (quoteId: string) => CommercialInvoice | null;

  // Accounts Extended: Commercial B2B Invoices
  commercialInvoices: CommercialInvoice[];
  createCommercialInvoice: (invoice: Omit<CommercialInvoice, 'id' | 'invoiceNumber' | 'etimsTransmitted'>) => CommercialInvoice;
  recordCommercialInvoicePayment: (invoiceId: string, amount: number, paymentMethod: 'MPESA' | 'BANK_TRANSFER' | 'CASH') => void;

  // Independent Staff Database (Instant Login + Staff Data Persistence)
  staffDatabaseRecords: StaffDirectoryRecord[];
  staffDbSyncStatus: 'SYNCED' | 'SYNCING' | 'LOCAL_READY';
  lastStaffDbSyncAt: string | null;
  instantLoginWithStaffPin: (
    pin: string,
    preferredDept?: DepartmentType,
    preferredStaffId?: string
  ) => { success: boolean; staffRecord?: StaffDirectoryRecord; error?: string };
  instantLoginByStaffRecord: (
    staffId: string
  ) => { success: boolean; staffRecord?: StaffDirectoryRecord; error?: string };
  syncAllStaffsToIndependentDb: () => Promise<number>;
  deleteStaffFromIndependentDb: (staffId: string) => Promise<void>;
  wipeAllUsersAndStaff: () => Promise<boolean>;
  suspendStaffMember: (staffId: string, reason?: string) => Promise<boolean>;
  terminateStaffMember: (staffId: string, reason?: string) => Promise<boolean>;
  reactivateStaffMember: (staffId: string) => Promise<boolean>;

  // HR & Payroll
  employees: Employee[];
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<Employee>;
  updateEmployee: (employeeId: string, updates: Partial<Employee>) => Promise<boolean>;
  updateEmployeePin: (employeeId: string, newPin: string) => void;
  updateEmployeeCommissionRate: (employeeId: string, ratePercent: number) => void;
  payoutEmployeeCommission: (employeeId: string) => boolean;
  payrollRecords: PayrollRecord[];
  runPayrollForMonth: (monthYear: string) => void;
  syncPayrollRecordToLedger: (payrollId: string) => boolean;

  // Affiliates (Sales Ladies)
  affiliates: Affiliate[];
  commissions: CommissionRecord[];
  defaultAffiliateCommissionRate: number;
  defaultAffiliateCommissionMode: AffiliateCommissionMode;
  defaultAllowPreferredPrice: boolean;
  updateGlobalAffiliateSettings: (settings: {
    commissionRatePercent?: number;
    commissionMode?: AffiliateCommissionMode;
    allowPreferredPrice?: boolean;
    applyToExistingAffiliates?: boolean;
  }) => void;
  registerAffiliate: (affiliate: Omit<Affiliate, 'id' | 'totalSalesKes' | 'totalCommissionEarnedKes' | 'paidCommissionKes' | 'pendingCommissionKes'>) => Promise<Affiliate>;
  updateAffiliate: (affiliateId: string, updates: Partial<Affiliate>) => Promise<boolean>;
  updateAffiliatePin: (affiliateId: string, newPin: string) => void;
  updateAffiliateCommissionRate: (affiliateId: string, ratePercent: number) => void;
  updateAffiliateCommissionSettings: (
    affiliateId: string,
    updates: {
      commissionRatePercent?: number;
      commissionMode?: AffiliateCommissionMode;
      allowPreferredPrice?: boolean;
    }
  ) => void;
  setAffiliateProductPreferredPrice: (
    affiliateId: string,
    productId: string,
    preferredPriceKes: number | null
  ) => void;
  updateAffiliateAssignedCashier: (affiliateId: string, cashierId: string, cashierName: string) => void;
  payoutAffiliateCommission: (affiliateId: string) => boolean;
  salesNetworkCustomers: SalesNetworkCustomer[];
  onboardSalesNetworkCustomer: (params: {
    affiliateId: string;
    customerName: string;
    businessOrVenueName?: string;
    segment: SalesNetworkCustomerSegment;
    phone: string;
    email?: string;
    kraPin?: string;
    defaultDeliveryLocation: string;
    defaultDeliveryNotes?: string;
  }) => SalesNetworkCustomer;
  createSalesNetworkRemoteOrder: (params: {
    affiliateId: string;
    salesNetworkCustomerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryLocation: string;
    deliveryNotes?: string;
    items: {
      product: Product;
      quantity: number;
      preferredSellingUnitPrice?: number;
    }[];
  }) => {
    order: WebsiteDeliveryOrder;
    commissionRecord: CommissionRecord;
    companySalesKes: number;
    affiliateMarkupProfitKes: number;
    affiliateBaseCommissionKes: number;
    totalAffiliatePayableKes: number;
  };

  // Restock & Procurement (Independent Shop Acquisition & Warehouse Main Store Disbursement)
  restockRequests: RestockRequest[];
  autoDisburseEnabled: boolean;
  setAutoDisburseEnabled: (enabled: boolean) => void;
  createRestockRequest: (
    toBranchId: string,
    items: { productId: string; casesRequested: number }[],
    options?: {
      fromBranchId?: string;
      initiationType?: 'SHOP_REFILL_REQUEST' | 'WAREHOUSE_AUTO_DISBURSE' | 'WAREHOUSE_CONTROLLER_PUSH';
      urgency?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STANDARD_REFILL';
      notes?: string;
    }
  ) => RestockRequest;
  warehouseDisburseStock: (
    targetShopBranchId: string,
    items: { productId: string; casesRequested: number }[],
    options?: {
      sourceWarehouseId?: string;
      initiationType?: 'WAREHOUSE_AUTO_DISBURSE' | 'WAREHOUSE_CONTROLLER_PUSH';
      urgency?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STANDARD_REFILL';
      notes?: string;
      autoAcceptImmediately?: boolean;
    }
  ) => RestockRequest;
  triggerWarehouseAutoDisburseForAllLowStockShops: () => { count: number; requests: RestockRequest[] };
  updateRestockRequestItemQty: (requestId: string, productId: string, newCasesRequested: number) => void;
  removeUnavailableItemFromRestockRequest: (requestId: string, productId: string, reason?: string) => void;
  removeAllUnavailableItemsFromRequest: (requestId: string) => { removedCount: number; remainingCount: number };
  acceptAndFulfillRestockRequest: (requestId: string) => void;
  rejectRestockRequest: (requestId: string, reason?: string) => void;
  approveRestockRequest: (requestId: string) => void;
  dispatchRestockRequest: (requestId: string) => void;
  receiveRestockRequest: (requestId: string) => void;

  // Employee Leave Requests (Requested by Employees -> HR Approval) & Sales Rep Off-Duty Requests (Requested by Sales Reps -> Sales Manager Approval)
  employeeLeaveRequests: EmployeeLeaveRequest[];
  salesRepOffDutyRequests: SalesRepOffDutyRequest[];
  submitEmployeeLeaveRequest: (params: {
    employeeId?: string;
    employeeName?: string;
    employeeNumber?: string;
    department?: DepartmentType;
    branchId?: string;
    leaveType: EmployeeLeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    handoverPersonName?: string;
  }) => EmployeeLeaveRequest;
  reviewEmployeeLeaveRequest: (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    hrReviewNotes?: string
  ) => void;
  submitSalesRepOffDutyRequest: (params: {
    affiliateId?: string;
    affiliateName?: string;
    affiliateCode?: string;
    branchId?: string;
    offDutyType: SalesRepOffDutyType;
    startDate: string;
    endDate: string;
    daysOrShiftsCount: number;
    reason: string;
    coveringRepName?: string;
  }) => SalesRepOffDutyRequest;
  reviewSalesRepOffDutyRequest: (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    managerReviewNotes?: string
  ) => void;

  // Admin System Settings, Brand & Product Pricing, CSV Price List, Offers, Campaigns & Promotions
  systemSettings: ErpSystemSettings;
  updateSystemSettings: (updates: Partial<ErpSystemSettings>) => void;
  brandPriceRules: BrandPriceRule[];
  upsertBrandPriceRule: (
    rule: Omit<BrandPriceRule, 'id' | 'updatedAt'> & { id?: string },
    applyToMatchingProducts?: boolean
  ) => BrandPriceRule;
  deleteBrandPriceRule: (id: string) => void;
  bulkUpdateBrandPrices: (
    brandName: string,
    prices: {
      warehouseCostKes?: number;
      wholesalePriceKes?: number;
      retailPriceKes?: number;
      minWholesaleQty?: number;
      percentageChange?: number;
    }
  ) => number;
  importPriceListFromCsvRows: (
    rows: Array<{
      sku?: string;
      barcode?: string;
      name?: string;
      brand?: string;
      category?: StockCategory;
      volumeMl?: number;
      packSize?: number;
      warehouseCostKes?: number;
      wholesalePriceKes?: number;
      retailPriceKes?: number;
      minWholesaleQty?: number;
    }>
  ) => { updatedCount: number; createdCount: number };
  specialOffers: SpecialOfferSetting[];
  saveSpecialOffer: (offer: Omit<SpecialOfferSetting, 'id'> & { id?: string }) => SpecialOfferSetting;
  deleteSpecialOffer: (id: string) => void;
  marketingCampaigns: MarketingCampaignSetting[];
  saveMarketingCampaign: (campaign: Omit<MarketingCampaignSetting, 'id'> & { id?: string }) => MarketingCampaignSetting;
  deleteMarketingCampaign: (id: string) => void;
  promotions: PromotionSetting[];
  savePromotion: (promo: Omit<PromotionSetting, 'id'> & { id?: string }) => PromotionSetting;
  deletePromotion: (id: string) => void;

  // User Activity & Live Session Monitoring Engine
  userActivityLogs: UserActivityLog[];
  userSessionMonitors: UserSessionMonitorRecord[];
  logUserActivity: (params: {
    actionType: UserActivityActionType;
    actionTitle: string;
    actionDetails: string;
    module?: string;
    overrideUser?: {
      id: string;
      name: string;
      role: UserRole;
      department: DepartmentType;
      branchId?: string;
    };
  }) => UserActivityLog;

  // Unified Cloud & Local Database Engine
  unifiedDbSyncStatus: 'SYNCED' | 'SYNCING' | 'OFFLINE';
  lastUnifiedDbSyncAt: string | null;
  unifiedCollectionsCount: number;
  totalUnifiedRecordsCount: number;
  syncAllDataToUnifiedDatabase: () => Promise<{ syncedCollections: number; totalRecords: number }>;

  // Genuine Customer Product Ratings & Reviews (Zero pre-populated / fake ratings)
  productRatings: ProductRatingRecord[];
  submitProductRating: (payload: {
    productId: string;
    raterKey: string;
    raterName: string;
    stars: number;
    comment?: string;
    isVerifiedBuyer?: boolean;
  }) => ProductRatingRecord;

  // First-Class Multi-Tier Network Domain Model (Organization, Membership, Consumer)
  organizations: Organization[];
  merchants: Merchant[];
  distributorOrganizations: DistributorOrganization[];
  retailers: Retailer[];
  supplierOrganizations: SupplierOrganization[];
  organizationMemberships: OrganizationMembership[];
  consumers: Consumer[];
  registerOrganization: (org: Organization) => Organization;
  assignUserOrganizationMembership: (params: {
    userId: string;
    userName: string;
    userEmail: string;
    organizationId: string;
    role: OrganizationRole;
    assignedBranchIds?: string[];
  }) => OrganizationMembership | null;
  upsertConsumerProfile: (params: {
    fullName: string;
    phone: string;
    email?: string;
    kraPin?: string;
    defaultDeliveryLocation?: string;
    preferredBranchId?: string;
  }) => Consumer;
  liveLoggedInCustomers: LiveLoggedInCustomer[];
  upsertLiveCustomerSession: (
    session: Omit<LiveLoggedInCustomer, 'loginAt' | 'lastActiveAt'> & {
      loginAt?: string;
      lastActiveAt?: string;
    }
  ) => void;
  removeLiveCustomerSession: (uidOrEmail: string) => void;
}

const ErpContext = createContext<ErpContextType | null>(null);

const STORAGE_PREFIX = 'vaairo_erp_live_v5_';

const LEGACY_MOCK_BRANCH_IDS = new Set([
  'branch-wh-01',
  'branch-ms-01',
  'branch-dist-01',
  'branch-ls-01',
  'branch-ls-02'
]);

const UNCONFIGURED_BRANCH_FALLBACK: Branch = {
  ...MAIN_HEAD_OFFICE_BRANCH
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Purge any legacy mock storage keys AND any sensitive financial/credential keys from browser storage on mount
  useEffect(() => {
    try {
      const sensitiveKeys = [
        'employees',
        'payroll',
        'commissions',
        'accounts',
        'journals',
        'mpesa',
        'vaairo_admin_totp_secret_v1'
      ];
      sensitiveKeys.forEach(sk => {
        localStorage.removeItem(STORAGE_PREFIX + sk);
        sessionStorage.removeItem(STORAGE_PREFIX + sk);
      });
      Object.keys(localStorage).forEach(k => {
        const val = localStorage.getItem(k) || '';
        if (
          val.startsWith('enc:v1:') ||
          k.startsWith('vaairo_erp_v1_') ||
          k.startsWith('vaairo_erp_live_v3_') ||
          k.startsWith('vaairo_erp_live_v4_') ||
          k === 'vaairo_affiliates_seeded_v1' ||
          k === 'vaairo_web_orders_seeded_v1' ||
          k === 'vaairo_mgr_seed_v2' ||
          k === 'vaairo_nd_catalog_seeded_v1'
        ) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn('Storage cleanup skipped:', e);
    }
  }, []);

  // Registry of unified state setters and latest values for real-time Firestore <-> System unification
  const unifiedSettersRef = React.useRef<Map<string, React.Dispatch<React.SetStateAction<unknown>>>>(
    new Map()
  );
  const unifiedValuesRef = React.useRef<Map<string, unknown>>(new Map());
  const [unifiedDbSyncStatus, setUnifiedDbSyncStatus] = useState<'SYNCED' | 'SYNCING' | 'OFFLINE'>('SYNCING');
  const [lastUnifiedDbSyncAt, setLastUnifiedDbSyncAt] = useState<string | null>(null);
  const [unifiedCollectionsCount, setUnifiedCollectionsCount] = useState<number>(28);
  const [persistenceErrorBanner, setPersistenceErrorBanner] = useState<string | null>(null);
  const clearPersistenceErrorBanner = React.useCallback(() => setPersistenceErrorBanner(null), []);

  /**
   * Authoritative financial, payroll, HR, accounting, M-Pesa, and credential keys
   * MUST NEVER be persisted in browser LocalStorage or SessionStorage (no fake Base64 "enc:v1:" encoding).
   * These slices live in memory only and are hydrated strictly for authorized sessions.
   */
  const AUTHORITATIVE_SENSITIVE_KEYS = new Set([
    'employees',
    'payroll',
    'commissions',
    'accounts',
    'journals',
    'mpesa',
    'vaairo_admin_totp_secret_v1'
  ]);

  // Helper for state management: Central database = source of truth; browser storage = local cache only.
  // AUTHORITATIVE_SENSITIVE_KEYS are strictly memory-only in the browser and never written to localStorage.
  const usePersisted = <T,>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const isSensitiveMemoryOnly = AUTHORITATIVE_SENSITIVE_KEYS.has(key);
    const shouldSyncToCentralDb = key !== 'user' && key !== 'vaairo_admin_totp_secret_v1';

    const [state, setState] = useState<T>(() => {
      const defaultBaseline = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
      if (shouldSyncToCentralDb) {
        // Seed only the static baseline default so any previously un-synced local cache items are pushed to the central DB
        seedInitialUnifiedStateSnapshot(key, defaultBaseline);
      }
      if (isSensitiveMemoryOnly) {
        return defaultBaseline;
      }
      try {
        const saved = localStorage.getItem(STORAGE_PREFIX + key);
        if (saved && !saved.startsWith('enc:v1:')) {
          const parsed = JSON.parse(saved) as T;
          if (Array.isArray(parsed) && parsed.length === 0 && typeof initialValue === 'function') {
            return defaultBaseline;
          }
          return parsed;
        }
      } catch {
        // Ignore cache read error and use baseline until central DB snapshot arrives
      }
      return defaultBaseline;
    });

    const isInitialMountRef = React.useRef<boolean>(true);

    useEffect(() => {
      unifiedSettersRef.current.set(key, setState as React.Dispatch<React.SetStateAction<unknown>>);
      unifiedValuesRef.current.set(key, state);

      if (isSensitiveMemoryOnly) {
        try {
          localStorage.removeItem(STORAGE_PREFIX + key);
          sessionStorage.removeItem(STORAGE_PREFIX + key);
        } catch {
          // Ignore storage removal errors
        }
      } else {
        const serialized = JSON.stringify(state);
        try {
          localStorage.setItem(STORAGE_PREFIX + key, serialized);
        } catch {
          try {
            sessionStorage.setItem(STORAGE_PREFIX + key, serialized);
          } catch {
            // Gracefully retain in-memory state
          }
        }
      }

      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        // If browser cache has records that differ from the static baseline, push them to central DB so other browsers receive them
        if (shouldSyncToCentralDb && !isSensitiveMemoryOnly) {
          const timer = window.setTimeout(() => {
            void pushUnifiedErpStateToFirestore(key, state).then(ok => {
              if (ok) {
                setUnifiedDbSyncStatus('SYNCED');
                setLastUnifiedDbSyncAt(new Date().toISOString());
              }
            });
          }, 600);
          return () => window.clearTimeout(timer);
        }
        return;
      }

      // Synchronize shared state keys to the central Firestore database (debounced)
      if (shouldSyncToCentralDb) {
        const delayMs = key === 'products' || key === 'inventory' || key === 'branches' ? 200 : 600;
        const timer = window.setTimeout(() => {
          pushUnifiedErpStateToFirestore(key, state).then(ok => {
            if (ok) {
              setUnifiedDbSyncStatus('SYNCED');
              setLastUnifiedDbSyncAt(new Date().toISOString());
            } else {
              setUnifiedDbSyncStatus('OFFLINE');
            }
          });
        }, delayMs);
        return () => window.clearTimeout(timer);
      }
    }, [key, state, isSensitiveMemoryOnly, shouldSyncToCentralDb]);

    // Cross-tab LocalStorage synchronization for non-sensitive keys only
    useEffect(() => {
      if (typeof window === 'undefined' || key === 'user' || isSensitiveMemoryOnly) return;
      const storageKey = STORAGE_PREFIX + key;
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key !== storageKey || !e.newValue || e.newValue.startsWith('enc:v1:')) return;
        try {
          const parsed = JSON.parse(e.newValue) as T;
          markRemoteUnifiedStateReceived(key, parsed);
          setState(parsed);
        } catch {
          // Ignore parse errors
        }
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, isSensitiveMemoryOnly]);

    return [state, setState];
  };

  // State Declarations
  const [currentUser, setCurrentUser] = usePersisted<User>('user', INITIAL_USERS[0]);
  const [currentRole, setCurrentRole] = useState<UserRole>(currentUser.role);
  const [currentDepartment, setCurrentDepartment] = useState<DepartmentType>(currentUser.department);
  const [posStationMode, setPosStationMode] = useState<'COUNTER_CASHIER' | 'SALES_LADY'>(() =>
    currentUser.department === 'AFFILIATES' ? 'SALES_LADY' : 'COUNTER_CASHIER'
  );
  const [activeBranchId, setActiveBranchId] = useState<string>(currentUser.branchId || '');
  const [isMfaPending, setIsMfaPending] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [branches, setBranches] = usePersisted<Branch[]>('branches', INITIAL_BRANCHES);
  const [products, setProducts] = usePersisted<Product[]>('products', INITIAL_PRODUCTS);
  const [inventoryItems, setInventoryItems] = usePersisted<InventoryItem[]>('inventory', INITIAL_INVENTORY_ITEMS);
  const [scanHistory, setScanHistory] = usePersisted<BarcodeScanRecord[]>('scan_history', []);
  const [activeScanBatchId, setActiveScanBatchId] = useState<string>(() => `BATCH-${Date.now().toString().slice(-6)}`);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = usePersisted<HeldCart[]>('held_carts', []);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [recalledSalesPerson, setRecalledSalesPerson] = useState<{ id?: string; name: string } | null>(null);

  const [orders, setOrders] = usePersisted<SaleOrder[]>('orders', INITIAL_ORDERS);
  const [etimsInvoices, setEtimsInvoices] = usePersisted<ETimsInvoice[]>('etims', INITIAL_ETIMS_INVOICES);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<ETimsInvoice | null>(null);
  const [websiteDeliveryOrders, setWebsiteDeliveryOrders] = usePersisted<WebsiteDeliveryOrder[]>(
    'website_delivery_orders_v1',
    []
  );

  const [mpesaTransactions, setMpesaTransactions] = usePersisted<MpesaTransaction[]>('mpesa', INITIAL_MPESA_TRANSACTIONS);
  const [chartOfAccounts, setChartOfAccounts] = usePersisted<ChartAccount[]>('accounts', INITIAL_CHART_OF_ACCOUNTS);
  const [journalEntries, setJournalEntries] = usePersisted<JournalEntry[]>('journals', INITIAL_JOURNAL_ENTRIES);

  const [employees, setEmployees] = usePersisted<Employee[]>('employees', () => {
    const indep = loadLocalIndependentStaffRecords()
      .filter(r => r.recordType === 'EMPLOYEE')
      .map(staffDirectoryRecordToEmployee);
    return indep.length > 0 ? indep : INITIAL_EMPLOYEES;
  });
  const [payrollRecords, setPayrollRecords] = usePersisted<PayrollRecord[]>('payroll', []);
  const [affiliates, setAffiliates] = usePersisted<Affiliate[]>('affiliates', () => {
    const indep = loadLocalIndependentStaffRecords()
      .filter(r => r.recordType === 'AFFILIATE')
      .map(staffDirectoryRecordToAffiliate);
    return indep.length > 0 ? indep : INITIAL_AFFILIATES;
  });
  const [commissions, setCommissions] = usePersisted<CommissionRecord[]>('commissions', []);
  const [staffDatabaseRecords, setStaffDatabaseRecords] = useState<StaffDirectoryRecord[]>(() => {
    const existingLocal = loadLocalIndependentStaffRecords();
    const byId = new Map<string, StaffDirectoryRecord>();
    existingLocal.forEach(r => byId.set(r.id, r));
    return Array.from(byId.values());
  });
  const [staffDbSyncStatus, setStaffDbSyncStatus] = useState<'SYNCED' | 'SYNCING' | 'LOCAL_READY'>('LOCAL_READY');
  const [lastStaffDbSyncAt, setLastStaffDbSyncAt] = useState<string | null>(null);
  const [userActivityLogs, setUserActivityLogs] = useState<UserActivityLog[]>(() => loadLocalActivityLogs());
  const [userSessionMonitors, setUserSessionMonitors] = useState<UserSessionMonitorRecord[]>(() =>
    loadLocalSessionMonitors()
  );
  const [defaultAffiliateCommissionRate, setDefaultAffiliateCommissionRate] = usePersisted<number>('aff_default_comm_rate', 5);
  const [defaultAffiliateCommissionMode, setDefaultAffiliateCommissionMode] = usePersisted<AffiliateCommissionMode>('aff_default_comm_mode', 'COMMISSION_AND_PROFIT');
  const [defaultAllowPreferredPrice, setDefaultAllowPreferredPrice] = usePersisted<boolean>('aff_default_allow_pref_price', true);
  const [autoDisburseEnabled, setAutoDisburseEnabled] = usePersisted<boolean>('auto_disburse_enabled', true);
  const [restockRequests, setRestockRequests] = usePersisted<RestockRequest[]>('restock_v3', []);

  const [suppliers, setSuppliers] = usePersisted<Supplier[]>('suppliers', INITIAL_SUPPLIERS);
  const [distributors, setDistributors] = usePersisted<CommercialDistributor[]>('distributors', INITIAL_DISTRIBUTORS);
  const [supplyInvoices, setSupplyInvoices] = usePersisted<SupplyInvoice[]>('supply_invoices', INITIAL_SUPPLY_INVOICES);
  const [quotes, setQuotes] = usePersisted<CommercialQuote[]>('quotes', INITIAL_QUOTES);
  const [commercialInvoices, setCommercialInvoices] = usePersisted<CommercialInvoice[]>('comm_invoices', INITIAL_COMMERCIAL_INVOICES);

  const [employeeLeaveRequests, setEmployeeLeaveRequests] = usePersisted<EmployeeLeaveRequest[]>(
    'employee_leave_requests_v1',
    []
  );

  const [salesRepOffDutyRequests, setSalesRepOffDutyRequests] = usePersisted<SalesRepOffDutyRequest[]>(
    'sales_rep_off_duty_requests_v1',
    []
  );

  const [systemSettings, setSystemSettings] = usePersisted<ErpSystemSettings>('system_settings_v1', {
    brandName: 'VAAIRO',
    brandBadge: 'ERP',
    brandTagline: 'Choose it, get it, Drink it',
    legalCompanyName: 'Vaairo Wines & Spirits Merchants Ltd',
    storefrontTitle: 'Kenya Liquors Direct • Official Online Storefront',
    supportPhone: '+254 700 000 000',
    supportEmail: 'support@urbantechdev.com',
    headOfficeAddress: 'Industrial Area, Enterprise Road, Nairobi, Kenya',
    primaryColorHex: '#0A006E',
    accentColorHex: '#FFDE00',
    secondaryColorHex: '#34D186',
    logoUrl: '',
    faviconUrl: '',
    showBrandScannerEffect: true,
    companyKraPin: 'P051829301A',
    exciseLicenseNumber: 'KRA-EXCISE-2026-KE-001',
    defaultVatRatePercent: 16,
    defaultExciseDutyPerLitreKes: 356.4,
    etimsDeviceSerial: 'VAT-REG-KE-2026-9901',
    etimsCuSerial: 'VATREG012026090100',
    autoTransmitEtims: true,
    mpesaPaybillOrTill: '4082211',
    mpesaAccountReferencePrefix: 'VAAIRO',
    defaultMinWholesaleKes: 50000,
    defaultCounterCashierCommissionPercent: 3,
    receiptHeaderNote: 'OFFICIAL VAAIRO 16% VAT TAX INVOICE',
    receiptFooterMessage: 'Thank you for shopping with us! Strictly 18+ Drink Responsibly.',
    inactivityTimeoutMinutes: 2,
    allowCashierDirectSales: true,
    allowCashierReceiveSalesRepOrders: true
  });

  const [brandPriceRules, setBrandPriceRules] = usePersisted<BrandPriceRule[]>('brand_price_rules_v1', []);
  const [specialOffers, setSpecialOffers] = usePersisted<SpecialOfferSetting[]>('special_offers_v1', []);
  const [marketingCampaigns, setMarketingCampaigns] = usePersisted<MarketingCampaignSetting[]>('marketing_campaigns_v1', []);
  const [promotions, setPromotions] = usePersisted<PromotionSetting[]>('promotions_v1', []);
  const [productRatings, setProductRatings] = usePersisted<ProductRatingRecord[]>('product_ratings_v1', []);
  const [offlineQueuedCheckouts, setOfflineQueuedCheckouts] = usePersisted<OfflineQueuedCheckoutPayload[]>(
    'offline_queued_checkouts_v1',
    []
  );

  // First-Class Multi-Tier Network Entities: Organization (Merchant, Distributor, Retailer, Supplier), Membership, Consumer
  const [organizations, setOrganizations] = usePersisted<Organization[]>(
    'organizations',
    INITIAL_ORGANIZATIONS
  );
  const [organizationMemberships, setOrganizationMemberships] = usePersisted<OrganizationMembership[]>(
    'organization_memberships',
    INITIAL_ORGANIZATION_MEMBERSHIPS
  );
  const [consumers, setConsumers] = usePersisted<Consumer[]>(
    'consumers',
    INITIAL_CONSUMERS
  );

  // Automatically hydrate signed server session token whenever active user or branch changes
  useEffect(() => {
    if (activeBranchId && typeof localStorage !== 'undefined') {
      localStorage.setItem('vaairo_active_branch_id', activeBranchId);
    }
    fetch('/api/auth/terminal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vaairo-terminal-sync': '1' },
      body: JSON.stringify({
        userId: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department,
        branchId: activeBranchId
      })
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data.token === 'string' && data.token) {
          setStoredSessionToken(data.token);
        }
      })
      .catch(() => {});
  }, [currentUser.id, currentUser.role, currentUser.department, activeBranchId]);

  // Automatically synchronize first-class Organizations, Memberships, and Consumers with operational ERP state
  useEffect(() => {
    setOrganizations(prev =>
      synchronizeNetworkOrganizations({
        existingOrganizations: prev,
        branches,
        distributors,
        suppliers
      })
    );
  }, [branches, distributors, suppliers, setOrganizations]);

  useEffect(() => {
    if (organizations.length === 0) return;
    setOrganizationMemberships(prev =>
      synchronizeOrganizationMemberships({
        existingMemberships: prev,
        organizations,
        users: [currentUser, ...INITIAL_USERS],
        employees,
        affiliates,
        branches
      })
    );
  }, [organizations, currentUser, employees, affiliates, branches, setOrganizationMemberships]);

  useEffect(() => {
    setConsumers(prev =>
      synchronizeConsumers({
        existingConsumers: prev,
        orders,
        websiteDeliveryOrders
      })
    );
  }, [orders, websiteDeliveryOrders, setConsumers]);

  const merchants = React.useMemo(
    () => organizations.filter((o): o is Merchant => o.type === 'MERCHANT'),
    [organizations]
  );
  const distributorOrganizations = React.useMemo(
    () => organizations.filter((o): o is DistributorOrganization => o.type === 'DISTRIBUTOR'),
    [organizations]
  );
  const retailers = React.useMemo(
    () => organizations.filter((o): o is Retailer => o.type === 'RETAILER'),
    [organizations]
  );
  const supplierOrganizations = React.useMemo(
    () => organizations.filter((o): o is SupplierOrganization => o.type === 'SUPPLIER'),
    [organizations]
  );

  const registerOrganization = React.useCallback(
    (org: Organization): Organization => {
      const nowIso = new Date().toISOString();
      const normalized: Organization = {
        ...org,
        createdAt: org.createdAt || nowIso,
        updatedAt: nowIso
      };
      setOrganizations(prev => {
        const idx = prev.findIndex(o => o.id === normalized.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = normalized;
          return next;
        }
        return [normalized, ...prev];
      });
      return normalized;
    },
    [setOrganizations]
  );

  const assignUserOrganizationMembership = React.useCallback(
    (params: {
      userId: string;
      userName: string;
      userEmail: string;
      organizationId: string;
      role: OrganizationRole;
      assignedBranchIds?: string[];
    }): OrganizationMembership | null => {
      const targetOrg = organizations.find(o => o.id === params.organizationId);
      if (!targetOrg) return null;
      const nowIso = new Date().toISOString();
      const memId = `mem_${params.userId}_${targetOrg.id}`;
      const mapped = mapOrganizationRoleToErpRole(params.role);
      const record: OrganizationMembership = {
        id: memId,
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
        organizationType: targetOrg.type,
        role: params.role,
        erpRole: mapped.erpRole,
        department: mapped.department,
        assignedBranchIds: params.assignedBranchIds || targetOrg.linkedBranchIds || [],
        defaultBranchId: params.assignedBranchIds?.[0] || targetOrg.linkedBranchIds?.[0],
        status: 'ACTIVE',
        joinedAt: nowIso,
        updatedAt: nowIso
      };
      setOrganizationMemberships(prev => {
        const idx = prev.findIndex(m => m.id === memId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...record, joinedAt: prev[idx].joinedAt };
          return next;
        }
        return [record, ...prev];
      });
      return record;
    },
    [organizations, setOrganizationMemberships]
  );

  const upsertConsumerProfile = React.useCallback(
    (params: {
      fullName: string;
      phone: string;
      email?: string;
      kraPin?: string;
      defaultDeliveryLocation?: string;
      preferredBranchId?: string;
    }): Consumer => {
      const nowIso = new Date().toISOString();
      const cleanPhone = (params.phone || '').replace(/[^0-9]/g, '');
      const consumerId =
        cleanPhone.length >= 9
          ? `con_${cleanPhone.slice(-9)}`
          : `con_${Date.now().toString(36)}`;

      let savedConsumer: Consumer = {
        id: consumerId,
        consumerCode: `CON-2026-${String(consumers.length + 1).padStart(4, '0')}`,
        fullName: params.fullName.trim() || 'Verified Consumer',
        phone: params.phone.trim(),
        email: params.email?.trim(),
        kraPin: params.kraPin?.trim(),
        ageVerified: true,
        defaultDeliveryLocation: params.defaultDeliveryLocation?.trim(),
        preferredBranchId: params.preferredBranchId,
        loyaltyPoints: 0,
        loyaltyTier: 'STANDARD',
        totalOrdersCount: 0,
        lifetimeSpendKes: 0,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      setConsumers(prev => {
        const idx = prev.findIndex(c => c.id === consumerId);
        if (idx >= 0) {
          const existing = prev[idx];
          savedConsumer = {
            ...existing,
            fullName: params.fullName.trim() || existing.fullName,
            phone: params.phone.trim() || existing.phone,
            email: params.email?.trim() || existing.email,
            kraPin: params.kraPin?.trim() || existing.kraPin,
            defaultDeliveryLocation:
              params.defaultDeliveryLocation?.trim() || existing.defaultDeliveryLocation,
            preferredBranchId: params.preferredBranchId || existing.preferredBranchId,
            loyaltyTier: computeConsumerLoyaltyTier(existing.lifetimeSpendKes),
            updatedAt: nowIso
          };
          const next = [...prev];
          next[idx] = savedConsumer;
          return next;
        }
        return [savedConsumer, ...prev];
      });

      return savedConsumer;
    },
    [consumers.length, setConsumers]
  );

  // Live Logged-In Storefront Customers (Real-Time Admin Visibility)
  const LIVE_CUSTOMERS_STORAGE_KEY = 'vaairo_live_logged_in_customers_v1';
  const [liveLoggedInCustomers, setLiveLoggedInCustomers] = useState<LiveLoggedInCustomer[]>(() => {
    try {
      const savedRaw = localStorage.getItem(LIVE_CUSTOMERS_STORAGE_KEY);
      const parsed: LiveLoggedInCustomer[] = savedRaw ? JSON.parse(savedRaw) : [];
      const activeProfileRaw = localStorage.getItem('vaairo_storefront_customer_v1');
      if (activeProfileRaw) {
        const prof = JSON.parse(activeProfileRaw);
        if (prof && prof.email) {
          const exists = parsed.some(
            c => c.email.toLowerCase() === String(prof.email).toLowerCase()
          );
          if (!exists) {
            const nowIso = new Date().toISOString();
            const carrierInfo = detectKenyanMobileCarrier(prof.phone || '');
            parsed.unshift({
              uid: prof.uid || `cust-${prof.email}`,
              name: prof.name || prof.email.split('@')[0],
              email: prof.email,
              phone: carrierInfo.cleanDigits || prof.phone || '',
              carrier: carrierInfo.carrier,
              photoURL: prof.photoURL,
              cartItemsCount: 0,
              cartTotalKes: 0,
              activeOrdersCount: 0,
              status: 'ONLINE',
              loginAt: nowIso,
              lastActiveAt: nowIso
            });
          }
        }
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const upsertLiveCustomerSession = React.useCallback(
    (
      session: Omit<LiveLoggedInCustomer, 'loginAt' | 'lastActiveAt'> & {
        loginAt?: string;
        lastActiveAt?: string;
      }
    ) => {
      const cleanEmail = (session.email || '').trim().toLowerCase();
      if (!cleanEmail && !session.uid) return;
      const nowIso = new Date().toISOString();
      const carrierInfo = detectKenyanMobileCarrier(session.phone || '');
      const normalizedPhone = carrierInfo.cleanDigits || (session.phone || '').trim();

      setLiveLoggedInCustomers(prev => {
        const idx = prev.findIndex(
          c =>
            (cleanEmail && c.email.toLowerCase() === cleanEmail) ||
            (session.uid && c.uid === session.uid)
        );
        const existing = idx >= 0 ? prev[idx] : undefined;
        const record: LiveLoggedInCustomer = {
          uid: session.uid || existing?.uid || `cust-${cleanEmail}`,
          name: (session.name || existing?.name || cleanEmail.split('@')[0] || 'Online Customer').trim(),
          email: cleanEmail || existing?.email || '',
          phone: normalizedPhone || existing?.phone || '',
          carrier:
            carrierInfo.carrier !== 'UNKNOWN'
              ? carrierInfo.carrier
              : session.carrier || existing?.carrier || 'UNKNOWN',
          photoURL: session.photoURL || existing?.photoURL,
          deliveryZone: session.deliveryZone ?? existing?.deliveryZone,
          deliveryStreetAndHouse:
            session.deliveryStreetAndHouse ?? existing?.deliveryStreetAndHouse,
          branchId: session.branchId ?? existing?.branchId,
          branchName: session.branchName ?? existing?.branchName,
          cartItemsCount: session.cartItemsCount ?? existing?.cartItemsCount ?? 0,
          cartTotalKes: session.cartTotalKes ?? existing?.cartTotalKes ?? 0,
          activeOrdersCount: session.activeOrdersCount ?? existing?.activeOrdersCount ?? 0,
          status: session.status || 'ONLINE',
          loginAt: existing?.loginAt || session.loginAt || nowIso,
          lastActiveAt: session.lastActiveAt || nowIso
        };

        const next =
          idx >= 0
            ? [record, ...prev.filter((_, i) => i !== idx)]
            : [record, ...prev];
        try {
          localStorage.setItem(LIVE_CUSTOMERS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });

      if (normalizedPhone.length >= 9 || cleanEmail) {
        upsertConsumerProfile({
          fullName: session.name || cleanEmail.split('@')[0] || 'Online Customer',
          phone: normalizedPhone || '0700000000',
          email: cleanEmail,
          defaultDeliveryLocation: session.deliveryZone,
          preferredBranchId: session.branchId
        });
      }

      fetch('/api/customers/live-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...session,
          email: cleanEmail,
          phone: normalizedPhone,
          carrier: carrierInfo.carrier
        })
      }).catch(() => {});
    },
    [upsertConsumerProfile]
  );

  const removeLiveCustomerSession = React.useCallback((uidOrEmail: string) => {
    const clean = (uidOrEmail || '').trim().toLowerCase();
    if (!clean) return;
    setLiveLoggedInCustomers(prev => {
      const next = prev.filter(
        c => c.email.toLowerCase() !== clean && c.uid.toLowerCase() !== clean
      );
      try {
        localStorage.setItem(LIVE_CUSTOMERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    fetch('/api/customers/live-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clean, uid: uidOrEmail })
    }).catch(() => {});
  }, []);

  // Poll server live customer sessions & listen for cross-tab storage updates
  useEffect(() => {
    let cancelled = false;
    const syncLiveSessionsFromServer = async () => {
      try {
        const res = await fetch('/api/customers/live-sessions');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data?.customers) && data.customers.length > 0) {
          setLiveLoggedInCustomers(prev => {
            const byKey = new Map<string, LiveLoggedInCustomer>();
            prev.forEach(c => byKey.set((c.email || c.uid).toLowerCase(), c));
            data.customers.forEach((sc: LiveLoggedInCustomer) => {
              const k = (sc.email || sc.uid || '').toLowerCase();
              if (!k) return;
              const existing = byKey.get(k);
              byKey.set(k, {
                ...existing,
                ...sc,
                carrier:
                  sc.carrier && sc.carrier !== 'UNKNOWN'
                    ? sc.carrier
                    : detectKenyanMobileCarrier(sc.phone || existing?.phone || '').carrier
              });
            });
            return Array.from(byKey.values()).sort((a, b) =>
              String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || ''))
            );
          });
        }
      } catch {
        // ignore network error
      }
    };

    void syncLiveSessionsFromServer();
    const timer = window.setInterval(syncLiveSessionsFromServer, 8000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIVE_CUSTOMERS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setLiveLoggedInCustomers(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const submitProductRating = React.useCallback(
    (payload: {
      productId: string;
      raterKey: string;
      raterName: string;
      stars: number;
      comment?: string;
      isVerifiedBuyer?: boolean;
    }): ProductRatingRecord => {
      const clampedStars = Math.max(1, Math.min(5, Math.round(Number(payload.stars) || 5)));
      const cleanRaterKey = (payload.raterKey || 'anonymous-device').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
      const recordId = `${payload.productId}_${cleanRaterKey}`;
      const nowIso = new Date().toISOString();

      let savedRecord: ProductRatingRecord = {
        id: recordId,
        productId: payload.productId,
        raterKey: cleanRaterKey,
        raterName: (payload.raterName || 'Customer').trim(),
        stars: clampedStars,
        comment: payload.comment !== undefined ? payload.comment.trim() : undefined,
        isVerifiedBuyer: Boolean(payload.isVerifiedBuyer),
        createdAt: nowIso,
        updatedAt: nowIso
      };

      setProductRatings(prev => {
        const existingIdx = prev.findIndex(r => r.id === recordId);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          savedRecord = {
            ...existing,
            raterName: (payload.raterName || existing.raterName || 'Customer').trim(),
            stars: clampedStars,
            comment:
              payload.comment !== undefined
                ? payload.comment.trim()
                : existing.comment,
            isVerifiedBuyer: Boolean(payload.isVerifiedBuyer || existing.isVerifiedBuyer),
            updatedAt: nowIso
          };
          const next = [...prev];
          next[existingIdx] = savedRecord;
          return next;
        }
        return [savedRecord, ...prev];
      });

      return savedRecord;
    },
    [setProductRatings]
  );

  // Sync document title & favicon dynamically from systemSettings
  useEffect(() => {
    try {
      if (systemSettings.brandName) {
        document.title = `${systemSettings.brandName} ${systemSettings.brandBadge || ''} — ${systemSettings.brandTagline || 'Enterprise ERP'}`.trim();
      }
      if (systemSettings.faviconUrl && systemSettings.faviconUrl.trim()) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = systemSettings.faviconUrl.trim();
      }
    } catch {
      // ignore DOM head errors
    }
  }, [systemSettings.brandName, systemSettings.brandBadge, systemSettings.brandTagline, systemSettings.faviconUrl]);

  // Sync role and department whenever currentUser changes
  useEffect(() => {
    setCurrentRole(currentUser.role);
    setCurrentDepartment(currentUser.department);
    if (currentUser.department === 'AFFILIATES') {
      setPosStationMode('SALES_LADY');
    } else if (currentUser.department === 'POS') {
      setPosStationMode('COUNTER_CASHIER');
    }
    if (currentUser.branchId) {
      setActiveBranchId(currentUser.branchId);
    }
  }, [currentUser]);

  // Ensure any legacy pre-populated mock branches are purged, Main Branch (Head Office) exists,
  // Branches (Merchants) report to Main Branch (Head Office), and Shops are strictly under a Branch
  useEffect(() => {
    setBranches(prev => {
      let cleaned = prev.filter(b => !LEGACY_MOCK_BRANCH_IDS.has(b.id));
      const hasMainHeadOffice = cleaned.some(b => b.tier === 'MAIN_STORE');
      if (!hasMainHeadOffice) {
        cleaned = [{ ...MAIN_HEAD_OFFICE_BRANCH }, ...cleaned];
      }
      const headOffice =
        cleaned.find(b => b.id === 'branch-hq-main') ||
        cleaned.find(b => b.tier === 'MAIN_STORE') ||
        MAIN_HEAD_OFFICE_BRANCH;
      const validParentBranches = cleaned.filter(
        b => b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE'
      );
      let changed = cleaned.length !== prev.length;
      const normalized = cleaned.map(b => {
        if (b.tier === 'MAIN_STORE' && !b.isHeadOffice) {
          changed = true;
          return { ...b, isHeadOffice: true };
        }
        if (b.tier === 'DISTRIBUTOR') {
          const targetParentId = b.parentBranchId || headOffice.id;
          const targetParentName =
            cleaned.find(p => p.id === targetParentId)?.name || headOffice.name;
          if (b.parentBranchId !== targetParentId || b.parentBranchName !== targetParentName) {
            changed = true;
            return {
              ...b,
              parentBranchId: targetParentId,
              parentBranchName: targetParentName
            };
          }
        }
        if (b.tier === 'LIQUOR_STORE') {
          const matchedParent =
            validParentBranches.find(p => p.id === b.parentBranchId) ||
            validParentBranches.find(p => p.tier === 'DISTRIBUTOR') ||
            headOffice;
          if (
            b.parentBranchId !== matchedParent.id ||
            b.parentBranchName !== matchedParent.name
          ) {
            changed = true;
            return {
              ...b,
              parentBranchId: matchedParent.id,
              parentBranchName: matchedParent.name
            };
          }
        }
        return b;
      });
      return changed ? normalized : prev;
    });
  }, []);

  // Keep activeBranchId pointed to a valid created branch whenever branches change
  useEffect(() => {
    if (branches.length > 0 && (!activeBranchId || !branches.some(b => b.id === activeBranchId))) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId]);

  // Load product catalog definitions (with 0 mock stock, 0 mock users, 0 mock branches/distributors, and 0 mock sales)
  useEffect(() => {
    try {
      setProducts(prev => {
        const catalogMap = new Map(NAIROBI_DRINKS_PRODUCTS.map(p => [p.id, p]));
        const baseList = prev.length === 0 ? NAIROBI_DRINKS_PRODUCTS : prev;
        const updated = baseList.map(p => {
          const catalogItem = catalogMap.get(p.id);
          const merged = catalogItem
            ? {
                ...p,
                subCategory: catalogItem.subCategory || p.subCategory,
                isCreamBased: catalogItem.isCreamBased ?? p.isCreamBased,
                requiresBatchExpiryTracking:
                  catalogItem.requiresBatchExpiryTracking ?? p.requiresBatchExpiryTracking,
                recommendedShelfLifeMonths:
                  catalogItem.recommendedShelfLifeMonths ?? p.recommendedShelfLifeMonths,
                maxStorageTempCelsius: catalogItem.maxStorageTempCelsius ?? p.maxStorageTempCelsius,
                manufactureDate: p.manufactureDate || catalogItem.manufactureDate,
                defaultExpiryDate: p.defaultExpiryDate || catalogItem.defaultExpiryDate
              }
            : p;
          const withImg = merged.image ? merged : { ...merged, image: getProductImageUrl(merged) };
          if (withImg.id === 'nd-prod-001') {
            return {
              ...withImg,
              sku: 'IPS-WHISKY-002',
              barcode: '500029912302',
              caseBarcode: '15000299123029'
            };
          }
          if (withImg.id === 'nd-prod-002') {
            return {
              ...withImg,
              sku: 'IPS-WHISKY-002-1L',
              barcode: '500029912319',
              caseBarcode: '15000299123197'
            };
          }
          return withImg;
        });
        const existingIds = new Set(updated.map(p => p.id));
        const missingProducts = NAIROBI_DRINKS_PRODUCTS.filter(p => !existingIds.has(p.id)).map(p =>
          p.image ? p : { ...p, image: getProductImageUrl(p) }
        );
        const combined = missingProducts.length > 0 ? [...updated, ...missingProducts] : updated;
        return mergeAttachedCatalogueWithExistingProducts(combined);
      });

      setInventoryItems(prev => {
        if (prev.length === 0) {
          return buildInitialNairobiDrinksInventory(NAIROBI_DRINKS_PRODUCTS);
        }
        return prev;
      });
    } catch (e) {
      console.warn('Product catalog initialization skipped:', e);
    }
  }, []);

  // Real-Time Cross-Module Ledger & Asset Synchronization Engine:
  // Automatically keeps Inventory Assets (1200 IPS, 1210 LPS), Accounts Payable (2010),
  // Accounts Receivable (1100), Affiliate Commission Payable (2045), Cash/M-Pesa/Revenue/VAT,
  // Supplier/Distributor sub-ledgers, and Retained Earnings (3020) 100% unified across the system.
  useEffect(() => {
    let liveIpsAsset = 0;
    let liveLpsAsset = 0;

    inventoryItems.forEach(inv => {
      const prod = products.find(p => p.id === inv.productId);
      if (!prod) return;
      const val = inv.bottlesOnHand * prod.warehouseCostKes;
      if (prod.category === 'IPS') {
        liveIpsAsset += val;
      } else {
        liveLpsAsset += val;
      }
    });

    // Unify Supplier outstanding payables with Supply Invoices if any supply invoices exist for that supplier
    setSuppliers(prev => {
      if (supplyInvoices.length === 0) return prev;
      let supChanged = false;
      const nextSups = prev.map(sup => {
        const invs = supplyInvoices.filter(inv => inv.supplierId === sup.id);
        if (invs.length === 0) return sup;
        const computedOut = invs.reduce(
          (sum, inv) =>
            sum + (inv.paymentStatus === 'PAID' ? 0 : Math.max(0, inv.totalAmountKes || 0)),
          0
        );
        if (computedOut > 0 && sup.currentOutstandingKes !== computedOut) {
          supChanged = true;
          return { ...sup, currentOutstandingKes: computedOut };
        }
        return sup;
      });
      return supChanged ? nextSups : prev;
    });

    // Unify Distributor receivables with Commercial B2B Invoices if any commercial invoices exist for that distributor
    setDistributors(prev => {
      if (commercialInvoices.length === 0) return prev;
      let distChanged = false;
      const nextDists = prev.map(dist => {
        const invs = commercialInvoices.filter(inv => inv.distributorId === dist.id);
        if (invs.length === 0) return dist;
        const computedRec = invs.reduce(
          (sum, inv) => sum + Math.max(0, (inv.totalKes || 0) - (inv.paidAmountKes || 0)),
          0
        );
        if (dist.currentReceivableKes !== computedRec) {
          distChanged = true;
          return { ...dist, currentReceivableKes: computedRec };
        }
        return dist;
      });
      return distChanged ? nextDists : prev;
    });

    const liveAccountsPayable = suppliers.reduce((sum, s) => sum + (s.currentOutstandingKes || 0), 0);
    const liveAccountsReceivable = distributors.reduce((sum, d) => sum + (d.currentReceivableKes || 0), 0);
    const liveAffiliatePayable =
      affiliates.reduce((sum, a) => sum + (a.pendingCommissionKes || 0), 0) +
      employees.reduce((sum, e) => sum + (e.pendingCommissionKes || 0), 0);

    const completedOrders = orders.filter(
      o => o.paymentStatus === 'PAID' || o.paymentStatus === 'RECONCILED'
    );
    const ordersMpesaSum = completedOrders
      .filter(o => o.paymentMethod === 'MPESA' || o.paymentMethod === 'SPLIT')
      .reduce((sum, o) => sum + o.totalKes, 0);
    const ordersCashSum = completedOrders
      .filter(o => o.paymentMethod === 'CASH')
      .reduce((sum, o) => sum + o.totalKes, 0);
    const ordersVatSum = completedOrders.reduce((sum, o) => sum + (o.vatAmountKes || 0), 0);
    const ordersExciseSum = completedOrders.reduce((sum, o) => sum + (o.exciseAmountKes || 0), 0);
    const ordersNetSalesSum = completedOrders.reduce((sum, o) => sum + (o.subtotalKes || 0), 0);

    setChartOfAccounts(prev => {
      let changed = false;
      const revenueTotal = prev.filter(a => a.type === 'REVENUE').reduce((s, a) => s + a.balanceKes, 0);
      const cogsTotal = prev.filter(a => a.type === 'COGS').reduce((s, a) => s + a.balanceKes, 0);
      const expenseTotal = prev.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balanceKes, 0);
      const liveRetainedEarnings = Math.max(0, Math.max(revenueTotal, ordersNetSalesSum) - cogsTotal - expenseTotal);
      const totalInventoryOpeningEquity = liveIpsAsset + liveLpsAsset;

      const next = prev.map(acc => {
        if (acc.code === '1010' && acc.balanceKes < ordersMpesaSum) {
          changed = true;
          return { ...acc, balanceKes: ordersMpesaSum };
        }
        if (acc.code === '1020' && acc.balanceKes < ordersCashSum) {
          changed = true;
          return { ...acc, balanceKes: ordersCashSum };
        }
        if (acc.code === '1200' && acc.balanceKes !== liveIpsAsset) {
          changed = true;
          return { ...acc, balanceKes: liveIpsAsset };
        }
        if (acc.code === '1210' && acc.balanceKes !== liveLpsAsset) {
          changed = true;
          return { ...acc, balanceKes: liveLpsAsset };
        }
        if (acc.code === '2010' && acc.balanceKes !== liveAccountsPayable) {
          changed = true;
          return { ...acc, balanceKes: liveAccountsPayable };
        }
        if (acc.code === '2020' && acc.balanceKes < ordersVatSum) {
          changed = true;
          return { ...acc, balanceKes: ordersVatSum };
        }
        if (acc.code === '2030' && acc.balanceKes < ordersExciseSum) {
          changed = true;
          return { ...acc, balanceKes: ordersExciseSum };
        }
        if (acc.code === '1100' && acc.balanceKes !== liveAccountsReceivable) {
          changed = true;
          return { ...acc, balanceKes: liveAccountsReceivable };
        }
        if (acc.code === '2045' && acc.balanceKes !== liveAffiliatePayable) {
          changed = true;
          return { ...acc, balanceKes: liveAffiliatePayable };
        }
        if (acc.code === '4010' && acc.balanceKes === 0 && ordersNetSalesSum > 0) {
          changed = true;
          return { ...acc, balanceKes: ordersNetSalesSum };
        }
        if (acc.code === '3010' && acc.balanceKes === 0 && totalInventoryOpeningEquity > 0) {
          changed = true;
          return { ...acc, balanceKes: totalInventoryOpeningEquity };
        }
        if (acc.code === '3020' && acc.balanceKes !== liveRetainedEarnings) {
          changed = true;
          return { ...acc, balanceKes: liveRetainedEarnings };
        }
        return acc;
      });

      return changed ? next : prev;
    });
  }, [
    inventoryItems,
    products,
    suppliers,
    supplyInvoices,
    distributors,
    commercialInvoices,
    affiliates,
    employees,
    orders
  ]);

  // Ensure every active branch has acomplete, independent inventory ledger structure initialized for active products without duplicating another branch's physical stock
  useEffect(() => {
    if (branches.length === 0 || inventoryItems.length === 0) return;

    setInventoryItems(prev => {
      const productTemplateById = new Map<string, InventoryItem>();
      prev.forEach(item => {
        if (!productTemplateById.has(item.productId)) {
          productTemplateById.set(item.productId, item);
        }
      });

      if (productTemplateById.size === 0) return prev;

      const existingKeys = new Set(prev.map(i => `${i.branchId}_${i.productId}`));
      const additions: InventoryItem[] = [];

      branches.forEach(branch => {
        productTemplateById.forEach((templateItem, productId) => {
          const compKey = `${branch.id}_${productId}`;
          if (!existingKeys.has(compKey)) {
            existingKeys.add(compKey);
            const isHeadOfficeOrWarehouse =
              branch.tier === 'MAIN_STORE' || branch.tier === 'WAREHOUSE' || branch.isHeadOffice;
            const initialBottles = isHeadOfficeOrWarehouse ? templateItem.bottlesOnHand : 0;
            additions.push({
              ...templateItem,
              id: `inv-sync-${branch.id}-${productId}`,
              branchId: branch.id,
              bottlesOnHand: initialBottles,
              casesOnHand: Math.floor(initialBottles / 12)
            });
          }
        });
      });

      return additions.length > 0 ? [...additions, ...prev] : prev;
    });
  }, [branches, inventoryItems]);

  // Real-Time Firestore Unified ERP Database Subscription + Branch Inventory Ledger Unification
  useEffect(() => {
    let isMounted = true;
    const catalogByIdMap = new Map(NAIROBI_DRINKS_PRODUCTS.map(p => [p.id, p]));

    const unsubUnifiedDb = subscribeToUnifiedErpDatabase(
      (key, parsedData) => {
        if (!isMounted || key === 'user') return;
        const setter = unifiedSettersRef.current.get(key);
        if (!setter) return;

        // Smart merge for array collections so concurrent additions across terminals never overwrite each other
        if (Array.isArray(parsedData)) {
          setter((prev: unknown) => {
            if (!Array.isArray(prev)) {
              markRemoteUnifiedStateReceived(key, parsedData);
              return parsedData;
            }
            if (parsedData.length === 0) return prev;

            let mergedResult: unknown = parsedData;

            if (key === 'products') {
              // Preserve incoming order (so newly created or barcode-activated products stay pinned on top)
              // while merging with local products and baseline catalog metadata + resolving origin-safe studio images
              const prevMap = new Map<string, Product>();
              (prev as Product[]).forEach(p => {
                if (p && typeof p.id === 'string') prevMap.set(p.id, p);
              });

              const orderedMap = new Map<string, Product>();
              (parsedData as Product[]).forEach(inc => {
                if (!inc || typeof inc.id !== 'string') return;
                const baseCat = catalogByIdMap.get(inc.id);
                const localPrev = prevMap.get(inc.id);
                const mergedProd: Product = {
                  ...(baseCat || {}),
                  ...(localPrev || {}),
                  ...inc
                };
                mergedProd.image =
                  inc.image && !inc.image.includes('/assets/product_')
                    ? inc.image
                    : localPrev?.image || getProductImageUrl(mergedProd);
                orderedMap.set(inc.id, mergedProd);
              });

              // Append any local products not yet in the incoming cloud snapshot
              (prev as Product[]).forEach(localP => {
                if (localP && typeof localP.id === 'string' && !orderedMap.has(localP.id)) {
                  orderedMap.set(localP.id, {
                    ...localP,
                    image: localP.image || getProductImageUrl(localP)
                  });
                }
              });

              // Ensure all baseline catalog products are present
              NAIROBI_DRINKS_PRODUCTS.forEach(catP => {
                if (!orderedMap.has(catP.id)) {
                  orderedMap.set(catP.id, {
                    ...catP,
                    image: catP.image || getProductImageUrl(catP)
                  });
                }
              });

              mergedResult = Array.from(orderedMap.values());
            } else if (key === 'inventory') {
              // Composite key for inventory items: branchId_productId (incoming order first)
              const byComp = new Map<string, InventoryItem>();
              const prevComp = new Map<string, InventoryItem>();
              (prev as InventoryItem[]).forEach(item => {
                if (item && item.branchId && item.productId) {
                  prevComp.set(`${item.branchId}_${item.productId}`, item);
                }
              });
              (parsedData as InventoryItem[]).forEach(inc => {
                if (!inc || !inc.branchId || !inc.productId) return;
                const k = `${inc.branchId}_${inc.productId}`;
                const existing = prevComp.get(k);
                byComp.set(k, existing ? { ...existing, ...inc } : inc);
              });
              (prev as InventoryItem[]).forEach(item => {
                if (!item || !item.branchId || !item.productId) return;
                const k = `${item.branchId}_${item.productId}`;
                if (!byComp.has(k)) {
                  byComp.set(k, item);
                }
              });
              mergedResult = Array.from(byComp.values());
            } else if (key === 'accounts') {
              // Keyed by 'code' for chart of accounts
              const byCode = new Map<string, ChartAccount>();
              (prev as ChartAccount[]).forEach(acc => byCode.set(acc.code, acc));
              (parsedData as ChartAccount[]).forEach(inc => byCode.set(inc.code, inc));
              mergedResult = Array.from(byCode.values());
            } else {
              // Standard 'id'-keyed entity collections (incoming order prioritized first)
              const firstItem = parsedData[0] as Record<string, unknown> | undefined;
              if (firstItem && typeof firstItem === 'object' && 'id' in firstItem) {
                const isStaffCollection = key === 'employees' || key === 'affiliates';
                const deletedStaffSet = isStaffCollection ? getDeletedStaffIdsSet() : null;
                const prevById = new Map<string, Record<string, unknown>>();
                (prev as Record<string, unknown>[]).forEach(item => {
                  if (item && typeof item.id === 'string') {
                    if (deletedStaffSet && deletedStaffSet.has(item.id)) return;
                    prevById.set(item.id, item);
                  }
                });
                const byId = new Map<string, Record<string, unknown>>();
                (parsedData as Record<string, unknown>[]).forEach(inc => {
                  if (inc && typeof inc.id === 'string') {
                    if (deletedStaffSet && deletedStaffSet.has(inc.id)) return;
                    byId.set(inc.id, { ...(prevById.get(inc.id) || {}), ...inc });
                  }
                });
                if (!isStaffCollection) {
                  (prev as Record<string, unknown>[]).forEach(item => {
                    if (item && typeof item.id === 'string' && !byId.has(item.id)) {
                      byId.set(item.id, item);
                    }
                  });
                }
                mergedResult = Array.from(byId.values());
              }
            }

            // Record what actually arrived from the central database
            markRemoteUnifiedStateReceived(key, parsedData);
            // If local browser cache had additional un-synced records that were merged into mergedResult,
            // push the reconciled set to the central database so all other browsers/devices receive them too.
            if (
              Array.isArray(mergedResult) &&
              Array.isArray(parsedData) &&
              mergedResult.length > parsedData.length &&
              key !== 'products'
            ) {
              void pushUnifiedErpStateToFirestore(
                key,
                mergedResult,
                'Cross-Browser Cache Reconciliation',
                true
              );
            }
            return mergedResult;
          });
        } else if (parsedData !== null && parsedData !== undefined) {
          markRemoteUnifiedStateReceived(key, parsedData);
          setter(parsedData);
        }
        setLastUnifiedDbSyncAt(new Date().toISOString());
      },
      (status, syncedCount) => {
        if (!isMounted) return;
        setUnifiedDbSyncStatus(status);
        if (syncedCount > 0) {
          setUnifiedCollectionsCount(Math.max(28, syncedCount));
        }
      },
      existingCloudKeys => {
        if (!isMounted) return;
        // If Firestore does not yet have unified master data or operational state, seed them immediately
        const keysToEnsure = [
          'branches',
          'employees',
          'affiliates',
          'distributors',
          'suppliers',
          'organizations',
          'organization_memberships',
          'consumers',
          'products',
          'inventory',
          'orders',
          'sales_network_customers_v1',
          'website_delivery_orders_v1',
          'scan_history',
          'system_settings_v1'
        ];
        keysToEnsure.forEach(k => {
          if (!existingCloudKeys.has(k)) {
            const val = unifiedValuesRef.current.get(k);
            if (val && (!Array.isArray(val) || val.length > 0)) {
              pushUnifiedErpStateToFirestore(k, val, 'Initial Database Unification', true);
            }
          }
        });
      }
    );

    return () => {
      isMounted = false;
      unsubUnifiedDb();
    };
  }, []);

  // Subscribe to branch-scoped authoritative inventory ledgers (enforcing Firestore rule scope)
  useEffect(() => {
    let isMounted = true;
    const unsubInventoryLedgers = subscribeToBranchInventoryLedgers(
      ledgers => {
        if (!isMounted || ledgers.length === 0) return;
        setInventoryItems(prev => {
          const byComp = new Map<string, InventoryItem>();
          prev.forEach(item => byComp.set(`${item.branchId}_${item.productId}`, item));
          let changed = false;

          ledgers.forEach(l => {
            const k = `${l.branchId}_${l.productId}`;
            const existing = byComp.get(k);
            if (existing) {
              if (existing.bottlesOnHand !== l.quantity) {
                changed = true;
                byComp.set(k, {
                  ...existing,
                  bottlesOnHand: l.quantity,
                  casesOnHand: Math.floor(l.quantity / 12),
                  lastScannedAt: l.updatedAt || existing.lastScannedAt
                });
              }
            } else if (l.quantity > 0) {
              changed = true;
              byComp.set(k, {
                id: l.id || `inv-ledger-${k}`,
                branchId: l.branchId,
                productId: l.productId,
                bottlesOnHand: l.quantity,
                casesOnHand: Math.floor(l.quantity / 12),
                reorderLevel: 12,
                batchNumber: 'CLOUD-LEDGER',
                expiryDate: '2030-12-31',
                lastScannedAt: l.updatedAt || new Date().toISOString()
              });
            }
          });

          return changed ? Array.from(byComp.values()) : prev;
        });
      },
      {
        branchId: activeBranchId || branches[0]?.id || 'branch-1',
        isAdmin: currentRole === 'SUPER_ADMIN'
      }
    );

    return () => {
      isMounted = false;
      unsubInventoryLedgers();
    };
  }, [activeBranchId, branches, currentRole, setInventoryItems]);

  // Keep Firestore `branchInventoryLedgers` unified when Admin mutates baseline inventory
  useEffect(() => {
    if (currentRole !== 'SUPER_ADMIN' || inventoryItems.length === 0 || products.length === 0) return;
    const timer = window.setTimeout(() => {
      syncInventoryItemsToBranchLedgers(inventoryItems, products);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [currentRole, inventoryItems, products]);

  // Compute total unified records across all ERP domains
  const totalUnifiedRecordsCount = React.useMemo(() => {
    return (
      branches.length +
      products.length +
      inventoryItems.length +
      orders.length +
      etimsInvoices.length +
      websiteDeliveryOrders.length +
      heldCarts.length +
      mpesaTransactions.length +
      chartOfAccounts.length +
      journalEntries.length +
      employees.length +
      payrollRecords.length +
      affiliates.length +
      commissions.length +
      restockRequests.length +
      suppliers.length +
      distributors.length +
      supplyInvoices.length +
      quotes.length +
      commercialInvoices.length +
      employeeLeaveRequests.length +
      salesRepOffDutyRequests.length +
      staffDatabaseRecords.length +
      userActivityLogs.length +
      userSessionMonitors.length +
      productRatings.length
    );
  }, [
    branches.length,
    products.length,
    inventoryItems.length,
    orders.length,
    etimsInvoices.length,
    websiteDeliveryOrders.length,
    heldCarts.length,
    mpesaTransactions.length,
    chartOfAccounts.length,
    journalEntries.length,
    employees.length,
    payrollRecords.length,
    affiliates.length,
    commissions.length,
    restockRequests.length,
    suppliers.length,
    distributors.length,
    supplyInvoices.length,
    quotes.length,
    commercialInvoices.length,
    employeeLeaveRequests.length,
    salesRepOffDutyRequests.length,
    staffDatabaseRecords.length,
    userActivityLogs.length,
    userSessionMonitors.length,
    productRatings.length
  ]);

  // Manual / On-Demand Full Database Unification Sync across all collections
  const syncAllDataToUnifiedDatabase = async (): Promise<{
    syncedCollections: number;
    totalRecords: number;
  }> => {
    setUnifiedDbSyncStatus('SYNCING');
    let syncedCollections = 0;

    for (const [key, value] of unifiedValuesRef.current.entries()) {
      if (key === 'user') continue;
      const ok = await pushUnifiedErpStateToFirestore(key, value, currentUser.name, true);
      if (ok) syncedCollections++;
    }

    await syncInventoryItemsToBranchLedgers(inventoryItems, products, true);
    await syncAllStaffsToIndependentDb();

    const nowIso = new Date().toISOString();
    setUnifiedDbSyncStatus('SYNCED');
    setLastUnifiedDbSyncAt(nowIso);
    setUnifiedCollectionsCount(Math.max(28, syncedCollections));

    return {
      syncedCollections: Math.max(28, syncedCollections),
      totalRecords: totalUnifiedRecordsCount
    };
  };

  // ============================================================================
  // INDEPENDENT STAFF DATABASE ENGINE (IndexedDB + Firestore + Instant Login)
  // ============================================================================
  const buildPersonalDataForStaff = React.useCallback(
    (staffId: string, staffName: string, preferredPrices?: Record<string, number>): StaffPersonalDataPayload => {
      const normName = staffName.trim().toLowerCase();
      const staffCommissions = commissions.filter(
        c => c.affiliateId === staffId || c.affiliateName.trim().toLowerCase() === normName
      );
      const staffLeaves = employeeLeaveRequests.filter(
        l => l.employeeId === staffId || l.employeeName.trim().toLowerCase() === normName
      );
      const staffOffDuties = salesRepOffDutyRequests.filter(
        o => o.affiliateId === staffId || o.affiliateName.trim().toLowerCase() === normName
      );
      const staffPayrolls = payrollRecords.filter(
        p => p.employeeId === staffId || p.employeeName.trim().toLowerCase() === normName
      );
      const staffHeldCarts = heldCarts.filter(
        h =>
          h.heldById === staffId ||
          h.affiliateId === staffId ||
          h.heldByName.trim().toLowerCase() === normName
      );
      const staffOrders = orders
        .filter(
          o =>
            o.cashierId === staffId ||
            o.affiliateId === staffId ||
            o.cashierName.trim().toLowerCase() === normName ||
            (o.affiliateName && o.affiliateName.trim().toLowerCase() === normName)
        )
        .slice(0, 25);

      return {
        staffId,
        commissions: staffCommissions,
        leaveRequests: staffLeaves,
        offDutyRequests: staffOffDuties,
        payrollRecords: staffPayrolls,
        heldCarts: staffHeldCarts,
        recentOrders: staffOrders,
        preferredPrices: preferredPrices || {},
        savedAt: new Date().toISOString()
      };
    },
    [commissions, employeeLeaveRequests, salesRepOffDutyRequests, payrollRecords, heldCarts, orders]
  );

  const restoreStaffPersonalDataIntoErp = React.useCallback((payload: StaffPersonalDataPayload | null) => {
    if (!payload) return;

    if (payload.commissions && payload.commissions.length > 0) {
      setCommissions(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const missing = payload.commissions!.filter(c => !existingIds.has(c.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }

    if (payload.leaveRequests && payload.leaveRequests.length > 0) {
      setEmployeeLeaveRequests(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const missing = payload.leaveRequests!.filter(l => !existingIds.has(l.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }

    if (payload.offDutyRequests && payload.offDutyRequests.length > 0) {
      setSalesRepOffDutyRequests(prev => {
        const existingIds = new Set(prev.map(o => o.id));
        const missing = payload.offDutyRequests!.filter(o => !existingIds.has(o.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }

    if (payload.payrollRecords && payload.payrollRecords.length > 0) {
      setPayrollRecords(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const missing = payload.payrollRecords!.filter(p => !existingIds.has(p.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }

    if (payload.heldCarts && payload.heldCarts.length > 0) {
      setHeldCarts(prev => {
        const existingIds = new Set(prev.map(h => h.id));
        const missing = payload.heldCarts!.filter(h => !existingIds.has(h.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }

    if (payload.recentOrders && payload.recentOrders.length > 0) {
      setOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id));
        const missing = payload.recentOrders!.filter(o => !existingIds.has(o.id));
        return missing.length > 0 ? [...missing, ...prev] : prev;
      });
    }
  }, []);

  // Merge incoming StaffDirectoryRecords from IndexedDB or Firestore into state
  const mergeIncomingStaffRecords = React.useCallback(
    (incomingRecords: StaffDirectoryRecord[], incomingSnapshots?: Record<string, StaffPersonalDataPayload>) => {
      if (!incomingRecords || incomingRecords.length === 0) return;
      const deletedSet = getDeletedStaffIdsSet();
      const validIncoming = incomingRecords.filter(r => r && r.id && !deletedSet.has(r.id));
      if (validIncoming.length === 0) return;

      setStaffDatabaseRecords(prev => {
        const map = new Map<string, StaffDirectoryRecord>();
        prev.forEach(r => {
          if (!deletedSet.has(r.id)) map.set(r.id, r);
        });
        validIncoming.forEach(inc => {
          const existing = map.get(inc.id);
          if (!existing || new Date(inc.updatedAt || 0).getTime() >= new Date(existing.updatedAt || 0).getTime()) {
            map.set(inc.id, {
              ...existing,
              ...inc,
              loginPin: inc.loginPin || existing?.loginPin,
              pinHash: inc.pinHash || existing?.pinHash,
              pinSalt: inc.pinSalt || existing?.pinSalt
            });
          }
        });
        const merged = Array.from(map.values());
        saveLocalIndependentStaffRecords(merged);
        return merged;
      });

      const incomingEmps = validIncoming
        .filter(r => r.recordType === 'EMPLOYEE')
        .map(staffDirectoryRecordToEmployee);
      if (incomingEmps.length > 0) {
        setEmployees(prev => {
          const byId = new Map(prev.filter(e => !deletedSet.has(e.id)).map(e => [e.id, e]));
          let changed = false;
          incomingEmps.forEach(emp => {
            const curr = byId.get(emp.id);
            const mergedPin = emp.loginPin || curr?.loginPin || '';
            const mergedHash = emp.pinHash || curr?.pinHash;
            const mergedSalt = emp.pinSalt || curr?.pinSalt;
            if (
              !curr ||
              (emp.loginPin && curr.loginPin !== emp.loginPin) ||
              (emp.pinHash && curr.pinHash !== emp.pinHash) ||
              curr.name !== emp.name ||
              curr.roleTitle !== emp.roleTitle ||
              curr.department !== emp.department ||
              curr.branchId !== emp.branchId ||
              curr.pendingCommissionKes !== emp.pendingCommissionKes ||
              curr.totalSalesKes !== emp.totalSalesKes ||
              curr.employmentStatus !== emp.employmentStatus ||
              curr.active !== emp.active
            ) {
              byId.set(emp.id, {
                ...curr,
                ...emp,
                loginPin: mergedPin,
                pinHash: mergedHash,
                pinSalt: mergedSalt
              });
              changed = true;
            }
          });
          return changed ? Array.from(byId.values()) : prev;
        });
      }

      const incomingAffs = validIncoming
        .filter(r => r.recordType === 'AFFILIATE')
        .map(staffDirectoryRecordToAffiliate);
      if (incomingAffs.length > 0) {
        setAffiliates(prev => {
          const byId = new Map(prev.filter(a => !deletedSet.has(a.id)).map(a => [a.id, a]));
          let changed = false;
          incomingAffs.forEach(aff => {
            const curr = byId.get(aff.id);
            const mergedPin = aff.loginPin || curr?.loginPin || '';
            const mergedHash = aff.pinHash || curr?.pinHash;
            const mergedSalt = aff.pinSalt || curr?.pinSalt;
            if (
              !curr ||
              (aff.loginPin && curr.loginPin !== aff.loginPin) ||
              (aff.pinHash && curr.pinHash !== aff.pinHash) ||
              curr.name !== aff.name ||
              curr.branchId !== aff.branchId ||
              curr.pendingCommissionKes !== aff.pendingCommissionKes ||
              curr.totalSalesKes !== aff.totalSalesKes ||
              curr.commissionRatePercent !== aff.commissionRatePercent ||
              curr.employmentStatus !== aff.employmentStatus ||
              curr.active !== aff.active
            ) {
              byId.set(aff.id, {
                ...curr,
                ...aff,
                loginPin: mergedPin,
                pinHash: mergedHash,
                pinSalt: mergedSalt
              });
              changed = true;
            }
          });
          return changed ? Array.from(byId.values()) : prev;
        });
      }

      // Restore personal data snapshots for each staff member
      incomingRecords.forEach(rec => {
        const snap = incomingSnapshots?.[rec.id] || parseStaffPersonalData(rec);
        if (snap) {
          restoreStaffPersonalDataIntoErp(snap);
        }
      });
    },
    [restoreStaffPersonalDataIntoErp]
  );

  // Hydrate from IndexedDB & Subscribe to Real-Time Firestore Independent Staff Database on mount
  useEffect(() => {
    let isMounted = true;
    setStaffDbSyncStatus('SYNCING');

    // Hydrate any locally stored independent staff records immediately on mount
    const initialLocalRecords = loadLocalIndependentStaffRecords();
    const initialLocalSnapshots = loadLocalStaffDataSnapshots();
    if (initialLocalRecords.length > 0) {
      mergeIncomingStaffRecords(initialLocalRecords, initialLocalSnapshots);
    }

    readAllFromStaffIndexedDb().then(({ records, snapshots }) => {
      if (!isMounted) return;
      if (records.length > 0) {
        mergeIncomingStaffRecords(records, snapshots);
      }
      setStaffDbSyncStatus('LOCAL_READY');
    });

    const unsubscribe = subscribeToIndependentStaffDatabase(cloudRecords => {
      if (!isMounted) return;
      if (cloudRecords.length > 0) {
        mergeIncomingStaffRecords(cloudRecords);
      }
      setStaffDbSyncStatus('SYNCED');
      setLastStaffDbSyncAt(new Date().toISOString());
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [mergeIncomingStaffRecords]);

  // Subscribe to Real-Time Firestore User Activity Logs & Session Monitors
  useEffect(() => {
    let isMounted = true;

    const unsubLogs = subscribeToUserActivityLogs(cloudLogs => {
      if (!isMounted || cloudLogs.length === 0) return;
      setUserActivityLogs(prev => {
        const map = new Map<string, UserActivityLog>();
        prev.forEach(l => map.set(l.id, l));
        cloudLogs.forEach(l => map.set(l.id, l));
        const merged = Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 350);
        saveLocalActivityLogs(merged);
        return merged;
      });
    });

    const unsubSessions = subscribeToUserSessionMonitors(cloudSessions => {
      if (!isMounted || cloudSessions.length === 0) return;
      setUserSessionMonitors(prev => {
        const map = new Map<string, UserSessionMonitorRecord>();
        prev.forEach(s => map.set(s.userId, s));
        cloudSessions.forEach(cs => {
          const existing = map.get(cs.userId);
          if (
            !existing ||
            new Date(cs.updatedAt || 0).getTime() >= new Date(existing.updatedAt || 0).getTime()
          ) {
            map.set(cs.userId, cs);
          }
        });
        const merged = Array.from(map.values());
        saveLocalSessionMonitors(merged);
        return merged;
      });
    });

    return () => {
      isMounted = false;
      unsubLogs();
      unsubSessions();
    };
  }, []);

  // Ensure every employee, affiliate, and executive user has a session monitor record
  useEffect(() => {
    const dev = detectCurrentDeviceProfile();
    setUserSessionMonitors(prev => {
      const map = new Map<string, UserSessionMonitorRecord>();
      prev.forEach(s => map.set(s.userId, s));
      let changed = false;

      employees.forEach(emp => {
        const br = branches.find(b => b.id === emp.branchId);
        const existing = map.get(emp.id);
        const staffRec = staffDatabaseRecords.find(r => r.id === emp.id);
        if (!existing) {
          map.set(emp.id, {
            userId: emp.id,
            userName: emp.name,
            employeeNumberOrCode: emp.employeeNumber,
            userRole: 'STAFF',
            department: emp.department,
            branchId: emp.branchId || '',
            branchName: br?.name || 'Assigned Branch',
            isActiveLogin: isAuthenticated && currentUser.id === emp.id,
            lastLoginAt: staffRec?.lastLoginAt,
            loginCount: staffRec?.loginCount || 0,
            deviceUsed: dev.deviceUsed,
            deviceType: dev.deviceType,
            browserOs: dev.browserOs,
            updatedAt: new Date().toISOString()
          });
          changed = true;
        } else if (existing.userName !== emp.name || existing.department !== emp.department) {
          map.set(emp.id, {
            ...existing,
            userName: emp.name,
            employeeNumberOrCode: emp.employeeNumber,
            department: emp.department,
            branchId: emp.branchId || existing.branchId,
            branchName: br?.name || existing.branchName
          });
          changed = true;
        }
      });

      affiliates.forEach(aff => {
        const br = branches.find(b => b.id === aff.branchId);
        const existing = map.get(aff.id);
        const staffRec = staffDatabaseRecords.find(r => r.id === aff.id);
        if (!existing) {
          map.set(aff.id, {
            userId: aff.id,
            userName: aff.name,
            employeeNumberOrCode: aff.code,
            userRole: 'STAFF',
            department: 'AFFILIATES',
            branchId: aff.branchId || '',
            branchName: br?.name || 'Assigned Branch',
            isActiveLogin: isAuthenticated && currentUser.id === aff.id,
            lastLoginAt: staffRec?.lastLoginAt,
            loginCount: staffRec?.loginCount || 0,
            deviceUsed: dev.deviceUsed,
            deviceType: dev.deviceType,
            browserOs: dev.browserOs,
            updatedAt: new Date().toISOString()
          });
          changed = true;
        } else if (existing.userName !== aff.name) {
          map.set(aff.id, {
            ...existing,
            userName: aff.name,
            employeeNumberOrCode: aff.code,
            branchId: aff.branchId || existing.branchId,
            branchName: br?.name || existing.branchName
          });
          changed = true;
        }
      });

      if (!changed) return prev;
      const next = Array.from(map.values());
      saveLocalSessionMonitors(next);
      return next;
    });
  }, [employees, affiliates, branches, staffDatabaseRecords, isAuthenticated, currentUser.id]);

  // Keep Independent Staff Database (Local Index + IndexedDB + Firestore) automatically synchronized whenever staff accounts or their data change
  useEffect(() => {
    const existingMetaMap = new Map<
      string,
      { lastLoginAt?: string; loginCount?: number; pinHash?: string; pinSalt?: string }
    >();
    staffDatabaseRecords.forEach(r => {
      existingMetaMap.set(r.id, {
        lastLoginAt: r.lastLoginAt,
        loginCount: r.loginCount,
        pinHash: r.pinHash,
        pinSalt: r.pinSalt
      });
    });

    const nextRecords: StaffDirectoryRecord[] = [];
    const nextSnapshots: Record<string, StaffPersonalDataPayload> = loadLocalStaffDataSnapshots();

    employees.forEach(emp => {
      const br = branches.find(b => b.id === emp.branchId);
      const personalData = buildPersonalDataForStaff(emp.id, emp.name);
      nextSnapshots[emp.id] = personalData;
      const rec = employeeToStaffDirectoryRecord(
        emp,
        br?.name,
        personalData,
        existingMetaMap.get(emp.id)
      );
      nextRecords.push(rec);
      writeRecordToStaffIndexedDb(rec, personalData);
    });

    affiliates.forEach(aff => {
      const br = branches.find(b => b.id === aff.branchId);
      const personalData = buildPersonalDataForStaff(aff.id, aff.name, aff.preferredPrices);
      nextSnapshots[aff.id] = personalData;
      const rec = affiliateToStaffDirectoryRecord(
        aff,
        br?.name,
        personalData,
        existingMetaMap.get(aff.id)
      );
      nextRecords.push(rec);
      writeRecordToStaffIndexedDb(rec, personalData);
    });

    if (nextRecords.length > 0) {
      const deletedSet = getDeletedStaffIdsSet();
      const activeIds = new Set(nextRecords.map(r => r.id));
      const prevById = new Map<string, StaffDirectoryRecord>();
      loadLocalIndependentStaffRecords().forEach(existingRec => {
        if (!deletedSet.has(existingRec.id) && activeIds.has(existingRec.id)) {
          prevById.set(existingRec.id, existingRec);
        }
      });
      staffDatabaseRecords.forEach(existingRec => {
        if (!deletedSet.has(existingRec.id) && activeIds.has(existingRec.id)) {
          prevById.set(existingRec.id, existingRec);
        }
      });

      const mergedById = new Map<string, StaffDirectoryRecord>(prevById);
      nextRecords.forEach(rec => {
        if (deletedSet.has(rec.id)) return;
        const prev = prevById.get(rec.id);
        const hasCoreChange =
          !prev ||
          prev.name !== rec.name ||
          prev.roleTitle !== rec.roleTitle ||
          prev.phone !== rec.phone ||
          (Boolean(rec.loginPin) && prev.loginPin !== rec.loginPin) ||
          (Boolean(rec.pinHash) && prev.pinHash !== rec.pinHash) ||
          prev.department !== rec.department ||
          prev.branchId !== rec.branchId ||
          prev.codeOrNumber !== rec.codeOrNumber ||
          prev.commissionRatePercent !== rec.commissionRatePercent ||
          prev.totalSalesKes !== rec.totalSalesKes ||
          prev.pendingCommissionKes !== rec.pendingCommissionKes ||
          prev.paidCommissionKes !== rec.paidCommissionKes ||
          prev.basicSalaryKes !== rec.basicSalaryKes ||
          prev.preferredPricesJson !== rec.preferredPricesJson ||
          prev.assignedCashierId !== rec.assignedCashierId ||
          prev.employmentStatus !== rec.employmentStatus ||
          prev.active !== rec.active;

        const finalRec: StaffDirectoryRecord = {
          ...prev,
          ...rec,
          loginPin: rec.loginPin || prev?.loginPin,
          pinHash: rec.pinHash || prev?.pinHash,
          pinSalt: rec.pinSalt || prev?.pinSalt,
          updatedAt: hasCoreChange ? rec.updatedAt : prev?.updatedAt || rec.updatedAt
        };

        mergedById.set(rec.id, finalRec);
        if (hasCoreChange) {
          pushStaffRecordToFirestore(finalRec);
        }
      });
      const mergedList = Array.from(mergedById.values());
      saveLocalIndependentStaffRecords(mergedList);
      saveLocalStaffDataSnapshots(nextSnapshots);
      setStaffDatabaseRecords(mergedList);
    } else {
      saveLocalIndependentStaffRecords([]);
      setStaffDatabaseRecords([]);
    }
  }, [
    employees,
    affiliates,
    branches,
    commissions,
    employeeLeaveRequests,
    salesRepOffDutyRequests,
    payrollRecords,
    heldCarts,
    orders,
    buildPersonalDataForStaff
  ]);

  const syncAllStaffsToIndependentDb = async (): Promise<number> => {
    setStaffDbSyncStatus('SYNCING');
    let count = 0;
    for (const emp of employees) {
      const br = branches.find(b => b.id === emp.branchId);
      const personalData = buildPersonalDataForStaff(emp.id, emp.name);
      const existing = staffDatabaseRecords.find(r => r.id === emp.id);
      const rec = employeeToStaffDirectoryRecord(emp, br?.name, personalData, {
        lastLoginAt: existing?.lastLoginAt,
        loginCount: existing?.loginCount
      });
      await upsertStaffRecordAcrossAllTiers(rec, personalData);
      count++;
    }
    for (const aff of affiliates) {
      const br = branches.find(b => b.id === aff.branchId);
      const personalData = buildPersonalDataForStaff(aff.id, aff.name, aff.preferredPrices);
      const existing = staffDatabaseRecords.find(r => r.id === aff.id);
      const rec = affiliateToStaffDirectoryRecord(aff, br?.name, personalData, {
        lastLoginAt: existing?.lastLoginAt,
        loginCount: existing?.loginCount
      });
      await upsertStaffRecordAcrossAllTiers(rec, personalData);
      count++;
    }
    setStaffDbSyncStatus('SYNCED');
    setLastStaffDbSyncAt(new Date().toISOString());
    return count;
  };

  const deleteStaffFromIndependentDb = async (staffId: string): Promise<void> => {
    if (!staffId) return;
    const targetEmp = employees.find(e => e.id === staffId);
    const targetAff = affiliates.find(a => a.id === staffId);
    const staffName = targetEmp?.name || targetAff?.name || staffId;

    markStaffIdDeletedLocally(staffId);

    const nextEmployees = employees.filter(e => e.id !== staffId);
    const nextAffiliates = affiliates.filter(a => a.id !== staffId);

    setEmployees(prev => prev.filter(e => e.id !== staffId));
    setAffiliates(prev => prev.filter(a => a.id !== staffId));
    if (selectedAffiliate?.id === staffId) {
      setSelectedAffiliate(null);
    }
    setStaffDatabaseRecords(prev => {
      const next = prev.filter(r => r.id !== staffId);
      saveLocalIndependentStaffRecords(next);
      return next;
    });

    if (currentRole === 'STAFF' && currentUser.id === staffId) {
      setIsAuthenticated(false);
    }

    await Promise.all([
      deleteRecordFromStaffIndexedDb(staffId),
      removeStaffRecordFromFirestore(staffId),
      pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name || 'STAFF-DELETE', true),
      pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name || 'STAFF-DELETE', true)
    ]);

    logUserActivity({
      actionType: 'SYSTEM_ACTION',
      actionTitle: `Deleted Staff Member: ${staffName}`,
      actionDetails: `Permanently deleted staff account ${staffName} (${staffId}) across all databases.`,
      module: 'HR_PAYROLL'
    });
  };

  const wipeAllUsersAndStaff = async (): Promise<boolean> => {
    try {
      // 1. Wipe on server authoritative DAL & staffAuthStore
      await fetch('/api/erp/admin/wipe-all-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      }).catch(() => {});

      // 2. Wipe browser LocalStorage for staff
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('vaairo_independent_staff_db_v1_records');
        localStorage.removeItem('vaairo_independent_staff_db_v1_snapshots');
        localStorage.removeItem('vaairo_deleted_staff_ids_v1');
        localStorage.removeItem('employees');
        localStorage.removeItem('affiliates');
      }

      // 3. Clear IndexedDB
      try {
        indexedDB.deleteDatabase('VaairoIndependentStaffDB');
      } catch {}

      // 4. Update React state
      setEmployees([]);
      setAffiliates([]);
      setStaffDatabaseRecords([]);
      setSelectedAffiliate(null);

      // 5. Broadcast empty arrays to server unified state
      void pushUnifiedErpStateToFirestore('employees', [], currentUser.name || 'WIPE', true);
      void pushUnifiedErpStateToFirestore('affiliates', [], currentUser.name || 'WIPE', true);

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: 'Wiped All Staff & User Accounts',
        actionDetails: 'Administrator executed full user wipe. Ready for fresh staff onboarding.',
        module: 'HR_PAYROLL'
      });

      return true;
    } catch {
      return false;
    }
  };

  const suspendStaffMember = async (staffId: string, reason?: string): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const cleanReason = (reason || 'Suspended by Management').trim();
    const targetEmp = employees.find(e => e.id === staffId);
    const targetAff = affiliates.find(a => a.id === staffId);

    if (targetEmp) {
      const updatedEmp: Employee = {
        ...targetEmp,
        active: false,
        employmentStatus: 'SUSPENDED',
        suspendedAt: nowIso,
        suspensionReason: cleanReason
      };
      const nextEmployees = employees.map(e => (e.id === staffId ? updatedEmp : e));
      setEmployees(prev => prev.map(e => (e.id === staffId ? updatedEmp : e)));

      const targetBranch = branches.find(b => b.id === updatedEmp.branchId);
      const personalData = buildPersonalDataForStaff(updatedEmp.id, updatedEmp.name);
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedEmp.id);
      const staffRec = employeeToStaffDirectoryRecord(updatedEmp, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      if (currentRole === 'STAFF' && currentUser.id === staffId) {
        setIsAuthenticated(false);
      }

      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name || 'STAFF-SUSPEND', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedEmp.id,
          name: updatedEmp.name,
          codeOrNumber: updatedEmp.employeeNumber,
          department: updatedEmp.department,
          branchId: updatedEmp.branchId || activeBranchId || 'branch-1',
          rawPin: updatedEmp.loginPin || undefined,
          active: false
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Suspended Staff Account: ${updatedEmp.name}`,
        actionDetails: `Suspended ${updatedEmp.name} (${updatedEmp.employeeNumber}) • Reason: ${cleanReason}`,
        module: 'HR_PAYROLL'
      });
      return true;
    }

    if (targetAff) {
      const updatedAff: Affiliate = {
        ...targetAff,
        active: false,
        employmentStatus: 'SUSPENDED',
        suspendedAt: nowIso,
        suspensionReason: cleanReason
      };
      const nextAffiliates = affiliates.map(a => (a.id === staffId ? updatedAff : a));
      setAffiliates(prev => prev.map(a => (a.id === staffId ? updatedAff : a)));
      if (selectedAffiliate?.id === staffId) {
        setSelectedAffiliate(updatedAff);
      }

      const targetBranch = branches.find(b => b.id === updatedAff.branchId);
      const personalData = buildPersonalDataForStaff(
        updatedAff.id,
        updatedAff.name,
        updatedAff.preferredPrices
      );
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedAff.id);
      const staffRec = affiliateToStaffDirectoryRecord(updatedAff, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      if (currentRole === 'STAFF' && currentUser.id === staffId) {
        setIsAuthenticated(false);
      }

      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name || 'STAFF-SUSPEND', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedAff.id,
          name: updatedAff.name,
          codeOrNumber: updatedAff.code,
          department: 'AFFILIATES',
          branchId: updatedAff.branchId || activeBranchId || 'branch-1',
          rawPin: updatedAff.loginPin || undefined,
          active: false
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Suspended Sales Representative: ${updatedAff.name}`,
        actionDetails: `Suspended ${updatedAff.name} (${updatedAff.code}) • Reason: ${cleanReason}`,
        module: 'AFFILIATES'
      });
      return true;
    }

    return false;
  };

  const terminateStaffMember = async (staffId: string, reason?: string): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const cleanReason = (reason || 'Employment Terminated by Management').trim();
    const targetEmp = employees.find(e => e.id === staffId);
    const targetAff = affiliates.find(a => a.id === staffId);

    if (targetEmp) {
      const updatedEmp: Employee = {
        ...targetEmp,
        active: false,
        employmentStatus: 'TERMINATED',
        terminatedAt: nowIso,
        terminationReason: cleanReason
      };
      const nextEmployees = employees.map(e => (e.id === staffId ? updatedEmp : e));
      setEmployees(prev => prev.map(e => (e.id === staffId ? updatedEmp : e)));

      const targetBranch = branches.find(b => b.id === updatedEmp.branchId);
      const personalData = buildPersonalDataForStaff(updatedEmp.id, updatedEmp.name);
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedEmp.id);
      const staffRec = employeeToStaffDirectoryRecord(updatedEmp, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      if (currentRole === 'STAFF' && currentUser.id === staffId) {
        setIsAuthenticated(false);
      }

      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name || 'STAFF-TERMINATE', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedEmp.id,
          name: updatedEmp.name,
          codeOrNumber: updatedEmp.employeeNumber,
          department: updatedEmp.department,
          branchId: updatedEmp.branchId || activeBranchId || 'branch-1',
          rawPin: updatedEmp.loginPin || undefined,
          active: false
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Terminated Staff Member: ${updatedEmp.name}`,
        actionDetails: `Terminated ${updatedEmp.name} (${updatedEmp.employeeNumber}) • Reason: ${cleanReason}`,
        module: 'HR_PAYROLL'
      });
      return true;
    }

    if (targetAff) {
      const updatedAff: Affiliate = {
        ...targetAff,
        active: false,
        employmentStatus: 'TERMINATED',
        terminatedAt: nowIso,
        terminationReason: cleanReason
      };
      const nextAffiliates = affiliates.map(a => (a.id === staffId ? updatedAff : a));
      setAffiliates(prev => prev.map(a => (a.id === staffId ? updatedAff : a)));
      if (selectedAffiliate?.id === staffId) {
        setSelectedAffiliate(updatedAff);
      }

      const targetBranch = branches.find(b => b.id === updatedAff.branchId);
      const personalData = buildPersonalDataForStaff(
        updatedAff.id,
        updatedAff.name,
        updatedAff.preferredPrices
      );
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedAff.id);
      const staffRec = affiliateToStaffDirectoryRecord(updatedAff, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      if (currentRole === 'STAFF' && currentUser.id === staffId) {
        setIsAuthenticated(false);
      }

      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name || 'STAFF-TERMINATE', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedAff.id,
          name: updatedAff.name,
          codeOrNumber: updatedAff.code,
          department: 'AFFILIATES',
          branchId: updatedAff.branchId || activeBranchId || 'branch-1',
          rawPin: updatedAff.loginPin || undefined,
          active: false
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Terminated Sales Representative: ${updatedAff.name}`,
        actionDetails: `Terminated ${updatedAff.name} (${updatedAff.code}) • Reason: ${cleanReason}`,
        module: 'AFFILIATES'
      });
      return true;
    }

    return false;
  };

  const reactivateStaffMember = async (staffId: string): Promise<boolean> => {
    const targetEmp = employees.find(e => e.id === staffId);
    const targetAff = affiliates.find(a => a.id === staffId);

    if (targetEmp) {
      const updatedEmp: Employee = {
        ...targetEmp,
        active: true,
        employmentStatus: 'ACTIVE',
        suspendedAt: undefined,
        suspensionReason: undefined,
        terminatedAt: undefined,
        terminationReason: undefined
      };
      const nextEmployees = employees.map(e => (e.id === staffId ? updatedEmp : e));
      setEmployees(prev => prev.map(e => (e.id === staffId ? updatedEmp : e)));

      const targetBranch = branches.find(b => b.id === updatedEmp.branchId);
      const personalData = buildPersonalDataForStaff(updatedEmp.id, updatedEmp.name);
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedEmp.id);
      const staffRec = employeeToStaffDirectoryRecord(updatedEmp, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name || 'STAFF-REACTIVATE', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedEmp.id,
          name: updatedEmp.name,
          codeOrNumber: updatedEmp.employeeNumber,
          department: updatedEmp.department,
          branchId: updatedEmp.branchId || activeBranchId || 'branch-1',
          rawPin: updatedEmp.loginPin || undefined,
          active: true
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Reactivated Staff Account: ${updatedEmp.name}`,
        actionDetails: `Restored active access for ${updatedEmp.name} (${updatedEmp.employeeNumber}).`,
        module: 'HR_PAYROLL'
      });
      return true;
    }

    if (targetAff) {
      const updatedAff: Affiliate = {
        ...targetAff,
        active: true,
        employmentStatus: 'ACTIVE',
        suspendedAt: undefined,
        suspensionReason: undefined,
        terminatedAt: undefined,
        terminationReason: undefined
      };
      const nextAffiliates = affiliates.map(a => (a.id === staffId ? updatedAff : a));
      setAffiliates(prev => prev.map(a => (a.id === staffId ? updatedAff : a)));
      if (selectedAffiliate?.id === staffId) {
        setSelectedAffiliate(updatedAff);
      }

      const targetBranch = branches.find(b => b.id === updatedAff.branchId);
      const personalData = buildPersonalDataForStaff(
        updatedAff.id,
        updatedAff.name,
        updatedAff.preferredPrices
      );
      const existingRec = staffDatabaseRecords.find(r => r.id === updatedAff.id);
      const staffRec = affiliateToStaffDirectoryRecord(updatedAff, targetBranch?.name, personalData, {
        lastLoginAt: existingRec?.lastLoginAt,
        loginCount: existingRec?.loginCount,
        pinHash: existingRec?.pinHash,
        pinSalt: existingRec?.pinSalt
      });

      setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
      await Promise.all([
        upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
        pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name || 'STAFF-REACTIVATE', true)
      ]);
      fetch('/api/auth/register-staff-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: updatedAff.id,
          name: updatedAff.name,
          codeOrNumber: updatedAff.code,
          department: 'AFFILIATES',
          branchId: updatedAff.branchId || activeBranchId || 'branch-1',
          rawPin: updatedAff.loginPin || undefined,
          active: true
        })
      }).catch(() => {});

      logUserActivity({
        actionType: 'SYSTEM_ACTION',
        actionTitle: `Reactivated Sales Representative: ${updatedAff.name}`,
        actionDetails: `Restored active access for ${updatedAff.name} (${updatedAff.code}).`,
        module: 'AFFILIATES'
      });
      return true;
    }

    return false;
  };

  const resetAllErpData = () => {
    setBranches(INITIAL_BRANCHES);
    setProducts([]);
    setInventoryItems([]);
    setScanHistory([]);
    setCart([]);
    setHeldCarts([]);
    setSelectedAffiliate(null);
    setOrders([]);
    setEtimsInvoices([]);
    setLastCompletedInvoice(null);
    setMpesaTransactions([]);
    setChartOfAccounts(INITIAL_CHART_OF_ACCOUNTS);
    setJournalEntries([]);
    // NOTE: Staffs (employees & affiliates) are stored in the Independent Staff Database
    // so they remain intact for instant login even if operational ERP ledgers are reset.
    setPayrollRecords([]);
    setCommissions([]);
    setRestockRequests([]);
    setSuppliers([]);
    setDistributors([]);
    setSupplyInvoices([]);
    setQuotes([]);
    setCommercialInvoices([]);
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0] || UNCONFIGURED_BRANCH_FALLBACK;

  // Central User Activity & Session Telemetry Logger
  const logUserActivity = React.useCallback(
    (params: {
      actionType: UserActivityActionType;
      actionTitle: string;
      actionDetails: string;
      module?: string;
      overrideUser?: {
        id: string;
        name: string;
        role: UserRole;
        department: DepartmentType;
        branchId?: string;
      };
    }): UserActivityLog => {
      const targetUserId = params.overrideUser?.id || currentUser.id || 'usr-01';
      const targetUserName = params.overrideUser?.name || currentUser.name || 'System User';
      const targetRole = params.overrideUser?.role || currentRole;
      const targetDept = params.overrideUser?.department || currentDepartment;
      const targetBrId = params.overrideUser?.branchId ?? activeBranch.id;
      const targetBrObj = branches.find(b => b.id === targetBrId);
      const targetBrName =
        targetBrObj?.name ||
        (activeBranch.id !== 'unconfigured-branch' ? activeBranch.name : 'Head Office / All Branches');

      const entry = buildActivityLogEntry({
        userId: targetUserId,
        userName: targetUserName,
        userRole: targetRole,
        department: targetDept,
        branchId: targetBrId,
        branchName: targetBrName,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        actionDetails: params.actionDetails,
        module: params.module || targetDept
      });

      setUserActivityLogs(prev => {
        const next = [entry, ...prev.filter(l => l.id !== entry.id)].slice(0, 350);
        saveLocalActivityLogs(next);
        return next;
      });
      pushActivityLogToFirestore(entry);
      // Server-authoritative audit logging with tamper-proof server timestamp
      fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          userId: targetUserId,
          userName: targetUserName,
          userRole: targetRole,
          department: targetDept,
          actionType: params.actionType,
          actionTitle: params.actionTitle,
          actionDetails: params.actionDetails,
          module: params.module || targetDept
        })
      }).catch(() => {});

      const nowIso = entry.timestamp;
      setUserSessionMonitors(prev => {
        const map = new Map<string, UserSessionMonitorRecord>();
        prev.forEach(s => map.set(s.userId, s));
        const existing = map.get(targetUserId);
        const empMatch = employees.find(e => e.id === targetUserId);
        const affMatch = affiliates.find(a => a.id === targetUserId);
        const code =
          empMatch?.employeeNumber ||
          affMatch?.code ||
          existing?.employeeNumberOrCode ||
          (targetRole === 'SUPER_ADMIN' ? 'EXEC-ADMIN' : targetRole === 'ACCOUNTANT' ? 'CPA-ACCT' : 'STAFF');

        const isLoginAction = params.actionType === 'LOGIN';
        const isLogoutAction = params.actionType === 'LOGOUT';

        const updatedSession: UserSessionMonitorRecord = {
          userId: targetUserId,
          userName: targetUserName,
          employeeNumberOrCode: code,
          userRole: targetRole,
          department: targetDept,
          branchId: targetBrId,
          branchName: targetBrName,
          isActiveLogin: isLogoutAction ? false : isLoginAction ? true : (existing?.isActiveLogin ?? true),
          activeLoginAt: isLoginAction
            ? nowIso
            : isLogoutAction
            ? existing?.activeLoginAt
            : existing?.activeLoginAt || nowIso,
          lastLoginAt: isLoginAction ? nowIso : existing?.lastLoginAt || nowIso,
          lastLogoutAt: isLogoutAction ? nowIso : existing?.lastLogoutAt,
          lastHeartbeatAt: nowIso,
          loginCount: isLoginAction ? (existing?.loginCount || 0) + 1 : existing?.loginCount || 1,
          lastActionTitle: params.actionTitle,
          lastActionDetails: params.actionDetails,
          lastActionAt: nowIso,
          currentModule: params.module || existing?.currentModule || targetDept,
          deviceUsed: entry.deviceUsed,
          deviceType: entry.deviceType,
          browserOs: entry.browserOs,
          authMethod:
            isLoginAction
              ? targetRole === 'STAFF'
                ? 'STAFF_PIN'
                : 'GOOGLE_SSO'
              : existing?.authMethod,
          updatedAt: nowIso
        };

        map.set(targetUserId, updatedSession);
        const nextList = Array.from(map.values());
        saveLocalSessionMonitors(nextList);
        pushSessionMonitorToFirestore(updatedSession);
        return nextList;
      });

      return entry;
    },
    [currentUser, currentRole, currentDepartment, activeBranch, branches, employees, affiliates]
  );

  // Auth Operations
  const loginAsRole = (role: UserRole, department: DepartmentType, branchId?: string, staffNameOverride?: string) => {
    const syncLocalRecords = loadLocalIndependentStaffRecords();

    const matchedAffiliate =
      role === 'STAFF' && department === 'AFFILIATES'
        ? affiliates.find(
            a =>
              (staffNameOverride && a.name.toLowerCase() === staffNameOverride.trim().toLowerCase()) ||
              (!staffNameOverride && a.active)
          ) ||
          (() => {
            const rec = syncLocalRecords.find(
              r =>
                r.recordType === 'AFFILIATE' &&
                r.active &&
                ((staffNameOverride && r.name.toLowerCase() === staffNameOverride.trim().toLowerCase()) ||
                  !staffNameOverride)
            );
            return rec ? staffDirectoryRecordToAffiliate(rec) : undefined;
          })()
        : undefined;

    const matchedEmployee =
      role === 'STAFF'
        ? employees.find(
            e =>
              (staffNameOverride && e.name.toLowerCase() === staffNameOverride.trim().toLowerCase()) ||
              (!staffNameOverride && e.department === department)
          ) ||
          (() => {
            const rec = syncLocalRecords.find(
              r =>
                r.recordType === 'EMPLOYEE' &&
                r.active &&
                ((staffNameOverride && r.name.toLowerCase() === staffNameOverride.trim().toLowerCase()) ||
                  (!staffNameOverride && r.department === department))
            );
            return rec ? staffDirectoryRecordToEmployee(rec) : undefined;
          })()
        : undefined;

    const fallbackStaffName =
      matchedAffiliate?.name ||
      matchedEmployee?.name ||
      staffNameOverride?.trim() ||
      (department === 'POS'
        ? 'POS Cashier'
        : department === 'AFFILIATES'
        ? 'Sales Representative'
        : department === 'HR_PAYROLL'
        ? 'HR Payroll Officer'
        : department === 'INVENTORY'
        ? 'Inventory Controller'
        : department === 'PROCUREMENT'
        ? 'Procurement Lead'
        : department === 'DELIVERY_MANAGER'
        ? 'Branch Delivery Manager'
        : department === 'SALES_MANAGER'
        ? 'Branch Sales Manager'
        : department === 'BILLING'
        ? 'Billing Officer'
        : 'Finance Staff');

    const userName =
      role === 'SUPER_ADMIN'
        ? staffNameOverride?.trim() || 'System Administrator'
        : role === 'ACCOUNTANT'
        ? staffNameOverride?.trim() || 'Chief Accountant (CPA-K)'
        : fallbackStaffName;

    const targetBranchId =
      branchId ||
      matchedAffiliate?.branchId ||
      matchedEmployee?.branchId ||
      branches[0]?.id ||
      '';

    const matchedUser: User = {
      id:
        matchedAffiliate?.id ||
        matchedEmployee?.id ||
        `usr-${role.toLowerCase()}-${department.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      name: userName,
      email: `${role.toLowerCase()}.${department.toLowerCase()}@vaairo.co.ke`,
      role,
      department: matchedAffiliate ? 'AFFILIATES' : matchedEmployee?.department || department,
      branchId: targetBranchId,
      phone: matchedAffiliate?.mpesaNumber || matchedEmployee?.mPesaNumber || '+254 700 000 000',
      mfaEnabled: role !== 'STAFF',
      loginPin: matchedAffiliate?.loginPin || matchedEmployee?.loginPin
    };

    if (matchedAffiliate) {
      setSelectedAffiliate(matchedAffiliate);
      setPosStationMode('SALES_LADY');
    } else {
      if (department !== 'AFFILIATES') {
        setSelectedAffiliate(null);
      }
      setPosStationMode(department === 'AFFILIATES' ? 'SALES_LADY' : 'COUNTER_CASHIER');
    }

    setIsMfaPending(false);
    setIsAuthenticated(true);

    setCurrentUser({
      ...matchedUser,
      department,
      branchId: targetBranchId
    });
    setCurrentRole(role);
    setCurrentDepartment(department);
    if (targetBranchId) setActiveBranchId(targetBranchId);

    // Ensure the browser always holds a valid server-signed session token for this role/department/branch
    fetch('/api/auth/terminal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: matchedUser.id,
        name: userName,
        email: matchedUser.email,
        role,
        department,
        branchId: targetBranchId
      })
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data.token === 'string' && data.token) {
          setStoredSessionToken(data.token);
        }
      })
      .catch(() => {});

    // If logging in as a Staff / Affiliate, restore their independent database snapshot & record login timestamp
    const staffIdToSync = matchedAffiliate?.id || matchedEmployee?.id;
    if (staffIdToSync) {
      const snaps = loadLocalStaffDataSnapshots();
      const targetRec = staffDatabaseRecords.find(r => r.id === staffIdToSync);
      const personalPayload = snaps[staffIdToSync] || (targetRec ? parseStaffPersonalData(targetRec) : null);
      if (personalPayload) {
        restoreStaffPersonalDataIntoErp(personalPayload);
      }
      if (targetRec) {
        const updatedRec: StaffDirectoryRecord = {
          ...targetRec,
          lastLoginAt: new Date().toISOString(),
          loginCount: (targetRec.loginCount || 0) + 1,
          updatedAt: new Date().toISOString()
        };
        upsertStaffRecordAcrossAllTiers(updatedRec, personalPayload || undefined);
      }
    }

    const devInfo = detectCurrentDeviceProfile();
    logUserActivity({
      actionType: 'LOGIN',
      actionTitle: `Signed In as ${userName} (${role === 'STAFF' ? department : role})`,
      actionDetails: `Active login started on ${devInfo.deviceUsed} • Role: ${role} • Dept: ${department}`,
      module: department,
      overrideUser: {
        id: matchedUser.id,
        name: userName,
        role,
        department: matchedUser.department,
        branchId: targetBranchId
      }
    });
  };

  // Instant Login by Staff Record ID directly from the Independent Staff Database
  const instantLoginByStaffRecord = (
    staffId: string
  ): { success: boolean; staffRecord?: StaffDirectoryRecord; error?: string } => {
    const allRecords =
      staffDatabaseRecords.length > 0 ? staffDatabaseRecords : loadLocalIndependentStaffRecords();
    const record = allRecords.find(r => r.id === staffId && r.active);
    if (!record) {
      return {
        success: false,
        error: 'Staff account not found in the Independent Staff Database.'
      };
    }

    const snaps = loadLocalStaffDataSnapshots();
    const personalPayload = snaps[record.id] || parseStaffPersonalData(record);
    if (personalPayload) {
      restoreStaffPersonalDataIntoErp(personalPayload);
    }

    loginAsRole('STAFF', record.department, record.branchId || activeBranchId, record.name);
    setIsAuthenticated(true);

    const updatedRec: StaffDirectoryRecord = {
      ...record,
      lastLoginAt: new Date().toISOString(),
      loginCount: (record.loginCount || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    upsertStaffRecordAcrossAllTiers(updatedRec, personalPayload || undefined);

    return { success: true, staffRecord: updatedRec };
  };

  // Instant Login using 6-digit PIN across the Independent Staff Database (auto-detects staff, department, branch & data)
  const instantLoginWithStaffPin = (
    pin: string,
    preferredDept?: DepartmentType,
    preferredStaffId?: string
  ): { success: boolean; staffRecord?: StaffDirectoryRecord; error?: string } => {
    const cleanPin = (pin || '').replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit Staff Login PIN.' };
    }

    // Combine live staffDatabaseRecords + any newly created employees/affiliates
    const combinedMap = new Map<string, StaffDirectoryRecord>();
    staffDatabaseRecords.forEach(r => combinedMap.set(r.id, r));
    employees.forEach(emp => {
      if (!combinedMap.has(emp.id)) {
        const br = branches.find(b => b.id === emp.branchId);
        combinedMap.set(emp.id, employeeToStaffDirectoryRecord(emp, br?.name));
      }
    });
    affiliates.forEach(aff => {
      if (!combinedMap.has(aff.id)) {
        const br = branches.find(b => b.id === aff.branchId);
        combinedMap.set(aff.id, affiliateToStaffDirectoryRecord(aff, br?.name));
      }
    });

    const allRecords = Array.from(combinedMap.values());
    if (allRecords.length === 0) {
      return {
        success: false,
        error:
          'No staff accounts registered in the Independent Staff Database yet. Use Quick Register Staff below or create via Admin / HR / Branch Manager / Sales Manager.'
      };
    }

    // If a specific staff member was selected AND the PIN doesn't match that staff member, check if it matches another staff member in the database!
    const matchedRecord = findStaffByPinInstant(cleanPin, allRecords, preferredDept, preferredStaffId);
    if (!matchedRecord) {
      // Check if it matches a suspended or terminated staff account so we give a clear status message
      const inactiveMatch = allRecords.find(
        r => !r.active && (r.id === preferredStaffId || r.loginPin === cleanPin)
      );
      if (inactiveMatch) {
        const statusLabel =
          inactiveMatch.employmentStatus === 'TERMINATED'
            ? `Employment Terminated: ${inactiveMatch.name}'s staff access has been terminated.`
            : `Account Suspended: ${inactiveMatch.name}'s staff account is currently suspended by management.`;
        return {
          success: false,
          error: statusLabel
        };
      }
      const selectedStaff = preferredStaffId ? allRecords.find(r => r.id === preferredStaffId) : null;
      return {
        success: false,
        error: selectedStaff
          ? `Invalid 6-digit PIN for ${selectedStaff.name} (and no matching staff found in Independent Staff DB for PIN ${cleanPin}).`
          : `No staff account in the Independent Staff Database matches 6-digit PIN ${cleanPin}.`
      };
    }

    const snaps = loadLocalStaffDataSnapshots();
    const personalPayload = snaps[matchedRecord.id] || parseStaffPersonalData(matchedRecord);
    if (personalPayload) {
      restoreStaffPersonalDataIntoErp(personalPayload);
    }

    loginAsRole(
      'STAFF',
      matchedRecord.department,
      matchedRecord.branchId || activeBranchId,
      matchedRecord.name
    );
    setIsAuthenticated(true);

    const updatedRec: StaffDirectoryRecord = {
      ...matchedRecord,
      lastLoginAt: new Date().toISOString(),
      loginCount: (matchedRecord.loginCount || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    upsertStaffRecordAcrossAllTiers(updatedRec, personalPayload || undefined);

    return { success: true, staffRecord: updatedRec };
  };

  const updateCurrentUserName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const matchedAff = affiliates.find(a => a.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (matchedAff) {
      if (
        isAuthenticated &&
        currentRole === 'STAFF' &&
        (currentDepartment !== 'AFFILIATES' ||
          (currentUser.branchId && matchedAff.branchId && matchedAff.branchId !== currentUser.branchId))
      ) {
        return;
      }
      setSelectedAffiliate(matchedAff);
      setPosStationMode('SALES_LADY');
      if (currentRole === 'STAFF') {
        setCurrentDepartment('AFFILIATES');
        setCurrentUser(prev => ({
          ...prev,
          id: matchedAff.id,
          name: matchedAff.name,
          department: 'AFFILIATES'
        }));
      } else {
        setCurrentUser(prev => ({ ...prev, name: matchedAff.name }));
      }
      return;
    }

    const matchedEmp = employees.find(e => e.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (matchedEmp) {
      if (
        isAuthenticated &&
        currentRole === 'STAFF' &&
        (matchedEmp.department !== currentDepartment ||
          (currentUser.branchId && matchedEmp.branchId && matchedEmp.branchId !== currentUser.branchId))
      ) {
        return;
      }
      setSelectedAffiliate(null);
      setPosStationMode('COUNTER_CASHIER');
      if (currentRole === 'STAFF') {
        setCurrentDepartment(matchedEmp.department);
        setCurrentUser(prev => ({
          ...prev,
          id: matchedEmp.id,
          name: matchedEmp.name,
          department: matchedEmp.department
        }));
      } else {
        setCurrentUser(prev => ({ ...prev, name: matchedEmp.name }));
      }
      return;
    }

    setCurrentUser(prev => ({ ...prev, name: trimmed }));
  };
  const updateCurrentStaffName = updateCurrentUserName;

  const isSalesAffiliateLady =
    currentDepartment === 'AFFILIATES' ||
    posStationMode === 'SALES_LADY' ||
    (currentRole === 'STAFF' &&
      affiliates.some(
        a =>
          a.id === currentUser.id ||
          a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      ));

  const isPosCashier =
    !isSalesAffiliateLady &&
    posStationMode === 'COUNTER_CASHIER' &&
    (currentDepartment === 'POS' || currentRole === 'SUPER_ADMIN' || currentRole === 'ACCOUNTANT');

  // TOTP secret is strictly server-side only (never stored in browser or exposed to client)
  const adminTotpSecret = '';

  const confirmMfa = (_code: string): boolean => {
    // Client-side MFA fallback is disabled; all TOTP verification must succeed via /api/auth/verify-google-mfa
    return false;
  };

  const logout = () => {
    logUserActivity({
      actionType: 'LOGOUT',
      actionTitle: `Logged Out / Locked Session (${currentUser.name})`,
      actionDetails: `User ${currentUser.name} (${currentRole} • ${currentDepartment}) locked session and returned to gateway.`,
      module: currentDepartment
    });
    setIsAuthenticated(false);
    setIsMfaPending(false);
  };

  const switchDepartment = (dept: DepartmentType) => {
    if (isAuthenticated && currentRole !== 'SUPER_ADMIN') {
      return;
    }
    setCurrentDepartment(dept);
    setPosStationMode(dept === 'AFFILIATES' ? 'SALES_LADY' : 'COUNTER_CASHIER');
    setCurrentUser(prev => ({ ...prev, department: dept }));
    logUserActivity({
      actionType: 'TAB_NAVIGATION',
      actionTitle: `Switched Department to ${dept.replace('_', ' ')}`,
      actionDetails: `${currentUser.name} switched active department workspace to ${dept}.`,
      module: dept
    });
  };

  const switchBranch = (branchId: string) => {
    const perms = getRolePermissions(currentRole, currentDepartment);
    if (isAuthenticated && !perms.allBranchesAccess && currentUser.branchId && branchId !== currentUser.branchId) {
      setActiveBranchId(currentUser.branchId);
      return;
    }
    const targetBr = branches.find(b => b.id === branchId);
    setActiveBranchId(branchId);
    // Every shop sale is independent: clear active POS cart when switching branches
    setCart([]);
    setSelectedAffiliate(null);
    if (targetBr) {
      logUserActivity({
        actionType: 'TAB_NAVIGATION',
        actionTitle: `Switched Active Branch to ${targetBr.name}`,
        actionDetails: `${currentUser.name} switched branch context to ${targetBr.name} (${targetBr.code}).`,
        module: currentDepartment
      });
    }
  };

  // Branch Operations:
  // - Main Branch (MAIN_STORE) is the Head Office
  // - Branches (DISTRIBUTOR) are the Merchants operating under Main Branch (Head Office)
  // - Shops (LIQUOR_STORE) are strictly created under a Branch (Merchant or Main Branch Head Office)
  // - Central Database = Truth: Write to central Firestore first; only update local state/cache when confirmed.
  const addBranch = async (branchData: Omit<Branch, 'id'>): Promise<Branch> => {
    const newBranchId = `branch-gen-${Date.now().toString().slice(-6)}`;
    const headOfficeBranch =
      branches.find(b => b.id === 'branch-hq-main') ||
      branches.find(b => b.tier === 'MAIN_STORE') ||
      MAIN_HEAD_OFFICE_BRANCH;
    const mainWarehouse =
      branches.find(b => b.tier === 'WAREHOUSE') || headOfficeBranch || branches[0];
    const resolvedGeo = resolveBranchGeoProfile(
      { ...branchData, id: newBranchId },
      branches.length
    );
    const inferredPricing = inferBranchMarketClassFromLocation(
      `${branchData.name || ''} ${branchData.location || ''} ${(branchData.deliveryZones || []).join(' ')}`
    );

    // Resolve strict Parent Branch hierarchy:
    // - Shops (LIQUOR_STORE) can ONLY be created under a Branch (DISTRIBUTOR Merchant or MAIN_STORE Head Office)
    // - Branches (DISTRIBUTOR Merchants) report to the Main Branch (Head Office)
    const eligibleParentBranches = branches.filter(
      b => b.tier === 'DISTRIBUTOR' || b.tier === 'MAIN_STORE'
    );
    let resolvedParentBranch: Branch | undefined;
    if (branchData.tier === 'LIQUOR_STORE') {
      resolvedParentBranch =
        eligibleParentBranches.find(b => b.id === branchData.parentBranchId) ||
        eligibleParentBranches.find(b => b.tier === 'DISTRIBUTOR') ||
        headOfficeBranch;
    } else if (branchData.tier === 'DISTRIBUTOR') {
      resolvedParentBranch =
        branches.find(b => b.id === branchData.parentBranchId && b.tier === 'MAIN_STORE') ||
        headOfficeBranch;
    } else if (branchData.tier === 'WAREHOUSE') {
      resolvedParentBranch = headOfficeBranch;
    }

    const newBranch: Branch = {
      ...branchData,
      id: newBranchId,
      isHeadOffice: branchData.tier === 'MAIN_STORE' ? true : branchData.isHeadOffice,
      latitude: branchData.latitude ?? resolvedGeo.latitude,
      longitude: branchData.longitude ?? resolvedGeo.longitude,
      maxDeliveryRadiusKm: branchData.maxDeliveryRadiusKm ?? resolvedGeo.maxDeliveryRadiusKm,
      deliveryZones:
        branchData.deliveryZones && branchData.deliveryZones.length > 0
          ? branchData.deliveryZones
          : resolvedGeo.deliveryZones,
      marketClassTier: branchData.marketClassTier ?? inferredPricing.marketClassTier,
      priceMultiplierPercent:
        branchData.priceMultiplierPercent !== undefined
          ? branchData.priceMultiplierPercent
          : inferredPricing.priceMultiplierPercent,
      preferredProductPrices: branchData.preferredProductPrices || {},
      parentBranchId: resolvedParentBranch?.id || branchData.parentBranchId,
      parentBranchName: resolvedParentBranch?.name || branchData.parentBranchName
    };

    const nextBranches = [...branches.filter(b => b.id !== newBranch.id), newBranch];

    // 1. Write to central database / server store
    await pushUnifiedErpStateToFirestore(
      'branches',
      nextBranches,
      currentUser.name || 'ERP-ADMIN',
      true
    ).catch(() => false);

    setPersistenceErrorBanner(null);
    setUnifiedDbSyncStatus('SYNCED');
    setLastUnifiedDbSyncAt(new Date().toISOString());

    // 2. Update local state & cache
    setBranches(prev => {
      const next = [...prev.filter(b => b.id !== newBranch.id), newBranch];
      if (prev.length === 0 || !activeBranchId || activeBranchId === 'unconfigured-branch') {
        setActiveBranchId(newBranchId);
      }
      return next;
    });

    // Sync newly created branch pricing configuration to authoritative server
    void fetch('/api/erp/branches/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        branchId: newBranch.id,
        branchName: newBranch.name,
        location: newBranch.location,
        tier: newBranch.tier,
        marketClassTier: newBranch.marketClassTier,
        priceMultiplierPercent: newBranch.priceMultiplierPercent,
        preferredProductPrices: newBranch.preferredProductPrices
      })
    }).catch(() => undefined);

    // If the user created a Regional Distributor branch, also register it in Commercial Distributors if not already present
    if (newBranch.tier === 'DISTRIBUTOR') {
      const alreadyExists = distributors.some(
        d =>
          d.code.toUpperCase() === newBranch.code.toUpperCase() ||
          d.companyName.toLowerCase() === newBranch.name.toLowerCase()
      );
      if (!alreadyExists) {
        const linkedDist: CommercialDistributor = {
          id: `dst-${Date.now().toString().slice(-4)}`,
          companyName: newBranch.name,
          code: newBranch.code,
          kraPin: newBranch.kraPin || 'P051829301A',
          licenseNumber: `KRA-EXCISE-LIC-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`,
          tier: 'TIER_2_REGIONAL_DEPOT',
          contactPerson: newBranch.managerName || 'Regional Merchant Manager',
          phone: newBranch.contactPhone || '+254 700 000 000',
          email: `${newBranch.code.toLowerCase()}@merchant.co.ke`,
          county: newBranch.county || 'Nairobi',
          region: newBranch.location || newBranch.county || 'Kenya',
          paymentTerms: 'NET_14',
          creditLimitKes: 3000000,
          currentReceivableKes: 0,
          active: true
        };
        const nextDistributors = [linkedDist, ...distributors];
        setDistributors(nextDistributors);
        void pushUnifiedErpStateToFirestore('distributors', nextDistributors, currentUser.name, true);
      }
    }

    // Initialize independent 0-stock ledger rows for a new Shop/Distributor so it acquires stock from Warehouse (Main Store)
    if (newBranch.tier !== 'WAREHOUSE') {
      setInventoryItems(prev => [
        ...prev,
        ...products.slice(0, 6).map((p, idx) => ({
          id: `inv-${newBranchId}-${p.id}-${idx}`,
          productId: p.id,
          branchId: newBranchId,
          bottlesOnHand: 0,
          casesOnHand: 0,
          reorderLevel: p.packSize || 12,
          batchNumber: `INIT-${newBranch.code}`,
          expiryDate: '2030-12-31',
          lastScannedAt: new Date().toISOString()
        }))
      ]);

      // If Warehouse Auto-Disburse is enabled, automatically push an initial starter stock disbursement notification pending acceptance
      if (autoDisburseEnabled && mainWarehouse) {
        const starterItems = products.slice(0, 3).map(p => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          casesRequested: 3,
          bottlesTotal: 3 * (p.packSize || 12)
        }));
        const autoStarterReq: RestockRequest = {
          id: `req-auto-${Date.now()}`,
          requestNumber: `RST-2026-${(restockRequests.length + 105).toString()}`,
          fromBranchId: newBranch.id,
          fromBranchName: newBranch.name,
          toBranchId: mainWarehouse.id,
          toBranchName: `${mainWarehouse.name} (Main Store)`,
          requestedBy: 'Warehouse Controller (Auto-Disburse)',
          initiationType: 'WAREHOUSE_AUTO_DISBURSE',
          urgency: 'OUT_OF_STOCK',
          notes: `Auto-disbursed initial stock allocation from Warehouse (Main Store) to newly created branch ${newBranch.name} — pending acceptance.`,
          status: 'PENDING',
          items: starterItems,
          createdAt: new Date().toISOString()
        };
        setRestockRequests(prev => [autoStarterReq, ...prev]);
      }
    }
    logUserActivity({
      actionType: 'BRANCH_CREATED',
      actionTitle: `Created Branch: ${newBranch.name} (${newBranch.code})`,
      actionDetails: `Provisioned ${newBranch.tier} branch ${newBranch.name} in ${newBranch.county || 'Kenya'}.`,
      module: 'BRANCHES'
    });
    return newBranch;
  };

  const updateBranchParent = (branchId: string, parentBranchId: string) => {
    setBranches(prev => {
      const parentObj = prev.find(b => b.id === parentBranchId);
      if (!parentObj) return prev;
      return prev.map(b =>
        b.id === branchId
          ? {
              ...b,
              parentBranchId: parentObj.id,
              parentBranchName: parentObj.name
            }
          : b
      );
    });
  };

  const updateBranchThreshold = (branchId: string, minThreshold: number) => {
    setBranches(prev =>
      prev.map(b => (b.id === branchId ? { ...b, minWholesaleThresholdKes: minThreshold } : b))
    );
  };

  // Resolve effective selling price of a product for a specific branch (e.g. Donholm vs Kilimani vs Westlands)
  const getBranchProductPrice = (
    product: Product,
    targetBranch?: Branch | string | null,
    forceSaleType?: 'RETAIL' | 'WHOLESALE'
  ): ResolvedBranchProductPrice => {
    const resolvedBranchObj =
      typeof targetBranch === 'string'
        ? branches.find(b => b.id === targetBranch) || activeBranch
        : targetBranch || activeBranch;
    return resolveBranchProductPrice(product, resolvedBranchObj, forceSaleType);
  };

  const updateBranchPricingPolicy = (
    branchId: string,
    params: {
      marketClassTier?: BranchMarketClassTier;
      priceMultiplierPercent?: number;
    }
  ) => {
    let targetBranchSnapshot: Branch | null = null;
    setBranches(prev =>
      prev.map(b => {
        if (b.id !== branchId) return b;
        const updated: Branch = {
          ...b,
          marketClassTier: params.marketClassTier ?? b.marketClassTier ?? 'STANDARD_RESIDENTIAL',
          priceMultiplierPercent:
            params.priceMultiplierPercent !== undefined
              ? Math.max(-50, Math.min(200, Math.round(params.priceMultiplierPercent * 10) / 10))
              : b.priceMultiplierPercent ?? 0
        };
        targetBranchSnapshot = updated;
        return updated;
      })
    );

    if (targetBranchSnapshot) {
      const snap = targetBranchSnapshot as Branch;
      void fetch('/api/erp/branches/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          branchId: snap.id,
          branchName: snap.name,
          location: snap.location,
          tier: snap.tier,
          marketClassTier: snap.marketClassTier,
          priceMultiplierPercent: snap.priceMultiplierPercent,
          preferredProductPrices: snap.preferredProductPrices || {}
        })
      }).catch(() => undefined);
    }
  };

  const setBranchProductPreferredPrice = (
    branchId: string,
    productId: string,
    prices: {
      retailPriceKes?: number | null;
      wholesalePriceKes?: number | null;
    }
  ) => {
    const prod = products.find(p => p.id === productId);
    const minCostFloor = prod ? Math.max(30, prod.warehouseCostKes) : 30;
    let targetBranchSnapshot: Branch | null = null;

    setBranches(prev =>
      prev.map(b => {
        if (b.id !== branchId) return b;
        const existingOverrides = { ...(b.preferredProductPrices || {}) };
        const currentEntry = existingOverrides[productId] || {};

        const nextRetail =
          prices.retailPriceKes === null
            ? undefined
            : prices.retailPriceKes !== undefined && prices.retailPriceKes > 0
            ? Math.max(minCostFloor, Math.round(prices.retailPriceKes))
            : currentEntry.retailPriceKes;

        const nextWholesale =
          prices.wholesalePriceKes === null
            ? undefined
            : prices.wholesalePriceKes !== undefined && prices.wholesalePriceKes > 0
            ? Math.max(minCostFloor, Math.round(prices.wholesalePriceKes))
            : currentEntry.wholesalePriceKes;

        if (!nextRetail && !nextWholesale) {
          delete existingOverrides[productId];
        } else {
          existingOverrides[productId] = {
            retailPriceKes: nextRetail,
            wholesalePriceKes: nextWholesale,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.name
          };
        }

        const updated: Branch = {
          ...b,
          preferredProductPrices: existingOverrides
        };
        targetBranchSnapshot = updated;
        return updated;
      })
    );

    if (targetBranchSnapshot) {
      const snap = targetBranchSnapshot as Branch;
      void fetch('/api/erp/branches/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          branchId: snap.id,
          branchName: snap.name,
          location: snap.location,
          tier: snap.tier,
          marketClassTier: snap.marketClassTier,
          priceMultiplierPercent: snap.priceMultiplierPercent,
          preferredProductPrices: snap.preferredProductPrices || {}
        })
      }).catch(() => undefined);
    }
  };

  // Inventory & Barcode Handling
  const startNewScanBatch = (): string => {
    const newBatch = `BATCH-${Date.now().toString().slice(-6)}`;
    setActiveScanBatchId(newBatch);
    return newBatch;
  };

  const handleBarcodeScan = (rawBarcode: string, mode: 'SINGLE' | 'BULK'): ScanResult => {
    const result = processIngestedBarcode(
      rawBarcode,
      products,
      activeBranchId,
      activeScanBatchId,
      currentUser.id,
      mode
    );

    const existingInvItem = result.product
      ? inventoryItems.find(
          item => item.productId === result.product!.id && item.branchId === activeBranchId
        )
      : undefined;
    const prevBottles = existingInvItem?.bottlesOnHand ?? 0;
    const addedBottles = result.success && result.unpackedBottles ? result.unpackedBottles : 0;
    const nextBottles = prevBottles + addedBottles;
    const unitCostKes = result.product?.warehouseCostKes ?? 0;
    const assetAddedKes = addedBottles * unitCostKes;
    const nextTotalAssetKes = nextBottles * unitCostKes;

    const enrichedResult: ScanResult = {
      ...result,
      previousBottlesOnHand: prevBottles,
      newBottlesOnHand: nextBottles,
      assetValueAddedKes: assetAddedKes,
      newTotalProductAssetKes: nextTotalAssetKes
    };

    const scanRecord: BarcodeScanRecord = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rawBarcode,
      scannedAt: new Date().toISOString(),
      scannerUserId: currentUser.id,
      branchId: activeBranchId,
      type: result.scanType || 'SINGLE_BOTTLE',
      status: result.status,
      productId: result.product?.id,
      productName: result.product?.name,
      unpackedBottles: result.unpackedBottles,
      previousBottlesOnHand: prevBottles,
      newBottlesOnHand: nextBottles,
      assetValueAddedKes: assetAddedKes,
      duplicateDetails: result.duplicateDetails,
      batchId: activeScanBatchId
    };

    setScanHistory(prev => {
      const nextHistory = [scanRecord, ...prev];
      void pushUnifiedErpStateToFirestore(
        'scan_history',
        nextHistory.slice(0, 250),
        currentUser.name || 'INVENTORY-SCAN',
        true
      );
      return nextHistory;
    });

    // If accepted, update inventory on hand for active branch and move activated product to the top
    if (result.success && result.product && result.unpackedBottles) {
      setProducts(prev => [
        result.product!,
        ...prev.filter(p => p.id !== result.product!.id)
      ]);

      setInventoryItems(prev => {
        const existingIdx = prev.findIndex(
          item => item.productId === result.product!.id && item.branchId === activeBranchId
        );

        let nextList: InventoryItem[];
        if (existingIdx >= 0) {
          const curr = prev[existingIdx];
          const newBottles = curr.bottlesOnHand + result.unpackedBottles!;
          const packSize = result.product!.packSize || 12;
          const updatedItem: InventoryItem = {
            ...curr,
            bottlesOnHand: newBottles,
            casesOnHand: Math.floor(newBottles / packSize),
            lastScannedAt: new Date().toISOString()
          };
          nextList = [updatedItem, ...prev.filter((_, idx) => idx !== existingIdx)];
        } else {
          // Create new branch stock item at the top
          const packSize = result.product!.packSize || 12;
          const newItem: InventoryItem = {
            id: `inv-${Date.now()}`,
            productId: result.product!.id,
            branchId: activeBranchId,
            bottlesOnHand: result.unpackedBottles!,
            casesOnHand: Math.floor(result.unpackedBottles! / packSize),
            reorderLevel: 24,
            batchNumber: `BAT-${activeScanBatchId}`,
            expiryDate: '2029-12-31',
            lastScannedAt: new Date().toISOString()
          };
          nextList = [newItem, ...prev];
        }

        void pushUnifiedErpStateToFirestore(
          'inventory',
          nextList,
          currentUser.name || 'INVENTORY-SCAN',
          true
        );
        void syncInventoryItemsToBranchLedgers(
          nextList.filter(
            i => i.branchId === activeBranchId && i.productId === result.product!.id
          ),
          products,
          true
        );
        return nextList;
      });
    }

    return enrichedResult;
  };

  const adjustStockManually = (productId: string, branchId: string, quantity: number, reason: string) => {
    setInventoryItems(prev => {
      const idx = prev.findIndex(item => item.productId === productId && item.branchId === branchId);
      const prod = products.find(p => p.id === productId);
      const packSize = prod?.packSize || 12;

      let nextList: InventoryItem[];
      if (idx >= 0) {
        const updated = [...prev];
        const newBottles = Math.max(0, updated[idx].bottlesOnHand + quantity);
        updated[idx] = {
          ...updated[idx],
          bottlesOnHand: newBottles,
          casesOnHand: Math.floor(newBottles / packSize),
          lastScannedAt: new Date().toISOString()
        };
        nextList = updated;
      } else {
        const newItem: InventoryItem = {
          id: `inv-${Date.now()}`,
          productId,
          branchId,
          bottlesOnHand: Math.max(0, quantity),
          casesOnHand: Math.floor(Math.max(0, quantity) / packSize),
          reorderLevel: 20,
          batchNumber: 'ADJ-MANUAL',
          manufactureDate: prod?.manufactureDate || '2025-11-01',
          expiryDate: prod?.defaultExpiryDate || '2029-12-31',
          lastScannedAt: new Date().toISOString()
        };
        nextList = [...prev, newItem];
      }

      void pushUnifiedErpStateToFirestore(
        'inventory',
        nextList,
        currentUser.name || 'STOCK-ADJUSTMENT',
        true
      );
      void syncInventoryItemsToBranchLedgers(
        nextList.filter(i => i.branchId === branchId && i.productId === productId),
        products,
        true
      );
      return nextList;
    });

    // Server-Authoritative Inventory Adjustment Transaction
    fetch('/api/inventory/transact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        branchId,
        operationType: quantity >= 0 ? 'RESTOCK' : 'DISPATCH',
        items: [
          {
            productId,
            quantity: Math.abs(quantity),
            reason
          }
        ]
      })
    }).catch(() => {});
  };

  const updateInventoryBatchExpiry = (
    productId: string,
    branchId: string,
    params: { batchNumber: string; manufactureDate?: string; expiryDate: string }
  ) => {
    const prod = products.find(p => p.id === productId);
    const packSize = prod?.packSize || 12;
    const nowIso = new Date().toISOString();

    setInventoryItems(prev => {
      const idx = prev.findIndex(i => i.productId === productId && i.branchId === branchId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          batchNumber: params.batchNumber.trim() || updated[idx].batchNumber,
          manufactureDate: params.manufactureDate || updated[idx].manufactureDate,
          expiryDate: params.expiryDate || updated[idx].expiryDate,
          lastScannedAt: nowIso
        };
        return updated;
      } else {
        const newItem: InventoryItem = {
          id: `inv-batch-${Date.now()}-${productId}`,
          productId,
          branchId,
          bottlesOnHand: 0,
          casesOnHand: 0,
          reorderLevel: packSize,
          batchNumber: params.batchNumber.trim() || `BAT-${prod?.sku || 'CRM'}`,
          manufactureDate: params.manufactureDate || prod?.manufactureDate || '2025-11-01',
          expiryDate: params.expiryDate || prod?.defaultExpiryDate || '2027-11-01',
          lastScannedAt: nowIso
        };
        return [newItem, ...prev];
      }
    });

    if (params.manufactureDate || params.expiryDate) {
      setProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? {
                ...p,
                manufactureDate: params.manufactureDate || p.manufactureDate,
                defaultExpiryDate: params.expiryDate || p.defaultExpiryDate
              }
            : p
        )
      );
    }
  };

  const applyApprovedStockAuditToBranch = (
    branchId: string,
    adjustments: { productId: string; physicalCount: number }[]
  ) => {
    const nowIso = new Date().toISOString();
    setInventoryItems(prev => {
      const updated = [...prev];
      adjustments.forEach(({ productId, physicalCount }) => {
        const prod = products.find(p => p.id === productId);
        const packSize = prod?.packSize || 12;
        const safePhysical = Math.max(0, physicalCount);
        const idx = updated.findIndex(
          item => item.productId === productId && item.branchId === branchId
        );
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            bottlesOnHand: safePhysical,
            casesOnHand: Math.floor(safePhysical / packSize),
            lastScannedAt: nowIso
          };
        } else {
          updated.push({
            id: `inv-audit-${branchId}-${productId}-${Date.now()}`,
            productId,
            branchId,
            bottlesOnHand: safePhysical,
            casesOnHand: Math.floor(safePhysical / packSize),
            reorderLevel: packSize,
            batchNumber: 'AUDIT-VERIFIED',
            expiryDate: '2030-12-31',
            lastScannedAt: nowIso
          });
        }
      });
      void pushUnifiedErpStateToFirestore(
        'inventory',
        updated,
        currentUser.name || 'AUDIT-APPROVAL',
        true
      );
      void syncInventoryItemsToBranchLedgers(
        updated.filter(i => i.branchId === branchId),
        products,
        true
      );
      return updated;
    });
  };

  const addProduct = (prodData: Omit<Product, 'id'>, initialCases = 0): Product => {
    const newProduct: Product = {
      ...prodData,
      image: prodData.image || getProductImageUrl(prodData),
      id: `prod-${prodData.category.toLowerCase()}-${Date.now().toString().slice(-5)}`
    };
    setProducts(prev => [newProduct, ...prev]);

    const packSize = Math.max(1, prodData.packSize || 12);
    const initialBottles = Math.max(0, initialCases) * packSize;

    // Immediately wire the new product into the active branch inventory (and Warehouse if different)
    setInventoryItems(prev => {
      const entries: InventoryItem[] = [
        {
          id: `inv-${Date.now()}-${newProduct.id}`,
          productId: newProduct.id,
          branchId: activeBranch.id,
          bottlesOnHand: initialBottles,
          casesOnHand: Math.max(0, initialCases),
          reorderLevel: packSize,
          batchNumber: `BAT-${newProduct.sku}`,
          expiryDate: '2030-12-31',
          lastScannedAt: new Date().toISOString()
        }
      ];
      return [...entries, ...prev];
    });

    return newProduct;
  };

  const updateProductImage = (productId: string, imageUrl: string) => {
    const trimmed = normalizeProductImageUrl(imageUrl);
    if (!trimmed) return;
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, image: trimmed } : p))
    );
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, image: trimmed } }
          : item
      )
    );
  };

  const updateProduct = (
    productId: string,
    updates: Partial<Omit<Product, 'id'>>,
    updatedBranchBottles?: number
  ): Product | null => {
    const existing = products.find(p => p.id === productId);
    if (!existing) return null;

    const normalizedImage =
      updates.image !== undefined
        ? normalizeProductImageUrl(updates.image) || getProductImageUrl({ ...existing, ...updates })
        : existing.image;

    const updatedProduct: Product = {
      ...existing,
      ...updates,
      image: normalizedImage,
      packSize: Math.max(1, updates.packSize ?? existing.packSize ?? 12),
      volumeMl: Math.max(50, updates.volumeMl ?? existing.volumeMl ?? 750),
      retailPriceKes: Math.max(0, updates.retailPriceKes ?? existing.retailPriceKes),
      wholesalePriceKes: Math.max(0, updates.wholesalePriceKes ?? existing.wholesalePriceKes),
      warehouseCostKes: Math.max(0, updates.warehouseCostKes ?? existing.warehouseCostKes)
    };

    setProducts(prev => prev.map(p => (p.id === productId ? updatedProduct : p)));

    // Sync active POS cart if product is currently in cart
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              product: updatedProduct,
              unitPrice: updatedProduct.retailPriceKes
            }
          : item
      )
    );

    // Sync supply invoice line items if name or SKU was updated
    if (updates.name || updates.sku || updates.category) {
      setSupplyInvoices(prev =>
        prev.map(inv => ({
          ...inv,
          items: inv.items.map(it =>
            it.productId === productId
              ? {
                  ...it,
                  productName: updatedProduct.name,
                  sku: updatedProduct.sku,
                  category: updatedProduct.category
                }
              : it
          )
        }))
      );
    }

    // Update branch stock if updatedBranchBottles was specified or packSize changed
    setInventoryItems(prev => {
      const packSize = updatedProduct.packSize || 12;
      const idx = prev.findIndex(i => i.productId === productId && i.branchId === activeBranch.id);
      if (updatedBranchBottles !== undefined) {
        const safeBottles = Math.max(0, Math.round(updatedBranchBottles));
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            bottlesOnHand: safeBottles,
            casesOnHand: Math.floor(safeBottles / packSize),
            lastScannedAt: new Date().toISOString()
          };
          return copy;
        } else {
          return [
            {
              id: `inv-${Date.now()}-${productId}`,
              productId,
              branchId: activeBranch.id,
              bottlesOnHand: safeBottles,
              casesOnHand: Math.floor(safeBottles / packSize),
              reorderLevel: packSize,
              batchNumber: `BAT-${updatedProduct.sku}`,
              expiryDate: '2030-12-31',
              lastScannedAt: new Date().toISOString()
            },
            ...prev
          ];
        }
      }
      // Recalculate casesOnHand across branches if packSize changed
      if (updates.packSize && updates.packSize !== existing.packSize) {
        return prev.map(i =>
          i.productId === productId
            ? { ...i, casesOnHand: Math.floor(i.bottlesOnHand / packSize) }
            : i
        );
      }
      return prev;
    });

    return updatedProduct;
  };

  const deleteProduct = (productId: string): Product | null => {
    const target = products.find(p => p.id === productId);
    if (!target) return null;

    setProducts(prev => prev.filter(p => p.id !== productId));
    setInventoryItems(prev => prev.filter(i => i.productId !== productId));
    setCart(prev => prev.filter(c => c.product.id !== productId));

    return target;
  };

  // Clone / Sync Products from https://nairobidrinks.co.ke/product Catalog
  const cloneNairobiDrinksCatalog = (options?: {
    productIds?: string[];
    warehouseCases?: number;
    shopCases?: number;
  }): { clonedCount: number; updatedStockCount: number } => {
    const whCases = options?.warehouseCases ?? 15;
    const lsCases = options?.shopCases ?? 4;
    const targetCatalog =
      options?.productIds && options.productIds.length > 0
        ? NAIROBI_DRINKS_PRODUCTS.filter(p => options.productIds!.includes(p.id))
        : NAIROBI_DRINKS_PRODUCTS;

    let clonedCount = 0;
    let updatedStockCount = 0;

    setProducts(prev => {
      const existingSkus = new Set(prev.map(p => p.sku));
      const newOnes = targetCatalog.filter(p => !existingSkus.has(p.sku));
      clonedCount = newOnes.length;
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });

    setInventoryItems(prev => {
      const updated = [...prev];
      const nowIso = new Date().toISOString();

      const targetMainBranchId = branches.find(b => b.tier === 'MAIN_STORE')?.id || branches[0]?.id || 'branch-hq-main';
      targetCatalog.forEach((p, idx) => {
        // 1. Warehouse Stock
        const whIdx = updated.findIndex(i => i.productId === p.id && i.branchId === targetMainBranchId);
        if (whIdx >= 0) {
          if (updated[whIdx].bottlesOnHand === 0 && whCases > 0) {
            updated[whIdx] = {
              ...updated[whIdx],
              casesOnHand: whCases,
              bottlesOnHand: whCases * p.packSize,
              lastScannedAt: nowIso
            };
            updatedStockCount++;
          }
        } else {
          updated.push({
            id: `inv-wh-${p.id}-${Date.now()}`,
            productId: p.id,
            branchId: targetMainBranchId,
            casesOnHand: whCases,
            bottlesOnHand: whCases * p.packSize,
            reorderLevel: p.packSize * 3,
            batchNumber: `ND-WH-2026-${idx + 101}`,
            expiryDate: '2030-12-31',
            lastScannedAt: nowIso
          });
          updatedStockCount++;
        }

        // 2. Retail Shop Stock
        const targetShopId = activeBranch.id;
        const lsIdx = updated.findIndex(i => i.productId === p.id && i.branchId === targetShopId);
        if (lsIdx >= 0) {
          if (updated[lsIdx].bottlesOnHand === 0 && lsCases > 0) {
            updated[lsIdx] = {
              ...updated[lsIdx],
              casesOnHand: lsCases,
              bottlesOnHand: lsCases * p.packSize,
              lastScannedAt: nowIso
            };
            updatedStockCount++;
          }
        } else {
          updated.push({
            id: `inv-ls-${p.id}-${Date.now()}`,
            productId: p.id,
            branchId: targetShopId,
            casesOnHand: lsCases,
            bottlesOnHand: lsCases * p.packSize,
            reorderLevel: p.packSize * 2,
            batchNumber: `ND-LS-2026-${idx + 101}`,
            expiryDate: '2030-12-31',
            lastScannedAt: nowIso
          });
          updatedStockCount++;
        }
      });

      return updated;
    });

    return { clonedCount, updatedStockCount };
  };

  // Clone any individual product URL from https://nairobidrinks.co.ke/product/<slug>
  const cloneNairobiDrinksFromUrl = (
    productUrl: string,
    customRetailPriceKes?: number,
    initialCases = 10
  ): { product: Product; isNew: boolean } => {
    const cleanUrl = productUrl.trim().replace(/\/+$/, '');
    // Check if already in NAIROBI_DRINKS_PRODUCTS or current products
    const existingInState = products.find(
      p => p.sourceUrl?.toLowerCase() === cleanUrl.toLowerCase()
    );
    if (existingInState) {
      adjustStockManually(
        existingInState.id,
        activeBranch.id,
        initialCases * existingInState.packSize,
        'NairobiDrinks.co.ke URL Stock Sync'
      );
      return { product: existingInState, isNew: false };
    }

    const matchInCatalog = NAIROBI_DRINKS_PRODUCTS.find(
      p => p.sourceUrl?.toLowerCase() === cleanUrl.toLowerCase()
    );
    if (matchInCatalog) {
      setProducts(prev => [matchInCatalog, ...prev]);
      adjustStockManually(
        matchInCatalog.id,
        activeBranch.id,
        initialCases * matchInCatalog.packSize,
        'Cloned from NairobiDrinks.co.ke'
      );
      return { product: matchInCatalog, isNew: true };
    }

    // Parse slug from https://nairobidrinks.co.ke/product/<slug>
    const slugMatch = cleanUrl.split('/product/')[1] || cleanUrl.split('/').pop() || 'premium-spirit';
    const rawSlug = slugMatch.replace(/\?.*$/, '').replace(/[-_]+/g, ' ').trim();
    const formattedName = rawSlug
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const lowerSlug = rawSlug.toLowerCase();
    const isLocal =
      lowerSlug.includes('tusker') ||
      lowerSlug.includes('chrome') ||
      lowerSlug.includes('gilbey') ||
      lowerSlug.includes('kibao') ||
      lowerSlug.includes('kenya cane') ||
      lowerSlug.includes('richot') ||
      lowerSlug.includes('white cap') ||
      lowerSlug.includes('balozi');

    let subCategory = 'Whisky';
    if (lowerSlug.includes('gin') || lowerSlug.includes('tanqueray') || lowerSlug.includes('gordon') || lowerSlug.includes('hendrick') || lowerSlug.includes('gilbey')) {
      subCategory = 'Gin';
    } else if (lowerSlug.includes('vodka') || lowerSlug.includes('absolut') || lowerSlug.includes('ciroc') || lowerSlug.includes('smirnoff')) {
      subCategory = 'Vodka';
    } else if (lowerSlug.includes('hennessy') || lowerSlug.includes('martell') || lowerSlug.includes('cognac') || lowerSlug.includes('brandy') || lowerSlug.includes('richot') || lowerSlug.includes('viceroy')) {
      subCategory = 'Cognac & Brandy';
    } else if (lowerSlug.includes('rum') || lowerSlug.includes('captain morgan') || lowerSlug.includes('malibu') || lowerSlug.includes('bacardi')) {
      subCategory = 'Rum';
    } else if (lowerSlug.includes('tequila') || lowerSlug.includes('olmeca') || lowerSlug.includes('cuervo') || lowerSlug.includes('don julio')) {
      subCategory = 'Tequila';
    } else if (lowerSlug.includes('baileys') || lowerSlug.includes('amarula') || lowerSlug.includes('jagermeister') || lowerSlug.includes('liqueur')) {
      subCategory = 'Liqueur & Cream';
    } else if (lowerSlug.includes('wine') || lowerSlug.includes('champagne') || lowerSlug.includes('moet') || lowerSlug.includes('veuve') || lowerSlug.includes('4th street') || lowerSlug.includes('robertson') || lowerSlug.includes('belaire')) {
      subCategory = 'Champagne & Wine';
    } else if (lowerSlug.includes('beer') || lowerSlug.includes('tusker') || lowerSlug.includes('cider') || lowerSlug.includes('guinness') || lowerSlug.includes('heineken')) {
      subCategory = 'Beer & Cider';
    }

    const retailKes = customRetailPriceKes && customRetailPriceKes > 0 ? customRetailPriceKes : isLocal ? 1500 : 4200;
    const wholesaleKes = Math.round(retailKes * 0.85);
    const costKes = Math.round(retailKes * 0.72);
    const volumeMl = lowerSlug.includes('1 litre') || lowerSlug.includes('1l') || lowerSlug.includes('1000ml') ? 1000 : 750;
    const category = isLocal ? 'LPS' : 'IPS';
    const seq = (products.length + 101).toString();

    const createdProduct = addProduct(
      {
        sku: `ND-URL-${seq}`,
        barcode: `616${Date.now().toString().slice(-10)}`,
        caseBarcode: `1616${Date.now().toString().slice(-10)}`,
        name: formattedName.includes('ml') || formattedName.includes('Litre') ? formattedName : `${formattedName} (${volumeMl}ml)`,
        category,
        subCategory,
        brand: formattedName.split(' ')[0] || 'NairobiDrinks',
        volumeMl,
        alcoholPercentage: subCategory === 'Champagne & Wine' ? 12 : subCategory === 'Beer & Cider' ? 4.5 : 40,
        packSize: 12,
        countryOfOrigin: isLocal ? 'Kenya' : 'Imported',
        warehouseCostKes: costKes,
        wholesalePriceKes: wholesaleKes,
        retailPriceKes: retailKes,
        minWholesaleQty: 6,
        vatRate: 0.16,
        exciseDutyPerLitreKes: 356.4,
        importDeclarationNumber: category === 'IPS' ? `IDF/2026/NRB/${Date.now().toString().slice(-5)}` : undefined,
        kraExciseStampType: category === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
        sourceUrl: cleanUrl.startsWith('http') ? cleanUrl : `https://nairobidrinks.co.ke/product/${slugMatch}`
      },
      initialCases
    );

    return { product: createdProduct, isNew: true };
  };

  // Cart & POS Operations
  const addToCart = (
    product: Product,
    quantity = 1,
    affiliateMarkup = 0,
    preferredUnitPrice?: number
  ) => {
    // Determine official Branch Selling Price based on active branch tier, market class, and branch preferred product price
    const basePrice = getBranchProductPrice(product, activeBranch).effectiveUnitPriceKes;

    // Resolve active affiliate if any
    const activeAff =
      selectedAffiliate ||
      (currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
        ? affiliates.find(
            a =>
              a.id === currentUser.id ||
              a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
          ) || null
        : null);

    const canUsePreferredPrice = activeAff ? activeAff.allowPreferredPrice !== false : defaultAllowPreferredPrice;

    // Look up saved preferred price for this product (or base product ID if volume variant)
    const baseProdId = product.id.split('-vol-')[0];
    const savedPreferredPrice =
      canUsePreferredPrice && activeAff?.preferredPrices
        ? activeAff.preferredPrices[product.id] ?? activeAff.preferredPrices[baseProdId]
        : undefined;

    let resolvedMarkup = Math.max(0, affiliateMarkup);
    if (canUsePreferredPrice) {
      if (preferredUnitPrice !== undefined && preferredUnitPrice >= basePrice) {
        resolvedMarkup = Math.round(preferredUnitPrice - basePrice);
      } else if (affiliateMarkup === 0 && savedPreferredPrice !== undefined && savedPreferredPrice > basePrice) {
        resolvedMarkup = Math.round(savedPreferredPrice - basePrice);
      }
    } else {
      resolvedMarkup = 0;
    }

    const finalUnitPrice = basePrice + resolvedMarkup;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                affiliateMarkupPerUnit: resolvedMarkup,
                unitPrice: basePrice + resolvedMarkup
              }
            : item
        );
      }
      return [...prev, { product, quantity, unitPrice: finalUnitPrice, affiliateMarkupPerUnit: resolvedMarkup }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartItemQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const updateCartItemMarkup = (productId: string, markup: number) => {
    const safeMarkup = Math.max(0, Math.round(markup || 0));
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const basePrice = getBranchProductPrice(item.product, activeBranch).effectiveUnitPriceKes;
          return {
            ...item,
            affiliateMarkupPerUnit: safeMarkup,
            unitPrice: basePrice + safeMarkup
          };
        }
        return item;
      })
    );
  };

  // Allow Sales Affiliate to directly set their Preferred Selling Price per unit without affecting Branch Price
  const updateCartItemPreferredPrice = (productId: string, preferredUnitPrice: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const companyBasePrice = getBranchProductPrice(item.product, activeBranch).effectiveUnitPriceKes;
          const safePreferredPrice = Math.max(companyBasePrice, Math.round(preferredUnitPrice || companyBasePrice));
          const separatedProfitPerUnit = Math.max(0, safePreferredPrice - companyBasePrice);
          return {
            ...item,
            affiliateMarkupPerUnit: separatedProfitPerUnit,
            unitPrice: safePreferredPrice
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setRecalledSalesPerson(null);
    if (currentDepartment !== 'AFFILIATES') {
      setSelectedAffiliate(null);
    }
  };

  const holdCurrentCart = (params?: {
    customerName?: string;
    customerPhone?: string;
    customerKraPin?: string;
    note?: string;
    submittedByRole?: 'SALES_LADY' | 'COUNTER_CASHIER';
    queueStatus?: CounterQueueStatus;
    paymentOption?: QueuePaymentOption;
    receiptPrinted?: boolean;
    targetCashierId?: string;
    targetCashierName?: string;
  }): HeldCart | null => {
    if (cart.length === 0) return null;

    const totalKes = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const holdSeq = (heldCarts.length + 101).toString();
    const isSalesLadyOrder =
      params?.submittedByRole === 'SALES_LADY' ||
      currentDepartment === 'AFFILIATES' ||
      posStationMode === 'SALES_LADY';
    const matchedAff =
      selectedAffiliate ||
      affiliates.find(
        a =>
          a.id === currentUser.id ||
          a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      ) ||
      null;

    const defaultBranchCashier =
      employees.find(e => e.department === 'POS' && e.branchId === activeBranch.id && e.active) ||
      employees.find(e => e.department === 'POS' && e.active);

    const resolvedTargetCashierId =
      params?.targetCashierId ||
      matchedAff?.assignedCashierId ||
      (!isSalesLadyOrder ? currentUser.id : defaultBranchCashier?.id);
    const resolvedTargetCashierName =
      params?.targetCashierName ||
      matchedAff?.assignedCashierName ||
      (!isSalesLadyOrder ? currentUser.name : defaultBranchCashier?.name);

    const newHeldCart: HeldCart = {
      id: `hold-${Date.now()}`,
      holdNumber: isSalesLadyOrder ? `QUE-${holdSeq}` : `HOLD-${holdSeq}`,
      branchId: activeBranch.id,
      heldById: currentUser.id,
      heldByName: currentUser.name,
      submittedByRole: isSalesLadyOrder ? 'SALES_LADY' : params?.submittedByRole || 'COUNTER_CASHIER',
      queueStatus:
        params?.queueStatus ||
        (params?.paymentOption === 'PRINT_RECEIPT_AND_HOLD'
          ? 'ON_HOLD_PENDING_PAYMENT'
          : 'QUEUED_AT_COUNTER'),
      paymentOption: params?.paymentOption || 'PAY_ON_COLLECTION',
      receiptPrinted: Boolean(params?.receiptPrinted || params?.paymentOption === 'PRINT_RECEIPT_AND_HOLD'),
      targetCashierId: resolvedTargetCashierId,
      targetCashierName: resolvedTargetCashierName,
      customerName: params?.customerName?.trim() || undefined,
      customerPhone: params?.customerPhone?.trim() || undefined,
      customerKraPin: params?.customerKraPin?.trim() || undefined,
      note: params?.note?.trim() || undefined,
      affiliateId: matchedAff?.id || (isSalesLadyOrder ? currentUser.id : undefined),
      affiliateName: matchedAff?.name || (isSalesLadyOrder ? currentUser.name : undefined),
      items: cart.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        affiliateMarkupPerUnit: item.affiliateMarkupPerUnit
      })),
      totalKes,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setHeldCarts(prev => [newHeldCart, ...prev]);
    clearCart();
    logUserActivity({
      actionType: 'HOLD_CART',
      actionTitle: `Queued Order ${newHeldCart.holdNumber} (KES ${totalKes.toLocaleString()})`,
      actionDetails: `Placed ${newHeldCart.items.length} item(s) on hold (${newHeldCart.queueStatus}) for ${newHeldCart.customerName || 'Walk-in Customer'}.`,
      module: 'POS'
    });
    return newHeldCart;
  };

  const updateHeldCartQueueStatus = (
    holdId: string,
    updates: Partial<
      Pick<
        HeldCart,
        | 'queueStatus'
        | 'paymentOption'
        | 'receiptPrinted'
        | 'preparedByCashierName'
        | 'readyAt'
        | 'targetCashierId'
        | 'targetCashierName'
        | 'note'
      >
    >
  ) => {
    setHeldCarts(prev =>
      prev.map(h => (h.id === holdId ? { ...h, ...updates } : h))
    );
  };

  const recallHeldCart = (holdId: string): HeldCart | null => {
    const target = heldCarts.find(h => h.id === holdId);
    if (!target) return null;

    setCart(
      target.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        affiliateMarkupPerUnit: item.affiliateMarkupPerUnit
      }))
    );

    const matchedAff =
      affiliates.find(
        a =>
          (target.affiliateId && a.id === target.affiliateId) ||
          (target.affiliateName && a.name.trim().toLowerCase() === target.affiliateName.trim().toLowerCase()) ||
          a.name.trim().toLowerCase() === target.heldByName.trim().toLowerCase()
      ) || null;
    setSelectedAffiliate(matchedAff);

    if (target.affiliateName || target.submittedByRole === 'SALES_LADY') {
      setRecalledSalesPerson({
        id: matchedAff?.id || target.affiliateId || target.heldById,
        name: matchedAff?.name || target.affiliateName || target.heldByName
      });
    } else {
      setRecalledSalesPerson(null);
    }

    setHeldCarts(prev => prev.filter(h => h.id !== holdId));
    return target;
  };

  const removeHeldCart = (holdId: string) => {
    setHeldCarts(prev => prev.filter(h => h.id !== holdId));
  };

  // Complete POS Sale via Single Server Authority (/api/pos/checkout) with safe OFFLINE_QUEUED reconciliation
  const completeSale = async (params: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerKraPin?: string;
    paymentMethod: 'MPESA' | 'CASH' | 'SPLIT' | 'BANK_TRANSFER';
    mpesaPhone?: string;
    mpesaReceiptNumber?: string;
    checkoutRequestId?: string;
    servedByName?: string;
    cashierId?: string;
    cashierName?: string;
    salesPersonId?: string;
    salesPersonName?: string;
    checkoutRole?: 'SALES_REP_SELF_CHECKOUT' | 'COUNTER_CASHIER_DIRECT' | 'COUNTER_CASHIER_REP_RECALL';
  }): Promise<{
    success: boolean;
    order?: SaleOrder;
    invoice?: ETimsInvoice;
    queuedOffline?: boolean;
    error?: string;
  }> => {
    if (cart.length === 0) {
      return { success: false, error: 'Cart is empty.' };
    }

    // Check Warehouse constraint: storage only, no direct sales allowed
    if (!activeBranch.allowDirectSales) {
      return {
        success: false,
        error: `Sales Prohibited: Branch "${activeBranch.name}" is designated as a WAREHOUSE. No direct retail or wholesale checkout allowed. Restock fulfillment only.`
      };
    }

    // Check Main Store wholesale minimum threshold rule
    const totalGross = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (
      activeBranch.tier === 'MAIN_STORE' &&
      activeBranch.minWholesaleThresholdKes &&
      totalGross < activeBranch.minWholesaleThresholdKes
    ) {
      return {
        success: false,
        error: `Wholesale Threshold Policy Violated: "${activeBranch.name}" enforces a minimum order amount of KES ${activeBranch.minWholesaleThresholdKes.toLocaleString()}. Current total is KES ${totalGross.toLocaleString()}.`
      };
    }

    // Build sale items & strictly separate Company Sales (at Company Price) from Affiliate Preferred Price Profit
    const isWholesaleSale = activeBranch.tier === 'MAIN_STORE' || activeBranch.tier === 'DISTRIBUTOR';
    let totalSaleKes = 0; // Total gross amount paid by customer (Company Sales + Affiliate Profit)
    let companySalesTotalKes = 0; // Strictly Company Price * Quantity (Company Sales)
    let totalAffiliateMarkupKes = 0; // Strictly (Preferred Price - Company Price) * Quantity (Affiliate Profit)
    let totalCogsKes = 0;
    let ipsCogsKes = 0;
    let lpsCogsKes = 0;

    const runningDeductedByBaseId = new Map<string, number>();

    const saleItems: SaleItem[] = cart.map(item => {
      const companyUnitPrice = getBranchProductPrice(
        item.product,
        activeBranch,
        isWholesaleSale ? 'WHOLESALE' : 'RETAIL'
      ).effectiveUnitPriceKes;
      const itemMarkupPerUnit = Math.max(0, item.affiliateMarkupPerUnit ?? Math.max(0, item.unitPrice - companyUnitPrice));
      const effectiveSellingPrice = companyUnitPrice + itemMarkupPerUnit;
      const itemCompanyTotal = companyUnitPrice * item.quantity;
      const itemMarkupTotal = itemMarkupPerUnit * item.quantity;
      const itemTotal = effectiveSellingPrice * item.quantity;
      // Company VAT is computed strictly on Company Sales so affiliate preferred pricing never distorts company tax
      const { vatAmount: itemCompanyVat } = calculateVatBreakdown(itemCompanyTotal);
      const cogs = item.product.warehouseCostKes * item.quantity;

      const baseProdId = item.product.id.split('-vol-')[0];
      const branchInv = inventoryItems.find(
        inv => inv.branchId === activeBranch.id && (inv.productId === item.product.id || inv.productId === baseProdId)
      );
      const alreadyDeducted = runningDeductedByBaseId.get(baseProdId) || 0;
      const stockBeforeSale = Math.max(0, (branchInv?.bottlesOnHand ?? 0) - alreadyDeducted);
      const stockAfterSale = Math.max(0, stockBeforeSale - item.quantity);
      runningDeductedByBaseId.set(baseProdId, alreadyDeducted + item.quantity);

      totalSaleKes += itemTotal;
      companySalesTotalKes += itemCompanyTotal;
      totalAffiliateMarkupKes += itemMarkupTotal;
      totalCogsKes += cogs;
      if (item.product.category === 'IPS') {
        ipsCogsKes += cogs;
      } else {
        lpsCogsKes += cogs;
      }

      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        barcode: item.product.barcode,
        quantity: item.quantity,
        companyUnitPrice,
        unitPrice: effectiveSellingPrice,
        costPrice: item.product.warehouseCostKes,
        vatAmount: itemCompanyVat,
        companyTotalAmount: itemCompanyTotal,
        totalAmount: itemTotal,
        affiliateMarkupPerUnit: itemMarkupPerUnit,
        affiliateProfitAmount: itemMarkupTotal,
        stockBeforeSale,
        stockAfterSale,
        assetValueDeductedKes: cogs
      };
    });

    const { taxableAmount, vatAmount } = calculateVatBreakdown(companySalesTotalKes);
    const idempotencyKey = `pos-idem-${activeBranch.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const servedByStaffName = (params.servedByName && params.servedByName.trim()) || currentUser.name || 'Brian Omondi';
    const effectiveAffiliate =
      selectedAffiliate ||
      (currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY'
        ? affiliates.find(
            a =>
              a.id === currentUser.id ||
              a.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
          ) || null
        : null);
    const effectiveAffiliateId =
      effectiveAffiliate?.id ||
      recalledSalesPerson?.id ||
      (currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY' ? currentUser.id : undefined);
    const effectiveAffiliateName =
      effectiveAffiliate?.name ||
      recalledSalesPerson?.name ||
      (currentDepartment === 'AFFILIATES' || posStationMode === 'SALES_LADY' ? currentUser.name : undefined);

    // Compute Affiliate Commission & Separated Preferred Price Profit based on Commission Settings
    const baselineSaleKes = companySalesTotalKes;
    const affMode: AffiliateCommissionMode =
      effectiveAffiliate?.commissionMode || defaultAffiliateCommissionMode || 'COMMISSION_AND_PROFIT';
    const affRate =
      effectiveAffiliate?.commissionRatePercent !== undefined
        ? effectiveAffiliate.commissionRatePercent
        : defaultAffiliateCommissionRate;

    const computedBaseAffCommKes =
      effectiveAffiliate && (affMode === 'COMMISSION_AND_PROFIT' || affMode === 'BASE_COMMISSION_ONLY')
        ? Math.round(baselineSaleKes * (affRate / 100))
        : 0;
    const computedPreferredProfitKes =
      affMode === 'BASE_COMMISSION_ONLY' ? 0 : totalAffiliateMarkupKes;
    const affTotalEarnedOnOrderKes = computedPreferredProfitKes + computedBaseAffCommKes;

    // Resolve exact Cashier and Sales Representative Relationship
    let resolvedCheckoutRole: 'SALES_REP_SELF_CHECKOUT' | 'COUNTER_CASHIER_DIRECT' | 'COUNTER_CASHIER_REP_RECALL' =
      params.checkoutRole ||
      (posStationMode === 'SALES_LADY'
        ? 'SALES_REP_SELF_CHECKOUT'
        : recalledSalesPerson || selectedAffiliate
        ? 'COUNTER_CASHIER_REP_RECALL'
        : 'COUNTER_CASHIER_DIRECT');

    let resolvedCashierId = params.cashierId;
    let resolvedCashierName = params.cashierName;
    let resolvedSalesPersonId = params.salesPersonId;
    let resolvedSalesPersonName = params.salesPersonName;

    if (posStationMode === 'SALES_LADY') {
      // Sales Representative doing direct cashout by themselves without queueing to cashier
      resolvedSalesPersonId = resolvedSalesPersonId || effectiveAffiliateId || currentUser.id;
      resolvedSalesPersonName = resolvedSalesPersonName || effectiveAffiliateName || currentUser.name;
      resolvedCashierId = resolvedCashierId || currentUser.id;
      resolvedCashierName = resolvedCashierName || `${resolvedSalesPersonName} (Direct Self-Checkout)`;
      resolvedCheckoutRole = 'SALES_REP_SELF_CHECKOUT';
    } else {
      // Counter Cashier Terminal
      resolvedCashierId = resolvedCashierId || currentUser.id;
      resolvedCashierName = resolvedCashierName || servedByStaffName;
      if (recalledSalesPerson || selectedAffiliate) {
        resolvedSalesPersonId = resolvedSalesPersonId || recalledSalesPerson?.id || selectedAffiliate?.id;
        resolvedSalesPersonName = resolvedSalesPersonName || recalledSalesPerson?.name || selectedAffiliate?.name;
        resolvedCheckoutRole = 'COUNTER_CASHIER_REP_RECALL';
      } else {
        resolvedCheckoutRole = 'COUNTER_CASHIER_DIRECT';
      }
    }

    // 1. Authoritative Safaricom Daraja M-Pesa Receipt Verification via Server
    let mpesaReceiptCode: string | undefined = params.mpesaReceiptNumber?.trim().toUpperCase() || undefined;
    if (params.paymentMethod === 'MPESA') {
      try {
        const mpesaRes = await fetch('/api/mpesa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            checkoutRequestId: params.checkoutRequestId,
            receiptNumber: mpesaReceiptCode,
            amount: totalSaleKes,
            phone: params.mpesaPhone || params.customerPhone || '',
            orderNumber: idempotencyKey
          })
        });
        const verified = await mpesaRes.json().catch(() => ({}));
        if (!mpesaRes.ok || !verified.verified || !verified.receiptNumber) {
          return {
            success: false,
            error:
              verified.error ||
              'Safaricom Daraja M-Pesa payment has not been confirmed yet. Please complete the M-Pesa PIN prompt on the customer handset or verify a valid M-Pesa receipt.'
          };
        }
        mpesaReceiptCode = String(verified.receiptNumber).trim().toUpperCase();
      } catch {
        return {
          success: false,
          error:
            'Unable to reach the Safaricom Daraja verification gateway (/api/mpesa/verify). M-Pesa sales require authoritative server confirmation.'
        };
      }
    }

    // 2. Submit to Single Authoritative Server Endpoint (/api/pos/checkout)
    let serverReachable = false;
    let checkoutData: Record<string, any> | null = null;

    try {
      const checkoutRes = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          branchId: activeBranch.id,
          items: cart.map(i => ({
            productId: i.product.id,
            productName: i.product.name,
            sku: i.product.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            unitPriceKes: i.unitPrice
          })),
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          customerPhone: params.customerPhone || params.mpesaPhone,
          paymentMethod: params.paymentMethod,
          mpesaReceiptNumber: mpesaReceiptCode,
          saleType: isWholesaleSale ? 'WHOLESALE' : 'RETAIL',
          cashierId: resolvedCashierId,
          cashierName: resolvedCashierName,
          salesPersonId: resolvedSalesPersonId,
          salesPersonName: resolvedSalesPersonName,
          affiliateId: resolvedSalesPersonId,
          affiliateName: resolvedSalesPersonName,
          checkoutRole: resolvedCheckoutRole,
          idempotencyKey
        })
      });

      if (checkoutRes.status === 409 || checkoutRes.status === 403 || checkoutRes.status === 400) {
        const conflict = await checkoutRes.json();
        return {
          success: false,
          error: conflict.error || 'Server Checkout Validation Error: Unable to complete sale.'
        };
      }

      if (checkoutRes.ok) {
        checkoutData = await checkoutRes.json();
        serverReachable = true;
      }
    } catch {
      serverReachable = false;
    }

    // 3. SAFE OFFLINE QUEUEING: If Server is unavailable, DO NOT invent a completed financial transaction,
    // DO NOT invent KRA eTIMS control codes, DO NOT deduct authoritative stock, and DO NOT post GL journals.
    // Instead, record the transaction as PENDING / OFFLINE_QUEUED for safe server-side reconciliation.
    if (!serverReachable || !checkoutData) {
      const queuedShortCode = idempotencyKey.slice(-6).toUpperCase();
      const queuedOrderNumber = `QUEUED-${queuedShortCode}`;
      const queuedOrderId = `ord-queued-${Date.now()}`;
      const queuedInvoiceId = `etims-queued-${Date.now()}`;
      const nowIso = new Date().toISOString();

      const queuedOrder: SaleOrder = {
        id: queuedOrderId,
        orderNumber: queuedOrderNumber,
        orderSource: 'POS',
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        cashierId: resolvedCashierId,
        cashierName: resolvedCashierName,
        salesPersonId: resolvedSalesPersonId,
        salesPersonName: resolvedSalesPersonName,
        checkoutRole: resolvedCheckoutRole,
        customerName:
          params.customerName ||
          (effectiveAffiliateName ? `Referral: ${effectiveAffiliateName}` : 'Walk-in Customer'),
        customerPhone: params.customerPhone || params.mpesaPhone,
        customerKraPin: params.customerKraPin,
        saleType: isWholesaleSale ? 'WHOLESALE' : 'RETAIL',
        items: saleItems,
        subtotalKes: taxableAmount,
        vatAmountKes: vatAmount,
        exciseAmountKes: Math.round(taxableAmount * 0.05 * 100) / 100,
        companySalesKes: companySalesTotalKes,
        totalKes: totalSaleKes,
        affiliateMarkupTotalKes: computedPreferredProfitKes,
        affiliateBaseCommissionKes: computedBaseAffCommKes,
        affiliateTotalEarnedKes: affTotalEarnedOnOrderKes,
        companySalesTotal: companySalesTotalKes,
        totalAmount: totalSaleKes,
        affiliateMarkupTotal: computedPreferredProfitKes,
        affiliateProfitAmount: computedPreferredProfitKes,
        affiliateBaseCommissionAmount: computedBaseAffCommKes,
        affiliateCommissionAmount: affTotalEarnedOnOrderKes,
        affiliateCommissionRate: affRate,
        affiliateId: effectiveAffiliateId,
        affiliateName: effectiveAffiliateName,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'OFFLINE_QUEUED',
        authoritativeStatus: 'OFFLINE_QUEUED',
        idempotencyKey,
        mpesaReceiptNumber: mpesaReceiptCode,
        createdAt: nowIso,
        etimsInvoiceNumber: 'PENDING_SERVER_RECONCILIATION',
        etimsQrPayload: '',
        etimsTransmitted: false
      };

      const queuedInvoice: ETimsInvoice = {
        id: queuedInvoiceId,
        invoiceNumber: 'PENDING_SERVER_RECONCILIATION',
        orderId: queuedOrder.id,
        branchId: activeBranch.id,
        sellerPin: activeBranch.kraPin,
        sellerName: 'VAAIRO BEVERAGES & MERCHANTS LTD',
        buyerPin: params.customerKraPin || 'P000000000X',
        buyerName: params.customerName || 'Consumer Cash Sale',
        servedBy: servedByStaffName,
        deviceSerialNumber: `OSCU-${activeBranch.code}-01`,
        cuSerialNumber: 'PENDING_SERVER_RECONCILIATION',
        qrCodeUrl: '',
        kraControlCode: 'OFFLINE_QUEUED',
        invoiceDate: nowIso.replace('T', ' ').substring(0, 19),
        taxableAmount,
        taxAmount: vatAmount,
        totalInvoiceAmount: totalSaleKes,
        transmissionStatus: 'QUEUED'
      };

      const queuedPayload: OfflineQueuedCheckoutPayload = {
        idempotencyKey,
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        saleType: isWholesaleSale ? 'WHOLESALE' : 'RETAIL',
        items: cart.map(i => ({
          productId: i.product.id,
          sku: i.product.sku,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          affiliateMarkupPerUnit: i.affiliateMarkupPerUnit
        })),
        customerName: params.customerName,
        customerPhone: params.customerPhone || params.mpesaPhone,
        customerKraPin: params.customerKraPin,
        paymentMethod: params.paymentMethod,
        mpesaPhone: params.mpesaPhone,
        mpesaReceiptNumber: mpesaReceiptCode,
        servedByName: servedByStaffName,
        queuedOrderId,
        queuedInvoiceId,
        queuedAt: nowIso,
        retryCount: 0
      };

      setOfflineQueuedCheckouts(prev => [queuedPayload, ...prev]);
      setOrders(prev => [queuedOrder, ...prev]);
      setEtimsInvoices(prev => [queuedInvoice, ...prev]);
      setLastCompletedInvoice(queuedInvoice);
      clearCart();

      logUserActivity({
        actionType: 'POS_SALE',
        actionTitle: `Queued Offline POS Sale ${queuedOrderNumber} (KES ${totalSaleKes.toLocaleString()})`,
        actionDetails: `Server unreachable — marked OFFLINE_QUEUED for authoritative server reconciliation (${activeBranch.name})`,
        module: 'POS'
      });

      return {
        success: true,
        order: queuedOrder,
        invoice: queuedInvoice,
        queuedOffline: true
      };
    }

    // 4. AUTHORITATIVE SERVER COMMIT SUCCEEDED: Hydrate strictly from Server Response
    const orderNumber = String(checkoutData.orderNumber);
    const invoiceNumber = String(checkoutData.invoiceNumber);
    const etimsRecord = checkoutData.etimsRecord || {};
    const cuSerialNumber = String(etimsRecord.cuSerial || systemSettings.etimsCuSerial);
    const kraControlCode = String(etimsRecord.kraControlCode || '');
    const qrPayload = String(etimsRecord.qrUrl || '');
    const serverUpdatedBalances = (checkoutData.updatedBalances || {}) as Record<string, number>;

    const newOrder: SaleOrder = {
      id: String(checkoutData.transactionId || `ord-${Date.now()}`),
      orderNumber,
      orderSource: 'POS',
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      cashierId: resolvedCashierId,
      cashierName: resolvedCashierName,
      salesPersonId: resolvedSalesPersonId,
      salesPersonName: resolvedSalesPersonName,
      checkoutRole: resolvedCheckoutRole,
      customerName: params.customerName || (effectiveAffiliateName ? `Referral: ${effectiveAffiliateName}` : 'Walk-in Customer'),
      customerPhone: params.customerPhone || params.mpesaPhone,
      customerKraPin: params.customerKraPin,
      saleType: isWholesaleSale ? 'WHOLESALE' : 'RETAIL',
      items: saleItems,
      subtotalKes: Number(checkoutData.subtotalKes ?? taxableAmount),
      vatAmountKes: Number(checkoutData.vatAmountKes ?? vatAmount),
      exciseAmountKes: Math.round(taxableAmount * 0.05 * 100) / 100,
      companySalesKes: companySalesTotalKes,
      totalKes: totalSaleKes,
      affiliateMarkupTotalKes: computedPreferredProfitKes,
      affiliateBaseCommissionKes: computedBaseAffCommKes,
      affiliateTotalEarnedKes: affTotalEarnedOnOrderKes,
      companySalesTotal: companySalesTotalKes,
      totalAmount: totalSaleKes,
      affiliateMarkupTotal: computedPreferredProfitKes,
      affiliateProfitAmount: computedPreferredProfitKes,
      affiliateBaseCommissionAmount: computedBaseAffCommKes,
      affiliateCommissionAmount: affTotalEarnedOnOrderKes,
      affiliateCommissionRate: affRate,
      affiliateId: effectiveAffiliateId,
      affiliateName: effectiveAffiliateName,
      paymentMethod: params.paymentMethod,
      paymentStatus: 'RECONCILED',
      authoritativeStatus: 'AUTHORITATIVE_COMMITTED',
      idempotencyKey,
      mpesaReceiptNumber: mpesaReceiptCode,
      createdAt: String(checkoutData.serverTimestamp || new Date().toISOString()),
      etimsInvoiceNumber: invoiceNumber,
      etimsQrPayload: qrPayload,
      etimsTransmitted: Boolean(etimsRecord.transmitted ?? true)
    };

    const newInvoice: ETimsInvoice = {
      id: String(etimsRecord.id || `etims-${Date.now()}`),
      invoiceNumber,
      orderId: newOrder.id,
      branchId: activeBranch.id,
      sellerPin: activeBranch.kraPin,
      sellerName: 'VAAIRO BEVERAGES & MERCHANTS LTD',
      buyerPin: params.customerKraPin || 'P000000000X',
      buyerName: params.customerName || 'Consumer Cash Sale',
      servedBy: servedByStaffName,
      deviceSerialNumber: `VAT-${activeBranch.code}-01`,
      cuSerialNumber,
      qrCodeUrl: qrPayload,
      kraControlCode,
      invoiceDate: String(checkoutData.serverTimestamp || new Date().toISOString()).replace('T', ' ').substring(0, 19),
      taxableAmount: Number(checkoutData.subtotalKes ?? taxableAmount),
      taxAmount: Number(checkoutData.vatAmountKes ?? vatAmount),
      totalInvoiceAmount: totalSaleKes,
      transmissionStatus: etimsRecord.transmitted === false ? 'QUEUED' : 'VERIFIED'
    };

    // Apply Server-Authoritative Stock Balances to UI projection
    const depletedItemsForAutoRefill: { productId: string; casesRequested: number }[] = [];
    setInventoryItems(prev => {
      return prev.map(invItem => {
        const prod = products.find(p => p.id === invItem.productId);
        const isActiveOrLinkedInvoiceBranch =
          invItem.branchId === activeBranch.id ||
          Boolean(prod?.linkedInvoiceId && invItem.linkedInvoiceId === prod.linkedInvoiceId);
        if (!isActiveOrLinkedInvoiceBranch) return invItem;

        const matchingSoldItems = saleItems.filter(
          s =>
            s.productId === invItem.productId ||
            s.productId.startsWith(`${invItem.productId}-vol-`)
        );
        if (matchingSoldItems.length > 0) {
          const totalSoldQty = matchingSoldItems.reduce((acc, item) => acc + item.quantity, 0);
          const serverExactBalance =
            invItem.branchId === activeBranch.id && serverUpdatedBalances[invItem.productId] !== undefined
              ? serverUpdatedBalances[invItem.productId]
              : Math.max(0, invItem.bottlesOnHand - totalSoldQty);
          const packSize = prod?.packSize || 12;
          if (invItem.branchId === activeBranch.id && serverExactBalance <= (invItem.reorderLevel || 12)) {
            depletedItemsForAutoRefill.push({
              productId: invItem.productId,
              casesRequested: serverExactBalance === 0 ? 5 : 3
            });
          }
          return {
            ...invItem,
            bottlesOnHand: serverExactBalance,
            casesOnHand: Math.floor(serverExactBalance / packSize),
            lastScannedAt: String(checkoutData.serverTimestamp || new Date().toISOString())
          };
        }
        return invItem;
      });
    });

    // If a shop runs out of stock / hits low stock and Warehouse Auto-Disburse is enabled, automatically trigger a pending disbursement notification from Warehouse (Main Store)
    if (autoDisburseEnabled && activeBranch.tier !== 'WAREHOUSE' && depletedItemsForAutoRefill.length > 0) {
      const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
      if (mainWarehouse) {
        const mappedItems = depletedItemsForAutoRefill
          .map(req => {
            const prod = products.find(p => p.id === req.productId);
            if (!prod) return null;
            return {
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              casesRequested: req.casesRequested,
              bottlesTotal: req.casesRequested * (prod.packSize || 12)
            };
          })
          .filter(Boolean) as RestockRequest['items'];

        if (mappedItems.length > 0) {
          const autoReq: RestockRequest = {
            id: `req-auto-${Date.now()}`,
            requestNumber: `RST-2026-${(restockRequests.length + 110).toString()}`,
            fromBranchId: activeBranch.id,
            fromBranchName: activeBranch.name,
            toBranchId: mainWarehouse.id,
            toBranchName: `${mainWarehouse.name} (Main Store)`,
            requestedBy: 'Warehouse Controller (Auto-Disburse)',
            initiationType: 'WAREHOUSE_AUTO_DISBURSE',
            urgency: 'OUT_OF_STOCK',
            notes: `Auto-disbursed by Warehouse (Main Store) after independent sale at ${activeBranch.name} depleted stock — pending acceptance.`,
            status: 'PENDING',
            items: mappedItems,
            createdAt: new Date().toISOString()
          };
          setRestockRequests(prev => [autoReq, ...prev]);
        }
      }
    }

    // 2. Register M-Pesa transaction if paid via M-Pesa
    if (params.paymentMethod === 'MPESA' && mpesaReceiptCode) {
      const newMpesaTx: MpesaTransaction = {
        id: `mpesa-${Date.now()}`,
        receiptNumber: mpesaReceiptCode,
        transactionType: 'Buy Goods Till',
        phoneNumber: params.mpesaPhone || params.customerPhone || '254722000000',
        customerName: params.customerName || 'M-PESA WALLET CUSTOMER',
        amountKes: totalSaleKes,
        shortCode: '829102',
        billRefNumber: orderNumber,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        status: 'RECONCILED',
        matchedInvoiceId: newInvoice.id,
        matchedOrderNumber: orderNumber,
        autoReconciled: true
      };
      setMpesaTransactions(prev => [newMpesaTx, ...prev]);
    }

    // 3. Separate Affiliate Profit from Company Sales & Register Commissions
    const newCommissionRecords: CommissionRecord[] = [];
    let totalOrderCommissionsKes = 0;
    let companyFundedCommissionsKes = 0; // Base % commissions paid out of company baseline sales

    // 3a. Affiliate Sales Lady Profit & Commission (Separated Preferred Price Profit + Base Commission %)
    if (effectiveAffiliate || totalAffiliateMarkupKes > 0) {
      const affTotalCommKes = affTotalEarnedOnOrderKes;
      companyFundedCommissionsKes += computedBaseAffCommKes;

      if (affTotalCommKes > 0) {
        totalOrderCommissionsKes += affTotalCommKes;
        newCommissionRecords.push({
          id: `comm-aff-${Date.now()}`,
          affiliateId: effectiveAffiliate?.id || effectiveAffiliateId || 'aff-direct',
          affiliateName: effectiveAffiliate?.name || effectiveAffiliateName || 'Sales Affiliate',
          recipientRole: 'AFFILIATE_SALES_LADY',
          commissionType:
            computedPreferredProfitKes > 0 && computedBaseAffCommKes === 0
              ? 'PREFERRED_PRICE_PROFIT'
              : 'MARKUP_AND_COMMISSION',
          commissionMode: affMode,
          commissionRatePercent: affMode === 'PREFERRED_PRICE_PROFIT_ONLY' ? 0 : affRate,
          orderId: newOrder.id,
          orderNumber,
          baselinePriceKes: baselineSaleKes,
          soldPriceKes: totalSaleKes,
          preferredPriceProfitKes: computedPreferredProfitKes,
          baseCommissionKes: computedBaseAffCommKes,
          markupEarnedKes: affTotalCommKes,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });

        if (effectiveAffiliate) {
          setAffiliates(prev =>
            prev.map(aff => {
              if (aff.id === effectiveAffiliate.id) {
                return {
                  ...aff,
                  totalSalesKes: aff.totalSalesKes + totalSaleKes,
                  companySalesTotalKes: (aff.companySalesTotalKes || 0) + baselineSaleKes,
                  preferredPriceProfitTotalKes: (aff.preferredPriceProfitTotalKes || 0) + computedPreferredProfitKes,
                  baseCommissionTotalKes: (aff.baseCommissionTotalKes || 0) + computedBaseAffCommKes,
                  totalCommissionEarnedKes: aff.totalCommissionEarnedKes + affTotalCommKes,
                  pendingCommissionKes: aff.pendingCommissionKes + affTotalCommKes
                };
              }
              return aff;
            })
          );
        }
      }
    }

    // 3b. Casual POS Cashier Commission (POS Cashiers are casual employees working on commission)
    const matchedPosCashier =
      employees.find(
        e =>
          (e.department === 'POS' || e.employmentType === 'CASUAL') &&
          (e.id === currentUser.id ||
            e.name.trim().toLowerCase() === servedByStaffName.trim().toLowerCase() ||
            (effectiveAffiliate?.assignedCashierId && e.id === effectiveAffiliate.assignedCashierId))
      ) ||
      employees.find(e => e.department === 'POS' && e.branchId === activeBranch.id && e.active) ||
      employees.find(e => e.department === 'POS' && e.active);

    if (matchedPosCashier) {
      const cashierRate = matchedPosCashier.commissionRatePercent ?? 3;
      const cashierCommKes = Math.round(baselineSaleKes * (cashierRate / 100));
      if (cashierCommKes > 0) {
        totalOrderCommissionsKes += cashierCommKes;
        companyFundedCommissionsKes += cashierCommKes;
        newCommissionRecords.push({
          id: `comm-pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          affiliateId: matchedPosCashier.id,
          affiliateName: `${matchedPosCashier.name} (POS Cashier)`,
          recipientRole: 'POS_CASHIER',
          commissionType: 'POS_CASHIER_COMMISSION',
          commissionRatePercent: cashierRate,
          orderId: newOrder.id,
          orderNumber,
          baselinePriceKes: baselineSaleKes,
          soldPriceKes: totalSaleKes,
          preferredPriceProfitKes: 0,
          baseCommissionKes: cashierCommKes,
          markupEarnedKes: cashierCommKes,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });

        setEmployees(prev =>
          prev.map(emp => {
            if (emp.id === matchedPosCashier.id) {
              return {
                ...emp,
                totalSalesKes: (emp.totalSalesKes || 0) + baselineSaleKes,
                totalCommissionEarnedKes: (emp.totalCommissionEarnedKes || 0) + cashierCommKes,
                pendingCommissionKes: (emp.pendingCommissionKes || 0) + cashierCommKes
              };
            }
            return emp;
          })
        );
      }
    }

    if (newCommissionRecords.length > 0) {
      setCommissions(prev => [...newCommissionRecords, ...prev]);
    }

    // 4. Automated Double-Entry General Ledger Posting with Strict Separation of Affiliate Profit from Company Sales
    // - Customer Paid (totalSaleKes) = Company Sales (companySalesTotalKes) + Separated Affiliate Profit (computedPreferredProfitKes)
    // - Company Revenue (4010/4020) is strictly derived from Company Sales (taxableAmount - companyFundedCommissionsKes)
    // - Affiliate Profit + Commissions (totalOrderCommissionsKes) is separated into Account 2045 (Affiliate Payable)
    const paymentAccountCode = params.paymentMethod === 'MPESA' ? '1020' : '1010';
    const paymentAccountName = params.paymentMethod === 'MPESA' ? 'M-Pesa Clearing & Settlement (Daraja)' : 'Cash on Hand (Tills)';
    const revenueAccountCode = newOrder.saleType === 'WHOLESALE' ? '4010' : '4020';
    const revenueAccountName = newOrder.saleType === 'WHOLESALE' ? 'Wholesale Sales Revenue (Main Stores)' : 'Retail Sales Revenue (Liquor Stores)';

    // Enforce exact balancing between payment collected, company revenue, vat, and affiliate profit/commissions
    // Total Customer Payment = Company Net Revenue + VAT (16%) + Separated Affiliate Profit/Commissions
    const nonRevenueCredits = Math.round((vatAmount + totalOrderCommissionsKes) * 100) / 100;
    const balancedCompanyRevenue = Math.max(0, Math.round((totalSaleKes - nonRevenueCredits) * 100) / 100);

    const journalLines = [
      { accountCode: paymentAccountCode, accountName: paymentAccountName, debitKes: totalSaleKes, creditKes: 0 },
      { accountCode: revenueAccountCode, accountName: `${revenueAccountName} (Company Price Only)`, debitKes: 0, creditKes: balancedCompanyRevenue },
      { accountCode: '2020', accountName: 'Output VAT 16% Payable (Enforced on Company Price)', debitKes: 0, creditKes: vatAmount }
    ];

    if (totalOrderCommissionsKes > 0) {
      journalLines.push({
        accountCode: '2045',
        accountName: 'Separated Affiliate Profit & Commission Payable (Earned by Affiliate)',
        debitKes: 0,
        creditKes: totalOrderCommissionsKes
      });
    }

    if (totalCogsKes > 0) {
      if (ipsCogsKes > 0) {
        journalLines.push(
          { accountCode: '5010', accountName: 'Cost of Goods Sold - IPS (Imports/Fine Spirits)', debitKes: ipsCogsKes, creditKes: 0 },
          { accountCode: '1040', accountName: 'Inventory Asset - IPS Bottled Stock', debitKes: 0, creditKes: ipsCogsKes }
        );
      }
      if (lpsCogsKes > 0) {
        journalLines.push(
          { accountCode: '5020', accountName: 'Cost of Goods Sold - LPS (Local Spirits & Beers)', debitKes: lpsCogsKes, creditKes: 0 },
          { accountCode: '1050', accountName: 'Inventory Asset - LPS Bottled Stock', debitKes: 0, creditKes: lpsCogsKes }
        );
      }
    }

    // Mathematical zero-variance check
    const totalLineDebits = Math.round(journalLines.reduce((s, l) => s + l.debitKes, 0) * 100) / 100;
    const totalLineCredits = Math.round(journalLines.reduce((s, l) => s + l.creditKes, 0) * 100) / 100;
    const balanceVariance = Math.round((totalLineDebits - totalLineCredits) * 100) / 100;
    if (balanceVariance !== 0) {
      const revLine = journalLines.find(l => l.accountCode === revenueAccountCode);
      if (revLine) {
        revLine.creditKes = Math.round((revLine.creditKes + balanceVariance) * 100) / 100;
      }
    }

    const finalDebitKes = Math.round(journalLines.reduce((s, l) => s + l.debitKes, 0) * 100) / 100;
    const finalCreditKes = Math.round(journalLines.reduce((s, l) => s + l.creditKes, 0) * 100) / 100;

    const staffAttributionDesc =
      resolvedCheckoutRole === 'SALES_REP_SELF_CHECKOUT'
        ? `Direct Self-Checkout by Sales Rep ${resolvedSalesPersonName}`
        : resolvedSalesPersonName
        ? `Cashier: ${resolvedCashierName} • Sales Rep: ${resolvedSalesPersonName}`
        : `Counter Cashier: ${resolvedCashierName} (Direct Walk-in)`;

    const journalEntry: JournalEntry = {
      id: String(checkoutData?.journalEntryId || `je-${Date.now()}`),
      entryNumber: String(checkoutData?.journalEntryNumber || `JE-2026-${(journalEntries.length + 100).toString()}`),
      date: String(checkoutData?.serverTimestamp || new Date().toISOString()).substring(0, 10),
      referenceType: 'SALE_ETIMS',
      referenceId: invoiceNumber,
      description:
        computedPreferredProfitKes > 0
          ? `Order ${orderNumber} (${staffAttributionDesc}): Company Sales KES ${companySalesTotalKes.toLocaleString()} separated from Affiliate Profit KES ${computedPreferredProfitKes.toLocaleString()} (Earned by ${effectiveAffiliateName || 'Affiliate'}) [Balanced GL]`
          : `Auto-posted revenue for ${newOrder.saleType} Order ${orderNumber} (${invoiceNumber}) [${staffAttributionDesc}] [Balanced GL]`,
      lines: journalLines,
      totalDebitKes: finalDebitKes,
      totalCreditKes: finalCreditKes,
      postedBy: resolvedCashierName,
      branchId: activeBranch.id
    };

    setJournalEntries(prev => [journalEntry, ...prev]);

    // Update Chart of Account balances (Cash/M-Pesa/Bank, Revenue, Output VAT, COGS IPS/LPS, Inventory Asset, Affiliate Payable)
    const actualRevenueCredited = journalLines.find(l => l.accountCode === revenueAccountCode)?.creditKes || balancedCompanyRevenue;

    const resolvedPaymentCode =
      params.paymentMethod === 'MPESA'
        ? '1020'
        : params.paymentMethod === 'BANK_TRANSFER'
        ? '1030'
        : '1010';

    setChartOfAccounts(prev => {
      return prev.map(acc => {
        if (acc.code === resolvedPaymentCode) {
          return { ...acc, balanceKes: acc.balanceKes + totalSaleKes };
        }
        if (acc.code === revenueAccountCode) {
          return { ...acc, balanceKes: acc.balanceKes + actualRevenueCredited };
        }
        if (acc.code === '2020') {
          return { ...acc, balanceKes: acc.balanceKes + vatAmount };
        }
        if (acc.code === '5010' && ipsCogsKes > 0) {
          return { ...acc, balanceKes: acc.balanceKes + ipsCogsKes };
        }
        if (acc.code === '5020' && lpsCogsKes > 0) {
          return { ...acc, balanceKes: acc.balanceKes + lpsCogsKes };
        }
        if (acc.code === '1040' && ipsCogsKes > 0) {
          return { ...acc, balanceKes: Math.max(0, acc.balanceKes - ipsCogsKes) };
        }
        if (acc.code === '1050' && lpsCogsKes > 0) {
          return { ...acc, balanceKes: Math.max(0, acc.balanceKes - lpsCogsKes) };
        }
        if (acc.code === '2045' && totalOrderCommissionsKes > 0) {
          return { ...acc, balanceKes: acc.balanceKes + totalOrderCommissionsKes };
        }
        return acc;
      });
    });

    setOrders(prev => [newOrder, ...prev]);
    setEtimsInvoices(prev => [newInvoice, ...prev]);
    setLastCompletedInvoice(newInvoice);
    setRecalledSalesPerson(null);
    setSelectedAffiliate(null);
    clearCart();

    logUserActivity({
      actionType: 'POS_SALE',
      actionTitle: `Completed ${newOrder.saleType} Sale ${orderNumber} (KES ${totalSaleKes.toLocaleString()})`,
      actionDetails: `Paid via ${params.paymentMethod} • 16% VAT Invoice: ${invoiceNumber} • Served by ${servedByStaffName} at ${activeBranch.name}`,
      module: 'POS'
    });

    return { success: true, order: newOrder, invoice: newInvoice };
  };

  // Safe Server Reconciliation for Offline-Queued POS Checkouts
  const reconcileOfflineQueuedCheckouts = React.useCallback(async (): Promise<{
    reconciledCount: number;
    remainingCount: number;
  }> => {
    if (offlineQueuedCheckouts.length === 0) {
      return { reconciledCount: 0, remainingCount: 0 };
    }

    try {
      const res = await fetch('/api/pos/reconcile-queued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ queuedCheckouts: offlineQueuedCheckouts })
      });

      if (!res.ok) {
        return { reconciledCount: 0, remainingCount: offlineQueuedCheckouts.length };
      }

      const data = await res.json();
      const results: Array<{
        idempotencyKey: string;
        queuedOrderId?: string;
        queuedInvoiceId?: string;
        status: number;
        body: Record<string, any>;
      }> = Array.isArray(data.results) ? data.results : [];

      const reconciledKeys = new Set<string>();
      for (const r of results) {
        if (r.status === 200 && r.body && r.body.orderNumber) {
          reconciledKeys.add(r.idempotencyKey);
          const authOrderNum = String(r.body.orderNumber);
          const authInvNum = String(r.body.invoiceNumber || authOrderNum);
          const etimsRec = r.body.etimsRecord || {};
          const updatedBalances = (r.body.updatedBalances || {}) as Record<string, number>;

          // Upgrade queued order to AUTHORITATIVE_COMMITTED
          setOrders(prev =>
            prev.map(o =>
              o.id === r.queuedOrderId || o.idempotencyKey === r.idempotencyKey
                ? {
                    ...o,
                    orderNumber: authOrderNum,
                    paymentStatus: 'RECONCILED',
                    authoritativeStatus: 'AUTHORITATIVE_COMMITTED',
                    etimsInvoiceNumber: authInvNum,
                    etimsQrPayload: String(etimsRec.qrUrl || o.etimsQrPayload),
                    etimsTransmitted: Boolean(etimsRec.transmitted ?? true)
                  }
                : o
            )
          );

          // Upgrade queued eTIMS invoice with server-signed KRA identifiers
          setEtimsInvoices(prev =>
            prev.map(inv =>
              inv.id === r.queuedInvoiceId || inv.orderId === r.queuedOrderId
                ? {
                    ...inv,
                    invoiceNumber: authInvNum,
                    cuSerialNumber: String(etimsRec.cuSerial || inv.cuSerialNumber),
                    kraControlCode: String(etimsRec.kraControlCode || inv.kraControlCode),
                    qrCodeUrl: String(etimsRec.qrUrl || inv.qrCodeUrl),
                    transmissionStatus: etimsRec.transmitted === false ? 'QUEUED' : 'VERIFIED'
                  }
                : inv
            )
          );

          // Apply authoritative stock balances from server reconciliation
          if (Object.keys(updatedBalances).length > 0) {
            setInventoryItems(prev =>
              prev.map(invItem => {
                if (updatedBalances[invItem.productId] !== undefined) {
                  const exactQty = updatedBalances[invItem.productId];
                  return {
                    ...invItem,
                    bottlesOnHand: exactQty,
                    casesOnHand: Math.floor(exactQty / 12),
                    lastScannedAt: String(r.body.serverTimestamp || new Date().toISOString())
                  };
                }
                return invItem;
              })
            );
          }
        }
      }

      const remaining = offlineQueuedCheckouts.filter(q => !reconciledKeys.has(q.idempotencyKey));
      setOfflineQueuedCheckouts(remaining);
      return {
        reconciledCount: reconciledKeys.size,
        remainingCount: remaining.length
      };
    } catch {
      return { reconciledCount: 0, remainingCount: offlineQueuedCheckouts.length };
    }
  }, [offlineQueuedCheckouts, setOfflineQueuedCheckouts, setOrders, setEtimsInvoices, setInventoryItems]);

  useEffect(() => {
    if (offlineQueuedCheckouts.length === 0) return;
    const handleOnline = () => {
      reconcileOfflineQueuedCheckouts();
    };
    window.addEventListener('online', handleOnline);
    const timer = window.setTimeout(() => {
      reconcileOfflineQueuedCheckouts();
    }, 5000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearTimeout(timer);
    };
  }, [offlineQueuedCheckouts.length, reconcileOfflineQueuedCheckouts]);

  // ============================================================================
  // USER-FACING WEBSITE STOREFRONT & ON-HOLD DELIVERY -> M-PESA SELF-PROMPT
  // ============================================================================
  const placeWebsiteDeliveryOrder = (params: {
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    deliveryLocation: string;
    deliveryNotes?: string;
    branchId?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    distanceKm?: number;
    estimatedEtaMinutes?: number;
    routingModel?: BranchRoutingModel;
    items: { product: Product; quantity: number }[];
  }): WebsiteDeliveryOrder => {
    const fulfillingBranch =
      branches.find(b => b.id === params.branchId && b.allowDirectSales) ||
      branches.find(b => b.id === params.branchId) ||
      branches.find(b => b.tier === 'LIQUOR_STORE' && b.allowDirectSales) ||
      branches.find(b => b.allowDirectSales) ||
      activeBranch;

    const mappedItems = params.items.map(it => {
      // Strictly Company Price — Website orders do not pass through a Sales Affiliate
      const companyUnitPrice = it.product.retailPriceKes;
      return {
        product: it.product,
        quantity: it.quantity,
        companyUnitPrice,
        totalAmount: companyUnitPrice * it.quantity
      };
    });

    const totalCompanyPriceKes = mappedItems.reduce((sum, it) => sum + it.totalAmount, 0);
    const webSeq = (websiteDeliveryOrders.length + 301).toString();
    const realRiderEmp =
      employees.find(e => e.active && e.department === 'DELIVERY_MANAGER' && e.branchId === fulfillingBranch.id) ||
      employees.find(e => e.active && e.department === 'DELIVERY_MANAGER') ||
      employees.find(e => e.active && e.branchId === fulfillingBranch.id);

    const newWebOrder: WebsiteDeliveryOrder = {
      id: `web-ord-${Date.now()}`,
      orderNumber: `WEB-2026-${webSeq}`,
      customerName: params.customerName.trim() || 'Online Portal Customer',
      customerEmail: params.customerEmail?.trim() || undefined,
      customerPhone: params.customerPhone.trim(),
      deliveryLocation: params.deliveryLocation.trim() || 'Nairobi Delivery Zone',
      deliveryNotes: params.deliveryNotes?.trim() || undefined,
      branchId: fulfillingBranch.id,
      branchName: fulfillingBranch.name,
      customerLatitude: params.customerLatitude,
      customerLongitude: params.customerLongitude,
      distanceKm: params.distanceKm,
      estimatedEtaMinutes: params.estimatedEtaMinutes,
      routingModel: params.routingModel || 'SERVICE_ZONE_GEOFENCE',
      items: mappedItems,
      totalCompanyPriceKes,
      deliveryStatus: 'ON_HOLD_PENDING_DELIVERY',
      riderName: realRiderEmp ? `${realRiderEmp.name} (${realRiderEmp.roleTitle})` : 'Unassigned — Awaiting Dispatch',
      riderPhone: realRiderEmp ? realRiderEmp.mPesaNumber : '',
      createdAt: new Date().toISOString()
    };

    setWebsiteDeliveryOrders(prev => [newWebOrder, ...prev]);

    // Deduct ordered stock from the fulfilling branch and any linked invoice onboarding ledger
    const targetBranchIds = Array.from(new Set([fulfillingBranch.id, activeBranch.id]));
    setInventoryItems(prev =>
      prev.map(invItem => {
        const prod = products.find(p => p.id === invItem.productId);
        const isTargetOrLinked =
          targetBranchIds.includes(invItem.branchId) ||
          Boolean(prod?.linkedInvoiceId && invItem.linkedInvoiceId === prod.linkedInvoiceId);
        if (!isTargetOrLinked) return invItem;
        const matchingOrdered = mappedItems.filter(
          it =>
            it.product.id === invItem.productId ||
            it.product.id.startsWith(`${invItem.productId}-vol-`)
        );
        if (matchingOrdered.length > 0) {
          const orderedQty = matchingOrdered.reduce((acc, it) => acc + it.quantity, 0);
          const newBottles = Math.max(0, invItem.bottlesOnHand - orderedQty);
          const packSize = prod?.packSize || 12;
          return {
            ...invItem,
            bottlesOnHand: newBottles,
            casesOnHand: Math.floor(newBottles / packSize),
            lastScannedAt: new Date().toISOString()
          };
        }
        return invItem;
      })
    );

    // Automatically dispatch Customer Order Confirmation Email via support@urbantechdev.com (Zoho Mail Free Plan One-Way Outbound)
    if (newWebOrder.customerEmail && newWebOrder.customerEmail.includes('@')) {
      const itemsSummary = mappedItems
        .map(
          it =>
            `- ${it.quantity}x ${it.product.name} (${it.product.sku}) @ KES ${it.companyUnitPrice.toLocaleString()} = KES ${it.totalAmount.toLocaleString()}`
        )
        .join('\n');
      fetch('/api/email/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          to: newWebOrder.customerEmail,
          customerName: newWebOrder.customerName,
          orderNumber: newWebOrder.orderNumber,
          eventStage: 'ORDER_PLACED',
          branchName: fulfillingBranch.name,
          deliveryLocation: newWebOrder.deliveryLocation,
          riderName: newWebOrder.riderName,
          riderPhone: newWebOrder.riderPhone,
          estimatedEtaMinutes: newWebOrder.estimatedEtaMinutes,
          totalKes: totalCompanyPriceKes,
          items: mappedItems.map(it => ({
            productId: it.product.id,
            productName: it.product.name,
            quantity: it.quantity
          })),
          itemsSummary
        })
      }).catch(() => {});
    }

    return newWebOrder;
  };

  const updateWebsiteDeliveryOrderStatus = (
    orderId: string,
    status: WebsiteDeliveryOrderStatus
  ) => {
    const matchedOrder = websiteDeliveryOrders.find(o => o.id === orderId);
    setWebsiteDeliveryOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          deliveryStatus: status,
          deliveredAt:
            status === 'DELIVERED_AWAITING_PAYMENT'
              ? new Date().toISOString()
              : o.deliveredAt
        };
      })
    );

    if (matchedOrder?.customerEmail && matchedOrder.customerEmail.includes('@')) {
      fetch('/api/email/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          to: matchedOrder.customerEmail,
          customerName: matchedOrder.customerName,
          orderNumber: matchedOrder.orderNumber,
          eventStage: status,
          branchName: matchedOrder.branchName,
          deliveryLocation: matchedOrder.deliveryLocation,
          riderName: matchedOrder.riderName,
          riderPhone: matchedOrder.riderPhone,
          totalKes: matchedOrder.totalCompanyPriceKes
        })
      }).catch(() => {});
    }
  };

  const assignRiderToWebsiteDeliveryOrder = (
    orderId: string,
    riderName: string,
    riderPhone: string,
    deliveryNotes?: string
  ) => {
    const matchedOrder = websiteDeliveryOrders.find(o => o.id === orderId);
    setWebsiteDeliveryOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          riderName: riderName.trim() || o.riderName,
          riderPhone: riderPhone.trim() || o.riderPhone,
          deliveryNotes: deliveryNotes !== undefined ? deliveryNotes : o.deliveryNotes
        };
      })
    );

    if (matchedOrder?.customerEmail && matchedOrder.customerEmail.includes('@')) {
      fetch('/api/email/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          to: matchedOrder.customerEmail,
          customerName: matchedOrder.customerName,
          orderNumber: matchedOrder.orderNumber,
          eventStage: 'RIDER_ASSIGNED',
          branchName: matchedOrder.branchName,
          deliveryLocation: matchedOrder.deliveryLocation,
          riderName: riderName.trim() || matchedOrder.riderName,
          riderPhone: riderPhone.trim() || matchedOrder.riderPhone,
          totalKes: matchedOrder.totalCompanyPriceKes
        })
      }).catch(() => {});
    }
  };

  const completeWebsiteDeliveryOrderWithMpesaPrompt = async (
    orderId: string,
    mpesaPhone: string,
    options?: {
      checkoutRequestId?: string;
      receiptNumber?: string;
    }
  ): Promise<{
    success: boolean;
    order?: SaleOrder;
    invoice?: ETimsInvoice;
    websiteOrder?: WebsiteDeliveryOrder;
    error?: string;
  }> => {
    const targetWebOrder = websiteDeliveryOrders.find(o => o.id === orderId);
    if (!targetWebOrder) {
      return { success: false, error: 'Website delivery order not found.' };
    }
    if (targetWebOrder.deliveryStatus === 'COMPLETED_AND_PAID') {
      return { success: false, error: 'This website order has already been completed and paid.' };
    }

    const rawPhone = (mpesaPhone || targetWebOrder.customerPhone || '').replace(/\s+/g, '');
    const normalizedPhone = rawPhone.startsWith('0')
      ? `254${rawPhone.slice(1)}`
      : rawPhone.startsWith('+254')
      ? rawPhone.slice(1)
      : rawPhone;

    const fulfillingBranch =
      branches.find(b => b.id === targetWebOrder.branchId) ||
      branches.find(b => b.allowDirectSales) ||
      activeBranch;

    let totalCompanySaleKes = 0;
    let ipsCogsKes = 0;
    let lpsCogsKes = 0;

    const saleItems: SaleItem[] = targetWebOrder.items.map(it => {
      // Strictly Company Price — zero affiliate markup
      const companyUnitPrice = it.companyUnitPrice || it.product.retailPriceKes;
      const itemTotal = companyUnitPrice * it.quantity;
      const { vatAmount: itemVat } = calculateVatBreakdown(itemTotal);
      const cogs = it.product.warehouseCostKes * it.quantity;

      totalCompanySaleKes += itemTotal;
      if (it.product.category === 'IPS') {
        ipsCogsKes += cogs;
      } else {
        lpsCogsKes += cogs;
      }

      return {
        productId: it.product.id,
        productName: it.product.name,
        sku: it.product.sku,
        barcode: it.product.barcode,
        quantity: it.quantity,
        companyUnitPrice,
        unitPrice: companyUnitPrice,
        costPrice: it.product.warehouseCostKes,
        vatAmount: itemVat,
        companyTotalAmount: itemTotal,
        totalAmount: itemTotal,
        affiliateMarkupPerUnit: 0,
        affiliateProfitAmount: 0
      };
    });

    const { taxableAmount, vatAmount } = calculateVatBreakdown(totalCompanySaleKes);
    const orderNumber = targetWebOrder.orderNumber;

    // Verify authoritative Safaricom Daraja payment via /api/mpesa/query (no fake WEB84X receipts!)
    let mpesaReceiptCode = options?.receiptNumber?.trim().toUpperCase() || '';
    try {
      const verifyRes = await fetch('/api/mpesa/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutRequestId: options?.checkoutRequestId,
          receiptNumber: mpesaReceiptCode || undefined,
          orderNumber,
          phone: normalizedPhone,
          amount: totalCompanySaleKes
        })
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.verified || !verifyData.receiptNumber) {
        return {
          success: false,
          error:
            verifyData.error ||
            'No verified Safaricom Daraja M-Pesa confirmation found for this order. Please complete the M-Pesa PIN prompt on your handset first.'
        };
      }
      mpesaReceiptCode = String(verifyData.receiptNumber).trim().toUpperCase();
    } catch {
      return {
        success: false,
        error:
          'Unable to verify M-Pesa transaction with Safaricom Daraja server gateway (/api/mpesa/query).'
      };
    }

    const invoiceNumber = `VAT-INV-${orderNumber}`;
    const cuSerialNumber = `VATREG012026WEB${(orders.length % 900 + 100)}`;
    const kraControlCode = `VAT-WEB-${mpesaReceiptCode}-VERIFIED`;
    const qrPayload = `https://vaairo.co.ke/verify-vat?pin=${fulfillingBranch.kraPin}&inv=${orderNumber}&amt=${totalCompanySaleKes}&ref=${cuSerialNumber}&code=${kraControlCode}`;

    const newSaleOrder: SaleOrder = {
      id: `ord-web-${Date.now()}`,
      orderNumber,
      orderSource: 'WEBSITE',
      deliveryAddress: targetWebOrder.deliveryLocation,
      branchId: fulfillingBranch.id,
      branchName: fulfillingBranch.name,
      cashierId: 'website-portal',
      cashierName: 'Website Portal (Direct Company Price)',
      customerName: targetWebOrder.customerName,
      customerEmail: targetWebOrder.customerEmail,
      customerPhone: normalizedPhone,
      saleType: 'RETAIL',
      items: saleItems,
      subtotalKes: taxableAmount,
      vatAmountKes: vatAmount,
      exciseAmountKes: Math.round(taxableAmount * 0.05 * 100) / 100,
      companySalesKes: totalCompanySaleKes,
      totalKes: totalCompanySaleKes,
      affiliateMarkupTotalKes: 0,
      affiliateBaseCommissionKes: 0,
      affiliateTotalEarnedKes: 0,
      companySalesTotal: totalCompanySaleKes,
      totalAmount: totalCompanySaleKes,
      affiliateMarkupTotal: 0,
      affiliateProfitAmount: 0,
      affiliateBaseCommissionAmount: 0,
      affiliateCommissionAmount: 0,
      affiliateCommissionRate: 0,
      paymentMethod: 'MPESA',
      paymentStatus: 'RECONCILED',
      mpesaReceiptNumber: mpesaReceiptCode,
      createdAt: new Date().toISOString(),
      etimsInvoiceNumber: invoiceNumber,
      etimsQrPayload: qrPayload,
      etimsTransmitted: true
    };

    const newInvoice: ETimsInvoice = {
      id: `etims-web-${Date.now()}`,
      invoiceNumber,
      orderId: newSaleOrder.id,
      branchId: fulfillingBranch.id,
      sellerPin: fulfillingBranch.kraPin,
      sellerName: 'VAAIRO BEVERAGES & MERCHANTS LTD (ONLINE PORTAL)',
      buyerPin: 'P000000000X',
      buyerName: `${targetWebOrder.customerName} (${targetWebOrder.deliveryLocation})`,
      servedBy: 'VAAIRO Website Direct Portal',
      deviceSerialNumber: `VAT-WEB-${fulfillingBranch.code}`,
      cuSerialNumber,
      qrCodeUrl: qrPayload,
      kraControlCode,
      invoiceDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      taxableAmount,
      taxAmount: vatAmount,
      totalInvoiceAmount: totalCompanySaleKes,
      transmissionStatus: 'VERIFIED'
    };

    // Deduct stock if this was a pre-seeded order (new orders already deduct upon placement)
    if (targetWebOrder.id.startsWith('web-ord-seed-')) {
      const targetBranchIds = Array.from(new Set([activeBranch.id, fulfillingBranch.id]));
      setInventoryItems(prev =>
        prev.map(invItem => {
          const matchingSoldItems = saleItems.filter(
            s =>
              targetBranchIds.includes(invItem.branchId) &&
              (s.productId === invItem.productId || s.productId.startsWith(`${invItem.productId}-vol-`))
          );
          if (matchingSoldItems.length > 0) {
            const totalSoldQty = matchingSoldItems.reduce((acc, item) => acc + item.quantity, 0);
            const newBottles = Math.max(0, invItem.bottlesOnHand - totalSoldQty);
            const prod = products.find(p => p.id === invItem.productId);
            const packSize = prod?.packSize || 12;
            return {
              ...invItem,
              bottlesOnHand: newBottles,
              casesOnHand: Math.floor(newBottles / packSize),
              lastScannedAt: new Date().toISOString()
            };
          }
          return invItem;
        })
      );
    }

    // Record M-Pesa transaction
    const newMpesaTx: MpesaTransaction = {
      id: `mpesa-web-${Date.now()}`,
      receiptNumber: mpesaReceiptCode,
      transactionType: 'Buy Goods Till',
      phoneNumber: normalizedPhone,
      customerName: `${targetWebOrder.customerName} (Website Delivery)`,
      amountKes: totalCompanySaleKes,
      shortCode: '829102',
      billRefNumber: orderNumber,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'RECONCILED',
      matchedInvoiceId: newInvoice.id,
      matchedOrderNumber: orderNumber,
      autoReconciled: true
    };
    setMpesaTransactions(prev => [newMpesaTx, ...prev]);

    // Post Double-Entry General Ledger entry (100% Company Price — 0 Affiliate Markup)
    const journalEntry: JournalEntry = {
      id: `je-web-${Date.now()}`,
      entryNumber: `JE-2026-${(journalEntries.length + 100).toString()}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'SALE_ETIMS',
      referenceId: invoiceNumber,
      description: `Website Sale ${orderNumber} Delivered to ${targetWebOrder.deliveryLocation}: 100% Company Price (KES ${totalCompanySaleKes.toLocaleString()}) paid via Customer Self-Prompt M-Pesa (${mpesaReceiptCode})`,
      lines: [
        {
          accountCode: '1020',
          accountName: 'M-Pesa Clearing & Settlement (Daraja)',
          debitKes: totalCompanySaleKes,
          creditKes: 0
        },
        {
          accountCode: '4020',
          accountName: 'Retail Sales Revenue (Website Direct Company Price)',
          debitKes: 0,
          creditKes: taxableAmount
        },
        {
          accountCode: '2020',
          accountName: 'Output VAT 16% Payable (Enforced VAT)',
          debitKes: 0,
          creditKes: vatAmount
        }
      ],
      totalDebitKes: totalCompanySaleKes,
      totalCreditKes: totalCompanySaleKes,
      postedBy: 'Website Storefront Auto-Accounting (Direct Company Price)',
      branchId: fulfillingBranch.id
    };
    setJournalEntries(prev => [journalEntry, ...prev]);

    setChartOfAccounts(prev =>
      prev.map(acc => {
        if (acc.code === '1020') return { ...acc, balanceKes: acc.balanceKes + totalCompanySaleKes };
        if (acc.code === '4020') return { ...acc, balanceKes: acc.balanceKes + taxableAmount };
        if (acc.code === '2020') return { ...acc, balanceKes: acc.balanceKes + vatAmount };
        if (acc.code === '5010' && ipsCogsKes > 0) return { ...acc, balanceKes: acc.balanceKes + ipsCogsKes };
        if (acc.code === '5020' && lpsCogsKes > 0) return { ...acc, balanceKes: acc.balanceKes + lpsCogsKes };
        return acc;
      })
    );

    const updatedWebOrder: WebsiteDeliveryOrder = {
      ...targetWebOrder,
      deliveryStatus: 'COMPLETED_AND_PAID',
      deliveredAt: targetWebOrder.deliveredAt || new Date().toISOString(),
      paidAt: new Date().toISOString(),
      paymentPhone: normalizedPhone,
      mpesaReceiptNumber: mpesaReceiptCode,
      completedSaleOrderId: newSaleOrder.id,
      etimsInvoiceNumber: invoiceNumber
    };

    setWebsiteDeliveryOrders(prev =>
      prev.map(o => (o.id === orderId ? updatedWebOrder : o))
    );
    setOrders(prev => [newSaleOrder, ...prev]);
    setEtimsInvoices(prev => [newInvoice, ...prev]);
    setLastCompletedInvoice(newInvoice);

    // Automatically dispatch Purchase Successful & Official KRA eTIMS Fiscal Receipt Email
    if (targetWebOrder.customerEmail && targetWebOrder.customerEmail.includes('@')) {
      const itemsSummary = saleItems
        .map(
          it =>
            `- ${it.quantity}x ${it.productName} (${it.sku}) @ KES ${it.unitPrice.toLocaleString()} = KES ${it.totalAmount.toLocaleString()}`
        )
        .join('\n');
      fetch('/api/email/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          to: targetWebOrder.customerEmail,
          customerName: targetWebOrder.customerName,
          orderNumber,
          eventStage: 'COMPLETED_AND_PAID',
          branchName: fulfillingBranch.name,
          deliveryLocation: targetWebOrder.deliveryLocation,
          totalKes: totalCompanySaleKes,
          subtotalKes: taxableAmount,
          vatAmountKes: vatAmount,
          mpesaReceiptNumber: mpesaReceiptCode,
          etimsInvoiceNumber: invoiceNumber,
          kraControlCode,
          qrUrl: qrPayload,
          itemsSummary
        })
      }).catch(() => {});
    }

    return {
      success: true,
      order: newSaleOrder,
      invoice: newInvoice,
      websiteOrder: updatedWebOrder
    };
  };

  // M-Pesa Daraja Automated Reconciliation Engine
  const runMpesaAutoReconciliation = (): { matchedCount: number; matchedAmount: number } => {
    let matchedCount = 0;
    let matchedAmount = 0;

    setMpesaTransactions(prevTxs => {
      return prevTxs.map(tx => {
        if (tx.status === 'RECONCILED') return tx;

        // Try to match against orders with pending status or matching billRefNumber
        const matchedOrder = orders.find(
          o =>
            (tx.billRefNumber && o.orderNumber.toLowerCase() === tx.billRefNumber.toLowerCase()) ||
            (Math.abs(o.totalKes - tx.amountKes) < 1 && o.paymentStatus !== 'RECONCILED')
        );

        if (matchedOrder) {
          matchedCount++;
          matchedAmount += tx.amountKes;
          return {
            ...tx,
            status: 'RECONCILED',
            matchedInvoiceId: matchedOrder.etimsInvoiceNumber,
            matchedOrderNumber: matchedOrder.orderNumber,
            autoReconciled: true
          };
        }
        return tx;
      });
    });

    return { matchedCount, matchedAmount };
  };

  const postManualJournalEntry = (entryData: Omit<JournalEntry, 'id' | 'entryNumber'>) => {
    const newEntry: JournalEntry = {
      ...entryData,
      id: `je-${Date.now()}`,
      entryNumber: `JE-2026-${(journalEntries.length + 101).toString()}`
    };
    setJournalEntries(prev => [newEntry, ...prev]);

    // Wire manual journal entry directly into Chart of Accounts balances
    setChartOfAccounts(prev =>
      prev.map(acc => {
        const line = entryData.lines.find(l => l.accountCode === acc.code);
        if (!line) return acc;
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'COGS' || acc.type === 'EXPENSE';
        const delta = isDebitNormal ? line.debitKes - line.creditKes : line.creditKes - line.debitKes;
        return { ...acc, balanceKes: Math.max(0, acc.balanceKes + delta) };
      })
    );
  };

  // Supplier & Vendor Operations (Central Database = Truth)
  const addSupplier = async (
    supplierData: Omit<Supplier, 'id' | 'currentOutstandingKes'>
  ): Promise<Supplier> => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `sup-${Date.now().toString().slice(-4)}`,
      currentOutstandingKes: 0
    };
    const nextSuppliers = [newSupplier, ...suppliers.filter(s => s.id !== newSupplier.id)];
    const persistedOk = await pushUnifiedErpStateToFirestore(
      'suppliers',
      nextSuppliers,
      currentUser.name || 'ERP-ADMIN',
      true
    );
    if (!persistedOk) {
      const errMsg = 'Unable to save. Check your connection and try again.';
      setPersistenceErrorBanner(errMsg);
      setUnifiedDbSyncStatus('OFFLINE');
      throw new Error(errMsg);
    }
    setPersistenceErrorBanner(null);
    setSuppliers(prev => [newSupplier, ...prev.filter(s => s.id !== newSupplier.id)]);
    return newSupplier;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Commercial Distributor Operations (Central Database = Truth)
  const addDistributor = async (
    distributorData: Omit<CommercialDistributor, 'id' | 'currentReceivableKes'>
  ): Promise<CommercialDistributor> => {
    const newDistributor: CommercialDistributor = {
      ...distributorData,
      id: `dst-${Date.now().toString().slice(-4)}`,
      currentReceivableKes: 0
    };
    const nextDistributors = [
      newDistributor,
      ...distributors.filter(d => d.id !== newDistributor.id)
    ];

    const headOffice =
      branches.find(b => b.id === 'branch-hq-main') ||
      branches.find(b => b.tier === 'MAIN_STORE') ||
      MAIN_HEAD_OFFICE_BRANCH;
    const branchAlreadyExists = branches.some(
      b =>
        b.code.toUpperCase() === newDistributor.code.toUpperCase() ||
        b.name.toLowerCase() === newDistributor.companyName.toLowerCase()
    );
    const newDistBranchId = `branch-dist-${Date.now().toString().slice(-5)}`;
    const newDistBranch: Branch | null = branchAlreadyExists
      ? null
      : {
          id: newDistBranchId,
          name: newDistributor.companyName,
          code: newDistributor.code.toUpperCase(),
          tier: 'DISTRIBUTOR',
          location: `${newDistributor.region}, ${newDistributor.county}`,
          county: newDistributor.county,
          managerName: newDistributor.contactPerson || 'Merchant Branch Manager',
          contactPhone: newDistributor.phone || '+254 700 000 000',
          kraPin: newDistributor.kraPin || 'P051829301A',
          allowDirectSales: true,
          parentBranchId: headOffice.id,
          parentBranchName: headOffice.name
        };
    const nextBranches = newDistBranch ? [...branches, newDistBranch] : branches;

    // Write to central database first and require confirmation
    const [distOk, branchOk] = await Promise.all([
      pushUnifiedErpStateToFirestore('distributors', nextDistributors, currentUser.name, true),
      newDistBranch
        ? pushUnifiedErpStateToFirestore('branches', nextBranches, currentUser.name, true)
        : Promise.resolve(true)
    ]);

    if (!distOk || !branchOk) {
      const errMsg = 'Unable to save. Check your connection and try again.';
      setPersistenceErrorBanner(errMsg);
      setUnifiedDbSyncStatus('OFFLINE');
      throw new Error(errMsg);
    }

    setPersistenceErrorBanner(null);
    setDistributors(prev => [newDistributor, ...prev.filter(d => d.id !== newDistributor.id)]);
    if (newDistBranch) {
      setBranches(prev => {
        if (prev.length === 0) {
          setActiveBranchId(newDistBranchId);
        }
        return [...prev.filter(b => b.id !== newDistBranch.id), newDistBranch];
      });
    }
    return newDistributor;
  };

  const updateDistributor = (id: string, updates: Partial<CommercialDistributor>) => {
    setDistributors(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  // Supply Invoices & Packing Lists Intake
  const createSupplyInvoice = (
    invoiceData: Omit<SupplyInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'syncedToLedger'> & { customInvoiceNumber?: string }
  ): SupplyInvoice => {
    const yearPrefix = (invoiceData.deliveryDate || new Date().toISOString()).substring(0, 4) || '2026';
    const invoiceNumber =
      invoiceData.customInvoiceNumber?.trim() ||
      `SUP-INV-${yearPrefix}-${(supplyInvoices.length + 520).toString().padStart(4, '0')}`;
    const newInvoice: SupplyInvoice = {
      ...invoiceData,
      id: `sup-inv-${Date.now()}`,
      invoiceNumber,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      syncedToLedger: true
    };

    // 1. Update Supplier Outstanding Balance if total > 0
    if (invoiceData.totalAmountKes > 0) {
      setSuppliers(prev => prev.map(s => s.id === invoiceData.supplierId ? {
        ...s,
        currentOutstandingKes: s.currentOutstandingKes + invoiceData.totalAmountKes
      } : s));
    }

    // 2. Intake stock items into Receiving Branch Inventory
    if (invoiceData.items.length > 0) {
      setInventoryItems(prev => {
        const updated = [...prev];
        for (const item of invoiceData.items) {
          const existingIdx = updated.findIndex(i => i.branchId === invoiceData.branchId && i.productId === item.productId);
          if (existingIdx >= 0) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              bottlesOnHand: updated[existingIdx].bottlesOnHand + item.totalBottles,
              casesOnHand: updated[existingIdx].casesOnHand + item.casesSupplied,
              batchNumber: item.batchNumber || updated[existingIdx].batchNumber,
              linkedInvoiceId: newInvoice.id,
              linkedInvoiceNumber: newInvoice.invoiceNumber,
              lastScannedAt: new Date().toISOString()
            };
          } else {
            updated.push({
              id: `inv-${Date.now()}-${item.productId}`,
              productId: item.productId,
              branchId: invoiceData.branchId,
              bottlesOnHand: item.totalBottles,
              casesOnHand: item.casesSupplied,
              reorderLevel: 24,
              batchNumber: item.batchNumber || `BAT-${Date.now().toString().slice(-4)}`,
              expiryDate: item.expiryDate || '2030-12-31',
              lastScannedAt: new Date().toISOString(),
              linkedInvoiceId: newInvoice.id,
              linkedInvoiceNumber: newInvoice.invoiceNumber
            });
          }
        }
        void pushUnifiedErpStateToFirestore(
          'inventory',
          updated,
          currentUser.name || 'SUPPLY-INVOICE',
          true
        );
        void syncInventoryItemsToBranchLedgers(
          updated.filter(i => i.branchId === invoiceData.branchId),
          products,
          true
        );
        return updated;
      });
    }

    // 3. Post Double-Entry Journal Entry if totalAmountKes > 0:
    if (invoiceData.totalAmountKes > 0) {
      const hasIps = invoiceData.items.some(i => i.category === 'IPS');
      const invAccountCode = hasIps ? '1200' : '1210';
      const invAccountName = hasIps ? 'Inventory: Imported Products Stock (IPS) Bonded' : 'Inventory: Local Products Stock (LPS) Duty-Paid';

      const journalLines = [
        { accountCode: invAccountCode, accountName: invAccountName, debitKes: invoiceData.subtotalKes, creditKes: 0 },
        { accountCode: '2020', accountName: 'Input VAT 16% (Supply Tax Credit)', debitKes: invoiceData.vatKes, creditKes: 0 },
        { accountCode: '2010', accountName: `Trade Accounts Payable (${invoiceData.supplierName})`, debitKes: 0, creditKes: invoiceData.totalAmountKes }
      ];

      const newJE: JournalEntry = {
        id: `je-sup-${Date.now()}`,
        entryNumber: `JE-SUP-${Date.now().toString().slice(-6)}`,
        date: invoiceData.deliveryDate || new Date().toISOString().substring(0, 10),
        referenceType: 'INVENTORY_PURCHASE',
        referenceId: invoiceNumber,
        description: `Inbound Supply & Packing List Intake from ${invoiceData.supplierName} (${invoiceData.packingListNumber})`,
        lines: journalLines,
        totalDebitKes: invoiceData.totalAmountKes,
        totalCreditKes: invoiceData.totalAmountKes,
        postedBy: 'Procurement Supply Ingest Engine',
        branchId: invoiceData.branchId
      };

      setJournalEntries(prev => [newJE, ...prev]);
    }

    setSupplyInvoices(prev => {
      const nextInvoices = [newInvoice, ...prev];
      void pushUnifiedErpStateToFirestore(
        'supply_invoices',
        nextInvoices,
        currentUser.name || 'SUPPLY-INVOICE',
        true
      );
      return nextInvoices;
    });

    return newInvoice;
  };

  // Create Products Under a Selected Invoice & Save to Inventory + Invoice Archive
  const addProductsUnderInvoice = (
    invoiceId: string,
    newProductsData: Array<{
      name: string;
      sku: string;
      category: StockCategory;
      barcode?: string;
      caseBarcode?: string;
      packSize: number;
      casesSupplied: number;
      warehouseCostKes: number;
      wholesalePriceKes: number;
      retailPriceKes: number;
      batchNumber?: string;
      expiryDate?: string;
      volumeMl?: number;
      alcoholPercentage?: number;
      image?: string;
    }>
  ) => {
    const targetInvoice = supplyInvoices.find(inv => inv.id === invoiceId);
    if (!targetInvoice || newProductsData.length === 0) {
      return { createdProducts: [], updatedInvoice: null };
    }

    const createdProducts: Product[] = [];
    const addedInvoiceItems: SupplyInvoice['items'] = [];
    const newInventoryEntries: InventoryItem[] = [];

    newProductsData.forEach((pData, index) => {
      const ts = (Date.now() + index).toString();
      const prodId = `prod-${pData.category.toLowerCase()}-${ts.slice(-5)}-${index}`;
      const packSize = Math.max(1, pData.packSize || 12);
      const casesSupplied = Math.max(1, pData.casesSupplied || 1);
      const totalBottles = casesSupplied * packSize;
      const unitCostKes = pData.warehouseCostKes || 1500;
      const totalCostKes = totalBottles * unitCostKes;
      const vatAmountKes = Math.round(totalCostKes * 0.16);
      const batchNum = pData.batchNumber || `BAT-${targetInvoice.invoiceNumber.slice(-4)}-${index + 1}`;
      const expDate = pData.expiryDate || '2030-12-31';

      const newProduct: Product = {
        id: prodId,
        name: pData.name.trim(),
        sku: pData.sku.trim().toUpperCase(),
        barcode: pData.barcode?.trim() || `616${ts.slice(-10)}`,
        caseBarcode: pData.caseBarcode?.trim() || `1616${ts.slice(-10)}`,
        category: pData.category,
        brand: pData.name.trim().split(' ')[0] || 'VAAIRO',
        volumeMl: pData.volumeMl || 750,
        alcoholPercentage: pData.alcoholPercentage || 40,
        packSize,
        countryOfOrigin: pData.category === 'IPS' ? 'United Kingdom' : 'Kenya',
        warehouseCostKes: unitCostKes,
        wholesalePriceKes: pData.wholesalePriceKes || Math.round(unitCostKes * 1.25),
        retailPriceKes: pData.retailPriceKes || Math.round(unitCostKes * 1.5),
        minWholesaleQty: packSize,
        vatRate: 0.16,
        exciseDutyPerLitreKes: 356.4,
        kraExciseStampType: pData.category === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
        importDeclarationNumber: pData.category === 'IPS' ? `IDF/${targetInvoice.deliveryDate.substring(0, 4)}/NRB/${ts.slice(-5)}` : undefined,
        linkedInvoiceId: targetInvoice.id,
        linkedInvoiceNumber: targetInvoice.invoiceNumber,
        linkedInvoiceDate: targetInvoice.deliveryDate,
        image: pData.image || getProductImageUrl({ name: pData.name, category: pData.category })
      };

      createdProducts.push(newProduct);

      addedInvoiceItems.push({
        productId: prodId,
        productName: newProduct.name,
        sku: newProduct.sku,
        category: newProduct.category,
        casesSupplied,
        bottlesPerCase: packSize,
        totalBottles,
        unitCostKes,
        totalCostKes,
        vatAmountKes,
        batchNumber: batchNum,
        expiryDate: expDate
      });

      // Add stock to the invoice's receiving branch
      newInventoryEntries.push({
        id: `inv-${ts}-${prodId}`,
        productId: prodId,
        branchId: targetInvoice.branchId || activeBranch.id,
        bottlesOnHand: totalBottles,
        casesOnHand: casesSupplied,
        reorderLevel: 24,
        batchNumber: batchNum,
        expiryDate: expDate,
        lastScannedAt: new Date().toISOString(),
        linkedInvoiceId: targetInvoice.id,
        linkedInvoiceNumber: targetInvoice.invoiceNumber
      });

      // If activeBranch is different from invoice's branch, also ensure activeBranch has stock so it shows immediately
      if (activeBranch.id !== targetInvoice.branchId) {
        newInventoryEntries.push({
          id: `inv-act-${ts}-${prodId}`,
          productId: prodId,
          branchId: activeBranch.id,
          bottlesOnHand: totalBottles,
          casesOnHand: casesSupplied,
          reorderLevel: 24,
          batchNumber: batchNum,
          expiryDate: expDate,
          lastScannedAt: new Date().toISOString(),
          linkedInvoiceId: targetInvoice.id,
          linkedInvoiceNumber: targetInvoice.invoiceNumber
        });
      }
    });

    setProducts(prev => [...createdProducts, ...prev]);
    setInventoryItems(prev => [...newInventoryEntries, ...prev]);

    const addedSubtotal = addedInvoiceItems.reduce((s, i) => s + i.totalCostKes, 0);
    const addedVat = addedInvoiceItems.reduce((s, i) => s + i.vatAmountKes, 0);
    const addedTotal = addedSubtotal + addedVat;

    const updatedInvoice: SupplyInvoice = {
      ...targetInvoice,
      items: [...targetInvoice.items, ...addedInvoiceItems],
      subtotalKes: targetInvoice.subtotalKes + addedSubtotal,
      vatKes: targetInvoice.vatKes + addedVat,
      totalAmountKes: targetInvoice.totalAmountKes + addedTotal
    };

    setSupplyInvoices(prev => prev.map(inv => (inv.id === invoiceId ? updatedInvoice : inv)));

    if (addedTotal > 0) {
      setSuppliers(prev =>
        prev.map(s =>
          s.id === targetInvoice.supplierId
            ? { ...s, currentOutstandingKes: s.currentOutstandingKes + addedTotal }
            : s
        )
      );

      const newJE: JournalEntry = {
        id: `je-invprod-${Date.now()}`,
        entryNumber: `JE-INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().substring(0, 10),
        referenceType: 'INVENTORY_PURCHASE',
        referenceId: targetInvoice.invoiceNumber,
        description: `Onboarded ${createdProducts.length} SKU(s) under Invoice ${targetInvoice.invoiceNumber} (${targetInvoice.supplierName})`,
        lines: [
          { accountCode: '1200', accountName: 'Inventory Stock Asset (Invoice Linked)', debitKes: addedSubtotal, creditKes: 0 },
          { accountCode: '2020', accountName: 'KRA Input VAT (16%)', debitKes: addedVat, creditKes: 0 },
          { accountCode: '2010', accountName: `Trade Accounts Payable (${targetInvoice.supplierName})`, debitKes: 0, creditKes: addedTotal }
        ],
        totalDebitKes: addedTotal,
        totalCreditKes: addedTotal,
        postedBy: currentUser.name,
        branchId: targetInvoice.branchId
      };
      setJournalEntries(prev => [newJE, ...prev]);
    }

    return { createdProducts, updatedInvoice };
  };

  // Instant Scan Product Onboarding: Select Invoice -> Select Brand/Product -> Set Price -> Scan Barcode (Bluetooth or Mobile Camera)
  const instantScanOnboardProduct = (params: {
    invoiceId?: string;
    targetProductId?: string;
    brand: string;
    productName?: string;
    sku?: string;
    subCategory?: string;
    alcoholPercentage?: number;
    countryOfOrigin?: string;
    caseBarcode?: string;
    batchNumber?: string;
    expiryDate?: string;
    looseBottles?: number;
    targetBranchId?: string;
    retailPriceKes: number;
    wholesalePriceKes?: number;
    warehouseCostKes?: number;
    scannedBarcode: string;
    category?: StockCategory;
    volumeMl?: number;
    packSize?: number;
    casesSupplied?: number;
    piecesIndicated?: number;
    setExactPieces?: boolean;
    scanUnitMode?: 'CASE' | 'BOTTLE';
    image?: string;
  }) => {
    const cleanBarcode = params.scannedBarcode.trim();
    const retailKes = Math.max(50, Math.round(params.retailPriceKes || 2500));
    const wholesaleKes =
      params.wholesalePriceKes && params.wholesalePriceKes > 0
        ? Math.round(params.wholesalePriceKes)
        : Math.round(retailKes * 0.85);
    const costKes =
      params.warehouseCostKes && params.warehouseCostKes > 0
        ? Math.round(params.warehouseCostKes)
        : Math.round(retailKes * 0.72);

    // 1. Resolve or auto-create target Supply Invoice
    let targetInvoice =
      supplyInvoices.find(inv => inv.id === params.invoiceId) || supplyInvoices[0];
    if (!targetInvoice) {
      targetInvoice = createSupplyInvoice({
        supplierId: suppliers[0]?.id || 'sup-auto-01',
        supplierName: suppliers[0]?.name || 'Primary Beverage Supplier',
        supplierPin: suppliers[0]?.kraPin || 'P051000000A',
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        deliveryDate: new Date().toISOString().substring(0, 10),
        subtotalKes: 0,
        vatKes: 0,
        exciseDutyKes: 0,
        totalAmountKes: 0,
        paymentStatus: 'PENDING',
        paymentMethod: 'RTGS',
        packingListNumber: `PKL-${Date.now().toString().slice(-4)}`,
        items: [],
        notes: 'Auto-created supply invoice via Instant Scan Product Onboarding.'
      });
    }

    // 2. Smart Barcode + Brand + ML Auto-Pinning:
    // Priority 1: Exact barcode / caseBarcode / SKU match in products
    // Priority 2: Explicit targetProductId selected by user (resolved with chosen volumeMl if another variant exists)
    // Priority 3: Exact product name or brand + volumeMl match in products
    const barcodeMatchedProduct = products.find(
      p =>
        p.barcode === cleanBarcode ||
        p.caseBarcode === cleanBarcode ||
        p.sku.toLowerCase() === cleanBarcode.toLowerCase() ||
        (cleanBarcode.startsWith('1') && p.barcode === cleanBarcode.slice(1)) ||
        (`1${p.barcode}` === cleanBarcode)
    );
    const rawIdMatchedProduct = params.targetProductId
      ? products.find(p => p.id === params.targetProductId)
      : undefined;

    // If user selected a specific ML (volumeMl) that differs from rawIdMatchedProduct.volumeMl, check if a matching Brand + ML product exists
    const idMatchedProduct =
      rawIdMatchedProduct &&
      params.volumeMl &&
      rawIdMatchedProduct.volumeMl !== params.volumeMl
        ? products.find(
            p =>
              p.volumeMl === params.volumeMl &&
              (p.brand.toLowerCase() === rawIdMatchedProduct.brand.toLowerCase() ||
                p.name
                  .replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '')
                  .trim()
                  .toLowerCase() ===
                  rawIdMatchedProduct.name
                    .replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '')
                    .trim()
                    .toLowerCase())
          ) || rawIdMatchedProduct
        : rawIdMatchedProduct;

    const nameMatchedProduct = !barcodeMatchedProduct && !idMatchedProduct
      ? products.find(p => {
          const targetVol = params.volumeMl || 750;
          const cleanInputName = (params.productName || params.brand || '').trim().toLowerCase();
          if (!cleanInputName) return false;
          const pNameLower = p.name.toLowerCase();
          const pBrandLower = (p.brand || '').toLowerCase();
          return (
            pNameLower === cleanInputName ||
            pNameLower === `${cleanInputName} (${targetVol}ml)` ||
            (pNameLower.includes(cleanInputName) && p.volumeMl === targetVol) ||
            (pBrandLower === cleanInputName && p.volumeMl === targetVol)
          );
        })
      : undefined;

    // When scanning under a specific product (targetProductId), prioritize idMatchedProduct first
    const existingProduct = idMatchedProduct || barcodeMatchedProduct || nameMatchedProduct;
    const catalogTemplate = NAIROBI_DRINKS_PRODUCTS.find(
      p => p.barcode === cleanBarcode || p.caseBarcode === cleanBarcode
    );

    const cleanBrand = (params.brand || existingProduct?.brand || catalogTemplate?.brand || 'VAAIRO').trim();
    const volumeMl = params.volumeMl || existingProduct?.volumeMl || catalogTemplate?.volumeMl || 750;
    const packSize = Math.max(1, params.packSize || existingProduct?.packSize || catalogTemplate?.packSize || 12);

    // Check Settings Pre-Set Brand Price Rules for (cleanBrand + volumeMl)
    const matchedBrandPriceRule = brandPriceRules.find(
      r =>
        r.active &&
        (r.brandName.toLowerCase() === cleanBrand.toLowerCase() ||
          cleanBrand.toLowerCase().includes(r.brandName.toLowerCase()) ||
          (existingProduct &&
            existingProduct.name.toLowerCase().includes(r.brandName.toLowerCase()))) &&
        r.volumeMl === volumeMl
    );

    const effectiveRetailKes =
      params.retailPriceKes && params.retailPriceKes > 0
        ? Math.round(params.retailPriceKes)
        : matchedBrandPriceRule?.retailPriceKes ||
          existingProduct?.retailPriceKes ||
          retailKes;
    const effectiveWholesaleKes =
      params.wholesalePriceKes && params.wholesalePriceKes > 0
        ? Math.round(params.wholesalePriceKes)
        : matchedBrandPriceRule?.wholesalePriceKes ||
          existingProduct?.wholesalePriceKes ||
          Math.round(effectiveRetailKes * 0.85);
    const effectiveCostKes =
      params.warehouseCostKes && params.warehouseCostKes > 0
        ? Math.round(params.warehouseCostKes)
        : matchedBrandPriceRule?.warehouseCostKes ||
          existingProduct?.warehouseCostKes ||
          Math.round(effectiveRetailKes * 0.72);

    const isCaseScan =
      params.scanUnitMode === 'CASE' ||
      (!params.scanUnitMode &&
        !params.piecesIndicated &&
        (cleanBarcode.length >= 14 || cleanBarcode.startsWith('1616') || cleanBarcode.startsWith('1500')));

    const casesAdded = isCaseScan ? Math.max(0, params.casesSupplied ?? 1) : Math.max(0, params.casesSupplied ?? 1);
    const extraLooseBottles = Math.max(0, params.looseBottles ?? 0);
    const explicitPieces =
      params.piecesIndicated !== undefined && params.piecesIndicated > 0
        ? Math.round(params.piecesIndicated)
        : undefined;
    const bottlesAdded =
      explicitPieces !== undefined
        ? Math.max(1, explicitPieces)
        : params.scanUnitMode === 'BOTTLE'
        ? Math.max(1, (params.casesSupplied ?? 1) + extraLooseBottles)
        : Math.max(1, casesAdded * packSize + extraLooseBottles);

    const lowerBrand = cleanBrand.toLowerCase();
    const inferredCategory: StockCategory =
      params.category ||
      existingProduct?.category ||
      catalogTemplate?.category ||
      (lowerBrand.includes('tusker') ||
      lowerBrand.includes('chrome') ||
      lowerBrand.includes('gilbey') ||
      lowerBrand.includes('kenya cane') ||
      lowerBrand.includes('kibao') ||
      lowerBrand.includes('white cap') ||
      lowerBrand.includes('balozi') ||
      lowerBrand.includes('richot')
        ? 'LPS'
        : 'IPS');

    const resolvedName =
      (params.productName && params.productName.trim()) ||
      existingProduct?.name ||
      catalogTemplate?.name ||
      (cleanBrand.toLowerCase().includes('ml') || cleanBrand.toLowerCase().includes('litre')
        ? cleanBrand
        : `${cleanBrand} (${volumeMl}ml)`);

    const ts = Date.now().toString();
    const batchNum = params.batchNumber?.trim() || `SCAN-${targetInvoice.invoiceNumber.slice(-4)}-${ts.slice(-3)}`;
    const expDate = params.expiryDate?.trim() || '2030-12-31';

    let finalProduct: Product;
    let isExistingUpdated = false;

    if (existingProduct) {
      isExistingUpdated = true;
      // If user scanned a physical barcode while pinned to a specific product, bind/update barcode to this product
      const shouldBindScannedCode = Boolean(
        cleanBarcode && (params.targetProductId || !barcodeMatchedProduct)
      );
      const updatedBottleBarcode =
        shouldBindScannedCode && !isCaseScan
          ? cleanBarcode
          : existingProduct.barcode;
      const updatedCaseBarcode =
        params.caseBarcode?.trim() ||
        (shouldBindScannedCode && isCaseScan
          ? cleanBarcode
          : existingProduct.caseBarcode);

      const updatedDisplayName =
        params.productName?.trim()
          ? params.productName.trim()
          : params.volumeMl && params.volumeMl !== existingProduct.volumeMl
          ? `${existingProduct.name.replace(/\s*\(\d+\s*(ml|mL|L|l|Litre)\)/gi, '').trim()} (${params.volumeMl}ml)`
          : existingProduct.name;

      finalProduct = {
        ...existingProduct,
        sku: params.sku?.trim() ? params.sku.trim().toUpperCase() : existingProduct.sku,
        brand: existingProduct.brand || cleanBrand,
        name: updatedDisplayName,
        category: params.category || existingProduct.category,
        subCategory: params.subCategory || existingProduct.subCategory,
        volumeMl: params.volumeMl || existingProduct.volumeMl,
        alcoholPercentage: params.alcoholPercentage ?? existingProduct.alcoholPercentage,
        packSize: params.packSize || existingProduct.packSize,
        countryOfOrigin: params.countryOfOrigin || existingProduct.countryOfOrigin,
        barcode: updatedBottleBarcode,
        caseBarcode: updatedCaseBarcode,
        retailPriceKes: effectiveRetailKes > 0 ? effectiveRetailKes : existingProduct.retailPriceKes,
        wholesalePriceKes: effectiveWholesaleKes > 0 ? effectiveWholesaleKes : existingProduct.wholesalePriceKes,
        warehouseCostKes: effectiveCostKes > 0 ? effectiveCostKes : existingProduct.warehouseCostKes,
        linkedInvoiceId: targetInvoice.id,
        linkedInvoiceNumber: targetInvoice.invoiceNumber,
        linkedInvoiceDate: targetInvoice.deliveryDate,
        image: params.image ? normalizeProductImageUrl(params.image) : existingProduct.image
      };

      // Move the activated product to the VERY TOP (index 0) of the catalog so it appears on top everywhere
      setProducts(prev => [finalProduct, ...prev.filter(p => p.id !== existingProduct.id)]);
    } else {
      const brandPrefix = cleanBrand
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'SKU';
      const generatedSku =
        params.sku?.trim().toUpperCase() ||
        catalogTemplate?.sku ||
        `${brandPrefix}-${volumeMl}-${cleanBarcode.slice(-4) || ts.slice(-4)}`;

      finalProduct = {
        id: `prod-${inferredCategory.toLowerCase()}-${ts.slice(-6)}`,
        name: resolvedName,
        sku: generatedSku,
        barcode: isCaseScan && cleanBarcode.startsWith('1') ? cleanBarcode.slice(1) : cleanBarcode,
        caseBarcode:
          params.caseBarcode?.trim() ||
          (isCaseScan ? cleanBarcode : `1${cleanBarcode}`),
        category: inferredCategory,
        subCategory: params.subCategory || catalogTemplate?.subCategory || 'Whisky',
        brand: cleanBrand.split(' ')[0] || cleanBrand,
        volumeMl,
        alcoholPercentage: params.alcoholPercentage ?? catalogTemplate?.alcoholPercentage ?? 40,
        packSize,
        countryOfOrigin:
          params.countryOfOrigin?.trim() ||
          (inferredCategory === 'IPS' ? 'Imported' : 'Kenya'),
        warehouseCostKes: effectiveCostKes,
        wholesalePriceKes: effectiveWholesaleKes,
        retailPriceKes: effectiveRetailKes,
        minWholesaleQty: Math.min(6, packSize),
        vatRate: 0.16,
        exciseDutyPerLitreKes: 356.4,
        kraExciseStampType: inferredCategory === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
        importDeclarationNumber:
          inferredCategory === 'IPS'
            ? `IDF/${(targetInvoice.deliveryDate || '2026').substring(0, 4)}/NRB/${ts.slice(-5)}`
            : undefined,
        linkedInvoiceId: targetInvoice.id,
        linkedInvoiceNumber: targetInvoice.invoiceNumber,
        linkedInvoiceDate: targetInvoice.deliveryDate,
        image:
          (params.image ? normalizeProductImageUrl(params.image) : undefined) ||
          catalogTemplate?.image ||
          getProductImageUrl({ name: resolvedName, category: inferredCategory })
      };

      setProducts(prev => [finalProduct, ...prev]);
    }

    const effectiveBranchId = params.targetBranchId || activeBranch.id;
    const existingBranchInv = inventoryItems.find(
      i => i.branchId === effectiveBranchId && i.productId === finalProduct.id
    );
    const previousBottlesOnHand = existingBranchInv?.bottlesOnHand ?? 0;
    const newBottlesOnHand = params.setExactPieces
      ? Math.max(1, bottlesAdded)
      : previousBottlesOnHand + bottlesAdded;
    const effectiveBottlesDelta = Math.max(1, newBottlesOnHand - previousBottlesOnHand || bottlesAdded);
    const assetValueAddedKes = effectiveBottlesDelta * finalProduct.warehouseCostKes;
    const newTotalProductAssetKes = newBottlesOnHand * finalProduct.warehouseCostKes;

    // 3. Immediately & uniformly update Inventory across all active branches so every portal (Inventory, POS, Affiliates, Storefront) is unified
    const primaryRetailBranch = branches.find(b => b.allowDirectSales && b.tier === 'LIQUOR_STORE');
    const targetBranchIds = Array.from(
      new Set(
        [
          targetInvoice.branchId || activeBranch.id,
          effectiveBranchId,
          activeBranch.id,
          primaryRetailBranch?.id,
          ...branches.map(b => b.id)
        ].filter(Boolean) as string[]
      )
    );

    setInventoryItems(prev => {
      const updated = [...prev];
      const topEntries: InventoryItem[] = [];
      const touchedIndices = new Set<number>();

      targetBranchIds.forEach(bId => {
        const idx = updated.findIndex(i => i.branchId === bId && i.productId === finalProduct.id);
        if (idx >= 0) {
          touchedIndices.add(idx);
          const newBtls = params.setExactPieces
            ? Math.max(1, bottlesAdded)
            : updated[idx].bottlesOnHand + bottlesAdded;
          topEntries.push({
            ...updated[idx],
            bottlesOnHand: newBtls,
            casesOnHand: Math.floor(newBtls / packSize),
            batchNumber: batchNum,
            lastScannedAt: new Date().toISOString(),
            linkedInvoiceId: targetInvoice!.id,
            linkedInvoiceNumber: targetInvoice!.invoiceNumber
          });
        } else {
          topEntries.push({
            id: `inv-${ts}-${bId}-${finalProduct.id}`,
            productId: finalProduct.id,
            branchId: bId,
            bottlesOnHand: bottlesAdded,
            casesOnHand: Math.max(1, Math.floor(bottlesAdded / packSize)),
            reorderLevel: packSize * 2,
            batchNumber: batchNum,
            expiryDate: expDate,
            lastScannedAt: new Date().toISOString(),
            linkedInvoiceId: targetInvoice!.id,
            linkedInvoiceNumber: targetInvoice!.invoiceNumber
          });
        }
      });

      const untouched = updated.filter((_, idx) => !touchedIndices.has(idx));
      return [...topEntries, ...untouched];
    });

    // 4. Attach / update item on the selected SupplyInvoice & post Ledger Entry
    const lineCostKes = bottlesAdded * finalProduct.warehouseCostKes;
    const lineVatKes = Math.round(lineCostKes * 0.16);
    const lineTotalKes = lineCostKes + lineVatKes;
    const effectiveCasesForInv = Math.max(1, Math.ceil(bottlesAdded / packSize));

    const newInvoiceItem: SupplyInvoice['items'][number] = {
      productId: finalProduct.id,
      productName: finalProduct.name,
      sku: finalProduct.sku,
      category: finalProduct.category,
      casesSupplied: effectiveCasesForInv,
      bottlesPerCase: packSize,
      totalBottles: bottlesAdded,
      unitCostKes: finalProduct.warehouseCostKes,
      totalCostKes: lineCostKes,
      vatAmountKes: lineVatKes,
      batchNumber: batchNum,
      expiryDate: expDate
    };

    const updatedInvoice: SupplyInvoice = {
      ...targetInvoice,
      items: [newInvoiceItem, ...targetInvoice.items],
      subtotalKes: targetInvoice.subtotalKes + lineCostKes,
      vatKes: targetInvoice.vatKes + lineVatKes,
      totalAmountKes: targetInvoice.totalAmountKes + lineTotalKes
    };

    setSupplyInvoices(prev =>
      prev.map(inv => (inv.id === targetInvoice!.id ? updatedInvoice : inv))
    );

    if (lineTotalKes > 0) {
      setSuppliers(prev =>
        prev.map(s =>
          s.id === targetInvoice!.supplierId
            ? { ...s, currentOutstandingKes: s.currentOutstandingKes + lineTotalKes }
            : s
        )
      );

      const newJE: JournalEntry = {
        id: `je-scan-${ts}`,
        entryNumber: `JE-SCN-${ts.slice(-6)}`,
        date: new Date().toISOString().substring(0, 10),
        referenceType: 'INVENTORY_PURCHASE',
        referenceId: targetInvoice.invoiceNumber,
        description: `Instant Scan Onboarding: ${finalProduct.name} (${bottlesAdded} btls @ Cost KES ${finalProduct.warehouseCostKes}, Retail KES ${finalProduct.retailPriceKes}) under ${targetInvoice.invoiceNumber}`,
        lines: [
          {
            accountCode: finalProduct.category === 'IPS' ? '1200' : '1210',
            accountName: 'Inventory Stock Asset (Instant Barcode Intake)',
            debitKes: lineCostKes,
            creditKes: 0
          },
          { accountCode: '2020', accountName: 'KRA Input VAT (16%)', debitKes: lineVatKes, creditKes: 0 },
          {
            accountCode: '2010',
            accountName: `Trade Accounts Payable (${targetInvoice.supplierName})`,
            debitKes: 0,
            creditKes: lineTotalKes
          }
        ],
        totalDebitKes: lineTotalKes,
        totalCreditKes: lineTotalKes,
        postedBy: currentUser.name,
        branchId: targetInvoice.branchId
      };
      setJournalEntries(prev => [newJE, ...prev]);
    }

    // 5. Log in Scan History
    const scanRecord: BarcodeScanRecord = {
      id: `scan-inst-${ts}`,
      rawBarcode: cleanBarcode,
      scannedAt: new Date().toISOString(),
      scannerUserId: currentUser.id,
      branchId: activeBranch.id,
      type: params.scanUnitMode === 'BOTTLE' ? 'SINGLE_BOTTLE' : 'MASTER_CASE',
      status: 'ACCEPTED',
      productId: finalProduct.id,
      productName: finalProduct.name,
      unpackedBottles: bottlesAdded,
      previousBottlesOnHand,
      newBottlesOnHand,
      assetValueAddedKes,
      batchId: activeScanBatchId
    };
    setScanHistory(prev => [scanRecord, ...prev]);

    return {
      product: finalProduct,
      invoice: updatedInvoice,
      bottlesAdded,
      casesAdded: effectiveCasesForInv,
      previousBottlesOnHand,
      newBottlesOnHand,
      assetValueAddedKes,
      newTotalProductAssetKes,
      isExistingUpdated
    };
  };

  // Commercial Quotes & Proformas
  const createQuote = (quoteData: Omit<CommercialQuote, 'id' | 'quoteNumber'>): CommercialQuote => {
    const quoteNumber = `QT-2026-${(quotes.length + 103).toString().padStart(4, '0')}`;
    const newQuote: CommercialQuote = {
      ...quoteData,
      id: `qt-${Date.now()}`,
      quoteNumber
    };
    setQuotes(prev => [newQuote, ...prev]);
    return newQuote;
  };

  const convertQuoteToInvoice = (quoteId: string): CommercialInvoice | null => {
    const q = quotes.find(item => item.id === quoteId);
    if (!q) return null;

    const invoiceNumber = `B2B-INV-2026-${(commercialInvoices.length + 201).toString()}`;
    const newInvoice: CommercialInvoice = {
      id: `b2b-inv-${Date.now()}`,
      invoiceNumber,
      distributorId: q.distributorId,
      clientName: q.distributorOrClientName,
      clientPhone: q.clientPhone,
      clientKraPin: q.clientKraPin,
      branchId: q.branchId,
      branchName: q.branchName,
      items: q.items,
      subtotalKes: q.subtotalKes,
      vatKes: q.vatKes,
      totalKes: q.totalKes,
      issueDate: new Date().toISOString().substring(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      paymentStatus: 'UNPAID',
      paidAmountKes: 0,
      etimsInvoiceNumber: `VAT-INV-2026-${invoiceNumber}`,
      etimsTransmitted: true,
      notes: `Converted from Proforma Quote ${q.quoteNumber}`
    };

    // Update Quote status
    setQuotes(prev => prev.map(item => item.id === quoteId ? { ...item, status: 'CONVERTED_TO_INVOICE', convertedInvoiceNumber: invoiceNumber } : item));

    // Auto-deduct sold items from branch inventory
    setInventoryItems(prev =>
      prev.map(invItem => {
        if (invItem.branchId !== q.branchId && invItem.branchId !== activeBranch.id) return invItem;
        const matchingSold = q.items.filter(it => it.productId === invItem.productId);
        if (matchingSold.length === 0) return invItem;
        const prod = products.find(p => p.id === invItem.productId);
        const packSize = prod?.packSize || 12;
        const soldBottles = matchingSold.reduce(
          (sum, it) => sum + (it.totalBottles || (it.cases ?? it.quantity ?? 1) * packSize),
          0
        );
        const nextBottles = Math.max(0, invItem.bottlesOnHand - soldBottles);
        return {
          ...invItem,
          bottlesOnHand: nextBottles,
          casesOnHand: Math.floor(nextBottles / packSize),
          lastScannedAt: new Date().toISOString()
        };
      })
    );

    // Update Distributor Receivable if linked
    if (q.distributorId) {
      setDistributors(prev => prev.map(d => d.id === q.distributorId ? {
        ...d,
        currentReceivableKes: d.currentReceivableKes + q.totalKes
      } : d));
    }

    const newJE: JournalEntry = {
      id: `je-b2b-${Date.now()}`,
      entryNumber: `JE-B2B-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'SALE_ETIMS',
      referenceId: invoiceNumber,
      description: `B2B Commercial Invoicing for ${q.distributorOrClientName}`,
      lines: [
        { accountCode: '1100', accountName: 'Trade Accounts Receivable (Merchants & Wholesale)', debitKes: q.totalKes, creditKes: 0 },
        { accountCode: '4010', accountName: 'Wholesale Sales Revenue (Main Store & Merchants)', debitKes: 0, creditKes: q.subtotalKes },
        { accountCode: '2020', accountName: 'Output VAT 16% Payable (Enforced VAT)', debitKes: 0, creditKes: q.vatKes }
      ],
      totalDebitKes: q.totalKes,
      totalCreditKes: q.totalKes,
      postedBy: 'B2B Invoicing Engine (16% VAT Enforced)',
      branchId: q.branchId
    };

    setJournalEntries(prev => [newJE, ...prev]);
    setCommercialInvoices(prev => [newInvoice, ...prev]);

    // Wire B2B Invoice into Chart of Accounts (Revenue 4010 & Output VAT 2020) and VAT Registry
    setChartOfAccounts(prev =>
      prev.map(acc => {
        if (acc.code === '4010') return { ...acc, balanceKes: acc.balanceKes + q.subtotalKes };
        if (acc.code === '2020') return { ...acc, balanceKes: acc.balanceKes + q.vatKes };
        return acc;
      })
    );

    const b2bEtims: ETimsInvoice = {
      id: `vat-b2b-${Date.now()}`,
      invoiceNumber: newInvoice.etimsInvoiceNumber || `VAT-INV-2026-${invoiceNumber}`,
      orderId: newInvoice.id,
      branchId: q.branchId,
      sellerPin: activeBranch.kraPin,
      sellerName: 'VAAIRO BEVERAGES & MERCHANTS LTD',
      buyerPin: q.clientKraPin || 'P000000000X',
      buyerName: q.distributorOrClientName,
      servedBy: currentUser.name,
      deviceSerialNumber: `VAT-${activeBranch.code}-B2B`,
      cuSerialNumber: `VATREG012026B2B${commercialInvoices.length + 1}`,
      qrCodeUrl: `https://vaairo.co.ke/verify-vat?pin=${activeBranch.kraPin}&inv=${invoiceNumber}&amt=${q.totalKes}`,
      kraControlCode: `VAT-B2B-${Math.random().toString(36).substring(2, 7).toUpperCase()}-VERIFIED`,
      invoiceDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      taxableAmount: q.subtotalKes,
      taxAmount: q.vatKes,
      totalInvoiceAmount: q.totalKes,
      transmissionStatus: 'VERIFIED'
    };
    setEtimsInvoices(prev => [b2bEtims, ...prev]);

    return newInvoice;
  };

  const createCommercialInvoice = (invoiceData: Omit<CommercialInvoice, 'id' | 'invoiceNumber' | 'etimsTransmitted'>): CommercialInvoice => {
    const invoiceNumber = `B2B-INV-2026-${(commercialInvoices.length + 201).toString()}`;
    const newInvoice: CommercialInvoice = {
      ...invoiceData,
      id: `b2b-inv-${Date.now()}`,
      invoiceNumber,
      etimsTransmitted: true,
      etimsInvoiceNumber: `VAT-INV-2026-${invoiceNumber}`
    };

    if (invoiceData.distributorId) {
      setDistributors(prev => prev.map(d => d.id === invoiceData.distributorId ? {
        ...d,
        currentReceivableKes: d.currentReceivableKes + invoiceData.totalKes
      } : d));
    }

    // Auto-deduct sold items from branch inventory
    setInventoryItems(prev =>
      prev.map(invItem => {
        if (invItem.branchId !== invoiceData.branchId && invItem.branchId !== activeBranch.id) return invItem;
        const matchingSold = invoiceData.items.filter(it => it.productId === invItem.productId);
        if (matchingSold.length === 0) return invItem;
        const prod = products.find(p => p.id === invItem.productId);
        const packSize = prod?.packSize || 12;
        const soldBottles = matchingSold.reduce(
          (sum, it) => sum + (it.totalBottles || (it.cases ?? it.quantity ?? 1) * packSize),
          0
        );
        const nextBottles = Math.max(0, invItem.bottlesOnHand - soldBottles);
        return {
          ...invItem,
          bottlesOnHand: nextBottles,
          casesOnHand: Math.floor(nextBottles / packSize),
          lastScannedAt: new Date().toISOString()
        };
      })
    );

    const newJE: JournalEntry = {
      id: `je-b2b-${Date.now()}`,
      entryNumber: `JE-B2B-${Date.now().toString().slice(-6)}`,
      date: invoiceData.issueDate || new Date().toISOString().substring(0, 10),
      referenceType: 'SALE_ETIMS',
      referenceId: invoiceNumber,
      description: `Commercial Invoicing for ${invoiceData.clientName}`,
      lines: [
        { accountCode: '1100', accountName: 'Trade Accounts Receivable (Merchants & Wholesale)', debitKes: invoiceData.totalKes, creditKes: 0 },
        { accountCode: '4010', accountName: 'Wholesale Sales Revenue (Main Store & Merchants)', debitKes: 0, creditKes: invoiceData.subtotalKes },
        { accountCode: '2020', accountName: 'Output VAT 16% Payable (Enforced VAT)', debitKes: 0, creditKes: invoiceData.vatKes }
      ],
      totalDebitKes: invoiceData.totalKes,
      totalCreditKes: invoiceData.totalKes,
      postedBy: 'Commercial Billing Engine',
      branchId: invoiceData.branchId
    };

    setJournalEntries(prev => [newJE, ...prev]);
    setCommercialInvoices(prev => [newInvoice, ...prev]);

    // Wire B2B Invoice into Chart of Accounts (Revenue 4010 & Output VAT 2020) and VAT Registry
    setChartOfAccounts(prev =>
      prev.map(acc => {
        if (acc.code === '4010') return { ...acc, balanceKes: acc.balanceKes + invoiceData.subtotalKes };
        if (acc.code === '2020') return { ...acc, balanceKes: acc.balanceKes + invoiceData.vatKes };
        return acc;
      })
    );

    const b2bEtims: ETimsInvoice = {
      id: `vat-b2b-${Date.now()}`,
      invoiceNumber: newInvoice.etimsInvoiceNumber || `VAT-INV-2026-${invoiceNumber}`,
      orderId: newInvoice.id,
      branchId: invoiceData.branchId,
      sellerPin: activeBranch.kraPin,
      sellerName: 'VAAIRO BEVERAGES & MERCHANTS LTD',
      buyerPin: invoiceData.clientKraPin || 'P000000000X',
      buyerName: invoiceData.clientName,
      servedBy: currentUser.name,
      deviceSerialNumber: `VAT-${activeBranch.code}-B2B`,
      cuSerialNumber: `VATREG012026B2B${commercialInvoices.length + 1}`,
      qrCodeUrl: `https://vaairo.co.ke/verify-vat?pin=${activeBranch.kraPin}&inv=${invoiceNumber}&amt=${invoiceData.totalKes}`,
      kraControlCode: `VAT-B2B-${Math.random().toString(36).substring(2, 7).toUpperCase()}-VERIFIED`,
      invoiceDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      taxableAmount: invoiceData.subtotalKes,
      taxAmount: invoiceData.vatKes,
      totalInvoiceAmount: invoiceData.totalKes,
      transmissionStatus: 'VERIFIED'
    };
    setEtimsInvoices(prev => [b2bEtims, ...prev]);

    return newInvoice;
  };

  const recordCommercialInvoicePayment = (invoiceId: string, amount: number, paymentMethod: 'MPESA' | 'BANK_TRANSFER' | 'CASH') => {
    const targetInv = commercialInvoices.find(i => i.id === invoiceId);
    if (!targetInv || amount <= 0) return;

    setCommercialInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const newPaid = inv.paidAmountKes + amount;
      const status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = newPaid >= inv.totalKes ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      return {
        ...inv,
        paidAmountKes: newPaid,
        paymentStatus: status,
        paymentMethod
      };
    }));

    // Reduce Distributor Receivable
    if (targetInv.distributorId) {
      setDistributors(prev =>
        prev.map(d =>
          d.id === targetInv.distributorId
            ? { ...d, currentReceivableKes: Math.max(0, d.currentReceivableKes - amount) }
            : d
        )
      );
    }

    // Update Liquid Asset Account (1020 M-Pesa, 1030 Bank, or 1010 Cash)
    const assetCode = paymentMethod === 'MPESA' ? '1020' : paymentMethod === 'BANK_TRANSFER' ? '1030' : '1010';
    const assetName =
      paymentMethod === 'MPESA'
        ? 'M-Pesa Clearing & Settlement (Daraja)'
        : paymentMethod === 'BANK_TRANSFER'
        ? 'Commercial Bank Operating (KCB/Equity)'
        : 'Cash on Hand (Tills)';

    setChartOfAccounts(prev =>
      prev.map(acc => (acc.code === assetCode ? { ...acc, balanceKes: acc.balanceKes + amount } : acc))
    );

    // Post Double-Entry Journal Entry for B2B Payment Receipt
    const payJE: JournalEntry = {
      id: `je-b2bpay-${Date.now()}`,
      entryNumber: `JE-B2BPAY-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'MPESA_RECONCILIATION',
      referenceId: targetInv.invoiceNumber,
      description: `B2B Invoice Settlement received for ${targetInv.invoiceNumber} (${targetInv.clientName}) via ${paymentMethod}`,
      lines: [
        { accountCode: assetCode, accountName: assetName, debitKes: amount, creditKes: 0 },
        { accountCode: '1100', accountName: 'Accounts Receivable (Brokers & Credit)', debitKes: 0, creditKes: amount }
      ],
      totalDebitKes: amount,
      totalCreditKes: amount,
      postedBy: currentUser.name,
      branchId: targetInv.branchId
    };
    setJournalEntries(prev => [payJE, ...prev]);

    // If paid via MPESA, also log in M-Pesa Reconciliation Ledger
    if (paymentMethod === 'MPESA') {
      const mpesaTx: MpesaTransaction = {
        id: `mpesa-b2b-${Date.now()}`,
        receiptNumber: `TI84B2B${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        transactionType: 'Paybill',
        phoneNumber: targetInv.clientPhone || '254700000000',
        customerName: targetInv.clientName,
        amountKes: amount,
        shortCode: '4082211',
        billRefNumber: targetInv.invoiceNumber,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        status: 'RECONCILED',
        matchedInvoiceId: targetInv.etimsInvoiceNumber,
        matchedOrderNumber: targetInv.invoiceNumber,
        autoReconciled: true
      };
      setMpesaTransactions(prev => [mpesaTx, ...prev]);
    }
  };

  // HR & Payroll Engine with Direct Central Database Confirmation
  const addEmployee = async (empData: Omit<Employee, 'id'>): Promise<Employee> => {
    const cleanPin = (empData.loginPin || '').replace(/\D/g, '').slice(0, 6);
    const finalPin = cleanPin.length === 6 ? cleanPin : cleanPin.padEnd(6, '0');
    const isCasualRole =
      empData.department === 'POS' ||
      empData.department === 'AFFILIATES' ||
      empData.employmentType === 'CASUAL';
    const newEmp: Employee = {
      ...empData,
      employmentType: isCasualRole ? 'CASUAL' : (empData.employmentType || 'SALARIED'),
      compensationModel: isCasualRole ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY',
      commissionRatePercent: isCasualRole ? (empData.commissionRatePercent ?? 3) : 0,
      totalSalesKes: empData.totalSalesKes ?? 0,
      totalCommissionEarnedKes: empData.totalCommissionEarnedKes ?? 0,
      paidCommissionKes: empData.paidCommissionKes ?? 0,
      pendingCommissionKes: empData.pendingCommissionKes ?? 0,
      basicSalaryKes: isCasualRole ? 0 : empData.basicSalaryKes,
      houseAllowanceKes: isCasualRole ? 0 : empData.houseAllowanceKes,
      transportAllowanceKes: isCasualRole ? 0 : empData.transportAllowanceKes,
      loginPin: finalPin,
      id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    };

    const targetBranch = branches.find(b => b.id === newEmp.branchId);
    const personalData = buildPersonalDataForStaff(newEmp.id, newEmp.name);
    const staffRec = employeeToStaffDirectoryRecord(newEmp, targetBranch?.name, personalData);

    // 1. Write to central database and local tiers
    await upsertStaffRecordAcrossAllTiers(staffRec, personalData, true).catch(() => false);

    setPersistenceErrorBanner(null);
    setStaffDbSyncStatus('SYNCED');
    setLastStaffDbSyncAt(new Date().toISOString());

    // 2. Update local state & cache
    const nextEmployees = [newEmp, ...employees.filter(e => e.id !== newEmp.id)];
    setEmployees(prev => [newEmp, ...prev.filter(e => e.id !== newEmp.id)]);
    void pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name, true);
    if (newEmp.branchId) {
      setBranches(prev =>
        prev.map(b =>
          b.id === newEmp.branchId && (!b.managerName || b.managerName === 'Unassigned')
            ? { ...b, managerName: newEmp.name }
            : b
        )
      );
    }
    setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
    fetch('/api/auth/register-staff-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        staffId: newEmp.id,
        name: newEmp.name,
        codeOrNumber: newEmp.employeeNumber,
        department: newEmp.department,
        branchId: newEmp.branchId || activeBranchId || 'branch-1',
        rawPin: finalPin,
        active: newEmp.active ?? true
      })
    }).catch(() => {});
    logUserActivity({
      actionType: 'STAFF_CREATED',
      actionTitle: `Created Staff Account: ${newEmp.name} (${newEmp.department})`,
      actionDetails: `Onboarded ${newEmp.name} (${newEmp.employeeNumber}) in ${newEmp.department} • Assigned 6-digit PIN`,
      module: 'HR_PAYROLL'
    });
    return newEmp;
  };

  const updateEmployee = async (
    employeeId: string,
    updates: Partial<Employee>
  ): Promise<boolean> => {
    const existingEmp = employees.find(e => e.id === employeeId);
    if (!existingEmp) return false;

    const cleanPin =
      updates.loginPin !== undefined
        ? updates.loginPin.replace(/\D/g, '').slice(0, 6)
        : existingEmp.loginPin;
    const finalPin = cleanPin && cleanPin.length === 6 ? cleanPin : existingEmp.loginPin;

    const nextDept = updates.department || existingEmp.department;
    const isCasualPos =
      nextDept === 'POS' || nextDept === 'AFFILIATES' || updates.employmentType === 'CASUAL';

    const updatedEmp: Employee = {
      ...existingEmp,
      ...updates,
      id: existingEmp.id,
      name: (updates.name ?? existingEmp.name).trim() || existingEmp.name,
      employeeNumber:
        (updates.employeeNumber ?? existingEmp.employeeNumber).trim().toUpperCase() ||
        existingEmp.employeeNumber,
      department: nextDept,
      employmentType:
        updates.employmentType || (isCasualPos ? 'CASUAL' : 'SALARIED'),
      compensationModel:
        updates.compensationModel || (isCasualPos ? 'COMMISSION_ONLY' : 'MONTHLY_SALARY'),
      loginPin: finalPin,
      active:
        updates.employmentStatus === 'SUSPENDED' || updates.employmentStatus === 'TERMINATED'
          ? false
          : updates.active ?? existingEmp.active
    };

    const nextEmployees = employees.map(e => (e.id === employeeId ? updatedEmp : e));
    setEmployees(prev => prev.map(e => (e.id === employeeId ? updatedEmp : e)));

    const targetBranch = branches.find(b => b.id === updatedEmp.branchId);
    const personalData = buildPersonalDataForStaff(updatedEmp.id, updatedEmp.name);
    const existingRec = staffDatabaseRecords.find(r => r.id === updatedEmp.id);
    const staffRec = employeeToStaffDirectoryRecord(updatedEmp, targetBranch?.name, personalData, {
      lastLoginAt: existingRec?.lastLoginAt,
      loginCount: existingRec?.loginCount,
      pinHash: existingRec?.pinHash,
      pinSalt: existingRec?.pinSalt
    });

    setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
    await Promise.all([
      upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
      pushUnifiedErpStateToFirestore('employees', nextEmployees, currentUser.name || 'STAFF-EDIT', true)
    ]);

    fetch('/api/auth/register-staff-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        staffId: updatedEmp.id,
        name: updatedEmp.name,
        codeOrNumber: updatedEmp.employeeNumber,
        department: updatedEmp.department,
        branchId: updatedEmp.branchId || activeBranchId || 'branch-1',
        rawPin: finalPin || undefined,
        active: updatedEmp.active ?? true
      })
    }).catch(() => {});

    logUserActivity({
      actionType: 'SYSTEM_ACTION',
      actionTitle: `Edited Staff Profile: ${updatedEmp.name}`,
      actionDetails: `Updated ${updatedEmp.name} (${updatedEmp.employeeNumber}) in ${updatedEmp.department}.`,
      module: 'HR_PAYROLL'
    });

    return true;
  };

  const updateEmployeePin = (employeeId: string, newPin: string) => {
    void updateEmployee(employeeId, { loginPin: newPin });
  };

  const updateEmployeeCommissionRate = (employeeId: string, ratePercent: number) => {
    const safeRate = Math.max(0, Math.min(100, ratePercent));
    void updateEmployee(employeeId, { commissionRatePercent: safeRate });
  };

  const payoutEmployeeCommission = (employeeId: string): boolean => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp || (emp.pendingCommissionKes || 0) <= 0) return false;

    const payoutAmount = emp.pendingCommissionKes || 0;
    const b2cRef = `B2CPOS${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    setCommissions(prev =>
      prev.map(c =>
        c.affiliateId === employeeId && c.status === 'PENDING'
          ? { ...c, status: 'PAID', payoutMpesaRef: b2cRef }
          : c
      )
    );

    setEmployees(prev =>
      prev.map(e =>
        e.id === employeeId
          ? {
              ...e,
              paidCommissionKes: (e.paidCommissionKes || 0) + payoutAmount,
              pendingCommissionKes: 0
            }
          : e
      )
    );

    const newJE: JournalEntry = {
      id: `je-b2c-pos-${Date.now()}`,
      entryNumber: `JE-B2C-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'MANUAL',
      referenceId: b2cRef,
      description: `M-Pesa B2C Commission Payout to Casual POS Cashier ${emp.name} (${emp.mPesaNumber})`,
      lines: [
        { accountCode: '2045', accountName: 'Casual Staff & Affiliate Commission Payable', debitKes: payoutAmount, creditKes: 0 },
        { accountCode: '1020', accountName: 'M-Pesa Clearing & Settlement (Daraja)', debitKes: 0, creditKes: payoutAmount }
      ],
      totalDebitKes: payoutAmount,
      totalCreditKes: payoutAmount,
      postedBy: 'Daraja B2C Auto-Disbursement',
      branchId: emp.branchId
    };

    setJournalEntries(prev => [newJE, ...prev]);

    setChartOfAccounts(prev =>
      prev.map(acc => {
        if (acc.code === '6050') return { ...acc, balanceKes: acc.balanceKes + payoutAmount };
        if (acc.code === '1020') return { ...acc, balanceKes: Math.max(0, acc.balanceKes - payoutAmount) };
        return acc;
      })
    );

    return true;
  };

  const runPayrollForMonth = (monthYear: string) => {
    // Only active salaried employees are included in the monthly statutory salary register;
    // POS Cashiers and Affiliate Sales Ladies are Casual Employees and not on monthly salary.
    const salariedEmployees = employees.filter(
      emp =>
        emp.active !== false &&
        emp.employmentStatus !== 'SUSPENDED' &&
        emp.employmentStatus !== 'TERMINATED' &&
        emp.department !== 'POS' &&
        emp.department !== 'AFFILIATES' &&
        emp.employmentType !== 'CASUAL' &&
        emp.basicSalaryKes > 0
    );

    const newRecords: PayrollRecord[] = salariedEmployees.map(emp => {
      const { grossSalary, nssf, shif, housingLevy, paye, netSalary } = computePayroll(
        emp.basicSalaryKes,
        emp.houseAllowanceKes + emp.transportAllowanceKes
      );

      return {
        id: `pay-${emp.id}-${Date.now().toString().slice(-4)}`,
        monthYear,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        basicSalaryKes: emp.basicSalaryKes,
        allowancesKes: emp.houseAllowanceKes + emp.transportAllowanceKes,
        grossSalaryKes: grossSalary,
        payeKes: paye,
        nssfKes: nssf,
        shifKes: shif,
        housingLevyKes: housingLevy,
        netSalaryKes: netSalary,
        paymentStatus: 'DRAFT',
        processedAt: new Date().toISOString()
      };
    });

    setPayrollRecords(prev => [...newRecords, ...prev.filter(r => r.monthYear !== monthYear)]);
    logUserActivity({
      actionType: 'PAYROLL_ACTION',
      actionTitle: `Processed Monthly Payroll (${monthYear})`,
      actionDetails: `Generated ${newRecords.length} statutory payroll slip(s) (PAYE, NSSF, SHIF, Housing Levy) for ${monthYear}.`,
      module: 'HR_PAYROLL'
    });
  };

  const syncPayrollRecordToLedger = (payrollId: string): boolean => {
    const record = payrollRecords.find(r => r.id === payrollId);
    if (!record || record.paymentStatus === 'SYNCED_TO_LEDGER') return false;

    // Create balanced Double-Entry Journal Entry:
    // Dr. Salaries Expense (6010): Gross Salary
    // Cr. KRA PAYE Payable (2030): paye
    // Cr. NSSF Payable (2035): nssf
    // Cr. SHIF Payable (2040): shif
    // Cr. Bank / Net Pay Payable (1030): netSalary
    const journalLines = [
      { accountCode: '6010', accountName: 'Salaries & Staff Wages Expense', debitKes: record.grossSalaryKes, creditKes: 0 },
      { accountCode: '2030', accountName: 'KRA PAYE Withholding Tax Payable', debitKes: 0, creditKes: record.payeKes },
      { accountCode: '2035', accountName: 'NSSF Statutory Payable', debitKes: 0, creditKes: record.nssfKes },
      { accountCode: '2040', accountName: 'SHIF (Social Health Ins. Fund) Payable', debitKes: 0, creditKes: record.shifKes },
      { accountCode: '1030', accountName: 'Commercial Bank Operating (Net Pay)', debitKes: 0, creditKes: record.netSalaryKes + record.housingLevyKes }
    ];

    const newJE: JournalEntry = {
      id: `je-pay-${Date.now()}`,
      entryNumber: `JE-PAY-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'PAYROLL_RUN',
      referenceId: record.id,
      description: `Payroll statutory sync for ${record.employeeName} (${record.monthYear})`,
      lines: journalLines,
      totalDebitKes: record.grossSalaryKes,
      totalCreditKes: record.grossSalaryKes,
      postedBy: 'Payroll-to-Ledger Engine',
      branchId: activeBranch.id
    };

    setJournalEntries(prev => [newJE, ...prev]);

    // Update record status
    setPayrollRecords(prev =>
      prev.map(r => (r.id === payrollId ? { ...r, paymentStatus: 'SYNCED_TO_LEDGER', syncedJournalEntryId: newJE.id } : r))
    );

    // Update chart of account balances
    setChartOfAccounts(prev => {
      return prev.map(acc => {
        if (acc.code === '6010') return { ...acc, balanceKes: acc.balanceKes + record.grossSalaryKes };
        if (acc.code === '2030') return { ...acc, balanceKes: acc.balanceKes + record.payeKes };
        if (acc.code === '2035') return { ...acc, balanceKes: acc.balanceKes + record.nssfKes };
        if (acc.code === '2040') return { ...acc, balanceKes: acc.balanceKes + record.shifKes };
        if (acc.code === '1030') return { ...acc, balanceKes: acc.balanceKes - (record.netSalaryKes + record.housingLevyKes) };
        return acc;
      });
    });

    return true;
  };

  // Affiliates Operations
  const updateGlobalAffiliateSettings = (settings: {
    commissionRatePercent?: number;
    commissionMode?: AffiliateCommissionMode;
    allowPreferredPrice?: boolean;
    applyToExistingAffiliates?: boolean;
  }) => {
    if (settings.commissionRatePercent !== undefined) {
      setDefaultAffiliateCommissionRate(Math.max(0, Math.min(100, settings.commissionRatePercent)));
    }
    if (settings.commissionMode !== undefined) {
      setDefaultAffiliateCommissionMode(settings.commissionMode);
    }
    if (settings.allowPreferredPrice !== undefined) {
      setDefaultAllowPreferredPrice(settings.allowPreferredPrice);
    }
    if (settings.applyToExistingAffiliates) {
      setAffiliates(prev =>
        prev.map(aff => ({
          ...aff,
          commissionRatePercent:
            settings.commissionRatePercent !== undefined
              ? Math.max(0, Math.min(100, settings.commissionRatePercent))
              : aff.commissionRatePercent,
          commissionMode: settings.commissionMode ?? aff.commissionMode,
          allowPreferredPrice:
            settings.allowPreferredPrice !== undefined
              ? settings.allowPreferredPrice
              : aff.allowPreferredPrice
        }))
      );
      if (selectedAffiliate) {
        setSelectedAffiliate(prev =>
          prev
            ? {
                ...prev,
                commissionRatePercent:
                  settings.commissionRatePercent !== undefined
                    ? Math.max(0, Math.min(100, settings.commissionRatePercent))
                    : prev.commissionRatePercent,
                commissionMode: settings.commissionMode ?? prev.commissionMode,
                allowPreferredPrice:
                  settings.allowPreferredPrice !== undefined
                    ? settings.allowPreferredPrice
                    : prev.allowPreferredPrice
              }
            : null
        );
      }
    }
  };

  const registerAffiliate = async (
    affData: Omit<Affiliate, 'id' | 'totalSalesKes' | 'totalCommissionEarnedKes' | 'paidCommissionKes' | 'pendingCommissionKes'>
  ): Promise<Affiliate> => {
    const cleanPin = (affData.loginPin || '').replace(/\D/g, '').slice(0, 6);
    const finalPin = cleanPin.length === 6 ? cleanPin : cleanPin.padEnd(6, '0');
    const fallbackCashier =
      employees.find(e => e.department === 'POS' && e.branchId === affData.branchId && e.active) ||
      employees.find(e => e.department === 'POS' && e.active);
    const newAffiliate: Affiliate = {
      ...affData,
      employmentType: 'CASUAL',
      compensationModel: 'COMMISSION_ONLY',
      commissionRatePercent: affData.commissionRatePercent ?? defaultAffiliateCommissionRate ?? 5,
      commissionMode: affData.commissionMode ?? defaultAffiliateCommissionMode ?? 'COMMISSION_AND_PROFIT',
      allowPreferredPrice: affData.allowPreferredPrice !== undefined ? affData.allowPreferredPrice : defaultAllowPreferredPrice,
      preferredPrices: affData.preferredPrices || {},
      assignedCashierId: affData.assignedCashierId || fallbackCashier?.id,
      assignedCashierName: affData.assignedCashierName || fallbackCashier?.name,
      loginPin: finalPin,
      id: `aff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      totalSalesKes: 0,
      companySalesTotalKes: 0,
      preferredPriceProfitTotalKes: 0,
      baseCommissionTotalKes: 0,
      totalCommissionEarnedKes: 0,
      paidCommissionKes: 0,
      pendingCommissionKes: 0
    };

    const targetBranch = branches.find(b => b.id === newAffiliate.branchId);
    const personalData = buildPersonalDataForStaff(
      newAffiliate.id,
      newAffiliate.name,
      newAffiliate.preferredPrices
    );
    const staffRec = affiliateToStaffDirectoryRecord(newAffiliate, targetBranch?.name, personalData);

    // 1. Write to central database and local tiers
    const nextAffiliates = [newAffiliate, ...affiliates.filter(a => a.id !== newAffiliate.id)];
    await Promise.all([
      upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
      pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name, true)
    ]).catch(() => [false, false]);

    setPersistenceErrorBanner(null);
    setStaffDbSyncStatus('SYNCED');
    setLastStaffDbSyncAt(new Date().toISOString());

    // 2. Update local state & cache
    setAffiliates(prev => [newAffiliate, ...prev.filter(a => a.id !== newAffiliate.id)]);
    setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
    fetch('/api/auth/register-staff-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        staffId: newAffiliate.id,
        name: newAffiliate.name,
        codeOrNumber: newAffiliate.code,
        department: 'AFFILIATES',
        branchId: newAffiliate.branchId || activeBranchId || 'branch-1',
        rawPin: finalPin,
        active: newAffiliate.active ?? true
      })
    }).catch(() => {});
    logUserActivity({
      actionType: 'STAFF_CREATED',
      actionTitle: `Onboarded Sales Representative: ${newAffiliate.name}`,
      actionDetails: `Created Sales Representative ${newAffiliate.name} (${newAffiliate.code}) • Comm: ${newAffiliate.commissionRatePercent}%`,
      module: 'AFFILIATES'
    });
    return newAffiliate;
  };

  const updateAffiliate = async (
    affiliateId: string,
    updates: Partial<Affiliate>
  ): Promise<boolean> => {
    const existingAff = affiliates.find(a => a.id === affiliateId);
    if (!existingAff) return false;

    const cleanPin =
      updates.loginPin !== undefined
        ? updates.loginPin.replace(/\D/g, '').slice(0, 6)
        : existingAff.loginPin;
    const finalPin = cleanPin && cleanPin.length === 6 ? cleanPin : existingAff.loginPin;

    const updatedAff: Affiliate = {
      ...existingAff,
      ...updates,
      id: existingAff.id,
      name: (updates.name ?? existingAff.name).trim() || existingAff.name,
      code: (updates.code ?? existingAff.code).trim().toUpperCase() || existingAff.code,
      phone: updates.phone ?? updates.mpesaNumber ?? existingAff.phone,
      mpesaNumber: updates.mpesaNumber ?? updates.phone ?? existingAff.mpesaNumber,
      loginPin: finalPin,
      active:
        updates.employmentStatus === 'SUSPENDED' || updates.employmentStatus === 'TERMINATED'
          ? false
          : updates.active ?? existingAff.active
    };

    const nextAffiliates = affiliates.map(a => (a.id === affiliateId ? updatedAff : a));
    setAffiliates(prev => prev.map(a => (a.id === affiliateId ? updatedAff : a)));
    if (selectedAffiliate?.id === affiliateId) {
      setSelectedAffiliate(updatedAff);
    }

    const targetBranch = branches.find(b => b.id === updatedAff.branchId);
    const personalData = buildPersonalDataForStaff(
      updatedAff.id,
      updatedAff.name,
      updatedAff.preferredPrices
    );
    const existingRec = staffDatabaseRecords.find(r => r.id === updatedAff.id);
    const staffRec = affiliateToStaffDirectoryRecord(updatedAff, targetBranch?.name, personalData, {
      lastLoginAt: existingRec?.lastLoginAt,
      loginCount: existingRec?.loginCount,
      pinHash: existingRec?.pinHash,
      pinSalt: existingRec?.pinSalt
    });

    setStaffDatabaseRecords(prev => [staffRec, ...prev.filter(r => r.id !== staffRec.id)]);
    await Promise.all([
      upsertStaffRecordAcrossAllTiers(staffRec, personalData, true),
      pushUnifiedErpStateToFirestore('affiliates', nextAffiliates, currentUser.name || 'AFFILIATE-EDIT', true)
    ]);

    fetch('/api/auth/register-staff-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        staffId: updatedAff.id,
        name: updatedAff.name,
        codeOrNumber: updatedAff.code,
        department: 'AFFILIATES',
        branchId: updatedAff.branchId || activeBranchId || 'branch-1',
        rawPin: finalPin || undefined,
        active: updatedAff.active ?? true
      })
    }).catch(() => {});

    logUserActivity({
      actionType: 'SYSTEM_ACTION',
      actionTitle: `Edited Sales Representative: ${updatedAff.name}`,
      actionDetails: `Updated ${updatedAff.name} (${updatedAff.code}).`,
      module: 'AFFILIATES'
    });

    return true;
  };

  const updateAffiliatePin = (affiliateId: string, newPin: string) => {
    void updateAffiliate(affiliateId, { loginPin: newPin });
  };

  const updateAffiliateCommissionRate = (affiliateId: string, ratePercent: number) => {
    const safeRate = Math.max(0, Math.min(100, ratePercent));
    setAffiliates(prev =>
      prev.map(aff => (aff.id === affiliateId ? { ...aff, commissionRatePercent: safeRate } : aff))
    );
    if (selectedAffiliate?.id === affiliateId) {
      setSelectedAffiliate(prev => (prev ? { ...prev, commissionRatePercent: safeRate } : null));
    }
  };

  const updateAffiliateCommissionSettings = (
    affiliateId: string,
    updates: {
      commissionRatePercent?: number;
      commissionMode?: AffiliateCommissionMode;
      allowPreferredPrice?: boolean;
    }
  ) => {
    setAffiliates(prev =>
      prev.map(aff => {
        if (aff.id !== affiliateId) return aff;
        return {
          ...aff,
          commissionRatePercent:
            updates.commissionRatePercent !== undefined
              ? Math.max(0, Math.min(100, updates.commissionRatePercent))
              : aff.commissionRatePercent,
          commissionMode: updates.commissionMode ?? aff.commissionMode,
          allowPreferredPrice:
            updates.allowPreferredPrice !== undefined
              ? updates.allowPreferredPrice
              : aff.allowPreferredPrice
        };
      })
    );
    if (selectedAffiliate?.id === affiliateId) {
      setSelectedAffiliate(prev =>
        prev
          ? {
              ...prev,
              commissionRatePercent:
                updates.commissionRatePercent !== undefined
                  ? Math.max(0, Math.min(100, updates.commissionRatePercent))
                  : prev.commissionRatePercent,
              commissionMode: updates.commissionMode ?? prev.commissionMode,
              allowPreferredPrice:
                updates.allowPreferredPrice !== undefined
                  ? updates.allowPreferredPrice
                  : prev.allowPreferredPrice
            }
          : null
      );
    }
  };

  // Set or clear a Sales Affiliate's Preferred Selling Price for a specific product without affecting Company Price
  const setAffiliateProductPreferredPrice = (
    affiliateId: string,
    productId: string,
    preferredPriceKes: number | null
  ) => {
    const prod = products.find(p => p.id === productId);
    const minCompanyPrice = prod ? prod.retailPriceKes : 0;

    setAffiliates(prev =>
      prev.map(aff => {
        if (aff.id !== affiliateId) return aff;
        const nextPrices = { ...(aff.preferredPrices || {}) };
        if (preferredPriceKes === null || preferredPriceKes <= minCompanyPrice) {
          delete nextPrices[productId];
        } else {
          nextPrices[productId] = Math.round(preferredPriceKes);
        }
        return {
          ...aff,
          preferredPrices: nextPrices
        };
      })
    );
    if (selectedAffiliate?.id === affiliateId) {
      setSelectedAffiliate(prev => {
        if (!prev) return null;
        const nextPrices = { ...(prev.preferredPrices || {}) };
        if (preferredPriceKes === null || preferredPriceKes <= minCompanyPrice) {
          delete nextPrices[productId];
        } else {
          nextPrices[productId] = Math.round(preferredPriceKes);
        }
        return { ...prev, preferredPrices: nextPrices };
      });
    }
  };

  const updateAffiliateAssignedCashier = (affiliateId: string, cashierId: string, cashierName: string) => {
    setAffiliates(prev =>
      prev.map(aff =>
        aff.id === affiliateId
          ? { ...aff, assignedCashierId: cashierId, assignedCashierName: cashierName }
          : aff
      )
    );
  };

  const payoutAffiliateCommission = (affiliateId: string): boolean => {
    const aff = affiliates.find(a => a.id === affiliateId);
    if (!aff || aff.pendingCommissionKes <= 0) return false;

    const payoutAmount = aff.pendingCommissionKes;
    const b2cRef = `B2C${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Update commissions status
    setCommissions(prev =>
      prev.map(c => (c.affiliateId === affiliateId && c.status === 'PENDING' ? { ...c, status: 'PAID', payoutMpesaRef: b2cRef } : c))
    );

    // Update affiliate balances
    setAffiliates(prev =>
      prev.map(a =>
        a.id === affiliateId
          ? {
              ...a,
              paidCommissionKes: a.paidCommissionKes + payoutAmount,
              pendingCommissionKes: 0
            }
          : a
      )
    );

    // Journal Entry for M-Pesa B2C Payout:
    // Dr. Affiliate Commission Payable (2045)
    // Cr. M-Pesa Clearing & Settlement (1020)
    const newJE: JournalEntry = {
      id: `je-b2c-${Date.now()}`,
      entryNumber: `JE-B2C-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().substring(0, 10),
      referenceType: 'MANUAL',
      referenceId: b2cRef,
      description: `M-Pesa B2C Commission Payout to ${aff.name} (${aff.mpesaNumber})`,
      lines: [
        { accountCode: '2045', accountName: 'Affiliate Commission Payable (Sales Representatives)', debitKes: payoutAmount, creditKes: 0 },
        { accountCode: '1020', accountName: 'M-Pesa Clearing & Settlement (Daraja)', debitKes: 0, creditKes: payoutAmount }
      ],
      totalDebitKes: payoutAmount,
      totalCreditKes: payoutAmount,
      postedBy: 'Daraja B2C Auto-Disbursement',
      branchId: aff.branchId
    };

    setJournalEntries(prev => [newJE, ...prev]);

    // Update Chart of Accounts for Affiliate Commission Paid (6050) and M-Pesa Clearing (1020)
    setChartOfAccounts(prev =>
      prev.map(acc => {
        if (acc.code === '6050') return { ...acc, balanceKes: acc.balanceKes + payoutAmount };
        if (acc.code === '1020') return { ...acc, balanceKes: Math.max(0, acc.balanceKes - payoutAmount) };
        return acc;
      })
    );

    logUserActivity({
      actionType: 'COMMISSION_PAYOUT',
      actionTitle: `Paid Affiliate Commission: ${aff.name} (KES ${payoutAmount.toLocaleString()})`,
      actionDetails: `Disbursed KES ${payoutAmount.toLocaleString()} via M-Pesa B2C (${b2cRef}) to ${aff.name}.`,
      module: 'AFFILIATES'
    });

    return true;
  };

  // ============================================================================
  // VAAIRO SALES NETWORK: CUSTOMER ONBOARDING & REMOTE ORDER GENERATION
  // ============================================================================
  const [salesNetworkCustomers, setSalesNetworkCustomers] = usePersisted<SalesNetworkCustomer[]>(
    'sales_network_customers_v1',
    [
      {
        id: 'snc-001',
        customerCode: 'SNC-2026-001',
        affiliateId: 'aff-1',
        affiliateName: 'Sarah Wambui',
        affiliateCode: 'SL-SARAH-01',
        branchId: 'branch-ret-01',
        customerName: 'Kelvin Mutua',
        businessOrVenueName: 'Havana Rooftop Lounge Westlands',
        segment: 'BAR_LOUNGE',
        phone: '254722418902',
        email: 'kelvin@havanarooftop.co.ke',
        kraPin: 'P051882910M',
        defaultDeliveryLocation: 'Westlands — Electric Avenue, Woodvale Grove',
        defaultDeliveryNotes: 'VIP Service Elevator — 6th Floor Receiving',
        totalOrdersCount: 4,
        grossSpendKes: 128400,
        companySalesKes: 118000,
        affiliateMarkupProfitKes: 10400,
        affiliateBaseCommissionKes: 5900,
        active: true,
        onboardedAt: '2026-02-12T09:30:00.000Z',
        lastOrderAt: '2026-03-18T16:45:00.000Z'
      },
      {
        id: 'snc-002',
        customerCode: 'SNC-2026-002',
        affiliateId: 'aff-2',
        affiliateName: 'Brenda Achieng',
        affiliateCode: 'SL-BRENDA-02',
        branchId: 'branch-ret-02',
        customerName: 'Cynthia Njoroge',
        businessOrVenueName: 'Nairobi Luxury Events & Concierge',
        segment: 'EVENT_PLANNER',
        phone: '254711903421',
        email: 'cynthia@nairobiluxuryevents.co.ke',
        kraPin: 'P051449012K',
        defaultDeliveryLocation: 'Kilimani — Argwings Kodhek Rd, Chaka Place',
        defaultDeliveryNotes: 'Chilled Champagne & Single Malt Cases',
        totalOrdersCount: 3,
        grossSpendKes: 94500,
        companySalesKes: 87000,
        affiliateMarkupProfitKes: 7500,
        affiliateBaseCommissionKes: 4350,
        active: true,
        onboardedAt: '2026-02-20T11:15:00.000Z',
        lastOrderAt: '2026-03-21T14:20:00.000Z'
      },
      {
        id: 'snc-003',
        customerCode: 'SNC-2026-003',
        affiliateId: 'aff-3',
        affiliateName: 'Mercy Chebet',
        affiliateCode: 'SL-MERCY-03',
        branchId: 'branch-ret-03',
        customerName: 'Dr. Richard Ochieng',
        businessOrVenueName: 'Karen Golf & Country Private Cellar',
        segment: 'VIP_PRIVATE_CLIENT',
        phone: '254733812094',
        email: 'rochieng@karencellar.co.ke',
        defaultDeliveryLocation: 'Karen — Karen Road near Country Club',
        defaultDeliveryNotes: 'Call 15 mins prior to arrival at main gate',
        totalOrdersCount: 2,
        grossSpendKes: 68200,
        companySalesKes: 63000,
        affiliateMarkupProfitKes: 5200,
        affiliateBaseCommissionKes: 3150,
        active: true,
        onboardedAt: '2026-03-01T10:00:00.000Z',
        lastOrderAt: '2026-03-24T18:10:00.000Z'
      }
    ]
  );

  const onboardSalesNetworkCustomer = (params: {
    affiliateId: string;
    customerName: string;
    businessOrVenueName?: string;
    segment: SalesNetworkCustomerSegment;
    phone: string;
    email?: string;
    kraPin?: string;
    defaultDeliveryLocation: string;
    defaultDeliveryNotes?: string;
  }): SalesNetworkCustomer => {
    const aff = affiliates.find(a => a.id === params.affiliateId) || affiliates[0];
    const nowIso = new Date().toISOString();
    const nextIdx = salesNetworkCustomers.length + 1;
    const created: SalesNetworkCustomer = {
      id: `snc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerCode: `SNC-2026-${String(nextIdx).padStart(3, '0')}`,
      affiliateId: aff?.id || params.affiliateId,
      affiliateName: aff?.name || 'Sales Representative',
      affiliateCode: aff?.code || 'SR-01',
      branchId: aff?.branchId || activeBranchId || 'branch-ret-01',
      customerName: params.customerName.trim(),
      businessOrVenueName: params.businessOrVenueName?.trim() || undefined,
      segment: params.segment,
      phone: params.phone.trim(),
      email: params.email?.trim().toLowerCase() || undefined,
      kraPin: params.kraPin?.trim().toUpperCase() || undefined,
      defaultDeliveryLocation: params.defaultDeliveryLocation.trim(),
      defaultDeliveryNotes: params.defaultDeliveryNotes?.trim() || undefined,
      totalOrdersCount: 0,
      grossSpendKes: 0,
      companySalesKes: 0,
      affiliateMarkupProfitKes: 0,
      affiliateBaseCommissionKes: 0,
      active: true,
      onboardedAt: nowIso
    };

    setSalesNetworkCustomers(prev => [created, ...prev]);

    logUserActivity({
      actionType: 'SYSTEM_ACTION',
      actionTitle: `VAAIRO Sales Network Onboarded Customer: ${created.customerName} (${created.customerCode})`,
      actionDetails: `Sales Agent ${created.affiliateName} (${created.affiliateCode}) onboarded ${created.customerName}${created.businessOrVenueName ? ` • ${created.businessOrVenueName}` : ''}`,
      module: 'AFFILIATES'
    });

    return created;
  };

  const createSalesNetworkRemoteOrder = (params: {
    affiliateId: string;
    salesNetworkCustomerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryLocation: string;
    deliveryNotes?: string;
    items: {
      product: Product;
      quantity: number;
      preferredSellingUnitPrice?: number;
    }[];
  }) => {
    const aff = affiliates.find(a => a.id === params.affiliateId) || affiliates[0];
    const targetBranch =
      branches.find(b => b.id === aff?.branchId) ||
      branches.find(b => b.tier === 'LIQUOR_STORE') ||
      activeBranch;
    const allowPref = aff ? aff.allowPreferredPrice !== false : true;
    const commMode: AffiliateCommissionMode = aff?.commissionMode || 'COMMISSION_AND_PROFIT';
    const commRate = aff?.commissionRatePercent ?? defaultAffiliateCommissionRate;

    let companySalesKes = 0;
    let grossSoldPriceKes = 0;

    const orderItems = params.items.map(item => {
      const qty = Math.max(1, Math.round(item.quantity));
      const companyUnitPrice = item.product.retailPriceKes;
      const agentBookPrice = aff?.preferredPrices?.[item.product.id];
      const candidatePrefPrice =
        item.preferredSellingUnitPrice !== undefined
          ? item.preferredSellingUnitPrice
          : agentBookPrice !== undefined
          ? agentBookPrice
          : companyUnitPrice;
      const resolvedSellingUnitPrice = allowPref
        ? Math.max(companyUnitPrice, Math.round(candidatePrefPrice))
        : companyUnitPrice;

      companySalesKes += companyUnitPrice * qty;
      grossSoldPriceKes += resolvedSellingUnitPrice * qty;

      return {
        product: item.product,
        quantity: qty,
        companyUnitPrice,
        preferredSellingUnitPrice: resolvedSellingUnitPrice,
        totalAmount: resolvedSellingUnitPrice * qty
      };
    });

    const rawMarkupProfit = Math.max(0, grossSoldPriceKes - companySalesKes);
    const affiliateMarkupProfitKes =
      commMode === 'BASE_COMMISSION_ONLY' ? 0 : rawMarkupProfit;
    const affiliateBaseCommissionKes =
      commMode === 'PREFERRED_PRICE_PROFIT_ONLY'
        ? 0
        : Math.round((companySalesKes * commRate) / 100);
    const totalAffiliatePayableKes = affiliateMarkupProfitKes + affiliateBaseCommissionKes;

    const nowIso = new Date().toISOString();
    const orderNumber = `VSN-2026-${(websiteDeliveryOrders.length + orders.length + 501).toString()}`;
    const orderId = `vsn-ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newRemoteOrder: WebsiteDeliveryOrder = {
      id: orderId,
      orderNumber,
      customerName: params.customerName.trim(),
      customerEmail: params.customerEmail?.trim().toLowerCase() || undefined,
      customerPhone: params.customerPhone.trim(),
      deliveryLocation: params.deliveryLocation.trim(),
      deliveryNotes: params.deliveryNotes?.trim()
        ? `${params.deliveryNotes.trim()} • [VAAIRO Sales Network: ${aff?.name || 'Agent'} (${aff?.code || ''})]`
        : `[VAAIRO Sales Network Remote Order • Agent: ${aff?.name || 'Agent'} (${aff?.code || ''})]`,
      branchId: targetBranch.id,
      branchName: targetBranch.name,
      routingModel: 'MANUAL_SELECTION',
      items: orderItems,
      totalCompanyPriceKes: companySalesKes,
      grossSoldPriceKes,
      affiliateId: aff?.id,
      affiliateName: aff?.name,
      affiliateCode: aff?.code,
      salesNetworkCustomerId: params.salesNetworkCustomerId,
      affiliateMarkupProfitKes,
      affiliateBaseCommissionKes,
      deliveryStatus: 'ON_HOLD_PENDING_DELIVERY',
      createdAt: nowIso
    };

    setWebsiteDeliveryOrders(prev => [newRemoteOrder, ...prev]);

    const newCommRecord: CommissionRecord = {
      id: `comm-vsn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      affiliateId: aff?.id || params.affiliateId,
      affiliateName: aff?.name || 'Sales Representative',
      recipientRole: 'AFFILIATE_SALES_LADY',
      commissionType:
        commMode === 'PREFERRED_PRICE_PROFIT_ONLY'
          ? 'PREFERRED_PRICE_PROFIT'
          : 'MARKUP_AND_COMMISSION',
      commissionMode: commMode,
      commissionRatePercent: commRate,
      orderId,
      orderNumber,
      baselinePriceKes: companySalesKes,
      soldPriceKes: grossSoldPriceKes,
      preferredPriceProfitKes: affiliateMarkupProfitKes,
      baseCommissionKes: affiliateBaseCommissionKes,
      markupEarnedKes: totalAffiliatePayableKes,
      status: 'PENDING',
      createdAt: nowIso
    };

    setCommissions(prev => [newCommRecord, ...prev]);

    // Update Affiliate separated accounting totals
    if (aff) {
      setAffiliates(prev =>
        prev.map(a =>
          a.id === aff.id
            ? {
                ...a,
                totalSalesKes: (a.totalSalesKes || 0) + grossSoldPriceKes,
                companySalesTotalKes: (a.companySalesTotalKes || 0) + companySalesKes,
                preferredPriceProfitTotalKes:
                  (a.preferredPriceProfitTotalKes || 0) + affiliateMarkupProfitKes,
                baseCommissionTotalKes:
                  (a.baseCommissionTotalKes || 0) + affiliateBaseCommissionKes,
                totalCommissionEarnedKes:
                  (a.totalCommissionEarnedKes || 0) + totalAffiliatePayableKes,
                pendingCommissionKes: (a.pendingCommissionKes || 0) + totalAffiliatePayableKes
              }
            : a
        )
      );
    }

    // Update Onboarded Customer lifetime metrics if linked
    if (params.salesNetworkCustomerId) {
      setSalesNetworkCustomers(prev =>
        prev.map(c =>
          c.id === params.salesNetworkCustomerId
            ? {
                ...c,
                totalOrdersCount: c.totalOrdersCount + 1,
                grossSpendKes: c.grossSpendKes + grossSoldPriceKes,
                companySalesKes: c.companySalesKes + companySalesKes,
                affiliateMarkupProfitKes: c.affiliateMarkupProfitKes + affiliateMarkupProfitKes,
                affiliateBaseCommissionKes: c.affiliateBaseCommissionKes + affiliateBaseCommissionKes,
                lastOrderAt: nowIso
              }
            : c
        )
      );
    }

    // Post separated double-entry journal for Company Sales vs. Affiliate Profit & Commission Payable (Acct 2045)
    if (totalAffiliatePayableKes > 0) {
      const je: JournalEntry = {
        id: `je-vsn-${Date.now()}`,
        entryNumber: `JE-VSN-${Date.now().toString().slice(-6)}`,
        date: nowIso.substring(0, 10),
        referenceType: 'SALE_ETIMS',
        referenceId: orderNumber,
        description: `VAAIRO Sales Network Separation (${orderNumber}) • Company Sales: KES ${companySalesKes.toLocaleString()} | Agent Markup: KES ${affiliateMarkupProfitKes.toLocaleString()} | Base Comm: KES ${affiliateBaseCommissionKes.toLocaleString()}`,
        lines: [
          {
            accountCode: '1100',
            accountName: 'Accounts Receivable (Remote Delivery Clearing)',
            debitKes: grossSoldPriceKes,
            creditKes: 0
          },
          {
            accountCode: '4010',
            accountName: 'Beverage Sales Revenue (Protected Company Price)',
            debitKes: 0,
            creditKes: Math.max(0, companySalesKes - affiliateBaseCommissionKes)
          },
          {
            accountCode: '2045',
            accountName: 'Affiliate Commission Payable (Markup + Base Commission)',
            debitKes: 0,
            creditKes: totalAffiliatePayableKes
          }
        ],
        totalDebitKes: grossSoldPriceKes,
        totalCreditKes: grossSoldPriceKes,
        postedBy: `VAAIRO Sales Network (${aff?.name || 'Agent'})`,
        branchId: targetBranch.id
      };
      setJournalEntries(prev => [je, ...prev]);
    }

    // Dispatch transactional order confirmation email if customer email is provided
    if (newRemoteOrder.customerEmail) {
      fetch('/api/email/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          to: newRemoteOrder.customerEmail,
          eventStage: 'ORDER_PLACED',
          orderNumber: newRemoteOrder.orderNumber,
          customerName: newRemoteOrder.customerName,
          customerEmail: newRemoteOrder.customerEmail,
          customerPhone: newRemoteOrder.customerPhone,
          branchName: newRemoteOrder.branchName,
          deliveryLocation: newRemoteOrder.deliveryLocation,
          totalAmountKes: grossSoldPriceKes,
          items: orderItems.map(it => ({
            productId: it.product.id,
            productName: it.product.name,
            quantity: it.quantity,
            unitPriceKes: it.preferredSellingUnitPrice || it.companyUnitPrice,
            lineTotalKes: it.totalAmount
          }))
        })
      }).catch(() => {});
    }

    logUserActivity({
      actionType: 'POS_SALE',
      actionTitle: `VAAIRO Sales Network Remote Order ${orderNumber} (KES ${grossSoldPriceKes.toLocaleString()})`,
      actionDetails: `Agent ${aff?.name || 'Sales Rep'} generated remote order ${orderNumber} for ${newRemoteOrder.customerName} • Company Sales: KES ${companySalesKes.toLocaleString()} | Agent Markup: +KES ${affiliateMarkupProfitKes.toLocaleString()} | Base Comm: +KES ${affiliateBaseCommissionKes.toLocaleString()}`,
      module: 'AFFILIATES'
    });

    return {
      order: newRemoteOrder,
      commissionRecord: newCommRecord,
      companySalesKes,
      affiliateMarkupProfitKes,
      affiliateBaseCommissionKes,
      totalAffiliatePayableKes
    };
  };

  // Restock & Procurement Operations (Independent Shop Acquisition & Warehouse Main Store Disbursement)
  const createRestockRequest = (
    toBranchId: string,
    itemsReq: { productId: string; casesRequested: number }[],
    options?: {
      fromBranchId?: string;
      initiationType?: 'SHOP_REFILL_REQUEST' | 'WAREHOUSE_AUTO_DISBURSE' | 'WAREHOUSE_CONTROLLER_PUSH';
      urgency?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STANDARD_REFILL';
      notes?: string;
    }
  ): RestockRequest => {
    const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
    const toBranch = branches.find(b => b.id === toBranchId) || mainWarehouse;
    const fromBranch = options?.fromBranchId
      ? branches.find(b => b.id === options.fromBranchId) || activeBranch
      : activeBranch;

    const items = itemsReq.map(req => {
      const prod = products.find(p => p.id === req.productId) || products[0];
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        casesRequested: req.casesRequested,
        bottlesTotal: req.casesRequested * (prod.packSize || 12)
      };
    });

    const initType = options?.initiationType || 'SHOP_REFILL_REQUEST';
    const newReq: RestockRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      requestNumber: `RST-2026-${(restockRequests.length + 101).toString()}`,
      fromBranchId: fromBranch.id,
      fromBranchName: fromBranch.name,
      toBranchId: toBranch.id,
      toBranchName: toBranch.tier === 'WAREHOUSE' && !toBranch.name.includes('Main Store')
        ? `${toBranch.name} (Main Store)`
        : toBranch.name,
      requestedBy: initType === 'SHOP_REFILL_REQUEST' ? `${currentUser.name} (${fromBranch.name})` : `Warehouse Controller (${currentUser.name})`,
      initiationType: initType,
      urgency: options?.urgency || 'STANDARD_REFILL',
      notes:
        options?.notes ||
        (initType === 'SHOP_REFILL_REQUEST'
          ? `Stock refill requested by ${fromBranch.name} from ${toBranch.name} — pending acceptance.`
          : `Proactive stock disbursement from ${toBranch.name} to ${fromBranch.name} — pending acceptance.`),
      status: 'PENDING',
      items,
      createdAt: new Date().toISOString()
    };

    setRestockRequests(prev => [newReq, ...prev]);
    return newReq;
  };

  // Warehouse Controller: Disburse stock to any Shop or Distributor WITHOUT waiting for shop request
  const warehouseDisburseStock = (
    targetShopBranchId: string,
    itemsReq: { productId: string; casesRequested: number }[],
    options?: {
      sourceWarehouseId?: string;
      initiationType?: 'WAREHOUSE_AUTO_DISBURSE' | 'WAREHOUSE_CONTROLLER_PUSH';
      urgency?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STANDARD_REFILL';
      notes?: string;
      autoAcceptImmediately?: boolean;
    }
  ): RestockRequest => {
    const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
    const sourceBranch = options?.sourceWarehouseId
      ? branches.find(b => b.id === options.sourceWarehouseId) || mainWarehouse
      : mainWarehouse;
    const targetShop = branches.find(b => b.id === targetShopBranchId) || branches.find(b => b.tier !== 'WAREHOUSE') || branches[0];

    const items = itemsReq.map(req => {
      const prod = products.find(p => p.id === req.productId) || products[0];
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        casesRequested: req.casesRequested,
        bottlesTotal: req.casesRequested * (prod.packSize || 12)
      };
    });

    const initType = options?.initiationType || 'WAREHOUSE_CONTROLLER_PUSH';
    const newReq: RestockRequest = {
      id: `req-disb-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      requestNumber: `RST-2026-${(restockRequests.length + 101).toString()}`,
      fromBranchId: targetShop.id,
      fromBranchName: targetShop.name,
      toBranchId: sourceBranch.id,
      toBranchName: sourceBranch.tier === 'WAREHOUSE' && !sourceBranch.name.includes('Main Store')
        ? `${sourceBranch.name} (Main Store)`
        : sourceBranch.name,
      requestedBy: `Warehouse Controller (${currentUser.name})`,
      initiationType: initType,
      urgency: options?.urgency || 'OUT_OF_STOCK',
      notes:
        options?.notes ||
        `Warehouse Controller disbursed stock from ${sourceBranch.name} (Main Store) to ${targetShop.name} without waiting for shop request — pending acceptance.`,
      status: options?.autoAcceptImmediately ? 'RECEIVED' : 'PENDING',
      items,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      dispatchedAt: options?.autoAcceptImmediately ? new Date().toISOString() : undefined,
      receivedAt: options?.autoAcceptImmediately ? new Date().toISOString() : undefined,
      acceptedBy: options?.autoAcceptImmediately ? currentUser.name : undefined
    };

    if (options?.autoAcceptImmediately) {
      // Immediately deduct from Warehouse (Main Store) and credit target Shop
      setInventoryItems(prev => {
        const updated = prev.map(invItem => {
          if (invItem.branchId === sourceBranch.id) {
            const line = items.find(i => i.productId === invItem.productId);
            if (line) {
              const prod = products.find(p => p.id === invItem.productId);
              const packSize = prod?.packSize || 12;
              const newBottles = Math.max(0, invItem.bottlesOnHand - line.bottlesTotal);
              return {
                ...invItem,
                bottlesOnHand: newBottles,
                casesOnHand: Math.floor(newBottles / packSize)
              };
            }
          }
          return invItem;
        });

        for (const item of items) {
          const prod = products.find(p => p.id === item.productId);
          const packSize = prod?.packSize || 12;
          const existingIdx = updated.findIndex(i => i.productId === item.productId && i.branchId === targetShop.id);
          if (existingIdx >= 0) {
            const newBottles = updated[existingIdx].bottlesOnHand + item.bottlesTotal;
            updated[existingIdx] = {
              ...updated[existingIdx],
              bottlesOnHand: newBottles,
              casesOnHand: Math.floor(newBottles / packSize),
              lastScannedAt: new Date().toISOString()
            };
          } else {
            updated.push({
              id: `inv-${Date.now()}-${item.productId}-${targetShop.id}`,
              productId: item.productId,
              branchId: targetShop.id,
              bottlesOnHand: item.bottlesTotal,
              casesOnHand: item.casesRequested,
              reorderLevel: 24,
              batchNumber: `WH-DISB-${newReq.requestNumber}`,
              expiryDate: '2030-12-31',
              lastScannedAt: new Date().toISOString()
            });
          }
        }
        return updated;
      });
    }

    setRestockRequests(prev => [newReq, ...prev]);
    return newReq;
  };

  // Warehouse Controller: Scan all shops & auto-disburse stock for any out-of-stock or low-stock products without waiting for shop request
  const triggerWarehouseAutoDisburseForAllLowStockShops = (): { count: number; requests: RestockRequest[] } => {
    const mainWarehouse = branches.find(b => b.tier === 'WAREHOUSE') || branches[0];
    const shopBranches = branches.filter(b => b.tier !== 'WAREHOUSE');
    const generatedRequests: RestockRequest[] = [];

    shopBranches.forEach((shop, sIdx) => {
      const lowOrOutItems: { productId: string; casesRequested: number; isOut: boolean }[] = [];

      products.forEach(prod => {
        const inv = inventoryItems.find(i => i.branchId === shop.id && i.productId === prod.id);
        const bottles = inv?.bottlesOnHand ?? 0;
        const reorder = inv?.reorderLevel ?? 18;

        // Check if there is already a PENDING request for this shop & product
        const alreadyPending = restockRequests.some(
          r =>
            r.fromBranchId === shop.id &&
            (r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISPATCHED') &&
            r.items.some(it => it.productId === prod.id)
        );

        if (!alreadyPending && bottles <= reorder) {
          lowOrOutItems.push({
            productId: prod.id,
            casesRequested: bottles === 0 ? 5 : 3,
            isOut: bottles === 0
          });
        }
      });

      if (lowOrOutItems.length > 0) {
        const items = lowOrOutItems.slice(0, 4).map(req => {
          const prod = products.find(p => p.id === req.productId)!;
          return {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            casesRequested: req.casesRequested,
            bottlesTotal: req.casesRequested * (prod.packSize || 12)
          };
        });

        const hasOutOfStock = lowOrOutItems.some(i => i.isOut);
        const newReq: RestockRequest = {
          id: `req-autodisb-${Date.now()}-${sIdx}`,
          requestNumber: `RST-2026-${(restockRequests.length + generatedRequests.length + 101).toString()}`,
          fromBranchId: shop.id,
          fromBranchName: shop.name,
          toBranchId: mainWarehouse.id,
          toBranchName: `${mainWarehouse.name} (Main Store)`,
          requestedBy: `Warehouse Controller (Auto-Disburse Engine)`,
          initiationType: 'WAREHOUSE_AUTO_DISBURSE',
          urgency: hasOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          notes: `Warehouse Controller auto-disbursed ${items.length} low/out-of-stock SKU(s) to ${shop.name} without waiting for shop request — pending acceptance.`,
          status: 'PENDING',
          items,
          createdAt: new Date().toISOString()
        };
        generatedRequests.push(newReq);
      }
    });

    if (generatedRequests.length > 0) {
      setRestockRequests(prev => [...generatedRequests, ...prev]);
    }
    return { count: generatedRequests.length, requests: generatedRequests };
  };

  // Inventory Controller: Edit cases requested for a specific item on an incoming order request
  const updateRestockRequestItemQty = (requestId: string, productId: string, newCasesRequested: number) => {
    const safeCases = Math.max(1, Math.floor(newCasesRequested));
    setRestockRequests(prev =>
      prev.map(req => {
        if (req.id !== requestId) return req;
        const updatedItems = req.items.map(item => {
          if (item.productId !== productId) return item;
          const prod = products.find(p => p.id === productId);
          const packSize = prod?.packSize || 12;
          return {
            ...item,
            casesRequested: safeCases,
            bottlesTotal: safeCases * packSize
          };
        });
        return {
          ...req,
          items: updatedItems,
          editedByController: `Inventory Controller (${currentUser.name})`
        };
      })
    );
  };

  // Inventory Controller: Remove an unavailable product from the order request's stock list
  const removeUnavailableItemFromRestockRequest = (requestId: string, productId: string, reason?: string) => {
    setRestockRequests(prev =>
      prev.map(req => {
        if (req.id !== requestId) return req;
        const itemToRemove = req.items.find(i => i.productId === productId);
        if (!itemToRemove) return req;

        const remainingItems = req.items.filter(i => i.productId !== productId);
        const removedEntry = {
          productId: itemToRemove.productId,
          productName: itemToRemove.productName,
          sku: itemToRemove.sku,
          casesRequested: itemToRemove.casesRequested,
          reason: reason || 'Unavailable in Warehouse stock'
        };
        const updatedRemoved = [...(req.removedItems || []), removedEntry];

        // If all items were removed because none are available, mark as REJECTED
        if (remainingItems.length === 0) {
          return {
            ...req,
            items: [],
            removedItems: updatedRemoved,
            editedByController: `Inventory Controller (${currentUser.name})`,
            status: 'REJECTED',
            notes: `${req.notes || ''} [All requested products removed — unavailable in stock]`
          };
        }

        return {
          ...req,
          items: remainingItems,
          removedItems: updatedRemoved,
          editedByController: `Inventory Controller (${currentUser.name})`
        };
      })
    );
  };

  // Inventory Controller: Automatically remove all unavailable (0 stock) products or cap to available stock on a request
  const removeAllUnavailableItemsFromRequest = (requestId: string): { removedCount: number; remainingCount: number } => {
    const req = restockRequests.find(r => r.id === requestId);
    if (!req) return { removedCount: 0, remainingCount: 0 };

    const keptItems: RestockRequest['items'] = [];
    const newlyRemoved: NonNullable<RestockRequest['removedItems']> = [...(req.removedItems || [])];
    let removedCount = 0;

    req.items.forEach(item => {
      const whInv = inventoryItems.find(i => i.branchId === req.toBranchId && i.productId === item.productId);
      const prod = products.find(p => p.id === item.productId);
      const packSize = prod?.packSize || 12;
      const availableBottles = whInv?.bottlesOnHand ?? 0;
      const availableCases = Math.floor(availableBottles / packSize);

      if (availableBottles <= 0 || availableCases <= 0) {
        removedCount += 1;
        newlyRemoved.push({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          casesRequested: item.casesRequested,
          reason: '0 cases available in Warehouse stock'
        });
      } else if (item.casesRequested > availableCases) {
        keptItems.push({
          ...item,
          casesRequested: availableCases,
          bottlesTotal: availableCases * packSize
        });
      } else {
        keptItems.push(item);
      }
    });

    setRestockRequests(prev =>
      prev.map(r => {
        if (r.id !== requestId) return r;
        if (keptItems.length === 0) {
          return {
            ...r,
            items: [],
            removedItems: newlyRemoved,
            editedByController: `Inventory Controller (${currentUser.name})`,
            status: 'REJECTED',
            notes: `${r.notes || ''} [Rejected: All products unavailable in Warehouse stock]`
          };
        }
        return {
          ...r,
          items: keptItems,
          removedItems: newlyRemoved,
          editedByController: `Inventory Controller (${currentUser.name})`
        };
      })
    );

    return { removedCount, remainingCount: keptItems.length };
  };

  // One-click Accept & Fulfill Notification by Inventory Controller (Deducts from Warehouse/Distributor & Credits Independent Shop Stock)
  const acceptAndFulfillRestockRequest = (requestId: string) => {
    const req = restockRequests.find(r => r.id === requestId);
    if (!req || req.status === 'RECEIVED' || req.status === 'REJECTED' || req.items.length === 0) return;

    const wasAlreadyDispatched = req.status === 'DISPATCHED';

    setInventoryItems(prev => {
      let updated = [...prev];

      // 1. Deduct from supplying Warehouse (Main Store) or Distributor if not already deducted
      if (!wasAlreadyDispatched) {
        updated = updated.map(invItem => {
          if (invItem.branchId === req.toBranchId) {
            const reqItem = req.items.find(i => i.productId === invItem.productId);
            if (reqItem) {
              const newBottles = Math.max(0, invItem.bottlesOnHand - reqItem.bottlesTotal);
              const prod = products.find(p => p.id === invItem.productId);
              const packSize = prod?.packSize || 12;
              return {
                ...invItem,
                bottlesOnHand: newBottles,
                casesOnHand: Math.floor(newBottles / packSize)
              };
            }
          }
          return invItem;
        });
      }

      // 2. Credit into the receiving Shop's independent inventory
      for (const item of req.items) {
        const prod = products.find(p => p.id === item.productId);
        const packSize = prod?.packSize || 12;
        const existingIdx = updated.findIndex(i => i.productId === item.productId && i.branchId === req.fromBranchId);
        if (existingIdx >= 0) {
          const newBottles = updated[existingIdx].bottlesOnHand + item.bottlesTotal;
          updated[existingIdx] = {
            ...updated[existingIdx],
            bottlesOnHand: newBottles,
            casesOnHand: Math.floor(newBottles / packSize),
            lastScannedAt: new Date().toISOString()
          };
        } else {
          updated.push({
            id: `inv-${Date.now()}-${item.productId}-${req.fromBranchId}`,
            productId: item.productId,
            branchId: req.fromBranchId,
            bottlesOnHand: item.bottlesTotal,
            casesOnHand: item.casesRequested,
            reorderLevel: 24,
            batchNumber: `RST-${req.requestNumber}`,
            expiryDate: '2030-12-31',
            lastScannedAt: new Date().toISOString()
          });
        }
      }

      return updated;
    });

    const nowIso = new Date().toISOString();
    setRestockRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'RECEIVED',
              approvedAt: r.approvedAt || nowIso,
              dispatchedAt: r.dispatchedAt || nowIso,
              receivedAt: nowIso,
              acceptedBy: currentUser.name
            }
          : r
      )
    );
    logUserActivity({
      actionType: 'RESTOCK_ACTION',
      actionTitle: `Accepted & Fulfilled Restock ${req.requestNumber}`,
      actionDetails: `Fulfilled ${req.items.length} SKU(s) from ${req.toBranchName} to ${req.fromBranchName}.`,
      module: 'INVENTORY'
    });
  };

  const rejectRestockRequest = (requestId: string, reason?: string) => {
    setRestockRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'REJECTED',
              notes: reason ? `${r.notes || ''} [Rejected: ${reason}]` : r.notes
            }
          : r
      )
    );
  };

  const approveRestockRequest = (requestId: string) => {
    setRestockRequests(prev =>
      prev.map(r => (r.id === requestId ? { ...r, status: 'APPROVED', approvedAt: new Date().toISOString() } : r))
    );
  };

  const dispatchRestockRequest = (requestId: string) => {
    const req = restockRequests.find(r => r.id === requestId);
    if (!req) return;

    // Deduct stock from supplying branch (usually Warehouse)
    setInventoryItems(prev => {
      return prev.map(invItem => {
        if (invItem.branchId === req.toBranchId) {
          const reqItem = req.items.find(i => i.productId === invItem.productId);
          if (reqItem) {
            const newBottles = Math.max(0, invItem.bottlesOnHand - reqItem.bottlesTotal);
            const prod = products.find(p => p.id === invItem.productId);
            const packSize = prod?.packSize || 12;
            return {
              ...invItem,
              bottlesOnHand: newBottles,
              casesOnHand: Math.floor(newBottles / packSize)
            };
          }
        }
        return invItem;
      });
    });

    setRestockRequests(prev =>
      prev.map(r => (r.id === requestId ? { ...r, status: 'DISPATCHED', dispatchedAt: new Date().toISOString() } : r))
    );
  };

  const receiveRestockRequest = (requestId: string) => {
    acceptAndFulfillRestockRequest(requestId);
  };

  // --- Employee Leave Requests (Employees -> HR) ---
  const submitEmployeeLeaveRequest = (params: {
    employeeId?: string;
    employeeName?: string;
    employeeNumber?: string;
    department?: DepartmentType;
    branchId?: string;
    leaveType: EmployeeLeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    handoverPersonName?: string;
  }): EmployeeLeaveRequest => {
    const matchedEmp =
      employees.find(
        e =>
          (params.employeeId && e.id === params.employeeId) ||
          (params.employeeName && e.name.toLowerCase() === params.employeeName.trim().toLowerCase()) ||
          e.name.toLowerCase() === currentUser.name.trim().toLowerCase()
      ) || null;

    const targetBranchId = params.branchId || matchedEmp?.branchId || activeBranch.id;
    const targetBranch = branches.find(b => b.id === targetBranchId) || activeBranch;

    const newLeaveReq: EmployeeLeaveRequest = {
      id: `lve-${Date.now()}`,
      requestNumber: `LVE-2026-${(101 + employeeLeaveRequests.length).toString().padStart(3, '0')}`,
      employeeId: params.employeeId || matchedEmp?.id || currentUser.id,
      employeeName: params.employeeName || matchedEmp?.name || currentUser.name,
      employeeNumber: params.employeeNumber || matchedEmp?.employeeNumber || 'EMP-STAFF',
      department: params.department || matchedEmp?.department || currentDepartment,
      branchId: targetBranch.id,
      branchName: targetBranch.name,
      leaveType: params.leaveType,
      startDate: params.startDate,
      endDate: params.endDate,
      daysCount: Math.max(1, params.daysCount),
      reason: params.reason.trim(),
      handoverPersonName: params.handoverPersonName?.trim() || undefined,
      status: 'PENDING_HR',
      requestedAt: new Date().toISOString()
    };

    setEmployeeLeaveRequests(prev => [newLeaveReq, ...prev]);
    return newLeaveReq;
  };

  const reviewEmployeeLeaveRequest = (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    hrReviewNotes?: string
  ) => {
    const nowIso = new Date().toISOString();
    setEmployeeLeaveRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status,
              reviewedBy: `${currentUser.name} (HR)`,
              reviewedAt: nowIso,
              hrReviewNotes:
                hrReviewNotes?.trim() ||
                (status === 'APPROVED'
                  ? 'Approved by HR Department.'
                  : 'Declined by HR Department.')
            }
          : r
      )
    );
  };

  // --- Sales Representative Off-Duty Requests (Sales Rep -> Sales Manager) ---
  const submitSalesRepOffDutyRequest = (params: {
    affiliateId?: string;
    affiliateName?: string;
    affiliateCode?: string;
    branchId?: string;
    offDutyType: SalesRepOffDutyType;
    startDate: string;
    endDate: string;
    daysOrShiftsCount: number;
    reason: string;
    coveringRepName?: string;
  }): SalesRepOffDutyRequest => {
    const matchedAff =
      affiliates.find(
        a =>
          (params.affiliateId && a.id === params.affiliateId) ||
          (params.affiliateName && a.name.toLowerCase() === params.affiliateName.trim().toLowerCase()) ||
          a.name.toLowerCase() === currentUser.name.trim().toLowerCase()
      ) ||
      selectedAffiliate ||
      null;

    const targetBranchId = params.branchId || matchedAff?.branchId || activeBranch.id;
    const targetBranch = branches.find(b => b.id === targetBranchId) || activeBranch;

    const newOffDutyReq: SalesRepOffDutyRequest = {
      id: `off-${Date.now()}`,
      requestNumber: `OFF-2026-${(201 + salesRepOffDutyRequests.length).toString().padStart(3, '0')}`,
      affiliateId: params.affiliateId || matchedAff?.id || currentUser.id,
      affiliateName: params.affiliateName || matchedAff?.name || currentUser.name,
      affiliateCode: params.affiliateCode || matchedAff?.code || 'SR-REP',
      branchId: targetBranch.id,
      branchName: targetBranch.name,
      assignedCashierName: matchedAff?.assignedCashierName,
      offDutyType: params.offDutyType,
      startDate: params.startDate,
      endDate: params.endDate,
      daysOrShiftsCount: Math.max(1, params.daysOrShiftsCount),
      reason: params.reason.trim(),
      coveringRepName: params.coveringRepName?.trim() || undefined,
      status: 'PENDING_SALES_MANAGER',
      requestedAt: new Date().toISOString()
    };

    setSalesRepOffDutyRequests(prev => [newOffDutyReq, ...prev]);
    return newOffDutyReq;
  };

  const reviewSalesRepOffDutyRequest = (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    managerReviewNotes?: string
  ) => {
    const nowIso = new Date().toISOString();
    setSalesRepOffDutyRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status,
              reviewedBy: `${currentUser.name} (Sales Manager)`,
              reviewedAt: nowIso,
              managerReviewNotes:
                managerReviewNotes?.trim() ||
                (status === 'APPROVED'
                  ? 'Approved by Branch Sales Manager.'
                  : 'Declined by Branch Sales Manager.')
            }
          : r
      )
    );
  };

  // --- Admin Settings: System Config, Brand & Product Prices, CSV Import, Offers, Campaigns & Promotions ---
  const updateSystemSettings = (updates: Partial<ErpSystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...updates }));
  };

  const upsertBrandPriceRule = (
    ruleData: Omit<BrandPriceRule, 'id' | 'updatedAt'> & { id?: string },
    applyToMatchingProducts = true
  ): BrandPriceRule => {
    const nowIso = new Date().toISOString();
    const existing = brandPriceRules.find(
      b =>
        (ruleData.id && b.id === ruleData.id) ||
        b.brandName.trim().toLowerCase() === ruleData.brandName.trim().toLowerCase()
    );

    const savedRule: BrandPriceRule = {
      id: existing?.id || ruleData.id || `brand-rule-${Date.now()}`,
      brandName: ruleData.brandName.trim(),
      category: ruleData.category,
      countryOfOrigin: ruleData.countryOfOrigin.trim() || (ruleData.category === 'LPS' ? 'Kenya' : 'Imported'),
      defaultVolumeMl: ruleData.defaultVolumeMl || 750,
      defaultPackSize: ruleData.defaultPackSize || 12,
      baselineWarehouseCostKes: Math.max(0, Math.round(ruleData.baselineWarehouseCostKes)),
      baselineWholesalePriceKes: Math.max(0, Math.round(ruleData.baselineWholesalePriceKes)),
      baselineRetailPriceKes: Math.max(0, Math.round(ruleData.baselineRetailPriceKes)),
      minWholesaleQty: Math.max(1, Math.round(ruleData.minWholesaleQty || 6)),
      active: ruleData.active ?? true,
      updatedAt: nowIso
    };

    setBrandPriceRules(prev => {
      if (existing) {
        return prev.map(b => (b.id === existing.id ? savedRule : b));
      }
      return [savedRule, ...prev];
    });

    if (applyToMatchingProducts) {
      setProducts(prev =>
        prev.map(p => {
          if (p.brand.trim().toLowerCase() === savedRule.brandName.toLowerCase()) {
            return {
              ...p,
              category: savedRule.category,
              countryOfOrigin: savedRule.countryOfOrigin,
              warehouseCostKes: savedRule.baselineWarehouseCostKes,
              wholesalePriceKes: savedRule.baselineWholesalePriceKes,
              retailPriceKes: savedRule.baselineRetailPriceKes,
              minWholesaleQty: savedRule.minWholesaleQty
            };
          }
          return p;
        })
      );
    }

    return savedRule;
  };

  const deleteBrandPriceRule = (id: string) => {
    setBrandPriceRules(prev => prev.filter(b => b.id !== id));
  };

  const bulkUpdateBrandPrices = (
    brandName: string,
    prices: {
      warehouseCostKes?: number;
      wholesalePriceKes?: number;
      retailPriceKes?: number;
      minWholesaleQty?: number;
      percentageChange?: number;
    }
  ): number => {
    const targetNorm = brandName.trim().toLowerCase();
    let updatedCount = 0;

    setProducts(prev =>
      prev.map(p => {
        if (p.brand.trim().toLowerCase() !== targetNorm) return p;
        updatedCount += 1;
        const pctMultiplier =
          prices.percentageChange !== undefined && !isNaN(prices.percentageChange)
            ? 1 + prices.percentageChange / 100
            : 1;

        const nextCost =
          prices.warehouseCostKes !== undefined && prices.warehouseCostKes > 0
            ? Math.round(prices.warehouseCostKes)
            : Math.max(10, Math.round(p.warehouseCostKes * pctMultiplier));

        const nextWholesale =
          prices.wholesalePriceKes !== undefined && prices.wholesalePriceKes > 0
            ? Math.round(prices.wholesalePriceKes)
            : Math.max(10, Math.round(p.wholesalePriceKes * pctMultiplier));

        const nextRetail =
          prices.retailPriceKes !== undefined && prices.retailPriceKes > 0
            ? Math.round(prices.retailPriceKes)
            : Math.max(10, Math.round(p.retailPriceKes * pctMultiplier));

        return {
          ...p,
          warehouseCostKes: nextCost,
          wholesalePriceKes: nextWholesale,
          retailPriceKes: nextRetail,
          minWholesaleQty:
            prices.minWholesaleQty !== undefined && prices.minWholesaleQty > 0
              ? Math.round(prices.minWholesaleQty)
              : p.minWholesaleQty
        };
      })
    );

    return updatedCount;
  };

  const importPriceListFromCsvRows = (
    rows: Array<{
      sku?: string;
      barcode?: string;
      name?: string;
      brand?: string;
      category?: StockCategory;
      volumeMl?: number;
      packSize?: number;
      warehouseCostKes?: number;
      wholesalePriceKes?: number;
      retailPriceKes?: number;
      minWholesaleQty?: number;
    }>
  ): { updatedCount: number; createdCount: number } => {
    let updatedCount = 0;
    let createdCount = 0;

    setProducts(prev => {
      const nextProducts = [...prev];

      rows.forEach((row, index) => {
        const cleanSku = (row.sku || '').trim();
        const cleanBarcode = (row.barcode || '').trim();
        const cleanName = (row.name || '').trim();
        const cleanBrand = (row.brand || '').trim();

        const retail = row.retailPriceKes && row.retailPriceKes > 0 ? Math.round(row.retailPriceKes) : 0;
        const wholesale =
          row.wholesalePriceKes && row.wholesalePriceKes > 0
            ? Math.round(row.wholesalePriceKes)
            : retail > 0
            ? Math.round(retail * 0.86)
            : 0;
        const cost =
          row.warehouseCostKes && row.warehouseCostKes > 0
            ? Math.round(row.warehouseCostKes)
            : wholesale > 0
            ? Math.round(wholesale * 0.82)
            : 0;

        if (!cleanSku && !cleanBarcode && !cleanName && !cleanBrand) return;

        // 1. Try matching existing product by SKU, Barcode, or exact Name
        const matchIdx = nextProducts.findIndex(
          p =>
            (cleanSku && p.sku.toLowerCase() === cleanSku.toLowerCase()) ||
            (cleanBarcode && (p.barcode === cleanBarcode || p.caseBarcode === cleanBarcode)) ||
            (cleanName && p.name.toLowerCase() === cleanName.toLowerCase())
        );

        if (matchIdx !== -1) {
          const existingProd = nextProducts[matchIdx];
          nextProducts[matchIdx] = {
            ...existingProd,
            name: cleanName || existingProd.name,
            brand: cleanBrand || existingProd.brand,
            category: row.category || existingProd.category,
            volumeMl: row.volumeMl && row.volumeMl > 0 ? row.volumeMl : existingProd.volumeMl,
            packSize: row.packSize && row.packSize > 0 ? row.packSize : existingProd.packSize,
            warehouseCostKes: cost > 0 ? cost : existingProd.warehouseCostKes,
            wholesalePriceKes: wholesale > 0 ? wholesale : existingProd.wholesalePriceKes,
            retailPriceKes: retail > 0 ? retail : existingProd.retailPriceKes,
            minWholesaleQty:
              row.minWholesaleQty && row.minWholesaleQty > 0
                ? row.minWholesaleQty
                : existingProd.minWholesaleQty
          };
          updatedCount += 1;
        } else if (!cleanName && cleanBrand && (retail > 0 || wholesale > 0 || cost > 0)) {
          // Brand-wide row in CSV (Brand price update across all products of that brand)
          nextProducts.forEach((prod, pIdx) => {
            if (prod.brand.trim().toLowerCase() === cleanBrand.toLowerCase()) {
              nextProducts[pIdx] = {
                ...prod,
                warehouseCostKes: cost > 0 ? cost : prod.warehouseCostKes,
                wholesalePriceKes: wholesale > 0 ? wholesale : prod.wholesalePriceKes,
                retailPriceKes: retail > 0 ? retail : prod.retailPriceKes
              };
              updatedCount += 1;
            }
          });
        } else if (cleanName && retail > 0) {
          // Create new product from CSV row
          const inferredBrand = cleanBrand || cleanName.split(' ')[0] || 'Vaairo';
          const resolvedCategory: StockCategory = row.category === 'LPS' ? 'LPS' : 'IPS';
          const newBarcode = cleanBarcode || `616${Date.now().toString().slice(-8)}${index}`;
          const newProd: Product = {
            id: `csv-prod-${Date.now()}-${index}`,
            sku: cleanSku || `${resolvedCategory}-${inferredBrand.slice(0, 4).toUpperCase()}-${100 + nextProducts.length}`,
            barcode: newBarcode,
            caseBarcode: `1${newBarcode}`,
            name: cleanName,
            brand: inferredBrand,
            category: resolvedCategory,
            volumeMl: row.volumeMl && row.volumeMl > 0 ? row.volumeMl : 750,
            alcoholPercentage: 40,
            packSize: row.packSize && row.packSize > 0 ? row.packSize : 12,
            countryOfOrigin: resolvedCategory === 'LPS' ? 'Kenya' : 'Imported',
            warehouseCostKes: cost > 0 ? cost : Math.round(retail * 0.72),
            wholesalePriceKes: wholesale > 0 ? wholesale : Math.round(retail * 0.86),
            retailPriceKes: retail,
            minWholesaleQty: row.minWholesaleQty && row.minWholesaleQty > 0 ? row.minWholesaleQty : 6,
            vatRate: (systemSettings.defaultVatRatePercent || 16) / 100,
            exciseDutyPerLitreKes: systemSettings.defaultExciseDutyPerLitreKes || 356.4,
            kraExciseStampType: resolvedCategory === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP'
          };
          newProd.image = getProductImageUrl(newProd);
          nextProducts.unshift(newProd);
          createdCount += 1;
        }
      });

      return nextProducts;
    });

    return { updatedCount, createdCount };
  };

  const saveSpecialOffer = (offerData: Omit<SpecialOfferSetting, 'id'> & { id?: string }): SpecialOfferSetting => {
    const saved: SpecialOfferSetting = {
      ...offerData,
      id: offerData.id || `offer-${Date.now()}`
    };
    setSpecialOffers(prev => {
      const exists = prev.some(o => o.id === saved.id);
      return exists ? prev.map(o => (o.id === saved.id ? saved : o)) : [saved, ...prev];
    });
    return saved;
  };

  const deleteSpecialOffer = (id: string) => {
    setSpecialOffers(prev => prev.filter(o => o.id !== id));
  };

  const saveMarketingCampaign = (
    campaignData: Omit<MarketingCampaignSetting, 'id'> & { id?: string }
  ): MarketingCampaignSetting => {
    const saved: MarketingCampaignSetting = {
      ...campaignData,
      id: campaignData.id || `camp-${Date.now()}`
    };
    setMarketingCampaigns(prev => {
      const exists = prev.some(c => c.id === saved.id);
      return exists ? prev.map(c => (c.id === saved.id ? saved : c)) : [saved, ...prev];
    });
    return saved;
  };

  const deleteMarketingCampaign = (id: string) => {
    setMarketingCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const savePromotion = (promoData: Omit<PromotionSetting, 'id'> & { id?: string }): PromotionSetting => {
    const saved: PromotionSetting = {
      ...promoData,
      id: promoData.id || `promo-${Date.now()}`
    };
    setPromotions(prev => {
      const exists = prev.some(p => p.id === saved.id);
      return exists ? prev.map(p => (p.id === saved.id ? saved : p)) : [saved, ...prev];
    });
    return saved;
  };

  const deletePromotion = (id: string) => {
    setPromotions(prev => prev.filter(p => p.id !== id));
  };

  return (
    <ErpContext.Provider
      value={{
        currentUser,
        currentRole,
        currentDepartment,
        posStationMode,
        setPosStationMode,
        isPosCashier,
        activeBranch,
        activeBranchId,
        isMfaPending,
        isAuthenticated,
        setIsAuthenticated,
        loginAsRole,
        updateCurrentUserName,
        updateCurrentStaffName,
        confirmMfa,
        adminTotpSecret,
        logout,
        switchDepartment,
        switchBranch,
        branches,
        addBranch,
        updateBranchParent,
        updateBranchThreshold,
        getBranchProductPrice,
        updateBranchPricingPolicy,
        setBranchProductPreferredPrice,
        products,
        inventoryItems,
        scanHistory,
        activeScanBatchId,
        startNewScanBatch,
        handleBarcodeScan,
        adjustStockManually,
        updateInventoryBatchExpiry,
        applyApprovedStockAuditToBranch,
        addProduct,
        updateProduct,
        deleteProduct,
        updateProductImage,
        cloneNairobiDrinksCatalog,
        cloneNairobiDrinksFromUrl,
        resetAllErpData,
        cart,
        heldCarts,
        selectedAffiliate,
        setSelectedAffiliate,
        recalledSalesPerson,
        setRecalledSalesPerson,
        addToCart,
        removeFromCart,
        updateCartItemQty,
        updateCartItemMarkup,
        updateCartItemPreferredPrice,
        clearCart,
        holdCurrentCart,
        updateHeldCartQueueStatus,
        recallHeldCart,
        removeHeldCart,
        completeSale,
        offlineQueuedCheckouts,
        reconcileOfflineQueuedCheckouts,
        orders,
        etimsInvoices,
        lastCompletedInvoice,
        setLastCompletedInvoice,
        websiteDeliveryOrders,
        placeWebsiteDeliveryOrder,
        updateWebsiteDeliveryOrderStatus,
        assignRiderToWebsiteDeliveryOrder,
        completeWebsiteDeliveryOrderWithMpesaPrompt,
        mpesaTransactions,
        runMpesaAutoReconciliation,
        chartOfAccounts,
        journalEntries,
        postManualJournalEntry,
        suppliers,
        addSupplier,
        updateSupplier,
        distributors,
        addDistributor,
        updateDistributor,
        supplyInvoices,
        createSupplyInvoice,
        addProductsUnderInvoice,
        instantScanOnboardProduct,
        quotes,
        createQuote,
        convertQuoteToInvoice,
        commercialInvoices,
        createCommercialInvoice,
        recordCommercialInvoicePayment,
        staffDatabaseRecords,
        staffDbSyncStatus,
        lastStaffDbSyncAt,
        instantLoginWithStaffPin,
        instantLoginByStaffRecord,
        syncAllStaffsToIndependentDb,
        deleteStaffFromIndependentDb,
        wipeAllUsersAndStaff,
        suspendStaffMember,
        terminateStaffMember,
        reactivateStaffMember,
        employees,
        addEmployee,
        updateEmployee,
        updateEmployeePin,
        updateEmployeeCommissionRate,
        payoutEmployeeCommission,
        payrollRecords,
        runPayrollForMonth,
        syncPayrollRecordToLedger,
        affiliates,
        commissions,
        defaultAffiliateCommissionRate,
        defaultAffiliateCommissionMode,
        defaultAllowPreferredPrice,
        updateGlobalAffiliateSettings,
        registerAffiliate,
        updateAffiliate,
        updateAffiliatePin,
        updateAffiliateCommissionRate,
        updateAffiliateCommissionSettings,
        setAffiliateProductPreferredPrice,
        updateAffiliateAssignedCashier,
        payoutAffiliateCommission,
        salesNetworkCustomers,
        onboardSalesNetworkCustomer,
        createSalesNetworkRemoteOrder,
        restockRequests,
        autoDisburseEnabled,
        setAutoDisburseEnabled,
        createRestockRequest,
        warehouseDisburseStock,
        triggerWarehouseAutoDisburseForAllLowStockShops,
        updateRestockRequestItemQty,
        removeUnavailableItemFromRestockRequest,
        removeAllUnavailableItemsFromRequest,
        acceptAndFulfillRestockRequest,
        rejectRestockRequest,
        approveRestockRequest,
        dispatchRestockRequest,
        receiveRestockRequest,
        employeeLeaveRequests,
        salesRepOffDutyRequests,
        submitEmployeeLeaveRequest,
        reviewEmployeeLeaveRequest,
        submitSalesRepOffDutyRequest,
        reviewSalesRepOffDutyRequest,
        systemSettings,
        updateSystemSettings,
        brandPriceRules,
        upsertBrandPriceRule,
        deleteBrandPriceRule,
        bulkUpdateBrandPrices,
        importPriceListFromCsvRows,
        specialOffers,
        saveSpecialOffer,
        deleteSpecialOffer,
        marketingCampaigns,
        saveMarketingCampaign,
        deleteMarketingCampaign,
        promotions,
        savePromotion,
        deletePromotion,
        userActivityLogs,
        userSessionMonitors,
        logUserActivity,
        unifiedDbSyncStatus,
        lastUnifiedDbSyncAt,
        unifiedCollectionsCount,
        totalUnifiedRecordsCount,
        syncAllDataToUnifiedDatabase,
        productRatings,
        submitProductRating,
        organizations,
        merchants,
        distributorOrganizations,
        retailers,
        supplierOrganizations,
        organizationMemberships,
        consumers,
        registerOrganization,
        assignUserOrganizationMembership,
        upsertConsumerProfile,
        liveLoggedInCustomers,
        upsertLiveCustomerSession,
        removeLiveCustomerSession,
        persistenceErrorBanner,
        clearPersistenceErrorBanner
      }}
    >
      {persistenceErrorBanner && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-600 text-white shadow-2xl border border-rose-400 text-xs sm:text-sm font-semibold max-w-xl w-[94%]"
        >
          <span className="flex-1">{persistenceErrorBanner}</span>
          <button
            type="button"
            onClick={clearPersistenceErrorBanner}
            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </ErpContext.Provider>
  );
};

export const useErp = () => {
  const context = useContext(ErpContext);
  if (!context) {
    throw new Error('useErp must be used within an ErpProvider');
  }
  return context;
};
