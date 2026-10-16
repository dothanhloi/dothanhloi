import { nowIso } from './format';
import type { Truck } from './types';

function unionById<T extends { id: string; at: string }>(a: T[] | undefined, b: T[] | undefined): T[] {
  const m = new Map<string, T>();
  for (const x of a || []) m.set(x.id, x);
  for (const x of b || []) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.at.localeCompare(y.at));
}

/**
 * Gộp bản ghi xe từ hai máy: bản mới hơn thắng các trường thường; sổ thanh toán và lịch sử
 * được hợp nhất để không mất lần trả tiền ghi ở máy khác. Trả về chính `local` nếu không có gì đổi.
 */
export function mergeTruck(local: Truck, remote: Truck): Truck {
  const remoteNewer = (remote.updatedAt || '') > (local.updatedAt || '');
  const base = remoteNewer ? remote : local;
  const other = remoteNewer ? local : remote;
  const hasPayArr = Array.isArray(base.payments) || Array.isArray(other.payments);
  const payments = hasPayArr ? unionById(base.payments, other.payments) : undefined;
  const history = unionById(base.history, other.history);
  const payGrew = hasPayArr && payments!.length !== (base.payments || []).length;
  const histGrew = history.length !== (base.history || []).length;
  if (!remoteNewer && !payGrew && !histGrew) return local;
  if (remoteNewer && !payGrew && !histGrew) return remote;
  const merged: Truck = { ...base, history };
  if (hasPayArr) {
    merged.payments = payments;
    merged.payment = { ...base.payment, paidAmount: payments!.reduce((a, x) => a + (Number(x.amount) || 0), 0) };
  }
  // có phần máy kia không có → bump để đẩy lại lên máy chủ (luôn lớn hơn mốc cũ dù đồng hồ lệch)
  const now = nowIso();
  const floor = new Date(new Date(base.updatedAt || 0).getTime() + 1).toISOString();
  return { ...merged, updatedAt: now > floor ? now : floor };
}
