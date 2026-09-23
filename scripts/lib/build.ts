// Turns parsed exams into validated, deduplicated Question records.
import type { ExamInfo, ExamLevel, Letter, Question } from '../../src/lib/types.ts';
import { LETTERS } from '../../src/lib/types.ts';
import type { ParsedExam, RawQuestion } from './parser.ts';
import { joinLines, layoutTable } from './parser.ts';
import type { Page } from './types.ts';

export interface ExamMeta {
  id: string;
  label: string;
  year: number;
  level: ExamLevel;
  testNumber?: string;
  file: string;
}

export type MetaOverride = Partial<Pick<ExamMeta, 'id' | 'label' | 'year' | 'level' | 'testNumber'>>;

export function detectMeta(pages: Page[], file: string, override: MetaOverride = {}): ExamMeta {
  const pageText = (p: Page) => p.lines.map((l) => l.segments.map((s) => s.text).join(' ')).join('\n');
  const cover = pages.slice(0, 2).map(pageText).join('\n');
  const all = pages.map(pageText).join('\n');
  const icdc = /(\d{4}) HS ICDC/.exec(cover);
  const test = /Test (?:Number )?(\d{4})/.exec(cover);
  const fileYear = /^(\d{4})[_ -]/.exec(file);
  const copyright = /Copyright © (\d{4})/.exec(all);
  let level: ExamLevel = 'Sample';
  if (icdc) level = 'ICDC';
  else if (/State\/Province Use/i.test(cover)) level = 'State';
  else if (/District\/Regional Use/i.test(cover) || /district/i.test(file)) level = 'District';
  const year = Number(icdc?.[1] ?? fileYear?.[1] ?? copyright?.[1] ?? 0);
  const testNumber = test?.[1];
  const meta: ExamMeta = {
    id: `${year}-${level.toLowerCase()}${testNumber ? '-' + testNumber : ''}`,
    label: `${year} ${level}${testNumber ? ` · Test ${testNumber}` : ''}`,
    year,
    level,
    testNumber,
    file,
  };
  return { ...meta, ...override };
}

/** Lowercase, straight quotes, alphanumerics only: used for comparing text. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9$%]+/g, '');
}

/**
 * Stem as display text. Tables become lines of the form "| a | b | c |" (one per row),
 * which the app renders as an HTML table.
 */
export function stemText(r: RawQuestion): string {
  return r.stem
    .map((b) =>
      b.kind === 'text'
        ? joinLines(b.lines)
        : layoutTable(b.rows)
            .map((row) => '| ' + row.join(' | ') + ' |')
            .join('\n'),
    )
    .filter(Boolean)
    .join('\n');
}

export interface BuildResult {
  questions: Question[];
  problems: string[];
  rationaleMismatches: number;
}

/** Joins question text with its key entry and validates. Never fills in missing content. */
export function buildExamQuestions(
  parsed: ParsedExam,
  meta: ExamMeta,
  areas: Record<string, string>,
): BuildResult {
  const problems = [...parsed.problems];
  const questions: Question[] = [];
  let rationaleMismatches = 0;
  const keyByNum = new Map(parsed.keys.map((k) => [k.number, k]));
  for (const r of parsed.questions) {
    const notes = [...r.notes];
    const key = keyByNum.get(r.number);
    const options = {} as Record<Letter, string>;
    for (const L of LETTERS) options[L] = joinLines(r.options[L] ?? []);
    const question = stemText(r);
    if (!question) notes.push('empty question text');
    for (const L of LETTERS) if (!options[L]) notes.push(`option ${L} is missing or empty`);
    const order = r.optionOrder.join('');
    if (!['ABCD', 'ACBD'].includes(order)) notes.push(`unexpected option order ${order || '(none)'}`);
    for (const L of LETTERS) {
      if (/\b(SOURCE:|Copyright ©)/.test(options[L])) notes.push(`option ${L} contains boilerplate text`);
      if (/\s[A-D]\.\s+[A-Z]/.test(options[L]) && !/\b[A-Z]\.\s+[A-Z][a-z]+,/.test(options[L]))
        notes.push(`option ${L} may contain another option marker: "${options[L]}"`);
    }
    for (const b of r.stem) {
      if (b.kind !== 'table') continue;
      const cols = Math.max(...b.rows.map((row) => row.length));
      if (cols < 3) notes.push(`stem has a table whose columns could not be recovered (${b.rows.length} rows, ${cols} columns)`);
      else notes.push(`stem contains a ${b.rows.length}-row table (check it renders correctly)`);
    }
    let explanation = '';
    let piCode = '';
    let piDescription = '';
    let reference: string | undefined;
    let correct: Letter = 'A';
    if (!key) notes.push('no answer-key entry');
    else {
      notes.push(...key.notes);
      correct = key.correct;
      explanation = joinLines(key.explanationLines);
      piCode = key.piCode ?? '';
      piDescription = joinLines(key.piDescriptionLines);
      const refs: string[][] = [[]];
      for (const l of key.referenceLines) {
        if (l === '\n') refs.push([]);
        else refs[refs.length - 1].push(l);
      }
      reference = refs.map(joinLines).filter(Boolean).join(' / ') || undefined;
      if (!explanation) notes.push('empty explanation');
      if (!piCode) notes.push('no PI code');
      // Consistency check: rationales restate the correct option first.
      const ex = normalize(explanation);
      const matches = LETTERS.filter((L) => {
        const o = normalize(options[L]);
        return o.length > 0 && (ex.startsWith(o) || ex.startsWith(o.replace(/^(a|an|the)(?=[a-z])/, '')));
      });
      if (matches.length && !matches.includes(correct)) {
        rationaleMismatches++;
        notes.push(`rationale restates option ${matches.join('/')} but key says ${correct}`);
      } else if (!matches.length && explanation) {
        notes.push(`info: rationale does not start with the correct option's text (source wording differs)`);
      }
    }
    const prefix = piCode.split(':')[0];
    const instructionalArea = areas[prefix] ?? 'Unknown';
    if (piCode && !areas[prefix]) notes.push(`unknown PI prefix ${prefix}`);
    const hard = notes.filter((n) => !n.startsWith('stem contains a') && !n.startsWith('info:'));
    questions.push({
      id: `${meta.id}-${r.number}`,
      exam: meta.id,
      number: r.number,
      question,
      options,
      correct,
      explanation,
      piCode,
      piDescription,
      instructionalArea,
      reference,
      appearances: [{ exam: meta.id, number: r.number }],
      needsReview: hard.length > 0,
      reviewNotes: notes,
    });
  }
  const nums = new Set(parsed.questions.map((q) => q.number));
  for (const k of parsed.keys) if (!nums.has(k.number)) problems.push(`key entry ${k.number} has no question`);
  return { questions, problems, rationaleMismatches };
}

export function dedupeKey(q: Question): string {
  return normalize(q.question) + '|' + LETTERS.map((L) => normalize(q.options[L])).sort().join('|');
}

export interface DedupeResult {
  questions: Question[];
  /** exam id -> ordered canonical question ids */
  examOrder: Map<string, (string | null)[]>;
  duplicates: { kept: string; dropped: string }[];
  conflicts: string[];
}

/** Collapses identical questions (same stem + same option set) into one record. */
export function dedupe(perExam: { meta: ExamMeta; questions: Question[] }[]): DedupeResult {
  const byKey = new Map<string, Question>();
  const out: Question[] = [];
  const examOrder = new Map<string, (string | null)[]>();
  const duplicates: { kept: string; dropped: string }[] = [];
  const conflicts: string[] = [];
  for (const { meta, questions } of perExam) {
    const order: (string | null)[] = Array(100).fill(null);
    for (const q of questions) {
      const key = dedupeKey(q);
      const existing = byKey.get(key);
      if (existing && !q.needsReview && !existing.needsReview) {
        existing.appearances.push({ exam: q.exam, number: q.number });
        duplicates.push({ kept: existing.id, dropped: q.id });
        if (normalize(existing.options[existing.correct]) !== normalize(q.options[q.correct]))
          conflicts.push(
            `${existing.id} vs ${q.id}: same question, different correct answers ("${existing.options[existing.correct]}" vs "${q.options[q.correct]}")`,
          );
        // Prefer the printed PI description where the first copy had none.
        if (!existing.piDescription && q.piDescription) existing.piDescription = q.piDescription;
        if (existing.piCode !== q.piCode) existing.reviewNotes.push(`also tagged ${q.piCode} in ${q.exam}`);
        order[q.number - 1] = existing.id;
        continue;
      }
      if (!q.needsReview) byKey.set(key, q);
      out.push(q);
      if (q.number >= 1 && q.number <= 100) order[q.number - 1] = q.id;
    }
    examOrder.set(meta.id, order);
  }
  for (const c of conflicts) {
    const id = c.split(' ')[0];
    const q = out.find((x) => x.id === id);
    if (q) {
      q.needsReview = true;
      q.reviewNotes.push(c);
    }
  }
  return { questions: out, examOrder, duplicates, conflicts };
}

/** Fills missing PI descriptions from other exams that printed a description for the same code. */
export function fillPiDescriptions(questions: Question[]): number {
  const catalog = new Map<string, { desc: string; exam: string; count: number }[]>();
  for (const q of questions) {
    if (!q.piCode || !q.piDescription || q.piDescriptionFrom) continue;
    const list = catalog.get(q.piCode) ?? [];
    const hit = list.find((e) => e.desc === q.piDescription);
    if (hit) hit.count++;
    else list.push({ desc: q.piDescription, exam: q.exam, count: 1 });
    catalog.set(q.piCode, list);
  }
  let filled = 0;
  for (const q of questions) {
    if (q.piDescription || !q.piCode) continue;
    const list = catalog.get(q.piCode);
    if (!list) continue;
    const best = [...list].sort((a, b) => b.count - a.count)[0];
    q.piDescription = best.desc;
    q.piDescriptionFrom = best.exam;
    filled++;
  }
  return filled;
}

export function examInfo(meta: ExamMeta, order: (string | null)[]): ExamInfo {
  return { ...meta, questionIds: order };
}
