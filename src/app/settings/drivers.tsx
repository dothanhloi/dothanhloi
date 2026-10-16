import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Sheet, TopBar, haptic } from '../../components/ui';
import { activeDrivers, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { Driver } from '../../lib/types';

export default function Drivers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const drivers = activeDrivers(store);
  const trucks = Object.values(store.trucks).filter((t) => !t.deleted);
  const [form, setForm] = useState<null | { id?: string; name: string; phone: string; plate: string }>(null);
  const [del, setDel] = useState<Driver | null>(null);

  function save() {
    if (!form) return;
    if (form.name.trim().length < 2) return toast('Nhập tên tài xế', 'err');
    if (form.id) store.updateDriver(form.id, { name: form.name.trim(), phone: form.phone.trim(), plate: form.plate.trim() });
    else store.addDriver(form);
    haptic('success');
    setForm(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Tài xế" onBack={() => router.back()} right={<IconBtn name="add" color="blue" onPress={() => setForm({ name: '', phone: '', plate: '' })} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        {drivers.length === 0 ? <Empty icon="car-outline" text="Chưa có tài xế" sub="Bạn cũng có thể thêm nhanh khi tạo xe" /> : (
          <Card>
            {drivers.map((d) => {
              const n = trucks.filter((t) => t.driverId === d.id).length;
              return (
                <View key={d.id} style={st.item}>
                  <Avatar name={d.name} bg={C.orangeSoft} fg={C.orange} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{d.name}</Text>
                    <Text style={st.sub}>{[d.plate, d.phone].filter(Boolean).join(' · ') || 'Chưa có biển số / SĐT'}{n ? ` · ${n} xe` : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <IconBtn name="pencil" color="blue" onPress={() => setForm({ id: d.id, name: d.name, phone: d.phone, plate: d.plate })} />
                    <IconBtn name="trash-outline" color="red" onPress={() => setDel(d)} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        <Btn title="Thêm tài xế" icon="add-circle" onPress={() => setForm({ name: '', phone: '', plate: '' })} />
      </ScrollView>

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Sửa tài xế' : 'Thêm tài xế'}>
        {form ? (
          <>
            <Field label="Tên tài xế"><Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="VD: Anh Tư" autoFocus /></Field>
            <Field label="Biển số xe"><Input value={form.plate} onChangeText={(v) => setForm({ ...form, plate: v })} placeholder="VD: 47C-123.45" autoCapitalize="characters" /></Field>
            <Field label="Số điện thoại"><Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="VD: 0905..." keyboardType="phone-pad" /></Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Huỷ" kind="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Btn title="Lưu" onPress={save} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
      </Sheet>
      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá tài xế ${del?.name}?`} danger confirmText="Xoá" desc="Các xe đã gán tài xế này vẫn giữ tên."
        onConfirm={() => { if (del) store.removeDriver(del.id); setDel(null); }} />
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12.5 },
});
