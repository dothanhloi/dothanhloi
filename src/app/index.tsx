import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, ConfirmSheet, Empty, Field, IconBtn, Input, InputSheet, Pill, Sheet, Stats, TopBar, haptic } from '../components/ui';
import { dayStats, truckStats } from '../lib/calc';
import { addDays, fmtDateShort, fmtDateVN, fmtKg, fmtMoney, fmtTime, fmtWeekday, todayStr } from '../lib/format';
import { activeDrivers, activeProducts, activeSellers, activeUsers, activeWarehouses, canSeeMoney, datesWithTrucks, dayPriceOf, driverName, selectCurrentUser, sellerName, useStore, userName } from '../lib/store';
import { reminders } from '../lib/reports';
import { getSyncStatus, onSyncStatus, SyncStatus, syncNow } from '../lib/sync';
import { C, shadow } from '../lib/theme';
import { toast } from '../lib/toast';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore(selectCurrentUser);
  const store = useStore();
  const allTrucks = store.trucks;
  const [date, setDate] = useState(todayStr());
  const trucks = useMemo(() => Object.values(allTrucks).filter((t) => !t.deleted && t.date === date).sort((a, b) => a.seq - b.seq), [allTrucks, date]);
  const dates = useMemo(() => datesWithTrucks({ trucks: allTrucks } as any), [allTrucks]);
  const ds = useMemo(() => dayStats(trucks), [trucks]);
  const [create, setCreate] = useState(false);
  const [logoutAsk, setLogoutAsk] = useState(false);
  const [editPrice, setEditPrice] = useState(false);
  const dayPrice = dayPriceOf(store, date);
  const money = canSeeMoney(store);
  const isAdmin = user?.role === 'admin';
  const [showRem, setShowRem] = useState(false);
  const rems = useMemo(() => reminders(store), [store]);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setSync), []);

  const isToday = date === todayStr();
  const nextSeq = Object.values(store.trucks).filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.seq || 0), 0) + 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        title="Cân Cà Phê"
        left={
          <Pressable onPress={() => setLogoutAsk(true)} style={st.userchip}>
            <Avatar name={user?.name || '?'} size={24} bg={C.blue} fg="#fff" />
            <Text style={st.userchipText} numberOfLines={1}>{user?.name}</Text>
          </Pressable>
        }
        right={
          <>
            <IconBtn name={sync.state === 'error' ? 'cloud-offline-outline' : sync.state === 'syncing' ? 'sync' : sync.state === 'ok' ? 'cloud-done-outline' : 'cloud-outline'}
              color={sync.state === 'error' ? 'red' : sync.state === 'ok' ? 'green' : 'gray'}
              onPress={async () => { const r = await syncNow(); if (r.ok) toast(`Đã đồng bộ: gửi ${r.pushed}, nhận ${r.received}`, 'ok'); else if ('off' in r) router.push('/settings/google'); else if ('error' in r) toast(r.error, 'err', 3500); }} />
            <IconBtn name="search-outline" color="gray" onPress={() => router.push('/search')} />
            <IconBtn name="settings-outline" color="blue" onPress={() => router.push('/settings')} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 100 }}>
        {/* Chọn ngày */}
        <View style={st.datebar}>
          <IconBtn name="chevron-back" onPress={() => setDate(addDays(date, -1))} />
          <Pressable onPress={() => setDate(todayStr())} style={[st.dateBox, shadow]}>
            <Text style={st.dateText}>{fmtDateVN(date)}</Text>
            <Text style={st.dateSub}>{fmtWeekday(date)}{isToday ? ' · Hôm nay' : ''}</Text>
          </Pressable>
          <IconBtn name="chevron-forward" onPress={() => setDate(addDays(date, 1))} />
        </View>
        {dates.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
            {(dates.some((d) => d.date === todayStr()) ? dates : [{ date: todayStr(), count: 0 }, ...dates]).slice(0, 30).map((d) => (
              <Pressable key={d.date} onPress={() => { haptic(); setDate(d.date); }} style={[st.chip, shadow, d.date === date && st.chipOn]}>
                <Text style={[st.chipText, d.date === date && { color: '#fff' }]}>{d.date === todayStr() ? 'Hôm nay' : fmtDateShort(d.date)}{d.count ? ` · ${d.count} xe` : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          <Pill text="Báo cáo" icon="bar-chart-outline" color="gray" small onPress={() => router.push('/reports')} />
          {money ? <Pill text="Công nợ" icon="wallet-outline" color="gray" small onPress={() => router.push('/debts')} /> : null}
          <Pill text="Tồn kho" icon="cube-outline" color="gray" small onPress={() => router.push('/inventory')} />
          <Pill text="Người bán" icon="person-outline" color="gray" small onPress={() => router.push('/settings/sellers')} />
          {rems.length ? <Pill text={`Nhắc việc (${rems.length})`} icon="notifications-outline" color="orange" small onPress={() => setShowRem((v) => !v)} /> : null}
        </ScrollView>
        {showRem && rems.length ? (
          <View style={[st.remBox, shadow]}>
            {rems.map((r, i) => (
              <Pressable key={i} onPress={() => { if (r.truckId) router.push(`/truck/${r.truckId}`); else if (r.sellerId && money) router.push(`/debts/${r.sellerId}`); }} style={st.remRow}>
                <Ionicons name={r.kind === 'overdue' ? 'alert-circle' : r.kind === 'unfinished' ? 'time' : r.kind === 'noprice' ? 'pricetag' : 'cube'} size={16} color={r.kind === 'overdue' ? C.red : C.orange} />
                <Text style={{ flex: 1, fontSize: 13, color: C.text }}>{(!money && r.kind === 'overdue') ? 'Có công nợ quá hạn (hỏi quản lý)' : r.text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {money ? <Pressable onPress={() => { if (!isAdmin && !money) return; setEditPrice(true); }} style={({ pressed }) => [st.priceBar, shadow, pressed && { opacity: 0.7 }]}>
          <Ionicons name="pricetag-outline" size={18} color={dayPrice?.price != null ? C.green : C.muted} />
          <Text style={{ flex: 1, color: C.muted, fontSize: 13 }}>Giá tham chiếu ngày {fmtDateShort(date)}{dayPrice?.note ? ` · ${dayPrice.note}` : ''}</Text>
          <Text style={[st.priceVal, dayPrice?.price == null && { color: C.blue, fontSize: 14 }]}>{dayPrice?.price != null ? fmtMoney(dayPrice.price) + '/kg' : 'Nhập giá'}</Text>
        </Pressable> : null}

        <Stats items={[
          { icon: 'car-outline', color: C.blue, value: `${ds.done}/${ds.trucks}`, label: 'Xe xong' },
          { icon: 'cube-outline', color: C.blue, value: String(ds.bags), label: 'Tổng bao' },
          { icon: 'scale-outline', color: C.green, value: fmtKg(ds.gross), unit: 'kg', label: 'Tổng thô' },
        ]} />
        {money && ds.amount > 0 ? (
          <Stats items={[
            { icon: 'leaf-outline', color: C.green, value: fmtKg(ds.net), unit: 'kg', label: 'Thực nhận' },
            { icon: 'cash-outline', color: C.orange, value: fmtMoney(ds.amount), label: 'Thành tiền' },
            { icon: 'wallet-outline', color: C.red, value: fmtMoney(ds.amount - ds.paid), label: 'Còn lại' },
          ]} />
        ) : null}

        {trucks.length === 0 ? (
          <Empty icon="car-outline" text={`Chưa có xe nào ngày ${fmtDateVN(date)}`} sub="Bấm “Tạo xe” để bắt đầu cân" />
        ) : trucks.map((t) => {
          const s = truckStats(t);
          const done = t.status === 'done';
          return (
            <Pressable key={t.id} onPress={() => router.push(`/truck/${t.id}`)} style={({ pressed }) => [st.truck, shadow, pressed && { opacity: 0.7 }]}>
              <View style={[st.seq, done && { backgroundColor: C.green }]}>
                <Text style={st.seqSmall}>XE</Text>
                <Text style={st.seqNum}>{t.seq}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={st.truckName}>{t.name}</Text>
                  {done ? <Pill text="Đã xong" color="green" small icon="checkmark-circle" /> : <Pill text="Đang cân" color="orange" small icon="time-outline" />}
                  {t.loaded ? <Pill text="Đã bốc" color="blue" small /> : null}
                  {money && t.payment.status === 'paid' ? <Pill text="Đã TT" color="green" small /> : money && t.payment.status === 'partial' ? <Pill text="TT 1 phần" color="orange" small /> : null}
                  {(t.weighMode || 'bags') === 'truck' ? <Pill text="Xe tải" color="gray" small /> : null}
                </View>
                <Text style={st.truckSub} numberOfLines={2}>
                  {sellerName(store, t.sellerId) ? `${sellerName(store, t.sellerId)} · ` : ''}{driverName(store, t.driverId) ? `TX ${driverName(store, t.driverId)} · ` : ''}
                  Cân: {userName(store, t.weigherId) || '—'} · Tạo {fmtTime(t.createdAt)}{done ? ` · Xong ${fmtTime(t.doneAt)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.kg}>{fmtKg(s.gross)}</Text>
                <Text style={st.kgL}>kg · {s.bags} bao</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => setCreate(true)} style={({ pressed }) => [st.fab, { bottom: insets.bottom + 18 }, pressed && { opacity: 0.85 }]}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={st.fabText}>Tạo xe {nextSeq}</Text>
      </Pressable>

      <Sheet visible={create} onClose={() => setCreate(false)} title={`Tạo Xe ${nextSeq} · ${fmtDateVN(date)}`} desc="Số xe tự tăng theo thứ tự trong ngày. Giờ tạo và người tạo được lưu lại.">
        {create ? <CreateTruckForm date={date} onClose={() => setCreate(false)} onCreated={(id) => { setCreate(false); router.push(`/truck/${id}`); }} /> : null}
      </Sheet>
      <InputSheet visible={editPrice} onClose={() => setEditPrice(false)} title={`Giá tham chiếu ${fmtDateVN(date)}`} label="Giá (đ/kg)" unit="đ/kg" keyboard="number"
        hint="Xe tạo mới trong ngày sẽ tự lấy giá này, vẫn sửa riêng từng xe được. Xe đã tạo không đổi."
        initial={dayPrice?.price != null ? String(dayPrice.price) : ''}
        onSave={(txt) => { const n = Number(String(txt).replace(/[^\d.]/g, '')); if (txt.trim() === '') { store.setDayPrice(date, null); setEditPrice(false); return; } if (isNaN(n) || n <= 0) return toast('Giá không hợp lệ', 'err'); store.setDayPrice(date, n); setEditPrice(false); haptic('success'); }} />
      <ConfirmSheet visible={logoutAsk} onClose={() => setLogoutAsk(false)} title="Đổi người dùng?" desc={`Đang đăng nhập: ${user?.name}. Dữ liệu vẫn được giữ trên máy.`} confirmText="Đăng xuất" onConfirm={() => { setLogoutAsk(false); store.logout(); }} />
    </View>
  );
}

function CreateTruckForm({ date, onClose, onCreated }: { date: string; onClose: () => void; onCreated: (id: string) => void }) {
  const store = useStore();
  const user = useStore(selectCurrentUser);
  const drivers = activeDrivers(store);
  const sellers = activeSellers(store);
  const users = activeUsers(store);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [newSeller, setNewSeller] = useState('');
  const [sellerQ, setSellerQ] = useState('');
  const products = activeProducts(store);
  const warehouses = activeWarehouses(store);
  const [productId, setProductId] = useState<string | null>(products.length === 1 ? products[0].id : null);
  const [warehouseId, setWarehouseId] = useState<string | null>(warehouses.length === 1 ? warehouses[0].id : null);
  const [mode, setMode] = useState<'bags' | 'truck'>('bags');
  const [weigherId, setWeigherId] = useState<string | null>(user?.id || null);
  const [newDriver, setNewDriver] = useState('');
  const [note, setNote] = useState('');
  const seq = Object.values(store.trucks).filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.seq || 0), 0) + 1;

  function create() {
    let dId = driverId;
    if (!dId && newDriver.trim()) dId = store.addDriver({ name: newDriver }).id;
    let sId = sellerId;
    if (!sId && newSeller.trim()) sId = store.addSeller({ name: newSeller }).id;
    const t = store.createTruck({ date, driverId: dId, sellerId: sId, weigherId, note, productId, warehouseId, weighMode: mode });
    haptic('success');
    toast(`Đã tạo ${t.name} lúc ${fmtTime(t.createdAt)}`, 'ok');
    onCreated(t.id);
  }

  return (
    <>
      <Field label="Người bán (mua của ai)">
        {sellers.length > 8 ? <Input value={sellerQ} onChangeText={setSellerQ} placeholder="Tìm người bán" style={{ marginBottom: 8, paddingVertical: 8 }} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sellers.filter((x) => !sellerQ.trim() || x.name.toLowerCase().includes(sellerQ.trim().toLowerCase())).slice(0, 30).map((d) => (
            <Pill key={d.id} text={d.name} color={sellerId === d.id ? 'blue' : 'gray'} onPress={() => setSellerId(sellerId === d.id ? null : d.id)} />
          ))}
        </View>
        {!sellerId ? <Input value={newSeller} onChangeText={setNewSeller} placeholder="Hoặc nhập tên người bán mới" style={{ marginTop: 8 }} /> : null}
      </Field>
      <Field label="Tài xế">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {drivers.map((d) => (
            <Pill key={d.id} text={d.name + (d.plate ? ` · ${d.plate}` : '')} color={driverId === d.id ? 'blue' : 'gray'} onPress={() => setDriverId(driverId === d.id ? null : d.id)} />
          ))}
          {drivers.length === 0 ? <Text style={{ color: C.muted, fontSize: 13 }}>Chưa có tài xế. Nhập tên bên dưới để thêm mới.</Text> : null}
        </View>
        {!driverId ? <Input value={newDriver} onChangeText={setNewDriver} placeholder="Hoặc nhập tên tài xế mới" style={{ marginTop: 8 }} /> : null}
      </Field>
      <Field label="Nhân viên đi cân">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {users.map((u) => <Pill key={u.id} text={u.name} color={weigherId === u.id ? 'blue' : 'gray'} onPress={() => setWeigherId(u.id)} />)}
        </View>
      </Field>
      {products.length ? (
        <Field label="Loại hàng">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {products.map((p) => <Pill key={p.id} text={p.name} color={productId === p.id ? 'blue' : 'gray'} small onPress={() => setProductId(productId === p.id ? null : p.id)} />)}
          </View>
        </Field>
      ) : null}
      {warehouses.length ? (
        <Field label="Nhập kho">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {warehouses.map((w) => <Pill key={w.id} text={w.name} color={warehouseId === w.id ? 'blue' : 'gray'} small onPress={() => setWarehouseId(warehouseId === w.id ? null : w.id)} />)}
          </View>
        </Field>
      ) : null}
      <Field label="Kiểu cân">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill text="Cân từng bao" color={mode === 'bags' ? 'blue' : 'gray'} small onPress={() => setMode('bags')} />
          <Pill text="Cân xe tải (vào − ra)" color={mode === 'truck' ? 'orange' : 'gray'} small onPress={() => setMode('truck')} />
        </View>
      </Field>
      <Field label="Ghi chú (tuỳ chọn)"><Input value={note} onChangeText={setNote} placeholder="VD: hàng của anh Ba, kho 2" /></Field>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title={`Tạo Xe ${seq}`} icon="add-circle" onPress={create} style={{ flex: 2 }} />
      </View>
    </>
  );
}

const st = StyleSheet.create({
  userchip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 999, backgroundColor: '#fff', maxWidth: 140, ...shadow },
  userchipText: { fontSize: 13, fontWeight: '600', color: C.text, flexShrink: 1 },
  datebar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  dateText: { fontWeight: '700', fontSize: 17, color: C.text },
  dateSub: { fontSize: 12, color: C.muted },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: C.blue },
  chipText: { fontSize: 13, fontWeight: '600', color: '#444' },
  truck: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10 },
  seq: { width: 50, height: 50, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  seqSmall: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  seqNum: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 24 },
  truckName: { fontWeight: '700', fontSize: 16, color: C.text },
  truckSub: { color: C.muted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  kg: { fontWeight: '800', fontSize: 17, color: C.text, fontVariant: ['tabular-nums'] },
  kgL: { fontSize: 11, color: C.muted },
  remBox: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 10 },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  priceBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  priceVal: { fontWeight: '800', color: C.green, fontSize: 15, fontVariant: ['tabular-nums'] },
  fab: { position: 'absolute', alignSelf: 'center', backgroundColor: C.blue, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
