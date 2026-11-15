import React from 'react';
import { FileDown, FileText, Image as ImageIcon, Share2, X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  activeSheetNumber: number;
  isExporting: boolean;
  onShareFormat: (format: 'pdf' | 'jpg' | 'docx') => void;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  activeSheetNumber,
  isExporting,
  onShareFormat,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xs bg-white border-t-2 sm:border-2 border-black p-4 space-y-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-300 pb-2">
          <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
            <Share2 className="w-4 h-4 text-emerald-700" />
            <span>Bagikan Laporan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-black"
            aria-label="Tutup menu bagikan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-600">
          Pilih format file untuk langsung dikirim ke WhatsApp, Email, atau aplikasi lain:
        </p>

        <div className="space-y-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => onShareFormat('pdf')}
            className="w-full py-2.5 px-3 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs border border-black flex items-center gap-2.5 transition active:scale-98"
          >
            <FileDown className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Bagikan sebagai PDF</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => onShareFormat('jpg')}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs border border-slate-900 flex items-center gap-2.5 transition active:scale-98"
          >
            <ImageIcon className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>Bagikan sebagai JPEG (Lembar {activeSheetNumber})</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => onShareFormat('docx')}
            className="w-full py-2.5 px-3 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs border border-blue-900 flex items-center gap-2.5 transition active:scale-98"
          >
            <FileText className="w-4 h-4 text-blue-100 shrink-0" />
            <span>Bagikan sebagai Word</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300"
        >
          Batal
        </button>
      </div>
    </div>
  );
};
