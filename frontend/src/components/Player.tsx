import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, VolumeX } from 'lucide-react';
import { apiUrl, Source } from '../api';

type Engine = { destroy: () => void };
const START_TIMEOUT = 15000;

const isApple = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Toca a primeira fonte que funcionar: HLS (hls.js ou nativo no Safari), MPEG-TS/FLV (mpegts.js) ou arquivo.
 * Se uma fonte falhar ou não começar em 15 s, passa para a próxima (ex.: link direto → proxy do servidor).
 */
export function Player({ sources, title, onPlaying }: { sources: Source[]; title: string; onPlaying?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<'loading' | 'playing' | 'failed'>('loading');
  const [detail, setDetail] = useState('');
  const [attempt, setAttempt] = useState(0);
  const playedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  // Se o usuário ativar o som pelos controles do vídeo, some o botão.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const sync = () => setMuted(el.muted);
    el.addEventListener('volumechange', sync);
    return () => el.removeEventListener('volumechange', sync);
  }, []);

  useEffect(() => {
    setIndex(0);
    setState('loading');
    setDetail('');
    playedRef.current = false;
  }, [sources]);

  useEffect(() => {
    const el = video.current;
    const src = sources[index];
    if (!el) return;
    if (!src) {
      setState('failed');
      return;
    }
    let engine: Engine | null = null;
    let cancelled = false;
    let failedOnce = false;
    const url = apiUrl(src.url);
    setState('loading');

    const fail = (why: string) => {
      if (cancelled || failedOnce) return;
      failedOnce = true;
      setDetail(why);
      setIndex((i) => i + 1);
    };
    const timer = window.setTimeout(() => fail('O canal não respondeu a tempo'), START_TIMEOUT);
    const onPlay = () => {
      window.clearTimeout(timer);
      setState('playing');
      if (!playedRef.current) {
        playedRef.current = true;
        onPlaying?.();
      }
    };
    const onError = () => fail(el.error?.message || 'Formato não suportado neste aparelho');
    el.addEventListener('playing', onPlay);
    el.addEventListener('error', onError);

    // Navegadores bloqueiam autoplay com som: toca mudo e mostra o botão "Ativar som".
    const tryPlay = () =>
      el.play().catch(() => {
        if (cancelled) return;
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {
          window.clearTimeout(timer);
          if (!cancelled) setState('playing');
        });
      });

    (async () => {
      if (src.type === 'hls') {
        const native = el.canPlayType('application/vnd.apple.mpegurl');
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported() && !(native && isApple())) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30, manifestLoadingTimeOut: 12000, fragLoadingTimeOut: 20000 });
          let recovered = false;
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
              recovered = true;
              hls.recoverMediaError();
              return;
            }
            fail(data.details || 'Erro no stream');
          });
          hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
          hls.loadSource(url);
          hls.attachMedia(el);
          engine = hls;
        } else if (native) {
          el.src = url;
          tryPlay();
        } else fail('Este navegador não toca HLS');
        return;
      }
      if (src.type === 'ts' || src.type === 'flv') {
        const mpegts = (await import('mpegts.js')).default;
        if (cancelled) return;
        if (!mpegts.isSupported()) return fail('Este aparelho não toca MPEG-TS');
        const player = mpegts.createPlayer(
          { type: src.type === 'flv' ? 'flv' : 'mpegts', isLive: true, url },
          { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false, autoCleanupSourceBuffer: true },
        );
        player.on(mpegts.Events.ERROR, (_t: string, d: string) => fail(d || 'Erro no stream'));
        player.attachMediaElement(el);
        player.load();
        tryPlay();
        engine = { destroy: () => { player.pause(); player.unload(); player.detachMediaElement(); player.destroy(); } };
        return;
      }
      el.src = url;
      tryPlay();
    })().catch((e) => fail(String(e?.message || e)));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      el.removeEventListener('playing', onPlay);
      el.removeEventListener('error', onError);
      try {
        engine?.destroy();
      } catch {
        /* ignora */
      }
      el.removeAttribute('src');
      el.load();
    };
  }, [sources, index, attempt, onPlaying]);

  const retry = () => {
    setIndex(0);
    setDetail('');
    setAttempt((a) => a + 1);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
      <video ref={video} className="h-full w-full bg-black" controls playsInline autoPlay title={title} />
      {muted && state === 'playing' && (
        <button
          type="button"
          onClick={() => {
            if (video.current) video.current.muted = false;
            setMuted(false);
          }}
          className="absolute left-3 top-3 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-black/70 px-3.5 text-sm font-semibold text-white backdrop-blur"
        >
          <VolumeX className="h-4 w-4" /> Ativar som
        </button>
      )}
      {state === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <div className="flex flex-col items-center gap-2 text-sm text-slate-200">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span>
              Conectando{sources.length > 1 ? ` · fonte ${Math.min(index + 1, sources.length)} de ${sources.length}` : ''}
              {sources[index]?.via === 'proxy' ? ' (pelo servidor)' : ''}
            </span>
          </div>
        </div>
      )}
      {state === 'failed' && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-4 text-center">
          <div className="flex max-w-sm flex-col items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="font-semibold">Não foi possível abrir este canal</p>
            <p className="text-xs text-slate-400">{detail || 'Nenhuma fonte respondeu.'} O canal pode estar fora do ar ou usar um formato que o navegador não toca.</p>
            <button type="button" onClick={retry} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
              <RotateCcw className="h-4 w-4" /> Tentar de novo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
