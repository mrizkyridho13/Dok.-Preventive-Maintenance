import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AppLauncher } from '@capacitor/app-launcher';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import {
  Camera,
  Image as ImageIcon,
  Clock,
  Trash2,
  RefreshCw,
  ZoomIn,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { PhotoItem, PhotoFitMode } from '../types/report';
import { processAndCompressImage } from '../utils/imageCompressor';
import { useBackHandler } from '../hooks/useAndroidBackButton';
import { LocalGalleryModal } from './LocalGalleryModal';

interface PhotoBoxProps {
  type: 'before' | 'after';
  slotId: string;
  boxNumber: number; // Sequential photo number (1, 2, 3, 4, 5, 6...)
  photo?: PhotoItem;
  caption: string;
  showLabel: boolean;
  globalFitMode: PhotoFitMode;
  onUpdatePhoto: (photo?: PhotoItem) => void;
  onUpdateCaption: (caption: string) => void;
  onCopyToRight?: () => void;
}

const TIMEMARK_PACKAGES = [
  'com.timestamper.timemark',
  'com.jeyluta.timestampcamerafree',
  'com.jeyluta.timestampcamera',
];

export const PhotoBox: React.FC<PhotoBoxProps> = ({
  type,
  slotId,
  boxNumber,
  photo,
  caption,
  showLabel,
  globalFitMode,
  onUpdatePhoto,
  onUpdateCaption,
  onCopyToRight,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [showLocalGallery, setShowLocalGallery] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Input 1 (web fallback): capture="environment" -> memicu kamera di browser mobile
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Input 2 (web/WebView fallback): pemilih file lokal browser / Android WebView
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useBackHandler(showActionMenu && Boolean(photo), () => setShowActionMenu(false), 55);
  useBackHandler(showFullView && Boolean(photo), () => setShowFullView(false), 65);

  const effectiveFitMode: PhotoFitMode = photo?.fitMode || globalFitMode;

  const saveCompressedPhoto = async (source: File | Blob | string) => {
    setIsProcessing(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
      const compressedDataUrl = await processAndCompressImage(source);
      onUpdatePhoto({
        id: `p-${Date.now()}`,
        dataUrl: compressedDataUrl,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fitMode: photo?.fitMode,
      });
      setShowActionMenu(false);
      setConfirmDelete(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await saveCompressedPhoto(file);
    } catch (err) {
      console.error('Error compressing image:', err);
    } finally {
      e.target.value = '';
    }
  };

  const saveActiveSlotForCapture = () => {
    try {
      localStorage.setItem('active_slot_id', slotId);
      localStorage.setItem('active_slot_opened_at', String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  };

  const clearActiveSlotForCapture = () => {
    try {
      localStorage.removeItem('active_slot_id');
      localStorage.removeItem('active_slot_opened_at');
    } catch {
      // Ignore storage errors
    }
  };

  const applyAlreadyCompressedPhoto = (compressedDataUrl: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    onUpdatePhoto({
      id: `p-${Date.now()}`,
      dataUrl: compressedDataUrl,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      fitMode: photo?.fitMode,
    });
    setShowActionMenu(false);
    setConfirmDelete(false);
  };

  const handleOpenCamera = async () => {
    saveActiveSlotForCapture();

    if (!Capacitor.isNativePlatform()) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      const captured = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (captured.dataUrl) {
        clearActiveSlotForCapture();
        await saveCompressedPhoto(captured.dataUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel|dismiss|abort|no image/i.test(msg)) {
        console.error('Native camera error:', err);
      }
    }
  };

  const handleOpenTimemark = async () => {
    saveActiveSlotForCapture();

    if (Capacitor.isNativePlatform()) {
      for (const pkg of TIMEMARK_PACKAGES) {
        try {
          const check = await AppLauncher.canOpenUrl({ url: pkg });
          if (check.value) {
            const launched = await AppLauncher.openUrl({ url: pkg });
            if (launched.completed) {
              return;
            }
          }
        } catch {
          // Coba paket aplikasi timestamp berikutnya
        }
      }

      // Fallback langsung via openUrl jika package query dibatasi perangkat
      for (const pkg of TIMEMARK_PACKAGES) {
        try {
          const launched = await AppLauncher.openUrl({ url: pkg });
          if (launched.completed) {
            return;
          }
        } catch {
          // Lanjut ke fallback kamera sistem
        }
      }

      // Jika Timemark/Timestamp Camera belum terinstal, buka kamera standar
      await handleOpenCamera();
      return;
    }

    // Di browser Android (Chrome), picu intent Android untuk Timemark -> fallback Timestamp Camera Free
    const isAndroidBrowser =
      typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (isAndroidBrowser) {
      const fallbackTimestamp = encodeURIComponent(
        'intent://#Intent;package=com.jeyluta.timestampcamerafree;end'
      );
      const intentLink = document.createElement('a');
      intentLink.href = `intent://#Intent;package=com.timestamper.timemark;S.browser_fallback_url=${fallbackTimestamp};end`;
      intentLink.style.display = 'none';
      document.body.appendChild(intentLink);
      intentLink.click();
      document.body.removeChild(intentLink);
      return;
    }

    // Di desktop browser, gunakan input kamera/file standar
    cameraInputRef.current?.click();
  };

  const handleFilePickerFallback = async () => {
    if (!Capacitor.isNativePlatform()) {
      galleryInputRef.current?.click();
      return;
    }

    try {
      const result = await FilePicker.pickFiles({
        types: ['image/*'],
        limit: 1,
        readData: true,
      });

      const picked = result.files?.[0];
      if (!picked) return;

      if (picked.blob) {
        await saveCompressedPhoto(picked.blob);
      } else if (picked.data) {
        const mimeType = picked.mimeType || 'image/jpeg';
        const dataUrl = picked.data.startsWith('data:')
          ? picked.data
          : `data:${mimeType};base64,${picked.data}`;
        await saveCompressedPhoto(dataUrl);
      } else if (picked.webPath) {
        const response = await fetch(picked.webPath);
        const blob = await response.blob();
        await saveCompressedPhoto(blob);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel|dismiss|abort/i.test(msg)) {
        return;
      }
      console.error('Local file picker error, falling back to input:', err);
      galleryInputRef.current?.click();
    }
  };

  const handlePickFromLocalGallery = async () => {
    // Browser web biasa tetap memakai <input type="file" accept="image/*" />
    if (!Capacitor.isNativePlatform()) {
      galleryInputRef.current?.click();
      return;
    }

    // Android Native (APK): buka modal Custom Galeri Lokal buatan sendiri (@capacitor-community/media)
    setShowLocalGallery(true);
  };

  const handleSetFitMode = (mode: PhotoFitMode) => {
    if (!photo) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    onUpdatePhoto({
      ...photo,
      fitMode: mode,
    });
  };

  const handleQuickToggleFitMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode: PhotoFitMode = effectiveFitMode === 'fill' ? 'original' : 'fill';
    handleSetFitMode(nextMode);
  };

  const handleCopy = () => {
    if (onCopyToRight) {
      onCopyToRight();
      setCopiedFeedback(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
      setTimeout(() => setCopiedFeedback(false), 1000);
    }
  };

  const isBefore = type === 'before';

  return (
    <div className="flex flex-col w-full bg-white border border-black shadow-2xs min-w-0">
      {/* Hidden file inputs:
          1) cameraInputRef (capture=environment) cadangan kamera browser web
          2) galleryInputRef (<input type="file" accept="image/*" />) cadangan galeri/file lokal */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. BEFORE / AFTER Label */}
      {showLabel && (
        <div className="py-0.5 px-1.5 text-center text-[10px] sm:text-[11px] font-bold tracking-wider uppercase border-b border-black bg-slate-800 text-white select-none">
          {isBefore ? 'BEFORE' : 'AFTER'}
        </div>
      )}

      {/* 2. Photo Slot Box (100% bersih tanpa overlay menutupi foto/timestamp) */}
      <div className="p-0.5 sm:p-1 bg-white">
        <div
          className="relative w-full aspect-[87/70] bg-white border border-black overflow-hidden flex flex-col items-center justify-center select-none"
          onClick={() => {
            if (photo) {
              setConfirmDelete(false);
              setShowActionMenu(true);
            }
          }}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-1.5 p-2 text-center text-slate-800">
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-slate-600">Mengompres foto...</span>
            </div>
          ) : photo ? (
            /* Photo Display: ZERO overlay so bottom timestamps remain 100% visible */
            <img
              src={photo.dataUrl}
              alt={`Foto #${boxNumber}`}
              className={`w-full h-full cursor-pointer ${
                effectiveFitMode === 'fill' ? 'object-fill' : 'object-contain'
              }`}
              loading="lazy"
            />
          ) : (
            /* Empty Box: BUKA KAMERA, pendamping Buka Timemark, dan Dari Galeri (File/Folder Lokal) */
            <div className="w-full h-full p-1.5 sm:p-2 md:p-2.5 flex flex-col justify-center items-stretch gap-1 sm:gap-1.5 bg-slate-900 text-white">
              {/* Tombol 1: BUKA KAMERA */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleOpenCamera();
                }}
                title="Buka kamera HP"
                className="w-full py-1 sm:py-1.5 px-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold rounded-xs flex items-center justify-center gap-1.5 border border-slate-500 transition active:scale-98"
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white" />
                <span className="text-[10px] sm:text-xs uppercase truncate">
                  BUKA KAMERA
                </span>
              </button>

              {/* Tombol Pendamping: Buka Timemark / Timestamp Camera */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleOpenTimemark();
                }}
                title="Buka aplikasi Timemark / Timestamp Camera lalu ambil hasilnya lewat Dari Galeri"
                className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-300 font-semibold rounded-xs flex items-center justify-center gap-1 border border-amber-500/40 transition active:scale-98"
              >
                <Clock className="w-3 h-3 shrink-0 text-amber-300" />
                <span className="text-[10px] sm:text-[11px] truncate">Buka Timemark</span>
              </button>

              {/* Tombol 2: Dari Galeri (File/Folder Picker Lokal) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handlePickFromLocalGallery();
                }}
                title="Ambil foto dari folder lokal HP (Timemark/DCIM - ingat folder terakhir)"
                className="w-full py-1 sm:py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-semibold rounded-xs flex items-center justify-center gap-1.5 border border-slate-700 transition active:scale-98"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                <span className="text-[10px] sm:text-xs truncate">Dari Galeri</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2b. Kontrol Foto di LUAR Kotak Foto (tidak menutupi foto & timestamp!) */}
      {photo && !isProcessing && (
        <div className="px-1 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1 select-none">
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              setShowActionMenu(true);
            }}
            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:text-black bg-white hover:bg-slate-100 border border-slate-300 flex items-center gap-1 truncate"
          >
            <RefreshCw className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">Ganti / Opsi</span>
          </button>

          <button
            type="button"
            onClick={handleQuickToggleFitMode}
            title="Ubah tampilan foto: Isi Kotak atau Sesuai Aslinya"
            className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold border flex items-center gap-0.5 transition active:scale-95 ${
              effectiveFitMode === 'fill'
                ? 'bg-slate-900 text-amber-300 border-black'
                : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-100'
            }`}
          >
            {effectiveFitMode === 'fill' ? (
              <>
                <Maximize2 className="w-2.5 h-2.5" />
                <span>Isi Kotak</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-2.5 h-2.5" />
                <span>Asli</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Kotak Nomor Urut Otomatis & Input Teks Keterangan */}
      <div className="border-t border-black bg-white">
        <div className="flex items-center">
          <div
            title={`Foto #${boxNumber}`}
            className="shrink-0 w-7 sm:w-9 h-7 sm:h-8 bg-white text-black font-black text-xs sm:text-sm flex items-center justify-center border-r border-black select-none"
          >
            {boxNumber}
          </div>

          <input
            type="text"
            value={caption}
            onChange={(e) => onUpdateCaption(e.target.value)}
            placeholder="Keterangan unit..."
            className="flex-1 min-w-0 h-7 sm:h-8 px-1.5 text-xs font-bold uppercase bg-white text-black focus:outline-hidden focus:bg-slate-50 placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal"
          />

          {/* Tombol Cepat 'Salin Keterangan ke Kanan' (Hanya di kolom kiri Before) */}
          {isBefore && onCopyToRight && (
            <button
              type="button"
              onClick={handleCopy}
              title="Salin keterangan ke foto kanan"
              className={`shrink-0 h-7 sm:h-8 px-1.5 font-bold text-[10px] sm:text-xs flex items-center gap-0.5 border-l border-black transition active:scale-95 ${
                copiedFeedback
                  ? 'bg-black text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-black'
              }`}
            >
              {copiedFeedback ? (
                <>
                  <Check className="w-3 h-3" />
                  <span className="hidden sm:inline">Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">Salin</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal / Dialog Opsi Foto (Resolusi Tampilan / Ganti via App/Kamera/Galeri / Hapus / Zoom) */}
      {showActionMenu && photo && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setShowActionMenu(false)}
        >
          <div
            className="w-full max-w-xs sm:max-w-sm bg-white border-2 border-black p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
              <span className="font-bold text-slate-900 text-xs">
                Opsi Foto #{boxNumber} ({isBefore ? 'Before' : 'After'})
              </span>
              <button
                type="button"
                onClick={() => setShowActionMenu(false)}
                className="text-slate-500 hover:text-black text-xs font-bold px-1"
              >
                &times; Tutup
              </button>
            </div>

            <div className="h-32 bg-white border border-black flex items-center justify-center overflow-hidden">
              <img
                src={photo.dataUrl}
                alt="preview"
                className={`h-full w-full ${
                  effectiveFitMode === 'fill' ? 'object-fill' : 'object-contain'
                }`}
              />
            </div>

            {/* Pilihan Resolusi / Tampilan Foto */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-700">
                Resolusi / Tampilan Foto di Kotak:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetFitMode('fill')}
                  className={`py-2 px-2 text-xs font-bold border flex items-center justify-center gap-1 transition ${
                    effectiveFitMode === 'fill'
                      ? 'bg-slate-900 text-white border-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-400'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Sesuaikan Kotak</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFitMode('original')}
                  className={`py-2 px-2 text-xs font-bold border flex items-center justify-center gap-1 transition ${
                    effectiveFitMode === 'original'
                      ? 'bg-slate-900 text-white border-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-400'
                  }`}
                >
                  <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Sesuai Aslinya</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  setShowFullView(true);
                }}
                className="w-full py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold border border-black text-xs flex items-center justify-center gap-1.5"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Lihat Foto Penuh
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  void handleOpenCamera();
                }}
                className="w-full py-2 px-2 bg-slate-800 hover:bg-slate-900 text-white font-bold border border-black text-xs flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Ganti Foto (BUKA KAMERA)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  void handleOpenTimemark();
                }}
                className="w-full py-2 px-2 bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold border border-black text-xs flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Buka Timemark / Timestamp
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  void handlePickFromLocalGallery();
                }}
                className="w-full py-2 px-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold border border-black text-xs flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Ganti Foto (Dari Galeri)
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-1.5 px-2 text-red-700 hover:bg-red-50 font-semibold border border-red-300 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  Hapus Foto Ini
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdatePhoto(undefined);
                      setConfirmDelete(false);
                      setShowActionMenu(false);
                    }}
                    className="py-1.5 px-2 bg-red-700 hover:bg-red-800 text-white font-bold border border-red-900 text-xs"
                  >
                    Ya, Hapus
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full image zoom viewer */}
      {showFullView && photo && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-3"
          onClick={() => setShowFullView(false)}
        >
          <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
            <span className="font-bold text-xs">
              Foto #{boxNumber} &bull; {isBefore ? 'BEFORE' : 'AFTER'}
            </span>
            <button
              type="button"
              onClick={() => setShowFullView(false)}
              className="bg-slate-800 px-3 py-1 text-xs font-bold border border-slate-700"
            >
              Tutup
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
            <img
              src={photo.dataUrl}
              alt="full view"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="text-center text-xs text-slate-300 bg-slate-900 py-1.5">
            {caption || 'Tanpa keterangan'}
          </div>
        </div>
      )}

      {/* Custom In-App Local Gallery Modal (Android Native) */}
      <LocalGalleryModal
        isOpen={showLocalGallery}
        onSelectPhoto={(compressedDataUrl) => applyAlreadyCompressedPhoto(compressedDataUrl)}
        onFallbackFilePicker={() => {
          void handleFilePickerFallback();
        }}
        onClose={() => setShowLocalGallery(false)}
      />
    </div>
  );
};
