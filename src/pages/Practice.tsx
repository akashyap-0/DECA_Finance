import { useEffect, useMemo, useRef, useState } from 'react';
import { exams, areas, examLabel, visibleQuestions } from '../data/bank';
import { Feedback, QuestionView } from '../components/QuestionView';
import { Button, Card, Toggle, cx } from '../components/ui';
import { activeFilterCount, filterPool, NO_FILTERS, pickRandom, type PracticeFilters } from '../lib/practice';
import { answeredToday, questionStats, streakDays } from '../lib/stats';
import { dueReviews, pickSmart, reviewQueueSize, type SmartPick } from '../lib/smart';
import { ProgressBar } from '../components/ui';
import { store, useAppState } from '../lib/storage';
import type { Letter, Question } from '../lib/types';
import { keyToLetter, useKeys } from '../lib/useKeys';

function filtersFromParams(params: URLSearchParams): PracticeFilters {
  const list = (k: string) => (params.get(k) ? params.get(k)!.split(',').filter(Boolean) : []);
  return {
    ...NO_FILTERS,
    piCodes: list('pi'),
    areas: list('area'),
    exams: list('exam'),
    missedOnly: params.get('missed') === '1',
    bookmarkedOnly: params.get('bookmarked') === '1',
  };
}

type Mode = 'smart' | 'custom';

export function PracticePage({ params }: { params: URLSearchParams }) {
  const state = useAppState();
  const [mode, setMode] = useState<Mode>(() =>
    activeFilterCount(filtersFromParams(params)) > 0 || params.get('mode') === 'custom' ? 'custom' : 'smart',
  );
  const [filters, setFilters] = useState<PracticeFilters>(() => filtersFromParams(params));
  const [showFilters, setShowFilters] = useState(() => activeFilterCount(filtersFromParams(params)) > 0);
  const questions = useMemo(() => visibleQuestions(state.settings.includeFlagged), [state.settings.includeFlagged]);
  const stats = useMemo(() => questionStats(state.attempts), [state.attempts]);
  // The pool is recomputed when filters change, not after every answer, so "unseen only"
  // doesn't yank the current question away while its feedback is showing.
  const pool = useMemo(
    () => filterPool(questions, filters, questionStats(store.get().attempts), state.bookmarks),
    [questions, filters, state.bookmarks],
  );

  const shown = useRef(new Set<string>());
  const [current, setCurrent] = useState<Question | null>(null);
  const [why, setWhy] = useState<SmartPick | null>(null);
  const [selected, setSelected] = useState<Letter | null>(null);
  const shownAt = useRef(Date.now());

  function next(m: Mode = mode) {
    let q: Question | null;
    if (m === 'smart') {
      const pick = pickSmart(questions, store.get().attempts, { exclude: shown.current });
      setWhy(pick);
      q = pick?.question ?? null;
    } else {
      setWhy(null);
      // Re-filter with fresh stats so "missed"/"unseen" reflect the answer just given.
      const fresh = filterPool(questions, filters, questionStats(store.get().attempts), store.get().bookmarks);
      q = pickRandom(
        fresh.filter((x) => x.id !== current?.id),
        shown.current,
      ) ?? (fresh.length ? fresh[0] : null);
    }
    if (q) shown.current.add(q.id);
    setCurrent(q);
    setSelected(null);
    shownAt.current = Date.now();
  }

  // New pool (custom mode) -> new question if the current one no longer fits.
  useEffect(() => {
    if (mode === 'custom' && current && !pool.some((q) => q.id === current.id)) next('custom');
  }, [pool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    next(mode);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(l: Letter) {
    if (!current || selected) return;
    setSelected(l);
    store.recordAttempt({
      qid: current.id,
      choice: l,
      correct: l === current.correct,
      ts: Date.now(),
      ms: Date.now() - shownAt.current,
      mode: mode === 'smart' ? 'smart' : 'practice',
    });
  }

  useKeys((e) => {
    if (!current) return;
    const l = keyToLetter(e.key);
    if (l && !selected) {
      e.preventDefault();
      answer(l);
    } else if (e.key === 'Enter' && selected) {
      e.preventDefault();
      next();
    } else if (e.key.toLowerCase() === 's' && !l) {
      store.toggleBookmark(current.id);
    }
  });

  const nFilters = activeFilterCount(filters);
  const bookmarked = current ? state.bookmarks.includes(current.id) : false;
  const qs = current ? stats.get(current.id) : undefined;

  return (
    <div className="space-y-4">
      <DailyBar />
      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
            {(['smart', 'custom'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition',
                  mode === m
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                )}
              >
                {m === 'smart' ? 'Smart' : 'Custom'}
              </button>
            ))}
          </div>
          {mode === 'custom' ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{pool.length}</span> match
              </span>
              <Button variant="secondary" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                Filters{nFilters ? ` (${nFilters})` : ''}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">Reviews missed questions, then your weakest areas</span>
          )}
        </div>
        {mode === 'custom' && showFilters && <FilterPanel filters={filters} setFilters={setFilters} />}
      </Card>

      {!current ? (
        <Card>
          <p className="text-center text-slate-600 dark:text-slate-400">
            No questions match these filters.{' '}
            <button className="font-semibold text-brand-600 underline" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          </p>
        </Card>
      ) : (
        <Card>
          <QuestionView
            question={current}
            selected={selected}
            revealed={selected != null}
            onSelect={answer}
            header={
              <div className="mb-3 flex items-start justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-semibold text-brand-700 dark:text-brand-400">{current.instructionalArea}</span>
                  <span>·</span>
                  <span>
                    {examLabel(current.exam)} #{current.number}
                  </span>
                  {qs && why?.reason !== 'new' && (
                    <>
                      <span>·</span>
                      <span>
                        seen {qs.attempts}× ({qs.correct} right)
                      </span>
                    </>
                  )}
                  {why ? (
                    <ReasonChip pick={why} />
                  ) : (
                    !qs && (
                      <span className="rounded bg-sky-100 px-1.5 font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                        new
                      </span>
                    )
                  )}
                </div>
                <BookmarkButton on={bookmarked} onClick={() => store.toggleBookmark(current.id)} />
              </div>
            }
          />
          {selected && (
            <>
              <Feedback question={current} selected={selected} />
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  <kbd>Enter</kbd> next · <kbd>S</kbd> bookmark
                </span>
                <Button onClick={() => next()} className="w-full sm:w-auto">
                  Next question →
                </Button>
              </div>
            </>
          )}
          {!selected && (
            <p className="mt-4 hidden text-xs text-slate-500 sm:block">
              Answer with <kbd>A</kbd>–<kbd>D</kbd> or <kbd>1</kbd>–<kbd>4</kbd>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

const REASON_STYLE: Record<SmartPick['reason'], string> = {
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  weak: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  new: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  refresh: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function ReasonChip({ pick }: { pick: SmartPick }) {
  return <span className={cx('rounded px-1.5 font-semibold', REASON_STYLE[pick.reason])}>{pick.detail}</span>;
}

/** Today's progress toward the daily goal, the streak, and reviews waiting. */
export function DailyBar() {
  const state = useAppState();
  const goal = state.settings.dailyGoal;
  const today = answeredToday(state.attempts);
  const streak = streakDays(state.attempts, goal);
  const questions = visibleQuestions(state.settings.includeFlagged);
  const stats = questionStats(state.attempts);
  const due = dueReviews(questions, stats, Date.now()).length;
  const queue = reviewQueueSize(questions, stats);
  return (
    <Card className="!p-3 sm:!p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-40 flex-1">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-semibold">Today</span>
            <span className="tabular-nums text-slate-600 dark:text-slate-400">
              {today} / {goal}
              {today >= goal && <span className="ml-1 text-brand-600 dark:text-brand-400">✓ goal met</span>}
            </span>
          </div>
          <ProgressBar value={today} max={goal} />
        </div>
        <div className="flex gap-5 text-sm">
          <div title="Days in a row you met your daily goal">
            <span className="text-lg font-bold tabular-nums">{streak}</span>{' '}
            <span className="text-slate-500 dark:text-slate-400">day streak</span>
          </div>
          <div title={`${queue} missed questions are in the review cycle`}>
            <span className="text-lg font-bold tabular-nums">{due}</span>{' '}
            <span className="text-slate-500 dark:text-slate-400">reviews due</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function BookmarkButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? 'Remove bookmark (S)' : 'Bookmark (S)'}
      className={cx(
        'shrink-0 rounded-lg p-1.5 transition',
        on ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{on ? 'Remove bookmark' : 'Bookmark'}</span>
    </button>
  );
}

function ChipToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        on
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

function FilterPanel({
  filters,
  setFilters,
}: {
  filters: PracticeFilters;
  setFilters: (f: PracticeFilters) => void;
}) {
  const toggle = (key: 'areas' | 'exams' | 'piCodes', v: string) => {
    const list = filters[key];
    setFilters({ ...filters, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };
  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="grid gap-x-6 sm:grid-cols-3">
        <Toggle label="Missed only" checked={filters.missedOnly} onChange={(v) => setFilters({ ...filters, missedOnly: v, unseenOnly: v ? false : filters.unseenOnly })} />
        <Toggle label="Unseen only" checked={filters.unseenOnly} onChange={(v) => setFilters({ ...filters, unseenOnly: v, missedOnly: v ? false : filters.missedOnly })} />
        <Toggle label="Bookmarked only" checked={filters.bookmarkedOnly} onChange={(v) => setFilters({ ...filters, bookmarkedOnly: v })} />
      </div>
      {filters.piCodes.length > 0 && (
        <FilterGroup title="Performance indicators">
          {filters.piCodes.map((p) => (
            <ChipToggle key={p} on onClick={() => toggle('piCodes', p)}>
              {p} ✕
            </ChipToggle>
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Instructional area">
        {areas.map((a) => (
          <ChipToggle key={a} on={filters.areas.includes(a)} onClick={() => toggle('areas', a)}>
            {a}
          </ChipToggle>
        ))}
      </FilterGroup>
      <FilterGroup title="Exam">
        {exams
          .filter((e) => !e.duplicateOf)
          .map((e) => (
            <ChipToggle key={e.id} on={filters.exams.includes(e.id)} onClick={() => toggle('exams', e.id)}>
              {e.label}
            </ChipToggle>
          ))}
      </FilterGroup>
      {activeFilterCount(filters) > 0 && (
        <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
          Clear all filters
        </Button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
