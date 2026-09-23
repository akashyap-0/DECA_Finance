import { useEffect, useRef } from 'react';

/** Global keydown handler that ignores typing in form fields and modified keys. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
        return;
      ref.current(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

/** Maps A-D / 1-4 to a letter. */
export function keyToLetter(key: string): 'A' | 'B' | 'C' | 'D' | null {
  const k = key.toUpperCase();
  if (k === 'A' || k === '1') return 'A';
  if (k === 'B' || k === '2') return 'B';
  if (k === 'C' || k === '3') return 'C';
  if (k === 'D' || k === '4') return 'D';
  return null;
}
