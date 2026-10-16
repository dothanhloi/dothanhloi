import { Directory, File, Paths } from 'expo-file-system';
import { nowIso, todayStr } from './format';
import { Store, useStore } from './store';
import type { SyncRecord } from './types';

const BUCKETS = ['users', 'drivers', 'presets', 'sellers', 'dayPrices', 'warehouses', 'products', 'sales', 'hedges', 'photos', 'configs', 'trucks'] as const;

export function exportPayload(s: Store): Record<string, unknown> {
  const out: Record<string, unknown> = { exportedAt: nowIso(), version: 2 };
  for (const k of BUCKETS) out[k] = (s as any)[k] || {};
  return out;
}

export function recordsFromPayload(data: any): SyncRecord[] {
  const recs: SyncRecord[] = [];
  for (const k of BUCKETS) for (const r of Object.values(data?.[k] || {})) recs.push(r as SyncRecord);
  return recs;
}

function backupDir(): Directory {
  const d = new Directory(Paths.document, 'backups');
  try { if (!d.exists) d.create(); } catch {}
  return d;
}

/** Sao lưu vào thư mục app (giữ 7 bản). force = true để chạy ngay */
export async function runAutoBackup(force = false): Promise<string | null> {
  const st = useStore.getState();
  const last = st.settings.lastBackup;
  if (!force && last && Date.now() - new Date(last).getTime() < 20 * 3600 * 1000) return null;
  try {
    const dir = backupDir();
    const file = new File(dir, `cancaphe-${todayStr()}.json`);
    await file.write(JSON.stringify(exportPayload(st)));
    st.setSettings({ lastBackup: nowIso() });
    // giữ 7 bản gần nhất
    const files = dir.list().filter((f) => f instanceof File && f.name.endsWith('.json')).map((f) => f as File).sort((a, b) => a.name.localeCompare(b.name));
    while (files.length > 7) { const f = files.shift()!; try { f.delete(); } catch {} }
    return file.name;
  } catch (e) {
    console.warn('backup', e);
    return null;
  }
}

export function listBackups(): File[] {
  try { return backupDir().list().filter((f) => f instanceof File).map((f) => f as File).sort((a, b) => b.name.localeCompare(a.name)); } catch { return []; }
}
