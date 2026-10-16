import { truckStats } from './calc';
import { addDays, parseDate, todayStr } from './format';
import type { Store } from './store';
import type { Truck } from './types';

export type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

export function periodRange(period: Period, anchor: string, custom?: { from: string; to: string }): { from: string; to: string } {
  if (period === 'custom' && custom) return custom;
  const d = parseDate(anchor);
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const dow = (d.getDay() + 6) % 7; // thứ hai = 0
    const from = addDays(anchor, -dow);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { from, to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  if (period === 'year') return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
  return { from: anchor, to: anchor };
}

export function shiftAnchor(period: Period, anchor: string, dir: 1 | -1): string {
  const d = parseDate(anchor);
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, 7 * dir);
  if (period === 'month') { d.setMonth(d.getMonth() + dir); return todayStr(d); }
  if (period === 'year') { d.setFullYear(d.getFullYear() + dir); return todayStr(d); }
  return anchor;
}

export interface Agg { key: string; name: string; trucks: number; bags: number; gross: number; net: number; amount: number; paid: number; remaining: number; avgPrice: number }

function newAgg(key: string, name: string): Agg {
  return { key, name, trucks: 0, bags: 0, gross: 0, net: 0, amount: 0, paid: 0, remaining: 0, avgPrice: 0 };
}
function addTo(a: Agg, t: Truck) {
  const s = truckStats(t);
  a.trucks++; a.bags += s.bags; a.gross += s.gross; a.net += s.net; a.amount += s.amount || 0; a.paid += s.paid; a.remaining += s.remaining || 0;
  a.avgPrice = a.net > 0 && a.amount > 0 ? a.amount / a.net : 0;
}

export function trucksInRange(store: Pick<Store, 'trucks'>, from: string, to: string, filter?: (t: Truck) => boolean): Truck[] {
  return Object.values(store.trucks).filter((t) => !t.deleted && t.date >= from && t.date <= to && (!filter || filter(t))).sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date.localeCompare(b.date)));
}

export type GroupBy = 'seller' | 'weigher' | 'driver' | 'product' | 'warehouse' | 'date';

export function groupTrucks(store: Store, list: Truck[], by: GroupBy): Agg[] {
  const m: Record<string, Agg> = {};
  for (const t of list) {
    let key = '';
    let name = '';
    switch (by) {
      case 'seller': key = t.sellerId || ''; name = key ? store.sellers?.[key]?.name || 'Người bán đã xoá' : 'Chưa gán'; break;
      case 'weigher': key = t.weigherId || ''; name = key ? store.users[key]?.name || '?' : 'Chưa gán'; break;
      case 'driver': key = t.driverId || ''; name = key ? store.drivers[key]?.name || '?' : 'Chưa gán'; break;
      case 'product': key = t.productId || ''; name = key ? store.products?.[key]?.name || '?' : 'Chưa phân loại'; break;
      case 'warehouse': key = t.warehouseId || ''; name = key ? store.warehouses?.[key]?.name || '?' : 'Chưa gán kho'; break;
      case 'date': key = t.date; name = t.date; break;
    }
    addTo(m[key] || (m[key] = newAgg(key, name)), t);
  }
  const arr = Object.values(m);
  return by === 'date' ? arr.sort((a, b) => a.key.localeCompare(b.key)) : arr.sort((a, b) => b.net - a.net);
}

export function totalAgg(list: Truck[]): Agg {
  const a = newAgg('all', 'Tổng');
  for (const t of list) addTo(a, t);
  return a;
}

/* ---------- tồn kho ---------- */
export interface StockRow { warehouseId: string; name: string; inKg: number; outKg: number; stockKg: number; trucks: number; sales: number }

export function stockByWarehouse(store: Store): StockRow[] {
  const m: Record<string, StockRow> = {};
  const get = (id: string | null | undefined) => {
    const k = id || '';
    return m[k] || (m[k] = { warehouseId: k, name: k ? store.warehouses?.[k]?.name || 'Kho đã xoá' : 'Chưa gán kho', inKg: 0, outKg: 0, stockKg: 0, trucks: 0, sales: 0 });
  };
  for (const t of Object.values(store.trucks)) {
    if (t.deleted) continue;
    const r = get(t.warehouseId);
    r.inKg += truckStats(t).net;
    r.trucks++;
  }
  for (const s of Object.values(store.sales || {})) {
    if (s.deleted) continue;
    const r = get(s.warehouseId);
    r.outKg += Number(s.kg) || 0;
    r.sales++;
  }
  for (const r of Object.values(m)) r.stockKg = r.inKg - r.outKg;
  return Object.values(m).sort((a, b) => b.stockKg - a.stockKg);
}

export function hedgeSummary(store: Store): { lots: number; tons: number } {
  let lots = 0, tons = 0;
  for (const h of Object.values(store.hedges || {})) {
    if (h.deleted) continue;
    lots += Number(h.lots) || 0;
    tons += (Number(h.lots) || 0) * (Number(h.tonsPerLot) || 10);
  }
  return { lots, tons };
}

/* ---------- nhắc việc ---------- */
export interface Reminder { kind: 'unfinished' | 'overdue' | 'noprice' | 'unloaded'; text: string; truckId?: string; sellerId?: string }

export function reminders(store: Store): Reminder[] {
  const out: Reminder[] = [];
  const today = todayStr();
  const dueDays = Number(store.settings.debtDueDays ?? 7);
  const overdueBySeller: Record<string, { name: string; amount: number; n: number }> = {};
  for (const t of Object.values(store.trucks)) {
    if (t.deleted) continue;
    if (t.status !== 'done' && t.date < today) out.push({ kind: 'unfinished', text: `${t.name} ngày ${t.date.split('-').reverse().slice(0, 2).join('/')} chưa bấm xong xe`, truckId: t.id });
    if (t.status === 'done' && t.price == null) out.push({ kind: 'noprice', text: `${t.name} ngày ${t.date.split('-').reverse().slice(0, 2).join('/')} đã xong nhưng chưa có giá`, truckId: t.id });
    if (t.status === 'done' && !t.loaded && t.date < today) out.push({ kind: 'unloaded', text: `${t.name} ngày ${t.date.split('-').reverse().slice(0, 2).join('/')} chưa đánh dấu bốc hàng`, truckId: t.id });
    const s = truckStats(t);
    if (s.remaining != null && s.remaining > 0.5 && t.status === 'done' && t.doneAt) {
      const days = Math.floor((Date.now() - new Date(t.doneAt).getTime()) / 86400000);
      if (days >= dueDays) {
        const k = t.sellerId || '';
        const o = overdueBySeller[k] || (overdueBySeller[k] = { name: k ? store.sellers?.[k]?.name || 'Người bán đã xoá' : 'Chưa gán người bán', amount: 0, n: 0 });
        o.amount += s.remaining; o.n++;
      }
    }
  }
  for (const [k, o] of Object.entries(overdueBySeller)) {
    out.push({ kind: 'overdue', text: `Còn nợ ${o.name}: ${Math.round(o.amount).toLocaleString('vi-VN')} đ (${o.n} xe quá ${dueDays} ngày)`, sellerId: k || 'none' });
  }
  return out.slice(0, 20);
}
