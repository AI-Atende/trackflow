import { prisma } from './src/lib/prisma';

async function main() {
  try {
    const configs = await prisma.integrationConfig.findMany({
      where: { provider: 'KOMMO' },
      include: { client: true },
    });

    console.log('Found Integration Configs:', JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error('Error fetching configs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
