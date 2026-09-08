import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import type { Session } from 'next-auth';

type DateRange = {
  from: Date;
  to: Date;
};

interface SyncButtonProps {
  session: Session;
  onSyncSuccess?: () => void;
  dateRange: DateRange;
}

export const SyncButton = ({ session, onSyncSuccess, dateRange }: SyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  const handleSync = async () => {
    if (!session?.user?.metaAdAccount?.adAccountId) {
      showToast('Nenhuma conta de anúncios vinculada.', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const since = format(dateRange.from, 'yyyy-MM-dd');
      const until = format(dateRange.to, 'yyyy-MM-dd');

      const res = await fetch(`/api/meta/${session.user.metaAdAccount.adAccountId}/sync-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ since, until }),
      });

      if (res.ok) {
        showToast('Sincronização iniciada com sucesso!', 'success');
        if (onSyncSuccess) onSyncSuccess();
      } else {
        const data = await res.json();
        showToast(`Erro ao sincronizar: ${data.error || 'Erro desconhecido'}`, 'error');
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      showToast('Erro ao conectar com o servidor.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all relative ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
      title="Forçar Sincronização"
    >
      <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
    </button>
  );
};
