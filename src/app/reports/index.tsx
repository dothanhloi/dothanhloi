import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Card, Empty, IconBtn, Pill, Stats, TopBar } from '../../components/ui';
import { truckStats } from '../../lib/calc';
import { fmtDateShort, fmtDateVN, fmtKg, fmtMoney, fmtTime, todayStr } from '../../lib/format';
import { GroupBy, Period, groupTrucks, periodRange, shiftAnchor, totalAgg, trucksInRange } from '../../lib/reports';
import { canSeeMoney, driverName, productName, sellerName, useStore, userName, warehouseName } from '../../lib/store';
import { C, shadow } from '../../lib/theme';
import { toast } from '../../lib/toast';
import { shareXlsx } from '../../lib/xlsx';

const PERIODS: { v: Period; label: string }[] = [{ v: 'day', label: 'Ngày' }, { v: 'week', label: 'Tuần' }, { v: 'month', label: 'Tháng' }, { v: 'year', label: 'Năm' }];
const GROUPS: { v: GroupBy; label: string }[] = [{ v: 'date', label: 'Theo ngày' }, { v: 'seller', label: 'Người bán' }, { v: 'weigher', label: 'Nhân viên' }, { v: 'driver', label: 'Tài xế' }, { v: 'product', label: 'Loại hàng' }, { v: 'warehouse', label: 'Kho' }];

export default function Reports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const money = canSeeMoney(store);
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(todayStr());
  const [group, setGroup] = useState<GroupBy>('date');
  const [exporting, setExporting] = useState(false);
  const range = periodRange(period, anchor);
  const list = useMemo(() => trucksInRange(store, range.from, range.to), [store, range.from, range.to]);
  const total = useMemo(() => totalAgg(list), [list]);
  const rows = useMemo(() => groupTrucks(store, list, group), [store, list, group]);

  const rangeLabel = range.from === range.to ? fmtDateVN(range.from) : `${fmtDateShort(range.from)} – ${fmtDateVN(range.to)}`;

  async function exportXlsx() {
    if (exporting) return;
    setExporting(true);
    try {
      const truckRows = list.map((t) => {
        const s = truckStats(t);
        return [fmtDateVN(t.date), t.name, sellerName(store, t.sellerId), driverName(store, t.driverId), userName(store, t.weigherId), productName(store, t.productId), warehouseName(store, t.warehouseId),
          t.status === 'done' ? 'Đã xong' : 'Đang cân', fmtTime(t.createdAt), s.bags, r1(s.gross), s.impurityPct == null ? '' : r2(s.impurityPct), s.moistureVal == null ? '' : s.moistureVal, r1(s.tare + s.impurity.kg + s.moisture.kg), r1(s.net),
          ...(money ? [s.effectivePrice == null ? '' : Math.round(s.effectivePrice), s.amount == null ? '' : Math.round(s.amount), Math.round(s.paid), s.remaining == null ? '' : Math.round(s.remaining)] : []), t.note];
      });
      const truckHeader = ['Ngày', 'Xe', 'Người bán', 'Tài xế', 'Nhân viên cân', 'Loại hàng', 'Kho', 'Trạng thái', 'Giờ tạo', 'Bao', 'Thô (kg)', 'Tạp (%)', 'Độ (%)', 'Trừ (kg)', 'Thực nhận (kg)', ...(money ? ['Giá (đ/kg)', 'Thành tiền (đ)', 'Đã trả (đ)', 'Còn lại (đ)'] : []), 'Ghi chú'];
      const sheets = [{ name: 'Xe', header: truckHeader, rows: truckRows }];
      for (const g of GROUPS) {
        const agg = groupTrucks(store, list, g.v);
        sheets.push({ name: g.label, header: [g.label, 'Số xe', 'Bao', 'Thô (kg)', 'Thực nhận (kg)', ...(money ? ['Giá TB (đ/kg)', 'Thành tiền (đ)', 'Đã trả (đ)', 'Còn lại (đ)'] : [])],
          rows: agg.map((a) => [g.v === 'date' ? fmtDateVN(a.key) : a.name, a.trucks, a.bags, r1(a.gross), r1(a.net), ...(money ? [Math.round(a.avgPrice), Math.round(a.amount), Math.round(a.paid), Math.round(a.remaining)] : [])]) });
      }
      await shareXlsx(`bao-cao-${range.from}_${range.to}.xlsx`, sheets);
    } catch (e: any) { toast('Không xuất được: ' + (e?.message || e), 'err', 3500); } finally { setExporting(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Báo cáo" onBack={() => router.back()} right={<IconBtn name="download-outline" color="green" onPress={exportXlsx} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {PERIODS.map((p) => <Pill key={p.v} text={p.label} color={period === p.v ? 'blue' : 'gray'} small onPress={() => setPeriod(p.v)} />)}
        </View>
        <View style={st.nav}>
          <IconBtn name="chevron-back" onPress={() => setAnchor(shiftAnchor(period, anchor, -1))} />
          <Pressable onPress={() => setAnchor(todayStr())} style={[st.navLabel, shadow]}><Text style={{ fontWeight: '700', color: C.text }}>{rangeLabel}</Text></Pressable>
          <IconBtn name="chevron-forward" onPress={() => setAnchor(shiftAnchor(period, anchor, 1))} />
        </View>

        <Stats items={[
          { icon: 'car-outline', color: C.blue, value: String(total.trucks), label: 'Xe' },
          { icon: 'cube-outline', color: C.blue, value: String(total.bags), label: 'Bao' },
          { icon: 'scale-outline', color: C.green, value: fmtKg(total.gross), unit: 'kg', label: 'Thô' },
          { icon: 'leaf-outline', color: C.green, value: fmtKg(total.net), unit: 'kg', label: 'Thực nhận' },
        ]} />
        {money ? (
          <Stats items={[
            { icon: 'pricetag-outline', color: C.orange, value: fmtMoney(total.avgPrice), label: 'Giá TB/kg' },
            { icon: 'cash-outline', color: C.blue, value: fmtMoney(total.amount), label: 'Thành tiền' },
            { icon: 'alert-circle-outline', color: C.red, value: fmtMoney(total.remaining), label: 'Còn nợ' },
          ]} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {GROUPS.map((g) => <Pill key={g.v} text={g.label} color={group === g.v ? 'blue' : 'gray'} small onPress={() => setGroup(g.v)} />)}
        </ScrollView>

        {rows.length === 0 ? <Empty icon="bar-chart-outline" text="Không có xe trong khoảng này" /> : (
          <Card>
            {rows.map((a) => {
              const pct = total.net > 0 ? (a.net / total.net) * 100 : 0;
              return (
                <Pressable key={a.key} onPress={() => { if (group === 'seller' && a.key) router.push(`/debts/${a.key}`); }} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{group === 'date' ? fmtDateVN(a.key) : a.name}</Text>
                    <Text style={st.sub}>{a.trucks} xe · {a.bags} bao · thô {fmtKg(a.gross)} kg{money && a.amount ? ` · TB ${fmtMoney(a.avgPrice)}/kg` : ''}</Text>
                    <View style={st.barBg}><View style={[st.bar, { width: `${Math.max(2, Math.min(100, pct))}%` }]} /></View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.kg}>{fmtKg(a.net)} <Text style={{ fontSize: 11, color: C.muted }}>kg</Text></Text>
                    {money ? <Text style={[st.sub, a.remaining > 0.5 && { color: C.red }]}>{fmtMoney(a.amount)}{a.remaining > 0.5 ? ` · nợ ${fmtMoney(a.remaining)}` : ''}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}
        <Btn title={exporting ? 'Đang tạo file...' : 'Xuất Excel (.xlsx)'} kind="secondary" icon="document-outline" onPress={exportXlsx} disabled={exporting || list.length === 0} />
      </ScrollView>
    </View>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const st = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  navLabel: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  kg: { fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  barBg: { height: 4, backgroundColor: C.gray, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: C.blue, borderRadius: 2 },
});
