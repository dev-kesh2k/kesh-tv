// Importação das listas: baixa (ou recebe o texto), lê e grava os canais por diferença,
// mantendo o id dos canais que continuam na lista (favoritos e recentes não se perdem).
import crypto from 'node:crypto';
import { prisma, HttpError } from './db.js';
import { parseM3U } from './m3u.js';
import { safeFetch } from './net.js';

const MAX_BYTES = 80 * 1024 * 1024;
const MAX_ITEMS = 300_000;
const BATCH = 2000;

export async function downloadList(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), 120_000);
  try {
    const { res } = await safeFetch(url, { signal: ctrl.signal, timeoutMs: 30_000 });
    if (!res.ok) throw new HttpError(502, `O servidor da lista respondeu ${res.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new HttpError(413, 'Lista grande demais (máx. 80 MB)');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (ctrl.signal.aborted) throw new HttpError(504, 'O download da lista passou de 2 minutos');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Grava os itens da lista. Retorna as contagens. */
export async function saveItems(playlistId, items) {
  if (!items.length) throw new HttpError(422, 'Nenhum canal encontrado. Confira se o arquivo/link é uma lista M3U.');
  if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
  const syncId = crypto.randomUUID();
  for (let i = 0; i < items.length; i += BATCH) {
    const part = items.slice(i, i + BATCH);
    const col = (k) => part.map((it) => it[k]);
    const pos = part.map((_, j) => i + j);
    await prisma.$executeRaw`
      INSERT INTO "Channel" ("playlistId","name","groupTitle","logo","tvgId","url","kind","userAgent","referrer","position","syncId")
      SELECT ${playlistId}::uuid, * FROM unnest(
        ${col('name')}::text[], ${col('groupTitle')}::text[], ${col('logo')}::text[], ${col('tvgId')}::text[],
        ${col('url')}::text[], ${col('kind')}::text[], ${col('userAgent')}::text[], ${col('referrer')}::text[],
        ${pos}::int[], array_fill(${syncId}::text, ARRAY[${part.length}::int]))
      ON CONFLICT ("playlistId","url") DO UPDATE SET
        "name"=EXCLUDED."name","groupTitle"=EXCLUDED."groupTitle","logo"=EXCLUDED."logo","tvgId"=EXCLUDED."tvgId",
        "kind"=EXCLUDED."kind","userAgent"=EXCLUDED."userAgent","referrer"=EXCLUDED."referrer",
        "position"=EXCLUDED."position","syncId"=EXCLUDED."syncId"`;
  }
  await prisma.$executeRaw`DELETE FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid AND "syncId" <> ${syncId}`;
  const counts = { live: 0, movie: 0, series: 0 };
  for (const it of items) counts[it.kind]++;
  return { channelCount: items.length, liveCount: counts.live, movieCount: counts.movie, seriesCount: counts.series };
}

const STALE_MS = 15 * 60_000;

/**
 * Atualiza uma lista; `text` vem do upload, senão baixa do link. Reivindica a lista na hora (erro 409 se já
 * estiver em andamento) e devolve { playlist, done } — `done` termina quando a importação acaba. Erros ficam gravados na lista.
 */
export async function startSync(playlistId, text) {
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!pl) throw new HttpError(404, 'Lista não encontrada');
  if (text == null && !pl.url) throw new HttpError(400, 'Esta lista veio de arquivo: envie o arquivo de novo para atualizar');
  // Reivindicação atômica (vale entre réplicas); importação parada há 15 min pode ser retomada.
  const claimed = await prisma.playlist.updateMany({
    where: { id: playlistId, OR: [{ status: { not: 'syncing' } }, { syncStarted: null }, { syncStarted: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'syncing', error: null, syncStarted: new Date() },
  });
  if (!claimed.count) throw new HttpError(409, 'Esta lista já está sendo atualizada');
  const done = (async () => {
    try {
      const body = text ?? (await downloadList(pl.url));
      const counts = await saveItems(playlistId, parseM3U(body));
      return await prisma.playlist.update({ where: { id: playlistId }, data: { ...counts, status: 'ok', error: null, syncedAt: new Date(), syncStarted: null } });
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Falha ao ler a lista';
      if (!(err instanceof HttpError)) console.error('sync', playlistId, err);
      await prisma.playlist.update({ where: { id: playlistId }, data: { status: 'error', error: message, syncStarted: null } }).catch(() => {});
      throw err instanceof HttpError ? err : new HttpError(500, message);
    }
  })();
  done.catch(() => {});
  return { playlist: await prisma.playlist.findUnique({ where: { id: playlistId } }), done };
}

/** Atualização automática diária das listas por link (a reivindicação evita que duas réplicas façam a mesma). */
export function startAutoRefresh() {
  const tick = async () => {
    try {
      const due = await prisma.playlist.findMany({
        where: { autoRefresh: true, url: { not: null }, status: { not: 'syncing' }, OR: [{ syncedAt: null }, { syncedAt: { lt: new Date(Date.now() - 24 * 3600_000) } }] },
        select: { id: true },
      });
      for (const p of due) await startSync(p.id).then((r) => r.done).catch((e) => console.warn('auto-refresh', p.id, e.message));
    } catch (err) {
      console.warn('auto-refresh', err.message);
    }
  };
  setTimeout(tick, 60_000 + Math.random() * 60_000);
  setInterval(tick, 30 * 60_000).unref();
}
