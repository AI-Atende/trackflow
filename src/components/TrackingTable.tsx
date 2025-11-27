import React from 'react';
import { AdCampaign } from '../types';
import { ChevronRight, Activity, Pause, CheckCircle2 } from 'lucide-react';
import { Skeleton } from './Skeleton';

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
  const labels = journeyLabels || ["I", "II", "III", "IV", "V"];
  const showFinancials = dataSource !== 'KOMMO';

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
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-brand-600 bg-brand-50/10">{labels[0] || "I"}</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[1] || "II"}</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[2] || "III"}</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[3] || "IV"}</th>
                <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[4] || "V"}</th>
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
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center text-brand-600 bg-brand-50/10">{labels[0] || "I"}</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[1] || "II"}</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[2] || "III"}</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[3] || "IV"}</th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 text-center">{labels[4] || "V"}</th>
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
                      <span className="truncate max-w-[200px]" title={ad.name}>{ad.name}</span>
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

                  {/* Stage I */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center bg-brand-50/5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-card text-brand-600 border border-brand-500/20">
                      {formatNumber(ad.data.stage1)}
                    </span>
                  </td>

                  {/* Stage II */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                    <span className="text-muted-foreground">{formatNumber(ad.data.stage2)}</span>
                    <div className="w-full bg-secondary h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-brand-500/50 h-1 rounded-full" style={{ width: `${(ad.data.stage2 / (ad.data.stage1 || 1)) * 100}%` }}></div>
                    </div>
                  </td>

                  {/* Stage III */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                    <span className="text-muted-foreground">{formatNumber(ad.data.stage3)}</span>
                  </td>

                  {/* Stage IV */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                    <span className="text-muted-foreground">{formatNumber(ad.data.stage4)}</span>
                  </td>

                  {/* Stage V */}
                  <td className="px-4 py-3 md:px-6 md:py-4 text-center">
                    <span className="font-bold text-brand-500">{formatNumber(ad.data.stage5)}</span>
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
