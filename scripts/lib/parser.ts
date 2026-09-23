// Pure parsing logic: positioned PDF lines -> raw questions and answer-key entries.
// See docs/exam-format.md for the layouts this handles.
import type { Line, Page, Segment } from './types.ts';
import type { Letter } from '../../src/lib/types.ts';

export interface RawQuestion {
  number: number;
  /** Stem as blocks: wrapped text lines, or a table (lines with column-separated runs / odd indents). */
  stem: StemBlock[];
  options: Partial<Record<Letter, string[]>>;
  /** Option letters in the order they were seen. */
  optionOrder: Letter[];
  page: number;
  notes: string[];
}

export type StemBlock = { kind: 'text'; lines: string[] } | { kind: 'table'; rows: Segment[][] };

export interface KeyEntry {
  number: number;
  correct: Letter;
  explanationLines: string[];
  piCode?: string;
  piDescriptionLines: string[];
  referenceLines: string[];
  sourceCount: number;
  page: number;
  notes: string[];
}

export interface ParsedExam {
  questions: RawQuestion[];
  keys: KeyEntry[];
  problems: string[];
}

const HEADER_RE =
  /^(?:\d{4} HS ICDC|Test \d{3,4}|SAMPLE)?\s*FINANCE (?:CLUSTER )?EXAM(?:\s*—\s*KEY)?(?:\s+\d{1,3})?$/i;
const COPYRIGHT_RE = /^Copyright ©/;
const QUESTION_START_RE = /^(\d{1,3})\.\s*(.*)$/;
const KEY_START_RE = /^(\d{1,3})\.\s+([A-D])$/;
const OPTION_RE = /^([A-D])\.\s*(.*)$/;
const SOURCE_RE = /^SOURCE:\s*(.*)$/;
const PI_RE = /^([A-Z]{2,3})\s?:\s?(\d{3})\b\s*[-–—:]?\s*(.*)$/;

/** Returns true for running headers, footers, lone page numbers and stray ® marks. */
export function isBoilerplate(line: Line, page: Page): boolean {
  const text = line.segments.map((s) => s.text).join(' ').trim();
  if (HEADER_RE.test(text)) return true;
  if (COPYRIGHT_RE.test(text)) return true;
  if (text === '®') return true;
  if (/^\d{1,3}$/.test(text) && line.y < 72) return true; // page number in the bottom margin
  if (/^\d{1,3}$/.test(text) && line.y > page.height - 60) return true; // page number in the top margin
  return false;
}

/** Joins wrapped lines into one paragraph, keeping hyphenated/em-dashed words together. */
export function joinLines(lines: string[]): string {
  let out = '';
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (!out) out = l;
    else if (/[—/]$/.test(out) || (/\w-$/.test(out) && !/^(and|or|to)\b/.test(l))) out += l;
    else out += ' ' + l;
  }
  return out.replace(/\s+/g, ' ').trim();
}

type State = 'pre' | 'questions' | 'afterLast' | 'key';

export function parsePages(pages: Page[], expected = 100): ParsedExam {
  const questions: RawQuestion[] = [];
  const keys: KeyEntry[] = [];
  const problems: string[] = [];
  let state: State = 'pre';
  let q: RawQuestion | null = null;
  let k: KeyEntry | null = null;
  let optionX: number | null = null; // x of left-column option markers, learned from the exam
  let questionX: number | null = null;
  let lastLeft: Letter | null = null;
  let lastRight: Letter | null = null;
  let sourceX = 0;
  let pageOfLastD = -1;

  for (const page of pages) {
    const midX = page.width * 0.45;
    for (const line of page.lines) {
      if (isBoilerplate(line, page)) continue;
      const segs = line.segments;
      const first = segs[0];
      const text = segs.map((s) => s.text).join(' ');

      // --- the answer key starts at the first "1. B" line
      const km = segs.length === 1 ? KEY_START_RE.exec(first.text) : null;
      if (km && state !== 'key' && Number(km[1]) === 1) {
        state = 'key';
        q = null;
      }

      if (state === 'key') {
        if (km && Number(km[1]) === keys.length + 1) {
          k = {
            number: Number(km[1]),
            correct: km[2] as Letter,
            explanationLines: [],
            piDescriptionLines: [],
            referenceLines: [],
            sourceCount: 0,
            page: page.number,
            notes: [],
          };
          keys.push(k);
          continue;
        }
        if (!k) continue;
        if (keys.length >= expected && k.sourceCount >= 2 && page.number > k.page + 1) continue;
        const sm = SOURCE_RE.exec(text);
        if (sm) {
          k.sourceCount++;
          if (k.sourceCount === 1) {
            sourceX = first.x;
            const pm = PI_RE.exec(sm[1].trim());
            if (pm) {
              k.piCode = `${pm[1]}:${pm[2]}`;
              if (pm[3]) k.piDescriptionLines.push(pm[3]);
            } else {
              k.notes.push(`first SOURCE line has no PI code: "${sm[1]}"`);
              k.referenceLines.push(sm[1]);
            }
          } else {
            if (k.referenceLines.length) k.referenceLines.push('\n');
            k.referenceLines.push(sm[1]);
          }
          continue;
        }
        if (k.sourceCount === 0) k.explanationLines.push(text);
        else if (k.sourceCount === 1 && k.piCode && first.x > sourceX + 10 && k.piDescriptionLines.length)
          k.piDescriptionLines.push(text);
        else if (k.sourceCount === 1 && !k.referenceLines.length) {
          k.notes.push(`unexpected text after PI line: "${text}"`);
          k.explanationLines.push(text);
        } else k.referenceLines.push(text);
        continue;
      }

      if (state === 'afterLast') {
        // Nothing after the last question's options until the key begins (key cover pages, etc.)
        if (page.number !== pageOfLastD) continue;
      }

      // --- question start
      const qm = QUESTION_START_RE.exec(first.text);
      const nextNum = questions.length + 1;
      if (
        qm &&
        Number(qm[1]) === nextNum &&
        (questionX === null || first.x < questionX + 12) &&
        (optionX === null || first.x < optionX)
      ) {
        if (questionX === null) questionX = first.x;
        q = {
          number: nextNum,
          stem: [],
          options: {},
          optionOrder: [],
          page: page.number,
          notes: [],
        };
        questions.push(q);
        state = 'questions';
        lastLeft = lastRight = null;
        const rest = [qm[2], ...segs.slice(1).map((s) => s.text)].filter(Boolean);
        if (rest.length) pushStemText(q, rest.join(' '));
        continue;
      }
      if (state === 'pre' || !q) continue;

      // --- option markers (possibly two on one line: A./C. or B./D.)
      const optionSegs = segs.filter((s) => isOptionMarker(s, optionX, midX));
      if (optionSegs.length && isOptionMarker(first, optionX, midX)) {
        for (const s of segs) {
          const om = isOptionMarker(s, optionX, midX) ? OPTION_RE.exec(s.text) : null;
          if (om) {
            const letter = om[1] as Letter;
            if (optionX === null && s.x < midX) optionX = s.x;
            if (q.options[letter]) q.notes.push(`option ${letter} appears twice`);
            q.options[letter] = om[2] ? [om[2]] : [];
            q.optionOrder.push(letter);
            if (s.x >= midX) lastRight = letter;
            else lastLeft = letter;
            if (letter === 'D') pageOfLastD = page.number;
          } else {
            appendToOption(q, s.x >= midX ? lastRight : lastLeft, s.text);
          }
        }
        if (q.number === expected && q.options.D) state = 'afterLast';
        continue;
      }

      // --- continuation lines
      if (q.optionOrder.length === 0) {
        // Stem text wraps at a fixed indent; tables use several runs per line or unusual indents.
        const tableLike = segs.length >= 2 || first.x >= (questionX ?? 0) + 22;
        const last = q.stem[q.stem.length - 1];
        if (tableLike) {
          if (last?.kind === 'table') last.rows.push(segs);
          else q.stem.push({ kind: 'table', rows: [segs] });
        } else pushStemText(q, text);
        continue;
      }
      for (const s of segs) appendToOption(q, s.x >= midX ? lastRight : lastLeft, s.text);
    }
  }

  if (questions.length !== expected) problems.push(`found ${questions.length} questions (expected ${expected})`);
  if (keys.length !== expected) problems.push(`found ${keys.length} answer-key entries (expected ${expected})`);
  return { questions, keys, problems };
}

function pushStemText(q: RawQuestion, text: string) {
  const last = q.stem[q.stem.length - 1];
  if (last?.kind === 'text') last.lines.push(text);
  else q.stem.push({ kind: 'text', lines: [text] });
}

/**
 * Lays table rows onto columns. The row with the most runs defines the column anchors;
 * every other run goes to the nearest anchor. A single-run row after the first row is a
 * wrapped cell, so it is appended to the cell above.
 */
export function layoutTable(rows: Segment[][]): string[][] {
  const anchorRow = rows.reduce((a, b) => (b.length > a.length ? b : a), rows[0]);
  const anchors = anchorRow.map((s) => s.x);
  const out: string[][] = [];
  for (const row of rows) {
    const cells: string[] = anchors.map(() => '');
    const colOf = (x: number) =>
      anchors.reduce((best, a, i) => (Math.abs(a - x) < Math.abs(anchors[best] - x) ? i : best), 0);
    if (row.length === 1 && out.length && anchors.length > 1) {
      const c = colOf(row[0].x);
      out[out.length - 1][c] = (out[out.length - 1][c] + ' ' + row[0].text).trim();
      continue;
    }
    for (const s of row) {
      const c = colOf(s.x);
      cells[c] = (cells[c] + ' ' + s.text).trim();
    }
    out.push(cells);
  }
  return out;
}

function isOptionMarker(s: Segment, optionX: number | null, midX: number): boolean {
  if (!OPTION_RE.test(s.text)) return false;
  if (optionX === null) return true;
  if (s.x >= midX) return /^[CD]\./.test(s.text);
  return Math.abs(s.x - optionX) <= 6;
}

function appendToOption(q: RawQuestion, letter: Letter | null, text: string) {
  if (!letter) {
    q.notes.push(`text with no option to attach to: "${text}"`);
    return;
  }
  (q.options[letter] ??= []).push(text);
}
