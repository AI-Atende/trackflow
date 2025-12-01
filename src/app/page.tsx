"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { LayoutDashboard, BarChart3, Target, Users, Settings, Bell, ChevronDown, LogOut, TrendingUp, Calendar, User, Search, RefreshCw, Layers, Menu, X, Moon, Sun } from "lucide-react";
import { STAGE_DESCRIPTIONS, STAGE_COLORS } from '@/constants';
import { MetricCard } from '@/components/MetricCard';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { subDays, format } from 'date-fns';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrackingTable } from '@/components/TrackingTable';
import { FunnelChart } from '@/components/FunnelChart';
import { AiInsights } from '@/components/AiInsights';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';

const SyncButton = ({ session, onSyncSuccess, dateRange }: { session: any, onSyncSuccess?: () => void, dateRange: DateRange }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const { showToast } = useToast();

    const handleSync = async () => {
        if (!session?.user?.metaAdAccount?.adAccountId) {
            showToast("Nenhuma conta de anúncios vinculada.", "error");
            return;
        }

        setIsSyncing(true);
        try {
            const since = format(dateRange.from, 'yyyy-MM-dd');
            const until = format(dateRange.to, 'yyyy-MM-dd');

            const res = await fetch(`/api/meta/${session.user.metaAdAccount.adAccountId}/sync-daily`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ since, until }),
            });

            if (res.ok) {
                showToast("Sincronização iniciada com sucesso!", "success");
                if (onSyncSuccess) onSyncSuccess();
            } else {
                const data = await res.json();
                showToast(`Erro ao sincronizar: ${data.error || "Erro desconhecido"}`, "error");
            }
        } catch (error) {
            console.error("Erro na sincronização:", error);
            showToast("Erro ao conectar com o servidor.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all relative ${isSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Forçar Sincronização"
        >
            <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
        </button>
    );
};

const HomeContent = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [integrationConfig, setIntegrationConfig] = useState<{ isActive: boolean, journeyMap: string[] } | null>(null);
    const [dataSource, setDataSource] = useState<'KOMMO' | 'META' | 'HYBRID'>('KOMMO');

    // Estado do filtro de data (Padrão: Últimos 30 dias)
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    useEffect(() => {
        if (searchParams.get('integration_success') === 'true') {
            showToast("Integração concluída! Dados capturados com sucesso.", "success");
            router.replace('/');
        }
    }, [searchParams, router, showToast]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        } else if (status === "authenticated") {
            checkIntegrationAndFetch();
        }
    }, [status, session, router, dateRange, dataSource]); // Re-fetch when dataSource changes

    const checkIntegrationAndFetch = async () => {
        setIsLoadingData(true);

        // 1. Verificar status da integração Kommo
        let isKommoActive = false;
        let journeyMap: string[] = [];

        try {
            const res = await fetch('/api/integrations/kommo');
            if (res.ok) {
                const config = await res.json();
                if (config.isActive) {
                    isKommoActive = true;
                    journeyMap = config.journeyMap;
                    setIntegrationConfig({ isActive: true, journeyMap: config.journeyMap });
                } else {
                    setIntegrationConfig(null);
                }
            }
        } catch (e) {
            console.error("Erro ao verificar integração:", e);
            setIntegrationConfig(null);
        }

        // 2. Decidir qual dado buscar
        if (dataSource === 'META') {
            fetchMetaDashboardData();
        } else if (isKommoActive) {
            fetchKommoDashboardData(journeyMap);
        } else {
            // Se Kommo inativo e selecionado Kommo/Hybrid -> Fallback para Meta
            setDataSource('META');
            setSelectedCampaignId(null);
            return; // O useEffect vai rodar novamente com dataSource='META'
        }
    };

    const fetchKommoDashboardData = async (journeyMap: string[]) => {
        setIsLoadingData(true);
        try {
            const since = format(dateRange.from, 'yyyy-MM-dd');
            const until = format(dateRange.to, 'yyyy-MM-dd');

            const res = await fetch(`/api/integrations/kommo/data?since=${since}&until=${until}`);
            if (res.ok) {
                const data = await res.json();
                const campaigns = data.campaigns;

                setCampaigns(campaigns);
                if (campaigns.length > 0 && !selectedCampaignId) {
                    setSelectedCampaignId(campaigns[0].id);
                }

                const totalStage1 = campaigns.reduce((acc: number, c: any) => acc + c.data.stage1, 0);
                const totalStage2 = campaigns.reduce((acc: number, c: any) => acc + c.data.stage2, 0);
                const totalStage3 = campaigns.reduce((acc: number, c: any) => acc + c.data.stage3, 0);
                const totalSpend = campaigns.reduce((acc: number, c: any) => acc + (c.spend || 0), 0);

                const totalRevenue = campaigns.reduce((acc: number, c: any) => acc + (c.data.stage5 * 100), 0);
                const totalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

                const baseMetrics = [
                    {
                        label: journeyMap[0] || "Etapa 1",
                        value: totalStage1.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "Users"
                    },
                    {
                        label: journeyMap[1] || "Etapa 2",
                        value: totalStage2.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "Filter"
                    },
                    {
                        label: journeyMap[2] || "Etapa 3",
                        value: totalStage3.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "CheckCircle"
                    },
                    {
                        label: "Receita Total",
                        value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        percentage: "+0%",
                        trend: "up",
                        icon: "DollarSign"
                    }
                ];

                if (dataSource === 'HYBRID') {
                    // Adicionar Investimento e ROAS no início
                    baseMetrics.unshift({
                        label: "ROAS Geral",
                        value: `${totalROAS.toFixed(2)}x`,
                        percentage: "+0%",
                        trend: totalROAS >= 1 ? "up" : "down",
                        icon: "TrendingUp"
                    });
                    baseMetrics.unshift({
                        label: "Investimento Total",
                        value: `R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        percentage: "+0%",
                        trend: "up",
                        icon: "DollarSign"
                    });
                }

                setMetrics(baseMetrics);
            }
        } catch (error) {
            console.error("Erro ao buscar dados Kommo:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const fetchMetaDashboardData = async () => {
        if (!session?.user?.metaAdAccount?.adAccountId) {
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        try {
            const since = format(dateRange.from, 'yyyy-MM-dd');
            const until = format(dateRange.to, 'yyyy-MM-dd');

            const res = await fetch(`/api/meta/${session.user.metaAdAccount.adAccountId}/report/campaigns?since=${since}&until=${until}`);
            if (res.ok) {
                const data = await res.json();
                const formattedCampaigns = data.campaigns.map((c: any) => ({
                    id: c.campaignId,
                    name: c.campaignName,
                    status: "active",
                    data: {
                        stage1: c.totalImpressions,
                        stage2: c.totalClicks,
                        stage3: c.totalLeads,
                        stage4: 0,
                        stage5: 0,
                    },
                    spend: c.totalSpend,
                    roas: 0
                }));

                setCampaigns(formattedCampaigns);
                if (formattedCampaigns.length > 0 && !selectedCampaignId) {
                    setSelectedCampaignId(formattedCampaigns[0].id);
                }

                const totalSpend = formattedCampaigns.reduce((acc: number, c: any) => acc + c.spend, 0);
                const totalImpressions = formattedCampaigns.reduce((acc: number, c: any) => acc + c.data.stage1, 0);
                const totalClicks = formattedCampaigns.reduce((acc: number, c: any) => acc + c.data.stage2, 0);
                const totalLeads = formattedCampaigns.reduce((acc: number, c: any) => acc + c.data.stage3, 0);

                const baseMetrics = [
                    {
                        label: "Investimento Total",
                        value: `R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        percentage: "+0%",
                        trend: "up",
                        icon: "DollarSign"
                    },
                    {
                        label: "Impressões",
                        value: totalImpressions.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "Eye"
                    },
                    {
                        label: "Cliques",
                        value: totalClicks.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "MousePointer"
                    },
                    {
                        label: "Leads",
                        value: totalLeads.toLocaleString('pt-BR'),
                        percentage: "+0%",
                        trend: "up",
                        icon: "Users"
                    }
                ];

                setMetrics(baseMetrics);
            }
        } catch (error) {
            console.error("Erro ao buscar dados Meta:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    if (!session) {
        return null;
    }

    return (
        <div className="flex h-screen bg-background text-foreground font-sans transition-colors duration-300">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border text-card-foreground flex flex-col shadow-xl transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
                            <LayoutDashboard className="text-white" size={20} />
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">TrackFlow</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2 mt-4">
                        Analytics
                    </div>

                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-brand-600/10 text-brand-400 rounded-lg border border-brand-600/20 transition-all group">
                        <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Dashboard Geral</span>
                    </a>

                    <a href="/campaigns" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Target size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Campanhas</span>
                    </a>

                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Users size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Públicos</span>
                    </a>

                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2 mt-8">
                        Configurações
                    </div>

                    <a href="/integrations" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Settings size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Integrações</span>
                    </a>

                    {session.user.role === "ADMIN" && (
                        <a
                            href="/admin/users"
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group mt-2"
                        >
                            <Users size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Gestão de Usuários</span>
                        </a>
                    )}
                </nav>
            </aside>

            {/* Desktop Sidebar */}
            <aside className="w-64 bg-card border-r border-border text-card-foreground flex flex-col shadow-xl z-20 hidden md:flex glass">
                <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <LayoutDashboard className="text-white" size={20} />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">TrackFlow</span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2 mt-4">
                        Analytics
                    </div>

                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-brand-600/10 text-brand-400 rounded-lg border border-brand-600/20 transition-all group">
                        <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Dashboard Geral</span>
                    </a>

                    <a href="/campaigns" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Target size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Campanhas</span>
                    </a>

                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Users size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Públicos</span>
                    </a>

                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2 mt-8">
                        Configurações
                    </div>

                    <a href="/integrations" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
                        <Settings size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Integrações</span>
                    </a>

                    {session.user.role === "ADMIN" && (
                        <a
                            href="/admin/users"
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group mt-2"
                        >
                            <Users size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Gestão de Usuários</span>
                        </a>
                    )}
                </nav>

                <div className="p-4 border-t border-border">
                    <div className="bg-card/50 rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-brand-500/20 rounded-lg">
                                <TrendingUp size={16} className="text-brand-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Meta Diária</p>
                                <p className="text-sm font-bold text-foreground">85% Atingida</p>
                            </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-500 h-1.5 rounded-full w-[85%] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen relative">
                {/* Header */}
                <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <DateRangePicker date={dateRange} setDate={setDateRange} />
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden sm:block relative max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full pl-9 pr-4 py-1.5 rounded-full bg-secondary/50 border-none focus:ring-2 focus:ring-brand-500/50 text-sm placeholder-muted-foreground outline-none transition-all text-foreground"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <SyncButton session={session} onSyncSuccess={checkIntegrationAndFetch} dateRange={dateRange} />
                            <button className="p-2 text-muted-foreground hover:text-brand-600 hover:bg-brand-50/10 rounded-full transition-all relative">
                                <Bell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background"></span>
                            </button>

                            <button
                                onClick={toggleTheme}
                                className="p-2 text-muted-foreground hover:text-brand-600 hover:bg-brand-50/10 rounded-full transition-all"
                                title="Alternar Tema"
                            >
                                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                        </div>

                        <div
                            className="relative"
                            onMouseEnter={() => setIsProfileMenuOpen(true)}
                            onMouseLeave={() => setIsProfileMenuOpen(false)}
                        >
                            <div className="flex items-center gap-3 cursor-pointer py-2">
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-semibold text-foreground">{session.user.name}</p>
                                    <p className="text-xs text-muted-foreground">{session.user.role === 'ADMIN' ? 'Administrador' : 'Membro'}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-secondary border-2 border-border shadow-sm overflow-hidden">
                                    {session.user.image ? (
                                        <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-brand-500/10 text-brand-500 font-bold">
                                            {session.user.name?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hover Dropdown */}
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full w-64 bg-popover text-popover-foreground rounded-xl shadow-xl border border-border overflow-hidden transition-all transform origin-top-right z-50">
                                    <div className="p-4 border-b border-border bg-accent/50">
                                        <p className="font-semibold">{session.user.name}</p>
                                        <p className="text-xs text-muted-foreground break-all">{session.user.email}</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => router.push('/profile')}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                                        >
                                            <User size={16} />
                                            Editar Perfil
                                        </button>
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/auth/login' })}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        >
                                            <LogOut size={16} />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">

                    {/* Hero Section: Data Source & Metrics */}
                    <section className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">Visão geral do desempenho das suas campanhas.</p>
                            </div>

                            {/* Data Source Selector - Hero Position */}
                            {integrationConfig?.isActive && (
                                <div className="flex items-center bg-secondary/50 rounded-lg p-1 self-start md:self-auto border border-border glass">
                                    <button
                                        onClick={() => { setDataSource('KOMMO'); setSelectedCampaignId(null); }}
                                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'KOMMO' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                    >
                                        Kommo
                                    </button>
                                    <button
                                        onClick={() => { setDataSource('META'); setSelectedCampaignId(null); }}
                                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'META' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                    >
                                        Meta
                                    </button>
                                    <button
                                        onClick={() => { setDataSource('HYBRID'); setSelectedCampaignId(null); }}
                                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'HYBRID' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                    >
                                        Kommo + Meta
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                    {/* Middle Section: Chart & AI */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <FunnelChart
                                data={filteredCampaigns}
                                selectedId={selectedCampaignId}
                                journeyLabels={dataSource === 'META' ? undefined : integrationConfig?.journeyMap}
                                loading={isLoadingData}
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <AiInsights campaigns={filteredCampaigns} loading={isLoadingData} />
                        </div>
                    </section>

                    {/* Main Table */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-foreground">Rastreamento de Campanhas</h2>
                            <div className="flex gap-2">
                                {/* Legenda dinâmica */}
                                {(dataSource === 'META' ? ["Impressões", "Cliques", "Leads", "-", "-"] : (integrationConfig?.journeyMap || ["Impressões / Alcance", "Cliques / Interesse", "Leads / Cadastro", "Checkout Iniciado", "Compra Realizada"])).map((label, idx) => (
                                    <div
                                        key={idx}
                                        className={`hidden md:flex items-center px-3 py-1 rounded-lg border ${idx === 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                            idx === 1 ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" :
                                                idx === 2 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                                    idx === 3 ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                                        "bg-red-500/10 text-red-500 border-red-500/20"
                                            }`}
                                    >
                                        <span className="text-xs font-bold mr-2 opacity-75">{['I', 'II', 'III', 'IV', 'V'][idx]}</span>
                                        <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <TrackingTable
                            data={filteredCampaigns}
                            onSelect={setSelectedCampaignId}
                            selectedId={selectedCampaignId}
                            journeyLabels={dataSource === 'META' ? undefined : integrationConfig?.journeyMap}
                            dataSource={dataSource}
                            loading={isLoadingData}
                        />
                    </section>

                </div>
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
