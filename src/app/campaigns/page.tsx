"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { LayoutDashboard, BarChart3, Target, Users, Settings, Bell, Menu, Search, Sun, Moon, LogOut, User as UserIcon, Filter, TrendingUp } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { subDays, format } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { CampaignHierarchyTable } from '@/components/CampaignHierarchyTable';
import { CampaignHierarchy } from '@/types';
import { Sidebar } from "@/components/Sidebar";
import { Select } from "@/components/ui/Select";

import { usePersistentState } from '@/hooks/usePersistentState';

const dateRangeDeserializer = (stored: string) => {
  const parsed = JSON.parse(stored);
  return {
    from: new Date(parsed.from),
    to: new Date(parsed.to),
  };
};

const CampaignsContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Persist Data Source
  const [dataSource, setDataSource] = usePersistentState<'KOMMO' | 'META' | 'HYBRID'>('dashboard_dataSource', 'KOMMO');

  // Persist Date Range
  const [dateRange, setDateRange] = usePersistentState<DateRange>(
    'dashboard_dateRange',
    {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    dateRangeDeserializer
  );

  const [campaigns, setCampaigns] = useState<CampaignHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [integrationConfig, setIntegrationConfig] = useState<{ isActive: boolean, journeyMap: string[] } | null>(null);

  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoalType, setSelectedGoalType] = usePersistentState<'ROAS' | 'CPA' | 'REVENUE'>('dashboard_selectedGoalType', 'ROAS');

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

  // Fetch Accounts
  useEffect(() => {
    if (status === "authenticated") {
      fetchAccounts();
    }
  }, [status]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAvailableAccounts(data);
        if (data.length > 0) {
          setSelectedAccount(data[0]);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated" && selectedAccount) {
      checkIntegrationAndFetch();
    }
  }, [status, session, router, dateRange, dataSource, selectedAccount]);

  const checkIntegrationAndFetch = async () => {
    if (!selectedAccount) return;
    setIsLoading(true);

    // 1. Verificar status da integração Kommo (se necessário para labels ou validação)
    let isKommoActive = false;
    let journeyMap: string[] = [];

    try {
      const res = await fetch(`/api/integrations/kommo?targetAccountId=${selectedAccount.id}`);
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

    // 2. Fetch Data
    try {
      const since = dateRange.from.toISOString();
      const until = dateRange.to.toISOString();
      const sinceLocal = format(dateRange.from, 'yyyy-MM-dd');
      const untilLocal = format(dateRange.to, 'yyyy-MM-dd');

      // Se Kommo inativo e selecionado Kommo, fallback para Meta?
      // Ou mostrar erro? O dashboard faz fallback. Vamos fazer fallback também.
      let effectiveSource = dataSource;
      if (dataSource !== 'META' && !isKommoActive) {
        effectiveSource = 'META';
        setDataSource('META'); // Update UI
      }

      const res = await fetch(`/api/campaigns?source=${effectiveSource}&since=${since}&until=${until}&sinceLocal=${sinceLocal}&untilLocal=${untilLocal}&targetAccountId=${selectedAccount.id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Erro ao buscar campanhas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === "loading") return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!session) return null;

  return (
    <div className="flex h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        availableAccounts={availableAccounts}
        currentAccount={selectedAccount}
        onAccountChange={(accountId) => {
          const acc = availableAccounts.find(a => a.id === accountId);
          if (acc) setSelectedAccount(acc);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30">
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
                placeholder="Buscar campanhas..."
                className="w-full pl-9 pr-4 py-1.5 rounded-full bg-secondary/50 border-none focus:ring-2 focus:ring-brand-500/50 text-sm placeholder-muted-foreground outline-none transition-all text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-muted-foreground hover:text-brand-600 hover:bg-brand-50/10 rounded-full transition-all"
                title="Alternar Tema"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>

            {/* Profile Dropdown */}
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
                      <UserIcon size={16} />
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">




          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Campanhas</h1>
              <p className="text-sm text-muted-foreground">Gerenciamento detalhado de campanhas e anúncios.</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Goal Selector */}
              <div className="w-32">
                <Select
                  options={[
                    { value: 'ROAS', label: 'ROAS' },
                    { value: 'REVENUE', label: 'Receita' },
                    ...(integrationConfig?.journeyMap || []).map((stage, index) => ({
                      value: `CPA_${index}`,
                      label: `CPA - ${stage}`
                    }))
                  ]}
                  value={selectedGoalType}
                  onChange={(val) => setSelectedGoalType(val as any)}
                  placeholder="Meta"
                />
              </div>

              {/* Data Source Selector */}
              {(() => {
                const options = [];

                // 1. Meta (Always first if available)
                if (selectedAccount?.metaAdAccounts?.length > 0) {
                  options.push({ value: 'META', label: 'Meta', icon: <LayoutDashboard size={16} /> });
                }

                // 2. Integrations (Kommo)
                if (integrationConfig?.isActive) {
                  options.push({ value: 'KOMMO', label: 'Kommo', icon: <Filter size={16} /> });
                }

                // 3. Hybrid (If both available)
                if (selectedAccount?.metaAdAccounts?.length > 0 && integrationConfig?.isActive) {
                  options.push({ value: 'HYBRID', label: 'Kommo + Meta', icon: <TrendingUp size={16} /> });
                }

                if (options.length === 0) return null;

                return (
                  <div className="w-48">
                    <Select
                      options={options}
                      value={dataSource}
                      onChange={(val) => {
                        setDataSource(val as any);
                      }}
                      placeholder="Fonte de Dados"
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {
            dataSource === 'HYBRID' ? (
              <>
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Target size={20} className="text-brand-500" />
                    Campanhas Integradas
                  </h2>
                  <CampaignHierarchyTable
                    data={filteredCampaigns.filter(c => !c.isOrphan)}
                    loading={isLoading}
                    journeyLabels={integrationConfig?.journeyMap}
                    dataSource={dataSource}
                    goals={goals}
                    selectedGoalType={selectedGoalType}
                  />
                </div>

                {filteredCampaigns.some(c => c.isOrphan) && (
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                      <Filter size={20} className="text-blue-500" />
                      Campanhas Adicionais (Apenas Meta)
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Estas campanhas foram encontradas no Meta Ads mas não possuem correspondência na integração atual.
                    </p>
                    <CampaignHierarchyTable
                      data={filteredCampaigns.filter(c => c.isOrphan)}
                      loading={isLoading}
                      journeyLabels={undefined} // Meta orphans don't have journey stages from Kommo
                      dataSource="META" // Treat as Meta source for columns
                      goals={goals}
                      selectedGoalType={selectedGoalType}
                    />
                  </div>
                )}
              </>
            ) : (
              <CampaignHierarchyTable
                data={filteredCampaigns}
                loading={isLoading}
                journeyLabels={dataSource === 'META' ? undefined : integrationConfig?.journeyMap}
                dataSource={dataSource}
                goals={goals}
                selectedGoalType={selectedGoalType}
              />
            )
          }
        </div >
      </main >
    </div >
  );
};

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
