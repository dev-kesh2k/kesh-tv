import { PrismaClient } from '@prisma/client';

// O Postgres do Hub é compartilhado (max_connections baixo): limita o pool deste app.
function dbUrl() {
  const raw = process.env.DATABASE_URL || '';
  try {
    const u = new URL(raw);
    // O Hub injeta connection_limit=10; com vários apps isso estoura o max_connections. Usa o menor.
    const max = Number(process.env.DB_POOL_SIZE) || 3;
    const current = Number(u.searchParams.get('connection_limit')) || Infinity;
    u.searchParams.set('connection_limit', String(Math.min(current, max)));
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });

export const TZ = process.env.TZ || 'America/Sao_Paulo';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

