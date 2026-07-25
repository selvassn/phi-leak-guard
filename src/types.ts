/** Compliance standards a recognizer contributes coverage toward. */
export type Standard = 'HIPAA_SAFE_HARBOR' | 'UK_GDPR';

/**
 * Identifier categories — one flat vocabulary of every PHI/PII type the library
 * can name, regardless of regulation. The HIPAA-oriented set follows the 18
 * Safe Harbor identifiers; UK-specific identifiers (nhs-number, nino) are added
 * on top. Which categories a given standard *requires* is defined in the
 * registry, not here — this enum stays regulation-agnostic.
 */
export type PHICategory =
  | 'name'
  | 'geographic'
  | 'date'
  | 'phone'
  | 'fax'
  | 'email'
  | 'ssn'
  | 'mrn'
  | 'nhs-number'
  | 'nino'
  | 'account'
  | 'license'
  | 'vehicle'
  | 'device'
  | 'url'
  | 'ip'
  | 'biometric'
  | 'photo'
  | 'other';

/**
 * `validated` = the candidate passed a checksum or structural rule (e.g. NHS
 * Modulus-11, VIN check digit, IPv4 octet ranges) — very low false-positive
 * rate. `pattern` = matched a pattern/context only — higher recall, more FPs.
 */
export type Confidence = 'validated' | 'pattern';

export interface PHIMatch {
  /** Recognizer id that produced the match. */
  recognizer: string;
  category: PHICategory;
  /** The exact substring that matched. */
  value: string;
  /** Character offsets into the scanned text. */
  start: number;
  end: number;
  confidence: Confidence;
}

export interface Recognizer {
  id: string;
  /** The category this recognizer primarily emits. */
  category: PHICategory;
  /**
   * Extra categories this recognizer can emit at runtime (e.g. the phone
   * recognizer emits `fax` for fax-context numbers). Used by coverage so the
   * report reflects what is really detectable.
   */
  alsoCovers?: PHICategory[];
  /** Standards whose coverage table this recognizer contributes to. */
  standards: Standard[];
  detect(text: string): PHIMatch[];
}

export interface DetectOptions {
  /**
   * Which compliance standard(s) to check against — the single axis for
   * scoping. Only recognizers contributing to one of these run. Omit to check
   * every standard (the default). e.g. { standards: ['HIPAA_SAFE_HARBOR'] }
   */
  standards?: Standard[];
  /**
   * Additional recognizers to run alongside the built-ins — the pluggable seam
   * for e.g. a statistical NER model. Filtered by `standards` too.
   */
  extraRecognizers?: Recognizer[];
}

export interface DetectResult {
  matches: PHIMatch[];
  /** True when no PHI was found. */
  clean: boolean;
}
