import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appStorage } from './storage';
import { laterThan, mergeSimple, mergeTruck } from './merge';
import { PRESET_TEMPLATES, tableStats, truckStats } from './calc';
import { COLS, ROWS, nowIso, uid } from './format';
import type { DayPrice, Driver, Hedge, HistoryKind, Payment, PaymentMethod, Photo, PresetSnapshot, Product, QualityPreset, Sale, Seller, Settings, SyncRecord, TeamConfig, Truck, User, Warehouse, WeighTable } from './types';
import { hashPin } from './security';

export interface State {
  users: Record<string, User>;
  drivers: Record<string, Driver>;
  trucks: Record<string, Truck>;
  presets: Record<string, QualityPreset>;
  sellers: Record<string, Seller>;
  dayPrices: Record<string, DayPrice>;
  warehouses: Record<string, Warehouse>;
  products: Record<string, Product>;
  sales: Record<string, Sale>;
  hedges: Record<string, Hedge>;
  photos: Record<string, Photo>;
  configs: Record<string, TeamConfig>;
  session: { userId: string | null };
  settings: Settings;
  hydrated: boolean;
  /** id bản ghi đã đổi trên máy này, chờ đẩy lên máy chủ (không phụ thuộc đồng hồ) */
  pending: Record<string, true>;
}

export interface Actions {
  setHydrated: (v: boolean) => void;
  // users
  addUser: (d: { name: string; pin: string; role?: User['role'] }) => Promise<User>;
  setUserPin: (id: string, pin: string) => Promise<void>;
  updateUser: (id: string, patch: Partial<User>) => void;
  removeUser: (id: string) => void;
  login: (id: string, pin: string) => Promise<boolean>;
  migratePins: () => Promise<void>;
  logout: () => void;
  // drivers
  addDriver: (d: { name: string; phone?: string; plate?: string }) => Driver;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  removeDriver: (id: string) => void;
  // trucks
  createTruck: (d: { date: string; driverId: string | null; sellerId?: string | null; weigherId: string | null; note?: string; warehouseId?: string | null; productId?: string | null; weighMode?: 'bags' | 'truck' }) => Truck;
  removeTruck: (id: string) => void;
  setCell: (truckId: string, tableIdx: number, col: number, row: number, value: number | null) => boolean;
  setField: (truckId: string, what: string, path: string[], value: unknown, kind?: HistoryKind) => boolean;
  patchTruck: (truckId: string, patch: Partial<Truck>, log?: { what: string; old?: unknown; new?: unknown; kind?: HistoryKind }) => void;
  markDone: (truckId: string, done: boolean) => void;
  setLoaded: (truckId: string, loaded: boolean) => void;
  setTableLocked: (truckId: string, tableIdx: number, locked: boolean) => void;
  lockAllTables: (truckId: string, locked: boolean) => void;
  addTable: (truckId: string) => void;
  removeLastTable: (truckId: string) => boolean;
  // catalog: kho, loại hàng
  addWarehouse: (d: { name: string; note?: string }) => Warehouse;
  updateWarehouse: (id: string, patch: Partial<Warehouse>) => void;
  removeWarehouse: (id: string) => void;
  addProduct: (d: { name: string; presetId?: string | null; note?: string }) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  // xuất bán, hedge
  addSale: (d: { date: string; warehouseId: string | null; productId: string | null; kg: number; price: number | null; buyer?: string; note?: string }) => Sale;
  updateSale: (id: string, patch: Partial<Sale>) => void;
  removeSale: (id: string) => void;
  addHedge: (d: { date: string; lots: number; tonsPerLot: number; price: number | null; note?: string }) => Hedge;
  removeHedge: (id: string) => void;
  // ảnh
  addPhoto: (d: { truckId: string; kind: Photo['kind']; localUri: string; note?: string }) => Photo;
  updatePhoto: (id: string, patch: Partial<Photo>) => void;
  removePhoto: (id: string) => void;
  // cân xe tải
  setWeighMode: (truckId: string, mode: 'bags' | 'truck') => void;
  // sellers (người bán)
  addSeller: (d: { name: string; phone?: string; address?: string; note?: string }) => Seller;
  updateSeller: (id: string, patch: Partial<Seller>) => void;
  removeSeller: (id: string) => void;
  // payments (sổ thanh toán)
  addPayment: (truckId: string, d: { amount: number; method: PaymentMethod; note?: string; at?: string }) => void;
  removePayment: (truckId: string, paymentId: string) => void;
  // day prices (giá tham chiếu theo ngày)
  setDayPrice: (date: string, price: number | null, note?: string) => void;
  // presets (quy ước tạp độ)
  addPreset: (d: Omit<QualityPreset, 'id' | 'type' | 'createdAt' | 'updatedAt'>) => QualityPreset;
  updatePreset: (id: string, patch: Partial<QualityPreset>) => void;
  removePreset: (id: string) => void;
  setDefaultPreset: (id: string) => void;
  ensureDefaultPreset: () => void;
  applyPreset: (truckId: string, presetId: string) => void;
  // settings
  setSettings: (patch: Partial<Settings>) => void;
  setTeamConfig: (patch: Partial<Omit<TeamConfig, 'id' | 'type' | 'updatedAt'>>) => void;
  // sync
  mergeRecords: (records: SyncRecord[], opts?: { markPending?: boolean }) => number;
  markPending: (ids: string[]) => void;
  clearPending: (ids: string[]) => void;
  resetAll: () => void;
}

export type Store = State & Actions;

const defaultSettings = (): Settings => ({
  sheetUrl: '',
  autoSync: true,
  lastSync: null,
  lastPush: null,
  moistureStd: 13,
  tarePerBag: 0,
  tablesPerTruck: 2,
});

function emptyCells(): (number | null)[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null));
}
function newTable(index: number): WeighTable {
  return { id: uid(), name: 'BẢNG ' + index, locked: false, cells: emptyCells() };
}

/** Tạo bản sao nông của record + updatedAt */
function bump<T extends { updatedAt: string }>(r: T, patch: Partial<T> = {}): T {
  return { ...r, ...patch, updatedAt: laterThan(r.updatedAt) };
}

/** true trong lúc mergeRecords áp dữ liệu máy chủ → không đánh dấu chờ đẩy */
let applyingRemote = false;
export const BUCKETS = ['users', 'drivers', 'trucks', 'presets', 'sellers', 'dayPrices', 'warehouses', 'products', 'sales', 'hedges', 'photos', 'configs'] as const;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      users: {},
      drivers: {},
      trucks: {},
      presets: {},
      sellers: {},
      dayPrices: {},
      warehouses: {},
      products: {},
      sales: {},
      hedges: {},
      photos: {},
      configs: {},
      session: { userId: null },
      settings: defaultSettings(),
      hydrated: false,
      pending: {},

      setHydrated: (v) => set({ hydrated: v }),

      /* ---------- users ---------- */
      addUser: async ({ name, pin, role }) => {
        const pinHash = await hashPin(String(pin));
        const u: User = { id: uid(), type: 'user', name: name.trim(), pin: '', pinHash, role: role || 'staff', createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ users: { ...s.users, [u.id]: u } }));
        return u;
      },
      setUserPin: async (id, pin) => {
        const pinHash = await hashPin(String(pin));
        get().updateUser(id, { pin: '', pinHash });
      },
      migratePins: async () => {
        const list = Object.values(get().users).filter((u) => !u.deleted && !u.pinHash && u.pin);
        for (const u of list) {
          const pinHash = await hashPin(String(u.pin));
          get().updateUser(u.id, { pin: '', pinHash });
        }
      },
      updateUser: (id, patch) =>
        set((s) => (s.users[id] ? { users: { ...s.users, [id]: bump(s.users[id], patch) } } : {})),
      removeUser: (id) =>
        set((s) => {
          if (!s.users[id]) return {};
          return {
            users: { ...s.users, [id]: bump(s.users[id], { deleted: true }) },
            session: s.session.userId === id ? { userId: null } : s.session,
          };
        }),
      login: async (id, pin) => {
        const u = get().users[id];
        if (!u || u.deleted) return false;
        let ok = false;
        if (u.pinHash) ok = (await hashPin(String(pin))) === u.pinHash;
        else ok = String(u.pin) === String(pin);
        if (!ok) return false;
        set({ session: { userId: id } });
        return true;
      },
      logout: () => set({ session: { userId: null } }),

      /* ---------- drivers ---------- */
      addDriver: ({ name, phone, plate }) => {
        const d: Driver = { id: uid(), type: 'driver', name: name.trim(), phone: (phone || '').trim(), plate: (plate || '').trim(), createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ drivers: { ...s.drivers, [d.id]: d } }));
        return d;
      },
      updateDriver: (id, patch) =>
        set((s) => (s.drivers[id] ? { drivers: { ...s.drivers, [id]: bump(s.drivers[id], patch) } } : {})),
      removeDriver: (id) =>
        set((s) => (s.drivers[id] ? { drivers: { ...s.drivers, [id]: bump(s.drivers[id], { deleted: true }) } } : {})),

      /* ---------- trucks ---------- */
      createTruck: ({ date, driverId, sellerId, weigherId, note, warehouseId, productId, weighMode }) => {
        const s = get();
        const user = s.users[s.session.userId || ''] || null;
        // kể cả xe đã xoá để số thứ tự không trùng
        const seq = Object.values(s.trucks).filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.seq || 0), 0) + 1;
        const n = Math.max(1, Number(teamConfigOf(s).tablesPerTruck) || 2);
        const tables: WeighTable[] = [];
        for (let i = 1; i <= n; i++) tables.push(newTable(i));
        const prod = productId ? s.products[productId] : null;
        const dp = (prod?.presetId && s.presets[prod.presetId] && !s.presets[prod.presetId].deleted ? s.presets[prod.presetId] : null) || defaultPresetOf(s);
        const dayPrice = s.dayPrices['dp-' + date];
        const price0 = dayPrice && !dayPrice.deleted && dayPrice.price != null ? Number(dayPrice.price) : null;
        const t: Truck = {
          id: uid(), type: 'truck', date, seq, name: 'Xe ' + seq,
          driverId: driverId || null,
          sellerId: sellerId || null,
          warehouseId: warehouseId || null,
          productId: productId || null,
          weighMode: weighMode || 'bags',
          truckWeigh: { grossIn: null, tareOut: null, bags: null },
          weigherId: weigherId || (user ? user.id : null),
          createdAt: nowIso(), createdBy: user ? user.id : null, createdByName: user ? user.name : '',
          updatedAt: nowIso(),
          status: 'weighing', doneAt: null, doneBy: null, doneByName: '',
          loaded: false, loadedAt: null, loadedBy: null,
          tables,
          sample: { gram: null, impurityGram: null, impurityPct: null, moisture: null },
          price: price0,
          tarePerBag: Number(s.settings.tarePerBag) || 0,
          moistureStd: Number(s.settings.moistureStd) || 0,
          preset: dp ? snapshotOf(dp) : null,
          payment: { status: 'unpaid', paidAmount: 0, note: '' },
          payments: [],
          note: note || '',
          history: price0 != null ? [{ id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?', what: 'Giá (theo giá ngày)', old: null, new: price0, kind: 'field' }] : [],
        };
        set({ trucks: { ...s.trucks, [t.id]: t } });
        return t;
      },
      removeTruck: (id) =>
        set((s) => (s.trucks[id] ? { trucks: { ...s.trucks, [id]: bump(s.trucks[id], { deleted: true }) } } : {})),

      setCell: (truckId, tableIdx, col, row, value) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return false;
        const tb = t.tables[tableIdx];
        if (!tb) return false;
        const old = tb.cells[col][row];
        if (old === value) return false;
        const user = s.users[s.session.userId || ''];
        const cells = tb.cells.map((c, ci) => (ci === col ? c.map((v, ri) => (ri === row ? value : v)) : c));
        const tables = t.tables.map((x, i) => (i === tableIdx ? { ...x, cells } : x));
        const history = [...t.history, {
          id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?',
          what: `${tb.name} · Cột ${col + 1} · Bao ${row + 1}`, old, new: value, kind: 'cell' as HistoryKind,
        }];
        set({ trucks: { ...s.trucks, [truckId]: bump(t, { tables, history }) } });
        return true;
      },

      setField: (truckId, what, path, value, kind = 'field') => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return false;
        // đọc giá trị cũ
        let cur: any = t;
        for (const k of path) cur = cur?.[k];
        if (cur === value) return false;
        // ghi theo kiểu immutable
        const next: any = { ...t };
        let o = next;
        for (let i = 0; i < path.length - 1; i++) {
          o[path[i]] = { ...(o[path[i]] || {}) };
          o = o[path[i]];
        }
        o[path[path.length - 1]] = value;
        const user = s.users[s.session.userId || ''];
        next.history = [...t.history, {
          id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?',
          what, old: cur === undefined ? null : cur, new: value === undefined ? null : value, kind,
        }];
        set({ trucks: { ...s.trucks, [truckId]: bump(next as Truck) } });
        return true;
      },

      patchTruck: (truckId, patch, log) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return;
        const user = s.users[s.session.userId || ''];
        const history = log
          ? [...t.history, { id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?', what: log.what, old: log.old ?? null, new: log.new ?? null, kind: log.kind || 'field' }]
          : t.history;
        set({ trucks: { ...s.trucks, [truckId]: bump(t, { ...patch, history }) } });
      },
      markDone: (truckId, done) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return;
        const user = s.users[s.session.userId || ''];
        get().patchTruck(truckId, {
          status: done ? 'done' : 'weighing',
          doneAt: done ? nowIso() : null,
          doneBy: done ? user?.id || null : null,
          doneByName: done ? user?.name || '' : '',
          tables: done ? t.tables.map((tb) => ({ ...tb, locked: true })) : t.tables,
        }, { what: 'Trạng thái xe', old: done ? 'Đang cân' : 'Đã xong', new: done ? 'Đã xong' : 'Mở lại', kind: 'status' });
      },
      setLoaded: (truckId, loaded) => {
        const s = get();
        const user = s.users[s.session.userId || ''];
        get().patchTruck(truckId, { loaded, loadedAt: loaded ? nowIso() : null, loadedBy: loaded ? user?.id || null : null },
          { what: 'Bốc hàng', old: loaded ? 'Chưa bốc' : 'Đã bốc', new: loaded ? 'Đã bốc' : 'Chưa bốc', kind: 'status' });
      },
      setTableLocked: (truckId, tableIdx, locked) => {
        const t = get().trucks[truckId];
        if (!t || !t.tables[tableIdx]) return;
        get().patchTruck(truckId, { tables: t.tables.map((tb, i) => (i === tableIdx ? { ...tb, locked } : tb)) },
          { what: `${t.tables[tableIdx].name}`, old: locked ? 'Mở' : 'Khoá', new: locked ? 'Khoá' : 'Mở', kind: 'table' });
      },
      lockAllTables: (truckId, locked) => {
        const t = get().trucks[truckId];
        if (!t) return;
        get().patchTruck(truckId, { tables: t.tables.map((tb) => ({ ...tb, locked })) },
          { what: 'Tất cả bảng', old: locked ? 'Mở' : 'Khoá', new: locked ? 'Khoá' : 'Mở', kind: 'table' });
      },
      addTable: (truckId) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return;
        const user = s.users[s.session.userId || ''];
        const tb = newTable(t.tables.length + 1);
        const history = [...t.history, { id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?', what: 'Thêm bảng', old: null, new: tb.name, kind: 'table' as HistoryKind }];
        set({ trucks: { ...s.trucks, [truckId]: bump(t, { tables: [...t.tables, tb], history }) } });
      },
      removeLastTable: (truckId) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t || t.tables.length <= 1) return false;
        const last = t.tables[t.tables.length - 1];
        if (tableStats(last).bags > 0) return false;
        const user = s.users[s.session.userId || ''];
        const history = [...t.history, { id: uid(), at: nowIso(), by: user?.id || null, byName: user?.name || '?', what: 'Xoá bảng', old: last.name, new: null, kind: 'table' as HistoryKind }];
        set({ trucks: { ...s.trucks, [truckId]: bump(t, { tables: t.tables.slice(0, -1), history }) } });
        return true;
      },

      /* ---------- kho, loại hàng, xuất bán, hedge, ảnh ---------- */
      addWarehouse: ({ name, note }) => {
        const d: Warehouse = { id: uid(), type: 'warehouse', name: name.trim(), note: (note || '').trim(), createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ warehouses: { ...s.warehouses, [d.id]: d } }));
        return d;
      },
      updateWarehouse: (id, patch) => set((s) => (s.warehouses[id] ? { warehouses: { ...s.warehouses, [id]: bump(s.warehouses[id], patch) } } : {})),
      removeWarehouse: (id) => set((s) => (s.warehouses[id] ? { warehouses: { ...s.warehouses, [id]: bump(s.warehouses[id], { deleted: true }) } } : {})),
      addProduct: ({ name, presetId, note }) => {
        const d: Product = { id: uid(), type: 'product', name: name.trim(), presetId: presetId || null, note: (note || '').trim(), createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ products: { ...s.products, [d.id]: d } }));
        return d;
      },
      updateProduct: (id, patch) => set((s) => (s.products[id] ? { products: { ...s.products, [id]: bump(s.products[id], patch) } } : {})),
      removeProduct: (id) => set((s) => (s.products[id] ? { products: { ...s.products, [id]: bump(s.products[id], { deleted: true }) } } : {})),
      addSale: ({ date, warehouseId, productId, kg, price, buyer, note }) => {
        const s0 = get();
        const user = s0.users[s0.session.userId || ''];
        const d: Sale = { id: uid(), type: 'sale', date, warehouseId: warehouseId || null, productId: productId || null, kg: Number(kg) || 0, price: price == null ? null : Number(price), buyer: (buyer || '').trim(), note: (note || '').trim(), byName: user?.name || '', createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ sales: { ...s.sales, [d.id]: d } }));
        return d;
      },
      updateSale: (id, patch) => set((s) => (s.sales[id] ? { sales: { ...s.sales, [id]: bump(s.sales[id], patch) } } : {})),
      removeSale: (id) => set((s) => (s.sales[id] ? { sales: { ...s.sales, [id]: bump(s.sales[id], { deleted: true }) } } : {})),
      addHedge: ({ date, lots, tonsPerLot, price, note }) => {
        const s0 = get();
        const user = s0.users[s0.session.userId || ''];
        const d: Hedge = { id: uid(), type: 'hedge', date, lots: Number(lots) || 0, tonsPerLot: Number(tonsPerLot) || 10, price: price == null ? null : Number(price), note: (note || '').trim(), byName: user?.name || '', createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ hedges: { ...s.hedges, [d.id]: d } }));
        return d;
      },
      removeHedge: (id) => set((s) => (s.hedges[id] ? { hedges: { ...s.hedges, [id]: bump(s.hedges[id], { deleted: true }) } } : {})),
      addPhoto: ({ truckId, kind, localUri, note }) => {
        const s0 = get();
        const user = s0.users[s0.session.userId || ''];
        const d: Photo = { id: uid(), type: 'photo', truckId, kind, note: (note || '').trim(), localUri, driveUrl: null, byName: user?.name || '', createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ photos: { ...s.photos, [d.id]: d } }));
        const t = s0.trucks[truckId];
        if (t) get().patchTruck(truckId, {}, { what: 'Thêm ảnh', old: null, new: kind, kind: 'field' });
        return d;
      },
      updatePhoto: (id, patch) => set((s) => (s.photos[id] ? { photos: { ...s.photos, [id]: bump(s.photos[id], patch) } } : {})),
      removePhoto: (id) => {
        const p = get().photos[id];
        if (!p) return;
        set((s) => ({ photos: { ...s.photos, [id]: bump(s.photos[id], { deleted: true }) } }));
        if (get().trucks[p.truckId]) get().patchTruck(p.truckId, {}, { what: 'Xoá ảnh', old: p.kind, new: null, kind: 'field' });
      },
      setWeighMode: (truckId, mode) => {
        const t = get().trucks[truckId];
        if (!t || (t.weighMode || 'bags') === mode) return;
        get().patchTruck(truckId, { weighMode: mode, truckWeigh: t.truckWeigh || { grossIn: null, tareOut: null, bags: null } },
          { what: 'Kiểu cân', old: (t.weighMode || 'bags') === 'bags' ? 'Từng bao' : 'Cân xe tải', new: mode === 'bags' ? 'Từng bao' : 'Cân xe tải', kind: 'status' });
      },

      /* ---------- sellers ---------- */
      addSeller: ({ name, phone, address, note }) => {
        const d: Seller = { id: uid(), type: 'seller', name: name.trim(), phone: (phone || '').trim(), address: (address || '').trim(), note: (note || '').trim(), createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({ sellers: { ...s.sellers, [d.id]: d } }));
        return d;
      },
      updateSeller: (id, patch) =>
        set((s) => (s.sellers[id] ? { sellers: { ...s.sellers, [id]: bump(s.sellers[id], patch) } } : {})),
      removeSeller: (id) =>
        set((s) => (s.sellers[id] ? { sellers: { ...s.sellers, [id]: bump(s.sellers[id], { deleted: true }) } } : {})),

      /* ---------- payments ---------- */
      addPayment: (truckId, { amount, method, note, at }) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t) return;
        const user = s.users[s.session.userId || ''];
        const p: Payment = { id: uid(), at: at || nowIso(), amount: Math.round(Number(amount) || 0), method, by: user?.id || null, byName: user?.name || '?', note: (note || '').trim() };
        const payments = [...paymentsOf(t), p];
        const paidAmount = payments.reduce((a, x) => a + (Number(x.amount) || 0), 0);
        get().patchTruck(truckId, { payments, payment: { ...t.payment, paidAmount, status: paymentStatusFor({ ...t, payments }, paidAmount) } },
          { what: `Thanh toán (${method === 'cash' ? 'tiền mặt' : method === 'transfer' ? 'chuyển khoản' : 'khác'})`, old: t.payment.paidAmount, new: paidAmount, kind: 'field' });
      },
      removePayment: (truckId, paymentId) => {
        const s = get();
        const t = s.trucks[truckId];
        if (!t || paymentId === 'legacy') return;
        const target = paymentsOf(t).find((x) => x.id === paymentId);
        if (!target) return;
        const payments = paymentsOf(t).filter((x) => x.id !== paymentId);
        const paidAmount = payments.reduce((a, x) => a + (Number(x.amount) || 0), 0);
        get().patchTruck(truckId, { payments, payment: { ...t.payment, paidAmount, status: paymentStatusFor({ ...t, payments }, paidAmount) } },
          { what: 'Xoá lần thanh toán', old: target.amount, new: null, kind: 'field' });
      },

      /* ---------- day prices ---------- */
      setDayPrice: (date, price, note) => {
        const s = get();
        const user = s.users[s.session.userId || ''];
        const id = 'dp-' + date;
        const d: DayPrice = { id, type: 'dayprice', date, price: price == null ? null : Number(price), note: (note || '').trim(), byName: user?.name || '', updatedAt: laterThan(s.dayPrices[id]?.updatedAt) };
        set({ dayPrices: { ...s.dayPrices, [id]: d } });
      },

      /* ---------- presets ---------- */
      addPreset: (d) => {
        const p: QualityPreset = { ...d, id: uid(), type: 'preset', createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => {
          const presets = { ...s.presets, [p.id]: p };
          if (p.isDefault) for (const k of Object.keys(presets)) if (k !== p.id && presets[k].isDefault) presets[k] = bump(presets[k], { isDefault: false });
          return { presets };
        });
        return p;
      },
      updatePreset: (id, patch) =>
        set((s) => {
          if (!s.presets[id]) return {};
          const presets = { ...s.presets, [id]: bump(s.presets[id], patch) };
          if (patch.isDefault) for (const k of Object.keys(presets)) if (k !== id && presets[k].isDefault) presets[k] = bump(presets[k], { isDefault: false });
          return { presets };
        }),
      removePreset: (id) =>
        set((s) => (s.presets[id] ? { presets: { ...s.presets, [id]: bump(s.presets[id], { deleted: true, isDefault: false }) } } : {})),
      setDefaultPreset: (id) => get().updatePreset(id, { isDefault: true }),
      ensureDefaultPreset: () => {
        const s = get();
        if (Object.values(s.presets).some((p) => !p.deleted)) return;
        if (s.settings.sheetUrl && !s.settings.lastSync) return; // chờ nhận quy ước từ Google Sheets trước
        const tpl = PRESET_TEMPLATES[0];
        const base = tpl.make();
        // giữ các giá trị mặc định cũ (độ chuẩn, bì) nếu người dùng đã chỉnh
        base.tareValue = Number(s.settings.tarePerBag) || 0;
        base.moisture = { ...base.moisture, standard: Number(s.settings.moistureStd) || 13 };
        get().addPreset({ ...base, name: tpl.name, note: tpl.desc, isDefault: true });
      },
      applyPreset: (truckId, presetId) => {
        const s = get();
        const t = s.trucks[truckId];
        const p = s.presets[presetId];
        if (!t || !p) return;
        const old = t.preset?.name || 'Mặc định';
        get().patchTruck(truckId, { preset: snapshotOf(p) }, { what: 'Quy ước tạp độ', old, new: p.name, kind: 'field' });
      },

      /* ---------- cài đặt dùng chung ---------- */
      setTeamConfig: (patch) => set((s) => {
        const cur = teamConfigOf(s);
        const next: TeamConfig = { ...cur, ...patch, company: { ...cur.company, ...(patch.company || {}) }, updatedAt: laterThan(cur.updatedAt) };
        return { configs: { ...s.configs, config: next } };
      }),

      /* ---------- settings ---------- */
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /* ---------- sync ---------- */
      markPending: (ids) => { if (ids.length) set((s) => { const pending = { ...s.pending }; for (const id of ids) pending[id] = true; return { pending }; }); },
      clearPending: (ids) => { if (ids.length) set((s) => { const pending = { ...s.pending }; for (const id of ids) delete pending[id]; return { pending }; }); },
      mergeRecords: (records, opts) => {
        const s = get();
        const toPush: string[] = opts?.markPending ? records.map((r) => r.id) : [];
        const users = { ...s.users };
        const drivers = { ...s.drivers };
        const trucks = { ...s.trucks };
        const presets = { ...s.presets };
        const sellers = { ...s.sellers };
        const dayPrices = { ...s.dayPrices };
        const warehouses = { ...s.warehouses };
        const products = { ...s.products };
        const sales = { ...s.sales };
        const hedges = { ...s.hedges };
        const photos = { ...s.photos };
        const configs = { ...s.configs };
        let changed = 0;
        for (const r of records || []) {
          if (!r || !r.id || !r.type) continue;
          const bucket: Record<string, any> | null = r.type === 'user' ? users : r.type === 'driver' ? drivers : r.type === 'truck' ? trucks : r.type === 'preset' ? presets : r.type === 'seller' ? sellers : r.type === 'dayprice' ? dayPrices : r.type === 'warehouse' ? warehouses : r.type === 'product' ? products : r.type === 'sale' ? sales : r.type === 'hedge' ? hedges : r.type === 'photo' ? photos : r.type === 'config' ? configs : null;
          if (!bucket) continue;
          const local = bucket[r.id];
          if (r.type === 'truck' && local) {
            const merged = mergeTruck(local as Truck, r as Truck);
            if (merged !== local) { bucket[r.id] = merged; changed++; if (merged !== r) toPush.push(r.id); } // bản gộp có phần máy chủ chưa có
            continue;
          }
          if (!local) { bucket[r.id] = r; changed++; continue; }
          const merged = mergeSimple(local as any, r as any);
          if (merged === local) continue;
          // ảnh: giữ đường dẫn file trên máy này
          bucket[r.id] = r.type === 'photo' && (local as Photo).localUri ? { ...merged, localUri: (local as Photo).localUri } : merged;
          changed++;
          if (merged !== r) toPush.push(r.id); // bản gộp (xoá dính) máy chủ chưa có
        }
        // nhiều quy ước cùng "mặc định" (mỗi máy tự tạo một cái): giữ cái mới nhất
        const defaults = Object.values(presets).filter((p) => !p.deleted && p.isDefault).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        for (const p of defaults.slice(1)) { presets[p.id] = bump(p, { isDefault: false }); changed++; toPush.push(p.id); }
        // hai máy cùng tạo "Xe N" trong ngày khi mất mạng → đánh lại số cho xe tạo sau
        const byDate: Record<string, Truck[]> = {};
        for (const t of Object.values(trucks)) if (!t.deleted) (byDate[t.date] || (byDate[t.date] = [])).push(t);
        for (const list of Object.values(byDate)) {
          // xe đã xong (đã in phiếu) giữ số; chỉ đánh lại số xe đang cân, theo thứ tự tạo
          list.sort((a, b) => (a.status === 'done' ? 0 : 1) - (b.status === 'done' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt));
          const used = new Set<number>();
          let maxSeq = 0;
          for (const t of list) {
            if (used.has(t.seq) && t.status !== 'done') {
              const seq = maxSeq + 1;
              const isDefaultName = t.name === 'Xe ' + t.seq;
              trucks[t.id] = bump(t, { seq, name: isDefaultName ? 'Xe ' + seq : t.name, history: [...t.history, { id: uid(), at: nowIso(), by: null, byName: 'Hệ thống', what: 'Đánh lại số xe (trùng khi đồng bộ)', old: t.seq, new: seq, kind: 'status' as HistoryKind }] });
              used.add(seq); maxSeq = Math.max(maxSeq, seq); changed++; toPush.push(t.id);
            } else { used.add(t.seq); maxSeq = Math.max(maxSeq, t.seq); }
          }
        }
        if (changed) {
          applyingRemote = true;
          try {
            const pending = { ...s.pending };
            for (const id of toPush) pending[id] = true;
            set({ users, drivers, trucks, presets, sellers, dayPrices, warehouses, products, sales, hedges, photos, configs, pending });
          } finally { applyingRemote = false; }
        }
        return changed;
      },
      resetAll: () => {
        set({ users: {}, drivers: {}, trucks: {}, presets: {}, sellers: {}, dayPrices: {}, warehouses: {}, products: {}, sales: {}, hedges: {}, photos: {}, configs: {}, pending: {}, session: { userId: null }, settings: defaultSettings() });
      },
    }),
    {
      name: 'cancaphe.v1',
      storage: createJSONStorage(() => appStorage),
      partialize: (s) => ({ users: s.users, drivers: s.drivers, trucks: s.trucks, presets: s.presets, sellers: s.sellers, dayPrices: s.dayPrices, warehouses: s.warehouses, products: s.products, sales: s.sales, hedges: s.hedges, photos: s.photos, configs: s.configs, session: s.session, settings: s.settings, pending: s.pending }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as any;
        const keys = ['presets', 'sellers', 'dayPrices', 'warehouses', 'products', 'sales', 'hedges', 'photos', 'configs', 'pending'] as const;
        const filled: Record<string, unknown> = {};
        for (const k of keys) filled[k] = p[k] || {};
        // nâng cấp từ bản cũ (chưa có hàng chờ): đẩy những gì đổi sau lần đẩy cuối
        if (p.pending === undefined && p.settings?.lastPush) {
          const pend: Record<string, true> = {};
          for (const k of BUCKETS) for (const r of Object.values((p[k] || {}) as Record<string, { id: string; updatedAt?: string }>)) if ((r.updatedAt || '') > p.settings.lastPush) pend[r.id] = true;
          filled.pending = pend;
        }
        return { ...current, ...p, ...filled, settings: { ...current.settings, ...(p.settings || {}) }, session: { ...current.session, ...(p.session || {}) } };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/* ---------- đánh dấu bản ghi đổi trên máy này ---------- */
let marking = false;
useStore.subscribe((s, prev) => {
  if (applyingRemote || marking || !s.hydrated) return;
  const ids: string[] = [];
  for (const k of BUCKETS) {
    const cur = s[k] as Record<string, { id: string }>;
    const old = prev[k] as Record<string, { id: string }>;
    if (cur === old) continue;
    for (const id of Object.keys(cur)) if (cur[id] !== old?.[id]) ids.push(id);
  }
  if (ids.length) { marking = true; try { s.markPending(ids); } finally { marking = false; } }
});

/* ---------- payment helpers ---------- */
export function paymentsOf(t: Truck): Payment[] {
  if (Array.isArray(t.payments)) return t.payments;
  // xe cũ: chuyển paidAmount thành một lần thanh toán ảo
  const a = Number(t.payment?.paidAmount || 0);
  return a > 0 ? [{ id: 'legacy', at: t.updatedAt, amount: a, method: 'other', by: null, byName: '', note: 'Nhập trước khi có sổ thanh toán' }] : [];
}
function paymentStatusFor(t: Truck, paid: number): Truck['payment']['status'] {
  const s = truckStats({ ...t, payments: undefined, payment: { ...t.payment, paidAmount: paid } });
  if (s.amount == null) return paid > 0 ? 'partial' : t.payment.status;
  if (paid >= Math.round(s.amount) - 1) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
}

/* ---------- preset helpers ---------- */
export function snapshotOf(p: QualityPreset): PresetSnapshot {
  return {
    id: p.id, name: p.name, tareMode: p.tareMode, tareValue: p.tareValue, impurityInput: p.impurityInput,
    impurity: { ...p.impurity, table: (p.impurity.table || []).map((r) => ({ ...r })) },
    moisture: { ...p.moisture, table: (p.moisture.table || []).map((r) => ({ ...r })) },
  };
}
export function defaultPresetOf(s: Pick<Store, 'presets'>): QualityPreset | null {
  const list = Object.values(s.presets || {}).filter((p) => !p.deleted);
  return list.find((p) => p.isDefault) || list[0] || null;
}
export const activePresets = (s: Store): QualityPreset[] =>
  Object.values(s.presets || {}).filter((p) => !p.deleted).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'vi'));

/* ---------- selectors / helpers ---------- */
export const selectCurrentUser = (s: Store): User | null => {
  const u = s.users[s.session.userId || ''];
  return u && !u.deleted ? u : null;
};
export const activeUsers = (s: Store): User[] =>
  Object.values(s.users).filter((u) => !u.deleted).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
export const activeDrivers = (s: Store): Driver[] =>
  Object.values(s.drivers).filter((d) => !d.deleted).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
export const trucksOfDate = (s: Store, date: string): Truck[] =>
  Object.values(s.trucks).filter((t) => !t.deleted && t.date === date).sort((a, b) => a.seq - b.seq);
export const datesWithTrucks = (s: Store): { date: string; count: number }[] => {
  const m: Record<string, number> = {};
  for (const t of Object.values(s.trucks)) if (!t.deleted) m[t.date] = (m[t.date] || 0) + 1;
  return Object.keys(m).sort().reverse().map((date) => ({ date, count: m[date] }));
};
export const allRecords = (s: Store): SyncRecord[] => {
  const photos = Object.values(s.photos || {}).map(({ localUri: _l, ...rest }) => rest as Photo); // không gửi đường dẫn máy
  return [...Object.values(s.users), ...Object.values(s.drivers), ...Object.values(s.presets || {}), ...Object.values(s.sellers || {}), ...Object.values(s.dayPrices || {}),
    ...Object.values(s.warehouses || {}), ...Object.values(s.products || {}), ...Object.values(s.sales || {}), ...Object.values(s.hedges || {}), ...photos, ...Object.values(s.trucks)];
};
export function teamConfigOf(s: Pick<Store, 'configs' | 'settings'>): TeamConfig {
  const c = s.configs?.config;
  if (c && !c.deleted) return { ...c, company: c.company || { name: '', phone: '', address: '', footer: '' } };
  // chưa có bản dùng chung: lấy từ cài đặt máy (bản cũ)
  return {
    id: 'config', type: 'config', updatedAt: '',
    staffCanSeeMoney: s.settings.staffCanSeeMoney !== false,
    debtDueDays: Number(s.settings.debtDueDays ?? 7),
    tablesPerTruck: Number(s.settings.tablesPerTruck) || 2,
    company: s.settings.company || { name: '', phone: '', address: '', footer: '' },
  };
}
export const activeWarehouses = (s: Store): Warehouse[] => Object.values(s.warehouses || {}).filter((x) => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
export const activeProducts = (s: Store): Product[] => Object.values(s.products || {}).filter((x) => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
export const warehouseName = (s: Store, id: string | null | undefined): string => (id && s.warehouses?.[id]?.name) || '';
export const productName = (s: Store, id: string | null | undefined): string => (id && s.products?.[id]?.name) || '';
export const photosOfTruck = (s: Store, truckId: string): Photo[] => Object.values(s.photos || {}).filter((p) => !p.deleted && p.truckId === truckId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
/** Quản lý luôn thấy tiền; nhân viên tuỳ cài đặt */
export const canSeeMoney = (s: Store): boolean => {
  const u = selectCurrentUser(s);
  if (!u) return false;
  return u.role === 'admin' || teamConfigOf(s).staffCanSeeMoney;
};
export const activeSellers = (s: Store): Seller[] =>
  Object.values(s.sellers || {}).filter((x) => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
export const sellerName = (s: Store, id: string | null | undefined): string => (id && s.sellers?.[id]?.name) || '';
export const dayPriceOf = (s: Pick<Store, 'dayPrices'>, date: string): DayPrice | null => {
  const d = s.dayPrices?.['dp-' + date];
  return d && !d.deleted ? d : null;
};
/** Các bản ghi đang chờ đẩy (theo id) */
export const pendingRecords = (s: Store): SyncRecord[] => {
  const out: SyncRecord[] = [];
  for (const id of Object.keys(s.pending || {})) {
    for (const k of BUCKETS) {
      const r = (s[k] as Record<string, SyncRecord>)[id];
      if (r) { out.push(r.type === 'photo' ? ({ ...(r as Photo), localUri: undefined } as Photo) : r); break; }
    }
  }
  return out;
};
export const userName = (s: Store, id: string | null | undefined): string => (id && s.users[id]?.name) || '';
export const driverName = (s: Store, id: string | null | undefined): string => (id && s.drivers[id]?.name) || '';
