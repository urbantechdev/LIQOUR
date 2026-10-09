import { Product, InventoryItem } from '../types';

export interface MerchantFeedItem {
  id: string; // g:id (Unique SKU identifier, e.g. IPS-WHISKY-002)
  title: string; // g:title (Product Name)
  description: string; // g:description (Clean product description, no marketing fluff)
  link: string; // g:link (Direct canonical product landing page URL)
  image_link: string; // g:image_link (Direct URL to primary product image >= 500x500px)
  availability: 'in_stock' | 'out_of_stock'; // g:availability
  price: string; // g:price formatted with currency code (e.g., "3200.00 KES")
  brand: string; // g:brand
  gtin: string; // g:gtin (Barcode/GTIN number)
  condition: 'new';
  mpn: string;
  stockBottles: number;
  rawPriceKes: number;
}

export interface MerchantDiagnosticResult {
  totalProducts: number;
  inStockCount: number;
  outOfStockCount: number;
  validRichResultsCount: number;
  validMerchantItemsCount: number;
  warnings: Array<{
    sku: string;
    productName: string;
    field: string;
    message: string;
  }>;
  lastGeneratedAt: string;
}

/**
 * Escapes special XML characters to ensure well-formed RSS 2.0 XML output.
 */
function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapes CSV values according to RFC 4180.
 */
function escapeCsv(val: string): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generates a clean, factual product description without promotional fluff or duplicate text,
 * strictly compliant with Google Merchant Center and Schema.org guidelines.
 */
export function buildCleanProductDescription(product: Product): string {
  const volume = product.volumeMl || 750;
  const abv = product.alcoholPercentage || 40;
  const origin = product.countryOfOrigin || (product.category === 'IPS' ? 'Imported' : 'Kenya');
  const subCat = product.subCategory || (product.category === 'IPS' ? 'Imported Spirit' : 'Local Beverage');
  const packInfo = product.packSize ? `${product.packSize} units per case` : 'standard bottle pack';

  return `${product.name} by ${product.brand}. Category: ${subCat} (${volume}ml, ${abv}% ABV). Country of origin: ${origin} (${packInfo}). Authentic KRA tax-compliant beverage available at Direct Company Price of KES ${product.retailPriceKes.toFixed(2)} (SKU: ${product.sku}, GTIN: ${product.barcode}).`;
}

/**
 * Resolves a high-resolution (minimum 500x500px, 800x800px canonical) clean product image URL
 * compliant with Google Merchant Center specifications.
 */
export function resolveHighResProductImageUrl(
  product: Product,
  siteOrigin: string = 'https://liqour.urbantechdev.com',
  fallbackAssetUrl?: string
): string {
  const cleanOrigin = siteOrigin.replace(/\/website\/?$/i, '').replace(/\/+$/, '');
  const rawImg = (product.image || fallbackAssetUrl || '').trim();

  if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
    return rawImg;
  }

  if (rawImg.startsWith('/')) {
    return `${cleanOrigin}${rawImg}`;
  }

  // Canonical high-resolution (800x800px) clean studio bottle image endpoint served by backend
  return `${cleanOrigin}/api/product-image/${encodeURIComponent(product.sku)}.svg`;
}

/**
 * Builds the canonical product landing page URL on https://liqour.urbantechdev.com/website.
 */
export function buildCanonicalProductUrl(
  product: Product,
  siteOrigin: string = 'https://liqour.urbantechdev.com'
): string {
  const cleanOrigin = siteOrigin.replace(/\/website\/?$/i, '').replace(/\/+$/, '');
  return `${cleanOrigin}/website?product=${encodeURIComponent(product.sku)}`;
}

/**
 * Computes available stock for a product from live ERP inventory items.
 */
export function resolveProductErpStock(
  productId: string,
  inventoryItems: InventoryItem[],
  activeBranchId?: string
): number {
  if (activeBranchId) {
    const branchInv = inventoryItems.find(
      i => i.productId === productId && i.branchId === activeBranchId
    );
    if (branchInv) {
      return Math.max(0, branchInv.bottlesOnHand);
    }
  }
  const matching = inventoryItems.filter(i => i.productId === productId);
  if (matching.length > 0) {
    return Math.max(0, matching.reduce((sum, item) => sum + item.bottlesOnHand, 0));
  }
  return 0;
}

/**
 * Step 1: Generates a single Product Schema.org JSON-LD object strictly aligned with
 * the visibly rendered title, image, Direct Company Price, and ERP stock availability.
 */
export function buildProductJsonLdSchema(
  product: Product,
  stockBottles: number,
  siteOrigin: string = 'https://kenyaliquorsdirect.com',
  resolvedImageUrl?: string
) {
  const isAvailable = stockBottles > 0;
  const canonicalUrl = buildCanonicalProductUrl(product, siteOrigin);
  const imageUrl = resolvedImageUrl || resolveHighResProductImageUrl(product, siteOrigin);
  const cleanBarcode = (product.barcode || '').replace(/\D/g, '');

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name: product.name,
    image: [imageUrl],
    description: buildCleanProductDescription(product),
    sku: product.sku,
    mpn: product.sku,
    ...(cleanBarcode.length >= 8 ? { gtin13: cleanBarcode } : {}),
    brand: {
      '@type': 'Brand',
      name: product.brand || 'VAAIRO'
    },
    category: product.subCategory || (product.category === 'IPS' ? 'Imported Spirits' : 'Local Beverages'),
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'KES',
      price: product.retailPriceKes.toFixed(2),
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      inventoryLevel: {
        '@type': 'QuantitativeValue',
        value: Math.max(0, stockBottles),
        unitText: 'Bottles'
      },
      seller: {
        '@type': 'Organization',
        name: 'VAAIRO LIQUOR HUB'
      }
    }
  };
}

/**
 * Builds the complete Storefront Catalog JSON-LD Graph (Organization + WebSite + ItemList of Products)
 * so search engine crawlers indexing the storefront root or category pages discover all products and offers.
 */
export function buildStorefrontCatalogJsonLd(
  products: Product[],
  inventoryItems: InventoryItem[],
  activeBranchId: string | undefined,
  siteOrigin: string = 'https://kenyaliquorsdirect.com',
  resolveImgFn?: (prod: Product) => string
) {
  const cleanOrigin = siteOrigin.replace(/\/+$/, '');
  const productSchemas = products.map((product, index) => {
    const stock = resolveProductErpStock(product.id, inventoryItems, activeBranchId);
    const rawImg = resolveImgFn ? resolveImgFn(product) : product.image;
    const highResImg = resolveHighResProductImageUrl(product, cleanOrigin, rawImg);
    const productNode = buildProductJsonLdSchema(product, stock, cleanOrigin, highResImg);
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: buildCanonicalProductUrl(product, cleanOrigin),
      item: productNode
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LiquorStore',
        '@id': `${cleanOrigin}/#organization`,
        name: 'VAAIRO LIQUOR HUB',
        url: cleanOrigin,
        priceRange: 'KES',
        description:
          'VAAIRO LIQUOR HUB — Direct Company Price online drinks delivery portal synced with real-time ERP inventory.'
      },
      {
        '@type': 'ItemList',
        '@id': `${cleanOrigin}/#catalog`,
        name: 'VAAIRO LIQUOR HUB Direct Company Price Product Catalog',
        numberOfItems: products.length,
        itemListElement: productSchemas
      }
    ]
  };
}

/**
 * Maps ERP products and live inventory into Google Merchant Center feed items.
 */
export function buildGoogleMerchantFeedItems(
  products: Product[],
  inventoryItems: InventoryItem[],
  activeBranchId?: string,
  siteOrigin: string = 'https://kenyaliquorsdirect.com',
  resolveImgFn?: (prod: Product) => string
): MerchantFeedItem[] {
  const cleanOrigin = siteOrigin.replace(/\/+$/, '');

  return products.map(product => {
    const stock = resolveProductErpStock(product.id, inventoryItems, activeBranchId);
    const rawImg = resolveImgFn ? resolveImgFn(product) : product.image;
    const imageLink = resolveHighResProductImageUrl(product, cleanOrigin, rawImg);

    return {
      id: product.sku,
      title: product.name,
      description: buildCleanProductDescription(product),
      link: buildCanonicalProductUrl(product, cleanOrigin),
      image_link: imageLink,
      availability: stock > 0 ? 'in_stock' : 'out_of_stock',
      price: `${product.retailPriceKes.toFixed(2)} KES`,
      brand: product.brand || 'VAAIRO',
      gtin: (product.barcode || '').replace(/\D/g, ''),
      condition: 'new',
      mpn: product.sku,
      stockBottles: stock,
      rawPriceKes: product.retailPriceKes
    };
  });
}

/**
 * Step 2A: Generates the Google Merchant Center RSS 2.0 XML Product Data Feed.
 */
export function generateGoogleMerchantXmlFeed(
  items: MerchantFeedItem[],
  siteOrigin: string = 'https://kenyaliquorsdirect.com'
): string {
  const cleanOrigin = siteOrigin.replace(/\/+$/, '');
  const nowRfc822 = new Date().toUTCString();

  const xmlItems = items
    .map(
      item => `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.image_link)}</g:image_link>
      <g:availability>${item.availability}</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:brand>${escapeXml(item.brand)}</g:brand>
      <g:gtin>${escapeXml(item.gtin)}</g:gtin>
      <g:mpn>${escapeXml(item.mpn)}</g:mpn>
      <g:condition>${item.condition}</g:condition>
      <g:identifier_exists>${item.gtin.length >= 8 ? 'yes' : 'no'}</g:identifier_exists>
      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Beverages &gt; Alcoholic Beverages</g:google_product_category>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>VAAIRO LIQUOR HUB — Direct Company Price Feed</title>
    <link>${escapeXml(cleanOrigin)}</link>
    <description>Automated Google Merchant Center Product Feed synced with VAAIRO ERP Live Inventory</description>
    <lastBuildDate>${escapeXml(nowRfc822)}</lastBuildDate>
${xmlItems}
  </channel>
</rss>`;
}

/**
 * Step 2B: Generates the Google Merchant Center CSV Product Data Feed.
 */
export function generateGoogleMerchantCsvFeed(items: MerchantFeedItem[]): string {
  const headers = [
    'id',
    'title',
    'description',
    'link',
    'image_link',
    'availability',
    'price',
    'brand',
    'gtin',
    'mpn',
    'condition'
  ];

  const rows = items.map(item =>
    [
      escapeCsv(item.id),
      escapeCsv(item.title),
      escapeCsv(item.description),
      escapeCsv(item.link),
      escapeCsv(item.image_link),
      escapeCsv(item.availability),
      escapeCsv(item.price),
      escapeCsv(item.brand),
      escapeCsv(item.gtin),
      escapeCsv(item.mpn),
      escapeCsv(item.condition)
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Step 3: Runs Google Rich Results & Merchant Center Feed Diagnostics across all products.
 */
export function runMerchantAndSchemaDiagnostics(
  items: MerchantFeedItem[]
): MerchantDiagnosticResult {
  const warnings: MerchantDiagnosticResult['warnings'] = [];
  let inStockCount = 0;
  let outOfStockCount = 0;
  let validRichResultsCount = 0;
  let validMerchantItemsCount = 0;

  items.forEach(item => {
    if (item.availability === 'in_stock') {
      inStockCount++;
    } else {
      outOfStockCount++;
    }

    let itemHasWarning = false;

    if (!item.id || item.id.trim().length < 2) {
      itemHasWarning = true;
      warnings.push({
        sku: item.id || 'MISSING',
        productName: item.title,
        field: 'g:id',
        message: 'Missing unique SKU identifier (g:id).'
      });
    }

    if (!item.title || item.title.trim().length < 3) {
      itemHasWarning = true;
      warnings.push({
        sku: item.id,
        productName: item.title,
        field: 'g:title',
        message: 'Product title is too short for Google Merchant Center.'
      });
    }

    if (item.rawPriceKes <= 0 || !item.price.endsWith(' KES')) {
      itemHasWarning = true;
      warnings.push({
        sku: item.id,
        productName: item.title,
        field: 'g:price',
        message: 'Price must be greater than 0 and formatted with ISO 4217 currency code (KES).'
      });
    }

    if (!item.image_link || (!item.image_link.startsWith('http://') && !item.image_link.startsWith('https://'))) {
      itemHasWarning = true;
      warnings.push({
        sku: item.id,
        productName: item.title,
        field: 'g:image_link',
        message: 'Image link must be an absolute HTTP/HTTPS URL (min 500x500px).'
      });
    }

    if (!item.gtin || item.gtin.length < 8) {
      warnings.push({
        sku: item.id,
        productName: item.title,
        field: 'g:gtin',
        message: 'GTIN/Barcode is shorter than 8 digits; identifier_exists set to "no".'
      });
    }

    if (!itemHasWarning) {
      validRichResultsCount++;
      validMerchantItemsCount++;
    }
  });

  return {
    totalProducts: items.length,
    inStockCount,
    outOfStockCount,
    validRichResultsCount,
    validMerchantItemsCount,
    warnings,
    lastGeneratedAt: new Date().toISOString()
  };
}
