/**
 * Kenyan Tax & Statutory Payroll Engine
 * Accurately implements 2024-2026 Kenyan Finance Regulations:
 * - Configurable Tax Engine (VAT 16% Inclusive/Exclusive, Zero-Rated, Exempt, Custom Rates)
 * - PAYE Tax Bands with KES 2,400 Monthly Personal Relief
 * - NSSF Act 2013 (Tier I & Tier II)
 * - SHIF (Social Health Insurance Fund at 2.75% replacing NHIF)
 * - Affordable Housing Levy (1.5%)
 */

import {
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_TAX_RULES,
  TaxRuleConfig,
  resolveActiveTaxRule
} from '../config/erpConfig';

export interface TaxCalculationResult {
  taxRuleId: string;
  taxCode: string;
  taxName: string;
  ratePercent: number;
  inclusive: boolean;
  taxableAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export function formatKes(amount: number, currencyCode: string = DEFAULT_BRANDING_CONFIG.currencyCode): string {
  return new Intl.NumberFormat(DEFAULT_BRANDING_CONFIG.locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace(currencyCode, `${currencyCode} `);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat(DEFAULT_BRANDING_CONFIG.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Configurable tax calculation supporting tax-inclusive, tax-exclusive, zero-rated, and exempt rules.
 */
export function calculateConfigurableTax(
  amount: number,
  options?: {
    taxCode?: string;
    ratePercentOverride?: number;
    inclusiveOverride?: boolean;
    customRules?: TaxRuleConfig[];
  }
): TaxCalculationResult {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const rule = resolveActiveTaxRule(options?.taxCode, options?.customRules || DEFAULT_TAX_RULES);
  const ratePercent =
    typeof options?.ratePercentOverride === 'number' && options.ratePercentOverride >= 0
      ? options.ratePercentOverride
      : rule.ratePercent;
  const inclusive =
    typeof options?.inclusiveOverride === 'boolean' ? options.inclusiveOverride : rule.inclusive;

  if (ratePercent <= 0) {
    const rounded = Math.round(safeAmount * 100) / 100;
    return {
      taxRuleId: rule.id,
      taxCode: rule.code,
      taxName: rule.name,
      ratePercent: 0,
      inclusive,
      taxableAmount: rounded,
      vatAmount: 0,
      grossAmount: rounded
    };
  }

  const rateDecimal = ratePercent / 100;
  if (inclusive) {
    const grossAmount = Math.round(safeAmount * 100) / 100;
    const taxableAmount = Math.round((grossAmount / (1 + rateDecimal)) * 100) / 100;
    const vatAmount = Math.round((grossAmount - taxableAmount) * 100) / 100;
    return {
      taxRuleId: rule.id,
      taxCode: rule.code,
      taxName: rule.name,
      ratePercent,
      inclusive: true,
      taxableAmount,
      vatAmount,
      grossAmount
    };
  } else {
    const taxableAmount = Math.round(safeAmount * 100) / 100;
    const vatAmount = Math.round(taxableAmount * rateDecimal * 100) / 100;
    const grossAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;
    return {
      taxRuleId: rule.id,
      taxCode: rule.code,
      taxName: rule.name,
      ratePercent,
      inclusive: false,
      taxableAmount,
      vatAmount,
      grossAmount
    };
  }
}

/**
 * Calculates VAT breakdown (defaults to active Standard VAT rule, with optional custom rate/inclusivity)
 */
export function calculateVatBreakdown(
  totalAmount: number,
  ratePercent?: number,
  inclusive: boolean = true
) {
  const result = calculateConfigurableTax(totalAmount, {
    ratePercentOverride: ratePercent,
    inclusiveOverride: inclusive
  });
  return {
    taxableAmount: result.taxableAmount,
    vatAmount: result.vatAmount,
    grossAmount: result.grossAmount,
    ratePercent: result.ratePercent,
    inclusive: result.inclusive
  };
}

/**
 * Computes Kenyan NSSF (Tier I & Tier II)
 * Tier I: 6% of pensionable earnings up to KES 7,000 (Max 420)
 * Tier II: 6% of pensionable earnings between KES 7,001 and KES 36,000 (Max 1,740)
 */
export function calculateNssf(grossSalary: number): { tier1: number; tier2: number; totalNssf: number } {
  const tier1Limit = 7000;
  const tier2Limit = 36000;

  const tier1 = Math.min(grossSalary, tier1Limit) * 0.06;
  let tier2 = 0;
  if (grossSalary > tier1Limit) {
    const tier2Earnings = Math.min(grossSalary - tier1Limit, tier2Limit - tier1Limit);
    tier2 = tier2Earnings * 0.06;
  }

  const totalNssf = Math.round((tier1 + tier2) * 100) / 100;
  return { tier1: Math.round(tier1 * 100) / 100, tier2: Math.round(tier2 * 100) / 100, totalNssf };
}

/**
 * Computes SHIF (Social Health Insurance Fund)
 * 2.75% of Gross Salary (Minimum KES 300)
 */
export function calculateShif(grossSalary: number): number {
  const calculated = grossSalary * 0.0275;
  return Math.round(Math.max(calculated, 300) * 100) / 100;
}

/**
 * Computes Affordable Housing Levy
 * 1.5% of Gross Salary employee contribution
 */
export function calculateHousingLevy(grossSalary: number): number {
  return Math.round(grossSalary * 0.015 * 100) / 100;
}

/**
 * Computes KRA PAYE (Pay As You Earn)
 * Current Kenyan Monthly Tax Bands:
 * 1. Up to KES 24,000 @ 10%
 * 2. Next KES 8,333 (24,001 to 32,333) @ 25%
 * 3. Next KES 467,667 (32,334 to 500,000) @ 30%
 * 4. Next KES 300,000 (500,001 to 800,000) @ 32.5%
 * 5. Above KES 800,000 @ 35%
 * Personal Relief = KES 2,400 per month
 */
export function calculatePaye(grossSalary: number, nssfDeduction: number): number {
  // Taxable pay after allowable statutory pension (NSSF)
  const taxablePay = Math.max(0, grossSalary - nssfDeduction);
  let tax = 0;

  if (taxablePay <= 24000) {
    tax = taxablePay * 0.10;
  } else if (taxablePay <= 32333) {
    tax = (24000 * 0.10) + ((taxablePay - 24000) * 0.25);
  } else if (taxablePay <= 500000) {
    tax = (24000 * 0.10) + (8333 * 0.25) + ((taxablePay - 32333) * 0.30);
  } else if (taxablePay <= 800000) {
    tax = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + ((taxablePay - 500000) * 0.325);
  } else {
    tax = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + (300000 * 0.325) + ((taxablePay - 800000) * 0.35);
  }

  // Deduct personal relief (KES 2,400 per month)
  const netPaye = Math.max(0, tax - 2400);
  return Math.round(netPaye * 100) / 100;
}

export function computePayroll(basicSalary: number, allowances: number) {
  const grossSalary = basicSalary + allowances;
  const { totalNssf } = calculateNssf(grossSalary);
  const shif = calculateShif(grossSalary);
  const housingLevy = calculateHousingLevy(grossSalary);
  const paye = calculatePaye(grossSalary, totalNssf);
  
  const totalDeductions = totalNssf + shif + housingLevy + paye;
  const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

  return {
    grossSalary,
    nssf: totalNssf,
    shif,
    housingLevy,
    paye,
    totalDeductions,
    netSalary
  };
}
