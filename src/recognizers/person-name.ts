import type { PHIMatch, Recognizer } from '../types';
import { GIVEN_NAMES } from '../data/given-names.generated';

/**
 * Person-name recognizer — gazetteer approach, HIGH-PRECISION by design.
 *
 * The given-name list is generated from authoritative, frequency-ranked data
 * (US SSA popular baby names; ONS-merge-ready) by scripts/build-names.mjs — not
 * hand-typed. See that script for provenance.
 *
 * Names have no checksum, so this is the ceiling of deterministic detection.
 * The de-id literature shows gazetteer name detection caps around 75-80%
 * precision because many real names are also common words / place components.
 * We defend precision with three rules:
 *   1. only fire on a *known given name* followed by a capitalised surname,
 *   2. drop everyday-word names that are FP magnets (AMBIGUOUS_GIVEN),
 *   3. reject when the trailing token is a place/institution word (a name
 *      like "Rose Cottage" or "Victoria Hospital" is a location, not a person).
 *
 * Honorifics are stripped before rule 1 is applied. Without that, the greedy
 * capitalised-run match swallows the title ("Mr John Smith" is one span), the
 * gazetteer test then runs against "mr", fails, and the real name inside is
 * discarded. A trailing full stop happens to break the run — which is why
 * "Dr. Sarah Patel" was found but "Dr Sarah Patel" was not — and British style
 * drops that full stop, so the unpunctuated form is the common one in UK notes.
 *
 * For real recall on names, plug a statistical NER model in via
 * `DetectOptions.extraRecognizers`. This list is the free floor, not the ceiling.
 */

// Everyday-word given names that produce false positives in clinical prose.
// Dropping them costs a little recall on real people so named — an explicit,
// documented precision trade, not an accident.
const AMBIGUOUS_GIVEN = new Set<string>([
  'rose', 'grace', 'hope', 'faith', 'may', 'june', 'mark', 'ivy', 'joy',
  'dawn', 'summer', 'holly', 'angel', 'king', 'prince', 'precious', 'royal',
  'sunny', 'love', 'divine', 'sincere', 'justice', 'reign',
]);

// If the token after the given name is one of these, the span is a place or
// institution, not a person.
const PLACE_INSTITUTION = new Set<string>([
  'road', 'street', 'lane', 'avenue', 'drive', 'close', 'court', 'way',
  'place', 'square', 'hospital', 'clinic', 'centre', 'center', 'ward',
  'house', 'cottage', 'manor', 'hall', 'park', 'station', 'garden', 'gardens',
  'church', 'college', 'school', 'university', 'trust', 'surgery', 'practice',
  'home', 'wing', 'unit', 'bridge', 'green', 'view', 'lodge', 'grove',
]);

// Leading titles, with or without the full stop. Longer forms precede their
// own prefixes so the alternation can't stop short (Mrs before Mr, Prof before
// Pro-nothing, etc. — the regex would backtrack anyway, but explicit is safer).
const LEADING_HONORIFIC =
  /^(?:(?:Professor|Prof|Doctor|Dr|Reverend|Rev|Father|Fr|Master|Matron|Sister|Nurse|Mrs|Miss|Mx|Ms|Mr|Sir|Dame|Lady|Lord)\.?\s+)+/i;

// Sequences of 2+ capitalised, alphabetic tokens (allowing hyphen/apostrophe).
const CAP_SEQUENCE = /\b[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)+\b/g;

export const personNameRecognizer: Recognizer = {
  id: 'person-name',
  category: 'name',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    const matches: PHIMatch[] = [];
    for (const m of text.matchAll(CAP_SEQUENCE)) {
      // Drop any leading title, and shift the offset by exactly what was cut.
      const span = m[0].replace(LEADING_HONORIFIC, '');
      const offset = m[0].length - span.length;

      const tokens = span.split(/\s+/);
      // A title followed by a lone surname ("Dr Smith") leaves nothing to check
      // against the gazetteer — precision-first, so it is left undetected.
      if (tokens.length < 2) continue;

      const first = tokens[0]!.toLowerCase();
      const second = tokens[1]!.toLowerCase();

      if (!GIVEN_NAMES.has(first) || AMBIGUOUS_GIVEN.has(first)) continue;
      if (PLACE_INSTITUTION.has(second)) continue;

      matches.push({
        recognizer: 'person-name',
        category: 'name',
        value: span,
        start: m.index + offset,
        end: m.index + offset + span.length,
        confidence: 'pattern',
      });
    }
    return matches;
  },
};
