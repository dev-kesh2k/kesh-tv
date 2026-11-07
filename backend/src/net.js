// Busca de URLs externas (listas, streams e logos) com proteção contra acesso à rede interna do servidor,
// e links assinados para o proxy (o <video>/<img> não manda header de autenticação).
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { HttpError } from './db.js';

const KEY = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
export const DEFAULT_UA = 'VLC/3.0.20 LibVLC/3.0.20';

const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString();
const hmac = (s) => crypto.createHmac('sha256', KEY).update(s).digest('base64url').slice(0, 32);

/** Parâmetros assinados: u = URL, h = headers extras (UA/referrer), e = validade (0 = sem). */
export function sign(url, { ua = '', ref = '', ttlSec = 0 } = {}) {
  const e = ttlSec ? Math.floor(Date.now() / 1000) + ttlSec : 0;
  const u = b64(url);
  const h = ua || ref ? b64(JSON.stringify({ ua, ref })) : '';
  const s = hmac(`${u}.${h}.${e}`);
  return new URLSearchParams({ u, ...(h ? { h } : {}), e: String(e), s }).toString();
}

export function verify(q) {
  const u = String(q.u || '');
  const h = String(q.h || '');
  const e = Number(q.e || 0);
  const s = String(q.s || '');
  const want = hmac(`${u}.${h}.${e}`);
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) throw new HttpError(403, 'Link inválido');
  if (e && e < Date.now() / 1000) throw new HttpError(410, 'Link expirado');
  const extra = h ? JSON.parse(unb64(h)) : {};
  return { url: unb64(u), ua: extra.ua || '', ref: extra.ref || '' };
}

/** Expande um IPv6 para 8 grupos de 16 bits (aceita "::" e IPv4 no final, ex.: ::ffff:1.2.3.4). */
function ipv6Groups(ip) {
  let v = ip.toLowerCase().split('%')[0];
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    v = v.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = v.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const fill = tail !== undefined ? Array(8 - h.length - t.length).fill('0') : [];
  return [...h, ...fill, ...t].map((g) => parseInt(g || '0', 16));
}

export function blockedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true; // link-local / metadados de nuvem
    if (a === 172 && b >= 16 && b <= 31) return true; // redes do Docker
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (!net.isIPv6(ip)) return true;
  const g = ipv6Groups(ip);
  // IPv4 dentro do IPv6 (::ffff:a.b.c.d, ::a.b.c.d e NAT64 64:ff9b::a.b.c.d), em qualquer escrita: vale a regra do IPv4.
  const zeros5 = g.slice(0, 5).every((x) => x === 0);
  if ((zeros5 && (g[5] === 0xffff || g[5] === 0)) || (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))) {
    if (zeros5 && g[5] === 0 && g[6] === 0 && g[7] <= 1) return true; // :: e ::1
    return blockedIp(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  const first = g[0];
  return (first & 0xffc0) === 0xfe80 || (first & 0xfe00) === 0xfc00 || (first & 0xff00) === 0xff00; // link-local, ULA, multicast
}

export async function assertPublic(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new HttpError(400, 'URL inválida');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'Use um link http:// ou https://');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local(host)?$|^host\.docker\.internal$/i.test(host)) throw new HttpError(400, 'Endereço não permitido');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new HttpError(502, `Não foi possível encontrar o servidor ${host}`);
  if (ips.some(blockedIp)) throw new HttpError(400, 'Endereço não permitido');
  return u;
}

/** fetch com redirecionamentos conferidos um a um (cada destino passa pela checagem de rede). */
export async function safeFetch(url, { headers = {}, signal, timeoutMs = 20000, ua = '', ref = '' } = {}) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
    const onAbort = () => ctrl.abort(signal.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': ua || DEFAULT_UA, Accept: '*/*', ...(ref ? { Referer: ref } : {}), ...headers },
      });
    } catch (err) {
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      if (signal?.aborted) throw err;
      throw new HttpError(502, ctrl.signal.aborted ? 'O servidor da lista demorou para responder' : 'Não foi possível conectar ao servidor');
    }
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
      res.body?.cancel().catch(() => {});
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new HttpError(502, 'Redirecionamentos demais');
}
