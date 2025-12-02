import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-900 rounded shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200 ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${position === 'top' ? 'border-t-slate-900 top-full' : 'border-b-slate-900 bottom-full'
              }`}
          />
        </div>
      )}
    </div>
  );
};
