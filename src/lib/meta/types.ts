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
    actions?: MetaAction[];
};

export type RawInsightsResponse = {
    data: RawInsightRow[];
    paging?: any;
};
