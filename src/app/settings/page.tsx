"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Target, DollarSign, TrendingUp, Layers } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { Sidebar } from "@/components/Sidebar";

interface Goal {
  type: 'REVENUE' | 'ROAS' | 'CPA';
  stageIndex?: number | null;
  value: number;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [journeyMap, setJourneyMap] = useState<string[]>([]);
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);

  // Default Goals
  const defaultGoals = {
    ROAS: 5.0,
    REVENUE: 10000.0,
    CPA: 50.0 // Default for all stages if not set
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Integration Config (for Journey Map)
      const accountsRes = await fetch('/api/accounts');
      const accounts = await accountsRes.json();
      const currentAccount = accounts.find((a: any) => a.id === session?.user?.clientId);

      if (currentAccount) {
        const integrationRes = await fetch(`/api/integrations/kommo?targetAccountId=${currentAccount.id}`);
        if (integrationRes.ok) {
          const config = await integrationRes.json();
          if (config.isActive) {
            setActiveIntegration('KOMMO');
            setJourneyMap(config.journeyMap || []);
          }
        }
      }

      // 2. Fetch User Goals
      const goalsRes = await fetch('/api/goals');
      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setGoals(data);
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
      showToast("Erro ao carregar configurações.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getGoalValue = (type: 'REVENUE' | 'ROAS' | 'CPA', stageIndex?: number) => {
    const goal = goals.find(g => g.type === type && (stageIndex === undefined || g.stageIndex === stageIndex));
    return goal ? goal.value : (type === 'CPA' ? defaultGoals.CPA : defaultGoals[type]);
  };

  const handleGoalChange = (type: 'REVENUE' | 'ROAS' | 'CPA', value: string, stageIndex?: number) => {
    // Allow empty string for better typing experience
    if (value === '') {
      // We can't store empty string in number type, so we might need a local state or just handle it as 0 or keep previous.
      // Better approach: Update state with 0 or handle it in the input.
      // For now, let's parse.
    }

    const numValue = parseFloat(value);
    // if (isNaN(numValue)) return; // Allow 0 or empty?

    setGoals(prev => {
      const existingIndex = prev.findIndex(g => g.type === type && g.stageIndex === stageIndex);
      if (existingIndex >= 0) {
        const newGoals = [...prev];
        newGoals[existingIndex] = { ...newGoals[existingIndex], value: isNaN(numValue) ? 0 : numValue };
        return newGoals;
      } else {
        return [...prev, { type, value: isNaN(numValue) ? 0 : numValue, stageIndex: stageIndex ?? null }];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals }),
      });

      if (res.ok) {
        showToast("Metas atualizadas com sucesso!", "success");
      } else {
        showToast("Erro ao salvar metas.", "error");
      }
    } catch (error) {
      console.error("Error saving goals:", error);
      showToast("Erro ao salvar metas.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading" || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentAccount={{ id: session?.user?.clientId || '', name: session?.user?.name || '', image: session?.user?.image }}
        availableAccounts={[]} // Not needed for settings context usually, or fetch if needed
        onAccountChange={() => { }}
      />

      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-4xl mx-auto space-y-8">

            {/* General Goals Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Target className="text-brand-500" size={24} />
                <h2 className="text-lg font-bold text-foreground">Metas Gerais</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp size={16} /> Meta de ROAS
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={getGoalValue('ROAS')}
                      onChange={(e) => handleGoalChange('ROAS', e.target.value)}
                      className="w-full pl-4 pr-12 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-2.5 text-muted-foreground font-bold">x</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Retorno sobre investimento desejado.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign size={16} /> Meta de Receita
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-muted-foreground font-bold">R$</span>
                    <input
                      type="number"
                      step="100"
                      value={getGoalValue('REVENUE')}
                      onChange={(e) => handleGoalChange('REVENUE', e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Valor planejado para receita total.</p>
                </div>
              </div>
            </section>

            {/* Journey Stage Goals Section */}
            {activeIntegration && journeyMap.length > 0 && (
              <section className="space-y-4 pt-6">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Layers className="text-blue-500" size={24} />
                  <h2 className="text-lg font-bold text-foreground">Metas de Custo por Etapa (CPA)</h2>
                </div>
                <p className="text-sm text-muted-foreground">Defina o custo máximo desejado para cada etapa do funil.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {journeyMap.map((stage, index) => (
                    <div key={index} className="space-y-2">
                      <label className="text-sm font-medium text-foreground truncate block" title={stage}>
                        Custo - {stage}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-2.5 text-muted-foreground font-bold">R$</span>
                        <input
                          type="number"
                          step="1"
                          value={getGoalValue('CPA', index)}
                          onChange={(e) => handleGoalChange('CPA', e.target.value, index)}
                          className="w-full pl-12 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="pt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={20} />}
                {isSaving ? "Salvando..." : "Salvar Configurações"}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
