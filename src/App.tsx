/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Media, MediaAsset } from '@capacitor-community/media';
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
import { generateSheetJPG } from './utils/jpgGenerator';
import { getThumbnailSrc, loadAndCompressMediaAsset } from './utils/mediaLoader';
import { saveExportedFile, shareExportedFile } from './utils/nativeExport';
import { handleTopBackAction } from './utils/backButtonManager';
import { useBackHandler } from './hooks/useAndroidBackButton';
import { Header } from './components/Header';
import { SheetTabs } from './components/SheetTabs';
import { SheetGrid } from './components/SheetGrid';
import { ReportInfoModal } from './components/ReportInfoModal';
import { PreviewModal } from './components/PreviewModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ShareModal } from './components/ShareModal';
import {
  Plus,
  FileDown,
  FileText,
  Image as ImageIcon,
  Eye,
  CheckCircle,
  Camera,
  X,
  Share2,
  LogOut,
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  // Auto-capture state (Timestamp / Timemark return detection)
  const [pendingAutoCapture, setPendingAutoCapture] = useState<{
    slotId: string;
    asset: MediaAsset;
    slotLabel: string;
  } | null>(null);
  const [isApplyingAutoCapture, setIsApplyingAutoCapture] = useState(false);

  // Debounced save ref, toast timer ref & latest sheets ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetsRef = useRef<Sheet[]>(sheets);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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

  // 3. Auto-Capture Detector when returning from Camera / Timemark / Timestamp Camera
  const formatSlotLabel = useCallback((slotId: string): string => {
    const [sheetId, rowIdxStr, side] = slotId.split('::');
    const rowIdx = Number(rowIdxStr);
    const targetSheet = sheetsRef.current.find((s) => s.id === sheetId);
    if (!targetSheet || Number.isNaN(rowIdx)) {
      return 'Kotak Foto Aktif';
    }
    const row = targetSheet.rows[rowIdx];
    const boxNum =
      side === 'before'
        ? row?.beforeNumber ?? ((targetSheet.sheetNumber - 1) * 6 + rowIdx * 2 + 1)
        : row?.afterNumber ?? ((targetSheet.sheetNumber - 1) * 6 + rowIdx * 2 + 2);
    return `Foto #${boxNum} (${side === 'before' ? 'BEFORE' : 'AFTER'})`;
  }, []);

  const checkRecentTimestampPhoto = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    let activeSlotId: string | null = null;
    let openedAt = 0;
    let lastCapturedId: string | null = null;
    try {
      activeSlotId = localStorage.getItem('active_slot_id');
      openedAt = Number(localStorage.getItem('active_slot_opened_at') || '0');
      lastCapturedId = localStorage.getItem('last_auto_captured_media_id');
    } catch {
      return;
    }

    if (!activeSlotId) return;

    try {
      const res = await Media.getMedias({
        quantity: 1,
        thumbnailWidth: 360,
        thumbnailHeight: 360,
        thumbnailQuality: 80,
        types: 'photos',
        sort: 'creationDate',
      });

      const newest = res.medias?.[0];
      if (!newest || !newest.identifier) return;
      if (newest.identifier === lastCapturedId) return;

      const createdMs = newest.creationDate ? new Date(newest.creationDate).getTime() : 0;
      const now = Date.now();
      const withinOneMinute = createdMs > 0 && now - createdMs <= 60_000;
      const takenAfterTap = openedAt <= 0 || createdMs >= openedAt - 10_000;

      if (withinOneMinute && takenAfterTap) {
        setPendingAutoCapture({
          slotId: activeSlotId,
          asset: newest,
          slotLabel: formatSlotLabel(activeSlotId),
        });
      }
    } catch (err) {
      console.warn('Auto-capture check skipped:', err);
    }
  }, [formatSlotLabel]);

  useEffect(() => {
    let removeNativeListener: (() => void) | undefined;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleCheck = () => {
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        void checkRecentTimestampPhoto();
      }, 400);
    };

    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          scheduleCheck();
        }
      }).then((handle) => {
        removeNativeListener = () => {
          void handle.remove();
        };
      });
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (checkTimer) clearTimeout(checkTimer);
      removeNativeListener?.();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkRecentTimestampPhoto]);

  // 3b. Android Hardware Back Button Handler & Clean Unmount Listener Cleanup
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;
    let backHandle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener('backButton', () => {
      const closedTopModal = handleTopBackAction();
      if (!closedTopModal) {
        setIsExitConfirmOpen(true);
      }
    }).then((handle) => {
      if (isMounted) {
        backHandle = handle;
      } else {
        void handle.remove();
      }
    });

    return () => {
      isMounted = false;
      if (backHandle) {
        void backHandle.remove();
      }
      void CapacitorApp.removeAllListeners();
    };
  }, []);

  const handleConfirmAutoCapture = async () => {
    if (!pendingAutoCapture) return;
    try {
      setIsApplyingAutoCapture(true);
      const compressedDataUrl = await loadAndCompressMediaAsset(pendingAutoCapture.asset);
      const [sheetId, rowIdxStr, side] = pendingAutoCapture.slotId.split('::');
      const rowIdx = Number(rowIdxStr);
      const field = side === 'before' ? 'beforePhoto' : 'afterPhoto';

      const newPhoto: PhotoItem = {
        id: `p-${Date.now()}`,
        dataUrl: compressedDataUrl,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };

      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== sheetId || Number.isNaN(rowIdx)) return sheet;
          const updatedRows = [...sheet.rows] as typeof sheet.rows;
          const existingRow = updatedRows[rowIdx];
          if (!existingRow) return sheet;

          updatedRows[rowIdx] = {
            ...existingRow,
            [field]: {
              ...newPhoto,
              fitMode: existingRow[field]?.fitMode,
            },
          };

          return {
            ...sheet,
            rows: updatedRows,
          };
        })
      );

      try {
        localStorage.setItem('last_auto_captured_media_id', pendingAutoCapture.asset.identifier);
        localStorage.removeItem('active_slot_id');
        localStorage.removeItem('active_slot_opened_at');
      } catch {
        // Ignore storage errors
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }

      const appliedLabel = pendingAutoCapture.slotLabel;
      setPendingAutoCapture(null);
      showToast(`Foto Timestamp dimasukkan ke ${appliedLabel}`);
    } catch (err) {
      console.error('Failed to apply auto-captured photo:', err);
      showToast('Gagal memuat foto terbaru. Silakan pilih lewat Dari Galeri.');
    } finally {
      setIsApplyingAutoCapture(false);
    }
  };

  const handleDismissAutoCapture = () => {
    if (pendingAutoCapture?.asset?.identifier) {
      try {
        localStorage.setItem('last_auto_captured_media_id', pendingAutoCapture.asset.identifier);
        localStorage.removeItem('active_slot_id');
        localStorage.removeItem('active_slot_opened_at');
      } catch {
        // Ignore storage errors
      }
    }
    setPendingAutoCapture(null);
  };

  useBackHandler(Boolean(pendingAutoCapture), handleDismissAutoCapture, 30);

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
      showToast('Maksimal 35 lembar laporan tercapai (105 unit).');
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
      showToast('Minimal harus ada 1 lembar laporan.');
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
      const { generateReportPDF } = await import('./utils/pdfGenerator');
      const blob = await generateReportPDF(sheets, meta);
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = (meta.date || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Laporan_Maintenance_${cleanLoc}_${cleanDate}.pdf`;
      const savedToast = await saveExportedFile(blob, fileName, 'pdf');
      showToast(savedToast);
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Gagal menghasilkan dokumen PDF. Silakan coba lagi.');
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
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Laporan_${cleanLoc}_Lembar_${targetSheet.sheetNumber}.jpg`;
      const savedToast = await saveExportedFile(blob, fileName, 'jpg');
      showToast(savedToast);
    } catch (err) {
      console.error('JPG export error:', err);
      showToast('Gagal menghasilkan file JPG. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler: Download All Sheets as Editable Word (.docx)
  const handleDownloadDOCX = async () => {
    try {
      setIsExporting(true);
      showToast('Menyiapkan dokumen Word (.docx)...');
      const { generateReportDOCX } = await import('./utils/docxGenerator');
      const blob = await generateReportDOCX(sheets, meta);
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = (meta.date || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Laporan_Maintenance_${cleanLoc}_${cleanDate}.docx`;
      const savedToast = await saveExportedFile(blob, fileName, 'docx');
      showToast(savedToast);
    } catch (err) {
      console.error('DOCX export error:', err);
      showToast('Gagal menghasilkan file Word. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler: Share (CamScanner-style Cache + Share sheet)
  const handleShareFormat = async (format: 'pdf' | 'jpg' | 'docx') => {
    try {
      setIsExporting(true);
      const cleanLoc = (meta.location || 'Teknisi').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = (meta.date || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (format === 'pdf') {
        showToast('Menyiapkan PDF untuk dibagikan...');
        const { generateReportPDF } = await import('./utils/pdfGenerator');
        const blob = await generateReportPDF(sheets, meta);
        await shareExportedFile(blob, `Laporan_Maintenance_${cleanLoc}_${cleanDate}.pdf`, 'pdf');
      } else if (format === 'jpg') {
        showToast(`Menyiapkan JPG Lembar ${currentSheet.sheetNumber} untuk dibagikan...`);
        const blob = await generateSheetJPG(currentSheet, meta, sheets.length);
        await shareExportedFile(blob, `Laporan_${cleanLoc}_Lembar_${currentSheet.sheetNumber}.jpg`, 'jpg');
      } else {
        showToast('Menyiapkan Word (.docx) untuk dibagikan...');
        const { generateReportDOCX } = await import('./utils/docxGenerator');
        const blob = await generateReportDOCX(sheets, meta);
        await shareExportedFile(blob, `Laporan_Maintenance_${cleanLoc}_${cleanDate}.docx`, 'docx');
      }
      setIsShareModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel|dismiss|abort/i.test(msg)) {
        console.error('Share error:', err);
        showToast('Gagal membagikan file. Silakan coba lagi.');
      }
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
        onDownloadDOCX={handleDownloadDOCX}
        onOpenShareModal={() => setIsShareModalOpen(true)}
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
          {/* Baris Tombol Aksi Bawah (Pratinjau, JPG, PDF, Word) + Ikon Bagikan (Share) */}
          <div className="flex items-stretch gap-1.5 md:gap-2">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-900 border border-black font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-700 shrink-0" />
                <span>Pratinjau</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleDownloadCurrentJPG(activeSheetIndex)}
                className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300 shrink-0" />
                <span>Unduh JPG</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadPDF}
                className="py-2.5 px-2 bg-slate-900 hover:bg-black active:bg-slate-950 disabled:opacity-40 text-white font-black text-xs md:text-sm flex items-center justify-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-white stroke-[2.5] shrink-0" />
                <span>Unduh PDF</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadDOCX}
                className="py-2.5 px-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 disabled:opacity-40 text-white border border-blue-900 font-bold text-xs md:text-sm flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-100 shrink-0" />
                <span>Unduh Word</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => setIsShareModalOpen(true)}
              className="w-11 md:w-12 shrink-0 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white border border-emerald-800 flex items-center justify-center shadow-2xs transition active:scale-95"
              title="Bagikan laporan (PDF / JPEG / Word)"
              aria-label="Bagikan laporan"
            >
              <Share2 className="w-4 h-4 md:w-5 md:h-5" />
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
            Format resmi 2x3 A4 &bull; Unduh PDF, JPG, Word &bull; Bebas kuota / offline
          </div>
        </div>
      </main>

      {/* Quick 1-Click Auto-Capture Banner for Recent Timestamp / Timemark Photo */}
      {pendingAutoCapture && (
        <div className="fixed bottom-3 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-50 bg-slate-900 text-white border-2 border-amber-400 p-2.5 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4">
          <img
            src={getThumbnailSrc(pendingAutoCapture.asset)}
            alt="Foto terbaru Timestamp"
            className="w-12 h-12 object-cover border border-slate-600 shrink-0 bg-black"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1 truncate">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Gunakan foto terbaru dari Timestamp?</span>
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              Tujuan: <strong className="text-white">{pendingAutoCapture.slotLabel}</strong>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                type="button"
                disabled={isApplyingAutoCapture}
                onClick={() => void handleConfirmAutoCapture()}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-[11px] border border-amber-200 transition active:scale-95"
              >
                {isApplyingAutoCapture ? 'Memproses...' : 'Ya, Gunakan Foto Ini'}
              </button>
              <button
                type="button"
                disabled={isApplyingAutoCapture}
                onClick={handleDismissAutoCapture}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] border border-slate-700"
              >
                Abaikan
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissAutoCapture}
            className="self-start text-slate-400 hover:text-white p-0.5"
            aria-label="Tutup konfirmasi foto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
        onDownloadDOCX={handleDownloadDOCX}
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

      {/* 5. CamScanner-style Share Format Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        activeSheetNumber={currentSheet.sheetNumber}
        isExporting={isExporting}
        onShareFormat={(fmt) => void handleShareFormat(fmt)}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* 6. Android Hardware Back Exit Confirmation Dialog */}
      <ConfirmModal
        isOpen={isExitConfirmOpen}
        title="Keluar dari aplikasi PGE DocuTek?"
        message="Pastikan laporan yang sedang dikerjakan sudah tersimpan atau diunduh."
        cancelLabel="Tidak"
        confirmLabel="Ya"
        isDestructive={false}
        backPriority={90}
        icon={<LogOut className="w-4 h-4" />}
        onConfirm={() => {
          void CapacitorApp.exitApp();
        }}
        onClose={() => setIsExitConfirmOpen(false)}
      />
    </div>
  );
}
