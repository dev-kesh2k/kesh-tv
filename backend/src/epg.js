// Guia de programação (EPG): descobre o XMLTV da lista, importa as próximas horas e responde "agora / a seguir".
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { prisma } from './db.js';
import { safeFetch } from './net.js';
import { createXmltvParser } from './xmltv.js';

const WINDOW_BEFORE = 2 * 3600_000; // programas que acabaram há até 2 h
const WINDOW_AFTER = 36 * 3600_000; // e as próximas 36 h
const BATCH = 2000;
export const EPG_REFRESH_MS = 6 * 3600_000;

/** URL do guia: a do cabeçalho da lista (url-tvg/x-tvg-url) ou, em servidores Xtream, o xmltv.php. */
export function epgUrlFor(listUrl, header = {}) {
  const fromHeader = String(header['url-tvg'] || header['x-tvg-url'] || header['tvg-url'] || '').split(',')[0].trim();
  if (/^https?:\/\//i.test(fromHeader)) return fromHeader;
  try {
    const u = new URL(listUrl);
    const user = u.searchParams.get('username');
    const pass = u.searchParams.get('password');
    if (/\/get\.php$/i.test(u.pathname) && user && pass) {
      return `${u.origin}/xmltv.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    }
  } catch {
    /* lista enviada por arquivo */
  }
  return null;
}

/** Importa o guia de uma lista. Erros ficam gravados na lista (não atrapalham os canais). */
export async function syncEpg(playlistId) {
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!pl?.epgUrl) return;
  try {
    const ids = await prisma.$queryRaw`SELECT DISTINCT lower("tvgId") AS id FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid AND "kind" = 'live' AND "tvgId" <> ''`;
    const wanted = new Set(ids.map((r) => r.id));
    if (!wanted.size) {
      await prisma.playlist.update({ where: { id: playlistId }, data: { epgCount: 0, epgError: 'Os canais desta lista não têm tvg-id', epgSyncedAt: new Date() } });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10 * 60_000);
    const syncId = crypto.randomUUID();
    let count = 0;
    try {
      const { res } = await safeFetch(pl.epgUrl, { signal: ctrl.signal, timeoutMs: 60_000 });
      if (!res.ok) throw new Error(`o servidor do guia respondeu ${res.status}`);
      let body = Readable.fromWeb(res.body);
      if (/\.gz(\?|$)/i.test(pl.epgUrl) || /gzip/i.test(res.headers.get('content-type') || '')) body = body.pipe(zlib.createGunzip());
      body.setEncoding('utf8');
      const parser = createXmltvParser();
      const from = Date.now() - WINDOW_BEFORE;
      const to = Date.now() + WINDOW_AFTER;
      let batch = [];
      // Guias de provedores costumam repetir o mesmo canal no XML: um programa por canal+início.
      const seen = new Set();
      const flush = async () => {
        if (!batch.length) return;
        const col = (k) => batch.map((p) => p[k]);
        await prisma.$executeRaw`
          INSERT INTO "Programme" ("playlistId","channel","start","stop","title","desc","syncId")
          SELECT ${playlistId}::uuid, * FROM unnest(${col('channel')}::text[], ${col('start')}::timestamp[], ${col('stop')}::timestamp[],
            ${col('title')}::text[], ${col('desc')}::text[], array_fill(${syncId}::text, ARRAY[${batch.length}::int]))`;
        count += batch.length;
        batch = [];
      };
      for await (const chunk of body) {
        for (const p of parser.push(chunk)) {
          const key = p.channel.toLowerCase();
          if (!wanted.has(key) || p.stop.getTime() < from || p.start.getTime() > to) continue;
          const dup = `${key}|${p.start.getTime()}`;
          if (seen.has(dup)) continue;
          seen.add(dup);
          batch.push({ ...p, channel: key });
          if (batch.length >= BATCH) await flush();
        }
      }
      await flush();
    } finally {
      clearTimeout(timer);
    }
    await prisma.$executeRaw`DELETE FROM "Programme" WHERE "playlistId" = ${playlistId}::uuid AND "syncId" <> ${syncId}`;
    await prisma.playlist.update({ where: { id: playlistId }, data: { epgCount: count, epgError: count ? null : 'O guia não tem programas para estes canais', epgSyncedAt: new Date() } });
  } catch (err) {
    console.warn('epg', playlistId, err.message);
    await prisma.playlist.update({ where: { id: playlistId }, data: { epgError: `Guia indisponível: ${err.message}`, epgSyncedAt: new Date() } }).catch(() => {});
  }
}

/** Agora e a seguir para vários canais de uma vez: Map "playlistId|tvg-id" → { now, next }. */
export async function nowNext(rows) {
  const live = rows.filter((r) => r.kind === 'live' && r.tvgId);
  const out = new Map();
  if (!live.length) return out;
  const now = new Date();
  const progs = await prisma.programme.findMany({
    where: {
      playlistId: { in: [...new Set(live.map((r) => r.playlistId))] },
      channel: { in: [...new Set(live.map((r) => r.tvgId.toLowerCase()))] },
      stop: { gt: now },
      start: { lt: new Date(now.getTime() + 12 * 3600_000) },
    },
    orderBy: { start: 'asc' },
    select: { playlistId: true, channel: true, start: true, stop: true, title: true },
  });
  for (const p of progs) {
    const key = `${p.playlistId}|${p.channel}`;
    const cur = out.get(key) || {};
    const item = { title: p.title, start: p.start, stop: p.stop };
    if (p.start <= now && !cur.now) cur.now = item;
    else if (p.start > now && !cur.next) cur.next = item;
    out.set(key, cur);
  }
  return out;
}

/** Programação de um canal: o atual e os próximos. */
export function channelGuide(ch, limit = 24) {
  if (ch.kind !== 'live' || !ch.tvgId) return Promise.resolve([]);
  return prisma.programme.findMany({
    where: { playlistId: ch.playlistId, channel: ch.tvgId.toLowerCase(), stop: { gt: new Date() } },
    orderBy: { start: 'asc' },
    take: limit,
    select: { start: true, stop: true, title: true, desc: true },
  });
}
