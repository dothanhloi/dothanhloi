import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Sheet, TopBar, haptic } from '../../components/ui';
import { activeSellers, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { Seller } from '../../lib/types';

export default function Sellers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const sellers = activeSellers(store);
  const trucks = Object.values(store.trucks).filter((t) => !t.deleted);
  const [form, setForm] = useState<null | { id?: string; name: string; phone: string; address: string; note: string }>(null);
  const [del, setDel] = useState<Seller | null>(null);
  const [q, setQ] = useState('');
  const list = q.trim() ? sellers.filter((x) => (x.name + ' ' + x.phone + ' ' + x.address).toLowerCase().includes(q.trim().toLowerCase())) : sellers;

  function save() {
    if (!form) return;
    if (form.name.trim().length < 2) return toast('Nhập tên người bán', 'err');
    if (form.id) store.updateSeller(form.id, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), note: form.note.trim() });
    else store.addSeller(form);
    haptic('success');
    setForm(null);
  }
  const blank = { name: '', phone: '', address: '', note: '' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Người bán" onBack={() => router.back()} right={<IconBtn name="add" color="blue" onPress={() => setForm(blank)} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        {sellers.length > 5 ? <Input value={q} onChangeText={setQ} placeholder="Tìm tên, SĐT, địa chỉ" style={{ marginBottom: 10, paddingVertical: 9 }} /> : null}
        {list.length === 0 ? <Empty icon="person-outline" text={q ? 'Không tìm thấy' : 'Chưa có người bán'} sub="Bạn cũng có thể thêm nhanh khi tạo xe" /> : (
          <Card>
            {list.map((d) => {
              const n = trucks.filter((t) => t.sellerId === d.id).length;
              return (
                <View key={d.id} style={st.item}>
                  <Avatar name={d.name} bg={C.greenSoft} fg={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{d.name}</Text>
                    <Text style={st.sub}>{[d.phone, d.address].filter(Boolean).join(' · ') || 'Chưa có SĐT / địa chỉ'}{n ? ` · ${n} xe` : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <IconBtn name="wallet-outline" color="green" onPress={() => router.push(`/debts/${d.id}`)} />
                    <IconBtn name="pencil" color="blue" onPress={() => setForm({ id: d.id, name: d.name, phone: d.phone, address: d.address, note: d.note })} />
                    <IconBtn name="trash-outline" color="red" onPress={() => setDel(d)} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        <Btn title="Thêm người bán" icon="person-add" onPress={() => setForm(blank)} />
      </ScrollView>

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Sửa người bán' : 'Thêm người bán'}>
        {form ? (
          <>
            <Field label="Tên"><Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="VD: Anh Ba Lộc" autoFocus /></Field>
            <Field label="Số điện thoại"><Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="VD: 0905..." keyboardType="phone-pad" /></Field>
            <Field label="Địa chỉ"><Input value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Thôn, xã" /></Field>
            <Field label="Ghi chú"><Input value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} placeholder="Thoả thuận riêng, ngân hàng..." /></Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Huỷ" kind="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Btn title="Lưu" onPress={save} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
      </Sheet>
      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá ${del?.name}?`} danger confirmText="Xoá" desc="Các xe đã gán người bán này vẫn giữ tên. Công nợ không bị mất."
        onConfirm={() => { if (del) store.removeSeller(del.id); setDel(null); }} />
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12.5 },
});
