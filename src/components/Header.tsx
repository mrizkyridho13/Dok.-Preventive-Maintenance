import React from 'react';
import {
  Eye,
  FileDown,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  WifiOff,
  Building,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ReportMeta } from '../types/report';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface HeaderProps {
  meta: ReportMeta;
  activeSheetNumber: number;
  totalSheets: number;
  onUpdateMeta: (newMeta: ReportMeta) => void;
  onTogglePhotoFitMode: () => void;
  onOpenMetaModal: () => void;
  onOpenPreview: () => void;
  onDownloadPDF: () => void;
  onDownloadCurrentJPG: () => void;
  onDownloadDOCX: () => void;
  isSaving: boolean;
  isExporting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  meta,
  onUpdateMeta,
  onTogglePhotoFitMode,
  onOpenMetaModal,
  onOpenPreview,
  onDownloadPDF,
  onDownloadCurrentJPG,
  onDownloadDOCX,
  isSaving,
  isExporting,
}) => {
  const isOnline = useOnlineStatus();
  const isFillMode = (meta.photoFitMode || 'original') === 'fill';

  const handleToggleLabels = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onUpdateMeta({
      ...meta,
      showBeforeAfterLabels: !meta.showBeforeAfterLabels,
    });
  };

  return (
    // Static header: does NOT follow screen on scroll
    <header className="w-full bg-slate-900 text-white border-b border-black select-none">
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-2.5 sm:px-4 py-2 md:py-2.5 space-y-2">
        {/* Row 1: Brand & Top Utilities with Company Logo */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.jpg"
              alt="Logo PT. Panca Gatrik Elektrindo"
              className="w-8 h-8 md:w-9 md:h-9 rounded-sm object-contain bg-white p-0.5 border border-slate-700 shrink-0"
            />
            <div className="min-w-0 leading-tight">
              <div className="font-black text-xs md:text-sm tracking-tight text-white uppercase truncate">
                {(meta.companyName || 'PT. PANCA GATRIK ELEKTRINDO').trim().toUpperCase()}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 truncate">
                {meta.location || 'Dokumentasi Maintenance'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onOpenMetaModal}
              className="h-7 md:h-8 px-2 md:px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-[11px] md:text-xs font-semibold flex items-center gap-1"
              title="Isi Kop Laporan (Nama Proyek, Toko, Teknisi, Tanggal)"
            >
              <Building className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
              <span>Data Kop</span>
            </button>
          </div>
        </div>

        {/* Row 2: Action & Export Buttons (Pratinjau, JPG, PDF, Word) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2">
          {/* Pratinjau (Preview) */}
          <button
            type="button"
            onClick={onOpenPreview}
            className="h-9 md:h-10 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            title="Pratinjau hasil sebelum download"
          >
            <Eye className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>Pratinjau</span>
          </button>

          {/* Unduh Lembar Ini (JPG) */}
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownloadCurrentJPG}
            className="h-9 md:h-10 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40 text-white border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            title="Download lembar ini format JPG untuk dikirim via WA"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>Unduh JPG</span>
          </button>

          {/* Unduh Semua Lembar (PDF) */}
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownloadPDF}
            className="h-9 md:h-10 bg-slate-100 hover:bg-white active:bg-slate-200 disabled:opacity-40 text-slate-950 border border-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            title="Download seluruh halaman dalam 1 file PDF A4"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-950 stroke-[2.5] shrink-0" />
            <span>Unduh PDF</span>
          </button>

          {/* Unduh Word (.docx) */}
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownloadDOCX}
            className="h-9 md:h-10 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 disabled:opacity-40 text-white border border-blue-900 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            title="Download format Word (.docx) agar dapat diedit manual oleh admin proyek"
          >
            <FileText className="w-3.5 h-3.5 text-blue-100 shrink-0" />
            <span>Unduh Word</span>
          </button>
        </div>

        {/* Row 3: BEFORE/AFTER Toggle, Photo Fit Mode Toggle, & Save Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1.5 border-t border-slate-800 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Toggle Switch Label BEFORE / AFTER */}
            <button
              type="button"
              onClick={handleToggleLabels}
              className="flex items-center gap-1.5 text-slate-200 hover:text-white"
            >
              <div
                className={`w-7 h-4 rounded-full p-0.5 transition-colors ${
                  meta.showBeforeAfterLabels ? 'bg-slate-100' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform ${
                    meta.showBeforeAfterLabels
                      ? 'translate-x-3 bg-slate-950'
                      : 'translate-x-0 bg-slate-400'
                  }`}
                />
              </div>
              <span className="font-medium text-[11px]">
                Label:{' '}
                <strong className={meta.showBeforeAfterLabels ? 'text-white' : 'text-slate-400'}>
                  {meta.showBeforeAfterLabels ? 'ON' : 'OFF'}
                </strong>
              </span>
            </button>

            {/* Toggle Global Mode Foto (Sesuai Aslinya vs Sesuaikan Kotak) */}
            <button
              type="button"
              onClick={onTogglePhotoFitMode}
              className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] sm:text-[11px] font-semibold transition active:scale-98"
              title="Ubah tampilan semua foto: Sesuai Aslinya atau Sesuaikan Kotak (isi penuh kolom)"
            >
              {isFillMode ? (
                <Maximize2 className="w-3 h-3 text-amber-300 shrink-0" />
              ) : (
                <Minimize2 className="w-3 h-3 text-slate-300 shrink-0" />
              )}
              <span>
                Foto:{' '}
                <strong className={isFillMode ? 'text-amber-300' : 'text-white'}>
                  {isFillMode ? 'Sesuaikan Kotak' : 'Sesuai Aslinya'}
                </strong>
              </span>
            </button>
          </div>

          {/* Status Simpan Otomatis */}
          <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 ml-auto">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span>{isSaving ? 'Menyimpan...' : 'Tersimpan'}</span>
            {!isOnline && (
              <span className="ml-1 text-slate-400 flex items-center gap-0.5">
                &bull; <WifiOff className="w-2.5 h-2.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
