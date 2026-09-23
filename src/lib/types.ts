// Shared data types for data/questions.json (written by scripts/parse-exams.ts, read by the app).

export type Letter = 'A' | 'B' | 'C' | 'D';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

export type ExamLevel = 'ICDC' | 'State' | 'District' | 'Sample';

export interface Appearance {
  exam: string;
  number: number;
}

export interface Question {
  /** Stable id: `${exam}-${number}` of the first appearance. */
  id: string;
  /** Exam id of the first appearance. */
  exam: string;
  /** Question number in that exam (1-100). */
  number: number;
  /** Question stem. Lines inside tables are separated by "\n", table cells by " | ". */
  question: string;
  options: Record<Letter, string>;
  correct: Letter;
  explanation: string;
  /** Performance Indicator code, e.g. "FI:071". */
  piCode: string;
  piDescription: string;
  /** When the description was not printed in this exam, the exam it was taken from (same PI code). */
  piDescriptionFrom?: string;
  instructionalArea: string;
  /** Bibliographic source line from the key (textbook, LAP, URL). */
  reference?: string;
  /** Every exam/number where this question appears (deduplicated across exams). */
  appearances: Appearance[];
  needsReview: boolean;
  reviewNotes: string[];
}

export interface ExamInfo {
  id: string;
  label: string;
  year: number;
  level: ExamLevel;
  testNumber?: string;
  file: string;
  /** Question ids in original exam order (index 0 = question 1). Null where a question failed to parse. */
  questionIds: (string | null)[];
  /** Set when this exam's questions are (almost) all duplicates of another exam. */
  duplicateOf?: string;
}

export interface QuestionBank {
  generatedAt: string;
  exams: ExamInfo[];
  questions: Question[];
  instructionalAreas: string[];
}
