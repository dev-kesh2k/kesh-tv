import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Heart, Clapperboard, Tv } from 'lucide-react';
import { apiUrl, Channel, programmeProgress, Series, seriesLink, toggleFavorite } from '../api';

const KIND_ICON = { live: Tv, movie: Film, series: Clapperboard };

export function ChannelLogo({ channel, className = '' }: { channel: Channel; className?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>(channel.logo ? 'loading' : 'failed');
  const Icon = KIND_ICON[channel.kind] || Tv;
  const initials = channel.name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={`relative grid place-items-center overflow-hidden ${state === 'ok' ? 'bg-ink-800' : 'bg-gradient-to-br from-ink-700 to-ink-800'} text-slate-300 ${className}`}>
      {state !== 'ok' && (initials ? <span className="text-lg font-bold tracking-wide">{initials}</span> : <Icon className="h-7 w-7" />)}
      {state !== 'failed' && (
        <img
          src={apiUrl(channel.logo)}
          alt=""
          loading="lazy"
          onLoad={() => setState('ok')}
          onError={() => setState('failed')}
          className={`absolute inset-0 m-auto transition-opacity ${channel.kind === 'live' ? 'max-h-[78%] max-w-[78%] object-contain' : 'h-full w-full object-cover'} ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

/** Barrinha do quanto já foi assistido (verde quando terminou). */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1 bg-black/50 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className={`h-full ${value >= 1 ? 'bg-emerald-400' : 'bg-brand'}`} style={{ width: `${Math.max(3, Math.round(value * 100))}%` }} />
    </div>
  );
}

export function ChannelCard({ channel, onChange }: { channel: Channel; onChange?: (c: Channel) => void }) {
  const [busy, setBusy] = useState(false);
  const fav = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      onChange?.({ ...channel, favorite: await toggleFavorite(channel) });
    } finally {
      setBusy(false);
    }
  };
  const poster = channel.kind !== 'live';
  return (
    <Link
      to={`/assistir/${channel.id}`}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900 transition hover:border-brand/60 hover:bg-ink-850 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative">
        <ChannelLogo channel={channel} className={`w-full ${poster ? 'aspect-[3/4]' : 'aspect-video'}`} />
        {!!channel.progress && <ProgressBar value={channel.progress} className="absolute inset-x-0 bottom-0" />}
        {channel.now && <ProgressBar value={Math.min(0.99, programmeProgress(channel.now))} className="absolute inset-x-0 bottom-0" />}
      </div>
      <div className="flex min-h-[52px] items-start gap-1 p-2.5 pr-1">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">{channel.name}</p>
          {channel.now ? (
            <p className="mt-0.5 truncate text-[11px] text-brand-light" title={`Agora: ${channel.now.title}`}>
              {channel.now.title}
            </p>
          ) : (
            channel.group && <p className="mt-0.5 truncate text-[11px] text-slate-500">{channel.group}</p>
          )}
        </div>
        <button
          type="button"
          onClick={fav}
          aria-label={channel.favorite ? 'Tirar dos favoritos' : 'Favoritar'}
          className="-my-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:text-brand"
        >
          <Heart className={`h-[18px] w-[18px] ${channel.favorite ? 'fill-brand text-brand' : ''}`} />
        </button>
      </div>
    </Link>
  );
}

export function ChannelGrid({ channels, onChange }: { channels: Channel[]; onChange?: (c: Channel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3">
      {channels.map((c) => (
        <ChannelCard key={c.id} channel={c} onChange={onChange} />
      ))}
    </div>
  );
}

export function SeriesCard({ series }: { series: Series }) {
  const fake = { id: '', name: series.name, group: series.group, kind: 'series', playlistId: series.playlistId, logo: series.logo, favorite: false } as Channel;
  return (
    <Link
      to={seriesLink(series)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900 transition hover:border-brand/60 hover:bg-ink-850 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <ChannelLogo channel={fake} className="aspect-[3/4] w-full" />
      <div className="min-h-[52px] p-2.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">{series.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {series.seasons > 1 ? `${series.seasons} temporadas · ` : ''}
          {series.episodes} {series.episodes === 1 ? 'episódio' : 'episódios'}
        </p>
      </div>
    </Link>
  );
}

export function SeriesGrid({ series }: { series: Series[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3">
      {series.map((s) => (
        <SeriesCard key={`${s.playlistId}|${s.name}`} series={s} />
      ))}
    </div>
  );
}

/** Grade de cartões "fantasma" enquanto a lista carrega (evita a tela pular quando os dados chegam). */
export function SkeletonGrid({ count = 12, poster = false }: { count?: number; poster?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-ink-700/40 bg-ink-900">
          <div className={`w-full animate-pulse bg-ink-800 ${poster ? 'aspect-[3/4]' : 'aspect-video'}`} />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-ink-800" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-800/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
