import { CampaignHierarchy } from '@/types';

export const sortAlphabetically = (a: { name: string }, b: { name: string }) => {
  return (a.name || '').localeCompare(b.name || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export const sortCampaignsRecursively = (campaigns: CampaignHierarchy[]): CampaignHierarchy[] => {
  return [...campaigns].sort(sortAlphabetically).map((campaign) => ({
    ...campaign,
    children: campaign.children ? sortCampaignsRecursively(campaign.children) : undefined,
  }));
};
