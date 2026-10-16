import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle, TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, shadow } from '../lib/theme';
import { onToast, ToastMsg } from '../lib/toast';

export type IonName = React.ComponentProps<typeof Ionicons>['name'];

export function haptic(kind: 'light' | 'medium' | 'success' | 'error' = 'light') {
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/* ---------- Thanh tiêu đề ---------- */
export function TopBar({ title, onBack, left, right, onTitlePress, subtitle }: {
  title: string; subtitle?: string; onBack?: () => void; left?: React.ReactNode; right?: React.ReactNode; onTitlePress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.topbar, { paddingTop: insets.top + 8 }]}>
      {onBack ? <IconBtn name="chevron-back" color="blue" onPress={onBack} /> : left ?? <View style={{ width: 40 }} />}
      <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={st.titleWrap}>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        {onTitlePress ? <Ionicons name="pencil" size={14} color={C.muted} style={{ marginLeft: 6 }} /> : null}
        {subtitle ? <Text style={st.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </Pressable>
      <View style={st.rightWrap}>{right ?? <View style={{ width: 40 }} />}</View>
    </View>
  );
}

export function IconBtn({ name, color = 'gray', onPress, onLongPress, size = 20, style }: {
  name: IonName; color?: 'blue' | 'red' | 'green' | 'gray' | 'orange'; onPress?: () => void; onLongPress?: () => void; size?: number; style?: ViewStyle;
}) {
  const bg = { blue: C.blueSoft, red: C.redSoft, green: C.greenSoft, gray: C.gray, orange: C.orangeSoft }[color];
  const fg = { blue: C.blue, red: C.red, green: C.green, gray: '#555', orange: C.orange }[color];
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={500} hitSlop={6}
      style={({ pressed }) => [st.iconbtn, { backgroundColor: bg, opacity: pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={name} size={size} color={fg} />
    </Pressable>
  );
}

/* ---------- Thẻ, nhãn, nút ---------- */
export function Card({ children, style, title, right }: { children: React.ReactNode; style?: ViewStyle; title?: string; right?: React.ReactNode }) {
  return (
    <View style={[st.card, style]}>
      {title ? (
        <View style={st.cardTitleRow}>
          <Text style={st.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Pill({ text, color = 'gray', icon, small, onPress, style }: {
  text: string; color?: 'blue' | 'green' | 'gray' | 'red' | 'orange'; icon?: IonName; small?: boolean; onPress?: () => void; style?: ViewStyle;
}) {
  const bg = { blue: C.blue, green: C.greenSoft, gray: C.gray, red: C.redSoft, orange: C.orangeSoft }[color];
  const fg = { blue: '#fff', green: C.green, gray: '#666', red: C.red, orange: C.orange }[color];
  const inner = (
    <View style={[st.pill, { backgroundColor: bg }, small && st.pillSm, style]}>
      {icon ? <Ionicons name={icon} size={small ? 12 : 14} color={fg} style={{ marginRight: 4 }} /> : null}
      <Text style={[st.pillText, { color: fg }, small && { fontSize: 12 }]}>{text}</Text>
    </View>
  );
  if (!onPress) return inner;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{inner}</Pressable>;
}

export function Btn({ title, onPress, onLongPress, kind = 'primary', icon, disabled, style, small }: {
  title: string; onPress?: () => void; onLongPress?: () => void; kind?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'; icon?: IonName; disabled?: boolean; style?: ViewStyle; small?: boolean;
}) {
  const bg = { primary: C.blue, secondary: C.blueSoft, success: C.green, danger: C.redSoft, ghost: '#fff' }[kind];
  const fg = { primary: '#fff', secondary: C.blue, success: '#fff', danger: C.red, ghost: C.text }[kind];
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={600} disabled={disabled}
      style={({ pressed }) => [st.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }, kind === 'ghost' && shadow, small && st.btnSm, style]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} style={{ marginRight: 7 }} /> : null}
      <Text style={[st.btnText, { color: fg }, small && { fontSize: 14 }]}>{title}</Text>
    </Pressable>
  );
}

/* ---------- Dòng khoá-giá trị (có nhấn giữ) ---------- */
export function KV({ label, sub, value, unit, empty, onPress, onLongPress, highlight, right }: {
  label: string; sub?: string; value?: string; unit?: string; empty?: boolean; onPress?: () => void; onLongPress?: () => void;
  highlight?: 'blue' | 'red' | 'green'; right?: React.ReactNode;
}) {
  const color = highlight ? { blue: C.blue, red: C.red, green: C.green }[highlight] : empty ? C.blue : C.text;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={500} disabled={!onPress && !onLongPress}
      style={({ pressed }) => [st.kv, pressed && (onPress || onLongPress) ? { backgroundColor: C.blueSoft, marginHorizontal: -14, paddingHorizontal: 14, borderRadius: 10 } : null]}>
      <View style={{ flexShrink: 0 }}>
        <Text style={st.kvLabel}>{label}</Text>
        {sub ? <Text style={st.kvSub}>{sub}</Text> : null}
      </View>
      <View style={st.kvRight}>
        {right}
        {value !== undefined ? (
          <Text style={[st.kvValue, { color }, highlight && { fontSize: 17 }, empty && { fontWeight: '600' }]} numberOfLines={1}>
            {value}{unit ? <Text style={st.kvUnit}> {unit}</Text> : null}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Toggle<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string; color: 'green' | 'red' | 'orange' | 'blue' }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={st.toggle}>
      {options.map((o) => {
        const on = o.v === value;
        const bg = on ? { green: C.green, red: C.red, orange: C.orange, blue: C.blue }[o.color] : 'transparent';
        return (
          <Pressable key={o.v} onPress={() => { if (!on) { haptic(); onChange(o.v); } }} style={[st.toggleBtn, { backgroundColor: bg }]}>
            <Text style={[st.toggleText, on && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!on)} style={[st.switch, on && { backgroundColor: C.green }]}>
      <View style={[st.switchKnob, on && { left: 23 }]} />
    </Pressable>
  );
}

/* ---------- Thống kê 3 cột ---------- */
export function Stats({ items }: { items: { icon: IonName; color: string; value: string; unit?: string; label: string }[] }) {
  return (
    <View style={[st.stats, shadow]}>
      {items.map((it, i) => (
        <View key={i} style={[st.stat, i < items.length - 1 && st.statBorder]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={it.icon} size={14} color={it.color} style={{ marginRight: 4 }} />
            <Text style={[st.statV, items.length > 3 && { fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>
              {it.value}{it.unit ? <Text style={st.statUnit}> {it.unit}</Text> : null}
            </Text>
          </View>
          <Text style={st.statL}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ visible, onClose, title, desc, children }: { visible: boolean; onClose: () => void; title?: string; desc?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.handle} />
          {title ? <Text style={st.sheetTitle}>{title}</Text> : null}
          {desc ? <Text style={st.sheetDesc}>{desc}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ flexShrink: 1 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
      {/* Modal nằm trên cây gốc nên toast ngoài Modal không hiện: render thêm một ToastHost trong sheet */}
      <ToastHost />
    </Modal>
  );
}

export function Field({ label, hint, children, style }: { label?: string; hint?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[st.field, style]}>
      {label ? <Text style={st.fieldLabel}>{label}</Text> : null}
      {children}
      {hint ? <Text style={st.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput> & { big?: boolean }) {
  const { big, style, ...rest } = props;
  return <TextInput placeholderTextColor="#B5B5BD" {...rest} style={[st.input, big && st.inputBig, style as TextStyle]} />;
}

/** Sheet nhập một giá trị (số hoặc chữ) */
export function InputSheet({ visible, onClose, title, desc, label, initial, unit, keyboard = 'decimal', onSave, big = true, hint, multiline }: {
  visible: boolean; onClose: () => void; title: string; desc?: string; label?: string; initial?: string; unit?: string;
  keyboard?: 'decimal' | 'number' | 'text'; onSave: (text: string) => void; big?: boolean; hint?: string; multiline?: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} desc={desc}>
      {visible ? <InputSheetBody label={label} initial={initial} unit={unit} keyboard={keyboard} onSave={onSave} big={big} hint={hint} multiline={multiline} onClose={onClose} /> : null}
    </Sheet>
  );
}

function InputSheetBody({ label, initial, unit, keyboard, onSave, big, hint, multiline, onClose }: {
  label?: string; initial?: string; unit?: string; keyboard: 'decimal' | 'number' | 'text'; onSave: (text: string) => void; big: boolean; hint?: string; multiline?: boolean; onClose: () => void;
}) {
  const [text, setText] = useState(initial ?? '');
  return (
    <>
      <Field label={label} hint={hint}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Input big={big} autoFocus value={text} onChangeText={setText} multiline={multiline}
            keyboardType={keyboard === 'decimal' ? 'decimal-pad' : keyboard === 'number' ? 'number-pad' : 'default'}
            style={{ flex: 1 }} selectTextOnFocus />
          {unit ? <Text style={{ marginLeft: 10, color: C.muted, fontWeight: '600' }}>{unit}</Text> : null}
        </View>
      </Field>
      <View style={st.actions}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title="Lưu" onPress={() => onSave(text)} style={{ flex: 1 }} />
      </View>
    </>
  );
}

/** Sheet xác nhận */
export function ConfirmSheet({ visible, onClose, title, desc, confirmText = 'Đồng ý', danger, onConfirm, children }: {
  visible: boolean; onClose: () => void; title: string; desc?: string; confirmText?: string; danger?: boolean; onConfirm: () => void; children?: React.ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} desc={desc}>
      {children}
      <View style={st.actions}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title={confirmText} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/* ---------- Toast ---------- */
export function ToastHost() {
  const [m, setM] = useState<ToastMsg | null>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => onToast(setM), []);
  if (!m) return null;
  const bg = m.kind === 'err' ? C.red : m.kind === 'ok' ? C.green : 'rgba(28,28,30,0.92)';
  return (
    <View pointerEvents="none" style={[st.toast, { bottom: insets.bottom + 90, backgroundColor: bg }]}>
      <Text style={st.toastText}>{m.text}</Text>
    </View>
  );
}

export function Empty({ icon, text, sub }: { icon: IonName; text: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Ionicons name={icon} size={44} color="#C5C6CF" />
      <Text style={{ color: C.muted, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>{text}</Text>
      {sub ? <Text style={{ color: '#B0B0B8', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

export function Avatar({ name, size = 38, bg = C.blueSoft, fg = C.blue }: { name: string; size?: number; bg?: string; fg?: string }) {
  const last = name.trim().split(/\s+/).pop() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: size * 0.42 }}>{last.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, backgroundColor: C.bg },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 0, flexWrap: 'wrap' },
  title: { fontSize: 19, fontWeight: '700', color: C.text, maxWidth: '85%' },
  subtitle: { width: '100%', textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 1 },
  rightWrap: { flexDirection: 'row', gap: 6 },
  iconbtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: R, padding: 14, marginBottom: 12, ...shadow },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  pillSm: { paddingVertical: 5, paddingHorizontal: 9 },
  pillText: { fontWeight: '700', fontSize: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 13 },
  btnSm: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontWeight: '700', fontSize: 16 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, minHeight: 46, gap: 10 },
  kvLabel: { color: C.muted, fontSize: 14 },
  kvSub: { color: '#B0B0B8', fontSize: 11, marginTop: 1 },
  kvRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  kvValue: { fontWeight: '700', fontSize: 15.5, textAlign: 'right', fontVariant: ['tabular-nums'] },
  kvUnit: { color: C.muted, fontWeight: '500', fontSize: 13 },
  toggle: { flexDirection: 'row', backgroundColor: C.gray, borderRadius: 10, padding: 3, gap: 2 },
  toggleBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  toggleText: { fontWeight: '700', fontSize: 13, color: '#666' },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D9DAE0' },
  switchKnob: { position: 'absolute', top: 3, left: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', ...shadow },
  stats: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R, marginBottom: 12, overflow: 'hidden' },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
  statBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line },
  statV: { fontSize: 18, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, color: C.muted, fontWeight: '600' },
  statL: { fontSize: 12, color: C.muted, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 12, flexShrink: 1, maxHeight: '92%' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: C.text },
  sheetDesc: { color: C.muted, fontSize: 13.5, marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: C.muted, fontWeight: '600', marginBottom: 6 },
  fieldHint: { fontSize: 12, color: C.muted, marginTop: 5 },
  input: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 17, backgroundColor: '#FAFAFC', color: C.text },
  inputBig: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  toast: { position: 'absolute', alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, maxWidth: '90%' },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' },
});
