export interface StageData {
  label: string; // e.g., "I", "II"
  description: string; // e.g., "Impressões", "Checkout"
  value: number;
}

export interface AdCampaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  data: {
    stage1: number; // I
    stage2: number; // II
    stage3: number; // III
    stage4: number; // IV
    stage5: number; // V
  };
  spend?: number;
  roas?: number;
  revenue?: number;
}

export enum JourneyStage {
  I = 'I',
  II = 'II',
  III = 'III',
  IV = 'IV',
  V = 'V'
}

export interface MetricSummary {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  percentage: string;
  tooltip?: string;
  icon?: string;
}

export interface CampaignHierarchy {
  id: string;
  name: string;
  type: 'campaign' | 'adset' | 'ad';
  status: 'active' | 'paused' | 'completed';
  data: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
    stage5: number;
  };
  spend: number;
  roas: number;
  revenue: number;
  children?: CampaignHierarchy[];
}
