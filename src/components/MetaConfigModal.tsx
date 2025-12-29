import React, { useState, useEffect } from 'react';
import { Save, X, RotateCcw, Layers, Facebook } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Select } from '@/components/ui/Select';

import { useSession } from "next-auth/react";

interface MetaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_METRICS = [
  { value: 'impressions', label: 'Impressões' },
  { value: 'clicks', label: 'Cliques' },
  { value: 'leads', label: 'Leads (Meta)' },
  { value: 'reach', label: 'Alcance' },
  { value: 'results', label: 'Resultados' },
  // Monetary metrics removed as per request.
];

export const MetaConfigModal: React.FC<MetaConfigModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const { update } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccountName, setConnectedAccountName] = useState<string | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [journeyStages, setJourneyStages] = useState<string[]>(['impressions', 'clicks', 'leads']);
  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/integrations/meta/accounts');
      if (res.ok) {
        const data = await res.json();
        setAvailableAccounts(data);
        setIsConnected(true); // If we can fetch accounts, we are connected
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      showToast("Erro ao buscar contas de anúncio.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/integrations/meta/status');
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.isConnected);
        setConnectedAccountName(data.accountName);
        if (data.isConnected && !data.adAccountId) {
          // Connected but no account selected? Fetch list
          fetchAccounts();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      fetchConfig();

      // Check for action param in URL (legacy support or direct access)
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'select_meta_account') {
        fetchAccounts();
        // Clean URL
        window.history.replaceState({}, '', '/integrations');
      }

      // Listen for popup message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'meta_auth_success') {
          showToast("Conexão com Facebook realizada!", "success");
          fetchAccounts();
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isOpen]);

  const handleConnect = () => {
    // Open popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      '/api/integrations/meta/auth/start',
      'MetaAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleSelectAccount = async () => {
    if (!selectedAccountId) return;
    setIsSaving(true);
    try {
      const account = availableAccounts.find(a => a.account_id === selectedAccountId || a.id === selectedAccountId);
      const name = account?.name || `Account ${selectedAccountId}`;
      const id = account?.account_id || account?.id;

      const res = await fetch('/api/integrations/meta/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: id, name })
      });

      if (res.ok) {
        showToast("Conta selecionada com sucesso!", "success");
        setConnectedAccountName(name);
        setAvailableAccounts([]); // Clear selection list
        checkStatus();

        // Refresh session to update active account in context
        await update();

        // Trigger Sync
        showToast("Sincronizando dados recentes...", "success");
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        fetch(`/api/meta/${id}/sync-daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            since: thirtyDaysAgo.toISOString().split('T')[0],
            until: today.toISOString().split('T')[0]
          })
        }).then(() => {
          showToast("Sincronização concluída!", "success");
          onSuccess();
        }).catch(err => {
          console.error("Sync error:", err);
          showToast("Erro ao sincronizar dados.", "error");
        });

      } else {
        throw new Error("Falha ao selecionar conta");
      }
    } catch (e) {
      showToast("Erro ao selecionar conta.", "error");
    } finally {
      setIsSaving(false);
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
              <p className="text-sm text-muted-foreground">Conecte sua conta e defina as métricas.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading && !availableAccounts.length ? (
            <div className="flex items-center justify-center h-40">Carregando...</div>
          ) : (
            <>
              {/* Connection Section */}
              <div className="bg-secondary/10 p-4 rounded-xl border border-border space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  Status da Conexão
                </h3>

                {!isConnected ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">Conecte sua conta do Facebook para importar seus anúncios.</p>
                    <button
                      onClick={handleConnect}
                      className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
                    >
                      <Facebook size={20} />
                      Conectar com Facebook
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {connectedAccountName ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">Conectado como</p>
                            <p className="font-bold text-foreground">{connectedAccountName}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setConnectedAccountName(null);
                                setSelectedAccountId("");
                                setSelectedBusinessId("");
                                fetchAccounts(); // Refresh list
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                              Trocar conta
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <button
                            onClick={handleConnect}
                            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                            title="Use isso se precisar trocar o usuário do Facebook"
                          >
                            <Facebook size={12} />
                            Re-autenticar com Facebook
                          </button>

                          <button
                            onClick={async () => {
                              if (!confirm("Tem certeza que deseja desconectar? Isso irá parar a sincronização.")) return;
                              try {
                                await fetch('/api/integrations/meta/disconnect', { method: 'DELETE' });
                                setIsConnected(false);
                                setConnectedAccountName(null);
                                setAvailableAccounts([]);
                                await update(); // Refresh session
                                showToast("Desconectado com sucesso.", "success");
                              } catch (e) {
                                showToast("Erro ao desconectar.", "error");
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Desconectar Integração
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Step 1: Select Business Portfolio */}
                        <div className="space-y-2">
                          <p className="text-sm text-foreground font-medium">1. Selecione o Portfólio Empresarial:</p>
                          <Select
                            options={[
                              ...Array.from(new Set(availableAccounts.map(a => a.business?.id || 'personal'))).map(bizId => {
                                const account = availableAccounts.find(a => (a.business?.id || 'personal') === bizId);
                                const isPersonal = bizId === 'personal';
                                return {
                                  value: bizId,
                                  label: isPersonal ? 'Conta Pessoal (Sem Portfólio)' : (account?.business?.name || 'Portfólio Desconhecido')
                                };
                              })
                            ]}
                            value={selectedBusinessId}
                            onChange={(val) => {
                              setSelectedBusinessId(val);
                              setSelectedAccountId(""); // Reset account selection
                            }}
                            placeholder="Selecione um portfólio..."
                          />
                        </div>

                        {/* Step 2: Select Ad Account */}
                        {selectedBusinessId && (
                          <div className="space-y-2">
                            <p className="text-sm text-foreground font-medium">2. Selecione a Conta de Anúncios:</p>
                            <div className="flex gap-2">
                              <Select
                                options={availableAccounts
                                  .filter(a => (a.business?.id || 'personal') === selectedBusinessId)
                                  .map(a => ({
                                    value: a.account_id || a.id,
                                    label: `${a.name} (${a.account_id || a.id})`
                                  }))}
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
                                placeholder="Selecione uma conta..."
                              />
                              <button
                                onClick={handleSelectAccount}
                                disabled={!selectedAccountId || isSaving}
                                className="bg-brand-600 text-white px-4 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        )}

                        {!availableAccounts.length && (
                          <p className="text-sm text-yellow-500">Nenhuma conta de anúncios encontrada.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Jornada de Compra (Only show if connected) */}
              {isConnected && (
                <div className="space-y-4 pt-4 border-t border-border">
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
              )}
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
            disabled={isSaving || !isConnected}
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
