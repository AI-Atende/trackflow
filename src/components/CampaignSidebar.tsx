
import React, { useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Layers, Filter } from 'lucide-react';

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
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Combined Sidebar and Trigger Container */}
            <div
                className={`fixed top-0 bottom-0 right-0 z-[70] flex transition-transform duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ width: 'min(320px, 90vw)' }}
            >
                {/* Pull-Tab Trigger Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        absolute left-0 top-1/2 -translate-x-[42px] -translate-y-1/2 
                        h-32 w-[42px] bg-card border border-r-0 border-border 
                        rounded-l-2xl shadow-[-10px_0_20px_rgba(0,0,0,0.1)] 
                        flex flex-col items-center justify-center gap-3
                        hover:bg-accent transition-colors duration-200 group
                    `}
                    title={isOpen ? "Fechar Filtros" : "Filtrar Campanhas"}
                >
                    <div className="bg-brand-500/10 p-1.5 rounded-xl text-brand-500 group-hover:scale-110 transition-transform">
                        {isOpen ? <ChevronRight size={20} strokeWidth={2.5} /> : <ChevronLeft size={20} strokeWidth={2.5} />}
                    </div>
                    <span className="[writing-mode:vertical-lr] rotate-180 text-[8px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                        Filtros
                    </span>
                </button>

                {/* Sidebar Panel */}
                <div className="w-full h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-border flex items-center justify-between bg-card">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-500/10 rounded-xl">
                                <Filter size={20} className="text-brand-500" />
                            </div>
                            <h3 className="font-bold text-lg text-foreground tracking-tight">
                                Filtros
                            </h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 bg-secondary/20">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por nome..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        <button
                            onClick={() => { onSelect(null); setIsOpen(false); }}
                            className={`
                                w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all
                                ${!selectedId
                                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25 ring-1 ring-brand-500'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
                            `}
                        >
                            Todas as Campanhas
                        </button>

                        <div className="h-px bg-border/50 my-2" />

                        {filteredCampaigns.map(camp => (
                            <button
                                key={camp.id}
                                onClick={() => { onSelect(camp.id); setIsOpen(false); }}
                                className={`
                                    w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group
                                    ${selectedId === camp.id
                                        ? 'bg-brand-500/10 text-brand-500 font-bold border border-brand-500/30'
                                        : 'text-foreground hover:bg-secondary border border-transparent'}
                                `}
                            >
                                <span className="truncate pr-2">{camp.name}</span>
                                {selectedId === camp.id ? (
                                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                                ) : (
                                    <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                            </button>
                        ))}

                        {filteredCampaigns.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="p-3 bg-secondary rounded-full mb-3 text-muted-foreground">
                                    <Search size={24} />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground italic">
                                    Nenhuma campanha encontrada
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-secondary/30">
                        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                            <Layers size={12} />
                            {campaigns.length} Sincronizadas
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
