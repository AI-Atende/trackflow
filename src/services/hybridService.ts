import { prisma } from "@/lib/prisma";
import { CampaignHierarchy } from "@/types";
import { fetchKommoHierarchy } from "./kommoService";
import { fetchMetaHierarchy } from "./metaService";
import { fetchGoogleHierarchy } from "./googleService";

export type DataSourceType = 'KOMMO' | 'META' | 'GOOGLE' | 'HYBRID_META' | 'HYBRID_GOOGLE' | 'HYBRID_ALL';

export async function getAvailableDataSources(clientId: string): Promise<DataSourceType[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      integrations: true,
      metaAdAccounts: true,
      googleAdAccounts: true,
    }
  });

  if (!client) return [];

  const hasKommo = client.integrations.some(i => i.provider === 'KOMMO' && i.isActive);
  const hasMeta = client.metaAdAccounts.some(a => a.status === 'ACTIVE');
  const hasGoogle = client.googleAdAccounts.some(a => a.status === 'ACTIVE');

  const sources: DataSourceType[] = [];

  if (hasKommo) sources.push('KOMMO');
  if (hasMeta) sources.push('META');
  if (hasGoogle) sources.push('GOOGLE');

  if (hasKommo && hasMeta) sources.push('HYBRID_META');
  if (hasKommo && hasGoogle) sources.push('HYBRID_GOOGLE');
  if (hasKommo && hasMeta && hasGoogle) sources.push('HYBRID_ALL');

  return sources;
}

export async function fetchHybridData(
  clientId: string,
  type: DataSourceType,
  since: string,
  until: string
): Promise<{ campaigns: CampaignHierarchy[], labels: string[] }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      integrations: true,
      metaAdAccounts: true,
      googleAdAccounts: true,
    }
  });

  if (!client) return { campaigns: [], labels: [] };

  const kommoConfig = client.integrations.find(i => i.provider === 'KOMMO');
  const metaAccount = client.metaAdAccounts.find(a => a.status === 'ACTIVE'); // Use active account
  const googleAccount = client.googleAdAccounts.find(a => a.status === 'ACTIVE'); // Use active account

  let kommoData: CampaignHierarchy[] = [];
  let metaData: CampaignHierarchy[] = [];
  let googleData: CampaignHierarchy[] = [];
  let labels: string[] = ["Impressões", "Cliques", "Leads", "Vendas", "Receita"]; // Default fallback

  const dateRange = { from: new Date(since), to: new Date(until) };

  // Fetch necessary data based on type
  if (type.includes('KOMMO') || type.includes('HYBRID')) {
    if (kommoConfig?.config) {
      const config = kommoConfig.config as any;
      const journeyMap = (kommoConfig.journeyMap as string[]) || [];
      if (journeyMap.length > 0) labels = journeyMap;
      kommoData = await fetchKommoHierarchy(config.subdomain, journeyMap, dateRange);
    }
  }

  if (type === 'META') {
    // If only META, use Meta defaults or config if we had one
    labels = ["Impressões", "Cliques", "Leads", "Alcance", "Resultados"];
  } else if (type === 'GOOGLE') {
    labels = ["Impressões", "Cliques", "Conversões", "Custo", "Valor Conv."];
  }

  if (type.includes('META') || type === 'HYBRID_META' || type === 'HYBRID_ALL') {
    if (metaAccount) {
      metaData = await fetchMetaHierarchy(metaAccount.adAccountId, since, until);
    }
  }

  if (type.includes('GOOGLE') || type === 'HYBRID_GOOGLE' || type === 'HYBRID_ALL') {
    if (googleAccount) {
      googleData = await fetchGoogleHierarchy(googleAccount.id, since, until);
    }
  }

  // Merge Logic
  let campaigns: CampaignHierarchy[] = [];
  if (type === 'HYBRID_META') {
    campaigns = mergeData(kommoData, metaData, []);
  } else if (type === 'HYBRID_GOOGLE') {
    campaigns = mergeData(kommoData, [], googleData);
  } else if (type === 'HYBRID_ALL') {
    campaigns = mergeData(kommoData, metaData, googleData);
  } else if (type === 'META') {
    campaigns = metaData;
  } else if (type === 'GOOGLE') {
    campaigns = googleData;
  } else {
    campaigns = kommoData;
  }

  return { campaigns, labels };
}

function mergeData(
  kommo: CampaignHierarchy[],
  meta: CampaignHierarchy[],
  google: CampaignHierarchy[]
): CampaignHierarchy[] {
  // Map to hold merged campaigns
  const mergedMap = new Map<string, CampaignHierarchy>();

  // Helper to normalize names for matching
  // Kommo uses UTMs which might not match exact API names, but we assume they do or use a fuzzy match.
  // For this implementation, we assume exact match on Name.
  // Ideally, we should match on ID if Kommo captured the Campaign ID in UTM, but usually it captures Name.

  // 1. Process Ad Platforms (Meta & Google) first as the "Base" structure for Spend/Impressions
  // They are the source of truth for "Spending"

  const processPlatformData = (items: CampaignHierarchy[], platform: 'meta' | 'google') => {
    for (const item of items) {
      const key = item.name.trim(); // Match by Name
      if (!mergedMap.has(key)) {
        // Clone to avoid mutating original
        mergedMap.set(key, JSON.parse(JSON.stringify(item)));
      } else {
        // Merge metrics if collision (unlikely between Meta and Google unless same name used)
        const existing = mergedMap.get(key)!;
        existing.spend += item.spend;
        existing.roas = 0; // Recalculate later
        // Merge children
        if (item.children) {
          // We need to merge children recursively
          // For simplicity in this level, let's just append children and let a second pass handle them?
          // No, we should merge adsets/adgroups.
          existing.children = mergeChildren(existing.children || [], item.children);
        }
      }
    }
  };

  processPlatformData(meta, 'meta');
  processPlatformData(google, 'google');

  // 2. Process Kommo Data (Source of truth for Results/Sales)
  for (const kItem of kommo) {
    const key = kItem.name.trim();
    let target = mergedMap.get(key);

    if (!target) {
      // Kommo found a campaign not in Ad Platforms (Organic? Or mismatch?)
      // Add it as is.
      target = JSON.parse(JSON.stringify(kItem));
      mergedMap.set(key, target!);
    } else {
      // Merge Kommo metrics into existing Ad Platform campaign
      target.data = kItem.data; // Overwrite stages with Kommo data (Source of Truth)
      target.revenue = kItem.revenue;
      target.ghostLeads = kItem.ghostLeads;

      // Merge children
      if (kItem.children) {
        target.children = mergeChildren(target.children || [], kItem.children);
      }
    }
  }

  return Array.from(mergedMap.values());
}

function mergeChildren(
  baseChildren: CampaignHierarchy[],
  kommoChildren: CampaignHierarchy[]
): CampaignHierarchy[] {
  const map = new Map<string, CampaignHierarchy>();

  // Index base children
  for (const child of baseChildren) {
    map.set(child.name.trim(), child);
  }

  // Merge Kommo children
  for (const kChild of kommoChildren) {
    const key = kChild.name.trim();
    const existing = map.get(key);

    if (existing) {
      existing.data = kChild.data;
      existing.revenue = kChild.revenue;
      existing.ghostLeads = kChild.ghostLeads;
      if (kChild.children) {
        existing.children = mergeChildren(existing.children || [], kChild.children);
      }
    } else {
      // Add new from Kommo
      map.set(key, JSON.parse(JSON.stringify(kChild)));
    }
  }

  return Array.from(map.values());
}
