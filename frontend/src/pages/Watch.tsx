import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Heart, PictureInPicture2 } from 'lucide-react';
import { api, Channel, KIND_LABEL, seriesLink, Source, toggleFavorite } from '../api';
import { ChannelLogo } from '../components/ChannelCard';
import { Player } from '../components/Player';
import { Guide } from '../components/Guide';
import { SleepTimer } from '../components/SleepTimer';
import { TvOsd } from '../components/TvOsd';
import { platform } from '../platform';
import { useTitle } from '../useTitle';
import { btnGhost, ErrorBox, Spinner } from '../components/ui';

interface PlayInfo {
  channel: Channel;
  sources: Source[];
  original: string;
  /** Segundos para continuar de onde parou (0 = do início). */
  resume: number;
  duration: number;
}

/** Tipo no subtítulo só quando acrescenta algo: ao vivo já tem o selo e "Filmes | Ação" já diz que é filme. */
function subtitleKind(ch: Channel) {
  if (ch.kind === 'live') return '';
  const label = KIND_LABEL[ch.kind];
  return ch.group.toLowerCase().includes(label.toLowerCase().slice(0, 5)) ? '' : label;
}

const fmtTime = (t: number) => {
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};
interface Around {
  channels: Channel[];
  prev: string | null;
  next: string | null;
  series?: string;
}

export default function Watch() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [around, setAround] = useState<Around | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useTitle(info?.channel.name);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setError('');
    api
      .get<PlayInfo>(`channels/${id}/play`)
      .then((r) => alive && setInfo(r))
      .catch((e) => alive && setError(e.message));
    api
      .get<Around>(`channels/${id}/around`)
      .then((r) => alive && setAround(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // Rola a lista lateral até o canal atual.
  useEffect(() => {
    listRef.current?.querySelector('[data-current="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [around]);

  const go = useCallback((target: string | null) => target && nav(`/assistir/${target}`, { replace: true }), [nav]);

  // Setas do teclado / controle remoto trocam de canal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Botão/link em destaque: as setas movem o destaque (navegação por controle remoto).
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ChannelUp') go(around?.prev || null);
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ChannelDown') go(around?.next || null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [around, go]);

  const onPlaying = useCallback(() => {
    api.post(`channels/${id}/watch`).catch(() => {});
  }, [id]);

  // Continuar de onde parou: começa no ponto salvo; "Recomeçar" volta ao início.
  // Calculado na hora (sem efeito) para o player já montar com o ponto certo.
  const [restarted, setRestarted] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  useEffect(() => setRestarted(false), [id]);
  const startAt = restarted ? 0 : info?.resume || 0;
  const restart = () => {
    setRestarted(true);
    setRestartKey((k) => k + 1);
  };
  const onProgress = useCallback(
    (position: number, duration: number) => {
      api.put(`channels/${id}/progress`, { position, duration }).catch(() => {});
    },
    [id],
  );

  const fav = async () => {
    if (!info) return;
    const favorite = await toggleFavorite(info.channel);
    setInfo({ ...info, channel: { ...info.channel, favorite } });
  };

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.original);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o link:', info.original);
    }
  };

  // Mini player (Picture-in-Picture): padrão nos navegadores e o modo do Safari no iPhone.
  type SafariVideo = HTMLVideoElement & { webkitSupportsPresentationMode?: (m: string) => boolean; webkitSetPresentationMode?: (m: string) => void };
  const canPip = typeof document !== 'undefined' && (document.pictureInPictureEnabled || 'webkitSetPresentationMode' in HTMLVideoElement.prototype);
  const pip = async () => {
    const v = document.querySelector('video') as SafariVideo | null;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (v.requestPictureInPicture) await v.requestPictureInPicture();
      else v.webkitSetPresentationMode?.('picture-in-picture');
    } catch {
      /* vídeo ainda não carregou ou o navegador recusou */
    }
  };

  const ch = info?.channel;

  // TV: vídeo na tela toda, comandado pelo controle remoto, com painel de informações por cima.
  if (platform.tv)
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {info ? (
          <Player key={restartKey} sources={info.sources} title={ch?.name || ''} onPlaying={onPlaying} startAt={startAt} onProgress={ch?.kind === 'live' ? undefined : onProgress} controls={false} fill />
        ) : (
          <div className="grid h-full place-items-center">{error ? <ErrorBox message={error} /> : <Spinner />}</div>
        )}
        <TvOsd channel={ch} />
      </div>
    );

  return (
    <main className="mx-auto w-full max-w-[1600px] pb-6 sm:px-5 sm:pt-[max(1rem,env(safe-area-inset-top))] lg:px-8 lg:pt-6">
      <div className="xl:flex xl:items-start xl:gap-6">
        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-20 bg-black pt-[env(safe-area-inset-top)] sm:static sm:bg-transparent sm:pt-0">
            {info ? <Player key={restartKey} sources={info.sources} title={ch?.name || ''} onPlaying={onPlaying} startAt={startAt} onProgress={ch?.kind === 'live' ? undefined : onProgress} /> : <div className="grid aspect-video w-full place-items-center bg-black sm:rounded-2xl">{error ? null : <Spinner />}</div>}
          </div>

          <div className="px-3 pt-3 sm:px-0">
            <ErrorBox message={error} />
            {startAt > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-sm">
                <span>
                  Continuando de <b className="font-mono">{fmtTime(startAt)}</b>
                </span>
                <button type="button" onClick={restart} className="min-h-[40px] shrink-0 rounded-lg px-3 font-semibold text-brand-light hover:bg-brand/15">
                  Recomeçar
                </button>
              </div>
            )}
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Voltar" className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-ink-800">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 pt-1.5">
                <h1 className="break-words text-lg font-bold leading-tight sm:text-xl">
                  {ch?.kind === 'live' && (
                    <span className="mr-2 inline-flex translate-y-[-2px] items-center gap-1.5 rounded-md bg-red-500/15 px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wider text-red-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                      </span>
                      AO VIVO
                    </span>
                  )}
                  {ch?.name || '…'}
                </h1>
                {ch && (
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {around?.series ? (
                      <Link to={seriesLink({ playlistId: ch.playlistId, name: around.series })} className="text-brand-light hover:underline">
                        {around.series}
                      </Link>
                    ) : (
                      subtitleKind(ch)
                    )}
                    {ch.group ? `${around?.series || subtitleKind(ch) ? ' · ' : ''}${ch.group}` : ''}
                  </p>
                )}
              </div>
            </div>

            {ch && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => go(around?.prev || null)} disabled={!around?.prev} aria-label="Canal anterior">
                  <ChevronLeft className="h-4 w-4" /> <span className="hidden min-[400px]:inline">{around?.series ? 'Ep. anterior' : 'Anterior'}</span>
                </button>
                <button type="button" className={btnGhost} onClick={() => go(around?.next || null)} disabled={!around?.next} aria-label="Próximo canal">
                  <span className="hidden min-[400px]:inline">{around?.series ? 'Próximo ep.' : 'Próximo'}</span> <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" className={`${btnGhost} ${ch.favorite ? 'text-brand-light' : ''}`} onClick={fav}>
                  <Heart className={`h-4 w-4 ${ch.favorite ? 'fill-brand text-brand' : ''}`} /> {ch.favorite ? 'Favorito' : 'Favoritar'}
                </button>
                <SleepTimer programmeEnd={ch.now?.stop} />
                {canPip && (
                  <button type="button" className={btnGhost} onClick={pip} title="Continuar vendo numa janelinha enquanto usa outros apps">
                    <PictureInPicture2 className="h-4 w-4" /> Mini player
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={copy} title="Copiar o link original (para abrir no VLC, por exemplo)">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar link'}
                </button>
              </div>
            )}
            {ch?.kind === 'live' && <Guide channelId={ch.id} />}
          </div>
        </div>

        {around && around.channels.length > 1 && (
          <aside className="mt-5 px-3 sm:px-0 xl:mt-0 xl:w-80 xl:shrink-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{around.series ? 'Episódios' : `Mais em ${ch?.group || 'este grupo'}`}</p>
            <div ref={listRef} className="space-y-1 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:pr-1">
              {around.channels.map((c) => (
                <Link
                  key={c.id}
                  to={`/assistir/${c.id}`}
                  replace
                  data-current={c.id === id ? '1' : undefined}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl p-1.5 pr-3 transition ${c.id === id ? 'bg-brand/15 ring-1 ring-brand/40' : 'hover:bg-ink-800'}`}
                >
                  <ChannelLogo channel={c} className="h-10 w-14 shrink-0 rounded-lg !p-1.5" />
                  <span className={`min-w-0 flex-1 truncate text-sm ${c.id === id ? 'font-semibold text-brand-light' : 'text-slate-200'}`}>{c.name}</span>
                  {c.favorite && <Heart className="h-3.5 w-3.5 shrink-0 fill-brand text-brand" />}
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
