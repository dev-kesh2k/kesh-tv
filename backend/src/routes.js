import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, HttpError } from './db.js';
import { signToken, publicUser, requireAuth, tooManyAttempts, recordFailure, clearFailures } from './auth.js';
import { startSync } from './sync.js';
import { cleanSeconds, resumePoint, watchedFraction } from './progress.js';
import { serveConversion, startConversion, stopUserConversion } from './convert.js';
import { sign, verify } from './net.js';
import { logoLink, probeType, proxyLogo, proxyStream, streamLink, typeFromUrl, xtreamHls } from './stream.js';

export const api = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const KINDS = ['live', 'movie', 'series'];

function text(v, field, { max = 200, required = false } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${field} é obrigatório`);
  if (s.length > max) throw new HttpError(400, `${field} deve ter no máximo ${max} caracteres`);
  return s;
}
function password(v) {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, 'A senha deve ter pelo menos 8 caracteres');
  if (v.length > 200) throw new HttpError(400, 'Senha muito longa');
  return v;
}
function listUrl(v) {
  const s = text(v, 'Link da lista', { max: 2000, required: true });
  if (!/^https?:\/\/\S+$/i.test(s)) throw new HttpError(400, 'O link deve começar com http:// ou https://');
  return s;
}
const uuid = (v, what = 'Registro') => {
  if (!UUID_RE.test(String(v || ''))) throw new HttpError(404, `${what} não encontrado`);
  return String(v);
};
function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Apenas o administrador'));
  next();
}

// ---------- Saúde, proxy e autenticação (públicos) ----------
api.get('/health', wrap(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
}));

// Links assinados (HMAC + validade): o <video> e o <img> não mandam o token de login.
api.get('/stream', wrap(proxyStream));
api.get('/logo', wrap(proxyLogo));
// Arquivos da conversão: o id da sessão é aleatório (128 bits) e só quem iniciou a conversão o recebe.
api.get('/convert/:sid/:file', wrap(serveConversion));

api.post('/auth/login', wrap(async (req, res) => {
  const email = text(req.body?.email, 'E-mail', { max: 160, required: true }).toLowerCase();
  const pass = String(req.body?.password || '');
  const key = `${req.ip}:${email}`;
  if (tooManyAttempts(key)) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(pass, user.passwordHash))) {
    recordFailure(key);
    throw new HttpError(401, 'E-mail ou senha incorretos');
  }
  clearFailures(key);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.use(requireAuth);

api.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

api.put('/auth/password', wrap(async (req, res) => {
  const current = String(req.body?.current || '');
  const next = password(req.body?.password);
  if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new HttpError(400, 'Senha atual incorreta');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  res.json({ ok: true });
}));

api.put('/auth/profile', wrap(async (req, res) => {
  const name = text(req.body?.name, 'Nome', { max: 80, required: true });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name } });
  res.json({ user: publicUser(user) });
}));

// ---------- Usuários (admin) ----------
api.get('/users', requireAdmin, wrap(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  res.json({ users });
}));

api.post('/users', requireAdmin, wrap(async (req, res) => {
  const name = text(req.body?.name, 'Nome', { max: 80, required: true });
  const email = text(req.body?.email, 'E-mail', { max: 160, required: true }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail inválido');
  const pass = password(req.body?.password);
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Já existe um usuário com este e-mail');
  const user = await prisma.user.create({ data: { name, email, role: 'user', passwordHash: await bcrypt.hash(pass, 10) } });
  res.status(201).json({ user: publicUser(user) });
}));

api.delete('/users/:id', requireAdmin, wrap(async (req, res) => {
  const id = uuid(req.params.id, 'Usuário');
  if (id === req.user.id) throw new HttpError(400, 'Você não pode excluir a própria conta');
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
}));

// ---------- Listas ----------
async function ownPlaylist(req, id) {
  const pl = await prisma.playlist.findFirst({ where: { id: uuid(id, 'Lista'), userId: req.user.id } });
  if (!pl) throw new HttpError(404, 'Lista não encontrada');
  return pl;
}

api.get('/playlists', wrap(async (req, res) => {
  const playlists = await prisma.playlist.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' } });
  res.json({ playlists });
}));

/** Por link: cria e importa em segundo plano (o app acompanha pelo status da lista). */
api.post('/playlists', wrap(async (req, res) => {
  const url = listUrl(req.body?.url);
  const name = text(req.body?.name, 'Nome', { max: 80 }) || hostName(url);
  if ((await prisma.playlist.count({ where: { userId: req.user.id } })) >= 20) throw new HttpError(400, 'Limite de 20 listas');
  const pl = await prisma.playlist.create({ data: { userId: req.user.id, name, url } });
  res.status(201).json({ playlist: (await startSync(pl.id)).playlist });
}));

/** Por arquivo: o corpo da requisição é o próprio .m3u, lido em fluxo. ?id= atualiza uma lista de arquivo existente. */
api.post('/playlists/upload', wrap(async (req, res) => {
  const len = Number(req.headers['content-length'] || 0);
  if (len > 95 * 1024 * 1024) throw new HttpError(413, 'Arquivo grande demais para envio (máx. 95 MB). Use o link da lista.');
  let pl;
  if (req.query.id) pl = await ownPlaylist(req, req.query.id);
  else {
    const name = text(req.query.name, 'Nome', { max: 80 }) || 'Minha lista';
    if ((await prisma.playlist.count({ where: { userId: req.user.id } })) >= 20) throw new HttpError(400, 'Limite de 20 listas');
    pl = await prisma.playlist.create({ data: { userId: req.user.id, name, url: null, autoRefresh: false } });
  }
  const { done } = await startSync(pl.id, limitBody(req, 95 * 1024 * 1024));
  try {
    res.status(req.query.id ? 200 : 201).json({ playlist: await done });
  } catch (err) {
    if (!req.query.id) await prisma.playlist.delete({ where: { id: pl.id } }).catch(() => {});
    throw err;
  }
}));

async function* limitBody(req, max) {
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new HttpError(413, 'Arquivo grande demais (máx. 95 MB)');
    yield chunk;
  }
}

api.put('/playlists/:id', wrap(async (req, res) => {
  const pl = await ownPlaylist(req, req.params.id);
  const data = {};
  if (req.body?.name !== undefined) data.name = text(req.body.name, 'Nome', { max: 80, required: true });
  if (req.body?.autoRefresh !== undefined) data.autoRefresh = !!req.body.autoRefresh && !!pl.url;
  let urlChanged = false;
  if (req.body?.url !== undefined && pl.url) {
    data.url = listUrl(req.body.url);
    urlChanged = data.url !== pl.url;
  }
  let playlist = await prisma.playlist.update({ where: { id: pl.id }, data });
  if (urlChanged) playlist = (await startSync(pl.id)).playlist;
  res.json({ playlist });
}));

api.post('/playlists/:id/refresh', wrap(async (req, res) => {
  const pl = await ownPlaylist(req, req.params.id);
  res.json({ playlist: (await startSync(pl.id)).playlist });
}));

api.delete('/playlists/:id', wrap(async (req, res) => {
  const pl = await ownPlaylist(req, req.params.id);
  await prisma.playlist.delete({ where: { id: pl.id } });
  res.json({ ok: true });
}));

function hostName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').slice(0, 80);
  } catch {
    return 'Minha lista';
  }
}

// ---------- Canais ----------
const channelSelect = { id: true, name: true, groupTitle: true, logo: true, kind: true, playlistId: true, position: true };

async function decorate(userId, rows) {
  const favs = rows.length
    ? new Set((await prisma.favorite.findMany({ where: { userId, channelId: { in: rows.map((r) => r.id) } }, select: { channelId: true } })).map((f) => f.channelId))
    : new Set();
  return rows.map((r) => ({ id: r.id, name: r.name, group: r.groupTitle, kind: r.kind, playlistId: r.playlistId, logo: logoLink(r.logo), favorite: favs.has(r.id) }));
}

async function playlistIds(req) {
  if (req.query.playlist) return [(await ownPlaylist(req, req.query.playlist)).id];
  return (await prisma.playlist.findMany({ where: { userId: req.user.id }, select: { id: true } })).map((p) => p.id);
}
const kindOf = (v) => (KINDS.includes(String(v)) ? String(v) : 'live');

// Contagem por grupo em listas enormes leva ~1 s: guarda até a lista ser atualizada (chave inclui syncedAt).
const groupCache = new Map();

api.get('/groups', wrap(async (req, res) => {
  const ids = await playlistIds(req);
  const kind = kindOf(req.query.kind);
  if (!ids.length) return res.json({ groups: [], total: 0 });
  const stamps = await prisma.playlist.findMany({ where: { id: { in: ids } }, select: { id: true, syncedAt: true }, orderBy: { id: 'asc' } });
  const key = `${kind}|${stamps.map((p) => `${p.id}:${p.syncedAt?.getTime()}`).join(',')}`;
  if (groupCache.has(key)) return res.json(groupCache.get(key));
  const rows =
    kind === 'series'
      ? await prisma.$queryRaw`
        SELECT "groupTitle" AS name, COUNT(DISTINCT COALESCE(NULLIF("seriesName", ''), "name"))::int AS count, MIN("position") AS pos
        FROM "Channel" WHERE "playlistId" = ANY(${ids}::uuid[]) AND "kind" = 'series'
        GROUP BY "groupTitle" ORDER BY pos`
      : await prisma.$queryRaw`
        SELECT "groupTitle" AS name, COUNT(*)::int AS count, MIN("position") AS pos
        FROM "Channel" WHERE "playlistId" = ANY(${ids}::uuid[]) AND "kind" = ${kind}
        GROUP BY "groupTitle" ORDER BY pos`;
  const out = { groups: rows.map((r) => ({ name: r.name, count: r.count })), total: rows.reduce((s, r) => s + r.count, 0) };
  if (groupCache.size > 200) groupCache.clear();
  groupCache.set(key, out);
  res.json(out);
}));

api.get('/channels', wrap(async (req, res) => {
  const ids = await playlistIds(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const q = text(req.query.q, 'Busca', { max: 100 });
  const where = { playlistId: { in: ids } };
  // Busca sem tipo: canais e filmes (episódios aparecem agrupados em /series).
  where.kind = !q || req.query.kind ? kindOf(req.query.kind) : { not: 'series' };
  if (req.query.group !== undefined && req.query.group !== '__all') where.groupTitle = String(req.query.group);
  if (q) where.name = { contains: q, mode: 'insensitive' };
  const rows = await prisma.channel.findMany({ where, select: channelSelect, orderBy: [{ playlistId: 'asc' }, { position: 'asc' }], skip: offset, take: limit + 1 });
  res.json({ channels: await decorate(req.user.id, rows.slice(0, limit)), hasMore: rows.length > limit });
}));

async function ownChannel(req) {
  const ch = await prisma.channel.findFirst({ where: { id: uuid(req.params.id, 'Canal'), playlist: { userId: req.user.id } } });
  if (!ch) throw new HttpError(404, 'Canal não encontrado');
  return ch;
}

/** Fontes para tocar o canal, em ordem de tentativa (o player passa para a próxima se uma falhar). */
api.get('/channels/:id/play', wrap(async (req, res) => {
  const ch = await ownChannel(req);
  const sources = [];
  const add = (url, type) => {
    const custom = ch.userAgent || ch.referrer;
    if (url.startsWith('https://') && !custom) sources.push({ type, via: 'direct', url });
    sources.push({ type, via: 'proxy', url: streamLink(url, ch.userAgent, ch.referrer) });
  };
  // Conversão no servidor (ffmpeg → HLS): link assinado com a URL original, usado em POST /convert/start.
  const convert = { type: 'convert', via: 'proxy', url: sign(ch.url, { ua: ch.userAgent, ref: ch.referrer, ttlSec: 12 * 3600 }) };
  let type = typeFromUrl(ch.url);
  const alt = ch.kind === 'live' && type !== 'hls' ? xtreamHls(ch.url) : null;
  if (alt) add(alt, 'hls');
  if (type === 'unknown') type = await probeType(ch.url, ch.userAgent, ch.referrer);
  const path = ch.url.split('?')[0];
  if (type === 'file' && /\.avi$/i.test(path)) {
    // Muitos ".avi" de listas Xtream são MP4 (H.264/AAC) com outro nome: tenta tocar direto (com avanço nativo);
    // AVI de verdade o navegador recusa em instantes e cai na conversão.
    add(ch.url, 'file');
    sources.push(convert);
  } else if (type === 'file' && !/\.(mp4|m4v|webm|mp3|aac)$/i.test(path)) {
    // MKV, MOV…: o navegador não toca (ou só às vezes) → converte direto.
    sources.push(convert);
  } else {
    add(ch.url, type === 'unknown' ? 'ts' : type);
    // MP4 com codec que o navegador não decodifica (ex.: HEVC) cai na conversão.
    if (type === 'file') sources.push(convert);
  }
  const [decorated] = await decorate(req.user.id, [ch]);
  // Filmes e episódios: posição para "continuar de onde parou".
  const hist = ch.kind === 'live' ? null : await prisma.history.findUnique({ where: { userId_channelId: { userId: req.user.id, channelId: ch.id } } });
  res.json({ channel: decorated, sources, original: ch.url, resume: hist ? resumePoint(hist.position, hist.duration) : 0, duration: hist?.duration || 0 });
}));

/** Vizinhos: episódios da mesma série (em ordem) ou canais do mesmo grupo — anterior/próximo e lista para trocar. */
api.get('/channels/:id/around', wrap(async (req, res) => {
  const ch = await ownChannel(req);
  if (ch.kind === 'series' && ch.seriesName) {
    const eps = await prisma.channel.findMany({
      where: { playlistId: ch.playlistId, seriesName: ch.seriesName },
      select: channelSelect,
      orderBy: [{ season: 'asc' }, { episode: 'asc' }, { position: 'asc' }],
      take: 3000,
    });
    const i = eps.findIndex((e) => e.id === ch.id);
    const list = eps.slice(Math.max(0, i - 30), i + 61);
    return res.json({ channels: await decorate(req.user.id, list), prev: eps[i - 1]?.id || null, next: eps[i + 1]?.id || null, series: ch.seriesName });
  }
  const base = { playlistId: ch.playlistId, kind: ch.kind, groupTitle: ch.groupTitle };
  const [before, after] = await Promise.all([
    prisma.channel.findMany({ where: { ...base, position: { lt: ch.position } }, select: channelSelect, orderBy: { position: 'desc' }, take: 30 }),
    prisma.channel.findMany({ where: { ...base, position: { gt: ch.position } }, select: channelSelect, orderBy: { position: 'asc' }, take: 60 }),
  ]);
  const list = await decorate(req.user.id, [...before.reverse(), ch, ...after]);
  res.json({ channels: list, prev: before.length ? before[before.length - 1].id : null, next: after[0]?.id || null });
}));

// ---------- Séries (episódios agrupados pelo nome antes de SxxEyy) ----------
api.get('/series', wrap(async (req, res) => {
  const ids = await playlistIds(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const group = req.query.group !== undefined && req.query.group !== '__all' ? String(req.query.group) : null;
  const q = text(req.query.q, 'Busca', { max: 100 });
  if (!ids.length) return res.json({ series: [], hasMore: false });
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await prisma.$queryRaw`
    SELECT "playlistId", COALESCE(NULLIF("seriesName", ''), "name") AS name, MIN("groupTitle") AS "group",
           MIN(NULLIF("logo", '')) AS logo, COUNT(*)::int AS episodes, COUNT(DISTINCT "season")::int AS seasons, MIN("position") AS pos
    FROM "Channel"
    WHERE "playlistId" = ANY(${ids}::uuid[]) AND "kind" = 'series'
      AND (${group}::text IS NULL OR "groupTitle" = ${group}::text)
      AND (${like}::text IS NULL OR COALESCE(NULLIF("seriesName", ''), "name") ILIKE ${like}::text)
    GROUP BY "playlistId", COALESCE(NULLIF("seriesName", ''), "name")
    ORDER BY pos LIMIT ${limit + 1} OFFSET ${offset}`;
  res.json({
    series: rows.slice(0, limit).map((r) => ({ playlistId: r.playlistId, name: r.name, group: r.group, logo: logoLink(r.logo || ''), episodes: r.episodes, seasons: r.seasons })),
    hasMore: rows.length > limit,
  });
}));

api.get('/series/episodes', wrap(async (req, res) => {
  const pl = await ownPlaylist(req, req.query.playlist);
  const name = text(req.query.name, 'Série', { max: 200, required: true });
  let rows = await prisma.channel.findMany({
    where: { playlistId: pl.id, seriesName: name },
    select: { ...channelSelect, season: true, episode: true },
    orderBy: [{ season: 'asc' }, { episode: 'asc' }, { position: 'asc' }],
    take: 5000,
  });
  // Item de série sem SxxEyy no nome: é a própria "série" de um episódio só.
  if (!rows.length) rows = await prisma.channel.findMany({ where: { playlistId: pl.id, kind: 'series', name }, select: { ...channelSelect, season: true, episode: true }, take: 50 });
  if (!rows.length) throw new HttpError(404, 'Série não encontrada');
  const list = await decorate(req.user.id, rows);
  res.json({
    name,
    group: rows[0].groupTitle,
    logo: list.find((c) => c.logo)?.logo || '',
    episodes: list.map((c, i) => ({ ...c, season: rows[i].season, episode: rows[i].episode })),
  });
}));

api.post('/channels/:id/watch', wrap(async (req, res) => {
  const ch = await ownChannel(req);
  await prisma.history.upsert({
    where: { userId_channelId: { userId: req.user.id, channelId: ch.id } },
    update: { watchedAt: new Date() },
    create: { userId: req.user.id, channelId: ch.id },
  });
  // Guarda só os 100 mais recentes.
  await prisma.$executeRaw`DELETE FROM "History" WHERE "userId" = ${req.user.id}::uuid AND "channelId" NOT IN (
    SELECT "channelId" FROM "History" WHERE "userId" = ${req.user.id}::uuid ORDER BY "watchedAt" DESC LIMIT 100)`;
  res.json({ ok: true });
}));

/** Progresso de filmes/episódios (o player manda a cada ~15 s e ao sair). */
api.put('/channels/:id/progress', wrap(async (req, res) => {
  const ch = await ownChannel(req);
  const position = cleanSeconds(req.body?.position);
  const duration = cleanSeconds(req.body?.duration) ?? 0;
  if (position === null) throw new HttpError(400, 'Posição inválida');
  if (ch.kind === 'live') return res.json({ ok: true });
  const data = { position, ...(duration ? { duration } : {}), watchedAt: new Date() };
  await prisma.history.upsert({
    where: { userId_channelId: { userId: req.user.id, channelId: ch.id } },
    update: data,
    create: { userId: req.user.id, channelId: ch.id, ...data },
  });
  res.json({ ok: true });
}));

// ---------- Conversão (arquivos que o navegador não toca) ----------
api.post('/convert/start', wrap(async (req, res) => {
  const link = new URLSearchParams(String(req.body?.link || ''));
  const { url, ua, ref } = verify(Object.fromEntries(link));
  const out = await startConversion({ url, ua, ref, offset: Number(req.body?.t) || 0, userId: req.user.id });
  res.json({ ...out, playlist: `convert/${out.sid}/index.m3u8` });
}));

api.delete('/convert/:sid', (req, res) => {
  stopUserConversion(req.user.id, String(req.params.sid));
  res.json({ ok: true });
});

// ---------- Favoritos e recentes ----------
api.get('/favorites', wrap(async (req, res) => {
  const favs = await prisma.favorite.findMany({ where: { userId: req.user.id }, include: { channel: { select: channelSelect } }, orderBy: { createdAt: 'desc' } });
  res.json({ channels: await decorate(req.user.id, favs.map((f) => f.channel)) });
}));

api.post('/favorites/:id', wrap(async (req, res) => {
  const ch = await ownChannel(req);
  await prisma.favorite.upsert({ where: { userId_channelId: { userId: req.user.id, channelId: ch.id } }, update: {}, create: { userId: req.user.id, channelId: ch.id } });
  res.json({ ok: true });
}));

api.delete('/favorites/:id', wrap(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, channelId: uuid(req.params.id, 'Canal') } });
  res.json({ ok: true });
}));

api.get('/history', wrap(async (req, res) => {
  const rows = await prisma.history.findMany({ where: { userId: req.user.id }, include: { channel: { select: channelSelect } }, orderBy: { watchedAt: 'desc' }, take: 60 });
  const list = await decorate(req.user.id, rows.map((r) => r.channel));
  res.json({
    channels: list.map((c, i) => ({
      ...c,
      watchedAt: rows[i].watchedAt,
      position: resumePoint(rows[i].position, rows[i].duration),
      progress: watchedFraction(rows[i].position, rows[i].duration),
    })),
  });
}));

api.delete('/history', wrap(async (req, res) => {
  await prisma.history.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
}));
