'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Menu,
  ChevronRight,
  ChevronDown,
  X,
  User,
  Megaphone,
  Download,
  Search,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';

interface JourneyStageOption {
  id: string;
  label: string;
  order: number;
}

interface ConversionEventLogRow {
  id: string;
  platform: 'META' | 'GOOGLE';
  eventName: string;
  status: string;
  errorMessage: string | null;
  responseDetail: string | null;
  sentAt: string | null;
  createdAt: string;
  attempts: number;
  journeyStage: { label: string };
}

interface ParsedErrorDetail {
  title: string | null;
  description: string | null;
  raw: string;
}

interface ParsedSuccessDetail {
  fbtraceId: string | null;
  eventsReceived: number | null;
  raw: string;
}

// Meta's success body is {events_received, messages, fbtrace_id} — pulling fbtrace_id/
// events_received out reads better than a JSON blob and is handy to reference in a Meta support
// case. Google's response shape isn't confirmed the same way, so it just falls back to raw JSON.
function parseSuccessDetail(
  raw: string | null,
  platform: 'META' | 'GOOGLE',
): ParsedSuccessDetail | null {
  if (!raw) return null;
  if (platform !== 'META') return { fbtraceId: null, eventsReceived: null, raw };
  try {
    const parsed = JSON.parse(raw);
    return {
      fbtraceId: typeof parsed?.fbtrace_id === 'string' ? parsed.fbtrace_id : null,
      eventsReceived: typeof parsed?.events_received === 'number' ? parsed.events_received : null,
      raw,
    };
  } catch {
    return { fbtraceId: null, eventsReceived: null, raw };
  }
}

interface TrackedMessageRow {
  id: string;
  text: string;
  receivedAt: string;
  matchStrategy: string;
  phoneNumberId: string | null;
  channel: string | null;
  matchedTrackingLink: { label: string; waNumber: string } | null;
  matchedMappedAd: { adName: string; campaignName: string; platform: 'META' | 'GOOGLE' } | null;
  kommoLeadId: string | null;
  kommoSyncStatus: string;
  kommoSyncError: string | null;
  resolvedAdMatchConfidence: string | null;
}

const MATCH_STRATEGY_LABELS: Record<string, string> = {
  CODE_INVISIBLE: 'Código invisível (link rastreado)',
  CODE_VISIBLE: 'Código visível (link rastreado)',
  AD_CODE: 'Código de anúncio (Click-to-WhatsApp)',
  TIME_WINDOW: 'Janela de tempo (sem código)',
  UNMATCHED: 'Não correspondido',
};

function matchStrategyLabel(strategy: string): string {
  return MATCH_STRATEGY_LABELS[strategy] ?? strategy;
}

// Meta CAPI errors come back as "Meta CAPI error <status>: {json}" — pulling error_user_title/
// error_user_msg out of that JSON (already localized by Meta) reads far better than the raw
// blob. Google/other errors have no embedded JSON, so they just fall back to the raw text.
function parseErrorDetail(raw: string | null): ParsedErrorDetail | null {
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return { title: null, description: null, raw };
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    const err = parsed?.error;
    if (err) {
      return {
        title: err.error_user_title || err.message || null,
        description: err.error_user_msg || null,
        raw,
      };
    }
  } catch {
    // not JSON — fall through to raw-only
  }
  return { title: null, description: null, raw };
}

interface LeadRow {
  id: string;
  kommoLeadId: number;
  waId: string | null;
  fbclid: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  saleValue: number | null;
  attributionType: string | null;
  currentJourneyStage: { id: string; label: string; order: number } | null;
  matchedMappedAd: {
    id: string;
    adName: string;
    campaignName: string;
    platform: 'META' | 'GOOGLE';
  } | null;
  conversionEventLogs: ConversionEventLogRow[];
  updatedAt: string;
}

// Derived client-side from the lead's own click ids / registered-ad match (not solely from
// attributionType) so leads synced before that field existed still show the right badge instead
// of a misleading "Não rastreado". EXTERNAL is the one case that needs the server's classification
// (it depends on TrackedMessage history, which isn't part of this row).
function attributionBadge(lead: LeadRow): { label: string; className: string } {
  const hasGoogle =
    Boolean(lead.gclid || lead.gbraid || lead.wbraid) ||
    lead.matchedMappedAd?.platform === 'GOOGLE';
  const hasMeta = Boolean(lead.fbclid) || lead.matchedMappedAd?.platform === 'META';
  if (hasGoogle) {
    return {
      label: 'Google',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  }
  if (hasMeta) {
    return {
      label: 'Meta',
      className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    };
  }
  if (lead.attributionType === 'EXTERNAL') {
    return {
      label: 'Fonte externa',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  return { label: 'Não rastreado', className: 'bg-secondary text-muted-foreground border-border' };
}

const LEADS_PER_PAGE = 15;

function statusBadgeClasses(status: string): string {
  if (status === 'SENT')
    return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
  if (status === 'FAILED') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
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
      className="text-xs text-muted-foreground hover:text-foreground font-mono bg-secondary/50 hover:bg-secondary px-2 py-1 rounded-md transition-colors"
      title={`Copiar ${label}`}
    >
      {value}
    </button>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [stages, setStages] = useState<JourneyStageOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [trackedMessages, setTrackedMessages] = useState<TrackedMessageRow[]>([]);
  const [isLoadingTrackedMessages, setIsLoadingTrackedMessages] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads ?? []);
        setStages(data.stages ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads();
  }, [fetchLeads]);

  const selectedLeadId = selectedLead?.id ?? null;
  useEffect(() => {
    if (!selectedLeadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrackedMessages([]);
      return;
    }
    let cancelled = false;
    setIsLoadingTrackedMessages(true);
    fetch(`/api/leads/${selectedLeadId}/tracked-messages`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        if (!cancelled) setTrackedMessages(data.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setTrackedMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTrackedMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeadId]);

  const moveLeadStage = async (leadId: string, journeyStageId: string) => {
    setMovingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyStageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao mover o lead');
      showToast('Lead movido de etapa!', 'success');
      await fetchLeads();
      setSelectedLead((prev) => {
        if (!prev || prev.id !== leadId) return prev;
        const updated = leads.find((l) => l.id === leadId);
        return updated ?? prev;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao mover o lead', 'error');
    } finally {
      setMovingLeadId(null);
    }
  };

  const retryConversionEvent = async (leadId: string, logId: string) => {
    setRetryingLogId(logId);
    try {
      const res = await fetch(`/api/leads/${leadId}/conversion-events/${logId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao tentar novamente');
      const updatedLog = data.log;
      showToast(
        updatedLog?.status === 'SENT'
          ? 'Evento reenviado com sucesso!'
          : 'O reenvio falhou novamente — confira o motivo no badge.',
        updatedLog?.status === 'SENT' ? 'success' : 'error',
      );
      const patchLogs = (logs: ConversionEventLogRow[]) =>
        logs.map((l) => (l.id === logId ? { ...l, ...updatedLog } : l));
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id !== leadId
            ? lead
            : { ...lead, conversionEventLogs: patchLogs(lead.conversionEventLogs) },
        ),
      );
      setSelectedLead((prev) =>
        prev && prev.id === leadId
          ? { ...prev, conversionEventLogs: patchLogs(prev.conversionEventLogs) }
          : prev,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao tentar novamente', 'error');
    } finally {
      setRetryingLogId(null);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (
      !confirm(
        'Excluir este lead do TrackFlow? Isso apaga o lead, o histórico de eventos de conversão e as mensagens de rastreamento desse telefone aqui (o Kommo não é alterado). Útil pra testar de novo do zero, inclusive a atribuição.',
      )
    ) {
      return;
    }
    setIsDeletingLead(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir o lead');
      showToast('Lead excluído.', 'success');
      setSelectedLead(null);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir o lead', 'error');
    } finally {
      setIsDeletingLead(false);
    }
  };

  const importLeads = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/leads/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao importar leads');
      showToast(
        `${data.imported} lead(s) importado(s) do Kommo${data.skipped ? `, ${data.skipped} ignorado(s)` : ''}.`,
        'success',
      );
      await fetchLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao importar leads do Kommo', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const digitsTerm = searchTerm.replace(/\D/g, '');
    const min = minValue.trim() !== '' ? parseFloat(minValue.replace(',', '.')) : null;
    const max = maxValue.trim() !== '' ? parseFloat(maxValue.replace(',', '.')) : null;

    return leads.filter((lead) => {
      if (term) {
        const nameEmailMatch = [lead.firstName, lead.lastName, lead.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
        // Phone search tolerates formatting (spaces, parens, dashes) since waId is stored as
        // digits only — matching against digitsTerm covers both a raw and a formatted query.
        const phoneMatch = digitsTerm.length > 0 && (lead.waId?.includes(digitsTerm) ?? false);
        if (!nameEmailMatch && !phoneMatch) return false;
      }
      if (min !== null && !Number.isNaN(min) && (lead.saleValue == null || lead.saleValue < min)) {
        return false;
      }
      if (max !== null && !Number.isNaN(max) && (lead.saleValue == null || lead.saleValue > max)) {
        return false;
      }
      return true;
    });
  }, [leads, searchTerm, minValue, maxValue]);

  const hasActiveFilters =
    searchTerm.trim() !== '' || minValue.trim() !== '' || maxValue.trim() !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setMinValue('');
    setMaxValue('');
  };

  const groups = useMemo(() => {
    const byStage = new Map<string, LeadRow[]>();
    for (const lead of filteredLeads) {
      const key = lead.currentJourneyStage?.id ?? 'none';
      const arr = byStage.get(key) ?? [];
      arr.push(lead);
      byStage.set(key, arr);
    }
    return byStage;
  }, [filteredLeads]);

  const stageOptions = stages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ value: s.id, label: s.label }));

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
            <h1 className="text-xl font-bold text-foreground">Jornada dos Leads</h1>
          </div>
          <Button onClick={importLeads} disabled={isImporting}>
            <Download size={16} className="mr-2" />
            {isImporting ? 'Importando...' : 'Importar leads do Kommo'}
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-background">
          <div className="max-w-5xl mx-auto space-y-6">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Leads conhecidos pelo TrackFlow, agrupados pela etapa atual no Kommo — configure as
              etapas em Configurações → Kommo. Mudar a etapa aqui também move o lead no Kommo.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, telefone ou e-mail..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  placeholder="Valor mín."
                  className="w-28 px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  placeholder="Valor máx."
                  className="w-28 px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {hasActiveFilters && !isLoading && (
              <p className="text-xs text-muted-foreground">
                {filteredLeads.length} de {leads.length} lead(s) correspondem aos filtros.
              </p>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa de jornada configurada ainda — configure em Configurações → Kommo.
              </p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {stages
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => {
                    const stageLeads = groups.get(stage.id) ?? [];
                    const totalPages = Math.max(1, Math.ceil(stageLeads.length / LEADS_PER_PAGE));
                    const page = Math.min(columnPages[stage.id] ?? 1, totalPages);
                    const pageLeads = stageLeads.slice(
                      (page - 1) * LEADS_PER_PAGE,
                      page * LEADS_PER_PAGE,
                    );
                    const setPage = (next: number) =>
                      setColumnPages((prev) => ({ ...prev, [stage.id]: next }));

                    return (
                      <div
                        key={stage.id}
                        className="shrink-0 w-72 h-[65vh] bg-card border border-border rounded-xl flex flex-col overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2 p-3 border-b border-border shrink-0">
                          <span className="font-bold text-sm truncate">{stage.label}</span>
                          <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md shrink-0">
                            {stageLeads.length}
                          </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                          {pageLeads.length === 0 ? (
                            <p className="p-2 text-xs text-muted-foreground">
                              {hasActiveFilters
                                ? 'Nenhum lead nessa etapa corresponde aos filtros.'
                                : 'Nenhum lead nessa etapa ainda.'}
                            </p>
                          ) : (
                            pageLeads.map((lead) => {
                              const badge = attributionBadge(lead);
                              return (
                                <button
                                  key={lead.id}
                                  onClick={() => setSelectedLead(lead)}
                                  className="w-full text-left bg-secondary/30 hover:bg-secondary/50 border border-border rounded-lg p-2.5 space-y-1 transition-colors"
                                >
                                  <p className="text-sm font-medium truncate">
                                    {[lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
                                      lead.waId ||
                                      'Lead sem nome'}
                                  </p>
                                  {lead.waId && (
                                    <p className="text-xs text-muted-foreground font-mono truncate">
                                      {lead.waId}
                                    </p>
                                  )}
                                  <span
                                    className={`inline-block text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-2 p-2 border-t border-border text-xs shrink-0">
                            <button
                              onClick={() => setPage(page - 1)}
                              disabled={page <= 1}
                              className="px-2 py-1 rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Anterior
                            </button>
                            <span className="text-muted-foreground">
                              {page} / {totalPages}
                            </span>
                            <button
                              onClick={() => setPage(page + 1)}
                              disabled={page >= totalPages}
                              className="px-2 py-1 rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Próximo
                            </button>
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

      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="min-w-0 flex items-center gap-2">
                <User size={18} className="text-brand-500 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-lg text-foreground truncate">
                    {[selectedLead.firstName, selectedLead.lastName].filter(Boolean).join(' ') ||
                      selectedLead.waId ||
                      'Lead sem nome'}
                  </h2>
                  {(selectedLead.firstName || selectedLead.lastName) && selectedLead.waId && (
                    <p className="text-xs text-muted-foreground truncate">{selectedLead.waId}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => deleteLead(selectedLead.id)}
                  disabled={isDeletingLead}
                  title="Excluir lead e rastreamento (pra testar de novo)"
                  className="text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors p-1 rounded-md hover:bg-secondary"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Etapa atual</p>
                <Select
                  options={stageOptions}
                  value={selectedLead.currentJourneyStage?.id ?? ''}
                  disabled={movingLeadId === selectedLead.id}
                  onChange={(val) => moveLeadStage(selectedLead.id, val)}
                />
              </div>

              {selectedLead.matchedMappedAd && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Anúncio atribuído</p>
                  <p className="font-medium">{selectedLead.matchedMappedAd.adName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLead.matchedMappedAd.campaignName}
                  </p>
                </div>
              )}

              {(selectedLead.email || selectedLead.saleValue != null) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLead.email && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="font-medium truncate">{selectedLead.email}</p>
                    </div>
                  )}
                  {selectedLead.saleValue != null && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Valor (Kommo)</p>
                      <p className="font-medium">{selectedLead.saleValue}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">IDs de atribuição</p>
                <div className="flex flex-wrap gap-2">
                  {selectedLead.fbclid && <CopyableId label="fbclid" value={selectedLead.fbclid} />}
                  {selectedLead.gclid && <CopyableId label="gclid" value={selectedLead.gclid} />}
                  {selectedLead.gbraid && <CopyableId label="gbraid" value={selectedLead.gbraid} />}
                  {selectedLead.wbraid && <CopyableId label="wbraid" value={selectedLead.wbraid} />}
                  {!selectedLead.fbclid &&
                    !selectedLead.gclid &&
                    !selectedLead.gbraid &&
                    !selectedLead.wbraid && (
                      <p className="text-xs text-muted-foreground">Nenhum id capturado.</p>
                    )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Rastreamento (mensagens que geraram atribuição)
                </p>
                {isLoadingTrackedMessages ? (
                  <p className="text-xs text-muted-foreground">Carregando...</p>
                ) : trackedMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma mensagem rastreada encontrada pra esse telefone.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {trackedMessages.map((msg) => {
                      const isMatched = msg.matchStrategy !== 'UNMATCHED';
                      return (
                        <div
                          key={msg.id}
                          className="bg-secondary/30 border border-border rounded-lg px-3 py-2 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] border px-2 py-0.5 rounded-full font-medium ${
                                isMatched
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                                  : 'bg-secondary text-muted-foreground border-border'
                              }`}
                            >
                              {matchStrategyLabel(msg.matchStrategy)}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {format(new Date(msg.receivedAt), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/90 break-words line-clamp-2">
                            &ldquo;{msg.text}&rdquo;
                          </p>
                          {msg.matchedMappedAd && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Megaphone size={11} />
                              {msg.matchedMappedAd.adName} · {msg.matchedMappedAd.campaignName} (
                              {msg.matchedMappedAd.platform})
                            </p>
                          )}
                          {msg.matchedTrackingLink && (
                            <p className="text-[11px] text-muted-foreground">
                              Link: {msg.matchedTrackingLink.label}
                            </p>
                          )}
                          {msg.channel && (
                            <p className="text-[11px] text-muted-foreground">
                              Recebido via{' '}
                              {msg.channel === 'whatsapp_lite'
                                ? 'WhatsApp Lite (QR Code)'
                                : 'WhatsApp (API oficial)'}
                            </p>
                          )}
                          <p
                            className="text-[11px] text-muted-foreground"
                            title={msg.kommoSyncError ?? undefined}
                          >
                            Sincronização Kommo: {msg.kommoSyncStatus}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Eventos de conversão</p>
                {selectedLead.conversionEventLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum evento disparado ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedLead.conversionEventLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const errorDetail = parseErrorDetail(log.errorMessage);
                      const successDetail = parseSuccessDetail(log.responseDetail, log.platform);
                      return (
                        <div
                          key={log.id}
                          className="bg-secondary/30 border border-border rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedLogId((prev) => (prev === log.id ? null : log.id))
                            }
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {log.eventName} · {log.journeyStage.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {log.platform} ·{' '}
                                {format(new Date(log.sentAt ?? log.createdAt), 'dd/MM/yyyy HH:mm')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[11px] border px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses(log.status)}`}
                              >
                                {log.status}
                              </span>
                              {log.status === 'FAILED' && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryConversionEvent(selectedLead.id, log.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      retryConversionEvent(selectedLead.id, log.id);
                                    }
                                  }}
                                  title="Tentar novamente"
                                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary cursor-pointer"
                                >
                                  <RotateCw
                                    size={13}
                                    className={retryingLogId === log.id ? 'animate-spin' : ''}
                                  />
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-muted-foreground" />
                              ) : (
                                <ChevronRight size={14} className="text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border px-3 py-2.5 space-y-2 bg-background/40">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                <div>
                                  <span className="text-muted-foreground">Tentativas: </span>
                                  <span className="font-medium">{log.attempts}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Criado em: </span>
                                  <span className="font-medium">
                                    {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                                  </span>
                                </div>
                                {log.sentAt && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Enviado em: </span>
                                    <span className="font-medium">
                                      {format(new Date(log.sentAt), 'dd/MM/yyyy HH:mm')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {log.status === 'SENT' && (
                                <div className="space-y-1.5">
                                  <div className="bg-green-500/10 border border-green-500/20 rounded-md px-2.5 py-2 space-y-0.5">
                                    <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">
                                      Evento confirmado na plataforma — sem erros.
                                    </p>
                                    {successDetail?.eventsReceived != null && (
                                      <p className="text-[11px] text-green-600/90 dark:text-green-400/90">
                                        Eventos recebidos: {successDetail.eventsReceived}
                                      </p>
                                    )}
                                    {successDetail?.fbtraceId && (
                                      <p className="text-[11px] text-green-600/90 dark:text-green-400/90">
                                        fbtrace_id: {successDetail.fbtraceId}
                                      </p>
                                    )}
                                  </div>
                                  {successDetail?.raw && (
                                    <details className="text-[11px]">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                        Detalhes técnicos
                                      </summary>
                                      <pre className="mt-1 whitespace-pre-wrap break-all bg-secondary/50 border border-border rounded-md p-2 font-mono text-[10px] text-muted-foreground max-h-40 overflow-y-auto">
                                        {successDetail.raw}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              )}

                              {errorDetail && (
                                <div className="space-y-1.5">
                                  {(errorDetail.title || errorDetail.description) && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-2 space-y-0.5">
                                      {errorDetail.title && (
                                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                          {errorDetail.title}
                                        </p>
                                      )}
                                      {errorDetail.description && (
                                        <p className="text-[11px] text-red-600/90 dark:text-red-400/90">
                                          {errorDetail.description}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <details className="text-[11px]">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                      Detalhes técnicos
                                    </summary>
                                    <pre className="mt-1 whitespace-pre-wrap break-all bg-secondary/50 border border-border rounded-md p-2 font-mono text-[10px] text-muted-foreground max-h-40 overflow-y-auto">
                                      {errorDetail.raw}
                                    </pre>
                                  </details>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
