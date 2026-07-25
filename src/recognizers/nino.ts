import type { PHIMatch, Recognizer } from '../types';

/**
 * UK National Insurance Number (GDPR direct identifier).
 * Format: two prefix letters, six digits, one suffix letter A-D — e.g.
 * "QQ 12 34 56 C". The prefix has structural rules (certain letters and
 * prefixes are never issued), which we validate to keep precision high.
 */
const CANDIDATE = /\b([A-Z]{2})\s?(\d{2})\s?(\d{2})\s?(\d{2})\s?([A-D])\b/gi;

// Letters D, F, I, Q, U, V are never used in either prefix position; O is not
// used as the second letter. These prefixes are also never allocated.
const INVALID_PREFIXES = new Set(['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ']);
const FIRST_OK = /^[ABCEGHJ-PRSTW-Z]$/;
const SECOND_OK = /^[ABCEGHJ-NPRSTW-Z]$/;

export function isValidNino(prefix: string): boolean {
  const p = prefix.toUpperCase();
  if (p.length !== 2) return false;
  if (!FIRST_OK.test(p[0]!) || !SECOND_OK.test(p[1]!)) return false;
  return !INVALID_PREFIXES.has(p);
}

export const ninoRecognizer: Recognizer = {
  id: 'nino',
  category: 'nino',
  standards: ['UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CANDIDATE)) {
      if (isValidNino(m[1]!)) {
        matches.push({
          recognizer: 'nino',
          category: 'nino',
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
