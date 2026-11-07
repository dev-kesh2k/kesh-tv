import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Heart, Clapperboard, Tv, X } from 'lucide-react';
import { apiUrl, Channel, groupLabel, programmeProgress, Series, seriesLink, toggleFavorite } from '../api';

const KIND_ICON = { live: Tv, movie: Film, series: Clapperboard };

// Palavras que não identificam o canal ("Canal 24H Animes" → "24H Animes").
const GENERIC = /^(canal|canais|tv|hd|fhd|uhd|sd|4k|h265|br|the|o|a|de|do|da)$/i;

/** Iniciais que ignoram palavras genéricas: "Canal AdultSwim.br" → "AD", "Globo SP" → "GS". */
export function monogram(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w && !GENERIC.test(w));
  if (!words.length) return '';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Logo do canal; sem logo, um logo de texto: o nome em tipo estreito (cartões) ou iniciais (espaços pequenos,
 * `compact`). Fundo liso — o nome do canal é a identidade, não um degradê genérico.
 */
export function ChannelLogo({ channel, className = '', compact = false }: { channel: Channel; className?: string; compact?: boolean }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>(channel.logo ? 'loading' : 'failed');
  const Icon = KIND_ICON[channel.kind] || Tv;
  const mono = monogram(channel.name);
  return (
    <div className={`relative grid place-items-center overflow-hidden bg-ink-800 text-slate-300 ${className}`}>
      {state !== 'ok' &&
        (compact ? (
          mono ? <span className="font-display text-base">{mono}</span> : <Icon className="h-5 w-5" />
        ) : (
          <span className="font-display line-clamp-3 px-3 text-center text-[1.15rem] leading-tight text-slate-200">{channel.name}</span>
        ))}
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

export function ChannelCard({ channel, onChange, onRemove }: { channel: Channel; onChange?: (c: Channel) => void; onRemove?: (c: Channel) => void }) {
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
      className="group relative flex min-w-0 flex-col rounded-[6px] outline-none focus-visible:outline-none"
    >
      <div className="relative overflow-hidden rounded-[6px] ring-brand ring-offset-2 ring-offset-ink-950 transition-shadow group-hover:ring-2 group-focus-visible:ring-[3px]">
        <ChannelLogo channel={channel} className={`w-full ${poster ? 'aspect-[3/4]' : 'aspect-video'}`} />
        {!!channel.progress && <ProgressBar value={channel.progress} className="absolute inset-x-0 bottom-0" />}
        {channel.now && <ProgressBar value={Math.min(0.99, programmeProgress(channel.now))} className="absolute inset-x-0 bottom-0" />}
        {onRemove && (
          <button
            type="button"
            aria-label={`Tirar ${channel.name} da lista`}
            onClick={(e) => {
              e.preventDefault();
              onRemove(channel);
            }}
            className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-[52px] items-start gap-1 pt-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">{channel.name}</p>
          {channel.now ? (
            <p className="mt-0.5 truncate text-[11px] text-brand-light" title={`Agora: ${channel.now.title}`}>
              {channel.now.title}
            </p>
          ) : (
            channel.group && <p className="mt-0.5 truncate text-[11px] text-slate-500">{groupLabel(channel.group, channel.kind)}</p>
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

export function ChannelGrid({ channels, onChange, onRemove }: { channels: Channel[]; onChange?: (c: Channel) => void; onRemove?: (c: Channel) => void }) {
  return (
    <div className="tv-grid grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3">
      {channels.map((c) => (
        <ChannelCard key={c.id} channel={c} onChange={onChange} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function SeriesCard({ series }: { series: Series }) {
  const fake = { id: '', name: series.name, group: series.group, kind: 'series', playlistId: series.playlistId, logo: series.logo, favorite: false } as Channel;
  return (
    <Link
      to={seriesLink(series)}
      className="group flex min-w-0 flex-col rounded-[6px] outline-none focus-visible:outline-none"
    >
      <div className="overflow-hidden rounded-[6px] ring-brand ring-offset-2 ring-offset-ink-950 transition-shadow group-hover:ring-2 group-focus-visible:ring-[3px]">
        <ChannelLogo channel={fake} className="aspect-[3/4] w-full" />
      </div>
      <div className="min-h-[52px] pt-2">
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
    <div className="tv-grid grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3">
      {series.map((s) => (
        <SeriesCard key={`${s.playlistId}|${s.name}`} series={s} />
      ))}
    </div>
  );
}

/** Grade de cartões "fantasma" enquanto a lista carrega (evita a tela pular quando os dados chegam). */
export function SkeletonGrid({ count = 12, poster = false }: { count?: number; poster?: boolean }) {
  return (
    <div className="tv-grid grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className={`w-full animate-pulse rounded-[6px] bg-ink-800 ${poster ? 'aspect-[3/4]' : 'aspect-video'}`} />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-ink-800" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-800/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fileira horizontal de cartões (atalhos no topo da página). */
export function Shelf({ title, channels }: { title: string; channels: Channel[] }) {
  if (!channels.length) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-300">{title}</h2>
      <div className="no-scrollbar -mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {channels.map((c) => (
          <div key={c.id} className={`shrink-0 snap-start ${c.kind === 'live' ? 'w-40 sm:w-48' : 'w-32 sm:w-36'}`}>
            <ChannelCard channel={c} />
          </div>
        ))}
      </div>
    </section>
  );
}
