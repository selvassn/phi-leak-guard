import { describe, it, expect } from 'vitest';
import { detectPHI } from '../src/index';
import type { PHICategory } from '../src/index';

/**
 * Synthetic PHI benchmark — the credibility artifact.
 *
 * We manufacture ground truth (text with *known* planted identifiers + clean
 * distractors), so we can compute real precision / recall / F1 with no human
 * annotation. That is exactly why deterministic PHI is buildable without
 * labelled clinical data.
 *
 * The set is deliberately HARD: real-world formatting variants, adversarial
 * distractors that look like PHI but aren't, and a few cases still beyond
 * deterministic reach (a rare non-gazetteer name) so recall never looks falsely
 * solved. The point is an honest map of where recall leaks.
 */

// --- deterministic valid-identifier generators -----------------------------

function nhsCheckDigit(nine: string): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nine[i]) * (10 - i);
  const c = 11 - (sum % 11);
  return c === 11 ? 0 : c;
}

/** Build a checksum-valid NHS number from a 9-digit prefix, or null if invalid. */
function makeNhsNumber(nine: string): string | null {
  const c = nhsCheckDigit(nine);
  if (c === 10) return null; // never issued
  return nine + String(c);
}

const spaceNhs = (n: string) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
const dotNhs = (n: string) => `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;

// Reproducible spread of valid NHS numbers (no randomness).
const validNhs: string[] = [];
for (let i = 0; i < 40 && validNhs.length < 12; i++) {
  const full = makeNhsNumber(String(400000000 + i * 7654321));
  if (full) validNhs.push(full);
}

const validSsns = ['123-45-6789', '234-56-7891', '536-22-1043', '412-88-7654'];
const emails = ['jane.doe@example.com', 'a.patient@nhs.net', 'bob99@gmail.com'];

// --- dataset ---------------------------------------------------------------

interface Sample {
  text: string;
  expected: Array<{ category: PHICategory; value: string }>;
}

const norm = (s: string) => s.replace(/[ .-]/g, '').toLowerCase();

// Well-formatted positives — these should all be caught.
const easyPositives: Sample[] = [
  ...validNhs.map((n): Sample => ({
    text: `Patient presented today; NHS number ${spaceNhs(n)} recorded on the chart.`,
    expected: [{ category: 'nhs-number', value: n }],
  })),
  ...validSsns.map((s): Sample => ({
    text: `Insurance record shows SSN ${s} for the account holder.`,
    expected: [{ category: 'ssn', value: s }],
  })),
  ...emails.map((e): Sample => ({
    text: `Follow-up correspondence should go to ${e} before Friday.`,
    expected: [{ category: 'email', value: e }],
  })),
];

// Hard positives — real-world shapes plus the newer identifier types.
const hardPositives: Sample[] = [
  { text: `NHS number ${dotNhs(validNhs[0]!)} on the referral letter.`, expected: [{ category: 'nhs-number', value: validNhs[0]! }] },
  { text: `System reference NHSNo${validNhs[1]!} was migrated.`, expected: [{ category: 'nhs-number', value: validNhs[1]! }] },
  { text: `SSN 123456789 verified against the SSA.`, expected: [{ category: 'ssn', value: '123456789' }] },
  { text: `Applicant SSN 234 56 7891 on the form.`, expected: [{ category: 'ssn', value: '234567891' }] },
  { text: `The patient, John Smith, was reviewed on the ward round.`, expected: [{ category: 'name', value: 'John Smith' }] },
  { text: `Reviewed by Dr. Aaliyah Hussain in the outpatient clinic.`, expected: [{ category: 'name', value: 'Aaliyah Hussain' }] },
  // Unpunctuated honorifics — British style drops the full stop, so these are
  // the COMMON form in UK notes. The greedy capitalised-run match used to
  // swallow the title and discard the name inside it.
  { text: `Mr John Smith was reviewed on the ward round.`, expected: [{ category: 'name', value: 'John Smith' }] },
  { text: `Dr Sarah Patel signed the discharge summary.`, expected: [{ category: 'name', value: 'Sarah Patel' }] },
  { text: `Mrs Mary Smith attended with her husband.`, expected: [{ category: 'name', value: 'Mary Smith' }] },
  { text: `Seen by Prof Alan Hughes in the respiratory clinic.`, expected: [{ category: 'name', value: 'Alan Hughes' }] },
  { text: `Date of birth 14/03/1962, no known allergies.`, expected: [{ category: 'date', value: '14/03/1962' }] },
  { text: `Lives at 22 Elm Road, Manchester M14 5GL.`, expected: [{ category: 'geographic', value: 'M14 5GL' }] },
  { text: `Patient resides at ZIP 90210 currently.`, expected: [{ category: 'geographic', value: '90210' }] },
  { text: `Contact number 0207 946 0958 is on file.`, expected: [{ category: 'phone', value: '0207 946 0958' }] },
  { text: `National Insurance number AB 12 34 56 C on record.`, expected: [{ category: 'nino', value: 'AB 12 34 56 C' }] },
  { text: `Patient portal at https://portal.example.com/u/4821 was accessed.`, expected: [{ category: 'url', value: 'https://portal.example.com/u/4821' }] },
  { text: `Session logged from 192.168.14.203 this morning.`, expected: [{ category: 'ip', value: '192.168.14.203' }] },
  { text: `Vehicle VIN 1HGCM82633A004352 recorded at intake.`, expected: [{ category: 'vehicle', value: '1HGCM82633A004352' }] },
  { text: `Chart MRN: A4821337 attached to the file.`, expected: [{ category: 'mrn', value: 'A4821337' }] },
  { text: `Policy number PN-9931827 on the claim.`, expected: [{ category: 'account', value: 'PN-9931827' }] },
];

// Still beyond deterministic reach — kept so recall never looks falsely solved.
const stillHardPositives: Sample[] = [
  // Rare given name absent from the gazetteer — only NER catches this.
  { text: `Seen by Dr. Xolani Mbeki on the ward round.`, expected: [{ category: 'name', value: 'Xolani Mbeki' }] },
];

// Distractors — look like PHI, must stay clean (precision test).
const distractors: Sample[] = [
  { text: 'Order reference 1234567890 was dispatched to the warehouse.', expected: [] },
  { text: 'Batch 123 456 7890 cleared quality control.', expected: [] },
  { text: 'Ticket code 000-12-3456 is still open.', expected: [] },
  { text: 'Reserved range 666-45-6789 is not a valid identifier.', expected: [] },
  { text: 'The dosage was 500 mg twice daily, titrated over 10 days.', expected: [] },
  { text: 'Vitals: BP 120/80, HR 72, SpO2 98% on room air.', expected: [] },
  { text: 'Discharged in stable condition with routine advice.', expected: [] },
  // FP tripwires for the name gazetteer.
  { text: 'Admitted to Rose Cottage care home for respite.', expected: [] },
  { text: 'Referred to Victoria Hospital outpatients department.', expected: [] },
  // Strips to "Mary Hospital" — the place guard must still reject it.
  { text: 'Follow-up at Sister Mary Hospital next month.', expected: [] },
  { text: 'The Grace Period on the account has now expired.', expected: [] },
];

const positives = [...easyPositives, ...hardPositives, ...stillHardPositives];
const dataset = [...positives, ...distractors];

// --- scoring ---------------------------------------------------------------

interface Stat { tp: number; fp: number; fn: number }

function score() {
  const stats = new Map<PHICategory, Stat>();
  const misses: Array<{ category: PHICategory; value: string; text: string }> = [];
  const bump = (cat: PHICategory, k: keyof Stat) => {
    const s = stats.get(cat) ?? { tp: 0, fp: 0, fn: 0 };
    s[k] += 1;
    stats.set(cat, s);
  };

  for (const sample of dataset) {
    const { matches } = detectPHI(sample.text);
    const expKeys = new Set(sample.expected.map((e) => `${e.category}:${norm(e.value)}`));
    const detKeys = new Set(matches.map((m) => `${m.category}:${norm(m.value)}`));

    for (const m of matches) {
      bump(m.category, expKeys.has(`${m.category}:${norm(m.value)}`) ? 'tp' : 'fp');
    }
    for (const e of sample.expected) {
      if (!detKeys.has(`${e.category}:${norm(e.value)}`)) {
        bump(e.category, 'fn');
        misses.push({ category: e.category, value: e.value, text: sample.text });
      }
    }
  }
  return { stats, misses };
}

function metrics(s: Stat) {
  const precision = s.tp + s.fp === 0 ? 1 : s.tp / (s.tp + s.fp);
  const recall = s.tp + s.fn === 0 ? 1 : s.tp / (s.tp + s.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

const overallOf = (stats: Map<PHICategory, Stat>) => {
  let tp = 0, fp = 0, fn = 0;
  for (const s of stats.values()) { tp += s.tp; fp += s.fp; fn += s.fn; }
  return { stat: { tp, fp, fn }, ...metrics({ tp, fp, fn }) };
};

// --- report + gate ---------------------------------------------------------

describe('synthetic PHI benchmark', () => {
  const { stats, misses } = score();
  const overall = overallOf(stats);

  it('prints an honest per-category precision/recall/F1 table', () => {
    const rows: Record<string, string> = {};
    for (const [cat, s] of [...stats.entries()].sort()) {
      const m = metrics(s);
      rows[cat] = `P ${m.precision.toFixed(2)}  R ${m.recall.toFixed(2)}  F1 ${m.f1.toFixed(2)}  (tp ${s.tp} fp ${s.fp} fn ${s.fn})`;
    }
    rows['OVERALL'] = `P ${overall.precision.toFixed(2)}  R ${overall.recall.toFixed(2)}  F1 ${overall.f1.toFixed(2)}  (tp ${overall.stat.tp} fp ${overall.stat.fp} fn ${overall.stat.fn})`;

    // eslint-disable-next-line no-console
    console.log(`\nphi-leak-guard benchmark — ${dataset.length} samples (${positives.length} positive, ${distractors.length} distractor)`);
    // eslint-disable-next-line no-console
    console.table(rows);
    if (misses.length) {
      // eslint-disable-next-line no-console
      console.log(`\nRECALL GAPS (${misses.length}) — the work-list:`);
      for (const m of misses) {
        // eslint-disable-next-line no-console
        console.log(`  [${m.category}] missed "${m.value}"  in: ${m.text}`);
      }
    }
    expect(dataset.length).toBeGreaterThan(0);
  });

  // INVARIANT: precision-first tool. A guard that cries wolf gets disabled.
  it('holds the zero-false-positive invariant', () => {
    expect(overall.stat.fp).toBe(0);
  });

  // RATCHET: lock in current recall so future changes can only improve it.
  it('does not regress overall recall below baseline', () => {
    expect(overall.recall).toBeGreaterThanOrEqual(BASELINE.overallRecall);
  });

  // DOCUMENTED CEILING: the remaining miss is a rare name absent from the
  // gazetteer — deterministic detection cannot close it; it needs the NER seam.
  it('shows names as the deterministic ceiling (recall < 1)', () => {
    expect(metrics(stats.get('name') ?? { tp: 0, fp: 0, fn: 0 }).recall).toBeLessThan(1);
  });
});

// Baseline measured on the current recognizer set. Ratchet upward as recall
// improves; never lower it to make a regression pass.
// History: 0.70 -> 0.76 -> 0.90 -> 0.97 (phone+ZIP)
//          -> 0.97 (added nino/url/ip/VIN/mrn/account)
//          -> current (honorific stripping). Adding the unpunctuated-title
//             cases dropped the OLD recognizer to name R 0.29 / overall R 0.88,
//             below this ratchet — the corpus had only ever tested "Dr." with a
//             full stop, which breaks the capitalised run by accident.
const BASELINE = {
  overallRecall: 0.97,
};
