'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Menu,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  X,
  Layers,
  Megaphone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
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

type StatusFilter = 'all' | 'active' | 'paused' | 'other';

function statusFilterOf(status: string): Exclude<StatusFilter, 'all'> {
  if (status === 'ACTIVE') return 'active';
  if (status.includes('PAUSED')) return 'paused';
  return 'other';
}

function statusBadgeClasses(status: string): string {
  const group = statusFilterOf(status);
  if (group === 'active')
    return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
  if (group === 'paused')
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-secondary text-muted-foreground border-border';
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const { showToast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copiado`, 'success');
    } catch {
      showToast('Não foi possível copiar', 'error');
    }
  };
  return (
    <button
      onClick={copy}
      className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono bg-secondary/50 hover:bg-secondary px-2 py-1 rounded-md transition-colors"
      title={`Copiar ${label}`}
    >
      {value}
      <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function AdCatalogPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [ads, setAds] = useState<MappedAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [selectedAd, setSelectedAd] = useState<MappedAd | null>(null);

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

  const lastSyncedAt = useMemo(() => {
    if (ads.length === 0) return null;
    return ads.reduce(
      (latest, ad) => (ad.lastSyncedAt > latest ? ad.lastSyncedAt : latest),
      ads[0].lastSyncedAt,
    );
  }, [ads]);

  const filteredAds = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ads.filter((ad) => {
      if (statusFilter !== 'all' && statusFilterOf(ad.adStatus) !== statusFilter) return false;
      if (!term) return true;
      return (
        ad.adName.toLowerCase().includes(term) ||
        ad.campaignName.toLowerCase().includes(term) ||
        ad.adsetName.toLowerCase().includes(term) ||
        ad.adExternalId.includes(term) ||
        ad.campaignExternalId.includes(term) ||
        ad.adsetExternalId.includes(term)
      );
    });
  }, [ads, search, statusFilter]);

  // Group by campaign > adset for display
  const campaigns = useMemo(() => {
    return filteredAds.reduce<
      Record<string, { name: string; adsets: Record<string, { name: string; ads: MappedAd[] }> }>
    >((acc, ad) => {
      acc[ad.campaignExternalId] ??= { name: ad.campaignName, adsets: {} };
      acc[ad.campaignExternalId].adsets[ad.adsetExternalId] ??= { name: ad.adsetName, ads: [] };
      acc[ad.campaignExternalId].adsets[ad.adsetExternalId].ads.push(ad);
      return acc;
    }, {});
  }, [filteredAds]);

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-muted-foreground max-w-2xl">
                Todas as campanhas, conjuntos e anúncios da conta Meta conectada — a base usada pra
                cruzar com os leads rastreados. Sincroniza a conta inteira, sem filtro de período.
              </p>
              {lastSyncedAt && (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Última sincronização: {format(new Date(lastSyncedAt), 'dd/MM/yyyy HH:mm')}
                </p>
              )}
            </div>

            {ads.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou ID (campanha, conjunto, anúncio)..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  />
                </div>
                <div className="sm:w-52">
                  <Select
                    options={[
                      { value: 'all', label: 'Todos os status' },
                      { value: 'active', label: 'Ativos' },
                      { value: 'paused', label: 'Pausados' },
                      { value: 'other', label: 'Outros' },
                    ]}
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as StatusFilter)}
                  />
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : ads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum anúncio mapeado ainda — clique em &quot;Sincronizar agora&quot;.
              </p>
            ) : Object.keys(campaigns).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum anúncio encontrado para esse filtro/busca.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(campaigns).map(([campaignId, campaign]) => {
                  const isOpen = expandedCampaigns.has(campaignId);
                  const allAdsInCampaign = Object.values(campaign.adsets).flatMap((a) => a.ads);
                  const activeCount = allAdsInCampaign.filter(
                    (ad) => statusFilterOf(ad.adStatus) === 'active',
                  ).length;

                  return (
                    <div
                      key={campaignId}
                      className="bg-card border border-border rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleCampaign(campaignId)}
                        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isOpen ? (
                            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                          )}
                          <Megaphone size={16} className="text-brand-500 shrink-0" />
                          <span className="font-bold truncate">{campaign.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {activeCount}/{allAdsInCampaign.length} ativo(s)
                          </span>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                            {campaignId}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-4 space-y-4">
                          {Object.entries(campaign.adsets).map(([adsetId, adset]) => (
                            <div key={adsetId} className="pl-4 border-l-2 border-border space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Layers size={14} />
                                {adset.name}
                                <span className="text-xs font-mono text-muted-foreground/70">
                                  {adsetId}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {adset.ads.map((ad) => (
                                  <button
                                    key={ad.id}
                                    onClick={() => setSelectedAd(ad)}
                                    className="w-full flex items-center justify-between gap-3 text-sm pl-4 py-2 rounded-lg hover:bg-secondary/40 transition-colors text-left"
                                  >
                                    <span className="truncate">{ad.adName}</span>
                                    <span
                                      className={`text-xs shrink-0 border px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses(ad.adStatus)}`}
                                    >
                                      {ad.adStatus}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedAd(null)}
        >
          <div
            className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="min-w-0">
                <h2 className="font-bold text-lg text-foreground truncate">{selectedAd.adName}</h2>
                <span
                  className={`inline-block mt-1 text-xs border px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses(selectedAd.adStatus)}`}
                >
                  {selectedAd.adStatus}
                </span>
              </div>
              <button
                onClick={() => setSelectedAd(null)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Campanha</p>
                <p className="font-medium">{selectedAd.campaignName}</p>
                <CopyableId label="ID da campanha" value={selectedAd.campaignExternalId} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Conjunto de anúncios</p>
                <p className="font-medium">{selectedAd.adsetName}</p>
                <CopyableId label="ID do conjunto" value={selectedAd.adsetExternalId} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Anúncio</p>
                <p className="font-medium">{selectedAd.adName}</p>
                <CopyableId label="ID do anúncio" value={selectedAd.adExternalId} />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Plataforma</p>
                  <p className="font-medium">{selectedAd.platform}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última sincronização</p>
                  <p className="font-medium">
                    {format(new Date(selectedAd.lastSyncedAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
