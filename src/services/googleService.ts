import { prisma } from '@/lib/prisma';
import { CampaignHierarchy } from '@/types';

type GoogleAdsMetricsRow = {
  cost_micros?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  conversions?: string | number;
  all_conversions_value?: string | number;
};

type GoogleAdsCampaignRow = {
  campaign: { id: string | number; name: string; status?: string };
  metrics: GoogleAdsMetricsRow;
};

type GoogleAdsAdGroupRow = {
  campaign: { id: string | number };
  ad_group: { id: string | number; name: string; status?: string };
  metrics: GoogleAdsMetricsRow;
};

type GoogleAdsAdRow = {
  ad_group: { id: string | number };
  ad_group_ad: {
    ad: { id: string | number; name?: string };
    status?: string;
  };
  metrics: GoogleAdsMetricsRow;
};

type GoogleHierarchyNode = {
  id: string;
  name: string;
  type: string;
  status: string;
  data: { stage1: number; stage2: number; stage3: number; stage4: number; stage5: number };
  spend: number;
  roas: number;
  revenue: number;
  metaLeads: number;
  children?: GoogleHierarchyNode[];
};

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/google/callback`;

// Scopes for Google Ads
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

export function getGoogleAuthUrl(state?: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // Important for refresh token
    prompt: 'consent', // Force consent to ensure refresh token is returned
    state: state || '',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Google OAuth Error: ${error.error_description || error.error}`);
  }

  return res.json();
}

export async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to refresh Google token');
  }

  return res.json();
}

// --- Google Ads API Helpers ---

const GOOGLE_ADS_API_VERSION = 'v16';

export async function listAccessibleCustomers(accessToken: string) {
  const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const res = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': DEV_TOKEN,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    const err = await res.json();
    console.error('Google Ads List Customers Error:', JSON.stringify(err, null, 2));
    throw new Error(`Failed to list customers: ${res.statusText}`);
  }

  const data = await res.json();
  return data.resourceNames; // ["customers/123", "customers/456"]
}

// --- Data Fetching ---

// --- Data Fetching ---

export async function fetchGoogleHierarchy(
  googleAdAccountId: string,
  since: string,
  until: string,
) {
  try {
    const account = await prisma.googleAdAccount.findUnique({
      where: { id: googleAdAccountId },
    });

    if (!account) throw new Error('Google Ad Account not found');

    // Initialize Client
    const { GoogleAdsApi } = await import('google-ads-api');
    const client = new GoogleAdsApi({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN!,
    });

    // Get Customer instance (library handles token refresh if we pass refresh_token)
    const customer = client.Customer({
      customer_id: account.customerId.replace(/-/g, ''), // Remove dashes
      refresh_token: account.refreshToken,
    });

    // Format dates to YYYY-MM-DD
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };

    const fromDate = formatDate(since);
    const toDate = formatDate(until);

    // GAQL Queries
    // 1. Campaigns
    const campaignQuery = `
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.all_conversions_value
      FROM campaign 
      WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
    `;

    // 2. Ad Groups
    const adGroupQuery = `
      SELECT 
        ad_group.id, 
        ad_group.name, 
        ad_group.status,
        campaign.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM ad_group 
      WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
    `;

    // 3. Ads
    const adQuery = `
      SELECT 
        ad_group_ad.ad.id, 
        ad_group_ad.ad.name, 
        ad_group_ad.status,
        ad_group.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM ad_group_ad 
      WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
    `;

    // Execute queries
    const [campaigns, adGroups, ads] = await Promise.all([
      customer.query(campaignQuery),
      customer.query(adGroupQuery),
      customer.query(adQuery),
    ]);

    console.log(
      'Google Ads Sync - Campaigns (First Item):',
      campaigns.length > 0 ? JSON.stringify(campaigns[0], null, 2) : 'No campaigns found',
    );
    console.log(
      'Google Ads Sync - AdGroups (First Item):',
      adGroups.length > 0 ? JSON.stringify(adGroups[0], null, 2) : 'No ad groups found',
    );
    console.log(
      'Google Ads Sync - Ads (First Item):',
      ads.length > 0 ? JSON.stringify(ads[0], null, 2) : 'No ads found',
    );

    // Transform to Hierarchy (the GAQL SELECT above determines which fields are actually
    // populated, which the library's generic row type doesn't capture)
    return mapGoogleDataToHierarchy(
      campaigns as unknown as GoogleAdsCampaignRow[],
      adGroups as unknown as GoogleAdsAdGroupRow[],
      ads as unknown as GoogleAdsAdRow[],
    );
  } catch (error) {
    console.error('Google Ads Sync Error:', JSON.stringify(error, null, 2));
    // Also log the message directly in case stringify fails
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Google Ads Sync Error Message:', message);
    throw new Error(`Failed to sync Google Ads: ${message}`);
  }
}

function mapGoogleDataToHierarchy(
  campaigns: GoogleAdsCampaignRow[],
  adGroups: GoogleAdsAdGroupRow[],
  ads: GoogleAdsAdRow[],
): CampaignHierarchy[] {
  // The library returns arrays of rows directly

  const hierarchy: GoogleHierarchyNode[] = [];
  const campaignMap = new Map<string, GoogleHierarchyNode>();
  const adGroupMap = new Map<string, GoogleHierarchyNode>();

  // Process Campaigns
  for (const row of campaigns) {
    const c = row.campaign;
    const m = row.metrics;

    // Robust status check
    const status = c.status ? String(c.status).toLowerCase() : 'unknown';

    const node = {
      id: String(c.id),
      name: c.name,
      type: 'campaign',
      status: status, // ENABLED, PAUSED, REMOVED -> active, paused, completed
      data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
      spend: (Number(m.cost_micros) || 0) / 1000000,
      roas: 0,
      revenue: Number(m.all_conversions_value) || 0,
      metaLeads: Number(m.conversions) || 0,
      children: [],
    };
    campaignMap.set(node.id, node);
    hierarchy.push(node);
  }

  // Process Ad Groups
  for (const row of adGroups) {
    const ag = row.ad_group;
    const m = row.metrics;
    const campId = String(row.campaign.id);
    const parent = campaignMap.get(campId);

    if (parent) {
      const status = ag.status ? String(ag.status).toLowerCase() : 'unknown';

      const node = {
        id: String(ag.id),
        name: ag.name,
        type: 'adset', // Mapping AdGroup to AdSet for consistency
        status: status,
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: (Number(m.cost_micros) || 0) / 1000000,
        roas: 0,
        revenue: 0,
        metaLeads: Number(m.conversions) || 0,
        children: [],
      };
      adGroupMap.set(node.id, node);
      parent.children!.push(node);
    }
  }

  // Process Ads
  for (const row of ads) {
    const ad = row.ad_group_ad.ad;
    const rawStatus = row.ad_group_ad.status;
    const m = row.metrics;
    const agId = String(row.ad_group.id);
    const parent = adGroupMap.get(agId);

    if (parent) {
      const status = rawStatus ? String(rawStatus).toLowerCase() : 'unknown';

      const node = {
        id: String(ad.id),
        name: ad.name || `Ad ${ad.id}`,
        type: 'ad',
        status: status,
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: (Number(m.cost_micros) || 0) / 1000000,
        roas: 0,
        revenue: 0,
        metaLeads: Number(m.conversions) || 0,
      };
      parent.children!.push(node);
    }
  }

  // The status strings above are derived at runtime from the Google Ads API and aren't
  // narrowed to CampaignHierarchy's literal union at the type level.
  return hierarchy as CampaignHierarchy[];
}
