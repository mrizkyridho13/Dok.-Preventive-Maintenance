import jsPDF from 'jspdf';
import { Sheet, ReportMeta } from '../types/report';
import { COMPANY_LOGO_BASE64, COMPANY_NAME } from './logoData';

/**
 * Generates an official multi-page A4 technical report PDF.
 * Finalized according to PT. Panca Gatrik Elektrindo official requirements:
 * - Official PT logo in the top header.
 * - Pure white background inside photo frames with preserved aspect ratio (no stretching/cropping).
 * - Balanced photo boxes (87mm x 70mm) for clear photo display.
 * - Sequential box numbering (1..6 on page 1, 7..12 on page 2).
 * - Adaptive text fitting for metadata and captions, zero footer collision.
 */
export async function generateReportPDF(
  sheets: Sheet[],
  meta: ReportMeta
): Promise<Blob> {
  // A4 portrait dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalPages = sheets.length;

  for (let pageIdx = 0; pageIdx < sheets.length; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage();
    }

    const sheet = sheets[pageIdx];
    await renderPDFPage(doc, sheet, meta, pageIdx + 1, totalPages);
  }

  return doc.output('blob');
}

async function renderPDFPage(
  doc: jsPDF,
  sheet: Sheet,
  meta: ReportMeta,
  pageNumber: number,
  totalPages: number
) {
  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 14;
  const marginRight = 14;
  const marginTop = 7.5;
  const usableWidth = pageWidth - marginLeft - marginRight; // 182mm

  // Outer document frame border (crisp official document border)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(8, 6, pageWidth - 16, pageHeight - 12); // bottom = 291mm

  // 1. HEADER SECTION with PT. PANCA GATRIK ELEKTRINDO LOGO
  let curY = marginTop;

  // Title Box with Logo
  const titleBoxHeight = 13.5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(marginLeft, curY, usableWidth, titleBoxHeight);

  // Embed Company Logo at Top-Left
  try {
    doc.addImage(COMPANY_LOGO_BASE64, 'JPEG', marginLeft + 2, curY + 1.25, 11, 11);
  } catch (e) {
    console.warn('Failed to embed logo into PDF:', e);
  }

  // Company Name & Project Title
  const companyDisplay = (meta.companyName || COMPANY_NAME).trim().toUpperCase() || COMPANY_NAME;
  const headerMaxW = usableWidth - 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  drawPDFSingleLine(doc, companyDisplay, marginLeft + 15.5, curY + 5.2, headerMaxW, 10, 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  const projectTitle = (meta.projectName || '').trim() || 'DOKUMENTASI PEKERJAAN MAINTENANCE';
  drawPDFSingleLine(doc, projectTitle.toUpperCase(), marginLeft + 15.5, curY + 10.2, headerMaxW, 8.2, 6.2);

  curY += titleBoxHeight;

  // Metadata Table (Lokasi, Teknisi, Tanggal)
  const metaBoxHeight = 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(marginLeft, curY, usableWidth, metaBoxHeight);

  const col1W = usableWidth * 0.40;
  const col2W = usableWidth * 0.32;
  const col3W = usableWidth - col1W - col2W;
  doc.line(marginLeft + col1W, curY, marginLeft + col1W, curY + metaBoxHeight);
  doc.line(marginLeft + col1W + col2W, curY, marginLeft + col1W + col2W, curY + metaBoxHeight);

  const padX = 2;

  // Col 1: Lokasi
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text('LOKASI / TOKO:', marginLeft + padX, curY + 2.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  drawPDFSingleLine(doc, meta.location.trim() || '-', marginLeft + padX, curY + 5.6, col1W - padX * 2, 7.2, 5.5);

  // Col 2: Teknisi
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text('TEKNISI / TIM:', marginLeft + col1W + padX, curY + 2.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  drawPDFSingleLine(doc, meta.technicianName.trim() || '-', marginLeft + col1W + padX, curY + 5.6, col2W - padX * 2, 7.2, 5.5);

  // Col 3: Tanggal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text('TANGGAL:', marginLeft + col1W + col2W + padX, curY + 2.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const formattedDate = meta.date || new Date().toISOString().split('T')[0];
  const spkText = meta.jobOrderNumber ? ` (SPK: ${meta.jobOrderNumber})` : '';
  drawPDFSingleLine(
    doc,
    `${formattedDate}${spkText}`,
    marginLeft + col1W + col2W + padX,
    curY + 5.6,
    col3W - padX * 2,
    7.2,
    5.5
  );

  curY += metaBoxHeight + 3.2;

  // 2. GRID 2 x 3 SECTION
  const colGap = 8;
  const photoW = (usableWidth - colGap) / 2; // 87mm
  const photoH = 70; // 70mm height
  const labelHeight = meta.showBeforeAfterLabels ? 3.8 : 0;
  const captionH = 7; // Caption cell
  const rowSpacing = 3.2;

  const baseBoxNum = (pageNumber - 1) * 6;

  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const rowData = sheet.rows[rIdx];
    if (!rowData) continue;

    const rowTop = curY + rIdx * (labelHeight + photoH + captionH + rowSpacing);

    const leftBoxNumber = rowData.beforeNumber ?? (baseBoxNum + rIdx * 2 + 1);
    const rightBoxNumber = rowData.afterNumber ?? (baseBoxNum + rIdx * 2 + 2);

    const globalFitMode = meta.photoFitMode || 'original';
    const leftFitMode = rowData.beforePhoto?.fitMode || globalFitMode;
    const rightFitMode = rowData.afterPhoto?.fitMode || globalFitMode;

    // Left Column (BEFORE)
    await renderSlotPDF(
      doc,
      marginLeft,
      rowTop,
      photoW,
      photoH,
      labelHeight,
      captionH,
      'BEFORE',
      leftBoxNumber,
      rowData.beforePhoto?.dataUrl,
      rowData.beforeCaption,
      meta.showBeforeAfterLabels,
      leftFitMode
    );

    // Right Column (AFTER)
    await renderSlotPDF(
      doc,
      marginLeft + photoW + colGap,
      rowTop,
      photoW,
      photoH,
      labelHeight,
      captionH,
      'AFTER',
      rightBoxNumber,
      rowData.afterPhoto?.dataUrl,
      rowData.afterCaption,
      meta.showBeforeAfterLabels,
      rightFitMode
    );
  }

  // 3. FOOTER SECTION
  const footerLineY = 285.5;
  const footerTextY = 288.8;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, footerLineY, marginLeft + usableWidth, footerLineY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${companyDisplay} • Dicetak: ${new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
    marginLeft,
    footerTextY
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`Lembar ${pageNumber} dari ${totalPages}`, marginLeft + usableWidth, footerTextY, {
    align: 'right',
  });
}

async function renderSlotPDF(
  doc: jsPDF,
  colX: number,
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
    doc.setFillColor(30, 41, 59);
    doc.rect(colX, curY, photoW, labelH, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(colX, curY, photoW, labelH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(label, colX + photoW / 2, curY + labelH / 2 + 0.9, { align: 'center' });

    curY += labelH;
  }

  // 2. Photo Box Frame (87mm x 70mm) - pure white background
  doc.setFillColor(255, 255, 255);
  doc.rect(colX, curY, photoW, photoH, 'F');

  if (photoDataUrl) {
    try {
      if (fitMode === 'fill') {
        // Sesuaikan dengan kotak (mengisi penuh kolom tanpa ruang putih & tanpa memotong timestamp)
        doc.addImage(photoDataUrl, 'JPEG', colX, curY, photoW, photoH, undefined, 'FAST');
      } else {
        // Sesuai aslinya (aspect-fit di tengah)
        const dims = await getImageDimensions(photoDataUrl);
        const innerPad = 0.4;
        const availW = photoW - innerPad * 2;
        const availH = photoH - innerPad * 2;
        const scale = Math.min(availW / dims.width, availH / dims.height);
        const drawW = dims.width * scale;
        const drawH = dims.height * scale;
        const drawX = colX + (photoW - drawW) / 2;
        const drawY = curY + (photoH - drawH) / 2;

        doc.addImage(photoDataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      }
    } catch (e) {
      console.error('Failed to add image to PDF:', e);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text('(Foto Gagal Dimuat)', colX + photoW / 2, curY + photoH / 2, { align: 'center' });
    }
  } else {
    doc.setFillColor(248, 250, 252);
    doc.rect(colX, curY, photoW, photoH, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('(Belum Ada Foto)', colX + photoW / 2, curY + photoH / 2, { align: 'center' });
  }

  // Thin Black Border around the photo box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(colX, curY, photoW, photoH, 'S');

  curY += photoH;

  // 3. Bottom unit number box & caption box
  const numBoxW = 11.5;
  const captionBoxW = photoW - numBoxW;

  // Unit Number Box
  doc.setFillColor(255, 255, 255);
  doc.rect(colX, curY, numBoxW, captionH, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(colX, curY, numBoxW, captionH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(String(boxNumber), colX + numBoxW / 2, curY + captionH / 2 + 1.1, { align: 'center' });

  // Caption Box
  doc.setFillColor(255, 255, 255);
  doc.rect(colX + numBoxW, curY, captionBoxW, captionH, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(colX + numBoxW, curY, captionBoxW, captionH, 'S');

  const textToDraw = (captionText || '').trim();
  const capPadX = 1.8;
  const maxWidth = captionBoxW - capPadX * 2;

  if (textToDraw) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const upper = textToDraw.toUpperCase();

    // Try single line from 7pt down to 6pt before wrapping to 2 lines
    let fittedSingle = false;
    for (const fs of [7, 6.4, 5.8]) {
      doc.setFontSize(fs);
      if (doc.getTextWidth(upper) <= maxWidth) {
        doc.text(upper, colX + numBoxW + capPadX, curY + captionH / 2 + 0.9);
        fittedSingle = true;
        break;
      }
    }

    if (!fittedSingle) {
      doc.setFontSize(5.5);
      const lines = doc.splitTextToSize(upper, maxWidth) as string[];
      if (lines.length >= 2) {
        doc.text(lines[0], colX + numBoxW + capPadX, curY + 2.8);
        let second = lines[1];
        if (lines.length > 2 || doc.getTextWidth(second) > maxWidth) {
          while (second.length > 3 && doc.getTextWidth(second + '...') > maxWidth) {
            second = second.slice(0, -1);
          }
          second += '...';
        }
        doc.text(second, colX + numBoxW + capPadX, curY + 5.3);
      } else {
        doc.text(lines[0] || '', colX + numBoxW + capPadX, curY + captionH / 2 + 0.9);
      }
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text('-', colX + numBoxW + capPadX, curY + captionH / 2 + 0.9);
  }
}

function drawPDFSingleLine(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number
) {
  let fs = maxFontSize;
  while (fs > minFontSize) {
    doc.setFontSize(fs);
    if (doc.getTextWidth(text) <= maxWidth) break;
    fs -= 0.4;
  }
  doc.setFontSize(fs);
  let display = text;
  if (doc.getTextWidth(display) > maxWidth) {
    while (display.length > 3 && doc.getTextWidth(display + '...') > maxWidth) {
      display = display.slice(0, -1);
    }
    display += '...';
  }
  doc.text(display, x, y);
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 1,
        height: img.naturalHeight || img.height || 1,
      });
    img.onerror = reject;
    img.src = src;
  });
}
