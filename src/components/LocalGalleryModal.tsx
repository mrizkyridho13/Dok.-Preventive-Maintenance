import React, { useEffect, useState, useCallback } from 'react';
import { Media, MediaAlbum, MediaAsset } from '@capacitor-community/media';
import {
  X,
  ZoomIn,
  Check,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { getThumbnailSrc, loadAndCompressMediaAsset } from '../utils/mediaLoader';

export const LAST_ALBUM_STORAGE_KEY = 'docutek_last_album_identifier';
const ALL_ALBUMS_ID = '__ALL__';

interface LocalGalleryModalProps {
  isOpen: boolean;
  onSelectPhoto: (compressedDataUrl: string) => void;
  onFallbackFilePicker: () => void;
  onClose: () => void;
}

export const LocalGalleryModal: React.FC<LocalGalleryModalProps> = ({
  isOpen,
  onSelectPhoto,
  onFallbackFilePicker,
  onClose,
}) => {
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_ALBUM_STORAGE_KEY) || ALL_ALBUMS_ID;
    } catch {
      return ALL_ALBUMS_ID;
    }
  });
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isSelectingPhoto, setIsSelectingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  const sortAlbumsPriority = (rawAlbums: MediaAlbum[]): MediaAlbum[] => {
    const priorityOrder = ['timemark', 'timestamp', 'camera', 'dcim', 'whatsapp', 'screenshots', 'pictures', 'download'];
    const seen = new Set<string>();
    const unique = rawAlbums.filter((alb) => {
      if (!alb.identifier || seen.has(alb.identifier)) return false;
      seen.add(alb.identifier);
      return true;
    });

    return unique.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aIdx = priorityOrder.findIndex((p) => aName.includes(p));
      const bIdx = priorityOrder.findIndex((p) => bName.includes(p));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return aName.localeCompare(bName);
    });
  };

  const loadAlbums = useCallback(async () => {
    setIsLoadingAlbums(true);
    setErrorMessage(null);
    try {
      const res = await Media.getAlbums();
      const sorted = sortAlbumsPriority(res.albums || []);
      setAlbums(sorted);

      // Pastikan albumIdentifier yang tersimpan masih valid; jika tidak, fallback ke Semua
      setSelectedAlbumId((prev) => {
        if (prev === ALL_ALBUMS_ID) return ALL_ALBUMS_ID;
        const stillExists = sorted.some((a) => a.identifier === prev);
        return stillExists ? prev : ALL_ALBUMS_ID;
      });
    } catch (err) {
      console.error('Error loading local albums:', err);
      setErrorMessage('Izin akses foto diperlukan untuk menampilkan folder galeri lokal.');
    } finally {
      setIsLoadingAlbums(false);
    }
  }, []);

  const loadMediasForAlbum = useCallback(async (albumId: string) => {
    setIsLoadingPhotos(true);
    setErrorMessage(null);
    try {
      const res = await Media.getMedias({
        quantity: 60,
        thumbnailWidth: 320,
        thumbnailHeight: 320,
        thumbnailQuality: 78,
        types: 'photos',
        ...(albumId !== ALL_ALBUMS_ID ? { albumIdentifier: albumId } : {}),
        sort: [{ key: 'creationDate', ascending: false }],
      });
      setPhotos(res.medias || []);
    } catch (err) {
      console.error('Error loading local medias:', err);
      setErrorMessage('Gagal memuat foto dari folder ini.');
      setPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewAsset(null);
    const savedAlbum = (() => {
      try {
        return localStorage.getItem(LAST_ALBUM_STORAGE_KEY) || ALL_ALBUMS_ID;
      } catch {
        return ALL_ALBUMS_ID;
      }
    })();
    setSelectedAlbumId(savedAlbum);
    void loadAlbums();
  }, [isOpen, loadAlbums]);

  useEffect(() => {
    if (!isOpen) return;
    void loadMediasForAlbum(selectedAlbumId);
  }, [isOpen, selectedAlbumId, loadMediasForAlbum]);

  const handleSelectAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    try {
      localStorage.setItem(LAST_ALBUM_STORAGE_KEY, albumId);
    } catch {
      // Ignore storage errors
    }
  };

  const handleConfirmAsset = async (asset: MediaAsset) => {
    try {
      setIsSelectingPhoto(true);
      const compressed = await loadAndCompressMediaAsset(asset);
      onSelectPhoto(compressed);
      setPreviewAsset(null);
      onClose();
    } catch (err) {
      console.error('Error selecting media asset:', err);
      setErrorMessage('Gagal memproses foto yang dipilih. Coba pilih foto lain.');
    } finally {
      setIsSelectingPhoto(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:h-[85vh] sm:max-w-lg bg-white border-0 sm:border-2 sm:border-black flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between border-b border-black shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-sm truncate">Pilih Foto</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                void loadAlbums();
                void loadMediasForAlbum(selectedAlbumId);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              title="Muat ulang daftar foto"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoadingAlbums || isLoadingPhotos ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Horizontal Scrollable Album Tabs */}
        <div className="bg-slate-100 border-b border-slate-300 px-2 py-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => handleSelectAlbum(ALL_ALBUMS_ID)}
              className={`px-3 py-1.5 text-xs font-bold border transition whitespace-nowrap ${
                selectedAlbumId === ALL_ALBUMS_ID
                  ? 'bg-slate-900 text-amber-300 border-black'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>

            {albums.map((album) => {
              const isSelected = selectedAlbumId === album.identifier;
              return (
                <button
                  key={album.identifier}
                  type="button"
                  onClick={() => handleSelectAlbum(album.identifier)}
                  className={`px-3 py-1.5 text-xs font-bold border transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-amber-300 border-black'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {album.name || 'Folder'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body: 3-Column Photo Grid */}
        <div className="flex-1 overflow-y-auto p-2 bg-slate-50 relative">
          {isSelectingPhoto && (
            <div className="absolute inset-0 z-20 bg-white/80 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-800">
                Memasukkan foto ke kotak...
              </span>
            </div>
          )}

          {errorMessage ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
              <ImageIcon className="w-10 h-10 text-slate-400" />
              <p className="text-xs text-slate-700 font-medium max-w-xs">{errorMessage}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadAlbums();
                    void loadMediasForAlbum(selectedAlbumId);
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold border border-black"
                >
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onFallbackFilePicker();
                  }}
                  className="px-3 py-1.5 bg-white text-slate-800 text-xs font-semibold border border-slate-400"
                >
                  Buka Pemilih File HP
                </button>
              </div>
            </div>
          ) : isLoadingPhotos && photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 py-12">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-600 font-medium">Memuat foto lokal...</span>
            </div>
          ) : photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <ImageIcon className="w-9 h-9 text-slate-400" />
              <p className="text-xs text-slate-600 font-medium">
                Belum ada foto di folder ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackFilePicker();
                }}
                className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold border border-black"
              >
                Cari Lewat File Manager
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {photos.map((asset) => {
                const thumbSrc = getThumbnailSrc(asset);
                return (
                  <div
                    key={asset.identifier}
                    onClick={() => void handleConfirmAsset(asset)}
                    className="relative aspect-square bg-slate-200 border border-slate-300 overflow-hidden cursor-pointer group active:scale-98 transition"
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt="Foto lokal"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}

                    {/* Tombol Preview / Perbesar kecil di pojok kanan atas */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAsset(asset);
                      }}
                      title="Perbesar / Preview foto"
                      className="absolute top-1 right-1 w-6 h-6 bg-black/75 hover:bg-black text-white flex items-center justify-center border border-white/40 shadow-sm"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info & Alternative File Picker */}
        <div className="bg-white border-t border-slate-300 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
          <span className="truncate">
            Ketuk foto untuk memilih &bull; Ikon kaca pembesar untuk preview
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onFallbackFilePicker();
            }}
            className="shrink-0 font-bold text-slate-800 hover:text-black underline"
          >
            File Lain
          </button>
        </div>
      </div>

      {/* Fullscreen Preview Overlay Before Picking */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col justify-between p-3"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewAsset(null);
          }}
        >
          <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
            <span className="font-bold text-xs">Pratinjau Foto Penuh</span>
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="bg-slate-800 px-3 py-1 text-xs font-bold border border-slate-700"
            >
              Kembali
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center overflow-hidden py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                previewAsset.identifier
                  ? getThumbnailSrc({ ...previewAsset, data: '' }) || getThumbnailSrc(previewAsset)
                  : getThumbnailSrc(previewAsset)
              }
              onError={(e) => {
                const fallback = getThumbnailSrc(previewAsset);
                if (fallback && e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                }
              }}
              alt="Preview penuh"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div
            className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSelectingPhoto}
              onClick={() => void handleConfirmAsset(previewAsset)}
              className="py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black border border-amber-200 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Gunakan Foto Ini</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
