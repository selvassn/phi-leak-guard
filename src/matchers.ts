import { detectPHI } from './detect';
import type { DetectOptions, PHIMatch } from './types';

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

function format(matches: PHIMatch[]): string {
  return matches.map((m) => `  - [${m.category}] "${m.value}" (${m.confidence})`).join('\n');
}

/**
 * Framework-agnostic custom matchers. Register with either test runner:
 *
 *   import { expect } from 'vitest';            // or '@jest/globals'
 *   import { phiMatchers } from 'phi-leak-guard/matchers';
 *   expect.extend(phiMatchers);
 *
 * Vitest users can instead just `import 'phi-leak-guard/vitest'` for
 * auto-registration plus TypeScript types.
 */
export const phiMatchers = {
  toContainNoPHI(this: unknown, received: string, options?: DetectOptions): MatcherResult {
    const { matches, clean } = detectPHI(received, options);
    const isNot = (this as { isNot?: boolean } | undefined)?.isNot ?? false;
    return {
      pass: clean,
      message: () =>
        isNot
          ? 'Expected output to contain PHI, but none was detected.'
          : `Expected output to contain no PHI, but found ${matches.length}:\n${format(matches)}`,
    };
  },
};
