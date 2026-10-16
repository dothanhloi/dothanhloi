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
 * Các trang dễ đọc được dựng lại tối đa 2 phút một lần khi có thay đổi (chạy setupTrigger() một lần
 * để tự dựng lại mỗi 10 phút kể cả khi không ai đồng bộ).
 *
 * Khi sửa file này, phải "Triển khai → Quản lý triển khai → Sửa → Phiên bản mới"
 * thì URL cũ mới chạy mã mới.
 *
 * Các trang (sheet) tự tạo:
 *   DATA          : dữ liệu gốc (type, id, updatedAt, deleted, json chia nhiều ô) – KHÔNG sửa tay
 *   Xe            : mỗi xe một dòng + tổng kết
 *   Chi tiết cân  : từng bao
 *   Lịch sử sửa   : mọi thay đổi (ai, lúc nào, cũ → mới)
 *   Thanh toán    : từng lần trả tiền
 *   Công nợ       : tổng còn nợ theo người bán
 *   Người bán, Giá ngày, Kho, Loại hàng
 *   Xuất bán, Tồn kho, Hedge, Ảnh (link Google Drive, thư mục "Cân Cà Phê - Ảnh")
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
    if (action === 'photo') {
      var url = savePhoto_(body);
      return json_({ ok: true, url: url });
    }
    if (action === 'sync' || action === 'push') {
      var incoming = Array.isArray(body.records) ? body.records : [];
      var serverNow = nextServerNow_();
      // ghi + đọc trong một lượt; chỉ parse JSON những dòng có receivedAt > since (giờ máy chủ nhận)
      var res = upsert_(incoming, serverNow, body.since || '');
      if (res.changed > 0) markDirty_();
      maybeRebuild_();
      return json_({ ok: true, upserted: res.changed, skipped: res.skipped, accepted: res.accepted, serverNow: serverNow, records: res.out });
    }
    if (action === 'rebuild') { rebuildViews_(); return json_({ ok: true }); }
    return json_({ ok: false, error: 'Hành động không hỗ trợ: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------------- ảnh lên Google Drive ---------------- */
var PHOTO_FOLDER = 'Cân Cà Phê - Ảnh';
function photoFolder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  return folder;
}
function savePhoto_(body) {
  if (!body.base64) throw new Error('Thiếu dữ liệu ảnh');
  var folder = photoFolder_();
  var name = String(body.name || (body.id + '.jpg')).replace(/[\\/:*?"<>|]/g, '_');
  // nếu đã có file cùng tên thì dùng lại
  var ex = folder.getFilesByName(name);
  var file = ex.hasNext() ? ex.next() : folder.createFile(Utilities.newBlob(Utilities.base64Decode(body.base64), body.mime || 'image/jpeg', name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

/** Mốc giờ máy chủ tăng nghiêm ngặt (hai lần đồng bộ không bao giờ trùng mốc) */
function nextServerNow_() {
  var props = PropertiesService.getScriptProperties();
  var last = props.getProperty('lastServerNow') || '';
  var now = new Date().toISOString();
  if (now <= last) now = new Date(new Date(last).getTime() + 1).toISOString();
  props.setProperty('lastServerNow', now);
  return now;
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

var CHUNK = 45000;           // Google Sheets giới hạn 50.000 ký tự / ô → chia JSON thành nhiều ô
var JSON_COLS = 4;           // json1..json4 (tối đa ~180k ký tự / bản ghi)
var COL_RECEIVED = 5 + JSON_COLS; // cột receivedAt (giờ máy chủ nhận)
var DATA_COLS = COL_RECEIVED;
var SENTINEL = '~';          // chữ đầu mỗi ô json để Sheets không hiểu nhầm thành công thức (= + -)

function dataSheet_() {
  var headers = ['type', 'id', 'updatedAt', 'deleted', 'json', 'json2', 'json3', 'json4', 'receivedAt'];
  var sh = sheet_(SH_DATA, headers);
  if (sh.getLastColumn() < headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    // cột giờ dạng văn bản để Sheets không tự đổi ISO string thành ngày
    sh.getRange(1, 3, sh.getMaxRows(), 1).setNumberFormat('@');
    sh.getRange(1, COL_RECEIVED, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  return sh;
}
/** Giá trị ô giờ → chuỗi ISO (phòng khi Sheets đã đổi thành Date) */
function isoOf_(v) {
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? '' : String(v);
}

/** Chia JSON thành các ô; null nếu quá lớn */
function splitJson_(str) {
  if (str.length > CHUNK * JSON_COLS) return null;
  var parts = [];
  for (var i = 0; i < str.length; i += CHUNK) parts.push(SENTINEL + str.substring(i, i + CHUNK));
  while (parts.length < JSON_COLS) parts.push('');
  return parts;
}
function joinJson_(row) {
  var json = '';
  for (var c = 4; c < 4 + JSON_COLS; c++) {
    var v = row[c] === null || row[c] === undefined ? '' : String(row[c]);
    if (v.charAt(0) === SENTINEL) v = v.substring(1); // bản cũ không có sentinel
    json += v;
  }
  return json;
}

/** Đọc tất cả bản ghi kèm receivedAt */
function readAllWithMeta_() {
  var sh = dataSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, DATA_COLS).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    try {
      var rec = JSON.parse(joinJson_(r));
      out.push({ rec: rec, receivedAt: isoOf_(r[COL_RECEIVED - 1]) || isoOf_(r[2]) });
    } catch (e) {}
  }
  return out;
}
function readAll_() { return readAllWithMeta_().map(function (x) { return x.rec; }); }

function unionById_(a, b) {
  var m = {}, out = [];
  (a || []).concat(b || []).forEach(function (x) { if (x && x.id && !m[x.id]) { m[x.id] = true; out.push(x); } });
  out.sort(function (x, y) { return (x.at || '') < (y.at || '') ? -1 : 1; });
  return out;
}
function laterThan_(prev) {
  var now = new Date().toISOString();
  var floor = prev ? new Date(new Date(prev).getTime() + 1).toISOString() : '';
  return now > floor ? now : floor;
}
function statusFromHistory_(history) {
  for (var i = history.length - 1; i >= 0; i--) if (history[i] && history[i].what === 'Trạng thái xe') return history[i]['new'] === 'Đã xong' ? 'done' : 'weighing';
  return null;
}
function paymentStatusOf_(t) {
  var s = truckStats_(t);
  if (s.amount === null || s.amount === undefined) return s.paid > 0 ? 'partial' : (t.payment && t.payment.status === 'paid' ? 'paid' : 'unpaid');
  if (s.paid >= Math.round(s.amount) - 1) return 'paid';
  return s.paid > 0 ? 'partial' : 'unpaid';
}
/** Gộp xe (giống merge.ts trong app): mới hơn thắng; thanh toán + lịch sử hợp nhất; "đã xong" và "đã xoá" không bị bản cũ ghi đè */
function mergeTruck_(existing, incoming) {
  var remoteNewer = (incoming.updatedAt || '') > (existing.updatedAt || '');
  var base = remoteNewer ? incoming : existing;
  var other = remoteNewer ? existing : incoming;
  var hasPayArr = Array.isArray(base.payments) || Array.isArray(other.payments);
  var payments = hasPayArr ? unionById_(base.payments, other.payments) : null;
  var history = unionById_(base.history, other.history);
  var payGrew = hasPayArr && payments.length !== (base.payments || []).length;
  var histGrew = history.length !== (base.history || []).length;
  var st = statusFromHistory_(history) || base.status;
  var statusChanged = st !== base.status;
  var deleted = !!(base.deleted || other.deleted);
  var deletedChanged = deleted !== !!base.deleted;
  if (!remoteNewer && !payGrew && !histGrew && !statusChanged && !deletedChanged) return null; // không có gì mới
  if (remoteNewer && !payGrew && !histGrew && !statusChanged && !deletedChanged) return incoming;
  var merged = JSON.parse(JSON.stringify(base));
  merged.history = history;
  if (hasPayArr) {
    merged.payments = payments;
    var paid = 0; payments.forEach(function (x) { paid += Number(x.amount) || 0; });
    merged.payment = merged.payment || {}; merged.payment.paidAmount = paid;
    merged.payment.status = paymentStatusOf_(merged);
  }
  if (statusChanged) {
    var src = st === 'done' ? (base.status === 'done' ? base : (other.status === 'done' ? other : base)) : null;
    if (st === 'done') { merged.status = 'done'; merged.doneAt = src.doneAt; merged.doneBy = src.doneBy; merged.doneByName = src.doneByName; (merged.tables || []).forEach(function (tb) { tb.locked = true; }); }
    else { merged.status = 'weighing'; merged.doneAt = null; merged.doneBy = null; merged.doneByName = ''; (merged.tables || []).forEach(function (tb) { tb.locked = false; }); }
  }
  if (deleted) merged.deleted = true;
  merged.updatedAt = laterThan_(base.updatedAt);
  return merged;
}
/** Bản ghi thường: mới hơn thắng, "đã xoá" là dính */
function mergeSimple_(existing, incoming) {
  var remoteNewer = (incoming.updatedAt || '') > (existing.updatedAt || '');
  var base = remoteNewer ? incoming : existing;
  var deleted = !!(existing.deleted || incoming.deleted);
  if (deleted && !base.deleted) { var m = JSON.parse(JSON.stringify(base)); m.deleted = true; m.updatedAt = laterThan_(base.updatedAt); return m; }
  return remoteNewer ? incoming : null;
}

/**
 * Ghi bản ghi gửi lên (xe: gộp; khác: mới hơn thắng, "đã xoá" dính), rồi trả về các bản ghi có receivedAt > since.
 * Bản ghi máy gửi lên mà máy chủ lưu nguyên vẹn thì không gửi lại (máy đã có).
 */
function upsert_(records, serverNow, since) {
  var result = { changed: 0, skipped: [], accepted: [], out: [] };
  // cùng id xuất hiện nhiều lần trong một lần gửi → lấy bản cuối
  var byId = {}; records.forEach(function (r) { if (r && r.id && r.type) byId[r.id] = r; });
  records = Object.keys(byId).map(function (k) { return byId[k]; });
  var sh = dataSheet_();
  var last = sh.getLastRow();
  var rows = last >= 2 ? sh.getRange(2, 1, last - 1, DATA_COLS).getValues() : [];
  var index = {}; // id -> chỉ số trong rows
  for (var i = 0; i < rows.length; i++) if (rows[i][1]) index[rows[i][1]] = i;
  var updated = {};  // chỉ số dòng đã sửa
  var echo = {};     // id máy gửi lên, lưu nguyên vẹn → không trả lại
  var force = {};    // id máy gửi bản cũ hơn bản máy chủ → luôn trả bản máy chủ về
  var appends = [];
  for (var k = 0; k < records.length; k++) {
    var r = records[k];
    var idx = index[r.id];
    var toWrite = null;
    if (idx !== undefined) {
      var existing = null;
      try { existing = JSON.parse(joinJson_(rows[idx])); } catch (e) {}
      if (!existing) toWrite = r;
      else if (r.type === 'truck') toWrite = mergeTruck_(existing, r);
      else toWrite = mergeSimple_(existing, r);
    } else toWrite = r;
    if (!toWrite) { result.accepted.push(r.id); force[r.id] = true; continue; } // máy chủ đã có bản mới hơn/khác → trả lại cho máy
    var parts = splitJson_(JSON.stringify(toWrite));
    if (!parts) { result.skipped.push(r.id); continue; }
    var rowVals = [toWrite.type, toWrite.id, toWrite.updatedAt || '', toWrite.deleted ? 'TRUE' : ''].concat(parts).concat([serverNow]);
    if (idx !== undefined) { rows[idx] = rowVals; updated[idx] = true; }
    else { index[r.id] = rows.length; rows.push(rowVals); appends.push(rowVals); }
    if (toWrite === r) echo[r.id] = true; // lưu đúng bản máy gửi → máy đã có
    result.accepted.push(r.id);
    result.changed++;
  }
  // ghi: ít dòng sửa → ghi từng dòng; nhiều → ghi lại cả vùng một lần
  var updatedIdx = Object.keys(updated);
  if (updatedIdx.length > 10) {
    var n = rows.length - appends.length;
    if (n > 0) sh.getRange(2, 1, n, DATA_COLS).setValues(rows.slice(0, n));
  } else {
    for (var u = 0; u < updatedIdx.length; u++) { var ri = Number(updatedIdx[u]); sh.getRange(ri + 2, 1, 1, DATA_COLS).setValues([rows[ri]]); }
  }
  if (appends.length) sh.getRange(last + 1 > 1 ? last + 1 : 2, 1, appends.length, DATA_COLS).setValues(appends);
  // trả về bản ghi máy chưa có
  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    if (!row[1] || echo[row[1]]) continue;
    var receivedAt = isoOf_(row[COL_RECEIVED - 1]) || isoOf_(row[2]);
    if (since && !force[row[1]] && !(receivedAt > since)) continue;
    try { result.out.push(JSON.parse(joinJson_(row))); } catch (e) {}
  }
  return result;
}

/* ---------------- dựng lại các trang dễ đọc có tiết chế ---------------- */
var REBUILD_EVERY_MS = 2 * 60 * 1000;
function markDirty_() { PropertiesService.getScriptProperties().setProperty('dirty', '1'); }
function hasRebuildTrigger_() {
  try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'rebuildIfDirty'; }); } catch (e) { return false; }
}
function maybeRebuild_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('dirty') !== '1') return;
  if (hasRebuildTrigger_()) return; // đã có trigger 10 phút: không dựng lại trong lúc đồng bộ (giữ khoá ngắn)
  var last = Number(props.getProperty('lastRebuild') || 0);
  if (Date.now() - last < REBUILD_EVERY_MS) return;
  try { rebuildViews_(); props.setProperty('lastRebuild', String(Date.now())); props.deleteProperty('dirty'); } catch (e) { Logger.log('rebuild: ' + e); }
}
/** Chạy tay một lần để tạo trigger dựng lại các trang mỗi 10 phút (khi có thay đổi) */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'rebuildIfDirty') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rebuildIfDirty').timeBased().everyMinutes(10).create();
}
function rebuildIfDirty() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); var props = PropertiesService.getScriptProperties(); if (props.getProperty('dirty') === '1') { rebuildViews_(); props.setProperty('lastRebuild', String(Date.now())); props.deleteProperty('dirty'); } }
  finally { try { lock.releaseLock(); } catch (e) {} }
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
  if ((t.weighMode || 'bags') === 'truck') {
    var w = t.truckWeigh || {};
    gross = w.grossIn != null && w.tareOut != null && w.grossIn !== '' && w.tareOut !== '' ? Math.max(0, Number(w.grossIn) - Number(w.tareOut)) : 0;
    bags = Number(w.bags) || 0;
  } else {
    (t.tables || []).forEach(function (tb) {
      (tb.cells || []).forEach(function (col) {
        col.forEach(function (v) { if (v !== null && v !== undefined && v !== '') { bags++; gross += Number(v) || 0; } });
      });
    });
  }
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
  var paid = Array.isArray(t.payments) ? t.payments.reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0) : Number((t.payment && t.payment.paidAmount) || 0);
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
  var users = {}, drivers = {}, sellers = {}, warehouses = {}, products = {}, trucks = [], presets = [], dayPrices = [], sales = [], hedges = [], photos = [];
  all.forEach(function (r) {
    if (r.type === 'user') users[r.id] = r;
    else if (r.type === 'driver') drivers[r.id] = r;
    else if (r.type === 'seller') sellers[r.id] = r;
    else if (r.type === 'warehouse') warehouses[r.id] = r;
    else if (r.type === 'product') products[r.id] = r;
    else if (r.type === 'dayprice') dayPrices.push(r);
    else if (r.type === 'sale' && !r.deleted) sales.push(r);
    else if (r.type === 'hedge' && !r.deleted) hedges.push(r);
    else if (r.type === 'photo' && !r.deleted) photos.push(r);
    else if (r.type === 'preset') presets.push(r);
    else if (r.type === 'truck' && !r.deleted) trucks.push(r);
  });
  trucks.sort(function (a, b) { return a.date === b.date ? (a.seq || 0) - (b.seq || 0) : (a.date < b.date ? 1 : -1); });
  var uname = function (id) { return (id && users[id] && users[id].name) || ''; };
  var dname = function (id) { return (id && drivers[id] && drivers[id].name) || ''; };
  var sname = function (id) { return (id && sellers[id] && sellers[id].name) || ''; };
  var wname = function (id) { return (id && warehouses[id] && warehouses[id].name) || ''; };
  var pname = function (id) { return (id && products[id] && products[id].name) || ''; };
  var truckById = {};
  trucks.forEach(function (t) { truckById[t.id] = t; });

  // Xe
  var hdr = ['Ngày', 'Xe', 'Tên xe', 'Người bán', 'Loại hàng', 'Kho', 'Kiểu cân', 'Tài xế', 'Nhân viên cân', 'Người tạo', 'Giờ tạo', 'Trạng thái', 'Giờ xong', 'Người xong', 'Bốc hàng',
    'Tổng bao', 'Tổng thô (kg)', 'TB/bao (kg)', 'Quy ước', 'Mẫu (g)', 'Tạp (g)', 'Tạp (%)', 'Trừ tạp (kg)', 'Trừ tạp (đ/kg)', 'Độ (%)', 'Trừ độ (kg)', 'Trừ độ (đ/kg)', 'Trừ bì (kg)',
    'Thực nhận (kg)', 'Giá (đ/kg)', 'Giá sau trừ (đ/kg)', 'Thành tiền (đ)', 'Thanh toán', 'Đã TT (đ)', 'Còn lại (đ)', 'Ghi chú TT', 'Ghi chú', 'Số lần sửa', 'ID'];
  var rows = trucks.map(function (t) {
    var s = truckStats_(t);
    return [fmtDate_(t.date), t.seq, t.name, sname(t.sellerId), pname(t.productId), wname(t.warehouseId), (t.weighMode || 'bags') === 'truck' ? 'Xe tải' : 'Từng bao', dname(t.driverId), uname(t.weigherId), t.createdByName || uname(t.createdBy), fmtTime_(t.createdAt),
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
    if ((t.weighMode || 'bags') === 'truck') return;
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
  writeSheet_('Nhân viên', ['Tên', 'Vai trò', 'PIN', 'Trạng thái', 'Tạo lúc', 'ID'], Object.keys(users).map(function (k) { var u = users[k]; return [u.name, u.role === 'admin' ? 'Quản lý' : 'Nhân viên', u.pinHash ? 'đã mã hoá' : 'chưa mã hoá', u.deleted ? 'Đã xoá' : 'Hoạt động', fmtTime_(u.createdAt), u.id]; }));
  // Thanh toán
  var h4 = ['Thời gian', 'Ngày xe', 'Xe', 'Người bán', 'Số tiền (đ)', 'Hình thức', 'Người ghi', 'Ghi chú', 'ID xe'];
  var r4 = [];
  trucks.forEach(function (t) {
    (Array.isArray(t.payments) ? t.payments : []).forEach(function (p) {
      r4.push([fmtTime_(p.at), fmtDate_(t.date), t.name, sname(t.sellerId), Number(p.amount) || 0, p.method === 'cash' ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Khác', p.byName || uname(p.by), p.note || '', t.id]);
    });
  });
  r4.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; });
  writeSheet_('Thanh toán', h4, r4);

  // Công nợ theo người bán
  var debt = {};
  trucks.forEach(function (t) {
    var s = truckStats_(t);
    var k = t.sellerId || '';
    var d = debt[k] || (debt[k] = { name: k ? (sname(k) || 'Người bán đã xoá') : 'Chưa gán người bán', trucks: 0, kg: 0, amount: 0, paid: 0 });
    d.trucks++; d.kg += s.net; d.amount += s.amount || 0; d.paid += s.paid;
  });
  var r5 = Object.keys(debt).map(function (k) { var d = debt[k]; return [d.name, d.trucks, round1_(d.kg), Math.round(d.amount), Math.round(d.paid), Math.round(d.amount - d.paid), k]; });
  r5.sort(function (a, b) { return b[5] - a[5]; });
  writeSheet_('Công nợ', ['Người bán', 'Số xe', 'Thực nhận (kg)', 'Thành tiền (đ)', 'Đã trả (đ)', 'Còn nợ (đ)', 'ID'], r5);

  writeSheet_('Người bán', ['Tên', 'SĐT', 'Địa chỉ', 'Ghi chú', 'Trạng thái', 'ID'], Object.keys(sellers).map(function (k) { var x = sellers[k]; return [x.name, x.phone || '', x.address || '', x.note || '', x.deleted ? 'Đã xoá' : 'Hoạt động', x.id]; }));
  dayPrices.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  writeSheet_('Giá ngày', ['Ngày', 'Giá (đ/kg)', 'Ghi chú', 'Người nhập', 'Cập nhật'], dayPrices.filter(function (x) { return !x.deleted; }).map(function (x) { return [fmtDate_(x.date), x.price == null ? '' : x.price, x.note || '', x.byName || '', fmtTime_(x.updatedAt)]; }));

  // Xuất bán, tồn kho, hedge, ảnh, kho, loại hàng
  sales.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  writeSheet_('Xuất bán', ['Ngày', 'Kho', 'Loại hàng', 'Số kg', 'Giá bán (đ/kg)', 'Thành tiền (đ)', 'Người mua', 'Ghi chú', 'Người ghi', 'ID'],
    sales.map(function (x) { return [fmtDate_(x.date), wname(x.warehouseId), pname(x.productId), x.kg, x.price == null ? '' : x.price, x.price == null ? '' : Math.round(x.kg * x.price), x.buyer || '', x.note || '', x.byName || '', x.id]; }));
  var stock = {};
  trucks.forEach(function (t) { var k = t.warehouseId || ''; var r = stock[k] || (stock[k] = { name: k ? (wname(k) || 'Kho đã xoá') : 'Chưa gán kho', inKg: 0, outKg: 0 }); r.inKg += truckStats_(t).net; });
  sales.forEach(function (x) { var k = x.warehouseId || ''; var r = stock[k] || (stock[k] = { name: k ? (wname(k) || 'Kho đã xoá') : 'Chưa gán kho', inKg: 0, outKg: 0 }); r.outKg += Number(x.kg) || 0; });
  writeSheet_('Tồn kho', ['Kho', 'Đã nhập (kg)', 'Đã xuất (kg)', 'Tồn (kg)'], Object.keys(stock).map(function (k) { var r = stock[k]; return [r.name, round1_(r.inKg), round1_(r.outKg), round1_(r.inKg - r.outKg)]; }));
  hedges.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  writeSheet_('Hedge', ['Ngày', 'Lệnh', 'Số lot', 'Tấn/lot', 'Tấn', 'Giá (USD/tấn)', 'Ghi chú', 'Người ghi'],
    hedges.map(function (h) { return [fmtDate_(h.date), h.lots > 0 ? 'Bán' : 'Mua lại', Math.abs(h.lots), h.tonsPerLot, h.lots * h.tonsPerLot, h.price == null ? '' : h.price, h.note || '', h.byName || '']; }));
  photos.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  writeSheet_('Ảnh', ['Thời gian', 'Ngày xe', 'Xe', 'Người bán', 'Loại ảnh', 'Link Drive', 'Người chụp', 'Ghi chú'],
    photos.map(function (p) { var t = truckById[p.truckId] || {}; return [fmtTime_(p.createdAt), fmtDate_(t.date), t.name || '', sname(t.sellerId), p.kind, p.driveUrl || '(chưa tải lên)', p.byName || '', p.note || '']; }));
  writeSheet_('Kho', ['Tên', 'Ghi chú', 'Trạng thái', 'ID'], Object.keys(warehouses).map(function (k) { var x = warehouses[k]; return [x.name, x.note || '', x.deleted ? 'Đã xoá' : 'Hoạt động', x.id]; }));
  writeSheet_('Loại hàng', ['Tên', 'Quy ước', 'Ghi chú', 'Trạng thái', 'ID'], Object.keys(products).map(function (k) { var x = products[k]; var pr = presets.filter(function (p) { return p.id === x.presetId; })[0]; return [x.name, pr ? pr.name : '', x.note || '', x.deleted ? 'Đã xoá' : 'Hoạt động', x.id]; }));

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

/** Chạy tay trong trình soạn thảo nếu muốn dựng lại các trang từ DATA ngay */
function rebuildNow() { rebuildViews_(); PropertiesService.getScriptProperties().deleteProperty('dirty'); }
