import { prisma } from '@/lib/prisma';
import { brPhoneVariants } from '@/lib/phone';

const CHUNK_SIZE = 500;

/**
 * Hard-deletes leads (scoped to clientId — ids from another client are silently ignored), their
 * ConversionEventLog history, and the TrackedMessage rows for their phone numbers. Mainly a
 * testing/operational-alignment tool: Lead's @@unique([clientId, kommoLeadId]) and
 * ConversionEventLog's @@unique([leadId, journeyStageId, platform]) mean a lead that already went
 * through the journey once won't re-fire events on a fresh run unless its old rows are cleared,
 * and classifyAttribution reads TrackedMessage history, so leftover messages would keep
 * classifying a "fresh" lead from stale matches. Doesn't touch PixelSession (keyed by browser
 * session, not phone number) and doesn't move/delete anything in Kommo itself.
 *
 * Runs in chunks, each in its own transaction, so deleting thousands doesn't hold one huge
 * transaction open. Returns how many leads were actually removed.
 */
export async function deleteLeads(clientId: string, leadIds: string[]): Promise<number> {
  let deleted = 0;

  for (let i = 0; i < leadIds.length; i += CHUNK_SIZE) {
    const chunk = leadIds.slice(i, i + CHUNK_SIZE);
    const leads = await prisma.lead.findMany({
      where: { id: { in: chunk }, clientId },
      select: { id: true, waId: true },
    });
    if (leads.length === 0) continue;

    const ids = leads.map((l) => l.id);
    const waIds = [...new Set(leads.flatMap((l) => (l.waId ? brPhoneVariants(l.waId) : [])))];

    const results = await prisma.$transaction([
      prisma.conversionEventLog.deleteMany({ where: { leadId: { in: ids } } }),
      ...(waIds.length > 0
        ? [prisma.trackedMessage.deleteMany({ where: { clientId, waId: { in: waIds } } })]
        : []),
      prisma.lead.deleteMany({ where: { id: { in: ids }, clientId } }),
    ]);
    deleted += results[results.length - 1].count;
  }

  return deleted;
}
