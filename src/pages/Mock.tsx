import { useEffect, useMemo, useRef, useState } from 'react';
import { byId, examById, exams, visibleQuestions } from '../data/bank';
import { Feedback, QuestionView } from '../components/QuestionView';
import { Button, Card, ProgressBar, cx, pct } from '../components/ui';
import {
  areaDistribution,
  buildMix,
  buildReplay,
  formatDuration,
  MOCK_TIME_MS,
  scoreMock,
} from '../lib/mock';
import { navigate } from '../lib/router';
import { store, useAppState, type ActiveMock, type MockAnswer, type MockResult } from '../lib/storage';
import type { Letter } from '../lib/types';
import { keyToLetter, useKeys } from '../lib/useKeys';

export function MockPage({ params }: { params: URLSearchParams }) {
  const state = useAppState();
  const resultId = params.get('result');
  if (state.activeMock) return <Runner mock={state.activeMock} />;
  if (resultId) {
    const r = state.mocks.find((m) => m.id === resultId);
    if (r) return <Results result={r} />;
  }
  return <Setup />;
}

// ------------------------------------------------------------------ setup

function Setup() {
  const state = useAppState();
  const replayable = useMemo(
    () => exams.filter((e) => !e.duplicateOf).sort((a, b) => b.year - a.year || a.label.localeCompare(b.label)),
    [],
  );
  const [examId, setExamId] = useState(replayable[0]?.id ?? '');
  const visible = useMemo(() => visibleQuestions(state.settings.includeFlagged), [state.settings.includeFlagged]);
  const dist = useMemo(() => areaDistribution(exams, byId), []);
  const takenIds = new Set(state.mocks.map((m) => m.examId).filter(Boolean));

  function start(kind: 'replay' | 'mix') {
    const visibleIds = new Set(visible.map((q) => q.id));
    let ids: string[];
    let label: string;
    if (kind === 'replay') {
      const e = examById.get(examId)!;
      ids = buildReplay(e, visibleIds);
      label = `${e.label} (replay)`;
    } else {
      ids = buildMix(visible, dist).map((q) => q.id);
      label = 'Mixed exam';
    }
    const m: ActiveMock = {
      id: `mock-${Date.now()}`,
      kind,
      examId: kind === 'replay' ? examId : undefined,
      label,
      startedAt: Date.now(),
      timeLimitMs: MOCK_TIME_MS,
      answers: ids.map((qid) => ({ qid, choice: null, flagged: false, ms: 0 })),
      current: 0,
    };
    store.setActiveMock(m);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mock exam</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          100 questions, 60 minutes, no feedback until you submit, just like the real test.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-bold">Replay a real exam</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Questions in their original order.</p>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {replayable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
                {takenIds.has(e.id) ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <Button className="mt-4 w-full" onClick={() => start('replay')} disabled={!examId}>
            Start replay
          </Button>
        </Card>
        <Card>
          <h2 className="font-bold">Mixed exam</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A shuffled mix from all {exams.filter((e) => !e.duplicateOf).length} exams, matching the real mix of
            instructional areas.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {[...dist.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([a, n]) => (
                <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {a} {n}
                </span>
              ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => start('mix')}>
            Start mixed exam
          </Button>
        </Card>
      </div>
      <History mocks={state.mocks} />
    </div>
  );
}

function History({ mocks }: { mocks: MockResult[] }) {
  if (!mocks.length) return null;
  return (
    <Card>
      <h2 className="mb-3 font-bold">History</h2>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {[...mocks].reverse().map((m) => (
          <li key={m.id}>
            <a
              href={`#/mock?result=${m.id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-700 dark:hover:text-brand-400"
            >
              <span>
                <span className="font-semibold">{m.label}</span>
                <span className="block text-xs text-slate-500">
                  {new Date(m.finishedAt).toLocaleString()} · {formatDuration(m.durationMs)}
                </span>
              </span>
              <span className="text-right font-bold tabular-nums">
                {m.score}/{m.total}
                <span className="block text-xs font-normal text-slate-500">{pct(m.total ? m.score / m.total : null)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------ runner

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Runner({ mock }: { mock: ActiveMock }) {
  const now = useNow();
  const remaining = mock.startedAt + mock.timeLimitMs - now;
  const [confirming, setConfirming] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const enteredAt = useRef(Date.now());
  const cur = mock.answers[mock.current];
  const q = byId.get(cur.qid)!;
  const answered = mock.answers.filter((a) => a.choice).length;
  const flagged = mock.answers.filter((a) => a.flagged).length;

  /** Adds time spent on the current question and applies a change. */
  function commit(change: (answers: MockAnswer[]) => { answers: MockAnswer[]; current?: number }) {
    const m = store.get().activeMock;
    if (!m) return;
    const spent = Date.now() - enteredAt.current;
    enteredAt.current = Date.now();
    const answers = m.answers.map((a, i) => (i === m.current ? { ...a, ms: a.ms + spent } : a));
    const r = change(answers);
    store.setActiveMock({ ...m, answers: r.answers, current: r.current ?? m.current });
  }

  const choose = (l: Letter) =>
    commit((answers) => ({ answers: answers.map((a, i) => (i === mock.current ? { ...a, choice: l } : a)) }));
  const toggleFlag = () =>
    commit((answers) => ({ answers: answers.map((a, i) => (i === mock.current ? { ...a, flagged: !a.flagged } : a)) }));
  const go = (i: number) => {
    if (i < 0 || i >= mock.answers.length) return;
    commit((answers) => ({ answers, current: i }));
    setShowGrid(false);
    window.scrollTo({ top: 0 });
  };

  function submit() {
    const m = store.get().activeMock;
    if (!m) return;
    const finishedAt = Date.now();
    const answers = m.answers.map((a, i) =>
      i === m.current ? { ...a, ms: a.ms + (finishedAt - enteredAt.current) } : a,
    );
    const s = scoreMock(answers, byId);
    const result: MockResult = {
      id: m.id,
      kind: m.kind,
      examId: m.examId,
      label: m.label,
      startedAt: m.startedAt,
      finishedAt,
      durationMs: Math.min(finishedAt - m.startedAt, m.timeLimitMs),
      timeLimitMs: m.timeLimitMs,
      answers,
      score: s.score,
      total: s.total,
    };
    const attempts = answers
      .filter((a) => a.choice)
      .map((a) => ({
        qid: a.qid,
        choice: a.choice!,
        correct: a.choice === byId.get(a.qid)?.correct,
        ts: finishedAt,
        ms: a.ms,
        mode: 'mock' as const,
      }));
    store.finishMock(result, attempts);
    navigate(`/mock?result=${m.id}`);
  }

  // Time's up -> submit automatically.
  useEffect(() => {
    if (remaining <= 0) submit();
  }, [remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useKeys((e) => {
    if (confirming) return;
    const l = keyToLetter(e.key);
    if (l) {
      e.preventDefault();
      choose(l);
    } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(mock.current + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(mock.current - 1);
    } else if (e.key.toLowerCase() === 'f') {
      toggleFlag();
    }
  });

  const low = remaining < 5 * 60 * 1000;
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{mock.label}</div>
            <div className="text-xs text-slate-500">
              {answered}/{mock.answers.length} answered · {flagged} flagged
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'rounded-lg px-2.5 py-1 font-mono text-lg font-bold tabular-nums',
                low ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-white dark:bg-slate-900',
              )}
              aria-label="Time remaining"
            >
              {formatDuration(remaining)}
            </span>
            <Button onClick={() => setConfirming(true)}>Submit</Button>
          </div>
        </div>
        <ProgressBar className="mt-2 !h-1" value={answered} max={mock.answers.length} />
      </div>

      {confirming && (
        <Card className="border-brand-300 dark:border-brand-800">
          <p className="font-semibold">Submit the exam?</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {mock.answers.length - answered > 0
              ? `${mock.answers.length - answered} question(s) are unanswered and will be marked wrong.`
              : 'All questions answered.'}
            {flagged > 0 && ` ${flagged} flagged.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={submit}>Submit now</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button
              variant="ghost"
              className="sm:ml-auto"
              onClick={() => {
                if (window.confirm('Abandon this mock exam? Nothing from it will be saved.')) store.setActiveMock(null);
              }}
            >
              Abandon exam
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <QuestionView
          question={q}
          selected={cur.choice}
          revealed={false}
          onSelect={choose}
          header={
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-bold">
                Question {mock.current + 1} <span className="font-normal text-slate-500">of {mock.answers.length}</span>
              </span>
              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={cur.flagged}
                className={cx(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition',
                  cur.flagged
                    ? 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700'
                    : 'text-slate-500 ring-slate-300 hover:bg-slate-100 dark:ring-slate-600 dark:hover:bg-slate-800',
                )}
              >
                {cur.flagged ? '⚑ Flagged' : '⚐ Flag'}
              </button>
            </div>
          }
        />
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => go(mock.current - 1)} disabled={mock.current === 0}>
            ← Prev
          </Button>
          <Button variant="ghost" onClick={() => setShowGrid((v) => !v)} className="sm:hidden">
            All questions
          </Button>
          <span className="hidden text-xs text-slate-500 sm:inline">
            <kbd>A</kbd>–<kbd>D</kbd> answer · <kbd>←</kbd> <kbd>→</kbd> move · <kbd>F</kbd> flag
          </span>
          <Button
            variant="secondary"
            onClick={() => go(mock.current + 1)}
            disabled={mock.current === mock.answers.length - 1}
          >
            Next →
          </Button>
        </div>
      </Card>

      <Card className={cx(!showGrid && 'hidden sm:block')}>
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-500">
          <Legend className="bg-brand-600" label="answered" />
          <Legend className="bg-amber-400" label="flagged" />
          <Legend className="bg-slate-200 dark:bg-slate-700" label="unanswered" />
        </div>
        <div className="grid grid-cols-10 gap-1 sm:grid-cols-20">
          {mock.answers.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Question ${i + 1}${a.choice ? ', answered' : ''}${a.flagged ? ', flagged' : ''}`}
              className={cx(
                'relative aspect-square rounded text-[0.65rem] font-semibold tabular-nums',
                a.choice ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                i === mock.current && 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-900',
              )}
            >
              {i + 1}
              {a.flagged && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-amber-400" />}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cx('h-3 w-3 rounded', className)} />
      {label}
    </span>
  );
}

// ------------------------------------------------------------------ results

type ReviewFilter = 'all' | 'wrong' | 'flagged';

function Results({ result }: { result: MockResult }) {
  const s = useMemo(() => scoreMock(result.answers, byId), [result]);
  const [filter, setFilter] = useState<ReviewFilter>('wrong');
  const rows = result.answers
    .map((a, i) => ({ a, i, q: byId.get(a.qid) }))
    .filter((r) => r.q)
    .filter((r) =>
      filter === 'all' ? true : filter === 'flagged' ? r.a.flagged : r.a.choice !== r.q!.correct,
    );
  const ratio = result.total ? result.score / result.total : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <a href="#/mock" className="text-sm font-semibold text-brand-700 dark:text-brand-400">
          ← Mock exams
        </a>
      </div>
      <Card>
        <div className="text-sm text-slate-500">{result.label}</div>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-4xl font-extrabold tabular-nums">
              {result.score}
              <span className="text-xl text-slate-400">/{result.total}</span>
            </div>
            <div className={cx('font-semibold', ratio >= 0.7 ? 'text-emerald-600' : 'text-rose-600')}>{pct(ratio)}</div>
          </div>
          <div className="text-sm">
            <div>
              <span className="text-slate-500">Time used</span>{' '}
              <span className="font-semibold tabular-nums">
                {formatDuration(result.durationMs)} / {formatDuration(result.timeLimitMs)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Answered</span>{' '}
              <span className="font-semibold tabular-nums">
                {s.answered}/{result.total}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Finished</span> {new Date(result.finishedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">By instructional area</h2>
        <div className="space-y-2">
          {s.byArea.map((g) => (
            <div key={g.area} className="grid grid-cols-[1fr_3rem] items-center gap-x-3 text-sm sm:grid-cols-[15rem_1fr_3rem]">
              <span className="truncate">{g.area}</span>
              <ProgressBar value={g.correct} max={g.total} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
              <span className="text-right tabular-nums text-slate-600 dark:text-slate-400">
                {g.correct}/{g.total}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Review</h2>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
            {(['wrong', 'flagged', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx(
                  'rounded-md px-3 py-1 font-semibold capitalize',
                  filter === f ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500',
                )}
              >
                {f === 'wrong' ? 'Missed' : f}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 && <p className="text-sm text-slate-500">Nothing to show here.</p>}
        <div className="space-y-6">
          {rows.map(({ a, i, q }) => (
            <div key={i} className="border-t border-slate-200 pt-5 first:border-0 first:pt-0 dark:border-slate-800">
              <QuestionView
                question={q!}
                selected={a.choice}
                revealed
                header={
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Q{i + 1} {a.flagged && <span className="text-amber-600">⚑ flagged</span>}{' '}
                    <span className="font-normal">· {formatDuration(a.ms)} spent</span>
                  </div>
                }
              />
              <Feedback question={q!} selected={a.choice} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
