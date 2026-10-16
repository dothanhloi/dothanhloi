import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tableStats } from '../lib/calc';
import { fmtKg, fmtNum } from '../lib/format';
import { C } from '../lib/theme';
import type { WeighTable as WT } from '../lib/types';
import { Pill } from './ui';

export interface EditingCell { tableIdx: number; col: number; row: number; text: string }

interface Props {
  table: WT;
  tableIdx: number;
  editing: EditingCell | null;
  readOnly: boolean;             // xe đã xong
  onCellPress: (tableIdx: number, col: number, row: number) => void;
  onCellLongPress: (tableIdx: number, col: number, row: number) => void;
  onToggleLock: (tableIdx: number) => void;
}

function WeighTableImpl({ table, tableIdx, editing, readOnly, onCellPress, onCellLongPress, onToggleLock }: Props) {
  const s = tableStats(table);
  const locked = table.locked || readOnly;
  const rows = table.cells[0]?.length || 5;
  return (
    <View style={st.block}>
      <View style={st.head}>
        <Pill text={table.name} color="blue" />
        <Pill text={locked ? 'Khoá' : 'Mở'} color={locked ? 'gray' : 'green'} icon={locked ? 'lock-closed' : 'lock-open'} small
          onPress={readOnly ? undefined : () => onToggleLock(tableIdx)} />
        <View style={{ flex: 1 }} />
        <Pill text={fmtKg(s.total) + ' kg'} color="green" icon="scale-outline" />
      </View>
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={st.row}>
          {table.cells.map((col, ci) => {
            const v = col[row];
            const isEditing = editing && editing.tableIdx === tableIdx && editing.col === ci && editing.row === row;
            return (
              <Pressable key={ci} onPress={() => onCellPress(tableIdx, ci, row)} onLongPress={() => onCellLongPress(tableIdx, ci, row)} delayLongPress={450}
                style={({ pressed }) => [st.cell, v != null && st.cellFilled, isEditing && st.cellEditing, pressed && !locked && st.cellPressed, locked && v == null && { opacity: 0.6 }]}>
                {isEditing ? (
                  <Text style={[st.cellText, { color: C.blue }]} numberOfLines={1} adjustsFontSizeToFit>
                    {editing!.text === '' ? ' ' : editing!.text}<Text style={{ color: C.blue }}>|</Text>
                  </Text>
                ) : v != null ? (
                  <Text style={st.cellText} numberOfLines={1} adjustsFontSizeToFit>{fmtNum(v)}</Text>
                ) : (
                  <Text style={st.cellIdx}>{ci + 1}.{row + 1}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={st.row}>
        {s.colTotals.map((t, ci) => (
          <View key={ci} style={st.total}>
            <Text style={[st.totalText, t === 0 && { color: '#E8A39E' }]} numberOfLines={1} adjustsFontSizeToFit>{fmtNum(t)}</Text>
          </View>
        ))}
      </View>
      <View style={st.foot}>
        <Ionicons name="cube-outline" size={13} color={C.muted} />
        <Text style={st.footText}>{s.bags} bao · {fmtKg(s.total)} kg</Text>
      </View>
    </View>
  );
}

export const WeighTable = memo(WeighTableImpl);

const st = StyleSheet.create({
  block: { marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  cell: { flex: 1, height: 52, borderRadius: 10, backgroundColor: C.cell, alignItems: 'center', justifyContent: 'center' },
  cellFilled: { backgroundColor: C.cellFilled, borderWidth: 1, borderColor: C.line },
  cellEditing: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.blue },
  cellPressed: { transform: [{ scale: 0.95 }], backgroundColor: C.blueSoft },
  cellText: { fontSize: 15.5, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  cellIdx: { fontSize: 10, color: '#B9BAC4', fontWeight: '600' },
  total: { flex: 1, height: 46, borderRadius: 10, backgroundColor: C.redSoft, alignItems: 'center', justifyContent: 'center' },
  totalText: { fontSize: 15, fontWeight: '800', color: C.red, fontVariant: ['tabular-nums'] },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  footText: { fontSize: 12, color: C.muted, fontWeight: '600' },
});
