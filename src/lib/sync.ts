import { nowIso } from './format';
import { allRecords, recordsSince, useStore } from './store';
import { photoBase64 } from './photos';
import type { SyncRecord } from './types';

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'off';
export interface SyncStatus { state: SyncState; message: string; at: string | null }

type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();
let status: SyncStatus = { state: 'idle', message: '', at: null };
let timer: ReturnType<typeof setTimeout> | null = null;
let busy = false;

function emit(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((fn) => fn(status));
}
export function getSyncStatus() { return status; }
export function onSyncStatus(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function url() { return (useStore.getState().settings.sheetUrl || '').trim(); }
export function syncEnabled() { return !!url(); }

async function request(u: string, payload: unknown) {
  const res = await fetch(u, {
    method: 'POST',
    // không đặt Content-Type JSON → Apps Script nhận "simple request", không cần preflight CORS
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    throw new Error('Phản hồi không phải JSON. Kiểm tra link Apps Script (phải triển khai dạng Web App, quyền "Anyone").');
  }
  if (!data.ok) throw new Error(data.error || 'Lỗi không xác định từ Google Sheets');
  return data as { ok: true; records: SyncRecord[]; serverNow?: string; skipped?: string[] };
}

export async function syncNow(opts: { full?: boolean } = {}) {
  const u = url();
  if (!u) { emit({ state: 'off', message: 'Chưa liên kết Google Sheets' }); return { ok: false as const, off: true }; }
  if (busy) return { ok: false as const, busy: true };
  busy = true;
  emit({ state: 'syncing', message: 'Đang đồng bộ...' });
  try {
    const st = useStore.getState();
    const records = opts.full ? allRecords(st) : recordsSince(st, st.settings.lastPush);
    const pushedAt = nowIso();
    const data = await request(u, { action: 'sync', records, since: opts.full ? null : st.settings.lastSync });
    const changed = useStore.getState().mergeRecords(data.records || []);
    // lastSync dùng giờ máy chủ (receivedAt) để không bỏ sót bản ghi máy khác gửi muộn
    useStore.getState().setSettings({ lastPush: pushedAt, lastSync: data.serverNow || nowIso() });
    if (data.skipped?.length) console.warn('Máy chủ bỏ qua bản ghi quá lớn:', data.skipped);
    const uploaded = await uploadPendingPhotos(u);
    emit({ state: 'ok', at: nowIso(), message: `Đã đồng bộ (${records.length} gửi, ${changed} nhận${uploaded ? `, ${uploaded} ảnh` : ''})` });
    return { ok: true as const, pushed: records.length, received: changed };
  } catch (e: any) {
    const message = e?.message || String(e);
    emit({ state: 'error', message });
    return { ok: false as const, error: message };
  } finally {
    busy = false;
  }
}

/** Tải các ảnh chưa có link Drive lên Google Drive (qua Apps Script), tối đa 5 ảnh mỗi lần */
async function uploadPendingPhotos(u: string): Promise<number> {
  const st = useStore.getState();
  const pending = Object.values(st.photos || {}).filter((p) => !p.deleted && !p.driveUrl && p.localUri).slice(0, 5);
  let n = 0;
  for (const p of pending) {
    try {
      const b64 = await photoBase64(p);
      if (!b64) continue;
      const t = st.trucks[p.truckId];
      const name = `${t ? t.date + '_' + t.name.replace(/\s+/g, '') : 'xe'}_${p.kind}_${p.id}.jpg`;
      const res = await fetch(u, { method: 'POST', body: JSON.stringify({ action: 'photo', id: p.id, name, mime: 'image/jpeg', base64: b64 }), redirect: 'follow' });
      const data = JSON.parse(await res.text());
      if (data.ok && data.url) { useStore.getState().updatePhoto(p.id, { driveUrl: data.url }); n++; }
    } catch (e) { console.warn('upload photo', e); }
  }
  if (n) { useStore.getState().setSettings({ lastPush: null }); } // đẩy lại bản ghi ảnh đã có link ở lần sau
  return n;
}

/** Gọi sau mỗi lần thay đổi dữ liệu: tự đồng bộ sau 3 giây nếu bật */
export function scheduleSync() {
  const st = useStore.getState();
  if (!st.settings.sheetUrl || !st.settings.autoSync) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { syncNow(); }, 3000);
}

export async function testSheetUrl(u: string) {
  const res = await fetch(u.trim() + (u.includes('?') ? '&' : '?') + 'action=ping', { redirect: 'follow' });
  const data = JSON.parse(await res.text());
  if (!data.ok) throw new Error(data.error || 'Không kết nối được');
  return data as { ok: true; sheet: string; version: string };
}
