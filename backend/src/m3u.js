// Leitura de listas M3U/M3U8 (formato estendido #EXTM3U/#EXTINF, com atributos tvg-* e group-title).

const ATTR_RE = /([A-Za-z0-9_-]+)="([^"]*)"/g;

/**
 * Tipo do item. O link manda primeiro (Xtream: /movie/, /series/, /live/ ou .ts/.m3u8 = ao vivo);
 * o nome do grupo só decide quando o link não diz nada (ex.: arquivo .mp4 solto).
 */
export function classify(url, group) {
  const path = url.toLowerCase().split('?')[0];
  if (/\/movies?\//.test(path)) return 'movie';
  if (/\/series\//.test(path)) return 'series';
  if (/\/live\//.test(path) || /\.(ts|m3u8?)$/.test(path)) return 'live';
  const g = group.toLowerCase();
  const isFile = /\.(mp4|mkv|avi|mov|m4v|webm)$/.test(path);
  if (/\b(s[ée]ries?|novelas?|temporadas?)\b/.test(g) && (isFile || !/\b(canais|ao vivo|24h|tv)\b/.test(g))) return 'series';
  if (isFile || /\b(filmes?|movies?|vod|cinema|lan[çc]amentos)\b/.test(g)) return 'movie';
  return 'live';
}

/** Separa "Nome da Série S02E05" em { seriesName, season, episode }. */
export function splitEpisode(title) {
  const m = String(title).match(/^(.*?)[\s._-]*\bS(\d{1,3})\s*[._-]?\s*E(\d{1,4})\b/i);
  if (!m || !m[1].trim()) return { seriesName: '', season: 0, episode: 0 };
  return { seriesName: m[1].trim().replace(/[\s:|–-]+$/, '').slice(0, 200), season: Number(m[2]), episode: Number(m[3]) };
}

/**
 * Leitor linha a linha (serve para listas enormes lidas em fluxo). `push(line)` devolve o item quando a linha
 * fecha um canal; itens: { name, groupTitle, logo, tvgId, url, kind, userAgent, referrer, seriesName, season, episode }.
 * Aceita lista sem #EXTM3U, CRLF, #EXTGRP, opções #EXTVLCOPT de user-agent/referrer e "url|User-Agent=..." (Kodi).
 */
export function createParser({ dedupe = true } = {}) {
  const seen = dedupe ? new Set() : null;
  let info = null;
  let opts = {};
  let extGroup = '';
  const reset = () => {
    info = null;
    opts = {};
  };
  const header = {};
  return {
    /** Atributos da linha #EXTM3U (ex.: url-tvg / x-tvg-url com o guia de programação). */
    header,
    push(raw) {
      const line = raw.trim();
      if (!line) return null;
      if (line.startsWith('#EXTM3U')) {
        for (const m of line.matchAll(ATTR_RE)) header[m[1].toLowerCase()] = m[2].trim();
        return null;
      }
      if (line.startsWith('#EXTINF')) {
        const comma = findTitleComma(line);
        const attrs = {};
        for (const m of (comma >= 0 ? line.slice(0, comma) : line).matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = m[2].trim();
        info = { attrs, title: comma >= 0 ? line.slice(comma + 1).trim() : '' };
        return null;
      }
      if (line.startsWith('#EXTGRP:')) {
        extGroup = line.slice(8).trim();
        return null;
      }
      if (line.startsWith('#EXTVLCOPT:')) {
        const [k, ...v] = line.slice(11).split('=');
        const key = k.trim().toLowerCase();
        if (key === 'http-user-agent') opts.userAgent = v.join('=').trim();
        if (key === 'http-referrer' || key === 'http-referer') opts.referrer = v.join('=').trim();
        return null;
      }
      if (line.startsWith('#')) return null;
      if (!/^https?:\/\//i.test(line)) {
        reset();
        return null;
      }
      let url = line;
      const pipe = url.indexOf('|');
      if (pipe > 0) {
        for (const part of url.slice(pipe + 1).split('&')) {
          const [k, ...v] = part.split('=');
          const key = decodeSafe(k).toLowerCase();
          if (key === 'user-agent') opts.userAgent = decodeSafe(v.join('='));
          if (key === 'referer' || key === 'referrer') opts.referrer = decodeSafe(v.join('='));
        }
        url = url.slice(0, pipe);
      }
      if (url.length > 2000 || seen?.has(url)) {
        reset();
        return null;
      }
      seen?.add(url);
      const a = info?.attrs || {};
      const groupTitle = cut(a['group-title'] || extGroup || '', 120);
      const name = cut(info?.title || a['tvg-name'] || nameFromUrl(url), 200);
      const kind = classify(url, groupTitle);
      const item = {
        name,
        groupTitle,
        logo: cut(a['tvg-logo'] || a['logo'] || '', 1000),
        tvgId: cut(a['tvg-id'] || '', 120),
        url,
        kind,
        userAgent: cut(opts.userAgent || a['user-agent'] || '', 300),
        referrer: cut(opts.referrer || '', 500),
        ...(kind === 'series' ? splitEpisode(name) : { seriesName: '', season: 0, episode: 0 }),
      };
      reset();
      return item;
    },
  };
}

export function parseM3U(text) {
  const parser = createParser();
  const items = [];
  for (const line of String(text).split(/\r?\n/)) {
    const it = parser.push(line);
    if (it) items.push(it);
  }
  return items;
}

/** Vírgula que separa atributos do título (ignora vírgulas dentro de aspas). */
function findTitleComma(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) return i;
  }
  return -1;
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s || '').trim();
  } catch {
    return String(s || '').trim();
  }
}

function nameFromUrl(url) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || url;
    return decodeSafe(last.replace(/\.[a-z0-9]{2,4}$/i, ''));
  } catch {
    return url;
  }
}

const cut = (s, n) => String(s).slice(0, n);
