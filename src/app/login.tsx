import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, Field, Input, haptic } from '../components/ui';
import { activeUsers, useStore } from '../lib/store';
import { C, shadow } from '../lib/theme';
import { toast } from '../lib/toast';

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const users = useStore(activeUsers);
  const login = useStore((s) => s.login);
  const addUser = useStore((s) => s.addUser);
  const [sel, setSel] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Lần đầu: tạo tài khoản quản lý
  const [name, setName] = useState('');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');

  function press(k: string) {
    haptic();
    if (k === 'back') { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4 && sel) {
      setTimeout(() => {
        if (login(sel, next)) { haptic('success'); router.replace('/'); }
        else { haptic('error'); setShake(true); setPin(''); setTimeout(() => setShake(false), 400); toast('Sai mã PIN', 'err'); }
      }, 80);
    }
  }

  function createFirst() {
    if (name.trim().length < 2) return toast('Nhập tên', 'err');
    if (!/^\d{4}$/.test(pin1)) return toast('PIN phải gồm 4 chữ số', 'err');
    if (pin1 !== pin2) return toast('PIN nhập lại không khớp', 'err');
    const u = addUser({ name, pin: pin1, role: 'admin' });
    login(u.id, pin1);
    haptic('success');
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={st.logo}><Ionicons name="scale" size={44} color="#fff" /></View>
      <Text style={st.h1}>Cân Cà Phê</Text>
      {users.length === 0 ? (
        <>
          <Text style={st.p}>Lần đầu sử dụng: tạo tài khoản quản lý. Sau đó bạn có thể thêm nhân viên trong phần Cài đặt.</Text>
          <Card style={{ width: '100%' }}>
            <Field label="Tên của bạn"><Input value={name} onChangeText={setName} placeholder="VD: Thành Lợi" autoFocus /></Field>
            <Field label="Mã PIN (4 số)"><Input value={pin1} onChangeText={setPin1} keyboardType="number-pad" maxLength={4} secureTextEntry placeholder="••••" /></Field>
            <Field label="Nhập lại PIN"><Input value={pin2} onChangeText={setPin2} keyboardType="number-pad" maxLength={4} secureTextEntry placeholder="••••" /></Field>
            <Btn title="Tạo tài khoản & bắt đầu" onPress={createFirst} />
          </Card>
        </>
      ) : (
        <>
          <Text style={st.p}>{sel ? 'Nhập mã PIN' : 'Chọn tên của bạn'}</Text>
          <View style={st.users}>
            {users.map((u) => (
              <Pressable key={u.id} onPress={() => { haptic(); setSel(u.id); setPin(''); }} style={[st.user, sel === u.id && st.userSel]}>
                <Avatar name={u.name} size={46} />
                <Text style={st.userName} numberOfLines={1}>{u.name}</Text>
                <Text style={st.userRole}>{u.role === 'admin' ? 'Quản lý' : 'Nhân viên'}</Text>
              </Pressable>
            ))}
          </View>
          {sel ? (
            <>
              <View style={[st.dots, shake && { transform: [{ translateX: 6 }] }]}>
                {[0, 1, 2, 3].map((i) => <View key={i} style={[st.dot, pin.length > i && st.dotOn]} />)}
              </View>
              <View style={st.pad}>
                {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'back']].map((r, i) => (
                  <View key={i} style={st.padRow}>
                    {r.map((k, j) => k === '' ? <View key={j} style={st.padKeyEmpty} /> : (
                      <Pressable key={j} onPress={() => press(k)} style={({ pressed }) => [st.padKey, pressed && { backgroundColor: C.blueSoft }]}>
                        {k === 'back' ? <Ionicons name="backspace-outline" size={26} color={C.text} /> : <Text style={st.padText}>{k}</Text>}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 20, alignItems: 'center', backgroundColor: C.bg, flexGrow: 1 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  h1: { fontSize: 24, fontWeight: '800', color: C.text },
  p: { color: C.muted, marginTop: 6, marginBottom: 22, textAlign: 'center' },
  users: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 20 },
  user: { width: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 6, ...shadow },
  userSel: { borderWidth: 2.5, borderColor: C.blue },
  userName: { fontWeight: '700', color: C.text },
  userRole: { fontSize: 11, color: C.muted },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.blue },
  dotOn: { backgroundColor: C.blue },
  pad: { gap: 12 },
  padRow: { flexDirection: 'row', gap: 12 },
  padKey: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow },
  padKeyEmpty: { width: 72, height: 72 },
  padText: { fontSize: 26, fontWeight: '600', color: C.text },
});
