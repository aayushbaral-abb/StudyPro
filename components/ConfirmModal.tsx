
import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={!isLoading ? onCancel : undefined}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl ${isDestructive ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-indigo-50 border-indigo-100 text-indigo-500'}`}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{title}</h3>
            <p className="text-gray-500 font-medium text-sm leading-relaxed">{message}</p>
          </div>

          <div className="flex w-full space-x-3 pt-2">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-6 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-6 py-4 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2 ${isDestructive ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
            >
              {isLoading ? (
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{confirmText}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
