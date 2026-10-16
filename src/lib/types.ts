export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  type: 'user';
  name: string;
  /** @deprecated PIN dạng chữ thường (tài khoản cũ); sau khi băm sẽ là '' */
  pin: string;
  /** SHA-256(pin + salt) */
  pinHash?: string;
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

/** Một chủ hàng (lô) trong xe: bảng cân, chất lượng, giá, thanh toán riêng */
export interface Lot {
  id: string;
  sellerId: string | null;
  productId: string | null;
  tables: WeighTable[];
  sample: { gram: number | null; impurityGram: number | null; impurityPct?: number | null; moisture: number | null };
  price: number | null;
  preset: PresetSnapshot | null;
  payments: Payment[];
  payment: { status: PaymentStatus; note: string };
  note: string;
  /** cân xe tải với nhiều chủ hàng: kg và số bao chia cho lô này */
  truckKg?: number | null;
  truckBags?: number | null;
}

export interface Truck {
  id: string;
  type: 'truck';
  date: string; // YYYY-MM-DD
  seq: number;
  name: string;
  driverId: string | null;
  sellerId?: string | null;
  warehouseId?: string | null;
  productId?: string | null;
  weigherId: string | null;
  /** 'bags' = cân từng bao (mặc định); 'truck' = cân xe tải (xe vào − xe ra) */
  weighMode?: WeighMode;
  truckWeigh?: { grossIn: number | null; tareOut: number | null; bags: number | null };
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
  /** Các chủ hàng trong xe (từ phiên bản 2). Xe cũ được chuyển tự động từ các trường legacy bên dưới */
  lots: Lot[];
  /** @deprecated legacy (xe một chủ hàng) – chỉ còn để chuyển đổi */
  tables?: WeighTable[];
  sample?: { gram: number | null; impurityGram: number | null; impurityPct?: number | null; moisture: number | null };
  price?: number | null;
  tarePerBag?: number;
  moistureStd?: number;
  preset?: PresetSnapshot | null;
  payment?: { status: PaymentStatus; paidAmount?: number; note: string };
  payments?: Payment[];
  note: string;
  history: HistoryEntry[];
  deleted?: boolean;
}

export type SyncRecord = User | Driver | Truck | QualityPreset | Seller | DayPrice | Warehouse | Product | Sale | Hedge | Photo | TeamConfig;

export interface Settings {
  sheetUrl: string;
  autoSync: boolean;
  lastSync: string | null;
  lastPush: string | null;
  moistureStd: number;
  tarePerBag: number;
  tablesPerTruck: number;
  defaultPresetId?: string | null;
  company?: Company;
  /** nhân viên (không phải quản lý) có được thấy giá và tiền không */
  staffCanSeeMoney?: boolean;
  /** nhắc công nợ quá hạn sau N ngày kể từ khi xong xe */
  debtDueDays?: number;
  lastBackup?: string | null;
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
  /** true nếu app tự tạo từ mẫu (ưu tiên thấp khi gộp nhiều "mặc định") */
  auto?: boolean;
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

/* ---------- Người bán, thanh toán, giá ngày ---------- */
export interface Seller {
  id: string;
  type: 'seller';
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export type PaymentMethod = 'cash' | 'transfer' | 'other';

export interface Payment {
  id: string;
  at: string;
  amount: number;
  method: PaymentMethod;
  by: string | null;
  byName: string;
  note: string;
}

export interface DayPrice {
  id: string; // 'dp-' + date
  type: 'dayprice';
  date: string;
  price: number | null;
  note: string;
  byName: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Company {
  name: string;
  phone: string;
  address: string;
  footer: string;
}

/* ---------- Nhóm 2 & 3: kho, loại hàng, xuất bán, hedge, ảnh ---------- */
export interface Warehouse {
  id: string;
  type: 'warehouse';
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Product {
  id: string;
  type: 'product';
  name: string;
  /** quy ước tạp độ mặc định cho loại hàng này */
  presetId: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

/** Xuất bán / xuất kho */
export interface Sale {
  id: string;
  type: 'sale';
  date: string;
  warehouseId: string | null;
  productId: string | null;
  kg: number;
  price: number | null;
  buyer: string;
  note: string;
  byName: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

/** Vị thế hedge trên sàn (ghi nhận tay) */
export interface Hedge {
  id: string;
  type: 'hedge';
  date: string;
  /** số lot bán (+) hoặc mua lại (−) */
  lots: number;
  /** tấn mỗi lot, London Robusta = 10 */
  tonsPerLot: number;
  price: number | null;
  note: string;
  byName: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Photo {
  id: string;
  type: 'photo';
  truckId: string;
  kind: 'sample' | 'ticket' | 'truck' | 'other';
  note: string;
  /** đường dẫn file trên máy đã chụp (không đồng bộ) */
  localUri?: string;
  /** link Google Drive sau khi tải lên */
  driveUrl: string | null;
  byName: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export type WeighMode = 'bags' | 'truck';

/** Cài đặt dùng chung cả đội, đồng bộ qua Google Sheets (id cố định 'config') */
export interface TeamConfig {
  id: 'config';
  type: 'config';
  staffCanSeeMoney: boolean;
  debtDueDays: number;
  tablesPerTruck: number;
  company: Company;
  updatedAt: string;
  deleted?: boolean;
}
