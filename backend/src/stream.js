// Proxy dos streams e logos: o app roda em HTTPS e a maioria das listas IPTV usa http:// (o navegador bloqueia),
// além de servidores sem CORS ou que exigem User-Agent próprio.
import { Readable } from 'node:stream';
import { HttpError } from './db.js';
import { safeFetch, sign, verify } from './net.js';

const STREAM_TTL = 12 * 3600;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

export const streamLink = (url, ua = '', ref = '') => `stream?${sign(url, { ua, ref, ttlSec: STREAM_TTL })}`;
export const logoLink = (url) => (url && /^https?:\/\//i.test(url) ? `logo?${sign(url)}` : '');

// Conteúdo de terceiros servido pelo domínio do app: nunca pode rodar script aqui (SVG com <script>, HTML…).
export const SANDBOX_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
};
const ACTIVE_TYPE = /html|javascript|ecmascript|xml(?!.*mpegurl)|svg/i;
/** Tipo repassado da fonte, trocado por binário quando o navegador o executaria. */
export const safeType = (ct) => (!ct || (ACTIVE_TYPE.test(ct) && !/^image\/svg/i.test(ct)) ? 'application/octet-stream' : ct);

const isPlaylist = (ct, url) => /mpegurl/i.test(ct) || /\.m3u8?(\?|$)/i.test(url);

/** Reescreve as URLs de uma playlist HLS para passarem pelo proxy (segmentos, sub-playlists, chaves). */
export function rewriteHls(text, baseUrl, ua, ref) {
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString();
    } catch {
      return u;
    }
  };
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return t.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${streamLink(abs(u), ua, ref)}"`);
      return streamLink(abs(t), ua, ref);
    })
    .join('\n');
}

// Filmes/episódios de Xtream redirecionam para um CDN com token a cada pedido (~2 s). Cada avanço no vídeo é um
// novo pedido com Range: guarda o destino por 5 min para não repetir o salto.
const redirects = new Map();
const REDIRECT_TTL = 5 * 60_000;

export async function proxyStream(req, res) {
  const { url, ua, ref } = verify(req.query);
  res.set(SANDBOX_HEADERS);
  const ctrl = new AbortController();
  req.on('close', () => ctrl.abort());
  const headers = req.headers.range ? { Range: req.headers.range } : {};
  const cached = redirects.get(url);
  const target = cached && cached.at > Date.now() - REDIRECT_TTL ? cached.to : url;
  let up;
  let finalUrl;
  try {
    ({ res: up, finalUrl } = await safeFetch(target, { headers, signal: ctrl.signal, ua, ref, timeoutMs: 20000 }));
    if (target !== url && !up.ok && up.status !== 206) {
      // Destino guardado expirou: volta ao link original.
      up.body?.cancel().catch(() => {});
      redirects.delete(url);
      ({ res: up, finalUrl } = await safeFetch(url, { headers, signal: ctrl.signal, ua, ref, timeoutMs: 20000 }));
    }
  } catch (err) {
    if (ctrl.signal.aborted) return; // o usuário fechou o vídeo
    throw err;
  }
  if (finalUrl !== url && typeFromUrl(url) === 'file') {
    if (redirects.size > 2000) redirects.clear();
    redirects.set(url, { to: finalUrl, at: cached?.to === finalUrl ? cached.at : Date.now() });
  }
  if (!up.ok && up.status !== 206) {
    up.body?.cancel().catch(() => {});
    throw new HttpError(502, `A fonte do canal respondeu ${up.status}`);
  }
  const ct = up.headers.get('content-type') || '';
  if (isPlaylist(ct, finalUrl) && !/video\/mp2t/i.test(ct)) {
    const text = await readText(up, 5 * 1024 * 1024);
    if (text.trimStart().startsWith('#EXTM3U')) {
      res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' });
      return res.send(rewriteHls(text, finalUrl, ua, ref));
    }
    res.set('Content-Type', safeType(ct));
    return res.send(text);
  }
  res.status(up.status);
  for (const h of PASS_HEADERS) {
    const v = up.headers.get(h);
    if (v) res.set(h, h === 'content-type' ? safeType(v) : v);
  }
  res.set({ 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  if (!up.body) return res.end();
  const body = Readable.fromWeb(up.body);
  body.on('error', () => res.destroy());
  res.on('close', () => body.destroy());
  body.pipe(res);
}

export async function proxyLogo(req, res) {
  const { url } = verify(req.query);
  res.set(SANDBOX_HEADERS);
  try {
    const { res: up } = await safeFetch(url, { timeoutMs: 8000, ua: BROWSER_UA, headers: { Accept: 'image/*' } });
    const ct = up.headers.get('content-type') || '';
    if (!up.ok || !/^image\//i.test(ct)) {
      up.body?.cancel().catch(() => {});
      return res.status(404).set('Cache-Control', 'public, max-age=3600').end();
    }
    const buf = Buffer.from(await readText(up, 2 * 1024 * 1024, true));
    res.set({ 'Content-Type': ct, 'Cache-Control': 'public, max-age=604800, immutable' }).send(buf);
  } catch {
    res.status(404).set('Cache-Control', 'public, max-age=600').end();
  }
}

async function readText(up, max, raw = false) {
  const chunks = [];
  let size = 0;
  for await (const c of up.body) {
    size += c.length;
    if (size > max) throw new HttpError(413, 'Resposta grande demais');
    chunks.push(c);
  }
  const buf = Buffer.concat(chunks);
  return raw ? buf : buf.toString('utf8');
}

/** Descobre o formato de uma URL sem extensão conhecida lendo o começo da resposta. */
export async function probeType(url, ua, ref) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const { res: up } = await safeFetch(url, { signal: ctrl.signal, ua, ref, timeoutMs: 6000 });
    const ct = up.headers.get('content-type') || '';
    const reader = up.body?.getReader();
    const first = reader ? (await reader.read()).value : null;
    reader?.cancel().catch(() => {});
    const head = first ? Buffer.from(first).subarray(0, 16) : Buffer.alloc(0);
    if (/mpegurl/i.test(ct) || head.toString().startsWith('#EXTM3U')) return 'hls';
    if (/mp2t/i.test(ct) || head[0] === 0x47) return 'ts';
    if (/flv/i.test(ct) || head.toString().startsWith('FLV')) return 'flv';
    return 'file';
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

export function typeFromUrl(url) {
  const path = url.split('?')[0].toLowerCase();
  if (/\.m3u8?$/.test(path)) return 'hls';
  if (/\.ts$/.test(path)) return 'ts';
  if (/\.flv$/.test(path)) return 'flv';
  if (/\.(mp4|m4v|webm|mkv|mov|avi|mp3|aac)$/.test(path)) return 'file';
  return 'unknown';
}

/** Alternativas para servidores Xtream: /live/u/p/123.ts também existe em .m3u8 (toca no iPhone). */
export function xtreamHls(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    let m;
    if (parts[0] === 'live' && parts.length === 4) m = parts.slice(1);
    else if (parts.length === 3 && /^\d+(\.ts)?$/.test(parts[2])) m = parts;
    if (!m || !/^\d+(\.ts)?$/.test(m[2])) return null;
    u.pathname = `/live/${m[0]}/${m[1]}/${m[2].replace(/\.ts$/, '')}.m3u8`;
    return u.toString();
  } catch {
    return null;
  }
}
