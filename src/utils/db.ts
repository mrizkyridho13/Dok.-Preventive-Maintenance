import { Sheet, ReportMeta, UnitRow, DEFAULT_META } from '../types/report';

const DB_NAME = 'docutek_technician_db';
const DB_VERSION = 1;
const STORE_NAME = 'reports_store';
const KEY_CURRENT_SESSION = 'active_report_session';

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReportToIndexedDB(
  sheets: Sheet[],
  meta: ReportMeta,
  activeSheetIndex: number = 0
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const payload = {
        sheets,
        meta,
        activeSheetIndex,
        savedAt: Date.now(),
      };
      const req = store.put(payload, KEY_CURRENT_SESSION);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('IndexedDB save failed, falling back to localStorage if possible:', error);
  }
}

export async function loadReportFromIndexedDB(): Promise<{
  sheets: Sheet[];
  meta: ReportMeta;
  activeSheetIndex: number;
  savedAt: number;
} | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_CURRENT_SESSION);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('IndexedDB load error:', error);
    return null;
  }
}

export async function resetReportInIndexedDB(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_CURRENT_SESSION);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('IndexedDB reset error:', error);
  }
}

export function createEmptySheet(sheetNumber: number, startingUnitNumber?: number): Sheet {
  const baseBoxNum = (sheetNumber - 1) * 6;
  const startPairNum = startingUnitNumber ?? ((sheetNumber - 1) * 3 + 1);

  return {
    id: `sheet-${Date.now()}-${sheetNumber}-${Math.random().toString(36).substring(2, 7)}`,
    sheetNumber,
    rows: [
      {
        id: `unit-${startPairNum}`,
        unitNumber: startPairNum,
        beforeNumber: baseBoxNum + 1,
        afterNumber: baseBoxNum + 2,
        beforeCaption: '',
        afterCaption: '',
      },
      {
        id: `unit-${startPairNum + 1}`,
        unitNumber: startPairNum + 1,
        beforeNumber: baseBoxNum + 3,
        afterNumber: baseBoxNum + 4,
        beforeCaption: '',
        afterCaption: '',
      },
      {
        id: `unit-${startPairNum + 2}`,
        unitNumber: startPairNum + 2,
        beforeNumber: baseBoxNum + 5,
        afterNumber: baseBoxNum + 6,
        beforeCaption: '',
        afterCaption: '',
      },
    ],
  };
}

export function renumberSheets(sheets: Sheet[]): Sheet[] {
  let pairCount = 1;
  return sheets.map((sheet, sIdx) => {
    const sheetNum = sIdx + 1;
    const baseBoxNum = sIdx * 6;
    const newRows: [UnitRow, UnitRow, UnitRow] = [
      {
        ...sheet.rows[0],
        unitNumber: pairCount++,
        beforeNumber: baseBoxNum + 1,
        afterNumber: baseBoxNum + 2,
      },
      {
        ...sheet.rows[1],
        unitNumber: pairCount++,
        beforeNumber: baseBoxNum + 3,
        afterNumber: baseBoxNum + 4,
      },
      {
        ...sheet.rows[2],
        unitNumber: pairCount++,
        beforeNumber: baseBoxNum + 5,
        afterNumber: baseBoxNum + 6,
      },
    ];
    return {
      ...sheet,
      sheetNumber: sheetNum,
      rows: newRows,
    };
  });
}
