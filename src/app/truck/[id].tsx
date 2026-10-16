import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NumPad } from '../../components/NumPad';
import { EditingCell, WeighTable } from '../../components/WeighTable';
import { PaymentSheet } from '../../components/PaymentSheet';
import { Btn, Card, ConfirmSheet, Field, IconBtn, Input, InputSheet, KV, Pill, Sheet, Stats, Toggle, TopBar, haptic } from '../../components/ui';
import { shareReceipt } from '../../lib/receipt';
import { presetOf, truckStats } from '../../lib/calc';
import { presetSummary } from '../../lib/presetText';
import { fmtDateTime, fmtDateVN, fmtKg, fmtMoney, fmtNum, fmtPct, fmtTime, parseNum } from '../../lib/format';
import { activeDrivers, activePresets, activeProducts, activeSellers, activeUsers, activeWarehouses, canSeeMoney, driverName, paymentsOf, photosOfTruck, productName, selectCurrentUser, sellerName, useStore, userName, warehouseName } from '../../lib/store';
import { PHOTO_KINDS, deletePhotoFile, photoUri, takePhoto } from '../../lib/photos';
import { C, shadow } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { PaymentStatus } from '../../lib/types';

type FieldKey = 'price' | 'gram' | 'impurityGram' | 'impurityPct' | 'moisture' | 'paymentNote' | 'note' | 'name' | 'grossIn' | 'tareOut' | 'truckBags';

const FIELDS: Record<FieldKey, { title: string; what: string; path: string[]; unit?: string; keyboard: 'decimal' | 'number' | 'text'; hint?: string }> = {
  name: { title: 'Đổi tên xe', what: 'Tên xe', path: ['name'], keyboard: 'text' },
  price: { title: 'Giá cà phê', what: 'Giá', path: ['price'], unit: 'đ/kg', keyboard: 'number', hint: 'Giá mua theo kg thực nhận' },
  gram: { title: 'Mẫu thử', what: 'Mẫu (g)', path: ['sample', 'gram'], unit: 'g', keyboard: 'decimal', hint: 'Khối lượng mẫu lấy ra để kiểm tra, VD 300' },
  impurityGram: { title: 'Tạp chất trong mẫu', what: 'Tạp (g)', path: ['sample', 'impurityGram'], unit: 'g', keyboard: 'decimal', hint: 'Số gram tạp trong mẫu. App tự tính % tạp = tạp / mẫu' },
  moisture: { title: 'Độ ẩm', what: 'Độ (%)', path: ['sample', 'moisture'], unit: '%', keyboard: 'decimal', hint: 'Độ ẩm đo được của lô hàng' },
  impurityPct: { title: 'Tạp chất', what: 'Tạp (%)', path: ['sample', 'impurityPct'], unit: '%', keyboard: 'decimal', hint: 'Nhập % tạp trực tiếp theo quy ước đang chọn' },
  paymentNote: { title: 'Ghi chú thanh toán', what: 'Ghi chú TT', path: ['payment', 'note'], keyboard: 'text' },
  note: { title: 'Ghi chú xe', what: 'Ghi chú', path: ['note'], keyboard: 'text' },
  grossIn: { title: 'Xe vào (có hàng)', what: 'Cân xe vào (kg)', path: ['truckWeigh', 'grossIn'], unit: 'kg', keyboard: 'decimal', hint: 'Tổng khối lượng xe + hàng khi vào' },
  tareOut: { title: 'Xe ra (rỗng)', what: 'Cân xe ra (kg)', path: ['truckWeigh', 'tareOut'], unit: 'kg', keyboard: 'decimal', hint: 'Khối lượng xe không hàng khi ra' },
  truckBags: { title: 'Số bao', what: 'Số bao', path: ['truckWeigh', 'bags'], unit: 'bao', keyboard: 'number', hint: 'Dùng để trừ bì theo bao (nếu quy ước có)' },
};

export default function TruckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const user = useStore(selectCurrentUser);
  const t = store.trucks[id || ''];
  const [editing, setEditingState] = useState<EditingCell | null>(null);
  const editingRef = useRef<EditingCell | null>(null);
  const setEditing = useCallback((v: EditingCell | null | ((cur: EditingCell | null) => EditingCell | null)) => {
    const next = typeof v === 'function' ? v(editingRef.current) : v;
    editingRef.current = next;
    setEditingState(next);
  }, []);
  const [field, setField] = useState<FieldKey | null>(null);
  const [pickDriver, setPickDriver] = useState(false);
  const [pickWeigher, setPickWeigher] = useState(false);
  const [pickPreset, setPickPreset] = useState(false);
  const [pickSeller, setPickSeller] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [delPay, setDelPay] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pickProduct, setPickProduct] = useState(false);
  const [pickWarehouse, setPickWarehouse] = useState(false);
  const [photoKind, setPhotoKind] = useState<null | 'menu'>(null);
  const [delPhoto, setDelPhoto] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [askMode, setAskMode] = useState<'bags' | 'truck' | null>(null);
  const [askDone, setAskDone] = useState(false);
  const [askReopen, setAskReopen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const s = useMemo(() => (t ? truckStats(t) : null), [t]);
  const truckId = id || '';
  const photosAll = store.photos;
  const photos = useMemo(() => photosOfTruck({ photos: photosAll } as any, truckId), [photosAll, truckId]);

  /* ---------- nhập ô cân (hooks phải đứng trước mọi return) ---------- */
  const commit = useCallback((e: EditingCell): boolean => {
    const v = e.text.trim() === '' ? null : parseNum(e.text);
    if (v !== null && (v === undefined || isNaN(v as number))) { toast('Số không hợp lệ', 'err'); return false; }
    useStore.getState().setCell(truckId, e.tableIdx, e.col, e.row, v === null ? null : Math.round((v as number) * 10) / 10);
    return true;
  }, [truckId]);

  const onCellPress = useCallback((ti: number, c: number, r: number) => {
    const tr = useStore.getState().trucks[truckId];
    if (!tr) return;
    if (tr.status === 'done') return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.');
    if (tr.tables[ti].locked) return toast('Bảng đang khoá. Bấm “Khoá” để mở.');
    const cur = editingRef.current;
    if (cur && cur.tableIdx === ti && cur.col === c && cur.row === r) return;
    if (cur) commit(cur);
    if (tr.tables[ti].cells[c][r] != null) { toast('Nhấn giữ ô để sửa số đã nhập'); setEditing(null); return; }
    haptic();
    setEditing({ tableIdx: ti, col: c, row: r, text: '' });
  }, [truckId, commit, setEditing]);

  const onCellLongPress = useCallback((ti: number, c: number, r: number) => {
    const tr = useStore.getState().trucks[truckId];
    if (!tr) return;
    if (tr.status === 'done') return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.');
    if (tr.tables[ti].locked) return toast('Bảng đang khoá. Bấm “Khoá” để mở.');
    const v = tr.tables[ti].cells[c][r];
    if (v == null) return;
    haptic('medium');
    const cur = editingRef.current;
    if (cur) commit(cur);
    setEditing({ tableIdx: ti, col: c, row: r, text: fmtNum(v) });
    toast('Đang sửa – thay đổi sẽ được lưu vào lịch sử');
  }, [truckId, commit, setEditing]);

  const onToggleLock = useCallback((ti: number) => {
    const st = useStore.getState();
    const tr = st.trucks[truckId];
    if (!tr) return;
    haptic();
    const cur = editingRef.current;
    if (cur && cur.tableIdx === ti) { commit(cur); setEditing(null); }
    useStore.getState().setTableLocked(truckId, ti, !tr.tables[ti].locked);
  }, [truckId, commit, setEditing]);

  const editingValid = !editing || (!!t && editing.tableIdx < t.tables.length && (t.weighMode || 'bags') !== 'truck' && t.status !== 'done');
  useEffect(() => { if (!editingValid) setEditing(null); }, [editingValid, setEditing]);
  // rời màn hình bằng vuốt lùi / nút back: vẫn lưu số đang nhập
  useEffect(() => () => { const cur = editingRef.current; if (cur) { commit(cur); editingRef.current = null; } }, [commit]);
  const photoUris = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, photoUri(p)])), [photos]);

  if (!t || t.deleted || !s) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title="Không tìm thấy xe" onBack={() => router.back()} />
      </View>
    );
  }

  const readOnly = t.status === 'done';
  const allLocked = t.tables.every((tb) => tb.locked);
  const preset = presetOf(t);
  const presets = activePresets(store);
  const money = canSeeMoney(store);
  const isTruckMode = (t.weighMode || 'bags') === 'truck';
  const addPhoto = async (kind: typeof PHOTO_KINDS[number]['v'], fromLibrary: boolean) => {
    setPhotoKind(null);
    try { const p = await takePhoto(t.id, kind, fromLibrary); if (p) { haptic('success'); toast('Đã thêm ảnh', 'ok'); } }
    catch (e: any) { toast(e?.message || String(e), 'err', 3000); }
  };

  const onKey = (k: string) => setEditing((e) => {
    if (!e) return e;
    if (k === 'back') return { ...e, text: e.text.slice(0, -1) };
    if (k === 'clear') return { ...e, text: '' };
    if (k === '.' && (e.text.includes('.') || e.text === '')) return k === '.' && e.text === '' ? { ...e, text: '0.' } : e;
    if (e.text.length >= 8) return e;
    if (e.text.includes('.') && e.text.split('.')[1].length >= 1) return e; // 1 số lẻ
    return { ...e, text: e.text + k };
  });

  const findNextEmpty = (e: EditingCell): EditingCell | null => {
    const tr = useStore.getState().trucks[t.id];
    for (let ti = e.tableIdx; ti < tr.tables.length; ti++) {
      const tb = tr.tables[ti];
      if (tb.locked) continue;
      for (let c = 0; c < tb.cells.length; c++) {
        for (let r = 0; r < tb.cells[c].length; r++) {
          const after = ti > e.tableIdx || c > e.col || (c === e.col && r > e.row);
          if (after && tb.cells[c][r] == null) return { tableIdx: ti, col: c, row: r, text: '' };
        }
      }
    }
    return null;
  };
  const onNext = () => { if (!editing) return; if (!commit(editing)) return; const n = findNextEmpty(editing); setEditing(n); if (!n) toast('Đã hết ô trống. Bấm “Thêm bảng” nếu cần.'); };
  const onDone = () => { if (!editing) return; if (commit(editing)) setEditing(null); };

  /* ---------- trường có bảo vệ (nhấn giữ để sửa) ---------- */
  const fieldValue = (k: FieldKey): unknown => { let o: any = t; for (const p of FIELDS[k].path) o = o?.[p]; return o; };
  const guarded = (k: FieldKey) => {
    const v = fieldValue(k);
    const empty = v == null || v === '';
    const locked = readOnly && k !== 'paymentNote'; // thanh toán vẫn ghi được sau khi xong xe
    return {
      empty,
      onPress: () => {
        if (locked) return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.');
        if (empty) setField(k); else toast('Nhấn giữ để sửa');
      },
      onLongPress: () => { if (locked) return toast('Xe đã xong. Nhấn giữ “Đã xong” để mở lại.'); haptic('medium'); setField(k); },
    };
  };
  const saveField = (text: string) => {
    if (!field) return;
    const f = FIELDS[field];
    let v: unknown;
    if (f.keyboard === 'text') v = text.trim();
    else { const n = parseNum(text); if (n !== null && isNaN(n)) return toast('Số không hợp lệ', 'err'); v = n; }
    if (field === 'name' && !v) return toast('Tên không được trống', 'err');
    store.setField(t.id, f.what, f.path, v);
    setField(null);
    haptic('success');
  };

  const setPayment = (st: PaymentStatus) => store.setField(t.id, 'Thanh toán', ['payment', 'status'], st, 'status');
  const payments = paymentsOf(t);
  const doShare = async () => {
    if (sharing) return;
    setSharing(true);
    try { await shareReceipt(t, store); } catch (e: any) { toast('Không tạo được phiếu: ' + (e?.message || e), 'err', 3500); } finally { setSharing(false); }
  };

  const title = t.name;
  const cellLabel = editing && t.tables[editing.tableIdx] ? `${t.tables[editing.tableIdx].name} · Cột ${editing.col + 1} · Bao ${editing.row + 1}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={title} subtitle={`${fmtDateVN(t.date)} · tạo ${fmtTime(t.createdAt)}${t.createdByName ? ' · ' + t.createdByName : ''}`}
        onBack={() => { if (editing) commit(editing); router.back(); }}
        onTitlePress={readOnly ? undefined : () => setField('name')}
        right={
          <>
            <IconBtn name={allLocked ? 'lock-closed' : 'lock-open-outline'} color={allLocked ? 'gray' : 'blue'} onPress={() => { if (readOnly) return toast('Xe đã xong'); haptic(); const cur = editingRef.current; if (cur) commit(cur); setEditing(null); store.lockAllTables(t.id, !allLocked); }} />
            {money ? <IconBtn name="share-outline" color="green" onPress={doShare} /> : null}
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
              <Text style={st.doneRow}><Text style={st.doneK}>Tạp </Text><Text style={st.doneV}>{s.impurityPct != null ? fmtPct(s.impurityPct) : '—'}</Text></Text>
              <Text style={st.doneRow}><Text style={st.doneK}>Độ </Text><Text style={st.doneV}>{s.moistureVal != null ? fmtPct(s.moistureVal, 1) : '—'}</Text></Text>
              {money ? (
                <>
                  <Text style={st.doneRow}><Text style={st.doneK}>Giá </Text><Text style={st.doneV}>{s.effectivePrice != null ? fmtMoney(s.effectivePrice) + '/kg' : '—'}</Text></Text>
                  <Text style={st.doneRow}><Text style={st.doneK}>Thành tiền </Text><Text style={st.doneV}>{fmtMoney(s.amount)}</Text></Text>
                  <Text style={st.doneRow}><Text style={st.doneK}>Đã TT </Text><Text style={st.doneV}>{fmtMoney(s.paid)}</Text></Text>
                  <Text style={st.doneRow}><Text style={st.doneK}>Còn lại </Text><Text style={st.doneV}>{fmtMoney(s.remaining)}</Text></Text>
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
            {readOnly ? <Pill text="Đã xong" color="green" icon="checkmark-circle" small /> : <Pill text="Đang cân" color="orange" icon="time-outline" small />}
            <View style={{ flex: 1 }} />
            <Toggle value={t.loaded ? 'yes' : 'no'} onChange={(v) => store.setLoaded(t.id, v === 'yes')}
              options={[{ v: 'no', label: 'Chưa bốc', color: 'red' }, { v: 'yes', label: 'Đã bốc', color: 'green' }]} />
          </View>
          <KV label="Người bán" value={sellerName(store, t.sellerId) || 'Chọn người bán'} empty={!t.sellerId} onPress={() => !readOnly && setPickSeller(true)} />
          <KV label="Tài xế" value={driverName(store, t.driverId) || 'Chọn tài xế'} empty={!t.driverId} onPress={() => !readOnly && setPickDriver(true)} />
          <KV label="Loại hàng" value={productName(store, t.productId) || 'Chọn loại hàng'} empty={!t.productId} onPress={() => !readOnly && setPickProduct(true)} />
          <KV label="Nhập kho" value={warehouseName(store, t.warehouseId) || 'Chọn kho'} empty={!t.warehouseId} onPress={() => !readOnly && setPickWarehouse(true)} />
          <KV label="Nhân viên đi cân" value={userName(store, t.weigherId) || 'Chọn nhân viên'} empty={!t.weigherId} onPress={() => !readOnly && setPickWeigher(true)} />
          <KV label="Giờ tạo xe" sub={t.createdByName ? `bởi ${t.createdByName}` : undefined} value={fmtDateTime(t.createdAt)} />
          {t.loaded && t.loadedAt ? <KV label="Bốc hàng lúc" value={fmtDateTime(t.loadedAt)} /> : null}
          <KV label="Ghi chú" value={t.note || 'Thêm ghi chú'} {...guarded('note')} />
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
            <KV label="Hàng (vào − ra)" value={fmtKg(s.gross)} unit="kg" highlight="blue" />
            <KV label="Số bao" value={t.truckWeigh?.bags != null ? String(t.truckWeigh.bags) : 'Nhập'} unit={t.truckWeigh?.bags != null ? 'bao' : undefined} {...guarded('truckBags')} />
          </Card>
        ) : (
          <>
            {t.tables.map((tb, i) => (
              <WeighTable key={tb.id} table={tb} tableIdx={i} editing={editing && editing.tableIdx === i ? editing : null} readOnly={readOnly}
                onCellPress={onCellPress} onCellLongPress={onCellLongPress} onToggleLock={onToggleLock} />
            ))}
            {!readOnly ? (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <Btn title="Thêm bảng" kind="secondary" icon="add" small onPress={() => { haptic(); store.addTable(t.id); }} style={{ flex: 1 }} />
                <Btn title="Bớt bảng" kind="ghost" icon="remove" small onPress={() => { const cur = editingRef.current; if (cur) { commit(cur); setEditing(null); } if (!store.removeLastTable(t.id)) toast('Chỉ bớt được bảng cuối khi bảng đó trống', 'err'); else haptic(); }} style={{ flex: 1 }} />
              </View>
            ) : null}
          </>
        )}

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

        {/* Chất lượng & giá */}
        <Card title="Chất lượng & giá" right={<Text style={{ fontSize: 11, color: C.muted }}>nhấn giữ để sửa</Text>}>
          <KV label="Quy ước tạp độ" sub={presetSummary(preset)} value={preset.name} onPress={() => { if (readOnly) return toast('Xe đã xong'); setPickPreset(true); }} />
          {preset.impurityInput === 'gram' ? (
            <>
              <KV label="Mẫu" value={t.sample.gram != null ? fmtNum(t.sample.gram) : 'Nhập'} unit={t.sample.gram != null ? 'g' : undefined} {...guarded('gram')} />
              <KV label="Tạp" sub={s.impurityPct != null ? `= ${fmtPct(s.impurityPct)} · ${s.impurity.label}` : undefined} value={t.sample.impurityGram != null ? fmtNum(t.sample.impurityGram) : 'Nhập'} unit={t.sample.impurityGram != null ? 'g' : undefined} {...guarded('impurityGram')} />
            </>
          ) : (
            <KV label="Tạp" sub={s.impurityPct != null ? s.impurity.label : undefined} value={t.sample.impurityPct != null ? fmtNum(t.sample.impurityPct, 2) : 'Nhập'} unit={t.sample.impurityPct != null ? '%' : undefined} {...guarded('impurityPct')} />
          )}
          <KV label="Độ" sub={s.moistureVal != null ? s.moisture.label : undefined} value={t.sample.moisture != null ? fmtNum(t.sample.moisture) : 'Nhập'} unit={t.sample.moisture != null ? '%' : undefined} {...guarded('moisture')} />
          {s.tare > 0 ? <KV label="Trừ bì" sub={preset.tareMode === 'perBag' ? `${fmtNum(preset.tareValue, 2)} kg × ${s.bags} bao` : `${fmtNum(preset.tareValue, 2)}% tổng thô`} value={'−' + fmtKg(s.tare)} unit="kg" /> : null}
          {s.impurity.kg > 0 ? <KV label="Trừ tạp" value={'−' + fmtKg(s.impurity.kg)} unit="kg" /> : null}
          {s.moisture.kg > 0 ? <KV label="Trừ độ" value={'−' + fmtKg(s.moisture.kg)} unit="kg" /> : null}
          <KV label="Thực nhận" value={fmtKg(s.net)} unit="kg" highlight="green" />
          {money ? (
            <>
              <KV label="Giá" value={t.price != null ? fmtMoney(t.price) : 'Nhập giá'} unit={t.price != null ? '/kg' : undefined} {...guarded('price')} />
              {s.priceDeduct > 0 ? <KV label="Giá sau trừ" sub={`trừ ${fmtMoney(s.priceDeduct)}/kg (tạp ${fmtMoney(s.impurity.price)} + độ ${fmtMoney(s.moisture.price)})`} value={fmtMoney(s.effectivePrice)} unit="/kg" /> : null}
              <KV label="Thành tiền" value={fmtMoney(s.amount)} highlight="blue" />
            </>
          ) : null}
        </Card>

        {/* Thanh toán */}
        {money ? <Card title="Thanh toán" right={<Pill text={t.payment.status === 'paid' ? 'Đã thanh toán' : t.payment.status === 'partial' ? 'Một phần' : 'Chưa thanh toán'} color={t.payment.status === 'paid' ? 'green' : t.payment.status === 'partial' ? 'orange' : 'red'} small />}>
          <KV label="Thành tiền" value={fmtMoney(s.amount)} />
          <KV label="Đã thanh toán" sub={payments.length ? `${payments.length} lần` : undefined} value={fmtMoney(s.paid)} highlight="green" />
          <KV label="Còn lại" value={fmtMoney(s.remaining)} highlight={s.remaining != null && s.remaining > 0.5 ? 'red' : 'green'} />
          {payments.map((p) => (
            <Pressable key={p.id} onLongPress={() => { if (p.id === 'legacy') return; haptic('medium'); setDelPay(p.id); }} delayLongPress={600} style={st.payRow}>
              <Ionicons name={p.method === 'cash' ? 'cash-outline' : p.method === 'transfer' ? 'card-outline' : 'ellipsis-horizontal-circle-outline'} size={18} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: C.text }}>{fmtMoney(p.amount)} <Text style={{ color: C.muted, fontWeight: '400', fontSize: 12 }}>{p.method === 'cash' ? 'tiền mặt' : p.method === 'transfer' ? 'chuyển khoản' : 'khác'}</Text></Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDateTime(p.at)}{p.byName ? ` · ${p.byName}` : ''}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn title="Ghi thanh toán" kind="success" small icon="add" onPress={() => setPayOpen(true)} style={{ flex: 1 }} />
            {s.amount == null || s.remaining == null || s.remaining > 0.5 ? (
              <Btn title={t.payment.status === 'paid' ? 'Đánh dấu chưa TT' : 'Đánh dấu đã TT'} kind="ghost" small onPress={() => setPayment(t.payment.status === 'paid' ? 'unpaid' : 'paid')} style={{ flex: 1 }} />
            ) : null}
          </View>
          <KV label="Ghi chú TT" value={t.payment.note || 'Thêm ghi chú'} {...guarded('paymentNote')} />
          {payments.length ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Nhấn giữ một dòng thanh toán để xoá (ghi vào lịch sử).</Text> : null}
        </Card> : null}

        {money ? <Btn title={sharing ? 'Đang tạo phiếu...' : 'Phiếu cân (PDF) gửi Zalo'} kind="secondary" icon="document-text-outline" onPress={doShare} disabled={sharing} style={{ marginBottom: 12 }} /> : null}

        <Pressable onPress={() => router.push(`/history/${t.id}`)} style={[st.histLink, shadow]}>
          <Ionicons name="time-outline" size={18} color={C.blue} />
          <Text style={{ fontWeight: '700', color: C.blue, flex: 1 }}>Lịch sử sửa ({t.history.length})</Text>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      </ScrollView>

      {/* Nút dưới */}
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

      {/* Sheets */}
      <InputSheet visible={!!field} onClose={() => setField(null)} title={field ? FIELDS[field].title : ''} label={field ? FIELDS[field].what : undefined}
        hint={field ? FIELDS[field].hint : undefined} unit={field ? FIELDS[field].unit : undefined} keyboard={field ? FIELDS[field].keyboard : 'text'}
        big={field ? FIELDS[field].keyboard !== 'text' : false}
        initial={field ? (() => { const v = fieldValue(field); return v == null ? '' : String(v); })() : ''} onSave={saveField} />

      <Sheet visible={pickDriver} onClose={() => setPickDriver(false)} title="Chọn tài xế" desc="Thêm/sửa tài xế trong Cài đặt → Tài xế">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeDrivers(store).map((d) => <Pill key={d.id} text={d.name + (d.plate ? ` · ${d.plate}` : '')} color={t.driverId === d.id ? 'blue' : 'gray'}
            onPress={() => { store.setField(t.id, 'Tài xế', ['driverId'], d.id); setPickDriver(false); }} />)}
          {activeDrivers(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có tài xế nào.</Text> : null}
        </View>
        <AddDriverInline onAdded={(id) => { store.setField(t.id, 'Tài xế', ['driverId'], id); setPickDriver(false); }} />
      </Sheet>

      <Sheet visible={pickWeigher} onClose={() => setPickWeigher(false)} title="Nhân viên đi cân">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeUsers(store).map((u) => <Pill key={u.id} text={u.name} color={t.weigherId === u.id ? 'blue' : 'gray'}
            onPress={() => { store.setField(t.id, 'Nhân viên cân', ['weigherId'], u.id); setPickWeigher(false); }} />)}
        </View>
      </Sheet>

      <Sheet visible={pickSeller} onClose={() => setPickSeller(false)} title="Chọn người bán" desc="Quản lý danh sách trong Cài đặt → Người bán">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeSellers(store).map((d) => <Pill key={d.id} text={d.name + (d.phone ? ` · ${d.phone}` : '')} color={t.sellerId === d.id ? 'blue' : 'gray'}
            onPress={() => { store.setField(t.id, 'Người bán', ['sellerId'], d.id); setPickSeller(false); }} />)}
          {activeSellers(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có người bán nào.</Text> : null}
        </View>
        <AddSellerInline onAdded={(id) => { store.setField(t.id, 'Người bán', ['sellerId'], id); setPickSeller(false); }} />
      </Sheet>

      <Sheet visible={pickProduct} onClose={() => setPickProduct(false)} title="Loại hàng" desc="Chọn loại hàng cũng áp dụng quy ước tạp độ gắn với loại đó (nếu có). Quản lý trong Cài đặt → Loại hàng.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeProducts(store).map((d) => <Pill key={d.id} text={d.name} color={t.productId === d.id ? 'blue' : 'gray'}
            onPress={() => { store.setField(t.id, 'Loại hàng', ['productId'], d.id); if (d.presetId && store.presets[d.presetId] && !store.presets[d.presetId].deleted && preset.id !== d.presetId) store.applyPreset(t.id, d.presetId); setPickProduct(false); }} />)}
          {activeProducts(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có loại hàng. Thêm trong Cài đặt → Loại hàng.</Text> : null}
        </View>
        <Btn title="Quản lý loại hàng" kind="secondary" small onPress={() => { setPickProduct(false); router.push('/settings/products'); }} />
      </Sheet>
      <Sheet visible={pickWarehouse} onClose={() => setPickWarehouse(false)} title="Nhập vào kho">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {activeWarehouses(store).map((d) => <Pill key={d.id} text={d.name} color={t.warehouseId === d.id ? 'blue' : 'gray'}
            onPress={() => { store.setField(t.id, 'Kho', ['warehouseId'], d.id); setPickWarehouse(false); }} />)}
          {activeWarehouses(store).length === 0 ? <Text style={{ color: C.muted }}>Chưa có kho. Thêm trong Cài đặt → Kho.</Text> : null}
        </View>
        <Btn title="Quản lý kho" kind="secondary" small onPress={() => { setPickWarehouse(false); router.push('/settings/warehouses'); }} />
      </Sheet>
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
        {viewPhoto && store.photos[viewPhoto] ? (() => { const p = store.photos[viewPhoto]; const uri = photoUri(p) || (p.driveUrl ? driveThumb(p.driveUrl, 1600) : null); return (
          <>
            {uri ? <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: C.gray }} resizeMode="contain" /> : <Text style={{ color: C.muted }}>Ảnh chưa có trên máy này và chưa được tải lên Google Drive.</Text>}
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>{p.byName ? `${p.byName} · ` : ''}{fmtDateTime(p.createdAt)}{p.driveUrl ? ' · đã lưu Google Drive' : ' · chưa tải lên'}</Text>
            {p.driveUrl ? <Btn title="Mở trên Google Drive" kind="ghost" small icon="open-outline" onPress={() => Linking.openURL(p.driveUrl!).catch(() => toast('Không mở được liên kết', 'err'))} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
          </>); })() : null}
      </Sheet>
      <ConfirmSheet visible={!!delPhoto} onClose={() => setDelPhoto(null)} title="Xoá ảnh này?" danger confirmText="Xoá" onConfirm={() => { if (delPhoto) { const p = store.photos[delPhoto]; if (p) deletePhotoFile(p); store.removePhoto(delPhoto); } setDelPhoto(null); }} />
      <ConfirmSheet visible={!!askMode} onClose={() => setAskMode(null)} title={askMode === 'truck' ? 'Chuyển sang cân xe tải?' : 'Chuyển sang cân từng bao?'}
        desc={askMode === 'truck' ? 'Tổng thô sẽ tính bằng cân xe vào trừ cân xe ra. Các bảng bao được giữ nhưng không tính.' : 'Tổng thô sẽ tính từ các bảng bao.'} confirmText="Chuyển"
        onConfirm={() => { const cur = editingRef.current; if (cur) commit(cur); setEditing(null); if (askMode) store.setWeighMode(t.id, askMode); setAskMode(null); }} />

      <PaymentSheet truckId={payOpen ? t.id : null} onClose={() => setPayOpen(false)} />
      <ConfirmSheet visible={!!delPay} onClose={() => setDelPay(null)} title="Xoá lần thanh toán này?" danger confirmText="Xoá" desc="Số tiền sẽ được cộng lại vào còn nợ. Việc xoá ghi vào lịch sử."
        onConfirm={() => { if (delPay) store.removePayment(t.id, delPay); setDelPay(null); }} />

      <Sheet visible={pickPreset} onClose={() => setPickPreset(false)} title="Chọn quy ước tạp độ" desc="Thêm/sửa quy ước trong Cài đặt → Quy ước tạp độ. Xe lưu bản sao quy ước tại thời điểm chọn.">
        {presets.map((p) => (
          <Pressable key={p.id} onPress={() => { store.applyPreset(t.id, p.id); setPickPreset(false); haptic('success'); }}
            style={({ pressed }) => [st.presetRow, preset.id === p.id && { borderColor: C.blue, backgroundColor: C.blueSoft }, pressed && { opacity: 0.7 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.text }}>{p.name}{p.isDefault ? '  · mặc định' : ''}</Text>
              <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{presetSummary(p)}</Text>
            </View>
            {preset.id === p.id ? <Ionicons name="checkmark-circle" size={22} color={C.blue} /> : null}
          </Pressable>
        ))}
        {presets.length === 0 ? <Text style={{ color: C.muted }}>Chưa có quy ước nào.</Text> : null}
        <Btn title="Quản lý quy ước" kind="secondary" icon="options" onPress={() => { setPickPreset(false); router.push('/settings/presets'); }} style={{ marginTop: 8 }} />
      </Sheet>

      <ConfirmSheet visible={askDone} onClose={() => setAskDone(false)} title={`Xong ${t.name}?`} confirmText="Xác nhận xong xe"
        desc="Các bảng sẽ bị khoá. Muốn sửa lại phải nhấn giữ để mở xe." onConfirm={() => { setAskDone(false); if (editing) commit(editing); setEditing(null); store.markDone(t.id, true); haptic('success'); toast(`${t.name} đã xong · ${fmtKg(s.gross)} kg`, 'ok', 2500); }}>
        <Card style={{ backgroundColor: C.bg, shadowOpacity: 0, elevation: 0 }}>
          <KV label="Tổng bao" value={String(s.bags)} />
          <KV label="Tổng thô" value={fmtKg(s.gross)} unit="kg" />
          <KV label="Thực nhận" value={fmtKg(s.net)} unit="kg" highlight="green" />
          {money ? <KV label="Thành tiền" value={fmtMoney(s.amount)} highlight="blue" /> : null}
          <KV label="Người bán" value={sellerName(store, t.sellerId) || '—'} />
          <KV label="Tài xế" value={driverName(store, t.driverId) || '—'} />
          <KV label="Nhân viên cân" value={userName(store, t.weigherId) || '—'} />
          <KV label="Người xác nhận" value={user?.name || '—'} />
        </Card>
      </ConfirmSheet>

      <ConfirmSheet visible={askReopen} onClose={() => setAskReopen(false)} title="Mở lại xe để sửa?" confirmText="Mở lại"
        desc="Việc mở lại sẽ được ghi vào lịch sử." onConfirm={() => { setAskReopen(false); store.markDone(t.id, false); store.lockAllTables(t.id, false); toast('Đã mở lại xe'); }} />

      <ConfirmSheet visible={askDelete} onClose={() => setAskDelete(false)} title={`Xoá ${t.name}?`} confirmText="Xoá xe" danger
        desc={user?.role === 'admin' ? 'Xe sẽ bị ẩn khỏi danh sách (vẫn còn trên Google Sheets với trạng thái đã xoá).' : 'Chỉ quản lý mới được xoá xe.'}
        onConfirm={() => { if (user?.role !== 'admin') { setAskDelete(false); return toast('Chỉ quản lý mới được xoá xe', 'err'); } setAskDelete(false); store.removeTruck(t.id); router.back(); }} />
    </View>
  );
}

/** Link xem ảnh Google Drive (uc?export=view) từ link share */
function driveThumb(url: string, size = 400): string {
  const m = url.match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w${size}` : url;
}

function AddSellerInline({ onAdded }: { onAdded: (id: string) => void }) {
  const addSeller = useStore((s) => s.addSeller);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <View>
      <Field label="Thêm người bán mới">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}><Input value={name} onChangeText={setName} placeholder="Tên người bán" /></View>
          <View style={{ flex: 1 }}><Input value={phone} onChangeText={setPhone} placeholder="SĐT" keyboardType="phone-pad" /></View>
        </View>
      </Field>
      <Btn title="Thêm & chọn" kind="secondary" onPress={() => { if (name.trim().length < 2) return toast('Nhập tên người bán', 'err'); onAdded(addSeller({ name, phone }).id); }} />
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
  thumbWrap: { width: 96 },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: C.gray },
  thumbLabel: { fontSize: 11, color: C.muted, marginTop: 3, textAlign: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, marginBottom: 8 },
  histLink: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 10, backgroundColor: 'rgba(242,243,247,0.95)' },
});
