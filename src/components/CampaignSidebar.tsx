
import React, { useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface CampaignSidebarProps {
    campaigns: any[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const CampaignSidebar: React.FC<CampaignSidebarProps> = ({
    campaigns,
    selectedId,
    onSelect,
    isOpen,
    setIsOpen
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCampaigns = campaigns.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            {/* Trigger Button (Floating) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-card border border-l-border border-y-border border-r-0 rounded-l-xl p-2 shadow-lg transition-transform duration-300 hover:bg-secondary ${isOpen ? '-translate-x-80' : 'translate-x-0'}`}
                title="Filtrar Campanhas"
                style={{ transition: 'transform 0.3s ease-in-out' }}
            >
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-1">
                    {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    <span className="text-[10px] font-bold uppercase tracking-wider -rotate-90 mt-2">Filtros</span>
                </div>
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Panel */}
            <div className={`fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Layers size={18} className="text-brand-500" />
                            Campanhas
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-border bg-secondary/20">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar campanha..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        <button
                            onClick={() => { onSelect(null); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedId ? 'bg-brand-500/10 text-brand-500' : 'text-muted-foreground hover:bg-secondary'}`}
                        >
                            Todas as Campanhas
                        </button>

                        {filteredCampaigns.map(camp => (
                            <button
                                key={camp.id}
                                onClick={() => { onSelect(camp.id); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${selectedId === camp.id ? 'bg-brand-500/10 text-brand-500 font-medium' : 'text-foreground hover:bg-secondary'}`}
                            >
                                <span className="truncate">{camp.name}</span>
                                {selectedId === camp.id && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                            </button>
                        ))}

                        {filteredCampaigns.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-xs">
                                Nenhuma campanha encontrada.
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-border bg-secondary/10 text-[10px] text-center text-muted-foreground">
                        {campaigns.length} campanhas sincronizadas
                    </div>
                </div>
            </div>
        </>
    );
};
