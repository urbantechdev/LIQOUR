/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TOKEN_KEY = 'vaairo_session_token';

export function getStoredSessionToken(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredSessionToken(token: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearStoredSessionToken(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
