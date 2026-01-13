import React, { useState } from 'react';
import { Trophy, Users, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdCampaign, CampaignHierarchy } from '../types';

interface CampaignRankingProps {
    campaigns: (AdCampaign | CampaignHierarchy)[];
    loading?: boolean;
    journeyLabels?: string[];
}

export const CampaignRanking: React.FC<CampaignRankingProps> = ({ campaigns, loading, journeyLabels = [] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (loading) {
        return <div className="h-full w-full bg-card rounded-2xl p-6 border border-border animate-pulse" />;
    }

    const topCampaigns = [...campaigns]
        .filter(c => (c.data?.stage1 || 0) > 0 || (c.spend || 0) > 0)
        .sort((a, b) => {
            // Priority 1: Ticket Médio
            const getTicketMedio = (camp: any) => {
                const lastIdx = journeyLabels.length || 5;
                const sales = (camp.data?.[`stage${lastIdx}`] as number) || 0;
                return sales > 0 ? (camp.revenue || 0) / sales : 0;
            };
            const ticketA = getTicketMedio(a);
            const ticketB = getTicketMedio(b);
            if (Math.abs(ticketB - ticketA) > 0.1) return ticketB - ticketA;

            // Priority 2: Funnel conversion rates (previous logic)
            const getConvRate = (camp: any, stageIndex: number) => {
                const stageVal = camp.data?.[`stage${stageIndex}`] || 0;
                const leads = camp.data?.stage1 || 1;
                return stageIndex === 1 ? stageVal : (stageVal / leads);
            };

            const maxStages = journeyLabels.length || 5;
            for (let i = maxStages; i >= 1; i--) {
                const rateA = getConvRate(a, i);
                const rateB = getConvRate(b, i);
                if (rateA > 0 || rateB > 0) {
                    if (Math.abs(rateB - rateA) > 0.0001) return rateB - rateA;
                }
            }

            // Priority 3: ROAS
            const roasA = a.spend ? (a.revenue || 0) / a.spend : 0;
            const roasB = b.spend ? (b.revenue || 0) / b.spend : 0;
            return roasB - roasA;
        })
        .slice(0, 3);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % topCampaigns.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + topCampaigns.length) % topCampaigns.length);
    };

    if (topCampaigns.length === 0) {
        return (
            <div className="h-full w-full bg-card rounded-2xl p-4 border border-border shadow-sm glass flex flex-col items-center justify-center text-center text-muted-foreground text-[10px] gap-1">
                <Trophy size={24} className="text-muted-foreground/30" />
                <p>Sem dados suficientes.</p>
            </div>
        );
    }

    const currentCamp = topCampaigns[currentIndex];
    const data = (currentCamp as any).data || { stage1: 0 };
    const revenue = currentCamp.revenue || 0;
    const spend = currentCamp.spend || 0;
    const cpa = data.stage1 > 0 ? spend / data.stage1 : 0;

    // Ticket Médio calculation for badge
    const lastStageIdx = journeyLabels.length || 5;
    const salesCount = (data[`stage${lastStageIdx}`] as number) || 0;
    const ticketMedio = salesCount > 0 ? revenue / salesCount : 0;

    // Use dynamic labels
    const leadLabel = journeyLabels[0] || "Leads";

    // Rank Specific Styles
    const rankColors = [
        "from-amber-400/20 to-yellow-600/10 border-amber-500/30 text-amber-500",
        "from-slate-300/20 to-slate-500/10 border-slate-400/30 text-slate-400",
        "from-orange-300/20 to-orange-600/10 border-orange-500/30 text-orange-400"
    ];
    const currentStyle = rankColors[currentIndex] || rankColors[0];

    return (
        <div className="h-full w-full bg-card rounded-2xl p-4 border border-border shadow-sm glass flex flex-col relative overflow-hidden group">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
                    <div className="p-1 bg-brand-500/10 rounded-md">
                        <Trophy size={14} className="text-brand-500" />
                    </div>
                    Ranking de Performance
                </h3>
                <div className="flex items-center gap-1">
                    <button onClick={handlePrev} className="p-1 hover:bg-muted rounded-md transition-colors">
                        <ChevronLeft size={16} className="text-muted-foreground" />
                    </button>
                    <button onClick={handleNext} className="p-1 hover:bg-muted rounded-md transition-colors">
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Carousel Item */}
            <div className={`flex-1 flex flex-col rounded-xl bg-gradient-to-br ${currentStyle} border p-4 relative overflow-hidden transition-all duration-500`}>
                {/* Background Rank Icon */}
                <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
                    <Trophy size={120} />
                </div>

                <div className="relative z-10 flex flex-col h-full">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest">{currentIndex + 1}º LUGAR</span>
                        {currentIndex === 0 && <Trophy size={16} className="text-amber-500 animate-pulse" />}
                    </div>

                    <h4 className="text-sm font-bold text-foreground truncate mb-1" title={currentCamp.name}>
                        {currentCamp.name}
                    </h4>

                    {/* Justification / Why is it here? */}
                    <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-1 h-3 bg-current rounded-full opacity-50" />
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Desempenho</span>
                        </div>
                        {(() => {
                            let reason = "Equilíbrio entre investimento e retorno.";
                            const lastIdx = journeyLabels.length || 5;
                            const sales = (data[`stage${lastIdx}`] as number) || 0;
                            const tm = sales > 0 ? revenue / sales : 0;

                            // Simple logic to determine a "Reason"
                            if (tm > 1000) {
                                reason = "Destaque pelo alto Ticket Médio por venda.";
                            } else if (revenue / (spend || 1) > 5) {
                                reason = "Excelente retorno sobre investimento (ROAS).";
                            } else {
                                // Find highest conversion rate stage
                                for (let i = lastIdx; i > 1; i--) {
                                    const val = (data[`stage${i}`] as number) || 0;
                                    const leads = (data.stage1 as number) || 1;
                                    if ((val / leads) > 0.1) {
                                        const stageLabel = journeyLabels[i - 1] || `Etapa ${i}`;
                                        reason = `Alta taxa de conversão em ${stageLabel}.`;
                                        break;
                                    }
                                }
                            }

                            return (
                                <p className="text-[11px] leading-tight font-medium opacity-90">
                                    {reason}
                                </p>
                            );
                        })()}
                    </div>

                    {/* Metrics Grid */}
                    <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold truncate opacity-60">{leadLabel}</span>
                            <span className="text-xs font-bold flex items-center gap-1">
                                <Users size={10} className="text-muted-foreground" />
                                {data.stage1.toLocaleString('pt-BR')}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold opacity-60">Ticket Médio</span>
                            <span className="text-xs font-black text-brand-600 dark:text-brand-400">
                                R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold opacity-60">CPA</span>
                            <span className="text-xs font-bold flex items-center gap-1">
                                <DollarSign size={10} className="text-muted-foreground" />
                                {cpa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold opacity-60">Receita</span>
                            <span className="text-xs font-bold">
                                R$ {revenue.toLocaleString('pt-BR', { notation: 'compact' })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pagination Dots */}
            <div className="flex justify-center gap-1.5 mt-4">
                {topCampaigns.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-brand-500' : 'w-1 bg-muted'}`}
                    />
                ))}
            </div>
        </div>
    );
};
