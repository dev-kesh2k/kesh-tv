import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const btnPrimary = `${btn} bg-brand text-ink-950 hover:bg-brand-dark`;
export const btnGhost = `${btn} bg-ink-800 text-slate-200 hover:bg-ink-700`;
// Ação secundária só em texto (sem fundo): deixa os botões principais em evidência.
export const btnQuiet = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-2 text-sm text-slate-400 transition-colors hover:bg-ink-900 hover:text-slate-100 disabled:opacity-40';
export const btnDanger = `${btn} bg-red-500/10 text-red-300 hover:bg-red-500/20`;
export const input =
  'w-full min-h-[44px] rounded-md border border-ink-700 bg-ink-900 px-3.5 text-[16px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
export const card = 'rounded-md border border-ink-800 bg-ink-900';

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
    <div className="max-w-md py-12">
      <div className="mb-3 text-slate-500">{icon}</div>
      <h3 className="font-display text-xl text-slate-100">{title}</h3>
      {children && <div className="mt-1.5 text-sm text-slate-400">{children}</div>}
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
        <h1 className="font-display text-[1.9rem] leading-tight text-slate-100 sm:text-[2.3rem]">{title}</h1>
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
