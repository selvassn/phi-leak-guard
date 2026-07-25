import { describe, it, expect } from 'vitest';
import '../src/vitest'; // registers toContainNoPHI on expect + augments types

describe('native Vitest matcher', () => {
  it('passes clean output', () => {
    expect('The patient was discharged in good health.').toContainNoPHI();
  });

  it('fails on leaked PHI', () => {
    expect(() => expect('email jane.doe@example.com').toContainNoPHI()).toThrow(/found 1/);
  });

  it('supports the standards option', () => {
    // NHS number is not a HIPAA identifier, so under HIPAA scope this passes.
    expect('NHS 943 476 5919').toContainNoPHI({ standards: ['HIPAA_SAFE_HARBOR'] });
  });

  it('works with .not', () => {
    expect('email jane.doe@example.com').not.toContainNoPHI();
  });
});
