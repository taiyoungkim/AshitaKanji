// Design Ref: §6 State Management + §2 Layer Architecture — root layout
// Plan SC: 앱 시작 시 DB 초기화 (번들 jlpt.db 복사 + 마이그레이션)
//
// Root: QueryClientProvider + RootErrorBoundary + DB init gate.

import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { queryClient } from '~/lib/queryClient';
import { RootErrorBoundary } from '~/lib/errorBoundary';
import { initAds } from '~/lib/ads/interstitialManager';
import { getDatabase } from '~/db/open';
import { ToastProvider } from '~/components/Toast';
import { colors, typography } from '~/design/tokens';

export default function RootLayout(): React.ReactNode {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  // TTS가 무음 스위치(벨소리 OFF)에서도 나오도록 오디오 세션을 playback 으로.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch((err: unknown) => {
      console.warn('[audio] setAudioMode failed:', err);
    });
  }, []);

  // 광고 SDK 초기화 (iOS ATT 동의 → AdMob init). 실패해도 앱 동작 무영향.
  useEffect(() => {
    void initAds();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then(() => {
        if (!cancelled) setDbReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setDbError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dbError) {
    // DB 초기화 실패 — 에러 바운더리로 전달
    throw dbError;
  }

  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>준비 중…</Text>
      </View>
    );
  }

  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text, fontWeight: typography.h2.fontWeight },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="intro" options={{ headerShown: false }} />
          <Stack.Screen name="tutorial" options={{ headerShown: false }} />
          <Stack.Screen
            name="study"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="done"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="scan"
            options={{ headerShown: true, title: '빠른 훑기', headerBackTitle: '뒤로' }}
          />
          <Stack.Screen
            name="reading"
            options={{ headerShown: true, title: '회독', headerBackTitle: '뒤로' }}
          />
          <Stack.Screen
            name="reading-study"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="weakness"
            options={{ headerShown: true, title: '약점 복습', headerBackTitle: '뒤로' }}
          />
          <Stack.Screen
            name="word/[id]"
            options={{ headerShown: true, title: '단어 상세', headerBackTitle: '뒤로' }}
          />
          <Stack.Screen
            name="onigiri/[id]"
            options={{ headerShown: true, title: 'ONIGIRI', headerBackTitle: '뒤로' }}
          />
          <Stack.Screen
            name="trace/[literal]"
            options={{
              headerShown: true,
              title: '따라쓰기',
              // 시트로 뜨면 세로 드로잉이 닫기 제스처를 발동 → 풀스크린 + 제스처 끔.
              presentation: 'fullScreenModal',
              gestureEnabled: false,
              // 풀스크린 모달 — 기본 뒤로 대신 좌측 X 아이콘으로 닫기.
              headerBackVisible: false,
              headerLeft: () => (
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                  style={styles.headerCloseBtn}
                >
                  <Text style={styles.headerClose}>✕</Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="about"
            options={{ headerShown: true, title: '앱 정보', headerBackTitle: '뒤로' }}
          />
        </Stack>
        </ToastProvider>
      </QueryClientProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: { marginTop: 12, ...typography.small, color: colors.textSecondary },
  headerCloseBtn: { paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  headerClose: { fontSize: 20, lineHeight: 24, color: colors.text, textAlign: 'center', minWidth: 24 },
});
