import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 transform translate-y-0 ${type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-red-100 text-red-800'
      }`}>
      {type === 'success' ? <CheckCircle size={20} className="text-green-500" /> : <XCircle size={20} className="text-red-500" />}
      <p className="text-sm font-medium">{message}</p>
      <button onClick={() => setIsVisible(false)} className="ml-2 p-1 hover:bg-slate-100 rounded-full transition-colors">
        <X size={14} className="text-slate-400" />
      </button>
    </div>
  );
};
