import React, { useEffect, useState } from 'react';
import {
  FileDown,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Sheet, ReportMeta } from '../types/report';
import { useBackHandler } from '../hooks/useAndroidBackButton';

interface PreviewModalProps {
  isOpen: boolean;
  sheets: Sheet[];
  meta: ReportMeta;
  activeSheetIndex: number;
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadJPG: (sheetIndex: number) => void;
  onDownloadDOCX: () => void;
  isExporting: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  sheets,
  meta,
  activeSheetIndex: initialIndex,
  onClose,
  onDownloadPDF,
  onDownloadJPG,
  onDownloadDOCX,
  isExporting,
}) => {
  const [currentSheetIdx, setCurrentSheetIdx] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentSheetIdx(Math.min(initialIndex, Math.max(0, sheets.length - 1)));
    }
  }, [isOpen, initialIndex, sheets.length]);

  useBackHandler(isOpen, onClose, 40);

  if (!isOpen) return null;

  const currentSheet = sheets[currentSheetIdx] || sheets[0];
  const totalSheets = sheets.length;
  const companyDisplay = (meta.companyName || 'PT. PANCA GATRIK ELEKTRINDO').trim().toUpperCase();
  const globalFitMode = meta.photoFitMode || 'original';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col justify-between p-2 sm:p-3 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="w-full max-w-md md:max-w-2xl mx-auto bg-slate-900 text-white px-3 py-2 flex items-center justify-between border border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Eye className="w-4 h-4 text-slate-300" />
          <span>Pratinjau Lembar A4</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Sheet Switcher */}
          <div className="flex items-center bg-slate-800 border border-slate-700">
            <button
              type="button"
              disabled={currentSheetIdx === 0}
              onClick={() => setCurrentSheetIdx((prev) => Math.max(0, prev - 1))}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-25"
              title="Lembar Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-bold text-white">
              {currentSheetIdx + 1} / {totalSheets}
            </span>
            <button
              type="button"
              disabled={currentSheetIdx === totalSheets - 1}
              onClick={() => setCurrentSheetIdx((prev) => Math.min(totalSheets - 1, prev + 1))}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-25"
              title="Lembar Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Middle: A4 Sheet Scaled View (scroll vertikal saja) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden my-2 flex justify-center items-start px-1">
        <div className="w-full max-w-md md:max-w-2xl bg-white text-slate-950 p-2.5 sm:p-3 md:p-4 border border-black flex flex-col justify-between shadow-lg">
          {/* 1. Header Laporan Resmi dengan Logo PT */}
          <div>
            <div className="bg-white border border-black p-1.5 md:p-2 flex items-center gap-2 mb-1">
              <img
                src="/logo.jpg"
                alt="Logo PGE"
                className="w-7 h-7 md:w-9 md:h-9 object-contain rounded-xs border border-slate-300 p-0.5 shrink-0"
              />
              <div className="min-w-0 leading-tight">
                <div className="text-[10px] sm:text-[11px] md:text-xs font-black uppercase text-black truncate">
                  {companyDisplay}
                </div>
                <div className="text-[9px] md:text-[11px] font-bold text-slate-700 uppercase truncate">
                  {meta.projectName.trim() || 'DOKUMENTASI PEKERJAAN MAINTENANCE'}
                </div>
              </div>
            </div>

            {/* Kop Meta Info */}
            <div className="grid grid-cols-3 text-[9px] sm:text-[10px] md:text-[11px] border border-black p-1.5 mb-2 bg-white gap-1 leading-tight">
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">LOKASI:</span>
                <strong className="text-slate-900 block truncate">{meta.location || '-'}</strong>
              </div>
              <div className="border-x border-slate-300 px-1 min-w-0">
                <span className="text-slate-500 font-medium block">TEKNISI:</span>
                <strong className="text-slate-900 block truncate">{meta.technicianName || '-'}</strong>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">TANGGAL:</span>
                <strong className="text-slate-900 block truncate">
                  {meta.date} {meta.jobOrderNumber ? `(${meta.jobOrderNumber})` : ''}
                </strong>
              </div>
            </div>

            {/* 2. Grid 2x3 */}
            <div className="space-y-1.5 md:space-y-2">
              {currentSheet.rows.map((row, rIdx) => {
                const baseBoxNum = (currentSheet.sheetNumber - 1) * 6;
                const leftBoxNumber = row.beforeNumber ?? (baseBoxNum + rIdx * 2 + 1);
                const rightBoxNumber = row.afterNumber ?? (baseBoxNum + rIdx * 2 + 2);
                const leftFit = row.beforePhoto?.fitMode || globalFitMode;
                const rightFit = row.afterPhoto?.fitMode || globalFitMode;

                return (
                  <div key={row.id || rIdx} className="grid grid-cols-2 gap-2 md:gap-3 items-start">
                    {/* Before Column */}
                    <div className="flex flex-col border border-black min-w-0">
                      {meta.showBeforeAfterLabels && (
                        <div className="bg-slate-800 text-white text-[9px] md:text-[10px] font-bold text-center py-0.5 tracking-wider uppercase border-b border-black">
                          BEFORE
                        </div>
                      )}
                      <div
                        className={`w-full aspect-[87/70] bg-white overflow-hidden flex items-center justify-center ${
                          leftFit === 'fill' ? '' : 'p-0.5'
                        }`}
                      >
                        {row.beforePhoto ? (
                          <img
                            src={row.beforePhoto.dataUrl}
                            alt="Before"
                            className={`w-full h-full ${
                              leftFit === 'fill' ? 'object-fill' : 'object-contain'
                            }`}
                          />
                        ) : (
                          <span className="text-[9px] md:text-[10px] text-slate-400 italic">
                            (Belum Ada Foto)
                          </span>
                        )}
                      </div>
                      {/* Caption row */}
                      <div className="flex items-center border-t border-black bg-white">
                        <div className="w-6 md:w-7 py-0.5 bg-white text-center font-bold text-[9px] md:text-[10px] text-black border-r border-black shrink-0">
                          {leftBoxNumber}
                        </div>
                        <div className="px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold text-black uppercase truncate flex-1">
                          {row.beforeCaption || '-'}
                        </div>
                      </div>
                    </div>

                    {/* After Column */}
                    <div className="flex flex-col border border-black min-w-0">
                      {meta.showBeforeAfterLabels && (
                        <div className="bg-slate-800 text-white text-[9px] md:text-[10px] font-bold text-center py-0.5 tracking-wider uppercase border-b border-black">
                          AFTER
                        </div>
                      )}
                      <div
                        className={`w-full aspect-[87/70] bg-white overflow-hidden flex items-center justify-center ${
                          rightFit === 'fill' ? '' : 'p-0.5'
                        }`}
                      >
                        {row.afterPhoto ? (
                          <img
                            src={row.afterPhoto.dataUrl}
                            alt="After"
                            className={`w-full h-full ${
                              rightFit === 'fill' ? 'object-fill' : 'object-contain'
                            }`}
                          />
                        ) : (
                          <span className="text-[9px] md:text-[10px] text-slate-400 italic">
                            (Belum Ada Foto)
                          </span>
                        )}
                      </div>
                      {/* Caption row */}
                      <div className="flex items-center border-t border-black bg-white">
                        <div className="w-6 md:w-7 py-0.5 bg-white text-center font-bold text-[9px] md:text-[10px] text-black border-r border-black shrink-0">
                          {rightBoxNumber}
                        </div>
                        <div className="px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold text-black uppercase truncate flex-1">
                          {row.afterCaption || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Footer */}
          <div className="pt-2 mt-2 border-t border-slate-300 flex items-center justify-between text-[9px] md:text-[10px] text-slate-500">
            <span className="truncate">{companyDisplay}</span>
            <span className="font-bold text-slate-900 shrink-0">
              Lembar {currentSheetIdx + 1} dari {totalSheets}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons: JPG, PDF, Word */}
      <div className="w-full max-w-md md:max-w-2xl mx-auto bg-slate-900 text-white p-2 grid grid-cols-3 gap-1.5 border border-slate-800">
        <button
          type="button"
          disabled={isExporting}
          onClick={() => onDownloadJPG(currentSheetIdx)}
          className="py-2 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white border border-slate-600 font-bold text-xs flex items-center justify-center gap-1"
        >
          <ImageIcon className="w-3.5 h-3.5 shrink-0" />
          <span>JPG ({currentSheetIdx + 1})</span>
        </button>

        <button
          type="button"
          disabled={isExporting}
          onClick={onDownloadPDF}
          className="py-2 px-2 bg-slate-100 hover:bg-white disabled:opacity-40 text-slate-950 border border-black font-extrabold text-xs flex items-center justify-center gap-1"
        >
          <FileDown className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
          <span>PDF</span>
        </button>

        <button
          type="button"
          disabled={isExporting}
          onClick={onDownloadDOCX}
          className="py-2 px-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white border border-blue-900 font-bold text-xs flex items-center justify-center gap-1"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Word</span>
        </button>
      </div>
    </div>
  );
};
