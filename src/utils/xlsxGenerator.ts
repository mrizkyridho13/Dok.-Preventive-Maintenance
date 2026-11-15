import ExcelJS from 'exceljs';
import { Sheet, ReportMeta, PhotoFitMode } from '../types/report';
import { COMPANY_LOGO_BASE64, COMPANY_NAME } from './logoData';

/**
 * Generates an editable Excel (.xlsx) workbook formatted cleanly
 * with 1 worksheet per Lembar (A4 portrait print-ready, 2x3 Before/After grid).
 * All kop fields, unit numbers, captions, and embedded photos can be edited in Excel/WPS/Sheets.
 */
export async function generateReportXLSX(
  sheets: Sheet[],
  meta: ReportMeta
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DocuTek - PT. Panca Gatrik Elektrindo';
  workbook.created = new Date();

  const totalPages = sheets.length;
  const companyDisplay = (meta.companyName || COMPANY_NAME).trim().toUpperCase() || COMPANY_NAME;
  const projectTitle = (meta.projectName || '').trim().toUpperCase() || 'DOKUMENTASI PEKERJAAN MAINTENANCE';
  const formattedDate = meta.date || new Date().toISOString().split('T')[0];
  const spkText = meta.jobOrderNumber ? ` (SPK: ${meta.jobOrderNumber})` : '';
  const globalFitMode: PhotoFitMode = meta.photoFitMode || 'original';

  // Register company logo once in workbook
  const logoImageId = workbook.addImage({
    base64: COMPANY_LOGO_BASE64,
    extension: 'jpeg',
  });

  const thinBlack = { style: 'thin' as const, color: { argb: 'FF000000' } };
  const boxBorders = {
    top: thinBlack,
    left: thinBlack,
    bottom: thinBlack,
    right: thinBlack,
  };

  // Column widths (sum Left = 6+22+16 = 44 chars ~330px; Gap = 3 chars; Right = 44 chars ~330px)
  const COL_WIDTHS = [6, 22, 16, 3, 6, 22, 16];
  const CARD_PX_W = 330;
  const PHOTO_ROW_PT = 172;
  const PHOTO_PX_H = Math.round(PHOTO_ROW_PT * 1.333); // ~229px

  for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
    const sheet = sheets[sIdx];
    const pageNumber = sIdx + 1;
    const baseBoxNum = sIdx * 6;

    const ws = workbook.addWorksheet(`Lembar ${pageNumber}`, {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.35,
          bottom: 0.35,
          header: 0.15,
          footer: 0.15,
        },
      },
    });

    ws.columns = COL_WIDTHS.map((w) => ({ width: w }));

    // 1. Header Box (Rows 1-2)
    ws.getRow(1).height = 24;
    ws.getRow(2).height = 20;

    ws.mergeCells('A1:A2');
    ws.mergeCells('B1:G1');
    ws.mergeCells('B2:G2');

    ws.getCell('A1').border = { top: thinBlack, left: thinBlack, bottom: thinBlack };
    ws.getCell('A2').border = { left: thinBlack, bottom: thinBlack };

    const titleCell = ws.getCell('B1');
    titleCell.value = companyDisplay;
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 2; c <= 7; c++) {
      ws.getRow(1).getCell(c).border = {
        top: thinBlack,
        right: c === 7 ? thinBlack : undefined,
      };
    }

    const subTitleCell = ws.getCell('B2');
    subTitleCell.value = projectTitle;
    subTitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 2; c <= 7; c++) {
      ws.getRow(2).getCell(c).border = {
        bottom: thinBlack,
        right: c === 7 ? thinBlack : undefined,
      };
    }

    // Place Logo cleanly in A1:A2
    ws.addImage(logoImageId, {
      tl: { col: 0.15, row: 0.12 },
      ext: { width: 42, height: 42 },
      editAs: 'oneCell',
    });

    // 2. Metadata Table (Rows 3-4)
    ws.getRow(3).height = 14;
    ws.getRow(4).height = 18;

    ws.mergeCells('A3:C3');
    ws.mergeCells('A4:C4');
    ws.mergeCells('D3:E3');
    ws.mergeCells('D4:E4');
    ws.mergeCells('F3:G3');
    ws.mergeCells('F4:G4');

    const metaBlocks: Array<{
      labelCell: string;
      valCell: string;
      label: string;
      val: string;
      cols: number[];
    }> = [
      {
        labelCell: 'A3',
        valCell: 'A4',
        label: 'LOKASI / TOKO:',
        val: meta.location.trim() || '-',
        cols: [1, 2, 3],
      },
      {
        labelCell: 'D3',
        valCell: 'D4',
        label: 'TEKNISI / TIM:',
        val: meta.technicianName.trim() || '-',
        cols: [4, 5],
      },
      {
        labelCell: 'F3',
        valCell: 'F4',
        label: 'TANGGAL:',
        val: `${formattedDate}${spkText}`,
        cols: [6, 7],
      },
    ];

    for (const mb of metaBlocks) {
      const lc = ws.getCell(mb.labelCell);
      lc.value = mb.label;
      lc.font = { name: 'Calibri', size: 8, color: { argb: 'FF64748B' } };
      lc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const vc = ws.getCell(mb.valCell);
      vc.value = mb.val;
      vc.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF000000' } };
      vc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const firstCol = mb.cols[0];
      const lastCol = mb.cols[mb.cols.length - 1];
      for (const c of mb.cols) {
        ws.getRow(3).getCell(c).border = {
          top: thinBlack,
          left: c === firstCol ? thinBlack : undefined,
          right: c === lastCol ? thinBlack : undefined,
        };
        ws.getRow(4).getCell(c).border = {
          bottom: thinBlack,
          left: c === firstCol ? thinBlack : undefined,
          right: c === lastCol ? thinBlack : undefined,
        };
      }
    }

    // Spacer Row 5
    let curRow = 5;
    ws.getRow(curRow).height = 10;
    curRow++;

    // 3. Grid 2x3
    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const rowData = sheet.rows[rIdx];
      if (!rowData) continue;

      const leftNum = rowData.beforeNumber ?? baseBoxNum + rIdx * 2 + 1;
      const rightNum = rowData.afterNumber ?? baseBoxNum + rIdx * 2 + 2;
      const leftFit = rowData.beforePhoto?.fitMode || globalFitMode;
      const rightFit = rowData.afterPhoto?.fitMode || globalFitMode;

      // Optional BEFORE / AFTER Label Row
      if (meta.showBeforeAfterLabels) {
        ws.getRow(curRow).height = 18;
        ws.mergeCells(curRow, 1, curRow, 3);
        ws.mergeCells(curRow, 5, curRow, 7);

        for (const [startC, text] of [
          [1, 'BEFORE'],
          [5, 'AFTER'],
        ] as const) {
          const cell = ws.getCell(curRow, startC);
          cell.value = text;
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          for (let c = startC; c < startC + 3; c++) {
            const cRef = ws.getRow(curRow).getCell(c);
            cRef.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF1E293B' },
            };
            cRef.border = boxBorders;
          }
        }
        curRow++;
      }

      // Photo Row
      const photoRowNum = curRow;
      ws.getRow(photoRowNum).height = PHOTO_ROW_PT;
      ws.mergeCells(photoRowNum, 1, photoRowNum, 3);
      ws.mergeCells(photoRowNum, 5, photoRowNum, 7);

      await placeExcelPhoto(
        workbook,
        ws,
        photoRowNum,
        0, // 0-indexed Col A
        rowData.beforePhoto?.dataUrl,
        CARD_PX_W,
        PHOTO_PX_H,
        leftFit,
        boxBorders
      );

      await placeExcelPhoto(
        workbook,
        ws,
        photoRowNum,
        4, // 0-indexed Col E
        rowData.afterPhoto?.dataUrl,
        CARD_PX_W,
        PHOTO_PX_H,
        rightFit,
        boxBorders
      );

      curRow++;

      // Number + Caption Row (editable!)
      ws.getRow(curRow).height = 24;
      ws.mergeCells(curRow, 2, curRow, 3);
      ws.mergeCells(curRow, 6, curRow, 7);

      // Left Number & Caption
      const leftNumCell = ws.getCell(curRow, 1);
      leftNumCell.value = leftNum;
      leftNumCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      leftNumCell.alignment = { vertical: 'middle', horizontal: 'center' };
      leftNumCell.border = boxBorders;

      const leftCapText = (rowData.beforeCaption || '').trim().toUpperCase();
      const leftCapCell = ws.getCell(curRow, 2);
      leftCapCell.value = leftCapText || '-';
      leftCapCell.font = {
        name: 'Calibri',
        size: 9,
        bold: Boolean(leftCapText),
        color: { argb: leftCapText ? 'FF000000' : 'FF94A3B8' },
      };
      leftCapCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
      ws.getRow(curRow).getCell(2).border = boxBorders;
      ws.getRow(curRow).getCell(3).border = boxBorders;

      // Right Number & Caption
      const rightNumCell = ws.getCell(curRow, 5);
      rightNumCell.value = rightNum;
      rightNumCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      rightNumCell.alignment = { vertical: 'middle', horizontal: 'center' };
      rightNumCell.border = boxBorders;

      const rightCapText = (rowData.afterCaption || '').trim().toUpperCase();
      const rightCapCell = ws.getCell(curRow, 6);
      rightCapCell.value = rightCapText || '-';
      rightCapCell.font = {
        name: 'Calibri',
        size: 9,
        bold: Boolean(rightCapText),
        color: { argb: rightCapText ? 'FF000000' : 'FF94A3B8' },
      };
      rightCapCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
      ws.getRow(curRow).getCell(6).border = boxBorders;
      ws.getRow(curRow).getCell(7).border = boxBorders;

      curRow++;

      // Spacer Row between units
      ws.getRow(curRow).height = 10;
      curRow++;
    }

    // 4. Footer Row
    ws.getRow(curRow).height = 18;
    ws.mergeCells(curRow, 1, curRow, 4);
    ws.mergeCells(curRow, 5, curRow, 7);

    const printedDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const footerLeft = ws.getCell(curRow, 1);
    footerLeft.value = `${companyDisplay} • Dicetak: ${printedDate}`;
    footerLeft.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF64748B' } };
    footerLeft.alignment = { vertical: 'middle', horizontal: 'left' };

    const footerRight = ws.getCell(curRow, 5);
    footerRight.value = `Lembar ${pageNumber} dari ${totalPages}`;
    footerRight.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    footerRight.alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 7; c++) {
      ws.getRow(curRow).getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function placeExcelPhoto(
  workbook: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  row1Indexed: number,
  startCol0Indexed: number,
  photoDataUrl: string | undefined,
  boxPxW: number,
  boxPxH: number,
  fitMode: PhotoFitMode,
  boxBorders: Partial<ExcelJS.Borders>
) {
  for (let c = startCol0Indexed + 1; c <= startCol0Indexed + 3; c++) {
    const cell = ws.getRow(row1Indexed).getCell(c);
    cell.border = boxBorders;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: photoDataUrl ? 'FFFFFFFF' : 'FFF8FAFC' },
    };
  }

  if (!photoDataUrl) {
    const cell = ws.getCell(row1Indexed, startCol0Indexed + 1);
    cell.value = '(Belum Ada Foto)';
    cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF94A3B8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    return;
  }

  try {
    const imgId = workbook.addImage({
      base64: photoDataUrl,
      extension: 'jpeg',
    });

    const row0 = row1Indexed - 1;
    let drawW = boxPxW - 6;
    let drawH = boxPxH - 6;

    if (fitMode === 'original') {
      const dims = await getImageDimensions(photoDataUrl);
      const availW = boxPxW - 10;
      const availH = boxPxH - 10;
      const scale = Math.min(availW / dims.width, availH / dims.height);
      drawW = Math.max(20, Math.round(dims.width * scale));
      drawH = Math.max(20, Math.round(dims.height * scale));
    }

    // Center inside the 3-column block (approx 3 columns wide)
    const offsetXPx = Math.max(2, (boxPxW - drawW) / 2);
    const offsetYPx = Math.max(2, (boxPxH - drawH) / 2);

    // Approximate column fraction (first col is ~45px, next two ~165px and ~120px)
    const colOffset = (offsetXPx / boxPxW) * 3;
    const rowOffset = offsetYPx / boxPxH;

    ws.addImage(imgId, {
      tl: {
        col: startCol0Indexed + colOffset,
        row: row0 + rowOffset,
      } as ExcelJS.Anchor,
      ext: { width: drawW, height: drawH },
      editAs: 'oneCell',
    });
  } catch (err) {
    console.error('Excel photo embed error:', err);
    const cell = ws.getCell(row1Indexed, startCol0Indexed + 1);
    cell.value = '(Foto Gagal Dimuat)';
    cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }
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
