import type { PHIMatch, Recognizer } from '../types';

/**
 * Dates tied to an individual (DOB, admission/discharge, death) are HIPAA
 * Safe Harbor identifier #3 — a bare *year* is allowed, but any full date is
 * not. We detect full numeric dates in the common day/month/year and ISO forms.
 *
 * Precision: requiring three components with `/` or `.` separators (or the
 * strict ISO `YYYY-MM-DD`) avoids the usual clinical-number traps — "120/80",
 * "1/2 tablet", "500 mg" all have too few components to match.
 */
const NUMERIC = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g; // 14/03/1962, 3.7.2024
const ISO = /\b\d{4}-\d{2}-\d{2}\b/g;                  // 1962-03-14

export const dateRecognizer: Recognizer = {
  id: 'date',
  category: 'date',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const re of [NUMERIC, ISO]) {
      for (const m of text.matchAll(re)) {
        matches.push({
          recognizer: 'date',
          category: 'date',
          value: m[0],
          start: m.index,
          end: m.index + m[0].length,
          confidence: 'pattern',
        });
      }
    }
    return matches;
  },
};
