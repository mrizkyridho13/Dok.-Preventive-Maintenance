import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useBackHandler } from '../hooks/useAndroidBackButton';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  backPriority?: number;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  isDestructive = true,
  backPriority = 50,
  icon,
  onConfirm,
  onClose,
}) => {
  useBackHandler(isOpen, onClose, backPriority);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-white border-2 border-black p-4 space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`w-8 h-8 flex items-center justify-center shrink-0 border border-black ${
              isDestructive ? 'bg-red-50 text-red-700' : 'bg-slate-900 text-amber-300'
            }`}
          >
            {icon ?? (isDestructive ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-slate-900 leading-snug">{title}</h4>
            {message && (
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 ${
              isDestructive
                ? 'bg-red-700 hover:bg-red-800 border border-red-900'
                : 'bg-slate-900 hover:bg-black border border-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
