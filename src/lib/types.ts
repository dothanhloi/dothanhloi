export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  type: 'user';
  name: string;
  pin: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Driver {
  id: string;
  type: 'driver';
  name: string;
  phone: string;
  plate: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export type CellValue = number | null;

export interface WeighTable {
  id: string;
  name: string;
  locked: boolean;
  /** cells[col][row] – 5 cột, mỗi cột 5 bao */
  cells: CellValue[][];
}

export type HistoryKind = 'cell' | 'field' | 'status' | 'table';

export interface HistoryEntry {
  id: string;
  at: string;
  by: string | null;
  byName: string;
  what: string;
  old: unknown;
  new: unknown;
  kind: HistoryKind;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type TruckStatus = 'weighing' | 'done';

export interface Truck {
  id: string;
  type: 'truck';
  date: string; // YYYY-MM-DD
  seq: number;
  name: string;
  driverId: string | null;
  weigherId: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  updatedAt: string;
  status: TruckStatus;
  doneAt: string | null;
  doneBy: string | null;
  doneByName: string;
  loaded: boolean;
  loadedAt: string | null;
  loadedBy: string | null;
  tables: WeighTable[];
  sample: { gram: number | null; impurityGram: number | null; moisture: number | null };
  price: number | null;
  tarePerBag: number;
  moistureStd: number;
  payment: { status: PaymentStatus; paidAmount: number; note: string };
  note: string;
  history: HistoryEntry[];
  deleted?: boolean;
}

export type SyncRecord = User | Driver | Truck;

export interface Settings {
  sheetUrl: string;
  autoSync: boolean;
  lastSync: string | null;
  lastPush: string | null;
  moistureStd: number;
  tarePerBag: number;
  tablesPerTruck: number;
}
