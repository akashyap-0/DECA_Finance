import { useMemo, useState } from 'react';
import { areas, visibleQuestions } from '../data/bank';
import { Button, Card, Stat, cx, pct } from '../components/ui';
import { navigate } from '../lib/router';
import { groupStats, overall, questionStats, streakDays, weakestPis, type GroupStat } from '../lib/stats';
import { useAppState, type MockResult } from '../lib/storage';
import type { Question } from '../lib/types';

/** Accuracy the heatmap treats as "neutral". Below reads as weak (red), above as strong (blue). */
const TARGET = 0.7;

/**
 * Diverging fill: red arm below the target, blue arm above, neutral gray at the target.
 * Poles/midpoint are CSS variables with separate light and dark values (see index.css).
 */
function heatFill(acc: number | null): string {
  if (acc == null) return 'transparent';
  const d = acc - TARGET;
  const t = Math.min(1, Math.abs(d) / (d < 0 ? TARGET : 1 - TARGET));
  const pole = d < 0 ? 'var(--heat-weak)' : 'var(--heat-strong)';
  return `color-mix(in oklab, ${pole} ${Math.round(15 + t * 85)}%, var(--heat-mid))`;
}

export function DashboardPage() {
  const state = useAppState();
  const questions = useMemo(() => visibleQuestions(state.settings.includeFlagged), [state.settings.includeFlagged]);
  const stats = useMemo(() => questionStats(state.attempts), [state.attempts]);
  const o = overall(state.attempts);
  const unseen = questions.filter((q) => !stats.has(q.id)).length;
  const streak = streakDays(state.attempts, state.settings.dailyGoal);
  const areaStats = useMemo(() => groupStats(questions, state.attempts, (q) => q.instructionalArea), [questions, state.attempts]);
  const piStats = useMemo(() => groupStats(questions, state.attempts, (q) => q.piCode), [questions, state.attempts]);
  const piInfo = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of questions) if (!m.has(q.piCode) || (!m.get(q.piCode)!.piDescription && q.piDescription)) m.set(q.piCode, q);
    return m;
  }, [questions]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accuracy" value={pct(o.accuracy)} sub={o.answered ? `${o.correct} correct` : 'No answers yet'} />
        <Stat label="Answered" value={o.answered.toLocaleString()} sub="all modes" />
        <Stat label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={`goal ${state.settings.dailyGoal}/day`} />
        <Stat label="Unseen" value={unseen.toLocaleString()} sub={`of ${questions.length.toLocaleString()}`} />
      </div>
      <Heatmap areaStats={areaStats} piStats={piStats} piInfo={piInfo} questions={questions} />
      <WeakestPis piStats={piStats} piInfo={piInfo} />
      <MockTrend mocks={state.mocks} />
    </div>
  );
}

function Heatmap({
  areaStats,
  piStats,
  piInfo,
  questions,
}: {
  areaStats: Map<string, GroupStat>;
  piStats: Map<string, GroupStat>;
  piInfo: Map<string, Question>;
  questions: Question[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = areas
    .map((a) => areaStats.get(a))
    .filter((g): g is GroupStat => !!g && g.questions > 0)
    .sort((a, b) => b.questions - a.questions);
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-bold">Weakness heatmap</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">By instructional area. Tap an area for its PIs.</p>
        </div>
        <HeatLegend />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-0.5 sm:grid-cols-4">
        {rows.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setOpen(open === g.key ? null : g.key)}
            aria-expanded={open === g.key}
            title={`${g.key}: ${g.attempts ? `${pct(g.accuracy)} over ${g.attempts} attempts` : 'no attempts yet'} · ${g.seen}/${g.questions} questions seen`}
            className={cx(
              'min-h-20 rounded-md border p-2.5 text-left transition hover:ring-2 hover:ring-slate-400',
              g.attempts ? 'border-transparent' : 'heat-empty border-slate-200 dark:border-slate-700',
              open === g.key && 'ring-2 ring-slate-900 dark:ring-white',
            )}
            style={{ backgroundColor: heatFill(g.accuracy) }}
          >
            <div className="text-xs leading-tight font-semibold">{g.key}</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{g.attempts ? pct(g.accuracy) : '—'}</div>
            <div className="text-[0.7rem] text-slate-700 tabular-nums dark:text-slate-300">
              {g.attempts} attempt{g.attempts === 1 ? '' : 's'} · {g.seen}/{g.questions} seen
            </div>
          </button>
        ))}
      </div>
      {open && <PiDrill area={open} piStats={piStats} piInfo={piInfo} questions={questions} />}
    </Card>
  );
}

function HeatLegend() {
  const stops = [0, 0.35, 0.7, 0.85, 1];
  return (
    <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
      <div className="flex gap-0.5">
        {stops.map((s) => (
          <span key={s} className="h-3 w-8 rounded-sm" style={{ background: heatFill(s) }} />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between">
        <span>0% weak</span>
        <span>70%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function PiDrill({
  area,
  piStats,
  piInfo,
  questions,
}: {
  area: string;
  piStats: Map<string, GroupStat>;
  piInfo: Map<string, Question>;
  questions: Question[];
}) {
  const [all, setAll] = useState(false);
  const codes = [...new Set(questions.filter((q) => q.instructionalArea === area).map((q) => q.piCode))];
  const sorted = codes
    .map((c) => piStats.get(c)!)
    .sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2) || b.attempts - a.attempts || a.key.localeCompare(b.key));
  const attempted = sorted.filter((g) => g.attempts > 0);
  const rows = all ? sorted : attempted;
  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{area}: performance indicators</h3>
        <Button variant="secondary" onClick={() => navigate(`/practice?area=${encodeURIComponent(area)}`)}>
          Practice area
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase">
              <th className="py-1 pr-2 font-semibold">PI</th>
              <th className="py-1 pr-2 font-semibold">Description</th>
              <th className="py-1 pr-2 text-right font-semibold">Tries</th>
              <th className="py-1 pr-2 text-right font-semibold">Accuracy</th>
              <th className="hidden py-1 text-right font-semibold sm:table-cell">Qs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2 align-top">
                  <a className="font-mono text-xs font-semibold text-brand-700 underline dark:text-brand-400" href={`#/practice?pi=${g.key}`}>
                    {g.key}
                  </a>
                </td>
                <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-400">{piInfo.get(g.key)?.piDescription || '—'}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{g.attempts}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: heatFill(g.accuracy) }} />
                    {pct(g.accuracy)}
                  </span>
                </td>
                <td className="hidden py-1.5 text-right tabular-nums text-slate-500 sm:table-cell">{g.questions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="py-2 text-sm text-slate-500">No attempts in this area yet.</p>}
      {sorted.length > attempted.length && (
        <button className="mt-2 text-xs font-semibold text-slate-500 underline" onClick={() => setAll((v) => !v)}>
          {all ? 'Show attempted PIs only' : `Show all ${sorted.length} PIs (${sorted.length - attempted.length} not attempted)`}
        </button>
      )}
    </div>
  );
}

function WeakestPis({ piStats, piInfo }: { piStats: Map<string, GroupStat>; piInfo: Map<string, Question> }) {
  const list = weakestPis(piStats);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Weakest 5 PIs</h2>
        {list.length > 0 && (
          <Button onClick={() => navigate(`/practice?pi=${list.map((g) => g.key).join(',')}`)}>Practice these</Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Answer a few more questions. PIs appear here once you have missed one at least once in 2+ attempts.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {list.map((g, i) => {
            const q = piInfo.get(g.key);
            return (
              <li key={g.key} className="flex items-start gap-3 text-sm">
                <span className="w-4 pt-0.5 text-slate-400 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="font-mono text-xs font-semibold">{g.key}</span>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      {q?.piDescription || <span className="italic">{q?.instructionalArea}</span>}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-right tabular-nums">
                  {g.correct}/{g.attempts} <span className="text-slate-500">({pct(g.accuracy)})</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function MockTrend({ mocks }: { mocks: MockResult[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const W = 640;
  const H = 220;
  const P = { l: 36, r: 16, t: 14, b: 26 };
  const pts = mocks.map((m, i) => ({
    m,
    v: m.total ? m.score / m.total : 0,
    x: P.l + (mocks.length === 1 ? (W - P.l - P.r) / 2 : (i / (mocks.length - 1)) * (W - P.l - P.r)),
  }));
  const y = (v: number) => P.t + (1 - v) * (H - P.t - P.b);
  const h = hover != null ? pts[hover] : null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Mock exam scores</h2>
        {mocks.length > 0 && (
          <button className="text-xs font-semibold text-slate-500 underline" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {mocks.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No mock exams yet. <a className="font-semibold text-brand-700 underline dark:text-brand-400" href="#/mock">Take one</a> to see your trend.
        </p>
      ) : showTable ? (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {mocks.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5">{new Date(m.finishedAt).toLocaleDateString()}</td>
                <td className="py-1.5">{m.label}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {m.score}/{m.total} ({pct(m.total ? m.score / m.total : null)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mock exam score trend" onMouseLeave={() => setHover(null)}>
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
                <text x={P.l - 6} y={y(g) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {g * 100}%
                </text>
              </g>
            ))}
            <line x1={P.l} x2={W - P.r} y1={y(TARGET)} y2={y(TARGET)} className="stroke-slate-400" strokeDasharray="4 4" strokeWidth="1" />
            <text x={P.l + 4} y={y(TARGET) - 4} className="fill-slate-500 text-[10px]">
              70% target
            </text>
            {pts.length > 1 && (
              <polyline
                points={pts.map((p) => `${p.x},${y(p.v)}`).join(' ')}
                fill="none"
                className="stroke-[var(--series-1)]"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {h && <line x1={h.x} x2={h.x} y1={P.t} y2={H - P.b} className="stroke-slate-400" strokeWidth="1" />}
            {pts.map((p, i) => (
              <g key={p.m.id} onMouseEnter={() => setHover(i)} onClick={() => navigate(`/mock?result=${p.m.id}`)} className="cursor-pointer">
                <circle cx={p.x} cy={y(p.v)} r="14" fill="transparent" />
                <circle cx={p.x} cy={y(p.v)} r={hover === i ? 6 : 4.5} className="pointer-events-none fill-[var(--series-1)] stroke-white dark:stroke-slate-900" strokeWidth="2" />
              </g>
            ))}
            {pts.length > 0 && (
              <>
                <text x={pts[0].x} y={H - 8} textAnchor={pts.length > 1 ? 'start' : 'middle'} className="fill-slate-400 text-[10px]">
                  {new Date(pts[0].m.finishedAt).toLocaleDateString()}
                </text>
                {pts.length > 1 && (
                  <text x={pts[pts.length - 1].x} y={H - 8} textAnchor="end" className="fill-slate-400 text-[10px]">
                    {new Date(pts[pts.length - 1].m.finishedAt).toLocaleDateString()}
                  </text>
                )}
              </>
            )}
          </svg>
          {h && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
              style={{ left: `${(h.x / W) * 100}%`, top: `${(y(h.v) / H) * 100}%`, marginTop: -10 }}
            >
              <div className="font-semibold">
                {h.m.score}/{h.m.total} · {pct(h.v)}
              </div>
              <div className="text-slate-500">{h.m.label}</div>
              <div className="text-slate-500">{new Date(h.m.finishedAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
