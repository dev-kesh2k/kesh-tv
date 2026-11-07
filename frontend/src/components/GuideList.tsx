import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Channel, hhmm, programmeProgress, toggleFavorite } from '../api';
import { ChannelLogo } from './ChannelCard';

/**
 * Canais ao vivo como grade de programação: número, logo, nome e o que está no ar (com a barra do horário),
 * o próximo programa em telas bem largas. Lê como o guia de TV impresso e funciona bem com as setas do controle.
 */
export function GuideList({ channels, onChange }: { channels: Channel[]; onChange?: (c: Channel) => void }) {
  return (
    <ol className="divide-y divide-ink-800 border-y border-ink-800">
      {channels.map((c) => (
        <GuideRow key={c.id} channel={c} onChange={onChange} />
      ))}
    </ol>
  );
}

function GuideRow({ channel: c, onChange }: { channel: Channel; onChange?: (c: Channel) => void }) {
  const [busy, setBusy] = useState(false);
  const fav = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      onChange?.({ ...c, favorite: await toggleFavorite(c) });
    } finally {
      setBusy(false);
    }
  };
  const progress = c.now ? Math.min(0.99, programmeProgress(c.now)) : 0;
  return (
    <li>
      <Link
        to={`/assistir/${c.id}`}
        className="group grid min-h-[64px] grid-cols-[2.75rem_4.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 px-1 py-2 transition-colors hover:bg-ink-900 sm:grid-cols-[3.25rem_5.5rem_minmax(0,1fr)_minmax(0,1.3fr)_2.75rem] 2xl:grid-cols-[3.25rem_5.5rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_2.75rem]"
      >
        <span className="text-right text-lg font-semibold text-slate-500 group-hover:text-brand">{c.number ?? ''}</span>
        <ChannelLogo channel={c} compact className="aspect-video w-full rounded-[4px] !p-1.5" />
        <div className="min-w-0">
          <p className="font-display truncate text-[1.05rem] leading-tight text-slate-100">{c.name}</p>
          {/* No celular o programa no ar fica embaixo do nome. */}
          <p className="truncate text-xs text-slate-400 sm:hidden">{c.now ? c.now.title : c.group}</p>
        </div>
        <div className="hidden min-w-0 sm:block">
          {c.now ? (
            <>
              <p className="truncate text-sm text-slate-200">{c.now.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-[3px] flex-1 bg-ink-700">
                  <div className="h-full bg-brand" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="shrink-0 text-xs text-slate-500">até {hhmm(c.now.stop)}</span>
              </div>
            </>
          ) : (
            <p className="truncate text-sm text-slate-500">{c.group || 'Sem programação'}</p>
          )}
        </div>
        <p className="hidden min-w-0 truncate text-sm text-slate-500 2xl:block">{c.next ? `${hhmm(c.next.start)} ${c.next.title}` : ''}</p>
        <button
          type="button"
          onClick={fav}
          aria-label={c.favorite ? 'Tirar dos favoritos' : 'Favoritar'}
          className="grid h-11 w-11 place-items-center text-slate-500 hover:text-brand"
        >
          <Heart className={`h-[18px] w-[18px] ${c.favorite ? 'fill-brand text-brand' : ''}`} />
        </button>
      </Link>
    </li>
  );
}
