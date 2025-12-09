import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { CampaignHierarchy } from '@/types';
import { Tooltip } from './Tooltip';
import { useToast } from '@/contexts/ToastContext';

const toRoman = (num: number): string => {
  const map: { [key: number]: string } = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
    11: 'XI', 12: 'XII'
  };
  return map[num] || num.toString();
};

interface Props {
  data: CampaignHierarchy[];
  loading: boolean;
  journeyLabels?: string[]; // Labels for columns (I, II, III...)
  dataSource?: 'KOMMO' | 'META' | 'HYBRID';
  goals?: any[];
  selectedGoalType?: 'ROAS' | 'CPA' | 'REVENUE';
}

const HierarchyRow = ({ node, level, journeyLabels, dataSource, goals = [], selectedGoalType = 'ROAS' }: { node: CampaignHierarchy, level: number, journeyLabels?: string[], dataSource?: 'KOMMO' | 'META' | 'HYBRID', goals?: any[], selectedGoalType?: 'ROAS' | 'CPA' | 'REVENUE' }) => {
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();
  const hasChildren = node.children && node.children.length > 0;

  const paddingLeft = level * 20 + 10;

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

  const getEvaluation = (campaign: CampaignHierarchy) => {
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
      let stageIndex = 2; // Default to index 2 (Stage 3) if parsing fails
      if (selectedGoalType && selectedGoalType.startsWith('CPA_')) {
        const parts = selectedGoalType.split('_');
        if (parts.length > 1) {
          stageIndex = parseInt(parts[1], 10);
        }
      }

      // Dynamic Stage Access (stage1, stage2, etc.)
      const stageKey = `stage${stageIndex + 1}` as keyof typeof campaign.data;
      const conversions = campaign.data[stageKey] || 0;

      const cpa = conversions > 0 ? spend / conversions : 0;
      const target = getGoalValue('CPA', stageIndex);

      const cpaRounded = Math.round(cpa * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      if (cpaRounded < targetRounded && cpaRounded > 0) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (cpaRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    }
  };

  const evaluation = node.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(node);

  return (
    <>
      <tr className={`border-b border-border transition-colors ${evaluation.bg ? evaluation.bg : (level > 0 ? 'bg-secondary/5' : '')} ${evaluation.hoverBg ? evaluation.hoverBg : 'hover:bg-secondary/20'}`}>
        <td className="py-3 pr-4" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasChildren && <div className="w-4" />} {/* Spacer */}

            <span
              className={`font-medium ${level === 0 ? 'text-foreground' : 'text-muted-foreground'} truncate max-w-[300px] hover:text-brand-500 cursor-copy transition-colors`}
              title="Copiar"
              onClick={(e) => handleCopy(e, node.name)}
            >
              {node.name}
            </span>
            {level === 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                Campanha
              </span>
            )}
            {level === 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Conjunto
              </span>
            )}
            {level === 2 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                Anúncio
              </span>
            )}
          </div>
        </td>

        {/* Evaluation Emoji */}
        <td className="py-3 px-4 text-center text-lg">
          {node.isOrphan ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <Tooltip content={`Nível: ${evaluation.level}`} position="top">
              <span>{evaluation.emoji}</span>
            </Tooltip>
          )}
        </td>

        <td className="py-3 px-4 text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${node.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
            {node.status === 'active' ? 'Ativo' : 'Pausado'}
          </span>
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>

        {/* Meta Leads (Stage 0) */}
        {dataSource === 'HYBRID' && (
          <td className="py-3 px-4 text-right font-mono text-sm text-blue-500 font-bold">
            {(node.metaLeads || 0).toLocaleString('pt-BR')}
          </td>
        )}
        {dataSource === 'META' && (
          <td className="py-3 px-4 text-right font-mono text-sm text-blue-500 font-bold">
            {(node.metaLeads || 0).toLocaleString('pt-BR')}
          </td>
        )}

        {/* Ghost Leads */}
        {(dataSource === 'KOMMO' || dataSource === 'HYBRID') && (
          <td className="py-3 px-4 text-right font-mono text-sm text-gray-600 font-bold bg-gray-500/10">
            {(node.ghostLeads || 0).toLocaleString('pt-BR')}
          </td>
        )}

        {/* Dynamic Stages */}
        {(journeyLabels || ["I", "II", "III", "IV", "V"]).map((label, index) => {
          const stageKey = `stage${index + 1}` as keyof typeof node.data;
          const value = node.data[stageKey];
          const spend = node.spend || 0;
          const costPerStep = value > 0 ? spend / value : 0;

          return (
            <td key={index} className="py-3 px-4 text-right font-mono text-sm text-foreground">
              <Tooltip content={
                <div className="text-center">
                  <p className="font-bold">{label}</p>
                  <p className="text-xs opacity-80">Custo: {costPerStep.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              } position="top">
                <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                  {value.toLocaleString('pt-BR')}
                </span>
              </Tooltip>
            </td>
          );
        })}

        {/* Revenue */}
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {(node.revenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>

        {/* ROAS */}
        {dataSource === 'HYBRID' && (
          <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
            {(() => {
              const spend = node.spend || 0;
              const roas = spend > 0 ? (node.revenue || 0) / spend : 0;
              return (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${evaluation.color} ${evaluation.bg}`}>
                  {roas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              );
            })()}
          </td>
        )}
      </tr>
      {expanded && node.children?.map((child) => (
        <HierarchyRow key={child.id} node={child} level={level + 1} journeyLabels={journeyLabels} dataSource={dataSource} goals={goals} selectedGoalType={selectedGoalType} />
      ))}
    </>
  );
};

export const CampaignHierarchyTable: React.FC<Props> = ({ data, loading, journeyLabels, dataSource, goals, selectedGoalType }) => {
  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];

  if (loading) {
    return (
      <div className="w-full bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass neon-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/30 border-b border-border text-left">
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground w-[35%]">Nome</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-center">Aval.</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-center">Status</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">Investimento</th>
              {dataSource === 'HYBRID' && (
                <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right text-blue-500">
                  Meta Leads
                </th>
              )}
              {dataSource === 'META' && (
                <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right text-blue-500">
                  {labels.length > 0 ? labels[labels.length - 1] : 'Resultado'}
                </th>
              )}
              {(dataSource === 'KOMMO' || dataSource === 'HYBRID') && (
                <th className="py-4 px-4 font-semibold text-sm text-gray-600 text-right bg-gray-500/10">Leads Fantasmas</th>
              )}
              {labels.map((label, index) => (
                <th key={index} className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">
                  {toRoman(index + 1)}
                </th>
              ))}
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">Receita</th>
              {dataSource === 'HYBRID' && (
                <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">ROAS</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground">
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            ) : (
              data.map((campaign) => (
                <HierarchyRow key={campaign.id} node={campaign} level={0} journeyLabels={labels} dataSource={dataSource} goals={goals} selectedGoalType={selectedGoalType} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
