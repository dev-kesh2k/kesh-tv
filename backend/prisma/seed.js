// Idempotente: roda a cada publicação. Cria o admin inicial só quando não existe nenhum.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@kesh-tv.app').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'troque-esta-senha';
  const name = process.env.SEED_ADMIN_NAME || 'Administrador';

  if ((await prisma.user.count({ where: { role: 'admin' } })) === 0) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'admin' },
      create: { email, name, role: 'admin', passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Admin criado: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
