// Mock exam construction and scoring. Pure functions.
import type { MockAnswer } from './storage';
import type { ExamInfo, Question } from './types';

export const MOCK_QUESTIONS = 100;
export const MOCK_TIME_MS = 60 * 60 * 1000;

/**
 * Average number of questions per instructional area across the real exams,
 * scaled to `total` with largest-remainder rounding so it sums exactly.
 */
export function areaDistribution(
  exams: ExamInfo[],
  byId: Map<string, Question>,
  total = MOCK_QUESTIONS,
): Map<string, number> {
  const counts = new Map<string, number>();
  let n = 0;
  for (const e of exams) {
    if (e.duplicateOf) continue;
    for (const id of e.questionIds) {
      const q = id ? byId.get(id) : undefined;
      if (!q) continue;
      counts.set(q.instructionalArea, (counts.get(q.instructionalArea) ?? 0) + 1);
      n++;
    }
  }
  const out = new Map<string, number>();
  if (!n) return out;
  const raw = [...counts.entries()].map(([a, c]) => ({ a, exact: (c / n) * total }));
  let assigned = 0;
  for (const r of raw) {
    out.set(r.a, Math.floor(r.exact));
    assigned += Math.floor(r.exact);
  }
  raw
    .sort((x, y) => y.exact - Math.floor(y.exact) - (x.exact - Math.floor(x.exact)) || x.a.localeCompare(y.a))
    .slice(0, total - assigned)
    .forEach((r) => out.set(r.a, out.get(r.a)! + 1));
  return out;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffled mix of questions matching the per-area distribution. */
export function buildMix(
  questions: Question[],
  dist: Map<string, number>,
  rng: () => number = Math.random,
  total = MOCK_QUESTIONS,
): Question[] {
  const byArea = new Map<string, Question[]>();
  for (const q of shuffle(questions, rng)) {
    const list = byArea.get(q.instructionalArea) ?? [];
    list.push(q);
    byArea.set(q.instructionalArea, list);
  }
  const chosen: Question[] = [];
  for (const [area, n] of dist) chosen.push(...(byArea.get(area) ?? []).splice(0, n));
  // Top up from whatever is left if an area ran short.
  if (chosen.length < total) {
    const rest = shuffle([...byArea.values()].flat(), rng);
    chosen.push(...rest.slice(0, total - chosen.length));
  }
  return shuffle(chosen.slice(0, total), rng);
}

/** Question ids of a real exam in original order, skipping slots that are missing or hidden. */
export function buildReplay(exam: ExamInfo, visible: Set<string>): string[] {
  return exam.questionIds.filter((id): id is string => !!id && visible.has(id));
}

export interface MockScore {
  score: number;
  total: number;
  answered: number;
  byArea: { area: string; correct: number; total: number }[];
}

export function scoreMock(answers: MockAnswer[], byId: Map<string, Question>): MockScore {
  let score = 0;
  let answered = 0;
  const areas = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const q = byId.get(a.qid);
    if (!q) continue;
    const g = areas.get(q.instructionalArea) ?? { correct: 0, total: 0 };
    g.total++;
    if (a.choice) answered++;
    if (a.choice === q.correct) {
      score++;
      g.correct++;
    }
    areas.set(q.instructionalArea, g);
  }
  return {
    score,
    total: answers.length,
    answered,
    byArea: [...areas.entries()]
      .map(([area, g]) => ({ area, ...g }))
      .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area)),
  };
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
