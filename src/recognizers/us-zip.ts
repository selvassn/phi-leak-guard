import type { PHIMatch, Recognizer } from '../types';

/**
 * US ZIP code (geographic identifier, HIPAA Safe Harbor #2).
 *
 * A bare 5-digit number is indistinguishable from an order/lab number, so
 * precision comes from three narrow triggers instead of matching every \d{5}:
 *   - ZIP+4 ("90210-1234") — distinctive enough to trust on its own,
 *   - a real US state abbreviation before it ("CA 90210"),
 *   - an explicit "ZIP" / "postal code" cue in the text.
 */
const US_STATES = new Set<string>([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const ZIP4 = /(?<![\d-])\d{5}-\d{4}(?![\d-])/g;
const BARE5 = /(?<![\d-])\d{5}(?![\d-])/g;
const STATE_ZIP = /\b([A-Z]{2})\s+(\d{5})(?![\d-])/g;
const ZIP_CONTEXT = /\bzip\b|\bpostal code\b/i;

export const usZipRecognizer: Recognizer = {
  id: 'us-zip',
  category: 'geographic',
  standards: ['HIPAA_SAFE_HARBOR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    const seen = new Set<number>();
    const add = (value: string, start: number) => {
      if (seen.has(start)) return;
      seen.add(start);
      matches.push({
        recognizer: 'us-zip', category: 'geographic', value,
        start, end: start + value.length, confidence: 'pattern',
      });
    };

    for (const m of text.matchAll(ZIP4)) add(m[0], m.index);
    for (const m of text.matchAll(STATE_ZIP)) {
      if (US_STATES.has(m[1]!)) add(m[2]!, m.index + m[0].indexOf(m[2]!));
    }
    if (ZIP_CONTEXT.test(text)) {
      for (const m of text.matchAll(BARE5)) add(m[0], m.index);
    }
    return matches;
  },
};
