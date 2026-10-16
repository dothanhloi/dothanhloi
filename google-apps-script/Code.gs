/**
 * Cân Cà Phê – backend Google Apps Script
 * ------------------------------------------------------------
 * Cách cài (làm 1 lần):
 *  1. Tạo Google Sheets mới → Tiện ích mở rộng → Apps Script.
 *  2. Xoá nội dung mặc định, dán toàn bộ file này, bấm Lưu.
 *  3. Triển khai → Tuỳ chọn triển khai mới → Ứng dụng web:
 *       - Thực thi với tư cách: Tôi
 *       - Ai có quyền truy cập: Bất kỳ ai
 *     Bấm Triển khai, cấp quyền, sao chép URL (kết thúc bằng /exec).
 *  4. Dán URL vào app: Cài đặt → Liên kết Google Sheets.
 *
 * Khi sửa file này, phải "Triển khai → Quản lý triển khai → Sửa → Phiên bản mới"
 * thì URL cũ mới chạy mã mới.
 *
 * Các trang (sheet) tự tạo:
 *   DATA          : dữ liệu gốc (type, id, updatedAt, deleted, json) – KHÔNG sửa tay
 *   Xe            : mỗi xe một dòng + tổng kết
 *   Chi tiết cân  : từng bao
 *   Lịch sử sửa   : mọi thay đổi (ai, lúc nào, cũ → mới)
 *   Quy ước      : các quy ước tạp/độ
 *   Nhân viên, Tài xế
 */

var VERSION = '1.0.0';
var SH_DATA = 'DATA';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    if (action === 'pull') return json_({ ok: true, records: readAll_() });
    return json_({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName(), version: VERSION });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action || 'sync';
    if (action === 'sync' || action === 'push') {
      var incoming = Array.isArray(body.records) ? body.records : [];
      var n = upsert_(incoming);
      if (n > 0) rebuildViews_();
      var out = body.since ? readAll_().filter(function (r) { return (r.updatedAt || '') > body.since; }) : readAll_();
      return json_({ ok: true, upserted: n, records: out });
    }
    return json_({ ok: false, error: 'Hành động không hỗ trợ: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------------- lưu trữ ---------------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function dataSheet_() {
  var sh = sheet_(SH_DATA, ['type', 'id', 'updatedAt', 'deleted', 'json']);
  sh.hideSheet && false; // giữ hiển thị để người dùng thấy, có thể ẩn tay
  return sh;
}

/** Đọc tất cả bản ghi từ DATA */
function readAll_() {
  var sh = dataSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, 5).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    try { out.push(JSON.parse(r[4])); } catch (e) {}
  }
  return out;
}

/** Ghi đè nếu bản ghi mới hơn. Trả về số bản ghi đã thay đổi */
function upsert_(records) {
  if (!records.length) return 0;
  var sh = dataSheet_();
  var last = sh.getLastRow();
  var index = {}; // id -> {row, updatedAt}
  if (last >= 2) {
    var ids = sh.getRange(2, 2, last - 1, 2).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0]) index[ids[i][0]] = { row: i + 2, updatedAt: String(ids[i][1] || '') };
  }
  var changed = 0;
  var appends = [];
  for (var k = 0; k < records.length; k++) {
    var r = records[k];
    if (!r || !r.id || !r.type) continue;
    var rowVals = [r.type, r.id, r.updatedAt || '', r.deleted ? 'TRUE' : '', JSON.stringify(r)];
    var ex = index[r.id];
    if (ex) {
      if ((r.updatedAt || '') > ex.updatedAt) { sh.getRange(ex.row, 1, 1, 5).setValues([rowVals]); changed++; }
    } else {
      appends.push(rowVals);
      index[r.id] = { row: -1, updatedAt: r.updatedAt || '' };
      changed++;
    }
  }
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, 5).setValues(appends);
  return changed;
}

/* ---------------- tính toán (giống app) ---------------- */
function legacyPreset_(t) {
  return { name: 'Mặc định', tareMode: 'perBag', tareValue: Number(t.tarePerBag) || 0, impurityInput: 'gram',
    impurity: { standard: 0, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] },
    moisture: { standard: Number(t.moistureStd) || 0, method: 'kg', rate: 1, tableUnit: 'kgPct', table: [] } };
}
function applyRule_(rule, measured, gross) {
  if (measured === null || measured === undefined || isNaN(measured)) return { kg: 0, price: 0 };
  var std = Number(rule.standard) || 0;
  var excess = Math.max(0, measured - std);
  if (rule.method === 'kg') return { kg: gross * (excess * (Number(rule.rate) || 0)) / 100, price: 0 };
  if (rule.method === 'price') return { kg: 0, price: excess * (Number(rule.rate) || 0) };
  if (rule.method === 'table') {
    var rows = (rule.table || []).slice().sort(function (a, b) { return a.upTo - b.upTo; });
    if (!rows.length) return { kg: 0, price: 0 };
    var row = null;
    for (var i = 0; i < rows.length; i++) if (measured <= rows[i].upTo) { row = rows[i]; break; }
    if (!row) row = rows[rows.length - 1];
    var v = Number(row.value) || 0;
    return rule.tableUnit === 'price' ? { kg: 0, price: v } : { kg: gross * v / 100, price: 0 };
  }
  return { kg: 0, price: 0 };
}
function truckStats_(t) {
  var bags = 0, gross = 0;
  (t.tables || []).forEach(function (tb) {
    (tb.cells || []).forEach(function (col) {
      col.forEach(function (v) { if (v !== null && v !== undefined && v !== '') { bags++; gross += Number(v) || 0; } });
    });
  });
  var p = t.preset || legacyPreset_(t);
  var sample = t.sample || {};
  var tare = 0;
  if (p.tareMode === 'perBag') tare = bags * (Number(p.tareValue) || 0);
  else if (p.tareMode === 'percent') tare = gross * (Number(p.tareValue) || 0) / 100;
  var impurityPct = null;
  if (p.impurityInput === 'percent') impurityPct = sample.impurityPct != null && sample.impurityPct !== '' ? Number(sample.impurityPct) : null;
  else if (sample.gram && sample.impurityGram != null && sample.impurityGram !== '') impurityPct = Number(sample.impurityGram) / Number(sample.gram) * 100;
  var imp = applyRule_(p.impurity, impurityPct, gross);
  var moisture = sample.moisture != null && sample.moisture !== '' ? Number(sample.moisture) : null;
  var moi = applyRule_(p.moisture, moisture, gross);
  var net = Math.max(0, gross - tare - imp.kg - moi.kg);
  var price = t.price != null && t.price !== '' ? Number(t.price) : null;
  var priceDeduct = imp.price + moi.price;
  var effectivePrice = price != null ? Math.max(0, price - priceDeduct) : null;
  var amount = effectivePrice != null ? net * effectivePrice : null;
  var paid = Number((t.payment && t.payment.paidAmount) || 0);
  return { bags: bags, gross: gross, avg: bags ? gross / bags : 0, impurityPct: impurityPct, impurityKg: imp.kg, impurityPrice: imp.price,
    moisture: moisture, moistureKg: moi.kg, moisturePrice: moi.price, tare: tare, net: net, price: price, priceDeduct: priceDeduct,
    effectivePrice: effectivePrice, amount: amount, paid: paid, remaining: amount != null ? amount - paid : null, presetName: p.name || '' };
}

function fmtTime_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}
function fmtDate_(s) { // YYYY-MM-DD -> dd/MM/yyyy
  if (!s) return '';
  var p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}
function paymentLabel_(s) { return s === 'paid' ? 'Đã thanh toán' : s === 'partial' ? 'Một phần' : 'Chưa thanh toán'; }
function round1_(n) { return Math.round((Number(n) || 0) * 10) / 10; }

/* ---------------- các trang dễ đọc ---------------- */
function rebuildViews_() {
  var all = readAll_();
  var users = {}, drivers = {}, trucks = [], presets = [];
  all.forEach(function (r) {
    if (r.type === 'user') users[r.id] = r;
    else if (r.type === 'driver') drivers[r.id] = r;
    else if (r.type === 'preset') presets.push(r);
    else if (r.type === 'truck' && !r.deleted) trucks.push(r);
  });
  trucks.sort(function (a, b) { return a.date === b.date ? (a.seq || 0) - (b.seq || 0) : (a.date < b.date ? 1 : -1); });
  var uname = function (id) { return (id && users[id] && users[id].name) || ''; };
  var dname = function (id) { return (id && drivers[id] && drivers[id].name) || ''; };

  // Xe
  var hdr = ['Ngày', 'Xe', 'Tên xe', 'Tài xế', 'Nhân viên cân', 'Người tạo', 'Giờ tạo', 'Trạng thái', 'Giờ xong', 'Người xong', 'Bốc hàng',
    'Tổng bao', 'Tổng thô (kg)', 'TB/bao (kg)', 'Quy ước', 'Mẫu (g)', 'Tạp (g)', 'Tạp (%)', 'Trừ tạp (kg)', 'Trừ tạp (đ/kg)', 'Độ (%)', 'Trừ độ (kg)', 'Trừ độ (đ/kg)', 'Trừ bì (kg)',
    'Thực nhận (kg)', 'Giá (đ/kg)', 'Giá sau trừ (đ/kg)', 'Thành tiền (đ)', 'Thanh toán', 'Đã TT (đ)', 'Còn lại (đ)', 'Ghi chú TT', 'Ghi chú', 'Số lần sửa', 'ID'];
  var rows = trucks.map(function (t) {
    var s = truckStats_(t);
    return [fmtDate_(t.date), t.seq, t.name, dname(t.driverId), uname(t.weigherId), t.createdByName || uname(t.createdBy), fmtTime_(t.createdAt),
      t.status === 'done' ? 'Đã xong' : 'Đang cân', fmtTime_(t.doneAt), t.doneByName || uname(t.doneBy), t.loaded ? 'Đã bốc' : 'Chưa bốc',
      s.bags, round1_(s.gross), round1_(s.avg), s.presetName, nz_(t.sample && t.sample.gram), nz_(t.sample && t.sample.impurityGram), s.impurityPct == null ? '' : Math.round(s.impurityPct * 100) / 100, round1_(s.impurityKg), Math.round(s.impurityPrice),
      s.moisture == null ? '' : s.moisture, round1_(s.moistureKg), Math.round(s.moisturePrice), round1_(s.tare),
      round1_(s.net), s.price == null ? '' : s.price, s.effectivePrice == null ? '' : Math.round(s.effectivePrice), s.amount == null ? '' : Math.round(s.amount), paymentLabel_(t.payment && t.payment.status),
      s.paid, s.remaining == null ? '' : Math.round(s.remaining), (t.payment && t.payment.note) || '', t.note || '', (t.history || []).length, t.id];
  });
  writeSheet_('Xe', hdr, rows);

  // Chi tiết cân
  var h2 = ['Ngày', 'Xe', 'Bảng', 'Cột', 'Bao', 'Khối lượng (kg)', 'Nhân viên cân', 'Tài xế', 'ID xe'];
  var r2 = [];
  trucks.forEach(function (t) {
    (t.tables || []).forEach(function (tb) {
      (tb.cells || []).forEach(function (col, ci) {
        col.forEach(function (v, ri) {
          if (v !== null && v !== undefined && v !== '') r2.push([fmtDate_(t.date), t.name, tb.name, ci + 1, ri + 1, Number(v), uname(t.weigherId), dname(t.driverId), t.id]);
        });
      });
    });
  });
  writeSheet_('Chi tiết cân', h2, r2);

  // Lịch sử sửa
  var h3 = ['Thời gian', 'Ngày xe', 'Xe', 'Người sửa', 'Nội dung', 'Giá trị cũ', 'Giá trị mới', 'Loại', 'ID xe'];
  var r3 = [];
  trucks.forEach(function (t) {
    (t.history || []).forEach(function (h) {
      var o = h.old, n = h.new;
      if (/Tài xế/.test(h.what)) { o = dname(o) || o; n = dname(n) || n; }
      if (/Nhân viên/.test(h.what)) { o = uname(o) || o; n = uname(n) || n; }
      r3.push([fmtTime_(h.at), fmtDate_(t.date), t.name, h.byName || uname(h.by), h.what, val_(o), val_(n), h.kind || '', t.id]);
    });
  });
  r3.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; });
  writeSheet_('Lịch sử sửa', h3, r3);

  // Nhân viên, Tài xế
  writeSheet_('Nhân viên', ['Tên', 'Vai trò', 'Trạng thái', 'Tạo lúc', 'ID'], Object.keys(users).map(function (k) { var u = users[k]; return [u.name, u.role === 'admin' ? 'Quản lý' : 'Nhân viên', u.deleted ? 'Đã xoá' : 'Hoạt động', fmtTime_(u.createdAt), u.id]; }));
  writeSheet_('Quy ước', ['Tên', 'Mặc định', 'Nhập tạp', 'Tạp: cách trừ', 'Tạp chuẩn (%)', 'Tạp: mức trừ', 'Tạp: bảng', 'Độ: cách trừ', 'Độ chuẩn (%)', 'Độ: mức trừ', 'Độ: bảng', 'Bì', 'Ghi chú', 'Trạng thái', 'ID'],
    presets.map(function (p) {
      var rt = function (r) { return (r.table || []).map(function (x) { return '≤' + x.upTo + '%: ' + x.value + (r.tableUnit === 'price' ? ' đ/kg' : '% kg'); }).join('; '); };
      return [p.name, p.isDefault ? 'X' : '', p.impurityInput === 'percent' ? '% trực tiếp' : 'gram/mẫu',
        p.impurity.method, p.impurity.standard, p.impurity.rate, rt(p.impurity), p.moisture.method, p.moisture.standard, p.moisture.rate, rt(p.moisture),
        p.tareMode === 'none' ? 'Không' : p.tareValue + (p.tareMode === 'perBag' ? ' kg/bao' : ' %'), p.note || '', p.deleted ? 'Đã xoá' : 'Hoạt động', p.id];
    }));
  writeSheet_('Tài xế', ['Tên', 'Biển số', 'SĐT', 'Trạng thái', 'ID'], Object.keys(drivers).map(function (k) { var d = drivers[k]; return [d.name, d.plate || '', d.phone || '', d.deleted ? 'Đã xoá' : 'Hoạt động', d.id]; }));
}

function nz_(v) { return v === null || v === undefined ? '' : v; }
function val_(v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function writeSheet_(name, headers, rows) {
  var sh = sheet_(name, headers);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), headers.length)).clearContent();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/** Chạy tay trong trình soạn thảo nếu muốn dựng lại các trang từ DATA */
function rebuildNow() { rebuildViews_(); }
