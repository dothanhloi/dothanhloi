export const COLS = 5;
export const ROWS = 5;

export function fmtKg(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(Number(n))) return '';
  const v = Number(n);
  return Number.isInteger(v) && digits <= 1 ? String(v) : v.toFixed(digits);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('vi-VN') + ' đ';
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits) + '%';
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export function fmtDateVN(s: string): string {
  const d = parseDate(s);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtWeekday(s: string): string {
  return WEEKDAYS[parseDate(s).getDay()];
}

export function fmtDateShort(s: string): string {
  const d = parseDate(s);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Chuyển chuỗi nhập (có thể dùng dấu phẩy) thành số, null nếu rỗng, NaN nếu sai */
export function parseNum(s: string): number | null {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return isNaN(v) ? NaN : v;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || '';
  return last.charAt(0).toUpperCase() || '?';
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function nowIso(): string {
  return new Date().toISOString();
}
