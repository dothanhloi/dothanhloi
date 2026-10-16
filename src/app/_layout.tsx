import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/ui';
import { selectCurrentUser, useStore } from '../lib/store';
import { scheduleSync, syncNow } from '../lib/sync';
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
    syncNow();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.trucks !== prev.trucks || s.users !== prev.users || s.drivers !== prev.drivers || s.presets !== prev.presets) scheduleSync();
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
