import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { Sheet, ReportMeta, PhotoFitMode } from '../types/report';
import { COMPANY_LOGO_BASE64, COMPANY_NAME } from './logoData';
import { optimizeJpegForExport } from './imageCompressor';

/**
 * Generates an editable Microsoft Word (.docx) document formatted cleanly
 * in A4 portrait 2x3 Before/After grid matching the PDF & JPG layout.
 * All kop fields, unit numbers, captions, and embedded photos remain editable.
 */
export async function generateReportDOCX(
  sheets: Sheet[],
  meta: ReportMeta
): Promise<Blob> {
  const totalPages = sheets.length;
  const companyDisplay = (meta.companyName || COMPANY_NAME).trim().toUpperCase() || COMPANY_NAME;
  const projectTitle = (meta.projectName || '').trim().toUpperCase() || 'DOKUMENTASI PEKERJAAN MAINTENANCE';
  const formattedDate = meta.date || new Date().toISOString().split('T')[0];
  const spkText = meta.jobOrderNumber ? ` (SPK: ${meta.jobOrderNumber})` : '';
  const globalFitMode: PhotoFitMode = meta.photoFitMode || 'original';

  const logoBytes = dataUrlToUint8Array(COMPANY_LOGO_BASE64);
  const children: Array<Paragraph | Table> = [];

  const solidBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: '000000',
  };
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
  };

  // Page usable width = 11906 - 794*2 = 10318 twips (~182mm)
  const USABLE_W = 10318;
  const LOGO_COL_W = 1080;
  const TITLE_COL_W = USABLE_W - LOGO_COL_W;

  const META_C1 = 4127;
  const META_C2 = 3302;
  const META_C3 = USABLE_W - META_C1 - META_C2;

  // Flat 5-column layout for 2x3 Grid: [NumL | CapL | Spacer | NumR | CapR]
  const GAP_W = 420;
  const CARD_W = (USABLE_W - GAP_W) / 2; // 4949 twips (~87.3mm)
  const NUM_W = 680;
  const CAP_W = CARD_W - NUM_W; // 4269 twips

  // Photo display dimensions in Word pixels (96 DPI)
  const BOX_PX_W = 316;
  const BOX_PX_H = 216;

  for (let pageIdx = 0; pageIdx < sheets.length; pageIdx++) {
    const sheet = sheets[pageIdx];
    const pageNumber = pageIdx + 1;
    const baseBoxNum = pageIdx * 6;

    // 1. Header Table (with pageBreakBefore on pages 2+)
    if (pageIdx > 0) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          spacing: { before: 0, after: 0 },
        })
      );
    }

    const headerTable = new Table({
      width: { size: USABLE_W, type: WidthType.DXA },
      columnWidths: [LOGO_COL_W, TITLE_COL_W],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: LOGO_COL_W, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 80, right: 60 },
              borders: {
                top: solidBorder,
                bottom: solidBorder,
                left: solidBorder,
                right: noBorder,
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: logoBytes
                    ? [
                        new ImageRun({
                          data: logoBytes,
                          transformation: { width: 42, height: 42 },
                          type: 'jpg',
                        }),
                      ]
                    : [],
                }),
              ],
            }),
            new TableCell({
              width: { size: TITLE_COL_W, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 60, right: 100 },
              borders: {
                top: solidBorder,
                bottom: solidBorder,
                left: noBorder,
                right: solidBorder,
              },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 25 },
                  children: [
                    new TextRun({
                      text: companyDisplay,
                      bold: true,
                      size: 20, // 10pt
                      font: 'Calibri',
                      color: '000000',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: projectTitle,
                      bold: true,
                      size: 17, // 8.5pt
                      font: 'Calibri',
                      color: '334155',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // 2. Metadata Table (Lokasi, Teknisi, Tanggal)
    const metaTable = new Table({
      width: { size: USABLE_W, type: WidthType.DXA },
      columnWidths: [META_C1, META_C2, META_C3],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            buildMetaCell('LOKASI / TOKO:', meta.location.trim() || '-', META_C1, solidBorder),
            buildMetaCell('TEKNISI / TIM:', meta.technicianName.trim() || '-', META_C2, solidBorder),
            buildMetaCell('TANGGAL:', `${formattedDate}${spkText}`, META_C3, solidBorder),
          ],
        }),
      ],
    });

    children.push(headerTable);
    children.push(metaTable);
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 80 },
      })
    );

    // 3. 2x3 Grid Table
    const gridRows: TableRow[] = [];

    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const rowData = sheet.rows[rIdx];
      if (!rowData) continue;

      const leftNum = rowData.beforeNumber ?? baseBoxNum + rIdx * 2 + 1;
      const rightNum = rowData.afterNumber ?? baseBoxNum + rIdx * 2 + 2;
      const leftFit = rowData.beforePhoto?.fitMode || globalFitMode;
      const rightFit = rowData.afterPhoto?.fitMode || globalFitMode;

      // Optional BEFORE / AFTER label row
      if (meta.showBeforeAfterLabels) {
        gridRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              buildLabelCell('BEFORE', CARD_W, solidBorder),
              buildSpacerCell(GAP_W, noBorder),
              buildLabelCell('AFTER', CARD_W, solidBorder),
            ],
          })
        );
      }

      // Photo row (216px box height)
      const leftPhotoCell = await buildPhotoCell(
        rowData.beforePhoto?.dataUrl,
        CARD_W,
        BOX_PX_W,
        BOX_PX_H,
        leftFit,
        solidBorder
      );
      const rightPhotoCell = await buildPhotoCell(
        rowData.afterPhoto?.dataUrl,
        CARD_W,
        BOX_PX_W,
        BOX_PX_H,
        rightFit,
        solidBorder
      );

      gridRows.push(
        new TableRow({
          cantSplit: true,
          height: { value: 3320, rule: 'atLeast' },
          children: [
            leftPhotoCell,
            buildSpacerCell(GAP_W, noBorder),
            rightPhotoCell,
          ],
        })
      );

      // Number + Caption row (editable cells!)
      gridRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            buildNumberCell(leftNum, NUM_W, solidBorder),
            buildCaptionCell(rowData.beforeCaption, CAP_W, solidBorder),
            buildSpacerCell(GAP_W, noBorder),
            buildNumberCell(rightNum, NUM_W, solidBorder),
            buildCaptionCell(rowData.afterCaption, CAP_W, solidBorder),
          ],
        })
      );

      // Spacer row between unit rows
      if (rIdx < 2) {
        gridRows.push(
          new TableRow({
            cantSplit: true,
            height: { value: 120, rule: 'exact' },
            children: [
              new TableCell({
                columnSpan: 5,
                borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
              }),
            ],
          })
        );
      }
    }

    const gridTable = new Table({
      width: { size: USABLE_W, type: WidthType.DXA },
      columnWidths: [NUM_W, CAP_W, GAP_W, NUM_W, CAP_W],
      rows: gridRows,
    });

    children.push(gridTable);

    // 4. Footer line
    const printedDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    children.push(
      new Paragraph({
        spacing: { before: 90, after: 0 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 4 },
        },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({
            text: `${companyDisplay} • Dicetak: ${printedDate}`,
            size: 14, // 7pt
            font: 'Calibri',
            color: '64748B',
          }),
          new TextRun({
            text: `\tLembar ${pageNumber} dari ${totalPages}`,
            bold: true,
            size: 15, // 7.5pt
            font: 'Calibri',
            color: '0F172A',
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 210mm
              height: 16838, // A4 297mm
            },
            margin: {
              top: 420,
              bottom: 420,
              left: 794,
              right: 794,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function buildMetaCell(
  label: string,
  value: string,
  width: number,
  border: { style: typeof BorderStyle.SINGLE; size: number; color: string }
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 45, bottom: 45, left: 85, right: 85 },
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 10 },
        children: [
          new TextRun({
            text: label,
            size: 13,
            font: 'Calibri',
            color: '64748B',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: value,
            bold: true,
            size: 16,
            font: 'Calibri',
            color: '000000',
          }),
        ],
      }),
    ],
  });
}

function buildLabelCell(
  text: string,
  width: number,
  border: { style: typeof BorderStyle.SINGLE; size: number; color: string }
): TableCell {
  return new TableCell({
    columnSpan: 2,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, fill: '1E293B', color: '1E293B' },
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            bold: true,
            size: 15,
            font: 'Calibri',
            color: 'FFFFFF',
          }),
        ],
      }),
    ],
  });
}

function buildSpacerCell(
  width: number,
  noBorder: { style: typeof BorderStyle.NONE; size: number; color: string }
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
  });
}

async function buildPhotoCell(
  photoDataUrl: string | undefined,
  cellWidth: number,
  maxPxW: number,
  maxPxH: number,
  fitMode: PhotoFitMode,
  border: { style: typeof BorderStyle.SINGLE; size: number; color: string }
): Promise<TableCell> {
  if (!photoDataUrl) {
    return new TableCell({
      columnSpan: 2,
      width: { size: cellWidth, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.SOLID, fill: 'F8FAFC', color: 'F8FAFC' },
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: '(Belum Ada Foto)',
              italics: true,
              size: 16,
              font: 'Calibri',
              color: '94A3B8',
            }),
          ],
        }),
      ],
    });
  }

  let optimizedJpeg = photoDataUrl;
  try {
    optimizedJpeg = await optimizeJpegForExport(photoDataUrl, 680, 0.75);
  } catch {
    optimizedJpeg = photoDataUrl;
  }

  const bytes = dataUrlToUint8Array(optimizedJpeg);
  if (!bytes) {
    return new TableCell({
      columnSpan: 2,
      width: { size: cellWidth, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: border, bottom: border, left: border, right: border },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '(Foto Gagal Dimuat)', italics: true, size: 16 })],
        }),
      ],
    });
  }

  let drawW = maxPxW;
  let drawH = maxPxH;

  if (fitMode === 'original') {
    try {
      const dims = await getImageDimensions(optimizedJpeg);
      const scale = Math.min(maxPxW / dims.width, maxPxH / dims.height);
      drawW = Math.max(20, Math.round(dims.width * scale));
      drawH = Math.max(20, Math.round(dims.height * scale));
    } catch {
      drawW = maxPxW;
      drawH = maxPxH;
    }
  }

  return new TableCell({
    columnSpan: 2,
    width: { size: cellWidth, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 30, bottom: 30, left: 30, right: 30 },
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: bytes,
            transformation: { width: drawW, height: drawH },
            type: 'jpg',
          }),
        ],
      }),
    ],
  });
}

function buildNumberCell(
  num: number,
  width: number,
  border: { style: typeof BorderStyle.SINGLE; size: number; color: string }
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 45, bottom: 45, left: 40, right: 40 },
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: String(num),
            bold: true,
            size: 18,
            font: 'Calibri',
            color: '000000',
          }),
        ],
      }),
    ],
  });
}

function buildCaptionCell(
  caption: string | undefined,
  width: number,
  border: { style: typeof BorderStyle.SINGLE; size: number; color: string }
): TableCell {
  const clean = (caption || '').trim().toUpperCase();
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 45, bottom: 45, left: 80, right: 80 },
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: clean || '-',
            bold: Boolean(clean),
            size: 16,
            font: 'Calibri',
            color: clean ? '000000' : '94A3B8',
          }),
        ],
      }),
    ],
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const parts = dataUrl.split(',');
    const base64 = parts.length > 1 ? parts[1] : parts[0];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
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
