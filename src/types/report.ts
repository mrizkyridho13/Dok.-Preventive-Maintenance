export interface PhotoItem {
  id: string;
  dataUrl: string; // Base64 compressed image (max 800px)
  timestamp?: string; // Captured date/time if recorded
}

export interface UnitRow {
  id: string;
  unitNumber: number; // Row index or pair identifier
  beforeNumber: number; // Exact sequential photo box number (1, 3, 5, 7, 9, 11...)
  afterNumber: number; // Exact sequential photo box number (2, 4, 6, 8, 10, 12...)
  beforePhoto?: PhotoItem;
  afterPhoto?: PhotoItem;
  beforeCaption: string;
  afterCaption: string;
}

export interface Sheet {
  id: string;
  sheetNumber: number; // 1, 2, 3...
  rows: [UnitRow, UnitRow, UnitRow]; // Exact 3 rows (6 photo boxes total per sheet)
}

export interface ReportMeta {
  companyName: string;
  projectName: string;
  technicianName: string;
  location: string;
  date: string;
  jobOrderNumber: string;
  showBeforeAfterLabels: boolean;
}

export const DEFAULT_META: ReportMeta = {
  companyName: 'PT. PANCA GATRIK ELEKTRINDO',
  projectName: 'DOKUMENTASI PEKERJAAN MAINTENANCE',
  technicianName: '',
  location: '',
  date: new Date().toISOString().split('T')[0],
  jobOrderNumber: '',
  showBeforeAfterLabels: true,
};
