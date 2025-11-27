import { AdCampaign, MetricSummary } from './types';

export const STAGE_DESCRIPTIONS = {
  I: "Impressões / Alcance",
  II: "Cliques / Interesse",
  III: "Leads / Cadastro",
  IV: "Checkout Iniciado",
  V: "Compra Realizada"
};

export const STAGE_COLORS = {
  I: "bg-blue-100 text-blue-700 border-blue-200",
  II: "bg-cyan-100 text-cyan-700 border-cyan-200",
  III: "bg-yellow-100 text-yellow-700 border-yellow-200",
  IV: "bg-orange-100 text-orange-700 border-orange-200",
  V: "bg-red-100 text-red-700 border-red-200"
};

export const MOCK_CAMPAIGNS: AdCampaign[] = [
  {
    id: '1',
    name: 'AD01 - Promo Verão',
    status: 'active',
    data: { stage1: 15420, stage2: 4200, stage3: 850, stage4: 120, stage5: 45 }
  },
  {
    id: '2',
    name: 'AD02 - Lançamento Tech',
    status: 'active',
    data: { stage1: 22100, stage2: 5100, stage3: 1200, stage4: 340, stage5: 120 }
  },
  {
    id: '3',
    name: 'AD03 - Retargeting Frio',
    status: 'paused',
    data: { stage1: 8900, stage2: 1200, stage3: 150, stage4: 20, stage5: 5 }
  },
  {
    id: '4',
    name: 'AD04 - Branding Institucional',
    status: 'active',
    data: { stage1: 45000, stage2: 2300, stage3: 500, stage4: 50, stage5: 10 }
  },
  {
    id: '5',
    name: 'AD05 - Oferta Relâmpago',
    status: 'completed',
    data: { stage1: 32000, stage2: 8900, stage3: 2100, stage4: 900, stage5: 450 }
  }
];

export const MOCK_METRICS: MetricSummary[] = [
  { label: 'Total Investido', value: 'R$ 12.450', trend: 'up', percentage: '+12%' },
  { label: 'ROAS Global', value: '4.2x', trend: 'up', percentage: '+5%' },
  { label: 'Taxa de Conversão (I -> V)', value: '1.8%', trend: 'down', percentage: '-0.2%' },
  { label: 'Custo por Lead (CPL)', value: 'R$ 4,50', trend: 'neutral', percentage: '0%' },
];
