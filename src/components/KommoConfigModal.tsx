import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Plus,
  Trash2,
  X,
  RotateCcw,
  Layers,
  Link,
  GripVertical,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Select } from '@/components/ui/Select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KommoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface KommoPipeline {
  id: number;
  name: string;
  isMain: boolean;
  statuses: { id: number; name: string; sort: number }[];
}

// Kommo/amoCRM reserves these two status ids for every pipeline's built-in "won"/"lost" columns
// — used to suggest a default "Compra" stage without the client having to know this themselves.
const KOMMO_WON_STATUS_ID = 142;

function buildSuggestedJourneyStages(pipelines: KommoPipeline[]): JourneyStageForm[] {
  const mainPipeline = pipelines.find((p) => p.isMain) ?? pipelines[0];
  if (!mainPipeline || mainPipeline.statuses.length === 0) return [];

  const suggestions: JourneyStageForm[] = [];
  const sorted = mainPipeline.statuses.slice().sort((a, b) => a.sort - b.sort);

  const firstStatus = sorted.find((s) => s.id !== KOMMO_WON_STATUS_ID) ?? sorted[0];
  suggestions.push({
    _key: newStageKey(),
    label: 'Lead criado',
    kommoPipelineId: mainPipeline.id,
    kommoStatusId: firstStatus.id,
    metaEventName: 'Lead',
    googleConversionActionId: '',
  });

  const wonStatus = mainPipeline.statuses.find((s) => s.id === KOMMO_WON_STATUS_ID);
  if (wonStatus) {
    suggestions.push({
      _key: newStageKey(),
      label: 'Compra',
      kommoPipelineId: mainPipeline.id,
      kommoStatusId: wonStatus.id,
      metaEventName: 'Purchase',
      googleConversionActionId: '',
    });
  }

  return suggestions;
}

interface GoogleConversionActionOption {
  id: string;
  name: string;
  resourceName: string;
}

interface JourneyStageForm {
  _key: string; // client-only stable key (dnd-kit + React list key) — not persisted
  id?: string; // JourneyStage.id once saved
  label: string;
  kommoPipelineId: number | null;
  kommoStatusId: number | null;
  metaEventName: string;
  googleConversionActionId: string;
}

const META_EVENT_SUGGESTIONS = [
  'Lead',
  'Schedule',
  'Contact',
  'SubmitApplication',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'CompleteRegistration',
];

function newStageKey() {
  return Math.random().toString(36).slice(2);
}

interface SortableStageCardProps {
  stage: JourneyStageForm;
  index: number;
  pipelines: KommoPipeline[];
  googleActions: GoogleConversionActionOption[];
  onChange: (key: string, patch: Partial<JourneyStageForm>) => void;
  onRemove: (key: string) => void;
}

const SortableStageCard = ({
  stage,
  index,
  pipelines,
  googleActions,
  onChange,
  onRemove,
}: SortableStageCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage._key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusesForPipeline = pipelines.find((p) => p.id === stage.kommoPipelineId)?.statuses ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="space-y-3 bg-secondary/30 p-4 rounded-xl border border-border"
    >
      <div className="flex items-center gap-3">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold border border-brand-500/20 shrink-0">
          {index + 1}
        </span>
        <input
          value={stage.label}
          onChange={(e) => onChange(stage._key, { label: e.target.value })}
          placeholder="Rótulo da etapa (ex: Agendado)"
          className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          onClick={() => onRemove(stage._key)}
          className="text-muted-foreground hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
          title="Remover etapa"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Pipeline (Kommo)</label>
          <Select
            options={pipelines.map((p) => ({ value: String(p.id), label: p.name }))}
            value={stage.kommoPipelineId != null ? String(stage.kommoPipelineId) : ''}
            onChange={(val) =>
              onChange(stage._key, { kommoPipelineId: Number(val), kommoStatusId: null })
            }
            placeholder="Selecione o pipeline..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Etapa (Kommo)</label>
          <Select
            options={statusesForPipeline.map((s) => ({ value: String(s.id), label: s.name }))}
            value={stage.kommoStatusId != null ? String(stage.kommoStatusId) : ''}
            onChange={(val) => {
              const statusName = statusesForPipeline.find((s) => s.id === Number(val))?.name;
              onChange(stage._key, {
                kommoStatusId: Number(val),
                label: stage.label || statusName || '',
              });
            }}
            placeholder={
              stage.kommoPipelineId ? 'Selecione a etapa...' : 'Escolha o pipeline primeiro'
            }
            disabled={!stage.kommoPipelineId}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Evento Meta (opcional)</label>
          <input
            value={stage.metaEventName}
            onChange={(e) => onChange(stage._key, { metaEventName: e.target.value })}
            list="meta-event-suggestions"
            placeholder="Nenhum"
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Ação de conversão Google (opcional)
          </label>
          <Select
            options={[
              { value: '', label: 'Nenhuma' },
              ...googleActions.map((a) => ({ value: a.resourceName, label: a.name })),
            ]}
            value={stage.googleConversionActionId}
            onChange={(val) => onChange(stage._key, { googleConversionActionId: val })}
          />
        </div>
      </div>
    </div>
  );
};

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ isOpen, onConfirm, onCancel }: ConfirmDialogProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-xl shadow-2xl border border-border p-6 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Tem certeza?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Leads e eventos já registrados nessa etapa impedem a remoção — esta ação não pode ser
            desfeita.
          </p>
        </div>
        <div className="flex gap-3 w-full pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-foreground bg-secondary/50 hover:bg-secondary rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-lg shadow-red-500/20"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export const KommoConfigModal: React.FC<KommoConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado do formulário
  const [isActive, setIsActive] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [journeyStages, setJourneyStages] = useState<JourneyStageForm[]>([]);
  const [pipelines, setPipelines] = useState<KommoPipeline[]>([]);
  const [googleActions, setGoogleActions] = useState<GoogleConversionActionOption[]>([]);

  // Estado de confirmação de remoção
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);

  const loadJourneyStages = useCallback(async (): Promise<JourneyStageForm[]> => {
    const res = await fetch('/api/journey-stages');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.stages ?? []).map(
      (s: {
        id: string;
        label: string;
        kommoPipelineId: number;
        kommoStatusId: number;
        metaEventName: string | null;
        googleConversionActionId: string | null;
      }) => ({
        _key: newStageKey(),
        id: s.id,
        label: s.label,
        kommoPipelineId: s.kommoPipelineId,
        kommoStatusId: s.kommoStatusId,
        metaEventName: s.metaEventName ?? '',
        googleConversionActionId: s.googleConversionActionId ?? '',
      }),
    );
  }, []);

  const loadAvailableOptions = useCallback(async (): Promise<{ pipelines: KommoPipeline[] }> => {
    const [stagesRes, actionsRes] = await Promise.all([
      fetch('/api/kommo-pipeline-mapping/available-stages'),
      fetch('/api/google-conversion-mapping/available-actions'),
    ]);
    let loadedPipelines: KommoPipeline[] = [];
    if (stagesRes.ok) {
      const data = await stagesRes.json();
      loadedPipelines = data.pipelines ?? [];
      setPipelines(loadedPipelines);
    }
    if (actionsRes.ok) {
      const data = await actionsRes.json();
      setGoogleActions(data.actions ?? []);
    }
    return { pipelines: loadedPipelines };
  }, []);

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
          const [stages, { pipelines: loadedPipelines }] = await Promise.all([
            loadJourneyStages(),
            loadAvailableOptions(),
          ]);
          // First time configuring the journey (no stages saved yet) — pre-fill a sensible
          // starting point instead of an empty form, per the user's request for default
          // "Lead criado"/"Compra" stages at the start/end of the funnel.
          setJourneyStages(
            stages.length === 0 ? buildSuggestedJourneyStages(loadedPipelines) : stages,
          );
        } catch (error) {
          console.error('Erro ao carregar configurações:', error);
          showToast('Erro ao carregar configurações.', 'error');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, showToast, loadJourneyStages, loadAvailableOptions]);

  const handleSave = async () => {
    const incomplete = journeyStages.some(
      (s) => !s.label.trim() || s.kommoPipelineId == null || s.kommoStatusId == null,
    );
    if (incomplete) {
      showToast('Preencha rótulo, pipeline e etapa em todas as linhas da jornada.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, journeyMap: [] }),
      });
      if (!res.ok) throw new Error('Falha ao salvar configuração');

      const stagesRes = await fetch('/api/journey-stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stages: journeyStages.map((s, index) => ({
            id: s.id,
            label: s.label.trim(),
            order: index,
            kommoPipelineId: s.kommoPipelineId,
            kommoStatusId: s.kommoStatusId,
            metaEventName: s.metaEventName.trim() || null,
            googleConversionActionId: s.googleConversionActionId || null,
          })),
        }),
      });
      if (!stagesRes.ok) throw new Error('Falha ao salvar a jornada');

      // 2. Buscar dados iniciais (Validação e Cache)
      const today = new Date().toISOString().split('T')[0];
      const dataRes = await fetch(`/api/integrations/kommo/data?since=${today}&until=${today}`);

      if (!dataRes.ok) {
        console.warn('Configuração salva, mas falha ao testar conexão de dados.');
        showToast('Configuração salva, mas houve um erro ao testar a conexão.', 'error');
      } else {
        showToast('Integração e jornada salvas com sucesso!', 'success');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('Erro ao salvar e testar integração. Verifique o subdomínio.', 'error');
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

  const addStage = () => {
    setJourneyStages([
      ...journeyStages,
      {
        _key: newStageKey(),
        label: '',
        kommoPipelineId: null,
        kommoStatusId: null,
        metaEventName: '',
        googleConversionActionId: '',
      },
    ]);
  };

  const updateStage = (key: string, patch: Partial<JourneyStageForm>) => {
    setJourneyStages((stages) => stages.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  };

  const requestRemoveStage = (key: string) => {
    const stage = journeyStages.find((s) => s._key === key);
    if (stage?.id) {
      setPendingRemoveKey(key);
    } else {
      // never saved — safe to drop locally without confirming
      setJourneyStages((stages) => stages.filter((s) => s._key !== key));
    }
  };

  const confirmRemoveStage = async () => {
    const stage = journeyStages.find((s) => s._key === pendingRemoveKey);
    setPendingRemoveKey(null);
    if (!stage?.id) return;
    try {
      const res = await fetch(`/api/journey-stages/${stage.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao remover etapa');
      setJourneyStages((stages) => stages.filter((s) => s._key !== stage._key));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover etapa', 'error');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setJourneyStages((items) => {
        const oldIndex = items.findIndex((s) => s._key === active.id);
        const newIndex = items.findIndex((s) => s._key === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
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

              {/* Jornada do lead */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-brand-500" />
                  <label className="block text-sm font-medium text-foreground">
                    Jornada do Lead
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada etapa é ligada a um pipeline/etapa real do Kommo. Quando um lead entra numa
                  etapa configurada aqui, o evento de conversão correspondente é disparado pra Meta
                  e/ou Google automaticamente. A ordem também define o funil exibido no dashboard.
                </p>

                {pipelines.length === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-600">
                    <AlertTriangle size={16} />
                    Não foi possível carregar os pipelines do Kommo — confira se a integração está
                    conectada.
                  </div>
                )}

                <datalist id="meta-event-suggestions">
                  {META_EVENT_SUGGESTIONS.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>

                <div className="space-y-3">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={journeyStages.map((s) => s._key)}
                      strategy={verticalListSortingStrategy}
                    >
                      {journeyStages.map((stage, index) => (
                        <SortableStageCard
                          key={stage._key}
                          stage={stage}
                          index={index}
                          pipelines={pipelines}
                          googleActions={googleActions}
                          onChange={updateStage}
                          onRemove={requestRemoveStage}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                <button
                  onClick={addStage}
                  className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-brand-500 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Plus size={18} />
                  Adicionar Etapa
                </button>
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

      <ConfirmDialog
        isOpen={pendingRemoveKey !== null}
        onConfirm={confirmRemoveStage}
        onCancel={() => setPendingRemoveKey(null)}
      />
    </div>
  );
};
