import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Channel, Episode, groupLabel, useApi } from '../api';
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

// Convenção dos serviços de streaming: T1:E3.
const label = (e: Episode) => (e.season || e.episode ? `T${e.season}:E${e.episode}` : '');

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
      <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/?tipo=series'))} className="-ml-2 mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm text-slate-400 hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <ErrorBox message={error} />
      {data && (
        <>
          <div className="flex gap-4 sm:gap-6">
            <ChannelLogo channel={poster} className="aspect-[3/4] w-28 shrink-0 rounded-[6px] sm:w-40" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display break-words text-[2rem] leading-[1.05] text-slate-100 sm:text-[2.6rem]">{data.name}</h1>
              <p className="mt-1 text-sm text-slate-400">{groupLabel(data.group, 'series')}</p>
              <p className="mt-1 text-sm text-slate-500">
                {seasons.length > 1 ? `${seasons.length} temporadas, ` : ''}
                {data.episodes.length} {data.episodes.length === 1 ? 'episódio' : 'episódios'}
              </p>
              {(last || first) && (
                <Link to={`/assistir/${(last || first)!.id}`} className={`${btnPrimary} mt-4`}>
                  <Play className="h-4 w-4 fill-current" /> {last ? `Continuar ${label(last)}${progressOf.get(last.id)?.position ? ` (${fmtClock(progressOf.get(last.id)!.position!)})` : ''}` : 'Assistir do início'}
                </Link>
              )}
            </div>
          </div>

          {seasons.length > 1 && (
            <nav aria-label="Temporadas" className="no-scrollbar -mx-3 mt-8 flex gap-6 overflow-x-auto border-b border-ink-800 px-3 sm:mx-0 sm:px-0">
              {seasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  aria-pressed={season === s}
                  className={`font-display -mb-px min-h-[48px] shrink-0 border-b-[3px] text-lg transition-colors ${season === s ? 'border-brand text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  {s ? `Temporada ${s}` : 'Outros'}
                </button>
              ))}
            </nav>
          )}

          <ol className="mt-2 divide-y divide-ink-800">
            {eps.map((e) => (
              <li key={e.id}>
                <Link to={`/assistir/${e.id}`} className={`flex min-h-[60px] items-center gap-4 border-l-[3px] py-2.5 pl-2 pr-3 transition-colors hover:bg-ink-900 ${last?.id === e.id ? 'border-brand bg-ink-900' : 'border-transparent'}`}>
                  <span className="font-display w-8 shrink-0 text-right text-xl text-slate-500">{e.episode || ''}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] text-slate-100">{episodeTitle(e, data.name)}</p>
                    {last?.id === e.id && <p className="text-xs text-slate-400">Você parou aqui</p>}
                    {!!progressOf.get(e.id)?.progress && <ProgressBar value={progressOf.get(e.id)!.progress!} className="mt-1.5 overflow-hidden rounded-full" />}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </Page>
  );
}
