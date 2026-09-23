// Turns a PDF into pages of positioned text lines using pdfjs-dist.
// Each line is split into "segments" wherever there is a large horizontal gap,
// which is how two-column option layouts (A./C. on the same row) are recovered.
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Line, Page, Segment } from './types.ts';

/** Gap (in PDF points) between text items that starts a new segment. */
export const SEGMENT_GAP = 8;
/** Items whose baselines differ by at most this many points share a line. */
const LINE_TOLERANCE = 2.5;

export interface Item {
  x: number;
  y: number;
  w: number;
  /** Font size (height) of the item. */
  h: number;
  s: string;
}

/** Items at most this tall are candidates for superscripts (body text is 9-10pt). */
const SUPERSCRIPT_MAX_SIZE = 7.5;

export async function readPdfPages(file: string): Promise<Page[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, verbosity: 0, useSystemFonts: false }).promise;
  const pages: Page[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      if (it.str === '') continue;
      items.push({ x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height, s: it.str });
    }
    pages.push({ number: p, width: viewport.width, height: viewport.height, lines: groupLines(items) });
  }
  await doc.cleanup();
  return pages;
}

export function groupLines(items: Item[]): Line[] {
  // Superscripts (exponents in formulas) sit a few points above the baseline of
  // the line they belong to. Re-home them onto that line as "^x" / "^(x y)".
  const body = items.filter((it) => it.h > SUPERSCRIPT_MAX_SIZE);
  items = items.map((it) => {
    if (it.h > SUPERSCRIPT_MAX_SIZE || it.s.trim() === '' || it.s.trim() === '®') return it;
    const host = body.find((b) => it.y - b.y >= 1 && it.y - b.y <= 6);
    if (!host) return it;
    const t = it.s.trim();
    return { ...it, y: host.y, s: '^' + (/[\s]/.test(t) ? `(${t})` : t) };
  });
  const rows: { y: number; items: Item[] }[] = [];
  for (const it of items) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= LINE_TOLERANCE);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  const lines: Line[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const segments: Segment[] = [];
    let cur: Segment | null = null;
    let curEnd = 0;
    for (const it of row.items) {
      const isSpace = it.s.trim() === '';
      const sup = it.s.startsWith('^');
      if (cur && (sup || it.x - curEnd <= SEGMENT_GAP)) {
        cur.text += !sup && it.x - curEnd > 1.5 && !cur.text.endsWith(' ') && !it.s.startsWith(' ') ? ' ' + it.s : it.s;
      } else if (!isSpace) {
        cur = { x: it.x, text: it.s };
        segments.push(cur);
      } else {
        continue;
      }
      // Whitespace items can span a column gap, so they never extend the segment.
      if (!isSpace) curEnd = it.x + it.w;
    }
    // A lone "12." or "C." marker belongs to the text that follows it.
    for (let i = 0; i < segments.length - 1; i++) {
      if (/^\s*((\d{1,3}|[A-D])\.|SOURCE:)\s*$/.test(segments[i].text) && segments[i + 1].x - segments[i].x < 75) {
        segments[i].text = segments[i].text.trim() + ' ' + segments[i + 1].text;
        segments.splice(i + 1, 1);
      }
    }
    const segs = segments
      .map((s) => ({ x: Math.round(s.x * 10) / 10, text: fixOrdinals(s.text.replace(/\s+/g, ' ').trim()) }))
      .filter((s) => s.text !== '');
    if (segs.length) lines.push({ y: Math.round(row.y * 10) / 10, segments: segs });
  }
  return lines;
}

export function lineText(line: Line): string {
  return line.segments.map((s) => s.text).join('  ');
}

/** Superscript ordinals ("8^th ed.") are not math; render them as plain "8th ed.". */
export function fixOrdinals(t: string): string {
  return t.replace(/(\d)\^(st|nd|rd|th)(?=[A-Za-z])/g, '$1$2 ').replace(/(\d)\^(st|nd|rd|th)\b/g, '$1$2');
}
