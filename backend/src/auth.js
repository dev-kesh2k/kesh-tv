import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

const SECRET = process.env.JWT_SECRET || '';
if (!SECRET) console.warn('JWT_SECRET não definido: usando segredo temporário (sessões caem ao reiniciar).');
const KEY = SECRET || `tmp-${Math.random().toString(36).slice(2)}${Date.now()}`;

export function signToken(user) {
  return jwt.sign({ sub: user.id }, KEY, { expiresIn: '30d' });
}

export function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const { sub } = jwt.verify(token, KEY);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return res.status(401).json({ error: 'Sessão inválida' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada' });
  }
}

// Limite simples de tentativas de login por IP+e-mail (memória do processo).
const attempts = new Map();
const WINDOW = 15 * 60_000;
export function tooManyAttempts(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= 10;
}
export function recordFailure(key) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
export const clearFailures = (key) => attempts.delete(key);
