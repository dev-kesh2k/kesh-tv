import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none';
export const btnPrimary = `${btn} bg-brand text-white hover:bg-brand-dark`;
export const btnGhost = `${btn} bg-ink-800 text-slate-200 hover:bg-ink-700`;
export const btnDanger = `${btn} bg-red-500/10 text-red-300 hover:bg-red-500/20`;
export const input =
  'w-full min-h-[44px] rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-[16px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
export const card = 'rounded-2xl border border-ink-700/70 bg-ink-900';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink-800 text-slate-400">{icon}</div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {children && <div className="mt-2 text-sm text-slate-400">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">{message}</div>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] items-center gap-3 text-sm text-slate-300"
    >
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}
