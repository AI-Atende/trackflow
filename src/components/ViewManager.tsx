import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Trash2, Layout, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface View {
  id: string;
  name: string;
  dataSource: string;
  columns: string[];
  isDefault: boolean;
}

interface ViewManagerProps {
  dataSource: string;
  availableColumns: { key: string; label: string }[];
  currentColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ViewManager({
  dataSource,
  availableColumns,
  currentColumns,
  onColumnsChange,
}: ViewManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [views, setViews] = useState<View[]>([]);
  const [viewName, setViewName] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // New State
  const [activeViewId, setActiveViewId] = useState<string>('custom');
  const [showColumns, setShowColumns] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch(`/api/views?dataSource=${dataSource}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setViews(data);

        // Apply default view if no columns set
        const defaultView = data.find((v: View) => v.isDefault);
        if (defaultView && currentColumns.length === 0) {
          onColumnsChange(defaultView.columns);
          setActiveViewId(defaultView.id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar views:', error);
    }
  }, [dataSource, currentColumns, onColumnsChange]);

  useEffect(() => {
    (async () => {
      await fetchViews();
    })();
  }, [dataSource, fetchViews]);

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Check for changes in current view
  useEffect(() => {
    (() => {
      if (activeViewId === 'custom') {
        setHasChanges(false);
        return;
      }

      const activeView = views.find((v) => v.id === activeViewId);
      if (!activeView) return;

      const isDifferent =
        activeView.columns.length !== currentColumns.length ||
        !activeView.columns.every((col, index) => col === currentColumns[index]);

      setHasChanges(isDifferent);
    })();
  }, [currentColumns, activeViewId, views]);

  // Initial load logic - try to match existing view ONLY on mount or when views change
  useEffect(() => {
    (() => {
      if (views.length > 0 && activeViewId === 'custom' && !hasChanges) {
        const matchingView = views.find(
          (v) =>
            v.columns.length === currentColumns.length &&
            v.columns.every((col, index) => col === currentColumns[index]),
        );

        if (matchingView) {
          setActiveViewId(matchingView.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-run when `views` changes (e.g. after fetch), not on every column edit
  }, [views]);

  const saveView = async () => {
    if (!viewName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: viewName,
          dataSource,
          columns: currentColumns,
          isDefault: false,
        }),
      });
      if (res.ok) {
        setViewName('');
        await fetchViews();
      }
    } catch (error) {
      console.error('Erro ao salvar view:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateView = async () => {
    if (activeViewId === 'custom') return;
    setLoading(true);
    try {
      const activeView = views.find((v) => v.id === activeViewId);
      if (!activeView) return;

      const res = await fetch(`/api/views/${activeViewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeView.name,
          dataSource,
          columns: currentColumns,
          isDefault: activeView.isDefault,
        }),
      });

      if (res.ok) {
        await fetchViews();
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Erro ao atualizar view:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteView = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta visualização?')) return;
    try {
      await fetch(`/api/views/${id}`, { method: 'DELETE' });
      await fetchViews();
      if (activeViewId === id) {
        setActiveViewId('custom');
      }
    } catch (error) {
      console.error('Erro ao deletar view:', error);
    }
  };

  const handleViewChange = (viewId: string) => {
    if (viewId === 'custom') {
      setActiveViewId('custom');
      return;
    }

    const view = views.find((v) => v.id === viewId);
    if (view) {
      onColumnsChange(view.columns);
      setActiveViewId(viewId);
      setHasChanges(false);
    }
  };

  const toggleColumn = (key: string) => {
    if (currentColumns.includes(key)) {
      onColumnsChange(currentColumns.filter((c) => c !== key));
    } else {
      onColumnsChange([...currentColumns, key]);
    }
  };

  // Prepare options for Select
  const viewOptions = [
    { value: 'custom', label: 'Criar nova visualização', icon: <Plus size={14} /> },
    ...views.map((v) => ({ value: v.id, label: v.name, icon: <Layout size={14} /> })),
  ];

  const activeViewName =
    activeViewId === 'custom'
      ? 'Visualização'
      : `Visualização: ${views.find((v) => v.id === activeViewId)?.name || ''}`;

  return (
    <div className="relative" ref={modalRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Layout className="w-4 h-4" />
        {activeViewName}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[400px] bg-card border border-border rounded-lg shadow-xl p-4 flex flex-col gap-4 max-h-[80vh] animate-in fade-in zoom-in-95 duration-200 text-card-foreground">
          {/* 1. Active View Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Visualização Ativa
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Select
                  options={viewOptions}
                  value={activeViewId}
                  onChange={handleViewChange}
                  placeholder="Selecione uma visualização"
                />
              </div>

              {/* Update Button (Only if changes detected in saved view) */}
              {activeViewId !== 'custom' && hasChanges && (
                <Button
                  size="icon"
                  onClick={updateView}
                  className="bg-blue-500 hover:bg-blue-600 text-white animate-pulse"
                  title="Salvar alterações na visualização atual"
                  disabled={loading}
                >
                  <Save size={16} />
                </Button>
              )}

              {/* Delete Button */}
              {activeViewId !== 'custom' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteView(activeViewId)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Excluir visualização"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </div>

          {/* 2. Save Current View (Only if Custom) */}
          {activeViewId === 'custom' && (
            <div className="bg-secondary/30 p-3 rounded-lg border border-border">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Salvar nova visualização
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da visualização..."
                  className="flex-1 text-sm border rounded px-3 py-2 bg-background border-input focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-foreground"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                />
                <Button size="sm" onClick={saveView} disabled={loading || !viewName}>
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          )}

          <hr className="border-border" />

          {/* 3. Configure Columns Toggle */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumns(!showColumns)}
              className="w-full justify-between group"
            >
              <span className="flex items-center gap-2">
                <Settings size={14} />
                {activeViewId === 'custom' ? 'Configurar Colunas' : 'Editar Colunas'}
              </span>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full group-hover:bg-secondary/80 transition-colors">
                {currentColumns.length} ativas
              </span>
            </Button>

            {showColumns && (
              <div className="mt-3 flex-1 overflow-y-auto pr-1 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  {availableColumns.map((col) => {
                    const isChecked = currentColumns.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer border transition-all ${isChecked ? 'bg-brand-500/10 border-brand-500/20 shadow-sm' : 'bg-background border-border hover:border-input'}`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-brand-500 border-brand-500' : 'bg-background border-input'}`}
                        >
                          {isChecked && <Plus size={10} className="text-white rotate-45" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="hidden"
                        />
                        <span className="truncate text-xs font-medium text-foreground">
                          {col.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
