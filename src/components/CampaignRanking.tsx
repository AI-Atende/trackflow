import React from 'react';
import { Trophy, TrendingUp, TrendingDown, MousePointer, Users, DollarSign } from 'lucide-react';
import { AdCampaign, CampaignHierarchy } from '../types';

interface CampaignRankingProps {
    campaigns: (AdCampaign | CampaignHierarchy)[];
    loading?: boolean;
}

export const CampaignRanking: React.FC<CampaignRankingProps> = ({ campaigns, loading }) => {
    if (loading) {
        return <div className="h-full w-full bg-card rounded-2xl p-6 border border-border animate-pulse" />;
    }

    // Sort by Conversion Rate of deepest non-zero stage
    // Algorithm: Compare Stage 5 Conv Rate -> Stage 4 Conv Rate -> ... -> Stage 1 Volume
    const topCampaigns = [...campaigns]
        .filter(c => (c.data?.stage1 || 0) > 0 || (c.spend || 0) > 0)
        .sort((a, b) => {
            const getConvRate = (camp: any, stageIndex: number) => {
                const stageVal = camp.data?.[`stage${stageIndex}`] || 0;
                const leads = camp.data?.stage1 || 1; // Avoid division by zero
                return stageIndex === 1 ? stageVal : (stageVal / leads);
            };

            // Iterate backwards from Stage 5 to Stage 1
            for (let i = 5; i >= 1; i--) {
                const rateA = getConvRate(a, i);
                const rateB = getConvRate(b, i);

                // If both have rate > 0 for this deep stage, compare them
                if (rateA > 0 || rateB > 0) {
                    if (Math.abs(rateB - rateA) > 0.0001) return rateB - rateA;
                }
                // If both are 0 (or equal), fall through to shallower stage
            }

            // Fallback to ROAS if no funnel data
            const roasA = a.spend ? (a.revenue || 0) / a.spend : 0;
            const roasB = b.spend ? (b.revenue || 0) / b.spend : 0;
            return roasB - roasA;
        })
        .slice(0, 3);

    return (
        <div className="h-full w-full bg-card rounded-2xl p-6 border border-border shadow-sm glass flex flex-col relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

            <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2 mb-6 relative z-10">
                <div className="p-1.5 bg-brand-500/10 rounded-lg">
                    <Trophy size={18} className="text-brand-500" />
                </div>
                Ranking de Performance
            </h3>

            <div className="flex-1 space-y-3 relative z-10 overflow-y-auto pr-1 custom-scrollbar">
                {topCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm py-8 gap-2">
                        <Trophy size={32} className="text-muted-foreground/30" />
                        <p>Sem dados suficientes para ranking.</p>
                    </div>
                ) : (
                    topCampaigns.map((camp, idx) => {
                        // Safe access for mixed types
                        const data = (camp as any).data || { stage1: 0 };
                        const spend = camp.spend || 0;
                        const revenue = camp.revenue || 0;

                        const roas = spend ? revenue / spend : 0;
                        const cpa = data.stage1 > 0 ? spend / data.stage1 : 0;

                        // Visual Definitions for Ranks
                        let rankStyles = "";
                        let rankIcon = null;
                        let waveColor = "";

                        if (idx === 0) { // Gold
                            rankStyles = "from-amber-500/10 to-yellow-600/10 border-amber-500/20";
                            waveColor = "text-amber-500";
                            rankIcon = <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-amber-400/50">1º</div>;
                        } else if (idx === 1) { // Silver
                            rankStyles = "from-slate-300/10 to-slate-500/10 border-slate-400/20";
                            waveColor = "text-slate-400";
                            rankIcon = <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-slate-400/50">2º</div>;
                        } else { // Bronze
                            rankStyles = "from-orange-300/10 to-orange-600/10 border-orange-500/20";
                            waveColor = "text-orange-400";
                            rankIcon = <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-orange-400/50">3º</div>;
                        }

                        return (
                            <div key={camp.id} className={`relative group p-4 rounded-xl bg-gradient-to-r ${rankStyles} border border-transparent hover:border-border transition-all duration-300 overflow-hidden`}>
                                {/* Wavy Background Effect */}
                                <div className={`absolute bottom-0 left-0 right-0 h-24 opacity-20 pointer-events-none ${waveColor}`}>
                                    <svg viewBox="0 0 1440 320" className="w-full h-full" preserveAspectRatio="none">
                                        <path fill="currentColor" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                                    </svg>
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="shrink-0">
                                            {rankIcon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold text-sm truncate text-foreground" title={camp.name}>
                                                {camp.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {(() => {
                                                    // Determine which metric triggered the ranking to display relevant badge
                                                    let badgeLabel = `ROAS ${roas.toFixed(2)}x`;
                                                    let badgeColor = roas >= 2 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500';

                                                    // Find deepest non-zero stage
                                                    for (let i = 5; i > 1; i--) {
                                                        const val = (camp as any).data?.[`stage${i}`] || 0;
                                                        if (val > 0) {
                                                            const leads = (camp as any).data?.stage1 || 1;
                                                            const rate = (val / leads) * 100;
                                                            badgeLabel = `Conv. Etapa ${i}: ${rate.toFixed(1)}%`;
                                                            badgeColor = 'bg-brand-500/10 text-brand-500';
                                                            break;
                                                        }
                                                    }

                                                    return (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badgeColor}`}>
                                                            {badgeLabel}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads</span>
                                            <span className="text-xs font-semibold flex items-center gap-1 mt-0.5">
                                                <Users size={12} className="text-brand-400" />
                                                {data.stage1}
                                            </span>
                                        </div>
                                        <div className="flex flex-col border-l border-border/50 pl-2">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">CPA</span>
                                            <span className="text-xs font-semibold flex items-center gap-1 mt-0.5">
                                                <DollarSign size={12} className="text-brand-400" />
                                                {cpa.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end border-l border-border/50 pl-2">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita</span>
                                            <span className="text-xs font-bold text-brand-500 mt-0.5">
                                                R$ {(camp.revenue || 0).toLocaleString('pt-BR', { notation: 'compact' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
