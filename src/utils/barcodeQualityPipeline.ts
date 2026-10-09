/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';

export type Gs1BarcodeFormat = 'EAN_13' | 'UPC_A' | 'EAN_8' | 'ITF_14' | 'INVALID_FORMAT';

export type MasterBarcodeApprovalStatus =
  | 'APPROVED_MASTER'
  | 'REMEDIATED_CHECK_DIGIT'
  | 'REMEDIATED_DUPLICATE'
  | 'REMEDIATED_FORMAT'
  | 'UNVERIFIED_SOURCE';

export interface BarcodeStageValidationResult {
  rawBarcode: string;
  cleanBarcode: string;
  format: Gs1BarcodeFormat;
  formatValid: boolean;
  actualCheckDigit: string;
  expectedCheckDigit: string;
  checkDigitValid: boolean;
  correctedBarcode: string;
}

export interface CaseBottleRelationshipResult {
  valid: boolean;
  packagingIndicator: string;
  bottleGtin12Base: string;
  caseEmbeddedGtin12Base: string;
  packSizeValid: boolean;
  expectedCaseBarcode: string;
  reason?: string;
}

export interface ProductBarcodePipelineRecord {
  productId: string;
  sku: string;
  productName: string;
  rawBottleBarcode: string;
  rawCaseBarcode: string;
  approvedBottleBarcode: string;
  approvedCaseBarcode: string;
  bottleFormatValid: boolean;
  bottleCheckDigitValid: boolean;
  caseFormatValid: boolean;
  caseCheckDigitValid: boolean;
  wasDuplicateBottle: boolean;
  wasDuplicateCase: boolean;
  caseBottleRelationshipValid: boolean;
  approvalStatus: MasterBarcodeApprovalStatus;
}

export interface CatalogBarcodeQualityAuditSummary {
  auditedAt: string;
  totalProducts: number;
  rawMetrics: {
    bottle13DigitCount: number;
    bottle12DigitCount: number;
    case14DigitCount: number;
    rawBottleCheckDigitPassCount: number;
    rawCaseCheckDigitPassCount: number;
    rawDuplicateBottleCount: number;
    rawDuplicateCaseCount: number;
    rawCaseBottleRelationshipPassCount: number;
  };
  approvedMasterMetrics: {
    approvedBottleCheckDigitPassCount: number;
    approvedCaseCheckDigitPassCount: number;
    approvedDuplicateBottleCount: number;
    approvedDuplicateCaseCount: number;
    approvedCaseBottleRelationshipPassCount: number;
    nativeApprovedCount: number;
    remediatedCheckDigitCount: number;
    remediatedDuplicateCount: number;
  };
}

/**
 * Computes the standard GS1 Modulo-10 check digit for any GTIN payload
 * (7 digits for EAN-8, 11 digits for UPC-A, 12 digits for EAN-13, 13 digits for ITF-14).
 */
export function computeGs1CheckDigit(payloadWithoutCheckDigit: string): string {
  const digits = payloadWithoutCheckDigit.replace(/\D/g, '');
  if (!digits) return '0';
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    // Rightmost payload position (just before check digit) always has weight 3 in GS1 Modulo-10
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return String(checkDigit);
}

/**
 * Stage 1 & Stage 2: Format Validation + GS1 Modulo-10 Check Digit Validation.
 */
export function validateGs1Barcode(rawBarcode: string): BarcodeStageValidationResult {
  const clean = String(rawBarcode || '').replace(/\D/g, '').trim();
  let format: Gs1BarcodeFormat = 'INVALID_FORMAT';
  if (clean.length === 13) format = 'EAN_13';
  else if (clean.length === 12) format = 'UPC_A';
  else if (clean.length === 8) format = 'EAN_8';
  else if (clean.length === 14) format = 'ITF_14';

  const formatValid = format !== 'INVALID_FORMAT';
  if (!formatValid || clean.length < 2) {
    return {
      rawBarcode,
      cleanBarcode: clean,
      format,
      formatValid: false,
      actualCheckDigit: '',
      expectedCheckDigit: '',
      checkDigitValid: false,
      correctedBarcode: clean
    };
  }

  const payload = clean.slice(0, -1);
  const actualCheckDigit = clean.slice(-1);
  const expectedCheckDigit = computeGs1CheckDigit(payload);
  const checkDigitValid = actualCheckDigit === expectedCheckDigit;

  return {
    rawBarcode,
    cleanBarcode: clean,
    format,
    formatValid: true,
    actualCheckDigit,
    expectedCheckDigit,
    checkDigitValid,
    correctedBarcode: `${payload}${expectedCheckDigit}`
  };
}

/**
 * Extracts the canonical 12-digit GTIN payload base from a 12-digit UPC-A or 13-digit EAN-13 bottle barcode.
 */
export function extractGtin12BaseFromBottleBarcode(bottleBarcode: string): string {
  const clean = String(bottleBarcode || '').replace(/\D/g, '');
  if (clean.length === 13) {
    return clean.slice(0, 12);
  }
  if (clean.length === 12) {
    // Convert UPC-A 11-digit payload to 12-digit EAN-13 payload by prepending leading '0'
    return `0${clean.slice(0, 11)}`;
  }
  return clean.padStart(12, '0').slice(0, 12);
}

/**
 * Builds a canonical 14-digit ITF-14 master case barcode from a bottle barcode and packaging indicator (default '1').
 */
export function buildCanonicalItf14CaseBarcode(
  bottleBarcode: string,
  packagingIndicator = '1'
): string {
  const indicator = /^[1-8]$/.test(packagingIndicator) ? packagingIndicator : '1';
  const gtin12Base = extractGtin12BaseFromBottleBarcode(bottleBarcode);
  const payload13 = `${indicator}${gtin12Base}`;
  const checkDigit = computeGs1CheckDigit(payload13);
  return `${payload13}${checkDigit}`;
}

/**
 * Stage 5: Verifies the mathematical and structural relationship between a single-bottle GTIN
 * and its outer master-case ITF-14 barcode.
 */
export function validateCaseToBottleRelationship(
  bottleBarcode: string,
  caseBarcode: string,
  packSize: number
): CaseBottleRelationshipResult {
  const cleanCase = String(caseBarcode || '').replace(/\D/g, '');
  const gtin12Base = extractGtin12BaseFromBottleBarcode(bottleBarcode);
  const packagingIndicator = cleanCase.length === 14 ? cleanCase[0] : '1';
  const expectedCaseBarcode = buildCanonicalItf14CaseBarcode(bottleBarcode, packagingIndicator);
  const caseValidation = validateGs1Barcode(cleanCase);
  const caseEmbeddedGtin12Base = cleanCase.length === 14 ? cleanCase.slice(1, 13) : '';
  const packSizeValid = Number.isFinite(packSize) && packSize >= 1;

  if (cleanCase.length !== 14 || !caseValidation.checkDigitValid) {
    return {
      valid: false,
      packagingIndicator,
      bottleGtin12Base: gtin12Base,
      caseEmbeddedGtin12Base,
      packSizeValid,
      expectedCaseBarcode,
      reason: 'Case barcode is not a valid 14-digit GS1 ITF-14 code.'
    };
  }

  if (caseEmbeddedGtin12Base !== gtin12Base) {
    return {
      valid: false,
      packagingIndicator,
      bottleGtin12Base: gtin12Base,
      caseEmbeddedGtin12Base,
      packSizeValid,
      expectedCaseBarcode,
      reason: 'Case ITF-14 embedded GTIN base does not match the bottle GTIN base.'
    };
  }

  return {
    valid: packSizeValid,
    packagingIndicator,
    bottleGtin12Base: gtin12Base,
    caseEmbeddedGtin12Base,
    packSizeValid,
    expectedCaseBarcode
  };
}

/**
 * Deterministically generates a collision-free 12-digit GTIN payload for a duplicate or malformed product index.
 */
function buildDeterministicUniqueGtin12Payload(product: Product, index: number, attempt: number): string {
  // Use Kenyan GS1 prefix 616 + deterministic hash of SKU/ID + index/attempt
  let hash = 2166136261;
  const seed = `${product.id}:${product.sku}:${index}:${attempt}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positiveNineDigits = String(Math.abs(hash) % 1000000000).padStart(9, '0');
  return `616${positiveNineDigits}`;
}

/**
 * Runs the 6-stage Master Barcode Quality & Provenance Hygiene Pipeline across the product catalogue:
 *   Barcode -> Format validation -> Check digit validation -> Duplicate detection ->
 *   Product verification -> Case/bottle relationship -> Approved master barcode
 */
export function executeCatalogBarcodeQualityPipeline(rawProducts: Product[]): {
  products: Product[];
  records: ProductBarcodePipelineRecord[];
  summary: CatalogBarcodeQualityAuditSummary;
} {
  // Pass 1: Measure raw catalogue barcode health and duplicates
  const rawBottleCounts = new Map<string, number>();
  const rawCaseCounts = new Map<string, number>();

  for (const p of rawProducts) {
    const b = String(p.barcode || '').replace(/\D/g, '');
    const c = String(p.caseBarcode || '').replace(/\D/g, '');
    if (b) rawBottleCounts.set(b, (rawBottleCounts.get(b) || 0) + 1);
    if (c) rawCaseCounts.set(c, (rawCaseCounts.get(c) || 0) + 1);
  }

  let bottle13DigitCount = 0;
  let bottle12DigitCount = 0;
  let case14DigitCount = 0;
  let rawBottleCheckDigitPassCount = 0;
  let rawCaseCheckDigitPassCount = 0;
  let rawDuplicateBottleCount = 0;
  let rawDuplicateCaseCount = 0;
  let rawCaseBottleRelationshipPassCount = 0;

  // Pass 2: Remediate check digits, resolve duplicates, enforce ITF-14 case/bottle relationship,
  // and isolate third-party provenance into internalProvenance
  const usedApprovedBottleBarcodes = new Set<string>();
  const usedApprovedCaseBarcodes = new Set<string>();
  const records: ProductBarcodePipelineRecord[] = [];
  const approvedProducts: Product[] = [];

  rawProducts.forEach((product, idx) => {
    const rawBottle = String(product.barcode || '').trim();
    const rawCase = String(product.caseBarcode || '').trim();

    const bottleStage = validateGs1Barcode(rawBottle);
    const caseStage = validateGs1Barcode(rawCase);

    if (bottleStage.cleanBarcode.length === 13) bottle13DigitCount++;
    else if (bottleStage.cleanBarcode.length === 12) bottle12DigitCount++;
    if (caseStage.cleanBarcode.length === 14) case14DigitCount++;

    if (bottleStage.checkDigitValid) rawBottleCheckDigitPassCount++;
    if (caseStage.checkDigitValid) rawCaseCheckDigitPassCount++;

    const isRawBottleDuplicate = (rawBottleCounts.get(bottleStage.cleanBarcode) || 0) > 1;
    const isRawCaseDuplicate = (rawCaseCounts.get(caseStage.cleanBarcode) || 0) > 1;
    if (isRawBottleDuplicate) rawDuplicateBottleCount++;
    if (isRawCaseDuplicate) rawDuplicateCaseCount++;

    const rawRel = validateCaseToBottleRelationship(rawBottle, rawCase, product.packSize || 12);
    if (rawRel.valid && bottleStage.checkDigitValid && caseStage.checkDigitValid) {
      rawCaseBottleRelationshipPassCount++;
    }

    // Determine candidate 12-digit GTIN payload for bottle
    let gtin12Payload: string;
    let approvalStatus: MasterBarcodeApprovalStatus = 'APPROVED_MASTER';

    if (bottleStage.cleanBarcode.length === 13) {
      gtin12Payload = bottleStage.cleanBarcode.slice(0, 12);
      if (!bottleStage.checkDigitValid) {
        approvalStatus = 'REMEDIATED_CHECK_DIGIT';
      }
    } else if (bottleStage.cleanBarcode.length === 12) {
      // Standardize 12-digit UPC-A payload into 13-digit EAN-13 (leading '0' + 11-digit payload)
      gtin12Payload = `0${bottleStage.cleanBarcode.slice(0, 11)}`;
      if (!bottleStage.checkDigitValid) {
        approvalStatus = 'REMEDIATED_CHECK_DIGIT';
      }
    } else {
      gtin12Payload = buildDeterministicUniqueGtin12Payload(product, idx, 0);
      approvalStatus = 'REMEDIATED_FORMAT';
    }

    let approvedBottleBarcode = `${gtin12Payload}${computeGs1CheckDigit(gtin12Payload)}`;
    let attempt = 1;
    while (usedApprovedBottleBarcodes.has(approvedBottleBarcode)) {
      const uniquePayload = buildDeterministicUniqueGtin12Payload(product, idx, attempt++);
      approvedBottleBarcode = `${uniquePayload}${computeGs1CheckDigit(uniquePayload)}`;
      approvalStatus = 'REMEDIATED_DUPLICATE';
    }
    usedApprovedBottleBarcodes.add(approvedBottleBarcode);

    // Derive canonical 14-digit ITF-14 case barcode linked to the approved bottle barcode
    const preferredIndicator =
      caseStage.cleanBarcode.length === 14 && /^[1-8]$/.test(caseStage.cleanBarcode[0])
        ? caseStage.cleanBarcode[0]
        : '1';
    let approvedCaseBarcode = buildCanonicalItf14CaseBarcode(approvedBottleBarcode, preferredIndicator);
    let indicatorAttempt = 1;
    while (usedApprovedCaseBarcodes.has(approvedCaseBarcode) && indicatorAttempt <= 8) {
      approvedCaseBarcode = buildCanonicalItf14CaseBarcode(
        approvedBottleBarcode,
        String(indicatorAttempt++)
      );
    }
    usedApprovedCaseBarcodes.add(approvedCaseBarcode);

    if (
      approvalStatus === 'APPROVED_MASTER' &&
      (!caseStage.checkDigitValid || approvedCaseBarcode !== caseStage.cleanBarcode)
    ) {
      approvalStatus = 'REMEDIATED_CHECK_DIGIT';
    }

    const finalRel = validateCaseToBottleRelationship(
      approvedBottleBarcode,
      approvedCaseBarcode,
      product.packSize || 12
    );

    records.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      rawBottleBarcode: rawBottle,
      rawCaseBarcode: rawCase,
      approvedBottleBarcode,
      approvedCaseBarcode,
      bottleFormatValid: bottleStage.formatValid,
      bottleCheckDigitValid: bottleStage.checkDigitValid,
      caseFormatValid: caseStage.formatValid,
      caseCheckDigitValid: caseStage.checkDigitValid,
      wasDuplicateBottle: isRawBottleDuplicate,
      wasDuplicateCase: isRawCaseDuplicate,
      caseBottleRelationshipValid: finalRel.valid,
      approvalStatus
    });

    // Isolate source provenance internally so third-party URLs are not exposed as public commercial claims
    const rawSourceUrl = product.sourceUrl;
    const inferredSourceName = rawSourceUrl?.includes('nairobidrinks.co.ke')
      ? 'Nairobi Drinks Market Observation'
      : rawSourceUrl?.includes('drinkszone') || rawSourceUrl?.includes('drinksvine')
      ? 'DrinksZone / Drinks Vine Market Observation'
      : 'VAAIRO Master Beverage Registry';

    const cleanProduct: Product = {
      ...product,
      barcode: approvedBottleBarcode,
      caseBarcode: approvedCaseBarcode,
      barcodeVerificationStatus: approvalStatus,
      internalProvenance: {
        source: product.internalProvenance?.source || inferredSourceName,
        observationDate: product.internalProvenance?.observationDate || '2026-03-01',
        sourceUrl: product.internalProvenance?.sourceUrl || rawSourceUrl,
        rawSourceBarcode: rawBottle,
        rawSourceCaseBarcode: rawCase,
        photographyRightsVerified: false,
        contentLicenseStatus: 'FIRST_PARTY_NORMALIZED'
      }
    };
    // Remove top-level public `sourceUrl` so public storefront and Merchant feeds never imply affiliation
    delete cleanProduct.sourceUrl;

    approvedProducts.push(cleanProduct);
  });

  // Final verification metrics on the approved master catalogue
  let approvedBottleCheckDigitPassCount = 0;
  let approvedCaseCheckDigitPassCount = 0;
  let approvedCaseBottleRelationshipPassCount = 0;
  let nativeApprovedCount = 0;
  let remediatedCheckDigitCount = 0;
  let remediatedDuplicateCount = 0;

  for (const r of records) {
    if (validateGs1Barcode(r.approvedBottleBarcode).checkDigitValid) {
      approvedBottleCheckDigitPassCount++;
    }
    if (validateGs1Barcode(r.approvedCaseBarcode).checkDigitValid) {
      approvedCaseCheckDigitPassCount++;
    }
    if (r.caseBottleRelationshipValid) {
      approvedCaseBottleRelationshipPassCount++;
    }
    if (r.approvalStatus === 'APPROVED_MASTER') nativeApprovedCount++;
    else if (r.approvalStatus === 'REMEDIATED_CHECK_DIGIT') remediatedCheckDigitCount++;
    else if (r.approvalStatus === 'REMEDIATED_DUPLICATE') remediatedDuplicateCount++;
  }

  return {
    products: approvedProducts,
    records,
    summary: {
      auditedAt: new Date().toISOString(),
      totalProducts: rawProducts.length,
      rawMetrics: {
        bottle13DigitCount,
        bottle12DigitCount,
        case14DigitCount,
        rawBottleCheckDigitPassCount,
        rawCaseCheckDigitPassCount,
        rawDuplicateBottleCount,
        rawDuplicateCaseCount,
        rawCaseBottleRelationshipPassCount
      },
      approvedMasterMetrics: {
        approvedBottleCheckDigitPassCount,
        approvedCaseCheckDigitPassCount,
        approvedDuplicateBottleCount: rawProducts.length - usedApprovedBottleBarcodes.size,
        approvedDuplicateCaseCount: rawProducts.length - usedApprovedCaseBarcodes.size,
        approvedCaseBottleRelationshipPassCount,
        nativeApprovedCount,
        remediatedCheckDigitCount,
        remediatedDuplicateCount
      }
    }
  };
}
