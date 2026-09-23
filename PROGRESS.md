# PROGRESS

## Milestones

- [x] M1 Inspect: raw text in `scratch/raw/`, format documented in `docs/exam-format.md`
- [x] M2 Parser: `npm run parse` -> `data/questions.json` (18 exams, 1531 unique questions, 0 flagged). Report in `docs/parse-report.md`. Tests: `scripts/lib/parser.test.ts`, `scripts/data.test.ts`
- [x] M3 Practice: one question at a time with instant feedback (answer, rationale, PI). Filters: area, exam, PI, missed/unseen/bookmarked. Keys: A-D / 1-4 answer, Enter next, S bookmark. Every attempt stored (choice, correct, ts, ms)
- [x] M4 Smart mode (default): due reviews of missed questions (1/3/7-day spaced repetition), then weighted picks favouring the weakest areas/PIs and unseen questions. Daily goal (default 25) with progress bar, goal streak, reviews-due count
- [x] M5 Mock exams: replay a real exam in original order, or a shuffled mix matching the real area distribution. 60-min timer (auto-submits), no feedback until submit, flagging, question navigator, resumes after reload. Results: score, per-area breakdown, time used, review with rationales (missed/flagged/all). History saved
- [ ] M6 Dashboard
- [ ] M7 Polish
