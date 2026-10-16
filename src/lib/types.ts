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
  sample: { gram: number | null; impurityGram: number | null; impurityPct?: number | null; moisture: number | null };
  price: number | null;
  /** @deprecated dùng preset; giữ để tương thích xe cũ */
  tarePerBag: number;
  /** @deprecated dùng preset; giữ để tương thích xe cũ */
  moistureStd: number;
  /** Quy ước tạp độ áp dụng cho xe (bản sao tại thời điểm chọn) */
  preset?: PresetSnapshot | null;
  payment: { status: PaymentStatus; paidAmount: number; note: string };
  note: string;
  history: HistoryEntry[];
  deleted?: boolean;
}

export type SyncRecord = User | Driver | Truck | QualityPreset;

export interface Settings {
  sheetUrl: string;
  autoSync: boolean;
  lastSync: string | null;
  lastPush: string | null;
  moistureStd: number;
  tarePerBag: number;
  tablesPerTruck: number;
  defaultPresetId?: string | null;
}

/* ---------- Quy ước tạp / độ (preset) ---------- */

/** Cách trừ cho một yếu tố (tạp hoặc độ) */
export type DeductMethod = 'none' | 'kg' | 'price' | 'table';

export interface DeductTableRow {
  /** Áp dụng khi giá trị đo (%) <= upTo */
  upTo: number;
  /** Mức trừ: % khối lượng (unit = 'kgPct') hoặc đ/kg (unit = 'price') */
  value: number;
}

export interface DeductRule {
  /** Mức chuẩn (%). Chỉ phần vượt quá mức này mới bị trừ (với method kg/price). 0 = trừ toàn bộ */
  standard: number;
  method: DeductMethod;
  /** method = 'kg': mỗi 1% vượt chuẩn trừ `rate` % khối lượng (thường 1). method = 'price': mỗi 1% vượt trừ `rate` đ/kg */
  rate: number;
  /** method = 'table' */
  tableUnit: 'kgPct' | 'price';
  table: DeductTableRow[];
}

export interface QualityPreset {
  id: string;
  type: 'preset';
  name: string;
  note: string;
  isDefault: boolean;
  /** Bì: 'perBag' = kg mỗi bao, 'percent' = % tổng thô, 'none' = không trừ */
  tareMode: 'none' | 'perBag' | 'percent';
  tareValue: number;
  /** Nhập tạp theo gram trong mẫu (cần Mẫu g) hay nhập % trực tiếp */
  impurityInput: 'gram' | 'percent';
  impurity: DeductRule;
  moisture: DeductRule;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

/** Bản sao quy ước lưu trong xe (không gồm metadata) */
export type PresetSnapshot = Pick<QualityPreset, 'id' | 'name' | 'tareMode' | 'tareValue' | 'impurityInput' | 'impurity' | 'moisture'>;
