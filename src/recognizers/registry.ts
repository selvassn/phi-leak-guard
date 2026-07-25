import type { PHICategory, Recognizer, Standard } from '../types';
import { accountRecognizer, deviceRecognizer, licenseRecognizer, mrnRecognizer } from './context-id';
import { dateRecognizer } from './date';
import { emailRecognizer } from './email';
import { ipRecognizer } from './ip';
import { nhsNumberRecognizer } from './nhs-number';
import { ninoRecognizer } from './nino';
import { personNameRecognizer } from './person-name';
import { phoneRecognizer } from './phone';
import { ukPostcodeRecognizer } from './uk-postcode';
import { urlRecognizer } from './url';
import { usSsnRecognizer } from './us-ssn';
import { usZipRecognizer } from './us-zip';
import { vehicleVinRecognizer } from './vehicle-vin';

/** All recognizers shipped with the library. */
export const RECOGNIZERS: Recognizer[] = [
  accountRecognizer,
  dateRecognizer,
  deviceRecognizer,
  emailRecognizer,
  ipRecognizer,
  licenseRecognizer,
  mrnRecognizer,
  nhsNumberRecognizer,
  ninoRecognizer,
  personNameRecognizer,
  phoneRecognizer,
  ukPostcodeRecognizer,
  urlRecognizer,
  usSsnRecognizer,
  usZipRecognizer,
  vehicleVinRecognizer,
];

/**
 * Categories a TEXT scanner fundamentally cannot detect: biometric templates
 * and full-face photos are binary data, not text; "other" (HIPAA #18, any other
 * unique identifier) is open-ended by definition. These are reported as
 * not-applicable rather than as missing coverage — an honest gap that can never
 * close for a text tool.
 */
export const NOT_TEXT_DETECTABLE: PHICategory[] = ['biometric', 'photo', 'other'];

/**
 * Categories each standard requires to be removed for de-identification.
 * HIPAA follows the 18 Safe Harbor identifiers; UK is a pragmatic direct-
 * identifier set (GDPR's "personal data" is open-ended and cannot be a fixed
 * list). These are the yardsticks the coverage report measures against.
 */
export const REQUIRED_CATEGORIES: Record<Standard, PHICategory[]> = {
  HIPAA_SAFE_HARBOR: [
    'name', 'geographic', 'date', 'phone', 'fax', 'email', 'ssn', 'mrn',
    'account', 'license', 'vehicle', 'device', 'url', 'ip', 'biometric',
    'photo', 'other',
  ],
  UK_GDPR: [
    'name', 'geographic', 'date', 'phone', 'email', 'nhs-number', 'nino',
    'account', 'other',
  ],
};
