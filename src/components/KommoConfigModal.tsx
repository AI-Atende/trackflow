import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, X, RotateCcw, Layers, Link, GripVertical, Pencil, AlertTriangle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
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

interface SortableStageItemProps {
  id: string;
  stage: string;
  index: number;
  onEdit: (index: number) => void;
}

const SortableStageItem = ({ id, stage, index, onEdit }: SortableStageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
      className="flex items-center justify-between bg-secondary/30 px-3 py-3 rounded-lg border border-border group hover:border-brand-500/30 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold border border-brand-500/20">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-foreground">
          {stage}
        </span>
      </div>
      <button
        onClick={() => onEdit(index)}
        className="text-muted-foreground hover:text-blue-500 transition-colors p-1 hover:bg-blue-500/10 rounded ml-2"
      >
        <Pencil size={16} />
      </button>
    </div>
  );
};

// Simple Edit Modal Component
interface EditStageModalProps {
  stageName: string;
  onSave: (newName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const EditStageModal = ({ stageName, onSave, onDelete, onClose }: EditStageModalProps) => {
  const [name, setName] = useState(stageName);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-xl shadow-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
          <h3 className="font-bold text-foreground">Editar Etapa</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Nome da Etapa</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-brand-500/50 outline-none"
              autoFocus
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={onDelete}
              className="px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Excluir
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => onSave(name)}
                className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                Salvar
              </button>
            </div>
          </div>
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
            Tem certeza que deseja apagar este item? Esta ação não pode ser desfeita.
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

export const KommoConfigModal: React.FC<KommoConfigModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado do formulário
  const [isActive, setIsActive] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [journeyStages, setJourneyStages] = useState<string[]>(['Criado', 'Qualificado', 'Venda']);
  const [newStage, setNewStage] = useState('');

  // Estados de Edição e Confirmação
  const [editingStage, setEditingStage] = useState<{ index: number; value: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/integrations/kommo');
      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          setIsActive(data.isActive);
          setSubdomain(data.config?.subdomain || '');
          setJourneyStages(data.journeyMap || ['Criado', 'Qualificado', 'Venda']);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      showToast("Erro ao carregar configurações.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Salvar Configuração
      const res = await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive,
          subdomain,
          journeyMap: journeyStages
        })
      });

      if (!res.ok) throw new Error('Falha ao salvar configuração');

      // 2. Buscar dados iniciais (Validação e Cache)
      const today = new Date().toISOString().split('T')[0];
      const dataRes = await fetch(`/api/integrations/kommo/data?since=${today}&until=${today}`);

      if (!dataRes.ok) {
        console.warn("Configuração salva, mas falha ao testar conexão de dados.");
        showToast("Configuração salva, mas houve um erro ao testar a conexão.", "error");
      } else {
        showToast("Integração salva e testada com sucesso!", "success");
      }

      onSuccess();
      onClose();

    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar e testar integração. Verifique o subdomínio.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Tem certeza? Isso desativará a integração e voltará para o padrão.")) return;

    setIsActive(false);
    setIsSaving(true);
    try {
      await fetch('/api/integrations/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
          subdomain,
          journeyMap: journeyStages
        })
      });
      showToast('Integração desativada. Voltando ao padrão.', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      showToast('Erro ao resetar integração.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addStage = () => {
    if (newStage.trim()) {
      setJourneyStages([...journeyStages, newStage.trim()]);
      setNewStage('');
    }
  };

  const handleEditClick = (index: number) => {
    setEditingStage({ index, value: journeyStages[index] });
  };

  const handleSaveEdit = (newName: string) => {
    if (editingStage && newName.trim()) {
      const newStages = [...journeyStages];
      newStages[editingStage.index] = newName.trim();
      setJourneyStages(newStages);
      setEditingStage(null);
    }
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (editingStage) {
      setJourneyStages(journeyStages.filter((_, i) => i !== editingStage.index));
      setEditingStage(null);
      setShowDeleteConfirm(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setJourneyStages((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);

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
              <p className="text-sm text-muted-foreground">Conecte sua conta para sincronizar leads.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
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
                  <span className={`text-sm font-medium ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-secondary'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${isActive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* Subdomínio */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">Subdomínio Kommo</label>
                <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl border border-border focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                  <span className="pl-4 text-muted-foreground font-mono">https://</span>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="seunegocio"
                    className="flex-1 py-2.5 bg-transparent border-none focus:ring-0 text-foreground placeholder-muted-foreground outline-none font-medium"
                  />
                  <span className="pr-4 text-muted-foreground font-mono">.kommo.com</span>
                </div>
              </div>

              {/* Jornada de Compra */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-brand-500" />
                  <label className="block text-sm font-medium text-foreground">Mapeamento da Jornada</label>
                </div>
                <p className="text-xs text-muted-foreground">Defina as etapas do funil que deseja rastrear. A ordem define o funil (I, II, III...).</p>

                <div className="space-y-2">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={journeyStages}
                      strategy={verticalListSortingStrategy}
                    >
                      {journeyStages.map((stage, index) => (
                        <SortableStageItem
                          key={stage}
                          id={stage}
                          stage={stage}
                          index={index}
                          onEdit={handleEditClick}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    placeholder="Nova etapa (ex: Agendou)"
                    className="flex-1 px-4 py-2.5 bg-secondary/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && addStage()}
                  />
                  <button
                    onClick={addStage}
                    className="px-4 py-2.5 bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 border border-brand-600/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus size={20} />
                  </button>
                </div>
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

      {editingStage && (
        <EditStageModal
          stageName={editingStage.value}
          onSave={handleSaveEdit}
          onDelete={handleDeleteRequest}
          onClose={() => setEditingStage(null)}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
