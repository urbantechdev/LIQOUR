/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KenyanMobileCarrierType = 'SAFARICOM' | 'AIRTEL' | 'TELKOM' | 'UNKNOWN';

export interface KenyanCarrierInfo {
  carrier: KenyanMobileCarrierType;
  carrierName: string;
  walletLabel: string;
  prefixMatched: string;
  cleanDigits: string;
  formattedDisplay: string;
  normalized254: string;
  digitsCount: number;
  remainingDigits: number;
  isComplete10Digits: boolean;
  isValid: boolean;
}

/**
 * Normalizes and strictly caps Kenyan mobile input to a standard 10-digit local mobile number
 * (`07XXXXXXXX` or `01XXXXXXXX`).
 * - Converts `+2547XXXXXXXX` / `2547XXXXXXXX` to `07XXXXXXXX`
 * - Converts `+2541XXXXXXXX` / `2541XXXXXXXX` to `01XXXXXXXX`
 * - Strips non-digit characters and enforces a strict 10-digit ceiling
 */
export function sanitizeAndControlKenyanMobileInput(raw: string): string {
  const trimmed = (raw || '').trim();
  let digits = trimmed.replace(/\D/g, '');

  // Convert 2547... or 2541... international format to 07... / 01...
  if (digits.startsWith('254') && digits.length >= 4 && (digits[3] === '7' || digits[3] === '1')) {
    digits = '0' + digits.slice(3);
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    digits = '0' + digits;
  }

  // Strictly enforce 10-digit Kenyan mobile number standard
  return digits.slice(0, 10);
}

/**
 * Formats a 10-digit Kenyan mobile string into `07XX XXX XXX` or `01XX XXX XXX` for display.
 */
export function formatKenyanMobileDisplay(raw: string): string {
  const d = sanitizeAndControlKenyanMobileInput(raw);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}`;
}

/**
 * Identifies whether a Kenyan mobile number belongs to Safaricom, Airtel Kenya, or Telkom Kenya
 * using official Communications Authority of Kenya (CAK) prefix allocations.
 */
export function detectKenyanMobileCarrier(raw: string): KenyanCarrierInfo {
  const cleanDigits = sanitizeAndControlKenyanMobileInput(raw);
  const digitsCount = cleanDigits.length;
  const remainingDigits = Math.max(0, 10 - digitsCount);
  const isComplete10Digits = digitsCount === 10;
  const isValid = /^(?:07|01)\d{8}$/.test(cleanDigits);

  const prefix4 = cleanDigits.slice(0, 4);
  const prefix3 = cleanDigits.slice(0, 3);
  const prefixNum = prefix4.length === 4 ? parseInt(prefix4, 10) : -1;

  let carrier: KenyanMobileCarrierType = 'UNKNOWN';
  let carrierName = 'Kenyan Mobile Line';
  let walletLabel = 'M-Pesa / Mobile Money';

  if (digitsCount >= 3) {
    // 1. Check 4-digit exact ranges first when 4+ digits are available
    if (prefix4.length === 4) {
      const isSafaricom4 =
        (prefixNum >= 700 && prefixNum <= 729) ||
        (prefixNum >= 740 && prefixNum <= 743) ||
        prefixNum === 745 ||
        prefixNum === 746 ||
        prefixNum === 748 ||
        (prefixNum >= 757 && prefixNum <= 759) ||
        prefixNum === 768 ||
        prefixNum === 769 ||
        (prefixNum >= 790 && prefixNum <= 799) ||
        (prefixNum >= 110 && prefixNum <= 115);

      const isAirtel4 =
        (prefixNum >= 730 && prefixNum <= 739) ||
        (prefixNum >= 750 && prefixNum <= 756) ||
        prefixNum === 762 ||
        (prefixNum >= 780 && prefixNum <= 789) ||
        (prefixNum >= 100 && prefixNum <= 106);

      const isTelkom4 = prefixNum >= 770 && prefixNum <= 779;

      if (isSafaricom4) {
        carrier = 'SAFARICOM';
      } else if (isAirtel4) {
        carrier = 'AIRTEL';
      } else if (isTelkom4) {
        carrier = 'TELKOM';
      }
    } else {
      // 3-digit early detection (070, 071, 072, 079, 011 -> Safaricom; 073, 078, 010 -> Airtel; 077 -> Telkom)
      if (['070', '071', '072', '079', '011'].includes(prefix3)) {
        carrier = 'SAFARICOM';
      } else if (['073', '078', '010'].includes(prefix3)) {
        carrier = 'AIRTEL';
      } else if (prefix3 === '077') {
        carrier = 'TELKOM';
      }
    }
  }

  if (carrier === 'SAFARICOM') {
    carrierName = 'Safaricom Kenya';
    walletLabel = 'Safaricom M-Pesa';
  } else if (carrier === 'AIRTEL') {
    carrierName = 'Airtel Kenya';
    walletLabel = 'Airtel Money / M-Pesa';
  } else if (carrier === 'TELKOM') {
    carrierName = 'Telkom Kenya';
    walletLabel = 'T-Kash / Mobile Money';
  }

  return {
    carrier,
    carrierName,
    walletLabel,
    prefixMatched: prefix4 || prefix3,
    cleanDigits,
    formattedDisplay: formatKenyanMobileDisplay(cleanDigits),
    normalized254: isValid ? `254${cleanDigits.slice(1)}` : cleanDigits,
    digitsCount,
    remainingDigits,
    isComplete10Digits,
    isValid
  };
}
