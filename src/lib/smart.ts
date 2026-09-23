// Smart mode: picks the next question.
// 1. Missed questions that are due for review (spaced repetition: 1, 3, then 7 days after a miss).
// 2. Otherwise a weighted random pick that favours the weakest instructional areas and PIs,
//    and favours unseen questions over ones already answered correctly.
import type { Attempt } from './storage';
import { groupStats, questionStats, smoothedAccuracy, srsState, type GroupStat, type QStat } from './stats';
import type { Question } from './types';

export type SmartReason = 'review' | 'weak' | 'new' | 'refresh';

export interface SmartPick {
  question: Question;
  reason: SmartReason;
  detail: string;
}

export interface SmartContext {
  stats: Map<string, QStat>;
  areaStats: Map<string, GroupStat>;
  piStats: Map<string, GroupStat>;
}

export function buildContext(questions: Question[], attempts: Attempt[]): SmartContext {
  return {
    stats: questionStats(attempts),
    areaStats: groupStats(questions, attempts, (q) => q.instructionalArea),
    piStats: groupStats(questions, attempts, (q) => q.piCode),
  };
}

/** Missed questions whose review is due, most overdue first. */
export function dueReviews(questions: Question[], stats: Map<string, QStat>, now: number): Question[] {
  return questions
    .map((q) => ({ q, srs: stats.has(q.id) ? srsState(stats.get(q.id)!) : null }))
    .filter((x) => x.srs && !x.srs.graduated && x.srs.dueAt <= now)
    .sort((a, b) => a.srs!.dueAt - b.srs!.dueAt)
    .map((x) => x.q);
}

/** Missed questions still in the review cycle (due now or later). */
export function reviewQueueSize(questions: Question[], stats: Map<string, QStat>): number {
  return questions.filter((q) => {
    const s = stats.get(q.id);
    const srs = s && srsState(s);
    return srs && !srs.graduated;
  }).length;
}

/** Weight for the weighted pick. Exported for tests. */
export function questionWeight(q: Question, ctx: SmartContext, now: number): number {
  const s = ctx.stats.get(q.id);
  if (s) {
    const srs = srsState(s);
    // Missed and scheduled for later: wait for its review date.
    if (srs && !srs.graduated && srs.dueAt > now) return 0;
  }
  const weakArea = 1 - smoothedAccuracy(ctx.areaStats.get(q.instructionalArea));
  const weakPi = 1 - smoothedAccuracy(ctx.piStats.get(q.piCode));
  const weakness = 1 + 3 * weakArea + 3 * weakPi; // 1..7, 4 with no data
  const base = s ? 0.15 : 1; // already answered correctly (or graduated) -> rarely repeat
  return base * weakness * weakness;
}

export function pickSmart(
  questions: Question[],
  attempts: Attempt[],
  opts: { now?: number; exclude?: Set<string>; rng?: () => number; ctx?: SmartContext } = {},
): SmartPick | null {
  const now = opts.now ?? Date.now();
  const exclude = opts.exclude ?? new Set<string>();
  const rng = opts.rng ?? Math.random;
  const ctx = opts.ctx ?? buildContext(questions, attempts);
  if (!questions.length) return null;

  const due = dueReviews(questions, ctx.stats, now).filter((q) => !exclude.has(q.id));
  if (due.length) {
    const q = due[0];
    const s = ctx.stats.get(q.id)!;
    return {
      question: q,
      reason: 'review',
      detail: `Review: missed ${s.attempts - s.correct}× · step ${s.correctSinceMiss + 1} of 3`,
    };
  }

  let candidates = questions.filter((q) => !exclude.has(q.id));
  if (!candidates.length) candidates = questions;
  const weights = candidates.map((q) => questionWeight(q, ctx, now));
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Everything is scheduled for later review: fall back to uniform.
    weights.fill(1);
    total = weights.length;
  }
  let r = rng() * total;
  let idx = 0;
  for (; idx < weights.length - 1; idx++) {
    r -= weights[idx];
    if (r < 0) break;
  }
  const q = candidates[idx];
  const area = ctx.areaStats.get(q.instructionalArea);
  const s = ctx.stats.get(q.id);
  if (area && area.attempts >= 3 && area.accuracy != null && area.accuracy < 0.7)
    return { question: q, reason: 'weak', detail: `Weak area: ${q.instructionalArea} (${Math.round(area.accuracy * 100)}%)` };
  if (!s) return { question: q, reason: 'new', detail: 'New question' };
  return { question: q, reason: 'refresh', detail: 'Refresher' };
}
