import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

const SECRET = process.env.JWT_SECRET || '';
if (!SECRET) console.warn('JWT_SECRET não definido: usando segredo temporário (sessões caem ao reiniciar).');
const KEY = SECRET || `tmp-${Math.random().toString(36).slice(2)}${Date.now()}`;

// O token leva a "versão" da senha: trocar a senha (ou sair de todos os aparelhos) invalida os tokens antigos.
export function signToken(user) {
  return jwt.sign({ sub: user.id, v: user.tokenVersion || 0 }, KEY, { expiresIn: '30d' });
}

export function publicUser(u) {
  const { passwordHash, tokenVersion, ...rest } = u;
  return rest;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const { sub, v } = jwt.verify(token, KEY);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || (v || 0) !== user.tokenVersion) return res.status(401).json({ error: 'Sessão encerrada. Entre de novo.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada' });
  }
}

/**
 * IP do visitante para o limite de tentativas. Atrás do Cloudflare (TRUST_CLOUDFLARE=1) usa o CF-Connecting-IP,
 * que o visitante não consegue forjar; sem ele, o endereço da conexão (X-Forwarded-For de fora não é confiável).
 */
export function clientIp(req) {
  const cf = process.env.TRUST_CLOUDFLARE === '1' ? String(req.headers['cf-connecting-ip'] || '').trim() : '';
  return cf || req.ip || req.socket?.remoteAddress || '';
}

// Limite simples de tentativas de login por IP+e-mail (memória do processo).
const attempts = new Map();
const WINDOW = 15 * 60_000;
export function tooManyAttempts(key, max = 10) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= max;
}
export function recordFailure(key) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
export const clearFailures = (key) => attempts.delete(key);

/** Apaga tentativas que já saíram da janela (senão o mapa só cresce com IPs/e-mails diferentes). */
export function pruneAttempts(now = Date.now()) {
  for (const [key, list] of attempts) {
    const recent = list.filter((t) => now - t < WINDOW);
    if (recent.length) attempts.set(key, recent);
    else attempts.delete(key);
  }
  return attempts.size;
}
setInterval(pruneAttempts, WINDOW).unref();
