import { useEffect } from 'react';
import { Logo } from './components/Logo';
import { cx } from './components/ui';
import { PracticePage } from './pages/Practice';
import { MockPage } from './pages/Mock';
import { DashboardPage } from './pages/Dashboard';
import { navigate, useRoute } from './lib/router';
import { useAppState } from './lib/storage';

const NAV = [
  { path: '/practice', label: 'Practice', icon: 'M4 6h16M4 12h10M4 18h7' },
  { path: '/mock', label: 'Mock exam', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { path: '/dashboard', label: 'Dashboard', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

function useTheme() {
  const { theme } = useAppState().settings;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useTheme();
  const route = useRoute();
  let page: React.ReactNode;
  switch (route.path) {
    case '/dashboard':
      page = <DashboardPage />;
      break;
    case '/mock':
      page = <MockPage params={route.params} />;
      break;
    default:
      page = <PracticePage key={route.params.toString()} params={route.params} />;
  }
  return (
    <div className="min-h-dvh pb-20 sm:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <button onClick={() => navigate('/practice')} aria-label="kash2finance home">
            <Logo />
          </button>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <a
                key={n.path}
                href={`#${n.path}`}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  route.path === n.path
                    ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-4 sm:py-6">{page}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
        {NAV.map((n) => (
          <a
            key={n.path}
            href={`#${n.path}`}
            className={cx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold',
              route.path === n.path ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500',
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
