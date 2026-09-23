# kash2finance

A personal, local-only study app for the **DECA Finance cluster exam**. It is built from the official
past exams in `exams/`: 18 exam files, **1,531 unique questions**, each with its answer, rationale and
Performance Indicator (PI).

- **Smart practice** (default) brings back missed questions on a 1/3/7-day spaced-repetition schedule,
  then weights picks toward your weakest instructional areas and PIs, then unseen questions.
  It tracks a daily goal and a streak.
- **Custom practice** filters by instructional area, exam, PI, missed only, unseen only or bookmarked.
- **Mock exams**: 100 questions in 60 minutes with no feedback until you submit. Replay a real exam in
  its original order, or take a shuffled mix that matches the real area distribution. Flag questions,
  jump between them, then review results by area with full rationales.
- **Dashboard**: accuracy, a weakness heatmap with PI drill-down, your weakest 5 PIs, and a mock score trend.
- **Settings**: daily goal, light/dark/system theme, export/import of progress as JSON, and reset.

There is no backend and no account. Progress stays in your browser's localStorage, so export it now and then.

## Run it

Requires Node 20.19+ or 22.12+ (tested on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

For an optimized local build:

```bash
npm run build
npm run preview    # http://localhost:4173
```

`data/questions.json` is committed, so the app works right after cloning. You don't need to parse anything first.

### Keyboard shortcuts

| Where | Keys |
|---|---|
| Practice | `A`–`D` or `1`–`4` answer · `Enter` next · `S` bookmark |
| Mock exam | `A`–`D` / `1`–`4` choose (changeable) · `←` `→` previous/next · `Enter` next · `F` flag |

## Add a new exam PDF

1. Drop the PDF into `exams/`. Any filename works.
2. Run `npm run parse`. This rewrites `data/questions.json` and `docs/parse-report.md`.
3. Open `docs/parse-report.md` and check the new exam's row: it should show 100 questions and 100 key
   entries. Anything the parser could not read cleanly is listed under **Problems**. Those questions get
   `needsReview: true` and are hidden in the app unless you turn them on in Settings.
4. If a PI prefix is new, the report says `unknown PI prefix XX`. Add it to `scripts/pi-areas.json`
   and re-run.
5. Optional: to change the auto-detected exam name, add `exams/manifest.json`:
   ```json
   { "my-file.pdf": { "id": "2026-icdc", "label": "2026 ICDC", "year": 2026, "level": "ICDC" } }
   ```
6. Run `npm test`, then commit `exams/`, `data/questions.json` and `docs/parse-report.md`.

The parser expects the standard MBA Research layout: questions 1–100, then a key with `N. L`, the
rationale, and `SOURCE: XX:NNN …` lines. See `docs/exam-format.md` for the details and quirks.
Byte-identical duplicate PDFs are skipped automatically. Questions that appear in several exams are merged.

**Scanned (image-only) PDFs** have no text layer. The parser skips them and says so in the report.
OCR such a file first (for example `ocrmypdf in.pdf out.pdf`), then put the OCR'd copy in `exams/`.

To inspect a PDF's raw text with x positions, run `npm run extract-raw`, which writes `scratch/raw/*.txt`.

## Tests

```bash
npm test           # unit tests: parser, storage, smart selection, mock builder, data sanity
npm run build      # type-check + production build
npm run smoke      # end-to-end in headless Chromium (run after build); screenshots -> scratch/shots/
                   # first time on a new machine: npx playwright install chromium
```

## Project layout

```
exams/                 source PDFs
scripts/parse-exams.ts npm run parse: PDFs -> data/questions.json + docs/parse-report.md
scripts/lib/           pdf-lines (pdfjs text + positions), parser (state machine), build (validate/dedupe)
scripts/pi-areas.json  PI prefix -> instructional area mapping
data/questions.json    generated question bank (committed)
src/lib/storage.ts     the only module that touches localStorage (plus export/import)
src/lib/smart.ts       smart-mode selection · src/lib/stats.ts statistics · src/lib/mock.ts mock exams
src/pages/             Practice, Mock, Dashboard, Settings
docs/                  exam-format.md, parse-report.md
DECISIONS.md           judgment calls made while building
```
