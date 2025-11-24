import express from "express";
import prisma from "../lib/prisma.js";
import { metaGet } from "../lib/metaClient.js";

const router = express.Router();

// Middleware: fake auth for now. Expect header x-client-id to identify client
router.use((req, res, next) => {
  const clientId = req.header("x-client-id");
  if (!clientId) {
    return res.status(401).json({ error: "x-client-id header required for auth" });
  }
  // attach to req
  (req as any).clientId = clientId;
  return next();
});

router.get('/:adAccountId/campaigns', async (req, res) => {
  const clientId = (req as any).clientId;
  const { adAccountId } = req.params;

  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { clientId, adAccountId, status: "active" },
  });

  if (!metaAccount) return res.status(404).json({ error: 'Conta de anúncio não encontrada' });

  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAccount.adAccountId}/campaigns`, metaAccount.accessToken, {
      fields: [
        "id",
        "name",
        "status",
        "objective",
        "effective_status",
        "start_time",
        "stop_time",
      ].join(','),
      limit: 100,
    });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar campanhas', details: err.message });
  }
});

router.get('/:adAccountId/adsets', async (req, res) => {
  const clientId = (req as any).clientId;
  const { adAccountId } = req.params;

  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { clientId, adAccountId, status: "active" },
  });

  if (!metaAccount) return res.status(404).json({ error: 'Conta de anúncio não encontrada' });

  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAccount.adAccountId}/adsets`, metaAccount.accessToken, {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "daily_budget",
        "lifetime_budget",
        "start_time",
        "end_time",
        "campaign_id",
      ].join(','),
      limit: 100,
    });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar ad sets', details: err.message });
  }
});

router.get('/:adAccountId/ads', async (req, res) => {
  const clientId = (req as any).clientId;
  const { adAccountId } = req.params;

  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { clientId, adAccountId, status: "active" },
  });

  if (!metaAccount) return res.status(404).json({ error: 'Conta de anúncio não encontrada' });

  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAccount.adAccountId}/ads`, metaAccount.accessToken, {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "adset_id",
        "campaign_id",
        "creative",
      ].join(','),
      limit: 100,
    });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar ads', details: err.message });
  }
});

router.get('/:adAccountId/insights', async (req, res) => {
  const clientId = (req as any).clientId;
  const { adAccountId } = req.params;

  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { clientId, adAccountId, status: "active" },
  });

  if (!metaAccount) return res.status(404).json({ error: 'Conta de anúncio não encontrada' });

  const { level = 'campaign', since = '2024-01-01', until = '2024-01-31' } = req.query as any;

  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAccount.adAccountId}/insights`, metaAccount.accessToken, {
      level,
      time_range: JSON.stringify({ since, until }),
      fields: [
        "campaign_id",
        "campaign_name",
        "adset_id",
        "adset_name",
        "ad_id",
        "ad_name",
        "impressions",
        "clicks",
        "spend",
        "cpc",
        "cpm",
        "ctr",
        "actions",
      ].join(','),
      limit: 1000,
    });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar insights', details: err.message });
  }
});

// OAuth start
router.get('/oauth/start', (req, res) => {
  const clientIdHeader = (req as any).clientId;
  const appId = process.env.META_APP_ID;
  const redirect = process.env.META_REDIRECT_URI;

  if (!appId || !redirect) return res.status(500).json({ error: 'META_APP_ID or META_REDIRECT_URI not set' });

  const state = encodeURIComponent(JSON.stringify({ clientId: clientIdHeader }));
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&scope=ads_read,ads_management&state=${state}`;

  return res.json({ url });
});

// OAuth callback
router.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query as any;
  if (!code) return res.status(400).json({ error: 'code missing' });

  let clientId: string | undefined;
  try {
    if (state) {
      const parsed = JSON.parse(decodeURIComponent(state));
      clientId = parsed.clientId;
    }
  } catch (e) {
    // ignore
  }

  const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token`;

  const tokenRes = await (await import('axios')).default.get(tokenUrl, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI || '',
      code,
    },
  });
  const tokenJson = tokenRes.data as any;
  const accessToken = tokenJson.access_token as string;

  // fetch adaccounts
  const accRes = await (await import('axios')).default.get('https://graph.facebook.com/v19.0/me/adaccounts', {
    params: { access_token: accessToken },
  });
  const accJson = accRes.data as any;
  const accountsData = (accJson.data || []) as Array<{ id: string; name?: string }>;

  for (const acc of accountsData) {
    await prisma.metaAdAccount.upsert({
      where: { clientId_adAccountId: { clientId: clientId || 'unknown', adAccountId: acc.id } },
      update: { name: acc.name || null, accessToken, status: 'active' },
      create: { clientId: clientId || 'unknown', adAccountId: acc.id, name: acc.name || null, accessToken, status: 'active' },
    });
  }

  return res.json({ success: true, accounts: accountsData });
});

export default router;
