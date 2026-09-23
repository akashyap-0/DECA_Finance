# PROGRESS

## Milestones

- [x] M1 Inspect: raw text in `scratch/raw/`, format documented in `docs/exam-format.md`
- [x] M2 Parser: `npm run parse` -> `data/questions.json` (18 exams, 1531 unique questions, 0 flagged). Report in `docs/parse-report.md`. Tests: `scripts/lib/parser.test.ts`, `scripts/data.test.ts`
- [x] M3 Practice: one question at a time with instant feedback (answer, rationale, PI). Filters: area, exam, PI, missed/unseen/bookmarked. Keys: A-D / 1-4 answer, Enter next, S bookmark. Every attempt stored (choice, correct, ts, ms)
- [ ] M4 Smart mode
- [ ] M5 Mock exams
- [ ] M6 Dashboard
- [ ] M7 Polish
