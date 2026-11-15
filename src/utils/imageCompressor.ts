/**
 * Image compressor for field technicians
 * Automatically resizes large camera photos (e.g. 4000px) to max 1000px on longest side
 * with 0.8 JPEG quality so RAM stays light even with 50-100 photos per day,
 * while keeping timestamps and equipment details sharp across JPG/PDF/Word exports.
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

export async function optimizeJpegForExport(
  sourceDataUrl: string,
  maxDimension: number = 1000,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
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

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.error('Canvas compression error:', err);
        resolve(sourceDataUrl);
      }
    };

    img.onerror = () => {
      reject(new Error('Gagal membaca gambar'));
    };

    img.src = sourceDataUrl;
  });
}

export async function compressImage(input: File | Blob | string): Promise<string> {
  const sourceDataUrl = await readInputAsDataUrl(input);
  // Resize input photos to max 1000px with 0.8 JPEG quality
  return optimizeJpegForExport(sourceDataUrl, 1000, 0.8);
}
