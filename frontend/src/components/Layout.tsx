import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { platform } from '../platform';
import { focusFirstContent } from '../spatial';
import { Heart, History, ListVideo, Tv, UserRound } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { BackToTop } from './BackToTop';

const NAV = [
  { to: '/', label: 'Canais', icon: Tv, end: true },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
  { to: '/recentes', label: 'Recentes', icon: History },
  { to: '/listas', label: 'Listas', icon: ListVideo },
  { to: '/conta', label: 'Conta', icon: UserRound },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}icon.svg?v=2`} alt="" className="h-8 w-8" />
      <span className="font-display text-[1.35rem] leading-none text-slate-100">Kesh TV</span>
    </div>
  );
}

export function Layout() {
  const { pathname, search } = useLocation();
  // TV: destaque já no conteúdo ao trocar de tela (controle remoto funciona de cara).
  useEffect(() => {
    if (platform.tv && !pathname.includes('/assistir/')) focusFirstContent();
  }, [pathname, search]);
  return (
    <div className="min-h-[100dvh] lg:flex">
      <aside className="tv-sidebar sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="-mx-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 border-l-[3px] px-3 text-[0.95rem] transition-colors ${isActive ? 'border-brand font-semibold text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-100'}`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        <BackToTop />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-medium ${isActive ? 'border-brand text-slate-100' : 'border-transparent text-slate-500'}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Container padrão das páginas, com respiro do notch no topo do celular. */
export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto w-full px-3 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 lg:px-8 lg:pt-8 ${wide ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
      {children}
    </main>
  );
}
