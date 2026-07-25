import type { PHICategory, Standard } from './types';
import { NOT_TEXT_DETECTABLE, RECOGNIZERS, REQUIRED_CATEGORIES } from './recognizers/registry';

export interface StandardCoverage {
  standard: Standard;
  /** All categories the standard requires. */
  required: PHICategory[];
  /** Required categories with at least one recognizer. */
  covered: PHICategory[];
  /** Required, detectable-in-text, but not yet covered — the real work-list. */
  missing: PHICategory[];
  /** Required but impossible for a text scanner (biometrics, photos, "other"). */
  notApplicable: PHICategory[];
}

/** Categories a recognizer can emit — its primary plus any `alsoCovers`. */
function coveredCategories(): Set<PHICategory> {
  const set = new Set<PHICategory>();
  for (const r of RECOGNIZERS) {
    set.add(r.category);
    for (const c of r.alsoCovers ?? []) set.add(c);
  }
  return set;
}

/**
 * Honest, per-standard coverage. Splits required categories into covered,
 * missing (addressable), and not-applicable (undetectable in text) — so the
 * report never counts an impossible category as a closable gap, nor averages
 * real gaps away.
 */
export function coverageFor(standard: Standard): StandardCoverage {
  const required = REQUIRED_CATEGORIES[standard];
  const detectable = coveredCategories();
  const notApplicable = required.filter((c) => NOT_TEXT_DETECTABLE.includes(c));
  const addressable = required.filter((c) => !NOT_TEXT_DETECTABLE.includes(c));
  const covered = addressable.filter((c) => detectable.has(c));
  const missing = addressable.filter((c) => !detectable.has(c));
  return { standard, required, covered, missing, notApplicable };
}

export function coverageReport(): StandardCoverage[] {
  return (Object.keys(REQUIRED_CATEGORIES) as Standard[]).map(coverageFor);
}
