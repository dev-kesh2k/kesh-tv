// Validação dos campos recebidos pelas rotas (sem consulta ao banco: testável).
import { HttpError } from './db.js';

/**
 * E-mail no formato "algo@dominio.tld": um só @, sem espaços, parte local não vazia e um ponto no domínio
 * que não seja o primeiro nem o último caractere (mesma regra de /^[^\s@]+@[^\s@]+\.[^\s@]+$/, sem retrocesso).
 */
export function isEmail(v) {
  const s = String(v);
  if (/\s/.test(s)) return false;
  const at = s.indexOf('@');
  if (at <= 0 || at !== s.lastIndexOf('@')) return false;
  const domain = s.slice(at + 1);
  return domain.length >= 3 && domain.slice(1, -1).includes('.');
}
const UUID_RE = /^[0-9a-f-]{36}$/i;
export const KINDS = ['live', 'movie', 'series'];

export function text(v, field, { max = 200, required = false } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${field} é obrigatório`);
  if (s.length > max) throw new HttpError(400, `${field} deve ter no máximo ${max} caracteres`);
  return s;
}

export function password(v) {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, 'A senha deve ter pelo menos 8 caracteres');
  if (v.length > 200) throw new HttpError(400, 'Senha muito longa');
  return v;
}

/** Link da lista M3U/Xtream: só http(s), sem espaços. */
export function listUrl(v) {
  const s = text(v, 'Link da lista', { max: 2000, required: true });
  if (!/^https?:\/\/\S+$/i.test(s)) throw new HttpError(400, 'O link deve começar com http:// ou https://');
  return s;
}

/** Id de registro; formato errado responde 404 (não entrega que o id não existe por outro motivo). */
export const uuid = (v, what = 'Registro') => {
  if (!UUID_RE.test(String(v || ''))) throw new HttpError(404, `${what} não encontrado`);
  return String(v);
};

/** Nome padrão de uma lista nova: o servidor do link, sem "www.". */
export function hostName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').slice(0, 80);
  } catch {
    return 'Minha lista';
  }
}

/** Tipo de canal pedido na URL (padrão: ao vivo). */
export const kindOf = (v) => (KINDS.includes(String(v)) ? String(v) : 'live');
