"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { LayoutDashboard, BarChart3, Target, Users, Settings, Bell, Menu, Search, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { subDays, format } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { CampaignHierarchyTable } from '@/components/CampaignHierarchyTable';
import { CampaignHierarchy } from '@/types';

const CampaignsContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [dataSource, setDataSource] = useState<'KOMMO' | 'META' | 'HYBRID'>('KOMMO');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [campaigns, setCampaigns] = useState<CampaignHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [integrationConfig, setIntegrationConfig] = useState<{ isActive: boolean, journeyMap: string[] } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      checkIntegrationAndFetch();
    }
  }, [status, session, router, dateRange, dataSource]);

  const checkIntegrationAndFetch = async () => {
    setIsLoading(true);

    // 1. Verificar status da integração Kommo (se necessário para labels ou validação)
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

    // 2. Fetch Data
    try {
      const since = format(dateRange.from, 'yyyy-MM-dd');
      const until = format(dateRange.to, 'yyyy-MM-dd');

      // Se Kommo inativo e selecionado Kommo, fallback para Meta?
      // Ou mostrar erro? O dashboard faz fallback. Vamos fazer fallback também.
      let effectiveSource = dataSource;
      if (dataSource !== 'META' && !isKommoActive) {
        effectiveSource = 'META';
        setDataSource('META'); // Update UI
      }

      const res = await fetch(`/api/campaigns?source=${effectiveSource}&since=${since}&until=${until}`);
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

      {/* Sidebar (Duplicated from page.tsx - ideally should be a component) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border text-card-foreground flex flex-col shadow-xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-border flex items-center justify-between md:justify-start md:gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <LayoutDashboard className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">TrackFlow</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <Menu size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2 mt-4">
            Analytics
          </div>

          <a href="/" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all group">
            <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">Dashboard Geral</span>
          </a>

          <a href="/campaigns" className="flex items-center gap-3 px-3 py-2.5 bg-brand-600/10 text-brand-400 rounded-lg border border-brand-600/20 transition-all group">
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Campanhas</h1>
              <p className="text-sm text-muted-foreground">Gerenciamento detalhado de campanhas e anúncios.</p>
            </div>

            {/* Data Source Selector */}
            {integrationConfig?.isActive && (
              <div className="flex items-center bg-secondary/50 rounded-lg p-1 self-start md:self-auto border border-border glass">
                <button
                  onClick={() => setDataSource('KOMMO')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'KOMMO' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                >
                  Kommo
                </button>
                <button
                  onClick={() => setDataSource('META')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'META' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                >
                  Meta
                </button>
                <button
                  onClick={() => setDataSource('HYBRID')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'HYBRID' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                >
                  Kommo + Meta
                </button>
              </div>
            )}
          </div>

          <CampaignHierarchyTable
            data={filteredCampaigns}
            loading={isLoading}
            journeyLabels={dataSource === 'META' ? undefined : integrationConfig?.journeyMap}
          />
        </div>
      </main>
    </div>
  );
};

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
