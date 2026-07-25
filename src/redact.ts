import type { DetectOptions } from './types';
import { detectPHI } from './detect';

export interface RedactResult {
  /** The input with every detected PHI span replaced by a `[CATEGORY]` label. */
  text: string;
  /** How many spans were redacted. */
  redactions: number;
}

/**
 * Replace detected PHI with category labels, e.g.
 *   "Call john@x.com"  ->  "Call [EMAIL]"
 * Purely deterministic; nothing leaves memory. Spans are replaced right-to-left
 * so earlier offsets stay valid as the string is rewritten.
 */
export function redactPHI(input: string, options: DetectOptions = {}): RedactResult {
  const { matches } = detectPHI(input, options);
  if (matches.length === 0) return { text: input, redactions: 0 };

  const ordered = [...matches].sort((a, b) => b.start - a.start);
  let text = input;
  for (const m of ordered) {
    text = text.slice(0, m.start) + `[${m.category.toUpperCase()}]` + text.slice(m.end);
  }
  return { text, redactions: matches.length };
}
