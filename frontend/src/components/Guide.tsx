import { useEffect, useState } from 'react';
import { api, hhmm, Programme, programmeProgress } from '../api';
import { ProgressBar } from './ChannelCard';

/** Programação do canal ao vivo: o que está passando e os próximos (atualiza a cada minuto). */
export function Guide({ channelId }: { channelId: string }) {
  const [list, setList] = useState<Programme[] | null>(null);
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<{ programmes: Programme[] }>(`channels/${channelId}/epg`)
        .then((r) => alive && setList(r.programmes))
        .catch(() => alive && setList([]));
    load();
    const t = window.setInterval(() => {
      setTick((n) => n + 1);
      // Recarrega quando o programa atual acabou.
      setList((cur) => {
        if (cur?.[0] && Date.parse(cur[0].stop) <= Date.now()) load();
        return cur;
      });
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [channelId]);

  if (!list?.length) return null;
  const [now, ...rest] = list;
  const live = Date.parse(now.start) <= Date.now();
  const upcoming = rest.slice(0, open ? 20 : 4);

  return (
    <section className="mt-6 border-t border-ink-800 pt-5">
      <p className="text-sm text-slate-400">
        {live ? 'No ar' : 'A seguir'}, {hhmm(now.start)} às {hhmm(now.stop)}
      </p>
      <h2 className="font-display mt-1 text-2xl leading-tight text-slate-100">{now.title}</h2>
      {live && <ProgressBar value={Math.min(0.99, programmeProgress(now))} className="mt-2 overflow-hidden rounded-full" />}
      {now.desc && <p className="mt-2 line-clamp-3 text-sm text-slate-400">{now.desc}</p>}

      {upcoming.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-800 border-t border-ink-800">
          {upcoming.map((p) => (
            <li key={p.start} className="flex gap-3 py-2.5 text-sm">
              <span className="w-12 shrink-0 text-sm text-slate-500">{hhmm(p.start)}</span>
              <span className="min-w-0 flex-1 text-slate-200">{p.title}</span>
            </li>
          ))}
        </ul>
      )}
      {rest.length > 4 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 min-h-[40px] text-sm font-semibold text-brand-light">
          {open ? 'Mostrar menos' : `Ver programação (${rest.length})`}
        </button>
      )}
    </section>
  );
}
