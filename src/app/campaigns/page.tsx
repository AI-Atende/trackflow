"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { sortCampaignsRecursively } from '@/utils/campaignSorting';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

import { format, subDays } from 'date-fns';
import { LayoutDashboard, Filter, TrendingUp, Target, Menu, User, LogOut, User as UserIcon, Search, Bell } from "lucide-react";
import { CampaignHierarchy } from '@/types';
import { Sidebar } from "@/components/Sidebar";
import { Select } from "@/components/ui/Select";
import CampaignHierarchyTable from "@/components/CampaignHierarchyTable";
import { AiInsights } from "@/components/AiInsights";
import { ViewManager } from "@/components/ViewManager";
import { Header } from "@/components/Header";
import { usePersistentState } from '@/hooks/usePersistentState';

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

  const [currentColumns, setCurrentColumns] = usePersistentState<string[]>('campaigns_columns', [
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

    // 1.5 Fetch Meta Config if needed (for labels)
    if (dataSource === 'META' || dataSource === 'HYBRID') {
      try {
        const res = await fetch(`/api/integrations/meta/config`);
        if (res.ok) {
          const config = await res.json();
          if (config.journeyMap) {
            if (dataSource === 'META') {
              setIntegrationConfig({ isActive: true, journeyMap: config.journeyMap });
            }
            setMetaJourneyMap(config.journeyMap);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar config Meta:", e);
      }
    }

    // 2. Fetch Data
    try {
      const since = dateRange.from.toISOString();
      const until = dateRange.to.toISOString();
      const sinceLocal = format(dateRange.from, 'yyyy-MM-dd');
      const untilLocal = format(dateRange.to, 'yyyy-MM-dd');

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

  const filteredCampaigns = sortCampaignsRecursively(
    campaigns.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
      <main className="flex-1 flex flex-col h-screen relative overflow-x-hidden">
        {/* Header */}
        <Header
          session={session}
          dateRange={dateRange}
          setDateRange={setDateRange}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSyncSuccess={() => {
            if (selectedAccount) checkIntegrationAndFetch();
          }}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

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

              {/* View Manager */}
              <ViewManager
                dataSource={dataSource}
                availableColumns={[
                  { key: 'name', label: 'Campanha' },
                  { key: 'evaluation', label: 'Avaliação' },
                  { key: 'status', label: 'Status' },
                  { key: 'spend', label: 'Investimento' },
                  { key: 'revenue', label: 'Receita' },
                  { key: 'roas', label: 'ROAS' },
                  { key: 'results', label: 'Resultados' },
                  ...(dataSource !== 'META' ? [{ key: 'ghostLeads', label: 'Leads Fantasmas' }] : []),
                  ...((integrationConfig?.journeyMap || ['Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4', 'Etapa 5']).map((label, i) => ({
                    key: `stage${i + 1}`,
                    label: label
                  })))
                ]}
                currentColumns={currentColumns}
                onColumnsChange={setCurrentColumns}
              />

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
          </div >

          <div className="mb-8">
            <AiInsights campaigns={filteredCampaigns} loading={isLoading} />
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
                    columns={currentColumns}
                    onColumnsReorder={setCurrentColumns}
                    metaResultLabel={metaJourneyMap[metaJourneyMap.length - 1]}
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
                      columns={currentColumns}
                      onColumnsReorder={setCurrentColumns}
                      metaResultLabel={metaJourneyMap[metaJourneyMap.length - 1]}
                    />
                  </div>
                )}
              </>
            ) : (
              <CampaignHierarchyTable
                data={filteredCampaigns}
                loading={isLoading}
                journeyLabels={integrationConfig?.journeyMap}
                dataSource={dataSource}
                goals={goals}
                selectedGoalType={selectedGoalType}
                columns={currentColumns}
                onColumnsReorder={setCurrentColumns}
                metaResultLabel={metaJourneyMap[metaJourneyMap.length - 1]}
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
