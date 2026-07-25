import { expect } from 'vitest';
import { phiMatchers } from './matchers';
import type { DetectOptions } from './types';

// Auto-register the matcher on Vitest's expect.
expect.extend(phiMatchers);

export { phiMatchers };

declare module 'vitest' {
  interface Assertion<T = any> {
    /** Fails if the string contains any detectable PHI for the given standards. */
    toContainNoPHI(options?: DetectOptions): T;
  }
  interface AsymmetricMatchersContaining {
    toContainNoPHI(options?: DetectOptions): void;
  }
}
