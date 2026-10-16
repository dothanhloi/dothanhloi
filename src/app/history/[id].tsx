import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Pill, TopBar } from '../../components/ui';
import { fmtDateTime, fmtMoney, fmtNum } from '../../lib/format';
import { useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import type { HistoryEntry, HistoryKind } from '../../lib/types';

function show(v: unknown, what: string): string {
  if (v == null || v === '') return 'trống';
  if (typeof v === 'number') return /tiền|thanh toán|giá/i.test(what) && !/mẫu|tạp|độ/i.test(what) ? fmtMoney(v) : fmtNum(v, 2);
  if (typeof v === 'boolean') return v ? 'có' : 'không';
  return String(v);
}

const KIND_LABEL: Record<HistoryKind | 'all', string> = { all: 'Tất cả', cell: 'Số cân', field: 'Thông tin', status: 'Trạng thái', table: 'Bảng' };

export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useStore((s) => s.trucks[id || '']);
  const users = useStore((s) => s.users);
  const [kind, setKind] = useState<HistoryKind | 'all'>('all');
  const list = useMemo(() => (t ? [...t.history].reverse().filter((h) => kind === 'all' || h.kind === kind) : []), [t, kind]);

  const resolveName = (h: HistoryEntry) => (h.by && users[h.by]?.name) || h.byName;
  const resolveVal = (h: HistoryEntry, v: unknown) => {
    if (/tài xế|nhân viên|người bán/i.test(h.what) && typeof v === 'string') {
      const st = useStore.getState();
      return st.users[v]?.name || st.drivers[v]?.name || st.sellers?.[v]?.name || v;
    }
    return show(v, h.what);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={`Lịch sử · ${t?.name || ''}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {(Object.keys(KIND_LABEL) as (HistoryKind | 'all')[]).map((k) => (
            <Pill key={k} text={KIND_LABEL[k]} color={kind === k ? 'blue' : 'gray'} small onPress={() => setKind(k)} />
          ))}
        </ScrollView>
        {list.length === 0 ? <Empty icon="time-outline" text="Chưa có thay đổi nào" /> : (
          <Card>
            {list.map((h) => (
              <View key={h.id} style={st.row}>
                <View style={[st.dot, { backgroundColor: h.kind === 'cell' ? C.orange : h.kind === 'status' ? C.green : h.kind === 'table' ? C.muted : C.blue }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.what}>{h.what}</Text>
                  <Text style={st.chg}>
                    <Text style={st.old}>{resolveVal(h, h.old)}</Text>  →  <Text style={st.new}>{resolveVal(h, h.new)}</Text>
                  </Text>
                  <Text style={st.meta}>{resolveName(h)} · {fmtDateTime(h.at)}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  what: { fontWeight: '700', color: C.text },
  chg: { color: C.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  old: { color: C.red, textDecorationLine: 'line-through' },
  new: { color: C.green, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
});
