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
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(num);
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export const TrackingTable: React.FC<TrackingTableProps> = ({ data, onSelect, selectedId, journeyLabels, dataSource = 'META', loading }) => {
  const labels = journeyLabels || ["Impressões", "Cliques", "Leads", "Checkout", "Vendas"];
  const { showToast } = useToast();

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado!`, "success");
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4">Campanha</th>
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
              {(dataSource === 'HYBRID' || dataSource === 'META') && (
                <>
                  <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">Investimento</th>
                  <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">ROAS</th>
                </>
              )}
              {labels.map((label, index) => (
                <th key={index} scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">
                  <Tooltip content={label}>
                    <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                      {toRoman(index + 1)}
                    </span>
                  </Tooltip>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-brand-500">Receita</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((ad) => {
              const isSelected = selectedId === ad.id;
              return (
                <tr
                  key={ad.id}
                  onClick={() => onSelect(ad.id)}
                  className={`cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-brand-50/10' : 'hover:bg-accent/50'}`}
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

                  {(dataSource === 'HYBRID' || dataSource === 'META') && (
                    <>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center text-foreground font-medium">
                        {formatCurrency(ad.spend || 0)}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${(ad.roas || 0) >= 1 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                          {(ad.roas || 0).toFixed(2)}x
                        </span>
                      </td>
                    </>
                  )}

                  {/* Dynamic Stages */}
                  {labels.map((_, index) => {
                    const stageKey = `stage${index + 1}` as keyof typeof ad.data;
                    const value = ad.data[stageKey];
                    // Calculate percentage for bar (relative to stage 1 or previous stage?)
                    // Let's keep it simple: just show the number. 
                    // If index is 1 (Stage II), we had a bar before. We can try to keep it if we want, but dynamic is harder.
                    // For now, simple number display.
                    return (
                      <td key={index} className="px-4 py-3 md:px-6 md:py-4 text-center">
                        <span className="text-muted-foreground">{formatNumber(value)}</span>
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
