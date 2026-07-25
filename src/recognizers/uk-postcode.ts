import type { PHIMatch, Recognizer } from '../types';

/**
 * UK postcode (geographic identifier). The format is well-defined — one/two
 * letters, a digit, an optional letter/digit, then a space, a digit and two
 * letters (e.g. "M14 5GL", "SW1A 1AA", "B33 8TH").
 *
 * Precision: anchoring to uppercase letters + the mandatory trailing
 * `digit + two letters` keeps clinical noise out — "SpO2 98%", "BP 120" and
 * similar don't fit the shape. (US ZIP is a separate, not-yet-built recognizer.)
 */
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g;

export const ukPostcodeRecognizer: Recognizer = {
  id: 'uk-postcode',
  category: 'geographic',
  standards: ['UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(POSTCODE)) {
      matches.push({
        recognizer: 'uk-postcode',
        category: 'geographic',
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 'pattern',
      });
    }
    return matches;
  },
};
