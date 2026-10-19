import { prisma } from '@/lib/prisma';

// Visits through a redirect link that never turned into a WhatsApp message carry no value
// (a human who opened the link and closed it, or something the bot filter missed) — and they
// are the only per-visit rows nobody else references. Pruning them keeps what we hold to the
// minimum. Matched sessions are kept: they're the attribution record for a real lead.
const RETENTION_DAYS = 30;

export async function runRedirectSessionCleanupJob() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.pixelSession.deleteMany({
    where: {
      matchedAt: null,
      createdAt: { lt: cutoff },
      lastTrackingLink: { is: { slug: { not: null } } },
    },
  });
  if (count > 0) {
    console.log(`[redirectSessionCleanupJob] Removed ${count} unmatched redirect-link visit(s)`);
  }
}
