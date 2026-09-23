import { describe, expect, it } from 'vitest';
import { areaDistribution, buildMix, buildReplay, formatDuration, scoreMock } from './mock';
import { mkQ } from './testutil';
import type { ExamInfo, Question } from './types';

const areasCycle = ['Financial Analysis', 'Financial Analysis', 'Economics', 'Business Law'];
const qs: Question[] = Array.from({ length: 400 }, (_, i) =>
  mkQ('q' + i, { instructionalArea: areasCycle[i % 4], correct: 'B' }),
);
const byId = new Map(qs.map((q) => [q.id, q]));
const exam = (id: string, ids: (string | null)[], dup?: string): ExamInfo => ({
  id,
  label: id,
  year: 2020,
  level: 'ICDC',
  file: id,
  questionIds: ids,
  duplicateOf: dup,
});
const e1 = exam('e1', qs.slice(0, 100).map((q) => q.id));
const e2 = exam('e2', qs.slice(100, 200).map((q) => q.id));
const eDup = exam('e3', qs.slice(0, 100).map((q) => q.id), 'e1');

describe('areaDistribution', () => {
  it('averages real exams (ignoring duplicate exams) and sums to 100', () => {
    const d = areaDistribution([e1, e2, eDup], byId);
    expect(Object.fromEntries(d)).toEqual({ 'Financial Analysis': 50, Economics: 25, 'Business Law': 25 });
  });
  it('uses largest remainder rounding', () => {
    const three = exam('x', [qs[0].id, qs[2].id, qs[3].id]); // FA, EC, BL -> 33.3 each
    const d = areaDistribution([three], byId, 100);
    expect([...d.values()].reduce((a, b) => a + b, 0)).toBe(100);
    expect([...d.values()].sort()).toEqual([33, 33, 34]);
  });
});

describe('buildMix', () => {
  it('builds 100 unique questions matching the distribution', () => {
    const d = areaDistribution([e1, e2], byId);
    const mix = buildMix(qs, d);
    expect(mix).toHaveLength(100);
    expect(new Set(mix.map((q) => q.id)).size).toBe(100);
    expect(mix.filter((q) => q.instructionalArea === 'Economics')).toHaveLength(25);
  });
  it('tops up from other areas when one runs short', () => {
    const d = new Map([
      ['Economics', 90],
      ['Business Law', 10],
    ]);
    const small = qs.slice(0, 40); // 10 Economics, 10 Business Law, 20 FA
    expect(buildMix(small, d)).toHaveLength(40);
  });
});

describe('buildReplay / scoreMock', () => {
  it('keeps original order and skips hidden or missing slots', () => {
    const e = exam('e', ['q1', null, 'q2', 'q3']);
    expect(buildReplay(e, new Set(['q1', 'q3']))).toEqual(['q1', 'q3']);
  });
  it('scores and breaks down by area', () => {
    const answers = [
      { qid: 'q0', choice: 'B' as const, flagged: false, ms: 1 },
      { qid: 'q1', choice: 'A' as const, flagged: false, ms: 1 },
      { qid: 'q2', choice: null, flagged: true, ms: 1 },
    ];
    const s = scoreMock(answers, byId);
    expect(s).toMatchObject({ score: 1, total: 3, answered: 2 });
    expect(s.byArea).toEqual([
      { area: 'Financial Analysis', correct: 1, total: 2 },
      { area: 'Economics', correct: 0, total: 1 },
    ]);
  });
  it('formats durations', () => {
    expect(formatDuration(61_000)).toBe('1:01');
    expect(formatDuration(3_600_000)).toBe('60:00');
  });
});
