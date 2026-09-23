import { describe, expect, it } from 'vitest';
import { filterPool, NO_FILTERS, pickRandom } from './practice';
import { questionStats } from './stats';
import type { Question } from './types';
import { mkQ } from './testutil';

const qs = [
  mkQ('a'),
  mkQ('b', { instructionalArea: 'Economics', piCode: 'EC:001' }),
  mkQ('c', { appearances: [{ exam: 'e1', number: 3 }, { exam: 'e2', number: 9 }] }),
];
const attempts = [
  { qid: 'a', choice: 'B' as const, correct: false, ts: 1, ms: 1, mode: 'practice' as const },
  { qid: 'b', choice: 'A' as const, correct: true, ts: 2, ms: 1, mode: 'practice' as const },
];
const stats = questionStats(attempts);
const ids = (x: Question[]) => x.map((q) => q.id);

describe('filterPool', () => {
  it('filters by area, exam (any appearance) and PI', () => {
    expect(ids(filterPool(qs, { ...NO_FILTERS, areas: ['Economics'] }, stats, []))).toEqual(['b']);
    expect(ids(filterPool(qs, { ...NO_FILTERS, exams: ['e2'] }, stats, []))).toEqual(['c']);
    expect(ids(filterPool(qs, { ...NO_FILTERS, piCodes: ['EC:001'] }, stats, []))).toEqual(['b']);
  });
  it('filters missed, unseen and bookmarked', () => {
    expect(ids(filterPool(qs, { ...NO_FILTERS, missedOnly: true }, stats, []))).toEqual(['a']);
    expect(ids(filterPool(qs, { ...NO_FILTERS, unseenOnly: true }, stats, []))).toEqual(['c']);
    expect(ids(filterPool(qs, { ...NO_FILTERS, bookmarkedOnly: true }, stats, ['b']))).toEqual(['b']);
  });
});

describe('pickRandom', () => {
  it('prefers questions not yet shown and cycles when all were shown', () => {
    expect(pickRandom(qs, new Set(['a', 'b']))!.id).toBe('c');
    expect(pickRandom(qs, new Set(['a', 'b', 'c']), () => 0)!.id).toBe('a');
    expect(pickRandom([], new Set())).toBeNull();
  });
});
