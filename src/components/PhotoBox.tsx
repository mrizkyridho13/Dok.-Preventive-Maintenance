import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, RefreshCw, ZoomIn, Copy, Check } from 'lucide-react';
import { PhotoItem } from '../types/report';
import { compressImage } from '../utils/imageCompressor';

interface PhotoBoxProps {
  type: 'before' | 'after';
  boxNumber: number; // Sequential photo number (1, 2, 3, 4, 5, 6...)
  photo?: PhotoItem;
  caption: string;
  showLabel: boolean;
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
  onUpdatePhoto,
  onUpdateCaption,
  onCopyToRight,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
      });
      setShowActionMenu(false);
    } catch (err) {
      console.error('Error compressing image:', err);
      alert('Gagal memproses foto. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
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
    <div className="flex flex-col w-full bg-white border border-black shadow-2xs">
      {/* Hidden file inputs for direct camera (environment) and gallery */}
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

      {/* 1. BEFORE / AFTER Label: Formal & Minimalis */}
      {showLabel && (
        <div className="py-0.5 px-1.5 text-center text-[10px] sm:text-[11px] font-bold tracking-wider uppercase border-b border-black bg-slate-800 text-white select-none">
          {isBefore ? 'BEFORE' : 'AFTER'}
        </div>
      )}

      {/* 2. Photo Slot Box: Proporsi Pas (aspect-[1.18/1], background putih bersih) */}
      <div className="p-0.5 sm:p-1 bg-white">
        <div
          className="relative w-full aspect-[1.18/1] bg-white border border-black overflow-hidden flex flex-col items-center justify-center select-none"
          onClick={() => {
            if (photo) setShowActionMenu(true);
          }}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-1.5 p-2 text-center text-slate-800">
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-slate-600">Mengompres foto...</span>
            </div>
          ) : photo ? (
            <>
              {/* Photo Display: object-contain with white background ensures timestamps are completely uncropped */}
              <img
                src={photo.dataUrl}
                alt={`Foto #${boxNumber}`}
                className="w-full h-full object-contain cursor-pointer"
                loading="lazy"
              />

              {/* Minimal tap prompt */}
              <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 py-0.5 text-center cursor-pointer">
                <span className="text-[9px] text-white flex items-center justify-center gap-1 font-medium">
                  <RefreshCw className="w-2.5 h-2.5" /> Ketuk untuk ganti
                </span>
              </div>
            </>
          ) : (
            /* Empty Box: Tombol Ikon Tetap Sama Sesuai Permintaan Pengguna */
            <div className="w-full h-full p-1.5 sm:p-2 flex flex-col justify-center items-stretch gap-1.5 sm:gap-2 bg-slate-900 text-white">
              {/* Tombol 1: Buka Kamera Belakang */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="w-full py-1.5 sm:py-2 px-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold rounded-xs flex items-center justify-center gap-1.5 border border-slate-500 transition active:scale-98"
              >
                <Camera className="w-4 h-4 shrink-0 text-white" />
                <span className="text-xs uppercase">Buka Kamera</span>
              </button>

              {/* Tombol 2: Pilih dari Galeri */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  galleryInputRef.current?.click();
                }}
                className="w-full py-1.5 sm:py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-semibold rounded-xs flex items-center justify-center gap-1.5 border border-slate-700 transition active:scale-98"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                <span className="text-xs">Dari Galeri</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Kotak Nomor Urut Otomatis & Input Teks Keterangan (Tersambung di Bawah Foto Seperti Gambar 2) */}
      <div className="border-t border-black bg-white">
        <div className="flex items-center">
          {/* Kotak Nomor Urut: e.g. 7, 8, 9, 10... persis gambar referensi */}
          <div
            title={`Foto #${boxNumber}`}
            className="shrink-0 w-8 sm:w-9 h-7 sm:h-8 bg-white text-black font-black text-xs sm:text-sm flex items-center justify-center border-r border-black select-none"
          >
            {boxNumber}
          </div>

          {/* Kolom Input Keterangan Unit */}
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
                  <span>Salin &rarr;</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal / Dialog Opsi Foto (Ganti / Hapus / Zoom) */}
      {showActionMenu && photo && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setShowActionMenu(false)}
        >
          <div
            className="w-full max-w-xs bg-white border-2 border-black p-3.5 space-y-2.5 animate-in fade-in zoom-in-95"
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

            <div className="h-28 bg-black border border-black flex items-center justify-center overflow-hidden">
              <img
                src={photo.dataUrl}
                alt="preview"
                className="h-full w-auto object-contain"
              />
            </div>

            <div className="space-y-1.5 pt-1">
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
                Ganti Foto (Buka Kamera)
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

              <button
                type="button"
                onClick={() => {
                  if (confirm('Hapus foto ini?')) {
                    onUpdatePhoto(undefined);
                    setShowActionMenu(false);
                  }
                }}
                className="w-full py-1.5 px-2 text-red-700 hover:bg-red-50 font-semibold border border-red-300 text-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Foto Ini
              </button>
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
