import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, Input, Pill, TopBar } from '../../components/ui';
import { truckStats } from '../../lib/calc';
import { fmtDateVN, fmtKg, fmtMoney } from '../../lib/format';
import { canSeeMoney, driverName, productName, sellerName, useStore, userName } from '../../lib/store';
import { C, shadow } from '../../lib/theme';

type StatusF = 'all' | 'weighing' | 'done' | 'debt' | 'unloaded';

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const money = canSeeMoney(store);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusF>('all');

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const norm = (s: string) => s.toLowerCase();
    return Object.values(store.trucks).filter((t) => {
      if (t.deleted) return false;
      const s = truckStats(t);
      if (status === 'weighing' && t.status !== 'weighing') return false;
      if (status === 'done' && t.status !== 'done') return false;
      if (status === 'debt' && !(s.remaining != null && s.remaining > 0.5)) return false;
      if (status === 'unloaded' && t.loaded) return false;
      if (!needle) return true;
      const driver = t.driverId ? store.drivers[t.driverId] : null;
      const seller = t.sellerId ? store.sellers?.[t.sellerId] : null;
      const hay = [t.name, t.date, fmtDateVN(t.date), t.note, seller?.name, seller?.phone, driver?.name, driver?.plate, driver?.phone, userName(store, t.weigherId), productName(store, t.productId), t.payment?.note].filter(Boolean).map((x) => norm(String(x))).join(' | ');
      return needle.split(/\s+/).every((w) => hay.includes(w));
    }).sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq).slice(0, 200);
  }, [store, q, status]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Tìm xe" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 12 }}>
        <Input value={q} onChangeText={setQ} placeholder="Tên người bán, tài xế, biển số, SĐT, ngày, ghi chú..." autoFocus style={{ marginBottom: 8 }} clearButtonMode="while-editing" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {([['all', 'Tất cả'], ['weighing', 'Đang cân'], ['done', 'Đã xong'], ['debt', 'Còn nợ'], ['unloaded', 'Chưa bốc']] as [StatusF, string][]).map(([v, l]) => (
            <Pill key={v} text={l} color={status === v ? 'blue' : 'gray'} small onPress={() => setStatus(v)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        {results.length === 0 ? <Empty icon="search-outline" text="Không tìm thấy xe" /> : results.map((t) => {
          const s = truckStats(t);
          return (
            <Pressable key={t.id} onPress={() => router.push(`/truck/${t.id}`)} style={({ pressed }) => [st.row, shadow, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{fmtDateVN(t.date)} · {t.name}{sellerName(store, t.sellerId) ? ` · ${sellerName(store, t.sellerId)}` : ''}</Text>
                <Text style={st.sub}>{[driverName(store, t.driverId) && `TX ${driverName(store, t.driverId)}`, userName(store, t.weigherId) && `cân ${userName(store, t.weigherId)}`, productName(store, t.productId), t.status === 'done' ? 'đã xong' : 'đang cân', t.loaded ? 'đã bốc' : 'chưa bốc'].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.kg}>{fmtKg(s.gross)} kg</Text>
                {money && s.remaining != null && s.remaining > 0.5 ? <Text style={[st.sub, { color: C.red }]}>nợ {fmtMoney(s.remaining)}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  kg: { fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
});
