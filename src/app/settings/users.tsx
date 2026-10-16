import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Sheet, Toggle, TopBar, haptic } from '../../components/ui';
import { activeUsers, selectCurrentUser, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { Role, User } from '../../lib/types';

export default function Users() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const me = useStore(selectCurrentUser);
  const isAdmin = me?.role === 'admin';
  const users = activeUsers(store);
  const [form, setForm] = useState<null | { id?: string; name: string; pin: string; role: Role }>(null);
  const [del, setDel] = useState<User | null>(null);

  function save() {
    if (!form) return;
    if (form.name.trim().length < 2) return toast('Nhập tên nhân viên', 'err');
    if (!form.id || form.pin) { if (!/^\d{4}$/.test(form.pin)) return toast('PIN phải gồm 4 chữ số', 'err'); }
    if (form.id) store.updateUser(form.id, { name: form.name.trim(), role: form.role, ...(form.pin ? { pin: form.pin } : {}) });
    else store.addUser({ name: form.name, pin: form.pin, role: form.role });
    haptic('success');
    setForm(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Nhân viên" onBack={() => router.back()} right={isAdmin ? <IconBtn name="add" color="blue" onPress={() => setForm({ name: '', pin: '', role: 'staff' })} /> : undefined} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        {!isAdmin ? <Text style={{ color: C.muted, fontSize: 13, marginBottom: 10, textAlign: 'center' }}>Chỉ quản lý mới thêm/sửa được nhân viên.</Text> : null}
        {users.length === 0 ? <Empty icon="people-outline" text="Chưa có nhân viên" /> : (
          <Card>
            {users.map((u) => (
              <View key={u.id} style={st.item}>
                <Avatar name={u.name} />
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{u.name}{u.id === me?.id ? '  (bạn)' : ''}</Text>
                  <Text style={st.sub}>{u.role === 'admin' ? 'Quản lý' : 'Nhân viên'} · PIN ••••</Text>
                </View>
                {isAdmin ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <IconBtn name="pencil" color="blue" onPress={() => setForm({ id: u.id, name: u.name, pin: '', role: u.role })} />
                    {u.id !== me?.id ? <IconBtn name="trash-outline" color="red" onPress={() => setDel(u)} /> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )}
        {isAdmin ? <Btn title="Thêm nhân viên" icon="person-add" onPress={() => setForm({ name: '', pin: '', role: 'staff' })} /> : null}
        <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 14, lineHeight: 18 }}>
          Mỗi nhân viên đăng nhập bằng tên + mã PIN 4 số trên bất kỳ điện thoại nào đã cài app. Khi liên kết Google Sheets, danh sách nhân viên được đồng bộ sang các máy khác.
        </Text>
      </ScrollView>

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Sửa nhân viên' : 'Thêm nhân viên'}>
        {form ? (
          <>
            <Field label="Tên"><Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="VD: Nguyễn Văn A" autoFocus /></Field>
            <Field label={form.id ? 'PIN mới (bỏ trống nếu giữ nguyên)' : 'Mã PIN (4 số)'}>
              <Input value={form.pin} onChangeText={(v) => setForm({ ...form, pin: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" maxLength={4} placeholder="••••" />
            </Field>
            <Field label="Vai trò">
              <Toggle value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ v: 'staff', label: 'Nhân viên', color: 'blue' }, { v: 'admin', label: 'Quản lý', color: 'green' }]} />
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Quản lý: thêm/xoá nhân viên, xoá xe, xoá dữ liệu.</Text>
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Huỷ" kind="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Btn title="Lưu" onPress={save} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
      </Sheet>

      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá ${del?.name}?`} danger confirmText="Xoá" desc="Tên vẫn hiển thị trên các xe đã cân trước đó."
        onConfirm={() => { if (del) store.removeUser(del.id); setDel(null); }} />
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12.5 },
});
