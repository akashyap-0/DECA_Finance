// End-to-end smoke test: serves dist/ with `vite preview` and drives every page in headless Chromium.
// Usage: npm run build && npm run smoke   (screenshots go to scratch/shots/)
/// <reference lib="dom" />
import fs from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { chromium, type Page } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'scratch', 'shots');
fs.mkdirSync(shots, { recursive: true });

const server = await preview({ root, preview: { port: 4179, strictPort: true, open: false }, logLevel: 'silent' });
const base = 'http://localhost:4179/';
const exe = ['/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const errors: string[] = [];
let failed = false;

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed = true;
    console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`);
  }
}
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('kash2finance:v1') ?? '{}'));

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);

  await step('smart practice: answer with keyboard, see rationale, next with Enter', async () => {
    await page.waitForSelector('[role=radiogroup]');
    await page.keyboard.press('2');
    await page.waitForSelector('text=Answer:');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.body.innerText.includes('Answer:'));
    const s = await state(page);
    if (s.attempts.length !== 1 || s.attempts[0].mode !== 'smart') throw new Error('attempt not recorded');
    await page.screenshot({ path: path.join(shots, 'practice.png') });
  });

  await step('custom practice: filter by area and bookmark', async () => {
    await page.click('role=tab[name="Custom"]');
    await page.click('button:has-text("Filters")');
    await page.click('button[aria-pressed]:has-text("Economics")');
    await page.waitForSelector('text=Economics');
    await page.keyboard.press('s');
    const s = await state(page);
    if (s.bookmarks.length !== 1) throw new Error('bookmark not saved');
  });

  await step('mock exam: replay, answer, flag, submit, results', async () => {
    await page.goto(base + '#/mock');
    await page.click('text=Start replay');
    await page.waitForSelector('text=Question 1');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('abcd'[i % 4]);
      if (i === 2) await page.keyboard.press('f');
      await page.keyboard.press('ArrowRight');
    }
    await page.reload();
    await page.waitForSelector('text=Question 6');
    await page.click('button:has-text("Submit")');
    await page.click('text=Submit now');
    await page.waitForSelector('text=By instructional area');
    await page.screenshot({ path: path.join(shots, 'mock-results.png') });
    const s = await state(page);
    if (s.mocks.length !== 1 || s.activeMock) throw new Error('mock not saved');
  });

  await step('dashboard renders heatmap, drill-down and trend', async () => {
    await page.goto(base + '#/dashboard');
    await page.waitForSelector('text=Weakness heatmap');
    await page.click('button[aria-expanded]:has-text("Financial Analysis")');
    await page.waitForSelector('text=Financial Analysis: performance indicators');
    await page.waitForSelector('svg[aria-label="Mock exam score trend"]');
    await page.screenshot({ path: path.join(shots, 'dashboard.png'), fullPage: true });
  });

  await step('settings: export, reset, import round-trip', async () => {
    await page.goto(base + '#/settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Export progress')]);
    const file = path.join(shots, 'export.json');
    await download.saveAs(file);
    const before = (await state(page)).attempts.length;
    await page.fill('input[autocomplete=off]', 'RESET');
    await page.click('text=Reset all progress');
    if ((await state(page)).attempts.length !== 0) throw new Error('reset failed');
    page.once('dialog', (d) => d.accept());
    await page.setInputFiles('input[type=file]', file);
    await page.waitForSelector('text=Imported');
    if ((await state(page)).attempts.length !== before) throw new Error('import did not restore attempts');
  });

  await step('mobile + dark mode layout', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await m.goto(base);
    await m.waitForSelector('[role=radiogroup]');
    const dark = await m.evaluate(() => document.documentElement.classList.contains('dark'));
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (!dark) throw new Error('dark mode not applied');
    if (overflow) throw new Error('horizontal overflow on mobile');
    await m.screenshot({ path: path.join(shots, 'mobile-dark.png') });
  });

  if (errors.length) {
    failed = true;
    console.log('  ✗ console errors:', errors);
  }
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
console.log(failed ? 'SMOKE FAILED' : 'SMOKE OK');
process.exit(failed ? 1 : 0);
