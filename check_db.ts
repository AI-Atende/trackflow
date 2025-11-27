import { prisma } from "./src/lib/prisma";

async function checkMetaAccount() {
  const insights = await prisma.metaAdInsightDaily.groupBy({
    by: ['date'],
    _count: {
      id: true
    },
    orderBy: {
      date: 'desc'
    }
  });
  console.log("Insights por data:", JSON.stringify(insights, null, 2));
}

checkMetaAccount()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
