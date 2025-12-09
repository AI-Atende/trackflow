import React, { useState, useEffect } from 'react';
import { Save, Trash2, Layout } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface View {
  id: string;
  name: string;
  columns: string[];
  isDefault: boolean;
}

interface ViewManagerProps {
  dataSource: string;
  availableColumns: { key: string; label: string }[];
  currentColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ViewManager({ dataSource, availableColumns, currentColumns, onColumnsChange }: ViewManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [views, setViews] = useState<View[]>([]);
  const [viewName, setViewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchViews();
    }
  }, [isOpen, dataSource]);

  const fetchViews = async () => {
    try {
      const res = await fetch(`/api/views?dataSource=${dataSource}`);
      if (res.ok) {
        const data = await res.json();
        setViews(data);

        // Apply default view if no columns set (initial load logic could be here or parent)
        const defaultView = data.find((v: View) => v.isDefault);
        if (defaultView && currentColumns.length === 0) {
          onColumnsChange(defaultView.columns);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar views:", error);
    }
  };

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
          isDefault: false
        })
      });
      if (res.ok) {
        setViewName('');
        fetchViews();
      }
    } catch (error) {
      console.error("Erro ao salvar view:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteView = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta visualização?')) return;
    try {
      await fetch(`/api/views/${id}`, { method: 'DELETE' });
      fetchViews();
    } catch (error) {
      console.error("Erro ao deletar view:", error);
    }
  };

  const loadView = (view: View) => {
    onColumnsChange(view.columns);
  };

  const toggleColumn = (key: string) => {
    if (currentColumns.includes(key)) {
      onColumnsChange(currentColumns.filter(c => c !== key));
    } else {
      onColumnsChange([...currentColumns, key]);
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
        <Layout className="w-4 h-4" />
        Visualização
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[400px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 flex flex-col gap-4 max-h-[80vh] overflow-hidden">

          {/* Saved Views Section */}
          <div className="flex-shrink-0">
            <h3 className="font-semibold mb-2 text-sm">Visualizações Salvas</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {views.map(view => (
                <div key={view.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm group">
                  <span className="cursor-pointer hover:underline truncate flex-1" onClick={() => loadView(view)}>
                    {view.name}
                  </span>
                  <button onClick={() => deleteView(view.id)} className="text-red-500 hover:text-red-700 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {views.length === 0 && <p className="text-xs text-gray-500">Nenhuma visualização salva.</p>}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Nome da nova visualização"
                className="flex-1 text-sm border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-600"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
              />
              <Button size="sm" onClick={saveView} disabled={loading || !viewName}>
                <Save className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-600" />

          {/* Columns Management Section */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="font-semibold mb-2 text-sm">Selecionar Colunas</h3>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {availableColumns.map(col => {
                  const isChecked = currentColumns.includes(col.key);
                  return (
                    <label key={col.key} className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer border transition-colors ${isChecked ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' : 'bg-gray-50 border-transparent dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="truncate text-xs font-medium">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
