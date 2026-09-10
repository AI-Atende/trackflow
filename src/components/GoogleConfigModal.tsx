import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { X, Check, Loader2, BarChart3 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Select } from '@/components/ui/Select';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GoogleAdAccountOption {
  id: string;
  name: string;
  currency?: string;
}

export function GoogleConfigModal({ isOpen, onClose, onSuccess }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccountName, setConnectedAccountName] = useState<string | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<GoogleAdAccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Account-level settings — MCC id, consent, currency (detected), last catalog sync.
  const [managerId, setManagerId] = useState('');
  const [consentGranted, setConsentGranted] = useState(true);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/google/accounts');
      if (res.ok) {
        const data = await res.json();
        setAvailableAccounts(data);
        setIsConnected(true);
      } else {
        const err = await res.text();
        console.error('Fetch accounts error:', err);
        showToast('Erro ao buscar contas.', 'error');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      showToast('Erro ao buscar contas de anúncio.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/google/status');
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.isConnected);
        setConnectedAccountName(data.accountName);
        setManagerId(data.managerId || '');
        setConsentGranted(data.consentGranted ?? true);
        setCurrencyCode(data.currencyCode ?? null);
        setLastSyncedAt(data.lastSyncedAt ?? null);
        if (data.isConnected && !data.customerId) {
          await fetchAccounts();
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar status', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, fetchAccounts]);

  useEffect(() => {
    if (isOpen) {
      (async () => {
        await checkStatus();
      })();

      // Listen for popup message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'google_auth_success') {
          showToast('Conexão com Google Ads realizada!', 'success');
          fetchAccounts();
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isOpen, checkStatus, fetchAccounts, showToast]);

  const handleConnect = () => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      '/api/integrations/google/auth',
      'GoogleAuth',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  };

  const handleSelectAccount = async () => {
    if (!selectedAccountId) return;
    setIsSaving(true);
    try {
      const account = availableAccounts.find((a) => a.id === selectedAccountId);
      const name = account?.name || `Account ${selectedAccountId}`;

      const res = await fetch('/api/integrations/google/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedAccountId, name }),
      });

      if (res.ok) {
        showToast('Conta selecionada com sucesso!', 'success');
        setConnectedAccountName(name);
        setAvailableAccounts([]);
        checkStatus();
        onSuccess();
      } else {
        throw new Error('Falha ao selecionar conta');
      }
    } catch {
      showToast('Erro ao selecionar conta.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/integrations/google/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: managerId.trim() || null, consentGranted }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      showToast('Configurações do Google Ads salvas!', 'success');
    } catch {
      showToast('Erro ao salvar configurações do Google Ads.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/integrations/google/status', { method: 'DELETE' });
      if (res.ok) {
        showToast('Desconectado com sucesso', 'success');
        setIsConnected(false);
        setConnectedAccountName(null);
        setAvailableAccounts([]);
        onSuccess();
      } else {
        showToast('Erro ao desconectar', 'error');
      }
    } catch {
      showToast('Erro ao desconectar', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <BarChart3 size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Configurar Google Ads</h2>
              <p className="text-sm text-muted-foreground">
                Conecte sua conta para importar campanhas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading && !availableAccounts.length && !connectedAccountName ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-brand-500" size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-secondary/10">
              {isConnected ? (
                <div className="w-full space-y-6">
                  <div className="flex items-center justify-center gap-2 text-green-500 mb-4">
                    <Check size={24} />
                    <span className="font-semibold text-lg">Conectado ao Google Ads</span>
                  </div>

                  {connectedAccountName ? (
                    <div className="space-y-4">
                      <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 flex justify-between items-center">
                        <div>
                          <p className="text-sm text-green-700 font-medium">Conta Ativa</p>
                          <p className="text-lg font-bold">{connectedAccountName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {currencyCode ? `Moeda: ${currencyCode} · ` : ''}
                            {lastSyncedAt
                              ? `Última sincronização: ${format(new Date(lastSyncedAt), 'dd/MM/yyyy HH:mm')}`
                              : 'Catálogo ainda não sincronizado'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setConnectedAccountName(null);
                            fetchAccounts();
                          }}
                          className="text-sm text-muted-foreground hover:text-foreground underline shrink-0"
                        >
                          Trocar
                        </button>
                      </div>

                      <div className="space-y-3 p-4 rounded-xl border border-border text-left">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            ID da conta gerenciadora (MCC) — opcional
                          </label>
                          <input
                            value={managerId}
                            onChange={(e) => setManagerId(e.target.value)}
                            placeholder="Ex: 123-456-7890"
                            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                          />
                          <p className="text-xs text-muted-foreground">
                            Só necessário se essa conta for gerenciada por uma MCC (agência).
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Consentimento de anúncios personalizados
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Desligue só se essa conta precisar declarar ausência de consentimento
                              (ex. contas na União Europeia).
                            </p>
                          </div>
                          <button
                            onClick={() => setConsentGranted(!consentGranted)}
                            className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${consentGranted ? 'bg-green-500' : 'bg-secondary'}`}
                          >
                            <div
                              className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${consentGranted ? 'left-7' : 'left-1'}`}
                            />
                          </button>
                        </div>

                        <button
                          onClick={saveSettings}
                          disabled={isSavingSettings}
                          className="w-full py-2 text-sm bg-secondary hover:bg-secondary/70 rounded-lg font-medium disabled:opacity-50"
                        >
                          {isSavingSettings ? 'Salvando...' : 'Salvar configurações'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full max-w-md mx-auto">
                      <p className="text-center text-foreground font-medium">
                        Selecione a conta de anúncios:
                      </p>
                      <div className="flex gap-2">
                        <Select
                          options={availableAccounts.map((a) => ({
                            value: a.id,
                            label: `${a.name} (${a.id})`,
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
                          {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar'}
                        </button>
                      </div>
                      {!availableAccounts.length && (
                        <p className="text-center text-yellow-500 text-sm">
                          Nenhuma conta encontrada.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleDisconnect}
                      className="text-red-500 hover:text-red-600 text-sm font-medium hover:underline"
                    >
                      Desconectar Integração
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-16 w-16 bg-yellow-500/10 text-yellow-600 rounded-full flex items-center justify-center mb-4">
                    <BarChart3 size={32} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Não Conectado</h3>
                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                    Conecte sua conta do Google Ads para importar campanhas e métricas.
                  </p>
                  <button
                    onClick={handleConnect}
                    className="w-full max-w-xs py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <Image
                      src="https://www.gstatic.com/images/branding/product/1x/ads_24dp.png"
                      alt=""
                      width={20}
                      height={20}
                      unoptimized
                      className="w-5 h-5 bg-white rounded-full p-0.5"
                    />
                    Conectar Google Ads
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
