import type { PHICategory, PHIMatch, Recognizer } from '../types';

/**
 * Telephone / fax number (HIPAA #4 phone and #5 fax — the same identifier as
 * text; a UK GDPR direct identifier).
 *
 * The precision problem: a 10-digit phone looks exactly like an NHS number, and
 * random reference numbers look like phones. So we match broadly, then VALIDATE
 * by normalised digit count + shape — and deliberately DON'T claim a bare
 * 10-digit run unless it carries a phone marker (leading +, parentheses, or a
 * phone-context word). That leaves 10-digit NHS numbers to the NHS recognizer
 * and avoids flagging order numbers. A number preceded by "fax" is tagged as
 * the `fax` category (hence `alsoCovers`).
 */
const CANDIDATE = /\+?\d[\d\s().-]{7,15}\d/g;
const PHONE_CONTEXT = /\b(phone|telephone|tel|mobile|cell|call|fax)\b/i;
const FAX_NEARBY = /fax/i;

function isPhone(raw: string, hasContext: boolean): boolean {
  const hadPlus = raw.trimStart().startsWith('+');
  const hadParens = /\(\d/.test(raw);
  const digits = raw.replace(/\D/g, '');
  const len = digits.length;
  if (hadPlus && len >= 10 && len <= 13) return true;      // international
  if (len === 11 && digits.startsWith('0')) return true;   // UK trunk (0xxx…)
  if (len === 10 && (hadParens || hasContext)) return true; // US, needs a marker
  return false;
}

export const phoneRecognizer: Recognizer = {
  id: 'phone',
  category: 'phone',
  alsoCovers: ['fax'],
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const hasContext = PHONE_CONTEXT.test(text);
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CANDIDATE)) {
      if (!isPhone(m[0], hasContext)) continue;
      // A "fax" label just before the number reclassifies it.
      const preceding = text.slice(Math.max(0, m.index - 12), m.index);
      const category: PHICategory = FAX_NEARBY.test(preceding) ? 'fax' : 'phone';
      matches.push({
        recognizer: 'phone', category, value: m[0],
        start: m.index, end: m.index + m[0].length, confidence: 'pattern',
      });
    }
    return matches;
  },
};
