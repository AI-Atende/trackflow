import { prisma } from '@/lib/prisma';
import { metaGet } from './client';
import type { RawInsightsResponse } from './types';
import { extractLeadsFromActions } from './insights';

export async function syncMetaInsightsDaily(options: {
  metaAdAccountId: string;
  adAccountId: string;
  accessToken: string;
  since: string; // "YYYY-MM-DD"
  until: string; // "YYYY-MM-DD"
}) {
  const { metaAdAccountId, adAccountId, accessToken, since, until } = options;

  // Garantir prefixo act_ para chamadas de API de anúncios
  const apiAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  const insights = await metaGet<RawInsightsResponse>(`/${apiAdAccountId}/insights`, accessToken, {
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    time_increment: 1,
    fields: [
      'date_start',
      'date_stop',
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'impressions',
      'clicks',
      'spend',
      'reach',
      'inline_link_clicks',
      'actions',
    ].join(','),
    limit: 1000,
  });

  const rows = insights.data || [];

  for (const row of rows) {
    const dateStr = row.date_start;
    const date = new Date(`${dateStr}T00:00:00.000Z`);

    const leads = extractLeadsFromActions(row.actions);
    const reach = Number(row.reach || 0);
    // "Results" is ambiguous. Using inline_link_clicks + leads as a proxy for "meaningful actions" if not explicitly defined.
    // Or simply map inline_link_clicks if that's what "results" usually implies in this context (traffic).
    // Given the request for "Results" alongside "Reach", and "Leads" is already separate, "Results" might be the objective-based metric.
    // Without 'objective' field, we can't be sure.
    // Let's use inline_link_clicks as a generic "Result" proxy for now, or sum of key actions.
    // Actually, let's just use leads + inline_link_clicks to capture both conversion and traffic results.
    // Better yet: just store 0 if we can't determine. But user wants to see something.
    // Let's map 'results' to 'leads' (if > 0) OR 'inline_link_clicks' (if leads == 0).
    const results = leads > 0 ? leads : Number(row.inline_link_clicks || 0);

    await prisma.metaAdInsightDaily.upsert({
      where: {
        metaAdAccountId_adId_date: {
          metaAdAccountId,
          adId: row.ad_id,
          date,
        },
      },
      update: {
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        adsetId: row.adset_id,
        adsetName: row.adset_name,
        adName: row.ad_name,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        spend: Number(row.spend || 0),
        leads,
        reach,
        results,
      },
      create: {
        metaAdAccountId,
        date,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        adsetId: row.adset_id,
        adsetName: row.adset_name,
        adId: row.ad_id,
        adName: row.ad_name,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        spend: Number(row.spend || 0),
        leads,
        reach,
        results,
      },
    });
  }

  return { count: rows.length };
}
