import { Stack, useRouter, useSegments } from 'expo-router';
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
  const user = useStore(selectCurrentUser);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const onLogin = segments[0] === 'login';
    if (!user && !onLogin) router.replace('/login');
    else if (user && onLogin) router.replace('/');
  }, [hydrated, user, segments, router]);

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
      </AuthGate>
      <ToastHost />
    </SafeAreaProvider>
  );
}
