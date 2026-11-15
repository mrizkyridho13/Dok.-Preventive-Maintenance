/**
 * Centralized smart image processor & compressor for PGE DocuTek.
 * Automatically resizes large camera/gallery/Timemark photos (e.g. 4000px)
 * to max 1000px with JPEG quality 0.8 so RAM stays light even with 50-100 photos/day,
 * and cleans up temporary Object URLs & canvas buffers immediately after processing.
 */
async function readInputAsDataUrl(input: File | Blob | string): Promise<string> {
  if (typeof input === 'string') {
    return input;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Gagal membaca data gambar'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal memproses file foto'));
    reader.readAsDataURL(input);
  });
}

function renderImageToCompressedJpeg(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number
): string {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  const longestSide = Math.max(width, height);
  if (longestSide > maxDimension) {
    const ratio = maxDimension / longestSide;
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    // Release canvas backing memory immediately
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function optimizeJpegForExport(
  sourceDataUrl: string,
  maxDimension: number = 1000,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanupImage = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };

    img.onload = () => {
      try {
        const compressedDataUrl = renderImageToCompressedJpeg(img, maxDimension, quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.error('Canvas compression error:', err);
        resolve(sourceDataUrl);
      } finally {
        cleanupImage();
      }
    };

    img.onerror = () => {
      cleanupImage();
      reject(new Error('Gagal membaca gambar'));
    };

    img.src = sourceDataUrl;
  });
}

async function compressBlobViaObjectUrl(
  blob: Blob,
  maxDimension: number,
  quality: number
): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      try {
        const compressedDataUrl = renderImageToCompressedJpeg(img, maxDimension, quality);
        resolve(compressedDataUrl);
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Gagal memuat gambar dari Object URL'));
    };

    img.src = objectUrl;
  });
}

/**
 * Centralized input photo processor & compressor.
 * Used by:
 * - "BUKA KAMERA" (native camera & web input)
 * - Auto-capture from Timestamp / Timemark
 * - Custom Galeri Lokal & file picker
 * Output: JPEG DataURL, max 1000px, quality 0.8.
 */
export async function processAndCompressImage(
  input: File | Blob | string
): Promise<string> {
  if (typeof input !== 'string' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return await compressBlobViaObjectUrl(input, 1000, 0.8);
    } catch {
      // Fallback to FileReader path if Object URL decoding fails on a WebView
    }
  }

  const sourceDataUrl = await readInputAsDataUrl(input);
  return optimizeJpegForExport(sourceDataUrl, 1000, 0.8);
}

export const compressImage = processAndCompressImage;
