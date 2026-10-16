import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Sheet, Toggle, TopBar, haptic } from '../../components/ui';
import { activeSellers, useStore } from '../../lib/store';
import { lotsOf } from '../../lib/calc';
import { kindOf } from '../../lib/labels';
import type { PartyKind , Seller } from '../../lib/types';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';

export default function Sellers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const isBuyers = params.kind === 'buyer';
  const title = isBuyers ? 'Khách hàng' : 'Người bán';
  const store = useStore();
  const sellers = activeSellers(store).filter((x) => { const k = x.kind || 'seller'; return k === 'both' || (isBuyers ? k === 'buyer' : k === 'seller'); });
  const trucks = Object.values(store.trucks).filter((t) => !t.deleted);
  const [form, setForm] = useState<null | { id?: string; name: string; phone: string; address: string; note: string; kind: PartyKind }>(null);
  const [del, setDel] = useState<Seller | null>(null);
  const [q, setQ] = useState('');
  const list = q.trim() ? sellers.filter((x) => (x.name + ' ' + x.phone + ' ' + x.address).toLowerCase().includes(q.trim().toLowerCase())) : sellers;

  function save() {
    if (!form) return;
    if (form.name.trim().length < 2) return toast('Nhập tên người bán', 'err');
    if (form.id) store.updateSeller(form.id, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), note: form.note.trim(), kind: form.kind });
    else store.addSeller(form);
    haptic('success');
    setForm(null);
  }
  const blank = { name: '', phone: '', address: '', note: '', kind: (isBuyers ? 'buyer' : 'seller') as PartyKind };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={title} onBack={() => router.back()} right={<IconBtn name="add" color="blue" onPress={() => setForm(blank)} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        {sellers.length > 5 ? <Input value={q} onChangeText={setQ} placeholder="Tìm tên, SĐT, địa chỉ" style={{ marginBottom: 10, paddingVertical: 9 }} /> : null}
        {list.length === 0 ? <Empty icon="person-outline" text={q ? 'Không tìm thấy' : `Chưa có ${title.toLowerCase()}`} sub={isBuyers ? 'Bạn cũng có thể thêm nhanh khi tạo chuyến bán' : 'Bạn cũng có thể thêm nhanh khi tạo xe'} /> : (
          <Card>
            {list.map((d) => {
              const n = trucks.filter((t) => kindOf(t) === (isBuyers ? 'sell' : 'buy') && lotsOf(t).some((l) => l.sellerId === d.id)).length;
              return (
                <View key={d.id} style={st.item}>
                  <Avatar name={d.name} bg={C.greenSoft} fg={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{d.name}</Text>
                    <Text style={st.sub}>{[d.phone, d.address].filter(Boolean).join(' · ') || 'Chưa có SĐT / địa chỉ'}{n ? ` · ${n} ${isBuyers ? 'chuyến' : 'xe'}` : ''}{(d.kind || 'seller') === 'both' ? ' · mua & bán' : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <IconBtn name="wallet-outline" color="green" onPress={() => router.push(`/debts/${d.id}?kind=${isBuyers ? 'sell' : 'buy'}`)} />
                    <IconBtn name="pencil" color="blue" onPress={() => setForm({ id: d.id, name: d.name, phone: d.phone, address: d.address, note: d.note, kind: d.kind || 'seller' })} />
                    <IconBtn name="trash-outline" color="red" onPress={() => setDel(d)} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        <Btn title={`Thêm ${title.toLowerCase()}`} icon="person-add" onPress={() => setForm(blank)} />
      </ScrollView>

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}>
        {form ? (
          <>
            <Field label="Tên"><Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={isBuyers ? 'VD: Cty Intimex, Đại lý Năm' : 'VD: Anh Ba Lộc'} autoFocus /></Field>
            <Field label="Vai trò">
              <Toggle value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[{ v: 'seller', label: 'Người bán', color: 'blue' }, { v: 'buyer', label: 'Khách hàng', color: 'green' }, { v: 'both', label: 'Cả hai', color: 'orange' }]} />
            </Field>
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
      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá ${del?.name}?`} danger confirmText="Xoá" desc="Các xe đã gán đối tác này vẫn giữ tên. Công nợ không bị mất."
        onConfirm={() => { if (del) store.removeSeller(del.id); setDel(null); }} />
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12.5 },
});
