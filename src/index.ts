export { expectLLM, PHIAssertionError } from './expect';
export type { LLMAssertion } from './expect';
export { phiMatchers } from './matchers';

export { detectPHI } from './detect';
export { redactPHI } from './redact';
export type { RedactResult } from './redact';
export { coverageFor, coverageReport } from './coverage';
export type { StandardCoverage } from './coverage';

export { RECOGNIZERS, REQUIRED_CATEGORIES, NOT_TEXT_DETECTABLE } from './recognizers/registry';
export { isValidNhsNumber } from './recognizers/nhs-number';
export { isValidSsn } from './recognizers/us-ssn';
export { isValidNino } from './recognizers/nino';
export { isValidVin } from './recognizers/vehicle-vin';
export { personNameRecognizer } from './recognizers/person-name';

export type {
  Standard,
  PHICategory,
  Confidence,
  PHIMatch,
  Recognizer,
  DetectOptions,
  DetectResult,
} from './types';
