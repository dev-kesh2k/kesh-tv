import { NavLink, Outlet } from 'react-router-dom';
import { Heart, History, ListVideo, Tv, UserRound } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

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
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9" />
      <span className="text-lg font-bold tracking-tight">
        Kesh <span className="text-brand">TV</span>
      </span>
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-[100dvh] lg:flex">
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? 'bg-brand/15 text-brand-light' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100'}`
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
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-slate-500'}`}
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
