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

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(num);
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

interface TrackingTableProps {
  data: AdCampaign[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  journeyLabels?: string[];
  dataSource?: string;
  loading?: boolean;
  goals?: any[];
  selectedGoalType?: 'ROAS' | 'CPA' | 'REVENUE';
  columns?: string[]; // Array of column keys
  onColumnsReorder?: (columns: string[]) => void;
  metaResultLabel?: string;
  compact?: boolean;
}

export const TrackingTable: React.FC<TrackingTableProps> = ({
  data,
  onSelect,
  selectedId,
  journeyLabels,
  dataSource = 'META',
  loading,
  goals = [],
  selectedGoalType = 'ROAS',
  columns,
  onColumnsReorder,
  metaResultLabel,
  compact = false
}) => {
  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];
  const { showToast } = useToast();

  // Default columns if not provided
  const activeColumns = columns || (compact
    ? ['name', 'status', 'roas', 'results']
    : ['name', 'evaluation', 'status', 'spend', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'revenue', 'roas', 'results']);

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
      let stageIndex = 2; // Default to index 2 (Stage 3) if parsing fails
      if (selectedGoalType.startsWith('CPA_')) {
        const parts = selectedGoalType.split('_');
        if (parts.length > 1) {
          stageIndex = parseInt(parts[1], 10);
        }
      }

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

  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, key: string) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableHeaderCellElement>, targetKey: string) => {
    e.preventDefault();
    const draggedKey = e.dataTransfer.getData('text/plain');
    if (draggedKey === targetKey) return;

    if (activeColumns && onColumnsReorder) {
      const newColumns = [...activeColumns];
      const draggedIndex = newColumns.indexOf(draggedKey);
      const targetIndex = newColumns.indexOf(targetKey);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        newColumns.splice(draggedIndex, 1);
        newColumns.splice(targetIndex, 0, draggedKey);
        onColumnsReorder(newColumns);
      }
    }
  };

  const renderHeader = (key: string) => {
    let content;
    if (key.startsWith('stage')) {
      const index = parseInt(key.replace('stage', '')) - 1;
      const label = labels[index] || toRoman(index + 1);
      content = label;
    } else {
      switch (key) {
        case 'name': content = 'Campanha'; break;
        case 'evaluation': content = 'Aval.'; break;
        case 'status': content = 'Status'; break;
        case 'spend': content = 'Investimento'; break;
        case 'revenue': content = 'Receita'; break;
        case 'roas': content = 'ROAS'; break;
        case 'ghostLeads': content = 'Fantasmas'; break;
        case 'results':
          if (dataSource?.includes('HYBRID') && metaResultLabel) {
            content = `Plataforma ${metaResultLabel}`;
          } else {
            if (dataSource === 'META') {
              content = journeyLabels && journeyLabels.length > 0 ? `Meta ${journeyLabels[journeyLabels.length - 1]}` : 'Meta Resultado';
            } else if (dataSource === 'GOOGLE') {
              content = journeyLabels && journeyLabels.length > 0 ? `Google ${journeyLabels[journeyLabels.length - 1]}` : 'Google Resultado';
            } else {
              content = journeyLabels && journeyLabels.length > 0 ? journeyLabels[journeyLabels.length - 1] : 'Resultado';
            }
          }
          break;
        default: content = null;
      }
    }

    if (!content) return null;

    return (
      <th
        key={key}
        draggable
        onDragStart={(e) => handleDragStart(e, key)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, key)}
        className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-move hover:bg-secondary/50 transition-colors ${key === 'name' ? 'text-left min-w-[200px]' : (key === 'spend' || key === 'revenue' || key === 'roas' ? 'text-right' : '')} ${key === 'results' ? 'text-blue-500' : ''} ${key === 'ghostLeads' ? 'text-gray-500' : ''}`}
      >
        {content}
      </th>
    );
  };

  const renderCell = (campaign: AdCampaign, key: string) => {
    const evaluation = campaign.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(campaign);

    if (key.startsWith('stage')) {
      const index = parseInt(key.replace('stage', '')) - 1;
      const value = campaign.data[key as keyof typeof campaign.data] || 0;
      const spend = campaign.spend || 0;
      const costPerStep = value > 0 ? spend / value : 0;
      const label = labels[index] || toRoman(index + 1);

      return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center`}>
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
    }

    switch (key) {
      case 'name': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} font-medium text-foreground`}>
          <span
            className="cursor-pointer hover:text-brand-500 transition-colors block truncate max-w-[200px]"
            onClick={(e) => { e.stopPropagation(); handleCopy(e, campaign.name); }}
            title={campaign.name}
          >
            {campaign.name}
          </span>
        </td>
      );
      case 'evaluation': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center text-lg`}>
          {campaign.isOrphan ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <Tooltip content={`Nível: ${evaluation.level}`} position="top">
              <span>{evaluation.emoji}</span>
            </Tooltip>
          )}
        </td>
      );
      case 'status': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center`}>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
            {campaign.status === 'active' ? 'Ativo' : 'Pausado'}
          </span>
        </td>
      );
      case 'spend': return <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-right font-mono text-sm text-foreground`}>{formatCurrency(campaign.spend || 0)}</td>;
      case 'revenue': return <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-right font-bold text-brand-500`}>{formatCurrency(campaign.revenue || 0)}</td>;
      case 'roas': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-right`}>
          {dataSource?.includes('HYBRID') ? (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${evaluation.color} ${evaluation.bg}`}>
              {(campaign.spend && campaign.spend > 0 ? (campaign.revenue || 0) / campaign.spend : 0).toFixed(2)}x
            </span>
          ) : (
            <span>{(campaign.roas || 0).toFixed(2)}x</span>
          )}
        </td>
      );
      case 'ghostLeads': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center text-gray-600 font-bold bg-gray-500/10`}>
          {formatNumber(campaign.ghostLeads || 0)}
        </td>
      );
      case 'results': return (
        <td key={key} className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-center font-bold text-blue-600 dark:text-blue-400`}>
          {formatNumber(campaign.metaLeads || campaign.data.stage5 || 0)}
        </td>
      );
      default: return <td key={key}></td>;
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                {activeColumns.map(key => renderHeader(key))}
                <th scope="col" className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  {activeColumns.map((key, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  ))}
                  <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-5 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-muted-foreground">
          <thead className="bg-secondary/50">
            <tr>
              {activeColumns.map(key => renderHeader(key))}
              <th scope="col" className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 1} className="py-8 text-center text-muted-foreground">
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            ) : (
              data.map((campaign) => {
                const evaluation = campaign.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(campaign);
                const isSelected = selectedId === campaign.id;

                return (
                  <tr
                    key={campaign.id}
                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-500/5' : ''} ${evaluation.bg || ''} ${evaluation.hoverBg || 'hover:bg-secondary/20'}`}
                    onClick={() => onSelect(campaign.id)}
                  >
                    {activeColumns.map(key => renderCell(campaign, key))}
                    <td className={`${compact ? 'px-2 py-2' : 'px-4 py-3'} text-right`}>
                      <button className={`p-1 rounded-full hover:bg-brand-500/20 text-muted-foreground hover:text-brand-500 transition-all ${isSelected ? 'text-brand-500 bg-brand-500/20' : ''}`}>
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
