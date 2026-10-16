import React from 'react';
import { Text, View } from 'react-native';
import { CatalogScreen } from '../../components/CatalogScreen';
import { Field, Pill } from '../../components/ui';
import { activePresets, activeProducts, useStore } from '../../lib/store';
import { C } from '../../lib/theme';

export default function Products() {
  const store = useStore();
  const presets = activePresets(store);
  const trucks = Object.values(store.trucks).filter((t) => !t.deleted);
  const items = activeProducts(store).map((p) => ({
    id: p.id, name: p.name,
    sub: `${trucks.filter((t) => t.productId === p.id).length} xe · quy ước: ${p.presetId && store.presets[p.presetId] ? store.presets[p.presetId].name : 'mặc định'}${p.note ? ' · ' + p.note : ''}`,
    values: { name: p.name, note: p.note, presetId: p.presetId || '' },
  }));
  return (
    <CatalogScreen title="Loại hàng" icon="leaf-outline" items={items} emptyText="VD: Robusta nhân xô, Cà phê tươi, Arabica..."
      fields={[{ key: 'name', label: 'Tên loại hàng', placeholder: 'VD: Robusta nhân xô' }, { key: 'note', label: 'Ghi chú', placeholder: 'Tiêu chuẩn, lưu ý' }]}
      renderExtraField={(values, set) => (
        <Field label="Quy ước tạp độ áp dụng khi chọn loại hàng này" hint="Bỏ trống = dùng quy ước mặc định">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pill text="Mặc định" color={!values.presetId ? 'blue' : 'gray'} small onPress={() => set('presetId', '')} />
            {presets.map((p) => <Pill key={p.id} text={p.name} color={values.presetId === p.id ? 'blue' : 'gray'} small onPress={() => set('presetId', p.id)} />)}
          </View>
          {presets.length === 0 ? <Text style={{ color: C.muted, fontSize: 12 }}>Chưa có quy ước nào.</Text> : null}
        </Field>
      )}
      onAdd={(v) => store.addProduct({ name: v.name, note: v.note, presetId: v.presetId || null })}
      onUpdate={(id, v) => store.updateProduct(id, { name: v.name.trim(), note: (v.note || '').trim(), presetId: v.presetId || null })}
      onRemove={(id) => store.removeProduct(id)} />
  );
}
