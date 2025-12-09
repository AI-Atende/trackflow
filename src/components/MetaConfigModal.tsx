import React, { useState, useEffect } from 'react';
import { Save, X, RotateCcw, Layers, Facebook } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Select } from '@/components/ui/Select';

interface MetaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_METRICS = [
  { value: 'impressions', label: 'Impressões' },
  { value: 'clicks', label: 'Cliques' },
  { value: 'leads', label: 'Leads (Meta)' },
  // Monetary metrics removed as per request.
  // Future: Add 'reach', 'results', 'purchases' when available in DB.
];

export const MetaConfigModal: React.FC<MetaConfigModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State
  const [journeyStages, setJourneyStages] = useState<string[]>(['impressions', 'clicks', 'leads']);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/integrations/meta/config');
      if (res.ok) {
        const data = await res.json();
        if (data.journeyMap && Array.isArray(data.journeyMap)) {
          setJourneyStages(data.journeyMap);
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
      const res = await fetch('/api/integrations/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyMap: journeyStages
        })
      });

      if (!res.ok) throw new Error('Falha ao salvar configuração');

      showToast("Configuração do Meta Ads salva com sucesso!", "success");
      onSuccess();
      onClose();

    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar configuração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Tem certeza? Isso voltará para o padrão (Impressões, Cliques, Leads).")) return;

    setJourneyStages(['impressions', 'clicks', 'leads']);
    // We can either save immediately or let user click save. Let's save immediately for "Reset" action.
    setIsSaving(true);
    try {
      await fetch('/api/integrations/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyMap: ['impressions', 'clicks', 'leads']
        })
      });
      showToast('Configuração resetada para o padrão.', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      showToast('Erro ao resetar configuração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStage = (index: number, value: string) => {
    const newStages = [...journeyStages];
    newStages[index] = value;
    setJourneyStages(newStages);
  };

  const addStage = () => {
    if (journeyStages.length < 5) {
      // Find first unused metric
      const used = new Set(journeyStages);
      const next = AVAILABLE_METRICS.find(m => !used.has(m.value))?.value || 'impressions';
      setJourneyStages([...journeyStages, next]);
    }
  };

  const removeStage = (index: number) => {
    setJourneyStages(journeyStages.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Facebook size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Configurar Meta Ads</h2>
              <p className="text-sm text-muted-foreground">Defina as métricas da jornada do cliente.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">Carregando...</div>
          ) : (
            <>
              {/* Jornada de Compra */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-brand-500" />
                  <label className="block text-sm font-medium text-foreground">Mapeamento da Jornada</label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione até 5 métricas para exibir no funil. A última etapa configurada será considerada o <strong>Resultado</strong> da campanha.
                </p>

                <div className="space-y-3">
                  {journeyStages.map((stage, index) => (
                    <div key={index} className="flex items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-border">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold border border-brand-500/20 shrink-0">
                        {index + 1}
                      </span>

                      <div className="flex-1">
                        <Select
                          options={AVAILABLE_METRICS.map(m => ({
                            ...m,
                            disabled: journeyStages.includes(m.value) && m.value !== stage // Disable if used elsewhere
                          }))}
                          value={stage}
                          onChange={(val) => updateStage(index, val)}
                        />
                      </div>

                      <button
                        onClick={() => removeStage(index)}
                        className="text-muted-foreground hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                        disabled={journeyStages.length <= 1}
                        title="Remover etapa"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {journeyStages.length < 5 && (
                  <button
                    onClick={addStage}
                    className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-brand-500 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    + Adicionar Etapa
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
  );
};
