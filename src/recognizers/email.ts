import type { PHIMatch, Recognizer } from '../types';

/**
 * Email address. Shared across jurisdictions (HIPAA identifier #6; personal
 * data under UK GDPR). Pattern-only: no checksum exists, so recall is high but
 * this carries a higher false-positive risk than the validated recognizers.
 */
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export const emailRecognizer: Recognizer = {
  id: 'email',
  category: 'email',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(EMAIL)) {
      matches.push({
        recognizer: 'email',
        category: 'email',
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 'pattern',
      });
    }
    return matches;
  },
};
