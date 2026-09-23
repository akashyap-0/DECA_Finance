import { describe, expect, it } from 'vitest';
import { mkQ } from './testutil';
import { buildContext, dueReviews, pickSmart, questionWeight } from './smart';
import { DAY_MS, groupStats, questionStats, srsState, streakDays, weakestPis } from './stats';
import type { Attempt } from './storage';

const T0 = new Date('2026-09-01T12:00:00').getTime();
const att = (qid: string, correct: boolean, ts: number): Attempt => ({
  qid,
  choice: correct ? 'A' : 'B',
  correct,
  ts,
  ms: 1000,
  mode: 'smart',
});

describe('spaced repetition', () => {
  it('schedules a missed question at 1, 3, then 7 days, then graduates it', () => {
    let a = [att('q', false, T0)];
    expect(srsState(questionStats(a).get('q')!)).toMatchObject({ stage: 0, dueAt: T0 + DAY_MS });
    a = [...a, att('q', true, T0 + DAY_MS)];
    expect(srsState(questionStats(a).get('q')!)).toMatchObject({ stage: 1, dueAt: T0 + 4 * DAY_MS });
    a = [...a, att('q', true, T0 + 4 * DAY_MS)];
    expect(srsState(questionStats(a).get('q')!)).toMatchObject({ stage: 2, dueAt: T0 + 11 * DAY_MS });
    a = [...a, att('q', true, T0 + 11 * DAY_MS)];
    expect(srsState(questionStats(a).get('q')!)!.graduated).toBe(true);
  });
  it('restarts the schedule on another miss', () => {
    const a = [att('q', false, T0), att('q', true, T0 + DAY_MS), att('q', false, T0 + 2 * DAY_MS)];
    expect(srsState(questionStats(a).get('q')!)).toMatchObject({ stage: 0, dueAt: T0 + 3 * DAY_MS });
  });
  it('never schedules questions that were never missed', () => {
    expect(srsState(questionStats([att('q', true, T0)]).get('q')!)).toBeNull();
  });
});

describe('pickSmart', () => {
  const qs = [
    mkQ('fi1'),
    mkQ('fi2'),
    mkQ('fi3'),
    mkQ('ec1', { instructionalArea: 'Economics', piCode: 'EC:001' }),
    mkQ('ec2', { instructionalArea: 'Economics', piCode: 'EC:001' }),
  ];

  it('serves due reviews first, most overdue first', () => {
    const a = [att('fi2', false, T0), att('fi1', false, T0 + 1000)];
    const now = T0 + 2 * DAY_MS;
    expect(dueReviews(qs, questionStats(a), now).map((q) => q.id)).toEqual(['fi2', 'fi1']);
    const pick = pickSmart(qs, a, { now, rng: () => 0.5 })!;
    expect(pick).toMatchObject({ reason: 'review' });
    expect(pick.question.id).toBe('fi2');
  });

  it('holds back missed questions until they are due', () => {
    const a = [att('fi1', false, T0)];
    const ctx = buildContext(qs, a);
    expect(questionWeight(qs[0], ctx, T0 + 1000)).toBe(0);
    expect(questionWeight(qs[0], ctx, T0 + DAY_MS + 1)).toBeGreaterThan(0);
  });

  it('weights the weakest area higher and unseen above already-correct', () => {
    // Economics: 0/3, Financial Analysis: 3/3
    const a = [
      att('ec1', false, T0 - 30 * DAY_MS),
      att('ec1', true, T0 - 29 * DAY_MS),
      att('ec1', true, T0 - 28 * DAY_MS),
      att('ec1', true, T0 - 27 * DAY_MS), // ec1 graduated
      att('ec2', false, T0 - 30 * DAY_MS),
      att('ec2', true, T0 - 29 * DAY_MS),
      att('ec2', true, T0 - 28 * DAY_MS),
      att('ec2', true, T0 - 27 * DAY_MS),
      att('fi1', true, T0 - 30 * DAY_MS),
    ];
    const extra = [mkQ('ec3', { instructionalArea: 'Economics', piCode: 'EC:002' })];
    const all = [...qs, ...extra];
    const ctx = buildContext(all, a);
    const w = (id: string) => questionWeight(all.find((q) => q.id === id)!, ctx, T0);
    expect(w('ec3')).toBeGreaterThan(w('fi2')); // unseen, weak area > unseen, strong area
    expect(w('fi2')).toBeGreaterThan(w('fi1')); // unseen > already correct
  });

  it('skips questions already shown this session', () => {
    const pick = pickSmart(qs, [], { exclude: new Set(['fi1', 'fi2', 'fi3', 'ec1']), rng: () => 0.99 })!;
    expect(pick.question.id).toBe('ec2');
    expect(pick.reason).toBe('new');
  });

  it('is well distributed with no history', () => {
    const counts = new Map<string, number>();
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const id = pickSmart(qs, [], { rng })!.question.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const q of qs) expect(counts.get(q.id)!).toBeGreaterThan(300);
  });
});

describe('streakDays', () => {
  const day = (n: number) => T0 + n * DAY_MS;
  const many = (ts: number, n: number) => Array.from({ length: n }, (_, i) => att('q' + i, true, ts + i));
  it('counts consecutive goal days ending today', () => {
    const a = [...many(day(-2), 3), ...many(day(-1), 3), ...many(day(0), 3)];
    expect(streakDays(a, 3, day(0))).toBe(3);
  });
  it('does not break before today is over', () => {
    const a = [...many(day(-2), 3), ...many(day(-1), 3), ...many(day(0), 1)];
    expect(streakDays(a, 3, day(0))).toBe(2);
  });
  it('breaks on a missed day', () => {
    const a = [...many(day(-3), 3), ...many(day(-1), 2), ...many(day(0), 3)];
    expect(streakDays(a, 3, day(0))).toBe(1);
  });
});

describe('weakestPis', () => {
  it('ranks PIs with 2+ attempts and at least one miss, lowest accuracy first', () => {
    const qs = [mkQ('a', { piCode: 'FI:001' }), mkQ('b', { piCode: 'FI:002' }), mkQ('c', { piCode: 'FI:003' })];
    const a = [
      att('a', false, 1), att('a', false, 2), att('a', true, 3), // 1/3
      att('b', true, 1), att('b', true, 2), // never missed -> excluded
      att('c', false, 1), // only 1 attempt -> excluded
    ];
    const pis = groupStats(qs, a, (q) => q.piCode);
    expect(weakestPis(pis).map((g) => g.key)).toEqual(['FI:001']);
  });
});
