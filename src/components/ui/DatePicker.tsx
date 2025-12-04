import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  setYear,
  getYear,
  isValid,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface DatePickerProps {
  value: string; // Expecting YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = "Selecione uma data", className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'days' | 'months'>('days'); // 'days' or 'months'
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewDate from value if valid
  useEffect(() => {
    if (value) {
      const date = parseISO(value);
      if (isValid(date)) {
        setViewDate(date);
      }
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('days'); // Reset view mode on close
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const handleMonthClick = (monthIndex: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(monthIndex);
    setViewDate(newDate);
    setViewMode('days');
  };

  const renderCalendarMonth = (monthDate: Date) => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(i);
      return format(d, 'MMMM', { locale: ptBR });
    });

    return (
      <div className="w-64">
        <div className="flex items-center justify-between mb-4 px-2">
          {viewMode === 'days' && (
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1 hover:bg-accent rounded-full text-muted-foreground"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 font-semibold text-foreground capitalize mx-auto">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'days' ? 'months' : 'days')}
              className="hover:bg-accent px-2 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              {viewMode === 'days' ? format(monthDate, 'MMMM', { locale: ptBR }) : 'Voltar'}
              {viewMode === 'days' && <ChevronDown size={14} className="opacity-50" />}
            </button>

            <select
              value={getYear(monthDate)}
              onChange={(e) => setViewDate(setYear(monthDate, parseInt(e.target.value)))}
              className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 font-semibold appearance-none hover:bg-accent px-2 py-1 rounded-md transition-colors"
            >
              {Array.from({ length: 100 }, (_, i) => getYear(new Date()) - 80 + i).map(year => (
                <option key={year} value={year} className="bg-popover text-popover-foreground">{year}</option>
              ))}
            </select>
          </div>

          {viewMode === 'days' && (
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1 hover:bg-accent rounded-full text-muted-foreground"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {viewMode === 'months' ? (
          <div className="grid grid-cols-2 gap-2">
            {months.map((month, index) => (
              <button
                key={month}
                type="button"
                onClick={() => handleMonthClick(index)}
                className={`
                  p-2 text-sm rounded-md capitalize transition-all
                  ${viewDate.getMonth() === index ? 'bg-brand-600 text-white font-bold' : 'hover:bg-accent text-foreground'}
                `}
              >
                {month}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                const isSelected = value ? isSameDay(day, parseISO(value)) : false;
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`
                      h-8 w-8 text-sm flex items-center justify-center rounded-md transition-all
                      ${isSelected ? 'bg-brand-600 text-white font-bold' : ''}
                      ${!isSelected && isCurrentMonth ? 'hover:bg-accent text-foreground' : ''}
                      ${!isSelected && !isCurrentMonth ? 'text-muted-foreground/30' : ''}
                      ${isToday && !isSelected ? 'border border-brand-500 text-brand-500' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const displayDate = value && isValid(parseISO(value))
    ? format(parseISO(value), 'dd/MM/yyyy')
    : '';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus-within:ring-2 focus-within:ring-brand-500/50 transition-all cursor-pointer flex items-center justify-between group"
      >
        <span className={displayDate ? "text-foreground" : "text-muted-foreground"}>
          {displayDate || placeholder}
        </span>
        <CalendarIcon className="text-muted-foreground group-hover:text-brand-500 transition-colors" size={18} />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
          {renderCalendarMonth(viewDate)}
        </div>
      )}
    </div>
  );
};
