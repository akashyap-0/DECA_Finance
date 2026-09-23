// Sanity checks on the committed question bank (data/questions.json).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QuestionBank } from '../src/lib/types.ts';

const bank: QuestionBank = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '..', 'data', 'questions.json'), 'utf8'),
);

describe('data/questions.json', () => {
  it('has 100 question slots for every exam', () => {
    for (const e of bank.exams) expect(e.questionIds, e.id).toHaveLength(100);
  });
  it('every exam slot points at an existing question', () => {
    const ids = new Set(bank.questions.map((q) => q.id));
    for (const e of bank.exams) for (const id of e.questionIds) if (id) expect(ids.has(id), `${e.id} -> ${id}`).toBe(true);
  });
  it('every usable question is complete', () => {
    for (const q of bank.questions.filter((q) => !q.needsReview)) {
      expect(q.question, q.id).not.toBe('');
      for (const L of ['A', 'B', 'C', 'D'] as const) expect(q.options[L], `${q.id} ${L}`).not.toBe('');
      expect(['A', 'B', 'C', 'D']).toContain(q.correct);
      expect(q.explanation, q.id).not.toBe('');
      expect(q.piCode, q.id).toMatch(/^[A-Z]{2,3}:\d{3}$/);
      expect(q.instructionalArea, q.id).not.toBe('Unknown');
    }
  });
  it('ids are unique', () => {
    expect(new Set(bank.questions.map((q) => q.id)).size).toBe(bank.questions.length);
  });
});
