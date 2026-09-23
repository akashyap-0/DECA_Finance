// Dumps the positioned text of every PDF in exams/ into scratch/raw/*.txt.
// Each line is printed as "[x] segment  ||  [x] segment" so column layouts are visible.
// Usage: npm run extract-raw
import fs from 'node:fs';
import path from 'node:path';
import { readPdfPages } from './lib/pdf-lines.ts';

const root = path.resolve(import.meta.dirname, '..');
const examsDir = path.join(root, 'exams');
const outDir = path.join(root, 'scratch', 'raw');
fs.mkdirSync(outDir, { recursive: true });

for (const f of fs.readdirSync(examsDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()) {
  const pages = await readPdfPages(path.join(examsDir, f));
  let out = '';
  let chars = 0;
  for (const p of pages) {
    out += `\n===== PAGE ${p.number} (${p.width.toFixed(0)}x${p.height.toFixed(0)}) =====\n`;
    for (const l of p.lines) {
      const t = l.segments.map((s) => `[${String(Math.round(s.x)).padStart(3)}] ${s.text}`).join('  ||  ');
      chars += l.segments.reduce((n, s) => n + s.text.length, 0);
      out += t + '\n';
    }
  }
  fs.writeFileSync(path.join(outDir, f.replace(/\.pdf$/i, '.txt')), out);
  console.log(`${f}: ${pages.length} pages, ${chars} chars${chars < 1000 ? '  <-- possibly image-only' : ''}`);
}
