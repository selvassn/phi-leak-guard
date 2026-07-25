import type { PHICategory, PHIMatch, Recognizer, Standard } from '../types';

/**
 * Factory for label-gated identifier recognizers.
 *
 * MRNs, account/policy numbers, licence numbers and device serials have no
 * universal format, so matching a bare token would be a false-positive machine.
 * Instead we require an explicit label ("MRN", "policy no", "serial number") to
 * precede the value, and require the captured value to contain a digit. That
 * keeps precision high at the cost of missing unlabelled identifiers — an
 * explicit, documented trade for identifiers that are otherwise unknowable.
 */
function makeContextIdRecognizer(config: {
  id: string;
  category: PHICategory;
  standards: Standard[];
  /** Regex source for the label alternation (without anchors/flags). */
  label: string;
}): Recognizer {
  const re = new RegExp(
    `\\b(?:${config.label})\\b[:#\\s.-]*([A-Za-z0-9][A-Za-z0-9-]{3,})`,
    'gi',
  );
  return {
    id: config.id,
    category: config.category,
    standards: config.standards,
    detect(text) {
      const matches: PHIMatch[] = [];
      for (const m of text.matchAll(re)) {
        const value = m[1]!;
        if (!/\d/.test(value)) continue; // must contain a digit — skips trailing words
        const start = m.index + m[0].length - value.length;
        matches.push({
          recognizer: config.id,
          category: config.category,
          value,
          start,
          end: start + value.length,
          confidence: 'pattern',
        });
      }
      return matches;
    },
  };
}

const BOTH: Standard[] = ['HIPAA_SAFE_HARBOR', 'UK_GDPR'];

export const mrnRecognizer = makeContextIdRecognizer({
  id: 'mrn', category: 'mrn', standards: BOTH,
  label: 'mrn|medical record (?:no\\.?|number)',
});

export const accountRecognizer = makeContextIdRecognizer({
  id: 'account', category: 'account', standards: BOTH,
  label: '(?:account|acct|policy|member|beneficiary)(?:\\s*(?:no\\.?|number|id|#))?',
});

export const licenseRecognizer = makeContextIdRecognizer({
  id: 'license', category: 'license', standards: BOTH,
  label: '(?:licen[cs]e|certificate)(?:\\s*(?:no\\.?|number|#))?',
});

export const deviceRecognizer = makeContextIdRecognizer({
  id: 'device', category: 'device', standards: BOTH,
  label: 'device\\s*(?:id|identifier)|serial\\s*(?:no\\.?|number)|udi',
});
