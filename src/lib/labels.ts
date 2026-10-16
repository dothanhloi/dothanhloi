import type { Truck, TruckKind } from './types';

/** Nhãn theo chiều giao dịch: thu mua hay bán hàng */
export interface KindLabels {
  kind: TruckKind;
  /** Thu mua / Bán hàng */
  title: string;
  /** Xe / Xuất */
  truckPrefix: string;
  /** Người bán / Khách hàng */
  party: string;
  partyPlural: string;
  /** Thanh toán / Thu tiền */
  pay: string;
  paid: string;        // Đã trả / Đã thu
  unpaid: string;      // Chưa thanh toán / Chưa thu
  partial: string;     // Một phần
  remaining: string;   // Còn nợ / Còn phải thu
  debtTitle: string;   // Công nợ phải trả / Công nợ phải thu
  receiptTitle: string; // PHIẾU CÂN CÀ PHÊ / PHIẾU GIAO HÀNG
  receiptBtn: string;
  weigher: string;     // Nhân viên cân / Nhân viên giao
  warehouse: string;   // Nhập kho / Xuất từ kho
  amount: string;      // Thành tiền
  chip: string;        // Mua / Bán
}

const BUY: KindLabels = {
  kind: 'buy', title: 'Thu mua', truckPrefix: 'Xe', party: 'Người bán', partyPlural: 'Người bán', pay: 'Thanh toán', paid: 'Đã thanh toán', unpaid: 'Chưa thanh toán', partial: 'Một phần',
  remaining: 'Còn nợ', debtTitle: 'Công nợ phải trả', receiptTitle: 'PHIẾU CÂN CÀ PHÊ', receiptBtn: 'Phiếu cân (PDF)', weigher: 'Nhân viên đi cân', warehouse: 'Nhập kho', amount: 'Thành tiền', chip: 'Mua',
};
const SELL: KindLabels = {
  kind: 'sell', title: 'Bán hàng', truckPrefix: 'Xuất', party: 'Khách hàng', partyPlural: 'Khách hàng', pay: 'Thu tiền', paid: 'Đã thu đủ', unpaid: 'Chưa thu', partial: 'Thu một phần',
  remaining: 'Còn phải thu', debtTitle: 'Công nợ phải thu', receiptTitle: 'PHIẾU GIAO HÀNG', receiptBtn: 'Phiếu giao hàng (PDF)', weigher: 'Nhân viên giao', warehouse: 'Xuất từ kho', amount: 'Thành tiền', chip: 'Bán',
};

export function kindOf(t: Pick<Truck, 'kind'> | null | undefined): TruckKind {
  return t?.kind === 'sell' ? 'sell' : 'buy';
}
export function labelsFor(kind: TruckKind | Truck | null | undefined): KindLabels {
  const k = typeof kind === 'string' ? kind : kindOf(kind);
  return k === 'sell' ? SELL : BUY;
}
export const L_BUY = BUY;
export const L_SELL = SELL;
