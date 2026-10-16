import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaymentSheet } from '../../components/PaymentSheet';
import { Btn, Card, Empty, KV, Pill, Stats, TopBar } from '../../components/ui';
import { lotStats, lotsOf } from '../../lib/calc';
import { fmtDateVN, fmtKg, fmtMoney, fmtTime } from '../../lib/format';
import { canSeeMoney, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';

export default function SellerDebt() {
  const { sellerId } = useLocalSearchParams<{ sellerId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const money = canSeeMoney(store);
  const id = sellerId === 'none' ? '' : sellerId || '';
  const seller = id ? store.sellers?.[id] : null;
  const [pay, setPay] = useState<{ truckId: string; lotId: string } | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);

  const allTrucks = store.trucks;
  const rows = useMemo(() => {
    const out: { t: (typeof allTrucks)[string]; lot: ReturnType<typeof lotsOf>[number]; s: ReturnType<typeof lotStats> }[] = [];
    for (const t of Object.values(allTrucks)) {
      if (t.deleted) continue;
      for (const lot of lotsOf(t)) if ((lot.sellerId || '') === id) out.push({ t, lot, s: lotStats(t, lot) });
    }
    return out.sort((a, b) => (a.t.date === b.t.date ? b.t.seq - a.t.seq : a.t.date < b.t.date ? 1 : -1));
  }, [allTrucks, id]);
  const total = rows.reduce((a, r) => ({ kg: a.kg + r.s.net, amount: a.amount + (r.s.amount || 0), paid: a.paid + r.s.paid, remaining: a.remaining + (r.s.remaining || 0) }), { kg: 0, amount: 0, paid: 0, remaining: 0 });
  const list = onlyOpen ? rows.filter((r) => (r.s.remaining || 0) > 0.5) : rows;
  const title = seller ? seller.name : id ? 'Người bán đã xoá' : 'Chưa gán người bán';

  if (!money) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title={title} onBack={() => router.back()} />
        <Empty icon="lock-closed-outline" text="Quản lý đã ẩn thông tin tiền với nhân viên" />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={title} subtitle={seller ? [seller.phone, seller.address].filter(Boolean).join(' · ') : undefined} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <Stats items={[
          { icon: 'leaf-outline', color: C.green, value: fmtKg(total.kg), unit: 'kg', label: 'Đã mua' },
          { icon: 'cash-outline', color: C.blue, value: fmtMoney(total.amount), label: 'Thành tiền' },
          { icon: 'alert-circle-outline', color: C.red, value: fmtMoney(total.remaining), label: 'Còn nợ' },
        ]} />
        {seller?.phone ? <Btn title={`Gọi ${seller.phone}`} kind="ghost" small icon="call-outline" onPress={() => Linking.openURL('tel:' + seller.phone).catch(() => toast('Máy này không gọi điện được', 'err'))} style={{ alignSelf: 'flex-start', marginBottom: 10 }} /> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pill text="Còn nợ" color={onlyOpen ? 'blue' : 'gray'} small onPress={() => setOnlyOpen(true)} />
          <Pill text="Tất cả xe" color={!onlyOpen ? 'blue' : 'gray'} small onPress={() => setOnlyOpen(false)} />
        </View>
        {list.length === 0 ? <Empty icon="checkmark-done-outline" text={onlyOpen ? 'Đã thanh toán đủ' : 'Chưa có xe'} /> : list.map(({ t, lot, s }) => (
          <Card key={t.id + lot.id}>
            <Pressable onPress={() => router.push(`/truck/${t.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{t.name} · {fmtDateVN(t.date)}</Text>
              {t.status === 'done' ? <Pill text="Xong" color="green" small /> : <Pill text="Đang cân" color="orange" small />}
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
            <KV label="Thực nhận" value={fmtKg(s.net)} unit="kg" />
            <KV label="Thành tiền" value={fmtMoney(s.amount)} />
            <KV label="Đã trả" value={fmtMoney(s.paid)} />
            <KV label="Còn lại" value={fmtMoney(s.remaining)} highlight={(s.remaining || 0) > 0.5 ? 'red' : 'green'} />
            {(s.remaining || 0) > 0.5 ? <Btn title="Thanh toán" kind="success" small icon="cash-outline" onPress={() => setPay({ truckId: t.id, lotId: lot.id })} style={{ alignSelf: 'flex-end', marginTop: 8 }} /> : null}
            {t.doneAt ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Xong xe lúc {fmtTime(t.doneAt)}</Text> : null}
          </Card>
        ))}
      </ScrollView>
      <PaymentSheet truckId={pay?.truckId || null} lotId={pay?.lotId || null} onClose={() => setPay(null)} />
    </View>
  );
}

