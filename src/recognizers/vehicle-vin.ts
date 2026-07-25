import type { PHIMatch, Recognizer } from '../types';

/**
 * Vehicle Identification Number (HIPAA Safe Harbor #12).
 * A VIN is 17 characters excluding I, O, Q. North American VINs carry a check
 * digit at position 9 (ISO 3779), which we validate — that checksum is what
 * separates a VIN from any random 17-char token, keeping precision high.
 */
const CANDIDATE = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

// Transliteration values for letters (I, O, Q excluded).
const VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidVin(vin: string): boolean {
  const v = vin.toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = v[i]!;
    const value = /\d/.test(c) ? Number(c) : VALUES[c];
    if (value === undefined) return false;
    sum += value * WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  const check = remainder === 10 ? 'X' : String(remainder);
  return v[8] === check;
}

export const vehicleVinRecognizer: Recognizer = {
  id: 'vehicle-vin',
  category: 'vehicle',
  standards: ['HIPAA_SAFE_HARBOR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CANDIDATE)) {
      if (isValidVin(m[0])) {
        matches.push({
          recognizer: 'vehicle-vin',
          category: 'vehicle',
          value: m[0],
          start: m.index,
          end: m.index + m[0].length,
          confidence: 'validated',
        });
      }
    }
    return matches;
  },
};
