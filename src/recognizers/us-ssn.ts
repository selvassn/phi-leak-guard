import type { PHIMatch, Recognizer } from '../types';

/**
 * US Social Security Number: AAA-GG-SSSS.
 *
 * SSNs have no checksum — only weak structural rules (invalid area/group/serial
 * ranges). So the format drives the precision strategy:
 *   - SEPARATED (dash or space, e.g. "123-45-6789" / "234 56 7891") is
 *     distinctive enough to detect anywhere, gated by structural validity.
 *   - BARE nine digits ("123456789") looks like any reference number, so we
 *     only trust it when SSN context ("SSN" / "social security") is present.
 *     Without that gate, every 9-digit order number would be a false positive.
 */
const SEPARATED = /(?<!\d)(\d{3})[- ](\d{2})[- ](\d{4})(?!\d)/g;
const BARE = /(?<!\d)(\d{3})(\d{2})(\d{4})(?!\d)/g;
const SSN_CONTEXT = /\b(ssn|social security)\b/i;

export function isValidSsn(area: string, group: string, serial: string): boolean {
  const a = Number(area);
  if (a === 0 || a === 666 || a >= 900) return false; // reserved / never issued
  if (Number(group) === 0) return false;
  if (Number(serial) === 0) return false;
  return true;
}

export const usSsnRecognizer: Recognizer = {
  id: 'us-ssn',
  category: 'ssn',
  standards: ['HIPAA_SAFE_HARBOR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(SEPARATED)) {
      if (isValidSsn(m[1]!, m[2]!, m[3]!)) {
        matches.push({
          recognizer: 'us-ssn', category: 'ssn', value: m[0],
          start: m.index, end: m.index + m[0].length, confidence: 'validated',
        });
      }
    }
    if (SSN_CONTEXT.test(text)) {
      for (const m of text.matchAll(BARE)) {
        if (isValidSsn(m[1]!, m[2]!, m[3]!)) {
          matches.push({
            recognizer: 'us-ssn', category: 'ssn', value: m[0],
            start: m.index, end: m.index + m[0].length, confidence: 'pattern',
          });
        }
      }
    }
    return matches;
  },
};
