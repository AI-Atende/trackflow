'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { ArrowLeft, Menu, Search, RotateCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { messageViaLabel } from '@/lib/messageSource';

interface TrackedContact {
  key: string;
  waId: string;
  firstSeenAt: string;
  lastMessageAt: string;
  messageCount: number;
  vias: Array<{ source: string; channel: string | null }>;
  attribution: {
    strategy: string;
    receivedAt: string;
    linkLabel: string | null;
    ad: { adName: string; campaignName: string; platform: 'META' | 'GOOGLE' } | null;
    utm: {
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmContent: string | null;
      utmTerm: string | null;
      hasClickId: boolean;
    } | null;
  } | null;
  kommo: { messageId: string; status: string; error: string | null; leadId: string | null } | null;
  trackflowLeadId: string | null;
}

const STRATEGY_LABELS: Record<string, string> = {
  CODE_INVISIBLE: 'Código invisível',
  CODE_VISIBLE: 'Código visível',
  AD_CODE: 'Código de anúncio (Click-to-WhatsApp)',
  TIME_WINDOW: 'Janela de tempo (sem código)',
};

const KOMMO_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SYNCED: {
    label: 'Gravado no Kommo',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  PENDING: {
    label: 'Aguardando o lead no Kommo',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  SKIPPED: {
    label: 'Não gravado no Kommo',
    className: 'bg-secondary text-muted-foreground border-border',
  },
  FAILED: {
    label: 'Falha no Kommo',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
};

const PAGE_SIZE = 50;
const REFRESH_MS = 10_000;

function formatPhone(waId: string): string {
  const d = waId.replace(/\D/g, '');
  if (d.startsWith('55') && d.length === 13)
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.startsWith('55') && d.length === 12)
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

export default function TrackedContactsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [contacts, setContacts] = useState<TrackedContact[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [onlyAttributed, setOnlyAttributed] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchContacts = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const res = await fetch(`/api/tracked-contacts?days=${days}`);
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts ?? []);
          setTruncated(Boolean(data.truncated));
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
    // New contacts appear as soon as the portal relays the message — poll so the list stays live
    // without a manual refresh (paused while the tab is hidden).
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchContacts(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    const digits = searchTerm.replace(/\D/g, '');
    return contacts.filter((c) => {
      if (onlyAttributed && !c.attribution) return false;
      if (digits && !c.waId.includes(digits)) return false;
      return true;
    });
  }, [contacts, onlyAttributed, searchTerm]);

  const visible = filtered.slice(0, visibleCount);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resync = async (contact: TrackedContact) => {
    if (!contact.kommo) return;
    setResyncingId(contact.kommo.messageId);
    try {
      const res = await fetch(`/api/tracked-messages/${contact.kommo.messageId}/resync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao reenviar ao Kommo');
      showToast(
        data.status === 'SYNCED'
          ? 'Origem gravada no lead do Kommo.'
          : data.status === 'PENDING'
            ? 'Lead ainda não encontrado no Kommo — o sistema vai tentar de novo sozinho.'
            : (data.error ?? 'Não foi possível gravar no Kommo.'),
        data.status === 'SYNCED' ? 'success' : 'error',
      );
      await fetchContacts(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao reenviar ao Kommo', 'error');
    } finally {
      setResyncingId(null);
    }
  };

  const deleteSelected = async () => {
    const chosen = contacts.filter((c) => selected.has(c.key));
    if (chosen.length === 0) return;
    const warning = `Excluir o histórico de rastreamento de ${chosen.length} contato(s)? Apaga as mensagens rastreadas desses números aqui (não mexe nos leads da jornada nem no Kommo). Não dá pra desfazer.`;
    if (chosen.length > 10) {
      const typed = prompt(`${warning}\n\nDigite EXCLUIR para confirmar.`);
      if (typed?.trim().toUpperCase() !== 'EXCLUIR') return;
    } else if (!confirm(warning)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/tracked-contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waIds: chosen.map((c) => c.waId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir');
      showToast(`${data.deleted} mensagem(ns) removida(s).`, 'success');
      setSelected(new Set());
      await fetchContacts(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.key));

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
            <h1 className="text-xl font-bold text-foreground">Contatos Rastreados</h1>
          </div>
          <Button variant="outline" onClick={() => fetchContacts()} disabled={isLoading}>
            <RotateCw size={16} className="mr-2" /> Atualizar
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="max-w-5xl mx-auto space-y-4">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Quem escreveu no seu WhatsApp e de onde veio — aparece assim que a mensagem chega, sem
              esperar o lead existir no Kommo. A lista se atualiza sozinha a cada 10 segundos.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  placeholder="Buscar por telefone..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-3 py-2 text-sm bg-card border border-border rounded-lg"
              >
                <option value={1}>Últimas 24 horas</option>
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyAttributed}
                  onChange={(e) => {
                    setOnlyAttributed(e.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                />
                Só com origem
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const c of visible) {
                        if (e.target.checked) next.add(c.key);
                        else next.delete(c.key);
                      }
                      return next;
                    })
                  }
                />
                Selecionar os {visible.length} exibidos
              </label>
              <span className="text-muted-foreground">
                {filtered.length} contato(s)
                {selected.size > 0 ? ` · ${selected.size} selecionado(s)` : ''}
              </span>
              {selected.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={deleteSelected}
                  disabled={isDeleting}
                >
                  <Trash2 size={14} className="mr-1" />
                  {isDeleting ? 'Excluindo...' : `Excluir histórico (${selected.size})`}
                </Button>
              )}
            </div>

            {truncated && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Há muitas mensagens no período — só as 5.000 mais recentes foram consideradas.
                Reduza o período para ver tudo.
              </p>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {onlyAttributed
                  ? 'Nenhum contato com origem identificada nesse período.'
                  : 'Nenhum contato nesse período.'}
              </p>
            ) : (
              <div className="space-y-2">
                {visible.map((c) => {
                  const a = c.attribution;
                  const kommoStyle = c.kommo ? KOMMO_STATUS_STYLES[c.kommo.status] : null;
                  const utmChips = a?.utm
                    ? (
                        [
                          ['utm_source', a.utm.utmSource],
                          ['utm_medium', a.utm.utmMedium],
                          ['utm_campaign', a.utm.utmCampaign],
                          ['utm_content', a.utm.utmContent],
                          ['utm_term', a.utm.utmTerm],
                        ] as const
                      ).filter(([, v]) => v)
                    : [];

                  return (
                    <div
                      key={c.key}
                      className={`bg-card border rounded-xl p-3 space-y-2 ${
                        selected.has(c.key) ? 'border-brand-500' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(c.key)}
                          onChange={() => toggle(c.key)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {formatPhone(c.waId)}
                            </span>
                            {c.vias.map((v) => (
                              <span
                                key={`${v.source}|${v.channel ?? ''}`}
                                className="text-[10px] border border-border bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-full"
                              >
                                {messageViaLabel(v.source, v.channel)}
                              </span>
                            ))}
                            {c.trackflowLeadId && (
                              <span className="text-[10px] border border-border bg-secondary px-1.5 py-0.5 rounded-full">
                                Na jornada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Última mensagem {format(new Date(c.lastMessageAt), 'dd/MM/yyyy HH:mm')}{' '}
                            · {c.messageCount} mensagem(ns)
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {a ? (
                            <span className="text-[11px] border border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                              {STRATEGY_LABELS[a.strategy] ?? a.strategy}
                            </span>
                          ) : (
                            <span className="text-[11px] border border-border bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                              Sem origem
                            </span>
                          )}
                        </div>
                      </div>

                      {a && (
                        <div className="pl-7 space-y-1.5">
                          {a.linkLabel && (
                            <p className="text-xs">
                              <span className="text-muted-foreground">Link:</span> {a.linkLabel}
                            </p>
                          )}
                          {a.ad && (
                            <p className="text-xs">
                              <span className="text-muted-foreground">
                                Anúncio ({a.ad.platform === 'META' ? 'Meta' : 'Google'}):
                              </span>{' '}
                              {a.ad.adName} · {a.ad.campaignName}
                            </p>
                          )}
                          {utmChips.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {utmChips.map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-[10px] font-mono bg-secondary/60 border border-border rounded px-1.5 py-0.5"
                                >
                                  {k}={v}
                                </span>
                              ))}
                            </div>
                          )}
                          {a.strategy === 'TIME_WINDOW' && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              Associado só pelo horário, sem código na mensagem — menos preciso.
                            </p>
                          )}
                          {c.kommo && kommoStyle && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${kommoStyle.className}`}
                                title={c.kommo.error ?? undefined}
                              >
                                {kommoStyle.label}
                                {c.kommo.leadId ? ` · lead ${c.kommo.leadId}` : ''}
                              </span>
                              {c.kommo.status !== 'SYNCED' && c.kommo.error && (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                  {c.kommo.error}
                                </span>
                              )}
                              <button
                                onClick={() => resync(c)}
                                disabled={resyncingId === c.kommo.messageId}
                                className="text-[11px] font-medium text-brand-500 hover:underline disabled:opacity-50"
                              >
                                {resyncingId === c.kommo.messageId
                                  ? 'Reenviando...'
                                  : 'Reenviar ao Kommo'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length > visibleCount && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Mostrar mais ({filtered.length - visibleCount} restantes)
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
