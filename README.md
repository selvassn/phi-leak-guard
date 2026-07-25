# phi-leak-guard

[![CI](https://github.com/selvassn/phi-leak-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/selvassn/phi-leak-guard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/phi-leak-guard.svg)](https://www.npmjs.com/package/phi-leak-guard)
[![license](https://img.shields.io/npm/l/phi-leak-guard.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/phi-leak-guard.svg)](https://www.npmjs.com/package/phi-leak-guard)

> Deterministic PHI/PII-leak assertions for LLM output — runnable in your normal `npm test`. HIPAA Safe Harbor + UK GDPR. **No LLM calls. No data leaves your machine.**

Fail the build when your LLM feature leaks patient identifiers into its output. `phi-leak-guard` is a lightweight, zero-runtime-dependency assertion library that drops into Vitest, Jest, or `node:test` like any other `expect`.

```ts
import { expectLLM } from 'phi-leak-guard';

test('clinical summary never leaks PHI', async () => {
  const summary = await summarize(patientNote);
  await expectLLM(summary).toContainNoPHI();
});
```

## Why

Generic LLM-eval tools (autoevals, vitest-evals, promptfoo, evalite) either have **no PHI concept**, or send your data to a **third-party SaaS** — a non-starter when the input *is* PHI. `phi-leak-guard` is the compliance regression test that was missing: **local, deterministic, zero-cost per run**, and it lives in the test suite you already have.

- 🔒 **Nothing leaves the process** — pure regex + checksums, no network, no model.
- ✅ **Precision-first** — checksum/structural validation (NHS Modulus-11, VIN check digit, IPv4 ranges) so a random reference number isn't flagged as PHI.
- 📋 **Standards-anchored** — recognizers map to HIPAA Safe Harbor's 18 identifiers and the UK direct-identifier set; `coverageReport()` tells you exactly what is and isn't checked.
- 🧩 **Extensible** — plug in your own recognizer (e.g. an NER model) via one interface.
- 📦 **Zero runtime dependencies**, ESM + CommonJS, first-class TypeScript types.

## Install

```sh
npm install --save-dev phi-leak-guard
```

Requires Node.js 18+.

## Usage

### Assert in a test

```ts
import { expectLLM } from 'phi-leak-guard';

await expectLLM(output).toContainNoPHI();                                 // check everything (default)
await expectLLM(output).toContainNoPHI({ standards: ['HIPAA_SAFE_HARBOR'] }); // US HIPAA identifiers only
await expectLLM(output).toContainNoPHI({ standards: ['UK_GDPR'] });          // UK direct identifiers only
```

`toContainNoPHI` throws a `PHIAssertionError` (which any test runner reports as a failure) listing what leaked:

```
Expected output to contain no PHI, but found 2:
  - [name] "John Smith" (pattern) at 13-23
  - [nhs-number] "943 476 5919" (validated) at 40-52
```

### Inspect matches directly

```ts
import { detectPHI } from 'phi-leak-guard';

const { matches, clean } = detectPHI('Contact John Smith on 0207 946 0958');
// clean === false
// matches: [{ category: 'name', value: 'John Smith', confidence: 'pattern', start, end }, ...]
```

### Redact before logging or prompting

```ts
import { redactPHI } from 'phi-leak-guard';

const { text, redactions } = redactPHI('Email jane.doe@example.com about MRN A4821337');
// text: 'Email [EMAIL] about MRN [MRN]'
// redactions: 2
```

### Plug in your own recognizer (e.g. an NER model)

Deterministic detection can't catch every name (see [Limitations](#limitations)). Supply extra recognizers — the same interface the built-ins use — for anything you need, such as a statistical NER model:

```ts
import { detectPHI, type Recognizer } from 'phi-leak-guard';

const nerNames: Recognizer = {
  id: 'ner-names',
  category: 'name',
  standards: ['HIPAA_SAFE_HARBOR', 'UK_GDPR'],
  detect(text) {
    return myNerModel(text).map((span) => ({
      recognizer: 'ner-names', category: 'name', value: span.text,
      start: span.start, end: span.end, confidence: 'pattern',
    }));
  },
};

detectPHI(output, { extraRecognizers: [nerNames] });
```

### Check coverage

```ts
import { coverageReport } from 'phi-leak-guard';

coverageReport();
// [{ standard: 'HIPAA_SAFE_HARBOR', covered: [...], missing: [], notApplicable: ['biometric','photo','other'] }, ...]
```

## What it detects

| Category | Recognizer | Confidence | Standard |
|---|---|---|---|
| `nhs-number` | Modulus-11 checksum | validated | UK GDPR |
| `ssn` | structural rules + context-gated bare form | validated / pattern | HIPAA |
| `nino` | UK NINO prefix validation | validated | UK GDPR |
| `vehicle` | VIN (ISO 3779 check digit) | validated | HIPAA |
| `ip` | IPv4 octet ranges + IPv6 | validated | both |
| `geographic` | UK postcode, US ZIP (+state/context) | pattern | both |
| `date` | numeric + ISO full dates | pattern | both |
| `phone` / `fax` | digit-count + shape validation | pattern | both |
| `email` | pattern | pattern | both |
| `url` | http(s) / www | pattern | both |
| `name` | authoritative gazetteer + precision guards | pattern | both |
| `mrn` `account` `license` `device` | label-gated + digit required | pattern | both |

Every match is tagged `validated` (passed a checksum/structural rule — very low false-positive rate) or `pattern` (matched a pattern/context). Call `coverageReport()` for the authoritative, per-standard map.

## Limitations

Read these before you rely on it — being honest about them is the point.

- **Deterministic-only.** It catches explicit, formatted identifiers. It **will miss paraphrased or contextually-implied re-identification** ("a 92-year-old retired vicar from the village with one GP"). Use the `extraRecognizers` seam for an NER layer when you need more.
- **Names are a floor, not a ceiling.** The name recognizer is high-precision but gazetteer-based — it misses names whose given name isn't in the list, and single-name mentions. Real name recall needs a plugged-in NER model.
- **Not a compliance certification.** HIPAA Safe Harbor is a finite, completable list. **UK GDPR "personal data" is open-ended** — this covers common *direct* identifiers, not "all GDPR personal data" (no deterministic tool can). Passing this check reduces risk; it does not prove compliance.
- **`biometric`, `photo`, `other`** are not detectable in a text scanner — reported as `notApplicable`, never as covered.

## API

- `expectLLM(output: string)` → `{ toContainNoPHI(options?): Promise<void> }`
- `detectPHI(text, options?)` → `{ matches: PHIMatch[]; clean: boolean }`
- `redactPHI(text, options?)` → `{ text: string; redactions: number }`
- `coverageFor(standard)` / `coverageReport()` → per-standard coverage
- `options`: `{ standards?: Standard[]; extraRecognizers?: Recognizer[] }`
- `Standard`: `'HIPAA_SAFE_HARBOR' | 'UK_GDPR'`

## Contributing

```sh
npm install
npm test          # unit tests
npm run bench     # synthetic precision/recall benchmark
npm run build     # dual ESM + CJS build
```

Adding a recognizer = implement the `Recognizer` interface and register it in `src/recognizers/registry.ts`. The name gazetteer is generated from authoritative data with `npm run build:names`.

## License

[MIT](./LICENSE)
