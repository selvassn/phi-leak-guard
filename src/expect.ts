import type { DetectOptions } from './types';
import { detectPHI } from './detect';

/** Thrown by the assertion API when PHI is found. Test runners report it as a failure. */
export class PHIAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PHIAssertionError';
  }
}

export interface LLMAssertion {
  /** Fails (throws) if the output contains any detectable PHI for the given locales. */
  toContainNoPHI(options?: DetectOptions): Promise<void>;
}

/**
 * Fluent, test-runner-agnostic assertion wrapper. Async so the surface stays
 * uniform if a future opt-in (e.g. context-aware checks) needs to await.
 *
 *   await expectLLM(output).toContainNoPHI({ locales: ['UK'] });
 */
export function expectLLM(output: string): LLMAssertion {
  return {
    async toContainNoPHI(options?: DetectOptions) {
      const result = detectPHI(output, options);
      if (!result.clean) {
        const details = result.matches
          .map((m) => `  - [${m.category}] "${m.value}" (${m.confidence}) at ${m.start}-${m.end}`)
          .join('\n');
        throw new PHIAssertionError(
          `Expected output to contain no PHI, but found ${result.matches.length}:\n${details}`,
        );
      }
    },
  };
}
