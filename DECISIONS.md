# DECISIONS

Judgment calls made while building without the owner available.

1. **No git remote configured.** The repo had no `origin`, so pushes are impossible from this
   environment. All work is committed locally on branch `claude/kash2finance`. To publish:
   `git remote add origin <url> && git push -u origin claude/kash2finance`.
2. **Work on a branch, not `main`.** Commits go to `claude/kash2finance` so `main` stays as the
   owner left it. Merge with `git checkout main && git merge claude/kash2finance`.
3. **PDFs moved into `exams/`.** The PDFs were committed at the repo root and deleted in the
   working tree. The brief refers to an `exams` folder, so they were restored and `git mv`'d into `exams/`.
4. **20 files, not 11.** The folder has 20 PDFs, which are 17 distinct exams (two pairs are byte-identical).
   All distinct exams are used. Byte-identical files are skipped by content hash.
5. **Raw text dumps are committed** (`scratch/raw/`) so the format doc can be checked against them
   without re-running anything.
6. **Exam ids and labels are auto-detected** from the cover text: year, level (ICDC / State / District / Sample)
   and Test number. For example `2025-icdc` or `2024-sample-1286`. The year comes from "YYYY HS ICDC", then a year
   prefix in the filename, then the copyright year. To override, add `exams/manifest.json` with
   `{ "<file.pdf>": { "id": "...", "label": "...", "year": 2025, "level": "State" } }`.
7. **`CC` (Compliance) maps to Business Law.** CC is a legacy 2011-2013 PI prefix. Later exams moved
   compliance PIs into BL (e.g. BL:148 "Discuss the nature and scope of compliance in the finance industry").
8. **Missing PI descriptions are filled from other exams with the same PI code.** Such records get
   `piDescriptionFrom: <exam id>`, and the app shows where the description came from. PIs that no exam
   ever printed a description for keep an empty description. Descriptions are never invented.
9. **Deduplication key = normalized stem + sorted normalized options.** Reordered options still count as
   the same question. The first appearance (oldest exam) is kept, and `appearances` lists every exam/number.
   Same-stem questions with different options are kept as separate questions (11 such pairs).
   Replaying a real exam uses the kept copy, so its option letters may differ from that exam's printing.
10. **Test 1143 is in two files** (a 2017 sample and a district booklet). Both are kept. The second is marked
    `duplicateOf` and hidden from the mock-exam replay list.
11. **Tables in stems** (2 questions) are stored as `| cell | cell |` lines inside `question`, and the app
    renders them as HTML tables. These questions carry an informational note but are not flagged.
12. **Consistency check used for flagging:** the rationale always restates the correct option. If a rationale
    restated a different option, the question would be flagged needsReview. 1530/1531 match, and the one
    non-match is a typo in the source ("Understating" vs "Understanding"), so it is noted but not flagged.
