// Importação das listas em fluxo: lê linha a linha enquanto baixa e grava em lotes (listas com centenas de
// milhares de itens cabem na memória do container). Canais que continuam na lista mantêm o id (favoritos/recentes).
import crypto from 'node:crypto';
import { prisma, HttpError } from './db.js';
import { createParser } from './m3u.js';
import { safeFetch } from './net.js';
import { EPG_REFRESH_MS, epgUrlFor, syncEpg } from './epg.js';

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_ITEMS = 1_000_000;
const TOTAL_TIMEOUT = 15 * 60_000;
const IDLE_TIMEOUT = 90_000;
const BATCH = 2000;
const STALE_MS = 20 * 60_000;
const RETRY_AFTER_ERROR_MS = 6 * 3600_000;

/** Linhas de um texto (upload) ou de um fluxo de bytes (download). */
async function* linesOf(source) {
  if (typeof source === 'string') {
    yield* source.split(/\r?\n/);
    return;
  }
  const decoder = new TextDecoder('utf-8');
  let rest = '';
  for await (const chunk of source) {
    rest += decoder.decode(chunk, { stream: true });
    const parts = rest.split(/\r?\n/);
    rest = parts.pop() ?? '';
    yield* parts;
  }
  rest += decoder.decode();
  if (rest) yield rest;
}

/** Baixa a lista com limite de tamanho, tempo total e tempo parado; devolve o fluxo de bytes. */
async function* download(url, ctrl) {
  const { res } = await safeFetch(url, { signal: ctrl.signal, timeoutMs: 60_000 });
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    throw new HttpError(502, `O servidor da lista respondeu ${res.status}`);
  }
  let size = 0;
  let idle = setTimeout(() => ctrl.abort(new Error('idle')), IDLE_TIMEOUT);
  try {
    for await (const chunk of res.body) {
      clearTimeout(idle);
      idle = setTimeout(() => ctrl.abort(new Error('idle')), IDLE_TIMEOUT);
      size += chunk.length;
      if (size > MAX_BYTES) throw new HttpError(413, 'Lista grande demais (máx. 300 MB)');
      yield chunk;
    }
  } finally {
    clearTimeout(idle);
  }
}

async function insertBatch(playlistId, items, syncId) {
  // A mesma URL duas vezes no mesmo INSERT quebra o ON CONFLICT: fica a última. Entre lotes, o upsert resolve.
  const part = [...new Map(items.map((it) => [it.url, it])).values()];
  const col = (k) => part.map((it) => it[k]);
  await prisma.$executeRaw`
    INSERT INTO "Channel" ("playlistId","name","groupTitle","logo","tvgId","url","kind","userAgent","referrer","position","seriesName","season","episode","syncId")
    SELECT ${playlistId}::uuid, * FROM unnest(
      ${col('name')}::text[], ${col('groupTitle')}::text[], ${col('logo')}::text[], ${col('tvgId')}::text[],
      ${col('url')}::text[], ${col('kind')}::text[], ${col('userAgent')}::text[], ${col('referrer')}::text[],
      ${col('position')}::int[], ${col('seriesName')}::text[], ${col('season')}::int[], ${col('episode')}::int[],
      array_fill(${syncId}::text, ARRAY[${part.length}::int]))
    ON CONFLICT ("playlistId","url") DO UPDATE SET
      "name"=EXCLUDED."name","groupTitle"=EXCLUDED."groupTitle","logo"=EXCLUDED."logo","tvgId"=EXCLUDED."tvgId",
      "kind"=EXCLUDED."kind","userAgent"=EXCLUDED."userAgent","referrer"=EXCLUDED."referrer","position"=EXCLUDED."position",
      "seriesName"=EXCLUDED."seriesName","season"=EXCLUDED."season","episode"=EXCLUDED."episode","syncId"=EXCLUDED."syncId"`;
}

/** Lê e grava a lista; só apaga os canais que sumiram se a leitura terminou inteira. Devolve contagens e o cabeçalho #EXTM3U. */
async function importLines(playlistId, lines) {
  const syncId = crypto.randomUUID();
  const parser = createParser({ dedupe: false });
  let total = 0;
  let batch = [];
  let lastProgress = Date.now();
  const flush = async () => {
    if (!batch.length) return;
    await insertBatch(playlistId, batch, syncId);
    batch = [];
    if (Date.now() - lastProgress > 2000) {
      lastProgress = Date.now();
      await prisma.playlist.update({ where: { id: playlistId }, data: { syncProgress: total } });
    }
  };
  for await (const line of lines) {
    const it = parser.push(line);
    if (!it) continue;
    if (total >= MAX_ITEMS) break;
    it.position = total++;
    batch.push(it);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  if (!total) throw new HttpError(422, 'Nenhum canal encontrado. Confira se o arquivo/link é uma lista M3U.');
  await prisma.$executeRaw`DELETE FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid AND "syncId" <> ${syncId}`;
  const [c] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "kind" = 'live')::int AS live,
           COUNT(*) FILTER (WHERE "kind" = 'movie')::int AS movie,
           COUNT(DISTINCT COALESCE(NULLIF("seriesName", ''), "name")) FILTER (WHERE "kind" = 'series')::int AS series
    FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid`;
  // seriesCount = número de séries (não de episódios); channelCount = todos os itens.
  return { counts: { channelCount: c.total, liveCount: c.live, movieCount: c.movie, seriesCount: c.series }, header: parser.header };
}

/**
 * Atualiza uma lista; `source` é o corpo do upload (fluxo de bytes), senão baixa do link. Reivindica a lista na hora (409 se já estiver
 * em andamento, vale entre réplicas) e devolve { playlist, done }; a importação segue em segundo plano.
 */
export async function startSync(playlistId, source) {
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!pl) throw new HttpError(404, 'Lista não encontrada');
  if (source == null && !pl.url) throw new HttpError(400, 'Esta lista veio de arquivo: envie o arquivo de novo para atualizar');
  const claimed = await prisma.playlist.updateMany({
    where: { id: playlistId, OR: [{ status: { not: 'syncing' } }, { syncStarted: null }, { syncStarted: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'syncing', error: null, syncStarted: new Date(), syncProgress: 0 },
  });
  if (!claimed.count) throw new HttpError(409, 'Esta lista já está sendo atualizada');
  const done = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), TOTAL_TIMEOUT);
    try {
      const { counts, header } = await importLines(playlistId, linesOf(source ?? download(pl.url, ctrl)));
      const epgUrl = epgUrlFor(pl.url, header);
      const saved = await prisma.playlist.update({ where: { id: playlistId }, data: { ...counts, epgUrl, status: 'ok', error: null, syncedAt: new Date(), syncStarted: null } });
      // Guia de programação em segundo plano (não segura a lista).
      if (epgUrl) syncEpg(playlistId).catch(() => {});
      return saved;
    } catch (err) {
      let message = err instanceof HttpError ? err.message : 'Falha ao ler a lista';
      if (ctrl.signal.aborted) message = ctrl.signal.reason?.message === 'idle' ? 'O servidor da lista parou de enviar dados' : 'O download da lista passou de 15 minutos';
      else if (!(err instanceof HttpError)) console.error('sync', playlistId, err);
      // syncStarted fica com a hora da tentativa: a atualização automática espera 6 h antes de tentar de novo.
      await prisma.playlist.update({ where: { id: playlistId }, data: { status: 'error', error: message, syncStarted: new Date() } }).catch(() => {});
      throw new HttpError(err instanceof HttpError ? err.status : 500, message);
    } finally {
      clearTimeout(timer);
    }
  })();
  done.catch(() => {});
  return { playlist: await prisma.playlist.findUnique({ where: { id: playlistId } }), done };
}

/** Atualização automática diária das listas por link. */
export function startAutoRefresh() {
  let running = false;
  const tick = async () => {
    // Uma rodada por vez: listas grandes ou guias lentos podem passar do intervalo de 30 min.
    if (running) return;
    running = true;
    try {
      const due = await prisma.playlist.findMany({
        where: {
          autoRefresh: true,
          url: { not: null },
          status: { not: 'syncing' },
          OR: [{ syncedAt: null }, { syncedAt: { lt: new Date(Date.now() - 24 * 3600_000) } }],
          // Lista com erro (servidor fora do ar): no máximo uma tentativa a cada 6 h, não a cada 30 min.
          NOT: { status: 'error', syncStarted: { gt: new Date(Date.now() - RETRY_AFTER_ERROR_MS) } },
        },
        select: { id: true },
      });
      for (const p of due) await startSync(p.id).then((r) => r.done).catch((e) => console.warn('auto-refresh', p.id, e.message));
      // Guia de programação: a cada 6 h (as listas em si só 1×/dia).
      const epgDue = await prisma.playlist.findMany({
        where: { epgUrl: { not: null }, status: 'ok', OR: [{ epgSyncedAt: null }, { epgSyncedAt: { lt: new Date(Date.now() - EPG_REFRESH_MS) } }] },
        select: { id: true },
      });
      for (const p of epgDue) await syncEpg(p.id);
    } catch (err) {
      console.warn('auto-refresh', err.message);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 60_000 + Math.random() * 60_000);
  setInterval(tick, 30 * 60_000).unref();
}
