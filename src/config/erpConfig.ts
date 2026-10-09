/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized ERP Business, Branding, Tax, Accounting & Email Configuration
 * Eliminates hardcoded VAT rates, branch names, currency strings, and branding across components.
 */

export interface TaxRuleConfig {
  id: string;
  code: 'STANDARD_VAT' | 'ZERO_RATED' | 'EXEMPT' | 'EXCISE_DUTY' | string;
  name: string;
  ratePercent: number;
  inclusive: boolean;
  effectiveFrom: string;
  category: 'VAT' | 'EXCISE' | 'WITHHOLDING' | 'LEVY';
  active: boolean;
  kraTaxCode: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface ErpBrandingConfig {
  companyName: string;
  tradingName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  defaultBranchId: string;
  kraPin: string;
  supportEmail: string;
  emailDomain: string;
  supportPhone: string;
  headquartersAddress: string;
}

export interface DocumentNumberingConfig {
  quotationPrefix: string;
  invoicePrefix: string;
  receiptPrefix: string;
  purchaseOrderPrefix: string;
  stockTransferPrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  journalEntryPrefix: string;
  saleOrderPrefix: string;
}

export const DEFAULT_BRANDING_CONFIG: ErpBrandingConfig = {
  companyName: 'VAAIRO BEVERAGES & LIQUOR HUB LTD',
  tradingName: 'VAAIRO ERP',
  tagline: 'Choose it, get it, Drink it',
  primaryColor: '#0A006E',
  secondaryColor: '#FFDE00',
  accentColor: '#34D186',
  logoUrl: '/icon.svg',
  faviconUrl: '/icon.svg',
  currencyCode: 'KES',
  currencySymbol: 'KES ',
  locale: 'en-KE',
  defaultBranchId: 'branch-1',
  kraPin: 'P051829301A',
  supportEmail: 'support@urbantechdev.com',
  emailDomain: 'urbantechdev.com',
  supportPhone: '+254 700 882 476',
  headquartersAddress: 'Westlands Commercial Centre, Ring Road Parklands, Nairobi, Kenya'
};

export const DEFAULT_DOCUMENT_NUMBERING: DocumentNumberingConfig = {
  quotationPrefix: 'QUO',
  invoicePrefix: 'INV',
  receiptPrefix: 'RCT',
  purchaseOrderPrefix: 'PO',
  stockTransferPrefix: 'TRF',
  creditNotePrefix: 'CN',
  debitNotePrefix: 'DN',
  journalEntryPrefix: 'JE',
  saleOrderPrefix: 'ORD'
};

export const DEFAULT_TAX_RULES: TaxRuleConfig[] = [
  {
    id: 'tax-vat-standard-16',
    code: 'STANDARD_VAT',
    name: 'Kenya Standard VAT (16%)',
    ratePercent: 16,
    inclusive: true,
    effectiveFrom: '2024-01-01',
    category: 'VAT',
    active: true,
    kraTaxCode: 'B'
  },
  {
    id: 'tax-vat-zero-0',
    code: 'ZERO_RATED',
    name: 'Zero-Rated Supply (0%)',
    ratePercent: 0,
    inclusive: true,
    effectiveFrom: '2024-01-01',
    category: 'VAT',
    active: true,
    kraTaxCode: 'C'
  },
  {
    id: 'tax-vat-exempt',
    code: 'EXEMPT',
    name: 'Tax Exempt Supply',
    ratePercent: 0,
    inclusive: false,
    effectiveFrom: '2024-01-01',
    category: 'VAT',
    active: true,
    kraTaxCode: 'A'
  },
  {
    id: 'tax-vat-exclusive-16',
    code: 'STANDARD_VAT_EXCLUSIVE',
    name: 'Kenya Standard VAT Exclusive (16%)',
    ratePercent: 16,
    inclusive: false,
    effectiveFrom: '2024-01-01',
    category: 'VAT',
    active: true,
    kraTaxCode: 'B'
  }
];

export const STANDARD_CHART_OF_ACCOUNTS = {
  CASH_ON_HAND: { code: '1010', name: 'Cash on Hand (Tills)', type: 'ASSET' as const },
  MPESA_CLEARING: { code: '1020', name: 'M-Pesa Clearing & Settlement', type: 'ASSET' as const },
  CARD_BANK_SETTLEMENT: { code: '1030', name: 'Corporate Bank & Card Settlement', type: 'ASSET' as const },
  ACCOUNTS_RECEIVABLE: { code: '1100', name: 'Trade Accounts Receivable', type: 'ASSET' as const },
  INVENTORY_ASSET: { code: '1200', name: 'Merchandise Inventory Asset', type: 'ASSET' as const },
  ACCOUNTS_PAYABLE: { code: '2010', name: 'Trade Accounts Payable (Suppliers)', type: 'LIABILITY' as const },
  VAT_OUTPUT_LIABILITY: { code: '2020', name: 'Value Added Tax (VAT) Output Liability', type: 'LIABILITY' as const },
  SALES_REVENUE: { code: '4010', name: 'Beverage Sales Revenue', type: 'REVENUE' as const },
  SALES_RETURNS_ALLOWANCES: { code: '4020', name: 'Sales Returns & Refunds Contra', type: 'REVENUE' as const },
  COST_OF_GOODS_SOLD: { code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' as const },
  INVENTORY_SHRINKAGE_EXPENSE: { code: '5030', name: 'Inventory Shrinkage & Write-Off Expense', type: 'EXPENSE' as const }
};

/**
 * Resolves the active tax rule by code or returns the active default standard VAT rule.
 */
export function resolveActiveTaxRule(
  taxCode?: string,
  customRules: TaxRuleConfig[] = DEFAULT_TAX_RULES,
  asOfDateIso?: string
): TaxRuleConfig {
  const refDate = asOfDateIso ? new Date(asOfDateIso).getTime() : Date.now();
  const activeRules = customRules.filter(r => {
    if (!r.active) return false;
    const eff = new Date(r.effectiveFrom).getTime();
    return Number.isNaN(eff) || eff <= refDate;
  });

  if (taxCode) {
    const matched = activeRules.find(r => r.code === taxCode || r.id === taxCode);
    if (matched) return matched;
  }

  return (
    activeRules.find(r => r.code === 'STANDARD_VAT') ||
    DEFAULT_TAX_RULES[0]
  );
}
