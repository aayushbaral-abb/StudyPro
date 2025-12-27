
import React, { useState, useEffect } from 'react';
import { NotificationType } from '../utils/notifications';

interface ToastProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 1000;
    const interval = 10;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onClose]);

  const config = {
    success: {
      bg: 'bg-emerald-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
      label: 'Success'
    },
    error: {
      bg: 'bg-rose-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>,
      label: 'Error'
    },
    info: {
      bg: 'bg-indigo-500',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      label: 'Update'
    }
  };

  return (
    <div className="flex flex-col w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto">
      <div className="p-4 flex items-center space-x-4">
        <div className={`${config[type].bg} p-2 rounded-xl text-white shadow-lg`}>
          {config[type].icon}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">{config[type].label}</p>
          <p className="text-sm font-bold text-gray-800 leading-tight">{message}</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="h-1 bg-gray-50 w-full overflow-hidden">
        <div 
          className={`h-full ${config[type].bg} transition-all duration-75 ease-linear`} 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default Toast;
