// Pure statistics over attempts. No React, no storage.
import type { Attempt } from './storage';
import type { Question } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Spaced-repetition intervals after a miss: 1 day, then 3, then 7. */
export const SRS_INTERVALS_DAYS = [1, 3, 7];

export interface QStat {
  attempts: number;
  correct: number;
  lastTs: number;
  lastCorrect: boolean;
  everMissed: boolean;
  /** Correct answers in a row since the most recent miss (0 right after a miss). */
  correctSinceMiss: number;
}

export function questionStats(attempts: Attempt[]): Map<string, QStat> {
  const m = new Map<string, QStat>();
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  for (const a of sorted) {
    let s = m.get(a.qid);
    if (!s) {
      s = { attempts: 0, correct: 0, lastTs: 0, lastCorrect: false, everMissed: false, correctSinceMiss: 0 };
      m.set(a.qid, s);
    }
    s.attempts++;
    if (a.correct) {
      s.correct++;
      s.correctSinceMiss++;
    } else {
      s.everMissed = true;
      s.correctSinceMiss = 0;
    }
    s.lastTs = a.ts;
    s.lastCorrect = a.correct;
  }
  return m;
}

export interface SrsState {
  /** Index into SRS_INTERVALS_DAYS; >= length means graduated (no longer reviewed). */
  stage: number;
  dueAt: number;
  graduated: boolean;
}

/** Review schedule for a question that has been missed at least once. */
export function srsState(s: QStat): SrsState | null {
  if (!s.everMissed) return null;
  const stage = s.correctSinceMiss;
  if (stage >= SRS_INTERVALS_DAYS.length) return { stage, dueAt: Infinity, graduated: true };
  return { stage, dueAt: s.lastTs + SRS_INTERVALS_DAYS[stage] * DAY_MS, graduated: false };
}

export interface GroupStat {
  key: string;
  attempts: number;
  correct: number;
  /** Raw accuracy 0..1, or null when never attempted. */
  accuracy: number | null;
  questions: number;
  seen: number;
}

/** Accuracy grouped by an arbitrary key of the question (instructional area, PI code, …). */
export function groupStats(
  questions: Question[],
  attempts: Attempt[],
  keyOf: (q: Question) => string,
): Map<string, GroupStat> {
  const qById = new Map(questions.map((q) => [q.id, q]));
  const m = new Map<string, GroupStat>();
  const get = (key: string) => {
    let g = m.get(key);
    if (!g) m.set(key, (g = { key, attempts: 0, correct: 0, accuracy: null, questions: 0, seen: 0 }));
    return g;
  };
  for (const q of questions) get(keyOf(q)).questions++;
  const seen = new Set<string>();
  for (const a of attempts) {
    const q = qById.get(a.qid);
    if (!q) continue;
    const g = get(keyOf(q));
    g.attempts++;
    if (a.correct) g.correct++;
    if (!seen.has(a.qid)) {
      seen.add(a.qid);
      g.seen++;
    }
  }
  for (const g of m.values()) g.accuracy = g.attempts ? g.correct / g.attempts : null;
  return m;
}

/** Smoothed accuracy (Laplace prior toward 50%) so a single attempt doesn't dominate. */
export function smoothedAccuracy(g: Pick<GroupStat, 'attempts' | 'correct'> | undefined): number {
  if (!g) return 0.5;
  return (g.correct + 1) / (g.attempts + 2);
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function answersPerDay(attempts: Attempt[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of attempts) m.set(dayKey(a.ts), (m.get(dayKey(a.ts)) ?? 0) + 1);
  return m;
}

export function answeredToday(attempts: Attempt[], now = Date.now()): number {
  const today = dayKey(now);
  return attempts.filter((a) => dayKey(a.ts) === today).length;
}

/**
 * Consecutive days (ending today) on which the daily goal was met. If today's goal
 * isn't met yet the streak still counts through yesterday, so it only breaks after a missed day.
 */
export function streakDays(attempts: Attempt[], goal: number, now = Date.now()): number {
  const perDay = answersPerDay(attempts);
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  let streak = 0;
  if ((perDay.get(dayKey(d.getTime())) ?? 0) >= goal) streak++;
  for (;;) {
    d.setDate(d.getDate() - 1);
    if ((perDay.get(dayKey(d.getTime())) ?? 0) >= goal) streak++;
    else break;
  }
  return streak;
}

export function overall(attempts: Attempt[]) {
  const correct = attempts.filter((a) => a.correct).length;
  return { answered: attempts.length, correct, accuracy: attempts.length ? correct / attempts.length : null };
}
