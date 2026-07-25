import type { DetectOptions, DetectResult, PHIMatch, Recognizer, Standard } from './types';
import { RECOGNIZERS } from './recognizers/registry';

/** A recognizer runs when (no standard filter given) or it contributes to one. */
function selectRecognizers(pool: Recognizer[], standards?: Standard[]): Recognizer[] {
  if (!standards) return pool;
  return pool.filter((r) => r.standards.some((s) => standards.includes(s)));
}

/**
 * Run every applicable recognizer over `text` and collect matches. Purely
 * deterministic — no network, no LLM, nothing leaves memory. Scope by
 * regulation with `standards`, or leave it off to check everything.
 */
export function detectPHI(text: string, options: DetectOptions = {}): DetectResult {
  const pool = [...RECOGNIZERS, ...(options.extraRecognizers ?? [])];
  const recognizers = selectRecognizers(pool, options.standards);
  const matches: PHIMatch[] = [];
  for (const r of recognizers) {
    matches.push(...r.detect(text));
  }
  matches.sort((a, b) => a.start - b.start);
  return { matches, clean: matches.length === 0 };
}
