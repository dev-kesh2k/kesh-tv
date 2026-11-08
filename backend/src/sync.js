// Importação das listas em fluxo: lê linha a linha enquanto baixa e grava em lotes (listas com centenas de
// milhares de itens cabem na memória do container). Canais que continuam na lista mantêm o id (favoritos/recentes).
import crypto from 'node:crypto';
import { prisma, HttpError } from './db.js';
import { createParser } from './m3u.js';
import { safeFetch } from './net.js';
import { EPG_REFRESH_MS, epgUrlFor, syncEpg } from './epg.js';
import { SERIES_MARK, xtreamCreds, xtreamEpisodes, xtreamItems } from './xtream.js';

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_ITEMS = 1_000_000;
const TOTAL_TIMEOUT = 15 * 60_000;
const IDLE_TIMEOUT = 90_000;
const BATCH = 2000;
const STALE_MS = 20 * 60_000;
const RETRY_AFTER_ERROR_MS = 6 * 3600_000;
// Atualização "em andamento" há mais que isso morreu no meio (container reiniciado/deploy): canais novos e antigos
// ficaram juntos (lista duplicada). A atualização automática refaz na hora.
const ORPHAN_MS = 60 * 60_000;

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

export async function insertBatch(playlistId, items, syncId) {
  // A mesma URL duas vezes no mesmo INSERT quebra o ON CONFLICT: fica a última. Entre lotes, o upsert resolve.
  const part = [...new Map(items.map((it) => [it.url, it])).values()];
  const col = (k) => part.map((it) => it[k]);
  await prisma.$executeRaw`
    INSERT INTO "Channel" ("playlistId","name","groupTitle","logo","tvgId","url","kind","userAgent","referrer","position","seriesName","season","episode","searchName","syncId")
    SELECT ${playlistId}::uuid, * FROM unnest(
      ${col('name')}::text[], ${col('groupTitle')}::text[], ${col('logo')}::text[], ${col('tvgId')}::text[],
      ${col('url')}::text[], ${col('kind')}::text[], ${col('userAgent')}::text[], ${col('referrer')}::text[],
      ${col('position')}::int[], ${col('seriesName')}::text[], ${col('season')}::int[], ${col('episode')}::int[], ${col('searchName')}::text[],
      array_fill(${syncId}::text, ARRAY[${part.length}::int]))
    ON CONFLICT ("playlistId","url") DO UPDATE SET
      "name"=EXCLUDED."name","groupTitle"=EXCLUDED."groupTitle","logo"=EXCLUDED."logo","tvgId"=EXCLUDED."tvgId",
      "kind"=EXCLUDED."kind","userAgent"=EXCLUDED."userAgent","referrer"=EXCLUDED."referrer","position"=EXCLUDED."position",
      "seriesName"=EXCLUDED."seriesName","season"=EXCLUDED."season","episode"=EXCLUDED."episode","searchName"=EXCLUDED."searchName","syncId"=EXCLUDED."syncId"`;
}

/** Itens de um M3U lido linha a linha; o cabeçalho #EXTM3U fica em `header` ao terminar. */
function m3uItems(lines, header) {
  const parser = createParser({ dedupe: false });
  return (async function* () {
    for await (const line of lines) {
      const it = parser.push(line);
      if (it) yield it;
    }
    Object.assign(header, parser.header);
  })();
}

/**
 * Trocar o link da lista (outro servidor/usuário) muda a URL de todos os canais, e eles viram linhas novas.
 * Antes de apagar as antigas, passa recentes e favoritos para o canal novo de mesmo nome/tipo/episódio
 * (havendo vários, o de mesmo id de stream no fim da URL e depois o primeiro da lista).
 */
async function carryOverUserData(playlistId, syncId) {
  await prisma.$executeRaw`
    WITH m AS (
      SELECT DISTINCT ON (o."id") o."id" AS old_id, n."id" AS new_id
      FROM "Channel" o
      JOIN "Channel" n ON n."playlistId" = o."playlistId" AND n."syncId" = ${syncId} AND n."kind" = o."kind"
        AND n."name" = o."name" AND n."seriesName" = o."seriesName" AND n."season" = o."season" AND n."episode" = o."episode"
      WHERE o."playlistId" = ${playlistId}::uuid AND o."syncId" <> ${syncId}
        AND (EXISTS (SELECT 1 FROM "History" h WHERE h."channelId" = o."id")
          OR EXISTS (SELECT 1 FROM "Favorite" f WHERE f."channelId" = o."id"))
      ORDER BY o."id",
        (substring(n."url" from '/([0-9]+)(\\.[A-Za-z0-9]+)?$') IS NOT DISTINCT FROM substring(o."url" from '/([0-9]+)(\\.[A-Za-z0-9]+)?$')) DESC,
        n."position"
    ), fav AS (
      INSERT INTO "Favorite" ("userId", "channelId", "createdAt")
      SELECT f."userId", m.new_id, f."createdAt" FROM "Favorite" f JOIN m ON m.old_id = f."channelId"
      ON CONFLICT ("userId", "channelId") DO NOTHING
    )
    INSERT INTO "History" ("userId", "channelId", "watchedAt", "position", "duration")
    SELECT DISTINCT ON (h."userId", m.new_id) h."userId", m.new_id, h."watchedAt", h."position", h."duration"
    FROM "History" h JOIN m ON m.old_id = h."channelId"
    ORDER BY h."userId", m.new_id, h."watchedAt" DESC
    ON CONFLICT ("userId", "channelId") DO UPDATE
      SET "watchedAt" = EXCLUDED."watchedAt", "position" = EXCLUDED."position", "duration" = EXCLUDED."duration"
      WHERE EXCLUDED."watchedAt" > "History"."watchedAt"`;
}

/**
 * Grava os itens; só apaga os que sumiram se a leitura terminou inteira. Devolve as contagens.
 * `xtream`: séries vêm como um item só (episódios buscados ao abrir); as que já têm episódios gravados os mantêm.
 */
async function importItems(playlistId, items, { xtream = false } = {}) {
  const syncId = crypto.randomUUID();
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
  for await (const it of items) {
    if (total >= MAX_ITEMS) break;
    it.position = total++;
    batch.push(it);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  if (!total) throw new HttpError(422, 'Nenhum canal encontrado. Confira se o arquivo/link é uma lista M3U.');
  if (xtream) {
    const mark = `${SERIES_MARK}%`;
    // Episódios já gravados (de uma leitura anterior) continuam valendo para as séries que ainda existem…
    await prisma.$executeRaw`
      UPDATE "Channel" SET "syncId" = ${syncId}
      WHERE "playlistId" = ${playlistId}::uuid AND "kind" = 'series' AND "syncId" <> ${syncId} AND "tvgId" NOT LIKE ${mark}
        AND "seriesName" IN (SELECT "seriesName" FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid AND "syncId" = ${syncId} AND "tvgId" LIKE ${mark})`;
    // …e aí o item provisório dessas séries sai.
    await prisma.$executeRaw`
      DELETE FROM "Channel" p WHERE p."playlistId" = ${playlistId}::uuid AND p."syncId" = ${syncId} AND p."tvgId" LIKE ${mark}
        AND EXISTS (SELECT 1 FROM "Channel" e WHERE e."playlistId" = p."playlistId" AND e."seriesName" = p."seriesName" AND e."tvgId" NOT LIKE ${mark} AND e."kind" = 'series')`;
  }
  await carryOverUserData(playlistId, syncId);
  await prisma.$executeRaw`DELETE FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid AND "syncId" <> ${syncId}`;
  const [c] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "kind" = 'live')::int AS live,
           COUNT(*) FILTER (WHERE "kind" = 'movie')::int AS movie,
           COUNT(DISTINCT COALESCE(NULLIF("seriesName", ''), "name")) FILTER (WHERE "kind" = 'series')::int AS series
    FROM "Channel" WHERE "playlistId" = ${playlistId}::uuid`;
  // seriesCount = número de séries (não de episódios); channelCount = todos os itens.
  return { channelCount: c.total, liveCount: c.live, movieCount: c.movie, seriesCount: c.series };
}

/**
 * Lê a lista: o arquivo enviado, ou o link. Link Xtream (get.php) que falhar — provedores bloqueiam o M3U,
 * devolvem 404 ou cortam no meio — é lido pela API do painel (player_api.php).
 */
async function readPlaylist(playlistId, pl, source) {
  const header = {};
  if (source != null) return { counts: await importItems(playlistId, m3uItems(linesOf(source), header)), header };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), TOTAL_TIMEOUT);
  try {
    return { counts: await importItems(playlistId, m3uItems(linesOf(download(pl.url, ctrl)), header)), header };
  } catch (err) {
    const xc = xtreamCreds(pl.url);
    if (!xc || err?.status === 413) throw abortMessage(ctrl, err);
    console.warn('sync', playlistId, 'M3U falhou, tentando a API Xtream:', abortMessage(ctrl, err).message);
  } finally {
    clearTimeout(timer);
  }
  const ctrl2 = new AbortController();
  const timer2 = setTimeout(() => ctrl2.abort(new Error('timeout')), TOTAL_TIMEOUT);
  try {
    return { counts: await importItems(playlistId, xtreamItems(xtreamCreds(pl.url), ctrl2.signal), { xtream: true }), header };
  } catch (err) {
    throw abortMessage(ctrl2, err);
  } finally {
    clearTimeout(timer2);
  }
}

/** Erro com a mensagem certa quando a leitura foi cortada pelo tempo. */
function abortMessage(ctrl, err) {
  if (ctrl.signal.aborted) {
    return new HttpError(504, ctrl.signal.reason?.message === 'idle' ? 'O servidor da lista parou de enviar dados' : 'O download da lista passou de 15 minutos');
  }
  return err;
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
    try {
      const { counts, header } = await readPlaylist(playlistId, pl, source);
      const epgUrl = epgUrlFor(pl.url, header);
      const saved = await prisma.playlist.update({ where: { id: playlistId }, data: { ...counts, epgUrl, status: 'ok', error: null, syncedAt: new Date(), syncStarted: null } });
      // Guia de programação em segundo plano (não segura a lista).
      if (epgUrl) syncEpg(playlistId).catch(() => {});
      return saved;
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Falha ao ler a lista';
      if (!(err instanceof HttpError)) console.error('sync', playlistId, err);
      // syncStarted fica com a hora da tentativa: a atualização automática espera 6 h antes de tentar de novo.
      await prisma.playlist.update({ where: { id: playlistId }, data: { status: 'error', error: message, syncStarted: new Date() } }).catch(() => {});
      throw new HttpError(err instanceof HttpError ? err.status : 500, message);
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
      const orphanBefore = new Date(Date.now() - ORPHAN_MS);
      // Arquivo enviado não dá para ler de novo sozinho: avisa para enviar outra vez.
      await prisma.playlist.updateMany({
        where: { status: 'syncing', url: null, syncStarted: { lt: orphanBefore } },
        data: { status: 'error', error: 'A atualização foi interrompida: envie o arquivo de novo', syncStarted: new Date() },
      });
      const orphans = await prisma.playlist.findMany({
        where: { status: 'syncing', url: { not: null }, OR: [{ syncStarted: null }, { syncStarted: { lt: orphanBefore } }] },
        select: { id: true },
      });
      for (const p of orphans) {
        console.warn('auto-refresh', p.id, 'atualização interrompida, refazendo');
        await startSync(p.id).then((r) => r.done).catch((e) => console.warn('auto-refresh', p.id, e.message));
      }
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

/**
 * Série importada pela API Xtream ainda sem episódios: busca no provedor (get_series_info) e grava no lugar do
 * item provisório, na mesma posição. Pedidos simultâneos da mesma série esperam o mesmo resultado.
 */
const expanding = new Map();
export function expandXtreamSeries(pl, placeholder) {
  const key = placeholder.id;
  if (!expanding.has(key)) {
    const job = (async () => {
      const c = xtreamCreds(pl.url);
      const row = await prisma.channel.findUnique({ where: { id: placeholder.id }, select: { url: true, syncId: true, position: true, seriesName: true, groupTitle: true, logo: true, tvgId: true } });
      if (!c || !row?.tvgId?.startsWith(SERIES_MARK)) return;
      const root = row.url.slice(0, row.url.indexOf('/series/'));
      const eps = await xtreamEpisodes(c, row.tvgId.slice(SERIES_MARK.length), { root, seriesName: row.seriesName, group: row.groupTitle, logo: row.logo });
      if (!eps.length) throw new HttpError(404, 'O provedor não tem episódios desta série');
      for (const e of eps) e.position = row.position;
      for (let i = 0; i < eps.length; i += BATCH) await insertBatch(pl.id, eps.slice(i, i + BATCH), row.syncId || '');
      await prisma.channel.delete({ where: { id: placeholder.id } }).catch(() => {});
    })().finally(() => expanding.delete(key));
    expanding.set(key, job);
  }
  return expanding.get(key);
}
