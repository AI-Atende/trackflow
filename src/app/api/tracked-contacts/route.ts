import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { brPhoneVariants, phoneKey } from '@/lib/phone';

const MAX_MESSAGES = 5000;
const MAX_PHONE_DIGITS = 15;
const MAX_DELETE = 2000;

// GET /api/tracked-contacts — every phone number that messaged the client's WhatsApp in the last
// `days` days, with how (if at all) it was attributed. Built straight from TrackedMessage — the
// rows TrackFlow stores the instant the portal relays a message — so a contact shows up
// immediately, with no dependency on Kommo having created (or webhooked) the lead yet. The Kommo
// sync status is shown alongside as a projection, not a prerequisite.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const clientId = session.user.clientId;

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const messages = await prisma.trackedMessage.findMany({
    where: { clientId, receivedAt: { gte: since } },
    orderBy: { receivedAt: 'desc' },
    take: MAX_MESSAGES,
    select: {
      id: true,
      waId: true,
      receivedAt: true,
      matchStrategy: true,
      matchedPixelSessionId: true,
      matchedTrackingLink: { select: { label: true } },
      matchedMappedAd: { select: { adName: true, campaignName: true, platform: true } },
      kommoLeadId: true,
      kommoSyncStatus: true,
      kommoSyncError: true,
    },
  });

  type Row = (typeof messages)[number];
  interface Group {
    key: string;
    waId: string;
    firstSeenAt: Date;
    lastMessageAt: Date;
    messageCount: number;
    attributed: Row | null; // newest message that matched something
  }

  // Newest first, so the first row seen per key is the latest message and the first matched row
  // is the latest attribution; firstSeenAt keeps shrinking as older rows are visited.
  const groups = new Map<string, Group>();
  for (const m of messages) {
    // WhatsApp group ids (longer than any phone number) were relayed before groups were
    // filtered out at ingestion — they're conversations, not contacts.
    if (m.waId.replace(/\D/g, '').length > MAX_PHONE_DIGITS) continue;

    const key = phoneKey(m.waId);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        waId: m.waId,
        firstSeenAt: m.receivedAt,
        lastMessageAt: m.receivedAt,
        messageCount: 0,
        attributed: null,
      };
      groups.set(key, g);
    }
    g.messageCount++;
    g.firstSeenAt = m.receivedAt;
    if (!g.attributed && m.matchStrategy !== 'UNMATCHED') g.attributed = m;
  }

  const sessionIds = [
    ...new Set(
      [...groups.values()]
        .map((g) => g.attributed?.matchedPixelSessionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [sessions, leads] = await Promise.all([
    sessionIds.length
      ? prisma.pixelSession.findMany({
          where: { id: { in: sessionIds } },
          select: {
            id: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            fbclid: true,
            gclid: true,
          },
        })
      : [],
    prisma.lead.findMany({ where: { clientId }, select: { id: true, waId: true } }),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const leadIdByKey = new Map<string, string>();
  for (const l of leads) {
    if (l.waId) leadIdByKey.set(phoneKey(l.waId), l.id);
  }

  const contacts = [...groups.values()].map((g) => {
    const a = g.attributed;
    const utm = a?.matchedPixelSessionId ? sessionById.get(a.matchedPixelSessionId) : undefined;
    return {
      key: g.key,
      waId: g.waId,
      firstSeenAt: g.firstSeenAt,
      lastMessageAt: g.lastMessageAt,
      messageCount: g.messageCount,
      attribution: a
        ? {
            strategy: a.matchStrategy,
            receivedAt: a.receivedAt,
            linkLabel: a.matchedTrackingLink?.label ?? null,
            ad: a.matchedMappedAd,
            utm: utm
              ? {
                  utmSource: utm.utmSource,
                  utmMedium: utm.utmMedium,
                  utmCampaign: utm.utmCampaign,
                  utmContent: utm.utmContent,
                  utmTerm: utm.utmTerm,
                  hasClickId: Boolean(utm.fbclid || utm.gclid),
                }
              : null,
          }
        : null,
      kommo: a
        ? {
            messageId: a.id,
            status: a.kommoSyncStatus,
            error: a.kommoSyncError,
            leadId: a.kommoLeadId,
          }
        : null,
      trackflowLeadId: leadIdByKey.get(g.key) ?? null,
    };
  });

  return NextResponse.json({ contacts, truncated: messages.length >= MAX_MESSAGES });
}

// DELETE /api/tracked-contacts — body { waIds: string[] }. Removes the tracked messages for those
// numbers (both Brazilian with/without-9 spellings). For clearing test data: a contact that never
// became a Lead can't be removed from the Leads screen. Doesn't touch Leads, PixelSessions or
// anything in Kommo — use the lead delete for those.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const waIds: unknown = body?.waIds;
  if (
    !Array.isArray(waIds) ||
    waIds.length === 0 ||
    waIds.length > MAX_DELETE ||
    !waIds.every((w) => typeof w === 'string')
  ) {
    return NextResponse.json({ error: `Informe de 1 a ${MAX_DELETE} números` }, { status: 400 });
  }

  const variants = [...new Set((waIds as string[]).flatMap((w) => brPhoneVariants(w)))];
  const { count } = await prisma.trackedMessage.deleteMany({
    where: { clientId: session.user.clientId, waId: { in: variants } },
  });
  return NextResponse.json({ success: true, deleted: count });
}
