export type MetaAction = {
  action_type: string;
  value: string;
};

export type RawInsightRow = {
  date_start: string;
  date_stop: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
};

export type MetaAdAccountOption = {
  id: string;
  account_id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
  business?: { id: string; name: string };
};

export type MetaPaging = {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
};

export type RawInsightsResponse = {
  data: RawInsightRow[];
  paging?: MetaPaging;
};
