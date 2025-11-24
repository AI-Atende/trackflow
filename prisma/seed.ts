import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

async function main() {
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    // upsert admin user by email
    const existing = await prisma.client.findFirst({ where: { email: ADMIN_EMAIL } });

    if (existing) {
      // update to ensure role and password
      console.log(`Updating existing admin (${ADMIN_EMAIL})`);
      await prisma.client.update({
        where: { id: existing.id },
        data: { name: ADMIN_NAME, passwordHash, role: 'ADMIN' as any },
      });
    } else {
      console.log(`Creating admin user (${ADMIN_EMAIL})`);
      await prisma.client.create({
        data: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          passwordHash,
          role: 'ADMIN' as any,
        },
      });
    }

    // Optionally create a sample MetaAdAccount for the admin (safe if not present)
    const adminClient = await prisma.client.findFirst({ where: { email: ADMIN_EMAIL } }) as any;
    if (adminClient) {
      const sampleAdAccountId = process.env.SAMPLE_AD_ACCOUNT_ID || 'act_1234567890';
      const exists = await prisma.metaAdAccount.findFirst({ where: { clientId: adminClient.id, adAccountId: sampleAdAccountId } });
      if (!exists) {
        await prisma.metaAdAccount.create({
          data: {
            clientId: adminClient.id,
            adAccountId: sampleAdAccountId,
            name: 'Sample Ad Account',
            accessToken: process.env.SAMPLE_ACCESS_TOKEN || 'sample-token',
            tokenExpiresAt: null,
            status: 'active',
          },
        });
        console.log('Created sample MetaAdAccount for admin');
      }
    }

    console.log('Seed finished');
  } catch (err: any) {
    console.error('Seed failed:', err.message || err);
    console.error('If this mentions a missing column or relation, run the Prisma migration and generate the client first:');
    console.error('  npx prisma migrate dev --name add-client-role');
    console.error('  npx prisma generate');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
