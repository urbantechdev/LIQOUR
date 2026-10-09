/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';

/**
 * Public Storefront Product Document (`productsPublic/{productId}`).
 * Strictly excludes commercial distributor secrets (`warehouseCostKes`, `wholesalePriceKes`,
 * `minWholesaleQty`, `exciseDutyPerLitreKes`, and `internalProvenance`).
 */
export interface PublicProductCatalogRecord {
  id: string;
  sku: string;
  barcode: string;
  caseBarcode: string;
  name: string;
  brand: string;
  category: Product['category'];
  subCategory: string;
  volumeMl: number;
  alcoholPercentage: number;
  packSize: number;
  countryOfOrigin: string;
  retailPriceKes: number;
  vatRate: number;
  kraExciseStampType: Product['kraExciseStampType'];
  image?: string;
  isCreamBased?: boolean;
  updatedAt: string;
}

/**
 * Private Commercial Pricing & Margin Document (`productsPrivate/{productId}`).
 * Restricted strictly to authenticated Organization members / Admins (`isAdmin() || isMemberOfOrganization(organizationId)`).
 */
export interface PrivateProductCommercialRecord {
  id: string;
  sku: string;
  organizationId: string;
  warehouseCostKes: number;
  wholesalePriceKes: number;
  minWholesaleQty: number;
  exciseDutyPerLitreKes: number;
  internalProvenance?: Product['internalProvenance'];
  updatedAt: string;
}

export function splitProductIntoPublicAndPrivate(
  product: Product,
  organizationId = 'org-merchant-vaairo-hq'
): {
  publicRecord: PublicProductCatalogRecord;
  privateRecord: PrivateProductCommercialRecord;
} {
  const nowIso = new Date().toISOString();

  const publicRecord: PublicProductCatalogRecord = {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    caseBarcode: product.caseBarcode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subCategory: product.subCategory || 'General',
    volumeMl: product.volumeMl,
    alcoholPercentage: product.alcoholPercentage,
    packSize: product.packSize,
    countryOfOrigin: product.countryOfOrigin,
    retailPriceKes: product.retailPriceKes,
    vatRate: product.vatRate,
    kraExciseStampType: product.kraExciseStampType,
    ...(product.image ? { image: product.image } : {}),
    ...(typeof product.isCreamBased === 'boolean' ? { isCreamBased: product.isCreamBased } : {}),
    updatedAt: nowIso
  };

  const privateRecord: PrivateProductCommercialRecord = {
    id: product.id,
    sku: product.sku,
    organizationId,
    warehouseCostKes: product.warehouseCostKes,
    wholesalePriceKes: product.wholesalePriceKes,
    minWholesaleQty: product.minWholesaleQty,
    exciseDutyPerLitreKes: product.exciseDutyPerLitreKes,
    ...(product.internalProvenance ? { internalProvenance: product.internalProvenance } : {}),
    updatedAt: nowIso
  };

  return { publicRecord, privateRecord };
}

export function stripCommercialPricingFromPublicProduct(
  product: Product | Record<string, unknown>
): PublicProductCatalogRecord {
  const copy = { ...(product as Record<string, unknown>) };
  delete copy.warehouseCostKes;
  delete copy.wholesalePriceKes;
  delete copy.minWholesaleQty;
  delete copy.exciseDutyPerLitreKes;
  delete copy.internalProvenance;
  delete copy.sourceUrl;
  return {
    ...(copy as unknown as PublicProductCatalogRecord),
    updatedAt: String(copy.updatedAt || new Date().toISOString())
  };
}
