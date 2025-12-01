import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { CampaignHierarchy } from '@/types';
import { useToast } from '@/contexts/ToastContext';

interface Props {
  data: CampaignHierarchy[];
  loading: boolean;
  journeyLabels?: string[]; // Labels for columns (I, II, III...)
}

const HierarchyRow = ({ node, level, journeyLabels }: { node: CampaignHierarchy, level: number, journeyLabels?: string[] }) => {
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();
  const hasChildren = node.children && node.children.length > 0;

  const paddingLeft = level * 20 + 10;

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado!`, "success");
  };

  return (
    <>
      <tr className={`border-b border-border hover:bg-secondary/20 transition-colors ${level > 0 ? 'bg-secondary/5' : ''}`}>
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
        <td className="py-3 px-4 text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${node.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
            {node.status === 'active' ? 'Ativo' : 'Pausado'}
          </span>
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.data.stage1.toLocaleString('pt-BR')}
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.data.stage2.toLocaleString('pt-BR')}
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.data.stage3.toLocaleString('pt-BR')}
        </td>
        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
          {node.data.stage5.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
      </tr>
      {expanded && node.children?.map((child) => (
        <HierarchyRow key={child.id} node={child} level={level + 1} journeyLabels={journeyLabels} />
      ))}
    </>
  );
};

export const CampaignHierarchyTable: React.FC<Props> = ({ data, loading, journeyLabels }) => {
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
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground w-[40%]">Nome</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-center">Status</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">Investimento</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">{labels[0]}</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">{labels[1]}</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">{labels[2]}</th>
              <th className="py-4 px-4 font-semibold text-sm text-muted-foreground text-right">Receita (V)</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            ) : (
              data.map((campaign) => (
                <HierarchyRow key={campaign.id} node={campaign} level={0} journeyLabels={labels} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
