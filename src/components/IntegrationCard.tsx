import React from 'react';
import { Settings, CheckCircle2, XCircle } from 'lucide-react';

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  onConfigure: () => void;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  name,
  description,
  icon,
  isActive,
  onConfigure,
}) => {
  return (
    <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-lg overflow-hidden glass hover:border-brand-500/50 transition-all group">
      <div className="p-6 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-secondary/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-secondary text-muted-foreground border-border'}`}
          >
            {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {isActive ? 'Ativo' : 'Inativo'}
          </div>
        </div>

        <h3 className="text-lg font-bold text-foreground mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-1">{description}</p>

        <button
          onClick={onConfigure}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600/10 text-brand-500 hover:bg-brand-600 hover:text-white border border-brand-600/20 rounded-lg transition-all font-medium"
        >
          <Settings size={16} />
          Configurar
        </button>
      </div>
    </div>
  );
};
