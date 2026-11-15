/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Sheet,
  ReportMeta,
  PhotoItem,
  DEFAULT_META,
} from './types/report';
import {
  saveReportToIndexedDB,
  loadReportFromIndexedDB,
  resetReportInIndexedDB,
  createEmptySheet,
  renumberSheets,
} from './utils/db';
import { generateReportPDF } from './utils/pdfGenerator';
import { generateSheetJPG } from './utils/jpgGenerator';
import { Header } from './components/Header';
import { SheetTabs } from './components/SheetTabs';
import { SheetGrid } from './components/SheetGrid';
import { ReportInfoModal } from './components/ReportInfoModal';
import { PreviewModal } from './components/PreviewModal';
import { ConfirmModal } from './components/ConfirmModal';
import {
  Plus,
  FileDown,
  Image as ImageIcon,
  Eye,
  CheckCircle,
  Building,
} from 'lucide-react';

export default function App() {
  // State: Sheets & Report Meta
  const [sheets, setSheets] = useState<Sheet[]>(() => [createEmptySheet(1, 1)]);
  const [meta, setMeta] = useState<ReportMeta>(DEFAULT_META);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Status flags
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Debounced save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. Initial Load from IndexedDB
  useEffect(() => {
    async function initDB() {
      try {
        const savedData = await loadReportFromIndexedDB();
        if (savedData && savedData.sheets && savedData.sheets.length > 0) {
          setSheets(savedData.sheets);
          if (savedData.meta) setMeta(savedData.meta);
          if (typeof savedData.activeSheetIndex === 'number') {
            setActiveSheetIndex(
              Math.min(savedData.activeSheetIndex, savedData.sheets.length - 1)
            );
          }
        }
      } catch (e) {
        console.error('Failed to load initial data from IndexedDB:', e);
      } finally {
        setIsLoaded(true);
      }
    }
    initDB();
  }, []);

  // 2. Auto-save to IndexedDB whenever sheets, meta, or activeSheetIndex changes
  useEffect(() => {
    if (!isLoaded) return;

    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveReportToIndexedDB(sheets, meta, activeSheetIndex);
      } catch (err) {
        console.warn('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [sheets, meta, activeSheetIndex, isLoaded]);

  // Active Sheet safe getter
  const currentSheet = sheets[activeSheetIndex] || sheets[0];

  // Handler: Update row in current sheet
  const handleUpdateRow = (
    rowIndex: number,
    field: 'beforePhoto' | 'afterPhoto' | 'beforeCaption' | 'afterCaption',
    value: PhotoItem | string | undefined
  ) => {
    setSheets((prevSheets) => {
      return prevSheets.map((sheet, sIdx) => {
        if (sIdx !== activeSheetIndex) return sheet;

        const updatedRows = [...sheet.rows] as [
          (typeof sheet.rows)[0],
          (typeof sheet.rows)[1],
          (typeof sheet.rows)[2],
        ];

        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          [field]: value,
        };

        return {
          ...sheet,
          rows: updatedRows,
        };
      });
    });
  };

  // Handler: Copy caption from Before to After
  const handleCopyCaptionToRight = (rowIndex: number) => {
    setSheets((prevSheets) => {
      return prevSheets.map((sheet, sIdx) => {
        if (sIdx !== activeSheetIndex) return sheet;

        const updatedRows = [...sheet.rows] as [
          (typeof sheet.rows)[0],
          (typeof sheet.rows)[1],
          (typeof sheet.rows)[2],
        ];

        const targetRow = updatedRows[rowIndex];
        updatedRows[rowIndex] = {
          ...targetRow,
          afterCaption: targetRow.beforeCaption,
        };

        return {
          ...sheet,
          rows: updatedRows,
        };
      });
    });
    showToast(`Keterangan disalin ke Unit #${currentSheet.rows[rowIndex]?.unitNumber} AFTER`);
  };

  // Handler: Add New Sheet (up to 35 sheets / 105 units)
  const handleAddSheet = () => {
    if (sheets.length >= 35) {
      alert('Maksimal 35 lembar laporan tercapai (105 unit).');
      return;
    }

    const nextSheetNum = sheets.length + 1;
    const lastSheet = sheets[sheets.length - 1];
    const lastUnitNumber = lastSheet?.rows[2]?.unitNumber ?? sheets.length * 3;
    const newSheet = createEmptySheet(nextSheetNum, lastUnitNumber + 1);

    const updated = [...sheets, newSheet];
    setSheets(updated);
    setActiveSheetIndex(updated.length - 1);
    showToast(`Lembar ${nextSheetNum} (Unit ${lastUnitNumber + 1} - ${lastUnitNumber + 3}) ditambahkan`);
  };

  // Handler: Delete Sheet
  const handleConfirmDeleteSheet = () => {
    if (deleteConfirmIndex === null) return;
    if (sheets.length <= 1) {
      alert('Minimal harus ada 1 lembar laporan.');
      return;
    }

    const filtered = sheets.filter((_, idx) => idx !== deleteConfirmIndex);
    const renumbered = renumberSheets(filtered);
    setSheets(renumbered);

    const newIndex = Math.min(deleteConfirmIndex, renumbered.length - 1);
    setActiveSheetIndex(Math.max(0, newIndex));
    setDeleteConfirmIndex(null);
    showToast('Lembar berhasil dihapus');
  };

  // Handler: Reset All to 1 Blank Sheet
  const handleConfirmResetAll = async () => {
    await resetReportInIndexedDB();
    const freshSheet = createEmptySheet(1, 1);
    setSheets([freshSheet]);
    setActiveSheetIndex(0);
    setIsResetConfirmOpen(false);
    showToast('Semua lembar di-reset ke 1 lembar kosong');
  };

  // Handler: Download All Sheets as Multi-page PDF
  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true);
      showToast('Menyiapkan file PDF A4...');
      const blob = await generateReportPDF(sheets, meta);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = (meta.date || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `Laporan_Maintenance_${cleanLoc}_${cleanDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Unduh PDF selesai');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Gagal menghasilkan dokumen PDF. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler: Download Single Sheet as JPG (WhatsApp friendly)
  const handleDownloadCurrentJPG = async (sheetIdx: number = activeSheetIndex) => {
    try {
      setIsExporting(true);
      const targetSheet = sheets[sheetIdx] || currentSheet;
      showToast(`Menyiapkan JPG Lembar ${targetSheet.sheetNumber}...`);

      const blob = await generateSheetJPG(targetSheet, meta, sheets.length);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `Laporan_${cleanLoc}_Lembar_${targetSheet.sheetNumber}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`JPG Lembar ${targetSheet.sheetNumber} selesai diunduh`);
    } catch (err) {
      console.error('JPG export error:', err);
      alert('Gagal menghasilkan file gambar JPG. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler: Toggle Global Photo Fit Mode ('original' <-> 'fill') and apply across photos
  const handleTogglePhotoFitMode = () => {
    const currentMode = meta.photoFitMode || 'original';
    const nextMode = currentMode === 'fill' ? 'original' : 'fill';

    setMeta((prev) => ({
      ...prev,
      photoFitMode: nextMode,
    }));

    // Reset per-photo overrides so all photos immediately follow the chosen global mode
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => ({
        ...sheet,
        rows: sheet.rows.map((row) => ({
          ...row,
          beforePhoto: row.beforePhoto
            ? { ...row.beforePhoto, fitMode: undefined }
            : undefined,
          afterPhoto: row.afterPhoto
            ? { ...row.afterPhoto, fitMode: undefined }
            : undefined,
        })) as typeof sheet.rows,
      }))
    );

    showToast(
      nextMode === 'fill'
        ? 'Mode semua foto: Sesuaikan Kotak (isi kolom)'
        : 'Mode semua foto: Sesuai Aslinya'
    );
  };

  return (
    // Responsive root: adapts to mobile & PC/laptop cleanly with vertical scroll only
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col font-sans overflow-x-hidden">
      {/* 1. Header Toolbar (Static: tidak melayang / tidak mengikuti layar) */}
      <Header
        meta={meta}
        activeSheetNumber={activeSheetIndex + 1}
        totalSheets={sheets.length}
        onUpdateMeta={setMeta}
        onTogglePhotoFitMode={handleTogglePhotoFitMode}
        onOpenMetaModal={() => setIsMetaModalOpen(true)}
        onOpenPreview={() => setIsPreviewModalOpen(true)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadCurrentJPG={() => handleDownloadCurrentJPG(activeSheetIndex)}
        isSaving={isSaving}
        isExporting={isExporting}
      />

      {/* 2. Main Content Container (Menyesuaikan Mobile, Tablet, & PC/Laptop tanpa geser kanan-kiri) */}
      <main className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-2 py-2 sm:px-4 md:py-4 space-y-2 md:space-y-3 flex-1 min-w-0">
        {/* Kop Ringkas Dokumen (Format Sederhana & Formal dengan Logo PT) */}
        <div className="bg-white border border-slate-300 p-2 md:p-3 text-xs select-none shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/logo.jpg"
                alt="Logo PGE"
                className="w-7 h-7 md:w-8 md:h-8 object-contain rounded-xs border border-slate-300 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-black text-slate-900 uppercase tracking-tight text-[11px] md:text-xs truncate">
                  {(meta.companyName || 'PT. PANCA GATRIK ELEKTRINDO').trim().toUpperCase()}
                </div>
                <div className="font-semibold text-slate-600 text-[10px] md:text-[11px] truncate">
                  {meta.projectName || 'DOKUMENTASI MAINTENANCE'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMetaModalOpen(true)}
              className="text-[10px] md:text-[11px] text-slate-700 hover:text-black font-bold px-2 py-1 bg-slate-100 border border-slate-300 shrink-0"
            >
              Ubah Data
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 text-[11px] md:text-xs text-slate-600">
            <div className="min-w-0 truncate">
              Lokasi: <strong className="text-slate-900">{meta.location || '-'}</strong>
            </div>
            <div className="min-w-0 truncate">
              Teknisi: <strong className="text-slate-900">{meta.technicianName || '-'}</strong>
            </div>
            <div className="min-w-0 truncate">
              Tanggal: <strong className="text-slate-900">{meta.date}</strong>
            </div>
            {meta.jobOrderNumber && (
              <div className="min-w-0 truncate">
                SPK: <strong className="text-slate-900">{meta.jobOrderNumber}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 3. Sheet Navigator (Navigasi Lembar Sederhana & Bebas Geser Samping) */}
        <SheetTabs
          sheets={sheets}
          activeSheetIndex={activeSheetIndex}
          onSelectSheet={setActiveSheetIndex}
          onAddSheet={handleAddSheet}
          onRequestDeleteSheet={(idx) => setDeleteConfirmIndex(idx)}
          onRequestResetAll={() => setIsResetConfirmOpen(true)}
        />

        {/* 4. Sheet Grid 2x3 (6 Kotak Foto Sederhana, Garis Bingkai Tipis Hitam) */}
        <div className="w-full min-w-0">
          <SheetGrid
            sheet={currentSheet}
            showLabels={meta.showBeforeAfterLabels}
            globalFitMode={meta.photoFitMode || 'original'}
            onUpdateRow={handleUpdateRow}
            onCopyCaptionToRight={handleCopyCaptionToRight}
          />
        </div>

        {/* 5. Bagian Bawah Halaman (Static di alur dokumen biasa, TIDAK melayang/sticky) */}
        <div className="pt-2 pb-6 space-y-2">
          {/* Baris Tombol Aksi Bawah */}
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-900 border border-black font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-700" />
              <span>Pratinjau</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleDownloadCurrentJPG(activeSheetIndex)}
              className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />
              <span>Unduh JPG</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPDF}
              className="py-2.5 px-2 bg-slate-900 hover:bg-black active:bg-slate-950 disabled:opacity-40 text-white font-black text-xs md:text-sm flex items-center justify-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-white stroke-[2.5]" />
              <span>Unduh PDF</span>
            </button>
          </div>

          {/* Tombol Tambah Lembar di Bawah */}
          {sheets.length < 35 && (
            <button
              type="button"
              onClick={handleAddSheet}
              className="w-full py-2 md:py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-400 font-bold text-xs md:text-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Tambah Lembar Baru (Total Saat Ini: {sheets.length} Lembar)</span>
            </button>
          )}

          <div className="text-[10px] md:text-xs text-slate-500 text-center pt-1">
            Format resmi 2x3 A4 &bull; Foto tersimpan otomatis di perangkat &bull; Bebas kuota / offline
          </div>
        </div>
      </main>

      {/* Floating Toast Notification (Hanya muncul sebentar saat aksi berhasil) */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-3 py-1.5 shadow-xl border border-white text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-100">
          <CheckCircle className="w-3.5 h-3.5 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {/* 1. Header/Kop Information Modal */}
      <ReportInfoModal
        isOpen={isMetaModalOpen}
        meta={meta}
        onSave={(newMeta) => {
          setMeta(newMeta);
          showToast('Kop laporan disimpan');
        }}
        onClose={() => setIsMetaModalOpen(false)}
      />

      {/* 2. Full A4 Document Preview Modal */}
      <PreviewModal
        isOpen={isPreviewModalOpen}
        sheets={sheets}
        meta={meta}
        activeSheetIndex={activeSheetIndex}
        onClose={() => setIsPreviewModalOpen(false)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadJPG={(idx) => handleDownloadCurrentJPG(idx)}
        isExporting={isExporting}
      />

      {/* 3. Confirm Delete Sheet Modal */}
      <ConfirmModal
        isOpen={deleteConfirmIndex !== null}
        title="Hapus Lembar Ini?"
        message={`Apakah Anda yakin ingin menghapus Lembar ${(deleteConfirmIndex ?? 0) + 1}? Foto pada lembar ini akan dihapus permanen.`}
        confirmLabel="Ya, Hapus"
        isDestructive={true}
        onConfirm={handleConfirmDeleteSheet}
        onClose={() => setDeleteConfirmIndex(null)}
      />

      {/* 4. Confirm Reset All Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset Semua Lembar?"
        message="Aplikasi akan dikembalikan ke 1 lembar kosong. Pastikan PDF/JPG sudah diunduh jika masih diperlukan."
        confirmLabel="Ya, Reset Semua"
        isDestructive={true}
        onConfirm={handleConfirmResetAll}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
