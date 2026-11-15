import { Sheet, ReportMeta } from '../types/report';
import { COMPANY_LOGO_BASE64, COMPANY_NAME } from './logoData';

/**
 * Generates a lightweight A4 portrait JPG (1240 x 1754 px, ~150 DPI Smart Scale)
 * targeting ~150KB-250KB per page while preserving crisp borders, typography,
 * timestamps, and equipment details matching the official PT. PGE layout.
 */
export async function generateSheetJPG(
  sheet: Sheet,
  meta: ReportMeta,
  totalPages: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  // Smart Scale A4 portrait (150 DPI): 1240 x 1754 (exact 0.5x of 2480 x 3508)
  const targetWidth = 1240;
  const targetHeight = 1754;
  const width = 2480;
  const height = 3508;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  ctx.scale(targetWidth / width, targetHeight / height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Pure white page background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer technical document border (crisp 4px black frame)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(88, 72, width - 176, height - 144); // bottom = 3436

  const marginX = 160;
  const usableWidth = width - marginX * 2; // 2160px

  // 1. HEADER SECTION with PT. PANCA GATRIK ELEKTRINDO LOGO
  let curY = 92;

  // Title Box with Logo
  const titleBoxHeight = 160;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(marginX, curY, usableWidth, titleBoxHeight);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(marginX, curY, usableWidth, titleBoxHeight);

  // Draw Logo centered vertically inside left of header
  try {
    const logoImg = await loadImage(COMPANY_LOGO_BASE64);
    const logoSize = 128;
    const logoX = marginX + 24;
    const logoY = curY + (titleBoxHeight - logoSize) / 2;
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
  } catch (e) {
    console.warn('Failed to load logo on JPG canvas:', e);
  }

  // Company Name & Project Title
  const headerTextX = marginX + 180;
  const headerTextMaxW = usableWidth - 204;

  const companyDisplay = (meta.companyName || COMPANY_NAME).trim().toUpperCase() || COMPANY_NAME;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  drawFittedSingleLine(ctx, companyDisplay, headerTextX, curY + 68, headerTextMaxW, 42, 28, 'bold');

  const title = (meta.projectName || '').trim() || 'DOKUMENTASI PEKERJAAN MAINTENANCE';
  ctx.fillStyle = '#334155';
  drawFittedSingleLine(ctx, title.toUpperCase(), headerTextX, curY + 124, headerTextMaxW, 32, 22, 'bold');

  curY += titleBoxHeight;

  // Metadata Table (3 columns)
  const metaHeight = 84;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(marginX, curY, usableWidth, metaHeight);

  const col1W = Math.round(usableWidth * 0.40);
  const col2W = Math.round(usableWidth * 0.32);
  const col3W = usableWidth - col1W - col2W;

  ctx.beginPath();
  ctx.moveTo(marginX + col1W, curY);
  ctx.lineTo(marginX + col1W, curY + metaHeight);
  ctx.moveTo(marginX + col1W + col2W, curY);
  ctx.lineTo(marginX + col1W + col2W, curY + metaHeight);
  ctx.stroke();

  const metaPadX = 22;

  // Col 1: Lokasi
  ctx.fillStyle = '#64748b';
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('LOKASI / TOKO:', marginX + metaPadX, curY + 32);
  ctx.fillStyle = '#000000';
  drawFittedSingleLine(
    ctx,
    meta.location.trim() || '-',
    marginX + metaPadX,
    curY + 66,
    col1W - metaPadX * 2,
    27,
    19,
    'bold'
  );

  // Col 2: Teknisi
  ctx.fillStyle = '#64748b';
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.fillText('TEKNISI / TIM:', marginX + col1W + metaPadX, curY + 32);
  ctx.fillStyle = '#000000';
  drawFittedSingleLine(
    ctx,
    meta.technicianName.trim() || '-',
    marginX + col1W + metaPadX,
    curY + 66,
    col2W - metaPadX * 2,
    27,
    19,
    'bold'
  );

  // Col 3: Tanggal & SPK
  ctx.fillStyle = '#64748b';
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.fillText('TANGGAL:', marginX + col1W + col2W + metaPadX, curY + 32);
  ctx.fillStyle = '#000000';
  const formattedDate = meta.date || new Date().toISOString().split('T')[0];
  const spkText = meta.jobOrderNumber ? ` (SPK: ${meta.jobOrderNumber})` : '';
  drawFittedSingleLine(
    ctx,
    `${formattedDate}${spkText}`,
    marginX + col1W + col2W + metaPadX,
    curY + 66,
    col3W - metaPadX * 2,
    27,
    19,
    'bold'
  );

  curY += metaHeight + 38; // 374px

  // 2. GRID 2 x 3 SECTION (identical proportions to PDF 87mm x 70mm)
  const colGap = 96;
  const photoW = (usableWidth - colGap) / 2; // 1032px
  const photoH = 832; // ~87:70 ratio (1.240)
  const labelH = meta.showBeforeAfterLabels ? 46 : 0;
  const captionH = 84;
  const rowSpacing = 40;

  const baseBoxNum = (sheet.sheetNumber - 1) * 6;

  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const row = sheet.rows[rIdx];
    if (!row) continue;

    const rowTop = curY + rIdx * (labelH + photoH + captionH + rowSpacing);

    const leftBoxNumber = row.beforeNumber ?? (baseBoxNum + rIdx * 2 + 1);
    const rightBoxNumber = row.afterNumber ?? (baseBoxNum + rIdx * 2 + 2);

    const globalFitMode = meta.photoFitMode || 'original';
    const leftFitMode = row.beforePhoto?.fitMode || globalFitMode;
    const rightFitMode = row.afterPhoto?.fitMode || globalFitMode;

    // Left (BEFORE)
    await renderCanvasSlot(
      ctx,
      marginX,
      rowTop,
      photoW,
      photoH,
      labelH,
      captionH,
      'BEFORE',
      leftBoxNumber,
      row.beforePhoto?.dataUrl,
      row.beforeCaption,
      meta.showBeforeAfterLabels,
      leftFitMode
    );

    // Right (AFTER)
    await renderCanvasSlot(
      ctx,
      marginX + photoW + colGap,
      rowTop,
      photoW,
      photoH,
      labelH,
      captionH,
      'AFTER',
      rightBoxNumber,
      row.afterPhoto?.dataUrl,
      row.afterCaption,
      meta.showBeforeAfterLabels,
      rightFitMode
    );
  }

  // 3. FOOTER SECTION (cleanly spaced inside outer border bottom = 3436)
  const footerLineY = 3372;
  const footerTextY = 3404;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, footerLineY);
  ctx.lineTo(marginX + usableWidth, footerLineY);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748b';
  ctx.font = '25px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${companyDisplay} • Dicetak: ${new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
    marginX,
    footerTextY
  );

  ctx.textAlign = 'right';
  ctx.font = 'bold 27px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`Lembar ${sheet.sheetNumber} dari ${totalPages}`, marginX + usableWidth, footerTextY);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.78);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrlToBlob(jpegDataUrl);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1] || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function renderCanvasSlot(
  ctx: CanvasRenderingContext2D,
  photoX: number,
  slotTop: number,
  photoW: number,
  photoH: number,
  labelH: number,
  captionH: number,
  label: 'BEFORE' | 'AFTER',
  boxNumber: number,
  photoDataUrl?: string,
  captionText?: string,
  showLabel: boolean = true,
  fitMode: 'original' | 'fill' = 'original'
) {
  let curY = slotTop;

  // 1. Optional Label BEFORE / AFTER
  if (showLabel) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(photoX, curY, photoW, labelH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, curY, photoW, labelH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 25px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, photoX + photoW / 2, curY + labelH / 2 + 1);

    curY += labelH;
  }

  // 2. Photo Box Frame (1032px x 832px, pure white background)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX, curY, photoW, photoH);

  if (photoDataUrl) {
    try {
      const img = await loadImage(photoDataUrl);
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (fitMode === 'fill') {
        // Sesuaikan dengan kotak (mengisi penuh kolom tanpa ruang putih & tanpa memotong timestamp)
        ctx.drawImage(img, photoX, curY, photoW, photoH);
      } else {
        // Sesuai aslinya (aspect-fit di tengah dengan ruang putih tipis agar rasio asli tetap terjaga)
        const innerPad = 4;
        const availW = photoW - innerPad * 2;
        const availH = photoH - innerPad * 2;
        const scale = Math.min(availW / imgW, availH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = photoX + (photoW - drawW) / 2;
        const drawY = curY + (photoH - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    } catch {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(photoX, curY, photoW, photoH);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('(Foto Gagal Dimuat)', photoX + photoW / 2, curY + photoH / 2);
    }
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(photoX, curY, photoW, photoH);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('(Belum Ada Foto)', photoX + photoW / 2, curY + photoH / 2);
  }

  // Crisp Black Border around photo
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(photoX, curY, photoW, photoH);

  curY += photoH; // Connected directly beneath

  // 3. Unit Number Box + Caption Box
  const numW = 136; // Proportional to 12mm in PDF
  const capW = photoW - numW;

  // Number Box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX, curY, numW, captionH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(photoX, curY, numW, captionH);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(boxNumber), photoX + numW / 2, curY + captionH / 2 + 1);

  // Caption Box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX + numW, curY, capW, captionH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(photoX + numW, curY, capW, captionH);

  const text = (captionText || '').trim();
  const capPadX = 18;
  const maxCapW = capW - capPadX * 2;

  if (text) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawAdaptiveCaption(ctx, text.toUpperCase(), photoX + numW + capPadX, curY + captionH / 2, maxCapW);
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', photoX + numW + capPadX, curY + captionH / 2);
  }
}

/**
 * Draws a single line of text, shrinking font size down to minFontSize if needed,
 * and adding ellipsis only if it still exceeds maxWidth at minFontSize.
 */
function drawFittedSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
  weight: 'normal' | 'bold' = 'bold'
) {
  let fontSize = maxFontSize;
  const prefix = weight === 'bold' ? 'bold ' : '';

  while (fontSize > minFontSize) {
    ctx.font = `${prefix}${fontSize}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 2;
  }

  ctx.font = `${prefix}${fontSize}px system-ui, -apple-system, sans-serif`;
  let display = text;
  if (ctx.measureText(display).width > maxWidth) {
    while (display.length > 3 && ctx.measureText(display + '…').width > maxWidth) {
      display = display.slice(0, -1);
    }
    display += '…';
  }
  ctx.fillText(display, x, y);
}

/**
 * Draws caption text neatly inside the caption box:
 * - Uses 27px bold if it fits on 1 line.
 * - Shrinks down to 23px if it fits on 1 line.
 * - Otherwise wraps cleanly across 2 lines at 21px bold so descriptions aren't cut off.
 */
function drawAdaptiveCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  centerY: number,
  maxWidth: number
) {
  // Try single line at 27px down to 23px
  for (const size of [27, 25, 23]) {
    ctx.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, centerY + 1);
      return;
    }
  }

  // Wrap across 2 lines at 21px
  const fontSize = 21;
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  const words = text.split(/\s+/);
  let line1 = '';
  let line2 = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test1 = line1 ? `${line1} ${word}` : word;
    if (ctx.measureText(test1).width <= maxWidth) {
      line1 = test1;
    } else {
      line2 = words.slice(i).join(' ');
      break;
    }
  }

  // Fallback if first single word itself is wider than maxWidth
  if (!line1) {
    line1 = text;
  }

  if (line2) {
    if (ctx.measureText(line2).width > maxWidth) {
      while (line2.length > 3 && ctx.measureText(line2 + '…').width > maxWidth) {
        line2 = line2.slice(0, -1);
      }
      line2 += '…';
    }
    ctx.fillText(line1, x, centerY - 12);
    ctx.fillText(line2, x, centerY + 14);
  } else {
    if (ctx.measureText(line1).width > maxWidth) {
      while (line1.length > 3 && ctx.measureText(line1 + '…').width > maxWidth) {
        line1 = line1.slice(0, -1);
      }
      line1 += '…';
    }
    ctx.fillText(line1, x, centerY + 1);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
