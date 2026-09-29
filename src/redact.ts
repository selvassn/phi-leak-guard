import type { DetectOptions, PHIMatch } from './types';
import { detectPHI } from './detect';

export interface RedactResult {
  /** The input with every detected PHI span replaced by a `[CATEGORY]` label. */
  text: string;
  /** How many spans were redacted. */
  redactions: number;
}

/**
 * Reduce matches to a set of non-overlapping spans.
 *
 * Two recognizers can legitimately claim the same characters — a checksum-valid
 * NHS number is also a plausible 10-digit US phone. Rewriting both would splice
 * the second label into text the first had already rewritten, producing corrupt
 * output ("Ref [PHONE]R]") and a redaction count higher than the number of
 * identifiers actually removed. So each overlapping region keeps exactly one
 * match, chosen by: `validated` over `pattern` (a checksum is stronger evidence
 * than a shape), then the longer span, then the earlier one.
 */
function resolveOverlaps(matches: PHIMatch[]): PHIMatch[] {
  const ranked = [...matches].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'validated' ? -1 : 1;
    const byLength = b.end - b.start - (a.end - a.start);
    if (byLength !== 0) return byLength;
    return a.start - b.start;
  });

  const kept: PHIMatch[] = [];
  for (const m of ranked) {
    if (kept.some((k) => m.start < k.end && k.start < m.end)) continue;
    kept.push(m);
  }
  return kept;
}

/**
 * Replace detected PHI with category labels, e.g.
 *   "Call john@x.com"  ->  "Call [EMAIL]"
 * Purely deterministic; nothing leaves memory. Overlapping matches are reduced
 * to one span each, then replaced right-to-left so earlier offsets stay valid
 * as the string is rewritten.
 */
export function redactPHI(input: string, options: DetectOptions = {}): RedactResult {
  const { matches } = detectPHI(input, options);
  const spans = resolveOverlaps(matches);
  if (spans.length === 0) return { text: input, redactions: 0 };

  spans.sort((a, b) => b.start - a.start);
  let text = input;
  for (const m of spans) {
    text = text.slice(0, m.start) + `[${m.category.toUpperCase()}]` + text.slice(m.end);
  }
  return { text, redactions: spans.length };
}
