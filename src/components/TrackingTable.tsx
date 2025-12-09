import React from 'react';
import { AdCampaign } from '../types';
import { ChevronRight } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Skeleton } from './Skeleton';
import { useToast } from '@/contexts/ToastContext';

const toRoman = (num: number): string => {
  const map: { [key: number]: string } = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
    11: 'XI', 12: 'XII'
  };
  return map[num] || num.toString();
};

interface TrackingTableProps {
  data: AdCampaign[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  journeyLabels?: string[];
  dataSource?: 'KOMMO' | 'META' | 'HYBRID';
  loading?: boolean;
  goals?: any[];
  selectedGoalType?: 'ROAS' | 'CPA' | 'REVENUE';
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(num);
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export const TrackingTable: React.FC<TrackingTableProps> = ({ data, onSelect, selectedId, journeyLabels, dataSource = 'META', loading, goals = [], selectedGoalType = 'ROAS' }) => {
  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];
  const { showToast } = useToast();

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado!`, "success");
  };

  const getGoalValue = (type: 'ROAS' | 'CPA' | 'REVENUE', stageIndex?: number) => {
    const safeGoals = Array.isArray(goals) ? goals : [];
    const goal = safeGoals.find(g => g.type === type && (stageIndex === undefined || g.stageIndex === stageIndex));
    // Defaults: ROAS 5, CPA 50, REVENUE 10000
    return goal ? goal.value : (type === 'ROAS' ? 5.0 : (type === 'REVENUE' ? 10000.0 : 50.0));
  };

  const getEvaluation = (campaign: AdCampaign) => {
    const spend = campaign.spend || 0;

    if (selectedGoalType === 'ROAS') {
      const roas = spend > 0 ? (campaign.revenue || 0) / spend : 0;
      const target = getGoalValue('ROAS');

      const roasRounded = Math.round(roas * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      if (roasRounded > targetRounded) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (roasRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    } else if (selectedGoalType === 'REVENUE') {
      const revenue = campaign.revenue || 0;
      const target = getGoalValue('REVENUE');

      const revenueRounded = Math.round(revenue * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      if (revenueRounded > targetRounded) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (revenueRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    } else {
      // CPA Evaluation
      // Parse index from "CPA_0", "CPA_1", etc.
      let stageIndex = 2; // Default to index 2 (Stage 3) if parsing fails
      if (selectedGoalType.startsWith('CPA_')) {
        const parts = selectedGoalType.split('_');
        if (parts.length > 1) {
          stageIndex = parseInt(parts[1], 10);
        }
      }

      // Dynamic Stage Access (stage1, stage2, etc.)
      // stageIndex is 0-based, data keys are 1-based (stage1, stage2...)
      const stageKey = `stage${stageIndex + 1}` as keyof typeof campaign.data;
      const conversions = campaign.data[stageKey] || 0;

      const cpa = conversions > 0 ? spend / conversions : 0;
      const target = getGoalValue('CPA', stageIndex);

      const cpaRounded = Math.round(cpa * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      // Lower CPA is better
      if (cpaRounded < targetRounded && cpaRounded > 0) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (cpaRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    }
  };

  if (loading) {
    // ... skeleton code (omitted for brevity, keeping existing skeleton logic would be best but I'm replacing the whole component for cleanliness)
    // Actually I should keep the skeleton.
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            {/* ... Skeleton Header ... */}
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4">Campanha</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">Aval.</th>
                {(dataSource === 'HYBRID' || dataSource === 'META') && (
                  <>
                    <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">Investimento</th>
                    <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">ROAS</th>
                  </>
                )}
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-brand-600 bg-brand-50/10">I</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">II</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">III</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">IV</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">V</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 md:px-6 md:py-4"><Skeleton className="h-5 w-48" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-8 mx-auto" /></td>
                  {(dataSource === 'HYBRID' || dataSource === 'META') && (
                    <>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-20 mx-auto" /></td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto rounded-full" /></td>
                    </>
                  )}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm glass">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-muted-foreground">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4">Campanha</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center" title="Nível de Avaliação">Aval.</th>
              {(dataSource === 'HYBRID' || dataSource === 'META') && (
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">Investimento</th>
              )}
              {dataSource === 'HYBRID' && (
                <>
                  <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">ROAS</th>
                  <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-blue-500">
                    Meta Leads
                  </th>
                </>
              )}
              {dataSource === 'META' && (
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-blue-500">
                  {labels.length > 0 ? labels[labels.length - 1] : 'Resultado'}
                </th>
              )}
              {(dataSource === 'KOMMO' || dataSource === 'HYBRID') && (
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-gray-600 font-bold bg-gray-500/10">Leads Fantasmas</th>
              )}
              {labels.map((label, index) => (
                <th key={index} scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">
                  {toRoman(index + 1)}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-brand-500">Receita</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((ad) => {
              const isSelected = selectedId === ad.id;
              const evaluation = ad.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(ad);

              return (
                <tr
                  key={ad.id}
                  onClick={() => onSelect(ad.id)}
                  className={`cursor-pointer transition-colors duration-200 border-l-4 ${isSelected ? `${evaluation.activeBg || 'bg-brand-500/20'} border-brand-500 shadow-inner` : `border-transparent ${evaluation.hoverBg || 'hover:bg-accent/50'} ${!isSelected && evaluation.bg}`}`}
                >
                  <td className="px-4 py-3 md:px-6 md:py-4 font-medium text-card-foreground">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${ad.status === 'active' ? 'bg-brand-400 animate-pulse' :
                        ad.status === 'paused' ? 'bg-amber-400' : 'bg-muted'
                        }`} />
                      <span
                        className="truncate max-w-[200px] hover:text-brand-500 cursor-copy transition-colors"
                        title="Copiar"
                        onClick={(e) => handleCopy(e, ad.name)}
                      >
                        {ad.name}
                      </span>
                    </div>
                  </td>

                  {/* Evaluation Emoji */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center text-lg">
                    {ad.isOrphan ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <Tooltip content={`Nível: ${evaluation.level}`} position="top">
                        <span>{evaluation.emoji}</span>
                      </Tooltip>
                    )}
                  </td>

                  {(dataSource === 'HYBRID' || dataSource === 'META') && (
                    <td className="px-4 py-3 md:px-6 md:py-4 text-center text-foreground font-medium">
                      {formatCurrency(ad.spend || 0)}
                    </td>
                  )}

                  {dataSource === 'HYBRID' && (
                    <>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                        {(() => {
                          const spend = ad.spend || 0;
                          const roas = spend > 0 ? (ad.revenue || 0) / spend : 0;
                          return (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${evaluation.color} ${evaluation.bg}`}>
                              {roas.toFixed(2)}x
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center text-blue-500 font-bold">
                        {formatNumber(ad.metaLeads || 0)}
                      </td>
                    </>
                  )}

                  {dataSource === 'META' && (
                    <td className="px-4 py-3 md:px-6 md:py-4 text-center text-blue-500 font-bold">
                      {formatNumber(ad.metaLeads || 0)}
                    </td>
                  )}

                  {(dataSource === 'KOMMO' || dataSource === 'HYBRID') && (
                    <td className="px-4 py-3 md:px-6 md:py-4 text-center text-gray-600 font-bold bg-gray-500/10">
                      {formatNumber(ad.ghostLeads || 0)}
                    </td>
                  )}

                  {/* Dynamic Stages */}
                  {labels.map((label, index) => {
                    const stageKey = `stage${index + 1}` as keyof typeof ad.data;
                    const value = ad.data[stageKey];
                    const spend = ad.spend || 0;
                    const costPerStep = value > 0 ? spend / value : 0;

                    return (
                      <td key={index} className="px-4 py-3 md:px-6 md:py-4 text-center">
                        <Tooltip content={
                          <div className="text-center">
                            <p className="font-bold">{label}</p>
                            <p className="text-xs opacity-80">Custo: {formatCurrency(costPerStep)}</p>
                          </div>
                        } position="top">
                          <span className="text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/50">
                            {formatNumber(value)}
                          </span>
                        </Tooltip>
                      </td>
                    );
                  })}

                  {/* Revenue */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                    <span className="font-bold text-brand-500">
                      {formatCurrency(ad.revenue || 0)}
                    </span>
                  </td>

                  <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                    <button className={`p-1 rounded-full hover:bg-brand-500/20 text-muted-foreground hover:text-brand-500 transition-all ${isSelected ? 'text-brand-500 bg-brand-500/20' : ''}`}>
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
