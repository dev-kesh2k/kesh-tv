import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Channel, Episode, useApi } from '../api';
import { ChannelLogo, ProgressBar } from '../components/ChannelCard';
import { Page } from '../components/Layout';
import { btnPrimary, ErrorBox, Spinner } from '../components/ui';
import { useTitle } from '../useTitle';

interface SeriesData {
  name: string;
  group: string;
  logo: string;
  episodes: Episode[];
}

/** "Greys Anatomy [L] S01E05" → "Episódio 5"; títulos próprios do episódio ficam. */
function episodeTitle(e: Episode, series: string) {
  const rest = e.name.startsWith(series) ? e.name.slice(series.length).replace(/^[\s._-]*S\d+\s*[._-]?\s*E\d+[\s._:-]*/i, '').trim() : e.name;
  return rest || `Episódio ${e.episode || ''}`.trim();
}

const fmtClock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const label = (e: Episode) => (e.season || e.episode ? `T${e.season} · E${String(e.episode).padStart(2, '0')}` : '');

export default function SeriesPage() {
  const { playlistId = '' } = useParams();
  const [params] = useSearchParams();
  const name = params.get('nome') || '';
  useTitle(name);
  const nav = useNavigate();
  const { data, error, loading } = useApi<SeriesData>(`series/episodes?playlist=${playlistId}&name=${encodeURIComponent(name)}`);
  const { data: hist } = useApi<{ channels: Channel[] }>('history');
  const seasons = useMemo(() => [...new Set((data?.episodes || []).map((e) => e.season))], [data]);
  const [season, setSeason] = useState<number | null>(null);

  const progressOf = useMemo(() => new Map((hist?.channels || []).map((c) => [c.id, c])), [hist]);
  // Último episódio assistido desta série → "Continuar" e temporada aberta.
  const last = useMemo(() => {
    const ids = new Set((data?.episodes || []).map((e) => e.id));
    const h = hist?.channels.find((c) => ids.has(c.id));
    return h ? data!.episodes.find((e) => e.id === h.id) || null : null;
  }, [data, hist]);
  useEffect(() => {
    if (season === null && seasons.length) setSeason(last?.season ?? seasons[0]);
  }, [seasons, last, season]);

  if (loading && !data) return <Spinner label="Carregando…" />;
  const eps = (data?.episodes || []).filter((e) => e.season === season);
  const first = data?.episodes[0];
  const poster = { id: '', name, group: data?.group || '', kind: 'series', playlistId, logo: data?.logo || '', favorite: false } as Channel;

  return (
    <Page>
      <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/?tipo=series'))} className="-ml-2 mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm text-slate-400 hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <ErrorBox message={error} />
      {data && (
        <>
          <div className="flex gap-4 sm:gap-6">
            <ChannelLogo channel={poster} className="aspect-[3/4] w-28 shrink-0 rounded-2xl sm:w-40" />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-bold leading-tight sm:text-2xl">{data.name}</h1>
              <p className="mt-1 text-sm text-slate-400">{data.group}</p>
              <p className="mt-1 text-sm text-slate-500">
                {seasons.length > 1 ? `${seasons.length} temporadas · ` : ''}
                {data.episodes.length} episódios
              </p>
              {(last || first) && (
                <Link to={`/assistir/${(last || first)!.id}`} className={`${btnPrimary} mt-4`}>
                  <Play className="h-4 w-4 fill-current" /> {last ? `Continuar ${label(last)}${progressOf.get(last.id)?.position ? ` · ${fmtClock(progressOf.get(last.id)!.position!)}` : ''}` : 'Assistir'}
                </Link>
              )}
            </div>
          </div>

          {seasons.length > 1 && (
            <div className="no-scrollbar -mx-3 mt-6 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              {seasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold ${season === s ? 'bg-brand text-ink-950' : 'bg-ink-800 text-slate-300 hover:bg-ink-700'}`}
                >
                  {s ? `Temporada ${s}` : 'Outros'}
                </button>
              ))}
            </div>
          )}

          <ul className="mt-4 divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900">
            {eps.map((e) => (
              <li key={e.id}>
                <Link to={`/assistir/${e.id}`} className={`flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition hover:bg-ink-850 ${last?.id === e.id ? 'bg-brand/10' : ''}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-800 text-xs font-bold text-slate-300">{e.episode || '•'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{episodeTitle(e, data.name)}</p>
                    {last?.id === e.id && <p className="text-xs text-brand-light">Último assistido</p>}
                    {!!progressOf.get(e.id)?.progress && <ProgressBar value={progressOf.get(e.id)!.progress!} className="mt-1.5 overflow-hidden rounded-full" />}
                  </div>
                  <Play className="h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
