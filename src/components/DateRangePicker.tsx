import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  isSameDay,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  setYear,
  getYear
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';

export type DateRange = {
  from: Date;
  to: Date;
};

interface DateRangePickerProps {
  date: DateRange;
  setDate: (date: DateRange) => void;
}

type Preset = {
  label: string;
  getValue: () => DateRange;
};

const PRESETS: Preset[] = [
  {
    label: 'Últimos 7 dias',
    getValue: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
  },
  {
    label: 'Últimos 30 dias',
    getValue: () => ({
      from: subDays(new Date(), 30),
      to: new Date(),
    }),
  },
  {
    label: 'Esta semana',
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Segunda-feira
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Semana passada',
    getValue: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
    }),
  },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ date, setDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date()); // Mês visível no calendário (lado esquerdo)
  const [tempDate, setTempDate] = useState<DateRange>(date); // Estado temporário durante a seleção personalizada
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atualizar preset ativo quando a data muda
  useEffect(() => {
    const foundPreset = PRESETS.find(preset => {
      const presetRange = preset.getValue();
      return isSameDay(presetRange.from, date.from) && isSameDay(presetRange.to, date.to);
    });
    setActivePreset(foundPreset ? foundPreset.label : 'Período personalizado');
  }, [date]);

  // Sincronizar tempDate quando abrir
  useEffect(() => {
    if (isOpen) {
      setTempDate(date);
      setViewDate(date.from);
    }
  }, [isOpen, date]);

  const handlePresetClick = (preset: Preset) => {
    const newRange = preset.getValue();
    setDate(newRange);
    setIsOpen(false);
  };

  const handleDayClick = (day: Date) => {
    if (isSameDay(day, tempDate.from) && isSameDay(day, tempDate.to)) {
      // Reset se clicar no mesmo dia único
      setTempDate({ from: day, to: day });
      return;
    }

    if (isBefore(day, tempDate.from) || (tempDate.from && tempDate.to && !isSameDay(tempDate.from, tempDate.to))) {
      // Novo início se clicar antes do início atual OU se já tiver um intervalo completo selecionado
      setTempDate({ from: day, to: day });
    } else {
      // Definir fim
      setTempDate({ from: tempDate.from, to: day });
    }
  };

  const handleApply = () => {
    // Validar e ordenar datas
    let finalFrom = tempDate.from;
    let finalTo = tempDate.to;

    if (isAfter(finalFrom, finalTo)) {
      [finalFrom, finalTo] = [finalTo, finalFrom];
    }

    setDate({ from: finalFrom, to: finalTo });
    setIsOpen(false);
  };

  const formatDateRange = (range: DateRange) => {
    return `${format(range.from, 'dd/MM/yyyy')} - ${format(range.to, 'dd/MM/yyyy')}`;
  };

  const renderCalendarMonth = (monthDate: Date) => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="w-64">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="font-semibold text-foreground capitalize">
            {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
            <div key={i} className="text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            const isSelected = isCurrentMonth && (isSameDay(day, tempDate.from) || isSameDay(day, tempDate.to) || (isAfter(day, tempDate.from) && isBefore(day, tempDate.to)));
            const isStart = isCurrentMonth && isSameDay(day, tempDate.from);
            const isEnd = isCurrentMonth && isSameDay(day, tempDate.to);
            const isToday = isSameDay(day, new Date());

            let bgClass = '';
            let textClass = 'text-foreground';

            if (isStart || isEnd) {
              bgClass = 'bg-brand-600 text-white rounded-md';
              textClass = 'text-white';
            } else if (isSelected) {
              bgClass = 'bg-brand-50/20 text-brand-500';
              textClass = 'text-brand-500';
            } else if (!isCurrentMonth) {
              textClass = 'text-muted-foreground/30';
            }

            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => setHoverDate(day)}
                onMouseLeave={() => setHoverDate(null)}
                className={`
                                    h-8 w-8 text-sm flex items-center justify-center relative transition-all
                                    ${bgClass}
                                    ${textClass}
                                    ${!isSelected && !isStart && !isEnd && isCurrentMonth ? 'hover:bg-accent rounded-md' : ''}
                                    ${isToday && !isSelected && isCurrentMonth ? 'font-bold text-brand-600' : ''}
                                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <CalendarIcon size={14} />
        <div className="flex flex-col items-start text-xs leading-tight">
          <span className="font-semibold text-foreground">{activePreset}</span>
          <span className="text-[10px] text-muted-foreground">{formatDateRange(date)}</span>
        </div>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown / Modal */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 bg-popover/95 backdrop-blur-xl text-popover-foreground rounded-xl shadow-2xl border border-border z-50 flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Sidebar Presets */}
          <div className="w-full md:w-48 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-2 flex flex-col gap-1">
            {PRESETS.map((preset, index) => {
              const presetRange = preset.getValue();
              const isActive = activePreset === preset.label;

              return (
                <button
                  key={index}
                  onClick={() => handlePresetClick(preset)}
                  className={`
                                        w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                                        ${isActive ? 'bg-background text-brand-600 shadow-sm font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
                                    `}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {formatDateRange(presetRange)}
                  </div>
                </button>
              );
            })}
            <div className="h-px bg-border my-1"></div>
            <button
              className={`
                                w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                                ${activePreset === 'Período personalizado' ? 'bg-background text-brand-600 shadow-sm font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
                            `}
            >
              <div className="font-medium">Período personalizado</div>
            </button>
          </div>

          {/* Custom Calendar Area */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-1 hover:bg-accent rounded-full text-muted-foreground"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-1 hover:bg-accent rounded-full text-muted-foreground"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Year Selector (Simplified) */}
              <select
                value={getYear(viewDate)}
                onChange={(e) => setViewDate(setYear(viewDate, parseInt(e.target.value)))}
                className="text-sm border-none bg-transparent font-semibold text-foreground cursor-pointer focus:ring-0"
              >
                {Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i).map(year => (
                  <option key={year} value={year} className="bg-popover text-popover-foreground">{year}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-8">
              {renderCalendarMonth(viewDate)}
              <div className="hidden md:block">
                {renderCalendarMonth(addMonths(viewDate, 1))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {tempDate.from && tempDate.to ? (
                  <span>
                    Selecionado: <span className="font-medium text-foreground">{formatDateRange(tempDate)}</span>
                  </span>
                ) : (
                  <span>Selecione o período</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApply}
                  className="px-3 py-1.5 text-sm bg-brand-600 text-white hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
                >
                  Aplicar Filtro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
