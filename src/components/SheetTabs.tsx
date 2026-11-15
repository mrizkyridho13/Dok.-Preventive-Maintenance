import React from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Sheet } from '../types/report';

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheetIndex: number;
  onSelectSheet: (index: number) => void;
  onAddSheet: () => void;
  onRequestDeleteSheet: (index: number) => void;
  onRequestResetAll: () => void;
}

export const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets,
  activeSheetIndex,
  onSelectSheet,
  onAddSheet,
  onRequestDeleteSheet,
  onRequestResetAll,
}) => {
  const currentSheet = sheets[activeSheetIndex] || sheets[0];
  const totalSheets = sheets.length;

  const firstUnit = currentSheet.rows[0]?.unitNumber ?? 1;
  const lastUnit = currentSheet.rows[2]?.unitNumber ?? firstUnit + 2;

  // Calculate filled photo count on current sheet
  let currentSheetFilled = 0;
  currentSheet.rows.forEach((r) => {
    if (r.beforePhoto) currentSheetFilled++;
    if (r.afterPhoto) currentSheetFilled++;
  });

  return (
    <div className="w-full bg-slate-900 text-white p-2.5 sm:p-3 border border-slate-800 space-y-2 select-none">
      {/* 1. Main Sheet Pager: Fits comfortably in 1 mobile screen without horizontal scroll */}
      <div className="flex items-center justify-between gap-1.5">
        {/* Tombol Lembar Sebelumnya */}
        <button
          type="button"
          disabled={activeSheetIndex === 0}
          onClick={() => onSelectSheet(activeSheetIndex - 1)}
          className="h-9 w-9 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-25 flex items-center justify-center border border-slate-700 text-white shrink-0"
          title="Lembar Sebelumnya"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Pemilih Lembar Dropdown / Status */}
        <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-slate-800 border border-slate-700 h-9 px-2">
          <select
            value={activeSheetIndex}
            onChange={(e) => onSelectSheet(Number(e.target.value))}
            className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-hidden cursor-pointer truncate max-w-full"
          >
            {sheets.map((s, idx) => {
              const f1 = idx * 6 + 1;
              const f6 = idx * 6 + 6;
              return (
                <option key={s.id || idx} value={idx} className="bg-slate-900 text-white">
                  Lembar {idx + 1} / {totalSheets} (Foto #{f1} - #{f6})
                </option>
              );
            })}
          </select>
        </div>

        {/* Tombol Lembar Berikutnya */}
        <button
          type="button"
          disabled={activeSheetIndex === totalSheets - 1}
          onClick={() => onSelectSheet(activeSheetIndex + 1)}
          className="h-9 w-9 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-25 flex items-center justify-center border border-slate-700 text-white shrink-0"
          title="Lembar Berikutnya"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Tombol Tambah Lembar */}
        {sheets.length < 35 && (
          <button
            type="button"
            onClick={onAddSheet}
            className="h-9 px-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold text-xs flex items-center gap-1 border border-slate-600 shrink-0"
            title="Tambah Lembar Baru"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">+ Lembar</span>
          </button>
        )}
      </div>

      {/* 2. Sub-Bar: Info Ringkas & Aksi Hapus / Reset */}
      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
        <div>
          Foto Lembar Ini: <strong className="text-white">{currentSheetFilled}/6</strong> &bull; Total Lembar: <strong className="text-white">{totalSheets}</strong>
        </div>

        <div className="flex items-center gap-1.5">
          {totalSheets > 1 && (
            <button
              type="button"
              onClick={() => onRequestDeleteSheet(activeSheetIndex)}
              className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-[10px] font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Hapus Lembar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRequestResetAll}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-semibold flex items-center gap-1"
            title="Kembali ke 1 lembar kosong"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
