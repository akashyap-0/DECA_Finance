import { describe, expect, it } from 'vitest';
import { createStore, memoryKV, parseState, STORAGE_KEY } from './storage';

const attempt = { qid: 'q1', choice: 'A' as const, correct: true, ts: 1000, ms: 5000, mode: 'practice' as const };

describe('storage', () => {
  it('persists attempts and bookmarks to the backing store', () => {
    const kv = memoryKV();
    const s = createStore(kv);
    s.recordAttempt(attempt);
    s.toggleBookmark('q1');
    const again = createStore(kv);
    expect(again.get().attempts).toEqual([attempt]);
    expect(again.get().bookmarks).toEqual(['q1']);
    s.toggleBookmark('q1');
    expect(s.get().bookmarks).toEqual([]);
  });

  it('round-trips export and import', () => {
    const a = createStore(memoryKV());
    a.recordAttempt(attempt);
    a.setSettings({ dailyGoal: 40, theme: 'dark' });
    const b = createStore(memoryKV());
    b.importJSON(a.exportJSON());
    expect(b.get().attempts).toEqual([attempt]);
    expect(b.get().settings).toMatchObject({ dailyGoal: 40, theme: 'dark' });
  });

  it('rejects files that are not progress exports', () => {
    const s = createStore(memoryKV());
    expect(() => s.importJSON('nope')).toThrow(/not valid JSON/);
    expect(() => s.importJSON('{"foo":1}')).toThrow(/Not a kash2finance/);
    expect(() => s.importJSON('{"app":"kash2finance","version":9,"attempts":[]}')).toThrow(/version/);
  });

  it('drops malformed attempts and clamps settings', () => {
    const st = parseState({
      app: 'kash2finance',
      version: 1,
      attempts: [attempt, { qid: 'x', choice: 'Z' }, null],
      settings: { dailyGoal: -3, theme: 'purple' },
    });
    expect(st.attempts).toHaveLength(1);
    expect(st.settings).toEqual({ dailyGoal: 25, theme: 'system', includeFlagged: false });
  });

  it('survives corrupted saved data', () => {
    const kv = memoryKV();
    kv.setItem(STORAGE_KEY, '{broken');
    expect(createStore(kv).get().attempts).toEqual([]);
  });

  it('reset keeps settings by default', () => {
    const s = createStore(memoryKV());
    s.recordAttempt(attempt);
    s.setSettings({ dailyGoal: 10 });
    s.reset();
    expect(s.get().attempts).toEqual([]);
    expect(s.get().settings.dailyGoal).toBe(10);
  });
});
