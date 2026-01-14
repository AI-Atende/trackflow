import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, LayoutGrid, Inbox, MoreHorizontal, MessageSquare } from 'lucide-react';
import { CampaignHierarchy } from '@/types';
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

interface Props {
  data: CampaignHierarchy[];
  loading: boolean;
  journeyLabels?: string[];
  dataSource?: 'KOMMO' | 'META' | 'GOOGLE' | 'HYBRID' | 'HYBRID_META' | 'HYBRID_GOOGLE' | 'HYBRID_ALL';
  goals?: any[];
  selectedGoalType?: 'ROAS' | 'CPA' | 'REVENUE';
  columns?: string[];
  onColumnsReorder?: (columns: string[]) => void;
  metaResultLabel?: string;
}

interface RowProps {
  node: CampaignHierarchy;
  level: number;
  columns: string[];
  renderCell: (node: CampaignHierarchy, key: string) => React.ReactNode;
  onCopy: (text: string) => void;
  evaluation: any;
  dataSource?: string;
}

const HierarchyRow: React.FC<RowProps> = ({ node, level, columns, renderCell, onCopy, evaluation, dataSource }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 20 + 10;

  return (
    <>
      <tr className={`border-b border-border transition-colors ${level === 2 ? (evaluation.bg || '') : ''} ${level === 2 ? (evaluation.hoverBg || 'hover:bg-secondary/20') : 'hover:bg-secondary/20'}`}>
        {columns.map(key => {
          if (key === 'name') {
            return (
              <td key={key} className="py-3 pr-4" style={{ paddingLeft: `${paddingLeft}px` }}>
                <div className="flex items-center gap-3 group">
                  {hasChildren ? (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  ) : (
                    <div className="w-6" />
                  )}

                  <div className={`
                    p-1.5 rounded-lg shrink-0
                    ${level === 0 ? 'bg-blue-500/10 text-blue-500' : ''}
                    ${level === 1 ? 'bg-purple-500/10 text-purple-500' : ''}
                    ${level === 2 ? 'bg-secondary text-foreground' : ''}
                  `}>
                    {level === 0 && <Folder size={16} />}
                    {level === 1 && <LayoutGrid size={16} />}
                    {level === 2 && <Inbox size={16} />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`font-semibold text-sm truncate max-w-[300px] cursor-copy transition-colors hover:text-brand-500 ${level === 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                      title={node.name}
                      onClick={(e) => { e.stopPropagation(); onCopy(node.name); }}
                    >
                      {node.name}
                    </span>
                    {level === 2 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/70">Mensagem</span>
                        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          {node.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            );
          }
          return renderCell(node, key);
        })}
      </tr>
      {expanded && hasChildren && node.children!.map(child => (
        <HierarchyRow
          key={child.id}
          node={child}
          level={level + 1}
          columns={columns}
          renderCell={renderCell}
          onCopy={onCopy}
          evaluation={evaluation}
          dataSource={dataSource}
        />
      ))}
    </>
  );
};

// Wrapper to handle recursive evaluation calculation
const HierarchyRowWrapper = ({ node, level, columns, renderCell, onCopy, getEvaluation, dataSource }: { node: CampaignHierarchy, level: number, columns: string[], renderCell: (node: CampaignHierarchy, key: string) => React.ReactNode, onCopy: (text: string) => void, getEvaluation: (node: CampaignHierarchy) => any, dataSource?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 20 + 10;
  const evaluation = node.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(node);

  return (
    <>
      <tr className={`border-b border-border transition-colors ${level === 2 ? (evaluation.bg || '') : ''} ${level === 2 ? (evaluation.hoverBg || 'hover:bg-secondary/20') : 'hover:bg-secondary/20'}`}>
        {columns.map(key => {
          if (key === 'name') {
            return (
              <td key={key} className="py-3 pr-4" style={{ paddingLeft: `${paddingLeft}px` }}>
                <div className="flex items-center gap-3 group">
                  {hasChildren ? (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  ) : (
                    <div className="w-6" /> // Spacer
                  )}

                  {/* Icon Based on Level/Type */}
                  <div className={`
                    p-1.5 rounded-lg shrink-0
                    ${level === 0 ? 'bg-blue-500/10 text-blue-500' : ''}
                    ${level === 1 ? 'bg-purple-500/10 text-purple-500' : ''}
                    ${level === 2 ? 'bg-secondary text-foreground' : ''}
                  `}>
                    {level === 0 && <Folder size={16} />}
                    {level === 1 && <LayoutGrid size={16} />}
                    {level === 2 && <Inbox size={16} />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`font-semibold text-sm truncate max-w-[300px] cursor-copy transition-colors hover:text-brand-500 ${level === 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                      title={node.name}
                      onClick={(e) => { e.stopPropagation(); onCopy(node.name); }}
                    >
                      {node.name}
                    </span>
                    {level === 2 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/70">Mensagem</span>
                        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          {node.name} {/* Assuming content is name, or "Olá..." */}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            );
          }
          return renderCell(node, key);
        })}
      </tr>
      {expanded && hasChildren && node.children!.map(child => (
        <HierarchyRowWrapper
          key={child.id}
          node={child}
          level={level + 1}
          columns={columns}
          renderCell={renderCell}
          onCopy={onCopy}
          getEvaluation={getEvaluation}
          dataSource={dataSource}
        />
      ))}
    </>
  );
};

export default function CampaignHierarchyTable({
  data,
  loading,
  journeyLabels,
  dataSource = 'META',
  goals = [],
  selectedGoalType = 'ROAS',
  columns,
  onColumnsReorder,
  metaResultLabel
}: Props) {
  const { showToast } = useToast();
  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];

  // Default columns
  const activeColumns = columns || ['name', 'evaluation', 'status', 'spend', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'revenue', 'roas', 'results'];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado!`, "success");
  };

  const getGoalValue = (type: 'ROAS' | 'CPA' | 'REVENUE', stageIndex?: number) => {
    const safeGoals = Array.isArray(goals) ? goals : [];
    const goal = safeGoals.find(g => g.type === type && (stageIndex === undefined || g.stageIndex === stageIndex));
    return goal ? goal.value : (type === 'ROAS' ? 5.0 : (type === 'REVENUE' ? 10000.0 : 50.0));
  };

  const getEvaluation = (node: CampaignHierarchy) => {
    const spend = node.spend || 0;

    if (selectedGoalType === 'ROAS') {
      const roas = spend > 0 ? (node.revenue || 0) / spend : 0;
      const target = getGoalValue('ROAS');
      const roasRounded = Math.round(roas * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      if (roasRounded > targetRounded) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (roasRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    } else if (selectedGoalType === 'REVENUE') {
      const revenue = node.revenue || 0;
      const target = getGoalValue('REVENUE');
      const revenueRounded = Math.round(revenue * 100) / 100;
      const targetRounded = Math.round(target * 100) / 100;

      if (revenueRounded > targetRounded) return { level: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10', hoverBg: 'hover:bg-green-500/20', activeBg: 'bg-green-500/20', emoji: '🤩' };
      if (revenueRounded === targetRounded) return { level: 'Aceitável', color: 'text-yellow-500', bg: 'bg-yellow-500/10', hoverBg: 'hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20', emoji: '😐' };
      return { level: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', hoverBg: 'hover:bg-red-500/20', activeBg: 'bg-red-500/20', emoji: '😟' };
    } else {
      let stageIndex = 2;
      if (selectedGoalType.startsWith('CPA_')) {
        const parts = selectedGoalType.split('_');
        if (parts.length > 1) stageIndex = parseInt(parts[1], 10);
      }
      const stageKey = `stage${stageIndex + 1}` as keyof typeof node.data;
      const conversions = node.data[stageKey] || 0;
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
        case 'name': content = 'Nome'; break;
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
        className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-move hover:bg-secondary/50 transition-colors ${key === 'name' ? 'text-left min-w-[300px]' : (key === 'spend' || key === 'revenue' || key === 'roas' ? 'text-right' : '')} ${key === 'results' ? 'text-blue-500' : ''}`}
      >
        {content}
      </th>
    );
  };

  const renderCell = (node: CampaignHierarchy, key: string) => {
    const evaluation = node.isOrphan ? { level: '', color: '', bg: '', hoverBg: '', activeBg: '', emoji: '-' } : getEvaluation(node);

    if (key.startsWith('stage')) {
      const index = parseInt(key.replace('stage', '')) - 1;
      const value = node.data[key as keyof typeof node.data] || 0;
      const spend = node.spend || 0;
      const costPerStep = value > 0 ? spend / value : 0;
      const label = labels[index] || toRoman(index + 1);

      return (
        <td key={key} className="px-4 py-3 text-center">
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
      case 'evaluation': return (
        <td key={key} className="px-4 py-3 text-center text-lg">
          {node.isOrphan ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <Tooltip content={`Nível: ${evaluation.level}`} position="top">
              <span>{evaluation.emoji}</span>
            </Tooltip>
          )}
        </td>
      );
      case 'status': {
        const statusMap: { [key: string]: { label: string; color: string; bg: string } } = {
          'ACTIVE': { label: 'Ativo', color: 'text-green-500', bg: 'bg-green-500/10' },
          'PAUSED': { label: 'Pausado', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          'DELETED': { label: 'Excluído', color: 'text-red-500', bg: 'bg-red-500/10' },
          'ARCHIVED': { label: 'Arquivado', color: 'text-gray-500', bg: 'bg-gray-500/10' },
          'CAMPAIGN_PAUSED': { label: 'Campanha Pausada', color: 'text-orange-500', bg: 'bg-orange-500/10' },
          'ADSET_PAUSED': { label: 'Conjunto Pausado', color: 'text-orange-500', bg: 'bg-orange-500/10' },
          'IN_PROCESS': { label: 'Em Processamento', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          'WITH_ISSUES': { label: 'Com Erros', color: 'text-red-500', bg: 'bg-red-500/10' },
        };

        const statusKey = node.status?.toUpperCase() || 'PAUSED';
        const config = statusMap[statusKey] || { label: 'Pausado', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };

        return (
          <td key={key} className="px-4 py-3 text-center">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} whitespace-nowrap`}>
              {config.label}
            </span>
          </td>
        );
      }
      case 'spend': return <td key={key} className="px-4 py-3 text-right font-mono text-sm text-foreground">{formatCurrency(node.spend || 0)}</td>;
      case 'revenue': return <td key={key} className="px-4 py-3 text-right font-bold text-brand-500">{formatCurrency(node.revenue || 0)}</td>;
      case 'roas': return (
        <td key={key} className="px-4 py-3 text-right">
          {dataSource?.includes('HYBRID') ? (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${evaluation.color} ${evaluation.bg}`}>
              {(node.spend && node.spend > 0 ? (node.revenue || 0) / node.spend : 0).toFixed(2)}x
            </span>
          ) : (
            <span>{(node.roas || 0).toFixed(2)}x</span>
          )}
        </td>
      );
      case 'ghostLeads': return (
        <td key={key} className="px-4 py-3 text-center text-gray-600 font-bold bg-gray-500/10">
          {formatNumber(node.ghostLeads || 0)}
        </td>
      );
      case 'results': return (
        <td key={key} className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
          {formatNumber(node.metaLeads || node.data.stage5 || 0)}
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
            <thead className="bg-secondary/50">
              <tr>
                {activeColumns.map(key => renderHeader(key))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  {activeColumns.map((key, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  ))}
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
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length} className="py-8 text-center text-muted-foreground">
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            ) : (
              data.map((campaign) => (
                <HierarchyRowWrapper
                  key={campaign.id}
                  node={campaign}
                  level={0}
                  columns={activeColumns}
                  renderCell={renderCell}
                  onCopy={handleCopy}
                  getEvaluation={getEvaluation}
                  dataSource={dataSource}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
