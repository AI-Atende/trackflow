'use client';

import { useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Plus, Trash2, Copy, QrCode, Download, X, ExternalLink, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';

export interface RedirectLinkRow {
  id: string;
  label: string;
  slug: string | null;
  waNumber: string;
  messageTemplate: string;
  codingStrategy: 'INVISIBLE' | 'VISIBLE_CODE' | 'TIME_WINDOW';
  timeWindowFallback: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  redirectUrl: string | null;
  visits: number;
  conversations: number;
}

interface WhatsAppNumber {
  phoneNumberId: string;
  displayNumber: string;
}

const OTHER_NUMBER = '__other__';

type Strategy = RedirectLinkRow['codingStrategy'];

const STRATEGY_INFO: Record<Strategy, { label: string; risk: string }> = {
  INVISIBLE: {
    label: 'Caracteres invisíveis',
    risk: 'O código vai escondido no texto da mensagem — discreto, mas se a pessoa apagar ou editar a mensagem antes de enviar, a atribuição se perde. Alguns teclados e aparelhos também removem caracteres invisíveis.',
  },
  VISIBLE_CODE: {
    label: 'Código curto visível',
    risk: 'Adiciona "— ref: abc123" ao fim da mensagem. Sobrevive melhor do que o invisível, mas a pessoa enxerga o código e pode apagá-lo antes de enviar.',
  },
  TIME_WINDOW: {
    label: 'Só por janela de tempo (sem código)',
    risk: 'Nenhum código na mensagem: o lead é associado à visita mais recente que ainda não virou mensagem (últimos 30 min). Se duas pessoas clicarem em sequência, a atribuição pode ir para a pessoa errada.',
  },
};

const STRATEGY_OPTIONS = (Object.keys(STRATEGY_INFO) as Strategy[]).map((value) => ({
  value,
  label: STRATEGY_INFO[value].label,
}));

function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-/, '');
}

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

export function RedirectLinksSection({
  links,
  registeredNumbers,
  isLoading,
  onChanged,
}: {
  links: RedirectLinkRow[];
  registeredNumbers: WhatsAppNumber[];
  isLoading: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { showToast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [numberChoice, setNumberChoice] = useState(OTHER_NUMBER);
  const [waNumber, setWaNumber] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá! Quero saber mais.');
  const [codingStrategy, setCodingStrategy] = useState<Strategy>('VISIBLE_CODE');
  const [timeWindowFallback, setTimeWindowFallback] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Set while the form is editing an existing link instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);

  const [qrLink, setQrLink] = useState<RedirectLinkRow | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);

  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (!slugTouched && !editingId) setSlug(slugify(value));
  };

  const handleNumberChoice = (choice: string) => {
    setNumberChoice(choice);
    if (choice === OTHER_NUMBER) {
      setWaNumber('');
      return;
    }
    const selected = registeredNumbers.find((n) => n.phoneNumberId === choice);
    // wa.me needs plain digits — the portal's displayNumber is formatted for humans (+55 11 ...).
    setWaNumber(selected ? selected.displayNumber.replace(/\D/g, '') : '');
  };

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setSlug('');
    setSlugTouched(false);
    setNumberChoice(OTHER_NUMBER);
    setWaNumber('');
    setMessageTemplate('Olá! Quero saber mais.');
    setCodingStrategy('VISIBLE_CODE');
    setTimeWindowFallback(false);
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmContent('');
  };

  const startEdit = (link: RedirectLinkRow) => {
    setEditingId(link.id);
    setLabel(link.label);
    setSlug(link.slug ?? '');
    setSlugTouched(true);
    const registered = registeredNumbers.find(
      (n) => n.displayNumber.replace(/\D/g, '') === link.waNumber,
    );
    setNumberChoice(registered ? registered.phoneNumberId : OTHER_NUMBER);
    setWaNumber(link.waNumber);
    setMessageTemplate(link.messageTemplate);
    setCodingStrategy(link.codingStrategy);
    setTimeWindowFallback(link.timeWindowFallback);
    setUtmSource(link.utmSource ?? '');
    setUtmMedium(link.utmMedium ?? '');
    setUtmCampaign(link.utmCampaign ?? '');
    setUtmContent(link.utmContent ?? '');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveLink = async () => {
    if (!label.trim() || !slug.trim() || !waNumber.trim() || !messageTemplate.trim()) {
      showToast('Preencha nome, endereço, número e mensagem.', 'error');
      return;
    }
    const isEditing = editingId !== null;
    setIsSaving(true);
    try {
      // The slug is deliberately not sent on edit — it can't change (it's baked into printed QR
      // codes), and the API rejects a different one.
      const res = await fetch(
        isEditing ? `/api/tracking-links/${editingId}` : '/api/tracking-links',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label,
            ...(isEditing ? {} : { slug }),
            waNumber,
            messageTemplate,
            codingStrategy,
            timeWindowFallback: codingStrategy !== 'TIME_WINDOW' && timeWindowFallback,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar o link');

      resetForm();
      await onChanged();
      showToast(isEditing ? 'Link atualizado!' : 'Link criado!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar o link', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLink = async (link: RedirectLinkRow) => {
    if (
      !confirm(
        `Excluir "${link.label}"? O endereço e qualquer QR code já impresso ou publicado deixam de funcionar (a pessoa verá "Link não encontrado").`,
      )
    ) {
      return;
    }
    await fetch(`/api/tracking-links/${link.id}`, { method: 'DELETE' });
    if (editingId === link.id) resetForm();
    await onChanged();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Link copiado!', 'success');
  };

  const openQr = async (link: RedirectLinkRow) => {
    if (!link.redirectUrl) return;
    setQrLink(link);
    setQrPng(null);
    try {
      setQrPng(await QRCode.toDataURL(link.redirectUrl, { width: 1024, margin: 2 }));
    } catch {
      showToast('Não foi possível gerar o QR code.', 'error');
      setQrLink(null);
    }
  };

  const downloadSvg = async (link: RedirectLinkRow) => {
    if (!link.redirectUrl) return;
    const svg = await QRCode.toString(link.redirectUrl, { type: 'svg', margin: 2 });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(url, `qr-${link.slug}.svg`);
    URL.revokeObjectURL(url);
  };

  const inputClass = 'border border-border rounded-lg px-3 py-2 bg-background';

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-bold">3. Links e QR codes para o WhatsApp</h2>
      <p className="text-sm text-muted-foreground">
        Gere um link (ou QR code) que leva direto ao WhatsApp e já rastreia quem veio por ele —
        funciona em qualquer lugar: bio do Instagram, panfleto, cartão, anúncio, e-mail. Não precisa
        do pixel no site.
      </p>

      <div ref={formRef} className="grid grid-cols-1 md:grid-cols-2 gap-3 scroll-mt-4">
        {editingId && (
          <p className="md:col-span-2 text-sm bg-brand-500/10 border border-brand-500/40 rounded-lg px-3 py-2">
            Editando um link existente. As mudanças valem a partir do próximo clique; visitas já
            registradas mantêm a origem (UTMs) que tinham. O QR code continua o mesmo.
          </p>
        )}
        <input
          className={inputClass}
          placeholder="Nome (ex: Panfleto Centro)"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
        <div className="space-y-1">
          <input
            className={`${inputClass} w-full font-mono text-sm`}
            placeholder="endereco-do-link (ex: panfleto-centro)"
            value={slug}
            disabled={editingId !== null}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
          <p className="text-xs text-muted-foreground">
            {editingId
              ? 'O endereço não pode ser alterado: QR codes já impressos deixariam de funcionar.'
              : 'Só letras minúsculas, números e hífen. Não pode repetir entre os seus links.'}
          </p>
        </div>

        <div className="space-y-2">
          <Select
            options={[
              ...registeredNumbers.map((n) => ({ value: n.phoneNumberId, label: n.displayNumber })),
              { value: OTHER_NUMBER, label: 'Outro número...' },
            ]}
            value={numberChoice}
            onChange={handleNumberChoice}
            placeholder="Número do WhatsApp"
          />
          {numberChoice === OTHER_NUMBER && (
            <input
              className={`${inputClass} w-full`}
              placeholder="Número do WhatsApp (ex: 5511999998888)"
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
            />
          )}
        </div>
        <textarea
          className={inputClass}
          placeholder="Mensagem que a pessoa vai enviar"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          rows={2}
        />

        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Como identificar quem enviou a mensagem
          </label>
          <Select
            options={STRATEGY_OPTIONS}
            value={codingStrategy}
            onChange={(v) => setCodingStrategy(v as Strategy)}
          />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {STRATEGY_INFO[codingStrategy].risk}
          </p>
          {codingStrategy !== 'TIME_WINDOW' && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={timeWindowFallback}
                onChange={(e) => setTimeWindowFallback(e.target.checked)}
              />
              <span>
                Se a pessoa apagar o código, tentar associar à visita mais recente (últimos 30 min).
                <span className="block text-xs text-amber-600 dark:text-amber-400">
                  Recupera atribuições que se perderiam, mas pode creditar o lead errado quando
                  várias pessoas clicam em sequência.
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Origem (opcional) — identifica este link nos relatórios. Parâmetros utm_* digitados no
            próprio link têm prioridade.
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input
              className={inputClass}
              placeholder="utm_source (ex: panfleto)"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="utm_medium (ex: offline)"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="utm_campaign"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="utm_content"
              value={utmContent}
              onChange={(e) => setUtmContent(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-2 flex gap-2">
          <Button onClick={saveLink} disabled={isSaving} className="flex-1">
            {editingId ? (
              <>
                <Save size={16} className="mr-2" /> Salvar alterações
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" /> Criar link
              </>
            )}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm} disabled={isSaving}>
              Cancelar
            </Button>
          )}
        </div>
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
              className={`border rounded-lg p-3 space-y-2 ${
                editingId === link.id ? 'border-brand-500' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{link.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.waNumber} · {STRATEGY_INFO[link.codingStrategy].label}
                    {link.codingStrategy !== 'TIME_WINDOW' && link.timeWindowFallback
                      ? ' + janela de tempo'
                      : ''}
                    {link.utmSource ? ` · origem: ${link.utmSource}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>
                    <span className="font-semibold text-foreground">{link.visits}</span> visita(s)
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">{link.conversations}</span>{' '}
                    conversa(s)
                  </p>
                </div>
              </div>

              {link.redirectUrl && (
                <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
                  <code className="text-xs break-all flex-1">{link.redirectUrl}</code>
                  <Button variant="outline" size="icon" onClick={() => copyUrl(link.redirectUrl!)}>
                    <Copy size={16} />
                  </Button>
                  <a
                    href={link.redirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Testar o link"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <Button variant="outline" size="icon" onClick={() => openQr(link)}>
                    <QrCode size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Editar"
                    onClick={() => startEdit(link)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLink(link)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {qrLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrLink(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold truncate">{qrLink.label}</h3>
                <p className="text-xs text-muted-foreground break-all">{qrLink.redirectUrl}</p>
              </div>
              <button
                onClick={() => setQrLink(null)}
                className="p-1 rounded-md hover:bg-secondary shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-white rounded-lg p-2 flex items-center justify-center min-h-64">
              {qrPng ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrPng} alt={`QR code de ${qrLink.label}`} className="w-full h-auto" />
              ) : (
                <p className="text-sm text-slate-500">Gerando...</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!qrPng}
                onClick={() => qrPng && download(qrPng, `qr-${qrLink.slug}.png`)}
              >
                <Download size={16} className="mr-2" /> PNG
              </Button>
              <Button variant="outline" onClick={() => downloadSvg(qrLink)}>
                <Download size={16} className="mr-2" /> SVG
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O QR code aponta para o endereço acima. Se o link for excluído, QR codes já impressos
              deixam de funcionar.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
