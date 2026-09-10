import React, { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, X, AlertTriangle, GripVertical } from 'lucide-react';
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

interface JourneyConfigModalProps {
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

/** The journey always has exactly one FIRST ("Lead criado") and one LAST ("Compra") stage — only
 * their Kommo pipeline/status mapping is configurable. Builds both, best-effort pre-filled from
 * the main pipeline's first status / built-in "won" status when available, unconfigured
 * (pipeline/status left null, for the client to pick) otherwise — but always both, never zero. */
function buildFixedJourneyStages(pipelines: KommoPipeline[]): {
  first: JourneyStageForm;
  last: JourneyStageForm;
} {
  const mainPipeline = pipelines.find((p) => p.isMain) ?? pipelines[0];
  const sorted = mainPipeline?.statuses.slice().sort((a, b) => a.sort - b.sort) ?? [];

  const firstStatus = sorted.find((s) => s.id !== KOMMO_WON_STATUS_ID) ?? sorted[0];
  const wonStatus = sorted.find((s) => s.id === KOMMO_WON_STATUS_ID);

  return {
    first: {
      _key: newStageKey(),
      label: 'Lead criado',
      position: 'FIRST',
      kommoPipelineId: mainPipeline && firstStatus ? mainPipeline.id : null,
      kommoStatusId: firstStatus?.id ?? null,
      metaEventName: 'Lead',
      googleConversionActionId: '',
    },
    last: {
      _key: newStageKey(),
      label: 'Compra',
      position: 'LAST',
      kommoPipelineId: mainPipeline && wonStatus ? mainPipeline.id : null,
      kommoStatusId: wonStatus?.id ?? null,
      metaEventName: 'Purchase',
      googleConversionActionId: '',
    },
  };
}

/** Guarantees the FIRST/LAST bookends exist in a loaded stage list — backfills them (using the
 * same best-effort defaults as a brand-new journey) if a client's existing journey predates this
 * requirement, or if they were somehow deleted. */
function ensureFixedStages(
  stages: JourneyStageForm[],
  pipelines: KommoPipeline[],
): JourneyStageForm[] {
  const hasFirst = stages.some((s) => s.position === 'FIRST');
  const hasLast = stages.some((s) => s.position === 'LAST');
  if (hasFirst && hasLast) return stages;

  const { first, last } = buildFixedJourneyStages(pipelines);
  const middle = stages.filter((s) => s.position === 'MIDDLE');
  return [
    ...(hasFirst ? stages.filter((s) => s.position === 'FIRST') : [first]),
    ...middle,
    ...(hasLast ? stages.filter((s) => s.position === 'LAST') : [last]),
  ];
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
  position: 'FIRST' | 'MIDDLE' | 'LAST';
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

const CREATE_ACTION_VALUE = '__create__';

interface StageCardFieldsProps {
  stage: JourneyStageForm;
  pipelines: KommoPipeline[];
  googleActions: GoogleConversionActionOption[];
  onChange: (key: string, patch: Partial<JourneyStageForm>) => void;
  onCreateGoogleAction: (
    stageKey: string,
    name: string,
    category: 'IMPORTED_LEAD' | 'PURCHASE',
  ) => Promise<void>;
}

/** Pipeline/status/event pickers shared by every stage card — middle (draggable, removable, free
 * label) and the fixed FIRST/LAST bookends (static label, no drag/remove) both render this. */
const StageCardFields = ({
  stage,
  pipelines,
  googleActions,
  onChange,
  onCreateGoogleAction,
}: StageCardFieldsProps) => {
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [newActionName, setNewActionName] = useState('');
  const [newActionCategory, setNewActionCategory] = useState<'IMPORTED_LEAD' | 'PURCHASE'>(
    'IMPORTED_LEAD',
  );
  const [isCreatingActionBusy, setIsCreatingActionBusy] = useState(false);

  const statusesForPipeline = pipelines.find((p) => p.id === stage.kommoPipelineId)?.statuses ?? [];

  return (
    <>
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
              { value: CREATE_ACTION_VALUE, label: '+ Criar nova ação...' },
            ]}
            value={stage.googleConversionActionId}
            onChange={(val) => {
              if (val === CREATE_ACTION_VALUE) {
                setIsCreatingAction(true);
                return;
              }
              onChange(stage._key, { googleConversionActionId: val });
            }}
          />
        </div>
      </div>

      {isCreatingAction && (
        <div className="space-y-2 p-3 bg-card border border-border rounded-lg">
          <p className="text-xs font-medium text-muted-foreground">Nova ação de conversão</p>
          <input
            value={newActionName}
            onChange={(e) => setNewActionName(e.target.value)}
            placeholder="Nome (ex: Compra via WhatsApp)"
            className="w-full px-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <Select
            options={[
              { value: 'IMPORTED_LEAD', label: 'Lead' },
              { value: 'PURCHASE', label: 'Compra' },
            ]}
            value={newActionCategory}
            onChange={(val) => setNewActionCategory(val as 'IMPORTED_LEAD' | 'PURCHASE')}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newActionName.trim()) return;
                setIsCreatingActionBusy(true);
                try {
                  await onCreateGoogleAction(stage._key, newActionName.trim(), newActionCategory);
                  setIsCreatingAction(false);
                  setNewActionName('');
                } finally {
                  setIsCreatingActionBusy(false);
                }
              }}
              disabled={!newActionName.trim() || isCreatingActionBusy}
              className="flex-1 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {isCreatingActionBusy ? 'Criando...' : 'Criar'}
            </button>
            <button
              onClick={() => setIsCreatingAction(false)}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface SortableStageCardProps {
  stage: JourneyStageForm;
  index: number;
  pipelines: KommoPipeline[];
  googleActions: GoogleConversionActionOption[];
  onChange: (key: string, patch: Partial<JourneyStageForm>) => void;
  onRemove: (key: string) => void;
  onCreateGoogleAction: (
    stageKey: string,
    name: string,
    category: 'IMPORTED_LEAD' | 'PURCHASE',
  ) => Promise<void>;
}

/** A middle stage — draggable, removable, freely-labeled. */
const SortableStageCard = ({
  stage,
  index,
  pipelines,
  googleActions,
  onChange,
  onRemove,
  onCreateGoogleAction,
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

      <StageCardFields
        stage={stage}
        pipelines={pipelines}
        googleActions={googleActions}
        onChange={onChange}
        onCreateGoogleAction={onCreateGoogleAction}
      />
    </div>
  );
};

interface FixedStageCardProps {
  stage: JourneyStageForm;
  label: string;
  pipelines: KommoPipeline[];
  googleActions: GoogleConversionActionOption[];
  onChange: (key: string, patch: Partial<JourneyStageForm>) => void;
  onCreateGoogleAction: (
    stageKey: string,
    name: string,
    category: 'IMPORTED_LEAD' | 'PURCHASE',
  ) => Promise<void>;
}

/** The FIRST ("Lead criado") or LAST ("Compra") bookend — always present, never draggable or
 * removable; only its Kommo pipeline/status/event mapping is editable, not its position or name. */
const FixedStageCard = ({
  stage,
  label,
  pipelines,
  googleActions,
  onChange,
  onCreateGoogleAction,
}: FixedStageCardProps) => (
  <div className="space-y-3 bg-secondary/50 p-4 rounded-xl border-2 border-brand-500/20">
    <div className="flex items-center gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold border border-brand-500/20 shrink-0">
        {stage.position === 'FIRST' ? '1' : '∞'}
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-secondary px-2 py-1 rounded-full shrink-0">
        Fixa
      </span>
    </div>

    <StageCardFields
      stage={stage}
      pipelines={pipelines}
      googleActions={googleActions}
      onChange={onChange}
      onCreateGoogleAction={onCreateGoogleAction}
    />
  </div>
);

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

// Deliberately its own top-level config, not nested inside "Configurar Kommo" — the journey/funnel
// is a cross-platform concept (fires events to Meta AND Google), and Kommo is just today's source
// for pipeline/stage data, not a permanent dependency. When TrackFlow's own CRM ships, only the
// "fetch available stages" data source here needs to change — JourneyStage itself is already
// CRM-agnostic (id/label/order + whichever platform events are configured).
export const JourneyConfigModal: React.FC<JourneyConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        position: 'FIRST' | 'LAST' | null;
        kommoPipelineId: number;
        kommoStatusId: number;
        metaEventName: string | null;
        googleConversionActionId: string | null;
      }) => ({
        _key: newStageKey(),
        id: s.id,
        label: s.label,
        position: s.position ?? 'MIDDLE',
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
          const [stages, { pipelines: loadedPipelines }] = await Promise.all([
            loadJourneyStages(),
            loadAvailableOptions(),
          ]);
          // Guarantees FIRST ("Lead criado") and LAST ("Compra") always exist — pre-filled with
          // sensible defaults for a brand-new journey, backfilled for one that predates this.
          setJourneyStages(ensureFixedStages(stages, loadedPipelines));
        } catch (error) {
          console.error('Erro ao carregar a jornada:', error);
          showToast('Erro ao carregar a jornada.', 'error');
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
      const stagesRes = await fetch('/api/journey-stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stages: journeyStages.map((s, index) => ({
            id: s.id,
            label: s.label.trim(),
            position: s.position === 'MIDDLE' ? null : s.position,
            order: index,
            kommoPipelineId: s.kommoPipelineId,
            kommoStatusId: s.kommoStatusId,
            metaEventName: s.metaEventName.trim() || null,
            googleConversionActionId: s.googleConversionActionId || null,
          })),
        }),
      });
      if (!stagesRes.ok) throw new Error('Falha ao salvar a jornada');

      showToast('Jornada salva com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar a jornada:', error);
      showToast('Erro ao salvar a jornada.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addStage = () => {
    const newStage: JourneyStageForm = {
      _key: newStageKey(),
      label: '',
      position: 'MIDDLE',
      kommoPipelineId: null,
      kommoStatusId: null,
      metaEventName: '',
      googleConversionActionId: '',
    };
    // Always inserted just before LAST — the funnel's end stays the end.
    setJourneyStages((stages) => {
      const lastIndex = stages.findIndex((s) => s.position === 'LAST');
      if (lastIndex === -1) return [...stages, newStage];
      return [...stages.slice(0, lastIndex), newStage, ...stages.slice(lastIndex)];
    });
  };

  const updateStage = (key: string, patch: Partial<JourneyStageForm>) => {
    setJourneyStages((stages) => stages.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  };

  const createGoogleAction = async (
    stageKey: string,
    name: string,
    category: 'IMPORTED_LEAD' | 'PURCHASE',
  ) => {
    try {
      const res = await fetch('/api/google-conversion-mapping/available-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar ação de conversão');
      setGoogleActions((prev) => [...prev, data.action]);
      updateStage(stageKey, { googleConversionActionId: data.action.resourceName });
      showToast('Ação de conversão criada no Google Ads!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar ação de conversão', 'error');
    }
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
          <div>
            <h2 className="font-bold text-lg text-foreground">Jornada do Lead</h2>
            <p className="text-sm text-muted-foreground">
              Etapas do funil que disparam eventos de conversão pra Meta e Google.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">Carregando...</div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Cada etapa é ligada a um pipeline/etapa real do Kommo — hoje a única fonte de
                pipeline conectada, mas a jornada em si não é uma configuração do Kommo: quando um
                lead entra numa etapa configurada aqui, o evento correspondente é disparado pra Meta
                e/ou Google, não importa qual CRM está por trás. Quando o CRM próprio estiver
                pronto, essas etapas também poderão vir de lá.
              </p>

              {pipelines.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-600">
                  <AlertTriangle size={16} />
                  Não foi possível carregar os pipelines do Kommo — confira se a integração está
                  conectada em Integrações → Kommo CRM.
                </div>
              )}

              <datalist id="meta-event-suggestions">
                {META_EVENT_SUGGESTIONS.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>

              {(() => {
                const firstStage = journeyStages.find((s) => s.position === 'FIRST');
                const middleStages = journeyStages.filter((s) => s.position === 'MIDDLE');
                const lastStage = journeyStages.find((s) => s.position === 'LAST');

                return (
                  <div className="space-y-3">
                    {firstStage && (
                      <FixedStageCard
                        stage={firstStage}
                        label="Lead criado"
                        pipelines={pipelines}
                        googleActions={googleActions}
                        onChange={updateStage}
                        onCreateGoogleAction={createGoogleAction}
                      />
                    )}

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={middleStages.map((s) => s._key)}
                        strategy={verticalListSortingStrategy}
                      >
                        {middleStages.map((stage, index) => (
                          <SortableStageCard
                            key={stage._key}
                            stage={stage}
                            index={index}
                            pipelines={pipelines}
                            googleActions={googleActions}
                            onChange={updateStage}
                            onRemove={requestRemoveStage}
                            onCreateGoogleAction={createGoogleAction}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    <button
                      onClick={addStage}
                      className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-brand-500 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Plus size={18} />
                      Adicionar Etapa
                    </button>

                    {lastStage && (
                      <FixedStageCard
                        stage={lastStage}
                        label="Compra"
                        pipelines={pipelines}
                        googleActions={googleActions}
                        onChange={updateStage}
                        onCreateGoogleAction={createGoogleAction}
                      />
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-secondary/20 border-t border-border flex justify-end items-center">
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
            {isSaving ? 'Salvando...' : 'Salvar Jornada'}
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
