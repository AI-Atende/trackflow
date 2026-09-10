import React, { useState, useEffect } from 'react';
import { Save, X, RotateCcw, Link, AlertTriangle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface KommoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const KommoConfigModal: React.FC<KommoConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    if (isOpen) {
      (async () => {
        setIsLoading(true);
        try {
          const res = await fetch('/api/integrations/kommo');
          if (res.ok) {
            const data = await res.json();
            if (data.id) {
              setIsActive(data.isActive);
              setSubdomain(data.config?.subdomain || '');
            }
          }
        } catch (error) {
          console.error('Erro ao carregar configurações:', error);
          showToast('Erro ao carregar configurações.', 'error');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, showToast]);

  // Journey/funnel config used to live here and be validated by hitting a legacy external
  // aggregation endpoint right after saving — that endpoint has nothing to do with basic
  // connection status, and failing it (e.g. isActive just toggled on with no data yet) produced
  // a misleading "erro ao testar a conexão" even when the save itself worked fine. The journey
  // moved to its own config (JourneyConfigModal, see Integrações) — this modal now only owns
  // isActive/subdomain, so there's nothing left here worth "testing" beyond the save itself.
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, journeyMap: [] }),
      });
      if (!res.ok) throw new Error('Falha ao salvar configuração');

      showToast('Integração salva com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('Erro ao salvar a integração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Tem certeza? Isso desativará a integração.')) return;

    setIsActive(false);
    setIsSaving(true);
    try {
      await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false, journeyMap: [] }),
      });
      showToast('Integração desativada.', 'success');
      onSuccess();
      onClose();
    } catch {
      showToast('Erro ao resetar integração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Link size={20} className="text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Configurar Kommo CRM</h2>
              <p className="text-sm text-muted-foreground">
                Conecte sua conta para sincronizar leads.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">Carregando...</div>
          ) : (
            <>
              {/* Status Toggle */}
              <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-xl border border-border">
                <span className="text-sm font-medium text-foreground">Status da Integração</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}
                  >
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-secondary'}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${isActive ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
              </div>

              {/* Subdomínio — gerenciado no portal, só leitura aqui */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  Subdomínio Kommo
                </label>
                {subdomain ? (
                  <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl border border-border">
                    <span className="pl-4 text-muted-foreground font-mono">https://</span>
                    <span className="flex-1 py-2.5 text-foreground font-medium font-mono">
                      {subdomain}
                    </span>
                    <span className="pr-4 text-muted-foreground font-mono">.kommo.com</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-600">
                    <AlertTriangle size={16} />
                    Configure o Kommo no portal primeiro — o subdomínio aparece aqui
                    automaticamente.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Gerenciado no portal, sincronizado a cada login.
                </p>
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
