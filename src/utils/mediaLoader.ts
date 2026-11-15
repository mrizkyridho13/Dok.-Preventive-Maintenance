import { Capacitor } from '@capacitor/core';
import { Media, MediaAsset } from '@capacitor-community/media';
import { processAndCompressImage } from './imageCompressor';

export function getThumbnailSrc(asset: MediaAsset): string {
  if (asset.data) {
    return asset.data.startsWith('data:')
      ? asset.data
      : `data:image/jpeg;base64,${asset.data}`;
  }
  if (asset.identifier) {
    return Capacitor.convertFileSrc(asset.identifier);
  }
  return '';
}

/**
 * Resolves full-resolution image data from a native MediaAsset identifier
 * and passes it through centralized processAndCompressImage() (max 1000px, 0.8 JPEG).
 */
export async function loadAndCompressMediaAsset(asset: MediaAsset): Promise<string> {
  // 1. Try reading full file via Capacitor's local file server bridge
  if (asset.identifier) {
    try {
      const fileUrl = Capacitor.convertFileSrc(asset.identifier);
      const response = await fetch(fileUrl);
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0) {
          return await processAndCompressImage(blob);
        }
      }
    } catch {
      // Fall through to getMediaByIdentifier
    }

    // 2. Fallback: request full-quality data/path from Media.getMediaByIdentifier
    try {
      const resolved = (await Media.getMediaByIdentifier({
        identifier: asset.identifier,
      })) as { path?: string; data?: string };

      if (resolved?.data) {
        const fullDataUrl = resolved.data.startsWith('data:')
          ? resolved.data
          : `data:image/jpeg;base64,${resolved.data}`;
        return await processAndCompressImage(fullDataUrl);
      }

      if (resolved?.path) {
        const pathUrl = Capacitor.convertFileSrc(resolved.path);
        const res = await fetch(pathUrl);
        if (res.ok) {
          const blob = await res.blob();
          return await processAndCompressImage(blob);
        }
      }
    } catch {
      // Fall through to thumbnail data fallback
    }
  }

  // 3. Final fallback: use the returned data payload
  if (asset.data) {
    const fallbackUrl = asset.data.startsWith('data:')
      ? asset.data
      : `data:image/jpeg;base64,${asset.data}`;
    return await processAndCompressImage(fallbackUrl);
  }

  throw new Error('Gagal memuat file gambar dari penyimpanan perangkat.');
}
