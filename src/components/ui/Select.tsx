import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
                    w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all duration-200
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border' : 'cursor-pointer'}
                    ${isOpen
            ? 'border-brand-500 ring-2 ring-brand-500/20 bg-background text-foreground'
            : 'border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground'}
                `}
        disabled={disabled}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="text-brand-500">{selectedOption.icon}</span>}
          <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                                        w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors
                                        ${isSelected
                      ? 'bg-brand-500/10 text-brand-600 font-medium'
                      : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground'}
                                    `}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && <span className={isSelected ? "text-brand-600" : "text-muted-foreground"}>{option.icon}</span>}
                    <span>{option.label}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-brand-600" />}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                Nenhuma opção disponível
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
