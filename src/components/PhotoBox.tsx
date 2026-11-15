import React, { useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ZoomIn,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { PhotoItem, PhotoFitMode } from '../types/report';
import { compressImage } from '../utils/imageCompressor';

interface PhotoBoxProps {
  type: 'before' | 'after';
  boxNumber: number; // Sequential photo number (1, 2, 3, 4, 5, 6...)
  photo?: PhotoItem;
  caption: string;
  showLabel: boolean;
  globalFitMode: PhotoFitMode;
  onUpdatePhoto: (photo?: PhotoItem) => void;
  onUpdateCaption: (caption: string) => void;
  onCopyToRight?: () => void;
}

export const PhotoBox: React.FC<PhotoBoxProps> = ({
  type,
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
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Input 1: capture="environment" -> memicu intent kamera HP / pemilih aplikasi kamera (jika didukung perangkat/APK)
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Input 2: Galeri foto biasa
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const effectiveFitMode: PhotoFitMode = photo?.fitMode || globalFitMode;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
      const compressedDataUrl = await compressImage(file);
      onUpdatePhoto({
        id: `p-${Date.now()}`,
        dataUrl: compressedDataUrl,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fitMode: photo?.fitMode,
      });
      setShowActionMenu(false);
      setConfirmDelete(false);
    } catch (err) {
      console.error('Error compressing image:', err);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
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
          1) cameraInputRef (capture=environment) triggers device camera / camera app intent
          2) galleryInputRef picks existing photo from gallery */}
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
            /* Empty Box: 2 Opsi Manual — Kamera / App dan Dari Galeri */
            <div className="w-full h-full p-1.5 sm:p-2 md:p-3 flex flex-col justify-center items-stretch gap-1.5 sm:gap-2 bg-slate-900 text-white">
              {/* Tombol 1: Buka Kamera / App */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                title="Buka kamera HP atau aplikasi kamera pilihan"
                className="w-full py-1.5 sm:py-2 px-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold rounded-xs flex items-center justify-center gap-1.5 border border-slate-500 transition active:scale-98"
              >
                <Camera className="w-4 h-4 shrink-0 text-white" />
                <span className="text-[11px] sm:text-xs uppercase truncate">
                  Kamera / App
                </span>
              </button>

              {/* Tombol 2: Dari Galeri */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  galleryInputRef.current?.click();
                }}
                title="Ambil foto dari Galeri HP"
                className="w-full py-1.5 sm:py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-semibold rounded-xs flex items-center justify-center gap-1.5 border border-slate-700 transition active:scale-98"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                <span className="text-[11px] sm:text-xs truncate">Dari Galeri</span>
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
                  cameraInputRef.current?.click();
                }}
                className="w-full py-2 px-2 bg-slate-800 hover:bg-slate-900 text-white font-bold border border-black text-xs flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Ganti Foto (Kamera / App)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  galleryInputRef.current?.click();
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
    </div>
  );
};
