import { describe, expect, it } from 'vitest';
import { groupLines, fixOrdinals, type Item } from './pdf-lines.ts';
import { isBoilerplate, joinLines, layoutTable, parsePages } from './parser.ts';
import { buildExamQuestions, dedupe, detectMeta, fillPiDescriptions, normalize } from './build.ts';
import type { Line, Page } from './types.ts';

// ---- helpers to build synthetic pages -------------------------------------------------
let y = 0;
function L(...parts: [number, string][]): Line {
  y -= 12;
  return { y, segments: parts.map(([x, text]) => ({ x, text })) };
}
function page(number: number, lines: Line[]): Page {
  return { number, width: 612, height: 792, lines: lines.map((l, i) => ({ ...l, y: 740 - i * 12 })) };
}
const areas = { FI: 'Financial Analysis', BL: 'Business Law' };
const meta = { id: 't', label: 'T', year: 2020, level: 'ICDC' as const, file: 't.pdf' };

describe('joinLines', () => {
  it('joins wrapped lines with spaces', () => {
    expect(joinLines(['The price of the', 'stock fell.'])).toBe('The price of the stock fell.');
  });
  it('keeps hyphenated compounds and em dashes together', () => {
    expect(joinLines(['an expense-', 'reimbursement form'])).toBe('an expense-reimbursement form');
    expect(joinLines(['three folders—', '30 days'])).toBe('three folders—30 days');
  });
  it('keeps a space for suspended hyphens ("long- and short-term")', () => {
    expect(joinLines(['long-', 'and short-term'])).toBe('long- and short-term');
  });
});

describe('isBoilerplate', () => {
  const p = page(1, []);
  it.each([
    '2011 HS ICDC FINANCE CLUSTER EXAM 1',
    '2025 HS ICDC FINANCE CLUSTER EXAM—KEY 12',
    'Test 1324 FINANCE EXAM 3',
    'SAMPLE FINANCE CLUSTER EXAM',
    'SAMPLE FINANCE CLUSTER EXAM—KEY',
    'Copyright © 2011 by MBA Research and Curriculum Center, Columbus, Ohio',
    '®',
  ])('drops "%s"', (t) => {
    expect(isBoilerplate({ y: 500, segments: [{ x: 60, text: t }] }, p)).toBe(true);
  });
  it('drops lone page numbers only in the margins', () => {
    expect(isBoilerplate({ y: 40, segments: [{ x: 298, text: '7' }] }, p)).toBe(true);
    expect(isBoilerplate({ y: 400, segments: [{ x: 298, text: '7' }] }, p)).toBe(false);
  });
  it('keeps question text', () => {
    expect(isBoilerplate({ y: 500, segments: [{ x: 60, text: '1. What is a finance exam?' }] }, p)).toBe(false);
  });
});

describe('groupLines', () => {
  const it_ = (x: number, y: number, s: string, w = s.length * 5, h = 10): Item => ({ x, y, w, h, s });
  it('splits two-column option rows at the column gap', () => {
    const lines = groupLines([it_(99, 600, 'A. awarding damages'), it_(324, 600, 'C. providing notice')]);
    expect(lines[0].segments.map((s) => s.text)).toEqual(['A. awarding damages', 'C. providing notice']);
  });
  it('does not let a wide space item bridge the column gap', () => {
    const lines = groupLines([
      it_(117, 600, 'provided positive effects.', 196),
      it_(314, 600, ' ', 1),
      it_(324, 600, 'C.', 10),
      it_(334, 600, ' ', 1),
      it_(342, 600, 'offered little value.', 120),
    ]);
    expect(lines[0].segments.map((s) => s.text)).toEqual(['provided positive effects.', 'C. offered little value.']);
  });
  it('re-homes superscripts onto their line', () => {
    const lines = groupLines([
      it_(81, 600, 'equal to $8,000 / (1 + 0.04)', 278),
      it_(359, 603, '3', 3.6, 6.5),
      it_(363, 600, '. Next', 30),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].segments[0].text).toBe('equal to $8,000 / (1 + 0.04)^3. Next');
  });
  it('turns superscript ordinals into plain text', () => {
    expect(fixOrdinals('Law (8^thed.)')).toBe('Law (8th ed.)');
    expect(fixOrdinals('(2^nd ed.)')).toBe('(2nd ed.)');
  });
  it('merges a lone question-number marker with its text', () => {
    const lines = groupLines([it_(66, 600, '1.', 8), it_(81, 600, 'A basic principle')]);
    expect(lines[0].segments).toEqual([{ x: 66, text: '1. A basic principle' }]);
  });
});

describe('layoutTable', () => {
  it('aligns rows to the widest row and folds wrapped cells', () => {
    const rows = [
      [{ x: 90, text: '52-WEEK' }, { x: 498, text: 'YLD' }],
      [{ x: 90, text: 'HI' }, { x: 128, text: 'LO' }, { x: 173, text: 'STOCK' }, { x: 498, text: '%' }],
      [{ x: 93, text: '37.03' }, { x: 130, text: '26.62' }, { x: 173, text: 'Home Depot' }, { x: 500, text: '2.7' }],
      [{ x: 180, text: '(HD)' }],
    ];
    expect(layoutTable(rows)).toEqual([
      ['52-WEEK', '', '', 'YLD'],
      ['HI', 'LO', 'STOCK', '%'],
      ['37.03', '26.62', 'Home Depot (HD)', '2.7'],
    ]);
  });
});

// A miniature exam with 3 questions exercising both layouts, a cover page, a key cover and a page break.
function miniExam(): Page[] {
  return [
    page(1, [L([420, 'Competency-Based']), L([158, 'Finance Cluster Exam']), L([72, 'CAUTION: Posting these materials…'])]),
    page(2, [
      L([60, '2020 HS ICDC'], [248, 'FINANCE CLUSTER EXAM'], [536, '1']),
      L([66, '1. A basic principle of procedural due process involves'], ),
      L([81, '__________ before taking action.']),
      L([99, 'A. awarding damages'], [324, 'C. providing notice']),
      L([99, 'B. obtaining witnesses'], [324, 'D. creating evidence']),
      L([66, '2. Which of the following potential compliance issues would temporal reasoning detect:']),
      L([99, 'A. A travel-expense account has a credit balance at the end of an accounting period rather than a']),
      L([117, 'debit balance.']),
      L([99, 'B. Purchase orders are similar.']),
      L([144, 'Copyright © 2020 by MBA Research and Curriculum Center, Columbus, Ohio']),
    ]),
    page(3, [
      L([60, '2020 HS ICDC'], [248, 'FINANCE CLUSTER EXAM'], [536, '2']),
      L([99, 'C. A new customer placed a large order.']),
      L([99, 'D. Jack changed a vendor file so funds would be']),
      L([117, 'diverted to his account.']),
      L([66, '3. Analyze the table.']),
      L([90, 'HI'], [128, 'LO'], [173, 'STOCK']),
      L([90, '37.03'], [128, '26.62'], [173, 'HD']),
      L([81, 'Which is true:']),
      L([99, 'A. One'], [324, 'C. Three']),
      L([99, 'B. Two'], [324, 'D. Four']),
    ]),
    page(4, [L([448, 'KEY']), L([72, 'This comprehensive exam was developed by…'])]),
    page(5, [
      L([60, '2020 HS ICDC FINANCE CLUSTER EXAM—KEY 1']),
      L([66, '1. C']),
      L([81, 'Providing notice. Due process is the concept that the government must respect all of the legal']),
      L([81, 'rights owed to individuals.']),
      L([81, 'SOURCE: BL:070 Explain the nature of legal procedure']),
      L([81, 'SOURCE: McAdams, T. (2007). Law, business, and society (8th ed.) [pp. 199-200]. Boston: McGraw-']),
      L([135, 'Hill/Irwin.']),
      L([66, '2. A']),
      L([81, 'A travel-expense account has a credit balance at the end of an accounting period rather than a debit']),
      L([81, 'balance. Temporal reasoning considers timing.']),
      L([81, 'SOURCE: FI:337 Explain types of financial markets (e.g., money market, capital market,']),
      L([109, 'commodities markets, etc.)']),
      L([81, 'SOURCE: LAP-FI-337']),
      L([66, '3. B']),
      L([81, 'Two. Because.']),
      L([81, 'SOURCE: FI:275']),
      L([81, 'SOURCE: QS LAP 37—Table Talk']),
    ]),
  ];
}

describe('parsePages', () => {
  const parsed = parsePages(miniExam(), 3);
  it('finds every question and key entry', () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.questions.map((q) => q.number)).toEqual([1, 2, 3]);
    expect(parsed.keys.map((k) => [k.number, k.correct])).toEqual([
      [1, 'C'],
      [2, 'A'],
      [3, 'B'],
    ]);
  });
  it('reads two-column options in A,C,B,D order', () => {
    expect(parsed.questions[0].optionOrder.join('')).toBe('ACBD');
    expect(parsed.questions[0].options.C).toEqual(['providing notice']);
  });
  it('joins wrapped options across a page break and strips the footer', () => {
    const q = parsed.questions[1];
    expect(joinLines(q.options.A!)).toBe(
      'A travel-expense account has a credit balance at the end of an accounting period rather than a debit balance.',
    );
    expect(joinLines(q.options.D!)).toBe('Jack changed a vendor file so funds would be diverted to his account.');
  });
  it('captures an embedded table as its own stem block', () => {
    expect(parsed.questions[2].stem.map((b) => b.kind)).toEqual(['text', 'table', 'text']);
  });
  it('reads PI code, wrapped description and reference', () => {
    const [k1, k2, k3] = parsed.keys;
    expect(k1.piCode).toBe('BL:070');
    expect(joinLines(k1.piDescriptionLines)).toBe('Explain the nature of legal procedure');
    expect(joinLines(k1.referenceLines)).toContain('McGraw-Hill/Irwin.');
    expect(joinLines(k2.piDescriptionLines)).toBe(
      'Explain types of financial markets (e.g., money market, capital market, commodities markets, etc.)',
    );
    expect(k3.piCode).toBe('FI:275');
    expect(k3.piDescriptionLines).toEqual([]);
  });
});

describe('buildExamQuestions', () => {
  it('builds clean questions and renders tables as pipe rows', () => {
    const { questions } = buildExamQuestions(parsePages(miniExam(), 3), meta, areas);
    expect(questions.map((q) => q.needsReview)).toEqual([false, false, false]);
    expect(questions[0]).toMatchObject({
      id: 't-1',
      correct: 'C',
      piCode: 'BL:070',
      instructionalArea: 'Business Law',
      options: { A: 'awarding damages', B: 'obtaining witnesses', C: 'providing notice', D: 'creating evidence' },
    });
    expect(questions[2].question).toBe('Analyze the table.\n| HI | LO | STOCK |\n| 37.03 | 26.62 | HD |\nWhich is true:');
  });
  it('flags missing options and never invents them', () => {
    const pages = miniExam();
    pages[2].lines = pages[2].lines.filter((l) => !l.segments[0].text.startsWith('C. A new'));
    const { questions } = buildExamQuestions(parsePages(pages, 3), meta, areas);
    expect(questions[1].needsReview).toBe(true);
    expect(questions[1].options.C).toBe('');
    expect(questions[1].reviewNotes.join()).toMatch(/option C is missing/);
  });
  it('flags a key letter that disagrees with the rationale', () => {
    const pages = miniExam();
    const line = pages[4].lines.find((l) => l.segments[0].text === '1. C')!;
    line.segments[0].text = '1. B';
    const { questions } = buildExamQuestions(parsePages(pages, 3), meta, areas);
    expect(questions[0].needsReview).toBe(true);
    expect(questions[0].reviewNotes.join()).toMatch(/restates option C but key says B/);
  });
  it('flags unknown PI prefixes', () => {
    const { questions } = buildExamQuestions(parsePages(miniExam(), 3), meta, { BL: 'Business Law' });
    expect(questions[1].instructionalArea).toBe('Unknown');
    expect(questions[1].needsReview).toBe(true);
  });
});

describe('dedupe and PI descriptions', () => {
  it('merges identical questions even with reordered options and keeps each exam order', () => {
    const a = buildExamQuestions(parsePages(miniExam(), 3), meta, areas).questions;
    const pages = miniExam();
    // swap A and C text in question 1 of the second exam
    const row = pages[1].lines[3];
    row.segments = [
      { x: 99, text: 'A. providing notice' },
      { x: 324, text: 'C. awarding damages' },
    ];
    pages[4].lines.find((l) => l.segments[0].text === '1. C')!.segments[0].text = '1. A';
    pages[4].lines[2].segments[0].text = 'Providing notice. Due process…';
    const bMeta = { ...meta, id: 'u' };
    const b = buildExamQuestions(parsePages(pages, 3), bMeta, areas).questions;
    const r = dedupe([
      { meta, questions: a },
      { meta: bMeta, questions: b },
    ]);
    expect(r.questions).toHaveLength(3);
    expect(r.conflicts).toEqual([]);
    expect(r.examOrder.get('u')!.slice(0, 3)).toEqual(['t-1', 't-2', 't-3']);
    expect(r.questions[0].appearances).toEqual([
      { exam: 't', number: 1 },
      { exam: 'u', number: 1 },
    ]);
  });
  it('fills a missing PI description from another question with the same code', () => {
    const qs = buildExamQuestions(parsePages(miniExam(), 3), meta, areas).questions;
    qs[2].piCode = 'BL:070';
    expect(qs[2].piDescription).toBe('');
    expect(fillPiDescriptions(qs)).toBe(1);
    expect(qs[2].piDescription).toBe('Explain the nature of legal procedure');
    expect(qs[2].piDescriptionFrom).toBe('t');
  });
});

describe('detectMeta', () => {
  it('reads year, level and test number from the cover', () => {
    const p = page(1, [L([405, 'for State/Province Use']), L([405, 'Test Number 1312'])]);
    expect(detectMeta([p], 'x.pdf')).toMatchObject({ level: 'State', testNumber: '1312' });
    const icdc = page(1, [L([405, '2025 HS ICDC'])]);
    expect(detectMeta([icdc], 'y.pdf')).toMatchObject({ id: '2025-icdc', level: 'ICDC', year: 2025 });
  });
  it('normalizes text for comparisons', () => {
    expect(normalize('“Don’t”  Stop!')).toBe(normalize('"Don\'t" stop'));
  });
});
