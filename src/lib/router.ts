import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function read(): string {
  return window.location.hash.replace(/^#/, '') || '/practice';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const h = useSyncExternalStore(subscribe, read, () => '/practice');
  const [path, query = ''] = h.split('?');
  return { path, params: new URLSearchParams(query) };
}

export function navigate(to: string) {
  window.location.hash = to;
}
