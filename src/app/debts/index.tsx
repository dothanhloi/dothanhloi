import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Empty, Pill, Stats, TopBar } from '../../components/ui';
import { lotStats, lotsOf } from '../../lib/calc';
import { fmtKg, fmtMoney } from '../../lib/format';
import { canSeeMoney, useStore } from '../../lib/store';
import { kindOf } from '../../lib/labels';
import type { TruckKind } from '../../lib/types';
import { C, shadow } from '../../lib/theme';

export interface SellerDebt { sellerId: string; name: string; trucks: number; open: number; kg: number; amount: number; paid: number; remaining: number }

export function computeDebts(store: Pick<ReturnType<typeof useStore.getState>, 'trucks' | 'sellers'>, kind: TruckKind = 'buy'): SellerDebt[] {
  const m: Record<string, SellerDebt> = {};
  for (const t of Object.values(store.trucks)) {
    if (t.deleted || kindOf(t) !== kind) continue;
    for (const lot of lotsOf(t)) {
      const key = lot.sellerId || '';
      const name = key ? store.sellers?.[key]?.name || 'Đối tác đã xoá' : (kind === 'sell' ? 'Chưa gán khách hàng' : 'Chưa gán người bán');
      const s = lotStats(t, lot);
      const d = m[key] || (m[key] = { sellerId: key, name, trucks: 0, open: 0, kg: 0, amount: 0, paid: 0, remaining: 0 });
      d.trucks++;
      d.kg += s.net;
      d.amount += s.amount || 0;
      d.paid += s.paid;
      const rem = s.remaining != null ? s.remaining : 0;
      d.remaining += rem;
      if (rem > 0.5) d.open++;
    }
  }
  return Object.values(m).sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, 'vi'));
}

export default function Debts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const store = useStore();
  const money = canSeeMoney(store);
  const trucks = store.trucks;
  const sellers = store.sellers;
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [kind, setKind] = useState<TruckKind>(params.kind === 'sell' ? 'sell' : 'buy');
  const debts = useMemo(() => computeDebts({ trucks, sellers } as any, kind), [trucks, sellers, kind]);
  const list = onlyOpen ? debts.filter((d) => d.remaining > 0.5) : debts;
  const total = debts.reduce((a, d) => ({ amount: a.amount + d.amount, paid: a.paid + d.paid, remaining: a.remaining + d.remaining }), { amount: 0, paid: 0, remaining: 0 });

  if (!money) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title="Công nợ" onBack={() => router.back()} />
        <Empty icon="lock-closed-outline" text="Quản lý đã ẩn thông tin tiền với nhân viên" />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Công nợ" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pill text="Phải trả (mua)" color={kind === 'buy' ? 'blue' : 'gray'} icon="arrow-up-circle-outline" onPress={() => setKind('buy')} />
          <Pill text="Phải thu (bán)" color={kind === 'sell' ? 'green' : 'gray'} icon="arrow-down-circle-outline" onPress={() => setKind('sell')} />
        </View>
        <Stats items={[
          { icon: 'cash-outline', color: C.blue, value: fmtMoney(total.amount), label: kind === 'sell' ? 'Tổng bán' : 'Tổng mua' },
          { icon: 'checkmark-circle-outline', color: C.green, value: fmtMoney(total.paid), label: kind === 'sell' ? 'Đã thu' : 'Đã trả' },
          { icon: 'alert-circle-outline', color: C.red, value: fmtMoney(total.remaining), label: kind === 'sell' ? 'Còn phải thu' : 'Còn nợ' },
        ]} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pill text="Còn nợ" color={onlyOpen ? 'blue' : 'gray'} small onPress={() => setOnlyOpen(true)} />
          <Pill text="Tất cả" color={!onlyOpen ? 'blue' : 'gray'} small onPress={() => setOnlyOpen(false)} />
        </View>
        {list.length === 0 ? <Empty icon="wallet-outline" text={onlyOpen ? (kind === 'sell' ? 'Không ai còn nợ mình' : 'Không còn nợ ai') : 'Chưa có giao dịch'} /> : list.map((d) => (
          <Pressable key={d.sellerId || 'none'} onPress={() => router.push(`/debts/${d.sellerId || 'none'}?kind=${kind}`)} style={({ pressed }) => [st.row, shadow, pressed && { opacity: 0.7 }]}>
            <Avatar name={d.name} bg={d.remaining > 0.5 ? C.redSoft : C.greenSoft} fg={d.remaining > 0.5 ? C.red : C.green} />
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{d.name}</Text>
              <Text style={st.sub}>{d.trucks} xe · {fmtKg(d.kg)} kg · {kind === 'sell' ? 'đã thu' : 'đã trả'} {fmtMoney(d.paid)}{d.open ? ` · ${d.open} xe chưa xong tiền` : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[st.amt, { color: d.remaining > 0.5 ? C.red : C.green }]}>{fmtMoney(d.remaining)}</Text>
              <Text style={st.sub}>{kind === 'sell' ? 'còn phải thu' : 'còn lại'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10 },
  name: { fontWeight: '700', color: C.text, fontSize: 15 },
  sub: { color: C.muted, fontSize: 12 },
  amt: { fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] },
});
