# PROGRESS

## Start Here

```bash
git checkout claude/kash2finance   # all work is on this branch (see note on pushing below)
npm install
npm run dev                        # open http://localhost:5173
```

Check these first:

1. **Practice** (the default page): answer with `A`–`D`. The feedback should show the correct answer,
   the rationale and the PI. Press `Enter` for the next question.
2. **Mock exam**: start a replay of any exam and check that the timer counts down. Answer a few questions,
   flag one, then Submit and look at the results page.
3. **Dashboard**: after a few answers the heatmap fills in. Tap an area to see its PIs.
4. **Settings**: export your progress once, to confirm the backup works.
5. Skim `docs/parse-report.md` (parse quality) and `DECISIONS.md` (the judgment calls I made).

Verify everything: `npm test` (63 unit tests), `npm run build`, then `npm run smoke` (end-to-end in headless Chromium).

**Pushing:** this repo had no git remote configured in the build environment, so nothing could be pushed.
Every milestone is committed locally on `claude/kash2finance`. To publish it:
`git remote add origin <your-repo-url> && git push -u origin claude/kash2finance`, then merge into `main`.

## Status: all 7 milestones done

- [x] M1 Inspect: raw text in `scratch/raw/`, format documented in `docs/exam-format.md`. No image-only PDFs, so no OCR was needed.
- [x] M2 Parser: `npm run parse` writes `data/questions.json`. 20 PDFs = 18 distinct files = 1800 question slots,
  which dedupe to 1531 unique questions. 0 are flagged. 1530/1531 rationales restate the keyed answer (the one
  miss is a typo in the source). Report: `docs/parse-report.md`. Tests: `scripts/lib/parser.test.ts`, `scripts/data.test.ts`.
- [x] M3 Practice: one question at a time with instant feedback (answer, rationale, PI). Filters: area, exam,
  PI, missed/unseen/bookmarked. Keys: A-D / 1-4 answer, Enter next, S bookmark. Every attempt is stored
  (choice, correct, timestamp, time taken).
- [x] M4 Smart mode (default): due reviews of missed questions (1/3/7-day spaced repetition), then weighted
  picks favouring the weakest areas/PIs and unseen questions. Daily goal (default 25) with a progress bar,
  a goal streak and a reviews-due count.
- [x] M5 Mock exams: replay a real exam in its original order, or a shuffled mix matching the real area
  distribution. 60-min timer that auto-submits, no feedback until submit, flagging, a question navigator,
  and resume after reload. Results show score, per-area breakdown, time used and a review with rationales
  (missed/flagged/all). History is saved.
- [x] M6 Dashboard: tiles for accuracy, answered, streak and unseen. Area heatmap (diverging around 70%;
  tap to drill into PIs with attempt counts). Weakest 5 PIs with a Practice-these button. Mock score trend
  with a hover tooltip and a table view.
- [x] M7 Polish: responsive layout with a bottom nav on phones, light/dark/system theme, kash2finance name
  and logo, Settings (daily goal, theme, export/import JSON, reset with typed confirmation), option to
  abandon a mock, README.

## Known limitations / ideas for later

- 254 questions come from older exams that print only the PI code (e.g. `BL:070`) and never a description.
  The app shows the code alone for those. Descriptions are never invented.
- Replaying a real exam uses the deduplicated copy of each question. For the 269 merged duplicates, the
  option letters may differ from how that year printed them.
- The two table questions render as HTML tables recovered from the PDF layout. Worth a quick look:
  2011 ICDC #47 and 2017 District (Test 1143) #78.
- Progress lives in one browser's localStorage. Use Settings → Export for backups.
