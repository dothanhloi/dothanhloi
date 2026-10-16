import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { lotStats, lotsOf, presetOf, truckStats } from './calc';
import { fmtDateTime, fmtDateVN, fmtKg, fmtMoney, fmtNum, fmtPct, fmtTime } from './format';
import { presetSummary } from './presetText';
import { labelsFor } from './labels';
import { Store, teamConfigOf } from './store';
import type { Lot, Truck } from './types';

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CSS = `
  @page { size: A5 portrait; margin: 10mm; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  h1 { font-size: 16pt; margin: 0; text-align: center; letter-spacing: .5px; }
  .co { text-align: center; font-size: 9.5pt; color: #444; margin-bottom: 8px; }
  .co b { font-size: 11pt; color: #111; }
  .head { display: flex; justify-content: space-between; font-size: 10pt; margin: 6px 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  .info td { padding: 3px 4px; font-size: 10pt; vertical-align: top; }
  .info td.k { color: #555; width: 32%; }
  .info td.v { font-weight: 600; }
  .grid { margin: 6px 0; font-size: 9.5pt; }
  .grid th { background: #eef; padding: 3px; text-align: left; font-size: 9.5pt; border: 1px solid #ccd; }
  .grid td { border: 1px solid #ccd; padding: 3px 2px; text-align: center; width: 20%; font-variant-numeric: tabular-nums; }
  .grid .tot td { font-weight: 700; color: #b00; background: #fff3f2; }
  .sum { margin-top: 8px; }
  .sum td { padding: 3px 4px; font-size: 10.5pt; border-bottom: 1px dashed #ddd; }
  .sum td.k { color: #555; }
  .sum td.v { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .sum tr.big td { font-size: 13pt; font-weight: 800; border-bottom: 2px solid #111; }
  .sum tr.green td.v { color: #1b7a3e; }
  .sum tr.red td.v { color: #b00; }
  .pay { font-size: 9.5pt; margin-top: 6px; }
  .pay td { padding: 2px 4px; border-bottom: 1px solid #eee; }
  .sign { display: flex; justify-content: space-between; margin-top: 18px; text-align: center; font-size: 10pt; }
  .sign div { width: 45%; }
  .sign small { display: block; color: #777; font-size: 8.5pt; margin-top: 2px; }
  .sign .line { height: 48px; }
  .foot { margin-top: 10px; font-size: 8.5pt; color: #777; text-align: center; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
`;

const kv = (k: string, v: string, cls = '') => `<tr class="${cls}"><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`;

function tablesHtml(t: Truck, lot: Lot): string {
  if ((t.weighMode || 'bags') === 'truck') return '';
  return lot.tables.map((tb) => {
    const rows = tb.cells[0]?.length || 5;
    const cols: number[] = tb.cells.map((col) => col.reduce<number>((a, v) => a + (v == null ? 0 : Number(v)), 0));
    const bags = tb.cells.reduce((n, c) => n + c.filter((v) => v != null).length, 0);
    if (bags === 0) return '';
    let html = `<table class="grid"><thead><tr><th colspan="${tb.cells.length}">${esc(tb.name)} · ${bags} bao · ${fmtKg(cols.reduce((a, b) => a + b, 0))} kg</th></tr></thead><tbody>`;
    for (let r = 0; r < rows; r++) html += '<tr>' + tb.cells.map((c) => `<td>${c[r] == null ? '' : fmtNum(c[r])}</td>`).join('') + '</tr>';
    html += '<tr class="tot">' + cols.map((v) => `<td>${fmtNum(v)}</td>`).join('') + '</tr></tbody></table>';
    return html;
  }).join('');
}

/** Một trang phiếu cân cho một chủ hàng */
function lotPage(t: Truck, lot: Lot, st: Store, idx: number, total: number): string {
  const s = lotStats(t, lot);
  const p = presetOf(lot, t);
  const co = teamConfigOf(st).company;
  const seller = lot.sellerId ? st.sellers?.[lot.sellerId] : null;
  const driver = t.driverId ? st.drivers[t.driverId] : null;
  const weigher = t.weigherId ? st.users[t.weigherId]?.name : '';
  const product = lot.productId ? st.products?.[lot.productId]?.name : '';
  const pays = lot.payments || [];
  const truckMode = (t.weighMode || 'bags') === 'truck';
  const lb = labelsFor(t);
  const lotTag = total > 1 ? ` · ${lb.kind === 'sell' ? 'Khách' : 'Chủ hàng'} ${idx + 1}/${total}` : '';
  return `<div class="page">
<div class="co">${co.name ? `<b>${esc(co.name)}</b><br>` : ''}${[co.address, co.phone ? 'ĐT: ' + co.phone : ''].filter(Boolean).map(esc).join(' · ')}</div>
<h1>${lb.receiptTitle}</h1>
<div class="head"><span>Số: <b>${esc(t.name)}</b>${esc(lotTag)} ngày ${fmtDateVN(t.date)}</span><span>Giờ cân: ${fmtTime(t.createdAt)}${t.doneAt ? ' – ' + fmtTime(t.doneAt) : ''}</span></div>
<table class="info">
${kv(lb.party, seller ? `${esc(seller.name)}${seller.phone ? ' · ' + esc(seller.phone) : ''}${seller.address ? '<br><span style="font-weight:400">' + esc(seller.address) + '</span>' : ''}` : '—')}
${product ? kv('Loại hàng', esc(product)) : ''}
${kv('Tài xế', driver ? `${esc(driver.name)}${driver.plate ? ' · ' + esc(driver.plate) : ''}` : '—')}
${kv(lb.weigher, esc(weigher || '—'))}
${kv('Quy ước', esc(p.name) + ` <span style="font-weight:400;color:#666;font-size:9pt">(${esc(presetSummary(p))})</span>`)}
${lot.note ? kv('Ghi chú', esc(lot.note)) : t.note && total === 1 ? kv('Ghi chú', esc(t.note)) : ''}
</table>
${tablesHtml(t, lot)}
<table class="sum">
${truckMode && total === 1 ? kv('Cân xe vào (có hàng)', fmtKg(t.truckWeigh?.grossIn ?? null) + ' kg') + kv('Cân xe ra (rỗng)', fmtKg(t.truckWeigh?.tareOut ?? null) + ' kg') : ''}
${kv('Tổng bao', String(s.bags))}
${kv('Tổng thô', fmtKg(s.gross) + ' kg')}
${s.tare > 0 ? kv('Trừ bì', '− ' + fmtKg(s.tare) + ' kg') : ''}
${s.impurityPct != null ? kv('Tạp ' + fmtPct(s.impurityPct), s.impurity.kg > 0 ? '− ' + fmtKg(s.impurity.kg) + ' kg' : s.impurity.price > 0 ? '− ' + fmtMoney(s.impurity.price) + '/kg' : 'không trừ') : ''}
${s.moistureVal != null ? kv('Độ ' + fmtPct(s.moistureVal, 1), s.moisture.kg > 0 ? '− ' + fmtKg(s.moisture.kg) + ' kg' : s.moisture.price > 0 ? '− ' + fmtMoney(s.moisture.price) + '/kg' : 'không trừ') : ''}
${kv('Thực nhận', fmtKg(s.net) + ' kg', 'green')}
${kv('Đơn giá', s.price != null ? fmtMoney(s.price) + '/kg' : '—')}
${s.priceDeduct > 0 ? kv('Giá sau trừ', fmtMoney(s.effectivePrice) + '/kg') : ''}
${kv('THÀNH TIỀN', fmtMoney(s.amount), 'big')}
${kv(lb.kind === 'sell' ? 'Đã thu' : 'Đã thanh toán', fmtMoney(s.paid))}
${kv(lb.kind === 'sell' ? 'Còn phải thu' : 'Còn lại', fmtMoney(s.remaining), s.remaining && s.remaining > 0 ? 'red' : 'green')}
</table>
${pays.length ? `<table class="pay">${pays.map((x) => `<tr><td>${fmtDateTime(x.at)}</td><td>${x.method === 'cash' ? 'Tiền mặt' : x.method === 'transfer' ? 'Chuyển khoản' : 'Khác'}</td><td style="text-align:right;font-weight:600">${fmtMoney(x.amount)}</td><td>${esc(x.note)}</td></tr>`).join('')}</table>` : ''}
<div class="sign"><div>${lb.kind === 'sell' ? 'Người nhận hàng' : 'Người bán'}<small>(ký, ghi rõ họ tên)</small><div class="line"></div></div><div>${lb.kind === 'sell' ? 'Người giao' : 'Người cân'}<small>${esc(weigher || '')}</small><div class="line"></div></div></div>
<div class="foot">${esc(co.footer || '')}${co.footer ? ' · ' : ''}In lúc ${fmtDateTime(new Date().toISOString())}</div>
</div>`;
}

/** HTML phiếu cân: một chủ hàng (lotId) hoặc cả xe (mỗi chủ hàng một trang) */
export function receiptHtml(t: Truck, st: Store, lotId?: string): string {
  const lots = lotsOf(t);
  const chosen = lotId ? lots.filter((l) => l.id === lotId) : lots;
  const pages = chosen.map((l) => lotPage(t, l, st, lots.findIndex((x) => x.id === l.id), lots.length)).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${pages}</body></html>`;
}

/** Tạo PDF phiếu cân và mở hộp chia sẻ (Zalo, Messages, Lưu vào Tệp...) */
export async function shareReceipt(t: Truck, st: Store, lotId?: string): Promise<void> {
  const html = receiptHtml(t, st, lotId);
  const { uri } = await Print.printToFileAsync({ html, width: 420, height: 595, base64: false });
  const lot = lotId ? lotsOf(t).find((l) => l.id === lotId) : null;
  const who = lot?.sellerId ? st.sellers?.[lot.sellerId]?.name : '';
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${labelsFor(t).kind === 'sell' ? 'Phiếu giao hàng' : 'Phiếu cân'} ${t.name}${who ? ' · ' + who : ''} ${fmtDateVN(t.date)}` });
  } else {
    await Print.printAsync({ uri });
  }
}
export { truckStats };
