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
 *
 * The phone marker must be NEAR the candidate, not merely somewhere in the
 * document: a note reading "NHS 943 476 5919 ... Tel 0207 946 0958" mentions a
 * phone, but that says nothing about the NHS number twelve words earlier.
 * Scanning the whole text would let one "Tel" claim every 10-digit run on the
 * page, so context is read from a short window immediately before the match.
 */
const CANDIDATE = /\+?\d[\d\s().-]{7,15}\d/g;
const PHONE_CONTEXT = /\b(phone|telephone|tel|mobile|cell|call|fax)\b/i;
const FAX_NEARBY = /fax/i;

/** Chars before a candidate searched for a phone marker. */
const CONTEXT_WINDOW = 25;
/** Tighter window for the fax label, which sits directly against the number. */
const FAX_WINDOW = 12;

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
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CANDIDATE)) {
      const preceding = text.slice(Math.max(0, m.index - CONTEXT_WINDOW), m.index);
      if (!isPhone(m[0], PHONE_CONTEXT.test(preceding))) continue;
      // A "fax" label just before the number reclassifies it.
      const category: PHICategory = FAX_NEARBY.test(preceding.slice(-FAX_WINDOW)) ? 'fax' : 'phone';
      matches.push({
        recognizer: 'phone', category, value: m[0],
        start: m.index, end: m.index + m[0].length, confidence: 'pattern',
      });
    }
    return matches;
  },
};
