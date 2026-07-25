# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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
