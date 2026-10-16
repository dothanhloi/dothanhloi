import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../lib/theme';
import { haptic } from './ui';

interface Props {
  label: string;         // ví dụ "BẢNG 1 · Cột 2 · Bao 3"
  value: string;
  onKey: (k: string) => void;   // '0'-'9', '.', 'back', 'clear'
  onNext: () => void;    // lưu & sang ô tiếp theo
  onDone: () => void;    // lưu & đóng
  onCancel: () => void;
}

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'back']];

export function NumPad({ label, value, onKey, onNext, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <View style={st.head}>
        <Pressable onPress={onCancel} hitSlop={8} style={st.cancel}><Ionicons name="close" size={20} color={C.muted} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>{label}</Text>
          <Text style={st.value} numberOfLines={1} adjustsFontSizeToFit>{value === '' ? '0' : value}<Text style={st.unit}> kg</Text></Text>
        </View>
        <Pressable onPress={() => { haptic(); onKey('clear'); }} hitSlop={8} style={st.cancel}><Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>Xoá</Text></Pressable>
      </View>
      <View style={st.body}>
        <View style={{ flex: 3 }}>
          {KEYS.map((r, i) => (
            <View key={i} style={st.krow}>
              {r.map((k) => (
                <Pressable key={k} onPress={() => { haptic(); onKey(k); }} style={({ pressed }) => [st.key, pressed && { backgroundColor: C.blueSoft }]}>
                  {k === 'back' ? <Ionicons name="backspace-outline" size={24} color={C.text} /> : <Text style={st.keyText}>{k}</Text>}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable onPress={() => { haptic('medium'); onNext(); }} style={({ pressed }) => [st.action, { backgroundColor: C.blue, flex: 2 }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="arrow-down" size={22} color="#fff" />
            <Text style={st.actionText}>Tiếp</Text>
          </Pressable>
          <Pressable onPress={() => { haptic('medium'); onDone(); }} style={({ pressed }) => [st.action, { backgroundColor: C.green, flex: 1 }, pressed && { opacity: 0.8 }]}>
            <Text style={st.actionText}>Xong</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#F7F7FA', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 10, paddingTop: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8 },
  cancel: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, color: C.muted, fontWeight: '600', textAlign: 'center' },
  value: { fontSize: 30, fontWeight: '800', color: C.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, color: C.muted, fontWeight: '600' },
  body: { flexDirection: 'row', gap: 8 },
  krow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  key: { flex: 1, height: 54, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  keyText: { fontSize: 24, fontWeight: '600', color: C.text },
  action: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
