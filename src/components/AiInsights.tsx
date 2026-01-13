import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { AdCampaign, CampaignHierarchy } from '../types';
import ReactMarkdown from 'react-markdown';
import { Skeleton } from './Skeleton';
// import { analyzeCampaignData } from '@/services/geminiService';

interface AiInsightsProps {
  campaigns: (AdCampaign | CampaignHierarchy)[];
  loading?: boolean;
}

export const AiInsights: React.FC<AiInsightsProps> = ({ campaigns, loading: parentLoading }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  const loading = parentLoading || internalLoading;

  const handleAnalyze = async () => {
    setInternalLoading(true);
    try {
      // Map to consistent structure for AI
      const simplifiedCampaigns = campaigns.map(c => {
        // Handle CampaignHierarchy structure which might calculate metrics differently or have them pre-calculated
        const spend = typeof c.spend === 'number' ? c.spend : 0;
        const revenue = typeof c.revenue === 'number' ? c.revenue : 0;
        // Safe access to data stages
        const leads = (c as any).data?.stage1 || 0;

        return {
          name: c.name,
          status: c.status,
          spend: spend,
          revenue: revenue,
          leads: leads,
          roas: spend > 0 ? revenue / spend : 0,
        };
      });

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaigns: simplifiedCampaigns }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      } else {
        setAnalysis("Erro ao gerar insights. Verifique a API Key ou tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao chamar API de IA:", error);
      setAnalysis("Erro de conexão com o servidor de IA.");
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-lg relative overflow-hidden glass neon-border">
      {/* Abstract Background Glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand-500 rounded-full blur-3xl opacity-20"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-brand-400" size={20} />
            <h3 className="font-bold text-lg">Gemini AI Insights</h3>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : 'Analisar Dados'}
          </button>
        </div>

        <div className="min-h-[100px] text-sm text-muted-foreground leading-relaxed">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-2 bg-muted rounded w-3/4" />
              <Skeleton className="h-2 bg-muted rounded w-1/2" />
              <Skeleton className="h-2 bg-muted rounded w-5/6" />
            </div>
          ) : analysis ? (
            <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground/50 italic">Clique em "Analisar Dados" para receber uma auditoria inteligente das suas campanhas baseada no funil de vendas I-V.</p>
          )}
        </div>
      </div>
    </div>
  );
};
