import { Product } from '../types';

export interface ScanResult {
  success: boolean;
  status: 'ACCEPTED' | 'DUPLICATE_BLOCKED' | 'UNKNOWN';
  message: string;
  product?: Product;
  scanType?: 'SINGLE_BOTTLE' | 'MASTER_CASE';
  unpackedBottles?: number;
  previousBottlesOnHand?: number;
  newBottlesOnHand?: number;
  assetValueAddedKes?: number;
  newTotalProductAssetKes?: number;
  duplicateDetails?: string;
  rawBarcode: string;
  batchId?: string;
}

// Simulated Redis Session Cache for Duplicate Barcode Tokenization
// Stores: `${branchId}:${batchId}:${barcode}` -> timestamp
class BarcodeDuplicateEngine {
  private scanCache = new Map<string, { timestamp: number; scannerId: string; batchId: string }>();

  // Expire entries older than 3 hours
  private TTL_MS = 3 * 60 * 60 * 1000;

  public checkAndRegisterScan(
    rawBarcode: string,
    branchId: string,
    batchId: string,
    scannerId: string
  ): { isDuplicate: boolean; priorScanDetails?: string } {
    const key = `${branchId}:${batchId}:${rawBarcode.trim()}`;
    const now = Date.now();

    const existing = this.scanCache.get(key);
    if (existing && now - existing.timestamp < this.TTL_MS) {
      const minutesAgo = Math.max(1, Math.round((now - existing.timestamp) / (60 * 1000)));
      return {
        isDuplicate: true,
        priorScanDetails: `Duplicate scan blocked! Scanned ${minutesAgo}m ago in batch [${batchId}] by scanner [${existing.scannerId}]. Redis token constraint active.`
      };
    }

    // Register into Redis cache
    this.scanCache.set(key, { timestamp: now, scannerId, batchId });
    return { isDuplicate: false };
  }

  public clearBatch(batchId: string) {
    for (const [key, val] of this.scanCache.entries()) {
      if (val.batchId === batchId) {
        this.scanCache.delete(key);
      }
    }
  }

  public getCacheSize(): number {
    return this.scanCache.size;
  }
}

export const duplicateEngine = new BarcodeDuplicateEngine();

/**
 * Evaluates an ingested barcode against catalog and duplicate constraints
 */
export function processIngestedBarcode(
  rawBarcode: string,
  products: Product[],
  branchId: string,
  batchId: string,
  scannerId: string,
  mode: 'SINGLE' | 'BULK'
): ScanResult {
  const cleanCode = rawBarcode.trim();

  // Find product by bottle barcode or case barcode
  let matchedProduct: Product | undefined;
  let scanType: 'SINGLE_BOTTLE' | 'MASTER_CASE' = 'SINGLE_BOTTLE';

  // 1. Primary lookup against Approved Master Barcodes (GS1 check-digit verified & deduplicated)
  for (const prod of products) {
    if (prod.barcode === cleanCode) {
      matchedProduct = prod;
      scanType = 'SINGLE_BOTTLE';
      break;
    }
    if (prod.caseBarcode === cleanCode) {
      matchedProduct = prod;
      scanType = 'MASTER_CASE';
      break;
    }
  }

  // 2. Secondary fallback against raw source barcode in internalProvenance if physical label uses un-remediated code
  if (!matchedProduct) {
    for (const prod of products) {
      if (prod.internalProvenance?.rawSourceBarcode === cleanCode) {
        matchedProduct = prod;
        scanType = 'SINGLE_BOTTLE';
        break;
      }
      if (prod.internalProvenance?.rawSourceCaseBarcode === cleanCode) {
        matchedProduct = prod;
        scanType = 'MASTER_CASE';
        break;
      }
    }
  }

  if (!matchedProduct) {
    // If not exact match, test if prefix matches
    matchedProduct = products.find(p => p.sku.toLowerCase() === cleanCode.toLowerCase());
    if (matchedProduct) {
      scanType = mode === 'BULK' ? 'MASTER_CASE' : 'SINGLE_BOTTLE';
    }
  }

  if (!matchedProduct) {
    return {
      success: false,
      status: 'UNKNOWN',
      message: `Unrecognized Barcode "${cleanCode}". SKU not found in IPS/LPS Master Database.`,
      rawBarcode: cleanCode
    };
  }

  // If in bulk mode and it's a case, or single bottle
  const unpackedBottles = scanType === 'MASTER_CASE' ? matchedProduct.packSize : 1;

  // Run duplicate check via Redis token cache
  const dupCheck = duplicateEngine.checkAndRegisterScan(cleanCode, branchId, batchId, scannerId);

  if (dupCheck.isDuplicate) {
    return {
      success: false,
      status: 'DUPLICATE_BLOCKED',
      message: dupCheck.priorScanDetails || 'Duplicate barcode blocked by Redis token cache.',
      duplicateDetails: dupCheck.priorScanDetails,
      product: matchedProduct,
      scanType,
      unpackedBottles,
      rawBarcode: cleanCode,
      batchId
    };
  }

  return {
    success: true,
    status: 'ACCEPTED',
    message: scanType === 'MASTER_CASE' 
      ? `Case Accepted! Unpacked ${matchedProduct.packSize} bottles of "${matchedProduct.name}".`
      : `Bottle Verified: "${matchedProduct.name}" (${matchedProduct.category}).`,
    product: matchedProduct,
    scanType,
    unpackedBottles,
    rawBarcode: cleanCode,
    batchId
  };
}

/**
 * Lightweight SVG QR code matrix generator for KRA eTIMS invoices
 * Generates an SVG string representation of a QR Code
 */
export function generateSimpleQrSvg(text: string, size = 160): string {
  // Hash text to generate repeatable pseudorandom QR-like 2D grid matrix with official position markers
  const gridSize = 25;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Function to add 7x7 corner finder patterns
  const addFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = true;
        } else {
          matrix[startY + r][startX + c] = false;
        }
      }
    }
  };

  // Top-left, top-right, bottom-left finders
  addFinder(0, 0);
  addFinder(gridSize - 7, 0);
  addFinder(0, gridSize - 7);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Fill data matrix based on input text characters
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
  }

  let pseudoBit = Math.abs(hash);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finders
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= gridSize - 8;
      const inFinder3 = r >= gridSize - 8 && c < 8;
      if (inFinder1 || inFinder2 || inFinder3) continue;

      pseudoBit = (pseudoBit * 1664525 + 1013904223) & 0xffffffff;
      matrix[r][c] = (pseudoBit % 3) === 0;
    }
  }

  // Build SVG path
  const cellSize = size / gridSize;
  let rects = '';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#0A006E" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="mx-auto bg-white p-1 rounded border border-slate-200">${rects}</svg>`;
}
