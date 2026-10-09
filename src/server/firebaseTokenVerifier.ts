/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import https from 'https';
import firebaseConfig from '../../firebase-applet-config.json';

export interface VerifiedFirebaseTokenClaims {
  uid: string;
  sub: string;
  email: string;
  emailVerified: boolean;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  organizationId?: string;
  role?: string;
  branchId?: string;
  signInSecondFactor?: string;
  secondFactorIdentifier?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  claims?: VerifiedFirebaseTokenClaims;
  errorCode?:
    | 'MALFORMED_TOKEN'
    | 'UNSUPPORTED_ALGORITHM'
    | 'MISSING_KEY_ID'
    | 'UNKNOWN_SIGNING_KEY'
    | 'INVALID_SIGNATURE'
    | 'TOKEN_EXPIRED'
    | 'INVALID_ISSUER'
    | 'INVALID_AUDIENCE'
    | 'INVALID_SUBJECT'
    | 'EMAIL_MISMATCH'
    | 'EMAIL_UNVERIFIED';
  errorMessage?: string;
}

const GOOGLE_SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cached Google X.509 certificates (kid -> PEM)
let cachedGoogleCerts: Record<string, string> = {};
let cachedCertsExpiresAtMs = 0;

// Additional trusted public keys registered for deterministic testing or custom enterprise IdP
const trustedTestingPublicKeys = new Map<string, string>();

export function registerTrustedPublicKeyForTesting(kid: string, publicKeyPem: string): void {
  trustedTestingPublicKeys.set(kid, publicKeyPem);
}

export function clearTrustedPublicKeysForTesting(): void {
  trustedTestingPublicKeys.clear();
}

/**
 * Helper to create a real RSA-SHA256 signed JWT for deterministic unit testing of cryptographic verification.
 */
export function signTestFirebaseIdToken(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  kid = 'test-firebase-kid-2026',
  alg = 'RS256'
): string {
  const header = { alg, typ: 'JWT', kid };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem).toString('base64url');
  return `${signingInput}.${signature}`;
}

/**
 * Fetches Google's SecureToken X.509 public key certificates with HTTP Cache-Control TTL caching.
 */
export async function fetchGooglePublicCertificates(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedCertsExpiresAtMs && Object.keys(cachedGoogleCerts).length > 0) {
    return cachedGoogleCerts;
  }

  return new Promise(resolve => {
    const req = https.get(GOOGLE_SECURETOKEN_CERTS_URL, { timeout: 3500 }, res => {
      if (res.statusCode !== 200) {
        resolve(cachedGoogleCerts);
        return;
      }

      let rawBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        rawBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawBody) as Record<string, string>;
          if (parsed && typeof parsed === 'object') {
            cachedGoogleCerts = parsed;
            const cacheControl = String(res.headers['cache-control'] || '');
            const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
            const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
            cachedCertsExpiresAtMs = Date.now() + Math.max(300, maxAgeSec) * 1000;
          }
        } catch {
          // Retain previous cache if parse fails
        }
        resolve(cachedGoogleCerts);
      });
    });

    req.on('error', () => {
      resolve(cachedGoogleCerts);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(cachedGoogleCerts);
    });
  });
}

/**
 * Performs full cryptographic RSA-SHA256 verification and strict claim validation
 * on a Firebase / Google ID token (JWT).
 * Never accepts unsigned tokens, non-RS256 algorithms, or unverified signatures.
 */
export async function verifyFirebaseIdTokenCryptographically(params: {
  idToken: unknown;
  expectedEmail?: string;
  expectedProjectId?: string;
  nowSeconds?: number;
}): Promise<TokenVerificationResult> {
  if (typeof params.idToken !== 'string' || !params.idToken.includes('.')) {
    return {
      valid: false,
      errorCode: 'MALFORMED_TOKEN',
      errorMessage: 'ID token must be a compact serialized 3-part JWT string.'
    };
  }

  const parts = params.idToken.trim().split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return {
      valid: false,
      errorCode: 'MALFORMED_TOKEN',
      errorMessage: 'JWT must contain header, payload, and cryptographic signature segments.'
    };
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return {
      valid: false,
      errorCode: 'MALFORMED_TOKEN',
      errorMessage: 'Failed to decode JWT Base64URL header or payload JSON.'
    };
  }

  // 1. Enforce RS256 asymmetric algorithm (prevent alg:none or HS256 confusion attacks)
  if (header.alg !== 'RS256') {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_ALGORITHM',
      errorMessage: `Unsupported JWT algorithm "${String(header.alg)}". Only RS256 is permitted.`
    };
  }

  const kid = typeof header.kid === 'string' ? header.kid.trim() : '';
  if (!kid) {
    return {
      valid: false,
      errorCode: 'MISSING_KEY_ID',
      errorMessage: 'JWT header is missing required "kid" key identifier.'
    };
  }

  // 2. Resolve Public Key / X.509 Certificate for `kid`
  let publicKeyPem = trustedTestingPublicKeys.get(kid);
  if (!publicKeyPem) {
    const googleCerts = await fetchGooglePublicCertificates();
    publicKeyPem = googleCerts[kid];
  }

  if (!publicKeyPem) {
    return {
      valid: false,
      errorCode: 'UNKNOWN_SIGNING_KEY',
      errorMessage: `No trusted Google SecureToken X.509 certificate found for kid "${kid}".`
    };
  }

  // 3. Cryptographic RSA-SHA256 Signature Verification
  try {
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signatureBytes = Buffer.from(parts[2], 'base64url');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();

    const signatureValid = verifier.verify(publicKeyPem, signatureBytes);
    if (!signatureValid) {
      return {
        valid: false,
        errorCode: 'INVALID_SIGNATURE',
        errorMessage: 'Cryptographic RSA-SHA256 signature verification failed.'
      };
    }
  } catch (err) {
    return {
      valid: false,
      errorCode: 'INVALID_SIGNATURE',
      errorMessage: `Cryptographic verification error: ${(err as Error)?.message || 'Invalid key or signature'}`
    };
  }

  // 4. Validate Standard JWT & Firebase Claims (exp, iat, aud, iss, sub, email)
  const nowSec = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);

  if (!exp || nowSec >= exp) {
    return {
      valid: false,
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'Firebase ID token has expired.'
    };
  }

  if (!iat || iat > nowSec + 300) {
    return {
      valid: false,
      errorCode: 'MALFORMED_TOKEN',
      errorMessage: 'Firebase ID token issued-at (iat) timestamp is invalid or in the future.'
    };
  }

  const configuredProjectId = params.expectedProjectId || firebaseConfig.projectId || 'gen-lang-client-0468740826';
  const aud = String(payload.aud || '').trim();
  const allowedAudiences = new Set([
    configuredProjectId,
    firebaseConfig.projectId,
    'gen-lang-client-0468740826',
    'gen-lang-client-0284516968'
  ]);

  if (!aud || !allowedAudiences.has(aud)) {
    return {
      valid: false,
      errorCode: 'INVALID_AUDIENCE',
      errorMessage: `Token audience "${aud}" does not match configured Firebase project "${configuredProjectId}".`
    };
  }

  const iss = String(payload.iss || '').trim();
  const allowedIssuers = new Set([
    `https://securetoken.google.com/${aud}`,
    `https://securetoken.google.com/${configuredProjectId}`,
    'https://accounts.google.com'
  ]);

  if (!iss || !allowedIssuers.has(iss)) {
    return {
      valid: false,
      errorCode: 'INVALID_ISSUER',
      errorMessage: `Token issuer "${iss}" is not a trusted Google SecureToken issuer.`
    };
  }

  const sub = String(payload.sub || payload.user_id || '').trim();
  if (!sub || sub.length > 128) {
    return {
      valid: false,
      errorCode: 'INVALID_SUBJECT',
      errorMessage: 'Token subject (sub) must be a non-empty Firebase UID.'
    };
  }

  const tokenEmail = String(payload.email || '').trim().toLowerCase();
  const emailVerified = payload.email_verified === true;

  if (!emailVerified) {
    return {
      valid: false,
      errorCode: 'EMAIL_UNVERIFIED',
      errorMessage: 'Google account email address is not verified.'
    };
  }

  if (params.expectedEmail) {
    const cleanExpected = params.expectedEmail.trim().toLowerCase();
    if (!tokenEmail || tokenEmail !== cleanExpected) {
      return {
        valid: false,
        errorCode: 'EMAIL_MISMATCH',
        errorMessage: `Token email "${tokenEmail}" does not match requested login email "${cleanExpected}".`
      };
    }
  }

  const firebaseClaimObj =
    payload.firebase && typeof payload.firebase === 'object'
      ? (payload.firebase as Record<string, unknown>)
      : {};
  const signInSecondFactor =
    typeof firebaseClaimObj.sign_in_second_factor === 'string'
      ? firebaseClaimObj.sign_in_second_factor
      : typeof payload.sign_in_second_factor === 'string'
      ? payload.sign_in_second_factor
      : undefined;
  const secondFactorIdentifier =
    typeof firebaseClaimObj.second_factor_identifier === 'string'
      ? firebaseClaimObj.second_factor_identifier
      : typeof payload.second_factor_identifier === 'string'
      ? payload.second_factor_identifier
      : undefined;

  return {
    valid: true,
    claims: {
      uid: sub,
      sub,
      email: tokenEmail,
      emailVerified,
      aud,
      iss,
      iat,
      exp,
      organizationId: typeof payload.organizationId === 'string' ? payload.organizationId : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      branchId: typeof payload.branchId === 'string' ? payload.branchId : undefined,
      signInSecondFactor,
      secondFactorIdentifier
    }
  };
}
