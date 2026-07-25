import type { PHIMatch, Recognizer } from '../types';

/**
 * IP address (HIPAA Safe Harbor #15; GDPR treats IPs as personal data).
 * IPv4 with per-octet range validation (0-255) so version strings and dotted
 * numbers like "400.000.0004" don't match. IPv6 covered by a conservative
 * hex-group pattern requiring several colon-separated groups.
 */
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;

export const ipRecognizer: Recognizer = {
  id: 'ip',
  category: 'ip',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const re of [IPV4, IPV6]) {
      for (const m of text.matchAll(re)) {
        matches.push({
          recognizer: 'ip',
          category: 'ip',
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
