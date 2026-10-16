export type ToastKind = 'info' | 'ok' | 'err';
export interface ToastMsg { id: number; text: string; kind: ToastKind }
type L = (m: ToastMsg | null) => void;
const ls = new Set<L>();
let n = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export function toast(text: string, kind: ToastKind = 'info', ms = 1800) {
  const m = { id: ++n, text, kind };
  ls.forEach((f) => f(m));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => ls.forEach((f) => f(null)), ms);
}
export function onToast(f: L) { ls.add(f); return () => { ls.delete(f); }; }
