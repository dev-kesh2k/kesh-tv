import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Pause, RotateCcw, VolumeX } from 'lucide-react';
import { api, apiUrl, Source } from '../api';

type Engine = { destroy: () => void };
// Ao vivo começa rápido; filmes/episódios de Xtream passam por redirecionamento e demoram mais.
const START_TIMEOUT = { hls: 20000, ts: 20000, flv: 20000, file: 40000, convert: 70000 };

interface Conv {
  sid: string;
  duration: number;
  offset: number;
  converting: boolean;
}

const fmtTime = (t: number) => {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const isApple = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Toca a primeira fonte que funcionar: HLS (hls.js ou nativo no Safari), MPEG-TS/FLV (mpegts.js) ou arquivo.
 * Se uma fonte falhar ou não começar em 15 s, passa para a próxima (ex.: link direto → proxy do servidor).
 */
export function Player({
  sources,
  title,
  onPlaying,
  startAt = 0,
  onProgress,
  controls = true,
  fill = false,
}: {
  sources: Source[];
  title: string;
  onPlaying?: () => void;
  /** Segundos para começar (continuar de onde parou). */
  startAt?: number;
  /** Posição absoluta e duração, a cada ~15 s, ao pausar e ao sair. */
  onProgress?: (position: number, duration: number) => void;
  /** Controles nativos do navegador (na TV ficam escondidos: o controle remoto comanda). */
  controls?: boolean;
  /** Ocupar todo o espaço do pai (tela cheia da TV) em vez de 16:9. */
  fill?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<'loading' | 'playing' | 'failed'>('loading');
  const [detail, setDetail] = useState('');
  const [attempt, setAttempt] = useState(0);
  const playedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  // Conversão no servidor: o vídeo começa em `offset`; avançar além do que já foi convertido reinicia dali.
  const [conv, setConv] = useState<Conv | null>(null);
  const [seekTo, setSeekTo] = useState(0);
  const [now, setNow] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  // Posição pedida e ainda não aplicada: toques seguidos em +30s se somam e só o último reinicia a conversão.
  const [pending, setPending] = useState<number | null>(null);
  // Sem controles nativos (TV): ícone de pausa e barra de tempo ao pausar/avançar.
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState(false);
  const hudTimer = useRef<number>();
  const seekTimer = useRef<number>();

  // Se o usuário ativar o som pelos controles do vídeo, some o botão.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const sync = () => setMuted(el.muted);
    el.addEventListener('volumechange', sync);
    return () => el.removeEventListener('volumechange', sync);
  }, []);

  // Início pedido: arquivos pulam no loadedmetadata; conversões já começam do ponto (offset).
  const startRef = useRef(startAt);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const convRef = useRef<Conv | null>(null);
  convRef.current = conv;

  useEffect(() => {
    startRef.current = startAt;
    setIndex(0);
    setState('loading');
    setDetail('');
    setConv(null);
    setSeekTo(Math.floor(startAt || 0));
    setPending(null);
    playedRef.current = false;
  }, [sources]);

  // Progresso: posição absoluta (offset da conversão + tempo do vídeo) e duração conhecida.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const report = () => {
      const c = convRef.current;
      const position = (c ? c.offset : 0) + el.currentTime;
      const duration = c ? c.duration : Number.isFinite(el.duration) ? el.duration : 0;
      if (position > 1 && duration > 0) progressRef.current?.(position, duration);
    };
    const timer = window.setInterval(() => !el.paused && report(), 15000);
    el.addEventListener('pause', report);
    window.addEventListener('pagehide', report);
    return () => {
      report();
      window.clearInterval(timer);
      el.removeEventListener('pause', report);
      window.removeEventListener('pagehide', report);
    };
  }, [sources]);

  useEffect(() => {
    const el = video.current;
    if (!el || controls) return;
    const flash = () => {
      setPaused(el.paused);
      setHud(true);
      window.clearTimeout(hudTimer.current);
      if (!el.paused) hudTimer.current = window.setTimeout(() => setHud(false), 4000);
    };
    el.addEventListener('pause', flash);
    el.addEventListener('play', flash);
    el.addEventListener('seeking', flash);
    return () => {
      el.removeEventListener('pause', flash);
      el.removeEventListener('play', flash);
      el.removeEventListener('seeking', flash);
      window.clearTimeout(hudTimer.current);
    };
  }, [controls]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const tick = () => setNow(el.currentTime);
    el.addEventListener('timeupdate', tick);
    return () => el.removeEventListener('timeupdate', tick);
  }, []);

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
    const timer = window.setTimeout(() => fail('O canal não respondeu a tempo'), START_TIMEOUT[src.type] || 20000);
    const onPlay = () => {
      window.clearTimeout(timer);
      setPending(null);
      setState('playing');
      if (!playedRef.current) {
        playedRef.current = true;
        onPlaying?.();
      }
    };
    const onError = () => fail(el.error?.message || 'Formato não suportado neste aparelho');
    // Continuar de onde parou (arquivos e HLS com fim; ao vivo não tem duração finita).
    const onMeta = () => {
      const t = startRef.current;
      if (src.type !== 'convert' && t > 0 && Number.isFinite(el.duration) && t < el.duration - 5) el.currentTime = t;
    };
    el.addEventListener('playing', onPlay);
    el.addEventListener('error', onError);
    el.addEventListener('loadedmetadata', onMeta);

    // Navegadores bloqueiam autoplay com som: toca mudo e mostra o botão "Ativar som".
    const tryPlay = () =>
      el.play().catch((err: DOMException) => {
        // Só autoplay bloqueado (NotAllowedError) vira "tocar mudo"; AbortError é o usuário pausando.
        if (cancelled || err?.name !== 'NotAllowedError') return;
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {
          window.clearTimeout(timer);
          if (!cancelled) setState('playing');
        });
      });

    let convSid = '';
    const playHls = async (hlsUrl: string, fromStart: boolean) => {
      const native = el.canPlayType('application/vnd.apple.mpegurl');
      const { default: Hls } = await import('hls.js');
      if (cancelled) return;
      if (Hls.isSupported() && !(native && isApple())) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30, manifestLoadingTimeOut: fromStart ? 50000 : 12000, fragLoadingTimeOut: fromStart ? 30000 : 20000, ...(fromStart ? { startPosition: 0 } : {}) });
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
        hls.loadSource(hlsUrl);
        hls.attachMedia(el);
        engine = hls;
      } else if (native) {
        el.src = hlsUrl;
        tryPlay();
      } else fail('Este navegador não toca HLS');
    };

    (async () => {
      if (src.type === 'convert') {
        const r = await api.post<Conv & { playlist: string }>('convert/start', { link: src.url, t: seekTo });
        if (cancelled) {
          api.del(`convert/${r.sid}`).catch(() => {});
          return;
        }
        convSid = r.sid;
        setConv({ sid: r.sid, duration: r.duration, offset: r.offset, converting: r.converting });
        await playHls(apiUrl(r.playlist), true);
        return;
      }
      if (src.type === 'hls') {
        await playHls(url, false);
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
      el.removeEventListener('loadedmetadata', onMeta);
      try {
        engine?.destroy();
      } catch {
        /* ignora */
      }
      if (convSid) api.del(`convert/${convSid}`).catch(() => {});
      el.removeAttribute('src');
      el.load();
    };
  }, [sources, index, attempt, onPlaying, seekTo]);

  const retry = () => {
    setIndex(0);
    setDetail('');
    setAttempt((a) => a + 1);
  };

  const position = conv ? conv.offset + now : 0;
  const shown = dragging ?? pending ?? position;
  const seek = (target: number) => {
    if (!conv) return;
    const t = Math.max(0, Math.min(target, conv.duration - 3));
    setPending(t);
    window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(() => {
      const el = video.current;
      if (!el) return;
      // Dentro do que já foi convertido: só move o vídeo; fora disso, reinicia a conversão a partir dali.
      const rel = t - conv.offset;
      const end = el.seekable.length ? el.seekable.end(el.seekable.length - 1) : 0;
      if (rel >= 0 && rel <= end - 2) {
        el.currentTime = rel;
        setPending(null);
      } else {
        setState('loading');
        setSeekTo(Math.floor(t));
      }
    }, 700);
  };
  useEffect(() => () => window.clearTimeout(seekTimer.current), []);

  // Atalhos: espaço/K/OK pausa (e teclas de mídia do controle), F tela cheia, M mudo, ←/→ 10 s (↑/↓ trocam de canal na página).
  const box = useRef<HTMLDivElement>(null);
  const seekRef = useRef(seek);
  seekRef.current = seek;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = video.current;
      // Com um botão/link/campo em destaque, as teclas são da navegação (controle remoto), não do vídeo.
      const tag = (e.target as HTMLElement)?.tagName;
      if (!el || e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k' || k === 'enter' || k === 'mediaplaypause') {
        e.preventDefault();
        // OK do controle: se começou mudo (autoplay bloqueado), o primeiro OK liga o som.
        if (k === 'enter' && el.muted && !el.paused) {
          el.muted = false;
          return;
        }
        if (el.paused) el.play().catch(() => {});
        else el.pause();
      } else if (k === 'mediaplay') {
        el.play().catch(() => {});
      } else if (k === 'mediapause' || k === 'mediastop') {
        el.pause();
      } else if (k === 'f') {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else (box.current || el).requestFullscreen?.().catch(() => {});
      } else if (k === 'm') {
        el.muted = !el.muted;
      } else if (k === 'arrowleft' || k === 'arrowright') {
        const d = k === 'arrowleft' ? -10 : 10;
        if (convRef.current) seekRef.current(shownRef.current + d);
        else if (Number.isFinite(el.duration)) el.currentTime = Math.max(0, Math.min(el.duration - 1, el.currentTime + d));
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={box} className="bg-black sm:bg-transparent">
    <div className={`relative w-full overflow-hidden bg-black ${fill ? 'h-full' : 'aspect-video sm:rounded-2xl'}`}>
      <video ref={video} className="h-full w-full bg-black" controls={controls} playsInline autoPlay title={title} />
      {!controls && state === 'playing' && paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid h-28 w-28 place-items-center rounded-full bg-black/60 backdrop-blur">
            <Pause className="h-14 w-14 fill-white text-white" />
          </div>
        </div>
      )}
      {!controls && hud && state === 'playing' && (conv?.duration || Number.isFinite(video.current?.duration ?? NaN)) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent px-12 pb-16 pt-10 text-lg text-white">
          <span className="font-mono">{fmtTime(conv ? shown : now)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, ((conv ? shown : now) / ((conv?.duration || video.current?.duration) || 1)) * 100)}%` }} />
          </div>
          <span className="font-mono text-white/70">{fmtTime(conv?.duration || video.current?.duration || 0)}</span>
        </div>
      )}
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
              {sources[index]?.type === 'convert' ? (
                'Preparando o arquivo no servidor…'
              ) : (
                <>
                  Conectando{sources.length > 1 ? ` · fonte ${Math.min(index + 1, sources.length)} de ${sources.length}` : ''}
                  {sources[index]?.via === 'proxy' ? ' (pelo servidor)' : ''}
                </>
              )}
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
    {controls && conv && conv.duration > 0 && (
      <div className="flex items-center gap-2 bg-ink-900 px-3 py-2 sm:mt-2 sm:rounded-xl">
        <button type="button" aria-label="Voltar 10 segundos" onClick={() => seek(shown - 10)} className="h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-slate-300 hover:bg-ink-800">
          −10s
        </button>
        <span className="w-14 shrink-0 text-right font-mono text-xs text-slate-400">{fmtTime(shown)}</span>
        <input
          type="range"
          aria-label="Posição do vídeo"
          min={0}
          max={Math.floor(conv.duration)}
          value={Math.floor(shown)}
          onChange={(e) => setDragging(Number(e.target.value))}
          onPointerUp={() => {
            if (dragging !== null) seek(dragging);
            setDragging(null);
          }}
          onKeyUp={() => {
            if (dragging !== null) seek(dragging);
            setDragging(null);
          }}
          className="h-10 min-w-0 flex-1 accent-brand"
        />
        <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{fmtTime(conv.duration)}</span>
        <button type="button" aria-label="Avançar 30 segundos" onClick={() => seek(shown + 30)} className="h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-slate-300 hover:bg-ink-800">
          +30s
        </button>
      </div>
    )}
    </div>
  );
}
