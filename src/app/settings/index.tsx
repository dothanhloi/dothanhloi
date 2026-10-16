import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, ConfirmSheet, InputSheet, Pill, TopBar, haptic } from '../../components/ui';
import { fmtDateTime, fmtNum, todayStr } from '../../lib/format';
import { activeDrivers, activeUsers, selectCurrentUser, useStore } from '../../lib/store';
import { getSyncStatus, onSyncStatus, SyncStatus } from '../../lib/sync';
import { C, shadow } from '../../lib/theme';
import { toast } from '../../lib/toast';
import type { SyncRecord } from '../../lib/types';

function Row({ icon, color, title, sub, onPress, right }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
      <View style={[st.icon, { backgroundColor: color }]}><Ionicons name={icon} size={18} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>{title}</Text>
        {sub ? <Text style={st.sub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null)}
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const user = useStore(selectCurrentUser);
  const isAdmin = user?.role === 'admin';
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setSync), []);
  const [edit, setEdit] = useState<null | 'moistureStd' | 'tarePerBag' | 'tablesPerTruck'>(null);
  const [askReset, setAskReset] = useState(false);
  const [askImport, setAskImport] = useState<SyncRecord[] | null>(null);

  async function exportData() {
    try {
      const data = { exportedAt: new Date().toISOString(), users: store.users, drivers: store.drivers, trucks: store.trucks };
      const file = new File(Paths.cache, `cancaphe-${todayStr()}.json`);
      await file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Sao lưu dữ liệu' });
      else toast('Đã lưu: ' + file.uri, 'ok');
    } catch (e: any) { toast('Lỗi sao lưu: ' + (e?.message || e), 'err', 3000); }
  }
  async function importData() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const text = await new File(res.assets[0].uri).text();
      const data = JSON.parse(text);
      const recs: SyncRecord[] = [...Object.values(data.users || {}), ...Object.values(data.drivers || {}), ...Object.values(data.trucks || {})] as SyncRecord[];
      if (!recs.length) return toast('File không có dữ liệu', 'err');
      setAskImport(recs);
    } catch (e: any) { toast('Không đọc được file: ' + (e?.message || e), 'err', 3000); }
  }

  const labels = { moistureStd: 'Độ chuẩn mặc định (%)', tarePerBag: 'Bì mỗi bao mặc định (kg)', tablesPerTruck: 'Số bảng mặc định khi tạo xe' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Cài đặt" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={user?.name || '?'} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 17 }}>{user?.name}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{isAdmin ? 'Quản lý' : 'Nhân viên'}</Text>
            </View>
            <Pill text="Đăng xuất" color="gray" small onPress={() => store.logout()} />
          </View>
        </Card>

        <Card title="Quản lý">
          <Row icon="people" color={C.blue} title="Nhân viên" sub={`${activeUsers(store).length} tài khoản · ai cân hàng sẽ hiện tên trên xe`} onPress={() => router.push('/settings/users')} />
          <Row icon="car" color={C.orange} title="Tài xế" sub={`${activeDrivers(store).length} tài xế`} onPress={() => router.push('/settings/drivers')} />
          <Row icon="logo-google" color={C.green} title="Liên kết Google Sheets"
            sub={store.settings.sheetUrl ? (sync.state === 'error' ? 'Lỗi: ' + sync.message : `Đã liên kết · đồng bộ lần cuối ${fmtDateTime(store.settings.lastSync)}`) : 'Chưa liên kết – dữ liệu chỉ lưu trên máy này'}
            onPress={() => router.push('/settings/google')} />
        </Card>

        <Card title="Mặc định khi tạo xe">
          <Row icon="water" color={C.blue} title={labels.moistureStd} sub={`${fmtNum(store.settings.moistureStd)} % · phần vượt quá sẽ bị trừ theo %`} onPress={() => setEdit('moistureStd')} />
          <Row icon="bag-handle" color={C.orange} title={labels.tarePerBag} sub={`${fmtNum(store.settings.tarePerBag)} kg`} onPress={() => setEdit('tarePerBag')} />
          <Row icon="grid" color={C.green} title={labels.tablesPerTruck} sub={`${store.settings.tablesPerTruck} bảng × 25 bao`} onPress={() => setEdit('tablesPerTruck')} />
        </Card>

        <Card title="Dữ liệu">
          <Row icon="share-outline" color={C.blue} title="Sao lưu ra file" sub="Xuất toàn bộ dữ liệu (JSON) để gửi Zalo/Email hoặc lưu iCloud" onPress={exportData} />
          <Row icon="download-outline" color={C.green} title="Khôi phục từ file" sub="Gộp dữ liệu từ file sao lưu vào máy này" onPress={importData} />
          {isAdmin ? <Row icon="trash" color={C.red} title="Xoá toàn bộ dữ liệu trên máy" sub="Không ảnh hưởng dữ liệu đã đồng bộ lên Google Sheets" onPress={() => setAskReset(true)} /> : null}
        </Card>

        <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 8 }}>Cân Cà Phê · phiên bản {Constants.expoConfig?.version || '1.0.0'}</Text>
      </ScrollView>

      <InputSheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? labels[edit] : ''} keyboard={edit === 'tablesPerTruck' ? 'number' : 'decimal'}
        initial={edit ? String(store.settings[edit]) : ''}
        onSave={(txt) => { const n = Number(String(txt).replace(',', '.')); if (isNaN(n) || n < 0) return toast('Số không hợp lệ', 'err'); store.setSettings({ [edit!]: edit === 'tablesPerTruck' ? Math.max(1, Math.round(n)) : n }); setEdit(null); haptic('success'); }} />

      <ConfirmSheet visible={askReset} onClose={() => setAskReset(false)} title="Xoá toàn bộ dữ liệu trên máy?" danger confirmText="Xoá hết"
        desc="Tất cả xe, nhân viên, tài xế trên máy này sẽ bị xoá và bạn sẽ phải đăng nhập lại. Hãy sao lưu trước."
        onConfirm={() => { setAskReset(false); store.resetAll(); }} />
      <ConfirmSheet visible={!!askImport} onClose={() => setAskImport(null)} title="Khôi phục dữ liệu?" confirmText="Gộp vào máy"
        desc={`File có ${askImport?.length || 0} bản ghi. Bản ghi mới hơn sẽ ghi đè bản cũ, dữ liệu hiện có không bị mất.`}
        onConfirm={() => { const n = store.mergeRecords(askImport || []); setAskImport(null); toast(`Đã cập nhật ${n} bản ghi`, 'ok'); }} />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', ...shadow },
  title: { fontWeight: '700', color: C.text, fontSize: 15 },
  sub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
});
