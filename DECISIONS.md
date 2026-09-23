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
