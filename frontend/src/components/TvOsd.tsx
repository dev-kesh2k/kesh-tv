import { useEffect, useRef, useState } from 'react';
import { Channel, hhmm, programmeProgress } from '../api';
import { ChannelLogo, ProgressBar } from './ChannelCard';

/** Painel de informações do player na TV: aparece ao abrir, ao trocar de canal e a cada tecla; some em 5 s. */
export function TvOsd({ channel }: { channel?: Channel }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<number>();
  const show = () => {
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 5000);
  };
  useEffect(() => {
    show();
    window.addEventListener('keydown', show);
    return () => {
      window.removeEventListener('keydown', show);
      window.clearTimeout(timer.current);
    };
  }, [channel?.id]);

  if (!channel) return null;
  const live = channel.kind === 'live';
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-12 pb-10 pt-32 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-end gap-6">
        <ChannelLogo channel={channel} className="h-24 w-40 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {live && <span className="rounded-md bg-red-600 px-2 py-0.5 text-sm font-bold tracking-wider text-white">AO VIVO</span>}
            <span className="truncate text-lg text-slate-300">{channel.group}</span>
          </div>
          <h1 className="mt-1 truncate text-4xl font-bold text-white">{channel.name}</h1>
          {channel.now && (
            <div className="mt-3 max-w-3xl">
              <p className="truncate text-xl text-slate-100">
                <span className="mr-2 text-brand-light">Agora</span>
                {channel.now.title}
                <span className="ml-3 text-base text-slate-400">
                  {hhmm(channel.now.start)} – {hhmm(channel.now.stop)}
                </span>
              </p>
              <ProgressBar value={Math.min(0.99, programmeProgress(channel.now))} className="mt-2 overflow-hidden rounded-full" />
              {channel.next && (
                <p className="mt-2 truncate text-lg text-slate-400">
                  <span className="mr-2">A seguir</span>
                  {channel.next.title} · {hhmm(channel.next.start)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-base text-slate-400">
        <b className="text-slate-200">OK</b> pausa · <b className="text-slate-200">▲▼</b> {live ? 'troca de canal' : 'episódio/item'} · <b className="text-slate-200">◀▶</b> 10 s · <b className="text-slate-200">Voltar</b> sai
      </p>
    </div>
  );
}
