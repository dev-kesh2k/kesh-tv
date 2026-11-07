// Leitura de listas M3U/M3U8 (formato estendido #EXTM3U/#EXTINF, com atributos tvg-* e group-title).

const ATTR_RE = /([A-Za-z0-9_-]+)="([^"]*)"/g;

/** Tipo do item: Xtream usa /movie/ e /series/ no caminho; o resto é TV ao vivo, salvo grupos óbvios. */
export function classify(url, group) {
  const u = url.toLowerCase();
  if (/\/movies?\//.test(u)) return 'movie';
  if (/\/series\//.test(u)) return 'series';
  const g = group.toLowerCase();
  if (/\b(s[ée]ries?|novelas?|temporadas?)\b/.test(g)) return 'series';
  if (/\b(filmes?|movies?|vod|cinema|lan[çc]amentos)\b/.test(g)) return 'movie';
  if (/\.(mp4|mkv|avi|mov)(\?|$)/.test(u)) return 'movie';
  return 'live';
}

/**
 * Converte o texto da lista em itens { name, groupTitle, logo, tvgId, url, kind, userAgent, referrer }.
 * Aceita lista sem #EXTM3U, quebras CRLF, #EXTGRP e opções #EXTVLCOPT de user-agent/referrer.
 */
export function parseM3U(text) {
  const items = [];
  const seen = new Set();
  let info = null;
  let opts = {};
  let extGroup = '';
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = {};
      const head = line.slice(0, findTitleComma(line));
      for (const m of head.matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = m[2].trim();
      const comma = findTitleComma(line);
      const title = comma >= 0 ? line.slice(comma + 1).trim() : '';
      info = { attrs, title };
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      extGroup = line.slice(8).trim();
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:')) {
      const [k, ...v] = line.slice(11).split('=');
      const key = k.trim().toLowerCase();
      if (key === 'http-user-agent') opts.userAgent = v.join('=').trim();
      if (key === 'http-referrer' || key === 'http-referer') opts.referrer = v.join('=').trim();
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!/^https?:\/\//i.test(line)) {
      info = null;
      opts = {};
      continue;
    }
    // URL do item: pode vir com "|User-Agent=..." (formato Kodi).
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
    if (url.length > 2000 || seen.has(url)) {
      info = null;
      opts = {};
      continue;
    }
    seen.add(url);
    const a = info?.attrs || {};
    const groupTitle = cut(a['group-title'] || extGroup || '', 120);
    const name = cut(info?.title || a['tvg-name'] || nameFromUrl(url), 200);
    items.push({
      name,
      groupTitle,
      logo: cut(a['tvg-logo'] || a['logo'] || '', 1000),
      tvgId: cut(a['tvg-id'] || '', 120),
      url,
      kind: classify(url, groupTitle),
      userAgent: cut(opts.userAgent || a['user-agent'] || '', 300),
      referrer: cut(opts.referrer || '', 500),
    });
    info = null;
    opts = {};
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
