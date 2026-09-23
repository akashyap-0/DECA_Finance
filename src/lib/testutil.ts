import type { Question } from './types';

/** Minimal question for tests. */
export function mkQ(id: string, over: Partial<Question> = {}): Question {
  return {
    id,
    exam: 'e1',
    number: 1,
    question: 'Q ' + id,
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correct: 'A',
    explanation: 'a.',
    piCode: 'FI:001',
    piDescription: '',
    instructionalArea: 'Financial Analysis',
    appearances: [{ exam: 'e1', number: 1 }],
    needsReview: false,
    reviewNotes: [],
    ...over,
  };
}

