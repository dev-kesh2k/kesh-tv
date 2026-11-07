import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { btnQuiet } from './ui';

const OPTIONS = [15, 30, 60, 90];

/** Pausa o vídeo depois de X minutos (para quem dorme com a TV ligada). */
export function SleepTimer({ programmeEnd }: { programmeEnd?: string }) {
  const [until, setUntil] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!until) return;
    const t = window.setInterval(() => {
      if (Date.now() >= until) {
        document.querySelector('video')?.pause();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setUntil(null);
      } else setTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [until]);

  const left = until ? Math.max(0, Math.ceil((until - Date.now()) / 60000)) : 0;
  const pick = (ms: number | null) => {
    setUntil(ms);
    setOpen(false);
  };
  const endMs = programmeEnd ? Date.parse(programmeEnd) : 0;

  return (
    <div className="relative">
      <button type="button" className={`${btnQuiet} ${until ? 'text-brand' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Moon className="h-4 w-4" /> {until ? `Desliga em ${left} min` : 'Timer'}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 py-1 shadow-2xl">
          {OPTIONS.map((m) => (
            <button key={m} type="button" onClick={() => pick(Date.now() + m * 60000)} className="block min-h-[40px] w-full px-4 text-left text-sm hover:bg-ink-700">
              Em {m} minutos
            </button>
          ))}
          {endMs > Date.now() && (
            <button type="button" onClick={() => pick(endMs)} className="block min-h-[40px] w-full px-4 text-left text-sm hover:bg-ink-700">
              No fim do programa
            </button>
          )}
          {until && (
            <button type="button" onClick={() => pick(null)} className="block min-h-[40px] w-full border-t border-ink-700 px-4 text-left text-sm text-red-300 hover:bg-ink-700">
              Cancelar timer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
