"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { sortAlphabetically } from '@/utils/campaignSorting';
import { LayoutDashboard, BarChart3, Target, Users, Settings, Bell, ChevronDown, LogOut, TrendingUp, Calendar, User, Search, RefreshCw, Layers, Menu, X, Moon, Sun, Filter } from "lucide-react";
import { MetricSummary } from '@/types';
import { usePersistentState } from '@/hooks/usePersistentState';
import { Sidebar } from "@/components/Sidebar";
import { Select } from "@/components/ui/Select";

import { Header } from "@/components/Header";
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { format, subDays } from 'date-fns';
import { MetricCard } from '@/components/MetricCard';
import { FunnelChart } from '@/components/FunnelChart';
import { EvolutionChart } from '@/components/EvolutionChart';
import { CampaignRanking } from '@/components/CampaignRanking';
import { CampaignSidebar } from '@/components/CampaignSidebar';

type DateRange = {
    from: Date;
    to: Date;
};



const dateRangeDeserializer = (stored: string) => {
    const parsed = JSON.parse(stored);
    return {
        from: new Date(parsed.from),
        to: new Date(parsed.to),
    };
};

const HomeContent = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const [campaigns, setCampaigns] = useState<any[]>([]);
    // const [metrics, setMetrics] = useState<any[]>([]); // Derived state now
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCampaignSidebarOpen, setIsCampaignSidebarOpen] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [availableDataSources, setAvailableDataSources] = useState<string[]>([]);
    const [journeyLabels, setJourneyLabels] = useState<string[]>([]);

    const [integrationConfig, setIntegrationConfig] = useState<{ isActive: boolean, journeyMap: string[] } | null>(null);
    const [evolutionData, setEvolutionData] = useState<any[]>([]); // New State for Evolution Data



    const [goals, setGoals] = useState<any[]>([]);
    const [selectedGoalType, setSelectedGoalType] = usePersistentState<'ROAS' | 'CPA' | 'REVENUE'>('dashboard_selectedGoalType', 'ROAS');

    const [currentColumns, setCurrentColumns] = usePersistentState<string[]>('dashboard_columns', [
        'name', 'evaluation', 'status', 'spend', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'revenue', 'roas', 'results'
    ]);

    const [metaJourneyMap, setMetaJourneyMap] = useState<string[]>([]);

    // Fetch Goals
    useEffect(() => {
        const loadGoals = () => {
            if (status === "authenticated") {
                fetch('/api/goals')
                    .then(res => {
                        if (!res.ok) throw new Error("Falha ao buscar metas");
                        return res.json();
                    })
                    .then(data => {
                        if (Array.isArray(data)) {
                            setGoals(data);
                        } else {
                            console.error("Metas retornaram formato inválido:", data);
                            setGoals([]);
                        }
                    })
                    .catch(err => console.error("Erro ao buscar metas:", err));
            }
        };

        loadGoals();

        window.addEventListener('focus', loadGoals);
        return () => window.removeEventListener('focus', loadGoals);
    }, [status]);

    // Persist Data Source
    const [dataSource, setDataSource] = usePersistentState<string>('dashboard_dataSource', 'KOMMO');

    // Persist Date Range
    const [dateRange, setDateRange] = usePersistentState<DateRange>(
        'dashboard_dateRange',
        {
            from: subDays(new Date(), 30),
            to: new Date(),
        },
        dateRangeDeserializer
    );

    const toRoman = (num: number): string => {
        const map: { [key: number]: string } = {
            1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
            6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
            11: 'XI', 12: 'XII'
        };
        return map[num] || num.toString();
    };

    const fetchAvailableDataSources = async () => {
        try {
            const res = await fetch('/api/dashboard/datasources');
            if (res.ok) {
                const sources = await res.json();
                setAvailableDataSources(sources);
                // If current dataSource is not available, switch to first available
                if (sources.length > 0 && !sources.includes(dataSource)) {
                    setDataSource(sources[0]);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar fontes de dados:", error);
        }
    };

    const fetchEvolutionData = async () => {
        if (!selectedAccount) return;
        try {
            // Always fetch 30 days to allow client-side filtering
            const res = await fetch(`/api/dashboard/evolution?days=30&dataSource=${dataSource}`);
            if (res.ok) {
                const data = await res.json();
                setEvolutionData(data);
            }
        } catch (error) {
            console.error("Erro ao buscar dados de evolução:", error);
        }
    };

    const fetchDashboardData = async () => {
        if (!selectedAccount) return;
        setIsLoadingData(true);
        try {
            const since = dateRange.from.toISOString();
            const until = dateRange.to.toISOString();

            const res = await fetch(`/api/dashboard/data?since=${since}&until=${until}&dataSource=${dataSource}`);
            if (res.ok) {
                const data = await res.json();
                const campaigns = data.campaigns || [];
                const labels = data.labels || [];

                setCampaigns(campaigns);
                setJourneyLabels(labels);

                setCampaigns(campaigns);
                setJourneyLabels(labels);

                // Auto-select removed to allow "All" view by default
                // if (campaigns.length > 0 && !selectedCampaignId) {
                //    setSelectedCampaignId(campaigns[0].id);
                // }

                // Metrics now derived in useMemo
                // setMetrics(baseMetrics);

                // Update integration config for journey map usage in other components
                setIntegrationConfig({ isActive: true, journeyMap: labels });
            }
        } catch (error) {
            console.error("Erro ao buscar dados do dashboard:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated") {
            fetchAvailableDataSources();
        }
    }, [status]);

    useEffect(() => {
        if (status === "authenticated" && selectedAccount) {
            fetchDashboardData();
            fetchEvolutionData();
        }
    }, [status, session, selectedAccount, dateRange, dataSource]);

    useEffect(() => {
        if (searchParams.get('integration_success') === 'true') {
            showToast("Integração concluída! Dados capturados com sucesso.", "success");
            router.replace('/');
        }
    }, [searchParams, router, showToast]);

    // Fetch Accounts
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        } else if (status === "authenticated") {
            // Client-side enforcement of profile completion
            if (session?.user && !session.user.isProfileComplete) {
                console.log("[DASHBOARD] Profile incomplete, forcing redirect...");
                window.location.href = "/auth/complete-profile";
                return;
            }

            fetch('/api/accounts')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setAvailableAccounts(data);
                        // Default to own account if not set or if current selection is invalid
                        if (!selectedAccount || !data.find(a => a.id === selectedAccount.id)) {
                            const ownAccount = data.find(a => a.id === session.user.clientId);
                            setSelectedAccount(ownAccount || data[0]);
                        }
                    }
                })
                .catch(err => console.error("Erro ao buscar contas:", err));
        }
    }, [status, session, router]);

    // Removed redundant useEffects that were replaced by the single fetchDashboardData effect
    // Keeping only the account fetching logic above



    // Derived Metrics Calculation
    const metrics = React.useMemo(() => {
        if (!campaigns.length || !journeyLabels.length) return [];

        // Determine which campaigns to aggregate
        let targetData = campaigns;
        if (selectedCampaignId) {
            const selected = campaigns.find(c => c.id === selectedCampaignId);
            if (selected) {
                targetData = [selected];
            } else {
                // If not found in top level, try to find in children (recursive if needed, but 1 level deep is standard for adsets)
                // For now, if we can't find it, we fallback to all or empty? 
                // Let's fallback to all to avoid broken state, or maybe filter children.
                // Assuming flat list or top-level id for now.
                // Note: If TrackingTable filters hierarchy, selectedID might be a child.
                // Let's try to find it in 2nd level.
                const childCamp = campaigns.flatMap(c => c.children || []).find(c => c.id === selectedCampaignId);
                if (childCamp) targetData = [childCamp];
            }
        }

        const totalSpend = targetData.reduce((acc: number, c: any) => acc + (c.spend || 0), 0);
        const totalRevenue = targetData.reduce((acc: number, c: any) => acc + (c.revenue || 0), 0);
        const totalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        const stageTotals = [
            targetData.reduce((acc: number, c: any) => acc + (c.data?.stage1 || 0), 0),
            targetData.reduce((acc: number, c: any) => acc + (c.data?.stage2 || 0), 0),
            targetData.reduce((acc: number, c: any) => acc + (c.data?.stage3 || 0), 0),
            targetData.reduce((acc: number, c: any) => acc + (c.data?.stage4 || 0), 0),
            targetData.reduce((acc: number, c: any) => acc + (c.data?.stage5 || 0), 0),
        ];

        const baseMetrics: MetricSummary[] = journeyLabels.map((label: string, index: number) => {
            const value = stageTotals[index];
            const firstStageValue = stageTotals[0];
            const percentage = firstStageValue > 0 ? (value / firstStageValue) * 100 : 0;

            return {
                label: label || `Etapa ${index + 1}`,
                value: value.toLocaleString('pt-BR'),
                percentage: index === 0 ? "100%" : `${percentage.toFixed(2)}%`,
                trend: "neutral",
                icon: ["Eye", "MousePointer", "Users", "Target", "Award"][index] || "Activity"
            };
        });

        baseMetrics.push({
            label: "Investimento Total",
            value: `R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            percentage: "",
            trend: "neutral",
            icon: "DollarSign"
        });

        baseMetrics.push({
            label: "Receita Total",
            value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            percentage: "",
            trend: "neutral",
            icon: "DollarSign"
        });

        baseMetrics.push({
            label: "ROAS Geral",
            value: `${totalROAS.toFixed(2)}x`,
            percentage: "",
            trend: "neutral",
            icon: "TrendingUp"
        });

        return baseMetrics;
    }, [campaigns, selectedCampaignId, journeyLabels]);



    const filteredCampaigns = campaigns
        .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .sort(sortAlphabetically);

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    if (!session) {
        return null;
    }

    // Guard: Do not render dashboard if profile is incomplete
    if (session.user && !session.user.isProfileComplete) {
        return <div className="flex items-center justify-center min-h-screen">Redirecionando para completar perfil...</div>;
    }

    return (
        <div className="flex h-screen bg-background text-foreground font-sans transition-colors duration-300">
            {/* Sidebar Component */}
            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                currentAccount={selectedAccount || { id: session.user.clientId, name: session.user.name, image: session.user.image }}
                availableAccounts={availableAccounts.length > 0 ? availableAccounts : [{ id: session.user.clientId, name: session.user.name, image: session.user.image }]}
                onAccountChange={(id) => {
                    const account = availableAccounts.find(a => a.id === id);
                    if (account) setSelectedAccount(account);
                }}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen relative overflow-x-hidden">
                {/* Header */}
                <Header
                    session={session}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    onSyncSuccess={() => {
                        if (selectedAccount) fetchDashboardData();
                    }}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                />

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
                    {/* Strategic Dashboard Layout */}

                    {/* 1. KPI Cards Row */}
                    <section className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Geral</h1>
                                <p className="text-sm text-muted-foreground">Visão estratégica e saúde do negócio.</p>
                            </div>

                            {/* Data Source Selector */}
                            <div className="w-48">
                                <Select
                                    options={availableDataSources.map(ds => {
                                        let label = ds;
                                        let icon = <LayoutDashboard size={16} />;
                                        if (ds === 'KOMMO') { label = 'Kommo'; icon = <Filter size={16} />; }
                                        else if (ds === 'META') { label = 'Meta Ads'; icon = <LayoutDashboard size={16} />; }
                                        else if (ds === 'GOOGLE') { label = 'Google Ads'; icon = <BarChart3 size={16} />; }
                                        else if (ds === 'HYBRID_META') { label = 'Kommo + Meta'; icon = <TrendingUp size={16} />; }
                                        else if (ds === 'HYBRID_GOOGLE') { label = 'Kommo + Google'; icon = <TrendingUp size={16} />; }
                                        else if (ds === 'HYBRID_ALL') { label = 'Tudo Integrado'; icon = <Layers size={16} />; }

                                        return { value: ds, label, icon };
                                    })}
                                    value={dataSource}
                                    onChange={(val) => {
                                        setDataSource(val as any);
                                        setSelectedCampaignId(null);
                                    }}
                                    placeholder="Fonte de Dados"
                                />
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {isLoadingData ? (
                                [...Array(4)].map((_, i) => (
                                    <MetricCard key={i} metric={{ label: '', value: '', percentage: '', trend: 'neutral' }} loading={true} />
                                ))
                            ) : (
                                metrics.map((metric, index) => (
                                    <MetricCard key={index} metric={metric} />
                                ))
                            )}
                            {metrics.length === 0 && !isLoadingData && (
                                <div className="col-span-4 text-center py-8 text-muted-foreground">
                                    Nenhuma métrica disponível. Vincule uma conta de anúncios e sincronize os dados.
                                </div>
                            )}
                        </div>
                    </section>


                    {/* 2. Performance & Insights Row */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Ranking takes 1/3 but is full width on mobile */}
                        <div className="lg:col-span-1 min-w-0">
                            <CampaignRanking campaigns={campaigns} loading={isLoadingData} />
                        </div>

                        {/* Evolution takes 2/3 */}
                        <div className="lg:col-span-2 min-w-0 h-[400px]">
                            <EvolutionChart
                                data={evolutionData}
                                loading={isLoadingData}
                            />
                        </div>
                    </section>

                    {/* 3. Operational Analysis Row */}
                    <section className="w-full h-[400px]">
                        <FunnelChart
                            data={filteredCampaigns}
                            selectedId={selectedCampaignId}
                            journeyLabels={integrationConfig?.journeyMap}
                            loading={isLoadingData}
                        />
                    </section>
                </div>

                {/* Floating Campaign Sidebar */}
                <CampaignSidebar
                    campaigns={campaigns}
                    selectedId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                    isOpen={isCampaignSidebarOpen}
                    setIsOpen={setIsCampaignSidebarOpen}
                />
            </main >
        </div >
    );
};

const Home = () => {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}>
            <HomeContent />
        </Suspense>
    );
};

export default Home;
