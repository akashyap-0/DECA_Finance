import type { Letter, Question } from '../lib/types';
import { LETTERS } from '../lib/types';
import { examLabel } from '../data/bank';
import { Stem } from './Stem';
import { cx } from './ui';

interface Props {
  question: Question;
  selected: Letter | null;
  /** When true, show which option is correct (practice feedback / review). */
  revealed: boolean;
  onSelect?: (l: Letter) => void;
  header?: React.ReactNode;
}

export function QuestionView({ question, selected, revealed, onSelect, header }: Props) {
  return (
    <div>
      {header}
      <Stem text={question.question} />
      <div className="mt-5 grid gap-2.5" role="radiogroup" aria-label="Answer choices">
        {LETTERS.map((L, i) => {
          const isSel = selected === L;
          const isCorrect = question.correct === L;
          let tone = 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-slate-800';
          if (revealed && isCorrect)
            tone = 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50';
          else if (revealed && isSel)
            tone = 'border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/50';
          else if (isSel) tone = 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-slate-800';
          else if (revealed) tone = 'border-slate-200 bg-white opacity-70 dark:border-slate-800 dark:bg-slate-900';
          return (
            <button
              key={L}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={!onSelect}
              onClick={() => onSelect?.(L)}
              className={cx(
                'flex w-full items-start gap-3 rounded-xl border-2 px-3 py-3 text-left transition disabled:cursor-default sm:px-4',
                tone,
              )}
            >
              <span
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  revealed && isCorrect
                    ? 'bg-emerald-600 text-white'
                    : revealed && isSel
                      ? 'bg-rose-600 text-white'
                      : isSel
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {L}
              </span>
              <span className="pt-0.5 leading-snug">{question.options[L]}</span>
              <span className="ml-auto hidden pt-1 text-xs text-slate-400 sm:block" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Feedback({ question, selected }: { question: Question; selected: Letter | null }) {
  const right = selected === question.correct;
  return (
    <div
      className={cx(
        'mt-5 rounded-xl border p-4 sm:p-5',
        right
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30',
      )}
      aria-live="polite"
    >
      <div className={cx('font-bold', right ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
        {selected == null ? 'Not answered.' : right ? 'Correct!' : `Not quite. You chose ${selected}.`}{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          Answer: {question.correct}. {question.options[question.correct]}
        </span>
      </div>
      <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">{question.explanation}</p>
      <PiLine question={question} />
    </div>
  );
}

export function PiLine({ question }: { question: Question }) {
  return (
    <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-3 text-sm text-slate-600 dark:border-slate-700/70 dark:text-slate-400">
      <div>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {question.piCode}
        </span>{' '}
        {question.piDescription || <em>No description printed for this PI</em>}
        {question.piDescriptionFrom && (
          <span className="text-xs text-slate-400"> (description from {examLabel(question.piDescriptionFrom)})</span>
        )}
      </div>
      <div>
        {question.instructionalArea} · {question.appearances.map((a) => `${examLabel(a.exam)} #${a.number}`).join(', ')}
      </div>
      {question.reference && <div className="text-xs break-words text-slate-400">Source: {question.reference}</div>}
    </div>
  );
}
