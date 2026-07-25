import { describe, it, expect } from 'vitest';
import {
  detectPHI,
  redactPHI,
  expectLLM,
  PHIAssertionError,
  coverageFor,
  isValidNhsNumber,
  isValidVin,
} from '../src/index';
import type { Recognizer } from '../src/index';

describe('NHS Number (Modulus-11 validated)', () => {
  it('flags a checksum-valid NHS number', () => {
    const r = detectPHI('Patient NHS no 943 476 5919 admitted today.');
    expect(r.matches[0]?.category).toBe('nhs-number');
    expect(r.matches[0]?.confidence).toBe('validated');
  });

  it('does NOT flag a 10-digit number that fails the checksum', () => {
    const r = detectPHI('Order reference 1234567890 shipped.');
    expect(r.matches.some((m) => m.category === 'nhs-number')).toBe(false);
  });

  it('catches dot-separated and label-adjacent forms', () => {
    expect(detectPHI('ref 400.000.0004').matches.some((m) => m.category === 'nhs-number')).toBe(true);
    expect(detectPHI('NHSNo9434765919').matches.some((m) => m.category === 'nhs-number')).toBe(true);
  });

  it('validates the checksum in isolation', () => {
    expect(isValidNhsNumber('9434765919')).toBe(true);
    expect(isValidNhsNumber('9434765918')).toBe(false);
  });
});

describe('US SSN', () => {
  it('flags dashed and space-separated forms', () => {
    expect(detectPHI('SSN 123-45-6789 on file').matches.some((m) => m.category === 'ssn')).toBe(true);
    expect(detectPHI('SSN 234 56 7891').matches.some((m) => m.category === 'ssn')).toBe(true);
  });
  it('catches a bare 9-digit SSN only with SSN context', () => {
    expect(detectPHI('SSN 123456789 on file').matches.some((m) => m.category === 'ssn')).toBe(true);
    expect(detectPHI('Order 123456789 shipped').matches.some((m) => m.category === 'ssn')).toBe(false);
  });
  it('does NOT flag a structurally-invalid SSN (area 000)', () => {
    expect(detectPHI('code 000-12-3456').matches.some((m) => m.category === 'ssn')).toBe(false);
  });
});

describe('date, postcode, ZIP', () => {
  it('flags a full date but not clinical measurements', () => {
    expect(detectPHI('DOB 14/03/1962').matches.some((m) => m.category === 'date')).toBe(true);
    expect(detectPHI('BP 120/80, HR 72').matches.some((m) => m.category === 'date')).toBe(false);
  });
  it('flags a UK postcode, ignores clinical shorthand', () => {
    expect(detectPHI('resident at M14 5GL').matches.some((m) => m.category === 'geographic')).toBe(true);
    expect(detectPHI('reading SpO2 98% today').matches.some((m) => m.category === 'geographic')).toBe(false);
  });
  it('flags US ZIP+4 and context-gated 5-digit, ignores bare numbers', () => {
    expect(detectPHI('mailing 90210-1234').matches.some((m) => m.category === 'geographic')).toBe(true);
    expect(detectPHI('ZIP 90210').matches.some((m) => m.category === 'geographic')).toBe(true);
    expect(detectPHI('lab value 90210 recorded').matches.some((m) => m.category === 'geographic')).toBe(false);
  });
});

describe('phone / fax', () => {
  it('catches UK trunk and US/international phones', () => {
    expect(detectPHI('call 0207 946 0958').matches.some((m) => m.category === 'phone')).toBe(true);
    expect(detectPHI('tel (202) 555-0173').matches.some((m) => m.category === 'phone')).toBe(true);
  });
  it('does NOT mistake a 10-digit NHS number for a phone', () => {
    const r = detectPHI('NHS 943 476 5919');
    expect(r.matches.some((m) => m.category === 'phone')).toBe(false);
    expect(r.matches.some((m) => m.category === 'nhs-number')).toBe(true);
  });
  it('tags a fax-labelled number as fax', () => {
    const r = detectPHI('Fax 0207 946 0958 for records');
    expect(r.matches.some((m) => m.category === 'fax')).toBe(true);
  });
});

describe('url and ip', () => {
  it('flags URLs, trimming trailing punctuation', () => {
    const r = detectPHI('see https://portal.example.com/u/42.');
    const url = r.matches.find((m) => m.category === 'url');
    expect(url?.value).toBe('https://portal.example.com/u/42');
  });
  it('flags a valid IPv4, not a dotted non-IP', () => {
    expect(detectPHI('from 192.168.14.203').matches.some((m) => m.category === 'ip')).toBe(true);
    expect(detectPHI('code 400.000.0004').matches.some((m) => m.category === 'ip')).toBe(false);
  });
});

describe('nino and vehicle VIN (validated)', () => {
  it('flags a valid NINO, rejects an invalid prefix', () => {
    expect(detectPHI('NINO AB 12 34 56 C').matches.some((m) => m.category === 'nino')).toBe(true);
    expect(detectPHI('code DF 12 34 56 C').matches.some((m) => m.category === 'nino')).toBe(false); // D invalid
  });
  it('validates a VIN check digit', () => {
    expect(isValidVin('1HGCM82633A004352')).toBe(true);
    expect(isValidVin('1HGCM82633A004353')).toBe(false);
  });
});

describe('context-gated ids (mrn/account/license/device)', () => {
  it('flags labelled ids, ignores unlabelled numbers', () => {
    expect(detectPHI('MRN: A4821337 attached').matches.some((m) => m.category === 'mrn')).toBe(true);
    expect(detectPHI('Policy number PN-9931827').matches.some((m) => m.category === 'account')).toBe(true);
    expect(detectPHI('License no D1234567').matches.some((m) => m.category === 'license')).toBe(true);
    expect(detectPHI('Serial number SN-88213X').matches.some((m) => m.category === 'device')).toBe(true);
    expect(detectPHI('Device ID UDI-40021').matches.some((m) => m.category === 'device')).toBe(true);
  });
  it('requires a label AND a digit — no false positives on prose', () => {
    expect(detectPHI('the account holder signed').matches.some((m) => m.category === 'account')).toBe(false);
    expect(detectPHI('renew your licence online').matches.some((m) => m.category === 'license')).toBe(false);
    expect(detectPHI('a serial killer thriller').matches.some((m) => m.category === 'device')).toBe(false);
  });
});

describe('person-name (gazetteer, high-precision)', () => {
  it('flags a known given name + surname', () => {
    const name = detectPHI('The patient, John Smith, was reviewed today.').matches.find((m) => m.category === 'name');
    expect(name?.value).toBe('John Smith');
  });
  it('does NOT flag capitalised non-names (precision guard)', () => {
    expect(detectPHI('Lives at 22 Elm Road, Manchester today.').matches.some((m) => m.category === 'name')).toBe(false);
  });
});

describe('standard filter', () => {
  const nhs = 'NHS 943 476 5919';
  const ssn = 'SSN 123-45-6789';

  it('HIPAA scope ignores UK-only identifiers, catches US ones', () => {
    expect(detectPHI(nhs, { standards: ['HIPAA_SAFE_HARBOR'] }).clean).toBe(true);
    expect(detectPHI(ssn, { standards: ['HIPAA_SAFE_HARBOR'] }).clean).toBe(false);
  });
  it('UK GDPR scope ignores US-only identifiers, catches UK ones', () => {
    expect(detectPHI(ssn, { standards: ['UK_GDPR'] }).clean).toBe(true);
    expect(detectPHI(nhs, { standards: ['UK_GDPR'] }).clean).toBe(false);
  });
  it('shared identifiers (email) fire under either standard', () => {
    const e = 'contact jane.doe@example.com';
    expect(detectPHI(e, { standards: ['HIPAA_SAFE_HARBOR'] }).clean).toBe(false);
    expect(detectPHI(e, { standards: ['UK_GDPR'] }).clean).toBe(false);
  });
  it('expectLLM accepts the standard filter', async () => {
    await expectLLM(nhs).toContainNoPHI({ standards: ['HIPAA_SAFE_HARBOR'] });
    await expect(
      expectLLM(ssn).toContainNoPHI({ standards: ['HIPAA_SAFE_HARBOR'] }),
    ).rejects.toBeInstanceOf(PHIAssertionError);
  });
});

describe('pluggable recognizer seam (extraRecognizers)', () => {
  it('runs a caller-supplied recognizer alongside the built-ins', () => {
    const custom: Recognizer = {
      id: 'ward-demo',
      category: 'other',
      standards: ['HIPAA_SAFE_HARBOR'],
      detect(text) {
        const out = [];
        for (const m of text.matchAll(/\bWARD-(\d{3})\b/g)) {
          out.push({
            recognizer: 'ward-demo', category: 'other' as const, value: m[0],
            start: m.index, end: m.index + m[0].length, confidence: 'pattern' as const,
          });
        }
        return out;
      },
    };
    const r = detectPHI('Bed on WARD-042 today.', { extraRecognizers: [custom] });
    expect(r.matches.some((m) => m.category === 'other')).toBe(true);
  });
});

describe('redactPHI', () => {
  it('replaces detected spans with category labels', () => {
    const { text, redactions } = redactPHI('Email jane.doe@example.com now');
    expect(text).toBe('Email [EMAIL] now');
    expect(redactions).toBe(1);
  });
});

describe('expectLLM assertion API', () => {
  it('passes clean output', async () => {
    await expectLLM('The patient was discharged in good health.').toContainNoPHI();
  });
  it('throws PHIAssertionError on leaked PHI', async () => {
    await expect(
      expectLLM('Reach the patient at john.doe@example.com').toContainNoPHI(),
    ).rejects.toBeInstanceOf(PHIAssertionError);
  });
});

describe('coverage report', () => {
  it('reports all addressable categories covered, biometrics N/A', () => {
    const us = coverageFor('HIPAA_SAFE_HARBOR');
    expect(us.covered).toContain('ssn');
    expect(us.covered).toContain('vehicle');
    expect(us.covered).toContain('fax'); // via the phone recognizer's alsoCovers
    expect(us.missing).toHaveLength(0);
    expect(us.notApplicable).toContain('biometric');
    expect(us.notApplicable).toContain('photo');

    const uk = coverageFor('UK_GDPR');
    expect(uk.covered).toContain('nhs-number');
    expect(uk.covered).toContain('nino');
    expect(uk.missing).toHaveLength(0);
  });
});
