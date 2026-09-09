'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Menu, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

interface MappedAd {
  id: string;
  platform: 'META' | 'GOOGLE';
  adExternalId: string;
  adName: string;
  adStatus: string;
  campaignExternalId: string;
  campaignName: string;
  adsetExternalId: string;
  adsetName: string;
  lastSyncedAt: string;
}

export default function AdCatalogPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [ads, setAds] = useState<MappedAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ad-catalog');
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAds();
  }, [fetchAds]);

  const syncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/ad-catalog/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar');
      showToast(`Sincronizado! ${data.synced} anúncio(s) atualizados.`, 'success');
      await fetchAds();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao sincronizar catálogo', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Group by campaign > adset for display
  const campaigns = ads.reduce<
    Record<string, { name: string; adsets: Record<string, { name: string; ads: MappedAd[] }> }>
  >((acc, ad) => {
    acc[ad.campaignExternalId] ??= { name: ad.campaignName, adsets: {} };
    acc[ad.campaignExternalId].adsets[ad.adsetExternalId] ??= { name: ad.adsetName, ads: [] };
    acc[ad.campaignExternalId].adsets[ad.adsetExternalId].ads.push(ad);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentAccount={{
          id: session?.user?.clientId || '',
          name: session?.user?.name || '',
          image: session?.user?.image,
        }}
        availableAccounts={[]}
        onAccountChange={() => {}}
      />

      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <button
              onClick={() => router.back()}
              className="hidden md:block p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Catálogo de Anúncios</h1>
          </div>
          <Button onClick={syncNow} disabled={isSyncing}>
            <RefreshCw size={16} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar agora
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-background">
          <div className="max-w-5xl mx-auto space-y-6">
            <p className="text-sm text-muted-foreground">
              Todas as campanhas, conjuntos e anúncios da conta Meta conectada — a base usada pra
              cruzar com os leads rastreados. Sincroniza a conta inteira, sem filtro de período.
            </p>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : Object.keys(campaigns).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum anúncio mapeado ainda — clique em &quot;Sincronizar agora&quot;.
              </p>
            ) : (
              Object.entries(campaigns).map(([campaignId, campaign]) => (
                <div
                  key={campaignId}
                  className="bg-card border border-border rounded-xl p-4 space-y-3"
                >
                  <h2 className="font-bold">{campaign.name}</h2>
                  {Object.entries(campaign.adsets).map(([adsetId, adset]) => (
                    <div key={adsetId} className="pl-4 border-l-2 border-border space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{adset.name}</p>
                      {adset.ads.map((ad) => (
                        <div
                          key={ad.id}
                          className="flex items-center justify-between text-sm pl-4 py-1"
                        >
                          <span>{ad.adName}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {ad.adStatus} · {ad.adExternalId}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
