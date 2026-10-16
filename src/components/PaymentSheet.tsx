import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { truckStats } from '../lib/calc';
import { fmtMoney, parseNum } from '../lib/format';
import { useStore } from '../lib/store';
import { C } from '../lib/theme';
import { toast } from '../lib/toast';
import type { PaymentMethod } from '../lib/types';
import { Btn, Field, Input, Pill, Sheet, Toggle, haptic } from './ui';

/** Sheet thêm một lần thanh toán cho xe */
export function PaymentSheet({ truckId, onClose }: { truckId: string | null; onClose: () => void }) {
  const t = useStore((s) => (truckId ? s.trucks[truckId] : undefined));
  return (
    <Sheet visible={!!truckId && !!t} onClose={onClose} title={t ? `Thanh toán · ${t.name}` : ''}>
      {t ? <Body truckId={t.id} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Body({ truckId, onClose }: { truckId: string; onClose: () => void }) {
  const t = useStore((s) => s.trucks[truckId]);
  const addPayment = useStore((s) => s.addPayment);
  const s = truckStats(t);
  const remaining = s.remaining != null ? Math.max(0, Math.round(s.remaining)) : null;
  const [amount, setAmount] = useState(remaining != null && remaining > 0 ? String(remaining) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');

  function save() {
    const n = parseNum(amount);
    if (n == null || isNaN(n) || n <= 0) return toast('Nhập số tiền', 'err');
    addPayment(truckId, { amount: n, method, note });
    haptic('success');
    toast(`Đã ghi ${fmtMoney(n)}`, 'ok');
    onClose();
  }

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: C.muted }}>Thành tiền <Text style={{ fontWeight: '700', color: C.text }}>{fmtMoney(s.amount)}</Text></Text>
        <Text style={{ color: C.muted }}>Còn lại <Text style={{ fontWeight: '700', color: C.red }}>{fmtMoney(s.remaining)}</Text></Text>
      </View>
      <Field label="Số tiền (đ)">
        <Input big autoFocus value={amount} onChangeText={setAmount} keyboardType="number-pad" selectTextOnFocus placeholder="0" />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {remaining != null && remaining > 0 ? <Pill text={`Trả hết ${fmtMoney(remaining)}`} color="green" small onPress={() => setAmount(String(remaining))} /> : null}
          {[1_000_000, 5_000_000, 10_000_000, 50_000_000].map((v) => <Pill key={v} text={'+' + fmtMoney(v)} color="gray" small onPress={() => setAmount(String((parseNum(amount) || 0) + v))} />)}
        </View>
      </Field>
      <Field label="Hình thức">
        <Toggle value={method} onChange={setMethod} options={[{ v: 'cash', label: 'Tiền mặt', color: 'green' }, { v: 'transfer', label: 'Chuyển khoản', color: 'blue' }, { v: 'other', label: 'Khác', color: 'orange' }]} />
      </Field>
      <Field label="Ghi chú"><Input value={note} onChangeText={setNote} placeholder="VD: CK Vietcombank, ứng trước đợt 1" /></Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Huỷ" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Btn title="Ghi thanh toán" kind="success" icon="checkmark" onPress={save} style={{ flex: 2 }} />
      </View>
    </>
  );
}
