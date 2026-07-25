import type { PHIMatch, Recognizer } from '../types';

/**
 * Web URL (HIPAA Safe Harbor #14; a personal URL is GDPR personal data).
 * Matches http(s) URLs and bare `www.` hosts. Trailing sentence punctuation is
 * trimmed so "see https://x.com/p." doesn't capture the full stop.
 */
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const TRAILING = /[.,;:!?)\]]+$/;

export const urlRecognizer: Recognizer = {
  id: 'url',
  category: 'url',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(URL)) {
      const value = m[0].replace(TRAILING, '');
      matches.push({
        recognizer: 'url',
        category: 'url',
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 'pattern',
      });
    }
    return matches;
  },
};
