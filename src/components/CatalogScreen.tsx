import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../lib/theme';
import { toast } from '../lib/toast';
import { Avatar, Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Sheet, TopBar, haptic } from './ui';

export interface CatalogItem { id: string; name: string; sub?: string }
export interface CatalogField { key: string; label: string; placeholder?: string; multiline?: boolean }

/** Màn hình danh mục đơn giản: danh sách + thêm/sửa/xoá */
export function CatalogScreen({ title, icon, items, fields, onAdd, onUpdate, onRemove, emptyText, extra, renderExtraField }: {
  title: string; icon?: string; items: CatalogItem[]; fields: CatalogField[];
  onAdd: (values: Record<string, string>) => void; onUpdate: (id: string, values: Record<string, string>) => void; onRemove: (id: string) => void;
  emptyText?: string; extra?: React.ReactNode;
  /** render thêm trường tuỳ chọn trong form (VD: chọn quy ước) */
  renderExtraField?: (values: Record<string, string>, set: (k: string, v: string) => void) => React.ReactNode;
  initialValues?: (id: string) => Record<string, string>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<null | { id?: string; values: Record<string, string> }>(null);
  const [del, setDel] = useState<CatalogItem | null>(null);
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, '']));

  function save() {
    if (!form) return;
    if ((form.values.name || '').trim().length < 1) return toast('Nhập tên', 'err');
    if (form.id) onUpdate(form.id, form.values); else onAdd(form.values);
    haptic('success');
    setForm(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={title} onBack={() => router.back()} right={<IconBtn name="add" color="blue" onPress={() => setForm({ values: blank() })} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        {extra}
        {items.length === 0 ? <Empty icon={(icon as any) || 'list-outline'} text={emptyText || 'Chưa có mục nào'} /> : (
          <Card>
            {items.map((it) => (
              <View key={it.id} style={st.item}>
                <Avatar name={it.name} />
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{it.name}</Text>
                  {it.sub ? <Text style={st.sub}>{it.sub}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <IconBtn name="pencil" color="blue" onPress={() => setForm({ id: it.id, values: { ...blank(), ...(it as any).values } })} />
                  <IconBtn name="trash-outline" color="red" onPress={() => setDel(it)} />
                </View>
              </View>
            ))}
          </Card>
        )}
        <Btn title={`Thêm ${title.toLowerCase()}`} icon="add-circle" onPress={() => setForm({ values: blank() })} />
      </ScrollView>
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}>
        {form ? (
          <>
            {fields.map((f, i) => (
              <Field key={f.key} label={f.label}>
                <Input value={form.values[f.key] || ''} onChangeText={(v) => setForm({ ...form, values: { ...form.values, [f.key]: v } })} placeholder={f.placeholder} autoFocus={i === 0} multiline={f.multiline} />
              </Field>
            ))}
            {renderExtraField ? renderExtraField(form.values, (k, v) => setForm({ ...form, values: { ...form.values, [k]: v } })) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="Huỷ" kind="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Btn title="Lưu" onPress={save} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
      </Sheet>
      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá ${del?.name}?`} danger confirmText="Xoá" desc="Các xe đã gán vẫn giữ nguyên dữ liệu."
        onConfirm={() => { if (del) onRemove(del.id); setDel(null); }} />
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  name: { fontWeight: '700', color: C.text },
  sub: { color: C.muted, fontSize: 12.5 },
});
