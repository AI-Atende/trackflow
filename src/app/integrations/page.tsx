"use client";

import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowLeft, Power, RotateCcw, Link, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

export default function IntegrationsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado do formulário
  const [isActive, setIsActive] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [journeyStages, setJourneyStages] = useState<string[]>(['Criado', 'Qualificado', 'Venda']);
  const [newStage, setNewStage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/integrations/kommo');
      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          setIsActive(data.isActive);
          setSubdomain(data.config?.subdomain || '');
          setJourneyStages(data.journeyMap || ['Criado', 'Qualificado', 'Venda']);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      showToast("Erro ao carregar configurações.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Salvar Configuração
      const res = await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive,
          subdomain,
          journeyMap: journeyStages
        })
      });

      if (!res.ok) throw new Error('Falha ao salvar configuração');

      // 2. Buscar dados iniciais (Validação e Cache)
      const today = new Date().toISOString().split('T')[0];
      const dataRes = await fetch(`/api/integrations/kommo/data?since=${today}&until=${today}`);

      if (!dataRes.ok) {
        console.warn("Configuração salva, mas falha ao testar conexão de dados.");
        showToast("Configuração salva, mas houve um erro ao testar a conexão.", "error");
      }

      // 3. Redirecionar com sucesso
      router.push('/?integration_success=true');

    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar e testar integração. Verifique o subdomínio.', 'error');
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Tem certeza? Isso desativará a integração e voltará para o padrão.")) return;

    setIsActive(false);
    setIsSaving(true);
    try {
      await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
          subdomain,
          journeyMap: journeyStages
        })
      });
      showToast('Integração desativada. Voltando ao padrão.', 'success');
    } catch (error) {
      showToast('Erro ao resetar integração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addStage = () => {
    if (newStage.trim()) {
      setJourneyStages([...journeyStages, newStage.trim()]);
      setNewStage('');
    }
  };

  const removeStage = (index: number) => {
    setJourneyStages(journeyStages.filter((_, i) => i !== index));
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/')} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Integração Kommo CRM</h1>
        </div>

        <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass neon-border">
          <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Link size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-foreground">Configuração Geral</h2>
                <p className="text-sm text-muted-foreground">Conecte sua conta Kommo para sincronizar leads.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-full border border-border">
              <span className={`text-sm font-medium ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-secondary'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${isActive ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Subdomínio */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Subdomínio Kommo</label>
              <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl border border-border focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                <span className="pl-4 text-muted-foreground font-mono">https://</span>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="seunegocio"
                  className="flex-1 py-2.5 bg-transparent border-none focus:ring-0 text-foreground placeholder-muted-foreground outline-none font-medium"
                />
                <span className="pr-4 text-muted-foreground font-mono">.kommo.com</span>
              </div>
            </div>

            {/* Jornada de Compra */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-brand-500" />
                <label className="block text-sm font-medium text-foreground">Mapeamento da Jornada</label>
              </div>
              <p className="text-xs text-muted-foreground">Defina as etapas do funil que deseja rastrear. A ordem define o funil (I, II, III...).</p>

              <div className="space-y-2">
                {journeyStages.map((stage, index) => (
                  <div key={index} className="flex items-center justify-between bg-secondary/30 px-4 py-3 rounded-lg border border-border group hover:border-brand-500/30 transition-colors">
                    <span className="text-sm font-medium text-foreground flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold border border-brand-500/20">
                        {index + 1}
                      </span>
                      {stage}
                    </span>
                    <button onClick={() => removeStage(index)} className="text-muted-foreground hover:text-red-500 transition-colors p-1 hover:bg-red-500/10 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  placeholder="Nova etapa (ex: Agendou)"
                  className="flex-1 px-4 py-2.5 bg-secondary/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && addStage()}
                />
                <button
                  onClick={addStage}
                  className="px-4 py-2.5 bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 border border-brand-600/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 bg-secondary/20 border-t border-border flex justify-between items-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              Voltar ao Padrão
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
