import React from 'react';
import { CatalogScreen } from '../../components/CatalogScreen';
import { activeWarehouses, useStore } from '../../lib/store';

export default function Warehouses() {
  const store = useStore();
  const trucks = Object.values(store.trucks).filter((t) => !t.deleted);
  const items = activeWarehouses(store).map((w) => ({ id: w.id, name: w.name, sub: `${trucks.filter((t) => t.warehouseId === w.id).length} xe nhập${w.note ? ' · ' + w.note : ''}`, values: { name: w.name, note: w.note } }));
  return (
    <CatalogScreen title="Kho" icon="home-outline" items={items} emptyText="Chưa có kho. Nếu chỉ có một kho, bạn không cần tạo."
      fields={[{ key: 'name', label: 'Tên kho', placeholder: 'VD: Kho 1 – Ea H’leo' }, { key: 'note', label: 'Ghi chú', placeholder: 'Địa chỉ, sức chứa...' }]}
      onAdd={(v) => store.addWarehouse({ name: v.name, note: v.note })}
      onUpdate={(id, v) => store.updateWarehouse(id, { name: v.name.trim(), note: (v.note || '').trim() })}
      onRemove={(id) => store.removeWarehouse(id)} />
  );
}
