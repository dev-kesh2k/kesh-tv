// Importação pela API Xtream Codes (player_api.php), usada quando o provedor bloqueia o link M3U (get.php).
// Lê categoria por categoria (respostas pequenas, cabem na memória) e monta os mesmos links que o M3U teria,
// então canais que já existiam mantêm o id. Séries entram como um item só e os episódios são buscados
// quando a série é aberta (get_series_info), para não fazer milhares de pedidos na importação.
import { HttpError } from './db.js';
import { normalizeSearch } from './m3u.js';
import { safeFetch } from './net.js';

/** Marca do item que representa uma série ainda sem episódios (tvgId). */
export const SERIES_MARK = 'xtream-series:';

const MAX_JSON = 60 * 1024 * 1024;
const cut = (s, n) => String(s ?? '').slice(0, n);

/** Usuário/senha de um link Xtream (…/get.php?username=…&password=…); null se não for. */
export function xtreamCreds(listUrl) {
  try {
    const u = new URL(listUrl);
    const user = u.searchParams.get('username');
    const pass = u.searchParams.get('password');
    if (!/\/get\.php$/i.test(u.pathname) || !user || !pass) return null;
    return { origin: u.origin, user, pass, ext: u.searchParams.get('output') === 'm3u8' ? 'm3u8' : 'ts' };
  } catch {
    return null;
  }
}

/** GET no player_api.php com tempo total, limite de tamanho e até 3 tentativas (esses servidores oscilam). */
export async function xtreamApi(c, params, signal) {
  const q = new URLSearchParams({ username: c.user, password: c.pass, ...params });
  const url = `${c.origin}/player_api.php?${q}`;
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    try {
      return await getJson(url, signal);
    } catch (err) {
      last = err;
      if (err instanceof HttpError && err.status < 500) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw last instanceof HttpError ? last : new HttpError(502, 'O servidor da lista não respondeu');
}

async function getJson(url, outer) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), 60_000);
  const onAbort = () => ctrl.abort(outer.reason);
  outer?.addEventListener('abort', onAbort, { once: true });
  try {
    const { res } = await safeFetch(url, { signal: ctrl.signal, timeoutMs: 30_000 });
    if (res.status === 401 || res.status === 403) {
      res.body?.cancel().catch(() => {});
      throw new HttpError(401, 'O provedor recusou o usuário ou a senha da lista');
    }
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new HttpError(502, `O servidor da lista respondeu ${res.status}`);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_JSON) throw new HttpError(413, 'Resposta grande demais do servidor da lista');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(502, 'O servidor da lista devolveu uma resposta inválida');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'O servidor da lista não respondeu');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/** Endereço base dos vídeos (o servidor informa host e porta; o M3U usa o mesmo formato, ex. http://host:80). */
export function streamBase(c, serverInfo) {
  const s = serverInfo || {};
  if (!s.url) return c.origin;
  const https = s.server_protocol === 'https';
  const port = https ? s.https_port : s.port;
  return `${https ? 'https' : 'http'}://${s.url}${port ? `:${port}` : ''}`;
}

const base = (fields) => ({ tvgId: '', userAgent: '', referrer: '', seriesName: '', season: 0, episode: 0, ...fields, searchName: normalizeSearch(fields.name) });

/** Item de canal ao vivo, filme ou série (como o leitor de M3U devolve). */
export function toItem(kind, s, ctx) {
  const { root, c, group } = ctx;
  const name = cut(s.name || s.title || '', 200).trim() || `Item ${s.stream_id ?? s.series_id}`;
  const auth = `${encodeURIComponent(c.user)}/${encodeURIComponent(c.pass)}`;
  if (kind === 'live') {
    return base({ kind, name, groupTitle: cut(group, 120), logo: cut(s.stream_icon, 1000), tvgId: cut(s.epg_channel_id, 120), url: `${root}/${auth}/${s.stream_id}.${c.ext}` });
  }
  if (kind === 'movie') {
    const ext = /^[a-z0-9]{2,4}$/i.test(s.container_extension || '') ? s.container_extension : 'mp4';
    return base({ kind, name, groupTitle: cut(group, 120), logo: cut(s.stream_icon, 1000), url: `${root}/movie/${auth}/${s.stream_id}.${ext}` });
  }
  return base({
    kind: 'series', name, groupTitle: cut(group, 120), logo: cut(s.cover, 1000),
    tvgId: `${SERIES_MARK}${s.series_id}`, seriesName: name, url: `${root}/series/${auth}/serie-${s.series_id}`,
  });
}

/** Confere a conta: senha certa e assinatura ativa. Devolve a base dos vídeos. */
export async function xtreamLogin(c, signal) {
  const info = await xtreamApi(c, {}, signal);
  const user = info?.user_info;
  if (!user || Number(user.auth) !== 1) throw new HttpError(401, 'O provedor recusou o usuário ou a senha da lista');
  const status = String(user.status || '').toLowerCase();
  if (status && status !== 'active') {
    const exp = Number(user.exp_date) > 0 ? ` em ${new Date(Number(user.exp_date) * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : '';
    throw new HttpError(402, status === 'expired' ? `A assinatura da lista venceu${exp}` : `A conta da lista está "${user.status}" no provedor`);
  }
  return streamBase(c, info.server_info);
}

const KINDS = [
  ['live', 'get_live_categories', 'get_live_streams'],
  ['movie', 'get_vod_categories', 'get_vod_streams'],
  ['series', 'get_series_categories', 'get_series'],
];

/** Todos os itens da conta, categoria por categoria. */
export async function* xtreamItems(c, signal) {
  const root = await xtreamLogin(c, signal);
  for (const [kind, catsAction, listAction] of KINDS) {
    const cats = await xtreamApi(c, { action: catsAction }, signal).catch(() => null);
    const list = Array.isArray(cats) && cats.length ? cats : [{ category_id: '', category_name: '' }];
    for (const cat of list) {
      const rows = await xtreamApi(c, cat.category_id ? { action: listAction, category_id: cat.category_id } : { action: listAction }, signal);
      if (!Array.isArray(rows)) continue;
      for (const s of rows) yield toItem(kind, s, { root, c, group: cat.category_name || '' });
    }
  }
}

/** Episódios de uma série (get_series_info), como itens prontos para gravar. */
export async function xtreamEpisodes(c, seriesId, { root, seriesName, group, logo }, signal) {
  const info = await xtreamApi(c, { action: 'get_series_info', series_id: String(seriesId) }, signal);
  const auth = `${encodeURIComponent(c.user)}/${encodeURIComponent(c.pass)}`;
  const out = [];
  const seasons = info?.episodes && typeof info.episodes === 'object' ? info.episodes : {};
  for (const [seasonKey, eps] of Object.entries(seasons)) {
    for (const e of Array.isArray(eps) ? eps : []) {
      const season = Number(e.season ?? seasonKey) || 0;
      const episode = Number(e.episode_num) || 0;
      const ext = /^[a-z0-9]{2,4}$/i.test(e.container_extension || '') ? e.container_extension : 'mp4';
      const pad = (n) => String(n).padStart(2, '0');
      const name = cut(e.title || `${seriesName} S${pad(season)}E${pad(episode)}`, 200);
      out.push(base({
        kind: 'series', name, groupTitle: group, logo: cut(e.info?.movie_image || logo, 1000),
        url: `${root}/series/${auth}/${e.id}.${ext}`, seriesName, season, episode,
      }));
    }
  }
  return out;
}
