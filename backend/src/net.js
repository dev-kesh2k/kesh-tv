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

function blockedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true; // link-local / metadados de nuvem
    if (a === 172 && b >= 16 && b <= 31) return true; // redes do Docker
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return blockedIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff');
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
