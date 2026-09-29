# phi-leak-guard

[![CI](https://github.com/selvassn/phi-leak-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/selvassn/phi-leak-guard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/phi-leak-guard.svg)](https://www.npmjs.com/package/phi-leak-guard)
[![license](https://img.shields.io/npm/l/phi-leak-guard.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/phi-leak-guard.svg)](https://www.npmjs.com/package/phi-leak-guard)

> Deterministic PHI/PII-leak assertions for LLM output — runnable in your normal `npm test`. HIPAA Safe Harbor + UK GDPR. **No LLM calls. No data leaves your machine.**

Fail the build when your LLM feature emits patient identifiers it was supposed to have stripped. `phi-leak-guard` is a lightweight, zero-runtime-dependency assertion library that drops into Vitest, Jest, or `node:test` like any other `expect`.

```ts
import { expectLLM } from 'phi-leak-guard';

test('clinical summary never leaks PHI', async () => {
  const summary = await summarize(patientNote);
  await expectLLM(summary).toContainNoPHI();
});
```

## What it does

Two pure functions. A string goes in, a result comes out, and nothing leaves your process — no network, no model, no state.

### `detectPHI(text)` — find identifiers

```ts
import { detectPHI } from 'phi-leak-guard';

detectPHI('Mr John Smith, NHS 943 476 5919, admitted 12/03/2025.');
// {
//   clean: false,
//   matches: [
//     { category: 'name',       value: 'John Smith',   confidence: 'pattern',   start:  3, end: 13 },
//     { category: 'nhs-number', value: '943 476 5919', confidence: 'validated', start: 19, end: 31 },
//     { category: 'date',       value: '12/03/2025',   confidence: 'pattern',   start: 42, end: 52 },
//   ],
// }
```

`confidence` is the field worth reading. **`validated`** means the value passed a checksum or structural rule — NHS Modulus-11, a VIN check digit, IPv4 octet ranges — so it is almost certainly a real identifier. **`pattern`** means it matched a shape or a nearby label. `clean` is just `matches.length === 0`, there for readability.

### `redactPHI(text)` — replace them with labels

```ts
import { redactPHI } from 'phi-leak-guard';

redactPHI('Mr John Smith, NHS 943 476 5919, admitted 12/03/2025.');
// {
//   text: 'Mr [NAME], NHS [NHS-NUMBER], admitted [DATE].',
//   redactions: 3,
// }
```

Redaction is one-way: no mapping is kept and there is no un-redact. Getting the original values back would need reversible tokenisation, which this library deliberately does not do — the mapping vault would itself be a PHI store to secure, key and audit.

Everything else in the package is a thin wrapper over those two:

| You want to… | Use |
|---|---|
| Fail a test when output isn't clean | `expectLLM(out).toContainNoPHI()`, or the `expect(out).toContainNoPHI()` matcher |
| See what was found, and where | `detectPHI(text)` |
| Strip identifiers before logging or storing | `redactPHI(text)` |
| Know which identifiers are covered | `coverageReport()` |
| Add your own detector (e.g. an NER model) | `detectPHI(text, { extraRecognizers: [...] })` |

## What it's for

Sixteen recognizers — regex plus checksums — sit behind those two functions. That is the whole engine, and its narrowness is deliberate, so it's worth being exact about what it buys you.

**It checks the output side.** The typical setup is a model that legitimately saw a real note — you have a BAA, or you self-host — and produced something that was *supposed* to come back de-identified: a summary, a research extract, a patient-facing letter. This asserts that it actually did.

**Reaching the model is not the leak.** Under a signed BAA — or an Art. 28 processor agreement in the UK/EU — sending a note to the model is a *permitted disclosure*, on the same legal footing as a transcription vendor or a cloud-hosted EHR. The model sits inside your compliance perimeter, and the major providers sign BAAs and offer zero-retention.

What changes is the destination. Input goes to **one** place, under **one** contract, usually ephemeral. Output flows into your app, your logs, Datadog, LangSmith traces, analytics events, an eval fixture committed to git, a letter sent to a patient, a vector store. One governed destination versus many ungoverned ones — which is exactly why the check belongs on the output.

**It still does not stop PHI reaching the model.** It never sees your input and does no input/output comparison. If a third-party model seeing patient data is itself unacceptable to you — a position plenty of trusts and health systems take — that is an architecture decision (self-host, on-prem), not something any assertion library fixes.

**Think of the model as a non-deterministic serializer.** Every API has a layer that decides what is safe to emit, and you already test it: `expect(response).not.toHaveProperty('passwordHash')`. Your database *has* the hash; that was never the question. With an ordinary serializer you can read the code and know what it emits. With an LLM you cannot — so you assert on the output instead.

**It is a regression test, not a security control.** The value lands four releases after you wrote the prompt, when someone edits it and de-identification quietly stops happening. Point it at *synthetic* notes in CI and you catch that with no real patient data involved anywhere:

```ts
// CI — synthetic notes, every commit. No real PHI in the loop.
test('summariser still de-identifies', async () => {
  const summary = await summarize(SYNTHETIC_NOTE);
  expect(summary).toContainNoPHI();
});
```

| It does | It does not |
|---|---|
| Assert output meets a de-identification contract | Prevent PHI reaching the model |
| Catch prompt and model regressions in CI | Certify HIPAA or GDPR compliance |
| Run on synthetic data with zero real PHI | Detect indirect re-identification |
| Give the same answer every run, offline, free | Replace a DPIA, a BAA, or human review |

**When it buys you nothing.** If your output was never meant to be de-identified, and it only ever returns to the same clinician who already owns the note, skip this library — it has nothing to tell you. Its value is conditional on one of two things being true: the output was *supposed* to come back clean, or the output travels somewhere the input was not allowed to go.

## Why

Generic LLM-eval tools (autoevals, vitest-evals, promptfoo, evalite) either have **no PHI concept**, or send your data to a **third-party SaaS** — a non-starter when the input *is* PHI. `phi-leak-guard` is the de-identification regression test that was missing: **local, deterministic, zero-cost per run**, and it lives in the test suite you already have.

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

### Use the native test matcher

Prefer `expect(...).toContainNoPHI()` that reads like any other matcher?

**Vitest** — one import auto-registers it (with types):

```ts
import 'phi-leak-guard/vitest';

test('summary is clean', () => {
  expect(summary).toContainNoPHI();
  expect(summary).toContainNoPHI({ standards: ['HIPAA_SAFE_HARBOR'] });
  expect(leakyOutput).not.toContainNoPHI();
});
```

**Jest** (or any `expect.extend`-compatible runner):

```ts
import { expect } from '@jest/globals';
import { phiMatchers } from 'phi-leak-guard/matchers';

expect.extend(phiMatchers);
// For types, add once in a .d.ts:
//   declare module 'expect' {
//     interface Matchers<R> { toContainNoPHI(options?: import('phi-leak-guard').DetectOptions): R }
//   }
```

### Redact before logging or prompting

`redactPHI` is shown [above](#redactphitext--replace-them-with-labels). Two things to know before you rely on it.

Overlapping matches — a checksum-valid NHS number is also a plausible 10-digit US phone — are reduced to one span each (`validated` beats `pattern`, then the longer span), so every identifier is replaced exactly once and the count reflects identifiers, not matches.

> **Don't make this your safety boundary.** Redacting before a prompt is reasonable defence-in-depth, but recall is 0.97 overall and **0.86 on names** (see below). A gate that lets ~3% through is not what makes it safe to send clinical data to a third party — a BAA/DPA, self-hosting, or zero-retention terms is.

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

## Measured performance

`npm run bench` scores the recognizers against a synthetic corpus with manufactured ground truth — 51 samples carrying 40 planted identifiers, plus 11 adversarial distractors (order references, `BP 120/80`, `Rose Cottage`, `Victoria Hospital`).

```
OVERALL   P 1.00   R 0.97   F1 0.99   (tp 39  fp 0  fn 1)
name      P 1.00   R 0.86   F1 0.92
```

Two invariants are enforced as tests: **zero false positives** (a guard that cries wolf gets switched off) and a **recall ratchet** that fails if overall recall drops below the committed baseline.

Read those numbers honestly. This is self-authored synthetic ground truth, not annotated clinical data, and the corpus is small — it demonstrates the recognizers behave as specified, it is not external validation. The single miss is `Xolani Mbeki`, a name outside the gazetteer, kept in the corpus deliberately so recall never looks solved.

## Limitations

Read these before you rely on it — being honest about them is the point.

- **Deterministic-only.** It catches explicit, formatted identifiers. It **will miss paraphrased or contextually-implied re-identification** ("a 92-year-old retired vicar from the village with one GP"). Use the `extraRecognizers` seam for an NER layer when you need more.
- **Names are a floor, not a ceiling.** The name recognizer is high-precision but gazetteer-based — it misses names whose given name isn't in the list. Measured recall on names is **0.86**. Real name recall needs a plugged-in NER model.
- **A title with a lone surname is not detected.** `Dr Sarah Patel` is found, `Dr Smith` is not: with the honorific stripped there is no given name left to check against the gazetteer, and treating any capitalised word after a title as a surname would cost more precision than it buys.
- **Not a compliance certification.** HIPAA Safe Harbor is a finite, completable list. **UK GDPR "personal data" is open-ended** — this covers common *direct* identifiers, not "all GDPR personal data" (no deterministic tool can). Passing this check reduces risk; it does not prove compliance.
- **Every full date counts as an identifier.** Safe Harbor #3 permits a bare *year* and nothing finer, so `Follow-up on 12/11/2025` fails the assertion. Correct per the standard, surprising in practice — scope with `standards`, or strip dates upstream, if your output legitimately carries appointment dates.
- **Phone context is read from the 25 characters *before* a candidate.** `Tel: 202 555 0173` is detected; `202 555 0173 (mobile)` is not. Deliberate: scanning the whole document would let a single "Tel" claim every 10-digit run on the page, including NHS numbers.
- **`biometric`, `photo`, `other`** are not detectable in a text scanner — reported as `notApplicable`, never as covered.

## API

- `expectLLM(output: string)` → `{ toContainNoPHI(options?): Promise<void> }`
- `detectPHI(text, options?)` → `{ matches: PHIMatch[]; clean: boolean }`
- `redactPHI(text, options?)` → `{ text: string; redactions: number }`
- `coverageFor(standard)` / `coverageReport()` → per-standard coverage
- `import 'phi-leak-guard/vitest'` → registers `expect(x).toContainNoPHI(options?)` (Vitest, with types)
- `phiMatchers` (`phi-leak-guard/matchers`) → for `expect.extend` in Jest or any compatible runner
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

## Stability

As of **1.0.0** the public API — `detectPHI`, `expectLLM`, `redactPHI`, the `toContainNoPHI` matcher, `coverageFor`/`coverageReport`, the `Recognizer` interface, and `DetectOptions` — is stable and follows [Semantic Versioning](https://semver.org/). New recognizers and options are added in minor releases; breaking changes only in a major. See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
