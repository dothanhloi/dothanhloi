import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/ui';
import { selectCurrentUser, useStore } from '../lib/store';
import { scheduleSync, syncNow } from '../lib/sync';
import { runAutoBackup } from '../lib/backup';
import { C } from '../lib/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);

  // Tự đồng bộ khi mở app và khi dữ liệu đổi
  useEffect(() => {
    if (!hydrated) return;
    useStore.getState().ensureDefaultPreset();
    // băm PIN cũ sau khi nhận dữ liệu máy chủ (tránh ghi đè PIN quản lý đã đổi ở máy khác)
    syncNow().then((r) => { if (r.ok || ('off' in r && r.off)) useStore.getState().migratePins(); useStore.getState().ensureDefaultPreset(); });
    runAutoBackup();
    // chỉ đồng bộ khi có bản ghi mới vào hàng chờ (không phải khi vừa nhận dữ liệu từ máy chủ)
    const unsub = useStore.subscribe((s, prev) => {
      if (s.pending !== prev.pending && Object.keys(s.pending).length > Object.keys(prev.pending || {}).length) scheduleSync();
    });
    return unsub;
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }
  return <>{children}</>;
}

const APP_ROUTES = ['index', 'truck/[id]', 'history/[id]', 'settings/index', 'settings/users', 'settings/drivers', 'settings/sellers', 'settings/google',
  'settings/presets', 'settings/products', 'settings/warehouses', 'debts/index', 'debts/[sellerId]', 'reports/index', 'inventory/index', 'search/index'];

export default function RootLayout() {
  const user = useStore(selectCurrentUser);
  const loggedIn = !!user;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
          {/* chưa đăng nhập → chỉ vào được login; đã đăng nhập → không vào lại login */}
          <Stack.Protected guard={loggedIn}>
            {APP_ROUTES.map((name) => <Stack.Screen key={name} name={name} />)}
          </Stack.Protected>
          <Stack.Protected guard={!loggedIn}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </AuthGate>
      <ToastHost />
    </SafeAreaProvider>
  );
}
