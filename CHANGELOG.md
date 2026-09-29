# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## 1.1.0 — 2026-09-29

Three detection fixes, all surfaced by running the recognizers over realistic
clinical text rather than isolated snippets. Detection behaviour changes, so
this is a minor release rather than a patch: output that passed
`toContainNoPHI` before may now fail it — correctly.

### Fixed
- **Titled names were silently discarded.** `Mr John Smith`, `Dr Sarah Patel`,
  `Mrs Mary Smith` and `Prof Alan Hughes` were all missed. The capitalised-run
  match swallowed the honorific, tested *that* against the given-name gazetteer,
  failed, and dropped the real name inside the span. `Dr.` worked only because
  the full stop breaks the run by accident — and British style omits it, making
  the broken form the common one in UK notes. Leading honorifics are now
  stripped before the gazetteer test, with offsets adjusted so matches point at
  the name rather than the title. Measured on a corpus that now includes the
  unpunctuated form, name recall goes from **0.29 to 0.86**.
- **One phone marker claimed every 10-digit run in the document.** Phone context
  was tested against the entire text, so a single "Tel" or "call" anywhere made
  every bare 10-digit number a phone — including checksum-valid NHS numbers the
  recognizer was explicitly designed to leave alone. Context is now read from
  the 25 characters immediately before each candidate.
- **`redactPHI` corrupted overlapping spans.** Where two recognizers claimed the
  same characters (an NHS number is also a plausible 10-digit US phone), both
  were replaced at offsets the first replacement had already invalidated —
  producing output such as `Ref [PHONE]R]` and a `redactions` count higher than
  the number of identifiers actually removed. Overlaps now resolve to one span
  each (`validated` beats `pattern`, then the longer span), so every identifier
  is replaced exactly once.

### Changed
- Benchmark corpus expanded from 46 to 51 samples, adding unpunctuated-honorific
  names and a distractor that exercises the place guard after the honorific
  strip. Recall ratchet raised from 0.95 to 0.97.
- README rewritten to state precisely what the library does and does not do: a
  `detectPHI` / `redactPHI` walkthrough, the output-side threat model, measured
  performance with its caveats, and the cases where the library buys you
  nothing.

## 1.0.0 — 2026-07-25

First stable release. The public API (`detectPHI`, `expectLLM`, `redactPHI`,
`coverageFor`/`coverageReport`, the `Recognizer` interface, and `DetectOptions`)
is now considered stable and will follow semver.

### Added
- **Native Vitest matcher** — `import 'phi-leak-guard/vitest'` auto-registers
  `expect(output).toContainNoPHI(options?)`, with TypeScript types.
- **Framework-agnostic `phiMatchers`** (`phi-leak-guard/matchers`) — register in
  Jest or any `expect.extend`-compatible runner.

## 0.0.1 — 2026-07-24

Initial release.

- `detectPHI`, `expectLLM(...).toContainNoPHI`, `redactPHI`, `coverageReport`.
- 16 recognizers across HIPAA Safe Harbor and UK GDPR, with checksum/structural
  validation (NHS Modulus-11, VIN check digit, IPv4 ranges, NINO prefixes).
- `standards` scoping and a pluggable-recognizer seam (`extraRecognizers`).
- Synthetic precision/recall benchmark (recall 0.97, precision 1.00).
- Zero runtime dependencies; ESM + CommonJS build.
