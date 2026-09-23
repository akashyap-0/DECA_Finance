# DECA Finance Cluster Exam PDF format

Findings from inspecting the text of every PDF in `exams/`. Positioned text dumps are in
`scratch/raw/*.txt` (regenerate with `npm run extract-raw`). Each dump line looks like
`[ 99] A. awarding damages  ||  [324] C. providing notice`: the bracketed number is the x
position in PDF points (page width 612) and `||` marks a big horizontal gap between two
text runs on the same baseline.

## The files

The repo has 20 PDFs. There are 17 distinct exams:

| File | Exam | Level | Pages | Option layout | PI descriptions |
|---|---|---|---|---|---|
| 2011_finance_icdc_exam.pdf | 2011 HS ICDC | ICDC | 36 | 2-column | no |
| 2012_finance_icdc_exam.pdf | 2012 HS ICDC | ICDC | 34 | 2-column | no |
| 2013_finance_sample_exam.pdf | Sample (posted March 2014) | Sample | 31 | 2-column | no |
| 2014_finance_sample_exam.pdf | **byte-identical copy of the 2013 file** | — | 31 | — | — |
| 2015_finance_sample_exam.pdf | Sample (posted March 2015) | Sample | 35 | 1-column | no |
| 2016_finance_sample_exam.pdf | Test 1123 sample | Sample | 34 | 1-column | no |
| 2017_finance_sample_exam.pdf | Test 1143 sample | Sample | 35 | 1-column | no |
| 2018_finance_sample_exam.pdf | Test 1163 sample | Sample | 34 | 1-column | no |
| 2019_finance_sample_exam.pdf | Test 1184 sample | Sample | 33 | 1-column | no |
| …C20_FIN_Tp (1).pdf | 2020 HS ICDC | ICDC | 33 | 2-column | no |
| …1255T_FIN_B22 (1).pdf | Test 1255 (2022 State/Province) | State | 32 | 2-column | yes |
| …C22_FIN_T (1).pdf | 2022 HS ICDC | ICDC | 35 | 2-column | no |
| …HS_Finance_Cluster_Sample_Exam_17.pdf | Test 1143 (District/Regional booklet) | District | 36 | 1-column | no |
| …DECA-ICDC-23-Exam-Finance (1).pdf | 2023 HS ICDC | ICDC | 41 | 1-column | yes |
| …HS_Finance_Cluster_Sample_Exam_24.pdf | Test 1286 sample | Sample | 40 | 1-column | yes |
| …1312_FIN_T_B25.pdf | Test 1312 (2025 State/Province) | State | 41 | 1-column | yes |
| …1312_FIN_T_B25 (1).pdf | **byte-identical copy of the file above** | — | — | — | — |
| …C25_HS_FIN_exam (1).pdf | 2025 HS ICDC | ICDC | 43 | 1-column | yes |
| …24-25_Finance District Exam.pdf | Test 1305 (2024-25 District) | District | 39 | 1-column | yes |
| …Finance-District Exam.pdf | Test 1324 (2025-26 District, © 2026) | District | 39 | 1-column | yes (99/100) |

Notes:

* The brief mentioned 11 exams. The folder actually has 20 files, which come to 17 distinct
  exams once byte-identical copies are removed. The parser keeps every distinct exam (see DECISIONS.md).
* `2017_finance_sample_exam.pdf` and `…HS_Finance_Cluster_Sample_Exam_17.pdf` are both
  **Test 1143** but they are different PDFs (sample layout and district booklet layout). They share
  the same questions, so question-level deduplication collapses them.
* Every PDF has a real text layer. None is image-only, so OCR was not needed. The only images
  are logos on the cover pages (checked with the pdfjs operator list; no figures or charts
  appear in any question).

## Page structure

1. **Cover page(s)** (every file except 2011, 2012). Examples: "Competency-Based Competitive
   Events *Written Exam* / 2025 HS ICDC / Booklet Number ___ / Finance Cluster Exam / ACT – …",
   or "SAMPLE EXAM / FINANCE CAREER CLUSTER / THE FINANCE CAREER CLUSTER EXAM IS USED FOR THE
   FOLLOWING EVENTS …". There is also a long copyright/caution paragraph. None of this is question content.
2. **Questions 1–100**, in order.
3. **Key cover** (2020+ booklets only): a copy of the cover page with a large "KEY" at the top.
4. **Answer key with rationales**: entries 1–100, in order.

## Running headers, footers, page numbers

The running header is the first line on each content page. Its styles are:

* `2011 HS ICDC   FINANCE CLUSTER EXAM   1` (three runs: left, centre, right page number)
* `SAMPLE FINANCE CLUSTER EXAM` (2013). Here the page number is a separate lone number at the
  bottom centre (`[298] 1`).
* `SAMPLE FINANCE CLUSTER EXAM   1` (2015)
* `Test 1123 FINANCE CLUSTER EXAM 1` (2016–2019, 2024, district booklets)
* `Test 1324 FINANCE EXAM 1` (2025-26 district, which drops the word "CLUSTER")
* Key pages add `—KEY`: `2025 HS ICDC FINANCE CLUSTER EXAM—KEY 1`.
* **Quirk:** in `2016_finance_sample_exam.pdf` the question pages 3–13 are wrongly headed
  `…EXAM—KEY n`. So the parser cannot use the header to tell questions from key pages. It
  uses the content instead: the first `1. B` style line starts the key.

The footer is `®` (a separate tiny run) plus
`Copyright © 2011 by MBA Research and Curriculum Center, Columbus, Ohio`. Some pages have no footer.

Page numbers restart at 1 in the key section.

## Question layout

* The question number starts the line, e.g. `1. A basic principle…`. Its x position is about
  61–67 in older layouts and about 40–50 in 2023+ layouts. Three-digit `100.` sits a few points further left.
* Stem continuation lines are indented (x≈81 old, x≈61 new) and wrap freely, so they are joined with spaces.
* Many stems end mid-sentence ("Walt was the victim of") and the options complete them.
  Stems ending in `:` or `?` are full questions.
* **Options** always use `A.`–`D.`:
  * **Two-column** (2011–2013, 2020, 2022): `A. …` at x≈99 and `C. …` at x≈324 on the same
    baseline, then `B. …` and `D. …`. When an option is long, the whole question switches to one
    column (A, B, C, D stacked at x≈99).
  * **One-column** (2015–2019, 2023+): options stacked at x≈99 (old) or x≈61 (new).
  * Wrapped option text continues on the next line with a deeper indent (x≈117 old, ≈73 new).
* **Tables.** One question (a Home Depot securities table, in the 2011 ICDC and 2019 sample exams) has a
  small stock table inside the stem. It appears as lines with many separated runs.
* **Superscripts.** Formula exponents such as `(1 + i)^n` and edition ordinals such as `8th ed.`
  are separate, smaller text runs (6.5pt against 10pt body) placed about 3pt above the baseline.
  The extractor puts them back on their line as `^n` / `^(n X t)`, and ordinals become plain `8th`.

## Answer key layout

Each entry looks like this:

```
1. B
Has a sense of humor. You don't have to be a stand-up comedian, but … (rationale, wraps)
SOURCE: EI:006 Demonstrate adaptability
SOURCE: LAP-EI-006—Go With the Flow (Demonstrating Adaptability)
```

* `N. L` alone on a line gives the number and the correct letter.
* The rationale follows. It usually begins by restating the correct option's text.
* The first `SOURCE:` line holds the **Performance Indicator**: `XX:NNN` plus, in 2022-State and
  2023+ exams, the PI description. The description can wrap onto an indented line
  (e.g. `FI:337 Explain types of financial markets (e.g., money market, capital market,` /
  `commodities markets, etc.)`).
* Older exams (2011–2022 ICDC and the 2013–2019 samples) give only the code, e.g. `SOURCE: CR:001`.
* The second `SOURCE:` line is a bibliographic reference (textbook, LAP, or URL). It wraps
  with deeper indents.
* The Test 1324 exam has one entry whose PI line lacks a description.

## PI prefixes seen (→ instructional area)

These are the prefixes in the exams, with the instructional area names used by DECA/MBA Research:

| Prefix | Instructional area | Count (all files) |
|---|---|---|
| BL | Business Law | 128 |
| CC | Compliance (legacy 2011–2013 code; mapped to Business Law, see DECISIONS.md) | 14 |
| CO | Communication Skills | 109 |
| CR | Customer Relations | 97 |
| EC | Economics | 124 |
| EI | Emotional Intelligence | 165 |
| EN | Entrepreneurship | 8 |
| FI | Financial Analysis | 476 |
| FM | Financial-Information Management | 229 |
| HR | Human Resources Management | 13 |
| MK | Marketing | 20 |
| NF | Information Management | 122 |
| OP | Operations | 116 |
| PD | Professional Development | 246 |
| RM | Risk Management | 125 |
| SM | Strategic Management | 8 |

The mapping is stored in `scripts/pi-areas.json`.

## Differences between years and levels

* **2011–2012 ICDC**: no cover page, 2-column options, code-only PIs.
* **2013/2015 samples**: a single cover page with a copyright paragraph and "SAMPLE" headers.
  2013 has its page number in the footer.
* **2016–2019 samples**: "SAMPLE EXAM FINANCE CAREER CLUSTER" cover and `Test NNNN` headers.
  2016 has the mislabelled KEY headers.
* **2020–2022 ICDC and State**: "Competency-Based Competitive Events" booklet cover, 2-column options.
  The 2022 state exam (1255) is the first with PI descriptions.
* **2023+**: new typography (question x≈49, options x≈61), always 1-column, PI descriptions,
  and a separate KEY cover page.
* The questions are the same kind at every level. District, State and ICDC exams all have 100 items.
