import { lotStats, lotsOf } from './calc';
import { nowIso } from './format';
import type { Lot, PaymentStatus, Truck } from './types';

function unionById<T extends { id: string; at: string }>(a: T[] | undefined, b: T[] | undefined): T[] {
  const m = new Map<string, T>();
  for (const x of a || []) m.set(x.id, x);
  for (const x of b || []) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.at.localeCompare(y.at));
}

/** Dấu thời gian mới, luôn lớn hơn mốc cũ dù đồng hồ máy chạy chậm */
export function laterThan(prev: string | null | undefined): string {
  const now = nowIso();
  const floor = prev ? new Date(new Date(prev).getTime() + 1).toISOString() : '';
  return now > floor ? now : floor;
}

/** Trạng thái xe theo lần đổi trạng thái gần nhất trong lịch sử hợp nhất (xong xe không bị "mở lại" bởi máy chưa cập nhật) */
function statusFromHistory(history: Truck['history']): 'done' | 'weighing' | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.what === 'Trạng thái xe') return h.new === 'Đã xong' ? 'done' : 'weighing';
  }
  return null;
}

export function paymentStatusOfLot(t: Truck, lot: Lot): PaymentStatus {
  const s = lotStats(t, lot);
  if (s.amount == null) return s.paid > 0 ? 'partial' : lot.payment?.status === 'paid' ? 'paid' : 'unpaid';
  if (s.paid >= Math.round(s.amount) - 1) return 'paid';
  return s.paid > 0 ? 'partial' : 'unpaid';
}

/**
 * Gộp bản ghi xe từ hai máy: bản mới hơn thắng các trường thường; với từng chủ hàng, sổ thanh toán được hợp nhất;
 * chủ hàng chỉ có ở một bên được giữ; lịch sử hợp nhất; "đã xong" và "đã xoá" không bị bản cũ hơn ghi đè.
 * Trả về chính `local` nếu không có gì đổi, chính `remote` nếu chỉ cần lấy bản máy chủ.
 */
export function mergeTruck(local: Truck, remote: Truck): Truck {
  const remoteNewer = (remote.updatedAt || '') > (local.updatedAt || '');
  const base = remoteNewer ? remote : local;
  const other = remoteNewer ? local : remote;
  const baseLots = lotsOf(base);
  const otherLots = lotsOf(other);

  // chủ hàng: theo id; cùng id → trường của base, thanh toán hợp nhất; chỉ ở other → thêm vào
  let lotsGrew = false;
  const lots: Lot[] = baseLots.map((bl) => {
    const ol = otherLots.find((l) => l.id === bl.id);
    if (!ol) return bl;
    const payments = unionById(bl.payments, ol.payments);
    if (payments.length === (bl.payments || []).length) return bl;
    lotsGrew = true;
    return { ...bl, payments };
  });
  for (const ol of otherLots) if (!baseLots.some((l) => l.id === ol.id)) { lots.push(ol); lotsGrew = true; }

  const history = unionById(base.history, other.history);
  const histGrew = history.length !== (base.history || []).length;
  const st = statusFromHistory(history) || base.status;
  const doneSrc = st === 'done' ? (base.status === 'done' ? base : other.status === 'done' ? other : base) : null;
  const statusChanged = st !== base.status;
  const deleted = !!(base.deleted || other.deleted);
  const deletedChanged = deleted !== !!base.deleted;

  if (!remoteNewer && !lotsGrew && !histGrew && !statusChanged && !deletedChanged) return local;
  if (remoteNewer && !lotsGrew && !histGrew && !statusChanged && !deletedChanged) return remote;

  const merged: Truck = { ...base, lots, history };
  if (lotsGrew) merged.lots = merged.lots.map((l) => ({ ...l, payment: { ...l.payment, status: paymentStatusOfLot(merged, l) } }));
  if (statusChanged) {
    if (st === 'done' && doneSrc) {
      merged.status = 'done'; merged.doneAt = doneSrc.doneAt; merged.doneBy = doneSrc.doneBy; merged.doneByName = doneSrc.doneByName;
      merged.lots = merged.lots.map((l) => ({ ...l, tables: l.tables.map((tb) => ({ ...tb, locked: true })) }));
    } else {
      merged.status = 'weighing'; merged.doneAt = null; merged.doneBy = null; merged.doneByName = '';
      merged.lots = merged.lots.map((l) => ({ ...l, tables: l.tables.map((tb) => ({ ...tb, locked: false })) }));
    }
  }
  if (deleted) merged.deleted = true;
  return { ...merged, updatedAt: laterThan(base.updatedAt) };
}

/** Gộp bản ghi thường (không phải xe): mới hơn thắng, nhưng "đã xoá" là dính */
export function mergeSimple<T extends { updatedAt: string; deleted?: boolean }>(local: T, remote: T): T {
  const remoteNewer = (remote.updatedAt || '') > (local.updatedAt || '');
  const base = remoteNewer ? remote : local;
  const deleted = !!(local.deleted || remote.deleted);
  if (deleted && !base.deleted) return { ...base, deleted: true, updatedAt: laterThan(base.updatedAt) };
  return base;
}
