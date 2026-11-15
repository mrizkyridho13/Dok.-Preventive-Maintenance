import React from 'react';
import { Sheet, PhotoItem, PhotoFitMode } from '../types/report';
import { PhotoBox } from './PhotoBox';

interface SheetGridProps {
  sheet: Sheet;
  showLabels: boolean;
  globalFitMode: PhotoFitMode;
  onUpdateRow: (
    rowIndex: number,
    field: 'beforePhoto' | 'afterPhoto' | 'beforeCaption' | 'afterCaption',
    value: PhotoItem | string | undefined
  ) => void;
  onCopyCaptionToRight: (rowIndex: number) => void;
}

export const SheetGrid: React.FC<SheetGridProps> = ({
  sheet,
  showLabels,
  globalFitMode,
  onUpdateRow,
  onCopyCaptionToRight,
}) => {
  return (
    <div className="w-full space-y-2.5 md:space-y-3">
      {sheet.rows.map((row, rIdx) => (
        <div
          key={row.id || `row-${rIdx}`}
          className="bg-white border border-slate-300 p-1.5 sm:p-2 md:p-3 rounded-none shadow-2xs min-w-0"
        >
          {/* Unit Row Header - Ringkas & Bersih */}
          <div className="flex items-center justify-between pb-1 mb-1.5 md:mb-2 border-b border-slate-200 text-xs gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 border border-slate-400 text-[11px] shrink-0">
                UNIT #{row.unitNumber}
              </span>
              <span className="text-[11px] text-slate-500 font-medium truncate">
                (Kiri: Before &bull; Kanan: After)
              </span>
            </div>

            {row.beforeCaption && !row.afterCaption && (
              <button
                type="button"
                onClick={() => onCopyCaptionToRight(rIdx)}
                className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 border border-slate-300 shrink-0"
              >
                Salin ke Kanan &rarr;
              </button>
            )}
          </div>

          {/* 2 Kolom x 3 Baris: 2 Kolom Foto Pasangan (Before & After) */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-3 items-start">
            {/* Kolom Kiri: BEFORE */}
            <PhotoBox
              type="before"
              boxNumber={row.beforeNumber ?? ((sheet.sheetNumber - 1) * 6 + rIdx * 2 + 1)}
              photo={row.beforePhoto}
              caption={row.beforeCaption}
              showLabel={showLabels}
              globalFitMode={globalFitMode}
              onUpdatePhoto={(photo) => onUpdateRow(rIdx, 'beforePhoto', photo)}
              onUpdateCaption={(caption) => onUpdateRow(rIdx, 'beforeCaption', caption)}
              onCopyToRight={() => onCopyCaptionToRight(rIdx)}
            />

            {/* Kolom Kanan: AFTER */}
            <PhotoBox
              type="after"
              boxNumber={row.afterNumber ?? ((sheet.sheetNumber - 1) * 6 + rIdx * 2 + 2)}
              photo={row.afterPhoto}
              caption={row.afterCaption}
              showLabel={showLabels}
              globalFitMode={globalFitMode}
              onUpdatePhoto={(photo) => onUpdateRow(rIdx, 'afterPhoto', photo)}
              onUpdateCaption={(caption) => onUpdateRow(rIdx, 'afterCaption', caption)}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
