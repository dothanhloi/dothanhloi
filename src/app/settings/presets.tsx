import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Card, ConfirmSheet, Empty, Field, IconBtn, Input, Pill, Sheet, Switch, Toggle, TopBar, haptic } from '../../components/ui';
import { PRESET_TEMPLATES, applyRule } from '../../lib/calc';
import { fmtKg, fmtMoney, fmtNum, parseNum } from '../../lib/format';
import { presetSummary, ruleText, tareText } from '../../lib/presetText';
import { activePresets, selectCurrentUser, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { DeductMethod, DeductRule, QualityPreset } from '../../lib/types';

type Draft = Omit<QualityPreset, 'id' | 'type' | 'createdAt' | 'updatedAt'> & { id?: string };

export default function Presets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const me = useStore(selectCurrentUser);
  const isAdmin = me?.role === 'admin';
  const presets = activePresets(store);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pickTpl, setPickTpl] = useState(false);
  const [del, setDel] = useState<QualityPreset | null>(null);

  function openNew(tplKey?: string) {
    const tpl = PRESET_TEMPLATES.find((x) => x.key === tplKey);
    const base = tpl ? tpl.make() : PRESET_TEMPLATES[0].make();
    setDraft({ ...base, name: tpl ? tpl.name : '', note: tpl ? tpl.desc : '', isDefault: presets.length === 0 });
    setPickTpl(false);
  }
  function openEdit(p: QualityPreset) {
    setDraft({ id: p.id, name: p.name, note: p.note || '', isDefault: p.isDefault, tareMode: p.tareMode, tareValue: p.tareValue, impurityInput: p.impurityInput,
      impurity: { ...p.impurity, table: (p.impurity.table || []).map((r) => ({ ...r })) }, moisture: { ...p.moisture, table: (p.moisture.table || []).map((r) => ({ ...r })) } });
  }
  function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2) return toast('Nhập tên quy ước', 'err');
    for (const [k, r] of [['Tạp', draft.impurity], ['Độ', draft.moisture]] as const) {
      if (r.method === 'table' && !(r.table || []).length) return toast(`${k}: bảng trừ lùi chưa có bậc nào`, 'err');
    }
    const { id, ...rest } = draft;
    const clean = { ...rest, name: rest.name.trim(), impurity: cleanRule(rest.impurity), moisture: cleanRule(rest.moisture) };
    if (id) store.updatePreset(id, clean); else store.addPreset(clean);
    haptic('success');
    setDraft(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Quy ước tạp độ" onBack={() => router.back()} right={isAdmin ? <IconBtn name="add" color="blue" onPress={() => setPickTpl(true)} /> : undefined} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
          Mỗi quy ước định nghĩa cách nhập tạp, mức chuẩn và cách trừ tạp, độ, bì. Khi tạo xe, app áp dụng quy ước mặc định; trên từng xe có thể đổi sang quy ước khác theo thoả thuận với người bán.
        </Text>
        {presets.length === 0 ? <Empty icon="options-outline" text="Chưa có quy ước" sub="Bấm + để tạo từ mẫu" /> : presets.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>{p.name}</Text>
                  {p.isDefault ? <Pill text="Mặc định" color="green" small icon="star" /> : null}
                </View>
                {p.note ? <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{p.note}</Text> : null}
              </View>
              {isAdmin ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <IconBtn name="pencil" color="blue" onPress={() => openEdit(p)} />
                  <IconBtn name="trash-outline" color="red" onPress={() => setDel(p)} />
                </View>
              ) : null}
            </View>
            <View style={st.rules}>
              <Text style={st.rule}>• {ruleText('Tạp', p.impurity)} ({p.impurityInput === 'gram' ? 'nhập gram trong mẫu' : 'nhập % trực tiếp'})</Text>
              <Text style={st.rule}>• {ruleText('Độ', p.moisture)}</Text>
              <Text style={st.rule}>• {tareText(p)}</Text>
            </View>
            {isAdmin && !p.isDefault ? <Btn title="Đặt làm mặc định" kind="ghost" small icon="star-outline" onPress={() => { store.setDefaultPreset(p.id); haptic(); }} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
          </Card>
        ))}
        {isAdmin ? <Btn title="Thêm quy ước" icon="add-circle" onPress={() => setPickTpl(true)} /> : <Text style={{ color: C.muted, textAlign: 'center', fontSize: 13 }}>Chỉ quản lý mới sửa được quy ước.</Text>}
      </ScrollView>

      {/* chọn mẫu */}
      <Sheet visible={pickTpl} onClose={() => setPickTpl(false)} title="Tạo quy ước từ mẫu" desc="Chọn mẫu gần nhất rồi chỉnh lại số liệu theo thoả thuận của bạn.">
        {PRESET_TEMPLATES.map((tpl) => (
          <Pressable key={tpl.key} onPress={() => openNew(tpl.key)} style={({ pressed }) => [st.tpl, pressed && { opacity: 0.7 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.text }}>{tpl.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{tpl.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}
      </Sheet>

      {/* form */}
      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Sửa quy ước' : 'Quy ước mới'}>
        {draft ? <PresetForm draft={draft} onChange={setDraft} onCancel={() => setDraft(null)} onSave={save} /> : null}
      </Sheet>

      <ConfirmSheet visible={!!del} onClose={() => setDel(null)} title={`Xoá quy ước ${del?.name}?`} danger confirmText="Xoá"
        desc="Các xe đã chọn quy ước này vẫn giữ nguyên cách tính (xe lưu bản sao)."
        onConfirm={() => { if (del) store.removePreset(del.id); setDel(null); store.ensureDefaultPreset(); }} />
    </View>
  );
}

function cleanRule(r: DeductRule): DeductRule {
  return { standard: Number(r.standard) || 0, method: r.method, rate: Number(r.rate) || 0, tableUnit: r.tableUnit || 'kgPct',
    table: (r.table || []).filter((x) => x.upTo != null && !isNaN(Number(x.upTo))).map((x) => ({ upTo: Number(x.upTo), value: Number(x.value) || 0 })).sort((a, b) => a.upTo - b.upTo) };
}

/* ---------- Form ---------- */
function NumInput({ value, onChange, unit, placeholder }: { value: number | string; onChange: (n: number) => void; unit?: string; placeholder?: string }) {
  const [txt, setTxt] = useState(value === '' || value == null ? '' : String(value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
      <Input value={txt} placeholder={placeholder} keyboardType="decimal-pad" style={{ flex: 1, paddingVertical: 9, fontSize: 16 }}
        onChangeText={(v) => { setTxt(v); const n = parseNum(v); if (n != null && !isNaN(n)) onChange(n); else if (v.trim() === '') onChange(0); }} />
      {unit ? <Text style={{ color: C.muted, fontWeight: '600', minWidth: 36 }}>{unit}</Text> : null}
    </View>
  );
}

const METHODS: { v: DeductMethod; label: string; color: 'green' | 'blue' | 'orange' | 'red' }[] = [
  { v: 'none', label: 'Không trừ', color: 'green' }, { v: 'kg', label: 'Trừ kg', color: 'blue' }, { v: 'price', label: 'Trừ giá', color: 'orange' }, { v: 'table', label: 'Bảng', color: 'red' },
];

function RuleEditor({ label, rule, onChange }: { label: string; rule: DeductRule; onChange: (r: DeductRule) => void }) {
  const set = (patch: Partial<DeductRule>) => onChange({ ...rule, ...patch });
  // ví dụ minh hoạ
  const demo = rule.method === 'none' ? null : applyRule(rule, (Number(rule.standard) || 0) + 2, 1000);
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{label}</Text>
      <Field label="Cách trừ">
        <Toggle value={rule.method} options={METHODS} onChange={(v) => set({ method: v })} />
      </Field>
      {rule.method !== 'none' && rule.method !== 'table' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label={`${label} chuẩn`} style={{ flex: 1 }}><NumInput value={rule.standard} unit="%" onChange={(n) => set({ standard: n })} /></Field>
          <Field label={rule.method === 'kg' ? 'Mỗi 1% vượt trừ' : 'Mỗi 1% vượt trừ'} style={{ flex: 1 }}>
            <NumInput value={rule.rate} unit={rule.method === 'kg' ? '% kg' : 'đ/kg'} onChange={(n) => set({ rate: n })} />
          </Field>
        </View>
      ) : null}
      {rule.method === 'table' ? (
        <>
          <Field label="Bảng trừ theo">
            <Toggle value={rule.tableUnit} options={[{ v: 'kgPct', label: '% khối lượng', color: 'blue' }, { v: 'price', label: 'đ/kg vào giá', color: 'orange' }]} onChange={(v) => set({ tableUnit: v })} />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            <Text style={[st.th, { flex: 1 }]}>{label} đo được ≤ (%)</Text>
            <Text style={[st.th, { flex: 1 }]}>Trừ ({rule.tableUnit === 'price' ? 'đ/kg' : '% kg'})</Text>
            <View style={{ width: 36 }} />
          </View>
          {(rule.table || []).map((row, i) => (
            <View key={`${i}-${rule.table.length}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <NumInput value={row.upTo} onChange={(n) => set({ table: rule.table.map((r, j) => (j === i ? { ...r, upTo: n } : r)) })} />
              <NumInput value={row.value} onChange={(n) => set({ table: rule.table.map((r, j) => (j === i ? { ...r, value: n } : r)) })} />
              <IconBtn name="close" color="red" size={16} style={{ width: 36, height: 36 }} onPress={() => set({ table: rule.table.filter((_, j) => j !== i) })} />
            </View>
          ))}
          <Btn title="Thêm bậc" kind="secondary" small icon="add" onPress={() => { const last = rule.table[rule.table.length - 1]; set({ table: [...rule.table, { upTo: last ? last.upTo + 1 : 13, value: last ? last.value : 0 }] }); }} style={{ alignSelf: 'flex-start' }} />
          <Text style={st.hint}>Giá trị đo lớn hơn bậc cuối sẽ áp dụng bậc cuối.</Text>
        </>
      ) : null}
      {demo ? <Text style={st.hint}>Ví dụ: 1.000 kg, {label.toLowerCase()} {fmtNum((Number(rule.standard) || 0) + 2, 1)}% → {demo.kg ? `trừ ${fmtKg(demo.kg)} kg` : demo.price ? `trừ ${fmtMoney(demo.price)}/kg` : 'không trừ'}</Text> : null}
    </View>
  );
}

function PresetForm({ draft, onChange, onCancel, onSave }: { draft: Draft; onChange: (d: Draft) => void; onCancel: () => void; onSave: () => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <>
      <Field label="Tên quy ước"><Input value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="VD: Đại lý Ba Tư, Hàng xô 13/1" /></Field>
      <Field label="Ghi chú"><Input value={draft.note} onChangeText={(v) => set({ note: v })} placeholder="Áp dụng cho ai, lưu ý gì" /></Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontWeight: '600', color: C.text }}>Dùng làm mặc định khi tạo xe</Text>
        <Switch on={draft.isDefault} onChange={(v) => set({ isDefault: v })} />
      </View>

      <View style={st.section}>
        <Text style={st.sectionTitle}>Tạp chất</Text>
        <Field label="Cách nhập tạp">
          <Toggle value={draft.impurityInput} options={[{ v: 'gram', label: 'Gram trong mẫu', color: 'blue' }, { v: 'percent', label: 'Nhập % trực tiếp', color: 'blue' }]} onChange={(v) => set({ impurityInput: v })} />
          <Text style={st.hint}>{draft.impurityInput === 'gram' ? 'Nhập Mẫu (g) và Tạp (g), app tự tính % tạp.' : 'Nhập thẳng % tạp đã thoả thuận.'}</Text>
        </Field>
      </View>
      <RuleEditor label="Tạp" rule={draft.impurity} onChange={(r) => set({ impurity: r })} />
      <RuleEditor label="Độ" rule={draft.moisture} onChange={(r) => set({ moisture: r })} />

      <View style={st.section}>
        <Text style={st.sectionTitle}>Bì (bao)</Text>
        <Field label="Cách trừ bì">
          <Toggle value={draft.tareMode} options={[{ v: 'none', label: 'Không trừ', color: 'green' }, { v: 'perBag', label: 'kg mỗi bao', color: 'blue' }, { v: 'percent', label: '% tổng thô', color: 'orange' }]} onChange={(v) => set({ tareMode: v })} />
        </Field>
        {draft.tareMode !== 'none' ? <Field label="Mức bì"><NumInput value={draft.tareValue} unit={draft.tareMode === 'perBag' ? 'kg/bao' : '%'} onChange={(n) => set({ tareValue: n })} /></Field> : null}
      </View>

      <Text style={[st.hint, { marginBottom: 8 }]}>Tóm tắt: {presetSummary({ ...draft, id: draft.id || '' })}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Huỷ" kind="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title="Lưu quy ước" onPress={onSave} style={{ flex: 2 }} />
      </View>
    </>
  );
}

const st = StyleSheet.create({
  rules: { marginTop: 8, gap: 3 },
  rule: { color: '#444', fontSize: 13, lineHeight: 18 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, marginBottom: 8 },
  section: { backgroundColor: C.bg, borderRadius: 12, padding: 12, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: 14, color: C.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  th: { fontSize: 12, color: C.muted, fontWeight: '600' },
  hint: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 16 },
});
