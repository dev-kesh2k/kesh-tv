// Idempotente: roda a cada publicação. Cria o admin inicial só quando não existe nenhum.
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@kesh-tv.app').trim().toLowerCase();
  // Sem SEED_ADMIN_PASSWORD, gera uma senha aleatória (mostrada uma vez no log quando o admin é criado).
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const name = process.env.SEED_ADMIN_NAME || 'Administrador';

  if ((await prisma.user.count({ where: { role: 'admin' } })) === 0) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'admin' },
      create: { email, name, role: 'admin', passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Admin criado: ${email}`);
    if (generated) console.log(`Senha gerada para o admin (troque depois de entrar): ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
