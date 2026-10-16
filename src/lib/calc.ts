import type { DeductRule, Lot, PresetSnapshot, Truck, WeighTable } from './types';
import { uid } from './format';

export interface TableStats {
  colTotals: number[];
  bags: number;
  total: number;
}

export interface DeductResult {
  /** giá trị đo (%) hoặc null nếu chưa nhập */
  measured: number | null;
  /** phần vượt chuẩn (%) */
  excess: number;
  /** kg bị trừ */
  kg: number;
  /** đ/kg bị trừ vào giá */
  price: number;
  /** mô tả ngắn cách tính để hiển thị */
  label: string;
}

export interface LotStats {
  lotId: string;
  sellerId: string | null;
  bags: number;
  gross: number;
  avg: number;
  tare: number;
  impurityPct: number | null;
  impurity: DeductResult;
  moisture: DeductResult;
  moistureVal: number | null;
  net: number;
  price: number | null;
  priceDeduct: number;
  effectivePrice: number | null;
  amount: number | null;
  paid: number;
  remaining: number | null;
  presetName: string;
}

export interface TruckStats {
  bags: number;
  gross: number;
  avg: number;
  tare: number;
  net: number;
  amount: number | null;
  paid: number;
  remaining: number | null;
  /** thống kê từng chủ hàng */
  lots: LotStats[];
  /** cân xe tải nhiều chủ hàng: kg chưa chia */
  unassignedKg: number;
}

export function tableStats(tb: WeighTable): TableStats {
  const colTotals: number[] = tb.cells.map((col) => col.reduce<number>((acc, v) => acc + (v == null ? 0 : Number(v)), 0));
  const bags = tb.cells.reduce((n, col) => n + col.filter((v) => v != null).length, 0);
  const total = colTotals.reduce((a, b) => a + b, 0);
  return { colTotals, bags, total };
}

/** Quy ước mặc định dùng khi xe cũ chưa có preset (giữ cách tính cũ) */
export function legacyPreset(t: { tarePerBag?: number; moistureStd?: number }): PresetSnapshot {
  return {
    id: 'legacy',
    name: 'Mặc định',
    tareMode: 'perBag',
    tareValue: Number(t.tarePerBag) || 0,
    impurityInput: 'gram',
    impurity: { standard: 0, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] },
    moisture: { standard: Number(t.moistureStd) || 0, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] },
  };
}

export function presetOf(lot: Lot, t?: Truck): PresetSnapshot {
  return lot.preset || legacyPreset(t || {});
}

/** Chuyển xe cũ (một chủ hàng, trường ở cấp xe) thành xe có danh sách chủ hàng. Trả về chính `t` nếu đã đúng dạng */
export function normalizeTruck(t: Truck): Truck {
  if (Array.isArray(t.lots) && t.lots.length) return t;
  const legacyPay = t.payment || { status: 'unpaid' as const, note: '' };
  const paidAmount = Number((t.payment as any)?.paidAmount || 0);
  const payments = Array.isArray(t.payments) ? t.payments : paidAmount > 0
    ? [{ id: 'legacy', at: t.updatedAt, amount: paidAmount, method: 'other' as const, by: null, byName: '', note: 'Nhập trước khi có sổ thanh toán' }] : [];
  const lot: Lot = {
    id: 'lot-' + t.id,
    sellerId: t.sellerId ?? null,
    productId: t.productId ?? null,
    tables: t.tables || [],
    sample: t.sample || { gram: null, impurityGram: null, impurityPct: null, moisture: null },
    price: t.price ?? null,
    preset: t.preset || (t.tarePerBag != null || t.moistureStd != null ? legacyPreset(t) : null),
    payments,
    payment: { status: legacyPay.status, note: legacyPay.note || '' },
    note: '',
  };
  const { tables: _t, sample: _s, price: _p, preset: _pr, payments: _pay, payment: _pm, ...rest } = t;
  return { ...rest, lots: [lot] } as Truck;
}

export function lotsOf(t: Truck): Lot[] {
  return Array.isArray(t.lots) && t.lots.length ? t.lots : normalizeTruck(t).lots;
}

export function newLot(sellerId: string | null, preset: PresetSnapshot | null, price: number | null, nTables = 2, productId: string | null = null): Lot {
  const tables: WeighTable[] = [];
  for (let i = 1; i <= Math.max(1, nTables); i++) tables.push({ id: uid(), name: 'BẢNG ' + i, locked: false, cells: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)) });
  return { id: uid(), sellerId, productId, tables, sample: { gram: null, impurityGram: null, impurityPct: null, moisture: null }, price, preset, payments: [], payment: { status: 'unpaid', note: '' }, note: '' };
}

function fmt1(n: number) { return Math.round(n * 100) / 100; }

/** Áp dụng một quy tắc trừ cho giá trị đo */
export function applyRule(rule: DeductRule, measured: number | null, gross: number): DeductResult {
  if (measured == null || isNaN(measured)) return { measured: null, excess: 0, kg: 0, price: 0, label: '' };
  const std = Number(rule.standard) || 0;
  const excess = Math.max(0, measured - std);
  switch (rule.method) {
    case 'kg': {
      const pct = excess * (Number(rule.rate) || 0);
      return { measured, excess, kg: (gross * pct) / 100, price: 0, label: excess > 0 ? `vượt ${fmt1(excess)}% × ${rule.rate} = trừ ${fmt1(pct)}% kg` : 'đạt chuẩn' };
    }
    case 'price': {
      const d = excess * (Number(rule.rate) || 0);
      return { measured, excess, kg: 0, price: d, label: excess > 0 ? `vượt ${fmt1(excess)}% × ${rule.rate} đ = trừ ${Math.round(d).toLocaleString('vi-VN')} đ/kg` : 'đạt chuẩn' };
    }
    case 'table': {
      const rows = [...(rule.table || [])].sort((a, b) => a.upTo - b.upTo);
      if (!rows.length) return { measured, excess, kg: 0, price: 0, label: 'bảng trống' };
      let row = rows.find((r) => measured <= r.upTo);
      let over = false;
      if (!row) { row = rows[rows.length - 1]; over = true; }
      const v = Number(row.value) || 0;
      if (rule.tableUnit === 'price') {
        return { measured, excess, kg: 0, price: v, label: `bậc ≤ ${row.upTo}%${over ? ' (vượt bảng)' : ''}: trừ ${Math.round(v).toLocaleString('vi-VN')} đ/kg` };
      }
      return { measured, excess, kg: (gross * v) / 100, price: 0, label: `bậc ≤ ${row.upTo}%${over ? ' (vượt bảng)' : ''}: trừ ${fmt1(v)}% kg` };
    }
    default:
      return { measured, excess, kg: 0, price: 0, label: 'chỉ ghi nhận, không trừ' };
  }
}

/** Tổng bao và tổng thô của một chủ hàng theo kiểu cân */
export function grossOfLot(t: Truck, lot: Lot): { bags: number; gross: number } {
  const lots = lotsOf(t);
  if ((t.weighMode || 'bags') === 'truck') {
    const w = t.truckWeigh || { grossIn: null, tareOut: null, bags: null };
    const total = w.grossIn != null && w.tareOut != null ? Math.max(0, Number(w.grossIn) - Number(w.tareOut)) : 0;
    if (lots.length <= 1) return { bags: Number(w.bags) || 0, gross: total };
    return { bags: Number(lot.truckBags) || 0, gross: Number(lot.truckKg) || 0 };
  }
  let bags = 0;
  let gross = 0;
  for (const tb of lot.tables) {
    const s = tableStats(tb);
    bags += s.bags;
    gross += s.total;
  }
  return { bags, gross };
}

export function lotStats(t: Truck, lot: Lot): LotStats {
  const { bags, gross } = grossOfLot(t, lot);
  const avg = bags ? gross / bags : 0;
  const p = presetOf(lot, t);
  const sample = lot.sample || { gram: null, impurityGram: null, impurityPct: null, moisture: null };
  let tare = 0;
  if (p.tareMode === 'perBag') tare = bags * (Number(p.tareValue) || 0);
  else if (p.tareMode === 'percent') tare = (gross * (Number(p.tareValue) || 0)) / 100;
  let impurityPct: number | null = null;
  if (p.impurityInput === 'percent') impurityPct = sample.impurityPct != null ? Number(sample.impurityPct) : null;
  else if (sample.gram && sample.impurityGram != null) impurityPct = (Number(sample.impurityGram) / Number(sample.gram)) * 100;
  const impurity = applyRule(p.impurity, impurityPct, gross);
  const moistureVal = sample.moisture != null ? Number(sample.moisture) : null;
  const moisture = applyRule(p.moisture, moistureVal, gross);
  const net = Math.max(0, gross - tare - impurity.kg - moisture.kg);
  const price = lot.price != null ? Number(lot.price) : null;
  const priceDeduct = impurity.price + moisture.price;
  const effectivePrice = price != null ? Math.max(0, price - priceDeduct) : null;
  const amount = effectivePrice != null ? net * effectivePrice : null;
  const paid = (lot.payments || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const remaining = amount != null ? amount - paid : null;
  return { lotId: lot.id, sellerId: lot.sellerId, bags, gross, avg, tare, impurityPct, impurity, moisture, moistureVal, net, price, priceDeduct, effectivePrice, amount, paid, remaining, presetName: p.name };
}

/** Thống kê cả xe = tổng các chủ hàng */
export function truckStats(t: Truck): TruckStats {
  const lots = lotsOf(t).map((l) => lotStats(t, l));
  const agg: TruckStats = { bags: 0, gross: 0, avg: 0, tare: 0, net: 0, amount: null, paid: 0, remaining: null, lots, unassignedKg: 0 };
  let anyAmount = false;
  for (const l of lots) {
    agg.bags += l.bags; agg.gross += l.gross; agg.tare += l.tare; agg.net += l.net; agg.paid += l.paid;
    if (l.amount != null) { anyAmount = true; agg.amount = (agg.amount || 0) + l.amount; }
  }
  agg.avg = agg.bags ? agg.gross / agg.bags : 0;
  agg.remaining = anyAmount ? (agg.amount || 0) - agg.paid : null;
  if ((t.weighMode || 'bags') === 'truck' && lots.length > 1) {
    const w = t.truckWeigh || { grossIn: null, tareOut: null, bags: null };
    const total = w.grossIn != null && w.tareOut != null ? Math.max(0, Number(w.grossIn) - Number(w.tareOut)) : 0;
    agg.unassignedKg = total - agg.gross;
  }
  return agg;
}

/** Tổng bao và tổng thô cả xe (tương thích) */
export function grossOf(t: Truck): { bags: number; gross: number } {
  const s = truckStats(t);
  return { bags: s.bags, gross: s.gross };
}

export interface DayStats {
  trucks: number;
  done: number;
  bags: number;
  gross: number;
  net: number;
  amount: number;
  paid: number;
}

export function dayStats(list: Truck[]): DayStats {
  const agg: DayStats = { trucks: list.length, done: 0, bags: 0, gross: 0, net: 0, amount: 0, paid: 0 };
  for (const t of list) {
    const s = truckStats(t);
    if (t.status === 'done') agg.done++;
    agg.bags += s.bags;
    agg.gross += s.gross;
    agg.net += s.net;
    agg.amount += s.amount || 0;
    agg.paid += s.paid;
  }
  return agg;
}

/* ---------- mẫu quy ước có sẵn ---------- */
export const PRESET_TEMPLATES: { key: string; name: string; desc: string; make: () => Omit<PresetSnapshot, 'id' | 'name'> }[] = [
  {
    key: 'kg11', name: 'Trừ kg 1:1', desc: 'Tạp chuẩn 1%, độ chuẩn 13%. Mỗi 1% vượt chuẩn trừ 1% khối lượng.',
    make: () => ({ tareMode: 'perBag', tareValue: 0, impurityInput: 'gram',
      impurity: { standard: 1, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] },
      moisture: { standard: 13, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] } }),
  },
  {
    key: 'price', name: 'Trừ giá', desc: 'Không trừ kg. Mỗi 1% tạp hoặc độ vượt chuẩn trừ một số tiền vào giá mỗi kg.',
    make: () => ({ tareMode: 'perBag', tareValue: 0, impurityInput: 'percent',
      impurity: { standard: 1, method: 'price', rate: 500, tableUnit: 'price', table: [] },
      moisture: { standard: 13, method: 'price', rate: 1000, tableUnit: 'price', table: [] } }),
  },
  {
    key: 'table', name: 'Bảng trừ lùi', desc: 'Trừ theo bậc: độ ≤13 không trừ, ≤14 trừ 1.5%, ≤15 trừ 3%, ≤16 trừ 5% kg. Sửa lại theo kho của bạn.',
    make: () => ({ tareMode: 'perBag', tareValue: 0, impurityInput: 'gram',
      impurity: { standard: 1, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] },
      moisture: { standard: 13, method: 'table', rate: 1, tableUnit: 'kgPct', table: [{ upTo: 13, value: 0 }, { upTo: 14, value: 1.5 }, { upTo: 15, value: 3 }, { upTo: 16, value: 5 }] } }),
  },
  {
    key: 'record', name: 'Chỉ ghi nhận', desc: 'Ghi tạp, độ để theo dõi nhưng không trừ gì. Giá đã thoả thuận theo hàng thực tế.',
    make: () => ({ tareMode: 'none', tareValue: 0, impurityInput: 'gram',
      impurity: { standard: 0, method: 'none', rate: 0, tableUnit: 'kgPct', table: [] },
      moisture: { standard: 0, method: 'none', rate: 0, tableUnit: 'kgPct', table: [] } }),
  },
];
