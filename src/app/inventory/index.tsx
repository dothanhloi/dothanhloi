import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, KV, Pill, Sheet, Stats, TopBar, haptic } from '../../components/ui';
import { fmtDateVN, fmtKg, fmtMoney, parseDate, parseNum, todayStr } from '../../lib/format';
import { hedgeSummary, stockByWarehouse } from '../../lib/reports';
import { activeProducts, activeWarehouses, canSeeMoney, productName, selectCurrentUser, useStore, warehouseName } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { Hedge, Sale } from '../../lib/types';

export default function Inventory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const me = useStore(selectCurrentUser);
  const money = canSeeMoney(store);
  const isAdmin = me?.role === 'admin';
  const stock = useMemo(() => stockByWarehouse(store), [store]);
  const hedge = useMemo(() => hedgeSummary(store), [store]);
  const totalStock = stock.reduce((a, r) => a + r.stockKg, 0);
  const unhedgedTons = totalStock / 1000 - hedge.tons;
  const sales = useMemo(() => Object.values(store.sales || {}).filter((x) => !x.deleted).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [store.sales]);
  const hedges = useMemo(() => Object.values(store.hedges || {}).filter((x) => !x.deleted).sort((a, b) => b.date.localeCompare(a.date)), [store.hedges]);
  const [saleOpen, setSaleOpen] = useState(false);
  const [hedgeOpen, setHedgeOpen] = useState(false);
  const [delSale, setDelSale] = useState<Sale | null>(null);
  const [delHedge, setDelHedge] = useState<Hedge | null>(null);
  const [tab, setTab] = useState<'sales' | 'hedges'>('sales');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Tồn kho" onBack={() => router.back()} right={<IconBtn name="home-outline" color="blue" onPress={() => router.push('/settings/warehouses')} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <Stats items={[
          { icon: 'arrow-down-circle-outline', color: C.green, value: fmtKg(stock.reduce((a, r) => a + r.inKg, 0)), unit: 'kg', label: 'Đã nhập' },
          { icon: 'arrow-up-circle-outline', color: C.orange, value: fmtKg(stock.reduce((a, r) => a + r.outKg, 0)), unit: 'kg', label: 'Đã xuất' },
          { icon: 'cube-outline', color: C.blue, value: fmtKg(totalStock), unit: 'kg', label: 'Tồn kho' },
        ]} />

        <Card title="Theo kho">
          {stock.length === 0 ? <Text style={{ color: C.muted }}>Chưa có xe nào.</Text> : stock.map((r) => (
            <View key={r.warehouseId || 'none'} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{r.name}</Text>
                <Text style={st.sub}>nhập {fmtKg(r.inKg)} ({r.trucks} xe) · xuất {fmtKg(r.outKg)} ({r.sales} chuyến/lần)</Text>
              </View>
              <Text style={[st.kg, r.stockKg < 0 && { color: C.red }]}>{fmtKg(r.stockKg)} <Text style={{ fontSize: 11, color: C.muted }}>kg</Text></Text>
            </View>
          ))}
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Nhập = thực nhận của các xe thu mua; xuất = chuyến bán hàng (tab Bán hàng ở trang chủ) + xuất khác ghi ở đây. Gán kho cho xe trên màn hình xe.</Text>
        </Card>

        {isAdmin ? (
          <Card title="Hedge (sàn London)" right={<Pill text="+ Lệnh" color="blue" small onPress={() => setHedgeOpen(true)} />}>
            <KV label="Tồn kho" value={fmtKg(totalStock / 1000, 2)} unit="tấn" />
            <KV label="Đã hedge" sub={`${hedge.lots} lot`} value={fmtKg(hedge.tons, 1)} unit="tấn" />
            <KV label="Chưa hedge" value={fmtKg(unhedgedTons, 2)} unit="tấn" highlight={unhedgedTons > 0.5 ? 'red' : 'green'} />
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Ghi lệnh bán (lot dương) khi mở vị thế, lệnh mua lại (lot âm) khi đóng. Robusta London 1 lot = 10 tấn.</Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <Pill text={`Xuất khác (${sales.length})`} color={tab === 'sales' ? 'blue' : 'gray'} small onPress={() => setTab('sales')} />
          {isAdmin ? <Pill text={`Lệnh hedge (${hedges.length})`} color={tab === 'hedges' ? 'blue' : 'gray'} small onPress={() => setTab('hedges')} /> : null}
          <View style={{ flex: 1 }} />
          {tab === 'sales' ? <Pill text="+ Xuất khác" color="green" small icon="add" onPress={() => setSaleOpen(true)} /> : null}
        </View>

        {tab === 'sales' ? (sales.length === 0 ? <Empty icon="arrow-up-circle-outline" text="Chưa có xuất khác" sub="Bán hàng có cân thì tạo chuyến bán ở trang chủ; mục này cho xuất kho không qua cân (hao hụt, chuyển kho...)" /> : (
          <Card>
            {sales.slice(0, 100).map((x) => (
              <Pressable key={x.id} onLongPress={() => { if (!isAdmin) return; haptic('medium'); setDelSale(x); }} delayLongPress={600} style={st.row}>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{fmtDateVN(x.date)} · {x.buyer || 'Xuất kho'}</Text>
                  <Text style={st.sub}>{[warehouseName(store, x.warehouseId), productName(store, x.productId), x.note].filter(Boolean).join(' · ') || '—'}{x.byName ? ` · ${x.byName}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.kg}>−{fmtKg(x.kg)} <Text style={{ fontSize: 11, color: C.muted }}>kg</Text></Text>
                  {money && x.price != null ? <Text style={st.sub}>{fmtMoney(x.price)}/kg · {fmtMoney(x.kg * x.price)}</Text> : null}
                </View>
              </Pressable>
            ))}
            {isAdmin ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Nhấn giữ để xoá.</Text> : null}
          </Card>
        )) : (hedges.length === 0 ? <Empty icon="trending-down-outline" text="Chưa ghi lệnh hedge nào" /> : (
          <Card>
            {hedges.map((h) => (
              <Pressable key={h.id} onLongPress={() => { haptic('medium'); setDelHedge(h); }} delayLongPress={600} style={st.row}>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{fmtDateVN(h.date)} · {h.lots > 0 ? 'Bán' : 'Mua lại'} {Math.abs(h.lots)} lot</Text>
                  <Text style={st.sub}>{h.price != null ? `${h.price.toLocaleString('en-US')} USD/tấn · ` : ''}{h.tonsPerLot} tấn/lot{h.note ? ` · ${h.note}` : ''}{h.byName ? ` · ${h.byName}` : ''}</Text>
                </View>
                <Text style={[st.kg, { color: h.lots > 0 ? C.green : C.orange }]}>{h.lots > 0 ? '+' : ''}{fmtKg(h.lots * h.tonsPerLot, 0)} t</Text>
              </Pressable>
            ))}
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Nhấn giữ để xoá.</Text>
          </Card>
        ))}
      </ScrollView>

      <Sheet visible={saleOpen} onClose={() => setSaleOpen(false)} title="Ghi xuất kho khác (không qua cân)">
        {saleOpen ? <SaleForm onClose={() => setSaleOpen(false)} /> : null}
      </Sheet>
      <Sheet visible={hedgeOpen} onClose={() => setHedgeOpen(false)} title="Ghi lệnh hedge">
        {hedgeOpen ? <HedgeForm onClose={() => setHedgeOpen(false)} /> : null}
      </Sheet>
      <ConfirmSheet visible={!!delSale} onClose={() => setDelSale(null)} title="Xoá lần xuất bán này?" danger confirmText="Xoá" onConfirm={() => { if (delSale) store.removeSale(delSale.id); setDelSale(null); }} />
      <ConfirmSheet visible={!!delHedge} onClose={() => setDelHedge(null)} title="Xoá lệnh hedge này?" danger confirmText="Xoá" onConfirm={() => { if (delHedge) store.removeHedge(delHedge.id); setDelHedge(null); }} />
    </View>
  );
}

function SaleForm({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const whs = activeWarehouses(store);
  const prods = activeProducts(store);
  const [date, setDate] = useState(todayStr());
  const [kg, setKg] = useState('');
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [note, setNote] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(whs.length === 1 ? whs[0].id : null);
  const [productId, setProductId] = useState<string | null>(null);
  function save() {
    const k = parseNum(kg);
    if (k == null || isNaN(k) || k <= 0) return toast('Nhập số kg', 'err');
    if (!validDate(date)) return toast('Ngày dạng YYYY-MM-DD, ví dụ 2026-10-16', 'err');
    const p = parseNum(price);
    store.addSale({ date, warehouseId, productId, kg: k, price: p == null || isNaN(p) ? null : p, buyer, note });
    haptic('success');
    onClose();
  }
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Ngày (YYYY-MM-DD)" style={{ flex: 1 }}><Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" /></Field>
        <Field label="Số kg" style={{ flex: 1 }}><Input value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="0" autoFocus /></Field>
      </View>
      {whs.length ? <Field label="Kho"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{whs.map((w) => <Pill key={w.id} text={w.name} color={warehouseId === w.id ? 'blue' : 'gray'} small onPress={() => setWarehouseId(w.id)} />)}</View></Field> : null}
      {prods.length ? <Field label="Loại hàng"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{prods.map((p) => <Pill key={p.id} text={p.name} color={productId === p.id ? 'blue' : 'gray'} small onPress={() => setProductId(productId === p.id ? null : p.id)} />)}</View></Field> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Người mua / nơi nhận" style={{ flex: 2 }}><Input value={buyer} onChangeText={setBuyer} placeholder="VD: Cty Intimex" /></Field>
        <Field label="Giá bán (đ/kg)" style={{ flex: 1 }}><Input value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="tuỳ chọn" /></Field>
      </View>
      <Field label="Ghi chú"><Input value={note} onChangeText={setNote} placeholder="Số xe, hợp đồng..." /></Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title="Ghi xuất" kind="success" onPress={save} style={{ flex: 2 }} />
      </View>
    </>
  );
}

function HedgeForm({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [date, setDate] = useState(todayStr());
  const [lots, setLots] = useState('');
  const [tpl, setTpl] = useState('10');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [side, setSide] = useState<'sell' | 'buy'>('sell');
  function save() {
    const l = parseNum(lots);
    if (l == null || isNaN(l) || l <= 0) return toast('Nhập số lot', 'err');
    if (!validDate(date)) return toast('Ngày dạng YYYY-MM-DD, ví dụ 2026-10-16', 'err');
    const p = parseNum(price);
    store.addHedge({ date, lots: side === 'sell' ? l : -l, tonsPerLot: parseNum(tpl) || 10, price: p == null || isNaN(p) ? null : p, note });
    haptic('success');
    onClose();
  }
  return (
    <>
      <Field label="Loại lệnh"><View style={{ flexDirection: 'row', gap: 8 }}><Pill text="Bán (mở hedge)" color={side === 'sell' ? 'green' : 'gray'} onPress={() => setSide('sell')} /><Pill text="Mua lại (đóng)" color={side === 'buy' ? 'orange' : 'gray'} onPress={() => setSide('buy')} /></View></Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Ngày" style={{ flex: 1 }}><Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" /></Field>
        <Field label="Số lot" style={{ flex: 1 }}><Input value={lots} onChangeText={setLots} keyboardType="number-pad" placeholder="0" autoFocus /></Field>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Tấn / lot" style={{ flex: 1 }}><Input value={tpl} onChangeText={setTpl} keyboardType="decimal-pad" /></Field>
        <Field label="Giá (USD/tấn)" style={{ flex: 1 }}><Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="tuỳ chọn" /></Field>
      </View>
      <Field label="Ghi chú"><Input value={note} onChangeText={setNote} placeholder="Kỳ hạn, sàn, broker..." /></Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title="Ghi lệnh" onPress={save} style={{ flex: 2 }} />
      </View>
    </>
  );
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return !isNaN(d.getTime()) && todayStr(d) === s;
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  kg: { fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
});
