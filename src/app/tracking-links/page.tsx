'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Menu, Plus, Trash2, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';

interface TrackingLink {
  id: string;
  label: string;
  waNumber: string;
  messageTemplate: string;
  codingStrategy: 'INVISIBLE' | 'VISIBLE_CODE' | 'TIME_WINDOW';
  createdAt: string;
}

const STRATEGY_OPTIONS = [
  { value: 'INVISIBLE', label: 'Caracteres invisíveis (padrão)' },
  { value: 'VISIBLE_CODE', label: 'Código curto visível' },
  { value: 'TIME_WINDOW', label: 'Só por janela de tempo (sem código)' },
];

interface KommoField {
  id: number;
  name: string;
  code: string | null;
}

const FIELD_MAPPING_KEYS = [
  { key: 'utmSourceFieldId', label: 'UTM Source' },
  { key: 'utmMediumFieldId', label: 'UTM Medium' },
  { key: 'utmCampaignFieldId', label: 'UTM Campaign' },
  { key: 'utmContentFieldId', label: 'UTM Content' },
  { key: 'utmTermFieldId', label: 'UTM Term' },
  { key: 'fbclidFieldId', label: 'Facebook Click ID (fbclid)' },
  { key: 'gclidFieldId', label: 'Google Click ID (gclid)' },
] as const;

export default function TrackingLinksPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [waNumber, setWaNumber] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá! Quero saber mais.');
  const [codingStrategy, setCodingStrategy] = useState<TrackingLink['codingStrategy']>('INVISIBLE');
  const [isSaving, setIsSaving] = useState(false);

  const [fieldMapping, setFieldMapping] = useState<Record<string, number | null>>({});
  const [availableFields, setAvailableFields] = useState<KommoField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Lazy initializer instead of an effect — window is only unavailable during SSR, and this
  // component never renders there ('use client' + session-gated content).
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tracking-links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFieldMapping = useCallback(async () => {
    const res = await fetch('/api/kommo-field-mapping');
    if (res.ok) {
      const data = await res.json();
      setFieldMapping(data ?? {});
    }
  }, []);

  useEffect(() => {
    // Data fetch on mount — the setState calls happen asynchronously inside these callbacks,
    // after an await, not synchronously in the effect body; this is the standard "fetch on
    // mount" pattern React's own docs endorse, which this lint rule is known to flag anyway.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLinks();
    fetchFieldMapping();
  }, [fetchLinks, fetchFieldMapping]);

  const loadAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const res = await fetch('/api/kommo-field-mapping/available-fields');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar campos');
      setAvailableFields(data.fields ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao buscar campos do Kommo', 'error');
    } finally {
      setIsLoadingFields(false);
    }
  };

  const saveFieldMapping = async () => {
    const res = await fetch('/api/kommo-field-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldMapping),
    });
    if (res.ok) {
      showToast('Mapeamento de campos salvo!', 'success');
    } else {
      showToast('Erro ao salvar mapeamento', 'error');
    }
  };

  const createLink = async () => {
    if (!label.trim() || !waNumber.trim() || !messageTemplate.trim()) {
      showToast('Preencha todos os campos.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/tracking-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, waNumber, messageTemplate, codingStrategy }),
      });
      if (!res.ok) throw new Error('Falha ao criar link');
      setLabel('');
      setWaNumber('');
      setMessageTemplate('Olá! Quero saber mais.');
      setCodingStrategy('INVISIBLE');
      await fetchLinks();
      showToast('Link de rastreamento criado!', 'success');
    } catch {
      showToast('Erro ao criar link de rastreamento', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLink = async (id: string) => {
    if (!confirm('Remover este link de rastreamento?')) return;
    await fetch(`/api/tracking-links/${id}`, { method: 'DELETE' });
    await fetchLinks();
  };

  const copySnippet = (link: TrackingLink) => {
    // Fallback href is a real (untracked) wa.me link, not "#" — some sites run their own
    // smooth-scroll/anchor scripts that call document.querySelector(this.getAttribute('href'))
    // on click, which throws once our script rewrites "#" into a full URL. A real link also
    // means the button still works if our script fails to load at all.
    const fallbackHref = `https://wa.me/${link.waNumber}`;
    const snippet = `<a href="${fallbackHref}" data-trackflow-link="${link.id}">Fale conosco no WhatsApp</a>`;
    navigator.clipboard.writeText(snippet);
    showToast('Trecho HTML copiado!', 'success');
  };

  const pixelSnippet =
    session?.user?.clientId && origin
      ? `<script src="${origin}/api/public/pixel/script/${session.user.clientId}" async></script>`
      : '';

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
            <h1 className="text-xl font-bold text-foreground">Rastreamento de Leads</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Pixel snippet */}
            <section className="bg-card border border-border rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-bold">1. Instale o pixel no seu site</h2>
              <p className="text-sm text-muted-foreground">
                Cole este trecho antes do fechamento da tag <code>&lt;/body&gt;</code> do seu site.
              </p>
              <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-3">
                <code className="text-xs break-all flex-1">{pixelSnippet}</code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(pixelSnippet);
                    showToast('Trecho do pixel copiado!', 'success');
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </section>

            {/* Tracking links */}
            <section className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold">2. Crie os links dos botões de WhatsApp</h2>
              <p className="text-sm text-muted-foreground">
                Pra cada botão do site que leva pro WhatsApp, crie um link aqui, copie o trecho HTML
                gerado e cole no lugar do botão no seu site — o pixel cuida do resto.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="border border-border rounded-lg px-3 py-2 bg-background"
                  placeholder="Nome (ex: Botão Hero)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <input
                  className="border border-border rounded-lg px-3 py-2 bg-background"
                  placeholder="Número do WhatsApp (ex: 5511999998888)"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                />
                <textarea
                  className="border border-border rounded-lg px-3 py-2 bg-background md:col-span-2"
                  placeholder="Mensagem que o visitante vai enviar"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={2}
                />
                <Select
                  options={STRATEGY_OPTIONS}
                  value={codingStrategy}
                  onChange={(v) => setCodingStrategy(v as TrackingLink['codingStrategy'])}
                />
                <Button onClick={createLink} disabled={isSaving}>
                  <Plus size={16} className="mr-2" /> Criar link
                </Button>
              </div>

              <div className="space-y-2 pt-4">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : links.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum link criado ainda.</p>
                ) : (
                  links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between border border-border rounded-lg p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{link.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {link.waNumber} ·{' '}
                          {STRATEGY_OPTIONS.find((s) => s.value === link.codingStrategy)?.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copySnippet(link)}>
                          <Copy size={14} className="mr-1" /> Copiar HTML
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteLink(link.id)}>
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Kommo field mapping */}
            <section className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold">3. Mapeie os campos do Kommo</h2>
              <p className="text-sm text-muted-foreground">
                Diga em qual campo personalizado do seu Kommo cada dado de rastreamento deve ser
                gravado quando um lead for identificado.
              </p>
              <Button variant="outline" onClick={loadAvailableFields} disabled={isLoadingFields}>
                {isLoadingFields ? 'Buscando...' : 'Buscar campos do Kommo'}
              </Button>

              {availableFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {FIELD_MAPPING_KEYS.map(({ key, label: fieldLabel }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {fieldLabel}
                      </label>
                      <Select
                        options={[
                          { value: '', label: '— não mapear —' },
                          ...availableFields.map((f) => ({
                            value: String(f.id),
                            label: f.name,
                          })),
                        ]}
                        value={fieldMapping[key] ? String(fieldMapping[key]) : ''}
                        onChange={(v) =>
                          setFieldMapping((prev) => ({
                            ...prev,
                            [key]: v ? Number(v) : null,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {availableFields.length > 0 && (
                <Button onClick={saveFieldMapping}>Salvar mapeamento</Button>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
