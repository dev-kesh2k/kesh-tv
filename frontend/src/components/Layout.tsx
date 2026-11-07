import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { platform } from '../platform';
import { focusFirstContent } from '../spatial';
import { Heart, History, ListVideo, Tv, UserRound } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { BackToTop } from './BackToTop';
import { useAuth } from '../auth';

const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

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
  const { user } = useAuth();
  // TV: destaque já no conteúdo ao trocar de tela (controle remoto funciona de cara).
  useEffect(() => {
    if (platform.tv && !pathname.includes('/assistir/')) focusFirstContent();
  }, [pathname, search]);
  return (
    <div className="min-h-[100dvh]">
      {/* Computador e TV: menu numa barra no topo. Celular: barra de abas embaixo. */}
      <header className="tv-topbar sticky top-0 z-30 hidden border-b border-ink-800 bg-ink-950/95 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-10 px-8">
          <NavLink to="/" aria-label="Kesh TV — início" className="shrink-0">
            <Logo />
          </NavLink>
          <nav className="flex h-full items-stretch gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group -mb-px flex items-center gap-2 border-b-[3px] px-3 text-[0.95rem] transition-colors ${
                    isActive ? 'border-brand font-semibold text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-brand' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          {user && (
            <NavLink to="/conta" title={user.email} className="ml-auto flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 hover:bg-ink-900">
              <span className="min-w-0 text-right text-sm leading-tight">
                <span className="block truncate text-slate-200">{user.name || 'Conta'}</span>
                <span className="block truncate text-xs text-slate-500">{user.email}</span>
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-800 text-xs font-semibold text-slate-300">{initials(user.name || user.email)}</span>
            </NavLink>
          )}
        </div>
      </header>

      <div className="min-w-0 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
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
