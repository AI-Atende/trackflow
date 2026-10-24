import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Cria o admin inicial de um banco novo. Nunca altera um usuário existente — antes o seed rodava
// a cada start do container e redefinia a senha do admin para um valor fixo versionado no git.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Administrador';

  if (!email || !password) {
    throw new Error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para rodar o seed.');
  }

  const existing = await prisma.client.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} já existe — nada a fazer.`);
    return;
  }

  const user = await prisma.client.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log({ user });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
