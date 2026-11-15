import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';

export type ExportKind = 'jpg' | 'pdf' | 'docx';

/**
 * Converts a Blob into a raw Base64 string (without data:... prefix)
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Gagal membaca data file'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Gagal mengonversi file ke Base64'));
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves an exported file:
 * - Android Native APK:
 *   - JPG -> Pictures/PGE-DocuTek (Gallery album PGE-DocuTek)
 *   - PDF/DOCX -> Download/PGE-DocuTek
 * - Web Browser: standard browser file download
 */
export async function saveExportedFile(
  blob: Blob,
  fileName: string,
  kind: ExportKind
): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    triggerBrowserDownload(blob, fileName);
    return kind === 'jpg'
      ? `JPG (${fileName}) selesai diunduh`
      : kind === 'pdf'
      ? 'Unduh PDF selesai'
      : 'Unduh Word (.docx) selesai';
  }

  const base64Data = await blobToBase64(blob);
  const mimeType =
    kind === 'jpg'
      ? 'image/jpeg'
      : kind === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const targetFolder = kind === 'jpg' ? 'Pictures/PGE-DocuTek' : 'Download/PGE-DocuTek';

  // 1. Primary on Android: use patched MediaStore savePublicFile (works seamlessly on Android 8-15 Scoped Storage)
  try {
    const mediaAny = Media as unknown as {
      savePublicFile?: (opts: {
        base64Data: string;
        fileName: string;
        mimeType: string;
        folder: string;
      }) => Promise<{ uri: string; folder: string }>;
    };

    if (typeof mediaAny.savePublicFile === 'function') {
      await mediaAny.savePublicFile({
        base64Data,
        fileName,
        mimeType,
        folder: targetFolder,
      });

      return kind === 'jpg'
        ? 'Tersimpan di Galeri (Album PGE-DocuTek)'
        : 'Tersimpan di Folder Download/PGE-DocuTek';
    }
  } catch (err) {
    console.warn('MediaStore savePublicFile fallback to Filesystem:', err);
  }

  // 2. Fallback via Capacitor Filesystem
  const relativePath = `${targetFolder}/${fileName}`;
  try {
    await Filesystem.writeFile({
      path: relativePath,
      data: base64Data,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
  } catch {
    await Filesystem.writeFile({
      path: `PGE-DocuTek/${fileName}`,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
  }

  return kind === 'jpg'
    ? 'Tersimpan di Galeri (Album PGE-DocuTek)'
    : 'Tersimpan di Folder Download/PGE-DocuTek';
}

/**
 * Generates a temporary file in Directory.Cache (Native) and opens system Share sheet
 * (WhatsApp, Email, Telegram, etc.). Falls back to Web Share API / download on web browsers.
 */
export async function shareExportedFile(
  blob: Blob,
  fileName: string,
  kind: ExportKind
): Promise<void> {
  const mimeType =
    kind === 'jpg'
      ? 'image/jpeg'
      : kind === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: 'Laporan Maintenance PGE',
      files: [uriResult.uri],
    });
    return;
  }

  // Web Browser fallback: use Web Share API with files if available
  const file = new File([blob], fileName, { type: mimeType });
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      title: 'Laporan Maintenance PGE',
      files: [file],
    });
    return;
  }

  // Desktop web fallback: download directly
  triggerBrowserDownload(blob, fileName);
}
