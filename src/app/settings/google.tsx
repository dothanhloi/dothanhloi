import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Card, Field, Input, KV, Switch, TopBar, haptic } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';
import { useStore } from '../../lib/store';
import { getSyncStatus, onSyncStatus, SyncStatus, syncNow, testSheetUrl } from '../../lib/sync';
import { C } from '../../lib/theme';
import { toast } from '../../lib/toast';

const GUIDE_URL = 'https://github.com/dothanhloi/dothanhloi#li%C3%AAn-k%E1%BA%BFt-google-sheets';

export default function GoogleSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [url, setUrl] = useState(settings.sheetUrl);
  const [testing, setTesting] = useState(false);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setSync), []);

  async function saveAndTest() {
    const u = url.trim();
    if (!u) { setSettings({ sheetUrl: '', lastPush: null, lastSync: null }); toast('Đã huỷ liên kết'); return; }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(u)) return toast('Link phải có dạng https://script.google.com/macros/s/.../exec', 'err', 3500);
    setTesting(true);
    try {
      const r = await testSheetUrl(u);
      setSettings({ sheetUrl: u, lastPush: null, lastSync: null });
      haptic('success');
      toast(`Kết nối OK: ${r.sheet}`, 'ok');
      const res = await syncNow({ full: true });
      if (res.ok) toast(`Đồng bộ lần đầu: gửi ${res.pushed}, nhận ${res.received}`, 'ok', 3000);
    } catch (e: any) {
      toast('Không kết nối được: ' + (e?.message || e), 'err', 4000);
    } finally { setTesting(false); }
  }

  const steps = [
    'Tạo một Google Sheets mới (sheets.new) trên tài khoản Google của bạn.',
    'Mở menu Tiện ích mở rộng → Apps Script, xoá nội dung có sẵn, dán toàn bộ file google-apps-script/Code.gs (có trong mã nguồn app) rồi bấm Lưu.',
    'Bấm Triển khai → Tùy chọn triển khai mới → loại Ứng dụng web. Chọn "Thực thi với tư cách: Tôi" và "Ai có quyền truy cập: Bất kỳ ai". Bấm Triển khai và cấp quyền.',
    'Sao chép URL ứng dụng web (kết thúc bằng /exec) và dán vào ô bên dưới, bấm Lưu & kiểm tra.',
    'Dán cùng link này trên điện thoại của các nhân viên khác để mọi người dùng chung dữ liệu.',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="Google Sheets" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <Card title="Trạng thái">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={[st.dot, { backgroundColor: sync.state === 'ok' ? C.green : sync.state === 'error' ? C.red : sync.state === 'syncing' ? C.orange : '#BBB' }]} />
            <Text style={{ fontWeight: '600', flex: 1 }}>{settings.sheetUrl ? (sync.message || 'Đã liên kết') : 'Chưa liên kết'}</Text>
          </View>
          <KV label="Đồng bộ lần cuối" value={fmtDateTime(settings.lastSync)} />
          <KV label="Tự động đồng bộ" sub="sau mỗi thay đổi, khi có mạng" right={<Switch on={settings.autoSync} onChange={(v) => setSettings({ autoSync: v })} />} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Btn title="Đồng bộ ngay" icon="sync" kind="secondary" disabled={!settings.sheetUrl || sync.state === 'syncing'} onPress={async () => { const r = await syncNow(); if (r.ok) toast(`Gửi ${r.pushed}, nhận ${r.received}`, 'ok'); else if ('error' in r) toast(r.error, 'err', 4000); }} style={{ flex: 1 }} />
            <Btn title="Gửi lại toàn bộ" icon="cloud-upload-outline" kind="ghost" disabled={!settings.sheetUrl || sync.state === 'syncing'} onPress={async () => { const r = await syncNow({ full: true }); if (r.ok) toast(`Đã gửi ${r.pushed} bản ghi`, 'ok'); else if ('error' in r) toast(r.error, 'err', 4000); }} style={{ flex: 1 }} />
          </View>
        </Card>

        <Card title="Link Apps Script">
          <Field hint="Dạng: https://script.google.com/macros/s/AKfyc.../exec">
            <Input value={url} onChangeText={setUrl} placeholder="Dán link ứng dụng web tại đây" autoCapitalize="none" autoCorrect={false} keyboardType="url" multiline style={{ fontSize: 14, minHeight: 70 }} />
          </Field>
          <Btn title={testing ? 'Đang kiểm tra...' : 'Lưu & kiểm tra kết nối'} icon="checkmark-circle" disabled={testing} onPress={saveAndTest} />
        </Card>

        <Card title="Hướng dẫn cài đặt (làm 1 lần)">
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={st.step}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
              <Text style={{ flex: 1, color: C.text, lineHeight: 20, fontSize: 14 }}>{s}</Text>
            </View>
          ))}
          <Btn title="Mở hướng dẫn chi tiết" kind="ghost" icon="open-outline" small onPress={() => Linking.openURL(GUIDE_URL)} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'flex-start' }}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} />
            <Text style={{ color: C.muted, fontSize: 12.5, flex: 1, lineHeight: 17 }}>
              Trong Google Sheets sẽ có các trang: “Xe” (mỗi xe một dòng, tổng kết), “Chi tiết cân” (từng bao), “Lịch sử sửa”, “Nhân viên”, “Tài xế” và “DATA” (dữ liệu gốc – không sửa tay).
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
  step: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
