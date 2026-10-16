import type { Truck, WeighTable } from './types';

export interface TableStats {
  colTotals: number[];
  bags: number;
  total: number;
}

export interface TruckStats {
  bags: number;
  gross: number;
  avg: number;
  tare: number;
  impurityPct: number;
  impurityKg: number;
  moisture: number | null;
  moistureExcess: number;
  moistureKg: number;
  net: number;
  price: number | null;
  amount: number | null;
  paid: number;
  remaining: number | null;
}

export function tableStats(tb: WeighTable): TableStats {
  const colTotals: number[] = tb.cells.map((col) => col.reduce<number>((acc, v) => acc + (v == null ? 0 : Number(v)), 0));
  const bags = tb.cells.reduce((n, col) => n + col.filter((v) => v != null).length, 0);
  const total = colTotals.reduce((a, b) => a + b, 0);
  return { colTotals, bags, total };
}

export function truckStats(t: Truck): TruckStats {
  let bags = 0;
  let gross = 0;
  for (const tb of t.tables) {
    const s = tableStats(tb);
    bags += s.bags;
    gross += s.total;
  }
  const avg = bags ? gross / bags : 0;
  const tare = bags * (Number(t.tarePerBag) || 0);
  const sample = t.sample || { gram: null, impurityGram: null, moisture: null };
  const impurityPct =
    sample.gram && sample.impurityGram != null ? (Number(sample.impurityGram) / Number(sample.gram)) * 100 : 0;
  const impurityKg = (gross * impurityPct) / 100;
  const moisture = sample.moisture != null ? Number(sample.moisture) : null;
  const std = Number(t.moistureStd) || 0;
  const moistureExcess = moisture != null ? Math.max(0, moisture - std) : 0;
  const moistureKg = (gross * moistureExcess) / 100;
  const net = Math.max(0, gross - tare - impurityKg - moistureKg);
  const price = t.price != null ? Number(t.price) : null;
  const amount = price != null ? net * price : null;
  const paid = Number(t.payment?.paidAmount || 0);
  const remaining = amount != null ? amount - paid : null;
  return { bags, gross, avg, tare, impurityPct, impurityKg, moisture, moistureExcess, moistureKg, net, price, amount, paid, remaining };
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
