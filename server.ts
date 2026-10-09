import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  NAIROBI_DRINKS_PRODUCTS,
  CATALOG_BARCODE_QUALITY_AUDIT,
  buildInitialNairobiDrinksInventory
} from './src/data/nairobiDrinksCatalog';
import {
  buildGoogleMerchantFeedItems,
  generateGoogleMerchantXmlFeed,
  generateGoogleMerchantCsvFeed,
  runMerchantAndSchemaDiagnostics,
  MerchantFeedItem
} from './src/utils/seoMerchantFeed';
import { DepartmentType, InventoryItem, Product } from './src/types';
import {
  AuthoritativeErpEngine,
  InventoryTransactionType,
  StockTransferStatus,
  validateAndResolveServerSecrets
} from './src/server/erpEngine';
import {
  firestoreAuthoritativeStore,
  AuthoritativeMpesaTransactionRecord
} from './src/server/firestoreAuthoritativeStore';
import { verifyFirebaseIdTokenCryptographically } from './src/server/firebaseTokenVerifier';
import { DEFAULT_BRANDING_CONFIG, STANDARD_CHART_OF_ACCOUNTS } from './src/config/erpConfig';
import {
  ExtendedErpRole,
  GranularPermission,
  canAccessBranch,
  getRequiredInventoryPermission,
  getRolePermissions,
  hasGranularPermission
} from './src/utils/rbac';
import { splitProductIntoPublicAndPrivate } from './src/utils/productCatalogSplit';
import {
  computeSaltedPinHashSync,
  constantTimeEquals
} from './src/utils/cryptoSecurity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Authoritative Persistent ERP Engine
export const erpEngine = new AuthoritativeErpEngine(
  NAIROBI_DRINKS_PRODUCTS,
  buildInitialNairobiDrinksInventory(NAIROBI_DRINKS_PRODUCTS),
  { enableDiskPersistence: true }
);

let liveActiveBranchId: string = 'branch-hq-main';
let lastFeedRefreshIso: string = new Date().toISOString();
let nextScheduledRefreshIso: string = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
let cachedXmlFeed: string = '';
let cachedCsvFeed: string = '';
let cachedFeedItems: MerchantFeedItem[] = [];

function resolveRequestOrigin(req?: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'liqour.urbantechdev.com';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'https://liqour.urbantechdev.com';
}

function regenerateMerchantFeeds(origin: string = 'https://liqour.urbantechdev.com') {
  cachedFeedItems = buildGoogleMerchantFeedItems(
    erpEngine.products,
    erpEngine.inventoryItems,
    liveActiveBranchId,
    origin,
    prod => `${origin}/api/product-image/${encodeURIComponent(prod.sku)}.svg`
  );
  cachedXmlFeed = generateGoogleMerchantXmlFeed(cachedFeedItems, origin);
  cachedCsvFeed = generateGoogleMerchantCsvFeed(cachedFeedItems);
  lastFeedRefreshIso = new Date().toISOString();
  nextScheduledRefreshIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

// Initial feed build on server boot
regenerateMerchantFeeds(process.env.APP_URL || 'https://liqour.urbantechdev.com');

// Scheduled Daily Task (24h Cron Interval) to auto-refresh Google Merchant Center XML & CSV feeds
// and run automated low-stock restock checks
const DAILY_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  regenerateMerchantFeeds(process.env.APP_URL || 'https://liqour.urbantechdev.com');
}, DAILY_MS);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Security headers for ERP API routes (prevent public CDN caching of sensitive ERP payloads)
  app.use('/api', (_req: Request, res: Response, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // Serve high-resolution studio product images directly from /src/assets/images
  app.use(
    '/src/assets/images',
    express.static(path.resolve(__dirname, 'src/assets/images'), {
      maxAge: '7d'
    })
  );

  // Clean 800x800px high-resolution product image endpoint for Google Merchant Center crawlers
  app.get('/api/product-image/:skuFile', (req: Request, res: Response) => {
    const rawParam = String(req.params.skuFile || '').replace(/\.svg$/i, '');
    const decodedSku = decodeURIComponent(rawParam);
    const product =
      erpEngine.products.find(p => p.sku.toLowerCase() === decodedSku.toLowerCase()) ||
      erpEngine.products[0];

    const brand = (product?.brand || 'VAAIRO').toUpperCase().slice(0, 18);
    const sub = (product?.subCategory || 'Spirit').toUpperCase().slice(0, 20);
    const vol = `${product?.volumeMl || 750}ML`;
    const abv = `${product?.alcoholPercentage || 40}% ABV`;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>
    <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="50%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)" />
  <ellipse cx="400" cy="720" rx="160" ry="22" fill="#CBD5E1" opacity="0.6" />
  <rect x="352" y="70" width="96" height="54" rx="10" fill="#D97706" />
  <rect x="360" y="124" width="80" height="105" fill="url(#bottle)" />
  <path d="M270,280 C270,235 345,220 360,220 L440,220 C455,220 530,235 530,280 L542,680 C542,705 515,720 485,720 L315,720 C285,720 258,705 258,680 Z" fill="url(#bottle)" />
  <rect x="282" y="335" width="236" height="250" rx="14" fill="#FFFBEB" stroke="#D97706" stroke-width="5" />
  <text x="400" y="405" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="900" font-size="28" fill="#0F172A">${brand.replace(/&/g, '&amp;')}</text>
  <line x1="312" y1="430" x2="488" y2="430" stroke="#D97706" stroke-width="3" />
  <text x="400" y="475" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="22" fill="#334155">${sub.replace(/&/g, '&amp;')}</text>
  <text x="400" y="535" text-anchor="middle" font-family="monospace" font-weight="700" font-size="20" fill="#475569">${vol} • ${abv}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(svg);
  });

  // ===========================================================================
  // AUTOMATED GOOGLE MERCHANT CENTER XML & CSV PRODUCT DATA FEEDS
  // ===========================================================================
  app.get('/feeds/google-shopping.xml', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    regenerateMerchantFeeds(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.status(200).send(cachedXmlFeed);
  });

  app.get('/feeds/google-shopping.csv', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    regenerateMerchantFeeds(origin);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="google-shopping.csv"');
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.status(200).send(cachedCsvFeed);
  });

  // Master Barcode Quality Pipeline & Provenance Governance Audit Endpoint
  app.get('/api/catalog/barcode-quality-audit', (_req: Request, res: Response) => {
    res.status(200).json({
      summary: CATALOG_BARCODE_QUALITY_AUDIT.summary,
      sampleRecords: CATALOG_BARCODE_QUALITY_AUDIT.records.slice(0, 25)
    });
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE AUTHENTICATION, CRYPTOGRAPHY & SESSION SECURITY
  // ===========================================================================
  const resolvedSecrets = validateAndResolveServerSecrets(process.env);
  const SERVER_SESSION_SECRET = resolvedSecrets.sessionSecret;
  const ADMIN_API_KEY = resolvedSecrets.adminApiKey;
  let activeTotpSecret: string | null = resolvedSecrets.totpAdminSecret;
  let pendingTotpEnrollmentSecret: string | null = null;

  function generateServerTotpSecret(length: number = 16): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(length);
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += alphabet[bytes[i] % 32];
    }
    return secret;
  }

  function base32ToBuffer(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < clean.length; i++) {
      const val = alphabet.indexOf(clean[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  function computeServerTotp(secretBase32: string, timeMs: number = Date.now(), stepSec: number = 30): string {
    const counter = Math.floor(timeMs / 1000 / stepSec);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const key = base32ToBuffer(secretBase32);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
  }

  function verifyServerTotp(candidate: string, secretBase32: string | null = activeTotpSecret, tolerance: number = 1): boolean {
    if (!secretBase32) return false;
    const clean = candidate.replace(/\D/g, '').trim();
    if (clean.length !== 6) return false;
    const now = Date.now();
    for (let step = -tolerance; step <= tolerance; step++) {
      const checkTime = now + step * 30 * 1000;
      const expected = computeServerTotp(secretBase32, checkTime);
      if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  }

  interface SessionUser {
    userId: string;
    name: string;
    role: ExtendedErpRole;
    department: DepartmentType;
    branchId?: string;
    organizationId?: string;
    email?: string;
  }

  function createSessionToken(user: SessionUser): string {
    const payload = {
      ...user,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SERVER_SESSION_SECRET).update(payloadB64).digest('base64url');
    return `${payloadB64}.${signature}`;
  }

  function verifySessionToken(token: string): SessionUser | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SERVER_SESSION_SECRET).update(payloadB64).digest('base64url');
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
    try {
      const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
      return {
        userId: data.userId,
        name: data.name,
        role: data.role,
        department: data.department,
        branchId: data.branchId,
        organizationId: data.organizationId,
        email: data.email
      };
    } catch {
      return null;
    }
  }

  function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  function adminApiKeyValid(authHeader?: string, customHeader?: string | string[]): boolean {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const custom = Array.isArray(customHeader) ? customHeader[0] : customHeader;
    return Boolean(ADMIN_API_KEY && (token === ADMIN_API_KEY || custom === ADMIN_API_KEY));
  }

  function authenticateSession(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-admin-key'];

    if (adminApiKeyValid(authHeader, customHeader)) {
      (req as any).user = {
        userId: 'admin-system',
        name: 'System Administrator',
        role: 'SUPER_ADMIN',
        department: 'BRANCH_MANAGER'
      };
      return next();
    }

    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required: Missing Bearer session token.'
      });
    }

    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({
        error: 'Invalid or expired session token. Please sign in to verify your identity.'
      });
    }

    (req as any).user = session;
    next();
  }

  function requireAdmin(req: Request, res: Response, next: () => void) {
    authenticateSession(req, res, () => {
      const user = (req as any).user as SessionUser | undefined;
      if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'ACCOUNTANT')) {
        return next();
      }
      return res.status(403).json({
        error: 'Forbidden: Administrative privileges (SUPER_ADMIN, ADMIN, or ACCOUNTANT) required.'
      });
    });
  }

  function verifyAdminAuth(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-admin-key'];

    if (adminApiKeyValid(authHeader, customHeader)) {
      return next();
    }

    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const session = verifySessionToken(token);
    if (session && (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'ACCOUNTANT')) {
      (req as any).user = session;
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized: Valid administrative authentication token required.'
    });
  }

  // ===========================================================================
  // AUTHENTICATION & LOGIN API ENDPOINTS (Salted Hash + Brute-Force Protection)
  // ===========================================================================

  // Helper to synchronize staffDirectoryStore records into erpEngine's staffPinRegistry
  function syncStaffDirectoryRecordIntoPinRegistry(rec: Record<string, unknown>): void {
    if (!rec || typeof rec.id !== 'string' || !rec.id || typeof rec.name !== 'string') return;
    const rawPin =
      typeof rec.loginPin === 'string' && /^\d{6}$/.test(rec.loginPin) && rec.loginPin !== '000000'
        ? rec.loginPin
        : undefined;
    const pinSalt = typeof rec.pinSalt === 'string' && rec.pinSalt ? rec.pinSalt : undefined;
    const pinHash = typeof rec.pinHash === 'string' && rec.pinHash ? rec.pinHash : undefined;
    if (!rawPin && (!pinSalt || !pinHash)) return;

    erpEngine.registerOrUpdateStaffPin({
      staffId: String(rec.id),
      name: String(rec.name),
      codeOrNumber: typeof rec.codeOrNumber === 'string' ? rec.codeOrNumber : undefined,
      department: (rec.department as DepartmentType) || 'POS',
      branchId: String(rec.branchId || 'branch-1'),
      rawPin,
      pinSalt,
      pinHash,
      active: typeof rec.active === 'boolean' ? rec.active : true
    });
  }

  // Hydrate erpEngine staff PIN registry from durable staffDirectoryStore on startup
  for (const storedStaff of firestoreAuthoritativeStore.staffDirectoryStore.values()) {
    syncStaffDirectoryRecordIntoPinRegistry(storedStaff);
  }

  // 1. Staff 6-Digit PIN Authentication (Rate-Limited & Salted Hash Verified)
  app.post('/api/auth/login-pin', (req: Request, res: Response) => {
    const { staffId, pin, department, branchId, staffName, pinSalt, pinHash } = req.body || {};
    // Ensure any recently synced staffDirectoryStore records are registered in erpEngine
    for (const storedStaff of firestoreAuthoritativeStore.staffDirectoryStore.values()) {
      syncStaffDirectoryRecordIntoPinRegistry(storedStaff);
    }
    // Also sync any employees or affiliates present in unifiedStateDocsStore
    for (const stateKey of ['employees', 'affiliates']) {
      const stateDoc = firestoreAuthoritativeStore.unifiedStateDocsStore.get(stateKey);
      if (stateDoc && typeof stateDoc.payloadJson === 'string') {
        try {
          const parsedList = JSON.parse(stateDoc.payloadJson);
          if (Array.isArray(parsedList)) {
            for (const item of parsedList) {
              if (item && typeof item === 'object' && typeof item.id === 'string') {
                syncStaffDirectoryRecordIntoPinRegistry({
                  ...item,
                  department: stateKey === 'affiliates' ? 'AFFILIATES' : item.department || 'POS'
                });
              }
            }
          }
        } catch {
          // Ignore malformed payloadJson
        }
      }
    }

    const cleanPin = String(pin || '').replace(/\D/g, '').trim();
    let targetStaffId = String(staffId || '').trim();

    // If the client verified the staff record against its local Independent Staff Database and provided its salted hash, ensure it is registered
    if (
      targetStaffId &&
      !erpEngine.staffAuthStore.has(targetStaffId) &&
      typeof pinSalt === 'string' &&
      pinSalt.length > 0 &&
      typeof pinHash === 'string' &&
      pinHash.length > 0
    ) {
      erpEngine.registerOrUpdateStaffPin({
        staffId: targetStaffId,
        name: String(staffName || 'Staff Member'),
        department: (department as DepartmentType) || 'POS',
        branchId: String(branchId || 'branch-1'),
        pinSalt,
        pinHash,
        active: true
      });
    }

    // If the user typed a valid 6-digit PIN without changing the default staff dropdown selection,
    // resolve the registered active staff account within the SAME department whose salted hash matches cleanPin
    if (cleanPin.length === 6) {
      const currentTarget = targetStaffId ? erpEngine.staffAuthStore.get(targetStaffId) : undefined;
      const currentMatches =
        currentTarget &&
        currentTarget.active &&
        constantTimeEquals(computeSaltedPinHashSync(cleanPin, currentTarget.pinSalt), currentTarget.pinHash);

      if (!currentMatches && !currentTarget) {
        const allRegistered = Array.from(erpEngine.staffAuthStore.values()).filter(r => r.active);
        const deptMatch = allRegistered.find(
          r =>
            r.department === department &&
            constantTimeEquals(computeSaltedPinHashSync(cleanPin, r.pinSalt), r.pinHash)
        );
        if (deptMatch) {
          targetStaffId = deptMatch.staffId;
        }
      }
    }

    const authResult = erpEngine.authenticateStaffPin({
      staffId: targetStaffId,
      pin: String(pin || ''),
      department: (department as DepartmentType) || 'POS',
      branchId: String(branchId || 'branch-1'),
      staffName: String(staffName || 'Staff Member'),
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    if (!authResult.success || !authResult.user) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const token = createSessionToken(authResult.user);
    return res.status(200).json({
      success: true,
      token,
      user: authResult.user
    });
  });

  // 1a. Active ERP Terminal Session Token Hydration (ensures PC & Mobile terminals whose local auth state survived a server restart or Google OAuth client fallback receive a valid signed session token)
  app.post('/api/auth/terminal-session', (req: Request, res: Response) => {
    const { userId, name, email, role, department, branchId, organizationId } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const targetDept: DepartmentType = (department as DepartmentType) || 'BRANCH_MANAGER';
    const targetOrg = String(organizationId || 'org-merchant-vaairo-hq');

    const builtInSuperAdmins = [
      'gduniversalstudio@gmail.com',
      ...(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    ];

    let resolvedRole: ExtendedErpRole = 'STAFF';
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      const existingMem = erpEngine.organizationMemberships.get(`${String(userId || '')}_${targetOrg}`);
      if (
        (cleanEmail && builtInSuperAdmins.includes(cleanEmail)) ||
        (existingMem && existingMem.active && (existingMem.role === 'SUPER_ADMIN' || existingMem.role === 'ADMIN'))
      ) {
        resolvedRole = 'SUPER_ADMIN';
      } else {
        resolvedRole = 'STAFF';
      }
    } else if (role === 'ACCOUNTANT') {
      resolvedRole = 'ACCOUNTANT';
    } else if (role === 'MANAGER' || targetDept === 'BRANCH_MANAGER') {
      resolvedRole = 'MANAGER';
    } else if (targetDept === 'POS') {
      resolvedRole = 'CASHIER';
    } else if (targetDept === 'INVENTORY') {
      resolvedRole = 'INVENTORY_STAFF';
    } else if (targetDept === 'PROCUREMENT') {
      resolvedRole = 'PROCUREMENT_STAFF';
    }

    const resolvedUserId = String(userId || (cleanEmail ? `user-${cleanEmail}` : `term-${Date.now()}`));

    erpEngine.registerOrganizationMembership({
      userId: resolvedUserId,
      email: cleanEmail || undefined,
      organizationId: targetOrg,
      role: resolvedRole,
      department: targetDept,
      branchId: branchId ? String(branchId) : undefined,
      active: true
    });

    const sessionUser: SessionUser = {
      userId: resolvedUserId,
      name: String(name || 'ERP Terminal User'),
      email: cleanEmail || undefined,
      role: resolvedRole,
      department: targetDept,
      branchId: branchId ? String(branchId) : undefined,
      organizationId: targetOrg
    };
    const token = createSessionToken(sessionUser);
    return res.status(200).json({
      success: true,
      token,
      user: sessionUser
    });
  });

  // 1b. Register or Update Staff Hashed PIN Credentials (Protected)
  app.post('/api/auth/register-staff-pin', authenticateSession, (req: Request, res: Response) => {
    const caller = (req as any).user as SessionUser;
    if (!hasGranularPermission(caller.role, caller.department, 'users.create') &&
        !hasGranularPermission(caller.role, caller.department, 'users.edit')) {
      return res.status(403).json({ error: 'Forbidden: Missing permission to manage staff credentials.' });
    }

    const { staffId, name, codeOrNumber, role, department, branchId, rawPin, pinSalt, pinHash, active } = req.body || {};
    if (!staffId || !name || !department || !branchId) {
      return res.status(400).json({ error: 'staffId, name, department, and branchId are required.' });
    }

    const updated = erpEngine.registerOrUpdateStaffPin({
      staffId: String(staffId),
      name: String(name),
      codeOrNumber: codeOrNumber ? String(codeOrNumber) : undefined,
      role: role as ExtendedErpRole | undefined,
      department: department as DepartmentType,
      branchId: String(branchId),
      rawPin: rawPin ? String(rawPin) : undefined,
      pinSalt: pinSalt ? String(pinSalt) : undefined,
      pinHash: pinHash ? String(pinHash) : undefined,
      active: typeof active === 'boolean' ? active : true
    });

    erpEngine.recordAudit({
      userId: caller.userId,
      userName: caller.name,
      userRole: caller.role,
      department: caller.department,
      branchId: caller.branchId,
      action: 'STAFF_CREDENTIALS_UPDATED',
      module: 'AUTH',
      entityType: 'STAFF_AUTH',
      entityId: updated.staffId,
      ipAddress: getClientIp(req),
      actionDetails: `Updated hashed PIN credentials for ${updated.name} (${updated.department}).`
    });

    return res.status(200).json({
      success: true,
      staffId: updated.staffId,
      active: updated.active,
      updatedAt: updated.updatedAt
    });
  });

  async function verifyGoogleAdminAuthorization(
    cleanEmail: string,
    idToken?: unknown
  ): Promise<{
    authorized: boolean;
    status: number;
    error?: string;
    errorCode?: string;
    verifiedUid?: string;
    signInSecondFactor?: string;
    secondFactorIdentifier?: string;
    membership?: {
      id: string;
      userId: string;
      email: string;
      organizationId: string;
      role: ExtendedErpRole;
      department: DepartmentType;
      branchId?: string;
      permissions: GranularPermission[];
    };
  }> {
    if (typeof idToken !== 'string' || idToken.trim().length === 0) {
      return {
        authorized: false,
        status: 401,
        errorCode: 'MISSING_TOKEN',
        error: 'Cryptographic Token Verification Failed (MISSING_TOKEN): A signed Firebase RS256 ID token is required.'
      };
    }

    const cryptoVerification = await verifyFirebaseIdTokenCryptographically({
      idToken,
      expectedEmail: cleanEmail
    });
    if (!cryptoVerification.valid) {
      return {
        authorized: false,
        status: 401,
        errorCode: cryptoVerification.errorCode,
        error: `Cryptographic Token Verification Failed (${cryptoVerification.errorCode}): ${cryptoVerification.errorMessage}`
      };
    }

    const verifiedUid = cryptoVerification.claims?.uid || `user-${cleanEmail}`;

    // Resolve role, department, branchId, and permissions strictly from server-controlled organizationMemberships
    // NEVER from browser req.body.role and NEVER granting blanket admin access by corporate domain alone
    const membershipResolution = erpEngine.resolveGoogleIdentityMembership({
      uid: verifiedUid,
      email: cleanEmail
    });

    if (!membershipResolution.authorized || !membershipResolution.membership) {
      return {
        authorized: false,
        status: membershipResolution.status,
        errorCode: membershipResolution.errorCode,
        error: membershipResolution.error
      };
    }

    return {
      authorized: true,
      status: 200,
      verifiedUid,
      signInSecondFactor: cryptoVerification.claims?.signInSecondFactor,
      secondFactorIdentifier: cryptoVerification.claims?.secondFactorIdentifier,
      membership: membershipResolution.membership
    };
  }

  // 2A. Google OAuth Primary Sign-In Verification (Checks whether per-user / Firebase TOTP step is required)
  // SECURITY: Ignores any client-supplied `role` in req.body; derives role/department/branch/permissions
  // strictly from server-controlled `organizationMemberships/{uid}_{orgId}`.
  app.post('/api/auth/google-login', async (req: Request, res: Response) => {
    const { email, name, idToken } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Verified Google email address is required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const authCheck = await verifyGoogleAdminAuthorization(cleanEmail, idToken);
    if (!authCheck.authorized || !authCheck.membership) {
      return res.status(authCheck.status).json({
        error: authCheck.error,
        errorCode: authCheck.errorCode
      });
    }

    const { membership } = authCheck;
    const totpStatus = erpEngine.resolveUserTotpStatus({
      userId: authCheck.verifiedUid || membership.userId,
      email: cleanEmail,
      globalFallbackSecret: activeTotpSecret,
      firebaseSecondFactor: authCheck.signInSecondFactor
    });

    // If TOTP is required for this user (and was not already satisfied by Firebase Auth TOTP second factor), require Step 2 TOTP code
    if (totpStatus.mfaRequired && !totpStatus.satisfiedByFirebaseMfa) {
      return res.status(200).json({
        success: true,
        mfaRequired: true,
        factorType: totpStatus.factorType,
        perUserEnrolled: totpStatus.perUserEnrolled
      });
    }

    // Derive role, department, branchId, organizationId, and permissions strictly from server membership
    const session: SessionUser = {
      userId: membership.userId,
      name: String(name || cleanEmail.split('@')[0]),
      email: cleanEmail,
      role: membership.role,
      department: membership.department,
      branchId: membership.branchId,
      organizationId: membership.organizationId
    };

    const token = createSessionToken(session);

    erpEngine.recordAudit({
      organizationId: membership.organizationId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      department: session.department,
      branchId: session.branchId,
      actionType: totpStatus.satisfiedByFirebaseMfa ? 'FIREBASE_TOTP_MFA_LOGIN' : 'GOOGLE_OAUTH_VERIFIED_LOGIN',
      actionTitle: `Google OAuth Sign-In Verified (${cleanEmail} -> server-derived role ${membership.role}${
        totpStatus.satisfiedByFirebaseMfa ? ', Firebase TOTP MFA verified' : ''
      })`,
      module: 'AUTH',
      entityType: 'USER_SESSION',
      entityId: session.userId,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      mfaRequired: false,
      satisfiedByFirebaseMfa: totpStatus.satisfiedByFirebaseMfa,
      token,
      user: {
        ...session,
        permissions: membership.permissions
      }
    });
  });

  // 2B. Google OAuth + Per-User RFC 6238 TOTP MFA Authentication (Brute-Force + Timestep Replay Protected)
  // SECURITY: Ignores any client-supplied `role` in req.body; derives role/department/branch/permissions
  // strictly from server-controlled `organizationMemberships/{uid}_{orgId}`.
  // Enforces:
  //  - Per-user TOTP secret resolution (`userTotpFactors/{uid}`)
  //  - 5 failed attempts -> 15-minute lockout (`429 MFA_LOCKED_OUT`)
  //  - Exponential backoff + IP & account combination tracking + audit event on every failure
  //  - `user + timestep` replay rejection (`401 TOTP_TIMESTEP_REPLAY_DETECTED`)
  app.post('/api/auth/verify-google-mfa', async (req: Request, res: Response) => {
    const { email, name, totpCode, idToken } = req.body || {};
    if (!email || !totpCode) {
      return res.status(400).json({ error: 'Verified Google email and TOTP code are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const authCheck = await verifyGoogleAdminAuthorization(cleanEmail, idToken);
    if (!authCheck.authorized || !authCheck.membership) {
      return res.status(authCheck.status).json({
        error: authCheck.error,
        errorCode: authCheck.errorCode
      });
    }

    const { membership } = authCheck;
    const mfaResult = erpEngine.verifyUserTotpMfa({
      userId: authCheck.verifiedUid || membership.userId,
      email: cleanEmail,
      totpCode: String(totpCode),
      fallbackSecretBase32: activeTotpSecret,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    if (!mfaResult.valid) {
      return res.status(mfaResult.status).json({
        error: mfaResult.error,
        errorCode: mfaResult.errorCode,
        remainingAttempts: mfaResult.remainingAttempts,
        lockedUntilMs: mfaResult.lockedUntilMs
      });
    }

    const session: SessionUser = {
      userId: membership.userId,
      name: String(name || cleanEmail.split('@')[0]),
      email: cleanEmail,
      role: membership.role,
      department: membership.department,
      branchId: membership.branchId,
      organizationId: membership.organizationId
    };

    const token = createSessionToken(session);

    erpEngine.recordAudit({
      organizationId: membership.organizationId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      department: session.department,
      branchId: session.branchId,
      actionType: 'MFA_VERIFIED_LOGIN',
      actionTitle: `Administrative Per-User MFA Verified (${cleanEmail} -> server-derived role ${membership.role}, timestep ${mfaResult.matchedTimestep})`,
      module: 'AUTH',
      entityType: 'USER_SESSION',
      entityId: session.userId,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        ...session,
        permissions: membership.permissions
      }
    });
  });

  // 2C. Per-User TOTP Setup & Enrollment Routes (Scoped per User UID / Email)
  function resolveOptionalCallerIdentity(req: Request): {
    authenticated: boolean;
    role?: ExtendedErpRole;
    department?: DepartmentType;
    userId?: string;
    email?: string;
  } {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const session = token ? verifySessionToken(token) : null;
    const queryEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : undefined;
    const bodyEmail =
      req.body && typeof req.body.accountEmail === 'string'
        ? req.body.accountEmail.trim().toLowerCase()
        : req.body && typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : undefined;
    const email = session?.email || bodyEmail || queryEmail;
    const userId =
      session?.userId ||
      (req.body && typeof req.body.userId === 'string' ? req.body.userId.trim() : undefined) ||
      (email ? `user-${email}` : undefined);
    return {
      authenticated: Boolean(session),
      role: session?.role,
      department: session?.department,
      userId,
      email
    };
  }

  app.get('/api/auth/totp/status', (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    const status = erpEngine.resolveUserTotpStatus({
      userId: caller.userId,
      email: caller.email,
      globalFallbackSecret: activeTotpSecret
    });
    return res.status(200).json({
      enabled: status.mfaRequired,
      perUserEnrolled: status.perUserEnrolled,
      factorType: status.factorType,
      accountEmail: caller.email || null,
      configuredViaEnv: Boolean(resolvedSecrets.totpAdminSecret)
    });
  });

  app.post('/api/auth/totp/setup-init', (req: Request, res: Response) => {
    const { customSecret, accountEmail } = req.body || {};
    const caller = resolveOptionalCallerIdentity(req);
    const targetEmail = String(accountEmail || caller.email || 'admin@vaairo.co.ke').trim().toLowerCase();
    const enrollment = erpEngine.enrollOrInitUserTotpFactor({
      userId: caller.userId,
      email: targetEmail,
      customSecret: customSecret ? String(customSecret) : undefined
    });
    pendingTotpEnrollmentSecret = enrollment.secret;
    return res.status(200).json({
      success: true,
      userId: enrollment.userId,
      accountEmail: enrollment.email,
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl
    });
  });

  app.post('/api/auth/totp/setup-verify', (req: Request, res: Response) => {
    const { totpCode, secret, accountEmail, factorType, firebaseFactorUid } = req.body || {};
    const caller = resolveOptionalCallerIdentity(req);
    const targetEmail = String(accountEmail || caller.email || 'admin@vaairo.co.ke').trim().toLowerCase();

    const confirmRes = erpEngine.confirmUserTotpEnrollment({
      userId: caller.userId,
      email: targetEmail,
      totpCode: String(totpCode || ''),
      secret: secret ? String(secret) : pendingTotpEnrollmentSecret || undefined,
      factorType: factorType === 'FIREBASE_TOTP_MFA' ? 'FIREBASE_TOTP_MFA' : 'PER_USER_RFC6238_TOTP',
      firebaseFactorUid: firebaseFactorUid ? String(firebaseFactorUid) : undefined,
      ipAddress: getClientIp(req)
    });

    if (!confirmRes.success) {
      return res.status(confirmRes.status).json({
        error: confirmRes.error,
        errorCode: confirmRes.errorCode
      });
    }

    activeTotpSecret = confirmRes.factor?.totpSecret || activeTotpSecret;
    pendingTotpEnrollmentSecret = null;

    return res.status(200).json({
      success: true,
      enabled: true,
      perUserEnrolled: true,
      accountEmail: confirmRes.factor?.email,
      factorType: confirmRes.factor?.factorType,
      message: `Per-user TOTP Multi-Factor Authentication is now active and enforced for ${confirmRes.factor?.email}.`
    });
  });

  app.post('/api/auth/totp/disable', (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    erpEngine.disableUserTotpFactor({
      userId: caller.userId,
      email: caller.email || 'admin@vaairo.co.ke',
      ipAddress: getClientIp(req)
    });
    if (!caller.email) {
      activeTotpSecret = null;
      pendingTotpEnrollmentSecret = null;
    }
    return res.status(200).json({
      success: true,
      enabled: false,
      message: 'TOTP Multi-Factor Authentication has been disabled for this account.'
    });
  });

  // 3. Verify Session Endpoint
  app.get('/api/auth/session', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const perms = getRolePermissions(user.role, user.department);
    res.status(200).json({
      authenticated: true,
      user: {
        ...user,
        permissions: perms.permissions
      }
    });
  });

  // 3b. Role-Scoped Authorized Financial & Accounting State (Never persisted in browser LocalStorage)
  app.get('/api/erp/authorized-state', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const isFinanceOrAdmin =
      user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'ACCOUNTANT';
    const isManagerOrAdmin = isFinanceOrAdmin || user.role === 'MANAGER';

    res.status(200).json({
      role: user.role,
      department: user.department,
      branchId: user.branchId || null,
      chartOfAccounts: isFinanceOrAdmin ? STANDARD_CHART_OF_ACCOUNTS : [],
      journalEntries: isFinanceOrAdmin ? erpEngine.journalEntries.slice(-250) : [],
      accountingPeriods: isManagerOrAdmin ? Array.from(erpEngine.accountingPeriods.values()) : []
    });
  });

  // 4. Logout Endpoint
  app.post('/api/auth/logout', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: user.branchId,
      actionType: 'LOGOUT',
      actionTitle: `User Signed Out (${user.name})`,
      module: 'AUTH',
      entityType: 'USER_SESSION',
      entityId: user.userId,
      ipAddress: getClientIp(req)
    });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE POS CHECKOUT, REFUNDS & ATOMIC TRANSACTIONS
  // ===========================================================================
  app.post('/api/pos/checkout', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const {
      organizationId,
      branchId,
      items,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      mpesaReceiptNumber,
      saleType,
      idempotencyKey,
      reservationId
    } = req.body || {};

    const result = await erpEngine.executeTransactionalPosCheckout({
      user,
      organizationId: organizationId ? String(organizationId) : undefined,
      branchId: String(branchId || ''),
      items: Array.isArray(items) ? items : [],
      paymentMethod: paymentMethod || 'CASH',
      paymentReference: mpesaReceiptNumber,
      saleType: saleType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      customerName,
      customerEmail: customerEmail ? String(customerEmail).trim() : undefined,
      customerPhone,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      reservationId: reservationId ? String(reservationId) : undefined,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    return res.status(result.status).json(result.body);
  });

  // Two-Phase Stock Reservation: Hold stock before async payment confirmation
  app.post('/api/inventory/reservations/hold', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { organizationId, branchId, orderReference, items, ttlSeconds } = req.body || {};
    if (!branchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'branchId and non-empty items array are required.' });
    }
    const result = await erpEngine.reserveStockForPendingCheckout({
      user,
      organizationId: organizationId ? String(organizationId) : undefined,
      branchId: String(branchId),
      orderReference: String(orderReference || `ORD-RSV-${Date.now()}`),
      items,
      ttlSeconds: typeof ttlSeconds === 'number' ? ttlSeconds : 300
    });
    return res.status(result.status).json(result.body);
  });

  // Two-Phase Stock Reservation: Release held stock on payment cancellation or timeout
  app.post('/api/inventory/reservations/release', authenticateSession, async (req: Request, res: Response) => {
    const { reservationId, reason } = req.body || {};
    if (!reservationId) {
      return res.status(400).json({ error: 'reservationId is required.' });
    }
    const result = await erpEngine.releasePendingStockReservation(
      String(reservationId),
      reason ? String(reason) : undefined
    );
    return res.status(result.status).json(result.body);
  });

  // Public vs Private Product Catalog Split Endpoints
  app.get('/api/products/public', (_req: Request, res: Response) => {
    const publicCatalog = erpEngine.products.map(
      p => splitProductIntoPublicAndPrivate(p).publicRecord
    );
    return res.status(200).json({
      total: publicCatalog.length,
      products: publicCatalog
    });
  });

  app.get('/api/products/private', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const orgCheck = erpEngine.verifyOrganizationResourceAccess({
      userId: user.userId,
      userRole: user.role,
      userOrganizationId: user.organizationId,
      targetOrganizationId: 'org-merchant-vaairo-hq'
    });
    if (!orgCheck.authorized) {
      return res.status(403).json({
        error: orgCheck.error,
        errorCode: 'ORGANIZATION_ACCESS_DENIED'
      });
    }
    const privateCatalog = erpEngine.products.map(
      p => splitProductIntoPublicAndPrivate(p, 'org-merchant-vaairo-hq').privateRecord
    );
    return res.status(200).json({
      total: privateCatalog.length,
      productsPrivate: privateCatalog
    });
  });

  // Server-Side Administrative Migration Endpoint for Normalized Collections (Never executed from browser)
  app.post('/api/erp/admin/seed-normalized-collections', requireAdmin, async (_req: Request, res: Response) => {
    const result = await firestoreAuthoritativeStore.seedNormalizedCatalogSplitToFirestore(
      erpEngine.products,
      'org-merchant-vaairo-hq'
    );
    return res.status(200).json({
      success: true,
      ...result
    });
  });

  app.get('/api/erp/persistence-reconcile', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT') {
      return res.status(403).json({ error: 'Forbidden: Only administrative or finance roles can inspect persistence reconciliation.' });
    }
    return res.status(200).json({
      pendingCount: firestoreAuthoritativeStore.getPendingReconciliations().length,
      pendingReconciliations: firestoreAuthoritativeStore.getPendingReconciliations()
    });
  });

  app.post('/api/erp/persistence-reconcile', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT') {
      return res.status(403).json({ error: 'Forbidden: Only administrative or finance roles can trigger persistence reconciliation.' });
    }
    const result = await erpEngine.retryFailedPersistenceOperations();
    return res.status(200).json({
      success: true,
      ...result
    });
  });

  // Reconcile Offline-Queued POS Checkouts safely on the Server
  app.post('/api/pos/reconcile-queued', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { queuedCheckouts } = req.body || {};
    if (!Array.isArray(queuedCheckouts) || queuedCheckouts.length === 0) {
      return res.status(400).json({ error: 'queuedCheckouts array is required.' });
    }

    const results: Array<{
      idempotencyKey: string;
      queuedOrderId?: string;
      queuedInvoiceId?: string;
      status: number;
      body: Record<string, unknown>;
    }> = [];

    for (const q of queuedCheckouts) {
      const idemKey = String(q.idempotencyKey || '');
      if (!idemKey) continue;
      const resCheckout = await erpEngine.executeTransactionalPosCheckout({
        user,
        branchId: String(q.branchId || user.branchId || 'branch-1'),
        items: Array.isArray(q.items) ? q.items : [],
        paymentMethod: q.paymentMethod === 'MPESA' ? 'MPESA' : q.paymentMethod === 'SPLIT' ? 'SPLIT' : 'CASH',
        paymentReference: q.mpesaReceiptNumber,
        saleType: q.saleType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        idempotencyKey: idemKey,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
      });
      results.push({
        idempotencyKey: idemKey,
        queuedOrderId: q.queuedOrderId,
        queuedInvoiceId: q.queuedInvoiceId,
        status: resCheckout.status,
        body: resCheckout.body
      });
    }

    return res.status(200).json({
      success: true,
      reconciledCount: results.filter(r => r.status === 200).length,
      results
    });
  });

  // Controlled Sale Refund / Credit Note Reversal
  app.post('/api/pos/refund', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { orderNumber, reason } = req.body || {};
    if (!orderNumber) {
      return res.status(400).json({ error: 'orderNumber is required.' });
    }
    const result = erpEngine.refundSaleTransaction({
      orderNumber: String(orderNumber),
      reason: String(reason || ''),
      user,
      ipAddress: getClientIp(req)
    });
    return res.status(result.status).json(result.body);
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE INVENTORY MUTATIONS, LEDGER & STOCK TRANSFERS
  // ===========================================================================
  app.post('/api/inventory/transact', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { branchId, items, operationType, reason, referenceId } = req.body || {};
    if (!branchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'branchId and items array are required.' });
    }

    // Map operationType to its specific granular RBAC permission instead of mapping everything to inventory.adjust
    const requiredPerm = getRequiredInventoryPermission(String(operationType || 'ADJUSTMENT'));
    if (!hasGranularPermission(user.role, user.department, requiredPerm)) {
      return res.status(403).json({
        error: `Forbidden: Missing "${requiredPerm}" permission required for inventory operation "${operationType || 'ADJUSTMENT'}".`,
        errorCode: 'INSUFFICIENT_INVENTORY_PERMISSION',
        requiredPermission: requiredPerm
      });
    }

    if (!canAccessBranch(user.role, user.department, user.branchId, String(branchId))) {
      return res.status(403).json({
        error: `Forbidden: User is not authorized to modify inventory for branch ${branchId}.`
      });
    }

    const updatedBalances: Record<string, number> = {};
    const nowIso = new Date().toISOString();
    const txType: InventoryTransactionType =
      operationType === 'SALE'
        ? 'SALE'
        : operationType === 'DISPATCH'
        ? 'TRANSFER_OUT'
        : operationType === 'RESTOCK'
        ? 'PURCHASE'
        : operationType === 'RETURN'
        ? 'RETURN'
        : 'ADJUSTMENT';

    // Atomic pre-flight check: ensure every item has sufficient available stock
    if (operationType === 'SALE' || operationType === 'DISPATCH') {
      for (const item of items) {
        const prod = erpEngine.products.find(p => p.id === item.productId || (item.sku && p.sku === item.sku));
        const resolvedProdId = prod?.id || item.productId;
        const inv = erpEngine.inventoryItems.find(
          i => i.branchId === branchId && i.productId === resolvedProdId
        );
        const currentBottles = inv ? inv.bottlesOnHand : 0;
        const requestedBottles = Number(item.quantity || item.bottles || 1);
        if (currentBottles < requestedBottles) {
          return res.status(409).json({
            error: `Insufficient stock for product ${item.productName || item.productId}.`,
            productId: resolvedProdId,
            availableBottles: currentBottles,
            requestedBottles
          });
        }
      }
    }

    const transactionId = `tx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    // Atomic execution with Inventory Ledger recording & DAL transaction commit
    for (const item of items) {
      const prod = erpEngine.products.find(p => p.id === item.productId || (item.sku && p.sku === item.sku));
      const resolvedProdId = prod?.id || item.productId;
      let inv = erpEngine.inventoryItems.find(
        i => i.branchId === branchId && i.productId === resolvedProdId
      );
      if (!inv) {
        inv = {
          id: `inv-${branchId}-${resolvedProdId}`,
          branchId,
          productId: resolvedProdId,
          bottlesOnHand: 0,
          casesOnHand: 0,
          reorderLevel: 12,
          batchNumber: 'BATCH-2026',
          expiryDate: '2029-12-31',
          lastScannedAt: nowIso
        };
        erpEngine.inventoryItems.push(inv);
      }

      const beforeQty = inv.bottlesOnHand;
      const requestedBottles = Number(item.quantity || item.bottles || 1);
      const signedDelta =
        operationType === 'SALE' || operationType === 'DISPATCH'
          ? -requestedBottles
          : requestedBottles;
      const tentativeAfterQty = Math.max(0, beforeQty + signedDelta);

      const ledgerTx = {
        id: `invtx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        organizationId: erpEngine.resolveBranchOrganizationId(String(branchId)),
        productId: resolvedProdId,
        sku: prod?.sku || item.sku || resolvedProdId,
        productName: prod?.name || item.productName || resolvedProdId,
        branchId: String(branchId),
        transactionType: txType,
        quantity: signedDelta,
        beforeQuantity: beforeQty,
        afterQuantity: tentativeAfterQty,
        referenceId: String(referenceId || transactionId),
        referenceType: String(operationType || 'INVENTORY_TRANSACT'),
        userId: user.userId,
        userName: user.name,
        reason: String(reason || `Inventory ${operationType || 'transaction'} at ${branchId}`),
        timestamp: nowIso
      };

      const dalRes = await firestoreAuthoritativeStore.commitInventoryMutation({
        tx: ledgerTx,
        updatedInventoryItem: { ...inv, bottlesOnHand: tentativeAfterQty },
        organizationId: ledgerTx.organizationId,
        barcode: prod?.barcode
      });

      if (!dalRes.persisted) {
        return res.status(dalRes.errorCode === 'STOCK_RESERVATION_CONFLICT' ? 409 : 503).json({
          success: false,
          error: dalRes.errorMessage || 'Inventory mutation persistence failed.',
          errorCode: dalRes.errorCode || 'PERSISTENCE_FAILED',
          persistenceStatus: 'PERSISTENCE_FAILED',
          reconciliationId: dalRes.reconciliationId,
          transactionId
        });
      }

      const authQty =
        dalRes.reservedBalances?.[resolvedProdId] ?? tentativeAfterQty;
      inv.bottlesOnHand = authQty;
      inv.casesOnHand = Math.floor(authQty / 12);
      inv.lastScannedAt = nowIso;
      updatedBalances[resolvedProdId] = authQty;

      const snap = dalRes.ledgerSnapshots?.[ledgerTx.id];
      erpEngine.inventoryLedger.push(
        snap
          ? {
              ...ledgerTx,
              beforeQuantity: snap.beforeQuantity,
              afterQuantity: snap.afterQuantity
            }
          : ledgerTx
      );
    }

    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: String(branchId),
      actionType: `INVENTORY_${operationType || 'TRANSACT'}`,
      actionTitle: `Inventory Transacted at Branch ${branchId} (${operationType})`,
      actionDetails: `Items: ${items.length} SKUs adjusted. Transaction ID: ${transactionId}`,
      module: 'INVENTORY',
      entityType: 'INVENTORY',
      entityId: transactionId,
      ipAddress: getClientIp(req)
    });

    erpEngine.persistState();

    res.status(200).json({
      success: true,
      transactionId,
      branchId,
      updatedBalances,
      serverTimestamp: nowIso
    });
  });

  // Query Immutable Inventory Ledger History
  app.get('/api/inventory/ledger', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    if (branchId && !canAccessBranch(user.role, user.department, user.branchId, branchId)) {
      return res.status(403).json({ error: `Forbidden: Unauthorized access to branch ${branchId} ledger.` });
    }

    const filtered = erpEngine.inventoryLedger.filter(entry => {
      if (branchId && entry.branchId !== branchId) return false;
      if (!branchId && !canAccessBranch(user.role, user.department, user.branchId, entry.branchId)) return false;
      if (productId && entry.productId !== productId) return false;
      return true;
    });

    return res.status(200).json({
      total: filtered.length,
      entries: filtered.slice(-limit).reverse()
    });
  });

  // Formal Stock Transfer Workflow Endpoint
  app.post('/api/transfers/workflow', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { transferId, fromBranchId, toBranchId, items, targetStatus, reason } = req.body || {};

    const result = erpEngine.createOrTransitionStockTransfer({
      transferId: transferId ? String(transferId) : undefined,
      fromBranchId: fromBranchId ? String(fromBranchId) : undefined,
      toBranchId: toBranchId ? String(toBranchId) : undefined,
      items: Array.isArray(items) ? items : undefined,
      targetStatus: (targetStatus as StockTransferStatus) || 'REQUESTED',
      reason: reason ? String(reason) : undefined,
      user,
      ipAddress: getClientIp(req)
    });

    return res.status(result.status).json(result.body);
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE DOUBLE-ENTRY ACCOUNTING & PERIOD CONTROLS
  // ===========================================================================
  app.post('/api/accounting/post', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { referenceNumber, description, lines, branchId, date } = req.body || {};

    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Valid double-entry lines (minimum 2 lines) required.' });
    }

    const postingDate = typeof date === 'string' && date.length >= 10 ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    if (!erpEngine.isAccountingPeriodOpen(postingDate)) {
      return res.status(409).json({
        error: `Accounting period ${postingDate.slice(0, 7)} is CLOSED. Cannot post journal entries to a closed period.`
      });
    }

    const totalDebit = Math.round(lines.reduce((sum, l) => sum + (Number(l.debitKes) || 0), 0) * 100) / 100;
    const totalCredit = Math.round(lines.reduce((sum, l) => sum + (Number(l.creditKes) || 0), 0) * 100) / 100;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: `Double-entry imbalance: Total Debit (${totalDebit}) must equal Total Credit (${totalCredit}).`
      });
    }

    const entryNumber = erpEngine.nextDocumentNumber('JE');
    const entryId = `je-${entryNumber}`;
    const journalEntry = {
      id: entryId,
      entryNumber,
      referenceNumber: referenceNumber || entryNumber,
      periodId: postingDate.slice(0, 7),
      branchId: String(branchId || user.branchId || 'branch-1'),
      date: postingDate,
      description: String(description || 'Manual Journal Posting').slice(0, 240),
      lines,
      totalDebitKes: totalDebit,
      totalCreditKes: totalCredit,
      postedBy: user.name,
      createdAt: new Date().toISOString()
    };
    erpEngine.journalEntries.push(journalEntry);

    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: journalEntry.branchId,
      actionType: 'ACCOUNTING_POST',
      actionTitle: `Journal Entry ${journalEntry.entryNumber} Posted (${totalDebit} KES)`,
      actionDetails: description,
      module: 'ACCOUNTING',
      entityType: 'JOURNAL_ENTRY',
      entityId: journalEntry.entryNumber,
      after: journalEntry,
      ipAddress: getClientIp(req)
    });

    erpEngine.persistState();

    res.status(201).json({
      success: true,
      journalEntry
    });
  });

  app.post('/api/accounting/period/close', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { periodId } = req.body || {};
    if (!periodId || typeof periodId !== 'string' || !/^\d{4}-\d{2}$/.test(periodId)) {
      return res.status(400).json({ error: 'Valid periodId in YYYY-MM format (e.g. 2026-10) is required.' });
    }
    const result = erpEngine.closeAccountingPeriod({
      periodId,
      user,
      ipAddress: getClientIp(req)
    });
    return res.status(result.status).json(result);
  });

  app.post('/api/accounting/period/reopen', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { periodId, reason } = req.body || {};
    if (!periodId || typeof periodId !== 'string' || !/^\d{4}-\d{2}$/.test(periodId)) {
      return res.status(400).json({ error: 'Valid periodId in YYYY-MM format (e.g. 2026-10) is required.' });
    }
    const result = erpEngine.reopenAccountingPeriod({
      periodId,
      reason: String(reason || ''),
      user,
      ipAddress: getClientIp(req)
    });
    return res.status(result.status).json(result);
  });

  // ===========================================================================
  // LIVE LOGGED-IN STOREFRONT CUSTOMERS (REAL-TIME ADMIN PRESENCE ROSTER)
  // ===========================================================================
  const liveLoggedInCustomerStore = new Map<string, any>();

  app.post('/api/customers/live-heartbeat', (req: Request, res: Response) => {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const uid = String(body.uid || email || '').trim();
    if (!uid && !email) {
      return res.status(400).json({ error: 'Customer uid or email is required.' });
    }
    const key = email || uid;
    const existing = liveLoggedInCustomerStore.get(key);
    const nowIso = new Date().toISOString();
    const record = {
      uid: uid || existing?.uid || `cust-${Date.now()}`,
      name: String(body.name || existing?.name || email.split('@')[0] || 'Online Customer').trim().slice(0, 120),
      email: email || existing?.email || '',
      phone: String(body.phone || existing?.phone || '').trim().slice(0, 24),
      carrier: body.carrier || existing?.carrier || 'UNKNOWN',
      photoURL: body.photoURL || existing?.photoURL || '',
      deliveryZone: String(body.deliveryZone || existing?.deliveryZone || '').trim().slice(0, 80),
      deliveryStreetAndHouse: String(body.deliveryStreetAndHouse || existing?.deliveryStreetAndHouse || '').trim().slice(0, 120),
      branchId: String(body.branchId || existing?.branchId || '').trim(),
      branchName: String(body.branchName || existing?.branchName || '').trim(),
      cartItemsCount: Math.max(0, Number(body.cartItemsCount ?? existing?.cartItemsCount ?? 0)),
      cartTotalKes: Math.max(0, Number(body.cartTotalKes ?? existing?.cartTotalKes ?? 0)),
      activeOrdersCount: Math.max(0, Number(body.activeOrdersCount ?? existing?.activeOrdersCount ?? 0)),
      status: body.status || 'ONLINE',
      loginAt: existing?.loginAt || body.loginAt || nowIso,
      lastActiveAt: nowIso
    };
    liveLoggedInCustomerStore.set(key, record);
    return res.json({ success: true, customer: record });
  });

  app.post('/api/customers/live-logout', (req: Request, res: Response) => {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const uid = String(body.uid || '').trim();
    if (email) liveLoggedInCustomerStore.delete(email);
    if (uid) {
      for (const [k, v] of liveLoggedInCustomerStore.entries()) {
        if (v.uid === uid) liveLoggedInCustomerStore.delete(k);
      }
    }
    return res.json({ success: true });
  });

  app.get('/api/customers/live-sessions', (_req: Request, res: Response) => {
    const customers = Array.from(liveLoggedInCustomerStore.values()).sort((a, b) =>
      String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || ''))
    );
    return res.json({ success: true, count: customers.length, customers });
  });

  // ===========================================================================
  // SECURE SEQUENTIAL DOCUMENT NUMBERING SERVICE
  // ===========================================================================
  app.post('/api/documents/next-number', authenticateSession, (req: Request, res: Response) => {
    const { documentType } = req.body || {};
    const allowedPrefixes = ['ORD', 'INV', 'RCT', 'QUO', 'PO', 'TRF', 'CN', 'DN', 'JE'];
    const prefix = String(documentType || 'DOC').toUpperCase();
    if (!allowedPrefixes.includes(prefix)) {
      return res.status(400).json({ error: `Invalid documentType. Allowed: ${allowedPrefixes.join(', ')}` });
    }
    const documentNumber = erpEngine.nextDocumentNumber(prefix);
    erpEngine.persistState();
    return res.status(200).json({
      success: true,
      documentType: prefix,
      documentNumber,
      issuedAt: new Date().toISOString()
    });
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE AUDIT LOG VIEWER & NOTIFICATIONS
  // ===========================================================================
  app.get('/api/audit/logs', requireAdmin, (_req: Request, res: Response) => {
    res.status(200).json({
      total: erpEngine.auditLogs.length,
      logs: erpEngine.auditLogs.slice(-100).reverse()
    });
  });

  app.post('/api/audit/log', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { actionType, actionTitle, actionDetails, module, entityType, entityId, before, after } = req.body || {};
    if (!actionType || !actionTitle) {
      return res.status(400).json({ error: 'actionType and actionTitle are required.' });
    }

    const auditRecord = erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: user.branchId,
      action: String(actionType).slice(0, 64),
      actionType: String(actionType).slice(0, 64),
      actionTitle: String(actionTitle).slice(0, 240),
      actionDetails: typeof actionDetails === 'string' ? actionDetails.slice(0, 2000) : undefined,
      module: String(module || 'CORE').slice(0, 64),
      entityType: entityType ? String(entityType).slice(0, 64) : undefined,
      entityId: entityId ? String(entityId).slice(0, 128) : undefined,
      before,
      after,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      logId: auditRecord.id,
      serverTimestamp: auditRecord.serverTimestamp
    });
  });

  // Authoritative Server Endpoints replacing direct browser Firestore writes (#13-#15):
  // Browser -> VAAIRO API -> Authoritative server transaction -> Firestore (Admin SDK)
  app.post('/api/erp/stock-audit/session', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { sessionId, sessionData, baselineLedgers } = req.body || {};
    if (!sessionId || !sessionData || typeof sessionData !== 'object') {
      return res.status(400).json({ error: 'sessionId and sessionData are required.' });
    }
    const targetBranchId = String((sessionData as Record<string, unknown>).branchId || user.branchId);
    if (!canAccessBranch(user.role, user.department, user.branchId, targetBranchId)) {
      return res.status(403).json({
        errorCode: 'BRANCH_ACCESS_DENIED',
        error: `Access denied: cannot modify stock audit session for branch ${targetBranchId}.`
      });
    }
    const ok = await firestoreAuthoritativeStore.persistStockAuditSessionToFirestore(
      String(sessionId),
      sessionData as Record<string, unknown>,
      Array.isArray(baselineLedgers) ? baselineLedgers : undefined
    );
    return res.status(200).json({ success: ok, sessionId: String(sessionId) });
  });

  app.post('/api/erp/stock-audit/approve', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'ADMIN' &&
      user.role !== 'MANAGER' &&
      user.department !== 'BRANCH_MANAGER' &&
      user.department !== 'INVENTORY'
    ) {
      return res.status(403).json({
        errorCode: 'INSUFFICIENT_ROLE_FOR_AUDIT_APPROVAL',
        error: 'Only Super Admin, Branch Manager, or Inventory Manager can approve stock audit sessions.'
      });
    }
    const { sessionId, branchId, approvedAt, approvedBy, ledgers, adjustmentLogs } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }
    const targetBranchId = String(branchId || user.branchId);
    if (!canAccessBranch(user.role, user.department, user.branchId, targetBranchId)) {
      return res.status(403).json({
        errorCode: 'BRANCH_ACCESS_DENIED',
        error: `Access denied: cannot approve stock audit session for branch ${targetBranchId}.`
      });
    }
    const ok = await firestoreAuthoritativeStore.approveStockAuditSessionInFirestore({
      sessionId: String(sessionId),
      approvedAt: String(approvedAt || new Date().toISOString()),
      approvedBy: String(approvedBy || `${user.name} (${user.role})`),
      ledgers: Array.isArray(ledgers) ? ledgers : [],
      adjustmentLogs: Array.isArray(adjustmentLogs) ? adjustmentLogs : []
    });
    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: targetBranchId,
      action: 'STOCK_AUDIT_APPROVED',
      module: 'INVENTORY',
      entityType: 'STOCK_AUDIT_SESSION',
      entityId: String(sessionId),
      ipAddress: getClientIp(req),
      actionDetails: `Approved stock audit session ${sessionId} for branch ${targetBranchId}`
    });
    return res.status(200).json({ success: ok, sessionId: String(sessionId) });
  });

  // Hydrate authoritative Staff Directory & Unified ERP State from Google Cloud Firestore on server boot
  void (async () => {
    try {
      const [cloudStaff, cloudUnifiedDocs] = await Promise.all([
        firestoreAuthoritativeStore.getStaffDirectoryRecordsAuthoritative(),
        firestoreAuthoritativeStore.getUnifiedStateDocsAuthoritative()
      ]);
      for (const rec of cloudStaff) {
        syncStaffDirectoryRecordIntoPinRegistry(rec);
      }
      for (const doc of cloudUnifiedDocs) {
        if (doc && doc.key === 'branches' && typeof doc.payloadJson === 'string') {
          try {
            const parsedBranches = JSON.parse(doc.payloadJson);
            if (Array.isArray(parsedBranches)) {
              for (const b of parsedBranches) {
                if (b && typeof b.id === 'string') {
                  erpEngine.configureBranchPricing({
                    branchId: b.id,
                    branchName: b.name,
                    location: b.location,
                    tier: b.tier,
                    marketClassTier: b.marketClassTier,
                    priceMultiplierPercent: b.priceMultiplierPercent,
                    preferredProductPrices: b.preferredProductPrices
                  });
                }
              }
            }
          } catch {
            // Ignore malformed branches JSON
          }
        }
      }
    } catch {
      // Non-blocking startup hydration
    }
  })();

  // Authoritative Cross-Device Staff Directory, Unified ERP State & Real-Time SSE Stream
  app.get('/api/erp/staff-directory', async (_req: Request, res: Response) => {
    const records = await firestoreAuthoritativeStore.getStaffDirectoryRecordsAuthoritative();
    for (const rec of records) {
      syncStaffDirectoryRecordIntoPinRegistry(rec);
    }
    return res.status(200).json({
      success: true,
      records
    });
  });

  app.post('/api/erp/staff-directory/upsert', async (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    const isTerminalSync = req.headers['x-vaairo-terminal-sync'] === '1';
    if (!caller.authenticated && !isTerminalSync) {
      return res.status(401).json({
        error: 'Unauthorized: Valid session token or terminal sync header required.'
      });
    }
    if (
      caller.authenticated &&
      caller.role &&
      caller.role !== 'SUPER_ADMIN' &&
      caller.role !== 'ADMIN' &&
      caller.role !== 'MANAGER' &&
      caller.department !== 'HR_PAYROLL' &&
      caller.department !== 'BRANCH_MANAGER' &&
      caller.department !== 'SALES_MANAGER' &&
      !isTerminalSync
    ) {
      return res.status(403).json({
        errorCode: 'STAFF_DIRECTORY_WRITE_FORBIDDEN',
        error: 'Only Super Admin, HR/Payroll, Branch Manager, or Sales Manager can mutate staff directory records.'
      });
    }
    const { staffId, record, rawPin } = req.body || {};
    if (!staffId || !record || typeof record !== 'object') {
      return res.status(400).json({ error: 'staffId and record are required.' });
    }
    const recObj = record as Record<string, unknown>;
    const ok = await firestoreAuthoritativeStore.persistStaffDirectoryRecordToFirestore(
      String(staffId),
      recObj,
      true
    );
    if (!ok) {
      return res.status(503).json({
        success: false,
        persisted: false,
        error: 'Unable to save. Check your connection and try again.'
      });
    }
    syncStaffDirectoryRecordIntoPinRegistry({
      ...recObj,
      id: String(staffId),
      ...(rawPin ? { loginPin: String(rawPin) } : {})
    });
    return res.status(200).json({ success: true, persisted: true, staffId: String(staffId) });
  });

  app.post('/api/erp/staff-directory/sync-batch', async (req: Request, res: Response) => {
    const incoming = Array.isArray(req.body?.records) ? req.body.records : [];
    for (const item of incoming) {
      if (item && typeof item === 'object' && typeof item.id === 'string' && item.id) {
        const ok = await firestoreAuthoritativeStore.persistStaffDirectoryRecordToFirestore(
          String(item.id),
          item as Record<string, unknown>,
          false
        );
        if (ok) {
          syncStaffDirectoryRecordIntoPinRegistry(item as Record<string, unknown>);
        }
      }
    }
    const allRecords = await firestoreAuthoritativeStore.getStaffDirectoryRecordsAuthoritative();
    return res.status(200).json({
      success: true,
      records: allRecords
    });
  });

  app.post('/api/erp/staff-directory/delete', async (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    const isTerminalSync = req.headers['x-vaairo-terminal-sync'] === '1';
    if (!caller.authenticated && !isTerminalSync) {
      return res.status(401).json({ error: 'Unauthorized: Valid session token required.' });
    }
    if (
      caller.authenticated &&
      caller.role !== 'SUPER_ADMIN' &&
      caller.role !== 'ADMIN' &&
      caller.role !== 'MANAGER' &&
      caller.department !== 'HR_PAYROLL' &&
      caller.department !== 'BRANCH_MANAGER' &&
      caller.department !== 'SALES_MANAGER' &&
      !isTerminalSync
    ) {
      return res.status(403).json({
        errorCode: 'STAFF_DIRECTORY_DELETE_FORBIDDEN',
        error: 'Only Super Admin, HR/Payroll, Branch Manager, or Sales Manager can delete staff directory records.'
      });
    }
    const { staffId } = req.body || {};
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required.' });
    }
    const cleanStaffId = String(staffId);
    const ok = await firestoreAuthoritativeStore.deleteStaffDirectoryRecordFromFirestore(cleanStaffId);
    if (!ok) {
      return res.status(503).json({
        success: false,
        persisted: false,
        error: 'Unable to save. Check your connection and try again.'
      });
    }
    erpEngine.staffAuthStore.delete(cleanStaffId);
    return res.status(200).json({ success: true, persisted: true, staffId: cleanStaffId });
  });

  // Authoritative Unified ERP State Sync (PC <-> Server <-> Firestore <-> Mobile)
  app.get('/api/erp/unified-state', async (_req: Request, res: Response) => {
    const docs = await firestoreAuthoritativeStore.getUnifiedStateDocsAuthoritative();
    return res.status(200).json({
      success: true,
      docs
    });
  });

  app.post('/api/erp/unified-state/sync', async (req: Request, res: Response) => {
    const docs = Array.isArray(req.body?.docs) ? req.body.docs : [];
    const result = await firestoreAuthoritativeStore.persistUnifiedStateDocsToFirestore(
      docs as Array<Record<string, unknown>>
    );
    if (!result.persisted) {
      return res.status(503).json({
        success: false,
        persisted: false,
        status: 'PERSISTENCE_FAILED',
        error: result.errorMessage || 'Unable to save. Check your connection and try again.'
      });
    }
    for (const doc of result.updatedDocs) {
      if (doc && doc.key === 'branches' && typeof doc.payloadJson === 'string') {
        try {
          const parsedBranches = JSON.parse(doc.payloadJson);
          if (Array.isArray(parsedBranches)) {
            for (const b of parsedBranches) {
              if (b && typeof b.id === 'string') {
                erpEngine.configureBranchPricing({
                  branchId: b.id,
                  branchName: b.name,
                  location: b.location,
                  tier: b.tier,
                  marketClassTier: b.marketClassTier,
                  priceMultiplierPercent: b.priceMultiplierPercent,
                  preferredProductPrices: b.preferredProductPrices
                });
              }
            }
          }
        } catch {
          // Ignore malformed branches JSON
        }
      }
    }
    return res.status(200).json({
      success: true,
      persisted: true,
      status: 'OK',
      syncedCount: result.persistedCount,
      docs: await firestoreAuthoritativeStore.getUnifiedStateDocsAuthoritative()
    });
  });

  // Real-Time Server-Sent Events (SSE) Stream for Instant Cross-Device Sync (PC <-> Mobile)
  app.get('/api/erp/live-stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const sendSseEvent = (eventType: string, data: unknown) => {
      try {
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        // Ignore closed socket
      }
    };

    // Immediately push current authoritative snapshot to the newly connected device
    try {
      const [staffRecords, unifiedDocs] = await Promise.all([
        firestoreAuthoritativeStore.getStaffDirectoryRecordsAuthoritative(),
        firestoreAuthoritativeStore.getUnifiedStateDocsAuthoritative()
      ]);
      const activitySnapshot = firestoreAuthoritativeStore.getUserActivityAndSessionsAuthoritative();
      sendSseEvent('INITIAL_SNAPSHOT', {
        timestamp: new Date().toISOString(),
        staffRecords,
        unifiedDocs,
        activityLogs: activitySnapshot.activityLogs,
        sessionMonitors: activitySnapshot.sessionMonitors
      });
    } catch {
      // Continue streaming updates
    }

    const unsubscribe = firestoreAuthoritativeStore.subscribeLiveSyncEvents(evt => {
      sendSseEvent(evt.type, evt);
    });

    const heartbeatTimer = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      unsubscribe();
    });
  });

  app.get('/api/audit/activity-state', (_req: Request, res: Response) => {
    const data = firestoreAuthoritativeStore.getUserActivityAndSessionsAuthoritative();
    return res.status(200).json({
      success: true,
      ...data
    });
  });

  app.post('/api/audit/activity-log', async (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    const { logId, record } = req.body || {};
    if (!logId || !record || typeof record !== 'object') {
      return res.status(400).json({ error: 'logId and record are required.' });
    }
    const recObj = record as Record<string, unknown>;
    const ok = await firestoreAuthoritativeStore.persistUserActivityLogToFirestore(
      String(logId),
      {
        ...recObj,
        userId: String(caller.userId || recObj.userId || 'erp-user')
      }
    );
    return res.status(200).json({ success: ok });
  });

  app.post('/api/audit/session-monitor', async (req: Request, res: Response) => {
    const caller = resolveOptionalCallerIdentity(req);
    const { record } = req.body || {};
    if (!record || typeof record !== 'object') {
      return res.status(400).json({ error: 'record is required.' });
    }
    const recObj = record as Record<string, unknown>;
    const targetUserId = String(caller.userId || recObj.userId || 'erp-user');
    const ok = await firestoreAuthoritativeStore.persistUserSessionMonitorToFirestore(
      targetUserId,
      {
        ...recObj,
        userId: targetUserId
      }
    );
    return res.status(200).json({ success: ok });
  });

  // Authoritative Branch Preferred Pricing & Market-Class Tier Configuration
  app.post('/api/erp/branches/pricing', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const {
      branchId,
      branchName,
      location,
      tier,
      marketClassTier,
      priceMultiplierPercent,
      preferredProductPrices
    } = req.body || {};

    if (!branchId) {
      return res.status(400).json({ error: 'branchId is required.' });
    }
    const targetBranchId = String(branchId).trim();
    if (!canAccessBranch(user.role, user.department, user.branchId, targetBranchId)) {
      return res.status(403).json({
        errorCode: 'BRANCH_ACCESS_DENIED',
        error: `Access denied: cannot configure pricing for branch ${targetBranchId}.`
      });
    }

    const updated = erpEngine.configureBranchPricing({
      branchId: targetBranchId,
      branchName: branchName ? String(branchName) : undefined,
      location: location ? String(location) : undefined,
      tier: tier as any,
      marketClassTier: marketClassTier as any,
      priceMultiplierPercent:
        priceMultiplierPercent !== undefined ? Number(priceMultiplierPercent) : undefined,
      preferredProductPrices:
        preferredProductPrices && typeof preferredProductPrices === 'object'
          ? preferredProductPrices
          : undefined
    });

    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: targetBranchId,
      action: 'BRANCH_PRICING_CONFIGURED',
      module: 'BRANCHES',
      entityType: 'BRANCH_PRICING',
      entityId: targetBranchId,
      ipAddress: getClientIp(req),
      actionDetails: `Updated preferred pricing for branch ${branchName || targetBranchId} (Tier: ${updated?.marketClassTier}, Multiplier: ${updated?.priceMultiplierPercent}%, Product overrides: ${Object.keys(updated?.preferredProductPrices || {}).length})`
    });

    return res.status(200).json({
      success: true,
      branchPricing: updated
    });
  });

  app.get('/api/erp/branches/pricing', authenticateSession, (_req: Request, res: Response) => {
    return res.status(200).json({
      branchPricingConfigs: Array.from(erpEngine.branchPricingConfigs.values())
    });
  });

  app.get('/api/notifications', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const filtered = erpEngine.notifications.filter(n =>
      !n.branchId || canAccessBranch(user.role, user.department, user.branchId, n.branchId)
    );
    res.status(200).json({
      total: filtered.length,
      notifications: filtered.slice(-100).reverse()
    });
  });

  // ===========================================================================
  // TRANSACTIONAL EMAIL SYSTEM (support@urbantechdev.com via Zoho & Cloudflare)
  // ===========================================================================
  app.post('/api/email/send', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { to, subject, templateType, bodyText, referenceId } = req.body || {};
    if (!to || !subject || !bodyText) {
      return res.status(400).json({ error: 'to, subject, and bodyText are required.' });
    }

    const emailRecord = await erpEngine.dispatchTransactionalEmail({
      to: String(to).trim(),
      subject: String(subject).trim(),
      templateType: templateType || 'SYSTEM_NOTIFICATION',
      bodyText: String(bodyText),
      referenceId: referenceId ? String(referenceId) : undefined,
      user,
      ipAddress: getClientIp(req)
    });

    return res.status(200).json({
      success: emailRecord.status !== 'FAILED',
      sent: emailRecord.status === 'SENT',
      status: emailRecord.status,
      emailRecord
    });
  });

  // Automated Customer Order Lifecycle Email Endpoint (Order Placed, Rider Dispatched, Status Update, Official Receipt)
  // Security Audit Fix (#11 & #12):
  // - Never unauthenticated: requires either an authenticated ERP session (Bearer/Cookie token) OR a verified server-issued checkoutToken.
  // - Server validates the order against authoritative server sales / checkout records and constructs the email payload server-side.
  // - Never falsely reports SENT when no outbound provider is configured (reports PROVIDER_NOT_CONFIGURED / QUEUED / FAILED / SENT).
  app.post('/api/email/order-lifecycle', async (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const sessionUser = token ? verifySessionToken(token) : null;
    const {
      checkoutToken,
      to,
      customerEmail,
      customerName,
      orderNumber,
      eventStage,
      stage: rawStage,
      branchId,
      branchName,
      deliveryLocation,
      riderName,
      riderPhone,
      estimatedEtaMinutes,
      mpesaReceiptNumber,
      etimsInvoiceNumber,
      kraControlCode,
      qrUrl,
      items
    } = req.body || {};

    let verifiedCheckoutRecord: ReturnType<typeof erpEngine.verifyPublicStorefrontCheckoutToken>['record'] | undefined;
    if (!sessionUser) {
      if (checkoutToken && typeof checkoutToken === 'string') {
        const tokenCheck = erpEngine.verifyPublicStorefrontCheckoutToken({
          checkoutToken: String(checkoutToken).trim()
        });
        if (tokenCheck.valid && tokenCheck.record) {
          verifiedCheckoutRecord = tokenCheck.record;
        }
      }
      if (!verifiedCheckoutRecord) {
        return res.status(401).json({
          errorCode: 'AUTHENTICATION_REQUIRED',
          error:
            'Authentication required: /api/email/order-lifecycle requires a valid ERP session token or a verified server-issued checkoutToken.'
        });
      }
    }

    const cleanOrderNumber = String(
      verifiedCheckoutRecord?.orderNumber || orderNumber || ''
    ).trim();
    const recipientEmail = String(to || customerEmail || '').trim();
    if (!recipientEmail || !recipientEmail.includes('@') || !cleanOrderNumber) {
      return res.status(400).json({
        errorCode: 'INVALID_ORDER_EMAIL_REQUEST',
        error: 'Valid customer email (to) and orderNumber are required.'
      });
    }

    // Look up authoritative server order or validate items against server catalog
    const authoritativeSale =
      erpEngine.sales.get(cleanOrderNumber) ||
      Array.from(erpEngine.sales.values()).find(
        s => s.orderNumber === cleanOrderNumber || s.id === cleanOrderNumber
      );
    const matchedCheckoutToken =
      verifiedCheckoutRecord ||
      Array.from(erpEngine.publicCheckoutTokens.values()).find(
        t => t.orderNumber === cleanOrderNumber
      );

    // If neither an authoritative sale, a server checkout token, nor valid catalog items exist, reject arbitrary email fabrication
    let authoritativeTotalKes = 0;
    let authoritativeSubtotalKes = 0;
    let authoritativeVatKes = 0;
    let authoritativeItemsSummary = '';
    let authoritativeInvoiceNo = '';
    let authoritativeKraCode = '';
    let authoritativeReceiptNo = '';

    if (authoritativeSale) {
      const matchedFiscal = erpEngine.fiscalTransactions.get(
        authoritativeSale.fiscalTransactionId
      );
      const matchedPayment = erpEngine.payments.get(
        authoritativeSale.paymentId
      );
      authoritativeTotalKes = authoritativeSale.totalAmountKes;
      authoritativeSubtotalKes = authoritativeSale.subtotalKes;
      authoritativeVatKes = authoritativeSale.vatAmountKes;
      authoritativeInvoiceNo = authoritativeSale.invoiceNumber;
      authoritativeKraCode = matchedFiscal?.kraControlCode || matchedFiscal?.cuSerial || 'VERIFIED';
      authoritativeReceiptNo = matchedPayment?.reference || authoritativeSale.receiptNumber;
      authoritativeItemsSummary = authoritativeSale.items
        .map(
          it =>
            `- ${it.quantity}x ${it.productName} (${it.sku}) @ KES ${it.authoritativeUnitPriceKes.toLocaleString()} = KES ${it.lineTotalKes.toLocaleString()}`
        )
        .join('\n');
    } else if (matchedCheckoutToken) {
      authoritativeTotalKes = matchedCheckoutToken.authoritativeAmountKes;
      authoritativeSubtotalKes = Math.round((authoritativeTotalKes / 1.16) * 100) / 100;
      authoritativeVatKes = Math.round((authoritativeTotalKes - authoritativeSubtotalKes) * 100) / 100;
      authoritativeItemsSummary = matchedCheckoutToken.items
        .map(
          it =>
            `- ${it.quantity}x ${it.productName} (${it.sku}) @ KES ${it.unitPriceKes.toLocaleString()} = KES ${it.lineTotalKes.toLocaleString()}`
        )
        .join('\n');
    } else if (Array.isArray(items) && items.length > 0) {
      const resolvedLines: string[] = [];
      for (const rawItem of items) {
        const pid = String(rawItem?.productId || '').trim();
        const pName = String(rawItem?.productName || '').trim();
        const qty = Number(rawItem?.quantity || 0);
        const prod = pid
          ? erpEngine.products.find(p => p.id === pid)
          : erpEngine.products.find(p => p.name === pName);
        if (!prod || !Number.isInteger(qty) || qty <= 0) {
          return res.status(400).json({
            errorCode: 'UNVERIFIED_ORDER_ITEMS',
            error: 'Order lifecycle email requires server-verified order items from the authoritative product catalog.'
          });
        }
        const lineTotal = Math.round(prod.retailPriceKes * qty * 100) / 100;
        authoritativeTotalKes += lineTotal;
        resolvedLines.push(
          `- ${qty}x ${prod.name} (${prod.sku}) @ KES ${prod.retailPriceKes.toLocaleString()} = KES ${lineTotal.toLocaleString()}`
        );
      }
      authoritativeTotalKes = Math.round(authoritativeTotalKes * 100) / 100;
      authoritativeSubtotalKes = Math.round((authoritativeTotalKes / 1.16) * 100) / 100;
      authoritativeVatKes = Math.round((authoritativeTotalKes - authoritativeSubtotalKes) * 100) / 100;
      authoritativeItemsSummary = resolvedLines.join('\n');
    } else {
      return res.status(404).json({
        errorCode: 'AUTHORITATIVE_ORDER_NOT_FOUND',
        error: `Order "${cleanOrderNumber}" does not exist in authoritative server records. The browser cannot construct unverified order emails.`
      });
    }

    const stage = String(eventStage || rawStage || 'ORDER_PLACED').toUpperCase();
    if (stage === 'COMPLETED_AND_PAID' && !authoritativeSale) {
      return res.status(403).json({
        errorCode: 'UNVERIFIED_RECEIPT_EMAIL_FORBIDDEN',
        error: 'Official 16% VAT Purchase Receipt emails can only be generated from completed server-verified sales.'
      });
    }

    const cust = String(
      customerName ||
        (authoritativeSale
          ? erpEngine.payments.get(authoritativeSale.paymentId)?.customerName
          : undefined) ||
        'Valued Customer'
    );
    const resolvedBranchName = String(
      branchName || branchId || matchedCheckoutToken?.branchId || authoritativeSale?.branchId || 'VAAIRO Branch'
    );
    let subject = `[VAAIRO] Order Confirmation: ${cleanOrderNumber}`;
    let templateType: 'ORDER_CONFIRMATION' | 'ORDER_STATUS_UPDATE' | 'PURCHASE_RECEIPT' = 'ORDER_CONFIRMATION';
    let bodyText = '';

    if (stage === 'ORDER_PLACED') {
      subject = `[VAAIRO] Order Confirmed (${cleanOrderNumber}) • Routed to ${resolvedBranchName}`;
      templateType = 'ORDER_CONFIRMATION';
      bodyText = `Dear ${cust},\n\nThank you for ordering from VAAIRO Official Online Storefront (Direct Company Price).\n\nORDER SUMMARY:\n- Order Number: ${cleanOrderNumber}\n- Status: ON HOLD — AWAITING DOORSTEP DELIVERY\n- Fulfilling Branch: ${resolvedBranchName}\n- Delivery Location: ${deliveryLocation || 'Nairobi'}\n- Assigned Rider: ${riderName || 'Dispatching Shortly'}${riderPhone ? ` (${riderPhone})` : ''}\n${estimatedEtaMinutes ? `- Estimated Arrival: ~${estimatedEtaMinutes} mins\n` : ''}- Total Amount (Server-Verified Direct Company Price): KES ${authoritativeTotalKes.toLocaleString()}\n\nORDERED ITEMS:\n${authoritativeItemsSummary}\n\nYou will receive an M-Pesa STK Push payment prompt upon delivery arrival.\nFor support or inquiries, reply directly to ${DEFAULT_BRANDING_CONFIG.supportEmail}.`;
    } else if (stage === 'OUT_FOR_DELIVERY' || stage === 'RIDER_ASSIGNED') {
      subject = `[VAAIRO] Out for Delivery: Order ${cleanOrderNumber} is on the way!`;
      templateType = 'ORDER_STATUS_UPDATE';
      bodyText = `Dear ${cust},\n\nGreat news! Your VAAIRO order (${cleanOrderNumber}) has been dispatched from ${resolvedBranchName} and is now OUT FOR DELIVERY.\n\nDELIVERY TRACKING:\n- Order Number: ${cleanOrderNumber}\n- Status: OUT FOR DELIVERY\n- Dispatch Rider: ${riderName || 'VAAIRO Express Rider'}${riderPhone ? ` • Phone: ${riderPhone}` : ''}\n- Destination: ${deliveryLocation || 'Your Delivery Address'}\n- Amount Due on Arrival: KES ${authoritativeTotalKes.toLocaleString()}\n\nFor assistance, reply to ${DEFAULT_BRANDING_CONFIG.supportEmail}.`;
    } else if (stage === 'DELIVERED_AWAITING_PAYMENT') {
      subject = `[VAAIRO] Rider Arrived for Order ${cleanOrderNumber} • Complete M-Pesa Payment`;
      templateType = 'ORDER_STATUS_UPDATE';
      bodyText = `Dear ${cust},\n\nYour VAAIRO delivery rider (${riderName || 'VAAIRO Dispatch'}) has arrived at ${deliveryLocation || 'your location'} with Order ${cleanOrderNumber}.\n\nPAYMENT INSTRUCTIONS:\n- Total Due (Direct Company Price): KES ${authoritativeTotalKes.toLocaleString()}\n- Please complete the M-Pesa STK Push prompt on your phone to receive your official 16% VAT Tax Receipt immediately.\n\nSupport: ${DEFAULT_BRANDING_CONFIG.supportEmail}.`;
    } else {
      const invNum = authoritativeInvoiceNo || etimsInvoiceNumber || `VAT-INV-${cleanOrderNumber}`;
      const kraCode = authoritativeKraCode || kraControlCode || 'VERIFIED';
      const rcptNum = authoritativeReceiptNo || mpesaReceiptNumber || 'CONFIRMED';
      subject = `[VAAIRO] Purchase Successful & Official 16% VAT Receipt (${invNum})`;
      templateType = 'PURCHASE_RECEIPT';
      bodyText = `Dear ${cust},\n\nPayment confirmed! Thank you for purchasing from VAAIRO Beverages & Merchants Ltd.\n\nOFFICIAL 16% VAT TAX RECEIPT DETAILS:\n- Order Number: ${cleanOrderNumber}\n- 16% VAT Tax Invoice: ${invNum}\n- VAT Audit Code: ${kraCode}\n- M-Pesa Receipt Number: ${rcptNum}\n- Fulfilling Branch: ${resolvedBranchName}\n\nITEMS PURCHASED:\n${authoritativeItemsSummary}\n\nSubtotal (Excl. 16% VAT): KES ${authoritativeSubtotalKes.toLocaleString()}\nEnforced 16% VAT: KES ${authoritativeVatKes.toLocaleString()}\nTOTAL PAID: KES ${authoritativeTotalKes.toLocaleString()}\n\nVerify 16% VAT Receipt: ${qrUrl || 'https://vaairo.co.ke/verify-vat'}\nThank you for choosing VAAIRO! Strictly 18+ Drink Responsibly.\nSupport & Inquiries: ${DEFAULT_BRANDING_CONFIG.supportEmail}`;
    }

    const emailRecord = await erpEngine.dispatchTransactionalEmail({
      to: recipientEmail,
      subject,
      templateType,
      bodyText,
      referenceId: cleanOrderNumber,
      user: sessionUser
        ? {
            userId: sessionUser.userId,
            name: sessionUser.name,
            role: sessionUser.role,
            department: sessionUser.department
          }
        : {
            userId: 'system-order-mailer',
            name: 'VAAIRO Automated Order Mailer',
            role: 'SYSTEM',
            department: 'POS'
          },
      ipAddress: getClientIp(req)
    });

    return res.status(200).json({
      success: emailRecord.status !== 'FAILED',
      sent: emailRecord.status === 'SENT',
      status: emailRecord.status,
      emailRecord
    });
  });

  app.get('/api/email/status', requireAdmin, (_req: Request, res: Response) => {
    const envEmail = (process.env.EMAIL_FROM_ADDRESS || '').trim();
    const validFrom = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(envEmail)
      ? envEmail
      : DEFAULT_BRANDING_CONFIG.supportEmail;
    return res.status(200).json({
      senderEmail: validFrom,
      replyToMailbox: validFrom,
      domain: DEFAULT_BRANDING_CONFIG.emailDomain,
      planTier: 'ZOHO_MAIL_FREE_PLAN',
      communicationMode: 'ONE_WAY_OUTBOUND_FROM_ERP',
      receivingDestination: 'Zoho Mail Webmail Inbox (https://mail.zoho.com)',
      provider: 'Zoho Mail Free Plan + Cloudflare DNS',
      dnsSecurity: {
        mx: ['10 mx.zoho.com', '20 mx2.zoho.com', '50 mx3.zoho.com'],
        spf: 'v=spf1 include:zoho.com ~all',
        dkim: 'zmail._domainkey.urbantechdev.com (Verified)',
        dmarc: 'v=DMARC1; p=quarantine; rua=mailto:support@urbantechdev.com'
      },
      totalDispatched: erpEngine.emailLogs.length,
      recentLogs: erpEngine.emailLogs.slice(-50).reverse()
    });
  });

  // ===========================================================================
  // MERCHANT FEED SYNC & REFRESH ENDPOINTS
  // ===========================================================================
  app.post('/api/merchant-feed/sync', verifyAdminAuth, (req: Request, res: Response) => {
    const { products, inventoryItems, activeBranchId } = req.body || {};

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Valid non-empty products array required.' });
    }
    const isValidProducts = products.every(
      (p: Product) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.sku === 'string' && typeof p.retailPriceKes === 'number'
    );
    if (!isValidProducts) {
      return res.status(400).json({ error: 'Malformed product records detected.' });
    }

    if (Array.isArray(inventoryItems)) {
      const isValidInventory = inventoryItems.every(
        (i: InventoryItem) => i && typeof i.branchId === 'string' && typeof i.productId === 'string' && typeof i.bottlesOnHand === 'number'
      );
      if (!isValidInventory) {
        return res.status(400).json({ error: 'Malformed inventory items detected.' });
      }
      erpEngine.inventoryItems = inventoryItems;
    }

    erpEngine.products = products;
    if (typeof activeBranchId === 'string' && activeBranchId.trim()) {
      liveActiveBranchId = activeBranchId.trim();
    }

    const origin = resolveRequestOrigin(req);
    regenerateMerchantFeeds(origin);
    const diagnostics = runMerchantAndSchemaDiagnostics(cachedFeedItems);

    res.status(200).json({
      success: true,
      lastFeedRefreshIso,
      nextScheduledRefreshIso,
      feedUrlXml: `${origin}/feeds/google-shopping.xml`,
      feedUrlCsv: `${origin}/feeds/google-shopping.csv`,
      diagnostics
    });
  });

  app.post('/api/merchant-feed/refresh', verifyAdminAuth, (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    regenerateMerchantFeeds(origin);
    const diagnostics = runMerchantAndSchemaDiagnostics(cachedFeedItems);

    res.status(200).json({
      success: true,
      lastFeedRefreshIso,
      nextScheduledRefreshIso,
      feedUrlXml: `${origin}/feeds/google-shopping.xml`,
      feedUrlCsv: `${origin}/feeds/google-shopping.csv`,
      diagnostics
    });
  });

  // ===========================================================================
  // PRODUCTION SAFARICOM DARAJA M-PESA GATEWAY (STK PUSH, STK QUERY & SIGNED WEBHOOKS)
  // Persisted to Firestore `mpesaTransactions/{checkoutRequestId}` via Admin SDK
  // ===========================================================================
  interface DarajaRuntimeConfig {
    environment: 'PRODUCTION' | 'SANDBOX';
    baseUrl: string;
    consumerKey: string;
    consumerSecret: string;
    passkey: string;
    shortCode: string;
    partyB: string;
    transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
    callbackUrl: string;
    webhookSecret: string;
    configured: boolean;
  }

  let cachedDarajaToken: { accessToken: string; expiresAtMs: number; baseUrl: string } | null = null;

  function resolveDarajaConfig(req?: Request): DarajaRuntimeConfig {
    const rawEnv = (process.env.MPESA_ENV || 'production').trim().toLowerCase();
    const environment: 'PRODUCTION' | 'SANDBOX' =
      rawEnv === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
    const defaultBaseUrl =
      environment === 'SANDBOX'
        ? 'https://sandbox.safaricom.co.ke'
        : 'https://api.safaricom.co.ke';
    const baseUrl = (process.env.MPESA_BASE_URL || defaultBaseUrl).trim().replace(/\/+$/, '');
    const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim();
    const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    const shortCode = (process.env.MPESA_SHORTCODE || '4082211').trim();
    const partyB = (process.env.MPESA_PARTY_B || shortCode).trim();
    const rawTxType = (process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline').trim();
    const transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' =
      rawTxType === 'CustomerBuyGoodsOnline' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const origin = resolveRequestOrigin(req);
    const callbackUrl = (
      process.env.MPESA_CALLBACK_URL || `${origin}/api/mpesa/daraja-webhook`
    ).trim();
    const webhookSecret =
      (process.env.MPESA_WEBHOOK_SECRET || '').trim() || resolvedSecrets.sessionSecret;

    const configured = Boolean(consumerKey && consumerSecret && passkey && shortCode);

    return {
      environment,
      baseUrl,
      consumerKey,
      consumerSecret,
      passkey,
      shortCode,
      partyB,
      transactionType,
      callbackUrl,
      webhookSecret,
      configured
    };
  }

  function normalizeKenyanMpesaPhoneServer(rawPhone: string): string | null {
    const digits = String(rawPhone || '').replace(/\D+/g, '');
    if (digits.startsWith('254') && digits.length === 12 && /^[71]/.test(digits.slice(3))) {
      return digits;
    }
    if (digits.startsWith('0') && digits.length === 10 && /^[71]/.test(digits.slice(1))) {
      return `254${digits.slice(1)}`;
    }
    if (digits.length === 9 && /^[71]/.test(digits)) {
      return `254${digits}`;
    }
    return null;
  }

  function buildDarajaTimestampAndPassword(
    shortCode: string,
    passkey: string,
    now = new Date()
  ): { timestamp: string; password: string } {
    const timestamp = now
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    return { timestamp, password };
  }

  function computeMpesaCallbackSignature(params: {
    webhookSecret: string;
    orderNumber: string;
    expectedAmountKes: number;
    expectedPhone: string;
    shortCode: string;
  }): string {
    return crypto
      .createHmac('sha256', params.webhookSecret)
      .update(
        `${params.orderNumber}:${Math.ceil(params.expectedAmountKes)}:${params.expectedPhone}:${params.shortCode}`
      )
      .digest('hex');
  }

  function verifyConstantTimeSignature(expectedHex: string, providedHex: string): boolean {
    if (!expectedHex || !providedHex) return false;
    try {
      const a = Buffer.from(expectedHex.trim(), 'utf8');
      const b = Buffer.from(providedHex.trim(), 'utf8');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async function getDarajaAccessToken(config: DarajaRuntimeConfig): Promise<string> {
    const nowMs = Date.now();
    if (
      cachedDarajaToken &&
      cachedDarajaToken.baseUrl === config.baseUrl &&
      cachedDarajaToken.expiresAtMs > nowMs + 60_000
    ) {
      return cachedDarajaToken.accessToken;
    }

    const basicAuth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
      'base64'
    );
    const tokenRes = await fetch(
      `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json'
        }
      }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Daraja OAuth failed (${tokenRes.status}): ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: string | number;
    };
    const accessToken = String(tokenData.access_token || '').trim();
    if (!accessToken) {
      throw new Error('Daraja OAuth response did not include an access_token.');
    }

    const expiresInSec = Math.max(60, Number(tokenData.expires_in) || 3599);
    cachedDarajaToken = {
      accessToken,
      expiresAtMs: nowMs + expiresInSec * 1000,
      baseUrl: config.baseUrl
    };
    return accessToken;
  }

  async function queryUpstreamDarajaStkStatus(
    config: DarajaRuntimeConfig,
    checkoutRequestId: string
  ): Promise<{
    queried: boolean;
    resultCode?: number;
    resultDesc?: string;
    merchantRequestId?: string;
    rawResponse?: string;
  }> {
    if (!config.configured) {
      return { queried: false };
    }
    try {
      const accessToken = await getDarajaAccessToken(config);
      const { timestamp, password } = buildDarajaTimestampAndPassword(
        config.shortCode,
        config.passkey
      );
      const queryRes = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: config.shortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        })
      });
      const rawText = await queryRes.text();
      let parsed: Record<string, any> = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return { queried: false, rawResponse: rawText };
      }

      if (parsed.ResultCode !== undefined && parsed.ResultCode !== null && parsed.ResultCode !== '') {
        return {
          queried: true,
          resultCode: Number(parsed.ResultCode),
          resultDesc: String(parsed.ResultDesc || ''),
          merchantRequestId: parsed.MerchantRequestID ? String(parsed.MerchantRequestID) : undefined,
          rawResponse: rawText
        };
      }
      return { queried: false, rawResponse: rawText };
    } catch (err) {
      return { queried: false, rawResponse: String(err) };
    }
  }

  // 1. Gateway Status & Readiness Endpoint
  app.get('/api/mpesa/status', (req: Request, res: Response) => {
    const config = resolveDarajaConfig(req);
    res.status(200).json({
      configured: config.configured,
      environment: config.environment,
      baseUrl: config.baseUrl,
      shortCode: config.shortCode,
      partyB: config.partyB,
      transactionType: config.transactionType,
      callbackUrl: config.callbackUrl
    });
  });

  // Rate limiter for M-Pesa STK Push initiation per phone / IP to prevent prompt-flooding abuse
  const stkPushRateLimiter = new Map<string, { count: number; windowStartMs: number }>();
  function checkStkPushRateLimit(key: string, maxPerMinute = 5): boolean {
    const nowMs = Date.now();
    const entry = stkPushRateLimiter.get(key);
    if (!entry || nowMs - entry.windowStartMs > 60_000) {
      stkPushRateLimiter.set(key, { count: 1, windowStartMs: nowMs });
      return true;
    }
    if (entry.count >= maxPerMinute) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  async function dispatchDarajaStkPushAndPersistPending(params: {
    req: Request;
    res: Response;
    normalizedPhone: string;
    expectedAmountKes: number;
    resolvedOrderNumber: string;
    cleanAccountRef: string;
    cleanDesc: string;
    organizationId: string;
    branchId: string;
  }) {
    const {
      req,
      res,
      normalizedPhone,
      expectedAmountKes,
      resolvedOrderNumber,
      cleanAccountRef,
      cleanDesc,
      organizationId,
      branchId
    } = params;

    const config = resolveDarajaConfig(req);
    if (!config.configured) {
      return res.status(503).json({
        success: false,
        errorCode: 'DARAJA_CREDENTIALS_NOT_CONFIGURED',
        environment: config.environment,
        shortCode: config.shortCode,
        error:
          'Safaricom Daraja API credentials (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY) are not configured on the server. Please configure your production Daraja keys in environment variables, or complete payment via Paybill/Till and verify the M-Pesa receipt.'
      });
    }

    const callbackSignatureToken = computeMpesaCallbackSignature({
      webhookSecret: config.webhookSecret,
      orderNumber: resolvedOrderNumber,
      expectedAmountKes,
      expectedPhone: normalizedPhone,
      shortCode: config.shortCode
    });

    try {
      const accessToken = await getDarajaAccessToken(config);
      const { timestamp, password } = buildDarajaTimestampAndPassword(
        config.shortCode,
        config.passkey
      );

      // Use clean CallBackURL without relying on query-string secrets being preserved by Safaricom
      const stkRes = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: config.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: config.transactionType,
          Amount: expectedAmountKes,
          PartyA: normalizedPhone,
          PartyB: config.partyB,
          PhoneNumber: normalizedPhone,
          CallBackURL: config.callbackUrl,
          AccountReference: cleanAccountRef,
          TransactionDesc: cleanDesc
        })
      });

      const stkData = (await stkRes.json()) as Record<string, any>;
      if (!stkRes.ok || String(stkData.ResponseCode ?? '') !== '0') {
        return res.status(502).json({
          success: false,
          errorCode: 'DARAJA_STK_REJECTED',
          error:
            stkData.errorMessage ||
            stkData.ResponseDescription ||
            'Safaricom Daraja rejected the STK Push request.',
          details: stkData
        });
      }

      const checkoutRequestId = String(stkData.CheckoutRequestID || '').trim();
      const merchantRequestId = String(stkData.MerchantRequestID || '').trim();
      const nowIso = new Date().toISOString();

      const pendingRecord: AuthoritativeMpesaTransactionRecord = {
        id: firestoreAuthoritativeStore.formatMpesaDocId(checkoutRequestId),
        checkoutRequestId,
        merchantRequestId,
        organizationId,
        branchId,
        orderNumber: resolvedOrderNumber,
        accountReference: cleanAccountRef,
        transactionDesc: cleanDesc,
        expectedAmountKes,
        expectedPhone: normalizedPhone,
        shortCode: config.shortCode,
        transactionType: config.transactionType,
        status: 'PENDING',
        callbackSignatureToken,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await firestoreAuthoritativeStore.createPendingMpesaTransaction(pendingRecord);

      return res.status(200).json({
        success: true,
        status: 'PENDING',
        environment: config.environment,
        checkoutRequestId,
        merchantRequestId,
        responseCode: String(stkData.ResponseCode),
        responseDescription: String(stkData.ResponseDescription || 'Success'),
        customerMessage: String(
          stkData.CustomerMessage || 'Success. Request accepted for processing'
        ),
        expectedAmountKes,
        expectedPhone: normalizedPhone,
        shortCode: config.shortCode,
        orderNumber: resolvedOrderNumber
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        errorCode: 'DARAJA_GATEWAY_UNREACHABLE',
        error: 'Failed to communicate with Safaricom Daraja STK Push gateway.',
        details: String(err)
      });
    }
  }

  // 2A. ERP / POS Authenticated Safaricom Daraja STK Push Endpoint
  // Enforces: authenticateSession -> organization -> branch -> order -> authoritative order amount -> STK Push
  app.post('/api/mpesa/stk-push', authenticateSession, async (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const {
      phone,
      amount,
      orderNumber,
      accountReference,
      transactionDesc,
      branchId,
      organizationId,
      saleType,
      items
    } = req.body || {};

    const normalizedPhone = normalizeKenyanMpesaPhoneServer(String(phone || ''));
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_MPESA_PHONE',
        error:
          'Valid Kenyan mobile number is required (e.g. 0712 345 678, 0110 000 000, or 2547XXXXXXXX).'
      });
    }

    if (!checkStkPushRateLimit(`${getClientIp(req)}:${normalizedPhone}`, 5)) {
      return res.status(429).json({
        success: false,
        errorCode: 'STK_PUSH_RATE_LIMITED',
        error: 'Too many STK Push requests for this phone number. Please wait 60 seconds.'
      });
    }

    const posAuth = erpEngine.verifyAuthorizedPosStkPushRequest({
      user,
      branchId: branchId ? String(branchId) : undefined,
      organizationId: organizationId ? String(organizationId) : undefined,
      orderNumber: orderNumber ? String(orderNumber) : undefined,
      requestedAmountKes: amount !== undefined ? Number(amount) : undefined,
      saleType: saleType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      items: Array.isArray(items) ? items : undefined
    });

    if (!posAuth.authorized || !posAuth.authoritativeAmountKes) {
      return res.status(posAuth.status).json({
        success: false,
        errorCode: posAuth.errorCode,
        error: posAuth.error
      });
    }

    const resolvedOrderNumber = posAuth.verifiedOrderNumber || `POS-${Date.now()}`;
    const cleanAccountRef =
      String(accountReference || resolvedOrderNumber)
        .replace(/[^a-zA-Z0-9-]/g, '')
        .slice(0, 12) || 'VAAIRO';
    const cleanDesc = String(transactionDesc || `VAAIRO ${cleanAccountRef}`).slice(0, 13);

    return dispatchDarajaStkPushAndPersistPending({
      req,
      res,
      normalizedPhone,
      expectedAmountKes: posAuth.authoritativeAmountKes,
      resolvedOrderNumber,
      cleanAccountRef,
      cleanDesc,
      organizationId: posAuth.verifiedOrganizationId || 'org-merchant-vaairo-hq',
      branchId: posAuth.verifiedBranchId || liveActiveBranchId || 'branch-1'
    });
  });

  // 2B. Public Storefront Controlled Checkout Order Token Endpoint
  // Computes authoritative order total on the server from catalog prices and issues a signed checkoutToken
  app.post('/api/storefront/checkout-token', (req: Request, res: Response) => {
    const { orderId, orderNumber, branchId, customerName, customerEmail, customerPhone, items } =
      req.body || {};
    const tokenRes = erpEngine.issuePublicStorefrontCheckoutToken({
      orderId: orderId ? String(orderId) : undefined,
      orderNumber: orderNumber ? String(orderNumber) : undefined,
      branchId: String(branchId || liveActiveBranchId || 'branch-1'),
      customerName: customerName ? String(customerName) : undefined,
      customerEmail: customerEmail ? String(customerEmail) : undefined,
      customerPhone: String(customerPhone || ''),
      items: Array.isArray(items) ? items : []
    });

    if (!tokenRes.success || !tokenRes.record) {
      return res.status(tokenRes.status).json({
        success: false,
        errorCode: tokenRes.errorCode,
        error: tokenRes.error
      });
    }

    return res.status(201).json({
      success: true,
      checkoutToken: tokenRes.record.checkoutToken,
      orderId: tokenRes.record.orderId,
      orderNumber: tokenRes.record.orderNumber,
      branchId: tokenRes.record.branchId,
      organizationId: tokenRes.record.organizationId,
      authoritativeAmountKes: tokenRes.record.authoritativeAmountKes,
      expiresAtMs: tokenRes.record.expiresAtMs
    });
  });

  // 2C. Public Storefront Controlled M-Pesa STK Push Endpoint
  // Accepts ONLY a server-issued `checkoutToken` (never arbitrary `organizationId`, `branchId`, or `amount` from browser)
  app.post('/api/mpesa/storefront-stk-push', async (req: Request, res: Response) => {
    const { checkoutToken, phone, orderNumber } = req.body || {};

    const tokenVerify = erpEngine.verifyPublicStorefrontCheckoutToken({
      checkoutToken: String(checkoutToken || ''),
      orderNumber: orderNumber ? String(orderNumber) : undefined
    });

    if (!tokenVerify.valid || !tokenVerify.record) {
      return res.status(tokenVerify.status).json({
        success: false,
        errorCode: tokenVerify.errorCode,
        error: tokenVerify.error
      });
    }

    const orderRecord = tokenVerify.record;
    const normalizedPhone = normalizeKenyanMpesaPhoneServer(
      String(phone || orderRecord.customerPhone || '')
    );
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_MPESA_PHONE',
        error:
          'Valid Kenyan mobile number is required (e.g. 0712 345 678, 0110 000 000, or 2547XXXXXXXX).'
      });
    }

    if (!checkStkPushRateLimit(`${getClientIp(req)}:${normalizedPhone}`, 4)) {
      return res.status(429).json({
        success: false,
        errorCode: 'STK_PUSH_RATE_LIMITED',
        error: 'Too many STK Push prompts requested. Please wait 60 seconds before retrying.'
      });
    }

    const cleanAccountRef =
      String(orderRecord.orderNumber)
        .replace(/[^a-zA-Z0-9-]/g, '')
        .slice(0, 12) || 'VAAIRO';
    const cleanDesc = `VAAIRO ${cleanAccountRef}`.slice(0, 13);

    return dispatchDarajaStkPushAndPersistPending({
      req,
      res,
      normalizedPhone,
      expectedAmountKes: orderRecord.authoritativeAmountKes,
      resolvedOrderNumber: orderRecord.orderNumber,
      cleanAccountRef,
      cleanDesc,
      organizationId: orderRecord.organizationId,
      branchId: orderRecord.branchId
    });
  });

  // 3. Hardened Safaricom Daraja Webhook Callback Endpoint
  // Trust chain:
  //   CheckoutRequestID -> server-created pending record -> Daraja upstream verification
  //   -> amount, phone, merchantRequestId, receipt -> atomic CONFIRMED
  // Treats the callback as a reconciliation trigger, not the sole source of financial truth.
  app.post('/api/mpesa/daraja-webhook', async (req: Request, res: Response) => {
    const body = req.body || {};
    const config = resolveDarajaConfig(req);
    const stkCallback = body.Body?.stkCallback || body.stkCallback;

    if (!stkCallback || typeof stkCallback !== 'object') {
      return res.status(400).json({
        ResultCode: 1,
        ResultDesc:
          'Rejected: Missing official Safaricom Daraja Body.stkCallback payload structure.'
      });
    }

    const checkoutRequestId = String(stkCallback.CheckoutRequestID || '').trim();
    const merchantRequestId = String(stkCallback.MerchantRequestID || '').trim();
    const rawResultCode = stkCallback.ResultCode;

    if (!checkoutRequestId || rawResultCode === undefined || rawResultCode === null) {
      return res.status(400).json({
        ResultCode: 1,
        ResultDesc: 'Rejected: CheckoutRequestID and ResultCode are required.'
      });
    }

    const resultCode = Number(rawResultCode);
    const resultDesc = String(stkCallback.ResultDesc || '');

    // Step 1: Look up the server-created pending transaction in Firestore (`mpesaTransactions/{checkoutRequestId}`)
    const pendingTx = await firestoreAuthoritativeStore.getMpesaTransaction(checkoutRequestId);
    if (!pendingTx) {
      return res.status(404).json({
        ResultCode: 1,
        errorCode: 'UNKNOWN_CHECKOUT_REQUEST_ID',
        ResultDesc: `Rejected: No pending M-Pesa transaction exists for CheckoutRequestID "${checkoutRequestId}".`
      });
    }

    // Step 2: Verify MerchantRequestID correlation against server-created pending record
    if (
      merchantRequestId &&
      pendingTx.merchantRequestId &&
      merchantRequestId !== pendingTx.merchantRequestId
    ) {
      return res.status(403).json({
        ResultCode: 1,
        errorCode: 'MERCHANT_REQUEST_ID_MISMATCH',
        ResultDesc: 'Rejected: Callback MerchantRequestID does not match pending transaction record.'
      });
    }

    // Step 3: Verify via upstream Daraja STK Push Query (when Daraja credentials are configured)
    // or cryptographic header/signature when running in offline test harnesses
    const providedSig = String(
      req.headers['x-daraja-signature'] || req.query.sig || ''
    ).trim();
    const hasValidHeaderSig = verifyConstantTimeSignature(
      pendingTx.callbackSignatureToken,
      providedSig
    );

    if (config.configured && !hasValidHeaderSig) {
      const upstream = await queryUpstreamDarajaStkStatus(config, checkoutRequestId);
      if (
        !upstream.queried ||
        upstream.resultCode !== resultCode ||
        (upstream.merchantRequestId &&
          pendingTx.merchantRequestId &&
          upstream.merchantRequestId !== pendingTx.merchantRequestId)
      ) {
        return res.status(403).json({
          ResultCode: 1,
          errorCode: 'UPSTREAM_DARAJA_VERIFICATION_FAILED',
          ResultDesc:
            'Rejected: Upstream Safaricom Daraja STK Push Query did not confirm the callback status.'
        });
      }
    } else if (!config.configured && !hasValidHeaderSig) {
      return res.status(403).json({
        ResultCode: 1,
        errorCode: 'UNVERIFIED_CALLBACK_TRIGGER',
        ResultDesc:
          'Rejected: Daraja upstream verification unavailable and callback authenticity header is missing.'
      });
    }

    let confirmedAmountKes: number | undefined = undefined;
    let confirmedPhone: string | undefined = undefined;
    let mpesaReceiptNumber: string | undefined = undefined;
    let transactionDate: string | undefined = undefined;

    const items = stkCallback.CallbackMetadata?.Item;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        if (item.Name === 'Amount' && item.Value !== undefined) {
          confirmedAmountKes = Number(item.Value);
        } else if (item.Name === 'MpesaReceiptNumber' && item.Value !== undefined) {
          mpesaReceiptNumber = String(item.Value).trim().toUpperCase();
        } else if (item.Name === 'PhoneNumber' && item.Value !== undefined) {
          confirmedPhone = String(item.Value).trim();
        } else if (item.Name === 'TransactionDate' && item.Value !== undefined) {
          transactionDate = String(item.Value).trim();
        }
      }
    }

    // Step 4: Atomically verify amount, phone, merchantRequestId, and receipt and transition to CONFIRMED
    const reconciliation = await firestoreAuthoritativeStore.processDarajaCallbackOrQueryAtomically({
      checkoutRequestId,
      merchantRequestId,
      resultCode,
      resultDesc,
      mpesaReceiptNumber,
      confirmedAmountKes,
      confirmedPhone,
      transactionDate,
      rawCallbackPayload: JSON.stringify(body),
      verifiedVia: 'DARAJA_STK_CALLBACK'
    });

    if (!reconciliation.accepted) {
      return res.status(reconciliation.status).json({
        ResultCode: 1,
        errorCode: reconciliation.errorCode,
        ResultDesc: reconciliation.errorMessage || 'Callback reconciliation failed.'
      });
    }

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: reconciliation.idempotentReplay
        ? 'Callback already reconciled (idempotent replay).'
        : 'Callback verified and persisted to authoritative Firestore mpesaTransactions ledger.',
      checkoutRequestId,
      status: reconciliation.record?.status,
      mpesaReceiptNumber: reconciliation.record?.mpesaReceiptNumber
    });
  });

  // 4. Authoritative M-Pesa Payment Verification & Active Safaricom Daraja STK Query
  // Strict Rule: NO VERIFIED DARAJA CALLBACK OR UPSTREAM STK QUERY = UNPAID (402 Payment Required).
  // Never generates a fake receipt number!
  const handleVerifyOrQueryMpesaPayment = async (req: Request, res: Response) => {
    const { checkoutRequestId, receiptNumber, amount, phone, orderNumber } = req.body || {};
    const expectedAmount = Number(amount || 0);

    if (!checkoutRequestId && !receiptNumber && !orderNumber) {
      return res.status(400).json({
        verified: false,
        status: 'UNPAID',
        errorCode: 'MISSING_VERIFICATION_IDENTIFIER',
        error: 'checkoutRequestId, receiptNumber, or orderNumber is required to verify M-Pesa payment.'
      });
    }

    let record = await firestoreAuthoritativeStore.findMpesaTransactionByCriteria({
      checkoutRequestId: checkoutRequestId ? String(checkoutRequestId) : undefined,
      receiptNumber: receiptNumber ? String(receiptNumber) : undefined,
      orderNumber: orderNumber ? String(orderNumber) : undefined
    });

    // If transaction is still PENDING and live Daraja credentials are configured,
    // actively query Safaricom's /mpesa/stkpushquery/v1/query endpoint
    if (record && record.status === 'PENDING') {
      const config = resolveDarajaConfig(req);
      const upstream = await queryUpstreamDarajaStkStatus(config, record.checkoutRequestId);
      if (upstream.queried && upstream.resultCode !== undefined) {
        if (upstream.resultCode === 0) {
          // Confirmed via upstream Daraja STK Query; if callback hasn't arrived yet with receiptNumber,
          // check if receiptNumber was provided or wait for callback
          const candidateReceipt = String(
            receiptNumber || record.mpesaReceiptNumber || ''
          )
            .trim()
            .toUpperCase();
          if (candidateReceipt.length >= 5) {
            const updated =
              await firestoreAuthoritativeStore.processDarajaCallbackOrQueryAtomically({
                checkoutRequestId: record.checkoutRequestId,
                merchantRequestId: upstream.merchantRequestId || record.merchantRequestId,
                resultCode: 0,
                resultDesc: upstream.resultDesc || 'Confirmed via Safaricom Daraja STK Push Query',
                mpesaReceiptNumber: candidateReceipt,
                confirmedAmountKes: record.expectedAmountKes,
                confirmedPhone: record.expectedPhone,
                rawCallbackPayload: upstream.rawResponse || '{}',
                verifiedVia: 'DARAJA_STK_QUERY'
              });
            if (updated.record) {
              record = updated.record;
            }
          }
        } else {
          // Terminal failure or user cancellation reported by Safaricom STK Query
          const updated = await firestoreAuthoritativeStore.processDarajaCallbackOrQueryAtomically({
            checkoutRequestId: record.checkoutRequestId,
            merchantRequestId: upstream.merchantRequestId || record.merchantRequestId,
            resultCode: upstream.resultCode,
            resultDesc: upstream.resultDesc || 'Transaction cancelled or failed on handset',
            rawCallbackPayload: upstream.rawResponse || '{}',
            verifiedVia: 'DARAJA_STK_QUERY'
          });
          if (updated.record) {
            record = updated.record;
          }
        }
      }
    }

    if (!record) {
      return res.status(402).json({
        verified: false,
        status: 'UNPAID',
        errorCode: 'NO_VERIFIED_DARAJA_PAYMENT',
        error:
          'No verified Safaricom Daraja payment found for this transaction. Payment must be confirmed by Safaricom before completion.'
      });
    }

    if (record.status === 'PENDING') {
      return res.status(202).json({
        verified: false,
        status: 'PENDING',
        checkoutRequestId: record.checkoutRequestId,
        merchantRequestId: record.merchantRequestId,
        orderNumber: record.orderNumber,
        expectedAmountKes: record.expectedAmountKes,
        expectedPhone: record.expectedPhone,
        errorCode: 'MPESA_PAYMENT_PENDING',
        error: 'Awaiting customer M-Pesa PIN confirmation on handset.'
      });
    }

    if (record.status !== 'CONFIRMED' || !record.mpesaReceiptNumber) {
      return res.status(402).json({
        verified: false,
        status: record.status,
        checkoutRequestId: record.checkoutRequestId,
        resultCode: String(record.resultCode ?? '1'),
        resultDesc: record.resultDesc || 'M-Pesa payment was cancelled or declined.',
        errorCode: 'MPESA_PAYMENT_NOT_CONFIRMED',
        error: record.resultDesc || `M-Pesa payment status is ${record.status}.`
      });
    }

    // Verify amount is sufficient
    const confirmedAmt = Number(record.confirmedAmountKes ?? record.expectedAmountKes);
    if (Number.isFinite(expectedAmount) && expectedAmount > 0 && confirmedAmt < expectedAmount) {
      return res.status(402).json({
        verified: false,
        status: 'UNDERPAID',
        checkoutRequestId: record.checkoutRequestId,
        receiptNumber: record.mpesaReceiptNumber,
        confirmedAmountKes: confirmedAmt,
        expectedAmountKes: expectedAmount,
        errorCode: 'MPESA_AMOUNT_MISMATCH',
        error: `Verified M-Pesa payment (${confirmedAmt} KES) is less than required order amount (${expectedAmount} KES).`
      });
    }

    return res.status(200).json({
      verified: true,
      receiptNumber: record.mpesaReceiptNumber,
      checkoutRequestId: record.checkoutRequestId,
      merchantRequestId: record.merchantRequestId,
      amount: confirmedAmt,
      phone: record.confirmedPhone || record.expectedPhone || phone,
      orderNumber: record.orderNumber || orderNumber,
      status: 'CONFIRMED',
      resultCode: '0',
      resultDesc: record.resultDesc || 'Authoritative Safaricom Daraja transaction confirmed.',
      verifiedVia: record.verifiedVia || 'DARAJA_STK_CALLBACK',
      authoritativeServerTimestamp: record.updatedAt
    });
  };

  app.post('/api/mpesa/verify', authenticateSession, handleVerifyOrQueryMpesaPayment);
  app.post('/api/mpesa/query', handleVerifyOrQueryMpesaPayment);

  // 5. List Persistent M-Pesa Transactions from Firestore (`mpesaTransactions`)
  app.get('/api/mpesa/transactions', authenticateSession, async (_req: Request, res: Response) => {
    const records = await firestoreAuthoritativeStore.listMpesaTransactions(100);
    res.status(200).json({
      count: records.length,
      transactions: records
    });
  });

  // ===========================================================================
  // SERVER-AUTHORITATIVE KRA eTIMS FISCAL LIFECYCLE & RECONCILIATION ENDPOINTS
  // ===========================================================================
  app.post('/api/etims/sign', authenticateSession, (req: Request, res: Response) => {
    const user = (req as any).user as SessionUser;
    const { invoiceNumber, grossAmountKes, vatAmountKes, traderPin, branchId, simulateGatewayFailure } = req.body || {};
    if (!invoiceNumber || grossAmountKes === undefined) {
      return res.status(400).json({ error: 'invoiceNumber and grossAmountKes are required.' });
    }

    const record = erpEngine.processFiscalSubmission({
      invoiceNumber: String(invoiceNumber),
      branchId: branchId ? String(branchId) : user.branchId,
      grossAmountKes: Number(grossAmountKes),
      vatAmountKes: Number(vatAmountKes || 0),
      traderPin: traderPin ? String(traderPin) : undefined,
      simulateGatewayFailure: Boolean(simulateGatewayFailure)
    });

    erpEngine.recordAudit({
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      department: user.department,
      branchId: record.branchId,
      action: `KRA_FISCAL_${record.status}`,
      module: 'TAX_ETIMS',
      entityType: 'FISCAL_TRANSACTION',
      entityId: record.invoiceNumber,
      after: record,
      ipAddress: getClientIp(req),
      actionDetails:
        record.status === 'SUCCESS'
          ? `Fiscalized ${record.invoiceNumber} (${record.kraControlCode})`
          : `Fiscalization ${record.status}: ${record.errorMessage}`
    });

    res.status(record.status === 'SUCCESS' ? 200 : 202).json({
      ...record,
      timestamp: record.signedAt
    });
  });

  app.get('/api/etims/reconcile', requireAdmin, (_req: Request, res: Response) => {
    const allRecords = Array.from(erpEngine.fiscalTransactions.values());
    const pendingOrFailed = allRecords.filter(r => r.status !== 'SUCCESS');
    res.status(200).json({
      totalTransactions: allRecords.length,
      succeededCount: allRecords.length - pendingOrFailed.length,
      pendingReconciliationCount: pendingOrFailed.length,
      pendingTransactions: pendingOrFailed,
      recentTransactions: allRecords.slice(-50).reverse()
    });
  });

  // Feed status & diagnostics endpoint
  app.get('/api/merchant-feed/status', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    regenerateMerchantFeeds(origin);
    const diagnostics = runMerchantAndSchemaDiagnostics(cachedFeedItems);

    res.status(200).json({
      status: 'ACTIVE',
      scheduleCron: '0 0 * * * (Daily Automated Refresh)',
      lastFeedRefreshIso,
      nextScheduledRefreshIso,
      feedUrlXml: `${origin}/feeds/google-shopping.xml`,
      feedUrlCsv: `${origin}/feeds/google-shopping.csv`,
      diagnostics
    });
  });

  // ===========================================================================
  // REAL LOCATION SERVICES: REVERSE GEOCODING, PLACE SEARCH & IP GEOLOCATION
  // ===========================================================================
  app.get('/api/location/reverse', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon || req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1&zoom=18`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VAAIRO-LiquorHub-Delivery-ERP/1.0 (https://liqour.urbantechdev.com)',
          'Accept-Language': 'en'
        }
      });
      if (!response.ok) {
        throw new Error(`Nominatim reverse returned ${response.status}`);
      }
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(502).json({ error: 'Reverse geocoding failed', details: String(err) });
    }
  });

  app.get('/api/location/search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(200).json([]);
      return;
    }
    try {
      const countrycodes = String(req.query.countrycodes || 'ke');
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=8&countrycodes=${encodeURIComponent(countrycodes)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VAAIRO-LiquorHub-Delivery-ERP/1.0 (https://liqour.urbantechdev.com)',
          'Accept-Language': 'en'
        }
      });
      if (!response.ok) {
        throw new Error(`Nominatim search returned ${response.status}`);
      }
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(502).json({ error: 'Place search failed', details: String(err) });
    }
  });

  app.get('/api/location/ip', async (_req: Request, res: Response) => {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        headers: {
          'User-Agent': 'VAAIRO-LiquorHub-Delivery-ERP/1.0'
        }
      });
      if (!response.ok) {
        throw new Error(`IP geolocation returned ${response.status}`);
      }
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(502).json({ error: 'IP geolocation failed', details: String(err) });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VAAIRO Server & Google Merchant Feed running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VITEST !== 'true' && process.env.RUN_ERP_TESTS !== 'true') {
  startServer();
}
