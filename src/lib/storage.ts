// The only module that touches localStorage. Everything the app remembers lives in one
// versioned JSON blob, which is also the export/import file format.
import { useSyncExternalStore } from 'react';
import type { Letter } from './types';

export type AttemptMode = 'smart' | 'practice' | 'mock';

export interface Attempt {
  qid: string;
  choice: Letter;
  correct: boolean;
  /** Epoch ms when answered. */
  ts: number;
  /** Time spent on the question, ms. */
  ms: number;
  mode: AttemptMode;
}

export interface MockAnswer {
  qid: string;
  choice: Letter | null;
  flagged: boolean;
  ms: number;
}

export interface MockResult {
  id: string;
  kind: 'replay' | 'mix';
  examId?: string;
  label: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  timeLimitMs: number;
  answers: MockAnswer[];
  score: number;
  total: number;
}

export interface ActiveMock {
  id: string;
  kind: 'replay' | 'mix';
  examId?: string;
  label: string;
  startedAt: number;
  timeLimitMs: number;
  answers: MockAnswer[];
  current: number;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  dailyGoal: number;
  theme: Theme;
  /** Show questions the parser flagged as needsReview. Off by default. */
  includeFlagged: boolean;
}

export interface AppState {
  app: 'kash2finance';
  version: 1;
  attempts: Attempt[];
  bookmarks: string[];
  mocks: MockResult[];
  activeMock: ActiveMock | null;
  settings: Settings;
}

export const STORAGE_KEY = 'kash2finance:v1';

export const DEFAULT_SETTINGS: Settings = { dailyGoal: 25, theme: 'system', includeFlagged: false };

export function emptyState(): AppState {
  return {
    app: 'kash2finance',
    version: 1,
    attempts: [],
    bookmarks: [],
    mocks: [],
    activeMock: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function defaultKV(): KV {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      ls.getItem(STORAGE_KEY);
      return ls;
    }
  } catch {
    /* blocked storage: fall through */
  }
  return memoryKV();
}

const LETTER_SET = new Set(['A', 'B', 'C', 'D']);

/** Validates and normalizes unknown JSON into AppState. Throws with a readable message. */
export function parseState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new Error('Not a kash2finance progress file.');
  const r = raw as Record<string, unknown>;
  if (r.app !== 'kash2finance') throw new Error('Not a kash2finance progress file (missing "app" marker).');
  if (r.version !== 1) throw new Error(`Unsupported progress file version: ${String(r.version)}`);
  const s = emptyState();
  if (!Array.isArray(r.attempts)) throw new Error('Progress file has no attempts list.');
  s.attempts = r.attempts.filter(
    (a): a is Attempt =>
      !!a &&
      typeof a.qid === 'string' &&
      LETTER_SET.has(a.choice) &&
      typeof a.correct === 'boolean' &&
      typeof a.ts === 'number' &&
      typeof a.ms === 'number',
  );
  for (const a of s.attempts) if (!['smart', 'practice', 'mock'].includes(a.mode)) a.mode = 'practice';
  s.bookmarks = Array.isArray(r.bookmarks) ? r.bookmarks.filter((b): b is string => typeof b === 'string') : [];
  s.mocks = Array.isArray(r.mocks)
    ? (r.mocks as MockResult[]).filter((m) => m && typeof m.id === 'string' && Array.isArray(m.answers))
    : [];
  s.activeMock =
    r.activeMock && typeof r.activeMock === 'object' && Array.isArray((r.activeMock as ActiveMock).answers)
      ? (r.activeMock as ActiveMock)
      : null;
  const st = (r.settings ?? {}) as Partial<Settings>;
  s.settings = {
    dailyGoal:
      typeof st.dailyGoal === 'number' && st.dailyGoal >= 1 ? Math.min(500, Math.round(st.dailyGoal)) : 25,
    theme: st.theme === 'light' || st.theme === 'dark' ? st.theme : 'system',
    includeFlagged: st.includeFlagged === true,
  };
  return s;
}

export function createStore(kv: KV = defaultKV()) {
  let state: AppState = emptyState();
  try {
    const raw = kv.getItem(STORAGE_KEY);
    if (raw) state = parseState(JSON.parse(raw));
  } catch (e) {
    console.warn('kash2finance: could not read saved progress, starting fresh', e);
  }
  const listeners = new Set<() => void>();

  function set(next: AppState) {
    state = next;
    try {
      kv.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('kash2finance: could not save progress', e);
    }
    listeners.forEach((l) => l());
  }

  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    update(fn: (s: AppState) => AppState) {
      set(fn(state));
    },
    recordAttempt(a: Attempt) {
      set({ ...state, attempts: [...state.attempts, a] });
    },
    toggleBookmark(qid: string) {
      const has = state.bookmarks.includes(qid);
      set({ ...state, bookmarks: has ? state.bookmarks.filter((b) => b !== qid) : [...state.bookmarks, qid] });
    },
    setSettings(patch: Partial<Settings>) {
      set({ ...state, settings: { ...state.settings, ...patch } });
    },
    setActiveMock(m: ActiveMock | null) {
      set({ ...state, activeMock: m });
    },
    finishMock(result: MockResult, attempts: Attempt[]) {
      set({ ...state, activeMock: null, mocks: [...state.mocks, result], attempts: [...state.attempts, ...attempts] });
    },
    exportJSON(): string {
      return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    },
    /** Replaces all progress with the file's contents. Throws on invalid input. */
    importJSON(text: string) {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      set(parseState(raw));
    },
    /** Clears progress; keeps settings unless told otherwise. */
    reset(keepSettings = true) {
      const fresh = emptyState();
      if (keepSettings) fresh.settings = state.settings;
      set(fresh);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export const store = createStore();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
