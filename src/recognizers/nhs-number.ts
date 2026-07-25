import type { PHIMatch, Recognizer } from '../types';

/**
 * NHS Number: 10 digits, conventionally grouped 3-3-4, carrying a Modulus-11
 * check digit (NHS Data Dictionary).
 *
 * The candidate pattern is deliberately permissive on *formatting* — space,
 * dot or hyphen separators, and it tolerates a letter immediately before the
 * digits (e.g. "NHSNo9434765919"). It stays safe because:
 *   - `(?<!\d)…(?!\d)` isolates a true 10-digit run (won't grab a window out of
 *     an 11+ digit string like a phone number), and
 *   - the Modulus-11 checksum rejects anything that isn't a real NHS number.
 * Formatting recall is free; the checksum is what preserves precision.
 */
const CANDIDATE = /(?<!\d)\d{3}[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g;

/**
 * Modulus-11 validation.
 *   - weight the first 9 digits by 10, 9, ... 2
 *   - remainder = sum % 11
 *   - checkDigit = 11 - remainder  (11 -> 0; 10 -> the number is invalid)
 *   - valid when checkDigit equals the 10th digit
 */
export function isValidNhsNumber(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) return false; // never issued
  return checkDigit === Number(digits[9]);
}

export const nhsNumberRecognizer: Recognizer = {
  id: 'nhs-number',
  category: 'nhs-number',
  standards: ['UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CANDIDATE)) {
      const raw = m[0];
      const digits = raw.replace(/[ .-]/g, '');
      if (isValidNhsNumber(digits)) {
        matches.push({
          recognizer: 'nhs-number',
          category: 'nhs-number',
          value: raw,
          start: m.index,
          end: m.index + raw.length,
          confidence: 'validated',
        });
      }
    }
    return matches;
  },
};
