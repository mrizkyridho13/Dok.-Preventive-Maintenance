/**
 * Image compressor for field technicians
 * Resizes images to max 1440px on longest side with 86% JPEG quality
 * to keep timestamps and equipment details sharp in JPG/PDF exports
 * while maintaining smooth offline performance.
 */
export async function compressImage(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_DIMENSION = 1440;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Scale down proportionally if either dimension exceeds MAX_DIMENSION
          const longestSide = Math.max(width, height);
          if (longestSide > MAX_DIMENSION) {
            const ratio = MAX_DIMENSION / longestSide;
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 86% quality for crisp timestamps
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
          resolve(compressedDataUrl);
        } catch (err) {
          console.error('Canvas compression error:', err);
          // Fallback to original read if canvas fails
          resolve(e.target?.result as string);
        }
      };

      img.onerror = () => {
        reject(new Error('Gagal membaca gambar'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Gagal memproses file foto'));
    reader.readAsDataURL(file);
  });
}
