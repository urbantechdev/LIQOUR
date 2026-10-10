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

export function getAuthHeaders(branchId?: string): Record<string, string> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    'x-vaairo-terminal-sync': '1'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resolvedBranch =
    branchId ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('vaairo_active_branch_id') || localStorage.getItem('activeBranchId')
      : '');
  if (resolvedBranch) {
    headers['x-branch-id'] = resolvedBranch;
  }
  return headers;
}
