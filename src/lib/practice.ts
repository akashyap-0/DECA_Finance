// Filtering for free practice mode.
import type { QStat } from './stats';
import type { Question } from './types';

export interface PracticeFilters {
  areas: string[];
  exams: string[];
  piCodes: string[];
  missedOnly: boolean;
  unseenOnly: boolean;
  bookmarkedOnly: boolean;
}

export const NO_FILTERS: PracticeFilters = {
  areas: [],
  exams: [],
  piCodes: [],
  missedOnly: false,
  unseenOnly: false,
  bookmarkedOnly: false,
};

export function filterPool(
  questions: Question[],
  f: PracticeFilters,
  stats: Map<string, QStat>,
  bookmarks: string[],
): Question[] {
  const bm = new Set(bookmarks);
  return questions.filter((q) => {
    if (f.areas.length && !f.areas.includes(q.instructionalArea)) return false;
    if (f.exams.length && !q.appearances.some((a) => f.exams.includes(a.exam))) return false;
    if (f.piCodes.length && !f.piCodes.includes(q.piCode)) return false;
    const s = stats.get(q.id);
    if (f.missedOnly && !s?.everMissed) return false;
    if (f.unseenOnly && s) return false;
    if (f.bookmarkedOnly && !bm.has(q.id)) return false;
    return true;
  });
}

export function activeFilterCount(f: PracticeFilters): number {
  return (
    f.areas.length +
    f.exams.length +
    f.piCodes.length +
    Number(f.missedOnly) +
    Number(f.unseenOnly) +
    Number(f.bookmarkedOnly)
  );
}

/** Random question from the pool, avoiding ones already shown this session when possible. */
export function pickRandom(pool: Question[], shown: Set<string>, rng: () => number = Math.random): Question | null {
  if (!pool.length) return null;
  const fresh = pool.filter((q) => !shown.has(q.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}
