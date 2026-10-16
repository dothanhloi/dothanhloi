import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NumPad } from '../../components/NumPad';
import { PaymentSheet } from '../../components/PaymentSheet';
import { EditingCell, WeighTable } from '../../components/WeighTable';
import { Btn, Card, ConfirmSheet, Field, IconBtn, Input, InputSheet, KV, Pill, Sheet, Stats, Toggle, TopBar, haptic } from '../../components/ui';
import { LotStats, lotsOf, presetOf, truckStats } from '../../lib/calc';
import { fmtDateTime, fmtDateVN, fmtKg, fmtMoney, fmtNum, fmtPct, fmtTime, parseNum } from '../../lib/format';
import { PHOTO_KINDS, deletePhotoFile, photoUri, takePhoto } from '../../lib/photos';
import { presetSummary } from '../../lib/presetText';
import { labelsFor } from '../../lib/labels';
import { shareReceipt } from '../../lib/receipt';
import { activeDrivers, activeParties, activePresets, activeProducts, activeUsers, activeWarehouses, canSeeMoney, driverName, photosOfTruck, productName, selectCurrentUser, sellerName, useStore, userName, warehouseName } from '../../lib/store';
import { C, shadow } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { Lot, PaymentStatus } from '../../lib/types';

/* ---------- trường có bảo vệ (nhấn giữ để sửa) ---------- */
type TruckFieldKey = 'name' | 'note' | 'grossIn' | 'tareOut' | 'truckBags';
type LotFieldKey = 'price' | 'gram' | 'impurityGram' | 'impurityPct' | 'moisture' | 'paymentNote' | 'lotNote' | 'lotKg' | 'lotBags';
type FieldKey = TruckFieldKey | LotFieldKey;
interface FieldDef { title: string; what: string; path: string[]; unit?: string; keyboard: 'decimal' | 'number' | 'text'; hint?: string; lot?: boolean }

const FIELDS: Record<FieldKey, FieldDef> = {
  name: { title: 'Đổi tên xe', what: 'Tên xe', path: ['name'], keyboard: 'text' },
  note: { title: 'Ghi chú xe', what: 'Ghi chú', path: ['note'], keyboard: 'text' },
  grossIn: { title: 'Xe vào (có hàng)', what: 'Cân xe vào (kg)', path: ['truckWeigh', 'grossIn'], unit: 'kg', keyboard: 'decimal', hint: 'Tổng khối lượng xe + hàng khi vào' },
  tareOut: { title: 'Xe ra (rỗng)', what: 'Cân xe ra (kg)', path: ['truckWeigh', 'tareOut'], unit: 'kg', keyboard: 'decimal', hint: 'Khối lượng xe không hàng khi ra' },
  truckBags: { title: 'Số bao', what: 'Số bao', path: ['truckWeigh', 'bags'], unit: 'bao', keyboard: 'number', hint: 'Dùng để trừ bì theo bao (nếu quy ước có)' },
  price: { title: 'Giá cà phê', what: 'Giá', path: ['price'], unit: 'đ/kg', keyboard: 'number', hint: 'Giá mua theo kg thực nhận', lot: true },
  gram: { title: 'Mẫu thử', what: 'Mẫu (g)', path: ['sample', 'gram'], unit: 'g', keyboard: 'decimal', hint: 'Khối lượng mẫu lấy ra để kiểm tra, VD 300', lot: true },
  impurityGram: { title: 'Tạp chất trong mẫu', what: 'Tạp (g)', path: ['sample', 'impurityGram'], unit: 'g', keyboard: 'decimal', hint: 'Số gram tạp trong mẫu. App tự tính % tạp = tạp / mẫu', lot: true },
  impurityPct: { title: 'Tạp chất', what: 'Tạp (%)', path: ['sample', 'impurityPct'], unit: '%', keyboard: 'decimal', hint: 'Nhập % tạp trực tiếp theo quy ước đang chọn', lot: true },
  moisture: { title: 'Độ ẩm', what: 'Độ (%)', path: ['sample', 'moisture'], unit: '%', keyboard: 'decimal', hint: 'Độ ẩm đo được của lô hàng', lot: true },
  paymentNote: { title: 'Ghi chú thanh toán', what: 'Ghi chú TT', path: ['payment', 'note'], keyboard: 'text', lot: true },
  lotNote: { title: 'Ghi chú chủ hàng', what: 'Ghi chú', path: ['note'], keyboard: 'text', lot: true },
  lotKg: { title: 'Kg hàng của chủ hàng này', what: 'Kg (cân xe tải)', path: ['truckKg'], unit: 'kg', keyboard: 'decimal', hint: 'Chia tổng hàng (xe vào − xe ra) cho từng chủ hàng', lot: true },
  lotBags: { title: 'Số bao của chủ hàng này', what: 'Số bao', path: ['truckBags'], unit: 'bao', keyboard: 'number', lot: true },
};

function driveThumb(url: string, size = 400): string {
  const m = url.match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w${size}` : url;
}

export default function TruckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const user = useStore(selectCurrentUser);
  const t = store.trucks[id || ''];
  const truckId = id || '';
  const [editing, setEditingState] = useState<EditingCell | null>(null);
  const editingRef = useRef<EditingCell | null>(null);
  const setEditing = useCallback((v: EditingCell | null | ((cur: EditingCell | null) => EditingCell | null)) => {
    const next = typeof v === 'function' ? v(editingRef.current) : v;
    editingRef.current = next;
    setEditingState(next);
  }, []);
  const [field, setField] = useState<{ key: FieldKey; lotId?: string } | null>(null);
  const [pickDriver, setPickDriver] = useState(false);
  const [pickWeigher, setPickWeigher] = useState(false);
  const [pickWarehouse, setPickWarehouse] = useState(false);
  const [pickSeller, setPickSeller] = useState<string | null>(null);   // lotId
  const [pickProduct, setPickProduct] = useState<string | null>(null); // lotId
  const [pickPreset, setPickPreset] = useState<string | null>(null);   // lotId
  const [payLot, setPayLot] = useState<string | null>(null);
  const [delPay, setDelPay] = useState<{ lotId: string; paymentId: string } | null>(null);
  const [askRemoveLot, setAskRemoveLot] = useState<string | null>(null);
  const [addLotOpen, setAddLotOpen] = useState(false);
  const [askDone, setAskDone] = useState(false);
  const [askReopen, setAskReopen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [photoKind, setPhotoKind] = useState<null | 'menu'>(null);
  const [delPhoto, setDelPhoto] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [askMode, setAskMode] = useState<'bags' | 'truck' | null>(null);

  const s = useMemo(() => (t ? truckStats(t) : null), [t]);
  const lots = useMemo(() => (t ? lotsOf(t) : []), [t]);
  const photosAll = store.photos;
  const photos = useMemo(() => photosOfTruck({ photos: photosAll } as any, truckId), [photosAll, truckId]);
  const photoUris = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, photoUri(p)])), [photos]);

  /* ---------- nhập ô cân (hooks phải đứng trước mọi return) ---------- */
  const commit = useCallback((e: EditingCell): boolean => {
    const v = e.text.trim() === '' ? null : parseNum(e.text);
    if (v !== null && (v === undefined || isNaN(v as number))) { toast('Số không hợp lệ', 'err'); return false; }
    useStore.getState().setCell(truckId, e.lotId, e.tableIdx, e.col, e.row, v === null ? null : Math.round((v as number) * 10) / 10);
    return true;
  }, [truckId]);

  const guardLot = (lotId: string, ti: number): Lot | null => {
    const tr = useStore.getState().trucks[truckId];
    if (!tr) return null;
    if (tr.status === 'done') { toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.'); return null; }
    const lot = lotsOf(tr).find((l) => l.id === lotId);
    if (!lot) return null;
    if (lot.tables[ti]?.locked) { toast('Bảng đang khoá. Bấm “Khoá” để mở.'); return null; }
    return lot;
  };
  const onCellPress = useCallback((lotId: string, ti: number, c: number, r: number) => {
    const lot = guardLot(lotId, ti);
    if (!lot) return;
    const cur = editingRef.current;
    if (cur && cur.lotId === lotId && cur.tableIdx === ti && cur.col === c && cur.row === r) return;
    if (cur) commit(cur);
    if (lot.tables[ti].cells[c][r] != null) { toast('Nhấn giữ ô để sửa số đã nhập'); setEditing(null); return; }
    haptic();
    setEditing({ lotId, tableIdx: ti, col: c, row: r, text: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId, commit, setEditing]);
  const onCellLongPress = useCallback((lotId: string, ti: number, c: number, r: number) => {
    const lot = guardLot(lotId, ti);
    if (!lot) return;
    const v = lot.tables[ti].cells[c][r];
    if (v == null) return;
    haptic('medium');
    const cur = editingRef.current;
    if (cur) commit(cur);
    setEditing({ lotId, tableIdx: ti, col: c, row: r, text: fmtNum(v) });
    toast('Đang sửa – thay đổi sẽ được lưu vào lịch sử');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId, commit, setEditing]);
  const onToggleLock = useCallback((lotId: string, ti: number) => {
    const st = useStore.getState();
    const tr = st.trucks[truckId];
    if (!tr) return;
    const lot = lotsOf(tr).find((l) => l.id === lotId);
    if (!lot) return;
    haptic();
    const cur = editingRef.current;
    if (cur && cur.lotId === lotId && cur.tableIdx === ti) { commit(cur); setEditing(null); }
    st.setTableLocked(truckId, lotId, ti, !lot.tables[ti].locked);
  }, [truckId, commit, setEditing]);

  const editingValid = !editing || (!!t && (t.weighMode || 'bags') !== 'truck' && t.status !== 'done' && !!lots.find((l) => l.id === editing.lotId)?.tables[editing.tableIdx]);
  useEffect(() => { if (!editingValid) setEditing(null); }, [editingValid, setEditing]);
  useEffect(() => () => { const cur = editingRef.current; if (cur) { commit(cur); editingRef.current = null; } }, [commit]);

  if (!t || t.deleted || !s) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title="Không tìm thấy xe" onBack={() => router.back()} />
      </View>
    );
  }

  const readOnly = t.status === 'done';
  const lb = labelsFor(t);
  const parties = activeParties(store, lb.kind);
  const allLocked = lots.every((l) => l.tables.every((tb) => tb.locked));
  const presets = activePresets(store);
  const money = canSeeMoney(store);
  const isTruckMode = (t.weighMode || 'bags') === 'truck';
  const multi = lots.length > 1;

  const onKey = (k: string) => setEditing((e) => {
    if (!e) return e;
    if (k === 'back') return { ...e, text: e.text.slice(0, -1) };
    if (k === 'clear') return { ...e, text: '' };
    if (k === '.') return e.text.includes('.') ? e : { ...e, text: e.text === '' ? '0.' : e.text + '.' };
    if (e.text.length >= 8) return e;
    if (e.text.includes('.') && e.text.split('.')[1].length >= 1) return e; // 1 số lẻ
    return { ...e, text: e.text + k };
  });
  const findNextEmpty = (e: EditingCell): EditingCell | null => {
    const tr = useStore.getState().trucks[truckId];
    const lot = lotsOf(tr).find((l) => l.id === e.lotId);
    if (!lot) return null;
    for (let ti = e.tableIdx; ti < lot.tables.length; ti++) {
      const tb = lot.tables[ti];
      if (tb.locked) continue;
      for (let c = 0; c < tb.cells.length; c++) for (let r = 0; r < tb.cells[c].length; r++) {
        const after = ti > e.tableIdx || c > e.col || (c === e.col && r > e.row);
        if (after && tb.cells[c][r] == null) return { lotId: e.lotId, tableIdx: ti, col: c, row: r, text: '' };
      }
    }
    return null;
  };
  const onNext = () => { if (!editing) return; if (!commit(editing)) return; const n = findNextEmpty(editing); setEditing(n); if (!n) toast('Đã hết ô trống. Bấm “Thêm bảng” nếu cần.'); };
  const onDone = () => { if (!editing) return; if (commit(editing)) setEditing(null); };

  /* ---------- trường có bảo vệ ---------- */
  const fieldValue = (k: FieldKey, lotId?: string): unknown => {
    const def = FIELDS[k];
    let o: any = def.lot ? lots.find((l) => l.id === lotId) : t;
    for (const p of def.path) o = o?.[p];
    return o;
  };
  const guarded = (k: FieldKey, lotId?: string) => {
    const v = fieldValue(k, lotId);
    const empty = v == null || v === '';
    const locked = readOnly && k !== 'paymentNote';
    return {
      empty,
      onPress: () => { if (locked) return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.'); if (empty) setField({ key: k, lotId }); else toast('Nhấn giữ để sửa'); },
      onLongPress: () => { if (locked) return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.'); haptic('medium'); setField({ key: k, lotId }); },
    };
  };
  const saveField = (text: string) => {
    if (!field) return;
    const f = FIELDS[field.key];
    let v: unknown;
    if (f.keyboard === 'text') v = text.trim();
    else { const n = parseNum(text); if (n !== null && isNaN(n)) return toast('Số không hợp lệ', 'err'); v = n; }
    if (field.key === 'name' && !v) return toast('Tên không được trống', 'err');
    if (f.lot && field.lotId) store.setLotField(t.id, field.lotId, f.what, f.path, v);
    else store.setField(t.id, f.what, f.path, v);
    setField(null);
    haptic('success');
  };
  const setPayment = (lotId: string, st: PaymentStatus) => store.setLotField(t.id, lotId, 'Thanh toán', ['payment', 'status'], st, 'status');
  const doShare = async (lotId?: string) => {
    if (sharing) return;
    setSharing(true);
    try { await shareReceipt(t, store, lotId); } catch (e: any) { toast('Không tạo được phiếu: ' + (e?.message || e), 'err', 3500); } finally { setSharing(false); }
  };
  const addPhoto = async (kind: typeof PHOTO_KINDS[number]['v'], fromLibrary: boolean) => {
    setPhotoKind(null);
    try { const p = await takePhoto(t.id, kind, fromLibrary); if (p) { haptic('success'); toast('Đã thêm ảnh', 'ok'); } }
    catch (e: any) { toast(e?.message || String(e), 'err', 3000); }
  };
  const lotTitle = (lot: Lot, i: number) => sellerName(store, lot.sellerId) || `${lb.kind === 'sell' ? 'Khách' : 'Chủ hàng'} ${i + 1}`;
  const cellLabel = (() => {
    if (!editing) return '';
    const lot = lots.find((l) => l.id === editing.lotId);
    const tb = lot?.tables[editing.tableIdx];
    return tb ? `${multi && lot ? lotTitle(lot, lots.indexOf(lot)) + ' · ' : ''}${tb.name} · Cột ${editing.col + 1} · Bao ${editing.row + 1}` : '';
  })();
  const curField = field ? FIELDS[field.key] : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t.name} subtitle={`${lb.title} · ${fmtDateVN(t.date)} · tạo ${fmtTime(t.createdAt)}${t.createdByName ? ' · ' + t.createdByName : ''}`}
        onBack={() => { if (editing) commit(editing); router.back(); }}
        onTitlePress={readOnly ? undefined : () => setField({ key: 'name' })}
        right={
          <>
            <IconBtn name={allLocked ? 'lock-closed' : 'lock-open-outline'} color={allLocked ? 'gray' : 'blue'} onPress={() => { if (readOnly) return toast('Xe đã xong'); haptic(); const cur = editingRef.current; if (cur) commit(cur); setEditing(null); store.lockAllTables(t.id, !allLocked); }} />
            {money ? <IconBtn name="share-outline" color="green" onPress={() => doShare()} /> : null}
            <IconBtn name="time-outline" color="blue" onPress={() => router.push(`/history/${t.id}`)} />
            <IconBtn name="trash-outline" color="red" onPress={() => setAskDelete(true)} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: (editing ? 330 : 90) + insets.bottom }} keyboardShouldPersistTaps="handled">
        {readOnly ? (
          <Pressable onLongPress={() => { haptic('medium'); setAskReopen(true); }} delayLongPress={600} style={st.doneCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={st.doneT}>✓ Đã xong xe · {fmtTime(t.doneAt)}{t.doneByName ? ` · ${t.doneByName}` : ''}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>nhấn giữ để mở lại</Text>
            </View>
            <Text style={st.doneBig}>{fmtKg(s.gross)} <Text style={{ fontSize: 16 }}>kg thô</Text></Text>
            <View style={st.doneGrid}>
              <Text style={st.doneRow}><Text style={st.doneK}>Tổng bao </Text><Text style={st.doneV}>{s.bags}</Text></Text>
              <Text style={st.doneRow}><Text style={st.doneK}>Thực nhận </Text><Text style={st.doneV}>{fmtKg(s.net)} kg</Text></Text>
              <Text style={st.doneRow}><Text style={st.doneK}>{lb.kind === 'sell' ? 'Khách hàng ' : 'Chủ hàng '}</Text><Text style={st.doneV}>{lots.length}</Text></Text>
              {money ? (
                <>
                  <Text style={st.doneRow}><Text style={st.doneK}>Thành tiền </Text><Text style={st.doneV}>{fmtMoney(s.amount)}</Text></Text>
                  <Text style={st.doneRow}><Text style={st.doneK}>{lb.kind === 'sell' ? 'Đã thu ' : 'Đã TT '}</Text><Text style={st.doneV}>{fmtMoney(s.paid)}</Text></Text>
                  <Text style={st.doneRow}><Text style={st.doneK}>{lb.kind === 'sell' ? 'Phải thu ' : 'Còn lại '}</Text><Text style={st.doneV}>{fmtMoney(s.remaining)}</Text></Text>
                </>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        <Stats items={[
          { icon: 'cube-outline', color: C.blue, value: String(s.bags), label: 'Tổng bao' },
          { icon: 'scale-outline', color: C.green, value: fmtKg(s.gross), unit: 'kg', label: 'Tổng thô' },
          { icon: 'analytics-outline', color: C.orange, value: fmtKg(s.avg), unit: 'kg', label: 'Trung bình' },
        ]} />

        {/* Thông tin xe */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <Pill text={lb.title} color={lb.kind === 'sell' ? 'green' : 'blue'} small icon={lb.kind === 'sell' ? 'arrow-up-circle' : 'arrow-down-circle'} />
            {readOnly ? <Pill text="Đã xong" color="green" icon="checkmark-circle" small /> : <Pill text="Đang cân" color="orange" icon="time-outline" small />}
            <View style={{ flex: 1 }} />
            <Toggle value={t.loaded ? 'yes' : 'no'} onChange={(v) => store.setLoaded(t.id, v === 'yes')}
              options={[{ v: 'no', label: 'Chưa bốc', color: 'red' }, { v: 'yes', label: 'Đã bốc', color: 'green' }]} />
          </View>
          <KV label="Tài xế" value={driverName(store, t.driverId) || 'Chọn tài xế'} empty={!t.driverId} onPress={() => !readOnly && setPickDriver(true)} />
          <KV label={lb.warehouse} value={warehouseName(store, t.warehouseId) || 'Chọn kho'} empty={!t.warehouseId} onPress={() => !readOnly && setPickWarehouse(true)} />
          <KV label={lb.weigher} value={userName(store, t.weigherId) || 'Chọn nhân viên'} empty={!t.weigherId} onPress={() => !readOnly && setPickWeigher(true)} />
          <KV label="Giờ tạo xe" sub={t.createdByName ? `bởi ${t.createdByName}` : undefined} value={fmtDateTime(t.createdAt)} />
          {t.loaded && t.loadedAt ? <KV label="Bốc hàng lúc" value={fmtDateTime(t.loadedAt)} /> : null}
          <KV label="Ghi chú xe" value={t.note || 'Thêm ghi chú'} {...guarded('note')} />
        </Card>

        {/* Kiểu cân */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Toggle value={isTruckMode ? 'truck' : 'bags'} onChange={(v) => { if (readOnly) return toast('Xe đã xong'); setAskMode(v); }}
            options={[{ v: 'bags', label: 'Cân từng bao', color: 'blue' }, { v: 'truck', label: 'Cân xe tải', color: 'orange' }]} />
        </View>
        {isTruckMode ? (
          <Card title="Cân xe tải (cân bàn ô tô)">
            <KV label="Xe vào (có hàng)" value={t.truckWeigh?.grossIn != null ? fmtKg(t.truckWeigh.grossIn) : 'Nhập'} unit={t.truckWeigh?.grossIn != null ? 'kg' : undefined} {...guarded('grossIn')} />
            <KV label="Xe ra (rỗng)" value={t.truckWeigh?.tareOut != null ? fmtKg(t.truckWeigh.tareOut) : 'Nhập'} unit={t.truckWeigh?.tareOut != null ? 'kg' : undefined} {...guarded('tareOut')} />
            <KV label="Hàng (vào − ra)" value={fmtKg(t.truckWeigh?.grossIn != null && t.truckWeigh?.tareOut != null ? Math.max(0, Number(t.truckWeigh.grossIn) - Number(t.truckWeigh.tareOut)) : 0)} unit="kg" highlight="blue" />
            {!multi ? <KV label="Số bao" value={t.truckWeigh?.bags != null ? String(t.truckWeigh.bags) : 'Nhập'} unit={t.truckWeigh?.bags != null ? 'bao' : undefined} {...guarded('truckBags')} /> : (
              <KV label="Chưa chia cho chủ hàng" value={fmtKg(s.unassignedKg)} unit="kg" highlight={Math.abs(s.unassignedKg) > 0.5 ? 'red' : 'green'} />
            )}
          </Card>
        ) : null}

        {/* Từng chủ hàng */}
        {lots.map((lot, li) => (
          <LotBlock key={lot.id} lot={lot} index={li} multi={multi} truckId={t.id} ls={s.lots[li]} readOnly={readOnly} money={money} isTruckMode={isTruckMode}
            title={lotTitle(lot, li)} lb={lb} editing={editing && editing.lotId === lot.id ? editing : null}
            onCellPress={onCellPress} onCellLongPress={onCellLongPress} onToggleLock={onToggleLock} guarded={guarded}
            onPickSeller={() => !readOnly && setPickSeller(lot.id)} onPickProduct={() => !readOnly && setPickProduct(lot.id)} onPickPreset={() => { if (readOnly) return toast('Xe đã xong'); setPickPreset(lot.id); }}
            onPay={() => setPayLot(lot.id)} onDelPay={(pid) => setDelPay({ lotId: lot.id, paymentId: pid })} onSetPayment={(v) => setPayment(lot.id, v)}
            onShare={() => doShare(lot.id)} sharing={sharing}
            onAddTable={() => { haptic(); store.addTable(t.id, lot.id); }}
            onRemoveTable={() => { const cur = editingRef.current; if (cur) { commit(cur); setEditing(null); } if (!store.removeLastTable(t.id, lot.id)) toast('Chỉ bớt được bảng cuối khi bảng đó trống', 'err'); else haptic(); }}
            onRemoveLot={() => setAskRemoveLot(lot.id)} />
        ))}
        {!readOnly ? <Btn title={lb.kind === 'sell' ? 'Thêm khách hàng' : 'Thêm chủ hàng'} kind="secondary" icon="person-add" onPress={() => setAddLotOpen(true)} style={{ marginBottom: 14 }} /> : null}

        {/* Ảnh */}
        <Card title={`Ảnh (${photos.length})`} right={!readOnly ? <Pill text="+ Chụp" color="blue" small icon="camera" onPress={() => setPhotoKind('menu')} /> : undefined}>
          {photos.length === 0 ? <Text style={{ color: C.muted, fontSize: 13 }}>Chụp ảnh mẫu hàng, phiếu cân giấy, xe hàng. Ảnh tự tải lên Google Drive khi đã liên kết Google Sheets.</Text> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p) => {
                const uri = photoUris[p.id] || (p.driveUrl ? driveThumb(p.driveUrl) : null);
                return (
                  <Pressable key={p.id} onPress={() => setViewPhoto(p.id)} onLongPress={() => { if (readOnly) return; haptic('medium'); setDelPhoto(p.id); }} delayLongPress={600} style={st.thumbWrap}>
                    {uri ? <Image source={{ uri }} style={st.thumb} /> : <View style={[st.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="cloud-offline-outline" size={22} color={C.muted} /></View>}
                    <Text style={st.thumbLabel} numberOfLines={1}>{PHOTO_KINDS.find((k) => k.v === p.kind)?.label}{p.driveUrl ? ' ☁︎' : ''}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Card>

        <Pressable onPress={() => router.push(`/history/${t.id}`)} style={[st.histLink, shadow]}>
          <Ionicons name="time-outline" size={18} color={C.blue} />
          <Text style={{ fontWeight: '700', color: C.blue, flex: 1 }}>Lịch sử sửa ({t.history.length})</Text>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      </ScrollView>

      {!editing ? (
        <View style={[st.bottom, { paddingBottom: insets.bottom + 10 }]}>
          {readOnly ? (
            <Btn title="Mở lại xe (nhấn giữ)" kind="ghost" icon="lock-open-outline" onLongPress={() => { haptic('medium'); setAskReopen(true); }} onPress={() => toast('Nhấn giữ để mở lại xe')} />
          ) : (
            <Btn title="Xong xe" kind="success" icon="checkmark-circle" onPress={() => { if (s.gross <= 0) return toast(isTruckMode ? 'Chưa nhập cân xe vào / xe ra' : 'Chưa có bao nào được cân', 'err'); setAskDone(true); }} />
          )}
        </View>
      ) : null}

      {editing && editingValid ? <NumPad label={cellLabel} value={editing.text} onKey={onKey} onNext={onNext} onDone={onDone} onCancel={() => setEditing(null)} /> : null}

      {/* ---------- sheets ---------- */}
      <InputSheet visible={!!field} onClose={() => setField(null)} title={curField?.title || ''} label={curField?.what} hint={curField?.hint} unit={curField?.unit}
        keyboard={curField?.keyboard || 'text'} big={curField ? curField.keyboard !== 'text' : false}
        initial={field ? (() => { const v = fieldValue(field.key, field.lotId); return v == null ? '' : String(v); })() : ''} onSave={saveField} />

      <Sheet visible={pickDriver} onClose={() => setPickDriver(false)} title="Chọn tài xế" desc="Thêm/sửa tài xế trong Cài đặt → Tài xế">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeDrivers(store).map((d) => <Pill key={d.id} text={d.name + (d.plate ? ` · ${d.plate}` : '')} color={t.driverId === d.id ? 'blue' : 'gray'} onPress={() => { store.setField(t.id, 'Tài xế', ['driverId'], d.id); setPickDriver(false); }} />)}
          {activeDrivers(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có tài xế nào.</Text> : null}
        </View>
        <AddDriverInline onAdded={(did) => { store.setField(t.id, 'Tài xế', ['driverId'], did); setPickDriver(false); }} />
      </Sheet>
      <Sheet visible={pickWeigher} onClose={() => setPickWeigher(false)} title="Nhân viên đi cân">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeUsers(store).map((u) => <Pill key={u.id} text={u.name} color={t.weigherId === u.id ? 'blue' : 'gray'} onPress={() => { store.setField(t.id, 'Nhân viên cân', ['weigherId'], u.id); setPickWeigher(false); }} />)}
        </View>
      </Sheet>
      <Sheet visible={pickWarehouse} onClose={() => setPickWarehouse(false)} title={lb.warehouse}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeWarehouses(store).map((d) => <Pill key={d.id} text={d.name} color={t.warehouseId === d.id ? 'blue' : 'gray'} onPress={() => { store.setField(t.id, 'Kho', ['warehouseId'], d.id); setPickWarehouse(false); }} />)}
          {activeWarehouses(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có kho. Thêm trong Cài đặt → Kho.</Text> : null}
        </View>
        <Btn title="Quản lý kho" kind="secondary" small onPress={() => { setPickWarehouse(false); router.push('/settings/warehouses'); }} />
      </Sheet>

      <Sheet visible={!!pickSeller} onClose={() => setPickSeller(null)} title={`Chọn ${lb.party.toLowerCase()}`} desc={`Quản lý danh sách trong Cài đặt → ${lb.partyPlural}`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {parties.map((d) => <Pill key={d.id} text={d.name + (d.phone ? ` · ${d.phone}` : '')} color={lots.find((l) => l.id === pickSeller)?.sellerId === d.id ? 'blue' : 'gray'}
            onPress={() => { if (pickSeller) store.setLotField(t.id, pickSeller, lb.party, ['sellerId'], d.id); setPickSeller(null); }} />)}
          {parties.length === 0 ? <Text style={{ color: C.muted }}>Chưa có {lb.party.toLowerCase()} nào.</Text> : null}
        </View>
        <AddSellerInline kind={lb.kind} onAdded={(sid) => { if (pickSeller) store.setLotField(t.id, pickSeller, lb.party, ['sellerId'], sid); setPickSeller(null); }} />
      </Sheet>
      <Sheet visible={!!pickProduct} onClose={() => setPickProduct(null)} title="Loại hàng" desc="Chọn loại hàng cũng áp dụng quy ước tạp độ gắn với loại đó (nếu có).">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeProducts(store).map((d) => <Pill key={d.id} text={d.name} color={lots.find((l) => l.id === pickProduct)?.productId === d.id ? 'blue' : 'gray'}
            onPress={() => { if (!pickProduct) return; const lot = lots.find((l) => l.id === pickProduct); store.setLotField(t.id, pickProduct, 'Loại hàng', ['productId'], d.id); if (d.presetId && store.presets[d.presetId] && !store.presets[d.presetId].deleted && lot && presetOf(lot, t).id !== d.presetId) store.applyPreset(t.id, pickProduct, d.presetId); setPickProduct(null); }} />)}
          {activeProducts(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có loại hàng. Thêm trong Cài đặt → Loại hàng.</Text> : null}
        </View>
        <Btn title="Quản lý loại hàng" kind="secondary" small onPress={() => { setPickProduct(null); router.push('/settings/products'); }} />
      </Sheet>
      <Sheet visible={!!pickPreset} onClose={() => setPickPreset(null)} title="Chọn quy ước tạp độ" desc="Áp dụng cho chủ hàng này. Thêm/sửa quy ước trong Cài đặt.">
        {presets.map((p) => {
          const lot = lots.find((l) => l.id === pickPreset);
          const curId = lot ? presetOf(lot, t).id : '';
          return (
            <Pressable key={p.id} onPress={() => { if (pickPreset) store.applyPreset(t.id, pickPreset, p.id); setPickPreset(null); haptic('success'); }}
              style={({ pressed }) => [st.presetRow, curId === p.id && { borderColor: C.blue, backgroundColor: C.blueSoft }, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.text }}>{p.name}{p.isDefault ? '  · mặc định' : ''}</Text>
                <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{presetSummary(p)}</Text>
              </View>
              {curId === p.id ? <Ionicons name="checkmark-circle" size={22} color={C.blue} /> : null}
            </Pressable>
          );
        })}
        {presets.length === 0 ? <Text style={{ color: C.muted }}>Chưa có quy ước nào.</Text> : null}
        <Btn title="Quản lý quy ước" kind="secondary" icon="options" onPress={() => { setPickPreset(null); router.push('/settings/presets'); }} style={{ marginTop: 8 }} />
      </Sheet>

      <Sheet visible={addLotOpen} onClose={() => setAddLotOpen(false)} title={lb.kind === 'sell' ? 'Thêm khách hàng vào chuyến' : 'Thêm chủ hàng vào xe'} desc={`Mỗi ${lb.party.toLowerCase()} có bảng cân, tạp độ, giá và ${lb.pay.toLowerCase()} riêng.`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {parties.map((d) => <Pill key={d.id} text={d.name} color="gray" onPress={() => { store.addLot(t.id, d.id); setAddLotOpen(false); haptic('success'); }} />)}
        </View>
        <AddSellerInline kind={lb.kind} onAdded={(sid) => { store.addLot(t.id, sid); setAddLotOpen(false); }} />
        <Btn title={`Thêm chưa chọn ${lb.party.toLowerCase()}`} kind="ghost" small onPress={() => { store.addLot(t.id, null); setAddLotOpen(false); }} style={{ marginTop: 8 }} />
      </Sheet>

      <PaymentSheet truckId={payLot ? t.id : null} lotId={payLot} onClose={() => setPayLot(null)} />
      <ConfirmSheet visible={!!delPay} onClose={() => setDelPay(null)} title="Xoá lần thanh toán này?" danger confirmText="Xoá" desc="Số tiền sẽ được cộng lại vào còn nợ. Việc xoá ghi vào lịch sử."
        onConfirm={() => { if (delPay) store.removePayment(t.id, delPay.lotId, delPay.paymentId); setDelPay(null); }} />
      <ConfirmSheet visible={!!askRemoveLot} onClose={() => setAskRemoveLot(null)} title="Bớt chủ hàng này?" danger confirmText="Bớt" desc="Chỉ bớt được khi chưa có số cân và chưa thanh toán."
        onConfirm={() => { if (askRemoveLot && !store.removeLot(t.id, askRemoveLot)) toast('Chủ hàng này đã có số cân hoặc thanh toán', 'err'); setAskRemoveLot(null); }} />

      <Sheet visible={photoKind === 'menu'} onClose={() => setPhotoKind(null)} title="Thêm ảnh" desc="Ảnh được nén còn khoảng 200–400 KB trước khi lưu.">
        {PHOTO_KINDS.map((k) => (
          <View key={k.v} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, fontWeight: '600', color: C.text }}>{k.label}</Text>
            <Btn title="Chụp" kind="primary" small icon="camera" onPress={() => addPhoto(k.v, false)} />
            <Btn title="Thư viện" kind="secondary" small icon="images" onPress={() => addPhoto(k.v, true)} />
          </View>
        ))}
      </Sheet>
      <Sheet visible={!!viewPhoto} onClose={() => setViewPhoto(null)} title={viewPhoto ? (PHOTO_KINDS.find((k) => k.v === store.photos[viewPhoto]?.kind)?.label || 'Ảnh') : ''}>
        {viewPhoto && store.photos[viewPhoto] ? (() => { const p = store.photos[viewPhoto]; const uri = photoUris[p.id] || (p.driveUrl ? driveThumb(p.driveUrl, 1600) : null); return (
          <>
            {uri ? <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: C.gray }} resizeMode="contain" /> : <Text style={{ color: C.muted }}>Ảnh chưa có trên máy này và chưa được tải lên Google Drive.</Text>}
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>{p.byName ? `${p.byName} · ` : ''}{fmtDateTime(p.createdAt)}{p.driveUrl ? ' · đã lưu Google Drive' : ' · chưa tải lên'}</Text>
            {p.driveUrl ? <Btn title="Mở trên Google Drive" kind="ghost" small icon="open-outline" onPress={() => Linking.openURL(p.driveUrl!).catch(() => toast('Không mở được liên kết', 'err'))} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
          </>); })() : null}
      </Sheet>
      <ConfirmSheet visible={!!delPhoto} onClose={() => setDelPhoto(null)} title="Xoá ảnh này?" danger confirmText="Xoá" onConfirm={() => { if (delPhoto) { const p = store.photos[delPhoto]; if (p) deletePhotoFile(p); store.removePhoto(delPhoto); } setDelPhoto(null); }} />
      <ConfirmSheet visible={!!askMode} onClose={() => setAskMode(null)} title={askMode === 'truck' ? 'Chuyển sang cân xe tải?' : 'Chuyển sang cân từng bao?'}
        desc={askMode === 'truck' ? 'Tổng thô tính bằng cân xe vào trừ cân xe ra. Nhiều chủ hàng thì chia kg cho từng người. Các bảng bao được giữ nhưng không tính.' : 'Tổng thô sẽ tính từ các bảng bao.'} confirmText="Chuyển"
        onConfirm={() => { const cur = editingRef.current; if (cur) commit(cur); setEditing(null); if (askMode) store.setWeighMode(t.id, askMode); setAskMode(null); }} />

      <ConfirmSheet visible={askDone} onClose={() => setAskDone(false)} title={`Xong ${t.name}?`} confirmText="Xác nhận xong xe"
        desc="Các bảng sẽ bị khoá. Muốn sửa lại phải nhấn giữ để mở xe." onConfirm={() => { setAskDone(false); const cur = editingRef.current; if (cur) commit(cur); setEditing(null); store.markDone(t.id, true); haptic('success'); toast(`${t.name} đã xong · ${fmtKg(s.gross)} kg`, 'ok', 2500); }}>
        <Card style={{ backgroundColor: C.bg, shadowOpacity: 0, elevation: 0 }}>
          <KV label="Tổng bao" value={String(s.bags)} />
          <KV label="Tổng thô" value={fmtKg(s.gross)} unit="kg" />
          <KV label="Thực nhận" value={fmtKg(s.net)} unit="kg" highlight="green" />
          {money ? <KV label="Thành tiền" value={fmtMoney(s.amount)} highlight="blue" /> : null}
          {lots.map((lot, i) => <KV key={lot.id} label={lotTitle(lot, i)} value={`${fmtKg(s.lots[i].net)} kg${money && s.lots[i].amount != null ? ' · ' + fmtMoney(s.lots[i].amount) : ''}`} />)}
          <KV label="Tài xế" value={driverName(store, t.driverId) || '—'} />
          <KV label={lb.weigher} value={userName(store, t.weigherId) || '—'} />
          <KV label="Người xác nhận" value={user?.name || '—'} />
        </Card>
      </ConfirmSheet>
      <ConfirmSheet visible={askReopen} onClose={() => setAskReopen(false)} title="Mở lại xe để sửa?" confirmText="Mở lại"
        desc="Việc mở lại sẽ được ghi vào lịch sử." onConfirm={() => { setAskReopen(false); store.markDone(t.id, false); toast('Đã mở lại xe'); }} />
      <ConfirmSheet visible={askDelete} onClose={() => setAskDelete(false)} title={`Xoá ${t.name}?`} confirmText="Xoá xe" danger
        desc={user?.role === 'admin' ? 'Xe sẽ bị ẩn khỏi danh sách (vẫn còn trên Google Sheets với trạng thái đã xoá).' : 'Chỉ quản lý mới được xoá xe.'}
        onConfirm={() => { if (user?.role !== 'admin') { setAskDelete(false); return toast('Chỉ quản lý mới được xoá xe', 'err'); } setAskDelete(false); store.removeTruck(t.id); router.back(); }} />
    </View>
  );
}

/* ---------- Khối một chủ hàng ---------- */
function LotBlock({ lot, index, multi, truckId, ls, readOnly, money, isTruckMode, title, lb, editing, onCellPress, onCellLongPress, onToggleLock, guarded,
  onPickSeller, onPickProduct, onPickPreset, onPay, onDelPay, onSetPayment, onShare, sharing, onAddTable, onRemoveTable, onRemoveLot }: {
  lot: Lot; index: number; multi: boolean; truckId: string; ls: LotStats; readOnly: boolean; money: boolean; isTruckMode: boolean; title: string; lb: ReturnType<typeof labelsFor>; editing: EditingCell | null;
  onCellPress: (lotId: string, ti: number, c: number, r: number) => void; onCellLongPress: (lotId: string, ti: number, c: number, r: number) => void; onToggleLock: (lotId: string, ti: number) => void;
  guarded: (k: FieldKey, lotId?: string) => { empty: boolean; onPress: () => void; onLongPress: () => void };
  onPickSeller: () => void; onPickProduct: () => void; onPickPreset: () => void; onPay: () => void; onDelPay: (pid: string) => void; onSetPayment: (v: PaymentStatus) => void;
  onShare: () => void; sharing: boolean; onAddTable: () => void; onRemoveTable: () => void; onRemoveLot: () => void;
}) {
  const store = useStore();
  const t = store.trucks[truckId];
  const preset = presetOf(lot, t);
  const payments = lot.payments || [];
  const cellPress = useCallback((ti: number, c: number, r: number) => onCellPress(lot.id, ti, c, r), [onCellPress, lot.id]);
  const cellLong = useCallback((ti: number, c: number, r: number) => onCellLongPress(lot.id, ti, c, r), [onCellLongPress, lot.id]);
  const toggleLock = useCallback((ti: number) => onToggleLock(lot.id, ti), [onToggleLock, lot.id]);
  return (
    <View style={[st.lotBlock, multi && { borderColor: LOT_COLORS[index % LOT_COLORS.length] }]}>
      <View style={st.lotHead}>
        <View style={[st.lotBadge, { backgroundColor: LOT_COLORS[index % LOT_COLORS.length] }]}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{multi ? `${lb.kind === 'sell' ? 'KH' : 'CH'} ${index + 1}` : lb.party.toUpperCase()}</Text></View>
        <Pressable onPress={onPickSeller} style={{ flex: 1 }}>
          <Text style={[st.lotTitle, !lot.sellerId && { color: C.blue }]} numberOfLines={1}>{lot.sellerId ? title : `Chọn ${lb.party.toLowerCase()}`}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{ls.bags} bao · {fmtKg(ls.gross)} kg thô · thực nhận {fmtKg(ls.net)} kg</Text>
        </Pressable>
        {multi && !readOnly ? <IconBtn name="close" color="red" size={16} style={{ width: 32, height: 32 }} onPress={onRemoveLot} /> : null}
      </View>
      <Card style={{ marginBottom: 10 }}>
        <KV label="Loại hàng" value={productName(store, lot.productId) || 'Chọn loại hàng'} empty={!lot.productId} onPress={onPickProduct} />
        <KV label="Ghi chú" value={lot.note || 'Thêm ghi chú'} {...guarded('lotNote', lot.id)} />
      </Card>

      {isTruckMode ? (
        multi ? (
          <Card title={`Phần hàng của ${lb.party.toLowerCase()} này (cân xe tải)`}>
            <KV label="Kg hàng" value={lot.truckKg != null ? fmtKg(lot.truckKg) : 'Nhập'} unit={lot.truckKg != null ? 'kg' : undefined} {...guarded('lotKg', lot.id)} />
            <KV label="Số bao" value={lot.truckBags != null ? String(lot.truckBags) : 'Nhập'} unit={lot.truckBags != null ? 'bao' : undefined} {...guarded('lotBags', lot.id)} />
          </Card>
        ) : null
      ) : (
        <>
          {lot.tables.map((tb, i) => (
            <WeighTable key={tb.id} table={tb} tableIdx={i} editing={editing && editing.tableIdx === i ? editing : null} readOnly={readOnly}
              onCellPress={cellPress} onCellLongPress={cellLong} onToggleLock={toggleLock} />
          ))}
          {!readOnly ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <Btn title="Thêm bảng" kind="secondary" icon="add" small onPress={onAddTable} style={{ flex: 1 }} />
              <Btn title="Bớt bảng" kind="ghost" icon="remove" small onPress={onRemoveTable} style={{ flex: 1 }} />
            </View>
          ) : null}
        </>
      )}

      <Card title="Chất lượng & giá" right={<Text style={{ fontSize: 11, color: C.muted }}>nhấn giữ để sửa</Text>}>
        <KV label="Quy ước tạp độ" sub={presetSummary(preset)} value={preset.name} onPress={onPickPreset} />
        {preset.impurityInput === 'gram' ? (
          <>
            <KV label="Mẫu" value={lot.sample.gram != null ? fmtNum(lot.sample.gram) : 'Nhập'} unit={lot.sample.gram != null ? 'g' : undefined} {...guarded('gram', lot.id)} />
            <KV label="Tạp" sub={ls.impurityPct != null ? `= ${fmtPct(ls.impurityPct)} · ${ls.impurity.label}` : undefined} value={lot.sample.impurityGram != null ? fmtNum(lot.sample.impurityGram) : 'Nhập'} unit={lot.sample.impurityGram != null ? 'g' : undefined} {...guarded('impurityGram', lot.id)} />
          </>
        ) : (
          <KV label="Tạp" sub={ls.impurityPct != null ? ls.impurity.label : undefined} value={lot.sample.impurityPct != null ? fmtNum(lot.sample.impurityPct, 2) : 'Nhập'} unit={lot.sample.impurityPct != null ? '%' : undefined} {...guarded('impurityPct', lot.id)} />
        )}
        <KV label="Độ" sub={ls.moistureVal != null ? ls.moisture.label : undefined} value={lot.sample.moisture != null ? fmtNum(lot.sample.moisture) : 'Nhập'} unit={lot.sample.moisture != null ? '%' : undefined} {...guarded('moisture', lot.id)} />
        {ls.tare > 0 ? <KV label="Trừ bì" sub={preset.tareMode === 'perBag' ? `${fmtNum(preset.tareValue, 2)} kg × ${ls.bags} bao` : `${fmtNum(preset.tareValue, 2)}% tổng thô`} value={'−' + fmtKg(ls.tare)} unit="kg" /> : null}
        {ls.impurity.kg > 0 ? <KV label="Trừ tạp" value={'−' + fmtKg(ls.impurity.kg)} unit="kg" /> : null}
        {ls.moisture.kg > 0 ? <KV label="Trừ độ" value={'−' + fmtKg(ls.moisture.kg)} unit="kg" /> : null}
        <KV label="Thực nhận" value={fmtKg(ls.net)} unit="kg" highlight="green" />
        {money ? (
          <>
            <KV label="Giá" value={lot.price != null ? fmtMoney(lot.price) : 'Nhập giá'} unit={lot.price != null ? '/kg' : undefined} {...guarded('price', lot.id)} />
            {ls.priceDeduct > 0 ? <KV label="Giá sau trừ" sub={`trừ ${fmtMoney(ls.priceDeduct)}/kg (tạp ${fmtMoney(ls.impurity.price)} + độ ${fmtMoney(ls.moisture.price)})`} value={fmtMoney(ls.effectivePrice)} unit="/kg" /> : null}
            <KV label="Thành tiền" value={fmtMoney(ls.amount)} highlight="blue" />
          </>
        ) : null}
      </Card>

      {money ? (
        <Card title={lb.pay} right={<Pill text={lot.payment.status === 'paid' ? lb.paid : lot.payment.status === 'partial' ? lb.partial : lb.unpaid} color={lot.payment.status === 'paid' ? 'green' : lot.payment.status === 'partial' ? 'orange' : 'red'} small />}>
          <KV label="Thành tiền" value={fmtMoney(ls.amount)} />
          <KV label={lb.kind === 'sell' ? 'Đã thu' : 'Đã thanh toán'} sub={payments.length ? `${payments.length} lần` : undefined} value={fmtMoney(ls.paid)} highlight="green" />
          <KV label={lb.remaining} value={fmtMoney(ls.remaining)} highlight={ls.remaining != null && ls.remaining > 0.5 ? 'red' : 'green'} />
          {payments.map((p) => (
            <Pressable key={p.id} onLongPress={() => { if (p.id === 'legacy') return; haptic('medium'); onDelPay(p.id); }} delayLongPress={600} style={st.payRow}>
              <Ionicons name={p.method === 'cash' ? 'cash-outline' : p.method === 'transfer' ? 'card-outline' : 'ellipsis-horizontal-circle-outline'} size={18} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: C.text }}>{fmtMoney(p.amount)} <Text style={{ color: C.muted, fontWeight: '400', fontSize: 12 }}>{p.method === 'cash' ? 'tiền mặt' : p.method === 'transfer' ? 'chuyển khoản' : 'khác'}</Text></Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDateTime(p.at)}{p.byName ? ` · ${p.byName}` : ''}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn title={lb.kind === 'sell' ? 'Ghi thu tiền' : 'Ghi thanh toán'} kind="success" small icon="add" onPress={onPay} style={{ flex: 1 }} />
            {ls.amount == null || ls.remaining == null || ls.remaining > 0.5 ? (
              <Btn title={lot.payment.status === 'paid' ? (lb.kind === 'sell' ? 'Đánh dấu chưa thu' : 'Đánh dấu chưa TT') : (lb.kind === 'sell' ? 'Đánh dấu đã thu' : 'Đánh dấu đã TT')} kind="ghost" small onPress={() => onSetPayment(lot.payment.status === 'paid' ? 'unpaid' : 'paid')} style={{ flex: 1 }} />
            ) : null}
          </View>
          <KV label="Ghi chú TT" value={lot.payment.note || 'Thêm ghi chú'} {...guarded('paymentNote', lot.id)} />
          {payments.length ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Nhấn giữ một dòng để xoá (ghi vào lịch sử).</Text> : null}
        </Card>
      ) : null}
      {money ? <Btn title={sharing ? 'Đang tạo phiếu...' : `${lb.receiptBtn}${multi ? ' · ' + title : ''}`} kind="secondary" icon="document-text-outline" onPress={onShare} disabled={sharing} style={{ marginBottom: 4 }} /> : null}
    </View>
  );
}

const LOT_COLORS = [C.blue, C.orange, C.green, '#8E44AD', '#C0392B'];

function AddSellerInline({ onAdded, kind = 'buy' }: { onAdded: (id: string) => void; kind?: 'buy' | 'sell' }) {
  const addSeller = useStore((s) => s.addSeller);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const party = kind === 'sell' ? 'khách hàng' : 'người bán';
  return (
    <View>
      <Field label={`Thêm ${party} mới`}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}><Input value={name} onChangeText={setName} placeholder={`Tên ${party}`} /></View>
          <View style={{ flex: 1 }}><Input value={phone} onChangeText={setPhone} placeholder="SĐT" keyboardType="phone-pad" /></View>
        </View>
      </Field>
      <Btn title="Thêm & chọn" kind="secondary" onPress={() => { if (name.trim().length < 2) return toast(`Nhập tên ${party}`, 'err'); onAdded(addSeller({ name, phone, kind: kind === 'sell' ? 'buyer' : 'seller' }).id); }} />
    </View>
  );
}

function AddDriverInline({ onAdded }: { onAdded: (id: string) => void }) {
  const addDriver = useStore((s) => s.addDriver);
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  return (
    <View>
      <Field label="Thêm tài xế mới">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}><Input value={name} onChangeText={setName} placeholder="Tên tài xế" /></View>
          <View style={{ flex: 1 }}><Input value={plate} onChangeText={setPlate} placeholder="Biển số" /></View>
        </View>
      </Field>
      <Btn title="Thêm & chọn" kind="secondary" onPress={() => { if (name.trim().length < 2) return toast('Nhập tên tài xế', 'err'); onAdded(addDriver({ name, plate }).id); }} />
    </View>
  );
}

const st = StyleSheet.create({
  doneCard: { backgroundColor: C.green, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  doneT: { color: '#fff', fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 },
  doneBig: { color: '#fff', fontSize: 30, fontWeight: '800', marginVertical: 6, fontVariant: ['tabular-nums'] },
  doneGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  doneRow: { width: '50%', color: '#fff', fontSize: 13.5, marginBottom: 4 },
  doneK: { color: 'rgba(255,255,255,0.85)' },
  doneV: { fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  lotBlock: { borderLeftWidth: 0, marginBottom: 12, paddingLeft: 0 },
  lotHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 4 },
  lotBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  lotTitle: { fontWeight: '800', fontSize: 16, color: C.text },
  thumbWrap: { width: 96 },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: C.gray },
  thumbLabel: { fontSize: 11, color: C.muted, marginTop: 3, textAlign: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, marginBottom: 8 },
  histLink: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 10, backgroundColor: 'rgba(242,243,247,0.95)' },
});
